/** Opt-in content audit; decision RNG never enters the game's RNG stream. */
import { readFileSync, writeFileSync } from "node:fs";
import { expect, it } from "vitest";
import { coachById, playerById, playerCardById, specialCardById, specialCards, subById } from "@/data";
import { generateDailyConfig } from "@/lib/daily";
import { DAILY_ROTATION_START, dailySeedForDate, seedFromDate } from "@/lib/dailyPlan";
import { createRng } from "@/lib/rng";
import { finalOverall } from "./cards";
import { applyFreeReroll, applyPick, applyReroll, createDraft, drawNextOffer, eventSpecialsFor, slotsForKind } from "./draft";
import { buildUserTeam } from "./teams";
import { fastForward, initTournament } from "./tournament";
import { compileResults } from "./results";
import type { DraftOfferCard, RunState } from "./types";
import type { ChallengeAction } from "./testing/challengeReplay";

function attempt(date:string, policy:number, seed=dailySeedForDate(date)) {
  const config=generateDailyConfig(date), rng=createRng(seed), decisions=createRng(policy);
  const ev=eventSpecialsFor(specialCards,date,undefined);
  let draft=drawNextOffer(createDraft(config.difficulty,{mode:"daily",poolLineupIds:config.poolLineupIds,rerollsOverride:config.rerollsOverride,specialChanceMult:config.specialChanceMult,scriptedLineups:config.scriptedLineups,eventSpecials:ev?{active:ev.active,boosted:[]}:undefined}),rng);
  const actions:ChallengeAction[]=[];
  const focus=policy%8, rerollChance=decisions.range(0,0.25), playerPriority=decisions.range(0,20);
  for(let guard=0;!draft.complete && guard<70;guard++) {
    if(!draft.offer?.hasPickableCard){actions.push({kind:"freeReroll"});draft=applyFreeReroll(draft,rng);continue;}
    if(draft.rerollsLeft>0 && decisions.chance(rerollChance)){actions.push({kind:"reroll"});draft=applyReroll(draft,rng);continue;}
    const picked=Object.values(draft.roster).filter(p=>p?.kind==="player").map(p=>playerCardById.get(p!.refId)!);
    const score=(c:DraftOfferCard)=>{
      let v=50;
      if(c.kind==="player") {
        const card=playerCardById.get(c.refId)!, person=playerById.get(card.playerId);
        v=finalOverall(card)+playerPriority;
        if(config.info.templateId==="underdog" && focus<4) v=100-Math.abs(finalOverall(card)-80)+playerPriority;
        if(c.specialId) v+=(specialCardById.get(c.specialId)?.overall??finalOverall(card))-finalOverall(card)+5;
        for(const prev of picked) {
          if(prev.lineupId===card.lineupId)v+=15;
          if(focus>=3 && playerById.get(prev.playerId)?.country===person?.country)v+=22;
          if(focus===4 && prev.seasonId===card.seasonId)v+=22;
          if(focus===5 && playerById.get(prev.playerId)?.region===person?.region)v+=12;
        }
      } else if(c.kind==="coach")v=coachById.get(c.refId)?.overall??50;
      else if(c.kind==="sub")v=subById.get(c.refId)?.overall??50;
      return v+decisions.range(0,focus===7?60:24);
    };
    const card=draft.offer.cards.filter(c=>c.availability==="available"&&slotsForKind(c.kind).some(s=>!draft.roster[s])).map(c=>({c,v:score(c)})).sort((a,b)=>b.v-a.v)[0]?.c;
    if(!card)return null;
    const slot=slotsForKind(card.kind).find(s=>!draft.roster[s])!;
    actions.push({kind:"pick",refId:card.refId,slot,...(card.specialId?{specialId:card.specialId}:{})});
    draft=applyPick(draft,card,slot,rng);
  }
  if(!draft.complete)return null;
  const team=buildUserTeam(draft.roster,config.difficulty,{mode:"daily"});
  const tournament=fastForward(initTournament(team,config.difficulty,rng,{mode:"daily",poolLineupIds:draft.poolLineupIds,opponentRatingBoost:config.info.opponentShift??0}),config.difficulty,rng);
  const run:RunState={runId:"audit",mode:"daily",seed,rngState:rng.state,difficulty:config.difficulty,showOverall:!config.hiddenOverall,phase:"results",startedAt:`${date}T00:00:00Z`,draft,tournament,daily:config.info,challenge:null,results:null};
  const result=compileResults(run,tournament,{achievementIds:[],unlockedSpecialIds:[]},rng);
  return {win:result.placement==="champion",bonus:!config.info.objective||result.xp.lines.some(l=>l.key==="objective"),actions,overall:team.rating.total,chemistry:team.chemistry.percent};
}

it.skipIf(!process.env.DAILY_AUDIT)("audits legal title and bonus paths over the future calendar",()=>{
  const rows=[];
  const length=Number(process.env.DAILY_DAYS??365), paths=Number(process.env.DAILY_PATHS??200);
  for(let day=0;day<length;day++) {
    const date=new Date(Date.parse(`${DAILY_ROTATION_START}T00:00:00Z`)+day*86400000).toISOString().slice(0,10);
    let win:ReturnType<typeof attempt>=null,bonus:ReturnType<typeof attempt>=null,seen=0;
    for(let policy=1;policy<=paths && (!win||!bonus);policy++) {
      const a=attempt(date,policy);seen++;
      if(a?.win)win=a;
      if(a?.bonus)bonus=a;
    }
    rows.push({date,template:generateDailyConfig(date).info.templateId,seen,win,bonus});
  }
  if(process.env.DAILY_REPORT)writeFileSync(process.env.DAILY_REPORT,JSON.stringify(rows,null,2));
  expect(rows.filter(r=>!r.win||!r.bonus).map(({date,template,win,bonus})=>({date,template,win:!!win,bonus:!!bonus}))).toEqual([]);
},120_000);

it.skipIf(!process.env.DAILY_AUTHOR)("authors a reviewed year of fixed daily seeds and legal win+bonus paths",()=>{
  const seeds:Record<string,number>={}, solutions:Record<string,{seed:number;actions:ChallengeAction[]}>={}, failures:string[]=[], report=[];
  for(let day=0;day<365;day++) {
    const date=new Date(Date.parse(`${DAILY_ROTATION_START}T00:00:00Z`)+day*86400000).toISOString().slice(0,10);
    let found=false, examined=0;
    for(let candidate=0;candidate<100&&!found;candidate++) {
      const seed=candidate===0?seedFromDate(date):seedFromDate(`daily:v2:${date}:${candidate}`);
      for(let policy=1;policy<=40;policy++) {
        const a=attempt(date,policy,seed);examined++;
        if(!a?.win||!a.bonus)continue;
        if(candidate>0)seeds[date]=seed;
        solutions[date]={seed,actions:a.actions};
        report.push({date,template:generateDailyConfig(date).info.templateId,candidate,examined,overall:a.overall,chemistry:a.chemistry});
        found=true;break;
      }
    }
    if(!found)failures.push(date);
  }
  if(process.env.DAILY_REPORT)writeFileSync(process.env.DAILY_REPORT,JSON.stringify({report,failures},null,2));
  expect(failures).toEqual([]);
  writeFileSync("src/generated/daily-seeds-v2.json",JSON.stringify(seeds,null,2)+"\n");
  writeFileSync("src/engine/__fixtures__/daily-solutions-v2.json",JSON.stringify(solutions,null,2)+"\n");
},120_000);

// Catalogue edits may consume an extra special roll and invalidate recorded
// picks. Try existing seeds first; only explicitly authorized FUTURE dates may
// receive a new seed. A failing audit writes neither the seeds nor the replays.
it.skipIf(!process.env.DAILY_REFRESH)("refreshes win+bonus replay paths, retaining past daily seeds",()=>{
  const solutions:Record<string,{seed:number;actions:ChallengeAction[]}>={}, failures:string[]=[];
  const seeds=JSON.parse(readFileSync("src/generated/daily-seeds-v2.json","utf8")) as Record<string,number>;
  const changed: {date:string;before:number;after:number}[]=[];
  const futureAfter=process.env.DAILY_REFRESH_AFTER;
  for(let day=0;day<365;day++) {
    const date=new Date(Date.parse(`${DAILY_ROTATION_START}T00:00:00Z`)+day*86400000).toISOString().slice(0,10);
    const seed=dailySeedForDate(date);
    let found=false;
    for(let policy=1;policy<=200;policy++) {
      const a=attempt(date,policy,seed);
      if(!a?.win||!a.bonus)continue;
      solutions[date]={seed,actions:a.actions};found=true;break;
    }
    if(!found && futureAfter && date>futureAfter) {
      for(let candidate=1;candidate<=100&&!found;candidate++) {
        const nextSeed=seedFromDate(`daily:card-review:${date}:${candidate}`);
        for(let policy=1;policy<=40;policy++) {
          const a=attempt(date,policy,nextSeed);
          if(!a?.win||!a.bonus)continue;
          seeds[date]=nextSeed;solutions[date]={seed:nextSeed,actions:a.actions};
          changed.push({date,before:seed,after:nextSeed});found=true;break;
        }
      }
    }
    if(!found)failures.push(date);
  }
  if(process.env.DAILY_REPORT)writeFileSync(process.env.DAILY_REPORT,JSON.stringify({futureAfter,changed,failures},null,2));
  expect(failures).toEqual([]);
  writeFileSync("src/generated/daily-seeds-v2.json",JSON.stringify(seeds,null,2)+"\n");
  writeFileSync("src/engine/__fixtures__/daily-solutions-v2.json",JSON.stringify(solutions,null,2)+"\n");
},360_000);
