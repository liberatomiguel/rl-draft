/**
 * rc9 ORG-UI: a takeover created with a name keeps it (Miguel, 27/11: "não dá
 * para adicionar seu nome ao escolher uma org existente, dá um nome aleatório").
 * The save's identity, the board's welcome mail and the takeover preview all
 * carry the typed name; a blank or one-letter name falls back to the generated one.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/config/balance", async (orig) => {
  const m = await orig<typeof import("@/config/balance")>();
  return { ...m, FEATURES: { ...m.FEATURES, board: true, realOrgStart: true } };
});

import { realOrgChoicesFor } from "@/engine/career/orgProfile";
import { buildWorldAtCreation, computeStars } from "@/engine/career/worldSim";
import { createCareerSave } from "@/store/careerFlow";
import { takeoverPreviewOf } from "@/store/takeoverPreview";
import { MANAGER_NAME_MAX, managerNameFor, takeoverInputOf } from "./takeoverInput";

const SEED = 4242;

function firstOrg() {
  const world = computeStars(buildWorldAtCreation(SEED), { seasonIndex: 0, careerSeed: SEED, difficulty: "normal" });
  const c = realOrgChoicesFor("EU", { careerSeed: SEED, seasonIndex: 0, difficulty: "normal", world })[0];
  if (!c) throw new Error("no EU org");
  return c;
}

describe("takeover manager name", () => {
  it("keeps the typed name in the save, the board's mail and the preview", () => {
    const name = managerNameFor("  Ana Lima ", "Sam Okoye");
    expect(name).toBe("Ana Lima");
    const input = takeoverInputOf(firstOrg(), "normal", name);
    const save = createCareerSave(input, SEED);
    expect(save.identity.managerName).toBe("Ana Lima");
    const mailNames = save.mail.map((m) => (m.params as Record<string, unknown> | undefined)?.manager).filter(Boolean);
    // The board's welcome mail names the manager on day one.
    expect(mailNames.length).toBeGreaterThan(0);
    for (const n of mailNames) expect(n).toBe("Ana Lima");
    expect(takeoverPreviewOf(input, SEED).save.identity.managerName).toBe("Ana Lima");
  });

  it("falls back to the generated name when blank or too short, and caps the length", () => {
    expect(managerNameFor("", "Sam Okoye")).toBe("Sam Okoye");
    expect(managerNameFor(" A ", "Sam Okoye")).toBe("Sam Okoye");
    expect(managerNameFor("x".repeat(40), "Sam Okoye")).toHaveLength(MANAGER_NAME_MAX);
  });
});
