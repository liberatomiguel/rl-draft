import { describe, expect, it } from "vitest";
import { DATASET_FILES, validateDataset } from "./validate";
import type { Challenge } from "@/engine/types";

describe("challenge catalog authoring guards", () => {
  it("rejects a prerequisite cycle that would lock real content forever", () => {
    const challenges = structuredClone(DATASET_FILES.challenges) as Challenge[];
    challenges[0].prereq = challenges[1].id;
    challenges[1].prereq = challenges[0].id;
    expect(() => validateDataset({ ...DATASET_FILES, challenges })).toThrow(/prerequisite cycle/);
  });
  it("rejects a nonexistent scripted offer", () => {
    const challenges = structuredClone(DATASET_FILES.challenges) as Challenge[];
    const lab = challenges.find(c => "draftScript" in c)!;
    lab.draftScript = Array.from({ length: 6 }, () => ({ lineupId: "missing-lineup" }));
    expect(() => validateDataset({ ...DATASET_FILES, challenges })).toThrow(/unknown scripted lineup/);
  });
});
