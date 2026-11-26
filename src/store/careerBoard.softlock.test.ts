/**
 * v2.2 board front — opt-in soft-lock check of the two job moves (BOARD_SOFT=1),
 * played by the arc bot with whatever staging flags the run sets:
 *  - a manager dismissed at a review takes an offer and plays on;
 *  - a manager accepts an unsolicited approach and plays on.
 *   BOARD_SOFT=1 NEXT_PUBLIC_ENDLESS_VARIETY=1 … node ../../../node_modules/vitest/vitest.mjs run src/store/careerBoard.softlock.test.ts
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/config/balance", async (orig) => {
  const m = await orig<typeof import("@/config/balance")>();
  return { ...m, FEATURES: { ...m.FEATURES, board: true, realOrgStart: true } };
});

import { dismissalOffersFor } from "@/engine/career/manager";
import { realOrgChoicesFor } from "@/engine/career/orgProfile";
import type { CareerSave } from "@/engine/career/types";
import { buildWorldAtCreation, computeStars } from "@/engine/career/worldSim";
import type { Region } from "@/engine/types";
import { createCareerSave } from "./careerFlow";
import { playArcCareer } from "./careerArcBot";

const SEED = 5150;
const REGIONS: Region[] = ["NA", "EU", "SAM", "MENA", "OCE", "APAC", "SSA"];

function start(region: Region, stature: string): CareerSave {
  const world = computeStars(buildWorldAtCreation(SEED), { seasonIndex: 0, careerSeed: SEED, difficulty: "normal" });
  const pick = realOrgChoicesFor(region, { careerSeed: SEED, seasonIndex: 0, difficulty: "normal", world }).find((c) => c.stature === stature)!;
  return createCareerSave(
    { identity: { orgName: "S", abbrev: "S", managerName: "Bot", country: "US", region, crestId: "shield", colors: { primary: "#f97316", secondary: "#fff" }, buffType: "offense" }, difficulty: "normal", rosterKey: "balanced", realOrgRef: pick.ref },
    SEED,
  );
}

describe.skipIf(!process.env.BOARD_SOFT)("board job moves under the arc bot", () => {
  it("dismissed at the season-2 review, takes an offer, plays two more seasons", () => {
    let moved = "";
    const first = start("EU", "mid");
    const original = first.identity.orgName;
    const out = playArcCareer({
      region: "EU", difficulty: "normal", policy: "tuned", seed: SEED, seasons: 4, startFrom: first, budgetMs: 900_000,
      onSeason: (moment, save) => {
        if (moment === "start" && save.clock.seasonIndex === 2) moved = save.identity.orgName;
        if (moment !== "end" || save.clock.seasonIndex !== 1 || !save.board || !save.manager) return;
        save.board.dismissedSeason = 1;
        save.manager.offers = dismissalOffersFor({ world: save.world, rep: save.manager.reputation, home: "EU", regions: REGIONS, exclude: [save.identity.realOrgRef ?? ""], careerSeed: SEED, seasonIndex: 1, foundName: "New Club" });
      },
    });
    expect(out.softlock).toBeNull();
    expect(out.seasons.length).toBe(4);
    expect(moved).not.toBe(original);
  }, 1_000_000);

  it("accepts an unsolicited approach after season 1 and plays two more seasons", () => {
    const names: string[] = [];
    const out = playArcCareer({
      region: "SAM", difficulty: "normal", policy: "tuned", seed: SEED, seasons: 3, startFrom: start("SAM", "underdog"), budgetMs: 900_000, boardApproach: true,
      onSeason: (moment, save) => {
        if (moment === "start") names.push(save.identity.orgName);
        if (moment !== "end" || save.clock.seasonIndex !== 0 || !save.manager) return;
        const o = dismissalOffersFor({ world: save.world, rep: 80, home: "SAM", regions: REGIONS, exclude: [save.identity.realOrgRef ?? ""], careerSeed: SEED, seasonIndex: 0, foundName: "x" }).find((x) => x.kind === "org")!;
        save.manager.offers = [{ ...o, reason: "approach" }];
      },
    });
    expect(out.softlock).toBeNull();
    expect(out.seasons.length).toBe(3);
    expect(names[1]).not.toBe(names[0]);
  }, 1_000_000);
});
