"use client";

/**
 * Tournament screen v3 — automatic simulation, focused on YOUR games.
 *
 * The player presses Start once; rounds then resolve on their own.
 * Playback rules (v0.5 playtest feedback):
 *  - The Match Center only ever shows the USER's series (AI series are
 *    browsable by clicking them once revealed — they never hijack the view).
 *  - Within a round the user's series plays first, game by game, then
 *    lingers so the result can be read before anything else moves.
 *  - Swiss standings only move at the END of a fully revealed round.
 *  - Upcoming opponents are hidden until the current round is fully revealed
 *    (the engine simulates ahead — revealing pairings early spoils results).
 *  - Speed toggle (1×/2×/4×) and Skip available.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TOURNAMENT } from "@/config/balance";
import { useCopy, type Copy } from "@/content/copy";
import { lineupById } from "@/data";
import { nextPlayoffPairings, roundOrderFor } from "@/engine/playoffs";
import { displayTeamOverall } from "@/engine/rating";
import type {
  PlayoffRoundName,
  RunState,
  SeriesResult,
  TournamentState,
  TournamentTeam,
} from "@/engine/types";
import { cx } from "@/lib/util";
import { sfx } from "@/lib/sfx";
import { useRunStore } from "@/store/runStore";
import { ANIM_TOURNAMENT_SPEED, useSettings } from "@/store/settingsStore";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Panel, SectionTitle } from "@/components/ui/Panel";
import { TeamLogo } from "@/components/ui/TeamLogo";
import { RunStepper } from "./RunStepper";

// ---------------------------------------------------------------------------
// Series indexing helpers
// ---------------------------------------------------------------------------

interface SeriesEntry {
  key: string;
  label: string;
  isUser: boolean;
  stage: "swiss" | "playoffs";
  roundIndex: number;
  seriesIndex: number;
}

function entryKey(stage: string, roundIndex: number, seriesIndex: number): string {
  return `${stage}:${roundIndex}:${seriesIndex}`;
}

function allEntries(t: TournamentState, T: Copy["TOURNAMENT_UI"]): SeriesEntry[] {
  const out: SeriesEntry[] = [];
  // Within each round the user's series reveals FIRST (it's the story);
  // AI series follow as quick background pops. Sort is stable, so rebuilt
  // queues keep the exact order of already-revealed entries.
  const pushRound = (entries: SeriesEntry[]) => {
    out.push(...[...entries].sort((a, b) => Number(b.isUser) - Number(a.isUser)));
  };
  t.swiss.rounds.forEach((round, ri) => {
    pushRound(
      round.series.map((s, si) => ({
        key: entryKey("swiss", ri, si),
        label: `${T.swiss} · ${T.round(round.round)}`,
        isUser: s.teamAId === "user" || s.teamBId === "user",
        stage: "swiss" as const,
        roundIndex: ri,
        seriesIndex: si,
      })),
    );
  });
  (t.playoffs?.rounds ?? []).forEach((round, ri) => {
    pushRound(
      round.series.map((s, si) => ({
        key: entryKey("playoffs", ri, si),
        label: T.roundNames[round.name] ?? round.name,
        isUser: s.teamAId === "user" || s.teamBId === "user",
        stage: "playoffs" as const,
        roundIndex: ri,
        seriesIndex: si,
      })),
    );
  });
  return out;
}

/** Playback pacing (ms at 1× — divided by the speed toggle). */
const PACE = {
  /** Between games of the user's series. */
  userGame: 950,
  /** Linger on the finished user series so the narration can be read. */
  userSeriesLinger: 2800,
  /** AI series during Swiss are invisible until standings move — near-batch. */
  aiSwiss: 90,
  /** AI series popping into the playoff bracket. */
  aiPlayoff: 420,
  /** Extra breath when a new round starts (standings just moved). */
  roundGap: 1400,
  /** Engine tick between rounds. */
  advance: 500,
} as const;

function locateSeries(t: TournamentState, entry: SeriesEntry): SeriesResult {
  return entry.stage === "swiss"
    ? t.swiss.rounds[entry.roundIndex].series[entry.seriesIndex]
    : t.playoffs!.rounds[entry.roundIndex].series[entry.seriesIndex];
}

function ratingLabel(team: TournamentTeam | undefined, showOverall: boolean): string {
  if (!team) return "";
  return showOverall ? String(displayTeamOverall(team.rating)) : "??";
}

/** AI teams are historical lineups — their logos follow the lineup's era. */
function teamSeasonId(team: TournamentTeam | undefined): string | undefined {
  return team?.lineupId ? lineupById.get(team.lineupId)?.seasonId : undefined;
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export function TournamentScreen({ run }: { run: RunState }) {
  const { TOURNAMENT_UI: T } = useCopy();
  const playRound = useRunStore((s) => s.playRound);
  const finishRun = useRunStore((s) => s.finishRun);
  const awardRevealedAchievements = useRunStore((s) => s.awardRevealedAchievements);
  const t = run.tournament;

  // Playback state. On mount (or refresh) everything already simulated is
  // treated as revealed. A FRESH tournament (straight from team review)
  // auto-starts — no extra click needed.
  const [queue, setQueue] = useState<SeriesEntry[]>(() => (t ? allEntries(t, T) : []));
  const [cursor, setCursor] = useState<number>(() => (t ? allEntries(t, T).length : 0));
  const [gamesShown, setGamesShown] = useState(0);
  const [running, setRunning] = useState(
    () => Boolean(t) && allEntries(t!, T).length === 0 && t!.stage !== "finished",
  );
  // Default playback speed follows the Settings → Animation speed preference.
  const [speed, setSpeed] = useState<1 | 2 | 4>(
    () => ANIM_TOURNAMENT_SPEED[useSettings.getState().animSpeed],
  );
  const [inspectKey, setInspectKey] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // User series whose "match complete" cue already played (once each).
  const cuedRef = useRef<Set<string>>(new Set());

  const revealedKeys = useMemo(
    () => new Set(queue.slice(0, cursor).map((e) => e.key)),
    [queue, cursor],
  );
  const current = cursor < queue.length ? queue[cursor] : null;
  const allRevealed = cursor >= queue.length;
  const finished = t?.stage === "finished";

  const advanceRound = useCallback(() => {
    playRound();
    const fresh = useRunStore.getState().run?.tournament;
    if (!fresh) return;
    const entries = allEntries(fresh, T);
    setQueue(entries); // cursor stays — new entries are beyond it
  }, [playRound, T]);

  // The autoplay engine. Pace depends on what is being revealed: the user's
  // series plays game by game then lingers; AI series pop quickly; crossing
  // into a new round adds a breath so the standings update can be read.
  useEffect(() => {
    if (!running || !t) return;
    const tick = (ms: number, fn: () => void) => {
      timerRef.current = setTimeout(fn, ms / speed);
    };

    if (current) {
      const prev = cursor > 0 ? queue[cursor - 1] : null;
      const crossesRound =
        prev !== null &&
        (prev.stage !== current.stage || prev.roundIndex !== current.roundIndex);
      const roundGap = crossesRound ? PACE.roundGap : 0;

      const series = locateSeries(t, current);
      if (current.isUser && gamesShown < series.games.length) {
        tick(PACE.userGame + (gamesShown === 0 ? roundGap : 0), () =>
          setGamesShown((g) => g + 1),
        );
      } else {
        // The user's series just finished resolving on screen — light cue, and
        // award its in-match / series feats NOW (at reveal time), scoped to the
        // user series revealed so far so nothing pops ahead of its animation.
        if (current.isUser && !cuedRef.current.has(current.key)) {
          cuedRef.current.add(current.key);
          if (series.winnerTeamId === "user") sfx.matchWin();
          else sfx.matchLose();
          const revealedUserSeries = queue
            .slice(0, cursor + 1)
            .filter((e) => e.isUser).length;
          awardRevealedAchievements(revealedUserSeries);
        }
        const base = current.isUser
          ? PACE.userSeriesLinger
          : (current.stage === "swiss" ? PACE.aiSwiss : PACE.aiPlayoff) + roundGap;
        tick(base, () => {
          setCursor((c) => c + 1);
          setGamesShown(0);
        });
      }
    } else if (t.stage !== "finished") {
      tick(PACE.advance, advanceRound);
    } else {
      setRunning(false);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [running, t, current, cursor, queue, gamesShown, speed, advanceRound, awardRevealedAchievements]);

  if (!t) return null;

  const skipAll = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    let guard = 0;
    while (useRunStore.getState().run?.tournament?.stage !== "finished" && guard < 20) {
      playRound();
      guard += 1;
    }
    const fresh = useRunStore.getState().run?.tournament;
    if (fresh) {
      const entries = allEntries(fresh, T);
      setQueue(entries);
      setCursor(entries.length);
      // Everything is revealed at once on skip — award all live feats now.
      awardRevealedAchievements(entries.filter((e) => e.isUser).length);
    }
    setGamesShown(0);
    setRunning(false);
  };

  // What the Match Center shows: inspected > the user's LIVE series > the
  // last revealed user series. AI series never hijack the center (v0.5).
  const inspected = inspectKey ? queue.find((e) => e.key === inspectKey) ?? null : null;
  const liveEntry = running && current ? current : null;
  const liveUserEntry = liveEntry?.isUser ? liveEntry : null;
  const lastRevealedUser = [...queue.slice(0, cursor)].reverse().find((e) => e.isUser) ?? null;
  const centerEntry = inspected ?? liveUserEntry ?? lastRevealedUser;
  const centerLive = Boolean(liveUserEntry && centerEntry?.key === liveUserEntry.key);

  // Swiss rounds fully revealed → the ONLY thing that moves the standings.
  const revealedSwissRounds = countRevealedSwissRounds(t, revealedKeys);
  const standingsRecords = swissRecordsThroughRounds(t, revealedSwissRounds);
  // The header badge tracks the user's own revealed series immediately.
  const userRecord =
    deriveSwissRecords(t, revealedKeys).get("user") ?? { wins: 0, losses: 0, gameDiff: 0 };

  return (
    <div className="rise-in">
      <RunStepper run={run} />

      <SectionTitle
        kicker={
          run.mode === "quick" || t.stage !== "swiss" ? T.playoffs : T.swiss
        }
        title={run.daily ? `Daily · ${run.daily.label}` : T.title}
        right={
          run.mode !== "quick" ? (
            <Badge tone="blue" className="!text-sm">
              {T.record(userRecord.wins, userRecord.losses)}
            </Badge>
          ) : null
        }
        className="mb-4"
      />

      {/* Controls */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {!finished || !allRevealed ? (
          <>
            {!running ? (
              <Button variant="primary" onClick={() => setRunning(true)}>
                <PlayGlyph /> {queue.length === 0 ? T.start : T.resume}
              </Button>
            ) : (
              <Button variant="secondary" onClick={() => setRunning(false)}>
                <PauseGlyph /> {T.pause}
              </Button>
            )}
            <div className="flex overflow-hidden rounded-lg border border-line">
              {([1, 2, 4] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSpeed(s)}
                  aria-pressed={speed === s}
                  className={cx(
                    "display px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors",
                    speed === s ? "bg-blue/20 text-blue-bright" : "text-sub hover:text-ink",
                  )}
                >
                  {T.speed(s)}
                </button>
              ))}
            </div>
            <Button variant="ghost" size="sm" onClick={skipAll}>
              {T.skipAll}
            </Button>
          </>
        ) : (
          <>
            <Button variant="primary" size="lg" className="min-w-64" onClick={finishRun}>
              {T.toResults}
            </Button>
            <span className="text-xs text-faint">{T.reviewHint}</span>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-6">
          {/* Match center */}
          {centerEntry ? (
            <MatchCenter
              t={t}
              entry={centerEntry}
              live={centerLive}
              gamesShown={centerLive ? gamesShown : Infinity}
              onClose={inspected ? () => setInspectKey(null) : undefined}
            />
          ) : (
            <Panel className="p-6 text-center text-sm text-sub">
              {T.matchCenter} — {queue.length === 0 ? T.start : T.upcoming}
            </Panel>
          )}

          {/* Swiss: your path (classic/daily only) */}
          {run.mode !== "quick" ? (
            <SwissPath
              run={run}
              t={t}
              revealed={revealedKeys}
              revealedRounds={revealedSwissRounds}
              liveKey={liveEntry?.key ?? null}
              onInspect={setInspectKey}
            />
          ) : null}

          {/* Playoffs bracket — only after the whole Swiss stage is revealed */}
          {t.playoffs &&
          (run.mode === "quick" ||
            (t.swiss.finished && revealedSwissRounds >= t.swiss.rounds.length)) ? (
            <PlayoffBracketView
              run={run}
              t={t}
              revealed={revealedKeys}
              liveKey={liveEntry?.key ?? null}
              allRevealed={allRevealed}
              onInspect={setInspectKey}
            />
          ) : null}

          {/* Bottom shortcut to results — long pages shouldn't need a scroll back up. */}
          {finished && allRevealed ? (
            <Button variant="primary" size="lg" full onClick={finishRun}>
              {T.toResults}
            </Button>
          ) : null}
        </div>

        {/* Standings (move only at the end of each revealed round) */}
        {run.mode !== "quick" ? (
          <SwissStandings
            run={run}
            t={t}
            records={standingsRecords}
            throughRound={revealedSwissRounds}
          />
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Derived (spoiler-safe) swiss records
// ---------------------------------------------------------------------------

interface DerivedRecord {
  wins: number;
  losses: number;
  gameDiff: number;
}

function deriveSwissRecords(
  t: TournamentState,
  revealed: Set<string>,
): Map<string, DerivedRecord> {
  const map = new Map<string, DerivedRecord>();
  for (const id of Object.keys(t.teams)) {
    map.set(id, { wins: 0, losses: 0, gameDiff: 0 });
  }
  t.swiss.rounds.forEach((round, ri) => {
    round.series.forEach((s, si) => {
      if (!revealed.has(entryKey("swiss", ri, si))) return;
      const margin = Math.abs(s.score[0] - s.score[1]);
      const loserId = s.winnerTeamId === s.teamAId ? s.teamBId : s.teamAId;
      const w = map.get(s.winnerTeamId)!;
      const l = map.get(loserId)!;
      w.wins += 1;
      w.gameDiff += margin;
      l.losses += 1;
      l.gameDiff -= margin;
    });
  });
  return map;
}

/** How many Swiss rounds are COMPLETELY revealed (standings granularity). */
function countRevealedSwissRounds(t: TournamentState, revealed: Set<string>): number {
  let count = 0;
  for (let ri = 0; ri < t.swiss.rounds.length; ri++) {
    const whole = t.swiss.rounds[ri].series.every((_, si) =>
      revealed.has(entryKey("swiss", ri, si)),
    );
    if (!whole) break;
    count += 1;
  }
  return count;
}

/** Records counting only the first `rounds` Swiss rounds (end-of-round steps). */
function swissRecordsThroughRounds(
  t: TournamentState,
  rounds: number,
): Map<string, DerivedRecord> {
  const keys = new Set<string>();
  t.swiss.rounds.slice(0, rounds).forEach((round, ri) => {
    round.series.forEach((_, si) => keys.add(entryKey("swiss", ri, si)));
  });
  return deriveSwissRecords(t, keys);
}

// ---------------------------------------------------------------------------
// Match Center
// ---------------------------------------------------------------------------

function MatchCenter({
  t,
  entry,
  live,
  gamesShown,
  onClose,
}: {
  t: TournamentState;
  entry: SeriesEntry;
  live: boolean;
  gamesShown: number;
  onClose?: () => void;
}) {
  const { TOURNAMENT_UI: T, NARRATION } = useCopy();
  const series = locateSeries(t, entry);
  const teamA = t.teams[series.teamAId];
  const teamB = t.teams[series.teamBId];
  const visible = series.games.slice(0, Math.min(gamesShown, series.games.length));
  const done = visible.length === series.games.length;

  let winsA = 0;
  let winsB = 0;
  for (const g of visible) {
    if (g.winnerTeamId === series.teamAId) winsA += 1;
    else winsB += 1;
  }

  const isUserSeries = entry.isUser;
  const userWon = series.winnerTeamId === "user";

  const narration = useMemo(() => {
    if (!done || !isUserSeries) return null;
    const margin = Math.abs(series.score[0] - series.score[1]);
    const userDiff = series.teamAId === "user" ? series.ratingDiff : -series.ratingDiff;
    const idx = series.games.length;
    const pick = (arr: readonly string[]) => arr[idx % arr.length];
    const lines: string[] = [];
    if (userWon && userDiff <= -3) lines.push(pick(NARRATION.upsetWin));
    else if (userWon && margin === 1) lines.push(pick(NARRATION.seriesWinClose));
    else if (userWon) lines.push(pick(NARRATION.seriesWin));
    else if (!userWon && userDiff >= 3) lines.push(pick(NARRATION.upsetLoss));
    else if (margin === 1) lines.push(pick(NARRATION.seriesLossClose));
    else lines.push(pick(NARRATION.seriesLoss));

    // Name the series star: most game-stars on the winning side.
    const counts = new Map<string, number>();
    for (const g of series.games) {
      if (g.winnerTeamId === series.winnerTeamId && g.starName) {
        counts.set(g.starName, (counts.get(g.starName) ?? 0) + 1);
      }
    }
    const star = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    if (star) {
      lines.push(
        userWon ? NARRATION.starLine(star) : NARRATION.starLineOpponent(star),
      );
    }

    if (series.games.some((g) => g.deciding && g.notes.includes("special_clutch"))) {
      lines.push(NARRATION.specialNote);
    } else if (series.games.some((g) => g.overtime && g.deciding)) {
      lines.push(NARRATION.overtimeNote);
    }
    return lines;
  }, [done, isUserSeries, series, userWon, NARRATION]);

  return (
    <Panel strong glow={live ? "orange" : undefined} className="p-5">
      <div className="mb-1 flex items-center justify-between gap-3">
        <p className="kicker">
          {entry.label} ·{" "}
          {T.bestOf(
            entry.stage === "swiss"
              ? TOURNAMENT.swiss.bestOf
              : t.playoffs?.format === "single"
                ? TOURNAMENT.quick.bestOf
                : TOURNAMENT.playoffs.bestOf,
          )}
        </p>
        <div className="flex items-center gap-2">
          {live ? (
            <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-orange-bright">
              <span className="live-dot h-2 w-2 rounded-full bg-orange" /> {T.live}
            </span>
          ) : null}
          {onClose ? (
            <button onClick={onClose} aria-label="Close" className="rounded p-1 text-sub hover:bg-white/10 hover:text-ink">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" />
              </svg>
            </button>
          ) : null}
        </div>
      </div>

      {/* Scoreline */}
      <div className="mb-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <TeamLogo orgId={teamA.orgId} seasonId={teamSeasonId(teamA)} size="sm" />
          <p className={cx("display min-w-0 truncate text-base font-bold uppercase tracking-wide md:text-lg", teamA.isUser ? "text-orange-bright" : "text-ink")}>
            {teamA.name}
          </p>
        </div>
        <p className="display shrink-0 text-3xl font-bold">
          <span className={cx(done && winsA > winsB ? "text-good" : "text-ink")}>{winsA}</span>
          <span className="mx-2 text-faint">–</span>
          <span className={cx(done && winsB > winsA ? "text-good" : "text-ink")}>{winsB}</span>
        </p>
        <div className="flex min-w-0 items-center justify-end gap-2">
          <p className={cx("display min-w-0 truncate text-right text-base font-bold uppercase tracking-wide md:text-lg", teamB.isUser ? "text-orange-bright" : "text-ink")}>
            {teamB.name}
          </p>
          <TeamLogo orgId={teamB.orgId} seasonId={teamSeasonId(teamB)} size="sm" />
        </div>
      </div>

      {/* Games — v1.3: split by outcome instead of chronological flow. Each
          game card lands in the WINNER's column (teamA left, teamB right —
          mirroring the scoreline above), so a 4-2 series stacks 4 cards under
          one team and 2 under the other. For the user's series this reads as
          "my wins on my side, my losses on the other". */}
      {(() => {
        const renderGame = (game: (typeof visible)[number]) => {
          const wonByUser = isUserSeries && game.winnerTeamId === "user";
          const lostByUser = isUserSeries && game.winnerTeamId !== "user";
          return (
            <li
              key={game.index}
              className={cx(
                "rise-in flex items-center justify-between rounded-md border px-3 py-1.5 text-xs",
                wonByUser
                  ? "border-good/30 bg-good/5"
                  : lostByUser
                    ? "border-bad/30 bg-bad/5"
                    : "border-line bg-white/3",
              )}
            >
              <span className="min-w-0 truncate uppercase tracking-wider text-sub">
                {T.game(game.index)}
                {game.overtime ? <span className="ml-1.5 font-bold text-orange-bright">{T.overtime}</span> : null}
                {game.deciding ? <span className="ml-1.5 font-bold text-cyan">{T.matchPoint}</span> : null}
                {game.starName && (game.overtime || game.deciding || game.notes.includes("high_roll")) ? (
                  <span className="ml-1.5 normal-case text-faint">★ {game.starName}</span>
                ) : null}
              </span>
              {/* game.score is [winnerGoals, loserGoals]; the card sits in the
                  winner's column, so showing it as-is reads "win score first". */}
              <span className="display font-bold text-ink">
                {game.score[0]}–{game.score[1]}
              </span>
            </li>
          );
        };
        const leftGames = visible.filter((g) => g.winnerTeamId === series.teamAId);
        const rightGames = visible.filter((g) => g.winnerTeamId === series.teamBId);
        return (
          <div className="grid grid-cols-2 gap-1.5" aria-live={live ? "polite" : undefined}>
            <ol className="flex flex-col gap-1.5">{leftGames.map(renderGame)}</ol>
            <ol className="flex flex-col gap-1.5">{rightGames.map(renderGame)}</ol>
          </div>
        );
      })()}

      {done && narration ? (
        <div className="pop-in mt-4 rounded-lg border border-line bg-white/4 px-4 py-3">
          {narration.map((line, i) => (
            <p key={i} className={cx("text-sm leading-relaxed", i === 0 ? (userWon ? "font-semibold text-good" : "font-semibold text-bad") : "text-sub")}>
              {line}
            </p>
          ))}
        </div>
      ) : null}
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Swiss path (the user's bracket-style round cards)
// ---------------------------------------------------------------------------

function SwissPath({
  run,
  t,
  revealed,
  revealedRounds,
  liveKey,
  onInspect,
}: {
  run: RunState;
  t: TournamentState;
  revealed: Set<string>;
  /** Fully revealed Swiss rounds — opponents beyond this stay hidden. */
  revealedRounds: number;
  liveKey: string | null;
  onInspect: (key: string) => void;
}) {
  const { TOURNAMENT_UI: T } = useCopy();
  // The user's series per swiss round, with reveal state.
  const cells: {
    key: string | null;
    round: number;
    series: SeriesResult | null;
    state: "revealed" | "live" | "upcoming" | "none";
    opponentId?: string;
    /** Swiss pairs by record — a future opponent leaks the current result. */
    hideOpponent?: boolean;
  }[] = [];

  t.swiss.rounds.forEach((round, ri) => {
    const si = round.series.findIndex((s) => s.teamAId === "user" || s.teamBId === "user");
    if (si === -1) return;
    const key = entryKey("swiss", ri, si);
    cells.push({
      key,
      round: round.round,
      series: round.series[si],
      state: revealed.has(key) ? "revealed" : key === liveKey ? "live" : "upcoming",
      hideOpponent: ri > revealedRounds,
    });
  });

  // Upcoming pairing (known one round ahead) — only once every simulated
  // round has been revealed; earlier it spoils the round still animating.
  const upcomingPair =
    revealedRounds >= t.swiss.rounds.length
      ? t.swiss.nextPairings?.find(([a, b]) => a === "user" || b === "user")
      : undefined;
  if (upcomingPair) {
    cells.push({
      key: null,
      round: t.swiss.rounds.length + 1,
      series: null,
      state: "upcoming",
      opponentId: upcomingPair[0] === "user" ? upcomingPair[1] : upcomingPair[0],
    });
  }

  while (cells.length < 5 && cells.length > 0 && !t.swiss.finished) {
    cells.push({ key: null, round: cells.length + 1, series: null, state: "none" });
  }

  if (cells.length === 0) return null;

  return (
    <Panel className="p-4">
      <h3 className="display mb-3 text-sm font-bold uppercase tracking-[0.16em] text-ink">
        {T.yourPath} — {T.swiss}
      </h3>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
        {cells.map((cell, i) => {
          if (cell.state === "none") {
            return (
              <div key={i} className="flex min-h-[72px] items-center justify-center rounded-lg border border-dashed border-line text-[10px] uppercase tracking-widest text-faint">
                {T.round(cell.round)}
              </div>
            );
          }
          if (!cell.series || (cell.state === "upcoming" && !cell.key)) {
            const opp = cell.opponentId ? t.teams[cell.opponentId] : null;
            return (
              <div key={i} className="rounded-lg border border-blue/35 bg-blue/5 p-2">
                <p className="kicker mb-1 !text-[9px]">{T.round(cell.round)} · {T.upcoming}</p>
                {opp ? (
                  <span className="flex items-center gap-1.5">
                    <TeamLogo orgId={opp.orgId} seasonId={teamSeasonId(opp)} size="xs" />
                    <span className="display min-w-0 truncate text-[11px] font-bold uppercase text-ink">{opp.name}</span>
                  </span>
                ) : (
                  <span className="text-[11px] italic text-faint">{T.tbd}</span>
                )}
              </div>
            );
          }
          const s = cell.series;
          const userWon = s.winnerTeamId === "user";
          const oppId = s.teamAId === "user" ? s.teamBId : s.teamAId;
          const opp = t.teams[oppId];
          const userScore = s.teamAId === "user" ? s.score : [s.score[1], s.score[0]];
          const isLive = cell.state === "live";
          const isRevealed = cell.state === "revealed";
          // Future rounds the engine already simulated: opponent stays hidden
          // (Swiss pairs by record — naming them spoils the current round).
          const showOpponent = isRevealed || isLive || !cell.hideOpponent;
          return (
            <button
              key={i}
              disabled={!isRevealed}
              onClick={() => cell.key && onInspect(cell.key)}
              className={cx(
                "rounded-lg border p-2 text-left transition-colors",
                isLive && "border-orange bg-orange/10",
                isRevealed && (userWon ? "border-good/60 bg-good/5 hover:bg-good/10" : "border-bad/60 bg-bad/5 hover:bg-bad/10"),
                !isLive && !isRevealed && "border-blue/35 bg-blue/5",
              )}
            >
              <p className="kicker mb-1 !text-[9px]">
                {T.round(cell.round)}
                {isLive ? <span className="ml-1 text-orange-bright">· {T.live}</span> : null}
              </p>
              {showOpponent ? (
                <span className="flex items-center gap-1.5">
                  <TeamLogo orgId={opp.orgId} seasonId={teamSeasonId(opp)} size="xs" />
                  <span className="display min-w-0 flex-1 truncate text-[11px] font-bold uppercase text-ink">
                    {opp.name}
                  </span>
                  {isRevealed ? (
                    <span className={cx("display shrink-0 text-xs font-bold", userWon ? "text-good" : "text-bad")}>
                      {userScore[0]}–{userScore[1]}
                    </span>
                  ) : null}
                </span>
              ) : (
                <span className="text-[11px] italic text-faint">{T.tbd}</span>
              )}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[10px] text-faint">{run.showOverall ? "" : T.opponentHidden}</p>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Double elimination bracket
// ---------------------------------------------------------------------------

const UPPER_COLUMNS: PlayoffRoundName[] = ["ub_quarterfinal", "ub_semifinal", "ub_final", "grand_final"];
const LOWER_COLUMNS: PlayoffRoundName[] = ["lb_round1", "lb_round2", "lb_semifinal", "lb_final", "third_place"];
const SINGLE_COLUMNS: PlayoffRoundName[] = ["quarterfinal", "semifinal", "final"];
const SLOTS: Record<PlayoffRoundName, number> = {
  ub_quarterfinal: 4,
  lb_round1: 2,
  ub_semifinal: 2,
  lb_round2: 2,
  ub_final: 1,
  lb_semifinal: 1,
  lb_final: 1,
  third_place: 1,
  grand_final: 1,
  quarterfinal: 4,
  semifinal: 2,
  final: 1,
};

function PlayoffBracketView({
  run,
  t,
  revealed,
  liveKey,
  allRevealed,
  onInspect,
}: {
  run: RunState;
  t: TournamentState;
  revealed: Set<string>;
  liveKey: string | null;
  allRevealed: boolean;
  onInspect: (key: string) => void;
}) {
  const { TOURNAMENT_UI: T } = useCopy();
  const p = t.playoffs!;
  const roundIndexByName = new Map(p.rounds.map((r, i) => [r.name, i]));
  const nextRoundName = roundOrderFor(p.format)[p.rounds.length] ?? null;
  const upcomingPairs = !p.finished && allRevealed && nextRoundName ? nextPlayoffPairings(p) : null;

  const renderColumn = (name: PlayoffRoundName) => {
    const ri = roundIndexByName.get(name);
    const series = ri !== undefined ? p.rounds[ri].series : null;
    return (
      <div key={name} className="flex min-w-[150px] flex-1 flex-col justify-around gap-2">
        <p className="kicker text-center !text-[9px]">{T.roundNames[name]}</p>
        {Array.from({ length: SLOTS[name] }).map((_, si) => {
          const s = series?.[si] ?? null;
          const key = ri !== undefined ? entryKey("playoffs", ri, si) : null;
          const isRevealed = Boolean(key && revealed.has(key));
          const isLive = Boolean(key && key === liveKey);
          const pair = !s && name === nextRoundName && upcomingPairs ? upcomingPairs[si] : null;
          return (
            <BracketCell
              key={si}
              run={run}
              t={t}
              // v1.3: pass the series for EVERY match of a simulated round so the
              // whole round's pairings show at once (teams + overalls). BracketCell
              // keeps the SCORE hidden until `revealed`, so results still reveal
              // one-by-one after the user's match plays — the matchups just aren't
              // a surprise anymore. Future (un-simulated) rounds: s is null → TBD.
              series={s}
              revealed={isRevealed}
              live={isLive}
              pair={pair ?? undefined}
              onClick={isRevealed && key ? () => onInspect(key) : undefined}
            />
          );
        })}
      </div>
    );
  };

  const isSingle = p.format === "single";

  return (
    <Panel className="p-4">
      <h3 className="display mb-4 text-sm font-bold uppercase tracking-[0.16em] text-ink">
        {T.bracket} ·{" "}
        {T.bestOf(isSingle ? TOURNAMENT.quick.bestOf : TOURNAMENT.playoffs.bestOf)}
      </h3>
      <div className="space-y-5 overflow-x-auto pb-1">
        {isSingle ? (
          <div className="flex min-w-[520px] gap-3">{SINGLE_COLUMNS.map(renderColumn)}</div>
        ) : (
          <>
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-cyan">{T.upperBracket}</p>
              <div className="flex min-w-[640px] gap-3">{UPPER_COLUMNS.map(renderColumn)}</div>
            </div>
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-orange-bright">{T.lowerBracket}</p>
              <div className="flex min-w-[640px] gap-3">{LOWER_COLUMNS.map(renderColumn)}</div>
            </div>
          </>
        )}
      </div>
    </Panel>
  );
}

function BracketCell({
  run,
  t,
  series,
  revealed,
  live,
  pair,
  onClick,
}: {
  run: RunState;
  t: TournamentState;
  series: SeriesResult | null;
  revealed: boolean;
  live: boolean;
  pair?: [string, string];
  onClick?: () => void;
}) {
  const { TOURNAMENT_UI: T } = useCopy();
  const userIn = series
    ? series.teamAId === "user" || series.teamBId === "user"
    : pair
      ? pair.includes("user")
      : false;
  const userWon = series?.winnerTeamId === "user";

  const outline = revealed && userIn
    ? userWon
      ? "border-good/70 shadow-[0_0_14px_rgba(52,211,153,0.15)]"
      : "border-bad/70 shadow-[0_0_14px_rgba(248,113,113,0.15)]"
    : live
      ? "border-orange"
      : userIn
        ? "border-orange/50"
        : "border-line";

  const row = (teamId: string | null, score: number | null, won: boolean | null) => {
    const team = teamId ? t.teams[teamId] : null;
    return (
      <p className={cx("flex items-center gap-1.5 py-0.5 text-xs", won === false && "opacity-45")}>
        {team ? <TeamLogo orgId={team.orgId} seasonId={teamSeasonId(team)} size="xs" /> : <span className="h-4 w-4 rounded bg-white/5" />}
        <span className={cx("min-w-0 flex-1 truncate", team?.isUser ? "font-bold text-orange-bright" : team ? "text-ink" : "italic text-faint")}>
          {team?.name ?? T.tbd}
        </span>
        {score !== null ? (
          <span className={cx("display shrink-0 font-bold", won ? "text-good" : "text-sub")}>{score}</span>
        ) : team ? (
          <span className="display shrink-0 text-[10px] text-faint">{ratingLabel(team, run.showOverall)}</span>
        ) : null}
      </p>
    );
  };

  const body = series ? (
    <>
      {row(series.teamAId, revealed ? series.score[0] : null, revealed ? series.winnerTeamId === series.teamAId : null)}
      {row(series.teamBId, revealed ? series.score[1] : null, revealed ? series.winnerTeamId === series.teamBId : null)}
    </>
  ) : pair ? (
    <>
      {row(pair[0], null, null)}
      {row(pair[1], null, null)}
    </>
  ) : (
    <>
      {row(null, null, null)}
      {row(null, null, null)}
    </>
  );

  const className = cx(
    "rounded-lg border bg-white/3 px-2.5 py-1.5 text-left transition-colors",
    outline,
    onClick && "cursor-pointer hover:bg-white/6",
    live && "bg-orange/8",
  );

  return onClick ? (
    <button type="button" onClick={onClick} className={className}>
      {body}
    </button>
  ) : (
    <div className={className}>{body}</div>
  );
}

// ---------------------------------------------------------------------------
// Standings
// ---------------------------------------------------------------------------

function SwissStandings({
  run,
  t,
  records,
  throughRound,
}: {
  run: RunState;
  t: TournamentState;
  records: Map<string, DerivedRecord>;
  /** Standings reflect rounds 1..throughRound only (end-of-round updates). */
  throughRound: number;
}) {
  const { TOURNAMENT_UI: T } = useCopy();
  const sorted = Object.keys(t.teams).sort((a, b) => {
    const ra = records.get(a)!;
    const rb = records.get(b)!;
    return (
      rb.wins - ra.wins ||
      ra.losses - rb.losses ||
      rb.gameDiff - ra.gameDiff ||
      t.teams[b].rating.total - t.teams[a].rating.total
    );
  });

  return (
    <aside aria-label={T.standings}>
      <Panel className="p-4">
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h3 className="display text-sm font-bold uppercase tracking-[0.16em] text-ink">
            {T.standings} — {T.swiss}
          </h3>
          {throughRound > 0 ? (
            <span className="shrink-0 text-[10px] uppercase tracking-wider text-faint">
              {T.throughRound(throughRound)}
            </span>
          ) : null}
        </div>
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-faint">
              <th className="pb-2 font-semibold">{T.team}</th>
              <th className="pb-2 text-center font-semibold">W–L</th>
              <th className="pb-2 text-center font-semibold">GD</th>
              <th className="pb-2 text-right font-semibold">OVR</th>
            </tr>
          </thead>
          {/* keyed by round → the whole body re-enters when standings step */}
          <tbody key={throughRound} className="rise-in">
            {sorted.map((teamId) => {
              const team = t.teams[teamId];
              const r = records.get(teamId)!;
              const isUser = teamId === "user";
              const out = r.losses >= 3;
              const through = r.wins >= 3;
              return (
                <tr key={teamId} className={cx("border-t border-line", isUser && "bg-orange/8", out && "opacity-45")}>
                  <td className="max-w-0 truncate py-1.5 pr-2">
                    <span className="flex items-center gap-1.5">
                      <TeamLogo orgId={team.orgId} seasonId={teamSeasonId(team)} size="xs" />
                      <span className={cx("min-w-0 truncate", isUser ? "font-bold text-orange-bright" : "text-ink")}>
                        {team.name}
                      </span>
                      {through ? <span className="text-[9px] font-bold text-good">✓</span> : null}
                    </span>
                  </td>
                  <td className="display whitespace-nowrap py-1.5 text-center font-bold">
                    {r.wins}–{r.losses}
                  </td>
                  <td className={cx("py-1.5 text-center", r.gameDiff > 0 ? "text-good" : r.gameDiff < 0 ? "text-bad" : "text-sub")}>
                    {r.gameDiff > 0 ? `+${r.gameDiff}` : r.gameDiff}
                  </td>
                  <td className="display py-1.5 text-right font-bold text-cyan">
                    {ratingLabel(team, run.showOverall)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Panel>
    </aside>
  );
}

function PlayGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
      <path d="M8 5.5v13l11-6.5Z" />
    </svg>
  );
}

function PauseGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
      <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" />
    </svg>
  );
}
