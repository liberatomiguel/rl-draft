/**
 * OBS-01 — the career events (#145), read off one store write.
 *
 * 1. The pure detectors over a whole season played through the REAL flows:
 *    one `career_event_completed` per TOURNAMENT (a regional weekend is one),
 *    the three split summaries, one season review, each milestone once, every
 *    payload scalar, id-shaped, anonymous and in the catalogue.
 * 2. The action events (transfers, staff, debt, the career's end).
 * 3. The store wiring against a fake sink: `career_created`, once per action,
 *    nothing on a reload, nothing on staging, `quality_migration` on a
 *    saveVersion upgrade.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { DAYS_PER_SEASON, firstDayOfWeek } from "@/engine/career/calendar";
import { ageOf, exactAgeOf, growthModelOf, playerViewById, readsUniformBand, scoutedBand } from "@/engine/career/development";
import { catalogProblems, EVENT_CATALOG, isCatalogEvent } from "@/lib/analyticsCatalog";
import { signableOverallCap } from "@/engine/career/economy";
import type { CareerPlayerView, CareerSave, MailItem, SponsorState, TransferOffer } from "@/engine/career/types";
import {
  analyticsPayload,
  connectAnalytics,
  notePageview,
  resetAnalyticsForTests,
  type TrackedEvent,
} from "@/lib/analytics";
import {
  careerCreatedEvent,
  careerEventsFor,
  careerIdOf,
  SPLIT_BOUNDARY_WEEKS,
  type CareerAction,
} from "./careerAnalytics";
import {
  acceptBidFlow,
  advanceDayFlow,
  chooseSponsorFlow,
  coachCandidatesFor,
  createCareerSave,
  finishEvent,
  fireCoachFlow,
  hireCoachFlow,
  isEventPaused,
  releasePlayerFlow,
  renewPlayerFlow,
  resolveInsertFlow,
  rolloverToNextSeason,
  signPlayerFlow,
  simEventToEnd,
  startEvent,
  takeBankLoanFlow,
  type CreateCareerInput,
} from "./careerFlow";
import { walkPastForTests } from "./careerClockForTests";
import { sundayStopHolds } from "./careerSunday";

const INPUT: CreateCareerInput = {
  identity: {
    orgName: "ZZ Org Name",
    abbrev: "ZZQ",
    managerName: "ZZ Manager",
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

const ID_SHAPED = /^[A-Za-z0-9_:.+-]*$/;

function makeSave(seed = 47_047): CareerSave {
  const save = createCareerSave(INPUT, seed);
  save.finances.balance = 400_000;
  return save;
}

/** The scalar / id-shape / anonymity / catalogue contract every career payload meets. */
function expectAnonymous(events: readonly TrackedEvent[]): void {
  const banned = [INPUT.identity.orgName, INPUT.identity.abbrev, INPUT.identity.managerName];
  for (const e of events) {
    expect(catalogProblems(e.name, e.props as Record<string, unknown>), e.name).toEqual([]);
    const payload = analyticsPayload(e.name, e.props as never);
    for (const [key, value] of Object.entries(payload)) {
      expect(value === null || ["string", "number", "boolean"].includes(typeof value), `${e.name}.${key}`).toBe(true);
      if (typeof value !== "string" || key === "release") continue;
      expect(value, `${e.name}.${key}`).toMatch(ID_SHAPED);
      for (const word of banned) expect(value.includes(word), `${e.name}.${key}`).toBe(false);
    }
  }
}

function named<K extends TrackedEvent["name"]>(events: readonly TrackedEvent[], name: K) {
  return events.filter((e): e is Extract<TrackedEvent, { name: K }> => e.name === name);
}

const placementOf = (r: CareerSave["eventResults"][number]) => r.userPlacement ?? r.rows.find((x) => x.ref === "user")?.placement;

/** Results the user played this season. */
function userResults(save: CareerSave) {
  return save.eventResults.filter((r) => placementOf(r) !== undefined);
}

/**
 * The TOURNAMENTS the user played (what `career_event_completed` reports): a
 * qualifier the team got through belongs to that weekend's regional.
 */
function tournaments(save: CareerSave) {
  return userResults(save).filter((r) => !(r.tier === "qualifier" && placementOf(r) !== "swiss_exit"));
}

/** One season through the flows, recording every write's events. */
function playSeasonRecording(input: CareerSave, events: TrackedEvent[]): CareerSave {
  let save = input;
  const step = (next: CareerSave, action?: CareerAction) => {
    events.push(...careerEventsFor(save, next, action));
    save = next;
  };
  let guard = 0;
  while (save.phase === "running" && guard++ < DAYS_PER_SEASON + 80) {
    if (save.pendingEventDef && save.clock.day === save.pendingEventDef.day && !save.activeEvent) {
      step(startEvent(save, false));
      step(simEventToEnd(save));
      if (isEventPaused(save)) {
        step(advanceDayFlow(save));
        step(simEventToEnd(save));
      }
      step(finishEvent(save));
      continue;
    }
    if (save.pendingInsert && save.pendingInsert.day === save.clock.day) {
      step(resolveInsertFlow(save, "b").save);
      continue;
    }
    const before = save.clock.day;
    // rc.34 (UX-01a): bids and offers hold the clock now — answered the way rc.33's walk did.
    step(advanceDayFlow(walkPastForTests(save)));
    if (save.clock.day === before && before >= DAYS_PER_SEASON) break;
  }
  return save;
}

function freeAgents(save: CareerSave): CareerPlayerView[] {
  const ctx = { careerSeed: save.careerSeed, seasonIndex: save.clock.seasonIndex, world: save.world };
  const cap = signableOverallCap(save.reputation);
  return save.world.freeAgentIds
    .map((id) => playerViewById(id, ctx))
    .filter((v): v is CareerPlayerView => v !== null && Math.round(v.overall) <= cap)
    .sort((a, b) => b.overall - a.overall || a.id.localeCompare(b.id));
}

function mail(save: CareerSave, kind: MailItem["kind"], params: MailItem["params"]): MailItem {
  return {
    id: `m:test:${kind}`,
    seasonIndex: save.clock.seasonIndex,
    day: save.clock.day,
    kind,
    titleKey: kind === "contract" ? "contractExpiring" : "unlock",
    params,
    fromKey: "agent",
    read: false,
  };
}

// ---------------------------------------------------------------------------
// 1. A season through the flows
// ---------------------------------------------------------------------------

describe("career events over a real season (pure detectors)", () => {
  const events: TrackedEvent[] = [];
  let end: CareerSave;

  beforeAll(() => {
    end = playSeasonRecording(makeSave(), events);
  });

  it("the split boundaries are the Mondays the flow settles a split on (weeks 11 / 21 / 31)", () => {
    expect(SPLIT_BOUNDARY_WEEKS).toEqual([11, 21, 31]);
  });

  it("reaches the season review", () => {
    expect(end.phase).toBe("seasonReview");
    expect(end.history).toHaveLength(1);
  });

  it("one career_event_completed per TOURNAMENT: a qualifier the team got through rides on its regional", () => {
    const done = named(events, "career_event_completed");
    const played = tournaments(end);
    expect(played.length).toBeGreaterThan(5);
    expect(played.length).toBeLessThan(userResults(end).length); // some weekends had both stages
    expect(done.map((e) => e.props.actionId.split(":").slice(3).join(":")).sort()).toEqual(
      played.map((r) => `event:${r.eventId}`).sort(),
    );
    for (const e of done) {
      const r = played.find((x) => e.props.actionId.endsWith(`:event:${x.eventId}`))!;
      expect(e.props.tier).toBe(r.tier);
      expect(e.props.week).toBe(r.week);
      expect(e.props.watched).toBe(false); // the bot sims every event
      expect(e.props.squadOverall).toBeGreaterThan(0);
      if (r.tier === "qualifier") expect(e.props.qualified).toBe(false);
      if (r.tier === "qualifier" || r.tier === "regional") expect(typeof e.props.seedingDirect).toBe("boolean");
      else expect(e.props.seedingDirect).toBeNull();
      if (r.tier === "major" || r.tier === "worlds") expect(e.props.eventRegion).toBe("international");
      if (r.tier === "regional") {
        const qualifier = userResults(end).find((q) => q.tier === "qualifier" && q.week === r.week);
        expect(e.props.qualifierPlacement ?? null).toBe(qualifier ? placementOf(qualifier) : null);
        expect(e.props.qualified ?? null).toBe(qualifier ? true : null);
      }
    }
    expect(done.some((e) => e.props.tier === "regional" && e.props.qualified === true)).toBe(true);
  });

  it("three split summaries, in order, with the split's money and the Major-table rank", () => {
    const splits = named(events, "career_split_summary");
    expect(splits.map((e) => e.props.split)).toEqual([1, 2, 3]);
    for (const e of splits) {
      expect(e.props.seasonIndex).toBe(0);
      expect(e.props.payrollPerSplit).toBeGreaterThan(0);
      expect(e.props.incomePrize).toBeGreaterThanOrEqual(0);
      expect(e.props.ledgerComplete).toBe(true);
      expect(e.props.splitRank == null || e.props.splitRank >= 1).toBe(true);
      expect(e.props.spendWages).toBeGreaterThan(0);
      expect(e.props.spendTransfers).toBeGreaterThanOrEqual(0);
      expect(e.props.spendOther).toBeGreaterThanOrEqual(0);
      expect(e.props.squadSize).toBeGreaterThanOrEqual(3);
      expect(e.props.squadOverall).toBeGreaterThan(0);
    }
  });

  it("one season review, matching the record the review wrote", () => {
    const reviews = named(events, "career_season_completed");
    expect(reviews).toHaveLength(1);
    const h = end.history[0];
    expect(reviews[0].props).toMatchObject({
      seasonIndex: 0,
      regionRank: h.userRegionRank,
      seasonPoints: h.userSeasonPoints,
      majorsQualified: h.majorsQualified,
      worldsPlacement: h.userWorldsPlacement,
      grade: h.grade,
      balance: h.balanceEnd,
      rep: h.repEnd,
      region: "SAM",
      difficulty: "normal",
      earnings: h.earnings,
      titlesSeason: h.titles,
      squadSize: end.squad.length,
    });
    expect(reviews[0].props.squadAvgAge).toBeGreaterThan(15);
    expect(reviews[0].props.payrollPerSplit).toBeGreaterThan(0);
  });

  it("each milestone at most once; every actionId unique; every payload anonymous and scalar", () => {
    const kinds = named(events, "career_milestone").map((e) => e.props.kind);
    expect(new Set(kinds).size).toBe(kinds.length);
    const ids = events.map((e) => (e.props as { actionId: string }).actionId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const e of events) expect((e.props as { careerId?: string }).careerId ?? careerIdOf(end)).toBe(careerIdOf(end));
    expectAnonymous(events);
  });

  it("the rollover reports no result, split or review again", () => {
    const next = rolloverToNextSeason(structuredClone(end));
    expect(careerEventsFor(end, next)).toEqual([]);
  });

  it("career_created reports the founding squad and money, and no name", () => {
    const save = makeSave();
    const created = careerCreatedEvent(save, "balanced", 2);
    expect(created.props).toMatchObject({ region: "SAM", difficulty: "normal", rosterKey: "balanced", startBalance: 400_000, slot: 2 });
    expect((created.props as { startOverall: number }).startOverall).toBeGreaterThan(0);
    expectAnonymous([created]);
  });
});

// ---------------------------------------------------------------------------
// 2. Action events
// ---------------------------------------------------------------------------

describe("career action events", () => {
  it("sign: one career_transfer with the fee, the wage, the slot, the age and the shown band", () => {
    const save = makeSave();
    const target = freeAgents(save)[0];
    const res = signPlayerFlow(save, target.id, { lengthSeasons: 2 });
    expect(res.error).toBeUndefined();
    const out = careerEventsFor(save, res.save, { kind: "sign", playerId: target.id });
    const [t] = named(out, "career_transfer");
    expect(out).toHaveLength(1);
    const signed = res.save.squad.find((p) => p.id === target.id)!;
    // The band the screens show (careerUi.potBandOfSquad): the save's development model (rc.32 review),
    // rc.33 (DEV-04): capped by the age clock, an older career's reports kept inside rc.32's band.
    // rc.37 (F1): a new career's band model 3, the uniform band.
    const band = scoutedBand(signed.potential, signed.overall, signed.scoutLevel, save.careerSeed, signed.id, growthModelOf(save.world), {
      arc: { peakAge: signed.peakAge, exactAge: exactAgeOf(ageOf(signed.birthYear, 0), res.save.clock.day) },
      rc32Reports: res.save.bandModel === undefined,
      uniform: readsUniformBand(res.save.bandModel),
    });
    const fee = res.save.transferLog.find((x) => x.kind === "userIn" && x.playerId === target.id)!.fee;
    expect(t.props).toMatchObject({
      kind: "sign",
      fee,
      overall: signed.overall,
      salaryPerSplit: signed.salaryPerSplit,
      role: signed.role,
      potentialBandMid: (band.min + band.max) / 2,
    });
    expect(t.props.age).toBeGreaterThanOrEqual(13);
    expectAnonymous(out);
  });

  it("a full squad's signing reports the leaver (release, with his severance) and the signing", () => {
    let save = makeSave();
    const [a, b] = freeAgents(save);
    save = signPlayerFlow(save, a.id, { lengthSeasons: 2 }).save; // 4 = full
    const leaver = save.squad.find((p) => p.role === "sub")!;
    const res = signPlayerFlow(save, b.id, { lengthSeasons: 2, releaseId: leaver.id });
    expect(res.error).toBeUndefined();
    const out = named(careerEventsFor(save, res.save, { kind: "sign", playerId: b.id }), "career_transfer");
    expect(out.map((e) => e.props.kind)).toEqual(["release", "sign"]);
    expect(out[0].props.fee).toBeGreaterThan(0);
  });

  it("release, renew and sell report their kind; a refused action reports nothing", () => {
    const save = makeSave();
    const [p1, p2] = save.starterIds;
    const released = releasePlayerFlow(save, p1);
    expect(named(careerEventsFor(save, released.save, { kind: "release", playerId: p1 }), "career_transfer").map((e) => e.props.kind)).toEqual(["release"]);

    const renewed = renewPlayerFlow(save, p2, 3);
    expect(renewed.error).toBeUndefined();
    const renew = named(careerEventsFor(save, renewed.save, { kind: "renew", playerId: p2 }), "career_transfer");
    expect(renew.map((e) => [e.props.kind, e.props.fee])).toEqual([["renew", 0]]);

    const bid: TransferOffer = {
      id: "bid:analytics",
      direction: "out",
      playerId: p2,
      playerName: "Seller",
      fee: 9_000,
      salaryPerSplit: 0,
      lengthSeasons: 2,
      role: "starter",
      otherRef: Object.values(save.world.orgs).find((o) => o.region === "SAM")!.ref,
      status: "pending",
      resolveSeason: save.clock.seasonIndex,
      resolveDay: save.clock.day + 7,
      factors: [],
    };
    const withBid = { ...structuredClone(save), pendingOffers: [bid] };
    const sold = acceptBidFlow(withBid, bid.id);
    expect(sold.error).toBeUndefined();
    const sell = named(careerEventsFor(withBid, sold.save, { kind: "sell", offerId: bid.id }), "career_transfer");
    expect(sell.map((e) => [e.props.kind, e.props.fee])).toEqual([["sell", 9_000]]);

    const refused = signPlayerFlow(save, "nobody", { lengthSeasons: 1 });
    expect(refused.error).toBeDefined();
    expect(careerEventsFor(save, refused.save, { kind: "sign", playerId: "nobody" })).toEqual([]);
  });

  it("a warned, expiring contract: the renewal or the release carries warned: true; reading mail sends nothing", () => {
    const save = makeSave();
    const p = save.squad[0];
    p.contractEndSeason = save.clock.seasonIndex;
    const quiet = renewPlayerFlow(save, p.id, 2).save;
    expect(named(careerEventsFor(save, quiet, { kind: "renew", playerId: p.id }), "career_transfer").map((e) => e.props.warned)).toEqual([false]);
    const warning = mail(save, "contract", { player: p.name });
    save.mail = [warning];
    const read = structuredClone(save);
    read.mail[0].read = true;
    expect(careerEventsFor(save, read)).toEqual([]);
    const renewed = renewPlayerFlow(save, p.id, 2).save;
    expect(named(careerEventsFor(save, renewed, { kind: "renew", playerId: p.id }), "career_transfer").map((e) => [e.props.kind, e.props.warned])).toEqual([["renew", true]]);
    const released = releasePlayerFlow(save, p.id).save;
    expect(named(careerEventsFor(save, released, { kind: "release", playerId: p.id }), "career_transfer").map((e) => [e.props.kind, e.props.warned])).toEqual([["release", true]]);
  });

  it("support staff: a retainer switched on or off is one career_staff; the same state again is nothing", () => {
    const save = makeSave();
    const on = structuredClone(save);
    on.finances.gear.staff = { ...(on.finances.gear.staff ?? {}), analyst: true };
    const hired = named(careerEventsFor(save, on, { kind: "staff", staffId: "analyst" }), "career_staff");
    expect(hired.map((e) => [e.props.kind, e.props.staffId])).toEqual([["staff_on", "analyst"]]);
    expect(named(careerEventsFor(on, save, { kind: "staff", staffId: "analyst" }), "career_staff").map((e) => e.props.kind)).toEqual(["staff_off"]);
    expect(careerEventsFor(on, structuredClone(on), { kind: "staff", staffId: "analyst" })).toEqual([]);
    const psych = structuredClone(save);
    psych.finances.gear.psychologist = true;
    expect(named(careerEventsFor(save, psych, { kind: "staff", staffId: "psychologist" }), "career_staff").map((e) => [e.props.kind, e.props.staffId])).toEqual([
      ["staff_on", "psychologist"],
    ]);
    expectAnonymous(hired);
  });

  it("a coach's renewal is career_staff coach_renewed", () => {
    const save = makeSave();
    save.reputation = 100;
    const hired = hireCoachFlow(save, coachCandidatesFor(save)[0]).save;
    const renewed = structuredClone(hired);
    renewed.coach = { ...renewed.coach!, salaryPerSplit: renewed.coach!.salaryPerSplit + 500 };
    const out = named(careerEventsFor(hired, renewed, { kind: "renewCoach" }), "career_staff");
    expect(out.map((e) => [e.props.kind, e.props.overall, e.props.salaryPerSplit])).toEqual([
      ["coach_renewed", renewed.coach!.overall, renewed.coach!.salaryPerSplit],
    ]);
  });

  it("staff: a coach hired and fired, a sponsor signed", () => {
    const save = makeSave();
    save.reputation = 100;
    const coach = coachCandidatesFor(save)[0];
    const hired = hireCoachFlow(save, coach);
    expect(hired.error).toBeUndefined();
    const hire = named(careerEventsFor(save, hired.save, { kind: "hireCoach" }), "career_staff");
    expect(hire.map((e) => [e.props.kind, e.props.overall, e.props.salaryPerSplit])).toEqual([
      ["coach_hired", coach.overall, coach.salaryPerSplit],
    ]);
    const fired = fireCoachFlow(hired.save);
    expect(named(careerEventsFor(hired.save, fired.save, { kind: "fireCoach" }), "career_staff").map((e) => e.props.kind)).toEqual([
      "coach_fired",
    ]);

    const offer: SponsorState = {
      sponsorId: "voltway",
      tier: 2,
      basePerSplit: 6_000,
      bonus: 2_000,
      objectiveKind: "regionalTop8",
      progress: 0,
      hitThisSplit: false,
      missedCount: 0,
    };
    const offered = { ...structuredClone(save), sponsorOffers: [offer] };
    const signed = chooseSponsorFlow(offered, "voltway");
    expect(signed.error).toBeUndefined();
    const sponsor = named(careerEventsFor(offered, signed.save, { kind: "chooseSponsor" }), "career_staff");
    expect(sponsor.map((e) => [e.props.kind, e.props.tier, e.props.basePerSplit, e.props.objectiveKind])).toEqual([
      ["sponsor_signed", 2, 6_000, "regionalTop8"],
    ]);
  });

  it("milestones from the write that first sets them: the bank loan, the Backer; an insolvency is the career's end", () => {
    const save = makeSave();
    save.reputation = 60;
    const loan = takeBankLoanFlow(save, 20_000);
    expect(loan.error).toBeUndefined();
    expect(named(careerEventsFor(save, loan.save), "career_milestone").map((e) => [e.props.kind, e.props.amount])).toEqual([
      ["bank_loan", loan.save.finances.bankLoan!.remaining],
    ]);
    const rescued = structuredClone(save);
    rescued.finances.loanUsed = true;
    rescued.finances.loan = { remaining: 50_000 };
    const broke = structuredClone(rescued);
    broke.end = { ...broke.end, ended: true, reason: "insolvency" };
    broke.phase = "ended";
    expect(named(careerEventsFor(save, rescued), "career_milestone").map((e) => [e.props.kind, e.props.amount])).toEqual([["backer", 50_000]]);
    const ended = careerEventsFor(rescued, broke);
    expect(ended.map((e) => e.name)).toEqual(["career_ended"]);
    expect(named(ended, "career_ended")[0].props).toMatchObject({ reason: "insolvency", seasonIndex: 0, titles: 0, balance: broke.finances.balance, rep: broke.reputation });
    expectAnonymous(ended);
    // Already set before the write: never again.
    expect(careerEventsFor(broke, structuredClone(broke))).toEqual([]);
  });

  it("the rescue milestone fires on every breach the bank covers (a loan or a top-up), the breach number in its actionId (rc.34)", () => {
    const save = makeSave();
    save.difficulty = "easy";
    const breach = (from: CareerSave, n: number, day: number): CareerSave => {
      const next = structuredClone(from);
      next.clock.day = day;
      next.finances.loanUsed = true;
      next.finances.loanBreaches = n;
      next.finances.loan = { remaining: 40_000 * n, topUps: n - 1 };
      return next;
    };
    const first = breach(save, 1, 15);
    const second = breach(first, 2, 64);
    // A breach the bank would not cover (the top-up cap) ends the career: no rescue for it.
    const third = breach(second, 3, 120);
    third.end = { ...third.end, ended: true, reason: "insolvency", moneyCause: "breach" };
    third.phase = "ended";
    const backer = (a: CareerSave, b: CareerSave) =>
      named(careerEventsFor(a, b), "career_milestone").filter((e) => e.props.kind === "backer");
    const one = backer(save, first);
    const two = backer(first, second);
    expect(one).toHaveLength(1);
    expect(two).toHaveLength(1);
    expect(one[0].props.actionId).toMatch(/:backer:1$/);
    expect(two[0].props.actionId).toMatch(/:backer:2$/);
    const closing = careerEventsFor(second, third);
    expect(named(closing, "career_milestone")).toEqual([]);
    expect(named(closing, "career_ended").map((e) => e.props.reason)).toEqual(["insolvency"]);
    // Two rescues in one write (a long batched advance): one event each.
    expect(backer(save, second).map((e) => e.props.actionId.split(":").at(-1))).toEqual(["1", "2"]);
    // rc.34: a later breach on Normal is a top-up, a rescue like any other.
    const normal = { ...structuredClone(first), difficulty: "normal" as const };
    expect(backer(normal, { ...breach(normal, 2, 64), difficulty: "normal" })).toHaveLength(1);
    // The deadline ends a career without a breach: the career's end, no rescue.
    const due = structuredClone(second);
    due.end = { ...due.end, ended: true, reason: "insolvency", moneyCause: "deadline" };
    due.phase = "ended";
    expect(careerEventsFor(second, due).map((e) => e.name)).toEqual(["career_ended"]);
  });

  it("a retirement ends the career once, with its reason", () => {
    const save = makeSave();
    const retired = structuredClone(save);
    retired.end = { ...retired.end, ended: true, reason: "retired", endedSeasonIndex: 0 };
    retired.phase = "ended";
    expect(named(careerEventsFor(save, retired), "career_ended").map((e) => e.props.reason)).toEqual(["retired"]);
    expect(careerEventsFor(retired, structuredClone(retired))).toEqual([]);
  });

  it("a Major result (no region of its own) reports eventRegion international; an AI-only result reports nothing", () => {
    const save = makeSave();
    const next = structuredClone(save);
    const row = { ref: "user", name: "ZZ Org Name", placement: "top8" as const, points: 0, prize: 0 };
    next.eventResults = [
      { eventId: "0:1:major", tier: "major", seasonIndex: 0, week: 10, split: 1, name: "Split 1 Major", rows: [row], championRef: "x", userPlacement: "top8", fieldQuality: 1 },
      { eventId: "0:1:reg1:EU", tier: "regional", region: "EU", seasonIndex: 0, week: 4, split: 1, name: "EU", rows: [{ ...row, ref: "eu:1" }], championRef: "eu:1", fieldQuality: 1 },
    ];
    const out = named(careerEventsFor(save, next), "career_event_completed");
    expect(out.map((e) => [e.props.tier, e.props.eventRegion, e.props.placement, e.props.seedingDirect])).toEqual([
      ["major", "international", "top8", null],
    ]);
    expectAnonymous(out);
  });

  it("careerId: the stored id wins; an older save without one derives a stable anonymous id", () => {
    const save = makeSave();
    expect(careerIdOf(save)).toMatch(/^c[0-9a-f]{8}$/);
    expect(careerIdOf(save)).toBe(careerIdOf(structuredClone(save)));
    expect(careerIdOf({ ...save, careerId: "cabc" })).toBe("cabc");
  });
});

// ---------------------------------------------------------------------------
// 3. The store wiring (fake sink)
// ---------------------------------------------------------------------------

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length(): number {
    return this.data.size;
  }
  clear(): void {
    this.data.clear();
  }
  getItem(key: string): string | null {
    return this.data.has(key) ? this.data.get(key)! : null;
  }
  key(index: number): string | null {
    return [...this.data.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
  setItem(key: string, value: string): void {
    this.data.set(key, String(value));
  }
}

type Call = { name: string; props: Record<string, unknown> };

describe("the career store sends each event once, in production only", () => {
  const storage = new MemoryStorage();
  let store: typeof import("./careerStore").useCareerStore;
  let selectActiveSave: typeof import("./careerStore").selectActiveSave;

  beforeAll(async () => {
    vi.stubGlobal("window", { localStorage: storage });
    try {
      const mod = await import("./careerStore");
      store = mod.useCareerStore;
      selectActiveSave = mod.selectActiveSave;
    } finally {
      vi.unstubAllGlobals();
    }
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    resetAnalyticsForTests();
    const problems = violations.splice(0);
    expect(problems, "every event sent matches the analytics catalogue").toEqual([]);
  });

  /** A production build on a host; returns the fake sink. */
  function deploy(host = "rocketdraft.app", build: { noindex?: string } = {}): Call[] {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_NOINDEX", build.noindex ?? "");
    vi.stubEnv("NEXT_PUBLIC_PLAYTEST", "");
    vi.stubGlobal("window", { location: { hostname: host, href: `https://${host}/career`, pathname: "/career" } });
    resetAnalyticsForTests();
    const calls: Call[] = [];
    connectAnalytics({
      capture: (name, props) => {
        const all = (props ?? {}) as Record<string, unknown>;
        calls.push({ name, props: all });
        if (name.startsWith("$")) return;
        const listed = isCatalogEvent(name) ? Object.keys(EVENT_CATALOG[name].props) : [];
        const own = Object.fromEntries(Object.entries(all).filter(([key]) => listed.includes(key) || !COMMON.includes(key)));
        violations.push(...catalogProblems(name, own));
      },
    });
    return calls;
  }

  /** Common properties, added by the analytics layer to every event. */
  const COMMON = ["release", "balanceVersion", "schemaVersion", "season", "environment", "locale", "gameMode", "sampleWeight", "sampleBucket"];
  /** Catalogue problems of anything the sink received (asserted empty after every test). */
  const violations: string[] = [];
  const career = (calls: Call[]) => calls.filter((c) => c.name.startsWith("career_"));

  const active = () => selectActiveSave(store.getState())!;

  function playUntil(stop: (s: CareerSave) => boolean): void {
    const st = () => store.getState();
    for (let i = 0; i < 400; i++) {
      const s = active();
      if (stop(s) || s.phase !== "running") return;
      if (s.pendingEventDef && s.clock.day === s.pendingEventDef.day && !s.activeEvent) {
        st().enterEvent(false);
        st().simEvent();
        if (isEventPaused(active())) {
          // rc.36 (SUN-01): HQ's "Start Sunday" moves a paused Saturday on.
          st().startSunday();
          st().simEvent();
        }
        st().completeEvent();
        continue;
      }
      if (s.pendingInsert && s.pendingInsert.day === s.clock.day) {
        st().resolveInsert("b");
        continue;
      }
      // rc.36 (SUN-01): through on Saturday, Sunday is started from HQ.
      if (sundayStopHolds(s)) {
        st().startSunday();
        continue;
      }
      st().advanceDay();
    }
  }

  it("createCareer stamps a random careerId and sends one career_created, with no name in it", () => {
    const calls = deploy();
    store.getState().createCareer(0, INPUT, 47_047);
    const save = active();
    expect(save.careerId).toMatch(/^c[0-9a-f]{16}$/);
    expect(calls.map((c) => c.name)).toEqual(["session_started", "career_created", "onboarding_step"]);
    expect(calls[1].props).toMatchObject({
      careerId: save.careerId,
      region: "SAM",
      difficulty: "normal",
      rosterKey: "balanced",
      slot: 0,
      startBalance: save.finances.balance,
      gameMode: "career",
      environment: "production",
    });
    expect(calls[2].props).toMatchObject({ step: "career_created", gameMode: "app" });
    expect(JSON.stringify(calls)).not.toMatch(/ZZ/);
  });

  it("playing to the first split boundary: each tournament once, one split summary, the tab and advance counters on the first event — and a reload sends nothing", async () => {
    const calls = deploy();
    store.getState().createCareer(1, INPUT, 47_048);
    // Two visits to the Club tab and one to HQ before the first tournament.
    const location = (window as unknown as { location: { pathname: string } }).location;
    for (const path of ["/career/club", "/career", "/career/club"]) {
      location.pathname = path;
      notePageview();
    }
    playUntil((s) => s.clock.day >= firstDayOfWeek(SPLIT_BOUNDARY_WEEKS[0]));
    const save = active();
    const count = (name: string) => calls.filter((c) => c.name === name).length;
    expect(count("career_split_summary")).toBe(1);
    expect(count("career_event_completed")).toBe(tournaments(save).length);
    expect(count("career_event_completed")).toBeGreaterThan(0);
    const ids = career(calls).map((c) => c.props.actionId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of career(calls)) expect(c.props.careerId).toBe(save.careerId);
    const [first, second] = calls.filter((c) => c.name === "career_event_completed");
    expect(first.props).toMatchObject({ tab_club: 2, tab_hq: 1 });
    expect(first.props.advanceCount).toBeGreaterThan(0);
    expect(second.props.tab_club).toBeUndefined();
    expect(calls.filter((c) => c.name === "onboarding_step").map((c) => c.props.step)).toEqual(["career_created", "career_first_event"]);
    expect(calls.filter((c) => c.name === "$pageview")).toHaveLength(2); // one per route

    const sent = calls.length;
    await store.persist.rehydrate();
    expect(active().clock.day).toBe(save.clock.day);
    expect(calls).toHaveLength(sent);
  });

  it("scout reports, mail reads and the HQ explainer send nothing (cut from the 2.0 catalogue); retiring ends the career once", () => {
    deploy();
    store.getState().createCareer(2, INPUT, 47_049);
    const calls = deploy(); // fresh sink after the creation
    const fa = freeAgents(active())[0];
    store.getState().buyScoutReport(fa.id);
    store.setState((s) => {
      const slots = [...s.slots];
      const save = structuredClone(slots[2]!);
      save.mail = [mail(save, "unlock", { name: "t2" }), ...save.mail];
      slots[2] = save;
      return { slots };
    });
    store.getState().markMailRead("m:test:unlock");
    store.getState().markFlag("seenHub");
    expect(career(calls)).toEqual([]);
    store.getState().retireCareer();
    store.getState().retireCareer();
    expect(career(calls).map((c) => [c.name, c.props.reason])).toEqual([["career_ended", "retired"]]);
  });

  it.each([
    ["the staging build", "rocketdraft.app", "1"],
    ["the staging host", "staging.rocketdraft.app", ""],
  ])("%s sends nothing", (_label, host, noindex) => {
    const calls = deploy(host, { noindex });
    store.getState().createCareer(0, INPUT, 47_050);
    playUntil((s) => s.clock.day >= 20);
    expect(active().clock.day).toBeGreaterThanOrEqual(20);
    expect(calls).toEqual([]);
  });

  it("a saveVersion upgrade on load reports one quality_migration (once per session)", async () => {
    const legacy = createCareerSave(INPUT, 47_051);
    legacy.saveVersion = 4;
    storage.setItem(
      "rocket-draft:career:v1",
      JSON.stringify({ state: { slots: [legacy, null, null], activeSlot: 0, achievements: { unlocked: {}, worldsWonOn: {} } }, version: 3 }),
    );
    const calls = deploy();
    await store.persist.rehydrate();
    expect(active().saveVersion).toBe(5);
    const migrations = calls.filter((c) => c.name === "quality_migration");
    expect(migrations.map((c) => [c.name, c.props.store, c.props.fromVersion, c.props.toVersion, c.props.gameMode])).toEqual([
      ["quality_migration", "career", 4, 5, "career"],
    ]);
  });
});
