import { describe, expect, it } from "vitest";
import { quizFacts, quizForDate, cluesFor, matchesQuizClues, QUIZ_ROTATION_START } from "./quiz";
import { visibleClues } from "./quizState";
import { createRng } from "@/lib/rng";
import { generateDailyConfig } from "@/lib/daily";
import { DAILY_ROTATION, DAILY_ROTATION_START, dailyInfo, dailySeedForDate } from "@/lib/dailyPlan";
import { QUIZ } from "@/config/balance";

const datesFrom = (start:string,n:number) => Array.from({length:n},(_,i)=>new Date(Date.parse(`${start}T00:00:00Z`)+i*86400000).toISOString().slice(0,10));

describe("daily content volume and coherence",()=>{
  it("has at least 200 eligible answers; every player appears once before a repeat",()=>{
    const count=quizFacts().size;
    expect(count).toBeGreaterThanOrEqual(200);
    const days=datesFrom(QUIZ_ROTATION_START,count*2);
    const ids=days.map(date=>quizForDate(date).playerId);
    expect(new Set(ids.slice(0,count)).size).toBe(count);
    expect(new Set(ids.slice(count)).size).toBe(count);
    for(let i=1;i<ids.length;i++) expect(ids[i],days[i]).not.toBe(ids[i-1]);
  });
  it("every full clue ladder identifies exactly one eligible player, across teammate variations",()=>{
    const facts=[...quizFacts().values()];
    for(const f of facts) for(const seed of [1,7,37,259]) {
      const clues=cluesFor(f,createRng(seed));
      const matches=facts.filter(other=>matchesQuizClues(other,clues));
      expect(matches.map(m=>m.player.id),`${f.player.id}, seed ${seed}`).toEqual([f.player.id]);
      expect(visibleClues({date:QUIZ_ROTATION_START,playerId:f.player.id,clues},QUIZ.attempts-1)).toEqual(clues);
    }
  });
  it("every 11-day daily cycle includes all formats, without adjacent Hard/Legacy days",()=>{
    const days=datesFrom(DAILY_ROTATION_START,730);
    const configs=days.map(d=>generateDailyConfig(d));
    expect(new Set(days.map(dailySeedForDate)).size).toBe(days.length);
    for(let start=0;start+DAILY_ROTATION.length<=days.length;start+=DAILY_ROTATION.length) {
      expect(new Set(configs.slice(start,start+DAILY_ROTATION.length).map(c=>c.info.templateId)).size).toBe(11);
    }
    for(let i=0;i<configs.length;i++) {
      const c=configs[i];
      expect(c.info,days[i]).toEqual(dailyInfo(days[i]));
      if(i>0) {
        expect(c.info.templateId).not.toBe(configs[i-1].info.templateId);
        expect(c.difficulty!=="normal" && configs[i-1].difficulty!=="normal").toBe(false);
      }
    }
  });
  it("retains historical answer selection before the versioned UTC cutover",()=>{
    const ids=[...quizFacts().keys()].sort();
    for(const date of ["2026-06-17","2026-11-07","2026-11-08"]) {
      let seed=0x811c9dc5; for(const c of `quiz:${date}`){seed^=c.charCodeAt(0);seed=Math.imul(seed,0x01000193);}
      expect(quizForDate(date).playerId).toBe(ids[createRng(seed>>>0).int(0,ids.length-1)]);
    }
  });
});
