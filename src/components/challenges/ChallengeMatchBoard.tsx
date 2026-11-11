"use client";

/**
 * Challenges — the boss series on the Road to Worlds board (v2.0, G2).
 *
 * The challenge Bo7 used to reveal one finished game per tick. It now plays on
 * the same running-clock scoreboard as the career Match Center, and it REUSES
 * that machinery instead of copying it: the goal timeline comes from the
 * engine (`buildGameTimeline`), the pacing plan and the step record from
 * `clockPlayback` (`gamePlayback`, `startBeat` / `stopBeat`), and the clock on
 * screen is the career `GameClock` / `ClockStamp` component itself.
 *
 * Only the frame around the clock is local: the career board reads a
 * `CareerSave` and the career dictionary, which a challenge has neither of.
 *
 *   - `useSeriesPlayback` is the driver (the career's lives in EventScreen):
 *     it walks a cursor over the beats, one timer per step.
 *   - `ChallengeMatchBoard` draws a snapshot of that cursor.
 */

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { CAREER_PLAYBACK, CHALLENGE } from "@/config/balance";
import { useCopy } from "@/content/copy";
import { buildGameTimeline, gameScoreAB, type TimelineGoal } from "@/engine/career/matchTimeline";
import type { GameResult, SeriesResult, TournamentTeam } from "@/engine/types";
import { cx } from "@/lib/util";
import {
  beatStepKey,
  createBeatSync,
  gamePlayback,
  startBeat,
  stopBeat,
  type BeatSync,
} from "@/components/career/event/clockPlayback";
import { ClockStamp, GameClock } from "@/components/career/event/GameClock";
import { Badge } from "@/components/ui/Badge";
import { Panel } from "@/components/ui/Panel";

/** `game` fully revealed games, `beat` timeline beats shown of games[game]. */
export interface SeriesCursor {
  game: number;
  beat: number;
}

/** How many recent beats (goals, the OT beat) the feed keeps on screen. */
const FEED_TAIL = 4;

/**
 * Walks the series beat by beat while `active`. Returns the cursor, the step
 * record the clock reads, and `finish` (skip to the end). `onGame` fires as
 * each game's final whistle lands.
 */
export function useSeriesPlayback(
  series: SeriesResult | null,
  roundKey: string,
  active: boolean,
  onGame?: (game: GameResult) => void,
): { cursor: SeriesCursor; sync: RefObject<BeatSync>; finish: () => void; restart: () => void } {
  const [cursor, setCursor] = useState<SeriesCursor>({ game: 0, beat: 0 });
  const sync = useRef<BeatSync>(createBeatSync());
  const onGameRef = useRef(onGame);
  useEffect(() => {
    onGameRef.current = onGame;
  }, [onGame]);

  useEffect(() => {
    if (!active || !series || cursor.game >= series.games.length) return;
    const game = series.games[cursor.game];
    const plan = gamePlayback(buildGameTimeline(series, game, roundKey));
    const tail = cursor.beat >= plan.steps.length;
    const delay = tail ? plan.tail.delayMs + CAREER_PLAYBACK.userGameGapMs : plan.steps[cursor.beat].delayMs;
    const record = sync.current;
    const wait = startBeat(
      record,
      beatStepKey(roundKey, cursor.game, cursor.beat),
      delay,
      CHALLENGE.seriesClockSpeed,
      performance.now(),
    );
    const timer = setTimeout(() => {
      if (tail) {
        onGameRef.current?.(game);
        setCursor({ game: cursor.game + 1, beat: 0 });
      } else {
        setCursor({ game: cursor.game, beat: cursor.beat + 1 });
      }
    }, wait);
    return () => {
      clearTimeout(timer);
      stopBeat(record, performance.now());
    };
  }, [active, series, roundKey, cursor]);

  const total = series?.games.length ?? 0;
  return {
    cursor,
    sync,
    finish: () => setCursor({ game: total, beat: 0 }),
    restart: () => setCursor({ game: 0, beat: 0 }),
  };
}

export function ChallengeMatchBoard({
  series,
  roundKey,
  bestOf,
  teamA,
  teamB,
  nameA,
  nameB,
  kicker,
  progress,
  sync,
}: {
  series: SeriesResult;
  roundKey: string;
  bestOf: number;
  /** series.teamAId / series.teamBId, for the scorers' names. */
  teamA: TournamentTeam;
  teamB: TournamentTeam;
  nameA: string;
  nameB: string;
  kicker: string;
  /** The live cursor; null = the whole series is on the board. */
  progress: SeriesCursor | null;
  sync?: RefObject<BeatSync>;
}) {
  const { CHALLENGES_UI: CH, TOURNAMENT_UI: T } = useCopy();
  const B = CH.board;
  const live = progress !== null && progress.game < series.games.length;
  const fullGames = live ? series.games.slice(0, progress.game) : series.games;
  const currentGame: GameResult | undefined = live ? series.games[progress.game] : undefined;

  const timeline = useMemo(
    () => (currentGame ? buildGameTimeline(series, currentGame, roundKey) : null),
    [series, currentGame, roundKey],
  );
  const playback = useMemo(() => (timeline ? gamePlayback(timeline) : null), [timeline]);
  const beatCursor = live ? progress.beat : 0;
  const shownBeats = timeline ? timeline.beats.slice(0, beatCursor) : [];
  const gameScore: [number, number] = shownBeats.length > 0 ? shownBeats[shownBeats.length - 1].scoreAfter : [0, 0];
  // OVERTIME shows from the OT beat on, never read off game.overtime early.
  const overtimeReached = shownBeats.some((b) => b.kind === "overtime");
  const clockSegment = playback ? (playback.steps[beatCursor]?.segment ?? playback.tail.segment) : null;

  let winsA = 0;
  let winsB = 0;
  for (const g of fullGames) {
    if (g.winnerTeamId === series.teamAId) winsA += 1;
    else winsB += 1;
  }
  const winsNeeded = Math.ceil(bestOf / 2);
  const matchPoint = Boolean(currentGame) && !currentGame?.deciding && Math.max(winsA, winsB) === winsNeeded - 1;
  const userIsA = teamA.isUser;

  const scorerNameOf = (e: TimelineGoal): string => {
    const team = e.side === "a" ? teamA : teamB;
    const fallback = e.side === "a" ? nameA : nameB;
    if (e.playerIdx === null) return fallback;
    return team.playerNames[e.playerIdx] ?? fallback;
  };

  return (
    <Panel strong glow={live ? "orange" : undefined} className="p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="kicker !text-[10px]">{kicker}</p>
        {live ? (
          <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-orange-bright">
            <span className="live-dot h-2 w-2 rounded-full bg-orange" aria-hidden />
            {B.live}
          </span>
        ) : null}
      </div>

      {/* scoreboard: goals · clock · goals, the series score under it */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4">
        <p className="display min-w-0 truncate text-sm font-bold uppercase tracking-wide text-orange-bright sm:text-lg">
          {nameA}
        </p>
        <div className="px-1 text-center">
          {currentGame ? (
            <>
              <p className="kicker !text-[10px] text-faint">{T.game(currentGame.index)}</p>
              <div className="flex items-center justify-center gap-2 sm:gap-3">
                <span key={`a${gameScore[0]}`} className="display pop-in min-w-[1ch] text-4xl font-bold leading-tight text-ink sm:text-5xl">
                  {gameScore[0]}
                </span>
                {clockSegment ? (
                  <GameClock
                    key={`${currentGame.index}:${beatCursor}`}
                    segment={clockSegment}
                    speed={CHALLENGE.seriesClockSpeed}
                    paused={false}
                    sync={sync}
                    syncKey={beatStepKey(roundKey, progress!.game, progress!.beat)}
                    label={B.gameClock}
                    className={cx(
                      "display rounded-md border px-1.5 py-0.5 text-sm font-bold leading-snug sm:px-2 sm:text-base",
                      overtimeReached
                        ? "border-orange/60 bg-orange/15 text-orange-bright"
                        : "border-line-strong bg-black/30 text-ink",
                    )}
                  />
                ) : null}
                <span key={`b${gameScore[1]}`} className="display pop-in min-w-[1ch] text-4xl font-bold leading-tight text-ink sm:text-5xl">
                  {gameScore[1]}
                </span>
              </div>
              <p className="display mt-0.5 flex items-baseline justify-center gap-1.5 text-sm font-bold text-sub">
                <span className="kicker !text-[9px] text-faint">{B.series}</span>
                {winsA} – {winsB}
              </p>
            </>
          ) : (
            <p className="display text-4xl font-bold leading-tight sm:text-5xl">
              <span className={cx(winsA > winsB ? "text-good" : "text-ink")}>{winsA}</span>
              <span className="mx-1.5 text-faint sm:mx-2">–</span>
              <span className={cx(winsB > winsA ? "text-good" : "text-ink")}>{winsB}</span>
            </p>
          )}
          <div className="mt-1 flex min-h-5 flex-wrap items-center justify-center gap-1">
            {overtimeReached ? (
              <Badge tone="orange" className="pop-in !text-[9px]">
                {B.overtime}
              </Badge>
            ) : null}
            {currentGame?.deciding ? (
              <Badge tone="blue" className="!text-[9px]">
                {B.deciding}
              </Badge>
            ) : matchPoint ? (
              <Badge className="!text-[9px]">{T.matchPoint}</Badge>
            ) : null}
          </div>
        </div>
        <p className="display min-w-0 truncate text-right text-sm font-bold uppercase tracking-wide text-ink sm:text-lg">
          {nameB}
        </p>
      </div>

      {/* game chips */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5">
        {Array.from({ length: bestOf }).map((_, i) => {
          const g = i < fullGames.length ? fullGames[i] : undefined;
          if (g) {
            const [goalsA, goalsB] = gameScoreAB(series, g);
            const wonByUser = (g.winnerTeamId === series.teamAId) === userIsA;
            return (
              <span
                key={i}
                title={`${T.game(g.index)} · ${goalsA}–${goalsB}${g.overtime ? ` ${T.overtime}` : ""}`}
                className={cx(
                  "pop-in display inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-bold",
                  wonByUser ? "border-good/50 bg-good/10 text-good" : "border-bad/50 bg-bad/10 text-bad",
                )}
              >
                {goalsA}–{goalsB}
                {g.overtime ? <span className="text-orange-bright">{T.overtime}</span> : null}
              </span>
            );
          }
          // Live, every slot still to come looks alike: dimming the ones the
          // series never reaches would give away its length.
          const isCurrent = live && i === progress.game;
          return (
            <span
              key={i}
              aria-hidden
              className={cx(
                "inline-flex h-[21px] w-8 items-center justify-center rounded-md border text-[9px]",
                isCurrent ? "pulse-soft border-orange/70 bg-orange/15 text-orange-bright" : "border-line bg-white/[0.03] text-faint",
                !live && "opacity-40",
              )}
            >
              G{i + 1}
            </span>
          );
        })}
      </div>

      {/* play-by-play (live game): goals with their clock, the OT beat */}
      {currentGame ? (
        <ol className="mt-4 min-h-[112px] space-y-1" aria-live="polite" aria-label={B.playByPlay}>
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
                  <span className="kicker !text-[9px] !tracking-[0.16em] text-orange-bright">{B.endOfRegulation}</span>
                  <span className="display shrink-0 text-xs font-bold text-ink">
                    {beat.scoreAfter[0]}–{beat.scoreAfter[1]}
                  </span>
                  <Badge tone="orange" className="!px-1.5 !text-[8px]">
                    {B.overtime}
                  </Badge>
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
                  className={cx("display shrink-0 text-[11px] font-bold", beat.golden ? "text-orange-bright" : "text-faint")}
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
                  {beat.golden ? B.goldenGoal : B.goal}
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
    </Panel>
  );
}
