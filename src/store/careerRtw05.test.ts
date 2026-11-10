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
import { CAREER_NEGOTIATION, CAREER_TRAINING, CAREER_WORLD } from "@/config/balance";
import { CAREER_EN } from "@/content/copy.career.en";
import { CAREER_PT } from "@/content/copy.career.pt";
import type { CareerCopy } from "@/content/careerCopy";
import {
  dayOfWeekOf,
  firstDayOfWeek,
  isWindowWeek,
  officialEventDefsForWeek,
  qualifierDefsForWeek,
  weekOfDay,
} from "@/engine/career/calendar";
import type { CareerEventDef, CareerSave, SquadPlayer } from "@/engine/career/types";
import { userTeamFor } from "@/engine/career/worldSim";
import { signableOverallCap } from "@/engine/career/economy";
import { listingFor, signableAtRep } from "@/engine/career/market";
import { continueKind, scrimAvailability } from "@/components/career/careerUi";
import { resolveMail } from "@/components/career/news/newsText";
import { errorTextFor } from "@/components/career/hub/hubShared";
import { fillSeatsForTests } from "./careerArcBot";
import {
  advanceDayFlow,
  advanceToNextStopFlow,
  backerLineOf,
  canSkipShortSquadEvent,
  skipShortSquadEventFlow,
  uncoveredAbsenceOf,
  createCareerSave,
  emptySeatPriceFor,
  migrateSaveToV5,
  releasePlayerFlow,
  ruledOutFor,
  runScrimFlow,
  scheduleScrimFlow,
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

  it("broke and short: only the cheapest free agent it may sign skips the money checks — anyone dearer is refused for money", () => {
    const day = withoutOne(onDay(createCareerSave(INPUT, 50_514), regionalW4.day, regionalW4));
    const broke = structuredClone(day);
    broke.finances.balance = backerLineOf(broke).floor - 50_000;
    const seat = emptySeatPriceFor(broke, 1)!;
    expect(seat).not.toBeNull();
    // The dearest free agent the Market lists that this org may sign (a star at its reputation cap).
    const listed = listingFor({
      world: broke.world,
      squadIds: broke.squad.map((p) => p.id),
      seasonIndex: 0,
      careerSeed: broke.careerSeed,
      signableCap: signableOverallCap(broke.reputation),
    }).freeAgents.filter((v) => signableAtRep(v.overall, broke.reputation));
    const ask = (id: string) => {
      const plan = signingPlanFor({ ...broke, finances: { ...broke.finances, balance: 10_000_000 } }, id, { lengthSeasons: 1 });
      return "plan" in plan ? plan.plan.talk.terms.wagePerSplit : 0;
    };
    const dear = [...listed].sort((a, b) => ask(b.id) - ask(a.id))[0];
    expect(ask(dear.id)).toBeGreaterThan(seat.wagePerSplit);
    expect(signingPlanFor(broke, dear.id, { lengthSeasons: 1 })).toEqual({ error: "funds" });
    expect(signPlayerFlow(broke, dear.id, { lengthSeasons: 1 }).save).toBe(broke);
    // The cheapest one always signs, and so does anyone no dearer — the seat can always be filled.
    const signed = signPlayerFlow(broke, seat.playerId, { lengthSeasons: 1 });
    expect(signed.error).toBeUndefined();
    expect(signed.save.squad).toHaveLength(3);
    expect(signed.save.squad.find((p) => p.id === seat.playerId)!.salaryPerSplit).toBe(seat.wagePerSplit);
    expect(startEvent(signed.save, false).activeEvent?.fieldedIds).toHaveLength(3);
    // A raise over his ask (a smaller share) is dearer than the seat's price: the normal checks apply.
    const share = signingPlanFor(broke, seat.playerId, { lengthSeasons: 1 });
    const lowShare = "plan" in share ? share.plan.talk.zone.shareMin : 0;
    if ("plan" in share && lowShare < share.plan.talk.ask.sharePct) {
      expect(signingPlanFor(broke, seat.playerId, { lengthSeasons: 1, offer: { sharePct: lowShare } })).toEqual({ error: "funds" });
    }
    // With money in the bank the dear one signs as before (the normal checks pass).
    const rich = structuredClone(day);
    rich.finances.balance = 5_000_000;
    expect(signPlayerFlow(rich, dear.id, { lengthSeasons: 1 }).error).toBeUndefined();
  });

  it("rc.36 (rc.35-(d), kept): a broke short squad offering the seat's player more bonus than he asks loses the waiver — and is told why; the switch reads his asked bonus", () => {
    const day = withoutOne(onDay(createCareerSave(INPUT, 50_516), regionalW4.day, regionalW4));
    const broke = structuredClone(day);
    broke.finances.balance = backerLineOf(broke).floor - 50_000;
    const seat = emptySeatPriceFor(broke, 1)!;
    const at = signingPlanFor(broke, seat.playerId, { lengthSeasons: 1 });
    expect("plan" in at).toBe(true);
    const talk = "plan" in at ? at.plan.talk : null;
    const more = { weekly: talk!.offer.weekly, bonus: talk!.ask.bonus + talk!.zone.bonusStep };
    expect(CAREER_NEGOTIATION.emptySeatCountsOfferedBonus).toBe(true);
    expect(signingPlanFor(broke, seat.playerId, { lengthSeasons: 1, offer: more })).toEqual({ error: "fundsSeatBonus" });
    for (const C of [CAREER_EN, CAREER_PT]) expect(C.market.errors.fundsSeatBonus).toBeTruthy();
    // At the bonus he asks the seat is covered; with the switch off, the bonus offered is not counted.
    expect("plan" in signingPlanFor(broke, seat.playerId, { lengthSeasons: 1, offer: { weekly: more.weekly } })).toBe(true);
    const N = CAREER_NEGOTIATION as unknown as { emptySeatCountsOfferedBonus: boolean };
    N.emptySeatCountsOfferedBonus = false;
    try {
      expect("plan" in signingPlanFor(broke, seat.playerId, { lengthSeasons: 1, offer: more })).toBe(true);
    } finally {
      N.emptySeatCountsOfferedBonus = true;
    }
  });

  it("broke, short and owing the Backer: the cheapest free agent still signs; a dearer one waits for the runway", () => {
    const day = withoutOne(onDay(createCareerSave(INPUT, 50_515), regionalW4.day - 2, regionalW4));
    const owed = structuredClone(day);
    owed.finances.balance = backerLineOf(owed).floor - 1_000;
    owed.finances.loan = { remaining: 60_000 };
    owed.finances.loanUsed = true;
    const seat = emptySeatPriceFor(owed, 2)!;
    const refusedDearer = owed.world.freeAgentIds.filter((id) => {
      if (id === seat.playerId) return false;
      const plan = signingPlanFor(owed, id, { lengthSeasons: 2 });
      return "error" in plan && (plan.error === "funds" || plan.error === "loanRunway");
    });
    expect(refusedDearer.length).toBeGreaterThan(0);
    const res = signPlayerFlow(owed, seat.playerId, { lengthSeasons: 2 });
    expect(res.error).toBeUndefined();
    expect(squadIsShort(res.save)).toBe(false);
  });

  it("the arc bot's short squad always signs, broke or not, window or not — never a softlock", () => {
    for (const [seed, policy] of [
      [50_521, "autopilot"],
      [50_522, "spender"],
      [50_523, "youth"],
    ] as const) {
      const day = withoutOne(onDay(createCareerSave(INPUT, seed), regionalW4.day - 1, regionalW4));
      const broke = structuredClone(day);
      broke.finances.balance = backerLineOf(broke).floor - 80_000;
      broke.finances.loan = { remaining: 90_000 };
      broke.finances.loanUsed = true;
      expect(isWindowWeek(weekOfDay(broke.clock.day))).toBe(false);
      const filled = fillSeatsForTests(broke, policy);
      expect(filled.squad, `${policy} @${seed}`).toHaveLength(3);
      expect(squadHoldFor(filled)).toBeNull();
    }
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

describe("R103 (rc.39 F6) — a three-player squad is ruled out too; without a reserve the lineup is short", () => {
  const W = CAREER_WORLD as unknown as { unavailabilityWithoutReserve: "immune" | "short"; unavailabilityNoReserveGraceSeasons: number };
  const reserveOf = (save: CareerSave): SquadPlayer => {
    const lead = save.squad[0];
    return { ...lead, id: `${lead.id}:r`, name: "Reserve", role: "sub", overall: lead.overall - 5 };
  };

  it("no reserve: he is out, his seat is empty, the clock holds and the event cannot start; a reserve lifts it", () => {
    const base = onDay(createCareerSave(INPUT, 50_507), regionalW4.day, regionalW4);
    const starter = base.starterIds[0];
    expect(squadIsShort(base)).toBe(false);
    const three = structuredClone(base);
    three.pendingUnavailability = { playerId: starter, eventId: regionalW4.id };
    expect(ruledOutFor(three, regionalW4)?.id).toBe(starter);
    expect(uncoveredAbsenceOf(three)?.id).toBe(starter);
    expect(squadIsShort(three)).toBe(true);
    expect(squadHoldFor(three)?.id).toBe(regionalW4.id);
    const t3 = userTeamForEvent(three, regionalW4);
    expect(t3.emptySeats).toBe(1);
    expect(t3.fieldedIds).not.toContain(starter);
    expect(startEvent(three, false).activeEvent).toBeNull();
    // The scrim rule reads the roster, not the absence: three under contract still scrim.
    expect(scrimAvailability(three).reason).not.toBe("squadShort");
    // Four players: the reserve takes his seat and nothing holds.
    const four = structuredClone(three);
    const reserve = reserveOf(four);
    four.squad.push(reserve);
    expect(uncoveredAbsenceOf(four)).toBeNull();
    expect(squadIsShort(four)).toBe(false);
    expect(squadHoldFor(four)).toBeNull();
    expect(ruledOutFor(four, regionalW4)?.id).toBe(starter);
    const t4 = userTeamForEvent(four, regionalW4);
    expect(t4.fieldedIds).not.toContain(starter);
    expect(t4.fieldedIds).toContain(reserve.id);
    expect(t4.emptySeats).toBe(0);
    expect(startEvent(four, false).activeEvent?.def.id).toBe(regionalW4.id);
  });

  it("a reserve only signs in a window (Miguel, 10/11): outside one the event is sat out, whatever its tier", () => {
    const three = onDay(createCareerSave(INPUT, 50_508), regionalW4.day - 1, regionalW4);
    three.pendingUnavailability = { playerId: three.starterIds[1], eventId: regionalW4.id };
    expect(isWindowWeek(weekOfDay(three.clock.day))).toBe(false);
    // No free agent takes the seat outside the window: an absence is not an empty seat.
    const listing = listingFor({
      world: three.world,
      squadIds: three.squad.map((p) => p.id),
      seasonIndex: three.clock.seasonIndex,
      careerSeed: three.careerSeed,
      signableCap: signableOverallCap(three.reputation),
    });
    for (const v of listing.freeAgents.slice(0, 5)) {
      expect(signPlayerFlow(three, v.id, { lengthSeasons: 1 }).error).toBe("windowClosed");
    }
    // The regional is sat out and the flag goes with it.
    expect(canSkipShortSquadEvent(three)).toBe(true);
    const skipped = skipShortSquadEventFlow(three);
    expect(skipped.error).toBeUndefined();
    expect(skipped.save.pendingUnavailability).toBeNull();
    expect(squadIsShort(skipped.save)).toBe(false);
    expect(skipped.save.mail[0]).toMatchObject({ titleKey: "eventMissedNoReserve" });
    // A Major slot too (a squad under three keeps R67: it signs first).
    const major: CareerEventDef = { ...regionalW4, id: "0:1:major-test", tier: "major", name: "Test Major" };
    const atMajor = onDay(createCareerSave(INPUT, 50_508), major.day - 1, major);
    atMajor.pendingUnavailability = { playerId: atMajor.starterIds[0], eventId: major.id };
    expect(squadHoldFor(atMajor)?.id).toBe(major.id);
    expect(canSkipShortSquadEvent(atMajor)).toBe(true);
    expect(canSkipShortSquadEvent(withoutOne(onDay(createCareerSave(INPUT, 50_508), major.day - 1, major)))).toBe(false);
  });

  it("a stale flag (another event's) never holds the clock; \"immune\" is rc.38's rule", () => {
    const base = onDay(createCareerSave(INPUT, 50_509), regionalW4.day, regionalW4);
    const stale = structuredClone(base);
    stale.pendingUnavailability = { playerId: stale.starterIds[0], eventId: "0:1:somewhere-else" };
    expect(squadIsShort(stale)).toBe(false);
    const flagged = structuredClone(base);
    flagged.pendingUnavailability = { playerId: flagged.starterIds[0], eventId: regionalW4.id };
    const mode = W.unavailabilityWithoutReserve;
    W.unavailabilityWithoutReserve = "immune";
    try {
      expect(ruledOutFor(flagged, regionalW4)).toBeNull();
      expect(squadIsShort(flagged)).toBe(false);
      expect(userTeamForEvent(flagged, regionalW4).emptySeats).toBe(0);
    } finally {
      W.unavailabilityWithoutReserve = mode;
    }
  });

  it("the Monday roll: a first-season squad without a reserve is exempt; past the grace it is ruled out like one with a reserve", () => {
    const sundayOf = (seed: number) => {
      const sunday = structuredClone(createCareerSave(INPUT, seed));
      // Split 2's first regional week (season 0's split 1 is the novice grace).
      sunday.clock.day = firstDayOfWeek(14) - 1;
      sunday.pendingEventDef = null;
      sunday.unofficialOffer = null;
      sunday.pendingInsert = null;
      sunday.sponsorOffers = null;
      for (const p of sunday.squad) p.trainingIntensity = "heavy";
      return sunday;
    };
    let fired = 0;
    const firedSeeds: number[] = [];
    for (let seed = 50_600; seed < 50_760 && fired < 2; seed++) {
      const sunday = sundayOf(seed);
      const four = structuredClone(sunday);
      four.squad.push(reserveOf(four));
      const withReserve = advanceDayFlow(four);
      const without = advanceDayFlow(sunday);
      expect(without.pendingUnavailability, `seed ${seed}`).toBeNull();
      if (withReserve.pendingUnavailability) {
        fired += 1;
        firedSeeds.push(seed);
      }
    }
    expect(fired).toBeGreaterThan(0);
    // The same Mondays with the grace over: the three-player squad is hit too, the mail says there is no reserve.
    const grace = W.unavailabilityNoReserveGraceSeasons;
    W.unavailabilityNoReserveGraceSeasons = 0;
    try {
      for (const seed of firedSeeds) {
        const hit = advanceDayFlow(sundayOf(seed));
        expect(hit.pendingUnavailability, `seed ${seed}`).not.toBeNull();
        expect(hit.mail.some((m) => m.bodyKey === "unavailableNoReserve")).toBe(true);
        expect(uncoveredAbsenceOf(hit)?.id).toBe(hit.pendingUnavailability!.playerId);
      }
    } finally {
      W.unavailabilityNoReserveGraceSeasons = grace;
    }
  }, 30_000);
});

describe("RTW-05 — no scrim with fewer than three players (rc.33 review)", () => {
  /** Day 1 of season 0 with nothing pending: a training day the clock can leave. */
  function quietStart(seed: number): CareerSave {
    const save = structuredClone(createCareerSave(INPUT, seed));
    save.pendingEventDef = null;
    save.unofficialOffer = null;
    save.pendingInsert = null;
    save.sponsorOffers = null;
    save.pendingOffers = [];
    return save;
  }

  it("a short squad cannot scrim: the flow refuses, nothing moves, the hub says why", () => {
    const full = quietStart(50_531);
    full.clock.day = 2;
    expect(dayOfWeekOf(full.clock.day)).toBeLessThanOrEqual(CAREER_TRAINING.trainingDaysPerWeek);
    const short = withoutOne(full);
    const res = runScrimFlow(short);
    expect(res.error).toBe("squadShort");
    expect(res.save).toBe(short);
    expect(scrimAvailability(short)).toMatchObject({ available: false, reason: "squadShort" });
    for (const C of [CAREER_EN as unknown as CareerCopy, CAREER_PT]) {
      expect(C.market.errors.squadShort.length).toBeGreaterThan(10);
      // The Training screen's banner names it (not the generic "Locked").
      expect(errorTextFor(C, "squadShort", "rescue")).toBe(C.market.errors.squadShort);
    }
    // The same day with three players scrims.
    expect(runScrimFlow(full).error).toBeUndefined();
  });

  it("a scrim booked for a day the squad is short is called off on arrival, and the feed says so", () => {
    const full = quietStart(50_532);
    const day = full.clock.day + 1;
    expect(dayOfWeekOf(day)).toBeLessThanOrEqual(CAREER_TRAINING.trainingDaysPerWeek);
    const opp = Object.values(full.world.orgs).find((o) => o.region === "SAM")!;
    const booked = scheduleScrimFlow(full, day, opp.ref);
    expect(booked.error).toBeUndefined();
    // Booked with three; a player leaves before the day.
    const short = withoutOne(booked.save);
    const next = advanceDayFlow(short);
    expect(next.clock.day).toBe(day);
    expect(next.scheduledScrims.some((x) => x.day === day)).toBe(false);
    expect(next.scrimLog.some((e) => e.day === day)).toBe(false);
    expect(next.scrimsThisWeek).toBe(short.scrimsThisWeek);
    expect(next.squad.map((p) => p.splitsTogether)).toEqual(short.squad.map((p) => p.splitsTogether));
    const item = next.mail.find((n) => n.titleKey === "scrimSkipped")!;
    expect(item).toBeDefined();
    expect(resolveMail(item, CAREER_EN as unknown as CareerCopy).title).toContain(opp.name);
    expect(resolveMail(item, CAREER_PT).title).toContain(opp.name);
    // The same booking with three players runs.
    const ran = advanceDayFlow(booked.save);
    expect(ran.scrimLog.some((e) => e.day === day && e.oppRef === opp.ref)).toBe(true);
  });
});
