"use client";

/**
 * Challenge match (v1.4) — the "challenge" phase. Shows your drafted team vs the
 * fixed boss line, plays the single Bo7 on demand, then a cleared/failed hero
 * with the reward and retry/back CTAs. Reuses the existing series sim + the
 * results celebration vocabulary (rays/confetti) so it feels of a piece.
 */

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { challengeById, lineupById } from "@/data";
import { lineupHeader } from "@/engine/cards";
import { displayTeamOverall } from "@/engine/rating";
import type { RunState, TournamentTeam } from "@/engine/types";
import { useCopy } from "@/content/copy";
import { cx } from "@/lib/util";
import { sfx } from "@/lib/sfx";
import { useRunStore } from "@/store/runStore";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { TeamLogo } from "@/components/ui/TeamLogo";
import { CrownIcon } from "@/components/ui/icons";
import { RunStepper } from "./RunStepper";

export function ChallengeScreen({ run }: { run: RunState }) {
  const { CHALLENGES_UI: CH } = useCopy();
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
  const [revealed, setRevealed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const GAME_PACE = 780; // ms per game reveal

  const series = state?.series ?? null;
  const totalGames = series?.games.length ?? 0;
  const shownGames = started ? Math.min(revealed, totalGames) : totalGames;
  const revealing = started && series != null && revealed < totalGames;

  const play = () => {
    sfx.start();
    setStarted(true);
    setRevealed(0);
    playChallenge(); // computes the full series synchronously
  };
  const skipReveal = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setRevealed(totalGames); // revealing is derived → false once revealed === total
  };

  // Drive the reveal: one game per tick, with a per-game win/lose blip. The tick
  // schedules only while games remain; reaching the end just stops (no setState
  // in the effect body).
  useEffect(() => {
    if (!started || !series || revealed >= series.games.length) return;
    timerRef.current = setTimeout(() => {
      const g = series.games[revealed];
      if (g?.winnerTeamId === "user") sfx.matchWin();
      else sfx.matchLose();
      setRevealed((r) => r + 1);
    }, GAME_PACE);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [started, series, revealed]);

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
  const { user, opponent, cleared } = state;
  const boss = lineupHeader(challenge.opponentLineupId);
  // Running series score over the games revealed so far.
  const shown = series ? series.games.slice(0, shownGames) : [];
  const userWins = shown.filter((g) => g.winnerTeamId === "user").length;
  const oppWins = shown.length - userWins;

  return (
    <div className="rise-in mx-auto max-w-3xl">
      <RunStepper run={run} />

      {/* Matchup */}
      <Panel className="p-5">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <TeamSide team={user} name={CH.yourTeam} align="start" />
          <span className="display text-xs font-bold uppercase tracking-[0.2em] text-faint">{CH.vs}</span>
          <BossSide team={opponent} orgId={lineupById.get(challenge.opponentLineupId)!.orgId} name={boss.orgName} align="end" />
        </div>
        <p className="mt-3 text-center text-[11px] uppercase tracking-wider text-faint">
          {boss.seasonLabel} · {CH.bestOf(challenge.sim.bestOf)}
        </p>
      </Panel>

      {!series ? (
        <div className="mt-6 text-center">
          <Button variant="primary" onClick={play}>
            {CH.playSeries}
          </Button>
        </div>
      ) : (
        <>
          {/* Live series score while the games reveal */}
          {revealing ? (
            <div className="mt-5 text-center" aria-live="polite">
              <p className="kicker">{CH.simulating}</p>
              <p className="display mt-1 text-3xl font-bold tabular-nums text-ink">
                {userWins}–{oppWins}
              </p>
            </div>
          ) : null}

          {/* Series games (revealed so far) */}
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {shown.map((g, i) => {
              const userWon = g.winnerTeamId === "user";
              return (
                <span
                  key={i}
                  className={cx(
                    "rise-in display rounded-md px-2.5 py-1 text-xs font-bold tabular-nums",
                    userWon ? "bg-good/15 text-good" : "bg-bad/15 text-bad",
                  )}
                >
                  {g.score[0]}–{g.score[1]}
                </span>
              );
            })}
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
                <div className="mt-4 flex justify-center">
                  <Badge tone="gold">{CH.rewardXp(challenge.reward.xp)}</Badge>
                </div>
              ) : null}

              <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
                {!cleared ? (
                  <Button variant="primary" onClick={() => startChallenge(challenge.id)}>
                    {CH.retry}
                  </Button>
                ) : null}
                <Button variant={cleared ? "primary" : "secondary"} onClick={() => router.push("/challenges")}>
                  {CH.backToChallenges}
                </Button>
              </div>
            </div>
          </Panel>
          ) : null}
        </>
      )}
    </div>
  );
}

function TeamSide({ team, name, align }: { team: TournamentTeam; name: string; align: "start" | "end" }) {
  return (
    <div className={cx("min-w-0", align === "end" ? "text-right" : "text-left")}>
      <p className="kicker !text-[10px]">{name}</p>
      <p className="display mt-1 truncate text-sm font-bold uppercase tracking-wide text-ink">{team.name}</p>
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
