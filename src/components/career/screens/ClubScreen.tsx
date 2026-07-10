"use client";

/**
 * Road to Worlds — the Club dashboard: identity, reputation track, the
 * Progression Track (design v0.1 — everything ahead, never hidden), trophy
 * room (the empty Worlds pedestal visible from day one), records, season
 * history and career settings.
 *
 * v0.2 UX pass: org-colored identity glow, rep bar with gate ticks, three-state
 * gear ladder (owned / unlocked-available / locked), staggered entrances.
 * NOTE: "Edit crest" stays out until the store grows an identity action —
 * there is no mutation path for identity.colors yet (see build report).
 */

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { CareerLifetimeStats } from "@/engine/career/types";
import { useCopy } from "@/content/copy";
import { formatMoney } from "@/lib/format";
import { cx } from "@/lib/util";
import { useMounted } from "@/store/useMounted";
import { useCareerStore } from "@/store/careerStore";
import { Badge, CountryChip } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Panel, SectionTitle } from "@/components/ui/Panel";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { REGION_BADGE } from "@/components/regionStyle";
import { TeamStars } from "@/components/career/TeamStars";
import { UserCrest } from "@/components/career/UserCrest";
import { unlockTrack, useCareerSave, userStars } from "@/components/career/careerUi";

// ---------------------------------------------------------------------------
// Small bits
// ---------------------------------------------------------------------------

function StatTile({ label, value, delay }: { label: string; value: string; delay?: number }) {
  return (
    <Panel
      className="rise-in p-4 text-center"
      style={delay ? { animationDelay: `${delay}ms` } : undefined}
    >
      <p className="kicker !text-[10px]">{label}</p>
      <p className="display mt-1 truncate text-2xl font-bold text-ink">{value}</p>
    </Panel>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden>
      <path d="m5 13 4 4 10-10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden>
      <rect x="6" y="11" width="12" height="9" rx="2" />
      <path d="M9 11V8a3 3 0 0 1 6 0v3" strokeLinecap="round" />
    </svg>
  );
}

/** Open-ring "available" marker: unlocked by rep, not yet bought. */
function AvailableIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden>
      <circle cx="12" cy="12" r="8" strokeDasharray="3.4 3.4" />
      <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Hand-drawn trophy cup, tint via currentColor (house icon style). */
function TrophyCup({ className, dashed }: { className?: string; dashed?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      strokeDasharray={dashed ? "2.6 2.6" : undefined}
      aria-hidden
    >
      <path d="M8 4h8v4.5a4 4 0 0 1-8 0V4Z" />
      <path d="M8 5H5.5a2.5 2.5 0 0 0 2.8 3.4M16 5h2.5a2.5 2.5 0 0 1-2.8 3.4" />
      <path d="M12 12.5V16M9 19.5h6M10.5 16h3" />
    </svg>
  );
}

/** The Worlds cup on its pedestal — golden when won, silhouette until then. */
function WorldsPedestal({ won, className }: { won: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <g strokeDasharray={won ? undefined : "3 3"}>
        <path d="M18 6h12v6.5a6 6 0 0 1-12 0V6Z" />
        <path d="M18 7.5h-3.5a3.5 3.5 0 0 0 4 4.8M30 7.5h3.5a3.5 3.5 0 0 1-4 4.8" />
        <path d="M24 19v4M20 26h8" />
      </g>
      <path d="M15 32h18v4H15ZM11 36h26v5H11Z" strokeDasharray={undefined} />
    </svg>
  );
}

const GRADE_TONE: Record<string, "gold" | "good" | "blue" | "neutral" | "bad"> = {
  S: "gold",
  A: "good",
  B: "blue",
  C: "neutral",
  D: "bad",
};

const TROPHY_TINT: Record<string, string> = {
  major: "text-amber-400",
  regional: "text-[#c9d3e0]",
  t2: "text-[#d09a66]",
  t3: "text-[#a97a4e]",
};

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export function ClubScreen() {
  const copy = useCopy().CAREER;
  const mounted = useMounted();
  const save = useCareerSave();
  const activeSlot = useCareerStore((s) => s.activeSlot);
  const deleteSlot = useCareerStore((s) => s.deleteSlot);
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [typed, setTyped] = useState("");

  if (!mounted) {
    return (
      <div className="mx-auto max-w-6xl px-3 py-6 sm:px-4">
        <div className="space-y-4" aria-busy>
          <div className="h-10 w-48 animate-pulse rounded-lg bg-white/5" />
          <div className="h-40 animate-pulse rounded-2xl bg-white/5" />
          <div className="grid gap-4 md:grid-cols-5">
            <div className="h-72 animate-pulse rounded-2xl bg-white/5 md:col-span-2" />
            <div className="h-72 animate-pulse rounded-2xl bg-white/5 md:col-span-3" />
          </div>
          <div className="h-40 animate-pulse rounded-2xl bg-white/5" />
        </div>
      </div>
    );
  }
  if (!save) return null;

  const stars = userStars(save);
  const rep = Math.round(save.reputation);
  const track = [...unlockTrack(save)].sort((a, b) => a.gate - b.gate);
  const nextGate = track.filter((e) => !e.unlocked && !e.future).sort((a, b) => a.gate - b.gate)[0];
  const unlockLabels = copy.club.unlockables as Record<string, string>;
  // Rep-bar tick marks: every distinct gate on a 0..100 scale.
  const gateTicks = [...new Set(track.map((e) => e.gate))].filter((g) => g > 0 && g < 100);

  const stats: CareerLifetimeStats = save.stats;
  const titlesTotal =
    stats.titlesT3 + stats.titlesT2 + stats.titlesRegional + stats.titlesMajor + stats.titlesWorlds;
  const shelf = [
    { key: "major", count: stats.titlesMajor },
    { key: "regional", count: stats.titlesRegional },
    { key: "t2", count: stats.titlesT2 },
    { key: "t3", count: stats.titlesT3 },
  ] as const;

  const typedOk = typed.trim().toLowerCase() === save.identity.orgName.trim().toLowerCase();
  const onAbandon = () => {
    if (activeSlot === null) return;
    setConfirmOpen(false);
    deleteSlot(activeSlot);
    router.push("/");
  };

  return (
    <div className="rise-in mx-auto max-w-6xl px-3 py-6 sm:px-4">
      <SectionTitle kicker={copy.meta.title} title={copy.club.title} className="mb-5" />

      {/* 1 — Identity (wears the org's own colors) */}
      <Panel strong glow="blue" className="relative mb-4 overflow-hidden p-6">
        <div
          aria-hidden
          className="pointer-events-none absolute -left-14 -top-14 h-52 w-52 rounded-full opacity-20 blur-3xl"
          style={{
            background: `radial-gradient(circle, ${save.identity.colors.primary}, transparent 70%)`,
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-16 -right-16 h-48 w-48 rounded-full opacity-10 blur-3xl"
          style={{
            background: `radial-gradient(circle, ${save.identity.colors.secondary}, transparent 70%)`,
          }}
        />
        <div className="relative flex flex-col items-center gap-6 sm:flex-row">
          <UserCrest
            crestId={save.identity.crestId}
            colors={save.identity.colors}
            abbrev={save.identity.abbrev}
            size="xl"
            className="shrink-0 drop-shadow-[0_10px_24px_rgba(0,0,0,0.45)]"
          />
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <p className="kicker mb-1">{copy.club.identity}</p>
            <h3 className="display truncate text-3xl font-bold uppercase tracking-wide text-ink">
              {save.identity.orgName}
            </h3>
            <p className="mt-2 flex flex-wrap items-center justify-center gap-2 text-sm text-sub sm:justify-start">
              <span className="kicker !text-[10px]">{copy.club.manager}</span>
              <span className="font-semibold text-ink">{save.identity.managerName}</span>
              <CountryChip code={save.identity.country} />
            </p>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <Badge className={REGION_BADGE[save.identity.region]}>{save.identity.region}</Badge>
              <Badge>{copy.wizard.founded}</Badge>
              <span className="inline-flex items-center gap-1.5">
                <TeamStars stars={stars} size="md" />
                <span className="text-xs font-semibold text-sub">{copy.club.starLabel(stars)}</span>
              </span>
            </div>
          </div>
        </div>
      </Panel>

      <div className="mb-4 grid gap-4 md:grid-cols-5">
        {/* 2 — Reputation track */}
        <div className="flex flex-col gap-4 md:col-span-2">
          <Panel className="rise-in p-5" style={{ animationDelay: "60ms" }}>
            <p className="kicker mb-1">{copy.club.reputation}</p>
            <p className="display text-4xl font-bold text-ink">
              <AnimatedNumber value={rep} />
              <span className="ml-2 align-middle text-sm font-semibold text-faint">/ 100</span>
            </p>
            {/* 0..100 scale with a tick on every unlock gate — the whole road. */}
            <div className="relative mt-3">
              <ProgressBar value={rep / 100} tone="orange" label={copy.club.reputation} />
              {gateTicks.map((g) => (
                <span
                  key={g}
                  aria-hidden
                  className={cx(
                    "absolute top-1/2 h-3 w-px -translate-y-1/2",
                    rep >= g ? "bg-white/50" : "bg-white/20",
                  )}
                  style={{ left: `${g}%` }}
                />
              ))}
            </div>
            {nextGate ? (
              <p className="mt-2 text-xs text-sub">
                {copy.club.repNext(nextGate.gate, unlockLabels[nextGate.key] ?? nextGate.key)}
              </p>
            ) : null}
          </Panel>

          {/* 5 — Records */}
          <div>
            <p className="kicker mb-2">{copy.club.records}</p>
            <div className="grid grid-cols-2 gap-3">
              <StatTile
                label={copy.club.recordPrize}
                value={formatMoney(stats.totalPrize, { compact: true })}
                delay={90}
              />
              <StatTile
                label={copy.club.recordSeries}
                value={`${stats.seriesWins}–${stats.seriesLosses}`}
                delay={120}
              />
              <StatTile
                label={copy.club.recordBiggestFee}
                value={formatMoney(stats.biggestSigningFee, { compact: true })}
                delay={150}
              />
              <StatTile label={copy.club.recordTitles} value={String(titlesTotal)} delay={180} />
            </div>
          </div>
        </div>

        {/* 3 — Progression Track (the unlock ladder, never hidden) */}
        <Panel className="rise-in p-5 md:col-span-3" style={{ animationDelay: "90ms" }}>
          <p className="kicker mb-0.5">{copy.club.progression}</p>
          <p className="mb-3 text-xs text-faint">{copy.club.progressionDesc}</p>
          <ul>
            {track.map((entry) => {
              const owned = entry.unlocked && entry.owned === true;
              const available = entry.unlocked && entry.owned === false;
              return (
                <li
                  key={entry.key}
                  className={cx(
                    "flex min-h-11 items-center gap-3 border-b border-line py-2 last:border-b-0",
                    owned && "bg-orange/[0.04]",
                  )}
                >
                  {owned ? (
                    <CheckIcon className="h-5 w-5 shrink-0 text-orange-bright" />
                  ) : available ? (
                    <AvailableIcon className="h-5 w-5 shrink-0 text-blue-bright" />
                  ) : entry.unlocked ? (
                    <CheckIcon className="h-5 w-5 shrink-0 text-good" />
                  ) : (
                    <LockIcon className="h-5 w-5 shrink-0 text-faint" />
                  )}
                  <span
                    className={cx(
                      "min-w-0 flex-1 truncate text-sm",
                      owned
                        ? "font-semibold text-orange-bright"
                        : entry.unlocked
                          ? "font-semibold text-ink"
                          : "text-faint",
                    )}
                  >
                    {unlockLabels[entry.key] ?? entry.key}
                  </span>
                  {owned ? (
                    <Badge tone="orange" className="shrink-0 !px-1.5 !text-[9px]">
                      {copy.finances.ownedLabel}
                    </Badge>
                  ) : available ? (
                    <Badge tone="blue" className="shrink-0 !px-1.5 !text-[9px]">
                      {copy.club.unlocked}
                    </Badge>
                  ) : entry.unlocked ? (
                    <span className="kicker !text-[9px] text-good">{copy.club.unlocked}</span>
                  ) : entry.future ? (
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="hidden text-[11px] text-faint sm:block">
                        {copy.club.unlockWorlds}
                      </span>
                      <Badge tone="gold" className="!text-[9px]">
                        {copy.club.unlockFuture}
                      </Badge>
                    </span>
                  ) : (
                    <span className="shrink-0 text-[11px] text-sub">
                      {copy.club.unlockAt(entry.gate)}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>

      {/* 4 — Trophy room */}
      <Panel className="rise-in mb-4 p-5" style={{ animationDelay: "150ms" }}>
        <p className="kicker mb-3">{copy.club.trophies}</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {/* The Worlds pedestal — visible from day one (design §11). */}
          <div
            className={cx(
              "col-span-2 flex flex-col items-center justify-center rounded-xl border p-4 text-center transition-colors sm:col-span-1",
              stats.titlesWorlds > 0
                ? "border-amber-400/50 bg-amber-400/10 shadow-[0_0_28px_rgba(251,191,36,0.15)]"
                : "border-dashed border-line-strong bg-white/3",
            )}
          >
            <WorldsPedestal
              won={stats.titlesWorlds > 0}
              className={cx(
                "h-14 w-14",
                stats.titlesWorlds > 0
                  ? "text-amber-300 drop-shadow-[0_0_10px_rgba(251,191,36,0.5)]"
                  : "text-faint",
              )}
            />
            {stats.titlesWorlds > 0 ? (
              <p className="display mt-1 text-2xl font-bold text-amber-300">
                {stats.titlesWorlds}
              </p>
            ) : null}
            <p className={cx("kicker mt-1 !text-[9px]", stats.titlesWorlds > 0 && "text-amber-300")}>
              {stats.titlesWorlds > 0 ? copy.common.tier.worlds : copy.club.worldsPedestal}
            </p>
          </div>

          {shelf.map((t) => (
            <div
              key={t.key}
              className={cx(
                "flex flex-col items-center justify-center rounded-xl border border-line bg-white/3 p-4 text-center transition-all",
                t.count === 0 ? "opacity-45" : "hover:border-line-strong hover:bg-white/5",
              )}
            >
              <TrophyCup
                dashed={t.count === 0}
                className={cx("h-10 w-10", t.count > 0 ? TROPHY_TINT[t.key] : "text-faint")}
              />
              <p className="display mt-1 text-2xl font-bold text-ink">{t.count}</p>
              <p className="kicker mt-1 !text-[9px]">{copy.common.tier[t.key]}</p>
            </div>
          ))}
        </div>
        {titlesTotal === 0 ? (
          <p className="mt-3 text-center text-xs text-faint">{copy.club.trophyEmpty}</p>
        ) : null}
      </Panel>

      {/* 6 — Season history */}
      {save.history.length > 0 ? (
        <Panel className="rise-in mb-4 p-5" style={{ animationDelay: "180ms" }}>
          <p className="kicker mb-3">{copy.club.seasonHistory}</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[30rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-line-strong">
                  <th aria-label={copy.club.seasonHistory} className="px-2 pb-2" />
                  <th className="kicker px-2 pb-2 text-center !text-[9px]">#</th>
                  <th className="kicker px-2 pb-2 text-right !text-[9px]">
                    {copy.common.seasonPoints}
                  </th>
                  <th className="kicker px-2 pb-2 text-right !text-[9px]">
                    {copy.common.tier.worlds}
                  </th>
                  <th className="kicker px-2 pb-2 text-right !text-[9px]">{copy.common.prize}</th>
                </tr>
              </thead>
              <tbody>
                {save.history.map((h) => (
                  <tr key={h.seasonIndex} className="border-b border-line transition-colors hover:bg-white/3">
                    <td className="px-2 py-2.5">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-semibold text-ink">{h.label}</span>
                        <Badge tone={GRADE_TONE[h.grade] ?? "neutral"} className="!px-1.5 !text-[9px]">
                          {h.grade}
                        </Badge>
                        {h.userWorldsPlacement === "champion" ? (
                          <Badge tone="gold" className="!px-1.5 !text-[9px]">
                            {copy.saves.champion}
                          </Badge>
                        ) : null}
                      </span>
                    </td>
                    <td className="display px-2 py-2.5 text-center font-bold text-sub">
                      #{h.userRegionRank}
                    </td>
                    <td className="display px-2 py-2.5 text-right font-bold text-ink">
                      {h.userSeasonPoints}
                    </td>
                    <td className="px-2 py-2.5 text-right text-xs text-sub">
                      {h.userWorldsPlacement
                        ? (copy.common.placement as Record<string, string>)[
                            h.userWorldsPlacement
                          ] ?? h.userWorldsPlacement
                        : "—"}
                    </td>
                    <td className="px-2 py-2.5 text-right text-xs font-semibold text-good">
                      {formatMoney(h.earnings, { compact: true })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : null}

      {/* 7 — Career settings */}
      <Panel className="rise-in p-5" style={{ animationDelay: "210ms" }}>
        <p className="kicker mb-3">{copy.club.settings}</p>
        <Button variant="danger" size="sm" onClick={() => setConfirmOpen(true)}>
          {copy.club.abandonCareer}
        </Button>
      </Panel>

      <Modal
        open={confirmOpen}
        title={copy.club.abandonCareer}
        onClose={() => {
          setConfirmOpen(false);
          setTyped("");
        }}
        actions={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setConfirmOpen(false);
                setTyped("");
              }}
            >
              {copy.common.cancel}
            </Button>
            <Button variant="danger" disabled={!typedOk} onClick={onAbandon}>
              {copy.common.confirm}
            </Button>
          </>
        }
      >
        <p>{copy.club.abandonConfirm}</p>
        <p className="mt-2 text-xs text-faint">
          {copy.saves.deleteConfirm(save.identity.orgName, save.clock.seasonIndex + 1)}
        </p>
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={save.identity.orgName}
          aria-label={copy.club.abandonCareer}
          autoComplete="off"
          className="mt-4 h-11 w-full rounded-lg border border-line-strong bg-white/5 px-3 text-sm text-ink outline-none placeholder:text-faint focus:border-bad/60"
        />
      </Modal>
    </div>
  );
}
