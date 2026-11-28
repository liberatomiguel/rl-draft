"use client";

/**
 * Road to Worlds — the season review / ceremony screen (the payoff moment).
 *
 * rc9 HQ (#247). What the player decides here: to start the next season (after
 * the contract review the rollover waits for). What he must see first: how the
 * season ended. So it tells the season in order of importance:
 *   1. what was won: the outcome as the title, the grade as the one figure and
 *      a strip of the season's figures (rank, points, titles, prize money);
 *   2. what the goal paid: the board's target and stretch, settled;
 *   3. what changes next: the contracts, the board's verdict, next season's books;
 *   4. the detail: the squad's growth, the final table, the titles and record;
 * then the one action (start the season, or the ending's fork).
 * Five endings (insolvency / retired / Worlds won / final whistle / plain
 * review) change only the title block; all read the last SeasonRecord.
 */

import { BoardSeasonPanel } from "@/components/career/board/BoardParts";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CareerSave } from "@/engine/career/types";
import { useActiveCareerCopy } from "@/components/career/orgCopy";
import { useMounted } from "@/store/useMounted";
import { useCareerStore } from "@/store/careerStore";
import { useProfileStore } from "@/store/profileStore";
import { ResearchInvite } from "@/components/ResearchInvite";
import { CAREER_SEASONS } from "@/config/balance";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { CareerShareButton } from "@/components/career/share/CareerShareButton";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { formatMoney } from "@/lib/format";
import { cx } from "@/lib/util";
import { OrgMark } from "@/components/career/OrgMark";
import { seasonLabelFor, squadAge, useCareerSave } from "@/components/career/careerUi";
import { ContractReview, rolloverBlocked } from "@/components/career/ContractReview";
import { MilestoneMoment } from "../event/MilestoneMoment";
import { SeasonStatistics } from "../SeasonStatistics";
import { SeasonOutlook } from "@/components/career/finances/SeasonOutlook";
import { SeasonGoalRows } from "@/components/career/SeasonGoalRows";
import { establishedOf } from "@/engine/career/established";
import { EventTierIcon, TIER_ICON_TONE } from "@/components/career/event/EventTierIcon";
import { placementLabelOf } from "@/components/career/event/weekendView";
import { TrophyIcon } from "@/components/ui/icons";
import { seasonGoalsViewOf } from "@/engine/career/seasonGoals";

/** The grade's tone: S is the reward (gold), D the warning; the middle grades are ink, not a rainbow. */
const GRADE_TEXT: Record<string, string> = {
  S: "text-amber-300",
  A: "text-good",
  B: "text-ink",
  C: "text-ink",
  D: "text-bad",
};

export function SeasonScreen() {
  const mounted = useMounted();
  const save = useCareerSave();
  const C = useActiveCareerCopy();
  const router = useRouter();
  const continueToNextSeason = useCareerStore((s) => s.continueToNextSeason);
  const continueInfinite = useCareerStore((s) => s.continueInfinite);
  const retireCareer = useCareerStore((s) => s.retireCareer);
  const [infoOpen, setInfoOpen] = useState(false);
  const activeDays = useProfileStore((s) => s.login.total);
  const runsCompleted = useProfileStore((s) => s.runsCompleted);

  if (!mounted) {
    // Loading: the shapes of the title block, the goal and the next-season boards.
    return (
      <div className="mx-auto max-w-4xl px-3 py-6 sm:px-4 sm:py-8">
        <div className="space-y-4" aria-busy>
          <div className="h-60 animate-pulse rounded-xl bg-white/5" />
          <div className="h-44 animate-pulse rounded-xl bg-white/5" />
          <div className="h-56 animate-pulse rounded-xl bg-white/5" />
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
  // rc.34 (UX-06b): the rollover never passes a needed decision (the contract review, a bid at HQ).
  const blocked = rolloverBlocked(save);
  const seasonLabel = last?.label ?? seasonLabelFor(save.clock.seasonIndex);

  // Season goal — settled at review time (targetMet flips off null in enterSeasonReview).
  const goals = save.seasonGoals;
  // rc.36 (UX-02): one view for the season's plan, rc.35's split model and a legacy key.
  const goalsView = seasonGoalsViewOf(save);
  const goalSettled = Boolean(goalsView) && goals?.targetMet !== null && goals?.targetMet !== undefined;

  // The title block: what this season was, in one line, by ending.
  const title = isInsolvent
    ? C.ceremonies.insolvencyTitle
    : isRetired
      ? C.ceremonies.legacyTitle
      : wonWorlds
        ? C.ceremonies.yourTitle
        : isFinalWhistle
          ? C.ceremonies.finalWhistle
          : C.ceremonies.seasonReview;
  const body = isInsolvent
    ? save.end.moneyCause === "deadline"
      ? C.ceremonies.insolvencyBodyDeadline
      : C.ceremonies.insolvencyBody
    : isRetired
      ? C.ceremonies.retireDesc
      : isFinalWhistle
        ? C.ceremonies.finalWhistleBody
        : null;

  return (
    <div className="mx-auto max-w-4xl px-3 py-4 sm:px-4 sm:py-8">
      <div className="space-y-4 sm:space-y-6">
        {/* 1 — WHAT WAS WON: the screen's focal board. Worlds keeps its rays (a reward); nothing else glows. */}
        <Panel strong className={cx("relative overflow-hidden p-5 sm:p-8", isInsolvent && "border-bad/40")}>
          {wonWorlds ? <div className="celebrate-rays" aria-hidden /> : null}
          <div className="relative">
            {wonWorlds ? <MilestoneMoment title={C.launch.worldsChampion} kind="worlds" /> : null}
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-center gap-4">
                {!isInsolvent ? <OrgMark save={save} orgRef="user" size="lg" className="shrink-0" /> : null}
                <div className="min-w-0">
                  <p className={cx("kicker", isInsolvent && "text-bad")}>{seasonLabel}</p>
                  <h1
                    className={cx(
                      "display mt-1.5 text-3xl font-bold uppercase leading-none sm:text-4xl",
                      isInsolvent ? "text-bad" : wonWorlds ? "text-amber-300" : "text-ink",
                    )}
                  >
                    {title}
                  </h1>
                  <p className="mt-2 text-sm text-sub">{save.identity.orgName}</p>
                </div>
              </div>
              {/* The one figure of the screen: the season's grade, its label quiet under it. */}
              {last ? (
                <div className="shrink-0 text-right" aria-label={C.ceremonies.seasonGrade(last.grade)}>
                  <p className={cx("display text-5xl font-bold leading-none sm:text-6xl", GRADE_TEXT[last.grade] ?? "text-ink")}>
                    {last.grade}
                  </p>
                  <p className="kicker mt-1.5">{C.ceremonies.grade}</p>
                </div>
              ) : null}
            </div>
            {body ? <p className="mt-4 max-w-xl text-sm leading-relaxed text-sub">{body}</p> : null}
            {!wonWorlds && last?.worldsChampionName ? (
              <p className="mt-4 flex items-center gap-2 text-sm text-sub">
                {last.worldsChampionRef ? <OrgMark save={save} orgRef={last.worldsChampionRef} size="xs" /> : null}
                {C.ceremonies.worldsChampion(last.worldsChampionName)}
              </p>
            ) : null}
            {save.end.legacyGrade ? (
              <div className="mt-4">
                <Badge tone="gold">{C.ceremonies.legacyGrade[save.end.legacyGrade]}</Badge>
              </div>
            ) : null}

            {/* The season in four figures: the value large, the label quiet under it; two to a row on a phone. */}
            {last ? (
              <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-line pt-5 sm:grid-cols-4">
                <Figure label={C.ceremonies.rank}>#{last.userRegionRank}</Figure>
                <Figure label={C.common.seasonPoints}>
                  <AnimatedNumber value={last.userSeasonPoints} />
                </Figure>
                <Figure label={C.club.recordTitles} tone={last.titles > 0 ? "text-amber-300" : undefined}>
                  <AnimatedNumber value={last.titles} />
                </Figure>
                <Figure label={C.ceremonies.prize} tone={last.earnings > 0 ? "text-good" : undefined}>
                  {formatMoney(last.earnings, { compact: true })}
                </Figure>
              </dl>
            ) : null}
          </div>
        </Panel>

        {/* 1b — the season's events as cards in the order played: titles in gold with the trophy, podiums in ink. */}
        <SeasonResults save={save} C={C} />

        {/* 2 — WHAT THE GOAL PAID: the board's target and stretch, settled, with their status. */}
        {goalsView && goalSettled ? (
          <Panel className="p-4 sm:p-6">
            {/* Each row carries its own Met / Missed tag, so the head holds only the title. */}
            <div className="card-head">
              <h2 className="card-title">{C.hub.seasonGoal}</h2>
            </div>
            <SeasonGoalRows view={goalsView} C={C} seasonIndex={save.clock.seasonIndex} showWhy={false} totals={establishedOf(save)} />
          </Panel>
        ) : null}

        {/* 3 — WHAT CHANGES NEXT: the contract review the rollover waits for, the board's verdict, the books. */}
        {!isInsolvent && !isRetired ? (
          <section className="space-y-4">
            <h2 className="kicker">{C.ceremonies.nextSeason}</h2>
            <ContractReview save={save} C={C} />
            <BoardSeasonPanel save={save} C={C} />
            <SeasonOutlook save={save} C={C} />
          </section>
        ) : null}

        {/* 4 — THE DETAIL: the squad's growth beside the final table, then titles and the record. */}
        <div className="grid items-start gap-4 md:grid-cols-2">
          {!ended || wonWorlds ? <SquadGrowth save={save} C={C} /> : null}
          {last && last.regionTable.length > 0 ? (
            <Panel className="p-4 sm:p-6">
              <div className="card-head">
                <h2 className="card-title">{C.standings.title}</h2>
                <span className="text-xs text-sub">{save.identity.region}</span>
              </div>
              <ul className="-my-1">
                {last.regionTable.map((row, i) => (
                  <SnapshotRow key={row.ref} save={save} rank={i + 1} orgRef={row.ref} name={row.name} points={row.points} />
                ))}
                {!last.regionTable.some((r) => r.ref === "user") ? (
                  <>
                    <li aria-hidden className="py-1 text-center text-xs leading-none text-faint">
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
        </div>

        <SeasonStatistics save={save} C={C} />

        {/* The one action (rc.34: the rollover waits for the contract review), docked on a phone. */}
        <div className="action-dock flex flex-wrap items-center justify-center gap-3 sm:pt-2">
          {ended ? (
            <>
              {/* ECO-02 (R46): an insolvency is final — only the archive remains. */}
              {!isRetired && !isInsolvent ? (
                <Button
                  variant="primary"
                  disabled={blocked}
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
              {/* v2.2 share kit: the season's close is the moment to post the club. */}
              {!isInsolvent ? <CareerShareButton save={save} label={wonWorlds ? C.share.buttonTitle : undefined} promptAt="season" /> : null}
            </>
          ) : (
            <>
              <Button
                variant="primary"
                size="lg"
                disabled={blocked}
                className="max-sm:flex-1"
                onClick={() => {
                  continueToNextSeason();
                  router.push("/career");
                }}
              >
                {C.ceremonies.rolloverCta} · {seasonLabelFor(save.clock.seasonIndex + 1)}
              </Button>
              <CareerShareButton save={save} size="lg" promptAt="season" /* rc9 SHARE: the invite's moment */ />
            </>
          )}
        </div>
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
        <p className="text-sm text-ink">{C.ceremonies.infiniteDesc}</p>
        <p className="mt-2 text-sm text-sub">{C.ceremonies.infiniteExplainer}</p>
      </Modal>

      {/* v2.0.31: the research form, for returning players, at the season's close
          (not on an insolvency, not while the explainer is open). */}
      <ResearchInvite
        surface="career"
        ready={(save.phase === "seasonReview" || ended) && !isInsolvent && !infoOpen}
        signals={{ activeDays, runsCompleted, careerSeasons: save.history.length }}
        text={C.research}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small bits
// ---------------------------------------------------------------------------

/** A number set as a number: the figure in display Bold, its label quiet under it. */
function Figure({ label, tone, children }: { label: string; tone?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col-reverse justify-end">
      <dt className="mt-1.5 text-xs text-faint">{label}</dt>
      <dd className={cx("display truncate text-2xl font-bold tabular-nums leading-none sm:text-3xl", tone ?? "text-ink")}>{children}</dd>
    </div>
  );
}

const PODIUM = new Set(["champion", "runner_up", "third"]);

/** The events the club played this season (qualifiers aside): one card each, its result the card's figure. */
function SeasonResults({ save, C }: { save: CareerSave; C: ReturnType<typeof useActiveCareerCopy> }) {
  const season = save.history.at(-1)?.seasonIndex ?? save.clock.seasonIndex;
  const events = save.eventResults
    .filter((e) => e.seasonIndex === season && e.tier !== "qualifier" && e.userPlacement)
    .sort((a, b) => a.week - b.week);
  if (events.length === 0) return null;
  const labels = { placement: C.common.placement, qualifierOutcome: C.common.qualifierOutcome };
  return (
    <section>
      <h2 className="kicker mb-3">{C.ceremonies.results}</h2>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {events.map((e) => {
          const p = e.userPlacement!;
          const won = p === "champion";
          const podium = PODIUM.has(p);
          return (
            <li
              key={e.eventId}
              className={cx(
                "panel flex min-h-28 flex-col justify-between p-3 sm:p-4",
                won ? "!border-amber-400/60" : podium ? "!border-line-strong" : "",
              )}
            >
              <span className="flex items-center gap-1.5 text-xs text-faint">
                <EventTierIcon tier={e.tier} className={cx("h-3.5 w-3.5 shrink-0", won ? "text-amber-300" : TIER_ICON_TONE[e.tier])} />
                <span className="min-w-0 truncate">{e.name}</span>
              </span>
              <span className="mt-3 flex items-end justify-between gap-2">
                <span className={cx("display text-lg font-bold leading-tight", won ? "text-amber-300" : podium ? "text-ink" : "text-sub")}>
                  {placementLabelOf(labels, e.tier, p)}
                </span>
                {won ? <TrophyIcon className="h-6 w-6 shrink-0 text-amber-300" /> : null}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** The squad's season: a row per player, his growth signed and coloured, his overall the row's figure. */
function SquadGrowth({ save, C }: { save: CareerSave; C: ReturnType<typeof useActiveCareerCopy> }) {
  const players = [...save.squad].sort((a, b) => b.overall - a.overall);
  return (
    <Panel className="p-4 sm:p-6">
      <div className="card-head">
        <h2 className="card-title">{C.ceremonies.devRecap}</h2>
        <span className="kicker">{C.common.ovr}</span>
      </div>
      {players.length === 0 ? (
        <p className="text-sm text-sub">{C.training.growthEmpty}</p>
      ) : (
        <ul className="-my-1">
          {players.map((p) => {
            const delta = Math.round(p.gainedThisSeason * 10) / 10;
            return (
              <li key={p.id} className="flex min-h-14 items-center gap-3 border-b border-line py-2 last:border-b-0">
                <div className="min-w-0 flex-1">
                  <p className="display truncate text-[15px] font-bold text-ink">{p.name}</p>
                  <p className="mt-0.5 truncate text-xs text-faint">
                    {C.player.age(squadAge(save, p))} · {C.player.archetype[p.archetype]}
                  </p>
                </div>
                <span className={cx("display w-12 shrink-0 text-right text-sm font-semibold tabular-nums", delta > 0 ? "text-good" : "text-faint")}>
                  {delta > 0 ? `+${delta.toFixed(1)}` : "–"}
                </span>
                <span className="display w-10 shrink-0 text-right text-xl font-bold tabular-nums text-ink">{Math.round(p.overall)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

/** A row of the final table; the user's row is his name in Demi between two stronger hairlines. */
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
  const copy = useActiveCareerCopy();
  const isUser = orgRef === "user";
  return (
    <li className={cx("flex min-h-11 items-center gap-2.5 border-b py-2 last:border-b-0", isUser ? "border-y border-line-strong" : "border-line")}>
      <span className={cx("display w-7 shrink-0 text-center text-sm font-bold tabular-nums", isUser ? "text-ink" : "text-faint")}>{rank}</span>
      <OrgMark save={save} orgRef={orgRef} size="xs" className="shrink-0" />
      <span className={cx("min-w-0 flex-1 truncate", isUser ? "display text-[15px] font-bold text-ink" : "text-sm text-sub")}>{name}</span>
      <span className="display shrink-0 text-base font-bold tabular-nums text-ink">{points}</span>
      <span className="shrink-0 text-xs text-faint">{copy.standings.ptsShort}</span>
    </li>
  );
}
