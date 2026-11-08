import { describe, expect, it } from "vitest";
import { challenges } from "@/data";
import { CHALLENGE_TEXT_EN } from "@/content/copy.challenges.en";
import { CHALLENGE_TEXT_PT } from "@/content/copy.challenges.pt";
import solutionsJson from "./__fixtures__/challenge-solutions.json";
import { replayChallenge, type ChallengeAction } from "./testing/challengeReplay";
import { evaluateStars, starSatisfied } from "./challenges";
import { displayTeamOverall } from "./rating";
import { challengeSchema } from "@/data/schemas";

export const challengeSolutions = solutionsJson as Record<string, { seed: number; actions: ChallengeAction[] }>;

describe("CH-02: every star is reachable in the actual fixed-seed game", () => {
  it("has a reviewed solution and EN/PT text for the entire expanded catalog", () => {
    const ids = challenges.map(c => c.id).sort();
    expect(ids.length).toBeGreaterThanOrEqual(45);
    expect(Object.keys(challengeSolutions).sort()).toEqual(ids);
    expect(Object.keys(CHALLENGE_TEXT_EN).sort()).toEqual(ids);
    expect(Object.keys(CHALLENGE_TEXT_PT).sort()).toEqual(ids);
  });
  for (const ch of challenges) it(`${ch.id}: legal picks and rerolls earn ALL three stars`, () => {
    const solution = challengeSolutions[ch.id];
    expect(solution.seed).toBe(ch.seed);
    const result = replayChallenge(ch, solution.actions);
    expect(result.mask).toBe(7);
    expect(Object.keys(result.draft.roster)).toHaveLength(6);
    if (ch.kind === "draft") expect(result.all).toEqual([]);
    else {
      expect(result.all).toHaveLength(1 + (ch.gauntlet?.lineupIds.length ?? 0));
      expect(result.all.every(s => s.winnerTeamId === "user")).toBe(true);
    }
    // A new attempt has the same offers, restrictions and outcome, including
    // specials: no sampled match seed or invented roster enters the proof.
    expect(replayChallenge(ch, solution.actions)).toEqual(result);
  });
});

describe("Draft Lab conditions", () => {
  const ch = challenges.find(c => c.kind === "draft")!;
  const result = () => replayChallenge(ch, challengeSolutions[ch.id].actions);
  it("uses the visible overall and requires its main objective before awarding any star", () => {
    const r = result();
    const ctx = { user: r.user, boss: null, all: [], bossOverall: 0, roster: r.draft.roster, rerollsUsed: 0 };
    const overall = displayTeamOverall(r.user.rating);
    expect(starSatisfied({ kind: "minOverall", min: overall }, ctx)).toBe(true);
    expect(starSatisfied({ kind: "minOverall", min: overall + 1 }, ctx)).toBe(false);
    expect(evaluateStars({ ...ch, objective: { kind: "minOverall", min: overall + 1 } }, ctx)).toBe(0);
  });
  it("rejects match-based conditions on draft-only challenges", () => {
    for (const kind of ["goals", "concede", "sweep", "underdog", "noLosses"]) {
      const objective = { kind, min: 10, max: 10, maxLosses: 2 };
      expect(challengeSchema.safeParse({ ...ch, objective }).success).toBe(false);
    }
  });
});
