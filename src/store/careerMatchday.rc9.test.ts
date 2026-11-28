/**
 * rc9 MATCHDAY (R240, R241, R243): the series room plays the same series
 * whichever way the player goes through it. Watched game by game (the live
 * view's `playUserSeriesNextFlow`), skipped from the plan (`delegate`),
 * skipped mid-series, or left to the coach in quick mode: with the same
 * choices, the same games. And a game's timeline is the same while its
 * series is still being played as after it.
 */
import { afterEach, describe, expect, it } from "vitest";
import { FEATURES } from "@/config/balance";
import { qualifierDefsForWeek, regionalForQualifier } from "@/engine/career/calendar";
import { buildGameTimeline } from "@/engine/career/matchTimeline";
import { planReport } from "@/engine/career/matchdaySeries";
import type { CareerEventDef, CareerSave } from "@/engine/career/types";
import { isSeriesOver } from "@/engine/match";
import type { SeriesPlan, SeriesResult } from "@/engine/types";
import {
  createCareerSave,
  delegateUserSeriesFlow,
  matchdayLevelOf,
  pendingUserSeriesOf,
  playUserSeriesNextFlow,
  setMatchdayLevelFlow,
  setUserSeriesPlanFlow,
  simEventToEnd,
  startEvent,
  stepEventRound,
  userSeriesTeamsOf,
  userSeriesTimeoutFlow,
  type CreateCareerInput,
} from "./careerFlow";

const features = FEATURES as { matchdayStyles: boolean; matchdayDecisions: boolean };
const initial = { ...features };
afterEach(() => {
  features.matchdayStyles = initial.matchdayStyles;
  features.matchdayDecisions = initial.matchdayDecisions;
});

const INPUT: CreateCareerInput = {
  identity: {
    orgName: "Room Test",
    abbrev: "RMT",
    managerName: "Bot",
    country: "BR",
    region: "EU",
    crestId: "shield",
    colors: { primary: "#f97316", secondary: "#fde68a" },
    buffType: "consistency",
  },
  difficulty: "normal",
  rosterKey: "balanced",
};

function onDay(save: CareerSave, def: CareerEventDef): CareerSave {
  const next = structuredClone(save);
  next.clock.day = def.day;
  next.pendingEventDef = def;
  next.unofficialOffer = null;
  next.pendingInsert = null;
  next.activeEvent = null;
  next.sponsorOffers = null;
  next.pendingOffers = [];
  next.pendingUnavailability = null;
  return next;
}

const base = createCareerSave(INPUT, 73_301);
const qualifier = qualifierDefsForWeek(0, 4).find((d) => d.region === "EU")!;
const regional = regionalForQualifier(qualifier)!;

function on() {
  features.matchdayStyles = true;
  features.matchdayDecisions = true;
}

/** Every series of the event, scorelines and game scores (the result, not the story). */
function digest(save: CareerSave): string {
  const t = save.activeEvent!.tournament;
  const rounds = [...t.swiss.rounds.map((r) => r.series), ...(t.playoffs?.rounds ?? []).map((r) => r.series)];
  return rounds
    .map((series) => series.map((x) => `${x.teamAId}-${x.teamBId}:${x.score.join("")}:${x.games.map((g) => g.score.join("")).join(".")}`).join(","))
    .join("|");
}

/** Steps the event to its end, answering every managed series with `answer`. */
function drive(save: CareerSave, answer: (s: CareerSave) => CareerSave): CareerSave {
  let s = save;
  for (let guard = 0; guard < 400 && s.activeEvent?.tournament.stage !== "finished"; guard++) {
    const pending = pendingUserSeriesOf(s);
    s = pending && !isSeriesOver(pending.state) ? answer(s) : stepEventRound(s);
  }
  return s;
}

/** The live view's path: the plan, then one game at a time. */
const watch = (plan?: (s: CareerSave) => SeriesPlan) => (s: CareerSave) => {
  let next = plan ? setUserSeriesPlanFlow(s, plan(s)) : s;
  while (!isSeriesOver(pendingUserSeriesOf(next)!.state)) next = playUserSeriesNextFlow(next);
  return next;
};
/** "Skip to the result" from the plan. */
const skip = (plan?: (s: CareerSave) => SeriesPlan) => (s: CareerSave) =>
  delegateUserSeriesFlow(plan ? setUserSeriesPlanFlow(s, plan(s)) : s);
/** One game watched, then "Skip series". */
const skipAfterOne = (plan?: (s: CareerSave) => SeriesPlan) => (s: CareerSave) =>
  delegateUserSeriesFlow(playUserSeriesNextFlow(plan ? setUserSeriesPlanFlow(s, plan(s)) : s));

/** A plan far from the coach's: all in, marking their playmaker. */
const bold = (s: CareerSave): SeriesPlan => {
  const us = pendingUserSeriesOf(s)!;
  const { teamA, teamB } = userSeriesTeamsOf(s)!;
  const opp = us.userSide === "a" ? teamB : teamA;
  return { kickoff: "aggressive", ...(opp.playmakerIndex !== undefined ? { mark: opp.playmakerIndex } : {}) };
};

describe("rc9 MATCHDAY: one series, whichever way it is played", () => {
  it("the coach's plan: watched, skipped, skipped after one game and quick mode play the same event", () => {
    on();
    const started = startEvent(onDay(base, regional), true);
    const quick = simEventToEnd(started);
    const managed = setMatchdayLevelFlow(started, "manage");
    expect(matchdayLevelOf(managed)).toBe("manage");
    const watched = drive(managed, watch());
    expect(watched.activeEvent!.tournament.stage).toBe("finished");
    expect(digest(watched)).toBe(digest(quick));
    expect(digest(drive(managed, skip()))).toBe(digest(quick));
    expect(digest(drive(managed, skipAfterOne()))).toBe(digest(quick));
    expect(watched.activeEvent!.rngState).toBe(quick.activeEvent!.rngState);
  });

  it("the player's own plan: watched, skipped and skipped after one game play the same event", () => {
    on();
    const managed = setMatchdayLevelFlow(startEvent(onDay(base, regional), true), "manage");
    const watched = digest(drive(managed, watch(bold)));
    expect(digest(drive(managed, skip(bold)))).toBe(watched);
    expect(digest(drive(managed, skipAfterOne(bold)))).toBe(watched);
  });

  it("a series reloaded between every game plays the same as one watched in one sitting", () => {
    on();
    const managed = setMatchdayLevelFlow(startEvent(onDay(base, regional), true), "manage");
    const reloadEach = (s: CareerSave) => {
      let next = JSON.parse(JSON.stringify(setUserSeriesPlanFlow(s, bold(s)))) as CareerSave;
      while (!isSeriesOver(pendingUserSeriesOf(next)!.state)) {
        next = JSON.parse(JSON.stringify(playUserSeriesNextFlow(next))) as CareerSave;
      }
      return next;
    };
    expect(digest(drive(managed, reloadEach))).toBe(digest(drive(managed, watch(bold))));
  });

  it("a timeout the player called (the room spends it at the next break) stands and is logged", () => {
    on();
    let s = stepEventRound(setMatchdayLevelFlow(startEvent(onDay(base, regional), true), "manage"));
    s = setUserSeriesPlanFlow(s, bold(s));
    s = playUserSeriesNextFlow(s);
    const us = pendingUserSeriesOf(s)!;
    const spentKey = us.userSide === "a" ? "timeoutA" : "timeoutB";
    const timed = userSeriesTimeoutFlow(s);
    expect(pendingUserSeriesOf(timed)!.state.matchday![spentKey]).toBe(true);
    const after = pendingUserSeriesOf(playUserSeriesNextFlow(timed))!.state;
    expect(after.games).toHaveLength(2);
    expect(after.matchday!.userLog?.[1].timeoutCut).toBeDefined();
  });

  it("the plan line's facts come from the engine's log, one entry per game", () => {
    on();
    let s = stepEventRound(setMatchdayLevelFlow(startEvent(onDay(base, regional), true), "manage"));
    s = watch(bold)(s);
    const state = pendingUserSeriesOf(s)!.state;
    const report = planReport(state)!;
    expect(report.games).toBe(state.games.length);
    expect(state.matchday!.userLog).toHaveLength(state.games.length);
    expect(report.edgeWins).toBeLessThanOrEqual(report.edgeGames.length);
  });
});

describe("rc9 MATCHDAY (R241): a game's timeline does not depend on the games after it", () => {
  it("game k of a finished series reads the same from the series cut after game k", () => {
    on();
    const done = simEventToEnd(startEvent(onDay(base, regional), true));
    const t = done.activeEvent!.tournament;
    const rounds = [...t.swiss.rounds.map((r, i) => ({ key: `sw:${i}`, series: r.series })), ...(t.playoffs?.rounds ?? []).map((r, i) => ({ key: `po:${i}`, series: r.series }))];
    let checked = 0;
    for (const round of rounds) {
      for (const series of round.series) {
        series.games.forEach((game, k) => {
          const cut: SeriesResult = { ...series, games: series.games.slice(0, k + 1) };
          expect(buildGameTimeline(cut, game, round.key)).toEqual(buildGameTimeline(series, game, round.key));
          checked += 1;
        });
      }
    }
    expect(checked).toBeGreaterThan(20);
  });
});
