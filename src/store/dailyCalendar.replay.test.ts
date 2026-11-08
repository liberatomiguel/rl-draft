import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import solutionsJson from "@/engine/__fixtures__/daily-solutions-v2.json";
import type { ChallengeAction } from "@/engine/testing/challengeReplay";
import { DAILY_ROTATION_START, dailySeedForDate } from "@/lib/dailyPlan";
import { useProfileStore } from "./profileStore";
import { useRunStore } from "./runStore";
import { useRewardToasts } from "./rewardToastStore";

const solutions=solutionsJson as Record<string,{seed:number;actions:ChallengeAction[]}>;
beforeEach(()=>{vi.useFakeTimers();useProfileStore.getState().resetAll();useRunStore.setState({run:null});useRewardToasts.setState({queue:[],loginModal:null});});
afterEach(()=>vi.useRealTimers());

describe("a year of daily challenges through the real game",()=>{
  it("has a continuous reviewed year, with 365 distinct fixed seeds",()=>{
    const dates=Object.keys(solutions).sort();
    expect(dates).toHaveLength(365);
    expect(dates[0]).toBe(DAILY_ROTATION_START);
    dates.forEach((date,i)=>expect(date).toBe(new Date(Date.parse(`${DAILY_ROTATION_START}T00:00:00Z`)+i*86400000).toISOString().slice(0,10)));
    expect(new Set(Object.values(solutions).map(s=>s.seed)).size).toBe(365);
  });
  for(const [date,solution] of Object.entries(solutions)) it(`${date}: legal picks, reload, title + bonus and a single official reward`,()=>{
    vi.setSystemTime(new Date(`${date}T12:00:00Z`));
    useRunStore.getState().startDailyRun();
    expect(useRunStore.getState().run?.seed).toBe(solution.seed);
    expect(dailySeedForDate(date)).toBe(solution.seed);
    solution.actions.forEach((action,i)=>{
      const store=useRunStore.getState();
      if(action.kind==="reroll") {expect(store.run!.draft.rerollsLeft).toBeGreaterThan(0);store.reroll();}
      else if(action.kind==="freeReroll") {expect(store.run!.draft.offer!.hasPickableCard).toBe(false);store.freeReroll();}
      else {
        const card=store.run!.draft.offer!.cards.find(c=>c.refId===action.refId&&c.specialId===action.specialId);
        expect(card?.availability).toBe("available");
        expect(store.run!.draft.roster[action.slot]).toBeUndefined();
        store.pickCard(card!,action.slot);
      }
      if(i===2)useRunStore.setState({run:JSON.parse(JSON.stringify(useRunStore.getState().run))});
    });
    expect(useRunStore.getState().run!.phase).toBe("review");
    useRunStore.getState().startTournament();
    for(let guard=0;useRunStore.getState().run!.tournament!.stage!=="finished"&&guard<30;guard++)useRunStore.getState().playRound();
    useRunStore.getState().finishRun();
    const run=useRunStore.getState().run!;
    expect(run.results?.placement).toBe("champion");
    if(run.daily!.objective)expect(run.results!.xp.lines.some(l=>l.key==="objective")).toBe(true);
    const xp=useProfileStore.getState().xp;
    const completed=useProfileStore.getState().dailyResults;
    useRunStore.setState({run:JSON.parse(JSON.stringify(run))});useRunStore.getState().finishRun();
    expect(useProfileStore.getState().xp).toBe(xp);
    expect(useProfileStore.getState().dailyResults).toEqual(completed);
    const finished=useRunStore.getState().run;
    useRunStore.getState().startDailyRun();
    expect(useRunStore.getState().run).toBe(finished);
  });
});
