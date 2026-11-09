/** Small contract checks only: no complete careers or matrix execution (the fork/extension checks are opt-in). */
import { expect, it } from "vitest";
import { createCareerSave, eventFieldFor, buyGearFlow, setPsychologistFlow } from "./careerFlow";
import { humanCohortPlan, humanMatrix, humanSmoke, AUDIT_REGIONS, AUDIT_DIFFICULTIES, AUDIT_ROSTERS, BASE_PROFILES } from "./auditHumanMatrix";
import { profileAliases, profiles } from "./auditHumanProfiles";
import { withWorldsExtra } from "./auditHumanSpy";
import { humanTelemetry } from "./auditHumanTelemetry";
import { ARC_POLICIES, advanceArcRun, startArcRun, type ArcCareer, type ArcRun } from "./auditHumanBot";
import type { CareerEventDef } from "@/engine/career/types";

export function auditFixture() {
  return createCareerSave({ identity: { orgName: "Audit", abbrev: "AUD", managerName: "Manager", country: "BR", region: "SAM",
    crestId: "shield", colors: { primary: "#f97316", secondary: "#fde68a" }, buffType: "consistency" },
  difficulty: "normal", rosterKey: "prospects" }, 9100);
}
it("plans every region/difficulty/roster/profile with two seeds and paired Worlds controls, without playing", () => {
  const cells = humanMatrix();
  expect(cells).toHaveLength(AUDIT_REGIONS.length * AUDIT_DIFFICULTIES.length * AUDIT_ROSTERS.length * Object.keys(profiles).length * 2 * 3 * 2);
  const coverage = new Map<string, Set<number>>();
  for (const c of cells) {
    const key = [c.region, c.difficulty, c.roster, c.profile, c.worldsExtra, c.cohort, c.seasons].join("|");
    if (!coverage.has(key)) coverage.set(key, new Set());
    coverage.get(key)!.add(c.seed);
  }
  expect([...coverage.values()].every(seeds => seeds.size === 2)).toBe(true);
  expect(humanSmoke()).toHaveLength(3);
  expect(() => humanMatrix([1, 1])).toThrow("two different seeds");
});
it("rc.37 cohort plan: every cell × distinct profile × both seeds once; pairs and the S20 extension fork from the control", () => {
  const aliases = profileAliases(ARC_POLICIES);
  // The identical effective policies found in the 41 profiles (same career, played once).
  expect(aliases).toEqual({ "style-consistency": "coachUpgrades", "briefing-adaptive": "coachUpgrades" });
  const units = humanCohortPlan({ aliases });
  const distinct = Object.keys(profiles).length - Object.keys(aliases).length;
  const cells = AUDIT_REGIONS.length * AUDIT_DIFFICULTIES.length * AUDIT_ROSTERS.length;
  expect(units).toHaveLength(cells * distinct * 2);
  expect(new Set(units.map((u) => u.key)).size).toBe(units.length);
  const seedsOf = new Map<string, Set<number>>();
  for (const u of units) {
    const c = u.cell;
    expect(c).toMatchObject({ seasons: 10, cohort: "coverage", worldsExtra: 0 });
    const key = [c.region, c.difficulty, c.roster, c.profile].join("|");
    (seedsOf.get(key) ?? seedsOf.set(key, new Set()).get(key)!).add(c.seed);
    const base = (BASE_PROFILES as readonly string[]).includes(c.profile);
    expect(u.worldsExtras).toEqual(base ? [0.5, 1] : []);
    expect(u.endlessTo).toBe(base && u.tier === "A" ? 20 : null);
    expect(u.tier === "A" || u.tier === "B").toBe(base);
  }
  expect(seedsOf.size).toBe(cells * distinct);
  expect([...seedsOf.values()].every((s) => s.size === 2)).toBe(true);
  expect(() => humanCohortPlan({ aliases, worldsExtras: [0] })).toThrow("positive increments");
});

/** A run's record without the wall clock (the only field two identical plays may differ in). */
function stable(out: ArcCareer) {
  return JSON.stringify({ ...out, ms: 0 });
}
const PROBE = { region: "SAM" as const, difficulty: "normal" as const, rosterKey: "balanced" as const, policy: profiles.experienced.base,
  policyOverrides: profiles.experienced.changes, seed: 9100, seasons: 2, budgetMs: 600_000 };

it.skipIf(process.env.HUMAN_AUDIT !== "1")("a fork taken mid-season continues exactly as the run it was cloned from", () => {
  const tel = humanTelemetry();
  const run = startArcRun(PROBE);
  let snap: { run: ArcRun; tel: ReturnType<typeof tel.state> } | null = null;
  advanceArcRun(run, 1, {
    onDay: tel.onDay, onSeason: tel.onSeason, onAction: tel.onAction, onEvent: tel.onEvent,
    fork: { when: (s) => s.clock.day === 61, take: (r) => { snap = structuredClone({ run: r, tel: tel.state() }); } },
  });
  const forked = snap as { run: ArcRun; tel: ReturnType<typeof tel.state> } | null;
  expect(forked).not.toBeNull();
  const copyTel = humanTelemetry(forked!.tel);
  advanceArcRun(forked!.run, 1, { onDay: copyTel.onDay, onSeason: copyTel.onSeason, onAction: copyTel.onAction, onEvent: copyTel.onEvent });
  expect(stable(forked!.run.out)).toBe(stable(run.out));
  expect(JSON.stringify(copyTel.result())).toBe(JSON.stringify(tel.result()));
  expect(forked!.run.save).toEqual(run.save);
}, 600_000);

it.skipIf(process.env.HUMAN_AUDIT !== "1")("an extension from a finished horizon plays the seasons a longer run plays", () => {
  const long = advanceArcRun(startArcRun(PROBE), 2);
  const short = advanceArcRun(startArcRun(PROBE), 1);
  expect(short.stage).toBe("seasonOver");
  advanceArcRun(short, 2);
  expect(stable(short.out)).toBe(stable(long.out));
  expect(short.save).toEqual(long.save);
}, 600_000);
it("raises only Worlds opponents by spy and restores after failure", () => {
  const save = auditFixture();
  // Frozen synthetic announced fields; no career is played to reach Worlds.
  const refs = [...Object.keys(save.world.orgs).slice(0, 15), "user"];
  save.competition.majorFieldRefs = refs;
  save.competition.worldsFieldRefs = refs;
  const def: CareerEventDef = { id: "audit-spy", tier: "worlds", seasonIndex: 0, week: 32, day: 224, name: "Audit", format: "swiss" };
  const baseline = eventFieldFor(save, def);
  const major = eventFieldFor(save, { ...def, tier: "major" });
  const result = withWorldsExtra(0.75, () => {
    expect(eventFieldFor(save, { ...def, tier: "major" })).toEqual(major);
    return eventFieldFor(save, def);
  });
  expect(result.applications).toBe(1);
  expect(result.value.field.filter(t => !t.isUser).length).toBeGreaterThan(0);
  for (const team of result.value.field) {
    const before = baseline.field.find(t => t.id === team.id)!;
    expect(team.rating.total - before.rating.total).toBeCloseTo(team.isUser ? 0 : 0.75);
  }
  expect(eventFieldFor(save, def)).toEqual(baseline);
  expect(() => withWorldsExtra(1, () => { throw Error("stop"); })).toThrow("stop");
  expect(eventFieldFor(save, def)).toEqual(baseline);
});
it("counts same-day spending once and measures capped marginal gain rather than advertised bonuses", () => {
  const before = auditFixture();
  // Synthetic boundary fixture, not a career outcome: everyone is at his true ceiling.
  before.reputation = 100; before.finances.balance = 1_000_000;
  for (const p of before.squad) { p.overall = 99; p.potential = 99; p.gainedThisSeason = 100; p.gainedThisSplit = 100; }
  const purchase = buyGearFlow(before, "peripherals");
  expect(purchase.error).toBeUndefined();
  const serialized = JSON.stringify(purchase.save), telemetry = humanTelemetry();
  telemetry.onAction("gear", before, purchase.save, "peripherals");
  telemetry.onDay(purchase.save); telemetry.onDay(purchase.save);
  const data = telemetry.result();
  expect(data.actions).toHaveLength(1);
  expect(data.actions[0].cashDelta).toBeLessThan(0);
  expect(data.actions[0].effect.trainingBonus).toBeGreaterThan(0);
  expect(data.actions[0].effect.fullDayGain).toBe(0);
  expect(data.finances.observedDays).toBe(1);
  expect(JSON.stringify(purchase.save)).toBe(serialized);
});

it("records capped attribute benefits even when an item has no scalar rating edge", () => {
  const before = auditFixture();
  before.reputation = 100; before.finances.balance = 1_000_000;
  for (const p of before.squad) {
    p.overall = 60;
    p.attrOffsets = { offense: 0, defense: 0, mechanics: 0, consistency: 0, experience: 0, clutch: 0 };
  }
  const hired = setPsychologistFlow(before, true);
  expect(hired.error).toBeUndefined();
  const telemetry = humanTelemetry();
  telemetry.onAction("psychologist", before, hired.save, "psychologist");
  const effect = telemetry.result().actions[0].effect;
  expect(effect.clutch).toBeGreaterThan(0);
  expect(effect.consistency).toBeGreaterThan(0);
  expect(effect.rating).toBe(0);
});
