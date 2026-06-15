"use client";

/**
 * Results screen v2: celebratory placement hero (rays + confetti for a
 * title), run highlights, team reveal in two rows of three, XP/rank
 * progress, achievement toasts and unlocked specials.
 */

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { achievementById, lineupById, specialCardById } from "@/data";
import { DIFFICULTY } from "@/config/balance";
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
import { downloadShareCard } from "@/lib/shareCard";
import { sfx } from "@/lib/sfx";
import { cx } from "@/lib/util";
import { useProfileStore } from "@/store/profileStore";
import { useRunStore } from "@/store/runStore";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { Panel, SectionTitle } from "@/components/ui/Panel";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { RankBadge } from "@/components/ui/RankBadge";
import { GameCard } from "@/components/cards/GameCard";
import { rosterSlots } from "@/components/cards/rosterView";
import { Logo } from "@/components/layout/AppShell";
import { AchievementIcon } from "@/components/AchievementIcon";
import { achievementStyle } from "@/components/achievementStyle";
import { RunStepper } from "./RunStepper";

const CONFETTI_COLORS = ["#f97316", "#fbbf24", "#3b82f6", "#38bdf8", "#e9eef8"];

export function ResultsScreen({ run }: { run: RunState }) {
  const router = useRouter();
  const { RESULTS_UI: R, RARITY_LABELS, CHEM_TIERS } = useCopy();
  const PLACEMENT_COPY: Record<Placement, { title: string; sub: string; tone: "orange" | "blue" }> = {
    champion: { title: R.champion, sub: R.championSub, tone: "orange" },
    runner_up: { title: R.runnerUp, sub: R.runnerUpSub, tone: "blue" },
    third: { title: R.third, sub: R.thirdSub, tone: "blue" },
    fourth: { title: R.fourth, sub: R.fourthSub, tone: "blue" },
    top4: { title: R.top4, sub: R.top4Sub, tone: "blue" },
    top6: { title: R.top6, sub: R.top6Sub, tone: "blue" },
    top8: { title: R.top8, sub: R.top8Sub, tone: "blue" },
    swiss_exit: { title: R.swissExit, sub: R.swissExitSub, tone: "blue" },
  };
  const clearRun = useRunStore((s) => s.clearRun);
  const setSetupMode = useRunStore((s) => s.setSetupMode);
  const xpNow = useProfileStore((s) => s.xp);
  const winsHard = useProfileStore((s) => s.wins.hard);
  const winsLegacy = useProfileStore((s) => s.wins.legacy);

  const results = run.results;
  const team = run.tournament?.teams["user"];
  const slots = useMemo(() => rosterSlots(run.draft.roster), [run.draft.roster]);
  const [ceremonyOpen, setCeremonyOpen] = useState(
    () => (run.results?.unlockedSpecialIds.length ?? 0) > 0,
  );
  const [rankUpSeen, setRankUpSeen] = useState(false);
  const [legacySeen, setLegacySeen] = useState(false);

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
  const xpBefore = Math.max(0, xpNow - results.xp.total);
  const rankBefore = rankForXp(xpBefore);
  const rankAfter = rankForXp(xpNow);
  const rankedUp = rankBefore.id !== rankAfter.id;
  // Legacy unlocks on the FIRST Hard tournament win — this run is that win when
  // it's a Hard championship and the hard-win counter (already incremented in
  // applyRunResults) just reached 1, with no Legacy title yet.
  const legacyJustUnlocked =
    run.difficulty === "hard" &&
    results.placement === "champion" &&
    winsHard === 1 &&
    winsLegacy === 0;

  const bestPick = [run.draft.roster.player1, run.draft.roster.player2, run.draft.roster.player3]
    .find((p) => p?.refId === results.bestPlayerCardId);
  const bestPlayer = bestPick ? resolvePlayerCard(bestPick.refId, bestPick.specialId) : null;

  const handlePlayAgain = () => {
    // Back to this mode's difficulty selection (last setup pre-selected).
    setSetupMode(run.mode === "quick" ? "quick" : "classic");
    clearRun();
  };

  const handleShare = () => {
    void downloadShareCard({
      placementLabel: placement.title,
      placement: results.placement,
      modeLabel: run.daily ? `Daily · ${run.daily.label}` : run.mode === "quick" ? "Quick Draft" : "Classic Draft",
      difficultyLabel: DIFFICULTY[run.difficulty].label,
      hiddenOverall: !run.showOverall,
      swissRecord:
        run.mode === "quick" ? null : `${results.swissRecord.wins}-${results.swissRecord.losses}`,
      teamOverall: displayTeamOverall(team.rating),
      chemistryTier: team.chemistry.tier,
      players: [run.draft.roster.player1, run.draft.roster.player2, run.draft.roster.player3]
        .filter(Boolean)
        .map((p) => {
          const card = resolvePlayerCard(p!.refId, p!.specialId);
          return { name: card.name, overall: card.overall ?? 0 };
        }),
      staff: [run.draft.roster.coach, run.draft.roster.sub, run.draft.roster.org]
        .map((p) => (p ? rosterSlots(run.draft.roster).find((s) => s.slot === p.slot)?.card?.name : null))
        .filter((n): n is string => Boolean(n) && n !== "No Coach" && n !== "No Sub"),
      xp: results.xp.total,
      date: new Date().toISOString().slice(0, 10),
    });
  };

  return (
    <div className="rise-in pb-8">
      <RunStepper run={run} />
      {ceremonyOpen ? (
        <UnlockCeremony
          specialIds={results.unlockedSpecialIds}
          onDone={() => setCeremonyOpen(false)}
        />
      ) : rankedUp && !rankUpSeen ? (
        <RankUpCelebration rank={rankAfter} onDone={() => setRankUpSeen(true)} />
      ) : legacyJustUnlocked && !legacySeen ? (
        <LegacyUnlockCelebration onDone={() => setLegacySeen(true)} />
      ) : (
        <AchievementToasts ids={results.newAchievementIds} />
      )}

      {/* Placement hero */}
      <Panel
        strong
        glow={placement.tone}
        className={cx(
          "celebrate mb-8 px-6 py-12 text-center",
          isChampion && "!border-orange/50",
          isImmaculate && "!border-cyan/50",
        )}
      >
        {isChampion ? (
          <>
            <div className={isImmaculate ? "celebrate-rays-prism" : "celebrate-rays"} aria-hidden />
            <Confetti prism={isImmaculate} />
          </>
        ) : null}
        <div className="relative z-10">
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
          <p className="mt-3 text-sm text-sub">{placement.sub}</p>
          {run.daily ? (
            <p className="mt-1 text-xs text-orange-bright">Daily · {run.daily.label}</p>
          ) : null}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <Badge tone="blue">
              {R.swissRecord}: {results.swissRecord.wins}–{results.swissRecord.losses}
            </Badge>
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

      {/* Highlights */}
      <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {bestPlayer ? (
          <HighlightTile label={R.bestPlayer} value={bestPlayer.name} detail={R.ovr(bestPlayer.overall ?? 0)} />
        ) : null}
        {results.biggestWin ? (
          <HighlightTile
            label={R.biggestWin}
            value={`${results.biggestWin.score[0]}–${results.biggestWin.score[1]} vs ${results.biggestWin.opponentName}`}
            detail={results.biggestWin.stage}
          />
        ) : null}
        {results.closestSeries ? (
          <HighlightTile
            label={R.closestSeries}
            value={`${results.closestSeries.score[0]}–${results.closestSeries.score[1]} vs ${results.closestSeries.opponentName}`}
            detail={results.closestSeries.stage}
          />
        ) : null}
        {results.worstLoss ? (
          <HighlightTile
            label={R.worstLoss}
            value={`${results.worstLoss.score[0]}–${results.worstLoss.score[1]} vs ${results.worstLoss.opponentName}`}
            detail={results.worstLoss.stage}
          />
        ) : null}
      </div>

      {/* Team reveal: players on top, staff below */}
      <SectionTitle
        title={R.teamReveal}
        right={!run.showOverall ? <Badge tone="orange">{R.hiddenReveal}</Badge> : null}
        className="mb-4"
      />
      <div className="mb-10 grid grid-cols-3 gap-2 md:gap-4">
        {slots.map((s, i) =>
          s.card ? (
            <RevealCard key={s.slot} card={s.card} delayMs={i * 220} animate={!run.showOverall} />
          ) : null,
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* XP + rank */}
        <Panel className="p-5">
          <p className="kicker mb-3">{R.xpGained}</p>
          <ul className="space-y-1.5">
            {results.xp.lines.map((line, i) => (
              <li key={i} className="flex items-center justify-between text-sm text-sub">
                <span>{line.label}</span>
                <span className="display font-bold text-ink">+{line.amount}</span>
              </li>
            ))}
            {results.xp.difficultyMultiplier !== 1 ? (
              <li className="flex items-center justify-between text-sm text-sub">
                <span>{R.difficultyMultiplier}</span>
                <span className="display font-bold text-cyan">×{results.xp.difficultyMultiplier}</span>
              </li>
            ) : null}
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
              +<AnimatedNumber value={results.xp.total} />
              <span className="ml-1 text-base">XP</span>
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
                        <AchievementIcon id={def.id} />
                      </span>
                      <span>
                        <span className="display block text-sm font-bold uppercase tracking-wide text-ink">
                          {def.title}
                        </span>
                        <span className="text-xs text-sub">{def.description} · +{def.xp} XP</span>
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
                — {R.unlockedNote}
              </p>
            </Panel>
          ) : null}
        </div>
      </div>

      {/* Who ended the run (lost runs only, feature-flagged — see results.ts) */}
      {results.eliminatedBy ? <EliminatorReveal eliminator={results.eliminatedBy} /> : null}

      {/* CTAs */}
      <div className="mt-10 flex flex-col items-stretch justify-center gap-3 sm:flex-row">
        <Button variant="primary" size="lg" onClick={handlePlayAgain}>
          {R.playAgain}
        </Button>
        <Button variant="secondary" size="lg" onClick={handleShare}>
          {R.share}
        </Button>
        <Button
          variant="ghost"
          size="lg"
          // Navigate only — the home page clears the run on mount (clearing
          // first flashes the setup screen during the route transition).
          onClick={() => router.push("/")}
        >
          {R.backHome}
        </Button>
      </div>
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
function Confetti({ prism }: { prism?: boolean }) {
  const colors = prism
    ? ["#38bdf8", "#a855f7", "#60a5fa", "#e9eef8", "#c084fc"]
    : CONFETTI_COLORS;
  const pieces = Array.from({ length: 16 }, (_, i) => ({
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
 * Unlock ceremony: each freshly unlocked special gets its reveal moment.
 * Plays AUTOMATICALLY (reveal after a beat, then advance) — clicking just
 * skips ahead.
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

  // Auto-play: reveal after ~1s, linger on the revealed card, then advance.
  useEffect(() => {
    if (!sp) return;
    const delay = revealed ? 3200 : 1000;
    const id = setTimeout(advance, delay);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, revealed, sp?.id]);

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
    // Tap ANYWHERE on the overlay advances (v0.6.1) — the inner button stops
    // propagation so it doesn't double-fire.
    <div
      className="fixed inset-0 z-50 flex cursor-pointer flex-col items-center justify-center gap-6 bg-black/85 p-6 backdrop-blur-sm"
      role="dialog"
      aria-label={R.ceremonyKicker}
      onClick={advance}
    >
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
    </div>
  );
}

/**
 * Rank-up moment (reworked v0.7.0): the v0.5 version read as cramped — this
 * now uses the SAME full-screen overlay language as the "new card unlocked"
 * ceremony (black backdrop, emblem bursting in the center) and the MENU rank
 * art (not the profile set). Auto-dismisses; clicking anywhere skips.
 */
function RankUpCelebration({
  rank,
  onDone,
}: {
  rank: Pick<RankInfo, "id" | "label">;
  onDone: () => void;
}) {
  const { RESULTS_UI: R } = useCopy();
  useEffect(() => {
    const id = setTimeout(onDone, 4200);
    return () => clearTimeout(id);
  }, [onDone]);

  // Rank-up fanfare, once on mount.
  useEffect(() => {
    sfx.rankUp();
  }, []);

  return (
    // Tap ANYWHERE dismisses (v0.6.1).
    <div
      className="fixed inset-0 z-50 flex cursor-pointer flex-col items-center justify-center gap-6 bg-black/85 p-6 backdrop-blur-sm"
      role="dialog"
      aria-label={R.rankUpTitle}
      onClick={onDone}
    >
      <p className="kicker">{R.rankUpKicker}</p>
      <div className="relative">
        <div className="ceremony-burst relative">
          <span className="ceremony-ring" aria-hidden />
          <div className="card-float">
            <RankBadge rank={rank} variant="menu" size="lg" />
          </div>
        </div>
      </div>
      <div className="text-center">
        <p className="champion-title display bg-gradient-to-b from-amber-200 via-orange-bright to-orange bg-clip-text text-4xl font-bold uppercase tracking-wide text-transparent md:text-5xl">
          {R.rankUpTitle}
        </p>
        <p className="display mt-2 text-lg font-bold uppercase tracking-[0.24em] text-ink">
          {rank.label}
        </p>
        <p className="mt-3 text-xs text-sub">{R.rankUpHint}</p>
      </div>
    </div>
  );
}

/**
 * Legacy-mode unlock (v0.6.1): the first Hard tournament win opens the
 * all-time Legacy gauntlet — a moment worth its own full-screen beat, in the
 * same ceremony language (prismatic, since Legacy is the endgame). Tap
 * anywhere or wait to dismiss.
 */
function LegacyUnlockCelebration({ onDone }: { onDone: () => void }) {
  const { RESULTS_UI: R } = useCopy();
  useEffect(() => {
    const id = setTimeout(onDone, 5200);
    return () => clearTimeout(id);
  }, [onDone]);

  // Unlock fanfare, once on mount.
  useEffect(() => {
    sfx.unlock();
  }, []);

  return (
    <div
      className="celebrate fixed inset-0 z-50 flex cursor-pointer flex-col items-center justify-center gap-6 bg-black/88 p-6 backdrop-blur-sm"
      role="dialog"
      aria-label={R.legacyTitle}
      onClick={onDone}
    >
      <div className="celebrate-rays-prism" aria-hidden />
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
    </div>
  );
}

function LegacyEmblem() {
  return (
    <div className="flex h-28 w-28 items-center justify-center rounded-2xl border-2 border-cyan/40 bg-gradient-to-br from-cyan/15 via-blue/10 to-purple-500/15 shadow-[0_0_44px_rgba(56,189,248,0.4)] md:h-32 md:w-32">
      <svg viewBox="0 0 48 48" className="h-16 w-16" fill="none" aria-hidden>
        <defs>
          <linearGradient id="legacyGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#38bdf8" />
            <stop offset="0.5" stopColor="#a855f7" />
            <stop offset="1" stopColor="#f97316" />
          </linearGradient>
        </defs>
        <path d="M24 4 41 14v20L24 44 7 34V14Z" stroke="url(#legacyGrad)" strokeWidth="2.5" strokeLinejoin="round" />
        <path
          d="M15 31l3-13 6 7 6-7 3 13Z"
          stroke="url(#legacyGrad)"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

/**
 * Eliminator reveal (v0.7.0, experimental — FEATURES.showEliminatorTeam):
 * on a lost run, a subdued strip shows the historical lineup that knocked the
 * user out so they can see who ended it. Deliberately low-key (small base
 * cards, muted panel) so it informs without competing with the placement hero.
 * Renders nothing when `results.eliminatedBy` is null (champion / flag off).
 */
function EliminatorReveal({ eliminator }: { eliminator: EliminatorTeam }) {
  const { RESULTS_UI: R } = useCopy();
  const lineup = lineupById.get(eliminator.lineupId);
  if (!lineup) return null;
  // Full opposing roster (v0.6.1): players, then coach/sub when the lineup
  // fielded them, then the org — so the eliminator reads as a complete team.
  const cards: ResolvedCard[] = [
    ...lineup.playerCardIds.map((id) => resolvePlayerCard(id)),
    ...(lineup.coachId ? [resolveCoach(lineup.coachId)] : []),
    ...(lineup.subId ? [resolveSub(lineup.subId)] : []),
    resolveOrg(lineup.orgId, lineup.orgBuffLevel, lineup.seasonId),
  ];

  return (
    <Panel className="mt-8 p-5 opacity-90">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="kicker !text-[10px]">{R.eliminatorKicker}</p>
          <p className="display mt-1 truncate text-sm font-bold uppercase tracking-wide text-sub">
            {R.eliminatedBy(eliminator.name)}
          </p>
        </div>
        <Badge tone="bad" className="shrink-0">
          {eliminator.stage} ·{" "}
          {R.eliminatorScore(eliminator.score[0], eliminator.score[1])}
        </Badge>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:max-w-2xl sm:grid-cols-6">
        {cards.map((card, i) => (
          <div key={i} className="mx-auto w-full max-w-28">
            <GameCard card={card} showOverall size="sm" fluid tilt="off" />
          </div>
        ))}
      </div>
    </Panel>
  );
}

/**
 * Slide-in toasts for freshly earned achievements — each toast wears the
 * achievement's own visual identity (icon, hue, legend prismatics), not a
 * generic trophy (v0.5).
 */
function AchievementToasts({ ids }: { ids: string[] }) {
  const { RESULTS_UI: R } = useCopy();
  const [visible, setVisible] = useState<string[]>([]);

  useEffect(() => {
    if (ids.length === 0) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    ids.forEach((id, i) => {
      timers.push(setTimeout(() => setVisible((v) => [...v, id]), 700 + i * 1100));
      timers.push(
        setTimeout(() => setVisible((v) => v.filter((x) => x !== id)), 700 + i * 1100 + 5200),
      );
    });
    return () => timers.forEach(clearTimeout);
  }, [ids]);

  if (visible.length === 0) return null;

  return (
    <div className="pointer-events-none fixed right-4 top-16 z-50 flex w-72 flex-col gap-2" aria-live="polite">
      {visible.map((id) => {
        const def = achievementById.get(id);
        if (!def) return null;
        const style = achievementStyle(def);
        return (
          <div
            key={id}
            className={cx(
              "toast-enter panel panel-strong pointer-events-auto flex items-center gap-3 p-3",
              style.ring,
              style.glow,
              style.legend && "ach-legend",
            )}
          >
            <span
              className={cx(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                style.chip,
                style.legend && "ach-legend-chip",
              )}
            >
              <AchievementIcon id={def.id} />
            </span>
            <span className="min-w-0">
              <span className={cx("block text-[9px] font-bold uppercase tracking-[0.18em]", style.text)}>
                {R.achievementToast} · {style.label}
              </span>
              <span className="display block truncate text-sm font-bold uppercase tracking-wide text-ink">
                {def.title}
              </span>
              <span className="block text-[11px] text-sub">+{def.xp} XP</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

function HighlightTile({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <Panel className="p-4">
      <p className="kicker mb-1 !text-[10px]">{label}</p>
      <p className="display truncate text-sm font-bold uppercase tracking-wide text-ink" title={value}>
        {value}
      </p>
      {detail ? <p className="mt-0.5 text-[11px] text-faint">{detail}</p> : null}
    </Panel>
  );
}

/** Flip-reveal card: shows a card back, then flips to the real card. */
function RevealCard({
  card,
  delayMs,
  animate,
}: {
  card: ResolvedCard;
  delayMs: number;
  animate: boolean;
}) {
  const [flipped, setFlipped] = useState(!animate);

  useEffect(() => {
    if (!animate) return;
    const id = setTimeout(() => setFlipped(true), 350 + delayMs);
    return () => clearTimeout(id);
  }, [animate, delayMs]);

  if (!animate) {
    return (
      <div className="mx-auto w-full max-w-36 md:max-w-44">
        <GameCard card={card} showOverall size="md" fluid />
      </div>
    );
  }

  return (
    <div className={cx("flip-card mx-auto w-full max-w-36 md:max-w-44", flipped && "flipped")}>
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

