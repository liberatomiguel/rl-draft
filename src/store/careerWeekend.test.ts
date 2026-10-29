/**
 * Road to Worlds v2.0 (R40) — the weekend calendar through the REAL flow:
 *  - regional week: qualifier SATURDAY (Swiss only: the 8 with 3 wins
 *    qualify, nobody is crowned) → regional SUNDAY;
 *  - Major / Worlds: Swiss stage SATURDAY → the event pauses (a reload keeps
 *    it) → playoffs SUNDAY ("Championship Sunday") → finishEvent once;
 *  - legacy saves (the pre-R40 midweek-qualifier / Saturday layout) migrate additively —
 *    never a softlock, never a duplicated effect.
 * Results are forced by roster strength (99 vs 40), never by a lucky seed,
 * so a change to the Swiss pairing cannot flip these assertions.
 */

import { describe, expect, it } from "vitest";
import {
  CAREER_CALENDAR,
  CAREER_ECONOMY,
  CAREER_PRIZES,
  CAREER_QUALIFIER,
  CAREER_REP,
  CAREER_SAVE,
  CAREER_SLOTS,
  TOURNAMENT,
} from "@/config/balance";
import {
  DAYS_PER_SEASON,
  eventDayFor,
  firstDayOfWeek,
  officialEventDefsForWeek,
  playoffsDayFor,
  qualifierDayFor,
  qualifierDefsForWeek,
  regionalDayFor,
  seasonSchedule,
} from "@/engine/career/calendar";
import { hasChampion, qualifierOutcomeOf } from "@/engine/career/careerResults";
import { applyMatchXp } from "@/engine/career/development";
import { gearTrainingBonus, pointsFor, prizeFor, prizePoolPaidFor, quantize, repGainFor, repTierOf } from "@/engine/career/economy";
import type {
  CareerDifficulty,
  CareerEventDef,
  CareerEventFormat,
  CareerSave,
  CompactEventResult,
  EventTier,
} from "@/engine/career/types";
import { seedsFromSwiss } from "@/engine/swiss";
import { fastForward, playNextRound } from "@/engine/tournament";
import type { Region } from "@/engine/types";
import { createRng } from "@/lib/rng";
import {
  acceptBidFlow,
  advanceDayFlow,
  advanceToNextStopFlow,
  continueEventToNextDayFlow,
  createCareerSave,
  eventDayPhaseOf,
  finishEvent,
  isChampionshipSunday,
  isEventPaused,
  isLegacySaturdayPlayoffs,
  migrateSaveToV4,
  regionalUserEligible,
  releasePlayerFlow,
  rolloverToNextSeason,
  setStartersFlow,
  signPlayerFlow,
  simEventToEnd,
  startEvent,
  stepEventRound,
  userEventDefOnDay,
  userIsDirect,
  userOwnsQualifier,
  userSeedRatingFor,
  type CreateCareerInput,
} from "./careerFlow";
import { eventTeamPreview, upcomingStops } from "@/components/career/careerUi";
import { lobbyFieldRefs } from "@/components/career/event/lobbyField";

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
/** A starter roster outside the direct 8 at the first regional (careerV2.test). */
const SEED = 55501;
const W = seasonSchedule().find((w) => w.kind === "regional")!.week;
/** The regional week after W — a week the current seeding only previews. */
const NEXT_W = seasonSchedule().find((w) => w.kind === "regional" && w.week > W)!.week;
const MAJOR_W = seasonSchedule().find((w) => w.kind === "major")!.week;
const WORLDS_W = CAREER_CALENDAR.worldsWeek;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A fresh career with the clock-stopping chores out of the way (no inserts, no offers). */
function freshCareer(seed = SEED): CareerSave {
  const save = createCareerSave(INPUT, seed);
  for (let s = 0; s < 2; s++) {
    for (let w = 1; w <= CAREER_CALENDAR.weeksPerSeason; w++) save.flags[`insertRolled:${s}:${w}`] = true;
  }
  save.sponsorOffers = null;
  return save;
}

/** Drops the decisions the batched Advance stops at (bids, sponsor offers). */
function quiet(save: CareerSave): CareerSave {
  return { ...save, sponsorOffers: null, pendingOffers: [] };
}

/** Day by day up to `day`; never plays — stops at a lobby it may not pass. */
function advanceTo(input: CareerSave, day: number): CareerSave {
  let save = input;
  let guard = 0;
  while (save.clock.day < day && save.phase === "running" && guard++ < 400) {
    const before = save.clock.day;
    save = advanceDayFlow(save);
    if (save.clock.day === before) break;
  }
  return save;
}

/** Enter today's lobby and instant-sim it; finishes unless the event pauses. */
function simToday(input: CareerSave): CareerSave {
  const save = simEventToEnd(startEvent(input, false));
  return save.activeEvent?.tournament.stage === "finished" ? finishEvent(save) : save;
}

/** Auto-plays (instant sim) up to `day`, handling lobbies and the Saturday pause. */
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
    save = advanceDayFlow(save);
    if (save.clock.day === before) throw new Error(`clock blocked on day ${before}`);
  }
  return save;
}

/** Every squad player at one overall — forces a result whatever the pairing. */
function withStrength(input: CareerSave, overall: number): CareerSave {
  const save = structuredClone(input);
  for (const p of save.squad) p.overall = overall;
  return save;
}

/** Monday of the first Major week with the user IN the field, advanced to its Saturday lobby. */
function majorSaturday(strength: number): CareerSave {
  let save = autoPlayTo(freshCareer(), firstDayOfWeek(MAJOR_W) - 1);
  // Top the split table: Monday's announcement fields the user.
  save.competition.splitPoints.SAM = { ...save.competition.splitPoints.SAM, user: 100_000 };
  save = advanceDayFlow(save);
  expect(save.competition.majorFieldRefs).toContain("user");
  expect(save.pendingEventDef).toMatchObject({ tier: "major", day: eventDayFor(MAJOR_W) });
  save = advanceTo(save, eventDayFor(MAJOR_W));
  expect(save.clock.day).toBe(eventDayFor(MAJOR_W));
  return withStrength(save, strength);
}

/** The W31 Sunday of a fresh career with the Worlds field announced (user in it or not). */
function worldsEve(userInField: boolean): CareerSave {
  const save = freshCareer();
  const refs: string[] = [];
  for (const region of Object.keys(CAREER_SLOTS.worlds) as Region[]) {
    const orgs = Object.values(save.world.orgs)
      .filter((o) => o.region === region)
      .map((o) => o.ref)
      .sort();
    refs.push(...orgs.slice(0, CAREER_SLOTS.worlds[region]));
  }
  if (userInField) refs[refs.indexOf(refs.find((r) => save.world.orgs[r].region === "SAM")!)] = "user";
  save.competition.worldsFieldRefs = refs;
  save.clock.day = firstDayOfWeek(WORLDS_W) - 1;
  return save;
}

/** Effect counters for one event (results, money, points, rep, news, stats, XP). */
function counters(save: CareerSave, def: CareerEventDef) {
  return {
    results: save.eventResults.filter((r) => r.eventId === def.id).length,
    prizeLines: save.finances.ledger.filter((l) => l.kind === "prize" && l.refName === def.name).length,
    resultNews: save.news.filter((n) => n.titleKey === "resultUser" && n.params?.event === def.name).length,
    championNews: save.news.filter((n) => n.titleKey === "seasonChampion" && n.params?.event === def.name).length,
    seasonPoints: save.competition.seasonPoints.SAM?.user ?? 0,
    balance: save.finances.balance,
    rep: save.reputation,
    majorsQualified: save.stats.majorsQualified,
    seriesPlayed: save.stats.seriesWins + save.stats.seriesLosses,
    xp: save.squad.reduce((n, p) => n + p.gainedThisSeason, 0),
    payrollLines: save.finances.ledger.filter((l) => l.kind === "payroll").length,
  };
}

function resultOf(save: CareerSave, def: CareerEventDef): CompactEventResult {
  const r = save.eventResults.find((x) => x.eventId === def.id);
  if (!r) throw new Error(`no result for ${def.id}`);
  return r;
}

// ---------------------------------------------------------------------------
// Regional weekend
// ---------------------------------------------------------------------------

describe("regional weekend (R40): qualifier Saturday → regional Sunday", () => {
  it("a non-direct user: Advance stops on the Saturday qualifier; qualifying lands Sunday's regional one Advance away", () => {
    let save = advanceTo(freshCareer(), firstDayOfWeek(W));
    expect(userIsDirect(save)).toBe(false);
    expect(save.pendingEventDef).toMatchObject({ tier: "qualifier", day: qualifierDayFor(W), format: "swissOnly" });
    expect(eventDayPhaseOf(save)).toBe("none");
    // Batched Advance from Monday lands on Saturday (not on any weekday).
    save = advanceToNextStopFlow(quiet(save));
    expect(save.clock.day).toBe(qualifierDayFor(W));
    expect(eventDayPhaseOf(save)).toBe("lobby");
    // Saturday arrival resolved the six AI qualifiers — and no regional yet.
    expect(save.eventResults.filter((r) => r.tier === "qualifier")).toHaveLength(6);
    expect(save.eventResults.some((r) => r.tier === "regional")).toBe(false);
    // An official lobby blocks the clock.
    expect(advanceDayFlow(save)).toBe(save);

    // A dominant roster qualifies.
    const played = simToday(withStrength(save, 99));
    expect(played.clock.day).toBe(qualifierDayFor(W));
    expect(played.activeEvent).toBeNull();
    expect(played.pendingEventDef).toMatchObject({ tier: "regional", region: "SAM", day: regionalDayFor(W) });
    expect(played.news.filter((n) => n.titleKey === "qualifiedRegional")).toHaveLength(1);
    expect(played.mail.filter((m) => m.titleKey === "qualifiedRegional")).toHaveLength(1);
    expect(played.competition.qualifiedRefs?.SAM?.refs).toContain("user");
    expect(eventDayPhaseOf(played)).toBe("none"); // Saturday is done for the user

    // One Advance → Sunday's lobby (the stop), the six AI regionals resolved on arrival.
    const sun = advanceToNextStopFlow(quiet(played));
    expect(sun.clock.day).toBe(regionalDayFor(W));
    expect(eventDayPhaseOf(sun)).toBe("lobby");
    expect(sun.eventResults.filter((r) => r.tier === "regional")).toHaveLength(6);
    expect(sun.eventResults.some((r) => r.tier === "regional" && r.region === "SAM")).toBe(false);
    // The regional fields the direct 8 + Saturday's 8 (a rematch is legitimate: new event).
    const reg = startEvent(sun, false);
    const ids = Object.keys(reg.activeEvent!.tournament.teams);
    expect(ids).toHaveLength(16);
    for (const ref of sun.competition.qualifiedRefs!.SAM!.refs) expect(ids).toContain(ref);
    expect(reg.activeEvent!.tournament.swissOnly).toBeUndefined(); // a full event
    const done = finishEvent(simEventToEnd(reg));
    expect(done.eventResults.filter((r) => r.tier === "regional")).toHaveLength(7);
    expect(hasChampion(resultOf(done, sun.pendingEventDef!))).toBe(true);
  });

  it("a direct user is never stopped on Saturday: Advance runs from Monday to Sunday's regional", () => {
    let save = advanceTo(freshCareer(), firstDayOfWeek(W) - 1);
    save.competition.splitPoints.SAM = { ...save.competition.splitPoints.SAM, user: 10_000 };
    save = advanceDayFlow(save); // the regional week's Monday commit
    expect(userIsDirect(save)).toBe(true);
    expect(save.pendingEventDef).toMatchObject({ tier: "regional", day: regionalDayFor(W) });
    expect(userEventDefOnDay(save, qualifierDayFor(W))).toBeNull();
    save = advanceToNextStopFlow(quiet(save));
    expect(save.clock.day).toBe(regionalDayFor(W));
    expect(eventDayPhaseOf(save)).toBe("lobby");
    // Saturday ran SAM's qualifier without the user: 8 qualified, never "user".
    expect(save.eventResults.filter((r) => r.tier === "qualifier")).toHaveLength(7);
    const q = save.competition.qualifiedRefs!.SAM!;
    expect(q.refs).toHaveLength(8);
    expect(q.refs).not.toContain("user");
    const reg = startEvent(save, false);
    expect(Object.keys(reg.activeEvent!.tournament.teams)).toContain("user");
  });

  it("out at the qualifier: missedRegional on Saturday, the regional resolves without the user on Sunday", () => {
    const sat = advanceTo(freshCareer(), qualifierDayFor(W));
    const played = simToday(withStrength(sat, 40));
    expect(played.pendingEventDef).toBeNull();
    expect(played.competition.qualifiedRefs!.SAM!.refs).not.toContain("user");
    expect(played.news.filter((n) => n.titleKey === "missedRegional")).toHaveLength(1);
    expect(played.mail.filter((m) => m.titleKey === "missedRegional")).toHaveLength(1);
    expect(played.eventResults.some((r) => r.tier === "regional" && r.region === "SAM")).toBe(false);
    expect(userEventDefOnDay(played, regionalDayFor(W))).toBeNull();
    // Sunday arrival: SAM's regional resolves headlessly (16 teams, no user).
    const sun = advanceDayFlow(played);
    expect(sun.clock.day).toBe(regionalDayFor(W));
    const reg = sun.eventResults.find((r) => r.tier === "regional" && r.region === "SAM")!;
    expect(reg.rows).toHaveLength(16);
    expect(reg.rows.some((r) => r.ref === "user")).toBe(false);
    // Nothing waits for the user on Sunday: the batched Advance runs past it.
    expect(advanceToNextStopFlow(quiet(played)).clock.day).toBeGreaterThan(regionalDayFor(W));
  });

  it("the qualifier is Swiss ONLY: 8 qualified + 8 out, no champion, qualifierAdvance rep, the flat prize table", () => {
    const sat = advanceTo(freshCareer(), qualifierDayFor(W));
    const lobby = startEvent(withStrength(sat, 99), false);
    const def = lobby.activeEvent!.def;
    expect(lobby.activeEvent!.tournament.swissOnly).toBe(true);
    const simmed = simEventToEnd(lobby);
    const t = simmed.activeEvent!.tournament;
    expect(t.stage).toBe("finished");
    expect(t.playoffs).toBeNull();
    expect(t.swiss.records.filter((r) => r.status === "advanced")).toHaveLength(8);

    const done = finishEvent(simmed);
    const result = resultOf(done, def);
    expect(result.rows.filter((r) => r.placement === "top8")).toHaveLength(8);
    expect(result.rows.filter((r) => r.placement === "swiss_exit")).toHaveLength(8);
    expect(result.rows.some((r) => r.placement === "champion")).toBe(false);
    expect(hasChampion(result)).toBe(false);
    expect(result.championRef).toBe(result.rows[0].ref); // the TOP SWISS SEED, never "champion"
    expect(result.userPlacement).toBe("top8");
    expect(qualifierOutcomeOf(result.tier, "top8")).toBe("qualified");
    expect(qualifierOutcomeOf(result.tier, "swiss_exit")).toBe("eliminated");
    expect(qualifierOutcomeOf("regional", "top8")).toBeNull();
    // Points: none. Prize: flat by outcome (rc.29: 10% qualified / 2.5% eliminated of the pool).
    expect(result.rows.every((r) => r.points === 0)).toBe(true);
    const pool = CAREER_PRIZES.pools.qualifier * CAREER_ECONOMY.prizeMult.normal;
    expect(prizeFor("qualifier", "top8", "swissOnly", "normal", 0)).toBe(quantize((pool * CAREER_PRIZES.swissOnlyPct.qualified) / 100));
    expect(prizeFor("qualifier", "swiss_exit", "swissOnly", "normal", 0)).toBe(quantize((pool * CAREER_PRIZES.swissOnlyPct.eliminated) / 100));
    for (const row of result.rows) {
      expect(row.prize).toBe(prizeFor("qualifier", row.placement, "swissOnly", "normal", 0));
    }
    // rc.29 (CAR-08): the flat table pays out the whole pool — the 16 rows sum
    // to the paid total the lobby advertises (prizePoolPaidFor).
    const paid = 8 * CAREER_PRIZES.swissOnlyPct.qualified + 8 * CAREER_PRIZES.swissOnlyPct.eliminated;
    expect(paid).toBe(100);
    expect(result.rows.reduce((sum, r) => sum + r.prize, 0)).toBe(
      prizePoolPaidFor("qualifier", "swissOnly", "normal", def.seasonIndex),
    );
    expect(done.finances.balance - simmed.finances.balance).toBe(result.rows.find((r) => r.ref === "user")!.prize);
    // Rep: qualifying pays qualifierAdvance — and nothing else (no qualifierWin any more).
    expect("qualifierWin" in CAREER_REP.gains).toBe(false);
    expect(done.reputation - simmed.reputation).toBe(repGainFor("qualifierAdvance", simmed.reputation));
    // One seeding rule: the qualified rows, the "top seed" and qualifiedRefs
    // follow the engine's own bracket seeding (seedsFromSwiss) — the list the
    // digest's "qualified eight" shows.
    const seeds = seedsFromSwiss(t.swiss, t.teams);
    expect(result.rows.filter((r) => r.placement === "top8").map((r) => r.ref)).toEqual(seeds);
    expect(result.championRef).toBe(seeds[0]);
    // qualifiedRefs = exactly the 8 qualified, in seed order, aimed at Sunday's regional.
    expect(done.competition.qualifiedRefs!.SAM).toEqual({
      eventId: def.id.replace(":qual", ":reg"),
      refs: result.rows.filter((r) => r.placement === "top8").map((r) => r.ref),
    });
    // The feed gets the tier (so "top8" reads "Qualified"); no champion news for a qualifier.
    const news = done.news.find((n) => n.titleKey === "resultUser")!;
    expect(news.params).toMatchObject({ event: def.name, placement: "top8", tier: "qualifier" });
    expect(done.news.some((n) => n.titleKey === "seasonChampion")).toBe(false);
    expect(done.stats.titlesRegional).toBe(sat.stats.titlesRegional);
  });

  it("every AI qualifier also stops at its Swiss: exactly 8 qualified per region, nobody crowned", () => {
    const sat = advanceTo(freshCareer(424242), qualifierDayFor(W));
    const quals = sat.eventResults.filter((r) => r.tier === "qualifier");
    expect(quals.length).toBeGreaterThanOrEqual(6);
    for (const q of quals) {
      expect(q.rows).toHaveLength(16);
      expect(q.rows.filter((r) => r.placement === "top8")).toHaveLength(8);
      expect(q.rows.filter((r) => r.placement === "swiss_exit")).toHaveLength(8);
      expect(q.rows.some((r) => r.placement === "champion")).toBe(false);
      expect(sat.competition.qualifiedRefs![q.region!]!.refs).toHaveLength(8);
    }
  });

  it("a whole split on the weekend layout: every qualifier and regional resolves exactly once", { timeout: 20_000 }, () => {
    const save = autoPlayTo(freshCareer(777001), firstDayOfWeek(MAJOR_W) - 1);
    const ids = save.eventResults.map((r) => r.eventId);
    expect(new Set(ids).size).toBe(ids.length);
    const weeks = seasonSchedule().filter((w) => w.kind === "regional" && w.split === 1).length;
    const regions = Object.keys(CAREER_SLOTS.major).length;
    expect(save.eventResults.filter((r) => r.tier === "qualifier")).toHaveLength(regions * weeks);
    expect(save.eventResults.filter((r) => r.tier === "regional")).toHaveLength(regions * weeks);
    for (const r of save.eventResults) expect(hasChampion(r)).toBe(r.tier !== "qualifier");
  });

  it("the week's commit is the authority: a user lifted into the direct 8 mid-week still plays (and fields) the qualifier", () => {
    const sat = advanceTo(freshCareer(), qualifierDayFor(W));
    expect(sat.pendingEventDef?.tier).toBe("qualifier");
    const drifted = structuredClone(sat);
    drifted.competition.splitPoints.SAM = { ...drifted.competition.splitPoints.SAM, user: 10_000 };
    // rc.30 (direct-8): Monday's committed seeding answers for this week;
    // only a later week previews the drift.
    expect(userIsDirect(drifted)).toBe(false);
    expect(userIsDirect(drifted, NEXT_W)).toBe(true);
    const lobby = startEvent(drifted, false);
    const ids = Object.keys(lobby.activeEvent!.tournament.teams);
    expect(ids).toHaveLength(16);
    expect(ids).toContain("user");
  });

  it("…and a direct user who drifted out of the 8 by Sunday still fields their regional", () => {
    let save = advanceTo(freshCareer(), firstDayOfWeek(W) - 1);
    save.competition.splitPoints.SAM = { ...save.competition.splitPoints.SAM, user: 10_000 };
    save = advanceTo(advanceDayFlow(save), regionalDayFor(W));
    expect(eventDayPhaseOf(save)).toBe("lobby");
    const drifted = structuredClone(save);
    delete drifted.competition.splitPoints.SAM.user;
    expect(userIsDirect(drifted)).toBe(true); // rc.30: the commit holds…
    expect(userIsDirect(drifted, NEXT_W)).toBe(false); // …a later week previews the drift
    const lobby = startEvent(drifted, false);
    const ids = Object.keys(lobby.activeEvent!.tournament.teams);
    expect(ids).toHaveLength(16);
    expect(ids).toContain("user");
  });

  it("the preview follows the week's commit: a direct user who drifts out of the 8 is never promised Saturday's qualifier", () => {
    let save = advanceTo(freshCareer(), firstDayOfWeek(W) - 1);
    save.competition.splitPoints.SAM = { ...save.competition.splitPoints.SAM, user: 10_000 };
    save = advanceDayFlow(save); // Monday: committed direct to Sunday's regional
    const regional = save.pendingEventDef!;
    expect(regional).toMatchObject({ tier: "regional", day: regionalDayFor(W) });
    delete save.competition.splitPoints.SAM.user; // drifts out of the direct 8 mid-week
    expect(userIsDirect(save)).toBe(true); // rc.30: Monday's committed seeding holds
    expect(userIsDirect(save, NEXT_W)).toBe(false);
    const q = qualifierDefsForWeek(0, W).find((d) => d.region === "SAM")!;
    expect(userOwnsQualifier(save, q)).toBe(false);
    expect(userEventDefOnDay(save, qualifierDayFor(W))).toBeNull();
    expect(userEventDefOnDay(save, regionalDayFor(W))).toEqual(regional);
    // The flow agrees: Saturday's qualifier runs without the user, the batched Advance stops on Sunday.
    const sun = advanceToNextStopFlow(quiet(save));
    expect(sun.clock.day).toBe(regionalDayFor(W));
    expect(eventDayPhaseOf(sun)).toBe("lobby");
    expect(resultOf(sun, q).rows.some((r) => r.ref === "user")).toBe(false);
    // A future qualifier still previews from today's seeding (outside the 8 → the qualifier).
    const next = qualifierDefsForWeek(0, W + 2).find((d) => d.region === "SAM");
    if (next) expect(userOwnsQualifier(save, next)).toBe(true);
  });

  it("…and a user out at the qualifier who drifts INTO the 8 is never promised Sunday's regional", () => {
    const sat = advanceTo(freshCareer(), qualifierDayFor(W));
    const drifted = structuredClone(simToday(withStrength(sat, 40)));
    expect(drifted.pendingEventDef).toBeNull();
    drifted.competition.splitPoints.SAM = { ...drifted.competition.splitPoints.SAM, user: 10_000 };
    expect(userIsDirect(drifted)).toBe(false); // rc.30: Monday's committed seeding holds
    expect(userIsDirect(drifted, NEXT_W)).toBe(true);
    const regional = officialEventDefsForWeek(0, W).find((d) => d.tier === "regional" && d.region === "SAM")!;
    expect(regionalUserEligible(drifted, regional)).toBe(false);
    expect(userEventDefOnDay(drifted, regionalDayFor(W))).toBeNull();
    // The qualifier the user played stays on its Saturday.
    expect(userEventDefOnDay(drifted, qualifierDayFor(W))?.tier).toBe("qualifier");
    // Sunday resolves the regional without the user — exactly what the preview said.
    const sun = advanceDayFlow(drifted);
    expect(eventDayPhaseOf(sun)).toBe("none");
    expect(resultOf(sun, regional).rows.some((r) => r.ref === "user")).toBe(false);
  });

  it("a direct user's region still fields 8 direct + 8 qualified: the org the user displaced plays Saturday", () => {
    let save = advanceTo(freshCareer(), firstDayOfWeek(W) - 1);
    save.competition.splitPoints.SAM = { ...save.competition.splitPoints.SAM, user: 10_000 };
    save = advanceToNextStopFlow(quiet(advanceDayFlow(save)));
    expect(save.clock.day).toBe(regionalDayFor(W));
    expect(eventDayPhaseOf(save)).toBe("lobby");
    const q = qualifierDefsForWeek(0, W).find((d) => d.region === "SAM")!;
    const qualifier = resultOf(save, q);
    expect(qualifier.rows).toHaveLength(TOURNAMENT.swiss.teams);
    expect(qualifier.rows.some((r) => r.ref === "user")).toBe(false);
    const regionalField = new Set(Object.keys(startEvent(save, false).activeEvent!.tournament.teams));
    expect(regionalField.size).toBe(TOURNAMENT.swiss.teams);
    const orgs = Object.values(save.world.orgs).filter((o) => o.region === "SAM").map((o) => o.ref);
    // Every org fits the weekend (7 direct beside the user + a 16-team qualifier)…
    expect(orgs.length).toBeLessThanOrEqual(CAREER_QUALIFIER.directSlots - 1 + TOURNAMENT.swiss.teams);
    // …so none may miss BOTH events.
    const inQualifier = new Set(qualifier.rows.map((r) => r.ref));
    expect(orgs.filter((ref) => !inQualifier.has(ref) && !regionalField.has(ref))).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Direct-8 (rc.30): Monday's seeding is the week's one decision
// ---------------------------------------------------------------------------

/**
 * Puts SAM's direct-8 line a hair from the user's team rating (the Monday
 * read, userSeedRatingFor): seven orgs clear above, the 8th just below
 * (`userAbove`) or just above it, the rest far below; nobody has split
 * points. Returns the 8th org's ref.
 */
function straddleLine(save: CareerSave, userAbove: boolean): string {
  const rating = userSeedRatingFor(save);
  const prestige = repTierOf(save.reputation) as 0 | 1 | 2 | 3;
  save.competition.splitPoints.SAM = {};
  const orgs = Object.values(save.world.orgs)
    .filter((o) => o.region === "SAM")
    .sort((a, b) => a.ref.localeCompare(b.ref));
  orgs.forEach((org, i) => {
    org.prestige = prestige;
    org.rating = i < 7 ? 99 - i : i === 7 ? rating + (userAbove ? -0.25 : 0.25) : 40 + i / 10;
  });
  return orgs[7].ref;
}

/** The event's field as the engine builds it, and as its lobby lists it. */
function fieldAndLobby(save: CareerSave): { field: string[]; lobby: string[] } {
  const def = save.pendingEventDef!;
  const field = Object.keys(startEvent(save, false).activeEvent!.tournament.teams).sort();
  const lobby = lobbyFieldRefs(save, def, eventTeamPreview(save, def).rating.total).sort();
  return { field, lobby };
}

describe("direct-8 (rc.30): Monday's seeding is the week's one decision", { timeout: 60_000 }, () => {
  it("a user seated in the 8 on Monday keeps the seat however the team drifts: Saturday fields the displaced org, Sunday is 8 + 8", () => {
    let save = advanceTo(freshCareer(), firstDayOfWeek(W) - 1);
    const eighth = straddleLine(save, true);
    save = advanceDayFlow(save); // Monday: the commit
    const committed = save.competition.weekSeeding!;
    expect(committed).toMatchObject({ seasonIndex: 0, week: W, region: "SAM" });
    expect(committed.direct).toHaveLength(CAREER_QUALIFIER.directSlots);
    expect(committed.direct).toContain("user");
    expect(committed.rest[0]).toBe(eighth);
    expect(save.pendingEventDef).toMatchObject({ tier: "regional", day: regionalDayFor(W) });
    // Mid-week the team collapses: a live read would drop the user out of the 8.
    save = withStrength(save, 40);
    expect(userIsDirect(save)).toBe(true);
    save = advanceToNextStopFlow(quiet(save));
    expect(save.clock.day).toBe(regionalDayFor(W));
    expect(eventDayPhaseOf(save)).toBe("lobby");
    // Saturday's AI qualifier fielded the displaced org, never the user or a direct org.
    const q = qualifierDefsForWeek(0, W).find((d) => d.region === "SAM")!;
    const inQualifier = resultOf(save, q).rows.map((r) => r.ref);
    expect(inQualifier).toContain(eighth);
    for (const ref of committed.direct) expect(inQualifier).not.toContain(ref);
    // Sunday: the committed direct 8 + Saturday's eight — lobby and engine alike.
    const qualified = save.competition.qualifiedRefs!.SAM!.refs;
    const { field, lobby } = fieldAndLobby(save);
    expect(field).toHaveLength(TOURNAMENT.swiss.teams);
    expect(field).toEqual([...committed.direct, ...qualified].sort());
    expect(lobby).toEqual(field);
  });

  it("a user outside the 8 on Monday plays Saturday and never takes a direct seat Sunday, even after drifting above the line", () => {
    let save = advanceTo(freshCareer(), firstDayOfWeek(W) - 1);
    const eighth = straddleLine(save, false);
    save = advanceDayFlow(save);
    const committed = save.competition.weekSeeding!;
    expect(committed.direct).not.toContain("user");
    expect(committed.direct).toContain(eighth);
    expect(save.pendingEventDef).toMatchObject({ tier: "qualifier", day: qualifierDayFor(W) });
    // Mid-week the team surges: a live read would now seat the user in the 8.
    save = withStrength(save, 99);
    expect(userIsDirect(save)).toBe(false);
    save = advanceToNextStopFlow(quiet(save));
    expect(save.clock.day).toBe(qualifierDayFor(W));
    const sat = fieldAndLobby(save);
    expect(sat.field).toContain("user");
    expect(sat.field).not.toContain(eighth);
    expect(sat.lobby).toEqual(sat.field);
    save = simToday(save); // 99s: through to Sunday
    const qualified = save.competition.qualifiedRefs!.SAM!.refs;
    expect(qualified).toContain("user");
    save = advanceToNextStopFlow(quiet(save));
    expect(save.clock.day).toBe(regionalDayFor(W));
    const sun = fieldAndLobby(save);
    expect(sun.field).toHaveLength(TOURNAMENT.swiss.teams);
    expect(sun.field).toEqual([...committed.direct, ...qualified].sort());
    expect(sun.lobby).toEqual(sun.field);
  });

  it("other weeks preview live; the seeding is re-decided on the next regional Monday", () => {
    let save = advanceTo(freshCareer(), firstDayOfWeek(W) - 1);
    straddleLine(save, true);
    save = advanceDayFlow(save);
    expect(userIsDirect(save)).toBe(true);
    // A collapse previews as "outside the 8" for the next regional week only.
    save = withStrength(save, 40);
    expect(userIsDirect(save, NEXT_W)).toBe(false);
    save = autoPlayTo(quiet(save), firstDayOfWeek(NEXT_W) - 1);
    expect(save.competition.weekSeeding!.week).toBe(W);
    save = advanceDayFlow(quiet(save));
    expect(save.competition.weekSeeding).toMatchObject({ seasonIndex: 0, week: NEXT_W });
    expect(save.competition.weekSeeding!.direct).toHaveLength(CAREER_QUALIFIER.directSlots);
  });
});

// ---------------------------------------------------------------------------
// Major / Worlds: Saturday Swiss → pause → Championship Sunday
// ---------------------------------------------------------------------------

describe("two-day Major (R40)", { timeout: 30_000 }, () => {
  it("Saturday Swiss → PAUSE (survives a JSON reload) → Sunday playoffs → finishEvent effects exactly once", () => {
    const sat = majorSaturday(99);
    const def = sat.pendingEventDef!;
    expect(userEventDefOnDay(sat, def.day)).toEqual(def);
    expect(userEventDefOnDay(sat, playoffsDayFor(def))).toEqual(def);

    let save = startEvent(sat, false);
    expect(eventDayPhaseOf(save)).toBe("swiss");
    save = simEventToEnd(save); // Saturday: sims to the END OF THE SWISS only
    const t = save.activeEvent!.tournament;
    expect(t.swiss.finished).toBe(true);
    expect(t.stage).toBe("playoffs");
    expect(t.playoffs!.rounds).toHaveLength(0);
    expect(isEventPaused(save)).toBe(true);
    expect(eventDayPhaseOf(save)).toBe("paused");
    expect(isChampionshipSunday(save)).toBe(false);
    // Neither stepping nor sim crosses into the playoffs on Saturday; finish refuses.
    expect(stepEventRound(save)).toBe(save);
    expect(simEventToEnd(save)).toBe(save);
    expect(finishEvent(save).activeEvent).not.toBeNull();
    // The Saturday result was not banked.
    expect(save.eventResults.some((r) => r.eventId === def.id)).toBe(false);

    // Reload: the pause lives in persisted fields only.
    const reloaded = migrateSaveToV4(JSON.parse(JSON.stringify(save)))!;
    expect(isEventPaused(reloaded)).toBe(true);
    const before = counters(reloaded, def);

    // Continue → exactly one day; Sunday's arrival leaves the user's Major alone.
    const sun = advanceToNextStopFlow(reloaded);
    expect(continueEventToNextDayFlow(reloaded)).toEqual(sun); // the named action, same result
    expect(continueEventToNextDayFlow(sun)).toBe(sun); // no-op once it is Sunday
    expect(continueEventToNextDayFlow(sat)).toBe(sat); // …and in a plain lobby
    expect(sun.clock.day).toBe(playoffsDayFor(def));
    expect(sun.clock.day).toBe(def.day + 1);
    expect(isEventPaused(sun)).toBe(false);
    expect(isChampionshipSunday(sun)).toBe(true);
    expect(eventDayPhaseOf(sun)).toBe("playoffs");
    expect(counters(sun, def)).toEqual(before); // no training, payroll, result or news on the way
    expect(advanceDayFlow(sun)).toBe(sun); // the playoffs must be played
    expect(advanceToNextStopFlow(sun)).toBe(sun);

    // Sunday: the playoffs, then the finish — once.
    const fin = simEventToEnd(sun);
    expect(fin.activeEvent!.tournament.stage).toBe("finished");
    expect(eventDayPhaseOf(fin)).toBe("finished");
    const done = finishEvent(fin);
    expect(done.activeEvent).toBeNull();
    expect(done.pendingEventDef).toBeNull();
    const result = resultOf(done, def);
    const userRow = result.rows.find((r) => r.ref === "user")!;
    const after = counters(done, def);
    expect(after.results).toBe(1);
    expect(after.resultNews).toBe(1);
    expect(after.prizeLines).toBe(userRow.prize > 0 ? 1 : 0);
    expect(after.majorsQualified).toBe(before.majorsQualified + 1);
    expect(after.seasonPoints).toBe(before.seasonPoints + pointsFor("major", userRow.placement));
    // (A 99-rated roster sits at its growth cap — the once-only XP check lives in the next test.)
    expect(after.seriesPlayed).toBeGreaterThan(before.seriesPlayed);
    expect(after.payrollLines).toBe(before.payrollLines);
    expect(hasChampion(result)).toBe(true);
    expect(result.rows.some((r) => r.placement === "champion")).toBe(true);
    // Nothing more to do on Sunday — and a second finish is inert.
    expect(counters(finishEvent(done), def)).toEqual(after);
    // The reload changed nothing: the same Sunday without the JSON round trip ends identically.
    const direct = finishEvent(simEventToEnd(advanceToNextStopFlow(save)));
    expect(counters(direct, def)).toEqual(after);
    expect(resultOf(direct, def)).toEqual(result);
  });

  it("the pause never changes the outcome: Saturday + Sunday equals one uninterrupted run", () => {
    const lobby = startEvent(majorSaturday(80), false);
    const ev = lobby.activeEvent!;
    const straight = fastForward(ev.tournament, lobby.difficulty, createRng(ev.rngState));
    const split = simEventToEnd(advanceDayFlow(simEventToEnd(lobby)));
    expect(split.activeEvent!.tournament).toEqual(straight);
  });

  it("watch mode: stepping round by round also holds at the Swiss end on Saturday", () => {
    let save = startEvent(majorSaturday(99), true);
    let guard = 0;
    while (!isEventPaused(save) && guard++ < 12) save = stepEventRound(save);
    expect(isEventPaused(save)).toBe(true);
    expect(save.activeEvent!.tournament.swiss.rounds.length).toBeGreaterThanOrEqual(3);
    expect(save.activeEvent!.tournament.playoffs!.rounds).toHaveLength(0);
  });

  it("knocked out in the Swiss: the event still pauses Saturday; Sunday's playoffs resolve without the user", () => {
    let save = startEvent(majorSaturday(40), true);
    let guard = 0;
    while (!isEventPaused(save) && guard++ < 12) save = stepEventRound(save);
    expect(isEventPaused(save)).toBe(true);
    expect(save.activeEvent!.tournament.userEliminated).toBe(true);
    const def = save.activeEvent!.def;
    save = advanceDayFlow(save);
    expect(save.clock.day).toBe(playoffsDayFor(def));
    expect(eventDayPhaseOf(save)).toBe("playoffs");
    // One step resolves every remaining (AI-only) playoff round.
    save = stepEventRound(save);
    expect(save.activeEvent!.tournament.stage).toBe("finished");
    // Match XP lands exactly once, at the finish (white-box mirror of finishEvent).
    const gearBonus = gearTrainingBonus(save.finances.gear);
    const expectedXp = save.squad.map(
      (p) =>
        applyMatchXp(p, {
          seasonIndex: save.clock.seasonIndex,
          fieldQuality: save.activeEvent!.fieldQuality,
          isSub: false,
          coachOverall: save.coach?.overall ?? null,
          gearBonus,
        }).gainedThisSeason,
    );
    const done = finishEvent(save);
    expect(done.squad.map((p) => p.gainedThisSeason)).toEqual(expectedXp);
    expect(expectedXp.some((xp, i) => xp > save.squad[i].gainedThisSeason)).toBe(true);
    const result = resultOf(done, def);
    expect(result.userPlacement).toBe("swiss_exit");
    expect(result.rows.some((r) => r.placement === "champion" && r.ref !== "user")).toBe(true);
    expect(done.eventResults.filter((r) => r.eventId === def.id)).toHaveLength(1);
    expect(counters(finishEvent(done), def)).toEqual(counters(done, def));
  });

  it("the team froze at the start: the lineup is locked while the event runs, and credit goes to who played", () => {
    let save = majorSaturday(80);
    const bench = { ...structuredClone(save.squad[0]), id: "bench-sub", name: "Bench Sub", role: "sub" as const };
    save = { ...save, squad: [...save.squad, bench] };
    const starters = [...save.starterIds] as [string, string, string];
    const swapIn: [string, string, string] = [bench.id, starters[1], starters[2]];
    // In the lobby the lineup is free…
    expect(setStartersFlow(save, swapIn).error).toBeUndefined();
    // …the event records who it fielded, then locks the lineup until it ends.
    save = simEventToEnd(startEvent(save, false));
    expect(isEventPaused(save)).toBe(true);
    expect(save.activeEvent!.fieldedIds).toEqual(starters);
    const refused = setStartersFlow(save, swapIn);
    expect(refused.error).toBe("eventLocked");
    expect(refused.save).toBe(save);
    // Even a lineup moved under a running event (any other path) cannot
    // redirect the credit: match XP and roster stability follow the frozen team.
    const moved = structuredClone(save);
    moved.starterIds = swapIn;
    moved.squad.find((p) => p.id === bench.id)!.role = "starter";
    moved.squad.find((p) => p.id === starters[0])!.role = "sub";
    const fin = simEventToEnd(advanceDayFlow(moved));
    const done = finishEvent(fin);
    expect(done.competition.newFacesThisSplit).not.toContain(bench.id);
    const xp = (id: string, isSub: boolean) =>
      applyMatchXp(fin.squad.find((p) => p.id === id)!, {
        seasonIndex: fin.clock.seasonIndex,
        fieldQuality: fin.activeEvent!.fieldQuality,
        isSub,
        coachOverall: fin.coach?.overall ?? null,
        gearBonus: gearTrainingBonus(fin.finances.gear),
      }).gainedThisSeason;
    const gained = (id: string) => done.squad.find((p) => p.id === id)!.gainedThisSeason;
    expect(gained(starters[0])).toBe(xp(starters[0], false)); // played both days: full share
    expect(gained(bench.id)).toBe(fin.squad.find((p) => p.id === bench.id)!.gainedThisSeason); // never played
    // Once the event is over the lineup is free again.
    expect(setStartersFlow(done, swapIn).error).toBeUndefined();
  });

  it("an AI-only Major resolves whole on Sunday — its champion news lands on Championship Sunday", () => {
    let save = autoPlayTo(freshCareer(), firstDayOfWeek(MAJOR_W) - 1);
    delete save.competition.splitPoints.SAM.user;
    save = advanceDayFlow(save);
    expect(save.competition.majorFieldRefs).not.toContain("user");
    expect(save.pendingEventDef).toBeNull();
    const sat = advanceTo(save, eventDayFor(MAJOR_W));
    expect(sat.clock.day).toBe(eventDayFor(MAJOR_W));
    expect(sat.eventResults.some((r) => r.tier === "major")).toBe(false);
    const sun = advanceDayFlow(sat);
    const majors = sun.eventResults.filter((r) => r.tier === "major");
    expect(majors).toHaveLength(1);
    expect(majors[0].rows.some((r) => r.ref === "user")).toBe(false);
    const news = sun.news.filter((n) => n.titleKey === "seasonChampion");
    expect(news).toHaveLength(1);
    expect(news[0].day).toBe(eventDayFor(MAJOR_W) + 1);
    // A spectator weekend is never a stop.
    expect(advanceToNextStopFlow(quiet(save)).clock.day).toBeGreaterThan(sun.clock.day);
  });
});

describe("roster moves wait for the event (rc.30, rc.29 review)", { timeout: 30_000 }, () => {
  it("no release, signing or sale between Saturday's Swiss and Sunday's playoffs; they open again after", () => {
    const paused = simEventToEnd(startEvent(majorSaturday(80), false));
    expect(isEventPaused(paused)).toBe(true);
    const starter = paused.starterIds[0];
    const released = releasePlayerFlow(paused, starter);
    expect(released.error).toBe("rosterLocked");
    expect(released.save).toBe(paused);
    const signed = signPlayerFlow(paused, paused.world.freeAgentIds[0], { role: "sub", lengthSeasons: 1 });
    expect(signed.error).toBe("rosterLocked");
    const withBid: CareerSave = {
      ...paused,
      pendingOffers: [
        {
          id: "bid:test",
          direction: "out",
          playerId: starter,
          playerName: "Starter",
          fee: 1000,
          salaryPerSplit: 0,
          lengthSeasons: 2,
          role: "starter",
          otherRef: Object.keys(paused.world.orgs)[0],
          status: "pending",
          resolveSeason: 0,
          resolveDay: paused.clock.day + 7,
          factors: [],
        },
      ],
    };
    const sold = acceptBidFlow(withBid, "bid:test");
    expect(sold.error).toBe("rosterLocked");
    expect(sold.save.squad.map((p) => p.id)).toContain(starter);
    // Sunday: the playoffs, the finish — then the market is open for business again.
    const done = finishEvent(simEventToEnd(advanceToNextStopFlow(withBid)));
    expect(done.activeEvent).toBeNull();
    const after = acceptBidFlow(done, "bid:test");
    expect(after.error).toBeUndefined();
    expect(after.save.squad.map((p) => p.id)).not.toContain(starter);
  });
});

describe("Worlds on the season's last weekend (R40)", { timeout: 30_000 }, () => {
  it("an unattended Worlds resolves on Sunday day 224 and closes the season; rollover works", () => {
    let save = advanceDayFlow(worldsEve(false)); // W32 Monday
    expect(save.pendingEventDef).toBeNull();
    save = advanceTo(save, eventDayFor(WORLDS_W));
    expect(save.clock.day).toBe(eventDayFor(WORLDS_W));
    expect(save.phase).toBe("running");
    expect(save.eventResults.some((r) => r.tier === "worlds")).toBe(false);
    save = advanceDayFlow(save);
    expect(save.clock.day).toBe(DAYS_PER_SEASON);
    expect(save.phase).toBe("seasonReview");
    expect(save.eventResults.filter((r) => r.tier === "worlds")).toHaveLength(1);
    expect(save.history).toHaveLength(1);
    expect(save.history[0].worldsChampionRef).toBeTruthy();
    const next = rolloverToNextSeason(save);
    expect(next.phase).toBe("running");
    expect(next.clock).toEqual({ seasonIndex: 1, day: 1 });
  });

  it("an attended Worlds plays Saturday + Sunday, finishes on day 224 and enters the season review", () => {
    let save = advanceDayFlow(worldsEve(true));
    expect(save.pendingEventDef).toMatchObject({ tier: "worlds", day: eventDayFor(WORLDS_W) });
    save = advanceToNextStopFlow(quiet(save));
    expect(save.clock.day).toBe(eventDayFor(WORLDS_W));
    expect(eventDayPhaseOf(save)).toBe("lobby");
    save = simEventToEnd(startEvent(save, false));
    expect(isEventPaused(save)).toBe(true);
    const def = save.activeEvent!.def;
    save = advanceToNextStopFlow(save);
    expect(save.clock.day).toBe(DAYS_PER_SEASON);
    expect(save.phase).toBe("running");
    expect(isChampionshipSunday(save)).toBe(true);
    expect(save.eventResults.some((r) => r.eventId === def.id)).toBe(false);
    save = finishEvent(simEventToEnd(save));
    expect(save.clock.day).toBe(DAYS_PER_SEASON);
    expect(save.phase === "seasonReview" || save.phase === "ended").toBe(true);
    expect(save.eventResults.filter((r) => r.eventId === def.id)).toHaveLength(1);
    expect(save.history).toHaveLength(1);
    expect(save.history[0].userWorldsPlacement).not.toBeNull();
    if (save.phase === "seasonReview") {
      expect(rolloverToNextSeason(save).clock).toEqual({ seasonIndex: 1, day: 1 });
    }
  });
});

// ---------------------------------------------------------------------------
// rc.29 review (R3): every format pays exactly the pool its lobby advertises
// ---------------------------------------------------------------------------

/** The format each tier is played in (the calendar's own defs are checked below). */
const FORMAT_OF: Record<EventTier, CareerEventFormat> = {
  qualifier: "swissOnly",
  regional: "swiss",
  major: "swiss",
  worlds: "swiss",
  t3: "single",
  t2: "single",
};

/**
 * A filed result's REAL finishing places — whatever the bracket produced
 * (the double-elimination top 8 with its third-place series, the 8-team
 * single elimination, the Swiss-only 8 / 8) — pay exactly the figure the
 * lobby, the calendar and HQ show (prizePoolPaidFor).
 */
function expectPaysItsPool(result: CompactEventResult, difficulty: CareerDifficulty): void {
  const format = FORMAT_OF[result.tier];
  expect(result.rows, result.eventId).toHaveLength(format === "single" ? 8 : 16);
  expect(new Set(result.rows.map((r) => r.ref)).size, result.eventId).toBe(result.rows.length);
  expect(
    result.rows.reduce((sum, r) => sum + r.prize, 0),
    `${result.eventId} (${result.tier}, ${difficulty})`,
  ).toBe(prizePoolPaidFor(result.tier, format, difficulty, result.seasonIndex));
}

describe("every format pays exactly its advertised pool — real results (rc.29 review R3)", { timeout: 60_000 }, () => {
  it("the regional weekend: seven Swiss-only qualifiers and seven regionals, the user's included", () => {
    const sat = advanceTo(freshCareer(), qualifierDayFor(W));
    const played = simToday(withStrength(sat, 99));
    const sun = advanceToNextStopFlow(quiet(played));
    expect(eventDayPhaseOf(sun)).toBe("lobby");
    const done = simToday(sun);
    const weekend = done.eventResults.filter((r) => r.seasonIndex === 0 && r.week === W);
    expect(weekend.filter((r) => r.tier === "qualifier")).toHaveLength(7);
    expect(weekend.filter((r) => r.tier === "regional")).toHaveLength(7);
    expect(weekend.filter((r) => r.rows.some((row) => row.ref === "user"))).toHaveLength(2);
    for (const result of weekend) expectPaysItsPool(result, "normal");
    for (const def of [...qualifierDefsForWeek(0, W), ...officialEventDefsForWeek(0, W)]) {
      expect(def.format, def.id).toBe(FORMAT_OF[def.tier]);
    }
  });

  it("a two-day Major and Worlds: Saturday's Swiss + Sunday's double-elimination playoffs", () => {
    const sat = majorSaturday(99);
    const majorDef = sat.pendingEventDef!;
    expect(majorDef.format).toBe(FORMAT_OF.major);
    const paused = simEventToEnd(startEvent(sat, false));
    expect(isEventPaused(paused)).toBe(true);
    const major = finishEvent(simEventToEnd(advanceToNextStopFlow(paused)));
    expectPaysItsPool(resultOf(major, majorDef), "normal");

    let worlds = advanceToNextStopFlow(quiet(advanceDayFlow(worldsEve(true))));
    expect(eventDayPhaseOf(worlds)).toBe("lobby");
    const worldsDef = worlds.pendingEventDef!;
    expect(worldsDef).toMatchObject({ tier: "worlds", format: FORMAT_OF.worlds });
    worlds = simEventToEnd(startEvent(worlds, false));
    expect(isEventPaused(worlds)).toBe(true);
    worlds = finishEvent(simEventToEnd(advanceToNextStopFlow(worlds)));
    expectPaysItsPool(resultOf(worlds, worldsDef), "normal");
  });

  it("the Community Cup and the Invitational: an 8-team single elimination, at every difficulty", () => {
    const week = seasonSchedule().find((w) => w.kind === "open")!.week;
    for (const difficulty of ["easy", "normal", "hard"] as const) {
      for (const tier of ["t3", "t2"] as const) {
        const save = createCareerSave({ ...INPUT, difficulty }, SEED);
        const def: CareerEventDef = {
          id: `0:${week}:unofficial`,
          tier,
          seasonIndex: 0,
          week,
          day: eventDayFor(week),
          name: tier === "t3" ? "Review Cup" : "Review Invitational",
          format: FORMAT_OF[tier],
        };
        save.clock.day = def.day;
        save.pendingEventDef = def;
        save.unofficialOffer = null;
        const done = finishEvent(simEventToEnd(startEvent(save, false)));
        expectPaysItsPool(resultOf(done, def), difficulty);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// The season review reads a capped results list
// ---------------------------------------------------------------------------

describe("season review counts (R40 review)", () => {
  it("counts every Major and title the user played — the results cap never trims the user's own season", { timeout: 60_000 }, () => {
    let save = withStrength(freshCareer(31337), 95);
    let guard = 0;
    while (save.phase === "running" && guard++ < 1500) {
      const phase = eventDayPhaseOf(save);
      if (phase === "lobby") {
        save = simToday(withStrength(save, 95));
        continue;
      }
      if (phase === "swiss" || phase === "playoffs" || phase === "finished") {
        save = simEventToEnd(save);
        if (save.activeEvent?.tournament.stage === "finished") save = finishEvent(save);
        continue;
      }
      const before = save.clock.day;
      save = quiet(advanceDayFlow(save));
      if (save.clock.day === before) throw new Error(`clock blocked on day ${before}`);
    }
    expect(save.phase).toBe("seasonReview");
    // A season files far more results than the cap keeps (7 qualifiers + 7 regionals a regional week)…
    expect(save.eventResults.length).toBeLessThanOrEqual(CAREER_SAVE.eventResultsCap);
    const regionalWeeks = seasonSchedule().filter((w) => w.kind === "regional").length;
    expect(save.eventResults.filter((r) => r.tier === "qualifier").length).toBeLessThan(
      regionalWeeks * Object.keys(CAREER_SLOTS.major).length,
    );
    // …yet the review counts the user's whole season.
    const s = save.stats;
    expect(s.majorsQualified).toBeGreaterThan(0);
    expect(save.history[0].majorsQualified).toBe(s.majorsQualified);
    expect(save.history[0].titles).toBe(
      s.titlesT3 + s.titlesT2 + s.titlesRegional + s.titlesMajor + s.titlesWorlds,
    );
  });
});

// ---------------------------------------------------------------------------
// Legacy saves (the pre-R40 weekday layout) — migrateSaveToV4
// ---------------------------------------------------------------------------

/** Dress a current save down to saveVersion 3 (the pre-R40 shape), via JSON like a real load. */
function asLegacy(save: CareerSave, edit: (s: CareerSave) => void = () => {}): CareerSave {
  const legacy = JSON.parse(JSON.stringify(save)) as CareerSave;
  legacy.saveVersion = 3;
  edit(legacy);
  return legacy;
}
/** The pre-R40 qualifier matchday (midweek, day 3 of the week). */
const OLD_QUALIFIER_DAY = eventDayFor(W) - 3;

describe("legacy saves (R40 migration)", { timeout: 30_000 }, () => {
  it("a pending legacy midweek qualifier is re-dated to Saturday (Swiss only); idempotent; new saves are untouched", () => {
    const mon = advanceTo(freshCareer(), firstDayOfWeek(W));
    const legacy = asLegacy(mon, (s) => {
      s.pendingEventDef = { ...s.pendingEventDef!, day: OLD_QUALIFIER_DAY, format: "swiss" };
    });
    const up = migrateSaveToV4(legacy)!;
    expect(up.saveVersion).toBe(4);
    expect(up.pendingEventDef).toEqual(mon.pendingEventDef);
    expect(migrateSaveToV4(up)).toBe(up);
    expect(migrateSaveToV4(mon)).toBe(mon); // a v4 save is never rewritten
  });

  it("on the old midweek qualifier day (AI qualifiers already run): re-dated to Saturday, nothing resolves twice", () => {
    const sat = advanceTo(freshCareer(), qualifierDayFor(W)); // 6 AI qualifiers on file
    const legacy = asLegacy(sat, (s) => {
      s.clock.day = OLD_QUALIFIER_DAY;
      s.pendingEventDef = { ...s.pendingEventDef!, day: OLD_QUALIFIER_DAY, format: "swiss" };
    });
    let save = migrateSaveToV4(legacy)!;
    expect(save.pendingEventDef?.day).toBe(qualifierDayFor(W));
    // The old midweek day no longer blocks; the lobby re-opens Saturday.
    save = advanceToNextStopFlow(quiet(save));
    expect(save.clock.day).toBe(qualifierDayFor(W));
    expect(eventDayPhaseOf(save)).toBe("lobby");
    expect(save.eventResults.filter((r) => r.tier === "qualifier")).toHaveLength(6);
    const played = simToday(withStrength(save, 99));
    expect(played.eventResults.filter((r) => r.tier === "qualifier")).toHaveLength(7);
    expect(hasChampion(played.eventResults.find((r) => r.region === "SAM" && r.tier === "qualifier")!)).toBe(false);
  });

  it("an open Saturday regional lobby moves to Sunday; the AI regionals already on file are not re-run", () => {
    // New layout up to Sunday's lobby: 6 AI regionals resolved, the user's pending.
    const sat = advanceTo(freshCareer(), qualifierDayFor(W));
    const sun = advanceDayFlow(simToday(withStrength(sat, 99)));
    expect(eventDayPhaseOf(sun)).toBe("lobby");
    expect(sun.eventResults.filter((r) => r.tier === "regional")).toHaveLength(6);
    // The old layout's Saturday: same history, the lobby open on Saturday.
    const legacy = asLegacy(sun, (s) => {
      s.clock.day = eventDayFor(W);
      s.pendingEventDef = { ...s.pendingEventDef!, day: eventDayFor(W) };
    });
    let save = migrateSaveToV4(legacy)!;
    expect(save.pendingEventDef?.day).toBe(regionalDayFor(W));
    expect(eventDayPhaseOf(save)).toBe("none");
    save = advanceToNextStopFlow(quiet(save));
    expect(save.clock.day).toBe(regionalDayFor(W));
    expect(eventDayPhaseOf(save)).toBe("lobby");
    expect(save.eventResults.filter((r) => r.tier === "regional")).toHaveLength(6);
    save = simToday(save);
    expect(save.eventResults.filter((r) => r.tier === "regional")).toHaveLength(7);
  });

  it("a pending Major stays on Saturday (Swiss), its playoffs on Sunday", () => {
    const sat = majorSaturday(80);
    const up = migrateSaveToV4(asLegacy(sat))!;
    expect(up.pendingEventDef).toEqual(sat.pendingEventDef);
    expect(playoffsDayFor(up.pendingEventDef!)).toBe(eventDayFor(MAJOR_W) + 1);
  });

  it("a legacy qualifier mid-Swiss finishes as Swiss-only — no playoffs, no champion", () => {
    const sat = advanceTo(freshCareer(), qualifierDayFor(W));
    // The old engine: a qualifier in the full "swiss" format (Swiss → playoffs).
    const old = structuredClone(sat);
    old.pendingEventDef = { ...old.pendingEventDef!, format: "swiss" };
    let save = startEvent(withStrength(old, 99), false);
    expect(save.activeEvent!.tournament.swissOnly).toBeUndefined();
    save = stepEventRound(save);
    expect(save.activeEvent!.tournament.stage).toBe("swiss");
    save = migrateSaveToV4(asLegacy(save, (s) => (s.activeEvent!.def.day = OLD_QUALIFIER_DAY)))!;
    expect(save.activeEvent!.def.format).toBe("swissOnly");
    expect(save.activeEvent!.tournament.swissOnly).toBe(true);
    save = simEventToEnd(save);
    expect(save.activeEvent!.tournament.stage).toBe("finished");
    expect(save.activeEvent!.tournament.playoffs).toBeNull();
    const done = finishEvent(save);
    const q = done.eventResults.find((r) => r.tier === "qualifier" && r.region === "SAM")!;
    expect(q.rows.filter((r) => r.placement === "top8")).toHaveLength(8);
    expect(q.rows.some((r) => r.placement === "champion")).toBe(false);
    expect(done.pendingEventDef).toMatchObject({ tier: "regional", day: regionalDayFor(W) });
  });

  it("a legacy qualifier in progress keeps ONE def — the day it started — so the agenda lists it once", () => {
    const sat = advanceTo(freshCareer(), qualifierDayFor(W));
    const lobby = startEvent(withStrength(sat, 99), false);
    const legacy = asLegacy(lobby, (s) => {
      s.clock.day = OLD_QUALIFIER_DAY;
      const old = { ...s.activeEvent!.def, day: OLD_QUALIFIER_DAY, format: "swiss" as const };
      s.activeEvent!.def = old;
      s.pendingEventDef = { ...old }; // startEvent never clears it
      delete s.activeEvent!.tournament.swissOnly;
    });
    const save = migrateSaveToV4(legacy)!;
    const def = save.activeEvent!.def;
    expect(def).toMatchObject({ day: OLD_QUALIFIER_DAY, format: "swissOnly" });
    expect(save.pendingEventDef).toEqual(def);
    expect(userEventDefOnDay(save, OLD_QUALIFIER_DAY)?.id).toBe(def.id);
    expect(userEventDefOnDay(save, qualifierDayFor(W))).toBeNull();
    // Qualified midweek → Sunday's regional is pending, days away (not "tomorrow").
    const done = finishEvent(simEventToEnd(save));
    expect(done.clock.day).toBe(OLD_QUALIFIER_DAY);
    expect(done.pendingEventDef).toMatchObject({ tier: "regional", day: regionalDayFor(W) });
    expect(userEventDefOnDay(done, OLD_QUALIFIER_DAY)).toBeNull();
  });

  it("a legacy qualifier already INTO its playoffs ends at its Swiss: playoff rounds dropped, placements from the Swiss", () => {
    const sat = advanceTo(freshCareer(), qualifierDayFor(W));
    const old = structuredClone(sat);
    old.pendingEventDef = { ...old.pendingEventDef!, format: "swiss" };
    let save = startEvent(withStrength(old, 40), false);
    // Play the old way: the whole Swiss, then one playoff round.
    const ev = save.activeEvent!;
    const rng = createRng(ev.rngState);
    let t = ev.tournament;
    while (t.stage === "swiss") t = playNextRound(t, save.difficulty, rng);
    t = playNextRound(t, save.difficulty, rng);
    expect(t.playoffs!.rounds).toHaveLength(1);
    save = { ...save, activeEvent: { ...ev, tournament: t, rngState: rng.state } };
    const swissAdvanced = t.swiss.records.filter((r) => r.status === "advanced").map((r) => r.teamId).sort();

    save = migrateSaveToV4(asLegacy(save))!;
    expect(save.activeEvent!.tournament.stage).toBe("finished");
    expect(save.activeEvent!.tournament.playoffs).toBeNull();
    const done = finishEvent(save);
    const q = done.eventResults.find((r) => r.tier === "qualifier" && r.region === "SAM")!;
    expect(q.rows.filter((r) => r.placement === "top8").map((r) => r.ref).sort()).toEqual(swissAdvanced);
    expect(q.rows.some((r) => r.placement === "champion")).toBe(false);
    expect(done.competition.qualifiedRefs!.SAM!.refs.sort()).toEqual(swissAdvanced);
    expect(done.pendingEventDef).toBeNull(); // the 40-rated roster was out
  });

  it("a legacy Major mid-Swiss on Saturday pauses at its Swiss end like a new one", () => {
    let save = stepEventRound(startEvent(majorSaturday(80), false));
    expect(save.activeEvent!.tournament.stage).toBe("swiss");
    save = migrateSaveToV4(asLegacy(save))!;
    save = simEventToEnd(save);
    expect(isEventPaused(save)).toBe(true);
  });

  it("a legacy Major already in its playoffs on Saturday finishes on Saturday (no forced pause, no Sunday re-run)", () => {
    let save = simEventToEnd(startEvent(majorSaturday(80), false));
    expect(isEventPaused(save)).toBe(true);
    // The old flow had no pause: one playoff round was already played on Saturday.
    const ev = save.activeEvent!;
    const rng = createRng(ev.rngState);
    const t = playNextRound(ev.tournament, save.difficulty, rng);
    save = { ...save, activeEvent: { ...ev, tournament: t, rngState: rng.state } };
    save = migrateSaveToV4(asLegacy(save))!;
    expect(isEventPaused(save)).toBe(false);
    save = finishEvent(simEventToEnd(save));
    expect(save.clock.day).toBe(eventDayFor(MAJOR_W));
    expect(save.eventResults.filter((r) => r.tier === "major")).toHaveLength(1);
    // Sunday's arrival finds the Major on file and leaves it alone.
    const sun = advanceDayFlow(save);
    expect(sun.clock.day).toBe(eventDayFor(MAJOR_W) + 1);
    expect(sun.eventResults.filter((r) => r.tier === "major")).toHaveLength(1);
    expect(sun.news.filter((n) => n.titleKey === "seasonChampion")).toHaveLength(0);
  });

  it("SEAM-1 (rc.30): a qualifier already played midweek is never Saturday's stop — the next stop is Sunday's regional", () => {
    const sat = advanceTo(freshCareer(), qualifierDayFor(W));
    const through = simToday(withStrength(sat, 99)); // qualified: Sunday's regional pending
    expect(through.pendingEventDef).toMatchObject({ tier: "regional" });
    // The old layout: the qualifier was played midweek, the regional pending on Saturday.
    let save = migrateSaveToV4(
      asLegacy(through, (s) => {
        s.clock.day = OLD_QUALIFIER_DAY;
        s.pendingEventDef = { ...s.pendingEventDef!, day: eventDayFor(W) };
      }),
    )!;
    expect(save.pendingEventDef?.day).toBe(regionalDayFor(W));
    expect(userEventDefOnDay(save, qualifierDayFor(W))).toBeNull();
    const next = upcomingStops(save, 2).find((x) => x.kind === "event")!;
    expect(next).toMatchObject({ day: regionalDayFor(W), event: { tier: "regional" } });
    // The flow agrees: the batched Advance runs through Saturday to Sunday's lobby.
    save = advanceToNextStopFlow(quiet(save));
    expect(save.clock.day).toBe(regionalDayFor(W));
    expect(eventDayPhaseOf(save)).toBe("lobby");
    expect(save.eventResults.filter((r) => r.tier === "qualifier" && r.region === "SAM")).toHaveLength(1);
  });

  it("SEAM-1 (rc.30): a regional already played on the old Saturday is never Sunday's stop", () => {
    const sat = advanceTo(freshCareer(), qualifierDayFor(W));
    const sun = advanceDayFlow(simToday(withStrength(sat, 99)));
    const played = simToday(sun);
    const regional = officialEventDefsForWeek(0, W).find((d) => d.tier === "regional" && d.region === "SAM")!;
    expect(played.eventResults.some((r) => r.eventId === regional.id && r.userPlacement)).toBe(true);
    const save = migrateSaveToV4(asLegacy(played, (s) => (s.clock.day = eventDayFor(W))))!;
    expect(userEventDefOnDay(save, regionalDayFor(W))).toBeNull();
    expect(upcomingStops(save, 3).some((x) => x.event?.id === regional.id)).toBe(false);
    // Today's own history still reads on its day (the clock's).
    expect(userEventDefOnDay(save, qualifierDayFor(W))?.tier).toBe("qualifier");
  });

  it("SEAM-2 (rc.30): only a legacy Major already INTO its playoffs on Saturday reads as a plain playoffs day", () => {
    const paused = simEventToEnd(startEvent(majorSaturday(80), false));
    expect(isEventPaused(paused)).toBe(true);
    expect(isLegacySaturdayPlayoffs(paused)).toBe(false); // the new flow's Saturday
    const ev = paused.activeEvent!;
    const rng = createRng(ev.rngState);
    const t = playNextRound(ev.tournament, paused.difficulty, rng);
    const legacy = migrateSaveToV4(
      asLegacy({ ...paused, activeEvent: { ...ev, tournament: t, rngState: rng.state } }),
    )!;
    expect(isLegacySaturdayPlayoffs(legacy)).toBe(true);
    expect(isChampionshipSunday(legacy)).toBe(false);
    // The new flow's Sunday is Championship Sunday, never the legacy case.
    const sunday = advanceToNextStopFlow(paused);
    expect(isChampionshipSunday(sunday)).toBe(true);
    expect(isLegacySaturdayPlayoffs(sunday)).toBe(false);
  });

  it("history stays exactly as it was (old qualifier rows with a champion included) and never counts as a title", () => {
    const sat = advanceTo(freshCareer(), qualifierDayFor(W));
    const legacy = asLegacy(sat, (s) => {
      const q = s.eventResults.find((r) => r.tier === "qualifier")!;
      q.rows[0] = { ...q.rows[0], placement: "champion" };
      q.rows[1] = { ...q.rows[1], ref: "user", placement: "champion" };
    });
    const before = JSON.parse(JSON.stringify(legacy.eventResults));
    const up = migrateSaveToV4(legacy)!;
    expect(up.eventResults).toEqual(before);
    expect(hasChampion(up.eventResults.find((r) => r.tier === "qualifier")!)).toBe(false);
  });
});
