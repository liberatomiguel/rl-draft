/**
 * Road to Worlds rc.31 (RTW-01, R49) — local amateur sides SCORE in the
 * regionals and race for Major / Worlds slots, through the REAL flow:
 *  - a season where every regional banks every team (local sides included),
 *    every qualifier and regional field stays well-formed (16, no duplicates,
 *    8 qualified, no org out of both weekend events) and the Major / Worlds
 *    fields resolve;
 *  - the Monday direct-8 commit seeds a scoring local side, Saturday skips it
 *    and Sunday fields it (lobby = engine);
 *  - the local scene's anchor freezes on the season's first regional Monday
 *    and holds (a better squad never moves a local side);
 *  - a Major with a local side plays end to end, deterministically, and banks
 *    into the side's home region;
 *  - the race tables (careerUi.raceTableOf) cut exactly where the field is;
 *  - a save from before rc.31 (no local points, no anchor, announced fields)
 *    loads mid-split and plays on.
 * Opt-in sweep: RTW_LOCALS=1 (knobs RTW_SEASONS, RTW_SEEDS, RTW_REGIONS,
 * RTW_DIFFS, RTW_MD=out.md) measures how often local sides take Major and
 * Worlds slots (it only measures).
 */

import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CAREER_CALENDAR, CAREER_SLOTS } from "@/config/balance";
import {
  dayOfWeekOf,
  firstDayOfWeek,
  officialEventDefsForWeek,
  qualifierDefsForWeek,
  regionalDayFor,
  seasonSchedule,
  weekAt,
  weekOfDay,
} from "@/engine/career/calendar";
import { majorFieldFor, worldsFieldFor } from "@/engine/career/careerResults";
import { isLocalRef, localRef, localRegionOf, localTeamName } from "@/engine/career/localScene";
import { sideOfRef } from "@/engine/career/raceTable";
import { isCompetitiveAge, playerViewById } from "@/engine/career/development";
import type { CareerDifficulty, CareerPlayerView, CareerSave, CompactEventResult } from "@/engine/career/types";
import { fieldForEvent, localTeamTarget, regionMedianRating, simulateAiEvent } from "@/engine/career/worldSim";
import type { Region } from "@/engine/types";
import {
  advanceDayFlow,
  createCareerSave,
  eventDayPhaseOf,
  finishEvent,
  localAnchorRatingFor,
  migrateSaveToV5,
  nameOfRef,
  regionOfRef,
  renewPlayerFlow,
  resolveInsertFlow,
  rolloverToNextSeason,
  setStartersFlow,
  signPlayerFlow,
  simEventToEnd,
  startEvent,
  syncSquadRoles,
  userIsDirect,
  userSeedRatingFor,
  type CreateCareerInput,
} from "./careerFlow";
import { eventTeamPreview, localSideRatingOf, raceTableOf } from "@/components/career/careerUi";
import { lobbyFieldRefs } from "@/components/career/event/lobbyField";

const REGIONS = Object.keys(CAREER_SLOTS.major) as Region[];
const SEED = 55501;
const REG_WEEKS = seasonSchedule()
  .filter((w) => w.kind === "regional")
  .map((w) => w.week);
const FIRST_REG = REG_WEEKS[0];
const MAJOR_W = seasonSchedule().find((w) => w.kind === "major")!.week;

function input(region: Region = "SAM", difficulty: CareerDifficulty = "normal"): CreateCareerInput {
  return {
    identity: {
      orgName: "Race Check",
      abbrev: "RCE",
      managerName: "Bot",
      country: "BR",
      region,
      crestId: "shield",
      colors: { primary: "#f97316", secondary: "#fde68a" },
      buffType: "consistency",
    },
    difficulty,
    style: "balanced",
    rosterKey: "balanced",
  };
}

/** A fresh career with the clock-stopping chores out of the way (no inserts, no sponsor offers). */
function freshCareer(seed = SEED, region: Region = "SAM", difficulty: CareerDifficulty = "normal"): CareerSave {
  const save = createCareerSave(input(region, difficulty), seed);
  for (let s = 0; s < 8; s++) {
    for (let w = 1; w <= CAREER_CALENDAR.weeksPerSeason; w++) save.flags[`insertRolled:${s}:${w}`] = true;
  }
  save.sponsorOffers = null;
  return save;
}

/** One step of a hands-off manager: today's event in instant sim, an insert answered, else one day. */
function step(save: CareerSave): CareerSave {
  const phase = eventDayPhaseOf(save);
  if (phase === "lobby") {
    const s = simEventToEnd(startEvent(save, false));
    return s.activeEvent?.tournament.stage === "finished" ? finishEvent(s) : s;
  }
  if (phase === "swiss" || phase === "playoffs" || phase === "finished") {
    const s = simEventToEnd(save);
    return s.activeEvent?.tournament.stage === "finished" ? finishEvent(s) : s;
  }
  if (save.pendingInsert && save.pendingInsert.day === save.clock.day) return resolveInsertFlow(save, "b").save;
  const before = save.clock.day;
  const next = advanceDayFlow(save);
  if (next.clock.day === before && next.phase === "running") throw new Error(`clock blocked on day ${before}`);
  return next;
}

/** Auto-plays until `stop` (or the season review). */
function playUntil(input: CareerSave, stop: (s: CareerSave) => boolean, onStep?: (s: CareerSave) => void): CareerSave {
  let save = input;
  for (let guard = 0; guard < 2000 && save.phase === "running" && !stop(save); guard++) {
    save = step(save);
    onStep?.(save);
  }
  return save;
}

const resultOf = (save: CareerSave, id: string): CompactEventResult | undefined =>
  save.eventResults.find((r) => r.eventId === id);

// ---------------------------------------------------------------------------
// A season through the real flow
// ---------------------------------------------------------------------------

/**
 * Plays a season to its review, checking every regional weekend on the
 * following Monday: both fields well-formed, every org of every region in one
 * of the two events, and Sunday banking every row (local sides included) into
 * the split table — and nothing else.
 */
function playSeasonChecked(input: CareerSave): { save: CareerSave; localRows: number; checked: string[]; directWeeks: number } {
  let save = input;
  let snapshot: CareerSave["competition"]["splitPoints"] | null = null;
  let localRows = 0;
  let directWeeks = 0;
  const checked: string[] = [];

  const checkWeek = (s: CareerSave, week: number) => {
    for (const region of REGIONS) {
      const q = resultOf(s, qualifierDefsForWeek(0, week).find((d) => d.region === region)!.id);
      const reg = resultOf(s, officialEventDefsForWeek(0, week).find((d) => d.region === region)!.id);
      expect(q, `${region} qualifier W${week}`).toBeDefined();
      expect(reg, `${region} regional W${week}`).toBeDefined();
      const qRefs = q!.rows.map((r) => r.ref);
      const rRefs = reg!.rows.map((r) => r.ref);
      expect(new Set(qRefs).size).toBe(16);
      expect(new Set(rRefs).size).toBe(16);
      expect(q!.rows.filter((r) => r.placement !== "swiss_exit")).toHaveLength(8);
      // Nobody plays both events unless Saturday sent them through; the 8 qualified play Sunday.
      const qualified = q!.rows.filter((r) => r.placement !== "swiss_exit").map((r) => r.ref);
      for (const ref of qualified) expect(rRefs, `${region} W${week}: ${ref} qualified`).toContain(ref);
      // No org of the region is out of both events (R40's "missing 8th org").
      for (const org of Object.values(s.world.orgs).filter((o) => o.region === region)) {
        expect(qRefs.includes(org.ref) || rRefs.includes(org.ref), `${region} W${week}: ${org.ref}`).toBe(true);
      }
      // Sunday banks EVERY row into the split table — locals too — and nothing else moved.
      const before = snapshot![region] ?? {};
      const after = s.competition.splitPoints[region] ?? {};
      for (const row of reg!.rows) {
        expect((after[row.ref] ?? 0) - (before[row.ref] ?? 0), `${region} W${week}: ${row.ref}`).toBe(row.points);
        if (isLocalRef(row.ref)) {
          localRows += 1;
          expect(localRegionOf(row.ref)).toBe(region);
          expect(row.name).toBe(localTeamName(row.ref, s.careerSeed));
        }
      }
      for (const ref of Object.keys(after)) if (!rRefs.includes(ref)) expect(after[ref]).toBe(before[ref]);
    }
    checked.push(`W${week}`);
  };

  save = playUntil(
    save,
    () => false, // to the season review
    (s) => {
      const week = weekOfDay(s.clock.day);
      const dow = dayOfWeekOf(s.clock.day);
      // A regional Monday: was the user committed to a direct seat?
      if (weekAt(week).kind === "regional" && dow === 1 && s.competition.weekSeeding?.week === week) {
        if (s.competition.weekSeeding.direct.includes("user")) directWeeks += 1;
      }
      // Snapshot the split tables on the regional Saturday (Sunday banks the points).
      if (weekAt(week).kind === "regional" && dow === 6 && !s.activeEvent) snapshot = structuredClone(s.competition.splitPoints);
      // The Monday after a regional week: that weekend is complete.
      if (dow === 1 && week > 1 && weekAt(week - 1).kind === "regional" && !checked.includes(`W${week - 1}`)) checkWeek(s, week - 1);
      // A Major / Worlds Monday: 16 distinct refs, every one resolvable.
      for (const refs of [s.competition.majorFieldRefs, s.competition.worldsFieldRefs]) {
        if (!refs) continue;
        expect(new Set(refs).size).toBe(16);
        for (const ref of refs) {
          const ok = ref === "user" || Boolean(s.world.orgs[ref]) || (isLocalRef(ref) && localRegionOf(ref) !== null);
          expect(ok, ref).toBe(true);
        }
      }
    },
  );
  return { save, localRows, checked, directWeeks };
}

describe("RTW-01 (R49): a season through the real flow", { timeout: 120_000 }, () => {
  it("every regional banks every team, local sides included; weekend fields stay well-formed; the fields resolve", () => {
    const { save, localRows, checked } = playSeasonChecked(freshCareer());
    expect(checked).toHaveLength(REG_WEEKS.length);
    // The local scene really took part: some local sides played (and scored in) the regionals.
    expect(localRows).toBeGreaterThan(0);
    const worlds = save.eventResults.find((r) => r.tier === "worlds");
    expect(worlds?.rows).toHaveLength(16);
    expect(save.phase).toBe("seasonReview");
    // The season review's table is the Worlds table's own order.
    const table = raceTableOf(save, save.identity.region, "worlds");
    const review = save.history[save.history.length - 1];
    expect(review.regionTable.map((r) => r.ref)).toEqual(
      table.rows.filter((r) => (save.competition.seasonPoints[save.identity.region] ?? {})[r.ref] !== undefined).slice(0, 8).map((r) => r.ref),
    );
  });

  it("the same holds with the user in the direct 8 (their region's Saturday then resolves without them)", () => {
    const strong = freshCareer(31337, "EU");
    for (const p of strong.squad) p.overall = 92;
    const { checked, directWeeks } = playSeasonChecked(strong);
    expect(checked).toHaveLength(REG_WEEKS.length);
    expect(directWeeks).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Seeding, anchor, the Major, the tables
// ---------------------------------------------------------------------------

describe("RTW-01 (R49): seeding, the anchor, a Major and the race tables", { timeout: 120_000 }, () => {
  it("regionOfRef / nameOfRef resolve a local side from its ref (its Major points bank at home)", () => {
    const save = freshCareer();
    const ref = localRef("OCE", 0, 2);
    expect(regionOfRef(save, ref)).toBe("OCE");
    expect(nameOfRef(save, ref)).toBe(localTeamName(ref, save.careerSeed));
    expect(regionOfRef(save, "user")).toBe("SAM");
  });

  it("the Monday commit seats a scoring local side in the direct 8; Saturday skips it, Sunday fields it — lobby = engine", () => {
    // The second regional week's eve, a SAM local side top of the split table.
    let save = playUntil(freshCareer(), (s) => s.clock.day >= firstDayOfWeek(REG_WEEKS[1]) - 1);
    const local = localRef("SAM", 0, 3);
    save = structuredClone(save);
    save.competition.splitPoints.SAM = { ...save.competition.splitPoints.SAM, [local]: 5_000 };
    save = advanceDayFlow(save); // Monday: commit
    const seeding = save.competition.weekSeeding!;
    expect(seeding.week).toBe(REG_WEEKS[1]);
    expect(seeding.direct).toContain(local);
    expect([...seeding.direct, ...seeding.rest].filter((r) => r === local)).toHaveLength(1);
    // Saturday's qualifier (the user's, unless they went direct): the local side is not in it.
    save = playUntil(save, (s) => s.clock.day >= qualifierDefsForWeek(0, REG_WEEKS[1])[0].day);
    const qDef = qualifierDefsForWeek(0, REG_WEEKS[1]).find((d) => d.region === "SAM")!;
    if (!userIsDirect(save)) {
      expect(save.pendingEventDef?.id).toBe(qDef.id);
      const lobby = lobbyFieldRefs(save, qDef, eventTeamPreview(save, qDef).rating.total);
      const engine = Object.keys(startEvent(save, false).activeEvent!.tournament.teams);
      expect([...lobby].sort()).toEqual([...engine].sort());
      expect(engine).not.toContain(local);
    }
    // Sunday: the local side plays the regional from its direct seat.
    save = playUntil(save, (s) => s.clock.day >= regionalDayFor(REG_WEEKS[1]) + 1);
    const reg = resultOf(save, officialEventDefsForWeek(0, REG_WEEKS[1]).find((d) => d.region === "SAM")!.id)!;
    expect(reg.rows.map((r) => r.ref)).toContain(local);
    expect(resultOf(save, qDef.id)!.rows.map((r) => r.ref)).not.toContain(local);
  });

  it("the anchor freezes on the first regional Monday and holds: a better squad never moves a local side", () => {
    let save = playUntil(freshCareer(), (s) => s.clock.day >= firstDayOfWeek(FIRST_REG) - 1);
    expect(save.competition.localAnchor ?? null).toBeNull();
    // The squad's best trio as it stands on the eve (nothing trains on a weekend).
    const expected = localAnchorRatingFor(save);
    save = advanceDayFlow(save);
    expect(save.competition.localAnchor).toEqual({ region: "SAM", rating: expected });
    const ref = localRef("SAM", 0, 5);
    const before = localSideRatingOf(save, ref);
    const stronger = structuredClone(save);
    for (const p of stronger.squad) p.overall = 95;
    expect(localSideRatingOf(stronger, ref)).toBe(before);
    expect(localSideRatingOf(stronger, ref, { def: { tier: "qualifier" }, userRating: 95 })).toBe(before);
    expect(before).toBe(localTeamTarget(ref, expected, save.careerSeed));
    // Another region's sides sit around its stored median.
    const eu = localRef("EU", 0, 1);
    expect(localSideRatingOf(save, eu)).toBe(localTeamTarget(eu, regionMedianRating(save.world, "EU"), save.careerSeed));
  });

  it("the anchor is the squad's best trio: a weaker lineup or an armed bootcamp on the eve never moves it", () => {
    const base = freshCareer();
    base.finances.balance = 1_000_000;
    // A weak sub, signed in the preseason window.
    const ctx = { careerSeed: base.careerSeed, seasonIndex: 0, world: base.world };
    const weakest = base.world.freeAgentIds
      .map((id) => playerViewById(id, ctx))
      .filter((v): v is CareerPlayerView => v !== null && isCompetitiveAge(v.age))
      .sort((a, b) => a.overall - b.overall || a.id.localeCompare(b.id))[0];
    const signed = signPlayerFlow(base, weakest.id, { lengthSeasons: 1 });
    expect(signed.error).toBeUndefined();
    const eve = playUntil(signed.save, (s) => s.clock.day >= firstDayOfWeek(FIRST_REG) - 1);
    expect(eve.squad).toHaveLength(4);
    const best = eve.squad.filter((p) => eve.starterIds.includes(p.id)).sort((a, b) => b.overall - a.overall)[0];
    const swapped = setStartersFlow(
      eve,
      eve.starterIds.map((id) => (id === best.id ? weakest.id : id)) as [string, string, string],
    );
    expect(swapped.error).toBeUndefined();
    const armed = structuredClone(eve);
    armed.finances.bootcampSharp = 1;
    // Both really move the fielded rating (the R45 seeding number)…
    expect(userSeedRatingFor(swapped.save)).toBeLessThan(userSeedRatingFor(eve));
    expect(userSeedRatingFor(armed)).toBeGreaterThan(userSeedRatingFor(eve));
    // …and neither moves the anchor frozen that Monday.
    const anchorOf = (s: CareerSave) => advanceDayFlow(s).competition.localAnchor;
    const honest = anchorOf(eve);
    expect(honest).toEqual({ region: "SAM", rating: localAnchorRatingFor(eve) });
    expect(anchorOf(swapped.save)).toEqual(honest);
    expect(anchorOf(armed)).toEqual(honest);
  });

  it("a Major with local sides plays end to end through the real flow, deterministically, and banks at home", () => {
    // The Major week's eve: the user and a SAM local side top the SAM split table.
    let save = playUntil(freshCareer(), (s) => s.clock.day >= firstDayOfWeek(MAJOR_W) - 1);
    const local = localRef("SAM", 0, 4);
    save = structuredClone(save);
    save.competition.splitPoints.SAM = { ...save.competition.splitPoints.SAM, user: 90_000, [local]: 80_000 };
    save = advanceDayFlow(save); // Monday: the field
    expect(save.competition.majorFieldRefs).toContain("user");
    expect(save.competition.majorFieldRefs).toContain(local);
    save = playUntil(save, (s) => s.clock.day >= officialEventDefsForWeek(0, MAJOR_W)[0].day);
    const def = save.pendingEventDef!;
    expect(def.tier).toBe("major");
    // The lobby lists the side (named), at the rating the engine fields.
    const started = startEvent(save, false);
    const team = started.activeEvent!.tournament.teams[local];
    expect(team.name).toBe(localTeamName(local, save.careerSeed));
    expect(team.playerNames).toHaveLength(3);
    expect(Math.abs(team.rating.total - team.rating.difficultyShift - localSideRatingOf(save, local))).toBeLessThanOrEqual(1);
    // The same Major without the user (a spectator's view) fields the same side.
    const spectator = fieldForEvent(def, {
      world: save.world,
      competition: save.competition,
      userTeam: null,
      userRegion: save.identity.region,
      careerSeed: save.careerSeed,
      difficulty: save.difficulty,
    }).field.find((t) => t.id === local)!;
    expect(spectator.rating).toEqual(team.rating);
    const play = (s: CareerSave) => playUntil(s, (x) => resultOf(x, def.id) !== undefined);
    const a = play(save);
    const b = play(save);
    const result = resultOf(a, def.id)!;
    expect(resultOf(b, def.id)).toEqual(result);
    const row = result.rows.find((r) => r.ref === local)!;
    expect(row.name).toBe(team.name);
    // Major points bank into the side's HOME season table (SAM), nowhere else.
    expect((a.competition.seasonPoints.SAM[local] ?? 0) - (save.competition.seasonPoints.SAM[local] ?? 0)).toBe(row.points);
    for (const region of REGIONS.filter((r) => r !== "SAM")) expect(a.competition.seasonPoints[region][local]).toBeUndefined();
    // The AI-only resolver agrees on who played.
    const ai = simulateAiEvent(def, { world: save.world, competition: save.competition, careerSeed: save.careerSeed, difficulty: save.difficulty });
    expect(ai.teams[local].name).toBe(team.name);
  });

  it("the race tables cut exactly where the Major field is, on its Monday", () => {
    const save = playUntil(freshCareer(), (s) => s.clock.day >= firstDayOfWeek(MAJOR_W));
    const field = save.competition.majorFieldRefs!;
    expect(field).toEqual(majorFieldFor(save.competition, save.careerSeed));
    for (const region of REGIONS) {
      const t = raceTableOf(save, region, "major");
      const inCut = t.rows.filter((r) => r.inCut).map((r) => r.ref);
      expect(inCut).toEqual(field.filter((ref) => (save.competition.splitPoints[region] ?? {})[ref] !== undefined));
      expect(t.rows.filter((r) => r.qualified).map((r) => r.ref).sort()).toEqual([...inCut].sort());
      expect(t.fixturesLeft.total).toBe(0);
      for (const r of t.rows) expect(r.side).toBe(sideOfRef(r.ref));
    }
    // The Worlds table: the season's races so far, fixtures still ahead.
    const worlds = raceTableOf(save, "SAM", "worlds");
    expect(worlds.fixturesLeft).toEqual({ regionals: 6, majors: 3, total: 9 });
    expect(worlds.rows.slice(0, worlds.cut).map((r) => r.ref)).toEqual(
      worldsFieldFor(save.competition, save.careerSeed).filter((ref) => (save.competition.seasonPoints.SAM ?? {})[ref] !== undefined),
    );
  });
});

// ---------------------------------------------------------------------------
// Saves from before rc.31
// ---------------------------------------------------------------------------

/** What a pre-rc.31 save looks like: no local points on file, no frozen anchor. */
function asPreRc31(save: CareerSave): CareerSave {
  const old = structuredClone(save);
  for (const table of [old.competition.splitPoints, old.competition.seasonPoints]) {
    for (const region of REGIONS) {
      for (const ref of Object.keys(table[region] ?? {})) if (isLocalRef(ref)) delete table[region][ref];
    }
  }
  delete old.competition.localAnchor;
  return old;
}

/** The store's load path: a JSON round-trip, the additive migrations, the squad self-heal. */
function load(save: CareerSave): CareerSave {
  const loaded = migrateSaveToV5(JSON.parse(JSON.stringify(save)))!;
  syncSquadRoles(loaded);
  return loaded;
}

describe("RTW-01 (R49): saves from before rc.31", { timeout: 120_000 }, () => {
  it("mid-split (the third regional's Thursday): loads, plays the weekend and the announced Major, then scores locals going forward", () => {
    const mid = playUntil(freshCareer(), (s) => s.clock.day >= firstDayOfWeek(REG_WEEKS[2]) + 3);
    let save = load(asPreRc31(mid));
    expect(save.competition.localAnchor).toBeUndefined();
    expect(Object.values(save.competition.splitPoints).every((t) => Object.keys(t).every((r) => !isLocalRef(r)))).toBe(true);
    // This week (its Monday already passed): no anchor yet, the shipped rating around the user.
    const ref = localRef("SAM", 0, 1);
    expect(localSideRatingOf(save, ref)).toBe(localTeamTarget(ref, userSeedRatingFor(save), save.careerSeed));
    // The weekend plays; the next Monday freezes the anchor; the Major field is announced and plays.
    save = playUntil(save, (s) => s.clock.day >= firstDayOfWeek(REG_WEEKS[2] + 1));
    expect(save.competition.localAnchor?.region).toBe("SAM");
    save = playUntil(save, (s) => resultOf(s, officialEventDefsForWeek(0, MAJOR_W)[0].id) !== undefined);
    expect(resultOf(save, officialEventDefsForWeek(0, MAJOR_W)[0].id)!.rows).toHaveLength(16);
    // Split 2's first regional banks its local sides like any team.
    save = playUntil(save, (s) => s.clock.day > regionalDayFor(REG_WEEKS[3]));
    const banked = REGIONS.flatMap((r) => Object.keys(save.competition.splitPoints[r]).filter(isLocalRef));
    const played = REGIONS.flatMap((r) =>
      resultOf(save, officialEventDefsForWeek(0, REG_WEEKS[3]).find((d) => d.region === r)!.id)!
        .rows.filter((row) => isLocalRef(row.ref))
        .map((row) => row.ref),
    );
    expect(banked.sort()).toEqual(played.sort());
  });

  it("with the Major and Worlds fields announced (old refs only): loads and plays both", () => {
    // The Major week's Tuesday: the field is on file, the user possibly in it.
    const majorWeek = playUntil(freshCareer(), (s) => s.clock.day >= firstDayOfWeek(MAJOR_W) + 1);
    let save = load(asPreRc31(majorWeek));
    expect(save.competition.majorFieldRefs).toHaveLength(16);
    save = playUntil(save, (s) => resultOf(s, officialEventDefsForWeek(0, MAJOR_W)[0].id) !== undefined);
    expect(resultOf(save, officialEventDefsForWeek(0, MAJOR_W)[0].id)!.rows.map((r) => r.ref).sort()).toEqual(
      [...majorWeek.competition.majorFieldRefs!].sort(),
    );
    // The Worlds window: the field announced, then Worlds plays to the season review.
    const eve = playUntil(save, (s) => s.clock.day >= firstDayOfWeek(CAREER_CALENDAR.worldsWindowWeek) + 1);
    expect(eve.competition.worldsFieldRefs).toHaveLength(16);
    const done = playUntil(load(asPreRc31(eve)), () => false);
    expect(done.phase).toBe("seasonReview");
    expect(done.eventResults.find((r) => r.tier === "worlds")?.rows).toHaveLength(16);
    // The next season starts clean: no anchor until its first regional Monday.
    const next = rolloverToNextSeason(done);
    expect(next.competition.localAnchor ?? null).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// The sweep (opt-in): how often do local sides take Major / Worlds slots?
// ---------------------------------------------------------------------------

const env = process.env;
const list = <T extends string>(v: string | undefined, all: readonly T[]): T[] =>
  v ? (v.split(",").filter((x) => (all as readonly string[]).includes(x)) as T[]) : [...all];

it.skipIf(!env.RTW_LOCALS)(
  "local sides vs real orgs in the Major and Worlds fields (measures only)",
  () => {
    const regions = list(env.RTW_REGIONS, REGIONS);
    const diffs = list(env.RTW_DIFFS, ["easy", "normal", "hard"] as const);
    const seeds = Number(env.RTW_SEEDS ?? 1);
    const seasons = Number(env.RTW_SEASONS ?? 3);
    type Tally = { slots: number; local: number; generic: number; org: number; user: number; fields: number };
    const blank = (): Tally => ({ slots: 0, local: 0, generic: 0, org: 0, user: 0, fields: 0 });
    // key: `${kind}|${region}|${view}|${difficulty}` — view "ai" (another region's career) or "home".
    const tallies = new Map<string, Tally>();
    const regionalSeats = new Map<string, { seats: number; local: number; direct: number; directLocal: number }>();
    const counted = new Set<string>();
    const add = (key: string, refs: string[]) => {
      const t = tallies.get(key) ?? blank();
      t.fields += 1;
      for (const ref of refs) {
        t.slots += 1;
        t[sideOfRef(ref) as "local" | "generic" | "org" | "user"] += 1;
      }
      tallies.set(key, t);
    };
    const t0 = Date.now();
    let careers = 0;
    let n = 0;
    for (const region of regions) {
      for (const difficulty of diffs) {
        for (let k = 0; k < seeds; k++) {
          n += 1;
          let save = freshCareer(910_000 + n * 7919, region, difficulty);
          careers += 1;
          for (let s = 0; s < seasons && save.phase !== "ended"; s++) {
            let lastMajor = "";
            const seasonIndex = save.clock.seasonIndex;
            save = playUntil(
              save,
              () => false,
              (x) => {
                const week = weekOfDay(x.clock.day);
                if (dayOfWeekOf(x.clock.day) === 1 && week === 24) {
                  for (const p of x.squad.filter((q) => q.contractEndSeason <= x.clock.seasonIndex)) {
                    const res = renewPlayerFlow(x, p.id, 2);
                    if (!res.error) Object.assign(x, res.save);
                  }
                }
                // Measurement only: a deep-pocketed owner keeps the career alive, so every
                // season's fields get measured (insolvency ends most hands-off careers early).
                if (dayOfWeekOf(x.clock.day) === 1 && x.finances.balance < 100_000) x.finances.balance = 100_000;
                const mf = x.competition.majorFieldRefs;
                if (mf && mf.join() !== lastMajor) {
                  lastMajor = mf.join();
                  for (const r of REGIONS) {
                    const view = r === x.identity.region ? "home" : "ai";
                    add(`major|${r}|${view}|${difficulty}`, mf.filter((ref) => regionOfRef(x, ref) === r));
                  }
                }
                const weekKey = `${n}:${seasonIndex}:${week}`;
                if (dayOfWeekOf(x.clock.day) === 1 && week > 1 && weekAt(week - 1).kind === "regional" && !counted.has(weekKey)) {
                  counted.add(weekKey);
                  for (const r of REGIONS) {
                    const res = resultOf(x, officialEventDefsForWeek(seasonIndex, week - 1).find((d) => d.region === r)!.id);
                    const q = resultOf(x, qualifierDefsForWeek(seasonIndex, week - 1).find((d) => d.region === r)!.id);
                    if (!res || !q) continue;
                    const qualified = new Set(q.rows.filter((row) => row.placement !== "swiss_exit").map((row) => row.ref));
                    const view = r === x.identity.region ? "home" : "ai";
                    const cell = regionalSeats.get(`${r}|${view}`) ?? { seats: 0, local: 0, direct: 0, directLocal: 0 };
                    cell.seats += res.rows.length;
                    cell.local += res.rows.filter((row) => isLocalRef(row.ref)).length;
                    const direct = res.rows.filter((row) => !qualified.has(row.ref));
                    cell.direct += direct.length;
                    cell.directLocal += direct.filter((row) => isLocalRef(row.ref)).length;
                    regionalSeats.set(`${r}|${view}`, cell);
                  }
                }
              },
            );
            const wf = save.competition.worldsFieldRefs;
            if (wf) {
              for (const r of REGIONS) {
                const view = r === save.identity.region ? "home" : "ai";
                add(`worlds|${r}|${view}|${difficulty}`, wf.filter((ref) => regionOfRef(save, ref) === r));
              }
            }
            if (save.phase === "seasonReview" && s < seasons - 1) {
              if (save.end.ended) {
                save = structuredClone(save);
                save.end.infinite = true;
                save.end.creditsShown = true;
              }
              save = rolloverToNextSeason(save);
            }
          }
        }
      }
    }
    const pct = (a: number, b: number) => (b ? `${((100 * a) / b).toFixed(1)} %` : "—");
    const lines: string[] = [
      `# Local sides in the Major / Worlds fields (RTW-01, R49)`,
      ``,
      `${careers} careers (${regions.join(", ")} × ${diffs.join(", ")} × ${seeds} seed), ${seasons} seasons each, hands-off manager; ${Math.round((Date.now() - t0) / 1000)} s.`,
      `"ai" = the region seen from another region's career (its locals around its stored median); "home" = the user's own region (its locals around the user).`,
      ``,
      `| race | region | view | difficulty | fields | slots | local | generic org | real org | user |`,
      `|---|---|---|---|---:|---:|---:|---:|---:|---:|`,
    ];
    for (const kind of ["major", "worlds"]) {
      for (const r of REGIONS) {
        for (const view of ["ai", "home"]) {
          for (const d of diffs) {
            const t = tallies.get(`${kind}|${r}|${view}|${d}`);
            if (!t) continue;
            lines.push(
              `| ${kind} | ${r} | ${view} | ${d} | ${t.fields} | ${t.slots} | ${t.local} (${pct(t.local, t.slots)}) | ${t.generic} (${pct(t.generic, t.slots)}) | ${t.org} (${pct(t.org, t.slots)}) | ${t.user} |`,
            );
          }
        }
      }
    }
    lines.push(
      ``,
      `| region | view | Sunday regional seats | held by local sides | direct-8 seats | held by local sides |`,
      `|---|---|---:|---:|---:|---:|`,
    );
    for (const r of REGIONS) {
      for (const view of ["ai", "home"]) {
        const cell = regionalSeats.get(`${r}|${view}`);
        if (!cell) continue;
        lines.push(
          `| ${r} | ${view} | ${cell.seats} | ${cell.local} (${pct(cell.local, cell.seats)}) | ${cell.direct} | ${cell.directLocal} (${pct(cell.directLocal, cell.direct)}) |`,
        );
      }
    }
    const all = [...tallies.entries()];
    for (const kind of ["major", "worlds"]) {
      const sum = all.filter(([k]) => k.startsWith(kind)).reduce((acc, [, t]) => {
        for (const f of ["slots", "local", "generic", "org", "user"] as const) acc[f] += t[f];
        return acc;
      }, blank());
      lines.push(``, `**${kind}**: ${sum.slots} slots — local ${pct(sum.local, sum.slots)}, generic org ${pct(sum.generic, sum.slots)}, real org ${pct(sum.org, sum.slots)}, user ${pct(sum.user, sum.slots)}.`);
    }
    const md = lines.join("\n");
    if (env.RTW_MD) writeFileSync(env.RTW_MD, md);
    else console.log(md);
    expect(careers).toBeGreaterThan(0);
  },
  7_200_000,
);
