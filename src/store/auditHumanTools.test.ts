/** Small contract checks only: no complete careers or matrix execution. */
import { expect, it } from "vitest";
import { createCareerSave, eventFieldFor, buyGearFlow, setPsychologistFlow } from "./careerFlow";
import { humanMatrix, humanSmoke, AUDIT_REGIONS, AUDIT_DIFFICULTIES, AUDIT_ROSTERS } from "./auditHumanMatrix";
import { profiles } from "./auditHumanProfiles";
import { withWorldsExtra } from "./auditHumanSpy";
import { humanTelemetry } from "./auditHumanTelemetry";
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
