"use client";

/**
 * Results screen v2: celebratory placement hero (rays + confetti for a
 * title), run highlights, team reveal in two rows of three, XP/rank
 * progress, achievement toasts and unlocked specials.
 */

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { achievementById, lineupById, playerCardById, specialCardById } from "@/data";
import { DIFFICULTY, RANK_REWARDS, RANKS } from "@/config/balance";
import { useCopy } from "@/content/copy";
import {
  resolveCoach,
  resolveOrg,
  resolvePlayerCard,
  resolveSpecial,
  resolveSub,
  type ResolvedCard,
} from "@/engine/cards";
import { rankForXp, type RankInfo } from "@/engine/progression";
import { displayTeamOverall } from "@/engine/rating";
import type { EliminatorTeam, Placement, RunState } from "@/engine/types";
import { dailyRunTag, resultStageLabel, signedDelta, xpLineLabel, xpMultiplierRows } from "@/lib/runLabels";
import { sfx } from "@/lib/sfx";
import { cx } from "@/lib/util";
import { useMounted } from "@/store/useMounted";
import { useCosmeticUnlocks } from "@/store/cosmeticUnlockStore";
import { useOverlayHold } from "@/store/overlayHoldStore";
import { useProfileStore } from "@/store/profileStore";
import { useRewardToasts } from "@/store/rewardToastStore";
import { useRunStore } from "@/store/runStore";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { Panel, SectionTitle } from "@/components/ui/Panel";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { useDialogFocus, usePageScrollLock } from "@/components/ui/dialog";
import { RankBadge } from "@/components/ui/RankBadge";
import { GameCard } from "@/components/cards/GameCard";
import { rosterSlots } from "@/components/cards/rosterView";
import { Logo } from "@/components/layout/AppShell";
import { AchievementIcon } from "@/components/AchievementIcon";
import { achievementStyle } from "@/components/achievementStyle";
import { LegacyEmblem as LegacyEmblem_ } from "@/components/ui/icons";
import { ResearchInvite } from "@/components/ResearchInvite";
import { DuelInvite } from "@/components/duel/DuelInvite";
import { RunShareSheet } from "@/components/share/RunShareSheet";
import { DuelResultsPanel } from "@/components/duel/DuelResultsPanel";
import { RunStepper } from "./RunStepper";
import { DailyOptimalPanel } from "./DailyOptimalPanel";
import { OverallParts } from "./OverallParts";
import { runEnd } from "./runEnd";

const CONFETTI_COLORS = ["#f97316", "#fbbf24", "#3b82f6", "#38bdf8", "#e9eef8"];

export function ResultsScreen({ run }: { run: RunState }) {
  const router = useRouter();
  const { RESULTS_UI: R, REVIEW, RARITY_LABELS, CHEM_TIERS, TOURNAMENT_UI: T, DAILY_TEXT, ACH_UI, DIFFICULTY_LABELS, RESEARCH_UI, DUEL_UI } = useCopy();
  // Only the placements that carry a fact get a line under the title (#285).
  const PLACEMENT_COPY: Record<Placement, { title: string; sub?: string; tone: "orange" | "blue" }> = {
    champion: { title: R.champion, tone: "orange" },
    runner_up: { title: R.runnerUp, tone: "blue" },
    third: { title: R.third, tone: "blue" },
    fourth: { title: R.fourth, sub: R.fourthSub, tone: "blue" },
    top4: { title: R.top4, tone: "blue" },
    top6: { title: R.top6, sub: R.top6Sub, tone: "blue" },
    top8: { title: R.top8, sub: R.top8Sub, tone: "blue" },
    // v2.2: career-only placement, never reached in the Draft.
    top12: { title: R.swissExit, tone: "blue" },
    swiss_exit: { title: R.swissExit, tone: "blue" },
  };
  const clearRun = useRunStore((s) => s.clearRun);
  const setSetupMode = useRunStore((s) => s.setSetupMode);
  const xpNow = useProfileStore((s) => s.xp);
  const mmrNow = useProfileStore((s) => s.mmr);
  const mmrGain = useProfileStore((s) => s.lastMmrGain);
  const winsHard = useProfileStore((s) => s.wins.hard);
  const winsLegacy = useProfileStore((s) => s.wins.legacy);
  const activeDays = useProfileStore((s) => s.login.total);
  const runsCompleted = useProfileStore((s) => s.runsCompleted);
  // Pop-ups the ceremonies held back (unlocks, the login calendar) — the XP
  // count-up waits for them too.
  const unlockPending = useCosmeticUnlocks((s) => s.queue.length > 0);
  const loginPending = useRewardToasts((s) => !!s.loginModal);

  const results = run.results;
  const team = run.tournament?.teams["user"];
  const slots = useMemo(() => rosterSlots(run.draft.roster), [run.draft.roster]);
  const playerSlots = slots.slice(0, 3); // player1 · player2 · player3
  const benchSlots = slots.slice(3); // coach · sub · org (null in Quick)
  const [ceremonyOpen, setCeremonyOpen] = useState(
    () => (run.results?.unlockedSpecialIds.length ?? 0) > 0,
  );
  const [rankUpSeen, setRankUpSeen] = useState(false);
  const [legacySeen, setLegacySeen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  // Placement cue, once on mount.
  useEffect(() => {
    if (!run.results) return;
    if (run.results.placement === "champion") sfx.win();
    else sfx.lose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!results || !team) return null;

  const placement = PLACEMENT_COPY[results.placement];
  const isChampion = results.placement === "champion";
  // Flawless: title without dropping a single series → prismatic celebration.
  const isImmaculate = isChampion && checkNoSeriesLost(run);
  // Legacy title — the all-time gauntlet. The hardest win in the game gets the
  // richest celebration (crown emblem, selo, denser rays + confetti) — v1.4.
  const isLegacyChampion = isChampion && run.difficulty === "legacy";
  // Rank-up baseline = the profile XP captured when the run STARTED (v1.4.4). The run's
  // whole XP gain — placement + end feats + any mid-run achievement XP that was already
  // applied live — lands here, so a rank crossed at any point during the run still fires
  // the ceremony on results. (Older runs without `xpAtStart` fall back to the estimate,
  // which misses mid-run achievement / counter XP — the exact bug this fixes.)
  const xpBefore = run.xpAtStart ?? Math.max(0, xpNow - results.xp.total);
  const rankBefore = rankForXp(xpBefore);
  const rankAfter = rankForXp(xpNow);
  const rankedUp = rankBefore.id !== rankAfter.id;
  // Legacy unlocks on the FIRST Hard tournament win — this run is that win when it's a
  // Classic/Quick Hard championship and the hard-win counter (already incremented in
  // applyRunResults) just reached 1, with no Legacy title yet. Daily/Challenge Hard
  // wins still count as titles but do NOT unlock Legacy (v1.4), so they never celebrate.
  const legacyJustUnlocked =
    !run.duel && // a duel grants nothing, Legacy included
    (run.mode === "classic" || run.mode === "quick") &&
    run.difficulty === "hard" &&
    results.placement === "champion" &&
    winsHard === 1 &&
    winsLegacy === 0;
  // rc.29 (DRAFT-05): the XP total counts up once nothing covers it — the
  // ceremonies first, then the pop-ups they held back.
  const ceremonyUp =
    ceremonyOpen || (rankedUp && !rankUpSeen) || (legacyJustUnlocked && !legacySeen);
  const countXp = !ceremonyUp && !unlockPending && !loginPending;

  const bestPick = [run.draft.roster.player1, run.draft.roster.player2, run.draft.roster.player3]
    .find((p) => p?.refId === results.bestPlayerCardId);
  const bestPlayer = bestPick ? resolvePlayerCard(bestPick.refId, bestPick.specialId) : null;

  const handlePlayAgain = () => {
    // Back to this mode's difficulty selection (last setup pre-selected).
    setSetupMode(run.mode === "quick" ? "quick" : "classic");
    clearRun();
  };

  // v2.2 share kit: the sheet draws the run's image (post or story) on open.
  const handleShare = () => setShareOpen(true);

  // Phone (mobile redesign, stage 2): the actions are one 65px row on ground
  // (`.action-dock`: play again and share; "back to menu" is the nav's Home on
  // a phone) where a 124px floating block used to cover the page. The four
  // highlights are rows of one board, and the boards breathe less.
  return (
    <div className="rise-in sm:pb-8">
      <RunStepper run={run} />
      {ceremonyOpen ? (
        <UnlockCeremony
          specialIds={results.unlockedSpecialIds}
          onDone={() => setCeremonyOpen(false)}
        />
      ) : rankedUp && !rankUpSeen ? (
        <RankUpCelebration
          rank={rankAfter}
          prevRankId={rankBefore.id}
          onDone={() => setRankUpSeen(true)}
        />
      ) : legacyJustUnlocked && !legacySeen ? (
        <LegacyUnlockCelebration onDone={() => setLegacySeen(true)} />
      ) : null}

      {/* Placement hero */}
      <Panel
        strong
        glow={placement.tone}
        className={cx(
          "celebrate mb-5 px-4 py-8 text-center sm:mb-8 sm:px-6 sm:py-12",
          isChampion && "!border-orange/50",
          isImmaculate && "!border-cyan/50",
          isLegacyChampion && "!border-cyan/60",
        )}
      >
        {isChampion ? (
          <>
            <div className={isImmaculate ? "celebrate-rays-prism" : "celebrate-rays"} aria-hidden />
            {/* Legacy champion layers a second prismatic ray bank for a denser,
                more rewarding sweep on top of the base champion rays (v1.4). */}
            {isLegacyChampion && !isImmaculate ? (
              <div className="celebrate-rays-prism" aria-hidden />
            ) : null}
            <Confetti prism={isImmaculate} legacy={isLegacyChampion} />
          </>
        ) : null}
        <div className="relative z-10">
          {isLegacyChampion ? (
            <div className="ceremony-burst mb-5 flex justify-center">
              <LegacyEmblem_ framed gradientId="legacyGradChamp" />
            </div>
          ) : null}
          <p className="kicker mb-3">{R.finalPlacement}</p>
          <h1
            className={cx(
              "display text-5xl font-bold uppercase tracking-wide md:text-7xl",
              isImmaculate
                ? "immaculate-title bg-gradient-to-b from-cyan via-blue-bright to-purple-400 bg-clip-text text-transparent"
                : isChampion
                  ? "champion-title bg-gradient-to-b from-amber-200 via-orange-bright to-orange bg-clip-text text-transparent"
                  : "text-ink",
            )}
          >
            {placement.title}
          </h1>
          {isImmaculate ? (
            <p className="display mt-2 text-base font-bold uppercase tracking-[0.3em] text-cyan">
              {R.immaculateBadge}
            </p>
          ) : null}
          {isLegacyChampion ? (
            <p className="immaculate-title display mt-2 bg-gradient-to-r from-cyan via-purple-400 to-orange-bright bg-clip-text text-base font-bold uppercase tracking-[0.3em] text-transparent">
              {R.legacyChampionBadge}
            </p>
          ) : null}
          {placement.sub ? <p className="mt-3 text-sm text-sub">{placement.sub}</p> : null}
          {run.daily ? (
            <p className="mt-1 text-xs text-orange-bright">{dailyRunTag(run.daily, DAILY_TEXT)}</p>
          ) : null}
          {run.duel ? <p className="mt-1 text-xs text-orange-bright">{DUEL_UI.kicker}</p> : null}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            {/* Quick Draft has no Swiss stage (single-elim bracket) — DRAFT-09. */}
            {run.mode !== "quick" ? (
              <Badge tone="blue">
                {R.swissRecord}: {results.swissRecord.wins}–{results.swissRecord.losses}
              </Badge>
            ) : null}
            <Badge tone="neutral">{R.teamOvrBadge(displayTeamOverall(team.rating))}</Badge>
            <Badge tone={team.chemistry.percent >= 62 ? "good" : "neutral"}>
              {R.chemistryBadge(CHEM_TIERS[team.chemistry.tier] ?? team.chemistry.tier)}
            </Badge>
            {results.goalsConceded === 0 ? <Badge tone="gold">{R.untouchableBadge}</Badge> : null}
          </div>
          {results.goalsConceded === 0 ? (
            <p className="mt-3 text-sm font-semibold text-amber-300">{R.untouchableNote}</p>
          ) : null}
          {results.championName ? (
            <p className="mt-4 text-xs text-faint">{R.champion0f(results.championName)}</p>
          ) : null}
        </div>
      </Panel>

      {/* Friend duel (v2.1): the standings and the link, where the XP would be. */}
      {run.duel ? <DuelResultsPanel run={run} /> : null}

      {/* Highlights */}
      <div className="phone-rows mb-6 grid grid-cols-1 sm:mb-8 sm:grid-cols-2 sm:gap-3 lg:grid-cols-4">
        {bestPlayer ? (
          <HighlightTile label={R.bestPlayer} value={bestPlayer.name} detail={R.ovr(bestPlayer.overall ?? 0)} />
        ) : null}
        {results.biggestWin ? (
          <HighlightTile
            label={R.biggestWin}
            value={`${results.biggestWin.score[0]}–${results.biggestWin.score[1]} vs ${results.biggestWin.opponentName}`}
            detail={resultStageLabel(results.biggestWin, T)}
          />
        ) : null}
        {results.closestSeries ? (
          <HighlightTile
            label={R.closestSeries}
            value={`${results.closestSeries.score[0]}–${results.closestSeries.score[1]} vs ${results.closestSeries.opponentName}`}
            detail={resultStageLabel(results.closestSeries, T)}
          />
        ) : null}
        {results.worstLoss ? (
          <HighlightTile
            label={R.worstLoss}
            value={`${results.worstLoss.score[0]}–${results.worstLoss.score[1]} vs ${results.worstLoss.opponentName}`}
            detail={resultStageLabel(results.worstLoss, T)}
          />
        ) : null}
      </div>

      {/* Team reveal: the three player cards across the pitch (the middle one
          raised, the outer two aligned), staff in a spaced row below. Card size
          matches the draft screen. */}
      <SectionTitle
        title={R.teamReveal}
        right={!run.showOverall ? <Badge tone="orange">{R.hiddenReveal}</Badge> : null}
        className="mb-4"
      />
      <div className="mb-6 sm:mb-10">
        <div className="field rounded-2xl p-3 sm:p-6">
          <div className="mx-auto grid max-w-2xl grid-cols-3 items-start gap-2 md:gap-4">
            {playerSlots.map((s, i) =>
              s?.card ? (
                // Outer two sit lower (aligned with each other); the middle card
                // is raised. Cards stay straight (no tilt) at the draft size.
                <div key={s.slot} className={cx(i !== 1 && "mt-6 sm:mt-10")}>
                  <RevealCard card={s.card} delayMs={i * 220} animate={!run.showOverall} />
                </div>
              ) : null,
            )}
          </div>
        </div>
        {benchSlots.some((s) => s.card) ? (
          // Desktop (sm+) mirrors the top row exactly — same 3-col grid, gaps and
          // card size, so coach/sub/org line up under the players. Mobile keeps
          // its tighter centered flex row, unchanged (v1.2.1).
          <div className="mt-5 flex justify-center gap-2 sm:mx-auto sm:grid sm:max-w-2xl sm:grid-cols-3 sm:items-start sm:gap-2 md:gap-4">
            {benchSlots.map((s, i) =>
              s.card ? (
                <RevealCard
                  key={s.slot}
                  card={s.card}
                  delayMs={(i + 3) * 220}
                  animate={!run.showOverall}
                  className="mx-auto w-[6.75rem] sm:w-full sm:max-w-36 md:max-w-44"
                />
              ) : null,
            )}
          </div>
        ) : null}
      </div>

      {/* Team overall (#280): the number and the parts that add up to it, the
          same list the Review shows. On a hidden-overall run this is the first
          time the player sees it; the Team Reveal title above carries the tag. */}
      <Panel strong className="mb-6 p-4 sm:mb-10 sm:p-6">
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-6 gap-y-3 sm:gap-x-10">
          <div>
            <p className="display text-6xl font-bold leading-[0.9] text-ink sm:text-7xl">
              {displayTeamOverall(team.rating)}
            </p>
            <p className="kicker mt-2">{REVIEW.teamOverall}</p>
          </div>
          <OverallParts rating={team.rating} quick={run.mode === "quick"} />
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* XP + rank (none in a duel: it pays nothing, and the rating shown would be the last run's). */}
        {!run.duel ? (
        <Panel className="p-5">
          <p className="kicker mb-3">{R.xpGained}</p>
          <ul className="space-y-1.5">
            {results.xp.lines.map((line, i) => (
              <li key={i} className="flex items-center justify-between text-sm text-sub">
                <span>{xpLineLabel(line, R, DAILY_TEXT)}</span>
                <span className="display font-bold text-ink">+{line.amount}</span>
              </li>
            ))}
            {/* Difficulty and game mode apart (Quick ×0.5 is not a difficulty) — DRAFT-09. */}
            {xpMultiplierRows(results.xp, run.mode, R).map((row) => (
              <li key={row.label} className="flex items-center justify-between text-sm text-sub">
                <span>{row.label}</span>
                <span className="display font-bold text-cyan">×{row.value}</span>
              </li>
            ))}
            {results.xp.hiddenOverallBonus > 0 ? (
              <li className="flex items-center justify-between text-sm text-sub">
                <span>{R.hiddenOverallBonus}</span>
                <span className="display font-bold text-cyan">
                  +{Math.round(results.xp.hiddenOverallBonus * 100)}%
                </span>
              </li>
            ) : null}
          </ul>
          <div className="mt-4 flex items-end justify-between border-t border-line pt-4">
            <span className="text-sm font-semibold text-sub">{R.total}</span>
            <span className="display text-3xl font-bold text-orange-bright">
              +<AnimatedNumber value={results.xp.total} play={countXp} />
              <span className="ml-1 text-base">XP</span>
            </span>
          </div>

          {/* Season Rating (v2.0): a signed delta on every run — titles pay, early exits
              at the higher difficulties cost a little. One label each side, "±0"
              when nothing moved (rc.29, DRAFT-16: 0 used to print the label twice). */}
          <div className="mt-2 flex items-end justify-between">
            <span className="text-xs font-semibold text-sub">{R.mmrEarned}</span>
            <span
              className={cx(
                "display text-base font-bold",
                mmrGain < 0 ? "text-bad" : mmrGain > 0 ? "text-cyan" : "text-sub",
              )}
            >
              {signedDelta(mmrGain)}
              <span className="ml-1 text-xs font-semibold text-faint">
                · {mmrNow} {R.mmrTotal}
              </span>
            </span>
          </div>

          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="display font-bold uppercase tracking-wider text-ink">
                {rankAfter.label}
              </span>
              {rankBefore.label !== rankAfter.label ? (
                <Badge tone="orange">{R.rankUpBadge}</Badge>
              ) : rankAfter.next ? (
                <span className="text-faint">{R.xpToNext(rankAfter.xpToNext, rankAfter.next.label)}</span>
              ) : null}
            </div>
            <ProgressBar value={rankAfter.progress} tone="orange" label={R.rankProgress} />
          </div>
        </Panel>
        ) : null}

        {/* Achievements + unlocks */}
        <div className="space-y-6">
          {results.newAchievementIds.length > 0 ? (
            <Panel className="p-5">
              <p className="kicker mb-3">{R.achievements}</p>
              <ul className="space-y-2.5">
                {results.newAchievementIds.map((id) => {
                  const def = achievementById.get(id);
                  if (!def) return null;
                  const style = achievementStyle(def);
                  return (
                    <li key={id} className="flex items-start gap-3">
                      <span
                        className={cx(
                          "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
                          style.chip,
                          style.legend && "ach-legend-chip",
                        )}
                      >
                        <AchievementIcon group={def.group} />
                      </span>
                      <span>
                        <span className="display block text-sm font-bold uppercase tracking-wide text-ink">
                          {ACH_UI.items[def.id]?.name ?? def.title}
                        </span>
                        <span className="text-xs text-sub">{ACH_UI.items[def.id]?.desc ?? def.description} · +{def.xp} XP</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Panel>
          ) : null}

          {results.unlockedSpecialIds.length > 0 ? (
            <Panel glow="orange" className="p-5">
              <p className="kicker mb-3">{R.unlocked}</p>
              <div className="flex flex-wrap gap-3">
                {results.unlockedSpecialIds.map((id) => {
                  const sp = specialCardById.get(id);
                  if (!sp) return null;
                  return (
                    <GameCard
                      key={id}
                      card={resolveSpecial(sp)}
                      showOverall
                      specialCollected
                      size="sm"
                    />
                  );
                })}
              </div>
              <p className="mt-3 text-xs text-faint">
                {results.unlockedSpecialIds
                  .map((id) => RARITY_LABELS[specialCardById.get(id)?.rarity ?? ""])
                  .filter(Boolean)
                  .join(" · ")}{" "}
               : {R.unlockedNote}
              </p>
            </Panel>
          ) : null}
        </div>
      </div>

      {/* v2.1: the day's best draft + percentile, only once the Daily is over. */}
      {run.daily ? <DailyOptimalPanel run={run} /> : null}

      {/* Who ended the run (lost runs only, feature-flagged — see results.ts) */}
      {results.eliminatedBy ? <EliminatorReveal eliminator={results.eliminatedBy} tournament={run.tournament} /> : null}

      {/* Friend duel (v2.1): the same settings as a duel, to send to a friend. */}
      <DuelInvite run={run} />

      {/* CTAs */}
      <div className="action-dock mt-6 flex items-stretch justify-center gap-2 sm:mt-10 sm:flex-row sm:gap-3">
        <Button
          variant="primary"
          size="lg"
          className="max-sm:flex-1 max-sm:whitespace-nowrap max-sm:px-2 max-sm:text-[15px]"
          onClick={handlePlayAgain}
        >
          {R.playAgain}
        </Button>
        <Button
          variant="secondary"
          size="lg"
          className="max-sm:flex-1 max-sm:whitespace-nowrap max-sm:px-2 max-sm:text-[15px]"
          onClick={handleShare}
        >
          {R.share}
        </Button>
        <Button
          variant="ghost"
          size="lg"
          className="max-sm:hidden"
          // Navigate only — the home page clears the run on mount (clearing
          // first flashes the setup screen during the route transition).
          onClick={() => router.push("/")}
        >
          {R.backHome}
        </Button>
      </div>

      <RunShareSheet
        run={run}
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        placementLabel={placement.title}
        teamOverall={displayTeamOverall(team.rating)}
        chemistryTier={team.chemistry.tier}
        modeLabel={run.mode === "quick" ? R.shareModeQuick : R.shareModeClassic}
        difficultyLabel={DIFFICULTY_LABELS[run.difficulty]?.label ?? DIFFICULTY[run.difficulty].label}
      />

      {/* v2.0.31: the research form, for returning players, once the results have settled. */}
      <ResearchInvite
        surface="draft"
        ready={countXp && !shareOpen}
        signals={{ activeDays, runsCompleted, careerSeasons: 0 }}
        text={RESEARCH_UI}
      />
    </div>
  );
}

function checkNoSeriesLost(run: RunState): boolean {
  const t = run.tournament;
  if (!t) return false;
  const all = [
    ...t.swiss.rounds.flatMap((r) => r.series),
    ...(t.playoffs?.rounds ?? []).flatMap((r) => r.series),
  ].filter((s) => s.teamAId === "user" || s.teamBId === "user");
  return all.length > 0 && all.every((s) => s.winnerTeamId === "user");
}

/** Deterministic confetti pieces (no render-time randomness → SSR safe). */
function Confetti({ prism, legacy }: { prism?: boolean; legacy?: boolean }) {
  // Legacy champions get the full prismatic palette (cyan→purple→gold→orange)
  // and a denser shower — the all-time gauntlet is the hardest title to win, so
  // its celebration is the richest (v1.4).
  const colors = legacy
    ? ["#38bdf8", "#a855f7", "#fbbf24", "#f97316", "#e9eef8", "#c084fc"]
    : prism
      ? ["#38bdf8", "#a855f7", "#60a5fa", "#e9eef8", "#c084fc"]
      : CONFETTI_COLORS;
  const count = legacy ? 30 : 16;
  const pieces = Array.from({ length: count }, (_, i) => ({
    left: `${(i * 61) % 100}%`,
    delay: `${(i * 0.37) % 2.6}s`,
    color: colors[i % colors.length],
    duration: `${3 + ((i * 13) % 14) / 10}s`,
  }));
  return (
    <div aria-hidden>
      {pieces.map((p, i) => (
        <span
          key={i}
          className="confetti"
          style={{
            left: p.left,
            animationDelay: p.delay,
            animationDuration: p.duration,
            backgroundColor: p.color,
          }}
        />
      ))}
    </div>
  );
}

/**
 * Shared full-screen ceremony overlay (v1.2.0): portaled onto <body> so the
 * `position: fixed` backdrop covers the viewport even though the results screen
 * animates with a transform (`rise-in`) that would otherwise re-anchor it. Locks
 * body scroll while open. Advances ONLY on user input — no auto-dismiss timers.
 *
 * rc.29: the keyboard continues like a tap (Escape / Enter — DRAFT-04) and the
 * focus starts inside; the scroll lock is the shared, shift-free one (DRAFT-06);
 * and while any ceremony is up it holds the login calendar and the cosmetic
 * unlock pop-ups, which open once the ceremonies are done (DRAFT-02).
 */
function CeremonyPortal({
  onClick,
  ariaLabel,
  className,
  children,
}: {
  onClick: () => void;
  ariaLabel: string;
  className?: string;
  children: React.ReactNode;
}) {
  const mounted = useMounted();
  const rootRef = useRef<HTMLDivElement>(null);
  const R = useCopy().RESULTS_UI;
  useOverlayHold("ceremony", true);
  usePageScrollLock(mounted);
  useDialogFocus(rootRef, mounted, { onEscape: onClick, onEnter: onClick });
  if (!mounted) return null;
  return createPortal(
    <div
      ref={rootRef}
      tabIndex={-1}
      style={{ outline: "none" }}
      // Full-screen SCROLL container: tall ceremony content (e.g. the Legacy
      // unlock on a SHORT viewport) stays reachable and the "tap to continue"
      // hint is never clipped off-screen. Body scroll stays locked (intended) —
      // only this overlay scrolls; the inner min-h-full centers it when it fits.
      className={cx(
        "fixed inset-0 z-[60] cursor-pointer overflow-y-auto overscroll-contain backdrop-blur-sm",
        className,
      )}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      onClick={onClick}
    >
      <button type="button" onClick={event => { event.stopPropagation(); onClick(); }} aria-label={R.ceremonyContinue} className="fixed right-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-lg bg-raised text-xl text-ink">→</button>
      <div className="flex min-h-full flex-col items-center justify-center gap-6 p-6">
        {children}
      </div>
    </div>,
    document.body,
  );
}

/**
 * Unlock ceremony: each freshly unlocked special gets its reveal moment.
 * Tap to reveal the card, tap again for the next — it advances only on input
 * (no auto-play) and is portaled full-screen by CeremonyPortal.
 */
function UnlockCeremony({
  specialIds,
  onDone,
}: {
  specialIds: string[];
  onDone: () => void;
}) {
  const { RESULTS_UI: R } = useCopy();
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);

  const sp = specialCardById.get(specialIds[index]);
  const last = index === specialIds.length - 1;

  const advance = () => {
    if (!revealed) {
      setRevealed(true);
      return;
    }
    if (last) onDone();
    else {
      setIndex((i) => i + 1);
      setRevealed(false);
    }
  };

  // Sound cue each time a card is revealed.
  useEffect(() => {
    if (revealed) sfx.unlock();
  }, [revealed, index]);

  if (!sp) {
    onDone();
    return null;
  }
  const card = resolveSpecial(sp);

  return (
    // Tap ANYWHERE on the overlay advances — the inner button stops propagation
    // so it doesn't double-fire. Portaled full-screen; advances only on input.
    <CeremonyPortal ariaLabel={R.ceremonyKicker} className="bg-black/85" onClick={advance}>
      <p className="kicker">{R.ceremonyKicker}</p>
      <div className="relative">
        {revealed ? (
          <div className="ceremony-burst relative">
            <span className="ceremony-ring" aria-hidden />
            <div className="card-float">
              <GameCard card={card} showOverall specialCollected size="lg" />
            </div>
          </div>
        ) : (
          <div className="pulse-soft card-frame card-hidden flex aspect-[3/4.3] w-44 flex-col items-center justify-center gap-3 p-3 md:w-52">
            <Logo className="text-[10px]" />
            <span className="display text-5xl font-bold text-faint">??</span>
          </div>
        )}
      </div>
      <p className="text-xs text-sub">
        {specialIds.length > 1 ? `${index + 1}/${specialIds.length} · ` : ""}
        {revealed ? "" : R.ceremonyTap}
      </p>
      {revealed ? (
        <Button
          variant="primary"
          onClick={(e) => {
            e.stopPropagation();
            advance();
          }}
        >
          {last ? R.ceremonyContinue : R.ceremonyNext}
        </Button>
      ) : null}
    </CeremonyPortal>
  );
}

/**
 * Rank-up moment (reworked v0.7.0): the v0.5 version read as cramped — this
 * now uses the SAME full-screen overlay language as the "new card unlocked"
 * ceremony (black backdrop, emblem bursting in the center) and the MENU rank
 * art (not the profile set). Portaled full-screen; advances only on tap/continue.
 */
/** What the new rank just unlocked vs the previous one — for the rank-up screen. */
function rankUnlockLines(
  prevRankId: string,
  rankId: string,
  R: ReturnType<typeof useCopy>["RESULTS_UI"],
  rarityLabels: ReturnType<typeof useCopy>["RARITY_LABELS"],
): string[] {
  const before = RANK_REWARDS[prevRankId];
  const after = RANK_REWARDS[rankId];
  if (!before || !after) return [];
  const out: string[] = [];
  if (!before.collection && after.collection) out.push(R.unlockCollection);
  for (const r of after.rarities) {
    if (before.rarities.includes(r) || r === "creator") continue;
    out.push(R.unlockRarity(rarityLabels[r as keyof typeof rarityLabels] ?? r));
  }
  if (!before.hardMode && after.hardMode) out.push(R.unlockHard);
  if (after.specialChance > before.specialChance) {
    // The copy describes the resulting chance, so show the new total.
    out.push(R.unlockChance(Math.round(after.specialChance * 100)));
  }
  return out;
}

export function RankUpCelebration({
  rank,
  prevRankId,
  onDone,
}: {
  rank: Pick<RankInfo, "id" | "label">;
  prevRankId: string;
  onDone: () => void;
}) {
  const { RESULTS_UI: R, RARITY_LABELS } = useCopy();
  const unlocks = rankUnlockLines(prevRankId, rank.id, R, RARITY_LABELS);

  // Rank-up fanfare, once on mount.
  useEffect(() => {
    sfx.rankUp();
  }, []);

  const previous = RANKS.findIndex(r => r.id === prevRankId);
  return <CeremonyPortal ariaLabel={R.rankUpTitle} className="bg-black/90" onClick={onDone}>
    <div className="w-full max-w-lg" onClick={e=>e.stopPropagation()}>
      <header className="mb-7 text-center">
        <p className="kicker">{R.rankUpTitle}</p>
        <div className="mt-7 flex flex-col items-center justify-center gap-4">
          <RankBadge rank={rank} variant="menu" size="lg" />
          <div><p className="text-sm text-sub">{RANKS[previous]?.label} →</p><p className="display text-3xl font-bold text-orange-bright">{rank.label}</p></div>
        </div>
      </header>
      <div className="rounded-2xl border border-orange/40 bg-raised p-5 shadow-[0_0_60px_#f9731612] sm:p-7">
        {unlocks.length ? <section><p className="mb-3 text-xs font-semibold text-sub">{R.rankUpUnlocked}</p><ul className="space-y-3">{unlocks.map(u=><li key={u} className="flex items-start gap-3 text-sm text-ink"><span className="text-good" aria-hidden>✓</span><span>{u}</span></li>)}</ul></section> : null}
        <Button variant="primary" full size="lg" className={unlocks.length ? "mt-5" : undefined} onClick={onDone}>{R.ceremonyContinue}</Button>
      </div>
    </div>
  </CeremonyPortal>;
}

/**
 * Legacy-mode unlock (v0.6.1): the first Hard tournament win opens the
 * all-time Legacy gauntlet — a moment worth its own full-screen beat, in the
 * same ceremony language (prismatic, since Legacy is the endgame). Portaled
 * full-screen; dismisses only when the player taps/continues.
 */
function LegacyUnlockCelebration({ onDone }: { onDone: () => void }) {
  const { RESULTS_UI: R } = useCopy();

  // Unlock fanfare, once on mount.
  useEffect(() => {
    sfx.unlock();
  }, []);

  return (
    <CeremonyPortal ariaLabel={R.legacyTitle} className="bg-black/88" onClick={onDone}>
      {/* Rays live in their OWN fixed, non-scrolling clip layer (the overlay now
          scrolls, so we can't reuse the old `.celebrate` overflow:hidden to clip
          them). `.celebrate-rays-prism` CSS is untouched — the champion hero
          that also uses it is unaffected. */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div className="celebrate-rays-prism" />
      </div>
      <p className="kicker relative z-10">{R.legacyKicker}</p>
      <div className="ceremony-burst relative z-10">
        <span className="ceremony-ring" aria-hidden />
        <div className="card-float">
          <LegacyEmblem />
        </div>
      </div>
      <div className="relative z-10 text-center">
        <p className="immaculate-title display bg-gradient-to-b from-cyan via-blue-bright to-purple-400 bg-clip-text text-4xl font-bold uppercase tracking-wide text-transparent md:text-5xl">
          {R.legacyTitle}
        </p>
        <p className="mx-auto mt-3 max-w-xs text-sm text-sub">{R.legacySub}</p>
        <p className="mt-3 text-xs text-faint">{R.legacyHint}</p>
      </div>
    </CeremonyPortal>
  );
}

function LegacyEmblem() {
  // Shared prismatic hexagon + crown (v1.4 — the crown now reads clearly and is
  // reused on the setup card and the in-run Legacy indicator).
  return <LegacyEmblem_ framed gradientId="legacyGradCeremony" />;
}

/**
 * Eliminator reveal (v0.7.0, experimental — FEATURES.showEliminatorTeam):
 * on a lost run, a subdued strip shows the historical lineup that knocked the
 * user out so they can see who ended it. Deliberately low-key (small base
 * cards, muted panel) so it informs without competing with the placement hero.
 * Renders nothing when `results.eliminatedBy` is null (champion / flag off).
 */
function EliminatorReveal({ eliminator, tournament }: { eliminator: EliminatorTeam; tournament: RunState["tournament"] }) {
  const { RESULTS_UI: R, TOURNAMENT_UI: T } = useCopy();
  const end = useMemo(() => runEnd(tournament), [tournament]);
  // The overall the draft screens show for this rival, and what it played at.
  const shownOverall = end?.shown ?? eliminator.overall;
  const playedAt = end?.played ?? null;
  const lineup = lineupById.get(eliminator.lineupId);
  if (!lineup) return null;
  // The specials the eliminator actually fielded (AI upgrades player cards), keyed
  // by playerId so we render the SAME special they beat you with (v1.3.3).
  const specialByPlayerId = new Map<string, string>();
  // v2.0.14: a result saved before v1.3.3 has no `specialIds` (it crashed this screen).
  for (const sid of eliminator.specialIds ?? []) {
    const sp = specialCardById.get(sid);
    if (sp) specialByPlayerId.set(sp.playerId, sid);
  }
  // Full opposing roster (v0.6.1): players, then coach/sub when the lineup
  // fielded them, then the org — so the eliminator reads as a complete team.
  const cards: ResolvedCard[] = [
    ...lineup.playerCardIds.map((id) =>
      resolvePlayerCard(id, specialByPlayerId.get(playerCardById.get(id)?.playerId ?? "")),
    ),
    ...(lineup.coachId ? [resolveCoach(lineup.coachId)] : []),
    ...(lineup.subId ? [resolveSub(lineup.subId)] : []),
    resolveOrg(lineup.orgId, lineup.orgBuffLevel, lineup.seasonId),
  ];

  return (
    <Panel className="mt-8 p-4 sm:p-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="kicker">{R.eliminatorKicker}</p>
          <h3 className="card-title mt-1 truncate">{R.eliminatedBy(eliminator.name)}</h3>
          <p className="mt-1 text-sm text-sub">
            {resultStageLabel(eliminator, T)} · {R.eliminatorScore(eliminator.score[0], eliminator.score[1])}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="display text-4xl font-bold leading-none tabular-nums text-ink">{shownOverall}</p>
          <p className="mt-1 text-xs text-faint">
            {playedAt != null && playedAt !== shownOverall ? R.playedAt(playedAt) : R.rivalOverall}
          </p>
        </div>
      </div>
      {end && end.games.length > 0 ? (
        <ul className="mb-5 flex flex-wrap gap-2" aria-label={R.gamesLabel}>
          {end.games.map((g, i) => (
            <li
              key={i}
              className={cx(
                "flex min-w-[3.25rem] flex-col items-center rounded-md border px-2.5 py-1.5",
                g.won ? "border-good/40" : "border-bad/40",
              )}
            >
              <span className={cx("kicker !text-[11px]", g.won ? "!text-good" : "!text-bad")}>
                {g.won ? R.gameWin : R.gameLoss}
                {g.overtime ? ` ${R.gameOvertime}` : ""}
              </span>
              <span className="display text-base font-semibold tabular-nums text-ink">
                {g.goals[0]}–{g.goals[1]}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {/* Card row — uses the EXACT proven structure from the team-review screen
          (ReviewScreen): a fluid size="sm" card inside a max-w-32 cell, laid out
          3-up on mobile / 6-up on desktop. This is the layout that finally fixed
          the mobile card-overflow that broke earlier attempts here (v1.3.1). */}
      <div className="grid grid-cols-3 gap-2 md:gap-3 lg:grid-cols-6">
        {cards.map((card, i) => (
          <div key={i} className="mx-auto w-full max-w-32">
            <GameCard card={card} showOverall size="sm" fluid tilt="off" />
          </div>
        ))}
      </div>
    </Panel>
  );
}


function HighlightTile({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    // Phone: a row of the highlights board (label and stage on the left, the
    // figure on the right). From 640px: a tile, as before.
    <Panel className="px-3.5 py-2.5 max-sm:flex max-sm:items-center max-sm:justify-between max-sm:gap-3 sm:p-4">
      <p className="kicker !text-[10px] max-sm:shrink-0 sm:mb-1">
        {label}
        {detail ? <span className="mt-0.5 block font-normal normal-case tracking-normal text-faint sm:hidden">{detail}</span> : null}
      </p>
      <p
        className="display min-w-0 truncate text-sm font-bold uppercase tracking-wide text-ink max-sm:text-right"
        title={value}
      >
        {value}
      </p>
      {detail ? <p className="mt-0.5 text-[11px] text-faint max-sm:hidden">{detail}</p> : null}
    </Panel>
  );
}

/** Flip-reveal card: shows a card back, then flips to the real card. */
function RevealCard({
  card,
  delayMs,
  animate,
  // Wrapper classes REPLACE the default — callers control width (the old
  // max-w-36/md:max-w-44 cap lived here, so appending would re-cap and silently
  // block enlargement). The flip-card structural class stays separate via cx().
  className = "mx-auto w-full max-w-36 md:max-w-44",
}: {
  card: ResolvedCard;
  delayMs: number;
  animate: boolean;
  className?: string;
}) {
  const [flipped, setFlipped] = useState(!animate);

  useEffect(() => {
    if (!animate) return;
    const id = setTimeout(() => setFlipped(true), 350 + delayMs);
    return () => clearTimeout(id);
  }, [animate, delayMs]);

  if (!animate) {
    return (
      <div className={className}>
        <GameCard card={card} showOverall size="md" fluid />
      </div>
    );
  }

  return (
    <div className={cx("flip-card", className, flipped && "flipped")}>
      <div className="flip-card-inner relative">
        <div className={cx("flip-face", flipped && "pointer-events-none")}>
          <CardBack />
        </div>
        <div className="flip-face flip-back absolute inset-0">
          <GameCard card={card} showOverall size="md" fluid />
        </div>
      </div>
    </div>
  );
}

function CardBack() {
  return (
    <div className="card-frame card-hidden flex aspect-[3/4.3] w-full flex-col items-center justify-center gap-3 p-3">
      <Logo className="text-[10px]" />
      <span className="display text-4xl font-bold text-faint">??</span>
    </div>
  );
}

