/**
 * Road to Worlds v2.0 (R40) — the weekend view-models (weekendView.ts) and
 * the Championship Sunday flow (startChampionshipSundayFlow), driven through
 * the REAL career flow. Results are forced by roster strength (99 vs 40),
 * never by a lucky seed, so a Swiss pairing change cannot flip them.
 */

import { describe, expect, it } from "vitest";
import { CAREER_CALENDAR, CAREER_QUALIFIER, CAREER_REP, TOURNAMENT } from "@/config/balance";
import {
  eventDayFor,
  firstDayOfWeek,
  officialEventDefsForWeek,
  playoffsDayFor,
  qualifierDayFor,
  qualifierDefsForWeek,
  regionalDayFor,
  seasonSchedule,
} from "@/engine/career/calendar";
import { repGainFor } from "@/engine/career/economy";
import type { CareerEventDef, CareerSave } from "@/engine/career/types";
import { seedsFromSwiss } from "@/engine/swiss";
import {
  advanceDayFlow,
  continueEventToNextDayFlow,
  createCareerSave,
  eventDayPhaseOf,
  finishEvent,
  isEventPaused,
  simEventToEnd,
  startChampionshipSundayFlow,
  startEvent,
  stepEventRound,
  sundayIntroFlagFor,
  type CreateCareerInput,
} from "@/store/careerFlow";
import { stepDayForTests } from "@/store/careerClockForTests";
import {
  advancedSeedsOf,
  eventRepPreview,
  isSundaySpectator,
  openingOpponentOf,
  participationOf,
  placementLabelOf,
  regionalEntryOf,
  regionalTomorrowOf,
  simStopsAtSwissEnd,
  sundayIntroDue,
  sundayPreviewOf,
  swissTableOrder,
  swissVerdictOf,
  userSeedOf,
  weekendPlanOf,
  weekendRoleOf,
} from "./weekendView";

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

// ---------------------------------------------------------------------------
// Fixtures (the careerWeekend.test recipe)
// ---------------------------------------------------------------------------

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
    save = stepDayForTests(save); // rc.34: rc.33's walk past cups / invites / bids / offers
    if (save.clock.day === before) break;
  }
  return save;
}

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

function withStrength(input: CareerSave, overall: number): CareerSave {
  const save = structuredClone(input);
  for (const p of save.squad) p.overall = overall;
  return save;
}

/** The Saturday qualifier lobby of the first regional week (user outside the direct 8). */
function qualifierLobby(strength: number): CareerSave {
  const save = advanceTo(freshCareer(), qualifierDayFor(W));
  expect(eventDayPhaseOf(save)).toBe("lobby");
  expect(save.pendingEventDef?.tier).toBe("qualifier");
  return withStrength(save, strength);
}

/** The first Major's Saturday lobby with the user in the field. */
function majorLobby(strength: number): CareerSave {
  let save = autoPlayTo(freshCareer(), firstDayOfWeek(MAJOR_W) - 1);
  save.competition.splitPoints.SAM = { ...save.competition.splitPoints.SAM, user: 100_000 };
  save = advanceDayFlow(save);
  save = advanceTo(save, eventDayFor(MAJOR_W));
  expect(eventDayPhaseOf(save)).toBe("lobby");
  return withStrength(save, strength);
}

const LABELS = {
  placement: {
    champion: "Champions",
    runner_up: "Runners-up",
    third: "3rd",
    fourth: "4th",
    top4: "Top 4",
    top6: "Top 6",
    top8: "Top 8",
    swiss_exit: "Swiss exit",
  },
  qualifierOutcome: { qualified: "Qualified", eliminated: "Eliminated" },
};

// ---------------------------------------------------------------------------
// Day roles & the two-day plan
// ---------------------------------------------------------------------------

describe("weekend roles and plans (R40)", () => {
  const qualifier = qualifierDefsForWeek(0, W).find((d) => d.region === "SAM")!;
  const regional = officialEventDefsForWeek(0, W).find((d) => d.tier === "regional" && d.region === "SAM")!;
  const major = officialEventDefsForWeek(0, MAJOR_W).find((d) => d.tier === "major")!;
  const cup: CareerEventDef = { ...regional, id: "cup", tier: "t3", format: "single", day: eventDayFor(W + 1) };

  it("names each day: qualifier, regional, Swiss stage, Championship Sunday, cup", () => {
    expect(weekendRoleOf(qualifier, qualifier.day)).toBe("qualifier");
    expect(weekendRoleOf(regional, regional.day)).toBe("regional");
    expect(weekendRoleOf(major, major.day)).toBe("swissDay");
    expect(weekendRoleOf(major, playoffsDayFor(major))).toBe("championshipSunday");
    expect(weekendRoleOf(cup, cup.day)).toBe("cup");
  });

  it("a regional week reads qualifier Saturday → regional Sunday, from either event", () => {
    const fromQualifier = weekendPlanOf(qualifier, qualifier.day);
    expect(fromQualifier.map((d) => [d.role, d.day, d.state])).toEqual([
      ["qualifier", qualifierDayFor(W), "today"],
      ["regional", regionalDayFor(W), "next"],
    ]);
    expect(fromQualifier[1].def.id).toBe(regional.id);
    const fromRegional = weekendPlanOf(regional, regional.day);
    expect(fromRegional.map((d) => [d.role, d.state])).toEqual([
      ["qualifier", "done"],
      ["regional", "today"],
    ]);
  });

  it("a Major reads Swiss stage Saturday → Championship Sunday; a cup has no weekend story", () => {
    expect(weekendPlanOf(major, major.day - 1).map((d) => [d.role, d.day, d.state])).toEqual([
      ["swissDay", eventDayFor(MAJOR_W), "next"],
      ["championshipSunday", playoffsDayFor(major), "next"],
    ]);
    expect(weekendPlanOf(major, playoffsDayFor(major)).map((d) => d.state)).toEqual(["done", "today"]);
    expect(weekendPlanOf(cup, cup.day)).toEqual([]);
  });

  it("labels: a qualifier row is Qualified / Eliminated, never a bracket placement", () => {
    expect(placementLabelOf(LABELS, "qualifier", "top8")).toBe("Qualified");
    expect(placementLabelOf(LABELS, "qualifier", "swiss_exit")).toBe("Eliminated");
    expect(placementLabelOf(LABELS, "regional", "top8")).toBe("Top 8");
    expect(placementLabelOf(LABELS, "major", "champion")).toBe("Champions");
  });

  it("the Swiss verdict waits for the wins to advance / losses to go out", () => {
    const { winsToAdvance: w, lossesToEliminate: l } = TOURNAMENT.swiss;
    expect(swissVerdictOf(undefined)).toBeNull();
    expect(swissVerdictOf({ wins: w - 1, losses: l - 1 })).toBeNull();
    expect(swissVerdictOf({ wins: w, losses: 1 })).toEqual({ outcome: "advanced", wins: w, losses: 1 });
    expect(swissVerdictOf({ wins: 1, losses: l })).toEqual({ outcome: "eliminated", wins: 1, losses: l });
  });
});

// ---------------------------------------------------------------------------
// The Saturday qualifier (Swiss only)
// ---------------------------------------------------------------------------

describe("the Saturday qualifier view (R40)", () => {
  it("lists the qualified eight in the engine's seed order; the table is the final Swiss", () => {
    const save = simEventToEnd(startEvent(qualifierLobby(99), true));
    const t = save.activeEvent!.tournament;
    expect(t.swissOnly).toBe(true);
    expect(t.stage).toBe("finished");
    const seeds = advancedSeedsOf(t);
    expect(seeds).toHaveLength(CAREER_QUALIFIER.advanceSlots);
    expect(seeds.map((r) => r.id)).toEqual(seedsFromSwiss(t.swiss, t.teams));
    expect(seeds.map((r) => r.seed)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(seeds.every((r) => r.wins === TOURNAMENT.swiss.winsToAdvance)).toBe(true);
    expect(userSeedOf(t)).not.toBeNull();
    const table = swissTableOrder(t);
    expect(table).toHaveLength(TOURNAMENT.swiss.teams);
    expect(new Set(table.slice(0, 8))).toEqual(new Set(seeds.map((r) => r.id)));
    // No bracket, ever: no Sunday preview for a Swiss-only event.
    expect(sundayPreviewOf(t)).toBeNull();
  });

  it("the digest's rep preview matches finishEvent exactly (qualified and eliminated)", () => {
    for (const strength of [99, 40]) {
      const save = simEventToEnd(startEvent(qualifierLobby(strength), true));
      const placement = save.activeEvent!.tournament.swiss.records.find((r) => r.teamId === "user")!.status === "advanced"
        ? "top8"
        : "swiss_exit";
      const preview = eventRepPreview({
        tier: "qualifier",
        placement,
        reputation: save.reputation,
        flags: save.flags,
        seasonIndex: save.clock.seasonIndex,
        day: save.clock.day,
      });
      const after = finishEvent(save);
      expect(preview).toBe(after.reputation - save.reputation);
      expect(preview).toBe(strength === 99 ? repGainFor("qualifierAdvance", save.reputation) : 0);
    }
  });

  it("Sunday's regional knows how the user got in (through Saturday)", () => {
    const save = finishEvent(simEventToEnd(startEvent(qualifierLobby(99), false)));
    const regional = save.pendingEventDef!;
    expect(regional.tier).toBe("regional");
    expect(regionalEntryOf(save, regional)).toBe("qualified");
  });

  it("'On to Sunday' only when the regional is tomorrow (never for a pre-R40 midweek qualifier)", () => {
    const qualifier = qualifierDefsForWeek(0, W).find((d) => d.region === "SAM")!;
    const regional = regionalTomorrowOf(qualifier, qualifierDayFor(W));
    expect(regional).toMatchObject({ tier: "regional", region: "SAM", day: regionalDayFor(W) });
    expect(regionalTomorrowOf(qualifier, qualifierDayFor(W) - 3)).toBeNull(); // the old midweek day
    expect(regionalTomorrowOf(regional!, qualifierDayFor(W))).toBeNull(); // not a qualifier
  });
});

// ---------------------------------------------------------------------------
// Major Saturday → Championship Sunday
// ---------------------------------------------------------------------------

describe("Major Saturday pause and Championship Sunday (R40)", () => {
  it("Saturday: paused, seeds known, no Sunday card yet; Sunday: the card is due with the opening pairs", () => {
    const sat = simEventToEnd(startEvent(majorLobby(99), true));
    expect(isEventPaused(sat)).toBe(true);
    const t = sat.activeEvent!.tournament;
    expect(advancedSeedsOf(t).map((r) => r.id)).toEqual(t.playoffs!.seeds);
    expect(userSeedOf(t)).toBe(t.playoffs!.seeds.indexOf("user") + 1);
    expect(sundayIntroDue(sat)).toBe(false);

    const sun = continueEventToNextDayFlow(sat);
    expect(sun.clock.day).toBe(playoffsDayFor(sun.activeEvent!.def));
    expect(sundayIntroDue(sun)).toBe(true);
    const preview = sundayPreviewOf(sun.activeEvent!.tournament)!;
    const s = t.playoffs!.seeds;
    // Top half 1v8, 4v5 · bottom half 2v7, 3v6 — pairings only.
    expect(preview.pairs.map((p) => [p.a.id, p.b.id])).toEqual([
      [s[0], s[7]],
      [s[3], s[4]],
      [s[1], s[6]],
      [s[2], s[5]],
    ]);
    expect(preview.pairs.map((p) => [p.a.seed, p.b.seed])).toEqual([
      [1, 8],
      [4, 5],
      [2, 7],
      [3, 6],
    ]);
    expect(preview.pairs.filter((p) => p.userIn)).toHaveLength(1);
    expect(preview.opener).not.toBeNull();
    expect(participationOf(sun, sun.activeEvent!.def)).toBe("playing");

    // The opener is fixed by the seeds: the same before and after the engine
    // plays ahead (the playback shows it while the first series is pending).
    expect(openingOpponentOf(t.playoffs)).toBe(preview.opener!.id);
    const played = stepEventRound(startChampionshipSundayFlow(sun, true));
    expect(played.activeEvent!.tournament.playoffs!.rounds.length).toBeGreaterThan(0);
    expect(openingOpponentOf(played.activeEvent!.tournament.playoffs)).toBe(preview.opener!.id);
    expect(sundayPreviewOf(played.activeEvent!.tournament)).toBeNull();
  });

  it("startChampionshipSunday (watch): marks the card seen in one write, keeps the event unplayed", () => {
    const sun = continueEventToNextDayFlow(simEventToEnd(startEvent(majorLobby(99), false)));
    expect(sun.activeEvent!.watched).toBe(false);
    const watched = startChampionshipSundayFlow(sun, true);
    expect(watched.activeEvent!.watched).toBe(true);
    expect(watched.flags[sundayIntroFlagFor(sun.activeEvent!.def.id)]).toBe(true);
    expect(sundayIntroDue(watched)).toBe(false);
    expect(watched.activeEvent!.tournament).toEqual(sun.activeEvent!.tournament);
    // The playoffs then play as today; the card never comes back.
    const stepped = stepEventRound(watched);
    expect(stepped.activeEvent!.tournament.playoffs!.rounds.length).toBeGreaterThan(0);
    expect(sundayIntroDue(stepped)).toBe(false);
  });

  it("startChampionshipSunday (instant): sims the playoffs to the finish — same result as watching", () => {
    const sun = continueEventToNextDayFlow(simEventToEnd(startEvent(majorLobby(99), true)));
    const instant = startChampionshipSundayFlow(sun, false);
    expect(instant.activeEvent!.watched).toBe(false);
    expect(instant.activeEvent!.tournament.stage).toBe("finished");
    const watched = simEventToEnd(startChampionshipSundayFlow(sun, true));
    expect(instant.activeEvent!.tournament).toEqual(watched.activeEvent!.tournament);
  });

  it("is a no-op (same save) off Championship Sunday or once a playoff round exists", () => {
    const sat = simEventToEnd(startEvent(majorLobby(99), true));
    expect(startChampionshipSundayFlow(sat, false)).toBe(sat);
    const sun = continueEventToNextDayFlow(sat);
    const playing = stepEventRound(startChampionshipSundayFlow(sun, true));
    expect(startChampionshipSundayFlow(playing, false)).toBe(playing);
  });

  it("the sim label follows the DAY: 'Sim the Swiss' exactly while the sim stops at the Swiss end", () => {
    const lobby = startEvent(majorLobby(99), true);
    const def = lobby.activeEvent!.def;
    expect(simStopsAtSwissEnd(def, lobby.clock.day)).toBe(true);
    // The engine agrees — and once it has played ahead to the pause (mid-reveal), the label must not move.
    const sat = simEventToEnd(lobby);
    expect(isEventPaused(sat)).toBe(true);
    expect(simStopsAtSwissEnd(def, sat.clock.day)).toBe(true);
    const sun = continueEventToNextDayFlow(sat);
    expect(simStopsAtSwissEnd(def, sun.clock.day)).toBe(false);
    expect(simEventToEnd(startChampionshipSundayFlow(sun, true)).activeEvent!.tournament.stage).toBe("finished");
    const regional = officialEventDefsForWeek(0, W).find((d) => d.tier === "regional")!;
    expect(simStopsAtSwissEnd(regional, regional.day)).toBe(false);
  });

  it("Championship Sunday: a user out in Saturday's Swiss is a spectator — through the finish of the reveal", () => {
    const out = continueEventToNextDayFlow(simEventToEnd(startEvent(majorLobby(40), true)));
    expect(out.activeEvent!.tournament.userEliminated).toBe(true);
    expect(isSundaySpectator(out)).toBe(true);
    // The engine resolves the spectator's playoffs in one step; the playback still reveals them.
    const played = stepEventRound(startChampionshipSundayFlow(out, true));
    expect(played.activeEvent!.tournament.stage).toBe("finished");
    expect(isSundaySpectator(played)).toBe(true);
    const through = continueEventToNextDayFlow(simEventToEnd(startEvent(majorLobby(99), true)));
    expect(isSundaySpectator(through)).toBe(false);
    // Never on Saturday.
    expect(isSundaySpectator(simEventToEnd(startEvent(majorLobby(40), true)))).toBe(false);
  });

  it("a spectated Major is 'spectating' once its field is announced; a future one is 'tbd'", () => {
    const monday = autoPlayTo(freshCareer(), firstDayOfWeek(MAJOR_W));
    const major = officialEventDefsForWeek(0, MAJOR_W).find((d) => d.tier === "major")!;
    const inField = monday.competition.majorFieldRefs?.includes("user") ?? false;
    expect(participationOf(monday, major)).toBe(inField ? "playing" : "spectating");
    const before = autoPlayTo(freshCareer(), firstDayOfWeek(MAJOR_W) - 7);
    expect(participationOf(before, major)).toBe("tbd");
  });
});

// ---------------------------------------------------------------------------
// The digest's rep preview — rule for rule with applyEventRep
// ---------------------------------------------------------------------------

describe("eventRepPreview mirrors applyEventRep", () => {
  const base = { reputation: 30, flags: {}, seasonIndex: 0, day: 40 };
  const g = (k: keyof typeof CAREER_REP.gains) => repGainFor(k, 30);

  it("pays every rule finishEvent pays (incl. the t3 / t2 finals and the regional Swiss-exit floor)", () => {
    expect(eventRepPreview({ ...base, tier: "qualifier", placement: "top8" })).toBe(g("qualifierAdvance"));
    expect(eventRepPreview({ ...base, tier: "qualifier", placement: "swiss_exit" })).toBe(0);
    expect(eventRepPreview({ ...base, tier: "regional", placement: "champion" })).toBe(g("regionalWin"));
    expect(eventRepPreview({ ...base, tier: "regional", placement: "third" })).toBe(g("regionalTop4"));
    expect(eventRepPreview({ ...base, tier: "regional", placement: "top8" })).toBe(g("regionalTop8"));
    expect(eventRepPreview({ ...base, tier: "regional", placement: "swiss_exit" })).toBe(g("regionalSwissExit"));
    expect(eventRepPreview({ ...base, tier: "t3", placement: "runner_up" })).toBe(g("t3Final"));
    expect(eventRepPreview({ ...base, tier: "t2", placement: "runner_up" })).toBe(g("t2Final"));
    expect(eventRepPreview({ ...base, tier: "major", placement: "top8" })).toBe(0);
    expect(eventRepPreview({ ...base, tier: "worlds", placement: "fourth" })).toBe(g("worldsTop4"));
    // A Worlds title sets reputation to 100.
    expect(eventRepPreview({ ...base, tier: "worlds", placement: "champion" })).toBe(70);
  });

  it("respects the t3 per-split cap and the 100 ceiling", () => {
    const key = "t3rep:0:1"; // season 0, split 1 (the first regional week)
    const capped = eventRepPreview({ ...base, day: firstDayOfWeek(W), tier: "t3", placement: "champion", flags: { [key]: 99 } });
    expect(capped).toBe(0);
    expect(eventRepPreview({ ...base, reputation: 99.5, tier: "regional", placement: "champion" })).toBeCloseTo(0.5);
  });
});
