import { describe, expect, it } from "vitest";
import { unofficialOfferFor } from "./calendar";
import { CAREER_CALENDAR, CAREER_UNOFFICIAL } from "@/config/balance";
import { ROCKET_STREET_EVENT_NAME } from "@/data/career/names";
import type { Region } from "@/engine/types";

describe("Rocket Street LATAM Championship", () => {
 const ctx = {userTeamRating:80,rep:CAREER_UNOFFICIAL.t2RepGate,t3EntriesThisSplit:0,careerSeed:42};
 it("appears in the SAM invitational rotation, preserving the normal event contract", () => {
  const found=[];
  for(let season=0;season<6;season++) for(let week=1;week<=CAREER_CALENDAR.weeksPerSeason;week++) {
   const event=unofficialOfferFor(season,week,{...ctx,region:"SAM"});
   if(event?.name===ROCKET_STREET_EVENT_NAME) found.push(event);
  }
  expect(found.length).toBeGreaterThan(0);
  const samNames = Array.from({length: CAREER_CALENDAR.weeksPerSeason},(_,i)=>unofficialOfferFor(0,i+1,{...ctx,region:"SAM"})?.name);
  expect(samNames).toContain("Duds Cup Invitational");
  for(const event of found){ expect(event.region).toBe("SAM");expect(event.tier).toBe("t2");expect(event.format).toBe("single");expect(event.id).toBe(`${event.seasonIndex}:${event.week}:unofficial`); }
 });
 it("never appears outside SAM; missing region preserves legacy callers", () => {
  for(const region of ["NA","EU","MENA","OCE","APAC","SSA",undefined] as (Region|undefined)[]) for(let season=0;season<6;season++) for(let week=1;week<=CAREER_CALENDAR.weeksPerSeason;week++) {
    expect(unofficialOfferFor(season,week,{...ctx,region})?.name).not.toBe(ROCKET_STREET_EVENT_NAME);
    if(region) expect(unofficialOfferFor(season,week,{...ctx,region})).toEqual(unofficialOfferFor(season,week,ctx));
  }
 });
 it("does not replace entry-level cups before invitational eligibility", () => {
  for(let week=1;week<=CAREER_CALENDAR.weeksPerSeason;week++)expect(unofficialOfferFor(0,week,{...ctx,rep:CAREER_UNOFFICIAL.t2RepGate-1,region:"SAM"})?.name).not.toBe(ROCKET_STREET_EVENT_NAME);
 });
});
