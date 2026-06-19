"use client";

/**
 * Results screen v2: celebratory placement hero (rays + confetti for a
 * title), run highlights, team reveal in two rows of three, XP/rank
 * progress, achievement toasts and unlocked specials.
 */

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { achievementById, lineupById, playerCardById, specialCardById } from "@/data";
import { DIFFICULTY, RANK_REWARDS } from "@/config/balance";
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
import {
  downloadShareCard,
  shareCardBlob,
  shareCardColor,
  shareCardDataUrl,
  type ShareCardData,
} from "@/lib/shareCard";
import { sfx } from "@/lib/sfx";
import { cx } from "@/lib/util";
import { useMounted } from "@/store/useMounted";
import { useProfileStore } from "@/store/profileStore";
import { useRunStore } from "@/store/runStore";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { Panel, SectionTitle } from "@/components/ui/Panel";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Modal } from "@/components/ui/Modal";
import { RankBadge } from "@/components/ui/RankBadge";
import { GameCard } from "@/components/cards/GameCard";
import { rosterSlots } from "@/components/cards/rosterView";
import { Logo } from "@/components/layout/AppShell";
import { AchievementIcon } from "@/components/AchievementIcon";
import { achievementStyle } from "@/components/achievementStyle";
import { BoltIcon, LegacyEmblem as LegacyEmblem_ } from "@/components/ui/icons";
import { RunStepper } from "./RunStepper";

const CONFETTI_COLORS = ["#f97316", "#fbbf24", "#3b82f6", "#38bdf8", "#e9eef8"];

export function ResultsScreen({ run }: { run: RunState }) {
  const router = useRouter();
  const { RESULTS_UI: R, REVIEW, RARITY_LABELS, CHEM_TIERS } = useCopy();
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
  const playerSlots = slots.slice(0, 3); // player1 · player2 · player3
  const benchSlots = slots.slice(3); // coach · sub · org (null in Quick)
  const [ceremonyOpen, setCeremonyOpen] = useState(
    () => (run.results?.unlockedSpecialIds.length ?? 0) > 0,
  );
  const [rankUpSeen, setRankUpSeen] = useState(false);
  const [legacySeen, setLegacySeen] = useState(false);
  const [shareData, setShareData] = useState<ShareCardData | null>(null);

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
    const roleOf: Record<string, string> = {
      player1: "P1", player2: "P2", player3: "P3", coach: "Coach", sub: "Sub", org: "Org",
    };
    const cards = rosterSlots(run.draft.roster)
      .filter((s) => s.card)
      .map((s) => {
        const c = s.card!;
        const isOrg = c.kind === "org";
        const isSpecial = Boolean(c.special);
        // Every card carries its org crest (org id is the org card's ref, or the
        // card's own org for players/coach/sub).
        const orgId = isOrg ? (c.orgId ?? c.refId) : c.orgId;
        return {
          name: c.name,
          value: isOrg ? (c.buffLevel && c.buffLevel !== "~" ? c.buffLevel : "~") : String(c.overall ?? ""),
          color: shareCardColor({
            isSpecial,
            specialRarity: c.special?.rarity,
            overall: c.overall,
            isOrg,
            buffLevel: c.buffLevel,
          }),
          isSpecial,
          role: roleOf[s.slot] ?? s.slot,
          imageUrl: orgId ? `/orgs/${orgId}.png` : undefined,
        };
      });
    setShareData({
      placementLabel: placement.title,
      placement: results.placement,
      modeLabel: run.daily ? `Daily · ${run.daily.label}` : run.mode === "quick" ? "Quick Draft" : "Classic Draft",
      difficultyLabel: DIFFICULTY[run.difficulty].label,
      hiddenOverall: !run.showOverall,
      swissRecord:
        run.mode === "quick" ? null : `${results.swissRecord.wins}-${results.swissRecord.losses}`,
      teamOverall: displayTeamOverall(team.rating),
      chemistryTier: team.chemistry.tier,
      cards,
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
        <RankUpCelebration
          rank={rankAfter}
          prevRankId={rankBefore.id}
          onDone={() => setRankUpSeen(true)}
        />
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

      {/* Team reveal: the three player cards across the pitch (the middle one
          raised, the outer two aligned), staff in a spaced row below. Card size
          matches the draft screen. */}
      <SectionTitle
        title={R.teamReveal}
        right={!run.showOverall ? <Badge tone="orange">{R.hiddenReveal}</Badge> : null}
        className="mb-4"
      />
      <div className="mb-10">
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

      {/* Team-overall breakdown — shown on results for ALL modes (v1.3.3; was
          hidden runs only). A clean end-of-run summary of how the team's overall
          was built, regardless of whether overalls were visible during play. */}
      <Panel strong glow="blue" className="mb-10 p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="kicker">{REVIEW.teamOverall}</p>
          <p className="display text-4xl font-bold leading-none text-ink">
            {displayTeamOverall(team.rating)}
          </p>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-sub sm:grid-cols-3">
          <ResultRow label={REVIEW.rowPlayers} value={team.rating.avgPlayerOverall.toFixed(1)} />
          {run.mode !== "quick" ? (
            <>
              <ResultRow label={REVIEW.rowCoach} value={`+${team.rating.coachMod.toFixed(1)}`} />
              <ResultRow label={REVIEW.rowSub} value={`+${team.rating.subMod.toFixed(1)}`} />
              <ResultRow label={REVIEW.rowOrg} value={`+${team.rating.orgMod.toFixed(1)}`} />
            </>
          ) : null}
          <ResultRow label={REVIEW.rowChemistry} value={`+${team.rating.chemMod.toFixed(1)}`} />
          <ResultRow label={REVIEW.rowSpecials} value={`+${team.rating.specialMod.toFixed(1)}`} />
        </dl>
      </Panel>

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

      {shareData ? (
        <ShareModal
          data={shareData}
          isChampion={isChampion}
          placementLabel={placement.title}
          onClose={() => setShareData(null)}
        />
      ) : null}
    </div>
  );
}

/**
 * Share preview (v1.3.1): renders the share image, a placement-aware caption and
 * three ways out — native Share (image + text on supporting devices), an X
 * compose intent (prefilled text), or a plain PNG download.
 */
function ShareModal({
  data,
  isChampion,
  placementLabel,
  onClose,
}: {
  data: ShareCardData;
  isChampion: boolean;
  placementLabel: string;
  onClose: () => void;
}) {
  const { RESULTS_UI: R } = useCopy();
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void shareCardDataUrl(data).then((u) => {
      if (alive) setUrl(u);
    });
    return () => {
      alive = false;
    };
  }, [data]);

  const message = isChampion ? R.shareMsgChampion : R.shareMsgPlacement(placementLabel);

  const onNativeShare = async () => {
    try {
      const blob = await shareCardBlob(data);
      const file = new File([blob], `rocket-draft-${data.date}.png`, { type: "image/png" });
      const nav = navigator as Navigator & {
        canShare?: (d: ShareData) => boolean;
      };
      if (nav.canShare?.({ files: [file] }) && nav.share) {
        await nav.share({ files: [file], text: `${message} rocketdraft.app` });
        return;
      }
    } catch {
      /* user cancelled or unsupported — fall through to download */
    }
    void downloadShareCard(data);
  };

  const onX = () => {
    const text = encodeURIComponent(`${message} rocketdraft.app`);
    window.open(`https://twitter.com/intent/tweet?text=${text}`, "_blank", "noopener,noreferrer");
  };

  return (
    <Modal open title={R.shareTitle} onClose={onClose} wide>
      <div className="space-y-4">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="w-full rounded-lg border border-line" />
        ) : (
          <div className="aspect-[1200/630] w-full animate-pulse rounded-lg bg-white/5" />
        )}
        <p className="text-center text-sm text-sub">{message}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="primary" onClick={onNativeShare}>
            {R.shareNative}
          </Button>
          <Button variant="secondary" onClick={onX}>
            {R.shareX}
          </Button>
          <Button variant="ghost" onClick={() => void downloadShareCard(data)}>
            {R.shareDownload}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function ResultRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-line/40 py-0.5">
      <dt>{label}</dt>
      <dd className="display font-bold text-ink">{value}</dd>
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
  useEffect(() => {
    // Capture + restore the prior value (not a hardcoded '') so concurrent lock
    // owners (e.g. a Modal) can't be desynced by this overlay's cleanup.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);
  if (!mounted) return null;
  return createPortal(
    <div
      // Full-screen SCROLL container: tall ceremony content (e.g. the Legacy
      // unlock on a SHORT viewport) stays reachable and the "tap to continue"
      // hint is never clipped off-screen. Body scroll stays locked (intended) —
      // only this overlay scrolls; the inner min-h-full centers it when it fits.
      className={cx(
        "fixed inset-0 z-[60] cursor-pointer overflow-y-auto overscroll-contain backdrop-blur-sm",
        className,
      )}
      role="dialog"
      aria-label={ariaLabel}
      onClick={onClick}
    >
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
    // Show the GAIN over the previous rank (e.g. "+2%"), not the absolute chance —
    // it reads as a reward and stays correct as the base rates change.
    out.push(R.unlockChance(Math.round((after.specialChance - before.specialChance) * 100)));
  }
  return out;
}

function RankUpCelebration({
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

  return (
    // Portaled full-screen; dismisses only when the player taps/continues.
    <CeremonyPortal ariaLabel={R.rankUpTitle} className="bg-black/85" onClick={onDone}>
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
        {unlocks.length > 0 ? (
          <div className="mx-auto mt-5 max-w-xs rounded-xl border border-orange/25 bg-orange/5 px-4 py-3">
            <p className="kicker !text-[10px] text-orange-bright">{R.rankUpUnlocked}</p>
            <ul className="mt-2 space-y-1">
              {unlocks.map((u, i) => (
                <li key={i} className="flex items-center justify-center gap-1.5 text-sm font-semibold text-ink">
                  <span className="text-good">+</span> {u}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="mt-3 text-xs text-sub">{R.rankUpHint}</p>
        )}
      </div>
    </CeremonyPortal>
  );
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
function EliminatorReveal({ eliminator }: { eliminator: EliminatorTeam }) {
  const { RESULTS_UI: R } = useCopy();
  const lineup = lineupById.get(eliminator.lineupId);
  if (!lineup) return null;
  // The specials the eliminator actually fielded (AI upgrades player cards), keyed
  // by playerId so we render the SAME special they beat you with (v1.3.3).
  const specialByPlayerId = new Map<string, string>();
  for (const sid of eliminator.specialIds) {
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
    <Panel className="mt-8 p-5 opacity-90">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="kicker !text-[10px]">{R.eliminatorKicker}</p>
          <p className="display mt-1 truncate text-sm font-bold uppercase tracking-wide text-sub">
            {R.eliminatedBy(eliminator.name)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="display text-2xl font-bold leading-none text-ink">
            {eliminator.overall}
            {eliminator.buffed ? (
              <span
                className="ml-0.5 inline-flex align-top text-orange"
                title={R.eliminatorBuffed}
                aria-label={R.eliminatorBuffed}
              >
                <BoltIcon className="h-4 w-4" />
              </span>
            ) : null}
          </span>
          <Badge tone="bad">
            {eliminator.stage} ·{" "}
            {R.eliminatorScore(eliminator.score[0], eliminator.score[1])}
          </Badge>
        </div>
      </div>
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

/**
 * Slide-in toasts for freshly earned achievements — each toast wears the
 * achievement's own visual identity (icon, hue, legend prismatics), not a
 * generic trophy (v0.5). They appear one after another in the screen corner
 * and auto-dismiss, so they inform without taking over the results screen.
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
    <div
      className="pointer-events-none fixed right-4 top-16 z-50 flex w-72 flex-col gap-2"
      aria-live="polite"
    >
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
              <span
                className={cx("block text-[9px] font-bold uppercase tracking-[0.18em]", style.text)}
              >
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

