/**
 * Road to Worlds — BAL-02, the career difficulty presets (rc.32, R59).
 *
 * The career reads its own CAREER_DIFFICULTY (never the Draft's DIFFICULTY):
 * Easy and Normal keep rc.31's values, Hard is tuned to give stronger
 * opponents; a Draft retune cannot move a career match; the presets replace
 * the Management Style step (prefs from the preset, an old save keeps its
 * own); filler orgs are capped at the region's best real lineup (a
 * PROVISIONAL default, switch CAREER_WORLD.fillerCapToBestReal).
 */

import { describe, expect, it } from "vitest";
import { CAREER_DIFFICULTY, CAREER_LOAN, CAREER_WORLD, DIFFICULTY, TOURNAMENT } from "@/config/balance";
import { CAREER_EN } from "@/content/copy.career.en";
import { CAREER_PT } from "@/content/copy.career.pt";
import { orgById } from "@/data";
import { careerMatchProfile, loanDeadlineWeeksFor, matchEdgeOf, presetPrefs } from "@/engine/career/difficulty";
import { localSceneRefs } from "@/engine/career/localScene";
import type { CareerDifficulty, CareerSave } from "@/engine/career/types";
import { computeStars, localTeamFor, orgTeamFor, userTeamFor } from "@/engine/career/worldSim";
import { simulateSeries } from "@/engine/match";
import type { Region, TournamentTeam } from "@/engine/types";
import { createRng } from "@/lib/rng";
import { PRESET_BULLETS, matchFeelOf } from "@/components/career/wizard/PresetEffects";
import { createCareerSave, migrateSaveToV5, type CreateCareerInput } from "./careerFlow";

const identity = (region: Region) => ({
  orgName: "Preset Org",
  abbrev: "PRE",
  managerName: "Bot",
  country: "BR",
  region,
  crestId: "shield",
  colors: { primary: "#f97316", secondary: "#fde68a" },
  buffType: "consistency" as const,
});
const input = (difficulty: CareerDifficulty, over: Partial<CreateCareerInput> = {}, region: Region = "SAM"): CreateCareerInput => ({
  identity: identity(region),
  difficulty,
  rosterKey: "balanced",
  ...over,
});
const DIFFS: CareerDifficulty[] = ["easy", "normal", "hard"];
const COPY = { en: CAREER_EN, pt: CAREER_PT };

const intrinsic = (t: TournamentTeam) => t.rating.total - t.rating.difficultyShift;

function teams(save: CareerSave): { user: TournamentTeam; orgs: TournamentTeam[]; local: TournamentTeam } {
  const ctx = { world: save.world, seasonIndex: 0, careerSeed: save.careerSeed, difficulty: save.difficulty };
  const user = userTeamFor({
    identity: save.identity,
    squad: save.squad,
    starterIds: save.starterIds,
    coach: null,
    gear: save.finances.gear,
    bootcampSharp: 0,
    seasonIndex: 0,
    careerSeed: save.careerSeed,
    difficulty: save.difficulty,
  }).team;
  const orgs = Object.values(save.world.orgs)
    .filter((o) => o.region === save.identity.region)
    .map((o) => orgTeamFor(o.ref, ctx));
  const local = localTeamFor(localSceneRefs(save.identity.region, 0)[0], { careerSeed: save.careerSeed, seasonIndex: 0, difficulty: save.difficulty, anchor: 80 });
  return { user, orgs, local };
}

/** The user's Bo5 series wins against every org of his region, fixed rng seeds. */
function seriesWins(save: CareerSave): number {
  const { user, orgs } = teams(save);
  let wins = 0;
  for (const opp of orgs)
    for (let k = 0; k < 40; k++) {
      const res = simulateSeries(user, opp, { bestOf: TOURNAMENT.swiss.bestOf, stage: "swiss", difficulty: save.difficulty }, createRng(9_000 + k));
      if (res.winnerTeamId === "user") wins += 1;
    }
  return wins;
}

describe("BAL-02 — the career's own difficulty", () => {
  it("Easy and Normal keep rc.31's values but the AI shift (rc.33 BAL-04); Hard's two tuned keys are the documented ones", () => {
    const rc31 = {
      easy: { userRollRange: [-3, 5], aiRollRange: [-4, 4], chemistryMaxBonus: 1.3, opponentChemistryMaxBonus: 1.3, opponentRatingShift: -2 },
      normal: { userRollRange: [-3, 4], aiRollRange: [-4, 4], chemistryMaxBonus: 2, opponentChemistryMaxBonus: 2, opponentRatingShift: -1.05 },
      hard: { userRollRange: [-3.5, 4], aiRollRange: [-4, 4], chemistryMaxBonus: 2.4, opponentChemistryMaxBonus: 0, opponentRatingShift: -0.5 },
    };
    // rc.33 (BAL-04): only the AI shift moved — Easy −2 → −1.6, Normal −1.05 → −0.6.
    expect({ ...careerMatchProfile("easy"), opponentRatingShift: -2 }).toEqual(rc31.easy);
    expect({ ...careerMatchProfile("normal"), opponentRatingShift: -1.05 }).toEqual(rc31.normal);
    expect(careerMatchProfile("easy").opponentRatingShift).toBe(-1.6);
    expect(careerMatchProfile("normal").opponentRatingShift).toBe(-0.6);
    expect({ ...careerMatchProfile("hard"), opponentChemistryMaxBonus: 0, opponentRatingShift: -0.5 }).toEqual(rc31.hard);
    expect(careerMatchProfile("hard").opponentChemistryMaxBonus).toBe(2);
    expect(careerMatchProfile("hard").opponentRatingShift).toBe(-0.2);
    expect(CAREER_DIFFICULTY.defaultPreset).toBe("normal");
  });

  it("a Draft retune of DIFFICULTY cannot move a career team or a career series", () => {
    const before = DIFFS.map((d) => {
      const save = createCareerSave(input(d), 71_001);
      const t = teams(save);
      return { ratings: [intrinsic(t.user), ...t.orgs.map(intrinsic), intrinsic(t.local)], shifts: t.orgs.map((o) => o.rating.difficultyShift), wins: seriesWins(save) };
    });
    const saved = structuredClone(DIFFICULTY);
    try {
      for (const d of DIFFS) {
        const p = DIFFICULTY[d] as unknown as Record<string, unknown>;
        p.userRollRange = [-9, 1];
        p.aiRollRange = [0, 9];
        p.chemistryMaxBonus = 9;
        p.opponentChemistryMaxBonus = 9;
        p.opponentRatingShift = 6;
      }
      DIFFS.forEach((d, i) => {
        const save = createCareerSave(input(d), 71_001);
        const t = teams(save);
        expect([intrinsic(t.user), ...t.orgs.map(intrinsic), intrinsic(t.local)], d).toEqual(before[i].ratings);
        expect(t.orgs.map((o) => o.rating.difficultyShift), d).toEqual(before[i].shifts);
        expect(seriesWins(save), d).toBe(before[i].wins);
      });
    } finally {
      for (const d of Object.keys(saved) as (keyof typeof DIFFICULTY)[]) Object.assign(DIFFICULTY[d], saved[d]);
    }
  });

  it("matches: a small edge for the user on Easy, stronger opponents on Hard (same squad, same world)", () => {
    const wins = DIFFS.map((d) => seriesWins(createCareerSave(input(d), 71_002)));
    expect(wins[0]).toBeGreaterThan(wins[1]);
    expect(wins[1]).toBeGreaterThan(wins[2]);
    expect(matchEdgeOf("easy")).toBeGreaterThan(matchEdgeOf("normal"));
    expect(matchEdgeOf("normal")).toBeGreaterThan(matchEdgeOf("hard"));
    // Overall stays the main signal: no preset moves a side by more than a couple of points.
    for (const d of DIFFS) expect(Math.abs(careerMatchProfile(d).opponentRatingShift)).toBeLessThanOrEqual(2);
  });

  it("career teams carry the career's roll range; Draft teams never do", () => {
    const save = createCareerSave(input("hard"), 71_003);
    const t = teams(save);
    expect(t.user.rollRange).toEqual(careerMatchProfile("hard").userRollRange);
    for (const o of t.orgs) expect(o.rollRange).toEqual(careerMatchProfile("hard").aiRollRange);
    expect(t.local.rollRange).toEqual(careerMatchProfile("hard").aiRollRange);
  });
});

describe("BAL-02 — the presets replace the Management Style step", () => {
  it("a new career takes its preset's prefs: Easy and Normal delegate, Hard is hands-on", () => {
    for (const d of DIFFS) expect(createCareerSave(input(d), 71_010).prefs).toEqual(presetPrefs(d));
    expect(presetPrefs("normal").autoTrain).toBe(true);
    expect(presetPrefs("hard").autoTrain).toBe(false);
    expect(presetPrefs("hard").managementStyle).toBe("handsOn");
  });

  it("the legacy style input keeps rc.31's mapping; explicit prefs win over both", () => {
    const legacy = createCareerSave(input("hard", { style: "balanced" }), 71_011).prefs;
    expect(legacy).toEqual({ managementStyle: "balanced", autoTrain: true, autoEnterUnofficials: true, playbackDefault: "full", newsDigest: true });
    const explicit = createCareerSave(input("easy", { prefs: { autoTrain: false } }), 71_012).prefs;
    expect(explicit.autoTrain).toBe(false);
    expect(explicit.managementStyle).toBe(presetPrefs("easy").managementStyle);
  });

  it("an existing save keeps its prefs and managementStyle through the load", () => {
    const save = createCareerSave(input("normal", { style: "handsOn" }), 71_013);
    const loaded = migrateSaveToV5(JSON.parse(JSON.stringify(save)))!;
    expect(loaded.prefs).toEqual(save.prefs);
    expect(loaded.prefs.managementStyle).toBe("handsOn");
  });

  it("rc.34 (front I, Miguel 31/10): each preset is a promise and three plain bullets — matches, money, help — read live from balance.ts, EN and PT", () => {
    // The jargon a first-time player should never meet on this step.
    const JARGON = /breach|backer|chemistry|quebra|investidor|química|rating|×|\$|\d\.\d/i;
    for (const lang of ["en", "pt"] as const) {
      const C = COPY[lang];
      expect(PRESET_BULLETS.map((b) => b.key)).toEqual(["matches", "money", "help"]);
      for (const d of DIFFS) {
        const bullets = Object.fromEntries(PRESET_BULLETS.map((b) => [b.key, b.value(d, C)]));
        expect(bullets.matches).toBe(C.wizard.presetMatches[matchFeelOf(d)]);
        expect(bullets.help).toBe(presetPrefs(d).autoTrain ? C.wizard.presetHelpGuided : C.wizard.presetHelpHandsOn);
        const weeks = loanDeadlineWeeksFor(d);
        expect(bullets.money).toBe(weeks === null ? C.wizard.presetMoneyNoLoan : C.wizard.presetMoney(weeks));
        // Short and plain: one line of promise, bullets of a few words — no jargon, no figures but the weeks.
        const promise = C.wizard.presets[d].promise;
        expect(promise.split(/\s+/).length, `${lang} ${d} promise`).toBeLessThanOrEqual(12);
        for (const text of [promise, ...Object.values(bullets)]) {
          expect(text, `${lang} ${d}`).not.toMatch(JARGON);
          expect(text.split(/\s+/).length, `${lang} ${d}: ${text}`).toBeLessThanOrEqual(16);
        }
        expect(bullets.money.replace(String(weeks), "")).not.toMatch(/\d/);
      }
      // Three different promises, and the matches bullet tells the presets apart.
      expect(new Set(DIFFS.map((d) => C.wizard.presets[d].promise)).size).toBe(3);
      expect(new Set(DIFFS.map((d) => C.wizard.presetMatches[matchFeelOf(d)])).size).toBe(3);
      expect(C.wizard.finalKicker).not.toMatch(JARGON);
      expect([matchFeelOf("easy"), matchFeelOf("normal"), matchFeelOf("hard")]).toEqual(["easier", "even", "harder"]);
    }
  });

  it("the money bullet reads the loan's deadline from front H's key when it exists (CAREER_LOAN.emergency.deadlineWeeks), else the scaffold; no loan reads plainly", () => {
    const L = CAREER_LOAN as unknown as { emergency?: { deadlineWeeks?: Record<string, number | null> } };
    const had = "emergency" in L;
    const saved = L.emergency;
    const money = PRESET_BULLETS.find((b) => b.key === "money")!;
    try {
      if (!had) {
        // The scaffold: a deadline for every preset, shorter as the preset gets harder.
        const [e, n, h] = DIFFS.map((d) => loanDeadlineWeeksFor(d)!);
        expect(e).toBeGreaterThanOrEqual(n);
        expect(n).toBeGreaterThanOrEqual(h);
        expect(h).toBeGreaterThanOrEqual(1);
      }
      L.emergency = { ...(saved ?? {}), deadlineWeeks: { easy: 10, normal: 6, hard: 1 } };
      expect(DIFFS.map((d) => loanDeadlineWeeksFor(d))).toEqual([10, 6, 1]);
      expect(money.value("easy", COPY.en)).toBe("Out of money? The bank lends it — repay within 10 weeks or the career ends.");
      expect(money.value("hard", COPY.en)).toBe("Out of money? The bank lends it — repay within 1 week or the career ends.");
      expect(money.value("normal", COPY.pt)).toBe("Sem dinheiro? O banco empresta — pague em até 6 semanas ou a carreira acaba.");
      expect(money.value("hard", COPY.pt)).toBe("Sem dinheiro? O banco empresta — pague em até 1 semana ou a carreira acaba.");
      L.emergency = { ...(saved ?? {}), deadlineWeeks: { easy: 12, normal: 8, hard: null } };
      expect(money.value("hard", COPY.en)).toBe(COPY.en.wizard.presetMoneyNoLoan);
      expect(money.value("hard", COPY.pt)).toBe(COPY.pt.wizard.presetMoneyNoLoan);
    } finally {
      if (had) L.emergency = saved;
      else delete L.emergency;
    }
  });
});

describe("BAL-02 — filler orgs capped at the region's best real lineup (PROVISIONAL 30/10)", () => {
  /** A world where every filler org of a region is far stronger than its real orgs. */
  function strongFillers(region: Region): CareerSave {
    const save = createCareerSave(input("normal", {}, region), 71_020);
    for (const org of Object.values(save.world.orgs)) {
      if (org.region !== region || orgById.has(org.ref)) continue;
      for (const id of org.playerIds) save.world.overallDelta[id] = 25;
    }
    return save;
  }
  const ctxOf = (save: CareerSave) => ({ world: save.world, seasonIndex: 0, careerSeed: save.careerSeed, difficulty: save.difficulty });

  it("a filler org never out-rates the region's best real org; its players keep their overalls", () => {
    expect(CAREER_WORLD.fillerCapToBestReal).toBe(true);
    const save = strongFillers("NA");
    const orgs = Object.values(save.world.orgs).filter((o) => o.region === "NA");
    const best = Math.max(...orgs.filter((o) => orgById.has(o.ref)).map((o) => intrinsic(orgTeamFor(o.ref, ctxOf(save)))));
    const fillers = orgs.filter((o) => !orgById.has(o.ref));
    expect(fillers.length).toBeGreaterThan(0);
    for (const f of fillers) {
      const t = orgTeamFor(f.ref, ctxOf(save));
      expect(intrinsic(t)).toBeLessThanOrEqual(best + 0.11);
      expect(t.rating.avgPlayerOverall).toBeGreaterThan(best - 5);
    }
    // The stored snapshot (stars, seeding) reads the capped rating too.
    const stars = computeStars(save.world, { seasonIndex: 0, careerSeed: save.careerSeed, difficulty: "normal" });
    for (const f of fillers) expect(stars.orgs[f.ref].rating!).toBeLessThanOrEqual(best + 0.11);
  });

  it("switch back: CAREER_WORLD.fillerCapToBestReal false leaves filler orgs uncapped (rc.31)", () => {
    const W = CAREER_WORLD as { fillerCapToBestReal: boolean };
    const save = strongFillers("NA");
    const f = Object.values(save.world.orgs).find((o) => o.region === "NA" && !orgById.has(o.ref))!;
    const capped = intrinsic(orgTeamFor(f.ref, ctxOf(save)));
    try {
      W.fillerCapToBestReal = false;
      const raw = orgTeamFor(f.ref, { ...ctxOf(save), world: structuredClone(save.world) });
      expect(intrinsic(raw)).toBeGreaterThan(capped + 1);
    } finally {
      W.fillerCapToBestReal = true;
    }
  });
});
