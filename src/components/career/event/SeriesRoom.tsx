"use client";

/**
 * rc9 MATCHDAY (R240-R246, DESIGN-DECISIONS #233-#235): the user's series when
 * the career is set to Manage. It replaces the slice-5 desk (a choice screen
 * per game). Three moments, one board:
 *
 *  1. THE PLAN: three directives with the coach's call preselected (approach,
 *     risk, who to shut down), the opponent read in one line, one button that
 *     plays the series and one that skips to the result.
 *  2. LIVE: every game on the clock (components/match/LiveGameView), one after
 *     the other. Between games the coach makes the calls; the board stops only
 *     when the opponent carries momentum and the timeout is unused, for one
 *     optional call that waits a few seconds and then goes on by itself.
 *  3. THE END: the result, one line on what the plan did (from the engine's
 *     own log), the players' numbers, Continue.
 *
 * Every rule lives in the flow and the engine (careerFlow rc9 block,
 * matchdaySeries): a series watched, skipped or left to the coach with the
 * same choices plays the same games.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { CAREER_MATCHDAY, FEATURES, MATCH_LIVE } from "@/config/balance";
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
  const C = useCareerCopy();
  const D = C.seriesDesk;
  const us = pendingUserSeriesOf(save);
  const teams = userSeriesTeamsOf(save);
  if (!us || !teams || !us.state.matchday) return null;
  return (
    <Room
      key={us.roundKey}
      save={save}
      D={D}
      label={label}
      onStart={onStart}
      onContinue={onContinue}
    />
  );
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
  const timeout = useCareerStore((s) => s.seriesTimeout);
  const delegate = useCareerStore((s) => s.delegateSeries);
  const [speed, setSpeed] = useState<number>(1);
  const [paused, setPaused] = useState(false);
  const [skipIdx, setSkipIdx] = useState<number | null>(null);
  const [coachBreaks, setCoachBreaks] = useState(false);
  const askedRef = useRef<number>(-1);

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

  // Between games: the one call, or straight on.
  const spent = side === "a" ? md.timeoutA : md.timeoutB;
  const oppMeter = side === "a" ? md.momentumB : md.momentumA;
  const callWorthAsking = !coachBreaks && !spent && oppMeter >= CAREER_MATCHDAY.timeoutTrigger;
  const atBreak = played > 0 && !over && watched >= played;
  useEffect(() => {
    if (!atBreak || callWorthAsking || askedRef.current === played) return;
    askedRef.current = played;
    playNext();
  }, [atBreak, callWorthAsking, played, playNext]);

  if (played === 0) {
    return (
      <PlanStep
        save={save}
        D={D}
        label={label}
        me={me}
        opp={opp}
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

  const labels: LiveLabels = {
    game: D.gameOf(Math.min(watched + 1, played), bestOf),
    overtime: C.event.overtime,
    final: D.final,
    goal: "",
    shots: "",
    saves: "",
    demos: "",
    assists: "",
    goals: "",
    player: "",
    clock: D.clock,
    goalLine: D.goalLine,
    noGoalsYet: D.noGoalsYet,
  };

  return (
    <Panel strong className="p-5" aria-label={label}>
      <div className="card-head">
        <h2 className="card-title">{ended ? (myWins > oppWins ? D.seriesWon : D.seriesLost) : label}</h2>
        <span className="display text-sm font-semibold tabular-nums text-sub">{D.series(myWins, oppWins)}</span>
      </div>
      {ended ? (
        <SeriesEnd save={save} D={D} series={series} roundKey={us.roundKey} boxSides={boxSides} side={side} myWins={myWins} oppWins={oppWins} onContinue={onContinue} />
      ) : watched < played ? (
        <LiveGame
          key={watched}
          save={save}
          D={D}
          labels={labels}
          series={series}
          gameIdx={watched}
          roundKey={us.roundKey}
          boxSides={boxSides}
          speed={speed}
          paused={paused}
          skip={skipIdx === watched}
          onEnd={() => setWatched((w) => w + 1)}
        />
      ) : callWorthAsking ? (
        <BreakCall
          D={D}
          after={played}
          oppName={opp.name}
          speed={speed}
          paused={paused}
          onTimeout={() => {
            timeout();
            playNext();
          }}
          onNext={() => playNext()}
          onCoach={() => {
            setCoachBreaks(true);
          }}
        />
      ) : (
        <div className="min-h-[18rem]" aria-busy />
      )}

      {!ended ? (
        <LiveControls
          D={D}
          paused={paused}
          speed={speed}
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

function LiveGame({
  save,
  D,
  labels,
  series,
  gameIdx,
  roundKey,
  boxSides,
  speed,
  paused,
  skip,
  onEnd,
}: {
  save: CareerSave;
  D: Desk;
  labels: LiveLabels;
  series: SeriesResult;
  gameIdx: number;
  roundKey: string;
  boxSides: { a?: TournamentTeam; b?: TournamentTeam };
  speed: number;
  paused: boolean;
  skip: boolean;
  onEnd: () => void;
}) {
  const B = useCareerCopy().boxScore;
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
  return (
    <LiveGameView
      timeline={timeline}
      sides={{
        a: { name: a?.name ?? "", players: a?.playerNames ?? [], own: series.teamAId === "user", mark: <OrgMark save={save} orgRef={series.teamAId} size="md" /> },
        b: { name: b?.name ?? "", players: b?.playerNames ?? [], own: series.teamBId === "user", mark: <OrgMark save={save} orgRef={series.teamBId} size="md" /> },
      }}
      finals={finals}
      labels={{ ...labels, goals: B.goals, assists: B.assists, shots: B.shots, saves: B.saves, demos: B.demos, player: B.player }}
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
  onPause,
  onSpeed,
  onSkipGame,
  onSkipSeries,
}: {
  D: Desk;
  paused: boolean;
  speed: number;
  onPause: () => void;
  onSpeed: (s: number) => void;
  onSkipGame?: () => void;
  onSkipSeries: () => void;
}) {
  return (
    <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line pt-4">
      <Button variant="secondary" size="sm" onClick={onPause} aria-pressed={paused}>
        {paused ? D.resume : D.pause}
      </Button>
      <div className="flex overflow-hidden rounded-[7px] border border-line" role="group" aria-label={D.speed}>
        {MATCH_LIVE.speeds.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={speed === s}
            onClick={() => onSpeed(s)}
            className={cx(
              "display min-h-11 min-w-11 px-3 text-xs font-semibold tabular-nums transition-colors sm:min-h-8",
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

/** The one call between games: it waits `breakMs`, then the coach takes it. */
function BreakCall({
  D,
  after,
  oppName,
  speed,
  paused,
  onTimeout,
  onNext,
  onCoach,
}: {
  D: Desk;
  after: number;
  oppName: string;
  speed: number;
  paused: boolean;
  onTimeout: () => void;
  onNext: () => void;
  onCoach: () => void;
}) {
  const total = MATCH_LIVE.breakMs;
  const [left, setLeft] = useState(total);
  const doneRef = useRef(false);
  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setLeft((l) => Math.max(0, l - 250 * speed)), 250);
    return () => clearInterval(id);
  }, [paused, speed]);
  useEffect(() => {
    if (left > 0 || doneRef.current) return;
    doneRef.current = true;
    onNext();
  }, [left, onNext]);
  const once = (fn: () => void) => () => {
    if (doneRef.current) return;
    doneRef.current = true;
    fn();
  };
  return (
    <div className="flex min-h-[18rem] flex-col justify-center" role="group" aria-labelledby="break-title">
      <p id="break-title" className="kicker">{D.breakTitle(after)}</p>
      <p className="mt-2 max-w-prose text-[15px] text-ink">{D.theirMomentum(oppName)}</p>
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Button variant="primary" onClick={once(onTimeout)}>
          {D.timeout}
        </Button>
        <Button variant="secondary" onClick={once(onNext)}>
          {D.nextGame(after + 1)}
        </Button>
        <span className="text-sm tabular-nums text-faint" aria-live="off">
          {D.nextIn(Math.ceil(left / 1000))}
        </span>
      </div>
      <button
        type="button"
        onClick={() => {
          onCoach();
          once(onNext)();
        }}
        className="mt-4 inline-flex min-h-11 items-center self-start text-sm text-sub underline-offset-4 hover:text-ink hover:underline"
      >
        {D.coachBreaks}
      </button>
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
      <p className={cx("display text-5xl font-bold leading-none tabular-nums", won ? "text-good" : "text-bad")}>
        {myWins}-{oppWins}
      </p>
      {line ? <p className="mt-3 max-w-prose text-[15px] leading-relaxed text-sub">{line}</p> : null}
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
                  <td className="py-2 pr-2">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="display truncate text-[15px] font-semibold text-ink">{names[i] ?? ""}</span>
                      {mvp ? <Badge tone="gold">{B.mvp}</Badge> : null}
                    </span>
                  </td>
                  <td className="py-2 text-right tabular-nums text-ink">{l.goals}</td>
                  <td className="py-2 text-right tabular-nums text-sub">{l.assists}</td>
                  <td className="py-2 text-right tabular-nums text-sub">{l.saves}</td>
                  <td className="hidden py-2 text-right tabular-nums text-sub sm:table-cell">{l.shots}</td>
                  <td className="display py-2 text-right font-semibold tabular-nums text-ink">{l.avgRating.toFixed(1)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : null}
      <Button data-continue variant="primary" className="mt-6 w-full sm:w-auto" onClick={onContinue}>
        {D.continue}
      </Button>
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

  const set = (patch: Partial<SeriesPlan> & { style?: PlayStyleId | null; mark?: number | null }) =>
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

      {/* The opponent: who, how strong, how they play. */}
      <div className="flex items-center gap-4">
        <OrgMark save={save} orgRef={opp.id} size="lg" className="shrink-0" />
        <div className="min-w-0">
          <p className="display text-2xl font-bold leading-tight text-ink">{opp.name}</p>
          <p className="mt-0.5 text-sm text-sub">{stakes}</p>
          {read ? <p className="text-sm text-sub">{read}</p> : null}
        </div>
      </div>

      <div className="mt-6 space-y-5">
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

      <div className="mt-7 flex flex-col gap-2 border-t border-line pt-5 sm:flex-row sm:items-center">
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
        selected ? "border-orange text-ink" : "border-line-strong text-sub hover:border-blue/60 hover:text-ink",
      )}
    >
      <span className="display text-[15px] font-semibold">{children}</span>
      {coach ? <span className="kicker">{tag}</span> : null}
    </button>
  );
}
