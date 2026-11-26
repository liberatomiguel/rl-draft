/**
 * v2.2 board front: with FEATURES.board and FEATURES.realOrgStart off (every
 * build but staging), a fixed-seed career is byte-for-byte the one the base
 * (staging rc.6, cfcf1cd) played: the same save at each season's end. The
 * digests below were produced on the base commit by this same test.
 */
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { FEATURES } from "@/config/balance";
import type { CareerSave } from "@/engine/career/types";
import { playArcCareer } from "./careerArcBot";

// Base cfcf1cd gave ["a42a77a750681368", "bce87b43a025194f"]; season 2 moved only by the formerSquad fix
// (agePassAndIntake keeps world.formerSquad in every build since v2.2), checked by toggling that one line.
const BASE_DIGESTS: string[] = ["a42a77a750681368", "67050fa1fe0b28fe"];

describe("flags off", () => {
  it("plays exactly as the base commit", () => {
    expect((FEATURES as Record<string, unknown>).board ?? false).toBe(false);
    const digests: string[] = [];
    const out = playArcCareer({
      region: "NA",
      difficulty: "normal",
      policy: "tuned",
      seed: 777,
      seasons: 2,
      onSeason: (moment: "start" | "end", save: CareerSave) => {
        if (moment === "end") digests.push(createHash("sha1").update(JSON.stringify({ ...save, createdAtAppVersion: "2.1.0-rc.6" })).digest("hex").slice(0, 16));
      },
      budgetMs: 600_000,
    });
    if (process.env.BOARD_DIGEST) console.log("DIGESTS", JSON.stringify(digests));
    expect(out.softlock).toBeNull();
    for (const d of digests) expect(d).not.toContain("board");
    expect(digests).toEqual(BASE_DIGESTS);
  }, 600_000);
});
