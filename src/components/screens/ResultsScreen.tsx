"use client";

/**
 * Results screen: placement, run stats, full team reveal (the payoff moment
 * for hidden-overall runs), XP breakdown, rank progress, achievements and
 * unlocked special cards.
 */

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { achievementById, specialCardById } from "@/data";
import { RESULTS_UI as R, RARITY_LABELS } from "@/content/copy";
import { resolvePlayerCard, type ResolvedCard } from "@/engine/cards";
import { rankForXp } from "@/engine/progression";
import { displayTeamOverall } from "@/engine/rating";
import type { Placement, RunState } from "@/engine/types";
import { cx } from "@/lib/util";
import { useProfileStore } from "@/store/profileStore";
import { useRunStore } from "@/store/runStore";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { Panel, SectionTitle } from "@/components/ui/Panel";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { GameCard } from "@/components/cards/GameCard";
import { rosterSlots } from "@/components/cards/rosterView";
import { Logo } from "@/components/layout/AppShell";
import { RunStepper } from "./RunStepper";

const PLACEMENT_COPY: Record<Placement, { title: string; sub: string; tone: "orange" | "blue" }> = {
  champion: { title: R.champion, sub: R.championSub, tone: "orange" },
  runner_up: { title: R.runnerUp, sub: R.runnerUpSub, tone: "blue" },
  semifinalist: { title: R.semifinalist, sub: R.semifinalistSub, tone: "blue" },
  quarterfinalist: { title: R.quarterfinalist, sub: R.quarterfinalistSub, tone: "blue" },
  swiss_exit: { title: R.swissExit, sub: R.swissExitSub, tone: "blue" },
};

export function ResultsScreen({ run }: { run: RunState }) {
  const router = useRouter();
  const clearRun = useRunStore((s) => s.clearRun);
  const xpNow = useProfileStore((s) => s.xp);

  const results = run.results;
  const team = run.tournament?.teams["user"];
  const slots = useMemo(() => rosterSlots(run.draft.roster), [run.draft.roster]);

  if (!results || !team) return null;

  const placement = PLACEMENT_COPY[results.placement];
  const xpBefore = Math.max(0, xpNow - results.xp.total);
  const rankBefore = rankForXp(xpBefore);
  const rankAfter = rankForXp(xpNow);

  const bestPick = [run.draft.roster.player1, run.draft.roster.player2, run.draft.roster.player3]
    .find((p) => p?.refId === results.bestPlayerCardId);
  const bestPlayer = bestPick
    ? resolvePlayerCard(bestPick.refId, bestPick.specialId)
    : null;

  return (
    <div className="rise-in pb-8">
      <RunStepper run={run} />

      {/* Placement hero */}
      <Panel
        strong
        glow={placement.tone}
        className="mb-8 px-6 py-10 text-center"
      >
        <p className="kicker mb-3">{R.finalPlacement}</p>
        <h1
          className={cx(
            "display text-5xl font-bold uppercase tracking-wide md:text-6xl",
            results.placement === "champion" ? "text-orange-bright" : "text-ink",
          )}
        >
          {placement.title}
        </h1>
        <p className="mt-3 text-sm text-sub">{placement.sub}</p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <Badge tone="blue">
            {R.swissRecord}: {results.swissRecord.wins}–{results.swissRecord.losses}
          </Badge>
          <Badge tone="neutral">Team OVR {displayTeamOverall(team.rating)}</Badge>
          <Badge tone={team.chemistry.percent >= 62 ? "good" : "neutral"}>
            {team.chemistry.tier} chemistry
          </Badge>
        </div>
        {results.championName ? (
          <p className="mt-4 text-xs text-faint">{R.champion0f(results.championName)}</p>
        ) : null}
      </Panel>

      {/* Highlights */}
      <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {bestPlayer ? (
          <HighlightTile label={R.bestPlayer} value={bestPlayer.name} detail={`OVR ${bestPlayer.overall}`} />
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

      {/* Team reveal */}
      <SectionTitle
        title={R.teamReveal}
        right={!run.showOverall ? <Badge tone="orange">{R.hiddenReveal}</Badge> : null}
        className="mb-4"
      />
      <div className="mb-10 flex flex-wrap justify-center gap-3 md:justify-start md:gap-4">
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
                <span>Difficulty multiplier</span>
                <span className="display font-bold text-cyan">×{results.xp.difficultyMultiplier}</span>
              </li>
            ) : null}
            {results.xp.hiddenOverallBonus > 0 ? (
              <li className="flex items-center justify-between text-sm text-sub">
                <span>Hidden overall bonus</span>
                <span className="display font-bold text-cyan">
                  +{Math.round(results.xp.hiddenOverallBonus * 100)}%
                </span>
              </li>
            ) : null}
          </ul>
          <div className="mt-4 flex items-end justify-between border-t border-line pt-4">
            <span className="text-sm font-semibold text-sub">Total</span>
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
                <Badge tone="orange">Rank up!</Badge>
              ) : rankAfter.next ? (
                <span className="text-faint">{rankAfter.xpToNext} XP to {rankAfter.next.label}</span>
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
                  return (
                    <li key={id} className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-orange/15 text-orange-bright">
                        <TrophyIcon />
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
                      card={resolvePlayerCard(sp.baseCardId, sp.id)}
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
                — added to your collection.
              </p>
            </Panel>
          ) : null}
        </div>
      </div>

      {/* CTAs */}
      <div className="mt-10 flex flex-col items-stretch justify-center gap-3 sm:flex-row">
        <Button variant="primary" size="lg" onClick={() => clearRun()}>
          {R.playAgain}
        </Button>
        <Button
          variant="secondary"
          size="lg"
          onClick={() => {
            clearRun();
            router.push("/");
          }}
        >
          {R.backHome}
        </Button>
      </div>
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
    return <GameCard card={card} showOverall size="md" />;
  }

  return (
    <div className={cx("flip-card", flipped && "flipped")}>
      <div className="flip-card-inner relative">
        <div className={cx("flip-face", flipped && "pointer-events-none")}>
          <CardBack />
        </div>
        <div className="flip-face flip-back absolute inset-0">
          <GameCard card={card} showOverall size="md" />
        </div>
      </div>
    </div>
  );
}

function CardBack() {
  return (
    <div className="card-frame card-hidden flex aspect-[3/4.3] w-36 flex-col items-center justify-center gap-3 p-3 md:w-40">
      <Logo className="text-[10px]" />
      <span className="display text-4xl font-bold text-faint">??</span>
    </div>
  );
}

function TrophyIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M8 4h8v5a4 4 0 0 1-8 0Z" strokeLinejoin="round" />
      <path d="M8 5H5a3 3 0 0 0 3 4M16 5h3a3 3 0 0 1-3 4M12 13v4m-3 3h6m-5-3h4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
