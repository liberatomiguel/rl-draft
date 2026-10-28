"use client";

/**
 * Road to Worlds — the event Match Center (v0.2 rebuild).
 *
 * The cinematic heart of the event screen: a broadcast-style scoreboard for
 * ONE series. Live user series reveal beat by beat (GAME-04 timeline: goals
 * on a running 5:00 clock, the end-of-regulation / OVERTIME beat, the OT
 * clock and the golden goal; scorer feed, running score, game chips
 * filling); finished series show the full result plus a desk-narration
 * banner (verdict, series star, what it means for the run). AI series can be
 * inspected here after they reveal.
 *
 * Pure skin: reveal pacing lives in EventScreen (the beat cursor) and
 * clockPlayback.ts (the shared plan); this renders a snapshot plus the clock.
 */

import { useMemo, type RefObject } from "react";
import { TOURNAMENT } from "@/config/balance";
import { useCopy } from "@/content/copy";
import { useCareerCopy } from "@/content/careerCopy";
import type { CareerSave } from "@/engine/career/types";
import {
  buildGameTimeline,
  gameScoreAB,
  type GameTimeline,
  type TimelineGoal,
} from "@/engine/career/matchTimeline";
import type { GameResult, SeriesResult, TournamentState } from "@/engine/types";
import { cx } from "@/lib/util";
import { OrgMark } from "@/components/career/OrgMark";
import { Badge } from "@/components/ui/Badge";
import { Panel } from "@/components/ui/Panel";
import {
  seriesShape,
  seriesStarOf,
  type RoundRef,
  type UserSeriesStatus,
} from "./eventPlayback";
import { beatStepKey, gamePlayback, type BeatSync, type GamePlayback } from "./clockPlayback";
import { ClockStamp, GameClock } from "./GameClock";

export function bestOfFor(round: RoundRef, t: TournamentState): number {
  if (round.stage === "swiss") return TOURNAMENT.swiss.bestOf;
  return t.playoffs?.format === "single"
    ? TOURNAMENT.quick.bestOf
    : TOURNAMENT.playoffs.bestOf;
}

/** How many recent beats (goals, the OT beat) the feed keeps on screen. */
const FEED_TAIL = 4;

export function CareerMatchCenter({
  save,
  t,
  round,
  series,
  progress,
  clockSpeed = 1,
  clockPaused = false,
  clockSync,
  status,
  onClose,
}: {
  save: CareerSave;
  t: TournamentState;
  round: RoundRef;
  series: SeriesResult;
  /**
   * Reveal cursor for a LIVE user series: `game` fully revealed games,
   * `beat` timeline beats shown of games[game] (goals plus, in overtime
   * games, the OT beat). Null = fully revealed (banner / inspect view).
   */
  progress: { game: number; beat: number } | null;
  /** Live clock pacing: the playback speed factor and the pause state. */
  clockSpeed?: number;
  clockPaused?: boolean;
  /** The reveal timer's step record (EventScreen), so the clock lands with each beat. */
  clockSync?: RefObject<BeatSync>;
  /** What the result means for the run (user series only, null otherwise). */
  status: UserSeriesStatus;
  /** Present on inspected series — renders the close affordance. */
  onClose?: () => void;
}) {
  const copy = useCopy();
  const C = useCareerCopy();
  const T = copy.TOURNAMENT_UI;
  const N = copy.NARRATION;

  const teamA = t.teams[series.teamAId];
  const teamB = t.teams[series.teamBId];
  const isUserSeries = series.teamAId === "user" || series.teamBId === "user";
  const userWon = series.winnerTeamId === "user";
  const bestOf = bestOfFor(round, t);
  const winsNeeded = Math.ceil(bestOf / 2);
  const live = progress !== null;
  const done = !live;

  // --- visible slice -------------------------------------------------------
  const fullGames = live ? series.games.slice(0, progress.game) : series.games;
  const currentGame: GameResult | undefined = live
    ? series.games[progress.game]
    : undefined;
  const roundKey = round.key;
  const timeline: GameTimeline | null = useMemo(
    () => (currentGame ? buildGameTimeline(series, currentGame, roundKey) : null),
    [series, currentGame, roundKey],
  );
  const playback: GamePlayback | null = useMemo(
    () => (timeline ? gamePlayback(timeline) : null),
    [timeline],
  );
  const beatCursor = progress?.beat ?? 0;
  const shownBeats = timeline ? timeline.beats.slice(0, beatCursor) : [];
  const gameScore: [number, number] =
    shownBeats.length > 0 ? shownBeats[shownBeats.length - 1].scoreAfter : [0, 0];
  // OVERTIME shows from the OT beat on — never read off game.overtime early.
  const overtimeReached = shownBeats.some((b) => b.kind === "overtime");
  // The segment the clock plays while the next beat is pending (tail = after the last).
  const clockSegment = playback
    ? (playback.steps[beatCursor]?.segment ?? playback.tail.segment)
    : null;
  const clockStep = progress ? beatStepKey(roundKey, progress.game, progress.beat) : undefined;

  let winsA = 0;
  let winsB = 0;
  for (const g of fullGames) {
    if (g.winnerTeamId === series.teamAId) winsA += 1;
    else winsB += 1;
  }

  const matchPoint =
    Boolean(currentGame) && !currentGame?.deciding && Math.max(winsA, winsB) === winsNeeded - 1;

  const label =
    round.stage === "swiss"
      ? `${C.event.swissStage} · ${C.event.roundLabel(round.roundNo)}`
      : (T.roundNames[round.name ?? ""] ?? C.event.playoffs);

  // --- desk narration (finished user series only) --------------------------
  const narration = useMemo(() => {
    if (!done || !isUserSeries) return null;
    const margin = Math.abs(series.score[0] - series.score[1]);
    const userDiff = series.teamAId === "user" ? series.ratingDiff : -series.ratingDiff;
    const idx = series.games.length;
    const pick = (arr: readonly string[]) => arr[idx % arr.length];
    const lines: string[] = [];
    if (userWon && userDiff <= -3) lines.push(pick(N.upsetWin));
    else if (userWon && margin === 1) lines.push(pick(N.seriesWinClose));
    else if (userWon) lines.push(pick(N.seriesWin));
    else if (!userWon && userDiff >= 3) lines.push(pick(N.upsetLoss));
    else if (margin === 1) lines.push(pick(N.seriesLossClose));
    else lines.push(pick(N.seriesLoss));
    if (series.games.some((g) => g.deciding && g.notes.includes("special_clutch"))) {
      lines.push(N.specialNote);
    } else if (series.games.some((g) => g.overtime && g.deciding)) {
      lines.push(N.overtimeNote);
    }
    return lines;
  }, [done, isUserSeries, series, userWon, N]);

  const star = done ? seriesStarOf(series) : null;
  const shape = done ? seriesShape(series) : { sweep: false, reverseSweep: false };

  const scorerNameOf = (e: TimelineGoal): string => {
    const team = e.side === "a" ? teamA : teamB;
    if (e.playerIdx === null) return team?.name ?? "";
    return team?.playerNames[e.playerIdx] ?? team?.name ?? "";
  };

  return (
    <Panel strong glow={live ? "orange" : undefined} className="p-4 sm:p-5">
      {/* header */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="kicker !text-[10px]">
          {label} · {T.bestOf(bestOf)}
        </p>
        <div className="flex items-center gap-2">
          {live ? (
            <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-orange-bright">
              <span className="live-dot h-2 w-2 rounded-full bg-orange" aria-hidden />
              {C.event.liveTag}
            </span>
          ) : null}
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              aria-label={C.common.close}
              className="rounded p-1 text-sub transition-colors hover:bg-white/10 hover:text-ink"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" />
              </svg>
            </button>
          ) : null}
        </div>
      </div>

      {/* scoreboard */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4">
        <TeamSide save={save} teamId={series.teamAId} name={teamA?.name ?? "?"} players={teamA?.playerNames ?? []} align="left" />
        <div className="px-1 text-center">
          {currentGame ? (
            <>
              <p className="kicker !text-[10px] text-faint">{C.event.game(currentGame.index)}</p>
              {/* RL broadcast board: goals · clock · goals. The goal feed is the
                  live region; the numbers re-key so each goal pops its side. */}
              <div className="flex items-center justify-center gap-2 sm:gap-3">
                <span
                  key={`a${gameScore[0]}`}
                  className="display pop-in min-w-[1ch] text-4xl font-bold leading-tight text-ink sm:text-5xl"
                >
                  {gameScore[0]}
                </span>
                {clockSegment ? (
                  <GameClock
                    key={`${currentGame.index}:${beatCursor}`}
                    segment={clockSegment}
                    speed={clockSpeed}
                    paused={clockPaused}
                    sync={clockSync}
                    syncKey={clockStep}
                    label={C.event.gameClock}
                    className={cx(
                      "display rounded-md border px-1.5 py-0.5 text-sm font-bold leading-snug sm:px-2 sm:text-base",
                      overtimeReached
                        ? "border-orange/60 bg-orange/15 text-orange-bright"
                        : "border-line-strong bg-black/30 text-ink",
                    )}
                  />
                ) : null}
                <span
                  key={`b${gameScore[1]}`}
                  className="display pop-in min-w-[1ch] text-4xl font-bold leading-tight text-ink sm:text-5xl"
                >
                  {gameScore[1]}
                </span>
              </div>
              <p className="display mt-0.5 flex items-baseline justify-center gap-1.5 text-sm font-bold text-sub">
                <span className="kicker !text-[9px] text-faint">{C.event.seriesTag}</span>
                {winsA} – {winsB}
              </p>
            </>
          ) : (
            <>
              <p className="kicker !text-[10px] text-faint">{C.event.matchCenter}</p>
              <p className="display text-4xl font-bold leading-tight sm:text-5xl">
                <span className={cx(done && winsA > winsB ? "text-good" : "text-ink")}>{winsA}</span>
                <span className="mx-1.5 text-faint sm:mx-2">–</span>
                <span className={cx(done && winsB > winsA ? "text-good" : "text-ink")}>{winsB}</span>
              </p>
            </>
          )}
          <div className="mt-1 flex min-h-5 flex-wrap items-center justify-center gap-1">
            {overtimeReached ? (
              <Badge tone="orange" className="pop-in !text-[9px]">{C.event.overtime}</Badge>
            ) : null}
            {currentGame?.deciding ? (
              <Badge tone="blue" className="!text-[9px]">{C.event.deciding}</Badge>
            ) : matchPoint ? (
              <Badge className="!text-[9px]">{C.event.matchPoint}</Badge>
            ) : null}
          </div>
        </div>
        <TeamSide save={save} teamId={series.teamBId} name={teamB?.name ?? "?"} players={teamB?.playerNames ?? []} align="right" />
      </div>

      {/* game chips */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5">
        {Array.from({ length: bestOf }).map((_, i) => {
          const g = i < fullGames.length ? fullGames[i] : undefined;
          const isCurrent = live && i === progress.game && i < series.games.length;
          if (g) {
            const aWonGame = g.winnerTeamId === series.teamAId;
            // game.score is winner-first; the chips read like the board (A–B).
            const [goalsA, goalsB] = gameScoreAB(series, g);
            const wonByUser = isUserSeries && g.winnerTeamId === "user";
            const lostByUser = isUserSeries && g.winnerTeamId !== "user";
            return (
              <span
                key={i}
                className={cx(
                  "pop-in display inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-bold",
                  wonByUser
                    ? "border-good/50 bg-good/10 text-good"
                    : lostByUser
                      ? "border-bad/50 bg-bad/10 text-bad"
                      : aWonGame
                        ? "border-line-strong bg-white/8 text-ink"
                        : "border-line-strong bg-white/8 text-sub",
                )}
                title={`${C.event.game(g.index)} · ${goalsA}–${goalsB}${g.overtime ? ` ${C.event.overtime}` : ""}`}
              >
                {goalsA}–{goalsB}
                {g.overtime ? <span className="text-orange-bright">{T.overtime}</span> : null}
              </span>
            );
          }
          // Live, every slot still to come looks alike: dimming the ones the
          // series never reaches would give away its length (a sweep from G1).
          const unreachable = done && i >= series.games.length;
          return (
            <span
              key={i}
              className={cx(
                "inline-flex h-[21px] w-8 items-center justify-center rounded-md border text-[9px]",
                isCurrent
                  ? "pulse-soft border-orange/70 bg-orange/15 text-orange-bright"
                  : "border-line bg-white/[0.03] text-faint",
                unreachable && "opacity-40",
              )}
              aria-hidden
            >
              G{i + 1}
            </span>
          );
        })}
      </div>

      {/* play-by-play (live game): goals with their clock, the OT beat */}
      {currentGame ? (
        <ol
          className="mt-4 min-h-[112px] space-y-1"
          aria-live="polite"
          aria-label={C.event.playByPlay}
        >
          {shownBeats.slice(-FEED_TAIL).map((beat, i, arr) => {
            const newest = i === arr.length - 1;
            const key = `${currentGame.index}:${shownBeats.length - arr.length + i}`;
            if (beat.kind === "overtime") {
              return (
                <li
                  key={key}
                  className={cx(
                    "flex items-center justify-center gap-2 rounded-md border border-orange/35 bg-orange/[0.07] px-2 py-1 text-center",
                    newest ? "pop-in" : "opacity-70",
                  )}
                >
                  <span className="kicker !text-[9px] !tracking-[0.16em] text-orange-bright">
                    {C.event.endOfRegulation}
                  </span>
                  <span className="display shrink-0 text-xs font-bold text-ink">
                    {beat.scoreAfter[0]}–{beat.scoreAfter[1]}
                  </span>
                  <Badge tone="orange" className="!px-1.5 !text-[8px]">{C.event.overtime}</Badge>
                </li>
              );
            }
            return (
              <li
                key={key}
                className={cx(
                  "flex items-center gap-2 rounded-md px-2 py-1 text-sm",
                  beat.side === "b" && "flex-row-reverse text-right",
                  beat.golden && "border border-orange/45 bg-orange/12",
                  newest && "pop-in",
                  newest && !beat.golden && "bg-orange/8",
                  !newest && "opacity-70",
                )}
              >
                <ClockStamp
                  period={beat.period}
                  seconds={beat.clock}
                  className={cx(
                    "display shrink-0 text-[11px] font-bold",
                    beat.golden ? "text-orange-bright" : "text-faint",
                  )}
                />
                <span
                  className={cx(
                    "display shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold tracking-wider",
                    beat.golden
                      ? "bg-gradient-to-b from-orange-bright to-orange text-[#1a0d02]"
                      : newest
                        ? "bg-orange/25 text-orange-bright"
                        : "bg-white/8 text-sub",
                  )}
                >
                  {beat.golden ? C.event.goldenGoal : C.event.goal}
                </span>
                <span className="min-w-0 truncate font-semibold text-ink">{scorerNameOf(beat)}</span>
                <span className="display shrink-0 text-xs font-bold text-sub">
                  {beat.scoreAfter[0]}–{beat.scoreAfter[1]}
                </span>
              </li>
            );
          })}
        </ol>
      ) : null}

      {/* series banner (finished reveal) */}
      {done ? (
        <div className="pop-in mt-4 rounded-lg border border-line bg-white/[0.04] px-4 py-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <p
              className={cx(
                "display min-w-0 flex-1 text-sm font-bold uppercase tracking-wide",
                isUserSeries ? (userWon ? "text-good" : "text-bad") : "text-ink",
              )}
            >
              {C.event.seriesWin(t.teams[series.winnerTeamId]?.name ?? "?")}
            </p>
            {series.upset ? <Badge tone="gold" className="!text-[9px]">{C.event.upset}</Badge> : null}
            {shape.reverseSweep ? (
              <Badge tone="orange" className="!text-[9px]">{C.event.reverseSweep}</Badge>
            ) : shape.sweep ? (
              <Badge tone="blue" className="!text-[9px]">{C.event.sweep}</Badge>
            ) : null}
          </div>
          {narration?.map((line, i) => (
            <p key={i} className="mt-1 text-sm leading-relaxed text-sub">
              {line}
            </p>
          ))}
          {star ? (
            <p className="mt-1 text-xs font-semibold text-cyan">{C.event.starOfSeries(star)}</p>
          ) : null}
          {status ? (
            <p
              className={cx(
                "display mt-2 border-t border-line pt-2 text-sm font-bold uppercase tracking-wide",
                status === "champion"
                  ? "text-amber-300"
                  : status === "advancing"
                    ? "text-good"
                    : "text-bad",
              )}
            >
              {status === "champion"
                ? C.event.champion(save.identity.orgName)
                : status === "advancing"
                  ? C.event.advancing
                  : C.event.eliminated}
            </p>
          ) : null}
        </div>
      ) : null}
    </Panel>
  );
}

function TeamSide({
  save,
  teamId,
  name,
  players,
  align,
}: {
  save: CareerSave;
  teamId: string;
  name: string;
  players: string[];
  align: "left" | "right";
}) {
  const isUser = teamId === "user";
  return (
    <div
      className={cx(
        "flex min-w-0 flex-col items-center gap-1.5 text-center",
        align === "left" ? "sm:flex-row sm:text-left" : "sm:flex-row-reverse sm:text-right",
      )}
    >
      <OrgMark save={save} orgRef={teamId} size="md" className="shrink-0" />
      <div className="min-w-0">
        <p
          className={cx(
            "display truncate text-sm font-bold uppercase tracking-wide sm:text-base md:text-lg",
            isUser ? "text-orange-bright" : "text-ink",
          )}
        >
          {name}
        </p>
        <p className="hidden truncate text-[10px] text-faint sm:block">{players.join(" · ")}</p>
      </div>
    </div>
  );
}
