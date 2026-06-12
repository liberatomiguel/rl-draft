"use client";

/**
 * Tournament screen v2 — automatic simulation.
 *
 * The player presses Start once; rounds then resolve on their own. The user's
 * series play out game by game in the Match Center, AI series pop into the
 * brackets with a short delay. Speed toggle (1×/2×) and Skip available.
 *
 * Views: Swiss = "Your Path" round cards + live standings (derived only from
 * revealed series — no spoilers). Playoffs = full double-elimination bracket
 * (upper, lower, finals + third place) with team logos and a green/red
 * outline on the user's matches. Finished → everything stays browsable and
 * any series can be clicked open in the Match Center.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TOURNAMENT } from "@/config/balance";
import { NARRATION, TOURNAMENT_UI as T } from "@/content/copy";
import { nextPlayoffPairings, PLAYOFF_ROUND_ORDER } from "@/engine/playoffs";
import { displayTeamOverall } from "@/engine/rating";
import type {
  PlayoffRoundName,
  RunState,
  SeriesResult,
  TournamentState,
  TournamentTeam,
} from "@/engine/types";
import { cx } from "@/lib/util";
import { useRunStore } from "@/store/runStore";
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

function allEntries(t: TournamentState): SeriesEntry[] {
  const out: SeriesEntry[] = [];
  t.swiss.rounds.forEach((round, ri) => {
    round.series.forEach((s, si) => {
      out.push({
        key: entryKey("swiss", ri, si),
        label: `${T.swiss} · ${T.round(round.round)}`,
        isUser: s.teamAId === "user" || s.teamBId === "user",
        stage: "swiss",
        roundIndex: ri,
        seriesIndex: si,
      });
    });
  });
  (t.playoffs?.rounds ?? []).forEach((round, ri) => {
    round.series.forEach((s, si) => {
      out.push({
        key: entryKey("playoffs", ri, si),
        label: T.roundNames[round.name] ?? round.name,
        isUser: s.teamAId === "user" || s.teamBId === "user",
        stage: "playoffs",
        roundIndex: ri,
        seriesIndex: si,
      });
    });
  });
  return out;
}

function locateSeries(t: TournamentState, entry: SeriesEntry): SeriesResult {
  return entry.stage === "swiss"
    ? t.swiss.rounds[entry.roundIndex].series[entry.seriesIndex]
    : t.playoffs!.rounds[entry.roundIndex].series[entry.seriesIndex];
}

function ratingLabel(team: TournamentTeam | undefined, showOverall: boolean): string {
  if (!team) return "";
  return showOverall ? String(displayTeamOverall(team.rating)) : "??";
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export function TournamentScreen({ run }: { run: RunState }) {
  const playRound = useRunStore((s) => s.playRound);
  const finishRun = useRunStore((s) => s.finishRun);
  const t = run.tournament;

  // Playback state. On mount (or refresh) everything already simulated is
  // treated as revealed; pressing Start continues from there.
  const [queue, setQueue] = useState<SeriesEntry[]>(() => (t ? allEntries(t) : []));
  const [cursor, setCursor] = useState<number>(() => (t ? allEntries(t).length : 0));
  const [gamesShown, setGamesShown] = useState(0);
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState<1 | 2>(1);
  const [inspectKey, setInspectKey] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    const entries = allEntries(fresh);
    setQueue(entries); // cursor stays — new entries are beyond it
  }, [playRound]);

  // The autoplay engine.
  useEffect(() => {
    if (!running || !t) return;
    const tick = (ms: number, fn: () => void) => {
      timerRef.current = setTimeout(fn, ms / speed);
    };

    if (current) {
      const series = locateSeries(t, current);
      if (current.isUser && gamesShown < series.games.length) {
        tick(850, () => setGamesShown((g) => g + 1));
      } else {
        tick(current.isUser ? 1300 : 240, () => {
          setCursor((c) => c + 1);
          setGamesShown(0);
        });
      }
    } else if (t.stage !== "finished") {
      tick(420, advanceRound);
    } else {
      setRunning(false);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [running, t, current, gamesShown, speed, advanceRound]);

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
      const entries = allEntries(fresh);
      setQueue(entries);
      setCursor(entries.length);
    }
    setGamesShown(0);
    setRunning(false);
  };

  // What the Match Center shows: inspected > live > last revealed user series.
  const inspected = inspectKey ? queue.find((e) => e.key === inspectKey) ?? null : null;
  const liveEntry = running && current ? current : null;
  const lastRevealedUser = [...queue.slice(0, cursor)].reverse().find((e) => e.isUser) ?? null;
  const centerEntry = inspected ?? liveEntry ?? lastRevealedUser;
  const centerLive = Boolean(liveEntry && centerEntry?.key === liveEntry.key);

  // Header record derived from revealed series only (no spoilers).
  const revealedRecords = deriveSwissRecords(t, revealedKeys);
  const userRecord = revealedRecords.get("user") ?? { wins: 0, losses: 0, gameDiff: 0 };

  return (
    <div className="rise-in">
      <RunStepper run={run} />

      <SectionTitle
        kicker={t.stage === "swiss" || !revealedPlayoffsStarted(t, revealedKeys) ? T.swiss : T.playoffs}
        title={T.title}
        right={
          <div className="flex items-center gap-2">
            <Badge tone="blue" className="!text-sm">
              {T.record(userRecord.wins, userRecord.losses)}
            </Badge>
          </div>
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
                <PauseGlyph /> Pause
              </Button>
            )}
            <div className="flex overflow-hidden rounded-lg border border-line">
              {([1, 2] as const).map((s) => (
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
            <Button variant="primary" size="lg" onClick={finishRun}>
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
              run={run}
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

          {/* Swiss: your path */}
          <SwissPath run={run} t={t} revealed={revealedKeys} liveKey={liveEntry?.key ?? null} onInspect={setInspectKey} />

          {/* Playoffs bracket */}
          {t.playoffs && revealedPlayoffsStarted(t, revealedKeys) ? (
            <DoubleElimBracket
              run={run}
              t={t}
              revealed={revealedKeys}
              liveKey={liveEntry?.key ?? null}
              allRevealed={allRevealed}
              onInspect={setInspectKey}
            />
          ) : null}
        </div>

        {/* Standings (derived from revealed series only) */}
        <SwissStandings run={run} t={t} records={revealedRecords} />
      </div>
    </div>
  );
}

function revealedPlayoffsStarted(t: TournamentState, revealed: Set<string>): boolean {
  if (!t.playoffs || t.playoffs.rounds.length === 0) {
    // Show the bracket as soon as seeding exists and all swiss is revealed.
    return Boolean(t.playoffs) && t.swiss.finished;
  }
  return true;
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

// ---------------------------------------------------------------------------
// Match Center
// ---------------------------------------------------------------------------

function MatchCenter({
  run,
  t,
  entry,
  live,
  gamesShown,
  onClose,
}: {
  run: RunState;
  t: TournamentState;
  entry: SeriesEntry;
  live: boolean;
  gamesShown: number;
  onClose?: () => void;
}) {
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
    if (series.games.some((g) => g.deciding && g.notes.includes("special_clutch"))) {
      lines.push(NARRATION.specialNote);
    } else if (series.games.some((g) => g.overtime && g.deciding)) {
      lines.push(NARRATION.overtimeNote);
    }
    return lines;
  }, [done, isUserSeries, series, userWon]);

  return (
    <Panel strong glow={live ? "orange" : undefined} className="p-5">
      <div className="mb-1 flex items-center justify-between gap-3">
        <p className="kicker">
          {entry.label} · {T.bestOf(entry.stage === "swiss" ? TOURNAMENT.swiss.bestOf : TOURNAMENT.playoffs.bestOf)}
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
          <TeamLogo orgId={teamA.orgId} size="sm" />
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
          <TeamLogo orgId={teamB.orgId} size="sm" />
        </div>
      </div>

      {/* Games */}
      <ol className="grid grid-cols-1 gap-1.5 sm:grid-cols-2" aria-live={live ? "polite" : undefined}>
        {visible.map((game) => {
          const aWon = game.winnerTeamId === series.teamAId;
          const userPerspective = isUserSeries
            ? game.winnerTeamId === "user"
            : aWon;
          const score = aWon ? game.score : ([game.score[1], game.score[0]] as [number, number]);
          return (
            <li
              key={game.index}
              className={cx(
                "rise-in flex items-center justify-between rounded-md border px-3 py-1.5 text-xs",
                isUserSeries
                  ? userPerspective
                    ? "border-good/30 bg-good/5"
                    : "border-bad/30 bg-bad/5"
                  : "border-line bg-white/3",
              )}
            >
              <span className="uppercase tracking-wider text-sub">
                {T.game(game.index)}
                {game.overtime ? <span className="ml-1.5 font-bold text-orange-bright">{T.overtime}</span> : null}
                {game.deciding ? <span className="ml-1.5 font-bold text-cyan">{T.matchPoint}</span> : null}
              </span>
              <span className="display font-bold text-ink">
                {score[0]}–{score[1]}
              </span>
            </li>
          );
        })}
      </ol>

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
  liveKey,
  onInspect,
}: {
  run: RunState;
  t: TournamentState;
  revealed: Set<string>;
  liveKey: string | null;
  onInspect: (key: string) => void;
}) {
  // The user's series per swiss round, with reveal state.
  const cells: {
    key: string | null;
    round: number;
    series: SeriesResult | null;
    state: "revealed" | "live" | "upcoming" | "none";
    opponentId?: string;
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
    });
  });

  // Upcoming pairing (known one round ahead).
  const upcomingPair = t.swiss.nextPairings?.find(([a, b]) => a === "user" || b === "user");
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
                    <TeamLogo orgId={opp.orgId} size="xs" />
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
              <span className="flex items-center gap-1.5">
                <TeamLogo orgId={opp.orgId} size="xs" />
                <span className="display min-w-0 flex-1 truncate text-[11px] font-bold uppercase text-ink">
                  {opp.name}
                </span>
                {isRevealed ? (
                  <span className={cx("display shrink-0 text-xs font-bold", userWon ? "text-good" : "text-bad")}>
                    {userScore[0]}–{userScore[1]}
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[10px] text-faint">{run.showOverall ? "" : "Opponent ratings stay hidden until the results screen."}</p>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Double elimination bracket
// ---------------------------------------------------------------------------

const UPPER_COLUMNS: PlayoffRoundName[] = ["ub_quarterfinal", "ub_semifinal", "ub_final", "grand_final"];
const LOWER_COLUMNS: PlayoffRoundName[] = ["lb_round1", "lb_round2", "lb_semifinal", "lb_final", "third_place"];
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
};

function DoubleElimBracket({
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
  const p = t.playoffs!;
  const roundIndexByName = new Map(p.rounds.map((r, i) => [r.name, i]));
  const nextRoundName = PLAYOFF_ROUND_ORDER[p.rounds.length] ?? null;
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
              series={isRevealed || isLive ? s : null}
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

  return (
    <Panel className="p-4">
      <h3 className="display mb-4 text-sm font-bold uppercase tracking-[0.16em] text-ink">
        {T.bracket} · {T.bestOf(TOURNAMENT.playoffs.bestOf)}
      </h3>
      <div className="space-y-5 overflow-x-auto pb-1">
        <div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-cyan">{T.upperBracket}</p>
          <div className="flex min-w-[640px] gap-3">{UPPER_COLUMNS.map(renderColumn)}</div>
        </div>
        <div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-orange-bright">{T.lowerBracket}</p>
          <div className="flex min-w-[640px] gap-3">{LOWER_COLUMNS.map(renderColumn)}</div>
        </div>
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
        {team ? <TeamLogo orgId={team.orgId} size="xs" /> : <span className="h-4 w-4 rounded bg-white/5" />}
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
}: {
  run: RunState;
  t: TournamentState;
  records: Map<string, DerivedRecord>;
}) {
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
        <h3 className="display mb-3 text-sm font-bold uppercase tracking-[0.16em] text-ink">
          {T.standings} — {T.swiss}
        </h3>
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-faint">
              <th className="pb-2 font-semibold">Team</th>
              <th className="pb-2 text-center font-semibold">W–L</th>
              <th className="pb-2 text-center font-semibold">GD</th>
              <th className="pb-2 text-right font-semibold">OVR</th>
            </tr>
          </thead>
          <tbody>
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
                      <TeamLogo orgId={team.orgId} size="xs" />
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
