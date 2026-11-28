"use client";

/**
 * rc9 MATCHDAY (R240-R247, DESIGN-DECISIONS #233-#238): the user's series when
 * the career is set to Manage. It replaces the slice-5 desk (a choice screen
 * per game). Three moments, one board:
 *
 *  1. THE PLAN: the matchup (both crests, names and ratings), the opponent
 *     read in one line, three directives with the coach's call preselected
 *     (approach, risk, who to shut down), each with its trade-off; one button
 *     that plays the series and one that skips to the result.
 *  2. LIVE: every game on the clock (components/match/LiveGameView), one after
 *     the other, with no stop between them (Miguel, 27/11). The coach makes
 *     the calls at each break. The Timeout button is always there: pressed,
 *     it is called at the next break (and can be taken back until then).
 *  3. THE END: the matchup and the series score, the games one by one, one
 *     line on what the plan did (from the engine's own log), the players'
 *     numbers, Continue.
 *
 * Every rule lives in the flow and the engine (careerFlow rc9 block,
 * matchdaySeries): a series watched, skipped or left to the coach with the
 * same choices plays the same games (careerMatchday.rc9.test.ts).
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { FEATURES, MATCH_LIVE } from "@/config/balance";
import { useCareerCopy } from "@/content/careerCopy";
import { buildGameBoxScore, buildSeriesBoxScore } from "@/engine/career/boxScore";
import { coachPlanFor, coachQualityOf, shownStyle } from "@/engine/career/matchday";
import { planReport } from "@/engine/career/matchdaySeries";
import { buildGameTimeline } from "@/engine/career/matchTimeline";
import { PLAY_STYLES, styleBeats } from "@/engine/career/styles";
import type { CareerSave } from "@/engine/career/types";
import { isSeriesOver } from "@/engine/match";
import type { KickoffPlan, PlayStyleId, SeriesPlan, SeriesResult, TournamentTeam } from "@/engine/types";
import { cx } from "@/lib/util";
import { pendingUserSeriesOf, userSeriesTeamsOf } from "@/store/careerFlow";
import { useCareerStore } from "@/store/careerStore";
import { OrgMark } from "@/components/career/OrgMark";
import { LiveGameView, type LiveLabels } from "@/components/match/LiveGameView";
import type { LiveLine } from "@/components/match/liveModel";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { planLine } from "./planLine";

const KICKOFFS: readonly KickoffPlan[] = ["safe", "standard", "aggressive"];

type Desk = ReturnType<typeof useCareerCopy>["seriesDesk"];

/** The series so far as a SeriesResult (the shape the timeline and the box score read). */
function partialSeries(teamA: TournamentTeam, teamB: TournamentTeam, games: SeriesResult["games"], wins: [number, number]): SeriesResult {
  return {
    teamAId: teamA.id,
    teamBId: teamB.id,
    games,
    score: wins,
    winnerTeamId: wins[0] >= wins[1] ? teamA.id : teamB.id,
    ratingDiff: Math.round((teamA.rating.total - teamB.rating.total) * 10) / 10,
    upset: false,
  };
}

export function SeriesRoom({
  save,
  label,
  onStart,
  onContinue,
}: {
  save: CareerSave;
  /** The round's label ("Playoffs · Best of 5"). */
  label: string;
  /** Before the first game is played (the screen marks the round as watched here). */
  onStart: () => void;
  /** After the end: play the round on. */
  onContinue: () => void;
}) {
  const D = useCareerCopy().seriesDesk;
  const us = pendingUserSeriesOf(save);
  const teams = userSeriesTeamsOf(save);
  if (!us || !teams || !us.state.matchday) return null;
  return <Room key={us.roundKey} save={save} D={D} label={label} onStart={onStart} onContinue={onContinue} />;
}

function Room({
  save,
  D,
  label,
  onStart,
  onContinue,
}: {
  save: CareerSave;
  D: Desk;
  label: string;
  onStart: () => void;
  onContinue: () => void;
}) {
  const C = useCareerCopy();
  // Games already played when the room opens (a reload) count as seen.
  const [watched, setWatched] = useState(() => pendingUserSeriesOf(save)?.state.games.length ?? 0);
  const setPlan = useCareerStore((s) => s.setSeriesPlan);
  const playNext = useCareerStore((s) => s.playSeriesNext);
  const callTimeout = useCareerStore((s) => s.seriesTimeout);
  const delegate = useCareerStore((s) => s.delegateSeries);
  const [speed, setSpeed] = useState<number>(1);
  const [paused, setPaused] = useState(false);
  const [skipIdx, setSkipIdx] = useState<number | null>(null);
  /** The Timeout button: called for the next break. */
  const [queued, setQueued] = useState(false);
  const playedRef = useRef<number>(-1);

  const us = pendingUserSeriesOf(save)!;
  const { teamA, teamB } = userSeriesTeamsOf(save)!;
  const state = us.state;
  const md = state.matchday!;
  const side = us.userSide;
  const me = side === "a" ? teamA : teamB;
  const opp = side === "a" ? teamB : teamA;
  const played = state.games.length;
  const over = isSeriesOver(state);
  const bestOf = state.target * 2 - 1;
  const t = save.activeEvent!.tournament;
  // The box score reads the event's own teams (the reveal does too), so both agree.
  const boxSides = { a: t.teams[state.teamAId], b: t.teams[state.teamBId] };
  const series = useMemo(
    () => partialSeries(teamA, teamB, state.games, [state.winsA, state.winsB]),
    [teamA, teamB, state.games, state.winsA, state.winsB],
  );
  const spent = side === "a" ? md.timeoutA : md.timeoutB;

  // The break: once the game on screen is over, the next one is played, with
  // the timeout first when it was called. No stop.
  const atBreak = played > 0 && !over && watched >= played;
  useEffect(() => {
    if (!atBreak || playedRef.current === played) return;
    playedRef.current = played;
    if (queued && !spent) callTimeout();
    setQueued(false);
    playNext();
  }, [atBreak, played, queued, spent, callTimeout, playNext]);

  const marks = {
    a: <OrgMark save={save} orgRef={state.teamAId} size="lg" />,
    b: <OrgMark save={save} orgRef={state.teamBId} size="lg" />,
  };

  if (played === 0) {
    return (
      <PlanStep
        save={save}
        D={D}
        label={label}
        me={me}
        opp={opp}
        meMark={side === "a" ? marks.a : marks.b}
        oppMark={side === "a" ? marks.b : marks.a}
        oppPlan={side === "a" ? md.planB : md.planA}
        current={side === "a" ? md.planA : md.planB}
        seed={us.seed}
        onPlay={(plan) => {
          onStart();
          setPlan(plan);
          playNext();
        }}
        onSkip={(plan) => {
          onStart();
          setPlan(plan);
          delegate();
          onContinue();
        }}
      />
    );
  }

  const myWins = side === "a" ? state.winsA : state.winsB;
  const oppWins = side === "a" ? state.winsB : state.winsA;
  const ended = over && watched >= played;
  // The head shows the games on screen so far, never one the engine has played but the view has not.
  const seen = state.games.slice(0, Math.min(watched, played));
  const seenMine = seen.filter((g) => g.winnerTeamId === me.id).length;
  const seenTheirs = seen.length - seenMine;
  const B = C.boxScore;
  const labels: LiveLabels = {
    game: D.gameOf(Math.min(watched + 1, played), bestOf),
    overtime: C.event.overtime,
    final: D.final,
    strip: D.strip,
    goals: B.goals,
    assists: B.assists,
    shots: B.shots,
    saves: B.saves,
    score: B.score,
    player: B.player,
    clock: D.clock,
    goalLine: D.goalLine,
    noGoalsYet: D.noGoalsYet,
  };

  return (
    <Panel strong className="p-5" aria-label={label}>
      <div className="card-head">
        <h2 className="card-title">{ended ? (myWins > oppWins ? D.seriesWon : D.seriesLost) : label}</h2>
        {!ended ? <SeriesPips myWins={seenMine} oppWins={seenTheirs} target={state.target} label={D.series(seenMine, seenTheirs)} /> : null}
      </div>
      {ended ? (
        <SeriesEnd
          save={save}
          D={D}
          series={series}
          roundKey={us.roundKey}
          boxSides={boxSides}
          side={side}
          me={me}
          opp={opp}
          meMark={side === "a" ? marks.a : marks.b}
          oppMark={side === "a" ? marks.b : marks.a}
          myWins={myWins}
          oppWins={oppWins}
          onContinue={onContinue}
        />
      ) : watched < played ? (
        <LiveGame
          key={watched}
          D={D}
          labels={labels}
          series={series}
          gameIdx={watched}
          roundKey={us.roundKey}
          boxSides={boxSides}
          marks={marks}
          speed={speed}
          paused={paused}
          skip={skipIdx === watched}
          onEnd={() => setWatched((w) => w + 1)}
        />
      ) : (
        <div className="min-h-[24rem]" aria-busy />
      )}

      {!ended ? (
        <LiveControls
          D={D}
          paused={paused}
          speed={speed}
          timeout={spent ? "used" : queued ? "called" : "ready"}
          onTimeout={() => setQueued((q) => !q)}
          onPause={() => setPaused((p) => !p)}
          onSpeed={setSpeed}
          onSkipGame={watched < played ? () => setSkipIdx(watched) : undefined}
          onSkipSeries={() => {
            delegate();
            setWatched(() => Number.MAX_SAFE_INTEGER);
          }}
        />
      ) : null}
    </Panel>
  );
}

/** The series score as pips: the games each side needs, filled as they win them (ours orange, theirs blue). */
function SeriesPips({ myWins, oppWins, target, label }: { myWins: number; oppWins: number; target: number; label: string }) {
  const row = (wins: number, tone: string) => (
    <span className="flex gap-1">
      {Array.from({ length: target }, (_, i) => (
        <span key={i} className={cx("h-2 w-4 rounded-[1px]", i < wins ? tone : "bg-line-strong")} />
      ))}
    </span>
  );
  return (
    <span className="flex items-center gap-3" role="img" aria-label={label}>
      {row(myWins, "bg-orange-bright")}
      <span className="display text-sm font-semibold tabular-nums text-ink" aria-hidden>
        {myWins}-{oppWins}
      </span>
      {row(oppWins, "bg-blue-bright")}
    </span>
  );
}

function LiveGame({
  D,
  labels,
  series,
  gameIdx,
  roundKey,
  boxSides,
  marks,
  speed,
  paused,
  skip,
  onEnd,
}: {
  D: Desk;
  labels: LiveLabels;
  series: SeriesResult;
  gameIdx: number;
  roundKey: string;
  boxSides: { a?: TournamentTeam; b?: TournamentTeam };
  marks: { a: ReactNode; b: ReactNode };
  speed: number;
  paused: boolean;
  skip: boolean;
  onEnd: () => void;
}) {
  const game = series.games[gameIdx];
  const timeline = useMemo(() => buildGameTimeline(series, game, roundKey), [series, game, roundKey]);
  const finals = useMemo(() => {
    if (!FEATURES.matchdayBoxScore) return undefined;
    const box = buildGameBoxScore(series, game, roundKey, boxSides);
    const strip = (l: LiveLine) => ({ goals: l.goals, assists: l.assists, shots: l.shots, saves: l.saves, demos: l.demos, score: l.score });
    return { a: box.players.a.map(strip), b: box.players.b.map(strip) };
  }, [series, game, roundKey, boxSides]);
  const winsBefore = series.games.slice(0, gameIdx).reduce<[number, number]>(
    (w, g) => (g.winnerTeamId === series.teamAId ? [w[0] + 1, w[1]] : [w[0], w[1] + 1]),
    [0, 0],
  );
  const a = boxSides.a;
  const b = boxSides.b;
  const ownA = series.teamAId === "user";
  return (
    <LiveGameView
      timeline={timeline}
      sides={{
        a: { name: a?.name ?? "", players: a?.playerNames ?? [], own: ownA, tone: ownA ? "orange" : "blue", mark: marks.a },
        b: { name: b?.name ?? "", players: b?.playerNames ?? [], own: !ownA, tone: ownA ? "blue" : "orange", mark: marks.b },
      }}
      finals={finals}
      labels={labels}
      context={<span className="tabular-nums">{D.series(winsBefore[0], winsBefore[1])}</span>}
      speed={speed}
      paused={paused}
      skip={skip}
      onEnd={onEnd}
    />
  );
}

function LiveControls({
  D,
  paused,
  speed,
  timeout,
  onTimeout,
  onPause,
  onSpeed,
  onSkipGame,
  onSkipSeries,
}: {
  D: Desk;
  paused: boolean;
  speed: number;
  timeout: "ready" | "called" | "used";
  onTimeout: () => void;
  onPause: () => void;
  onSpeed: (s: number) => void;
  onSkipGame?: () => void;
  onSkipSeries: () => void;
}) {
  return (
    // Phone: docked, so the Timeout stays in reach while the game runs.
    <div className="action-dock mt-6 flex flex-wrap items-center gap-2 sm:border-t sm:border-line sm:pt-4">
      {/* The timeout: called for the next break, taken back with a second press; once a series. */}
      <button
        type="button"
        aria-pressed={timeout === "called"}
        disabled={timeout === "used"}
        onClick={onTimeout}
        className={cx(
          "display inline-flex min-h-11 items-center gap-2 rounded-[7px] border px-3 text-sm font-semibold uppercase tracking-[0.05em] transition-colors sm:min-h-9",
          timeout === "called"
            ? "border-orange bg-orange/10 text-orange-bright"
            : timeout === "used"
              ? "cursor-not-allowed border-line text-faint"
              : "border-line-strong text-ink hover:border-orange/70",
        )}
      >
        {timeout === "called" ? D.timeoutCalled : timeout === "used" ? D.timeoutUsed : D.timeout}
        {timeout === "ready" ? <span className="text-xs font-medium normal-case tracking-normal text-faint">{D.timeoutLeft}</span> : null}
      </button>
      <Button variant="secondary" size="sm" onClick={onPause} aria-pressed={paused}>
        {paused ? D.resume : D.pause}
      </Button>
      {/* Phone: one button that steps through the speeds, so the dock keeps to two rows. */}
      <button
        type="button"
        aria-label={`${D.speed} ${speed}×`}
        onClick={() => {
          const all = MATCH_LIVE.speeds as readonly number[];
          onSpeed(all[(all.indexOf(speed) + 1) % all.length]);
        }}
        className="display min-h-11 min-w-11 rounded-[7px] border border-line px-3 text-xs font-semibold tabular-nums text-ink sm:hidden"
      >
        {speed}×
      </button>
      <div className="hidden overflow-hidden rounded-[7px] border border-line sm:flex" role="group" aria-label={D.speed}>
        {MATCH_LIVE.speeds.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={speed === s}
            onClick={() => onSpeed(s)}
            className={cx(
              "display min-h-11 min-w-11 px-3 text-xs font-semibold tabular-nums transition-colors sm:min-h-9",
              speed === s ? "bg-white/[0.08] text-ink" : "text-sub hover:text-ink",
            )}
          >
            {s}×
          </button>
        ))}
      </div>
      <span className="ml-auto flex flex-wrap gap-2">
        {onSkipGame ? (
          <Button variant="ghost" size="sm" onClick={onSkipGame}>
            {D.skipGame}
          </Button>
        ) : null}
        <Button variant="ghost" size="sm" onClick={onSkipSeries}>
          {D.skipSeries}
        </Button>
      </span>
    </div>
  );
}

/** One side of a matchup: crest, name, rating figure. */
function MatchSide({ mark, name, rating, tone, align }: { mark: ReactNode; name: string; rating?: number; tone: "orange" | "blue"; align: "left" | "right" }) {
  return (
    <div className={cx("flex min-w-0 flex-col items-center gap-2 text-center sm:flex-row sm:gap-3", align === "right" && "sm:flex-row-reverse")}>
      <span className="shrink-0">{mark}</span>
      <div className={cx("min-w-0", align === "left" ? "sm:text-left" : "sm:text-right")}>
        <p className="display break-words text-[15px] font-semibold leading-tight text-ink sm:text-xl">{name}</p>
        <span className={cx("mt-1.5 inline-block h-1 w-8 rounded-[1px]", tone === "orange" ? "bg-orange-bright" : "bg-blue-bright")} aria-hidden />
        {rating !== undefined ? <p className="display mt-1 text-2xl font-bold leading-none tabular-nums text-ink">{rating}</p> : null}
      </div>
    </div>
  );
}

function SeriesEnd({
  save,
  D,
  series,
  roundKey,
  boxSides,
  side,
  me,
  opp,
  meMark,
  oppMark,
  myWins,
  oppWins,
  onContinue,
}: {
  save: CareerSave;
  D: Desk;
  series: SeriesResult;
  roundKey: string;
  boxSides: { a?: TournamentTeam; b?: TournamentTeam };
  side: "a" | "b";
  me: TournamentTeam;
  opp: TournamentTeam;
  meMark: ReactNode;
  oppMark: ReactNode;
  myWins: number;
  oppWins: number;
  onContinue: () => void;
}) {
  const B = useCareerCopy().boxScore;
  const us = pendingUserSeriesOf(save)!;
  const line = planLine(D, planReport(us.state));
  const box = useMemo(
    () => (FEATURES.matchdayBoxScore ? buildSeriesBoxScore(series, roundKey, boxSides) : null),
    [series, roundKey, boxSides],
  );
  const won = myWins > oppWins;
  const names = boxSides[side]?.playerNames ?? [];
  const rootRef = useRef<HTMLDivElement>(null);
  // The end lands on its one action, so a keyboard player goes on with Enter.
  useEffect(() => rootRef.current?.querySelector<HTMLButtonElement>("[data-continue]")?.focus({ preventScroll: true }), []);
  return (
    <div ref={rootRef}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-6">
        <MatchSide mark={meMark} name={me.name} tone="orange" align="left" />
        <p className={cx("display pop-in text-6xl font-bold leading-none tabular-nums sm:text-7xl", won ? "text-good" : "text-bad")}>
          {myWins}-{oppWins}
        </p>
        <MatchSide mark={oppMark} name={opp.name} tone="blue" align="right" />
      </div>

      {/* The games, one by one: the winner's colour, the score from our side. */}
      <ol className="mt-5 flex flex-wrap justify-center gap-2">
        {series.games.map((g, i) => {
          const ours = g.winnerTeamId === "user";
          const [w, l] = g.score;
          return (
            <li
              key={i}
              className={cx(
                "display flex min-w-[4.5rem] flex-col items-center rounded-[7px] border px-3 py-1.5",
                ours ? "border-orange/60" : "border-blue-bright/50",
              )}
            >
              <span className="kicker">{B.game(i + 1)}</span>
              <span className={cx("text-base font-semibold tabular-nums", ours ? "text-orange-bright" : "text-blue-bright")}>
                {ours ? `${w}-${l}` : `${l}-${w}`}
                {g.overtime ? <span className="ml-1 text-xs text-faint">OT</span> : null}
              </span>
            </li>
          );
        })}
      </ol>

      {line ? <p className="mx-auto mt-5 max-w-prose text-center text-[15px] leading-relaxed text-sub">{line}</p> : null}

      {box ? (
        <table className="mt-5 w-full table-fixed text-sm">
          <thead>
            <tr className="kicker">
              <th scope="col" className="w-[40%] pb-1 text-left font-medium">{B.player}</th>
              <th scope="col" className="pb-1 text-right font-medium">{B.goals}</th>
              <th scope="col" className="pb-1 text-right font-medium">{B.assists}</th>
              <th scope="col" className="pb-1 text-right font-medium">{B.saves}</th>
              <th scope="col" className="hidden pb-1 text-right font-medium sm:table-cell">{B.shots}</th>
              <th scope="col" className="pb-1 text-right font-medium">{B.rating}</th>
            </tr>
          </thead>
          <tbody>
            {box.totals[side].map((l, i) => {
              const mvp = box.mvp?.side === side && box.mvp.playerIdx === i;
              return (
                <tr key={i} className="border-t border-line">
                  <td className="py-2.5 pr-2">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="h-2 w-2 shrink-0 rounded-[2px] bg-orange-bright" aria-hidden />
                      <span className="display truncate text-[15px] font-semibold text-ink">{names[i] ?? ""}</span>
                      {mvp ? <Badge tone="gold">{B.mvp}</Badge> : null}
                    </span>
                  </td>
                  <td className="py-2.5 text-right tabular-nums text-ink">{l.goals}</td>
                  <td className="py-2.5 text-right tabular-nums text-sub">{l.assists}</td>
                  <td className="py-2.5 text-right tabular-nums text-sub">{l.saves}</td>
                  <td className="hidden py-2.5 text-right tabular-nums text-sub sm:table-cell">{l.shots}</td>
                  <td className="display py-2.5 text-right text-base font-semibold tabular-nums text-ink">{l.avgRating.toFixed(1)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : null}
      <div className="action-dock mt-6">
        <Button data-continue variant="primary" className="w-full sm:w-auto" onClick={onContinue}>
          {D.continue}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The plan
// ---------------------------------------------------------------------------

function PlanStep({
  save,
  D,
  label,
  me,
  opp,
  meMark,
  oppMark,
  oppPlan,
  current,
  seed,
  onPlay,
  onSkip,
}: {
  save: CareerSave;
  D: Desk;
  label: string;
  me: TournamentTeam;
  opp: TournamentTeam;
  meMark: ReactNode;
  oppMark: ReactNode;
  oppPlan: SeriesPlan;
  current: SeriesPlan;
  seed: number;
  onPlay: (plan: SeriesPlan) => void;
  onSkip: (plan: SeriesPlan) => void;
}) {
  const quality = save.coach ? coachQualityOf(save.coach.overall) : null;
  const coach = useMemo(() => coachPlanFor(me, opp, quality, seed, "user"), [me, opp, quality, seed]);
  const [plan, setPlanState] = useState<SeriesPlan>(current);
  const tag = save.coach ? D.coachPick : D.captainPick;
  const pct = (n: number | undefined) => Math.round((n ?? 0) * 100);

  const gap = Math.round(me.rating.total - opp.rating.total);
  const stakes = Math.abs(gap) < 1 ? D.even : gap > 0 ? D.favourite(gap) : D.underdog(-gap);

  // Approach: our style, the one that beats theirs, and the coach's own if it is a third.
  const oppStyle = shownStyle(opp, oppPlan);
  const natural = me.style?.natural;
  const answer = oppStyle ? PLAY_STYLES.find((s) => styleBeats(s) === oppStyle) : undefined;
  const styleOptions: { id: PlayStyleId | undefined; label: string; note: string }[] = [];
  if (me.style && natural) {
    const theirs = oppStyle ? D.styles[oppStyle] : "";
    styleOptions.push({
      id: undefined,
      label: D.ourGame(D.styles[natural]),
      note: !oppStyle
        ? D.ourGameNeutral
        : styleBeats(natural) === oppStyle
          ? D.ourGameEdge(theirs)
          : styleBeats(oppStyle) === natural
            ? D.ourGameAgainst(theirs)
            : D.ourGameNeutral,
    });
    if (answer && answer !== natural && oppStyle) {
      styleOptions.push({ id: answer, label: D.answer(D.styles[answer]), note: D.answerNote(theirs, pct(me.style.fit[answer]), pct(me.style.fit[natural])) });
    }
    const third = coach.style;
    if (third && third !== natural && third !== answer && oppStyle) {
      styleOptions.push({ id: third, label: D.switchTo(D.styles[third]), note: D.switchNote(theirs, pct(me.style.fit[third])) });
    }
  }
  const pm = opp.playmakerIndex !== undefined ? opp.playerNames[opp.playmakerIndex] : undefined;
  const read = oppStyle ? (answer && answer !== natural ? D.read(D.styles[oppStyle], D.styles[answer]) : D.readPlain(D.styles[oppStyle])) : null;

  const set = (patch: { style?: PlayStyleId | null; kickoff?: KickoffPlan; mark?: number | null }) =>
    setPlanState((p) => {
      const next: SeriesPlan = { ...p };
      if ("style" in patch) {
        if (patch.style) next.style = patch.style;
        else delete next.style;
      }
      if (patch.kickoff) next.kickoff = patch.kickoff;
      if ("mark" in patch) {
        if (patch.mark === null || patch.mark === undefined) delete next.mark;
        else next.mark = patch.mark;
      }
      return next;
    });

  const selectedStyle = styleOptions.find((o) => o.id === plan.style) ?? styleOptions[0];

  return (
    <Panel strong className="p-5" aria-labelledby="plan-title">
      <div className="card-head">
        <h2 id="plan-title" className="card-title">{D.planTitle}</h2>
        <span className="text-sm text-sub">{label}</span>
      </div>

      {/* The matchup: who, how strong, how they play. */}
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-6">
        <MatchSide mark={meMark} name={me.name} rating={Math.round(me.rating.total)} tone="orange" align="left" />
        <span className="display text-lg font-semibold text-faint">vs</span>
        <MatchSide mark={oppMark} name={opp.name} rating={Math.round(opp.rating.total)} tone="blue" align="right" />
      </div>
      <div className="mt-4 text-center">
        <p className="text-[15px] text-ink">{stakes}</p>
        {read ? <p className="mt-0.5 text-sm text-sub">{read}</p> : null}
      </div>

      <div className="mt-6 space-y-5 border-t border-line pt-5">
        {styleOptions.length > 1 ? (
          <Directive label={D.approach} note={selectedStyle?.note}>
            {styleOptions.map((o) => (
              <Choice key={o.id ?? "natural"} selected={plan.style === o.id} coach={coach.style === o.id} tag={tag} onClick={() => set({ style: o.id ?? null })}>
                {o.label}
              </Choice>
            ))}
          </Directive>
        ) : styleOptions.length === 1 ? (
          <Directive label={D.approach} note={styleOptions[0].note}>
            <p className="display flex min-h-11 items-center text-[15px] font-semibold text-ink">{styleOptions[0].label}</p>
          </Directive>
        ) : null}

        <Directive label={D.risk} note={D.riskNote[plan.kickoff]}>
          {KICKOFFS.map((k) => (
            <Choice key={k} selected={plan.kickoff === k} coach={coach.kickoff === k} tag={tag} onClick={() => set({ kickoff: k })}>
              {D.risks[k]}
            </Choice>
          ))}
        </Directive>

        {pm !== undefined && opp.playmakerIndex !== undefined ? (
          <Directive label={D.shutDown} note={plan.mark === opp.playmakerIndex ? D.markNote(pm) : D.freeNote}>
            <Choice selected={plan.mark === undefined} coach={coach.mark === undefined} tag={tag} onClick={() => set({ mark: null })}>
              {D.free}
            </Choice>
            <Choice selected={plan.mark === opp.playmakerIndex} coach={coach.mark === opp.playmakerIndex} tag={tag} onClick={() => set({ mark: opp.playmakerIndex! })}>
              {D.mark(pm)}
            </Choice>
          </Directive>
        ) : null}
      </div>

      {/* Phone: docked over the bottom bar, so the decision is one thumb away (DESIGN.md "Phone"). */}
      <div className="action-dock mt-7 flex flex-col gap-2 sm:flex-row sm:items-center sm:border-t sm:border-line sm:pt-5">
        <Button variant="primary" size="lg" className="w-full sm:w-auto" onClick={() => onPlay(plan)}>
          {D.play}
        </Button>
        <Button variant="ghost" className="w-full sm:w-auto" onClick={() => onSkip(plan)}>
          {D.skip}
        </Button>
      </div>
    </Panel>
  );
}

function Directive({ label, note, children }: { label: string; note?: string; children: React.ReactNode }) {
  return (
    <fieldset className="grid gap-2 sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:gap-4">
      <legend className="contents">
        <span className="kicker pt-3">{label}</span>
      </legend>
      <div className="min-w-0">
        <div className="flex flex-wrap gap-2">{children}</div>
        {note ? <p className="mt-2 text-sm text-sub">{note}</p> : null}
      </div>
    </fieldset>
  );
}

/** One option: a hairline that turns orange when chosen; the coach's own call carries a quiet tag. */
function Choice({
  selected,
  coach,
  tag,
  onClick,
  children,
}: {
  selected: boolean;
  coach: boolean;
  tag: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cx(
        "flex min-h-11 min-w-0 max-w-full items-center gap-2 rounded-[7px] border px-3 py-2 text-left transition-colors",
        selected ? "border-orange bg-orange/[0.06] text-ink" : "border-line-strong text-sub hover:border-blue/60 hover:text-ink",
      )}
    >
      <span className="display text-[15px] font-semibold">{children}</span>
      {coach ? <span className="kicker">{tag}</span> : null}
    </button>
  );
}
