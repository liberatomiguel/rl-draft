"use client";

/**
 * Results screen v2: celebratory placement hero (rays + confetti for a
 * title), run highlights, team reveal in two rows of three, XP/rank
 * progress, achievement toasts and unlocked specials.
 */

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { achievementById, specialCardById } from "@/data";
import { DIFFICULTY } from "@/config/balance";
import { RESULTS_UI as R, RARITY_LABELS } from "@/content/copy";
import { resolvePlayerCard, resolveSpecial, type ResolvedCard } from "@/engine/cards";
import { rankForXp } from "@/engine/progression";
import { displayTeamOverall } from "@/engine/rating";
import type { Placement, RunState } from "@/engine/types";
import { downloadShareCard } from "@/lib/shareCard";
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
  third: { title: R.third, sub: R.thirdSub, tone: "blue" },
  fourth: { title: R.fourth, sub: R.fourthSub, tone: "blue" },
  top4: { title: R.top4, sub: R.top4Sub, tone: "blue" },
  top6: { title: R.top6, sub: R.top6Sub, tone: "blue" },
  top8: { title: R.top8, sub: R.top8Sub, tone: "blue" },
  swiss_exit: { title: R.swissExit, sub: R.swissExitSub, tone: "blue" },
};

const CONFETTI_COLORS = ["#f97316", "#fbbf24", "#3b82f6", "#38bdf8", "#e9eef8"];

export function ResultsScreen({ run }: { run: RunState }) {
  const router = useRouter();
  const clearRun = useRunStore((s) => s.clearRun);
  const setSetupMode = useRunStore((s) => s.setSetupMode);
  const xpNow = useProfileStore((s) => s.xp);

  const results = run.results;
  const team = run.tournament?.teams["user"];
  const slots = useMemo(() => rosterSlots(run.draft.roster), [run.draft.roster]);
  const [ceremonyOpen, setCeremonyOpen] = useState(
    () => (run.results?.unlockedSpecialIds.length ?? 0) > 0,
  );

  if (!results || !team) return null;

  const placement = PLACEMENT_COPY[results.placement];
  const isChampion = results.placement === "champion";
  // Flawless: title without dropping a single series → prismatic celebration.
  const isImmaculate = isChampion && checkNoSeriesLost(run);
  const xpBefore = Math.max(0, xpNow - results.xp.total);
  const rankBefore = rankForXp(xpBefore);
  const rankAfter = rankForXp(xpNow);

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
            <Badge tone="neutral">Team OVR {displayTeamOverall(team.rating)}</Badge>
            <Badge tone={team.chemistry.percent >= 62 ? "good" : "neutral"}>
              {team.chemistry.tier} chemistry
            </Badge>
            {results.goalsConceded === 0 ? <Badge tone="gold">Untouchable</Badge> : null}
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

      {/* Team reveal: players on top, staff below */}
      <SectionTitle
        title={R.teamReveal}
        right={!run.showOverall ? <Badge tone="orange">{R.hiddenReveal}</Badge> : null}
        className="mb-4"
      />
      <div className="mb-10 grid grid-cols-3 justify-items-center gap-2 md:gap-4">
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
                — added to your collection.
              </p>
            </Panel>
          ) : null}
        </div>
      </div>

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

  if (!sp) {
    onDone();
    return null;
  }
  const card = resolveSpecial(sp);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-black/85 p-6 backdrop-blur-sm"
      role="dialog"
      aria-label={R.ceremonyKicker}
    >
      <p className="kicker">{R.ceremonyKicker}</p>
      <button type="button" onClick={advance} className="relative outline-none" aria-label={R.ceremonyTap}>
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
      </button>
      <p className="text-xs text-sub">
        {specialIds.length > 1 ? `${index + 1}/${specialIds.length} · ` : ""}
        {revealed ? "" : R.ceremonyTap}
      </p>
      {revealed ? (
        <Button variant="primary" onClick={advance}>
          {last ? R.ceremonyContinue : "Next card"}
        </Button>
      ) : null}
    </div>
  );
}

/** Slide-in toasts for freshly earned achievements. */
function AchievementToasts({ ids }: { ids: string[] }) {
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
        return (
          <div key={id} className="toast-enter panel-strong pointer-events-auto flex items-center gap-3 p-3 !border-orange/40">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange/15 text-orange-bright">
              <TrophyIcon />
            </span>
            <span className="min-w-0">
              <span className="kicker block !text-[9px]">{R.achievementToast}</span>
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
    <div className="card-frame card-hidden flex aspect-[3/4.3] w-36 flex-col items-center justify-center gap-3 p-3 md:w-44">
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
