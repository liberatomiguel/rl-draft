"use client";

/**
 * Road to Worlds — the event Match Center (v0.2 rebuild).
 *
 * The cinematic heart of the event screen: a broadcast-style scoreboard for
 * ONE series. Live user series reveal goal by goal (scorer feed, running
 * score, OT/deciding badges, game chips filling); finished series show the
 * full result plus a desk-narration banner (verdict, series star, what it
 * means for the run). AI series can be inspected here after they reveal.
 *
 * Pure skin: all reveal pacing lives in EventScreen; this renders a snapshot.
 */

import { useMemo } from "react";
import { TOURNAMENT } from "@/config/balance";
import { useCopy } from "@/content/copy";
import { useCareerCopy } from "@/content/careerCopy";
import type { CareerSave } from "@/engine/career/types";
import type { GameResult, SeriesResult, TournamentState } from "@/engine/types";
import { cx } from "@/lib/util";
import { OrgMark } from "@/components/career/OrgMark";
import { Badge } from "@/components/ui/Badge";
import { Panel } from "@/components/ui/Panel";
import {
  goalTimeline,
  seriesShape,
  seriesStarOf,
  type GoalEvent,
  type RoundRef,
  type UserSeriesStatus,
} from "./eventPlayback";

export function bestOfFor(round: RoundRef, t: TournamentState): number {
  if (round.stage === "swiss") return TOURNAMENT.swiss.bestOf;
  return t.playoffs?.format === "single"
    ? TOURNAMENT.quick.bestOf
    : TOURNAMENT.playoffs.bestOf;
}

/** How many recent goals the feed keeps on screen. */
const FEED_TAIL = 4;

export function CareerMatchCenter({
  save,
  t,
  round,
  series,
  progress,
  status,
  onClose,
}: {
  save: CareerSave;
  t: TournamentState;
  round: RoundRef;
  series: SeriesResult;
  /**
   * Reveal cursor for a LIVE user series: `game` fully revealed games,
   * `goal` goals shown of games[game]. Null = fully revealed (banner /
   * inspect view).
   */
  progress: { game: number; goal: number } | null;
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
  const timeline: GoalEvent[] = useMemo(
    () => (currentGame ? goalTimeline(series, currentGame) : []),
    [series, currentGame],
  );
  const shownGoals = currentGame ? timeline.slice(0, progress?.goal ?? 0) : [];
  const gameScore: [number, number] =
    shownGoals.length > 0 ? shownGoals[shownGoals.length - 1].scoreAfter : [0, 0];
  const currentGameComplete = Boolean(currentGame) && shownGoals.length === timeline.length;

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

  const scorerNameOf = (e: GoalEvent): string => {
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
              <p className="display text-4xl font-bold leading-tight text-ink sm:text-5xl" aria-live="polite">
                {gameScore[0]}
                <span className="mx-1.5 text-faint sm:mx-2">:</span>
                {gameScore[1]}
              </p>
              <p className="display mt-0.5 text-sm font-bold text-sub">
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
            {currentGame?.overtime && currentGameComplete ? (
              <Badge tone="orange" className="!text-[9px]">{C.event.overtime}</Badge>
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
                title={`${C.event.game(g.index)} · ${g.score[0]}–${g.score[1]}${g.overtime ? ` ${C.event.overtime}` : ""}`}
              >
                {g.score[0]}–{g.score[1]}
                {g.overtime ? <span className="text-orange-bright">{T.overtime}</span> : null}
              </span>
            );
          }
          const played = i < series.games.length;
          return (
            <span
              key={i}
              className={cx(
                "inline-flex h-[21px] w-8 items-center justify-center rounded-md border text-[9px]",
                isCurrent
                  ? "pulse-soft border-orange/70 bg-orange/15 text-orange-bright"
                  : "border-line bg-white/[0.03] text-faint",
                !played && !isCurrent && "opacity-40",
              )}
              aria-hidden
            >
              G{i + 1}
            </span>
          );
        })}
      </div>

      {/* goal feed (live game) */}
      {currentGame ? (
        <div className="mt-4 min-h-[104px] space-y-1" aria-live="polite">
          {shownGoals.slice(-FEED_TAIL).map((e, i, arr) => {
            const newest = i === arr.length - 1;
            const isLastOfGame =
              shownGoals.length === timeline.length &&
              i === arr.length - 1;
            const otGoal = isLastOfGame && currentGame.overtime;
            return (
              <div
                key={`${e.scoreAfter[0]}-${e.scoreAfter[1]}-${e.side}`}
                className={cx(
                  "flex items-center gap-2 rounded-md px-2 py-1 text-sm",
                  e.side === "b" && "flex-row-reverse text-right",
                  newest && "pop-in bg-orange/8",
                  !newest && "opacity-70",
                )}
              >
                <span
                  className={cx(
                    "display shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold tracking-wider",
                    newest ? "bg-orange/25 text-orange-bright" : "bg-white/8 text-sub",
                  )}
                >
                  {C.event.goal}
                </span>
                <span className="min-w-0 truncate font-semibold text-ink">{scorerNameOf(e)}</span>
                <span className="display shrink-0 text-xs font-bold text-sub">
                  {e.scoreAfter[0]}–{e.scoreAfter[1]}
                </span>
                {otGoal ? <Badge tone="orange" className="!text-[8px]">{C.event.overtime}</Badge> : null}
              </div>
            );
          })}
        </div>
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
