/**
 * Road to Worlds rc.36 (SUN-01..03, R88) — Saturday → HQ → Sunday through the
 * REAL flow: the Saturday-evening stop holds every clock mover until Sunday
 * is started (once, exactly one day, no training / payroll / replay / double
 * prize, a reload keeps it), the coach briefing's edge lands on Sunday's
 * series only and "keep" plays rc.35's Sunday, a spectator's watch / results
 * / skip, and the event the user is out of kept compact for /career/follow.
 * Results are forced by roster strength (99 vs 40), never by a lucky seed.
 */

import { describe, expect, it } from "vitest";
import { CAREER_CALENDAR, CAREER_SUNDAY } from "@/config/balance";
import {
  eventDayFor,
  firstDayOfWeek,
  playoffsDayFor,
  qualifierDayFor,
  regionalDayFor,
  seasonSchedule,
} from "@/engine/career/calendar";
import { followRoundsOf, followSwissTable, followWinnerOf } from "@/engine/career/follow";
import { briefingEdgeFor, repairWeekendState, sundayEdgeFor } from "@/engine/career/sunday";
import type { CareerEventDef, CareerSave } from "@/engine/career/types";
import type { SeriesResult, TournamentState } from "@/engine/types";
import {
  advanceDayFlow,
  advanceToNextStopFlow,
  createCareerSave,
  eventDayPhaseOf,
  finishEvent,
  isChampionshipSunday,
  isEventPaused,
  migrateSaveToV5,
  simEventToEnd,
  startEvent,
  sundayIntroFlagFor,
  type CreateCareerInput,
} from "./careerFlow";
import { stepDayForTests, walkPastForTests } from "./careerClockForTests";
import { clockHoldOf, pendingDecisionsOf } from "./careerDecisions";
import {
  dismissFollowFlow,
  followCardOf,
  followSundayFlow,
  openFollowFlow,
  recordSundayBriefingFlow,
  startSundayFlow,
  sundayAheadOf,
  sundayWithoutYouOf,
} from "./careerSunday";
import { continueKind } from "@/components/career/careerUi";

const INPUT: CreateCareerInput = {
  identity: {
    orgName: "Test Org",
    abbrev: "TST",
    managerName: "Bot",
    country: "BR",
    region: "SAM",
    crestId: "shield",
    colors: { primary: "#f97316", secondary: "#fde68a" },
    buffType: "consistency",
  },
  difficulty: "normal",
  style: "balanced",
  rosterKey: "balanced",
};
/** A starter roster outside the direct 8 at the first regional (careerWeekend.test). */
const SEED = 55501;
const W = seasonSchedule().find((w) => w.kind === "regional")!.week;
const MAJOR_W = seasonSchedule().find((w) => w.kind === "major")!.week;

function freshCareer(): CareerSave {
  const save = createCareerSave(INPUT, SEED);
  for (let s = 0; s < 2; s++) {
    for (let w = 1; w <= CAREER_CALENDAR.weeksPerSeason; w++) save.flags[`insertRolled:${s}:${w}`] = true;
  }
  save.sponsorOffers = null;
  return save;
}

function advanceTo(input: CareerSave, day: number): CareerSave {
  let save = input;
  let guard = 0;
  while (save.clock.day < day && save.phase === "running" && guard++ < 400) {
    const before = save.clock.day;
    save = stepDayForTests(save);
    if (save.clock.day === before) break;
  }
  return save;
}

function withStrength(input: CareerSave, overall: number): CareerSave {
  const save = structuredClone(input);
  for (const p of save.squad) p.overall = overall;
  return save;
}

/** Today's lobby, instant sim; finishes unless the event pauses. */
function simToday(input: CareerSave): CareerSave {
  const save = simEventToEnd(startEvent(input, false));
  return save.activeEvent?.tournament.stage === "finished" ? finishEvent(save) : save;
}

/** Auto-plays (instant) up to `day`, every Sunday started with the default briefing. */
function autoPlayTo(input: CareerSave, day: number): CareerSave {
  let save = input;
  let guard = 0;
  while (save.clock.day < day && save.phase === "running" && guard++ < 900) {
    const phase = eventDayPhaseOf(save);
    if (phase === "lobby") {
      save = simToday(save);
      continue;
    }
    if (phase === "swiss" || phase === "playoffs" || phase === "finished") {
      save = simEventToEnd(save);
      if (save.activeEvent?.tournament.stage === "finished") save = finishEvent(save);
      continue;
    }
    const before = save.clock.day;
    save = stepDayForTests(save);
    if (save.clock.day === before) throw new Error(`clock blocked on day ${before}`);
  }
  return save;
}

/** Saturday evening after a qualifier the user won (Sunday's regional tomorrow). */
function regionalSaturdayEvening(): CareerSave {
  const sat = advanceTo(freshCareer(), qualifierDayFor(W));
  const played = simToday(withStrength(sat, 99));
  expect(played.pendingEventDef).toMatchObject({ tier: "regional", day: regionalDayFor(W) });
  return played;
}

/** The first Major paused after its Saturday Swiss (the user in the field, at `strength`). */
function pausedMajor(strength: number): CareerSave {
  let save = autoPlayTo(freshCareer(), firstDayOfWeek(MAJOR_W) - 1);
  save.competition.splitPoints.SAM = { ...save.competition.splitPoints.SAM, user: 100_000 };
  save = advanceTo(advanceDayFlow(save), eventDayFor(MAJOR_W));
  expect(save.pendingEventDef).toMatchObject({ tier: "major" });
  const paused = simEventToEnd(startEvent(withStrength(save, strength), false));
  expect(isEventPaused(paused)).toBe(true);
  return paused;
}

const reload = (save: CareerSave): CareerSave => migrateSaveToV5(JSON.parse(JSON.stringify(save)))!;

function counters(save: CareerSave) {
  return {
    payroll: save.finances.ledger.filter((l) => l.kind === "payroll").length,
    prizes: save.finances.ledger.filter((l) => l.kind === "prize").length,
    balance: save.finances.balance,
    squad: save.squad.map((p) => [p.id, p.overall, p.gainedThisSeason]),
    qualifiers: save.eventResults.filter((r) => r.tier === "qualifier").length,
    rep: save.reputation,
  };
}

function userSeriesOf(t: TournamentState, stage: "swiss" | "playoffs"): SeriesResult[] {
  const rounds = stage === "swiss" ? t.swiss.rounds : (t.playoffs?.rounds ?? []);
  return rounds.flatMap((r) => r.series.filter((s) => s.teamAId === "user" || s.teamBId === "user"));
}

/** The user's side of a series' recorded rating difference (positive = the user rated higher). */
const userDiff = (s: SeriesResult): number => (s.teamAId === "user" ? s.ratingDiff : -s.ratingDiff);

/**
 * The edge a series carried: the recorded difference is rounded to 0.1 (match.ts), so the
 * delta reads within 0.1 of it. `samePairing` false (a later round paired differently) skips.
 */
function expectEdge(delta: number, edge: number, samePairing = true): void {
  if (!samePairing) return;
  expect(Math.abs(delta - edge)).toBeLessThanOrEqual(0.1 + 1e-9);
}

describe("SUN-01 — Saturday's qualifier won: HQ holds Saturday evening until Sunday is started", () => {
  it("every clock mover holds (a reload too); Start Sunday is exactly one day, once, with nothing on the way", () => {
    const eve = regionalSaturdayEvening();
    const ahead = sundayAheadOf(eve)!;
    expect(ahead).toMatchObject({ kind: "regional", playing: true, briefing: null, sundayDay: regionalDayFor(W) });
    expect(eve.weekend).toEqual({ eventId: ahead.def.id, briefing: null });
    expect(clockHoldOf(eve)?.kind).toBe("sunday");
    expect(continueKind(eve)).toBe("sunday"); // the autoplay stops; the top bar routes to HQ
    expect(advanceDayFlow(eve)).toBe(eve);
    expect(advanceToNextStopFlow(eve)).toBe(eve);
    const reloaded = reload(eve);
    expect(clockHoldOf(reloaded)?.kind).toBe("sunday");
    expect(advanceDayFlow(reloaded)).toBe(reloaded);

    const before = counters(reloaded);
    const res = startSundayFlow(reloaded, "prepare");
    expect(res.error).toBeUndefined();
    const sun = res.save;
    expect(sun.clock.day).toBe(regionalDayFor(W));
    expect(sun.weekend).toEqual({ eventId: ahead.def.id, briefing: "prepare" });
    expect(eventDayPhaseOf(sun)).toBe("lobby");
    // No training day, payroll, replayed qualifier or second prize on the way.
    expect(counters(sun)).toEqual(before);
    // Answered once: on Sunday there is no stop left to start.
    expect(sundayAheadOf(sun)).toBeNull();
    expect(startSundayFlow(sun, "keep").error).toBe("none");
    expect(pendingDecisionsOf(sun).some((d) => d.kind === "sunday")).toBe(false);
  });

  it("another decision holding the clock is answered first; a direct seed never gets the stop", () => {
    const eve = regionalSaturdayEvening();
    const insert = { ...eve, pendingInsert: { id: "x", day: eve.clock.day } };
    expect(startSundayFlow(insert).error).toBe("decisionPending");
    // A direct user plays no Saturday: no weekend record, no stop.
    let direct = advanceTo(freshCareer(), firstDayOfWeek(W) - 1);
    direct.competition.splitPoints.SAM = { ...direct.competition.splitPoints.SAM, user: 10_000 };
    direct = advanceTo(advanceDayFlow(direct), qualifierDayFor(W));
    expect(direct.pendingEventDef).toMatchObject({ tier: "regional" });
    expect(sundayAheadOf(direct)).toBeNull();
    expect(advanceDayFlow(direct).clock.day).toBe(regionalDayFor(W));
  });

  it("an rc.35 save on that Saturday evening (no weekend record) keeps playing as it did", () => {
    const eve = regionalSaturdayEvening();
    const old = reload({ ...eve, weekend: undefined });
    expect(sundayAheadOf(old)).toBeNull();
    expect(advanceDayFlow(old).clock.day).toBe(regionalDayFor(W));
  });

  it("the briefing's edge: Prepare on the opening series only, Recover on every Sunday series; Keep is rc.35's Sunday", () => {
    const eve = regionalSaturdayEvening();
    const play = (choice: "keep" | "recover" | "prepare") => {
      const sun = startSundayFlow(eve, choice).save;
      const fin = simEventToEnd(startEvent(withStrength(sun, 80), false));
      return fin.activeEvent!.tournament;
    };
    const keep = play("keep");
    const prepare = play("prepare");
    const recover = play("recover");
    const opener = (t: TournamentState) => userSeriesOf(t, "swiss")[0];
    expectEdge(userDiff(opener(prepare)) - userDiff(opener(keep)), CAREER_SUNDAY.briefing.prepare.opener);
    expectEdge(userDiff(opener(recover)) - userDiff(opener(keep)), CAREER_SUNDAY.briefing.recover.everySeries);
    // Prepare's edge is gone after the opener; Recover's stays on every series.
    const second = (t: TournamentState) => userSeriesOf(t, "swiss")[1];
    expectEdge(userDiff(second(recover)) - userDiff(second(keep)), CAREER_SUNDAY.briefing.recover.everySeries, second(recover).teamAId === second(keep).teamAId && second(recover).teamBId === second(keep).teamBId);
    // The frozen team is untouched: the edge is per round, never stored on the team.
    expect(prepare.teams.user.rating.total).toBe(keep.teams.user.rating.total);
    // Keep plays exactly the Sunday without a briefing.
    const plain = simEventToEnd(startEvent(withStrength(advanceDayFlow(recordSundayBriefingFlow(eve).save), 80), false));
    expect(plain.activeEvent!.tournament).toEqual(keep);
  });

  it("the edge rules (pure): Sunday only, the briefed event only, the opener while no Sunday series was played", () => {
    const eve = regionalSaturdayEvening();
    const def = eve.pendingEventDef!;
    const sun = startSundayFlow(eve, "prepare").save;
    const t = startEvent(sun, false).activeEvent!.tournament;
    expect(sundayEdgeFor(sun.weekend, def, def.day, t)).toBe(CAREER_SUNDAY.briefing.prepare.opener);
    expect(sundayEdgeFor(sun.weekend, def, def.day - 1, t)).toBe(0); // Saturday
    expect(sundayEdgeFor(sun.weekend, { ...def, id: "other" }, def.day, t)).toBe(0);
    expect(sundayEdgeFor({ eventId: def.id, briefing: "keep" }, def, def.day, t)).toBe(0);
    const played = simEventToEnd(startEvent(sun, false)).activeEvent!.tournament;
    expect(briefingEdgeFor("prepare", def, played)).toBe(0);
    expect(briefingEdgeFor("recover", def, played)).toBe(CAREER_SUNDAY.briefing.recover.everySeries);
    // The load repair: a bad record reads as none, never throws.
    const bad: { weekend?: unknown } = { weekend: { eventId: 7 } };
    repairWeekendState(bad);
    expect(bad.weekend).toBeNull();
    const odd: { weekend?: unknown } = { weekend: { eventId: "e", briefing: "nap", follow: "maybe" } };
    repairWeekendState(odd);
    expect(odd.weekend).toEqual({ eventId: "e", briefing: null });
  });
});

describe("SUN-01 — a Major paused after its Swiss: Championship Sunday is started from HQ", { timeout: 60_000 }, () => {
  it("the pause is the stop; Recover lands on every playoff series of the user, the result is banked once", () => {
    const paused = pausedMajor(85);
    const def = paused.activeEvent!.def;
    expect(sundayAheadOf(paused)).toMatchObject({ kind: "championship", briefing: null, sundayDay: playoffsDayFor(def) });
    expect(clockHoldOf(paused)?.kind).toBe("sunday");
    expect(advanceDayFlow(reload(paused)).clock.day).toBe(paused.clock.day);
    const keepSun = startSundayFlow(paused, "keep").save;
    const recSun = startSundayFlow(paused, "recover").save;
    expect(isChampionshipSunday(recSun)).toBe(true);
    expect(recSun.flags[sundayIntroFlagFor(def.id)]).toBeUndefined(); // the intro still plays
    const keepT = simEventToEnd(keepSun).activeEvent!.tournament;
    const recFin = simEventToEnd(recSun);
    const recT = recFin.activeEvent!.tournament;
    // Saturday's Swiss is the same; the briefing touches Sunday only.
    expect(recT.swiss).toEqual(keepT.swiss);
    const first = (t: TournamentState) => userSeriesOf(t, "playoffs")[0];
    if (first(keepT) && first(recT)) {
      expectEdge(userDiff(first(recT)) - userDiff(first(keepT)), CAREER_SUNDAY.briefing.recover.everySeries);
    }
    const done = finishEvent(recFin);
    expect(done.eventResults.filter((r) => r.eventId === def.id)).toHaveLength(1);
    expect(finishEvent(done).eventResults.filter((r) => r.eventId === def.id)).toHaveLength(1);
  });

  it("out in the Swiss: watch, results or skip — the same banked result, no briefing", () => {
    const paused = pausedMajor(40);
    const ahead = sundayAheadOf(paused)!;
    expect(ahead.playing).toBe(false);
    const watch = startSundayFlow(paused, "prepare", "watch").save;
    expect(watch.weekend?.briefing).toBe(CAREER_SUNDAY.defaultBriefing); // a spectator plays no series
    expect(watch.activeEvent!.watched).toBe(true);
    expect(watch.activeEvent!.tournament.stage).not.toBe("finished");
    const results = startSundayFlow(paused, null, "results").save;
    expect(results.activeEvent!.tournament.stage).toBe("finished");
    expect(results.flags[sundayIntroFlagFor(ahead.def.id)]).toBe(true);
    const skip = startSundayFlow(paused, null, "skip").save;
    expect(skip.activeEvent).toBeNull();
    expect(skip.clock.day).toBe(ahead.sundayDay);
    const banked = finishEvent(results).eventResults.find((r) => r.eventId === ahead.def.id);
    expect(skip.eventResults.find((r) => r.eventId === ahead.def.id)).toEqual(banked);
  });
});

describe("SUN-03 — an event the user is out of", { timeout: 60_000 }, () => {
  function outAtQualifier(): CareerSave {
    const sat = advanceTo(freshCareer(), qualifierDayFor(W));
    const out = simToday(withStrength(sat, 40));
    expect(out.pendingEventDef).toBeNull();
    return out;
  }

  it("the eliminated Saturday offers Sunday without the user — it never holds the clock", () => {
    const out = outAtQualifier();
    const offer = sundayWithoutYouOf(out)!;
    expect(offer.def).toMatchObject({ tier: "regional", region: "SAM", day: regionalDayFor(W) });
    expect(offer.qualifiedIds).toHaveLength(8);
    expect(offer.qualifiedIds).not.toContain("user");
    expect(pendingDecisionsOf(out).find((d) => d.kind === "follow")).toMatchObject({ holds: false });
    expect(clockHoldOf(out)).toBeNull();
    // Walked past: Sunday's regional resolves headlessly and is kept compact.
    const sun = advanceDayFlow(walkPastForTests(out));
    expect(sun.clock.day).toBe(regionalDayFor(W));
    const f = sun.followEvent!;
    expect(f).toMatchObject({ reason: "eliminated", view: null, dismissed: false });
    expect(f.def.id).toBe(offer.def.id);
    expect(f.teams).toHaveLength(16);
    expect(f.qualifiedIds).toEqual(offer.qualifiedIds);
    const result = sun.eventResults.find((r) => r.eventId === f.def.id)!;
    expect(f.champion).toBe(result.championRef);
    // The compact rounds replay the real event: the Swiss table's top eight are its playoff eight.
    const rounds = followRoundsOf(f);
    expect(rounds.length).toBe(f.swiss.length + f.playoffs.length);
    const table = followSwissTable(f, f.swiss.length).slice(0, 8).map((r) => r.id).sort();
    expect([...f.seeds].sort()).toEqual(table);
    const final = f.playoffs[f.playoffs.length - 1].series[0];
    expect(followWinnerOf(final)).toBe(f.champion);
    // HQ offers it for followCardDays days, until opened or hidden.
    expect(followCardOf(sun)?.def.id).toBe(f.def.id);
    expect(followCardOf(openFollowFlow(sun, "results").save)).toBeNull();
    expect(followCardOf(dismissFollowFlow(sun).save)).toBeNull();
    let later = sun;
    for (let i = 0; i < CAREER_SUNDAY.followCardDays; i++) later = stepDayForTests(later);
    expect(followCardOf(later)).toBeNull();
    // A reload keeps it readable.
    expect(reload(sun).followEvent).toEqual(f);
  });

  it("Watch / Results move to Sunday and open it that way; Skip only hides it", () => {
    const out = outAtQualifier();
    const watched = followSundayFlow(out, "watch").save;
    expect(watched.clock.day).toBe(regionalDayFor(W));
    expect(watched.followEvent?.view).toBe("watch");
    expect(followSundayFlow(out, "results").save.followEvent?.view).toBe("results");
    const skipped = followSundayFlow(out, "skip").save;
    expect(skipped.clock.day).toBe(out.clock.day);
    expect(sundayWithoutYouOf(skipped)).toBeNull();
    const sun = advanceDayFlow(walkPastForTests(skipped));
    expect(sun.followEvent?.dismissed).toBe(true);
    expect(followCardOf(sun)).toBeNull();
  });

  it("a Major the user is not in is kept compact on its Sunday", () => {
    let save = autoPlayTo(freshCareer(), firstDayOfWeek(MAJOR_W) - 1);
    delete save.competition.splitPoints.SAM.user;
    save = advanceTo(advanceDayFlow(save), eventDayFor(MAJOR_W) + 1);
    const f = save.followEvent!;
    expect(f.def).toMatchObject({ tier: "major" } satisfies Partial<CareerEventDef>);
    expect(f.reason).toBe("notQualified");
    expect(f.teams.some((t) => t.id === "user")).toBe(false);
    expect(f.seeds).toHaveLength(8);
    expect(followCardOf(save)?.def.id).toBe(f.def.id);
  });

  it("an unreadable follow record is dropped on load", () => {
    const out = outAtQualifier();
    const broken = reload({ ...out, followEvent: { def: null } as never });
    expect(broken.followEvent).toBeNull();
  });
});
