"use client";

/**
 * Road to Worlds — the Club dashboard: identity, reputation track, the
 * Progression Track (design v0.1 — everything ahead, never hidden), trophy
 * room (the empty Worlds pedestal visible from day one), records, season
 * history and career settings.
 *
 * v0.2 UX pass: rep bar with gate ticks, three-state gear ladder
 * (owned / unlocked-available / locked).
 * NOTE: "Edit crest" stays out until the store grows an identity action —
 * there is no mutation path for identity.colors yet (see build report).
 *
 * Layout (DESIGN.md): the identity board first and largest, the career's
 * records as figures on the same board; then one column for what the club
 * has won (trophies, achievements) and one for what its reputation opens
 * next; the season table and the settings close the page.
 */

import { AchievementCard } from "@/components/AchievementsGrid";
import { AchievementIcon } from "@/components/AchievementIcon";
import { achievementStyle } from "@/components/achievementStyle";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { CareerLifetimeStats } from "@/engine/career/types";
import { useActiveCareerCopy } from "@/components/career/orgCopy";
import { useCopy } from "@/content/copy";
import { formatMoney } from "@/lib/format";
import { cx } from "@/lib/util";
import { useMounted } from "@/store/useMounted";
import { CAREER_ACHIEVEMENTS } from "@/data/career/achievements";
import { useCareerStore } from "@/store/careerStore";
import { Badge, CountryChip } from "@/components/ui/Badge";
import { Button, buttonClass } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { CheckIcon, LockIcon } from "@/components/ui/icons";
import { Panel, SectionTitle } from "@/components/ui/Panel";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { REGION_BADGE } from "@/components/regionStyle";
import { CAREER_BOARD } from "@/config/balance";
import { establishedOf, standingOf } from "@/engine/career/established";
import { StandingTrack } from "@/components/career/board/BoardParts";
import { OperationsSummary } from "@/components/career/finances/Operations";
import { TeamStars } from "@/components/career/TeamStars";
import { UserOrgMark } from "@/components/career/OrgMark";
import { CareerShareButton } from "@/components/career/share/CareerShareButton";
import { unlockTrack, useCareerSave, userStars } from "@/components/career/careerUi";

// ---------------------------------------------------------------------------
// Small bits
// ---------------------------------------------------------------------------

/** A record set as a number: the figure large, its label quiet under it. */
function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col-reverse">
      <dt className="kicker mt-2">{label}</dt>
      <dd className="display truncate text-3xl font-bold leading-none text-ink">{value}</dd>
    </div>
  );
}

/** Open-ring "available" marker: unlocked by rep, not yet bought (the shared set has no such glyph). */
function AvailableIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden>
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
  // Job: the club's record (who it is, what it has won, how far its reputation has come). The one thing to read for a decision: what the next reputation gate unlocks.
  const achievements = useCareerStore((s) => s.achievements);
  const copy = useActiveCareerCopy();
  // rc.36 (UX-05, #155): the achievements' words live in the core copy (one source with the general list).
  const { ACH_UI } = useCopy();
  const mounted = useMounted();
  const save = useCareerSave();
  const activeSlot = useCareerStore((s) => s.activeSlot);
  const deleteSlot = useCareerStore((s) => s.deleteSlot);
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Phone: the list of 22 shows its first rows until the player asks for the rest.
  const [allAchievements, setAllAchievements] = useState(false);

  if (!mounted) {
    return (
      <div className="mx-auto max-w-6xl px-3 py-6 sm:px-4">
        <div className="space-y-4" aria-busy>
          <div className="h-10 w-48 animate-pulse rounded-lg bg-white/5" />
          <div className="h-40 animate-pulse rounded-xl bg-white/5" />
          <div className="grid gap-4 md:grid-cols-5">
            <div className="h-72 animate-pulse rounded-xl bg-white/5 md:col-span-3" />
            <div className="h-72 animate-pulse rounded-xl bg-white/5 md:col-span-2" />
          </div>
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

  // rc.6 (ORGMODE UI-C): what a promotion changes, from the board's own numbers.
  const established = establishedOf(save);
  const standing = standingOf(save);
  const promotionNote = !standing
    ? undefined
    : standing.next
      ? copy.orgmode.club.promotes(Math.round((CAREER_BOARD.standing.budgetStep.up - 1) * 100), CAREER_BOARD.profiles[standing.next.tier].signCap)
      : copy.orgmode.club.top(Math.round((1 - CAREER_BOARD.standing.budgetStep.down) * 100));

  const stats: CareerLifetimeStats = save.stats;
  const titlesTotal =
    stats.titlesT3 + stats.titlesT2 + stats.titlesRegional + stats.titlesMajor + stats.titlesWorlds;
  const shelf = [
    { key: "major", count: stats.titlesMajor },
    { key: "regional", count: stats.titlesRegional },
    { key: "t2", count: stats.titlesT2 },
    { key: "t3", count: stats.titlesT3 },
  ] as const;
  const worldsWon = stats.titlesWorlds > 0;
  const achievementsDone = CAREER_ACHIEVEMENTS.filter((a) => achievements.unlocked[a.id]).length;

  const onAbandon = () => {
    if (activeSlot === null) return;
    setConfirmOpen(false);
    deleteSlot(activeSlot);
    router.push("/");
  };

  return (
    <div className="rise-in mx-auto max-w-6xl px-3 py-6 sm:px-4">
      <SectionTitle title={copy.club.title} className="mb-6" />

      {/* 1. Identity: the crest and the name lead the page; the career's
          records sit on the same board as a strip of figures. */}
      <Panel strong className="mb-6 grid gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-8">
        <div className="flex min-w-0 flex-col items-center gap-4 sm:flex-row sm:gap-5">
          <UserOrgMark
            identity={save.identity}
            seasonIndex={save.clock.seasonIndex}
            size="xl"
            className="shrink-0"
          />
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <h3 className="display text-3xl font-bold leading-[1.05] text-ink [overflow-wrap:anywhere] sm:text-4xl">
              {save.identity.orgName}
            </h3>
            <p className="mt-2.5 flex flex-wrap items-center justify-center gap-2 text-sm text-sub sm:justify-start">
              <span>{copy.club.manager}</span>
              <span className="font-semibold text-ink">{save.identity.managerName}</span>
              <CountryChip code={save.identity.country} />
            </p>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2.5 sm:justify-start">
              <Badge className={REGION_BADGE[save.identity.region]}>{save.identity.region}</Badge>
              {/* rc.36 (POL-02, Miguel on rc.35): the stars only — no "0.5-star org" text (its words stay the stars' accessible name). */}
              <TeamStars stars={stars} size="md" label={copy.club.starLabel(stars)} />
            </div>
            {/* v2.2 share kit: the club's card, post or story. */}
            <CareerShareButton save={save} size="sm" className="mt-4" />
          </div>
        </div>
        <dl
          aria-label={copy.club.records}
          className="grid grid-cols-2 gap-x-8 gap-y-4 border-t border-line pt-4 sm:grid-cols-4 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0"
        >
          <Figure label={copy.club.recordTitles} value={String(titlesTotal)} />
          <Figure label={copy.club.recordSeries} value={`${stats.seriesWins}–${stats.seriesLosses}`} />
          <Figure label={copy.club.recordPrize} value={formatMoney(stats.totalPrize, { compact: true })} />
          <Figure label={copy.club.recordBiggestFee} value={formatMoney(stats.biggestSigningFee, { compact: true })} />
        </dl>
      </Panel>

      <div className="mb-6 grid grid-cols-1 items-start gap-x-6 gap-y-6 md:grid-cols-5">
        {/* Primary column: what the club has won. */}
        <div className="flex min-w-0 flex-col gap-6 max-md:contents md:col-span-3">
          {/* 2. Trophy room: the Worlds pedestal (visible from day one, design §11)
              beside the shelf. Trophies are rewards and keep their gold. */}
          <Panel data-tour="club-trophies" className="p-4 max-md:order-1 sm:p-5">
            <div className="card-head"><h3 className="card-title">{copy.club.trophies}</h3></div>
            <div className="mt-4 grid gap-5 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)] sm:items-stretch">
              <div
                className={cx(
                  "flex flex-col items-center justify-center px-3 py-4 text-center",
                  worldsWon
                    ? "rounded-lg border border-amber-400/50 bg-amber-400/10 shadow-[0_0_28px_rgba(251,191,36,0.15)]"
                    : "sm:border-r sm:border-line",
                )}
              >
                <WorldsPedestal
                  won={worldsWon}
                  className={cx(
                    "h-14 w-14",
                    worldsWon ? "text-amber-300 drop-shadow-[0_0_10px_rgba(251,191,36,0.5)]" : "text-faint",
                  )}
                />
                {worldsWon ? (
                  <p className="display mt-2 text-3xl font-bold leading-none text-amber-300">
                    {stats.titlesWorlds}
                  </p>
                ) : null}
                <p className={cx("mt-1.5 text-xs leading-snug", worldsWon ? "text-amber-300" : "text-sub")}>
                  {worldsWon ? copy.common.tier.worlds : copy.club.worldsPedestal}
                </p>
              </div>

              <ul className="grid grid-cols-2 gap-y-4 sm:grid-cols-4">
                {shelf.map((t) => (
                  <li
                    key={t.key}
                    className="flex min-w-0 flex-col items-center justify-center px-2 text-center sm:border-l sm:border-line sm:first:border-l-0"
                  >
                    <TrophyCup
                      dashed={t.count === 0}
                      className={cx("h-9 w-9", t.count > 0 ? TROPHY_TINT[t.key] : "text-faint")}
                    />
                    <p
                      className={cx(
                        "display mt-2 text-3xl font-bold leading-none",
                        t.count > 0 ? "text-ink" : "text-faint",
                      )}
                    >
                      {t.count}
                    </p>
                    <p className="mt-1.5 text-xs leading-snug text-sub">{copy.common.tier[t.key]}</p>
                  </li>
                ))}
              </ul>
            </div>
            {titlesTotal === 0 ? <p className="mt-4 border-t border-line pt-4 text-sm text-faint">{copy.club.trophyEmpty}</p> : null}
          </Panel>

          {/* 3. Career achievements (v2.0 R32): each one is its own card, so the section needs no board. */}
          {/* Phone: after the reputation board (`order`); the list shows its first
              six rows and a key for the rest (it was 2,250px of the screen). */}
          <section className="max-md:order-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h3 className="card-title">{copy.achievements.title}</h3>
              <span className="text-sm text-sub">
                {copy.achievements.progress(achievementsDone, CAREER_ACHIEVEMENTS.length)}
              </span>
            </div>
            <p className="mt-1.5 max-w-prose text-sm leading-snug text-faint">{copy.achievements.hint}</p>
            {/* rc.6 (R171): an established org earns none of them; the board stays (the account's collection). */}
            {established ? <p className="mt-1 max-w-prose text-sm leading-snug text-sub">{copy.achievements.foundedOnly}</p> : null}
            <div data-all={allAchievements} className="club-achievements mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {CAREER_ACHIEVEMENTS.map((a) => {
                const at = achievements.unlocked[a.id];
                const item = ACH_UI.careerItems[a.id] ?? { name: a.id, desc: "" };
                return (
                  <AchievementCard
                    key={a.id}
                    earned={Boolean(at)}
                    style={achievementStyle({ id: a.id, category: a.tier })}
                    icon={<AchievementIcon group="career" id={a.id} className="h-5 w-5" />}
                    title={item.name}
                    tier={ACH_UI.careerTier[a.tier]}
                    body={item.desc}
                    foot={at ? copy.achievements.unlockedOn(new Date(at).toLocaleDateString()) : copy.achievements.xp(a.xp)}
                  />
                );
              })}
            </div>
            <button
              type="button"
              aria-expanded={allAchievements}
              onClick={() => setAllAchievements((v) => !v)}
              className={cx(buttonClass("secondary", "sm"), "mt-3 w-full sm:hidden")}
            >
              {allAchievements ? copy.achievements.showLess : copy.achievements.showAll(CAREER_ACHIEVEMENTS.length)}
            </button>
          </section>
        </div>

        {/* Secondary column: reputation and the Progression Track (the unlock
            ladder, never hidden) on one board, the track as a plain list. */}
        <div data-tour="club-progress" className="min-w-0 max-md:order-2 md:col-span-2">
          {/* rc.6 (ORGMODE UI-C): an established org shows its Standing and its Operations; nothing here is unlocked. */}
          {established ? (
            <div className="flex min-w-0 flex-col gap-4">
              <StandingTrack save={save} C={copy} note={promotionNote} />
              <OperationsSummary save={save} C={copy} />
            </div>
          ) : (
          <Panel className="p-4 sm:p-5">
            <div className="card-head"><h3 className="card-title">{copy.club.reputation}</h3></div>
            <p className="display mt-1 text-5xl font-bold leading-none text-ink">
              <AnimatedNumber value={rep} />
              <span className="ml-1.5 text-base font-semibold text-faint">/ 100</span>
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
              <p className="mt-2.5 text-sm text-sub">
                {copy.club.repNext(nextGate.gate, unlockLabels[nextGate.key] ?? nextGate.key)}
              </p>
            ) : null}

            <div className="mt-5 border-t border-line pt-4">
              <h3 className="card-title">{copy.club.progression}</h3>
              <ul className="mt-2">
                {track.map((entry) => {
                  const owned = entry.unlocked && entry.owned === true;
                  const available = entry.unlocked && entry.owned === false;
                  return (
                    <li
                      key={entry.key}
                      className="flex min-h-11 items-center gap-3 border-b border-line py-2 last:border-b-0"
                    >
                      {available ? (
                        <AvailableIcon className="h-5 w-5 shrink-0 text-blue-bright" />
                      ) : entry.unlocked ? (
                        <CheckIcon className="h-5 w-5 shrink-0 text-good" />
                      ) : (
                        <LockIcon className="h-5 w-5 shrink-0 text-faint" />
                      )}
                      <span className={cx("min-w-0 flex-1 truncate text-sm", entry.unlocked ? "text-ink" : "text-sub")}>
                        {unlockLabels[entry.key] ?? entry.key}
                      </span>
                      {owned ? (
                        <span className="shrink-0 text-xs text-sub">{copy.finances.ownedLabel}</span>
                      ) : available ? (
                        <Badge tone="blue" className="shrink-0">
                          {copy.club.unlocked}
                        </Badge>
                      ) : entry.unlocked ? (
                        <span className="shrink-0 text-xs text-good">{copy.club.unlocked}</span>
                      ) : entry.future ? (
                        <span className="flex shrink-0 items-center gap-2">
                          <span className="hidden text-xs text-faint sm:block">{copy.club.unlockWorlds}</span>
                          <Badge>{copy.club.unlockFuture}</Badge>
                        </span>
                      ) : (
                        <span className="shrink-0 text-xs text-sub">{copy.club.unlockAt(entry.gate)}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </Panel>
          )}
        </div>
      </div>

      {/* 4. Season history: one row per finished season, the points column carrying the weight. */}
      {save.history.length > 0 ? (
        <Panel className="mb-6 p-4 sm:p-5">
          <div className="card-head"><h3 className="card-title">{copy.club.seasonHistory}</h3></div>
          <div className="mt-3 min-w-0">
            <table className="mobile-history-table w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-line-strong">
                  <th aria-label={copy.club.seasonHistory} className="px-2 pb-2" />
                  <th className="kicker px-2 pb-2 text-center">#</th>
                  <th className="kicker px-2 pb-2 text-right">{copy.common.seasonPoints}</th>
                  <th className="kicker px-2 pb-2 text-right">{copy.common.tier.worlds}</th>
                  <th className="kicker px-2 pb-2 text-right">{copy.common.prize}</th>
                </tr>
              </thead>
              <tbody>
                {save.history.map((h) => (
                  <tr key={h.seasonIndex} className="border-b border-line last:border-b-0">
                    <td className="px-2 py-2.5">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-semibold text-ink">{h.label}</span>
                        <Badge tone={GRADE_TONE[h.grade] ?? "neutral"}>{h.grade}</Badge>
                        {h.userWorldsPlacement === "champion" ? (
                          <Badge tone="gold">{copy.saves.champion}</Badge>
                        ) : null}
                      </span>
                    </td>
                    <td data-label="#" className="display px-2 py-2.5 text-center font-semibold text-sub">
                      #{h.userRegionRank}
                    </td>
                    <td data-label={copy.common.seasonPoints} className="display px-2 py-2.5 text-right text-lg font-bold leading-none text-ink">
                      {h.userSeasonPoints}
                    </td>
                    <td data-label={copy.common.tier.worlds} className="px-2 py-2.5 text-right text-xs text-sub">
                      {h.userWorldsPlacement
                        ? (copy.common.placement as Record<string, string>)[
                            h.userWorldsPlacement
                          ] ?? h.userWorldsPlacement
                        : "–"}
                    </td>
                    <td data-label={copy.common.prize} className="px-2 py-2.5 text-right text-xs font-semibold text-good">
                      {formatMoney(h.earnings, { compact: true })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : null}

      {/* 5. Career settings: one destructive action, kept apart at the foot of the page. */}
      <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6">
        <h3 className="card-title">{copy.club.settings}</h3>
        {/* rc9 MATCHDAY: the matchday setting moved to the Training screen. */}
        <Button variant="danger" size="sm" onClick={() => setConfirmOpen(true)}>
          {copy.club.abandonCareer}
        </Button>
      </div>

      <Modal
        open={confirmOpen}
        title={copy.club.abandonCareer}
        onClose={() => {
          setConfirmOpen(false);
        }}
        actions={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setConfirmOpen(false);
              }}
            >
              {copy.common.cancel}
            </Button>
            <Button variant="danger" onClick={onAbandon}>
              {copy.common.confirm}
            </Button>
          </>
        }
      >
        <p>{copy.club.abandonConfirm}</p>
        <p className="mt-2 text-xs text-faint">
          {copy.saves.deleteConfirm(save.identity.orgName, save.clock.seasonIndex - (save.startSeasonIndex ?? 0) + 1)}
        </p>
      </Modal>
    </div>
  );
}
