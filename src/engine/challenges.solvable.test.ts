import { readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { challenges } from "@/data";
import { CHALLENGE_TEXT_EN } from "@/content/copy.challenges.en";
import { CHALLENGE_TEXT_PT } from "@/content/copy.challenges.pt";
import solutionsJson from "./__fixtures__/challenge-solutions.json";
import { exploreChallenge, replayChallenge, type ChallengeAction } from "./testing/challengeReplay";
import { evaluateStars, starSatisfied } from "./challenges";
import { displayTeamOverall } from "./rating";
import { challengeSchema } from "@/data/schemas";

export const challengeSolutions = solutionsJson as Record<string, { seed: number; actions: ChallengeAction[] }>;

// Catalogue authoring gate: replace only invalid replay witnesses, retaining
// the rules, rank gates and star objectives. Opt-in reseeding repairs a
// catalogue whose old fixed offers no longer have a witnessed full-star path.
it.skipIf(!process.env.CHALLENGE_REFRESH)("refreshes challenge replay witnesses for the final catalogue",()=>{
  const next=structuredClone(challengeSolutions), failures:string[]=[], refreshed:string[]=[];
  const catalog=JSON.parse(readFileSync("src/data/challenges.json","utf8")) as typeof challenges;
  const seedChanges: {id:string;before:number;after:number}[]=[];
  for(const ch of challenges) {
    try { if(replayChallenge(ch,next[ch.id].actions).mask===7)continue; } catch { /* Search a new legal path. */ }
    let found=false;
    for(let policy=1;policy<=Number(process.env.CHALLENGE_PATHS ?? 2000);policy++) {
      const a=exploreChallenge(ch,policy);
      if(a?.mask!==7)continue;
      next[ch.id]={seed:ch.seed,actions:a.actions};found=true;refreshed.push(ch.id);break;
    }
    if (!found && process.env.CHALLENGE_RESEED) {
      for (let offset=1; offset<=64 && !found; offset++) {
        const candidate={...ch,seed:ch.seed+offset};
        for (let policy=1;policy<=1000;policy++) {
          const a=exploreChallenge(candidate,policy);
          if(a?.mask!==7)continue;
          next[ch.id]={seed:candidate.seed,actions:a.actions};found=true;refreshed.push(ch.id);
          catalog.find(c=>c.id===ch.id)!.seed=candidate.seed;
          seedChanges.push({id:ch.id,before:ch.seed,after:candidate.seed});break;
        }
      }
    }
    if(!found)failures.push(ch.id);
  }
  if(process.env.CHALLENGE_REPORT)writeFileSync(process.env.CHALLENGE_REPORT,JSON.stringify({refreshed,seedChanges,failures},null,2));
  expect(failures).toEqual([]);
  writeFileSync("src/engine/__fixtures__/challenge-solutions.json",JSON.stringify(next,null,2)+"\n");
  if(seedChanges.length)writeFileSync("src/data/challenges.json",JSON.stringify(catalog,null,2)+"\n");
},180_000);

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

describe("Challenge objective quality", () => {
  it("rejects stars already guaranteed by the no-specials or scripted draft rules", () => {
    const ch = challenges[0];
    expect(challengeSchema.safeParse({ ...ch, constraint: { noSpecials: true }, stars: [{ kind: "noSpecials" }, { kind: "goals", min: 12 }] }).success).toBe(false);
    expect(challengeSchema.safeParse({ ...ch, draftScript: [{ lineupId: ch.opponentLineupId }], stars: [{ kind: "maxRerolls", max: 0 }, { kind: "goals", min: 12 }] }).success).toBe(false);
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
