import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CAREER_EN } from "@/content/copy.career.en";
import type { CareerCopy } from "@/content/careerCopy";
import { recordHonor, honorsTableOf } from "@/engine/career/honors";
import { officialEventDefsForWeek, seasonSchedule } from "@/engine/career/calendar";
import { prizeScheduleFor } from "@/engine/career/economy";
import { EventRewardsTable } from "@/components/career/event/EventRewardsTable";
import { UserCrest, composeCrestId, parseCrestId } from "@/components/career/UserCrest";
import { createCareerSave, finishEvent, simEventToEnd, startEvent, continueEventToNextDayFlow, moneyNoticeOf, moneyNoticeRaisedToday, acknowledgeMoneyNoticeFlow, signingPlanFor, type CreateCareerInput } from "./careerFlow";
import { trainingDayStart, runTrainingSession } from "./careerTraining";

const input: CreateCareerInput = {
  identity: { orgName: "Aurora", abbrev: "AUR", managerName: "QA", country: "BR", region: "SAM", crestId: "shield", colors: { primary: "#17345d", secondary: "#c5a12a" }, buffType: "consistency" },
  difficulty: "normal", style: "balanced", rosterKey: "balanced",
};
const fresh = () => createCareerSave(input, 40001);

describe("rc.40 feedback contracts", () => {
  it("starts at the Season X cutoff, with eight Worlds and no retroactive Majors", () => {
    const save = fresh();
    const orgs = honorsTableOf(save, "orgs");
    const players = honorsTableOf(save, "players");
    expect(orgs.reduce((n,r) => n+r.worlds,0)).toBe(8);
    expect(orgs.reduce((n,r) => n+r.majors,0)).toBe(0);
    expect(players.reduce((n,r) => n+r.worlds,0)).toBe(24);
    expect(players.find(r => r.id === "turbopolsa")?.worlds).toBe(4);
    expect(players.find(r => r.id === "kaydop")?.worlds).toBe(3);
  });

  it("settles a Major once and snapshots the winning players before transfers and reload", () => {
    let save = fresh();
    const week = seasonSchedule().find(w => w.kind === "major")!.week;
    const def = officialEventDefsForWeek(0, week).find(d => d.tier === "major")!;
    save.clock.day = def.day;
    save.pendingEventDef = def;
    save.competition.majorFieldRefs = ["user", ...Object.keys(save.world.orgs).slice(0,15)];
    save.sponsorOffers = null;
    save.pendingOffers = [];
    save = simEventToEnd(startEvent(save,false));
    save = simEventToEnd(continueEventToNextDayFlow(save));
    expect(save.activeEvent?.tournament.stage).toBe("finished");
    save = finishEvent(save);
    expect(save.honors).toHaveLength(1);
    const honor = structuredClone(save.honors![0]);
    expect(honor.players).toHaveLength(3);
    expect(finishEvent(save).honors).toHaveLength(1);
    const before = honorsTableOf(save, "players");
    for (const org of Object.values(save.world.orgs)) org.playerIds.reverse();
    save.eventResults = [];
    save.clock.seasonIndex++;
    expect(honorsTableOf(JSON.parse(JSON.stringify(save)), "players")).toEqual(before);
    expect(save.honors![0]).toEqual(honor);
  });

  it("duplicate event settlement cannot add a second title", () => {
    const save = fresh();
    const result = { eventId: "test-worlds", seasonIndex: 0, tier: "worlds" as const, week: 32, name: "Worlds", rows: [], championRef: "nrg-esports", fieldQuality: 1 };
    recordHonor(save,result,[{id:"turbopolsa",name:"Turbopolsa"}]);
    recordHonor(save,result,[{id:"turbopolsa",name:"Turbopolsa"}]);
    expect(honorsTableOf(save,"players").find(p => p.id === "turbopolsa")?.worlds).toBe(5);
  });

  it("a routine loan quote never raises a popup or a calendar stop; emergency debt still does", () => {
    const save = fresh();
    save.moneyNotices = [{id:"credit",kind:"creditOffer",seasonIndex:0,day:save.clock.day,params:{principal:1000}}];
    expect(moneyNoticeOf(save)).toBeNull();
    expect(moneyNoticeRaisedToday(save)).toBe(false);
    save.moneyNotices.push({id:"emergency",kind:"loanOpened",seasonIndex:0,day:save.clock.day,params:{lent:1000,owed:1250}});
    expect(moneyNoticeOf(save)?.id).toBe("emergency");
    expect(moneyNoticeOf(acknowledgeMoneyNoticeFlow(save))).toBeNull();
  });

  it("contracted signings enforce reputation 20 in the flow as well as the market", () => {
    const save = fresh();
    const id = Object.values(save.world.orgs)[0].playerIds[0];
    save.reputation = 19;
    expect(signingPlanFor(save,id,{lengthSeasons:2})).toMatchObject({error:"contractedRep"});
    save.reputation = 20;
    const result = signingPlanFor(save,id,{lengthSeasons:2});
    expect("error" in result ? result.error : null).not.toBe("contractedRep");
  });

  it("the weekly baseline changes once per week and survives a cycle adjustment", () => {
    const save = fresh();
    trainingDayStart(save);
    const before = structuredClone(save.training!.weekly);
    runTrainingSession(save);
    trainingDayStart(save);
    expect(save.training!.weekly).toEqual(before);
    save.clock.day = 8;
    trainingDayStart(save);
    expect(save.training!.weekly?.week).toBe(2);
    expect(save.training!.weekly?.players[save.squad[0].id].overall).toBe(save.squad[0].overall);
  });

  it("pre-event rewards show exactly the engine's complete payout table", () => {
    const save = fresh();
    const def = { id:"cup",seasonIndex:0,week:2,day:14,name:"Cup",tier:"t3" as const,format:"single" as const };
    const html = renderToStaticMarkup(createElement(EventRewardsTable,{save,def,C:CAREER_EN as unknown as CareerCopy}));
    for(const amount of Object.values(prizeScheduleFor(def.tier,def.format,save.difficulty,0))) expect(html).toContain(amount.toLocaleString("en-US"));
    expect(html).not.toContain(CAREER_EN.standings.ptsShort+"</th>");
  });

  it("third field colour and primary emblem selection survive save serialization", () => {
    const id = composeCrestId({shape:"heater",symbol:"wolf",pattern:"tricolor",layout:"stacked",iconColor:"primary"});
    expect(composeCrestId(parseCrestId(id))).toBe(id);
    const html = renderToStaticMarkup(createElement(UserCrest,{crestId:id,colors:{primary:"#16633e",secondary:"#631e38",tertiary:"#ead886"},abbrev:"AUR",size:"lg"}));
    expect(html).toContain('fill="#ead886"');
    expect(html).toContain('fill="#16633e" stroke=');
  });
});
