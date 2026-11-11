"use client";

/**
 * Challenge match (v1.4) — the "challenge" phase. Shows your drafted team vs the
 * fixed boss line, plays the single Bo7 on demand, then a cleared/failed hero
 * with the reward and retry/back CTAs. Reuses the existing series sim + the
 * results celebration vocabulary (rays/confetti) so it feels of a piece.
 */

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChallengeMatchBoard, useSeriesPlayback } from "@/components/challenges/ChallengeMatchBoard";
import { challengeById, lineupById } from "@/data";
import { lineupHeader } from "@/engine/cards";
import { countStars, rosterFromLineup, starsAvailable, totalStars } from "@/engine/challenges";
import { StarRow } from "@/app/challenges/ChallengesView";
import { challengeStarLabels } from "@/components/challenges/challengeLabels";
import { CHALLENGE } from "@/config/balance";
import { COSMETICS } from "@/data/cosmetics";
import { CosmeticIcon, useCosmeticCopy } from "@/components/cosmetics/CosmeticViews";
import { Modal } from "@/components/ui/Modal";
import { rankForXp } from "@/engine/progression";
import { displayTeamOverall } from "@/engine/rating";
import type { RunState, TournamentTeam } from "@/engine/types";
import { useCopy } from "@/content/copy";
import { teamDisplayName } from "@/lib/runLabels";
import { cx } from "@/lib/util";
import { sfx } from "@/lib/sfx";
import { useOverlayHold } from "@/store/overlayHoldStore";
import { useProfileStore } from "@/store/profileStore";
import { useRunStore } from "@/store/runStore";
import { RankUpCelebration } from "./ResultsScreen";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { TeamLogo } from "@/components/ui/TeamLogo";
import { FieldView } from "@/components/cards/FieldView";
import { CrownIcon } from "@/components/ui/icons";
import { RunStepper } from "./RunStepper";
import { DraftChallengeResult } from "./DraftChallengeResult";

export function ChallengeScreen({ run }: { run: RunState }) {
  const { CHALLENGES_UI: CH, TOURNAMENT_UI: T } = useCopy();
  const router = useRouter();
  const playChallenge = useRunStore((s) => s.playChallenge);
  const startChallenge = useRunStore((s) => s.startChallenge);
  const challenge = run.challengeId ? challengeById.get(run.challengeId) : undefined;
  const state = run.challenge;

  // Animated game-by-game reveal of the Bo7 (v1.4) — challenges used to resolve
  // instantly; now the series plays out like the other modes. `revealed` counts
  // shown games; `animating` is the playback window opened by "Play the series".
  // `started` opens the playback window (set once on "Play"); it never auto-resets,
  // so `revealing` is derived (no setState inside the reveal effect → no cascading-
  // render lint hit). On a fresh mount/refresh with a series already present,
  // `started` is false so the whole series shows at once.
  const [started, setStarted] = useState(false);

  // Rank-up celebration (v1.4): a challenge clear grants XP, which can cross a rank
  // threshold — fire the same full-screen ceremony the run results use. `xpBefore` was
  // captured at clear time, so this is robust to re-renders.
  const xpNow = useProfileStore((s) => s.xp);
  const [rankUpSeen, setRankUpSeen] = useState(false);

  const series = state?.series ?? null;
  const totalGames = series?.games.length ?? 0;
  // v2.0 (G2): the series plays beat by beat on the Road to Worlds clock board;
  // the cursor counts whole games (and the beats of the one in play).
  const roundKey = `challenge:${run.challengeId ?? ""}`;
  const playback = useSeriesPlayback(series, roundKey, started, (g) => {
    if (g.winnerTeamId === "user") sfx.matchWin();
    else sfx.matchLose();
  });
  const revealed = playback.cursor.game;
  const revealing = started && series != null && revealed < totalGames;
  // rc.29 (DRAFT-02): the clear's XP lands when the series is computed, before
  // it plays — its cosmetic unlocks wait until the series has been shown (and
  // the rank-up ceremony after it holds them in turn). Held from before "Play"
  // so the hold is already up when they arrive; a gauntlet lost at a stage
  // has no boss series to show.
  const played = !!state?.evaluated || series != null || (state?.stages?.failedAt ?? null) !== null;
  useOverlayHold("live", !played || revealing);

  const play = () => {
    sfx.start();
    setStarted(true);
    playback.restart();
    playChallenge(); // computes the full series synchronously
  };
  const skipReveal = () => playback.finish(); // revealing is derived → false at the end

  // One-shot win/lose sting once the whole series has been revealed.
  const stung = useRef(false);
  useEffect(() => {
    if (state?.series && !revealing && !stung.current) {
      stung.current = true;
      if (state.cleared) sfx.win();
      else sfx.lose();
    }
  }, [state?.series, state?.cleared, revealing]);

  if (!state || !challenge) return null;
  if (challenge.kind === "draft") return <DraftChallengeResult run={run} challenge={challenge} state={state} />;
  const { user, opponent, cleared } = state;
  const boss = lineupHeader(challenge.opponentLineupId);
  const stages = state.stages;
  const stageOpponents = stages?.opponents ?? [];
  const finishedAttempt = Boolean(series) || (stages?.failedAt !== null && stages?.failedAt !== undefined);

  // Did the clear reward cross a rank? Only after the series is revealed (so the
  // ceremony lands with the win, not mid-animation).
  const rankBefore = state.xpBefore != null ? rankForXp(state.xpBefore) : null;
  const rankAfter = rankForXp(xpNow);
  const rankedUp =
    cleared && !revealing && rankBefore != null && rankBefore.id !== rankAfter.id;

  return (
    <div className="rise-in mx-auto max-w-3xl">
      {rankedUp && !rankUpSeen ? (
        <RankUpCelebration
          rank={rankAfter}
          prevRankId={rankBefore.id}
          onDone={() => setRankUpSeen(true)}
        />
      ) : null}
      <RunStepper run={run} />

      {/* Matchup header */}
      <Panel className="p-5">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <TeamSide team={user} kicker={CH.yourTeam} name={teamDisplayName(user, T)} align="start" />
          <span className="display text-xs font-bold uppercase tracking-[0.2em] text-faint">{CH.vs}</span>
          <BossSide team={opponent} orgId={lineupById.get(challenge.opponentLineupId)!.orgId} name={boss.orgName} align="end" />
        </div>
        <p className="mt-3 text-center text-[11px] uppercase tracking-wider text-faint">
          {boss.seasonLabel} · {CH.bestOf(challenge.sim.bestOf)}
        </p>
      </Panel>

      {/* Both teams on the pitch (v1.4) — your line and the boss line side by side. */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <p className="kicker mb-1.5">{CH.yourTeam}</p>
          <FieldView roster={run.draft.roster} showOverall showBench={false} />
        </div>
        <div>
          <p className="kicker mb-1.5">{CH.theBoss}</p>
          <FieldView roster={rosterFromLineup(challenge.opponentLineupId)} showOverall showBench={false} />
        </div>
      </div>

      {/* Gauntlet stages (v2.0): the road to the boss. */}
      {stageOpponents.length ? (
        <Panel className="mt-4 p-4">
          <p className="kicker mb-2 !text-[10px]">{CH.gauntletKicker}</p>
          <ol className="space-y-1.5">
            {stageOpponents.map((o, i) => {
              const r = stages?.results[i];
              const won = r ? r.winnerTeamId === user.id : null;
              const myScore = r ? (r.teamAId === user.id ? r.score[0] : r.score[1]) : null;
              const theirScore = r ? (r.teamAId === user.id ? r.score[1] : r.score[0]) : null;
              return (
                <li key={o.id} className={cx("flex items-center gap-2 rounded-lg border px-3 py-2 text-xs", won === true ? "border-good/40 bg-good/5" : won === false ? "border-bad/40 bg-bad/5" : "border-line/60")}>
                  <Badge tone="neutral">{CH.stage(i + 1)}</Badge>
                  <TeamLogo orgId={o.orgId} size="sm" />
                  <span className="min-w-0 flex-1 truncate font-semibold text-ink">{o.name}</span>
                  <span className="display text-sm font-bold text-ink">{displayTeamOverall(o.rating)}</span>
                  {r ? (
                    <span className={cx("display text-sm font-bold", won ? "text-good" : "text-bad")}>
                      {myScore}–{theirScore}
                    </span>
                  ) : (
                    <span className="text-[10px] uppercase tracking-wider text-faint">{finishedAttempt ? "—" : CH.stageUpcoming}</span>
                  )}
                </li>
              );
            })}
            <li className="flex items-center gap-2 rounded-lg border border-orange/30 px-3 py-2 text-xs">
              <Badge tone="orange">{CH.bossStage}</Badge>
              <TeamLogo orgId={lineupById.get(challenge.opponentLineupId)!.orgId} size="sm" />
              <span className="min-w-0 flex-1 truncate font-semibold text-ink">{boss.orgName}</span>
              <span className="display text-sm font-bold text-ink">{displayTeamOverall(opponent.rating)}</span>
            </li>
          </ol>
        </Panel>
      ) : null}

      {!finishedAttempt ? (
        <div className="mt-6 text-center">
          <Button variant="primary" onClick={play}>
            {CH.playSeries}
          </Button>
        </div>
      ) : !series ? (
        /* Gauntlet lost before the boss (v2.0). */
        <Panel strong className="celebrate mt-6 px-6 py-10 text-center">
          <div className="relative z-10">
            <h1 className="display text-3xl font-bold uppercase tracking-wide text-ink md:text-4xl">{CH.failedTitle}</h1>
            <p className="mt-3 text-sm text-sub">{CH.failedSub}</p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <Button variant="primary" onClick={() => startChallenge(challenge.id)}>
                {CH.retry}
              </Button>
              <Button variant="secondary" onClick={() => router.push("/challenges")}>
                {CH.backToChallenges}
              </Button>
            </div>
          </div>
        </Panel>
      ) : (
        <>
          {/* The series on the running-clock board (v2.0): goals land on the
              5:00 clock, overtime counts up, chips fill game by game. */}
          <div className="mt-6">
            <ChallengeMatchBoard
              series={series}
              roundKey={roundKey}
              bestOf={challenge.sim.bestOf}
              teamA={series.teamAId === user.id ? user : opponent}
              teamB={series.teamAId === user.id ? opponent : user}
              nameA={series.teamAId === user.id ? teamDisplayName(user, T) : boss.orgName}
              nameB={series.teamAId === user.id ? boss.orgName : teamDisplayName(user, T)}
              kicker={`${boss.seasonLabel} · ${CH.bestOf(challenge.sim.bestOf)}`}
              progress={revealing ? playback.cursor : null}
              sync={playback.sync}
            />
          </div>

          {revealing ? (
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={skipReveal}
                className="text-[11px] font-semibold uppercase tracking-wider text-faint underline-offset-2 transition-colors hover:text-ink hover:underline"
              >
                {CH.skip}
              </button>
            </div>
          ) : null}

          {/* Result hero — only once the series is fully revealed */}
          {series && !revealing ? (
          <Panel
            strong
            glow={cleared ? "orange" : undefined}
            className={cx("celebrate mt-6 px-6 py-10 text-center", cleared && "!border-orange/50")}
          >
            {cleared ? <div className="celebrate-rays" aria-hidden /> : null}
            <div className="relative z-10">
              {cleared ? (
                <CrownIcon className="mx-auto mb-3 h-10 w-10 text-amber-300" />
              ) : null}
              <p className="kicker mb-2">
                {CH.seriesScore(
                  series.winnerTeamId === "user" ? series.score[0] : series.score[1],
                  series.winnerTeamId === "user" ? series.score[1] : series.score[0],
                )}
              </p>
              <h1
                className={cx(
                  "display text-3xl font-bold uppercase tracking-wide md:text-4xl",
                  cleared
                    ? "champion-title bg-gradient-to-b from-amber-200 via-orange-bright to-orange bg-clip-text text-transparent"
                    : "text-ink",
                )}
              >
                {cleared ? CH.clearedTitle : CH.failedTitle}
              </h1>
              <p className="mt-3 text-sm text-sub">{cleared ? CH.clearedSub : CH.failedSub}</p>
              {cleared ? (
                <div className="mt-4 flex flex-col items-center gap-2">
                  <StarRow mask={state.starsEarned ?? 1} total={starsAvailable(challenge)} size="md" />
                  {state.starsNew ? (
                    <Badge tone="gold">
                      {countStars(state.starsNew) === 1 ? CH.newStar : CH.newStars(countStars(state.starsNew))}
                      {xpNow - (state.xpBefore ?? xpNow) > 0 ? ` · +${xpNow - (state.xpBefore ?? xpNow)} XP` : ""}
                    </Badge>
                  ) : (
                    <Badge tone="neutral">{CH.noNewStars}</Badge>
                  )}
                </div>
              ) : null}

              <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
                {!cleared || countStars(state.starsEarned ?? 0) < starsAvailable(challenge) ? (
                  <Button variant={cleared ? "secondary" : "primary"} onClick={() => startChallenge(challenge.id)}>
                    {cleared ? CH.replay : CH.retry}
                  </Button>
                ) : null}
                <Button variant={cleared ? "primary" : "secondary"} onClick={() => router.push("/challenges")}>
                  {CH.backToChallenges}
                </Button>
              </div>
            </div>
          </Panel>
          ) : null}
          {series && !revealing && cleared && state.starsNew ? (
            <StarRewardModal
              challenge={challenge}
              starsEarned={state.starsEarned ?? 1}
              starsNew={state.starsNew}
              xpGained={xpNow - (state.xpBefore ?? xpNow)}
              CH={CH}
            />
          ) : null}
        </>
      )}
    </div>
  );
}

/**
 * rc.2: the reward moment. Opens once per cleared attempt that earned a NEW
 * star: the stars with what each one asked (new ones lit), the XP, and where
 * the player now stands on the star track (next cosmetic reward).
 */
function StarRewardModal({
  challenge,
  starsEarned,
  starsNew,
  xpGained,
  CH,
}: {
  challenge: NonNullable<ReturnType<typeof challengeById.get>>;
  starsEarned: number;
  starsNew: number;
  xpGained: number;
  CH: ReturnType<typeof useCopy>["CHALLENGES_UI"];
}) {
  const copy = useCosmeticCopy();
  const starMasks = useProfileStore((s) => s.challengeStars);
  const [dismissed, setDismissed] = useState(false);
  const labels = challengeStarLabels(challenge, CH);
  const total = totalStars(starMasks);
  const next = CHALLENGE.starMilestones.find((m) => m > total) ?? null;
  const reward = next ? COSMETICS.find((c) => c.source.type === "challenge-stars" && c.source.stars === next) ?? null : null;
  const prev = [...CHALLENGE.starMilestones].reverse().find((m) => m <= total) ?? 0;
  const pct = next ? Math.min(100, Math.round(((total - prev) / (next - prev)) * 100)) : 100;
  return (
    <Modal
      open={!dismissed}
      title={CH.starRewardTitle}
      onClose={() => setDismissed(true)}
      actions={
        <Button variant="primary" onClick={() => setDismissed(true)}>
          {CH.starRewardContinue}
        </Button>
      }
    >
      <div className="text-center">
        <StarRow mask={starsEarned} total={starsAvailable(challenge)} size="md" />
        <p className="display mt-2 text-2xl font-bold text-orange-bright">
          {countStars(starsNew) === 1 ? CH.newStar : CH.newStars(countStars(starsNew))}
          {xpGained > 0 ? <span className="ml-2 text-base text-ink">+{xpGained} XP</span> : null}
        </p>
      </div>
      <ul className="mt-4 space-y-1.5">
        {labels.map((label, i) => {
          const earned = Boolean(starsEarned & (1 << i));
          const fresh = Boolean(starsNew & (1 << i));
          return (
            <li
              key={i}
              className={cx(
                "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs",
                fresh ? "border-amber-300/60 bg-amber-300/10 text-ink" : earned ? "border-line text-sub" : "border-line/60 text-faint",
              )}
            >
              <span className={cx("text-base leading-none", earned ? "text-amber-300" : "text-faint/60")} aria-hidden>
                ★
              </span>
              <span className="flex-1">{label}</span>
              {fresh ? <Badge tone="gold">{CH.newStar}</Badge> : null}
            </li>
          );
        })}
      </ul>
      <div className="mt-5 rounded-xl border border-line bg-white/[0.03] p-3">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="kicker !text-[10px]">{CH.starTrack}</span>
          <span className="display font-bold text-ink">{next ? CH.starTrackProgress(total, next) : CH.starsTotal(total)}</span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/8">
          <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-300" style={{ width: `${pct}%` }} />
        </div>
        {reward ? (
          <div className="mt-2 flex items-center gap-2 text-xs text-sub">
            <CosmeticIcon def={reward} />
            <span>{CH.starTrackReward(copy.name(reward.id))}</span>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

/** The player's side of the matchup header. `name` is the team's display name
 *  (rc.29 review R1: `teamDisplayName`, never the engine's English default). */
function TeamSide({
  team,
  kicker,
  name,
  align,
}: {
  team: TournamentTeam;
  kicker: string;
  name: string;
  align: "start" | "end";
}) {
  return (
    <div className={cx("min-w-0", align === "end" ? "text-right" : "text-left")}>
      <p className="kicker !text-[10px]">{kicker}</p>
      <p className="display mt-1 truncate text-sm font-bold uppercase tracking-wide text-ink">{name}</p>
      <p className="display mt-1 text-2xl font-bold text-orange-bright">{displayTeamOverall(team.rating)}</p>
    </div>
  );
}

function BossSide({
  team,
  orgId,
  name,
  align,
}: {
  team: TournamentTeam;
  orgId: string;
  name: string;
  align: "start" | "end";
}) {
  return (
    <div className={cx("flex min-w-0 items-center gap-2", align === "end" && "flex-row-reverse text-right")}>
      <TeamLogo orgId={orgId} size="md" />
      <div className="min-w-0">
        <p className="display truncate text-sm font-bold uppercase tracking-wide text-ink">{name}</p>
        <p className="display mt-1 text-2xl font-bold text-ink">{displayTeamOverall(team.rating)}</p>
      </div>
    </div>
  );
}
