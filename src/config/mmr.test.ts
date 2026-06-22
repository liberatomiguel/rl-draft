/**
 * MMR economy (v1.4 rework) — guards the flat win-only award table and the
 * retroactive backfill curve (capped at 1500, title-less stays at the start).
 */

import { describe, expect, it } from "vitest";
import { MMR, mmrAfterRun, mmrBackfillFloor, mmrRawGain } from "./balance";

describe("mmrRawGain — wins only, flat table", () => {
  it("awards the configured title value for a champion at each difficulty", () => {
    // Reference MMR.award (not hardcoded numbers) so re-tuning the values can't break
    // this — it pins the WIRING (champion → that difficulty's title award), not the figure.
    expect(mmrRawGain("easy", "champion")).toBe(MMR.award.easyTitle);
    expect(mmrRawGain("normal", "champion")).toBe(MMR.award.normalTitle);
    expect(mmrRawGain("hard", "champion")).toBe(MMR.award.hardTitle);
    expect(mmrRawGain("legacy", "champion")).toBe(MMR.award.legacyTitle);
  });

  it("awards the Legacy grand finalist (runner-up) value, and only on Legacy", () => {
    expect(mmrRawGain("legacy", "runner_up")).toBe(MMR.award.legacyFinalist);
    expect(mmrRawGain("hard", "runner_up")).toBe(0);
    expect(mmrRawGain("normal", "runner_up")).toBe(0);
  });

  it("awards nothing for any non-qualifying placement", () => {
    for (const p of ["third", "fourth", "top4", "top6", "top8", "swiss_exit"] as const) {
      expect(mmrRawGain("legacy", p)).toBe(0);
      expect(mmrRawGain("hard", p)).toBe(0);
    }
  });
});

describe("mmrAfterRun — linear add", () => {
  it("adds the flat award and nothing else", () => {
    expect(mmrAfterRun(1000, "hard", "champion")).toBe(1000 + MMR.award.hardTitle);
    expect(mmrAfterRun(1490, "legacy", "champion")).toBe(1490 + MMR.award.legacyTitle); // climbs past 1500 live
    expect(mmrAfterRun(1200, "normal", "swiss_exit")).toBe(1200); // mediocre run = no gain
  });
});

describe("mmrBackfillFloor — capped at 1500, elites near it", () => {
  it("leaves a title-less account at the start (1000)", () => {
    expect(mmrBackfillFloor({ easy: 0, normal: 0, hard: 0, legacy: 0 })).toBe(MMR.start);
  });

  it("never exceeds the 1500 backfill cap, even for an absurd history", () => {
    const huge = mmrBackfillFloor({ easy: 200, normal: 200, hard: 200, legacy: 200 });
    expect(huge).toBeLessThanOrEqual(MMR.backfillCap);
    expect(huge).toBe(MMR.backfillCap);
  });

  it("puts a strong title history near (but under) the cap", () => {
    // ~ a very good player: lots of titles across difficulties.
    const strong = mmrBackfillFloor({ easy: 30, normal: 40, hard: 25, legacy: 20 });
    expect(strong).toBeGreaterThan(1430);
    expect(strong).toBeLessThan(MMR.backfillCap);
  });

  it("is monotonic — more titles never lowers the value", () => {
    const a = mmrBackfillFloor({ easy: 1, normal: 1, hard: 1, legacy: 0 });
    const b = mmrBackfillFloor({ easy: 1, normal: 1, hard: 1, legacy: 5 });
    expect(b).toBeGreaterThanOrEqual(a);
  });
});
