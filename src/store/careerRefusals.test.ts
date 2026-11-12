/**
 * v2.0 (P1) — HQ asks why a purchase would be refused on every render. It
 * used to run the purchase flow on a copy (a deep copy of the whole save per
 * question); it now reads the flows' own refusal rules. Both must always give
 * the same answer, and a refusal must hand the same save back.
 */
import { describe, expect, it } from "vitest";
import type { GearItemId } from "@/engine/career/economy";
import type { CareerSave } from "@/engine/career/types";
import {
  bootcampRefusalOf,
  buyGearFlow,
  createCareerSave,
  gearRefusalOf,
  psychologistRefusalOf,
  runBootcampFlow,
  setPsychologistFlow,
  type CreateCareerInput,
} from "./careerFlow";
import { toolboxOf, toolboxRefusalOf } from "./careerHq";

const INPUT: CreateCareerInput = {
  identity: {
    orgName: "Refusal Test",
    abbrev: "REF",
    managerName: "Bot",
    country: "BR",
    region: "SAM",
    crestId: "shield",
    colors: { primary: "#f97316", secondary: "#fde68a" },
    buffType: "consistency",
  },
  difficulty: "normal",
  rosterKey: "balanced",
};

/** A spread of states: money, reputation, a camp already used, the ladder partly bought. */
function variants(): CareerSave[] {
  const base = createCareerSave(INPUT, 81_001);
  const out: CareerSave[] = [];
  for (const balance of [-50_000, 0, 5_000, 80_000, 5_000_000]) {
    for (const reputation of [0, 15, 35, 60, 95]) {
      const s = structuredClone(base);
      s.finances.balance = balance;
      s.reputation = reputation;
      out.push(s);
      const used = structuredClone(s);
      used.finances.bootcampUsedThisSplit = true;
      const first = toolboxOf(used).find((i) => i.kind === "gear");
      if (first) (used.finances.gear as unknown as Record<string, unknown>)[first.id] = true;
      out.push(used);
    }
  }
  return out;
}

describe("v2.0 (P1) — the toolbox refusal is the flow's own answer, read without a copy", () => {
  it("every item of the toolbox: the rule and the flow agree, and a refused flow returns the same save", () => {
    let asked = 0;
    for (const save of variants()) {
      for (const item of toolboxOf(save)) {
        const viaFlow =
          item.id === "bootcamp1" || item.id === "bootcamp2"
            ? runBootcampFlow(save)
            : item.id === "psych"
              ? setPsychologistFlow(save, true)
              : buyGearFlow(save, item.id as GearItemId);
        expect(toolboxRefusalOf(save, item.id), `${item.id} bal ${save.finances.balance} rep ${save.reputation}`).toBe(viaFlow.error ?? null);
        if (viaFlow.error) expect(viaFlow.save).toBe(save);
        else expect(viaFlow.save).not.toBe(save);
        asked += 1;
      }
    }
    expect(asked).toBeGreaterThan(100);
  });

  it("the three rules stand on their own (the flows start from them)", () => {
    const save = createCareerSave(INPUT, 81_002);
    const broke = { ...save, finances: { ...save.finances, balance: -1_000_000 } };
    const next = toolboxOf(save).find((i) => i.kind === "gear");
    if (next) {
      const id = next.id as GearItemId;
      expect(buyGearFlow(broke, id).error ?? null).toBe(gearRefusalOf(broke, id));
    }
    expect(runBootcampFlow(broke).error ?? null).toBe(bootcampRefusalOf(broke));
    expect(setPsychologistFlow(broke, true).error ?? null).toBe(psychologistRefusalOf(broke, true));
    // Switching the psychologist off is never refused.
    expect(psychologistRefusalOf(save, false)).toBeNull();
  });
});
