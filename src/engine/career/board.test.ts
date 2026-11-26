import { describe, expect, it } from "vitest";
import { CAREER_BOARD } from "@/config/balance";
import { applyConfidence, checkpointDelta, newBoardState, objectiveAimOf, ultimatumAllowed } from "./board";
import { abbrevFor, patienceOf, statureFor } from "./orgProfile";
import { reachOf } from "./manager";

describe("board engine", () => {
  it("stature reads rank and prestige; abbreviations are short", () => {
    expect(statureFor(1, 0)).toBe("elite");
    expect(statureFor(4, 3)).toBe("elite");
    expect(statureFor(4, 1)).toBe("contender");
    expect(statureFor(9, 0)).toBe("mid");
    expect(statureFor(14, 0)).toBe("underdog");
    expect(abbrevFor("Gentle Mates")).toBe("GM");
    expect(abbrevFor("Vitality")).toBe("VIT");
    expect(abbrevFor("Team BDS")).toBe("TB");
  });

  it("a giant is less patient than an underdog; Hard less than Easy; the ambitious aim is harder", () => {
    expect(patienceOf("elite", "normal")).toBeGreaterThan(patienceOf("underdog", "normal"));
    expect(patienceOf("mid", "hard")).toBeGreaterThan(patienceOf("mid", "easy"));
    expect(objectiveAimOf("ambitious", "mid", "normal")).toBeLessThan(objectiveAimOf("expected", "mid", "normal"));
    expect(objectiveAimOf("cautious", "mid", "normal")).toBeGreaterThan(objectiveAimOf("expected", "mid", "normal"));
  });

  it("every change is logged with its reason; a title halves losses and blocks the ultimatum; grace seasons block it", () => {
    const b = newBoardState({ kind: "board", stature: "mid", startSeason: 0, weekWages: 1000, grantBase: 0, wageRoom: 1200 });
    applyConfidence(b, -10, "objectiveMissed", { seasonIndex: 0, day: 224 });
    expect(b.confidence).toBe(CAREER_BOARD.confidence.start - 10);
    expect(b.log[0]).toMatchObject({ delta: -10, reason: "objectiveMissed" });
    expect(ultimatumAllowed(b, 0)).toBe(false);
    expect(ultimatumAllowed(b, 1)).toBe(true);
    b.protectedUntil = 1;
    applyConfidence(b, -10, "behind", { seasonIndex: 1, day: 71 });
    expect(b.log[0].delta).toBe(-5);
    expect(ultimatumAllowed(b, 1)).toBe(false);
    const owners = newBoardState({ kind: "owners", stature: "owners", startSeason: 0, weekWages: 1000, grantBase: 0, wageRoom: 1200 });
    expect(ultimatumAllowed(owners, 1)).toBe(false);
    expect(ultimatumAllowed(owners, 2)).toBe(true);
  });

  it("checkpoints move with the objective's chance, inside their clamp; reputation opens bigger seats", () => {
    expect(checkpointDelta(0.6, 0.6)).toBe(0);
    expect(checkpointDelta(0.6, 0)).toBe(CAREER_BOARD.checkpoint.min);
    expect(checkpointDelta(0.4, 1)).toBe(CAREER_BOARD.checkpoint.max);
    expect(reachOf(10)).toBe("underdog");
    expect(reachOf(80)).toBe("elite");
  });
});
