/** RC365_UI_DIR: synthetic browser scenarios, never app imports or balance evidence. */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { officialEventDefsForWeek, qualifierDefsForWeek } from "@/engine/career/calendar";
import { compileEventResult } from "@/engine/career/careerResults";
import { followRecordOf } from "@/engine/career/follow";
import { simplePackageOf } from "@/engine/career/training";
import { simulateAiEvent } from "@/engine/career/worldSim";
import { fastForward } from "@/engine/tournament";
import { createRng } from "@/lib/rng";
import type { CareerSave } from "@/engine/career/types";
import { advanceDayFlow, coachCandidatesFor, createCareerSave, finishEvent, isEventPaused, resolveInsertFlow, rolloverToNextSeason, runBootcampFlow, runScrimFlow, scrimShortlistFor, simEventToEnd, startEvent } from "./careerFlow";
import { setTrainingPackageFlow, trainingReportOf } from "./careerTraining";
import { walkPastForTests } from "./careerClockForTests";

function base(seed = 3652) {
  const s = createCareerSave({ identity:{ orgName:"Feedback Org", abbrev:"FDB", managerName:"Tester", country:"BR", region:"SAM", crestId:"shield", colors:{primary:"#f97316",secondary:"#102050"}, buffType:"consistency" },
    difficulty:"normal", rosterKey:"prospects", prefs:{autoEnterUnofficials:false} }, seed);
  s.flags.seenHub = true;
  return s;
}
function step(input: CareerSave): CareerSave {
  let s = walkPastForTests(input);
  if (s.pendingInsert?.day === s.clock.day) s = resolveInsertFlow(s,"b").save;
  if (s.activeEvent) {
    s = simEventToEnd(s);
    if (!isEventPaused(s) && s.activeEvent?.tournament.stage === "finished") s = finishEvent(s);
  } else if (s.pendingEventDef?.day === s.clock.day) {
    s = simEventToEnd(startEvent(s,false));
    if (!isEventPaused(s) && s.activeEvent?.tournament.stage === "finished") s = finishEvent(s);
  }
  return advanceDayFlow(walkPastForTests(s));
}

it.skipIf(!process.env.RC365_UI_DIR)("writes cycle, event, spectator and HQ browser scenarios", () => {
  const dir = process.env.RC365_UI_DIR!;
  mkdirSync(dir, { recursive:true });
  const write = (name: string, save: CareerSave) => writeFileSync(join(dir, `${name}.json`), JSON.stringify(save));
  let hq = base();
  hq.reputation = 21;
  hq.clock.day = 9;
  const refs = scrimShortlistFor(hq);
  hq = runScrimFlow(hq, refs[0].ref).save;
  const news = structuredClone(hq);
  news.clock.day = 10;
  news.scheduledScrims = [{ day:11, oppRef:refs[1].ref }];
  write("news", news);
  hq.clock.day = 11;
  hq = runScrimFlow(hq, refs[1].ref).save;
  hq.finances.gear = { ...hq.finances.gear, peripherals:true, monitors:true, pcs:true };
  write("hq", hq);
  const camp = runBootcampFlow({...hq,reputation:38});
  expect(camp.error).toBeUndefined();
  write("camp-active",camp.save);
  for (const coach of [false,true]) {
    let s = base(3651);
    if (coach) s.coach = coachCandidatesFor(s)[0];
    s = setTrainingPackageFlow(s, simplePackageOf({ objective:"development",workload:"normal",scrims:"even",focus:"mechanics-lab" })).save;
    for (let k=0; k<100 && !trainingReportOf(s); k++) s = step(s);
    expect(trainingReportOf(s)).not.toBeNull();
    write(coach ? "report-coach" : "report", s);
  }
  const lobby = base();
  const def = qualifierDefsForWeek(0,4).find(d => d.region === "SAM")!;
  lobby.clock.day = def.day;
  lobby.pendingEventDef = def;
  write("lobby", lobby);
  write("live", startEvent(lobby,true));
  const played = simEventToEnd(startEvent(lobby,false));
  expect(played.activeEvent?.tournament.stage).toBe("finished");
  write("result", played);
  const major = base();
  const majorDef = Array.from({length:32},(_,i)=>officialEventDefsForWeek(0,i+1)).flat().find(d=>d.tier==="major")!;
  major.clock.day = majorDef.day;
  major.pendingEventDef = majorDef;
  major.competition.majorFieldRefs = ["user", ...Object.keys(major.world.orgs).slice(0,15)];
  const majorStarted = startEvent(major,true);
  expect(majorStarted.activeEvent?.tournament.teams.user).toBeDefined();
  majorStarted.activeEvent!.tournament = fastForward(majorStarted.activeEvent!.tournament,major.difficulty,createRng(365));
  majorStarted.clock.day = majorDef.day + 1;
  write("playoffs",majorStarted);
  const foreign = base();
  const foreignDef = officialEventDefsForWeek(0,4).find(d => d.region === "EU" && d.tier === "regional")!;
  foreign.clock.day = foreignDef.day;
  const tournament = simulateAiEvent(foreignDef, { world:foreign.world, competition:foreign.competition, careerSeed:foreign.careerSeed, difficulty:foreign.difficulty });
  foreign.followEvent = { ...followRecordOf(foreignDef,tournament,{reason:"notQualified"}), view:"watch" };
  foreign.eventResults = [compileEventResult(foreignDef,tournament,{ difficulty:foreign.difficulty, fieldQuality:1, nameOf:id => tournament.teams[id]?.name ?? id })];
  write("follow", foreign);
  foreign.followEvent.view = "results";
  write("follow-result", foreign);
  let coaches = base();
  for (let k=0; k<6 && !coachCandidatesFor(coaches).some(c=>c.source==="real"); k++)
    coaches = rolloverToNextSeason({...coaches,phase:"seasonReview"});
  coaches.reputation = 21;
  expect(coachCandidatesFor(coaches).some(c=>c.source==="real")).toBe(true);
  write("coaches",coaches);
}, 120_000);
