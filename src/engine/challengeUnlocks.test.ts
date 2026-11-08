import { beforeEach, describe, expect, it } from "vitest";
import { challenges, challengeById } from "@/data/catalog";
import { RANKS } from "@/config/balance";
import { challengeStatus, challengeUnlockProgress } from "./challengeStars";
import { profileAvailableKeys, challengeKey } from "./profileNew";
import { useProfileStore } from "@/store/profileStore";
import { useRunStore } from "@/store/runStore";
import type { ChallengeUnlockCondition } from "./types";

describe("progressive challenge unlocks", () => {
  it("every challenge can be opened by Draft progression alone, without a circular milestone", () => {
    const completed: Record<string,string> = {}, stars: Record<string,number> = {};
    for (let pass=0; pass<challenges.length; pass++) {
      for (const ch of challenges) if (challengeStatus(ch, 60_000, completed, {challengeStars:stars}) !== "locked") {
        completed[ch.id] = "2026-11-09"; stars[ch.id] = 7;
      }
    }
    expect(Object.keys(completed).sort()).toEqual(challenges.map(c => c.id).sort());
    expect(new Set(challenges.map(c => c.rankRequired)).size).toBe(8);
  });
  it("rank AND previous challenge remain required; career is one alternative milestone", () => {
    const ch = challengeById.get("ch-gauntlet-final-bosses")!;
    const marks = {careerMarks:["car-first-worlds"]};
    expect(challengeStatus(ch,0,{},marks)).toBe("locked");
    expect(challengeStatus(ch,60_000,{},marks)).toBe("locked");
    expect(challengeStatus(ch,60_000,{[ch.prereq!]:"done"},marks)).toBe("available");
    expect(challengeStatus(ch,0,{[ch.id]:"already done"})).toBe("cleared");
  });
  it("counter gates open exactly at the target and OR alternatives do not require both", () => {
    const cases: ChallengeUnlockCondition[] = [{kind:"clears",count:3},{kind:"stars",count:9},{kind:"perfects",count:3},{kind:"quiz",count:3}];
    for(const condition of cases) {
      const below = {challengeStars:{a:7,b:1},quizSolved:2};
      const at = {challengeStars:{a:7,b:7,c:7},quizSolved:3};
      expect(challengeUnlockProgress(condition,{a:"done",b:"done"},below).met,condition.kind).toBe(false);
      expect(challengeUnlockProgress(condition,{a:"done",b:"done",c:"done"},at).met,condition.kind).toBe(true);
    }
    const ch=challengeById.get("ch-desert-rising")!;
    const xp=RANKS.find(r=>r.id===ch.rankRequired)!.minXp;
    expect(challengeStatus(ch,xp,{})).toBe("locked");
    expect(challengeStatus(ch,xp,{}, {careerMarks:["car-first-regional"]})).toBe("available");
    expect(challengeStatus(ch,xp,{a:"done",b:"done",c:"done"})).toBe("available");
    expect(challengeStatus(ch,xp-1,{}, {careerMarks:["car-first-regional"]})).toBe("locked");
  });
  it("the New dot uses exactly the same career, stars and quiz gates as the catalog", () => {
    const base={xp:60_000,unlockedSpecials:{},challengesCompleted:{}};
    const id="ch-desert-rising";
    expect(profileAvailableKeys(base)).not.toContain(challengeKey(id));
    expect(profileAvailableKeys({...base,careerMarks:["car-first-regional"]})).toContain(challengeKey(id));
    expect(profileAvailableKeys({...base,quiz:{solved:3}})).toContain(challengeKey("ch-global-alliance"));
  });
});

describe("unlock enforcement through the real store",()=>{
  beforeEach(()=>{useProfileStore.getState().resetAll();useRunStore.setState({run:null});});
  it("refuses a locked start without replacing another run, then accepts the mirrored Regional achievement",()=>{
    useProfileStore.setState({xp:4_000});
    useRunStore.getState().startChallenge("ch-first-final");
    const before=useRunStore.getState().run;
    useRunStore.getState().startChallenge("ch-desert-rising");
    expect(useRunStore.getState().run).toBe(before);
    useProfileStore.setState({careerMarks:["car-first-regional"]});
    useRunStore.getState().startChallenge("ch-desert-rising");
    expect(useRunStore.getState().run?.challengeId).toBe("ch-desert-rising");
  });
});
