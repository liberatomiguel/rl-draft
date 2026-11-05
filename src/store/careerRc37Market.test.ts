/**
 * Road to Worlds — rc.37 front F1 (ROADMAP-NEXT-2026-11-05 §3 F1) through
 * the flows: the contracted page's signable top-up (package 1), the resale
 * lock against a sign-and-flip (package 2), the title raise's two-season
 * window across the rollover (package 3) and a new career's band model
 * (package 4). The pure rules are in engine/career/rc37F1.test.ts.
 */

import { describe, expect, it } from "vitest";
import { CAREER_CALENDAR, CAREER_ECONOMY, CAREER_SCOUT, CAREER_TRANSFER } from "@/config/balance";
import { firstDayOfWeek, seasonSchedule, weekOfDay, windowIndexOf } from "@/engine/career/calendar";
import {
  CURRENT_BAND_MODEL,
  developmentProfileOf,
  exactAgeOf,
  isCompetitiveAge,
  peakTargetOf,
  playerViewById,
  reachableOverallOf,
  seasonYear,
} from "@/engine/career/development";
import { marketValueFor, quantize, signableOverallCap } from "@/engine/career/economy";
import { bidWeightOf, incomingBidForDay, listingFor, valueInputOf } from "@/engine/career/market";
import type { CareerPlayerView, CareerSave, CompactEventResult, SquadPlayer } from "@/engine/career/types";
import { potBandOfView } from "@/components/career/careerUi";
import {
  createCareerSave,
  eventDayPhaseOf,
  finishEvent,
  renewalTitlesOf,
  renewPlayerFlow,
  rolloverToNextSeason,
  signPlayerFlow,
  simEventToEnd,
  startEvent,
  type CreateCareerInput,
} from "./careerFlow";
import { stepDayForTests } from "./careerClockForTests";

const INPUT: CreateCareerInput = {
  identity: {
    orgName: "Market Org",
    abbrev: "MKT",
    managerName: "Bot",
    country: "BR",
    region: "EU",
    crestId: "shield",
    colors: { primary: "#f97316", secondary: "#fde68a" },
    buffType: "consistency",
  },
  difficulty: "normal",
  style: "balanced",
  rosterKey: "prospects",
};

// ---------------------------------------------------------------------------
// Package 1 — the contracted page tops up with signable players
// ---------------------------------------------------------------------------

describe("rc.37 F1 — the contracted page keeps its top 120 and tops up with signable players", () => {
  it("at rep 0 every org's top players sit over the cap: the page still lists 24 the org may sign", () => {
    for (const seed of [3, 4_041, 90_210]) {
      const save = createCareerSave(INPUT, seed);
      const cap = signableOverallCap(0);
      const ctx = { careerSeed: seed, seasonIndex: 0, world: save.world };
      const squad = new Set(save.squad.map((p) => p.id));
      const all = Object.values(save.world.orgs)
        .flatMap((o) => o.playerIds)
        .filter((id) => !squad.has(id))
        .map((id) => playerViewById(id, ctx))
        .filter((v): v is CareerPlayerView => v !== null && isCompetitiveAge(v.age))
        .sort((a, b) => b.overall - a.overall);
      const signableTotal = all.filter((v) => Math.round(v.overall) <= cap).length;

      const plain = listingFor({ world: save.world, squadIds: [...squad], seasonIndex: 0, careerSeed: seed });
      const capped = listingFor({ world: save.world, squadIds: [...squad], seasonIndex: 0, careerSeed: seed, signableCap: cap });
      // Without a cap: rc.36's page, the top 120 by overall.
      expect(plain.contracted.length).toBe(Math.min(120, all.length));
      // With it: the same top 120 first (stars included), unchanged and in order ...
      expect(capped.contracted.slice(0, plain.contracted.length).map((c) => c.view.id)).toEqual(
        plain.contracted.map((c) => c.view.id),
      );
      // ... then signable players until 24 are signable, when that many exist.
      const signableListed = capped.contracted.filter((c) => Math.round(c.view.overall) <= cap).length;
      expect(signableListed).toBe(Math.max(Math.min(24, signableTotal), plain.contracted.filter((c) => Math.round(c.view.overall) <= cap).length));
      expect(signableTotal).toBeGreaterThanOrEqual(24); // the world has them: the test reads the top-up
      // The prices and the deal ("splits remaining") are the ordinary ones.
      for (const c of capped.contracted.slice(plain.contracted.length)) {
        expect(c.splitsRemaining).toBeGreaterThanOrEqual(1);
        expect(c.splitsRemaining).toBeLessThanOrEqual(6);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Package 2 — the resale lock: no sign-and-flip
// ---------------------------------------------------------------------------

const W1_START = firstDayOfWeek(11);

function windowSave(seed: number): CareerSave {
  const save = createCareerSave(INPUT, seed);
  save.finances.balance = 2_000_000;
  save.reputation = 100;
  save.clock.day = W1_START;
  if (save.squad.length >= 4) {
    const sub = save.squad.find((p) => !save.starterIds.includes(p.id));
    save.squad = save.squad.filter((p) => p !== sub);
  }
  return save;
}

function bestFreeAgent(save: CareerSave): CareerPlayerView {
  const ctx = { careerSeed: save.careerSeed, seasonIndex: save.clock.seasonIndex, world: save.world };
  const cap = signableOverallCap(save.reputation);
  return save.world.freeAgentIds
    .map((id) => playerViewById(id, ctx))
    .filter((v): v is CareerPlayerView => v !== null && v.age >= 16 && Math.round(v.overall) <= cap)
    .sort((a, b) => b.overall - a.overall || a.id.localeCompare(b.id))[0];
}

describe("rc.37 F1 — anti-flip: a player bought in a window cannot be sold in it or the next", () => {
  it("no AI bid lands on him in his signing window or the next one; from the window after, bids do", () => {
    let laterBids = 0;
    for (const seed of [5, 61, 909, 4_242, 31_337, 777_001]) {
      const save = windowSave(seed);
      const fa = bestFreeAgent(save);
      const res = signPlayerFlow(save, fa.id, { lengthSeasons: 2 });
      expect(res.error).toBeUndefined();
      // The only target worth a bid: a star with room to grow.
      const signed = res.save.squad.find((p) => p.id === fa.id)!;
      signed.overall = 92;
      signed.potential = 97;
      const bidOn = (seasonIndex: number, day: number) =>
        incomingBidForDay({
          world: res.save.world,
          squad: res.save.squad,
          seasonIndex,
          windowIdx: windowIndexOf(weekOfDay(day))!,
          day,
          careerSeed: seed,
          rep: res.save.reputation,
          bidsThisWindow: 0,
          lastBidDay: -99,
          pendingTargetIds: [],
        });
      // His signing window (1) and the next (2): nothing on him, so no sale and no profit.
      for (const [first, last] of [[11, 12], [21, 22]]) {
        for (let day = firstDayOfWeek(first); day < firstDayOfWeek(last + 1); day++) {
          expect(bidOn(0, day)?.playerId).not.toBe(fa.id);
        }
      }
      // From the Worlds window (3) on he is fair game again (and next season's windows).
      const later: [number, number, number][] = [[0, 31, 31], [1, 1, 2], [1, 11, 12]];
      for (const [season, first, last] of later) {
        for (let day = firstDayOfWeek(first); day < firstDayOfWeek(last + 1); day++) {
          if (bidOn(season, day)?.playerId === fa.id) laterBids += 1;
        }
      }
    }
    expect(laterBids).toBeGreaterThan(0);
  });
});

describe("rc.37 F1 — one valuation for buying, selling and the wage", () => {
  it("a market view and the squad player he becomes read the same value input (and price)", () => {
    for (const seed of [5, 909, 31_337]) {
      const save = windowSave(seed);
      const fa = bestFreeAgent(save);
      const res = signPlayerFlow(save, fa.id, { lengthSeasons: 2 });
      expect(res.error).toBeUndefined();
      const squad = res.save.squad.find((p) => p.id === fa.id)!;
      expect(squad.peakAge).toBe(fa.peakAge);
      const fromView = valueInputOf(fa, seed, 0);
      expect(valueInputOf(squad, seed, 0)).toEqual(fromView);
      expect(fromView.plateauYears).toBe(developmentProfileOf(fa.id, seed).plateauYears);
      expect(marketValueFor(valueInputOf(squad, seed, 0))).toBe(marketValueFor(fromView));
    }
  });

  it("the AI's interest follows the reach gap at any age (rc.36: +8 for an u18 prospect only)", () => {
    const at = (age: number, overall: number, potential: number, peakAge: number) =>
      ({ id: `test:w:${age}:${overall}:${potential}`, overall, potential, birthYear: seasonYear(0) - age, peakAge }) as SquadPlayer;
    const ctx = { careerSeed: 7, seasonIndex: 0 };
    expect(bidWeightOf(at(17, 70, 98, 22), ctx)).toBe(29); // rc.36: 9
    expect(bidWeightOf(at(19, 85, 95, 22), ctx)).toBe(31); // rc.36: 21
    expect(bidWeightOf(at(23, 85, 85, 22), ctx)).toBe(21); // unchanged
    expect(bidWeightOf(at(21, 70, 70, 21), ctx)).toBe(1); // unchanged
    expect(bidWeightOf(at(17, 70, 76, 22), ctx)).toBe(9); // = rc.36: the floor keeps +8
    expect(bidWeightOf(at(21, 72, 80, 23), ctx)).toBe(10); // rc.36: 2 (no bonus at 21)
  });

  it("a locked talent is never the target, and his teammates draw no extra bids from him", () => {
    const save = windowSave(4_242);
    const fa = bestFreeAgent(save);
    const res = signPlayerFlow(save, fa.id, { lengthSeasons: 2 });
    const signed = res.save.squad.find((p) => p.id === fa.id)!;
    signed.overall = 85;
    signed.potential = 97;
    const others = res.save.squad.filter((p) => p.id !== fa.id);
    let withHim = 0;
    let without = 0;
    for (let day = firstDayOfWeek(11); day < firstDayOfWeek(13); day++) {
      const args = {
        world: res.save.world,
        seasonIndex: 0,
        windowIdx: 1,
        day,
        careerSeed: 4_242,
        rep: 100,
        bidsThisWindow: 0,
        lastBidDay: -99,
        pendingTargetIds: [],
      };
      const bid = incomingBidForDay({ ...args, squad: res.save.squad });
      expect(bid?.playerId).not.toBe(fa.id);
      if (bid) withHim += 1;
      if (incomingBidForDay({ ...args, squad: others })) without += 1;
    }
    // The locked star counts for nothing: the same days bring the same bids as a squad without him.
    expect(withHim).toBe(without);
    // Everyone locked or pending: no bid at all.
    const all = res.save.squad.map((p) => p.id);
    for (let day = firstDayOfWeek(11); day < firstDayOfWeek(13); day++) {
      expect(
        incomingBidForDay({
          world: res.save.world,
          squad: res.save.squad,
          seasonIndex: 0,
          windowIdx: 1,
          day,
          careerSeed: 4_242,
          rep: 100,
          bidsThisWindow: 0,
          lastBidDay: -99,
          pendingTargetIds: all,
        }),
      ).toBeNull();
    }
  });

  it("a contracted buy is locked too, and a later bid prices him on the buy's value basis", () => {
    const save = windowSave(909);
    const cap = signableOverallCap(save.reputation);
    const listing = listingFor({ world: save.world, squadIds: save.squad.map((p) => p.id), seasonIndex: 0, careerSeed: 909, signableCap: cap });
    const pick = listing.contracted.find((c) => Math.round(c.view.overall) <= cap && c.view.age >= 16)!;
    const res = signPlayerFlow(save, pick.view.id, { lengthSeasons: 2 });
    expect(res.error).toBeUndefined();
    const bought = res.save.squad.find((p) => p.id === pick.view.id)!;
    expect(bought.signedDay).toBe(W1_START);
    const bidFor = (seasonIndex: number, day: number, seedOffset = 0) =>
      incomingBidForDay({
        world: res.save.world,
        squad: [bought],
        seasonIndex,
        windowIdx: windowIndexOf(weekOfDay(day))!,
        day,
        careerSeed: 909 + day + seedOffset,
        rep: 100,
        bidsThisWindow: 0,
        lastBidDay: -99,
        pendingTargetIds: [],
      });
    for (const seedOffset of [0, 1_000, 2_000]) {
      for (const [first, last] of [[11, 12], [21, 22]]) {
        for (let day = firstDayOfWeek(first); day < firstDayOfWeek(last + 1); day++) expect(bidFor(0, day, seedOffset)).toBeNull();
      }
    }
    // From the Worlds window on he is fair game — next season's windows, on the buy's value basis
    // (the value reads the career seed through his plateau years, so each draw is checked on its own seed).
    let seen = 0;
    for (const seedOffset of [0, 1_000, 2_000]) {
      for (const [first, last] of [[1, 2], [11, 12], [21, 22]]) {
        for (let day = firstDayOfWeek(first); day < firstDayOfWeek(last + 1); day++) {
          const bid = bidFor(1, day, seedOffset);
          if (!bid) continue;
          seen += 1;
          const value = marketValueFor(valueInputOf(bought, 909 + day + seedOffset, 1));
          expect(bid.fee).toBeGreaterThanOrEqual(quantize(value * CAREER_TRANSFER.aiBidRange[0]) - CAREER_ECONOMY.roundQuantum);
          expect(bid.fee).toBeLessThanOrEqual(quantize(value * CAREER_TRANSFER.aiBidRange[1]));
        }
      }
    }
    expect(seen).toBeGreaterThan(0);
  });

  it("each renewal counts (renewalCount), so the next one climbs the tenure ladder", () => {
    let save = createCareerSave(INPUT, 8_080);
    save.finances.balance = 5_000_000;
    const p = save.squad[0];
    save.clock.seasonIndex = p.contractEndSeason;
    expect(p.renewalCount).toBeUndefined();
    const once = renewPlayerFlow(save, p.id, 1);
    expect(once.error).toBeUndefined();
    save = once.save;
    expect(save.squad.find((x) => x.id === p.id)!.renewalCount).toBe(1);
    expect(save.squad.find((x) => x.id === p.id)!.joinedSeason).toBe(p.joinedSeason);
  });
});

// ---------------------------------------------------------------------------
// Package 3 — the title raise's window outlives the rollover
// ---------------------------------------------------------------------------

/** A fresh career with the clock-stopping chores out of the way (careerWeekend.test's helper). */
function freshCareer(seed: number): CareerSave {
  const save = createCareerSave({ ...INPUT, identity: { ...INPUT.identity, region: "SAM" }, rosterKey: "balanced" }, seed);
  for (let s = 0; s < 2; s++) {
    for (let w = 1; w <= CAREER_CALENDAR.weeksPerSeason; w++) save.flags[`insertRolled:${s}:${w}`] = true;
  }
  save.sponsorOffers = null;
  return save;
}

/** Auto-plays (instant sim) up to `day`, lobbies and the Saturday pause included (careerWeekend.test). */
function autoPlayTo(input: CareerSave, day: number): CareerSave {
  let save = input;
  let guard = 0;
  while (save.clock.day < day && save.phase === "running" && guard++ < 900) {
    const phase = eventDayPhaseOf(save);
    if (phase === "lobby") {
      save = simEventToEnd(startEvent(save, false));
      if (save.activeEvent?.tournament.stage === "finished") save = finishEvent(save);
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

function champion(tier: CompactEventResult["tier"], seasonIndex: number, eventId: string): CompactEventResult {
  return { eventId, tier, seasonIndex, week: 10, name: eventId, rows: [], championRef: "user", userPlacement: "champion", fieldQuality: 1 };
}

describe("rc.37 F1 — the title raise reads two seasons (eventResults is cleared at the rollover)", () => {
  it("last season's titles still count after the rollover; two seasons on they drop out", () => {
    let save = createCareerSave(INPUT, 12_345);
    save.userTitlesBySeason = [{ seasonIndex: 0, majorOrWorlds: 1, regional: 2 }];
    const founder = save.squad[0];
    expect(renewalTitlesOf(save, founder)).toEqual({ majorOrWorlds: 1, regional: 2 });
    save = rolloverToNextSeason({ ...save, phase: "seasonReview" });
    expect(save.eventResults).toEqual([]);
    expect(renewalTitlesOf(save, founder)).toEqual({ majorOrWorlds: 1, regional: 2 });
    // Never before he joined.
    expect(renewalTitlesOf(save, { joinedSeason: 1 })).toEqual({ majorOrWorlds: 0, regional: 0 });
    save = rolloverToNextSeason({ ...save, phase: "seasonReview" });
    expect(renewalTitlesOf(save, founder)).toEqual({ majorOrWorlds: 0, regional: 0 });
    // Pruned to the window: season 0 is gone from the save.
    expect(save.userTitlesBySeason!.some((t) => t.seasonIndex === 0)).toBe(false);
  });

  it("a player signed mid-season counts only the titles won after his signing day (founders: the whole season)", () => {
    let save = createCareerSave(INPUT, 22_222);
    // Season 0: the split-1 Major (day 70), the split-2 Major (day 140), a regional (day 150).
    save.userTitlesBySeason = [
      {
        seasonIndex: 0,
        majorOrWorlds: 2,
        regional: 1,
        days: [
          { day: 70, major: true },
          { day: 140, major: true },
          { day: 150, major: false },
        ],
      },
    ];
    const founder = save.squad[0];
    const window1 = { joinedSeason: 0, signedDay: firstDayOfWeek(11) };
    const worldsWindow = { joinedSeason: 0, signedDay: firstDayOfWeek(31) };
    expect(renewalTitlesOf(save, founder)).toEqual({ majorOrWorlds: 2, regional: 1 });
    expect(renewalTitlesOf(save, window1)).toEqual({ majorOrWorlds: 1, regional: 1 });
    expect(renewalTitlesOf(save, worldsWindow)).toEqual({ majorOrWorlds: 0, regional: 0 });
    // His renewal next season: the titles of the season he joined still filter by his day.
    save = rolloverToNextSeason({ ...save, phase: "seasonReview" });
    expect(renewalTitlesOf(save, worldsWindow)).toEqual({ majorOrWorlds: 0, regional: 0 });
    expect(renewalTitlesOf(save, window1)).toEqual({ majorOrWorlds: 1, regional: 1 });
    expect(renewalTitlesOf(save, founder)).toEqual({ majorOrWorlds: 2, regional: 1 });
  });

  it("a title won through the flow is counted with its day (noteUserTitle)", () => {
    let save = freshCareer(55_501);
    for (const p of save.squad) p.overall = 99;
    const regionalWeek = seasonSchedule().find((w) => w.kind === "regional")!.week;
    save = autoPlayTo(save, firstDayOfWeek(regionalWeek + 1));
    expect(save.stats.titlesRegional).toBeGreaterThanOrEqual(1);
    const row = save.userTitlesBySeason!.find((t) => t.seasonIndex === 0)!;
    expect(row.regional).toBe(save.stats.titlesRegional);
    expect(row.days!.length).toBe(row.regional + row.majorOrWorlds);
    const titleDay = row.days![0].day;
    expect(weekOfDay(titleDay)).toBe(regionalWeek);
    expect(renewalTitlesOf(save, save.squad[0]).regional).toBe(row.regional);
    // Signed the day after: none of it is his.
    expect(renewalTitlesOf(save, { joinedSeason: 0, signedDay: titleDay }).regional).toBe(row.regional - 1);
  });

  it("a save from before rc.37 (no counts) reads this season's results, and keeps them at its rollover", () => {
    let save = createCareerSave(INPUT, 54_321);
    delete save.userTitlesBySeason;
    // A Major, a regional and a cup (a cup title never counts for the raise).
    save.eventResults.push(champion("major", 0, "s0-major-1"), champion("regional", 0, "s0-reg-1"), champion("t2", 0, "s0-cup"));
    const founder = save.squad[0];
    expect(renewalTitlesOf(save, founder)).toEqual({ majorOrWorlds: 1, regional: 1 });
    save = rolloverToNextSeason({ ...save, phase: "seasonReview" });
    // rc.33–rc.36 read 0 here: the rollover had cleared the results.
    expect(renewalTitlesOf(save, founder)).toEqual({ majorOrWorlds: 1, regional: 1 });
  });
});

// ---------------------------------------------------------------------------
// Package 4 — a new career reads the uniform band
// ---------------------------------------------------------------------------

describe("rc.37 F1 — band model 3", () => {
  it("a new career stamps CURRENT_BAND_MODEL (3)", () => {
    expect(createCareerSave(INPUT, 1).bandModel).toBe(CURRENT_BAND_MODEL);
  });

  it("the band the screens show keeps the uniform place for a player still growing (the age cap only once it binds)", () => {
    // Market views of fresh careers, the band of the market tile (potBandOfView).
    const tops: number[] = [];
    let exact = 0;
    let exactModel2 = 0;
    let growing = 0;
    for (const seed of [71_001, 71_002, 71_003]) {
      for (const region of ["EU", "NA", "SAM"] as const) {
        const save = createCareerSave({ ...INPUT, identity: { ...INPUT.identity, region } }, seed);
        const model2 = { ...save, bandModel: 2 };
        const listing = listingFor({ world: save.world, squadIds: [], seasonIndex: 0, careerSeed: seed });
        for (const view of [...listing.freeAgents, ...listing.contracted.map((c) => c.view)]) {
          const target = peakTargetOf(view.potential, developmentProfileOf(view.id, seed));
          const reach = reachableOverallOf(view, exactAgeOf(view.age, save.clock.day), seed);
          if (!(target > view.overall && reach >= target) || Math.round(view.potential) > 93) continue;
          growing += 1;
          const band = potBandOfView(save, view);
          tops.push(band.max - Math.round(view.potential));
          if (band.min === band.max) exact += 1;
          const old = potBandOfView(model2, view);
          if (old.min === old.max) exactModel2 += 1;
        }
      }
    }
    expect(growing).toBeGreaterThan(300);
    // rc.33's age cap kept every top within +2 of the truth; model 3 spreads it over the band.
    const high = tops.filter((t) => t >= 3).length / tops.length;
    expect(high).toBeGreaterThan(0.35);
    expect(Math.max(...tops)).toBe(CAREER_SCOUT.honestWidthByLevel[0]);
    // And no free exact read from the cap (before the fix: 23 % of them, against
    // model 2's 10 %). What is left is rc.35's floor at his overall — a potential at
    // or under his overall collapses onto it, a little more often with the truth
    // as likely at the top as anywhere (1 in 6; rc.33's top place was 1 in 18).
    expect(exact / growing, `exact ${exact} vs model 2 ${exactModel2} of ${growing}`).toBeLessThan(0.05);
  });
});
