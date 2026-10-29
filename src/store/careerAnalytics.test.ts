/**
 * OBS-01 — the career events (#145), read off one store write.
 *
 * 1. The pure detectors over a whole season played through the REAL flows:
 *    one `career_event_completed` per banked user result, the three split
 *    summaries, one season review, each milestone once, every payload scalar,
 *    id-shaped and anonymous.
 * 2. The action events (transfers, staff, scouting, mail, the rollover).
 * 3. The store wiring against a fake sink: `career_created`, once per action,
 *    nothing on a reload, nothing on staging, `quality_migration` on a
 *    saveVersion upgrade.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { DAYS_PER_SEASON, firstDayOfWeek } from "@/engine/career/calendar";
import { growthModelOf, playerViewById, scoutedBand } from "@/engine/career/development";
import { signableOverallCap } from "@/engine/career/economy";
import type { CareerPlayerView, CareerSave, MailItem, SponsorState, TransferOffer } from "@/engine/career/types";
import {
  analyticsPayload,
  connectAnalytics,
  resetAnalyticsForTests,
  type TrackedEvent,
} from "@/lib/analytics";
import {
  careerEventsFor,
  careerIdOf,
  headroomBucket,
  SPLIT_BOUNDARY_WEEKS,
  type CareerAction,
} from "./careerAnalytics";
import {
  acceptBidFlow,
  advanceDayFlow,
  buyScoutReportFlow,
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

/** The scalar / id-shape / anonymity contract every career payload meets. */
function expectAnonymous(events: readonly TrackedEvent[]): void {
  const banned = [INPUT.identity.orgName, INPUT.identity.abbrev, INPUT.identity.managerName];
  for (const e of events) {
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

/** Results the user played this season (what `career_event_completed` reports). */
function userResults(save: CareerSave) {
  return save.eventResults.filter((r) => (r.userPlacement ?? r.rows.find((x) => x.ref === "user")?.placement) !== undefined);
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
    step(advanceDayFlow(save));
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

  it("one career_event_completed per banked user result, with its tier's fields", () => {
    const done = named(events, "career_event_completed");
    const results = userResults(end);
    expect(results.length).toBeGreaterThan(5);
    expect(done.map((e) => e.props.actionId.split(":").slice(3).join(":")).sort()).toEqual(
      results.map((r) => `event:${r.eventId}`).sort(),
    );
    for (const e of done) {
      const r = results.find((x) => e.props.actionId.endsWith(`:event:${x.eventId}`))!;
      expect(e.props.tier).toBe(r.tier);
      expect(e.props.watched).toBe(false); // the bot sims every event
      expect(e.props.qualified === null).toBe(r.tier !== "qualifier");
      if (r.tier === "qualifier" || r.tier === "regional") expect(typeof e.props.seedingDirect).toBe("boolean");
      else expect(e.props.seedingDirect).toBeNull();
      if (r.tier === "major" || r.tier === "worlds") expect(e.props.eventRegion).toBe("international");
    }
  });

  it("three split summaries, in order, with the split's money and the Major-table rank", () => {
    const splits = named(events, "career_split_summary");
    expect(splits.map((e) => e.props.split)).toEqual([1, 2, 3]);
    for (const e of splits) {
      expect(e.props.seasonIndex).toBe(0);
      expect(e.props.payrollPerSplit).toBeGreaterThan(0);
      expect(e.props.incomePrize).toBeGreaterThanOrEqual(0);
      expect(e.props.ledgerComplete).toBe(true);
      expect(e.props.splitRank === null || e.props.splitRank >= 1).toBe(true);
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
    });
  });

  it("each milestone at most once; every actionId unique; every payload anonymous and scalar", () => {
    const kinds = named(events, "career_milestone").map((e) => e.props.kind);
    expect(new Set(kinds).size).toBe(kinds.length);
    const ids = events.map((e) => (e.props as { actionId: string }).actionId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const e of events) expect((e.props as { careerId?: string }).careerId ?? careerIdOf(end)).toBe(careerIdOf(end));
    expectAnonymous(events);
  });

  it("the rollover reports no result, split or review again; an expiring contract that runs out is let go", () => {
    const review = structuredClone(end);
    const leaver = [...review.squad].sort((a, b) => b.birthYear - a.birthYear)[0]; // the youngest: no retirement
    leaver.contractEndSeason = review.clock.seasonIndex;
    const next = rolloverToNextSeason(review);
    expect(next.squad.some((p) => p.id === leaver.id)).toBe(false);
    const after = careerEventsFor(review, next);
    expect(after.filter((e) => e.name !== "ux_contract_warning")).toEqual([]);
    expect(named(after, "ux_contract_warning").map((e) => e.props.outcome)).toEqual(["let_go"]);
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
    // The band the screens show (careerUi.potBandOfSquad): the save's development model (rc.32 review).
    const band = scoutedBand(signed.potential, signed.overall, signed.scoutLevel, save.careerSeed, signed.id, growthModelOf(save.world));
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

  it("an expiring, warned contract: reading the warning, renewing and releasing report ux_contract_warning", () => {
    const save = makeSave();
    const p = save.squad[0];
    p.contractEndSeason = save.clock.seasonIndex;
    const warning = mail(save, "contract", { player: p.name });
    save.mail = [warning];
    const read = structuredClone(save);
    read.mail[0].read = true;
    expect(named(careerEventsFor(save, read, { kind: "readMail", mailId: warning.id }), "ux_contract_warning").map((e) => e.props.outcome)).toEqual(["seen"]);
    const renewed = renewPlayerFlow(save, p.id, 2).save;
    expect(named(careerEventsFor(save, renewed, { kind: "renew", playerId: p.id }), "ux_contract_warning").map((e) => e.props.outcome)).toEqual(["renewed"]);
    const released = releasePlayerFlow(save, p.id).save;
    expect(named(careerEventsFor(save, released, { kind: "release", playerId: p.id }), "ux_contract_warning").map((e) => e.props.outcome)).toEqual(["released"]);
  });

  it("a toolbox unlock mail read reports ux_unlock_seen with the unlock key", () => {
    const save = makeSave();
    save.mail = [mail(save, "unlock", { name: "coach" })];
    const read = structuredClone(save);
    read.mail[0].read = true;
    const out = named(careerEventsFor(save, read, { kind: "readMail", mailId: save.mail[0].id }), "ux_unlock_seen");
    expect(out.map((e) => [e.props.kind, e.props.id, e.props.gameMode])).toEqual([["toolbox", "coach", "career"]]);
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

  it("a scout report reports the paid level, the age and the bucketed headroom of the band it shows", () => {
    const save = makeSave();
    const fa = freeAgents(save)[0];
    const res = buyScoutReportFlow(save, fa.id);
    expect(res.error).toBeUndefined();
    const [r] = named(careerEventsFor(save, res.save, { kind: "scout", playerId: fa.id }), "career_scout_report");
    const level = Number(res.save.scouted[fa.id]);
    const band = scoutedBand(fa.potential, fa.overall, level as 0 | 1 | 2 | 3, save.careerSeed, fa.id, growthModelOf(save.world));
    expect(r.props).toMatchObject({
      level,
      age: fa.age,
      headroomBand: headroomBucket((band.min + band.max) / 2 - fa.overall),
    });
    expect(["0", "1-2", "3-5", "6-9", "10+"]).toContain(r.props.headroomBand);
  });

  it("milestones from the write that first sets them: the bank loan, the Backer, insolvency", () => {
    const save = makeSave();
    save.reputation = 60;
    const loan = takeBankLoanFlow(save, 20_000);
    expect(loan.error).toBeUndefined();
    expect(named(careerEventsFor(save, loan.save), "career_milestone").map((e) => e.props.kind)).toEqual(["bank_loan"]);
    const rescued = structuredClone(save);
    rescued.finances.loanUsed = true;
    rescued.finances.loan = { remaining: 50_000 };
    const broke = structuredClone(rescued);
    broke.end = { ...broke.end, ended: true, reason: "insolvency" };
    broke.phase = "ended";
    expect(named(careerEventsFor(save, rescued), "career_milestone").map((e) => e.props.kind)).toEqual(["backer"]);
    expect(named(careerEventsFor(rescued, broke), "career_milestone").map((e) => e.props.kind)).toEqual(["insolvency"]);
    // Already set before the write: never again.
    expect(careerEventsFor(broke, structuredClone(broke))).toEqual([]);
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
  });

  /** A production build on a host; returns the fake sink. */
  function deploy(host = "rocketdraft.app", build: { noindex?: string } = {}): Call[] {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_NOINDEX", build.noindex ?? "");
    vi.stubEnv("NEXT_PUBLIC_PLAYTEST", "");
    vi.stubGlobal("window", { location: { hostname: host, href: `https://${host}/career`, pathname: "/career" } });
    resetAnalyticsForTests();
    const calls: Call[] = [];
    connectAnalytics({ capture: (name, props) => void calls.push({ name, props: (props ?? {}) as Record<string, unknown> }) });
    return calls;
  }

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
          st().advanceDay();
          st().simEvent();
        }
        st().completeEvent();
        continue;
      }
      if (s.pendingInsert && s.pendingInsert.day === s.clock.day) {
        st().resolveInsert("b");
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
    expect(calls.map((c) => c.name)).toEqual(["career_created"]);
    expect(calls[0].props).toMatchObject({
      careerId: save.careerId,
      region: "SAM",
      difficulty: "normal",
      rosterKey: "balanced",
      gameMode: "career",
      environment: "production",
    });
    expect(JSON.stringify(calls)).not.toMatch(/ZZ/);
  });

  it("playing to the first split boundary: each banked result once, one split summary — and a reload sends nothing", async () => {
    const calls = deploy();
    store.getState().createCareer(1, INPUT, 47_048);
    playUntil((s) => s.clock.day >= firstDayOfWeek(SPLIT_BOUNDARY_WEEKS[0]));
    const save = active();
    const count = (name: string) => calls.filter((c) => c.name === name).length;
    expect(count("career_split_summary")).toBe(1);
    expect(count("career_event_completed")).toBe(userResults(save).length);
    expect(count("career_event_completed")).toBeGreaterThan(0);
    const ids = calls.map((c) => c.props.actionId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of calls) expect(c.props.careerId).toBe(save.careerId);

    const sent = calls.length;
    await store.persist.rehydrate();
    expect(active().clock.day).toBe(save.clock.day);
    expect(calls).toHaveLength(sent);
  });

  it("the action descriptors reach the detectors: a scout report, a mail read, the HQ explainer", () => {
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
    store.getState().markMailRead("m:test:unlock"); // already read: nothing
    store.getState().markFlag("seenHub");
    store.getState().markFlag("seenHub");
    expect(calls.map((c) => c.name)).toEqual(["career_scout_report", "ux_unlock_seen", "ux_tutorial"]);
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
    expect(calls.map((c) => [c.name, c.props.store, c.props.fromVersion, c.props.toVersion, c.props.gameMode])).toEqual([
      ["quality_migration", "career", 4, 5, "career"],
    ]);
  });
});
