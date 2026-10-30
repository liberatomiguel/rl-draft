import { describe, expect, it } from "vitest";
import { CAREER_LADDER, CAREER_UNLOCKS } from "@/config/balance";
import { coachHireRefusalFor, ladderLevelFor, ladderRungs, sponsorLadderLevelFor, sponsorLadderLevelOf } from "./ladder";

describe("rc.35 progression ladder", () => {
  it("runs in Miguel's order, gates never decreasing", () => {
    const ids = ladderRungs().map((r) => r.id);
    const idx = (id: string) => ids.indexOf(id as never);
    expect(idx("peripherals")).toBeLessThan(idx("coach"));
    expect(idx("coach")).toBeLessThan(idx("monitors"));
    // rc.35 integration (Miguel): local sponsors open with the generic coach, at rep 10.
    expect(idx("sponsors1")).toBeLessThan(idx("monitors"));
    expect(idx("monitors")).toBeLessThan(idx("pcs"));
    expect(idx("pcs")).toBeLessThan(idx("exProCoach"));
    expect(idx("exProCoach")).toBeLessThan(idx("bootcamp1"));
    expect(idx("bootcamp1")).toBeLessThan(idx("sponsors2"));
    expect(idx("sponsors2")).toBeLessThan(idx("psychologist"));
    expect(idx("psychologist")).toBeLessThan(idx("sponsors3"));
    expect(idx("sponsors3")).toBeLessThan(idx("perfCenter"));
    const gates = ladderRungs().map((r) => r.gate);
    expect([...gates].sort((a, b) => a - b)).toEqual(gates);
  });

  it("levels count the rungs reached", () => {
    expect(ladderLevelFor(0)).toBe(0);
    expect(ladderLevelFor(1000)).toBe(ladderRungs().length);
  });

  it("sponsor ladder level is 0–4 and the seam reads the save", () => {
    expect(sponsorLadderLevelFor(CAREER_LADDER.sponsorRep[0] - 1)).toBe(0);
    expect(sponsorLadderLevelFor(CAREER_LADDER.sponsorRep[0])).toBe(1);
    expect(sponsorLadderLevelFor(CAREER_LADDER.sponsorRep[2])).toBe(3);
    expect(sponsorLadderLevelOf({ reputation: 1000 })).toBe(4);
  });

  it("gates generic coaches, then ex-pros", () => {
    expect(coachHireRefusalFor(CAREER_UNLOCKS.coachRep - 1, { source: "generated" })).toBe("repGate");
    expect(coachHireRefusalFor(CAREER_UNLOCKS.coachRep, { source: "generated" })).toBeNull();
    expect(coachHireRefusalFor(CAREER_UNLOCKS.coachRep, { source: "real" })).toBe("exProGate");
    expect(coachHireRefusalFor(CAREER_LADDER.exProCoachRep, { source: "real" })).toBeNull();
  });
});
