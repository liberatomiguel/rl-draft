/**
 * Road to Worlds — RTW-05 (rc.33, Miguel 30/10): "no event with fewer than
 * three players (no stand-in for a missing player); the team rating always
 * counts three seats, an empty one as 0."
 *
 *  - every team-rating read counts three seats: an empty one rates 0 (HQ,
 *    the seeding, the best trio, the save slot's stars);
 *  - the clock never enters the user's matchday with a squad under three —
 *    Advance, the batched Advance, the autoplay (continueKind) and a reload
 *    all hold; the event cannot start on its day; a free agent can take the
 *    empty seat any day (window or not, broke or not), then the clock moves;
 *  - the pre-event unavailability roll never takes a lineup below three: a
 *    reserve covers, and with no reserve nobody is ruled out.
 */

import { describe, expect, it } from "vitest";
import { firstDayOfWeek, isWindowWeek, officialEventDefsForWeek, qualifierDefsForWeek, weekOfDay } from "@/engine/career/calendar";
import type { CareerEventDef, CareerSave, SquadPlayer } from "@/engine/career/types";
import { userTeamFor } from "@/engine/career/worldSim";
import { continueKind } from "@/components/career/careerUi";
import {
  advanceDayFlow,
  advanceToNextStopFlow,
  backerLineOf,
  createCareerSave,
  migrateSaveToV5,
  releasePlayerFlow,
  ruledOutFor,
  signPlayerFlow,
  signingPlanFor,
  squadHoldFor,
  squadIsShort,
  startEvent,
  userSeedRatingFor,
  userTeamForEvent,
  type CreateCareerInput,
} from "./careerFlow";
import { slotMetaFor } from "./careerStore";

const INPUT: CreateCareerInput = {
  identity: {
    orgName: "Seat Test",
    abbrev: "SEA",
    managerName: "Bot",
    country: "BR",
    region: "SAM",
    crestId: "shield",
    colors: { primary: "#f97316", secondary: "#fde68a" },
    buffType: "consistency",
  },
  difficulty: "normal",
  rosterKey: "balanced",
};

/** The save on `day` with `def` committed as the user's event (nothing else pending). */
function onDay(save: CareerSave, day: number, def: CareerEventDef): CareerSave {
  const next = structuredClone(save);
  next.clock.day = day;
  next.pendingEventDef = def;
  next.unofficialOffer = null;
  next.pendingInsert = null;
  next.activeEvent = null;
  next.sponsorOffers = null;
  next.pendingOffers = [];
  next.pendingUnavailability = null;
  return next;
}

/** Drop one squad player straight off the roster (no window or money rules). */
function withoutOne(save: CareerSave): CareerSave {
  const next = structuredClone(save);
  const gone = next.squad[next.squad.length - 1];
  next.squad = next.squad.filter((p) => p.id !== gone.id);
  next.starterIds = next.starterIds.map((id) => (id === gone.id ? "" : id)) as [string, string, string];
  return next;
}

function teamOf(save: CareerSave) {
  return userTeamFor({
    identity: save.identity,
    squad: save.squad,
    starterIds: save.starterIds,
    coach: save.coach,
    gear: save.finances.gear,
    bootcampSharp: 0,
    seasonIndex: save.clock.seasonIndex,
    careerSeed: save.careerSeed,
    difficulty: save.difficulty,
  });
}

/** A free agent the market would let this save sign today (the cheapest first). */
function freeAgentFor(save: CareerSave): string {
  for (const id of save.world.freeAgentIds) {
    const plan = signingPlanFor(save, id, { lengthSeasons: 1 });
    if ("plan" in plan) return id;
  }
  throw new Error("no signable free agent");
}

const qualifierW4 = qualifierDefsForWeek(0, 4).find((d) => d.region === "SAM")!;
const regionalW4 = officialEventDefsForWeek(0, 4).find((d) => d.tier === "regional" && d.region === "SAM")!;

describe("RTW-05 — the team rating always counts three seats", () => {
  it("an empty seat rates 0: the plain average, the seeding rating and the slot's stars all drop", () => {
    const full = createCareerSave(INPUT, 50_501);
    const short = withoutOne(full);
    const fullTeam = teamOf(full);
    const shortTeam = teamOf(short);
    expect(fullTeam.emptySeats).toBe(0);
    expect(shortTeam.emptySeats).toBe(1);
    const overalls = short.squad.map((p) => p.overall);
    expect(shortTeam.team.rating.avgPlayerOverall).toBeCloseTo((overalls[0] + overalls[1] + 0) / 3, 1);
    expect(shortTeam.fieldedIds).toHaveLength(2);
    // No 60-OVR stand-in any more: far below what a stand-in would have made.
    expect(shortTeam.team.rating.total).toBeLessThan(fullTeam.team.rating.total - 15);
    expect(userSeedRatingFor(short)).toBeLessThan(userSeedRatingFor(full) - 15);
    // The saves list's stars read the same three seats (a starter org may sit at the floor either way).
    const stars = slotMetaFor([full, short]);
    expect(stars[1]!.stars).toBeLessThanOrEqual(stars[0]!.stars);
  });

  it("a squad of one counts two empty seats", () => {
    let save = withoutOne(withoutOne(createCareerSave(INPUT, 50_502)));
    expect(save.squad).toHaveLength(1);
    save = structuredClone(save);
    expect(teamOf(save).emptySeats).toBe(2);
    expect(squadIsShort(save)).toBe(true);
  });
});

describe("RTW-05 — no event with fewer than three players", () => {
  it("the clock holds on the eve of the matchday: Advance, the batched Advance, the autoplay and a reload", () => {
    const base = createCareerSave(INPUT, 50_503);
    const eve = withoutOne(onDay(base, qualifierW4.day - 1, qualifierW4));
    expect(squadHoldFor(eve)?.id).toBe(qualifierW4.id);
    expect(advanceDayFlow(eve).clock.day).toBe(eve.clock.day);
    expect(advanceToNextStopFlow(eve).clock.day).toBe(eve.clock.day);
    expect(continueKind(eve)).toBe("decision");
    const reloaded = migrateSaveToV5(JSON.parse(JSON.stringify(eve)))!;
    expect(squadHoldFor(reloaded)?.id).toBe(qualifierW4.id);
    expect(advanceDayFlow(reloaded).clock.day).toBe(eve.clock.day);
    // A full squad on the same eve moves on to the matchday.
    const fullEve = onDay(base, qualifierW4.day - 1, qualifierW4);
    expect(squadHoldFor(fullEve)).toBeNull();
    expect(advanceDayFlow(fullEve).clock.day).toBe(qualifierW4.day);
  });

  it("on the matchday the event cannot start short; a free agent signs into the empty seat (no window), then it plays", () => {
    const day = withoutOne(onDay(createCareerSave(INPUT, 50_504), regionalW4.day, regionalW4));
    expect(isWindowWeek(weekOfDay(day.clock.day))).toBe(false);
    expect(startEvent(day, false).activeEvent).toBeNull();
    expect(continueKind(day)).toBe("decision");
    // Outside a window a contracted player still waits for the window.
    const contracted = Object.values(day.world.orgs).find((o) => o.region === "SAM")!.playerIds[0];
    expect(signingPlanFor(day, contracted, { lengthSeasons: 1 })).toEqual({ error: "windowClosed" });
    // A free agent into the empty seat: allowed today, and never refused for money.
    const broke = structuredClone(day);
    broke.finances.balance = backerLineOf(broke).floor - 5_000;
    const fa = freeAgentFor(broke);
    const signed = signPlayerFlow(broke, fa, { lengthSeasons: 1 });
    expect(signed.error).toBeUndefined();
    expect(signed.save.squad).toHaveLength(3);
    expect(squadHoldFor(signed.save)).toBeNull();
    const started = startEvent(signed.save, false);
    expect(started.activeEvent?.def.id).toBe(regionalW4.id);
    expect(started.activeEvent?.fieldedIds).toHaveLength(3);
    // No stand-in fee is ever booked.
    expect(started.finances.ledger.some((l) => l.kind === "standInFee")).toBe(false);
  });

  it("a release that leaves two players holds the next matchday until a third signs", () => {
    const base = onDay(createCareerSave(INPUT, 50_505), qualifierW4.day - 2, qualifierW4);
    const released = releasePlayerFlow(base, base.squad[2].id);
    expect(released.error).toBeUndefined();
    let save = advanceDayFlow(released.save);
    expect(save.clock.day).toBe(qualifierW4.day - 1);
    expect(advanceDayFlow(save).clock.day).toBe(qualifierW4.day - 1);
    save = signPlayerFlow(save, freeAgentFor(save), { lengthSeasons: 1 }).save;
    expect(advanceDayFlow(save).clock.day).toBe(qualifierW4.day);
  });

  it("a Community Cup can be passed instead: the hold lifts when the cup is declined", () => {
    const cup: CareerEventDef = {
      id: "0:5:unofficial",
      tier: "t3",
      region: "SAM",
      seasonIndex: 0,
      week: 5,
      day: firstDayOfWeek(5) + 5,
      name: "Neon Cup",
      format: "single",
    };
    const eve = withoutOne(onDay(createCareerSave(INPUT, 50_506), cup.day - 1, cup));
    expect(squadHoldFor(eve)?.id).toBe(cup.id);
    const passed = { ...structuredClone(eve), pendingEventDef: null };
    expect(squadHoldFor(passed)).toBeNull();
    expect(advanceDayFlow(passed).clock.day).toBe(cup.day);
  });
});

describe("RTW-05 — the unavailability roll never takes a lineup below three", () => {
  it("with no reserve nobody is ruled out; with a reserve he covers the seat", () => {
    const base = onDay(createCareerSave(INPUT, 50_507), regionalW4.day, regionalW4);
    const starter = base.starterIds[0];
    // Three players, a starter flagged out (an old save): he still plays, the lobby shows nobody out.
    const three = structuredClone(base);
    three.pendingUnavailability = { playerId: starter, eventId: regionalW4.id };
    expect(ruledOutFor(three, regionalW4)).toBeNull();
    const t3 = userTeamForEvent(three, regionalW4);
    expect(t3.emptySeats).toBe(0);
    expect(t3.fieldedIds).toContain(starter);
    // Four players: the reserve takes his seat.
    const four = structuredClone(three);
    const lead = four.squad[0];
    const reserve: SquadPlayer = { ...lead, id: `${lead.id}:r`, name: "Reserve", role: "sub", overall: lead.overall - 5 };
    four.squad.push(reserve);
    expect(ruledOutFor(four, regionalW4)?.id).toBe(starter);
    const t4 = userTeamForEvent(four, regionalW4);
    expect(t4.fieldedIds).not.toContain(starter);
    expect(t4.fieldedIds).toContain(reserve.id);
    expect(t4.emptySeats).toBe(0);
  });

  it("the Monday roll fires only for a squad with a reserve (same seed, same week)", () => {
    let fired = 0;
    for (let seed = 50_600; seed < 50_760 && fired < 2; seed++) {
      const base = createCareerSave(INPUT, seed);
      // Split 2's first regional week (season 0's split 1 is the novice grace).
      const sunday = structuredClone(base);
      sunday.clock.day = firstDayOfWeek(14) - 1;
      sunday.pendingEventDef = null;
      sunday.unofficialOffer = null;
      sunday.pendingInsert = null;
      sunday.sponsorOffers = null;
      for (const p of sunday.squad) p.trainingIntensity = "heavy";
      const lead = sunday.squad[0];
      const four = structuredClone(sunday);
      four.squad.push({ ...lead, id: `${lead.id}:r`, name: "Reserve", role: "sub", overall: lead.overall - 5 });
      const withReserve = advanceDayFlow(four);
      const without = advanceDayFlow(sunday);
      expect(without.pendingUnavailability, `seed ${seed}`).toBeNull();
      if (withReserve.pendingUnavailability) fired += 1;
    }
    expect(fired).toBeGreaterThan(0);
  });
});
