/**
 * v2.1 Matchday slice 3 (docs/MATCHDAY-SPEC.md §6, §9): the user's series on
 * its own seed, the quick and custom modes, the breaks, a reload mid-series
 * and an event already in progress when the update lands.
 */
import { afterEach, describe, expect, it } from "vitest";
import { FEATURES } from "@/config/balance";
import { qualifierDefsForWeek, regionalForQualifier } from "@/engine/career/calendar";
import type { CareerEventDef, CareerSave } from "@/engine/career/types";
import { isSeriesOver } from "@/engine/match";
import {
  createCareerSave,
  delegateUserSeriesFlow,
  pendingUserSeriesOf,
  playUserSeriesGameFlow,
  setMatchdayModeFlow,
  setUserSeriesPlanFlow,
  simEventToEnd,
  startEvent,
  stepEventRound,
  userSeriesAdjustFlow,
  userSeriesSubFlow,
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
    orgName: "Matchday Test",
    abbrev: "MDT",
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

function flags(styles: boolean, decisions: boolean) {
  features.matchdayStyles = styles;
  features.matchdayDecisions = decisions;
}

/** Steps the event to its end the way the UI does, answering every custom stop with `answer`. */
function driveToEnd(save: CareerSave, answer: (s: CareerSave) => CareerSave, reload = false): { save: CareerSave; stops: number } {
  let s = save;
  let stops = 0;
  for (let guard = 0; guard < 200 && s.activeEvent?.tournament.stage !== "finished"; guard++) {
    const pending = pendingUserSeriesOf(s);
    if (pending && !isSeriesOver(pending.state)) {
      if (pending.state.games.length === 0) stops += 1;
      s = answer(s);
    } else {
      s = stepEventRound(s);
    }
    if (reload) s = JSON.parse(JSON.stringify(s)) as CareerSave;
  }
  return { save: s, stops };
}

function digest(save: CareerSave): string {
  const t = save.activeEvent!.tournament;
  const rounds = [...t.swiss.rounds.map((r) => r.series), ...(t.playoffs?.rounds ?? []).map((r) => r.series)];
  return rounds.map((series) => series.map((x) => `${x.teamAId}-${x.teamBId}:${x.score.join("")}`).join(",")).join("|");
}

describe("matchday slice 3 — flag off and old events", () => {
  it("flag off: no matchday mark, no user series, the same event as before", () => {
    flags(false, false);
    const off = simEventToEnd(startEvent(onDay(base, regional), false));
    expect(off.activeEvent!.matchday).toBeUndefined();
    expect(off.activeEvent!.userSeries).toBeUndefined();
    flags(true, false);
    // matchdayStyles on, decisions off: slice 2's behaviour, still no slice-3 fields.
    const styled = simEventToEnd(startEvent(onDay(base, regional), false));
    expect(styled.activeEvent!.matchday).toBeUndefined();
    expect(Object.values(styled.activeEvent!.tournament.teams).some((t) => t.matchday)).toBe(false);
  });

  it("an event started before the update finishes on the old engine", () => {
    flags(false, false);
    const started = startEvent(onDay(base, regional), false);
    const oldWay = simEventToEnd(started);
    flags(true, true);
    const afterUpdate = simEventToEnd(started);
    expect(digest(afterUpdate)).toBe(digest(oldWay));
    expect(afterUpdate.activeEvent!.rngState).toBe(oldWay.activeEvent!.rngState);
  });
});

describe("matchday slice 3 — quick mode", () => {
  it("never stops, finishes, and is deterministic", () => {
    flags(true, true);
    const started = startEvent(onDay(base, regional), false);
    expect(started.activeEvent!.matchday).toBe(1);
    const a = driveToEnd(started, () => {
      throw new Error("quick mode stopped");
    });
    const b = simEventToEnd(started);
    expect(a.stops).toBe(0);
    expect(a.save.activeEvent!.tournament.stage).toBe("finished");
    expect(digest(a.save)).toBe(digest(b));
    expect(pendingUserSeriesOf(b)).toBeNull();
  });

  it("the user's series sits on its own seed: the AI series match the flag-on round order", () => {
    flags(true, true);
    const started = startEvent(onDay(base, regional), false);
    const quick = simEventToEnd(started);
    const custom = driveToEnd(setMatchdayModeFlow(started, "custom", "every"), (s) => {
      // A very different plan: aggressive, off-style, and an early timeout.
      let next = setUserSeriesPlanFlow(s, { kickoff: "aggressive", mark: 2 });
      next = playUserSeriesGameFlow(next);
      return userSeriesTimeoutFlow(next);
    });
    // First round: every AI-vs-AI series is the same whatever the user does.
    const r1q = quick.activeEvent!.tournament.swiss.rounds[0].series.filter((s) => s.teamAId !== "user" && s.teamBId !== "user");
    const r1c = custom.save.activeEvent!.tournament.swiss.rounds[0].series.filter((s) => s.teamAId !== "user" && s.teamBId !== "user");
    expect(r1c).toEqual(r1q);
  });
});

describe("matchday slice 3 — custom mode", () => {
  it("stops at every series, plays game by game, and a reload mid-series changes nothing", () => {
    flags(true, true);
    const started = setMatchdayModeFlow(startEvent(onDay(base, regional), true), "custom", "every");
    const answer = (s: CareerSave) => playUserSeriesGameFlow(s);
    const plain = driveToEnd(started, answer);
    const reloaded = driveToEnd(started, answer, true);
    expect(plain.stops).toBeGreaterThan(0);
    expect(plain.save.activeEvent!.tournament.stage).toBe("finished");
    expect(digest(reloaded.save)).toBe(digest(plain.save));
    expect(reloaded.save.activeEvent!.rngState).toBe(plain.save.activeEvent!.rngState);
  });

  it("the default stop skips Swiss series and stops in the playoffs only", () => {
    flags(true, true);
    const started = setMatchdayModeFlow(startEvent(onDay(base, regional), true), "custom");
    const stages: string[] = [];
    driveToEnd(started, (s) => {
      stages.push(s.activeEvent!.tournament.stage);
      return delegateUserSeriesFlow(s);
    });
    expect(stages.every((st) => st === "playoffs")).toBe(true);
  });

  it("the breaks: one timeout, an adjustment, one sub, then the coach plays it out", () => {
    flags(true, true);
    let s = setMatchdayModeFlow(startEvent(onDay(base, regional), true), "custom", "every");
    s = stepEventRound(s);
    const opened = pendingUserSeriesOf(s)!;
    expect(opened.state.games).toHaveLength(0);
    // No break before game 1; the plan is set there.
    expect(userSeriesTimeoutFlow(s)).toBe(s);
    s = setUserSeriesPlanFlow(s, { kickoff: "safe" });
    expect(pendingUserSeriesOf(s)!.state.matchday![opened.userSide === "a" ? "planA" : "planB"].kickoff).toBe("safe");
    s = playUserSeriesGameFlow(s);
    expect(pendingUserSeriesOf(s)!.state.games).toHaveLength(1);
    // The plan is locked after game 1; the break's adjustment works.
    expect(setUserSeriesPlanFlow(s, { kickoff: "aggressive" })).toBe(s);
    s = userSeriesAdjustFlow(s, { kickoff: "aggressive" });
    const side = opened.userSide === "a" ? "planA" : "planB";
    expect(pendingUserSeriesOf(s)!.state.matchday![side].kickoff).toBe("aggressive");
    const timed = userSeriesTimeoutFlow(s);
    expect(pendingUserSeriesOf(timed)!.state.matchday![opened.userSide === "a" ? "timeoutA" : "timeoutB"]).toBe(true);
    expect(userSeriesTimeoutFlow(timed)).toBe(timed);
    s = timed;
    // The sub, when the squad has a reserve.
    const onCourt = s.activeEvent!.fieldedIds ?? s.starterIds;
    const reserve = s.squad.find((p) => !onCourt.includes(p.id));
    if (reserve) {
      const subbed = userSeriesSubFlow(s, onCourt[0], reserve.id);
      const us = pendingUserSeriesOf(subbed)!;
      expect(us.sub).toEqual({ outId: onCourt[0], inId: reserve.id });
      expect(userSeriesTeamsOf(subbed)![us.userSide === "a" ? "teamA" : "teamB"].playerNames).toContain(reserve.name);
      expect(userSeriesSubFlow(subbed, onCourt[1], reserve.id)).toBe(subbed);
      s = subbed;
    }
    s = delegateUserSeriesFlow(s);
    expect(isSeriesOver(pendingUserSeriesOf(s)!.state)).toBe(true);
    s = stepEventRound(s);
    expect(s.activeEvent!.tournament.swiss.rounds).toHaveLength(1);
    expect(pendingUserSeriesOf(s)).toBeNull();
  });

  it("delegating every stop equals quick mode (same seed, same coach)", () => {
    flags(true, true);
    const started = startEvent(onDay(base, regional), true);
    const quick = simEventToEnd(started);
    const delegated = driveToEnd(setMatchdayModeFlow(started, "custom", "every"), delegateUserSeriesFlow);
    expect(digest(delegated.save)).toBe(digest(quick));
  });

  it("slice 5: an instant result never stops, even in custom mode", () => {
    flags(true, true);
    const instant = setMatchdayModeFlow(startEvent(onDay(base, regional), false), "custom", "every");
    const done = simEventToEnd(instant);
    expect(pendingUserSeriesOf(done)).toBeNull();
    expect(done.activeEvent!.tournament.stage).not.toBe("swiss");
  });

  it("slice 5: back to quick mid-series, the coach plays it out and the games played stand", () => {
    flags(true, true);
    let s = setMatchdayModeFlow(startEvent(onDay(base, regional), true), "custom", "every");
    s = playUserSeriesGameFlow(stepEventRound(s));
    const first = pendingUserSeriesOf(s)!.state.games[0];
    s = setMatchdayModeFlow(s, "quick");
    const us = pendingUserSeriesOf(s)!;
    expect(isSeriesOver(us.state)).toBe(true);
    expect(us.state.games[0]).toEqual(first);
    s = stepEventRound(s);
    expect(pendingUserSeriesOf(s)).toBeNull();
  });
});
