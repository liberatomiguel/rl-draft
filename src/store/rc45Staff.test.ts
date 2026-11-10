/**
 * rc.45 (R120): the support-staff retainers (CAREER_STAFF).
 */
import { describe, expect, it } from "vitest";
import { CAREER_DEV, CAREER_PLAN, CAREER_STAFF } from "@/config/balance";
import { staffOn, staffPerSplitFor, staffWeeklyOf, weeklyOf } from "@/engine/career/economy";
import { ladderOf, ladderRungs } from "@/engine/career/ladder";
import type { CareerSave, StaffId } from "@/engine/career/types";
import { createCareerSave, setStaffFlow, weeklyStatementOf, type CreateCareerInput } from "./careerFlow";
import { wearRiskMultOf } from "./careerTraining";

const INPUT: CreateCareerInput = {
  identity: {
    orgName: "Staff Test",
    abbrev: "STF",
    managerName: "Tester",
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

const fresh = (rep: number): CareerSave => {
  const save = createCareerSave(INPUT, 45_001);
  save.reputation = rep;
  save.finances.balance = 500_000;
  return save;
};

describe("rc.45 (R120): support staff", () => {
  it("every role sits on the ladder at its gate, in the declared order", () => {
    const rungs = ladderRungs();
    for (const id of CAREER_STAFF.order) {
      const rung = rungs.find((r) => r.id === id);
      expect(rung).toMatchObject({ kind: "staff", gate: CAREER_STAFF.roles[id].repGate });
    }
    const gates = CAREER_STAFF.order.map((id) => CAREER_STAFF.roles[id].repGate);
    expect([...gates].sort((a, b) => a - b)).toEqual(gates);
  });

  it("a role is locked under its gate, retained above it, billed on Mondays and released at will", () => {
    for (const id of CAREER_STAFF.order) {
      const gate = CAREER_STAFF.roles[id].repGate;
      expect(setStaffFlow(fresh(gate - 1), id, true).error).toBe("locked");
      const save = fresh(gate);
      const before = weeklyStatementOf(save);
      expect(before.staff).toBe(0);
      const hired = setStaffFlow(save, id, true);
      expect(hired.error).toBeUndefined();
      expect(staffOn(hired.save.finances.gear, id)).toBe(true);
      expect(ladderOf(hired.save).find((r) => r.id === id)?.status).toBe("owned");
      const after = weeklyStatementOf(hired.save);
      expect(after.staff).toBe(weeklyOf(staffPerSplitFor(id, 0)));
      expect(after.expenses - before.expenses).toBe(after.staff);
      expect(staffWeeklyOf(hired.save.finances.gear, 0)).toBe(after.staff);
      const released = setStaffFlow(hired.save, id, false).save;
      expect(staffOn(released.finances.gear, id)).toBe(false);
      expect(weeklyStatementOf(released).staff).toBe(0);
    }
  });

  it("a save from before rc.45 (no staff field) reads as nobody retained", () => {
    const save = fresh(99);
    delete save.finances.gear.staff;
    for (const id of CAREER_STAFF.order) expect(staffOn(save.finances.gear, id)).toBe(false);
    expect(weeklyStatementOf(save).staff).toBe(0);
    expect(setStaffFlow(save, "analyst", true).save.finances.gear.staff).toEqual({ analyst: true });
  });

  it("the physio cuts the wear risk on top of the coach; the assistant lifts the bench share; the doses stay modest", () => {
    const save = fresh(99);
    const base = wearRiskMultOf(save);
    const withPhysio = wearRiskMultOf(setStaffFlow(save, "physio", true).save);
    expect(withPhysio).toBeCloseTo(base * CAREER_STAFF.roles.physio.wearRiskMult, 9);
    expect(base).toBe(save.coach ? CAREER_PLAN.wear.coachRiskMult : 1);
    const R = CAREER_STAFF.roles;
    expect(R.assistant.benchXpShare).toBeGreaterThan(CAREER_DEV.benchXpShare);
    expect(R.assistant.benchXpShare).toBeLessThan(1);
    expect(R.analyst.playoffRating).toBeLessThanOrEqual(1);
    expect(R.physio.wearRiskMult).toBeGreaterThanOrEqual(0.5);
    expect(R.brand.sponsorValueMult).toBeLessThanOrEqual(1.2);
    const ids: StaffId[] = [...CAREER_STAFF.order];
    expect(ids.length).toBe(4);
  });
});
