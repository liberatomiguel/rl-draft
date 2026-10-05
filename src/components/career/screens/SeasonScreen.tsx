"use client";

/**
 * Road to Worlds — the season review / ceremony screen (the payoff moment).
 *
 * Five-way hero (insolvency / retired / Worlds won / final whistle / plain
 * review), then the season report card (grade stamp + stats grid + settled
 * season goal), the development recap (per-player OVR + season delta + age),
 * the business recap, and the final region table snapshot — all from the
 * last SeasonRecord in save.history. Actions fork: rollover, defend the
 * title, the infinite-era explainer, or retire.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CareerSave } from "@/engine/career/types";
import { useCareerCopy } from "@/content/careerCopy";
import { useMounted } from "@/store/useMounted";
import { useCareerStore } from "@/store/careerStore";
import { CAREER_SEASONS } from "@/config/balance";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { formatMoney } from "@/lib/format";
import { cx } from "@/lib/util";
import { REGION_BADGE } from "@/components/regionStyle";
import { OrgMark } from "@/components/career/OrgMark";
import { seasonLabelFor, squadAge, useCareerSave } from "@/components/career/careerUi";

// Duplicated from ClubScreen (not exported there) — keep the two in sync.
const GRADE_TONE: Record<string, "gold" | "good" | "blue" | "neutral" | "bad"> = {
  S: "gold",
  A: "good",
  B: "blue",
  C: "neutral",
  D: "bad",
};

/** The big report-card stamp — same tone semantics as GRADE_TONE / Badge. */
const GRADE_STAMP: Record<string, string> = {
  S: "border-amber-400/50 bg-amber-400/10 text-amber-300 shadow-[0_0_24px_rgba(251,191,36,0.18)]",
  A: "border-good/40 bg-good/10 text-good",
  B: "border-blue/40 bg-blue/10 text-blue-bright",
  C: "border-line-strong bg-white/5 text-sub",
  D: "border-bad/40 bg-bad/10 text-bad",
};

export function SeasonScreen() {
  const mounted = useMounted();
  const save = useCareerSave();
  const C = useCareerCopy();
  const router = useRouter();
  const continueToNextSeason = useCareerStore((s) => s.continueToNextSeason);
  const continueInfinite = useCareerStore((s) => s.continueInfinite);
  const retireCareer = useCareerStore((s) => s.retireCareer);
  const [infoOpen, setInfoOpen] = useState(false);

  if (!mounted) {
    return (
      <div className="mx-auto max-w-3xl px-3 py-8 sm:px-4">
        <div className="space-y-4" aria-busy>
          <div className="h-52 animate-pulse rounded-2xl bg-white/5" />
          <div className="h-44 animate-pulse rounded-2xl bg-white/5" />
          <div className="grid gap-4 md:grid-cols-5">
            <div className="h-40 animate-pulse rounded-2xl bg-white/5 md:col-span-3" />
            <div className="h-40 animate-pulse rounded-2xl bg-white/5 md:col-span-2" />
          </div>
          <div className="h-12 animate-pulse rounded-lg bg-white/5" />
        </div>
      </div>
    );
  }
  if (!save) return null;

  const last = save.history[save.history.length - 1];
  const ended = save.end.ended;
  const reason = save.end.reason;
  const wonWorlds = reason === "worlds_won";
  const isFinalWhistle = reason === "timeline_complete";
  const isInsolvent = reason === "insolvency";
  const isRetired = reason === "retired";
  const canContinueSeasons = save.clock.seasonIndex < CAREER_SEASONS.length - 1;

  // Season goal — settled at review time (targetMet flips off null in enterSeasonReview).
  const goals = save.seasonGoals;
  const goalLabel =
    goals && typeof (C.goals as Record<string, unknown>)[goals.targetKey] === "string"
      ? ((C.goals as Record<string, unknown>)[goals.targetKey] as string)
      : null;

  const worldsChampionLine =
    !wonWorlds && last?.worldsChampionName ? (
      <div className="mt-4 flex items-center justify-center gap-2.5">
        {last.worldsChampionRef ? (
          <OrgMark save={save} orgRef={last.worldsChampionRef} size="sm" />
        ) : null}
        <p className="text-sm text-sub">{C.ceremonies.worldsChampion(last.worldsChampionName)}</p>
      </div>
    ) : null;

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-3 py-8 sm:px-4">
      {/* 1 — Champion / ending splash (five-way) */}
      <Panel
        strong
        glow={wonWorlds ? "orange" : isInsolvent ? undefined : "blue"}
        className={cx(
          "relative overflow-hidden p-8 text-center sm:p-10",
          isInsolvent && "border-bad/30",
        )}
      >
        {wonWorlds ? <div className="celebrate-rays" aria-hidden /> : null}
        <div className="relative rise-in">
          {isInsolvent ? (
            <>
              <p className="kicker text-[11px] text-bad">
                {last?.label ?? seasonLabelFor(save.clock.seasonIndex)}
              </p>
              <p className="display mt-2 text-3xl font-bold text-bad">
                {C.ceremonies.insolvencyTitle}
              </p>
              <p className="mx-auto mt-3 max-w-md text-sm text-sub">
                {C.ceremonies.insolvencyBody}
              </p>
            </>
          ) : isRetired ? (
            <>
              <OrgMark save={save} orgRef="user" size="lg" className="mx-auto mb-4" />
              <p className="display text-3xl font-bold text-ink">{C.ceremonies.legacyTitle}</p>
              <p className="mx-auto mt-3 max-w-md text-sm text-sub">{C.ceremonies.retireDesc}</p>
            </>
          ) : wonWorlds ? (
            <>
              <OrgMark
                save={save}
                orgRef="user"
                size="lg"
                className="mx-auto mb-4 drop-shadow-[0_10px_30px_rgba(251,191,36,0.35)]"
              />
              <p className="kicker text-[11px] text-amber-300">{last?.label}</p>
              <p className="display mt-2 text-4xl font-bold text-orange-bright drop-shadow-[0_2px_18px_rgba(249,115,22,0.35)]">
                {C.ceremonies.yourTitle}
              </p>
              <p className="display mt-2 text-lg font-bold uppercase tracking-wide text-ink">
                {save.identity.orgName}
              </p>
            </>
          ) : isFinalWhistle ? (
            <>
              <p className="kicker text-[11px]">{last?.label}</p>
              <p className="display mt-2 text-3xl font-bold text-ink">
                {C.ceremonies.finalWhistle}
              </p>
              <p className="mx-auto mt-3 max-w-md text-sm text-sub">
                {C.ceremonies.finalWhistleBody}
              </p>
              {worldsChampionLine}
            </>
          ) : (
            <>
              <p className="kicker text-[11px]">{C.ceremonies.seasonReview}</p>
              <p className="display mt-2 text-3xl font-bold text-ink">{last?.label}</p>
              {worldsChampionLine}
            </>
          )}
          {save.end.legacyGrade ? (
            <div className="mt-4">
              <Badge tone="gold">{C.ceremonies.legacyGrade[save.end.legacyGrade]}</Badge>
            </div>
          ) : null}
        </div>
      </Panel>

      {/* 2 — Season report card: grade stamp + goal settlement + stats grid */}
      {last ? (
        <Panel className="rise-in p-5" style={{ animationDelay: "60ms" }}>
          <div className="flex items-center gap-4">
            <div
              className={cx(
                "flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border",
                GRADE_STAMP[last.grade] ?? GRADE_STAMP.C,
              )}
              aria-label={C.ceremonies.seasonGrade(last.grade)}
            >
              <span className="display text-3xl font-bold">{last.grade}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="kicker !text-[10px]">{C.ceremonies.seasonReview}</p>
              <p className="display truncate text-lg font-bold text-ink">{last.label}</p>
              {goalLabel && goals?.targetMet !== null ? (
                <p
                  className={cx(
                    "mt-0.5 truncate text-xs",
                    goals?.targetMet ? "text-good" : "text-bad",
                  )}
                >
                  {goals?.targetMet
                    ? C.ceremonies.delivered(goalLabel)
                    : C.ceremonies.expected(goalLabel)}
                </p>
              ) : null}
            </div>
            <Badge tone={GRADE_TONE[last.grade] ?? "neutral"} className="hidden shrink-0 sm:inline-flex">
              {C.ceremonies.seasonGrade(last.grade)}
            </Badge>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label={C.standings.seasonTab} value={`#${last.userRegionRank}`} />
            <Stat
              label={C.common.seasonPoints}
              value={<AnimatedNumber value={last.userSeasonPoints} />}
            />
            <Stat
              label={C.finances.balance}
              value={formatMoney(last.balanceEnd, { compact: true })}
              tone={last.balanceEnd < 0 ? "bad" : undefined}
            />
            <Stat
              label={C.common.reputation}
              value={<AnimatedNumber value={Math.round(last.repEnd)} />}
            />
            <Stat
              label={C.calendar.worlds}
              value={
                last.userWorldsPlacement ? C.common.placement[last.userWorldsPlacement] : "—"
              }
              tone={last.userWorldsPlacement === "champion" ? "gold" : undefined}
            />
            <Stat label={C.club.recordTitles} value={<AnimatedNumber value={last.titles} />} />
          </div>
        </Panel>
      ) : null}

      {/* 3+4 — Development recap · business recap */}
      <div className="grid gap-4 md:grid-cols-5">
        {!ended || wonWorlds ? (
          <Panel
            className={cx("rise-in p-5", last ? "md:col-span-3" : "md:col-span-5")}
            style={{ animationDelay: "120ms" }}
          >
            <div className="mb-2 flex items-baseline justify-between">
              <p className="kicker !text-[10px]">{C.ceremonies.devRecap}</p>
              <span className="kicker !text-[9px] text-faint">{C.common.ovr}</span>
            </div>
            <ul>
              {[...save.squad]
                .sort((a, b) => b.overall - a.overall)
                .map((p) => {
                  const delta = Math.round(p.gainedThisSeason * 10) / 10;
                  return (
                    <li
                      key={p.id}
                      className="flex items-center gap-3 border-b border-line py-2 transition-colors last:border-b-0 hover:bg-white/3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-ink">{p.name}</p>
                        <p className="truncate text-[11px] text-faint">
                          {C.player.age(squadAge(save, p))} · {C.player.archetype[p.archetype]}
                        </p>
                      </div>
                      {delta > 0 ? (
                        <span className="display shrink-0 rounded bg-good/10 px-1.5 py-0.5 text-xs font-bold text-good">
                          +{delta.toFixed(1)}
                        </span>
                      ) : (
                        <span className="shrink-0 text-[11px] text-faint">—</span>
                      )}
                      <span className="display w-10 shrink-0 text-right text-lg font-bold text-ink">
                        {Math.round(p.overall)}
                      </span>
                    </li>
                  );
                })}
            </ul>
          </Panel>
        ) : null}

        {last ? (
          <Panel
            className={cx(
              "rise-in p-5",
              !ended || wonWorlds ? "md:col-span-2" : "md:col-span-5",
            )}
            style={{ animationDelay: "150ms" }}
          >
            <p className="kicker mb-3 !text-[10px]">{C.ceremonies.bizRecap}</p>
            <div
              className={cx(
                "grid gap-3",
                !ended || wonWorlds ? "grid-cols-3 md:grid-cols-1" : "grid-cols-3",
              )}
            >
              <BizStat
                label={C.club.recordPrize}
                value={formatMoney(last.earnings, { compact: true })}
                cls="text-good"
              />
              <BizStat
                label={C.finances.balance}
                value={formatMoney(last.balanceEnd, { compact: true })}
                cls={last.balanceEnd < 0 ? "text-bad" : "text-ink"}
              />
              <BizStat
                label={C.common.reputation}
                value={<AnimatedNumber value={Math.round(last.repEnd)} />}
                cls="text-ink"
              />
            </div>
          </Panel>
        ) : null}
      </div>

      {/* 5 — Final region table snapshot */}
      {last && last.regionTable.length > 0 ? (
        <Panel className="rise-in p-4 sm:p-5" style={{ animationDelay: "180ms" }}>
          <div className="mb-2 flex items-center justify-between">
            <p className="kicker !text-[10px]">{C.standings.title}</p>
            <Badge className={REGION_BADGE[save.identity.region]}>{save.identity.region}</Badge>
          </div>
          <ul>
            {last.regionTable.map((row, i) => (
              <SnapshotRow
                key={row.ref}
                save={save}
                rank={i + 1}
                orgRef={row.ref}
                name={row.name}
                points={row.points}
              />
            ))}
            {!last.regionTable.some((r) => r.ref === "user") ? (
              <>
                <li aria-hidden className="py-0.5 text-center text-xs leading-none text-faint">
                  ···
                </li>
                <SnapshotRow
                  save={save}
                  rank={last.userRegionRank}
                  orgRef="user"
                  name={save.identity.orgName}
                  points={last.userSeasonPoints}
                />
              </>
            ) : null}
          </ul>
        </Panel>
      ) : null}

      {/* 6 — Actions / fork (logic unchanged) */}
      <div
        className="rise-in flex flex-wrap justify-center gap-3 pt-2"
        style={{ animationDelay: "240ms" }}
      >
        {ended ? (
          <>
            {!isRetired ? (
              <Button
                variant="primary"
                onClick={() => {
                  if (wonWorlds && canContinueSeasons) {
                    continueToNextSeason();
                    router.push("/career");
                  } else {
                    setInfoOpen(true);
                  }
                }}
              >
                {wonWorlds && canContinueSeasons ? C.ceremonies.defendTitle : C.ceremonies.infinite}
              </Button>
            ) : null}
            <Button
              variant="secondary"
              onClick={() => {
                retireCareer();
                router.push("/career/saves");
              }}
            >
              {C.ceremonies.retire}
            </Button>
          </>
        ) : (
          <Button
            variant="primary"
            size="lg"
            onClick={() => {
              continueToNextSeason();
              router.push("/career");
            }}
          >
            {C.ceremonies.rolloverCta} · {seasonLabelFor(save.clock.seasonIndex + 1)}
          </Button>
        )}
      </div>

      <Modal
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
        title={C.ceremonies.infinite}
        actions={
          <Button
            variant="primary"
            onClick={() => {
              continueInfinite();
              router.push("/career");
            }}
          >
            {C.common.confirm}
          </Button>
        }
      >
        <p className="text-sm font-semibold text-ink">{C.ceremonies.infiniteDesc}</p>
        <p className="mt-2 text-sm text-sub">{C.ceremonies.infiniteExplainer}</p>
      </Modal>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small bits
// ---------------------------------------------------------------------------

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  tone?: "bad" | "gold";
}) {
  return (
    <div className="rounded-lg border border-line bg-white/[0.02] p-2.5">
      <p className="kicker truncate !text-[10px]">{label}</p>
      <p
        className={cx(
          "display truncate text-lg font-bold",
          tone === "bad" ? "text-bad" : tone === "gold" ? "text-amber-300" : "text-ink",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function BizStat({
  label,
  value,
  cls,
}: {
  label: string;
  value: React.ReactNode;
  cls?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="kicker truncate !text-[10px]">{label}</p>
      <p className={cx("display truncate text-xl font-bold", cls ?? "text-ink")}>{value}</p>
    </div>
  );
}

function SnapshotRow({
  save,
  rank,
  orgRef,
  name,
  points,
}: {
  save: CareerSave;
  rank: number;
  orgRef: string;
  name: string;
  points: number;
}) {
  const copy = useCareerCopy();
  const isUser = orgRef === "user";
  return (
    <li
      className={cx(
        "flex items-center gap-2.5 border-b border-line py-2 pr-1 last:border-b-0",
        isUser && "bg-white/4",
      )}
      style={{
        borderLeft: `3px solid ${isUser ? save.identity.colors.primary : "transparent"}`,
      }}
    >
      <span
        className={cx(
          "display w-7 shrink-0 text-center text-sm font-bold",
          isUser ? "text-ink" : "text-faint",
        )}
      >
        {rank}
      </span>
      <OrgMark save={save} orgRef={orgRef} size="xs" className="shrink-0" />
      <span
        className={cx(
          "min-w-0 flex-1 truncate text-sm",
          isUser ? "font-semibold text-ink" : "text-sub",
        )}
      >
        {name}
      </span>
      {isUser ? (
        <Badge tone="orange" className="shrink-0 !px-1.5 !text-[9px]">
          {copy.standings.userChip}
        </Badge>
      ) : null}
      <span
        className={cx(
          "display shrink-0 text-sm font-bold",
          isUser ? "text-orange-bright" : "text-ink",
        )}
      >
        {points}
      </span>
      <span className="shrink-0 text-[10px] text-faint">{copy.standings.ptsShort}</span>
    </li>
  );
}
