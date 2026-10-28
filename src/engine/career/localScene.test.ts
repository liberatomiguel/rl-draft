import { describe, expect, it } from "vitest";
import { CAREER_UNOFFICIAL } from "@/config/balance";
import type { Region } from "../types";
import { localPlayerNames, localSceneRefs, localTeamName } from "./localScene";

const REGIONS: Region[] = ["NA", "EU", "SAM", "MENA", "OCE", "APAC", "SSA"];

describe("local amateur scene names (rc.28)", () => {
  it("every side of a region-season pool has its own name and its own three players", () => {
    const failures: string[] = [];
    for (let careerSeed = 1; careerSeed <= 300; careerSeed++) {
      for (const region of REGIONS) {
        for (let seasonIndex = 0; seasonIndex < 4; seasonIndex++) {
          const refs = localSceneRefs(region, seasonIndex);
          const teams = refs.map((ref) => localTeamName(ref, careerSeed));
          const players = refs.flatMap((ref) => localPlayerNames(ref, careerSeed));
          if (new Set(teams).size !== refs.length) failures.push(`${careerSeed} ${region} ${seasonIndex}: teams ${teams}`);
          if (new Set(players).size !== players.length) failures.push(`${careerSeed} ${region} ${seasonIndex}: players`);
        }
      }
    }
    expect(CAREER_UNOFFICIAL.localScenePool).toBe(8);
    expect(failures.slice(0, 5)).toEqual([]);
  });

  it("names are deterministic per career and differ across careers", () => {
    const ref = localSceneRefs("SAM", 0)[3];
    expect(localTeamName(ref, 77)).toBe(localTeamName(ref, 77));
    expect(localPlayerNames(ref, 77)).toEqual(localPlayerNames(ref, 77));
    const rosters = new Set(Array.from({ length: 20 }, (_, i) => localPlayerNames(ref, i + 1).join(",")));
    expect(rosters.size).toBeGreaterThan(10);
  });
});
