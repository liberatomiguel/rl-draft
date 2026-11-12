import { describe, expect, it } from "vitest";
import { rocketStreetCupWeeksFor, unofficialOfferFor, weekAt } from "./calendar";
import { newsChannelOf } from "./communications";
import {
  ROCKET_STREET_KEYS,
  rocketStreetBerths,
  rocketStreetCupPreview,
  rocketStreetResultStory,
  rocketStreetRookieClass,
  rocketStreetSigns,
  rocketStreetWindowWrap,
} from "./rocketStreet";
import { CAREER_CALENDAR, CAREER_ROCKET_STREET, CAREER_UNOFFICIAL } from "@/config/balance";
import { PARTNER_EVENT_NAMES, ROCKET_STREET_EVENT_NAME, T2_EVENT_NAMES, T3_EVENT_NAMES } from "@/data/career/names";
import { CAREER_EN } from "@/content/copy.career.en";
import { CAREER_PT } from "@/content/copy.career.pt";
import type { Region } from "@/engine/types";
import type { CompactEventResult, TransferLogEntry } from "./types";

const WEEKS = Array.from({ length: CAREER_CALENDAR.weeksPerSeason }, (_, i) => i + 1);
const SEASONS = Array.from({ length: 12 }, (_, i) => i);

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

 // R133: the championship used to sit behind the invitational gate (a new org's third season).
 it("has every anchored edition in every season, on open weeks no other partner holds", () => {
  for (const season of SEASONS) {
   const weeks = rocketStreetCupWeeksFor(season);
   expect(weeks).toHaveLength(CAREER_ROCKET_STREET.cupAnchorWeeks.length);
   expect(new Set(weeks).size).toBe(weeks.length);
   for (const week of weeks) {
    expect(weekAt(week).kind).toBe("open");
    // The worldwide rotation's name that week, at either tier, is not a partner's.
    for (const rep of [0, CAREER_UNOFFICIAL.t2RepGate]) expect(PARTNER_EVENT_NAMES).not.toContain(unofficialOfferFor(season, week, { ...ctx, rep, careerSeed: 7 })!.name.split(" · ")[0]);
   }
  }
  for (const name of PARTNER_EVENT_NAMES) expect([...T2_EVENT_NAMES, ...T3_EVENT_NAMES]).toContain(name);
 });
 it("reaches a SAM org below the invitational gate as a standard Community Cup, and above it as an Invitational", () => {
  for (const season of SEASONS) for (const seed of [1, 42, 9100, 17019]) {
   const below = WEEKS.map((week) => unofficialOfferFor(season, week, { ...ctx, careerSeed: seed, rep: 0, region: "SAM" })).filter((e) => e?.name === ROCKET_STREET_EVENT_NAME);
   const above = WEEKS.map((week) => unofficialOfferFor(season, week, { ...ctx, careerSeed: seed, region: "SAM" })).filter((e) => e?.name === ROCKET_STREET_EVENT_NAME);
   expect(below.map((e) => e!.week)).toEqual([...rocketStreetCupWeeksFor(season)].sort((a, b) => a - b));
   expect(above.map((e) => e!.week)).toEqual(below.map((e) => e!.week));
   for (const e of below) { expect(e!.tier).toBe("t3"); expect(e!.teamSize).toBeUndefined(); expect(e!.region).toBe("SAM"); expect(e!.format).toBe("single"); }
   for (const e of above) expect(e!.tier).toBe("t2");
  }
 });
 it("leaves the other partners' cups and every other week of a SAM season as they were", () => {
  for (const season of SEASONS) for (const rep of [0, CAREER_UNOFFICIAL.t2RepGate]) {
   const names = new Set<string>();
   for (const week of WEEKS) {
    const sam = unofficialOfferFor(season, week, { ...ctx, rep, region: "SAM" });
    const world = unofficialOfferFor(season, week, { ...ctx, rep });
    if (sam) names.add(sam.name.split(" · ")[0]);
    if (sam?.name !== ROCKET_STREET_EVENT_NAME) expect(sam).toEqual(world);
    else expect({ ...sam, name: "", region: undefined, tier: "", teamSize: undefined }).toEqual({ ...world, name: "", region: undefined, tier: "", teamSize: undefined });
   }
   // Whatever partner cup the worldwide rotation plays that season, SAM still plays it.
   for (const week of WEEKS) {
    const world = unofficialOfferFor(season, week, { ...ctx, rep })?.name.split(" · ")[0];
    if (world && PARTNER_EVENT_NAMES.includes(world)) expect(names).toContain(world);
   }
  }
 });
});

describe("Rocket Street desk", () => {
 const rows = (champion: string, runnerUp: string, userPlacement?: string) => [
  { ref: "org:a", name: champion, placement: "champion", points: 0, prize: 0 },
  { ref: "org:b", name: runnerUp, placement: "runner_up", points: 0, prize: 0 },
  ...(userPlacement ? [{ ref: "user", name: "My Org", placement: userPlacement, points: 0, prize: 0 }] : []),
 ] as CompactEventResult["rows"];
 const regional = (ordinal: number, split = 1): CompactEventResult => ({ eventId: `0:s${split}:reg${ordinal}:SAM`, tier: "regional", region: "SAM", seasonIndex: 0, week: 4, split: split as 1 | 2 | 3, name: `SAM Regional ${ordinal}`, rows: rows("Alpha", "Beta"), championRef: "org:a", fieldQuality: 1 });

 it("signs its own stories, the curated beat, the SAM rookie class and SAM organisations that leave — nothing else", () => {
  for (const titleKey of ROCKET_STREET_KEYS) {
   expect(rocketStreetSigns({ titleKey })).toBe(true);
   expect(newsChannelOf({ titleKey })).toBe("news");
  }
  expect(rocketStreetSigns({ titleKey: "beat", beatId: "sx-sam-hungry" })).toBe(true);
  expect(rocketStreetSigns({ titleKey: "rookieClass", params: { region: "SAM", name: "x" } })).toBe(true);
  expect(rocketStreetSigns({ titleKey: "orgLeaves", params: { region: "SAM", org: "x" } })).toBe(true);
  expect(rocketStreetSigns({ titleKey: "orgLeaves", params: { region: "EU", org: "x" } })).toBe(false);
  expect(rocketStreetSigns({ titleKey: "orgEnters", params: { region: "SAM", org: "x" } })).toBe(false);
  expect(rocketStreetSigns({ titleKey: "orgRelocates", params: { from: "SAM", to: "NA", org: "x" } })).toBe(false);
  expect(rocketStreetSigns({ titleKey: "transferFee", params: { region: "SAM" } })).toBe(false);
  expect(rocketStreetSigns({ titleKey: "beat", beatId: "s4-sam-worlds" })).toBe(false);
 });

 it("writes only for a career based in South America", () => {
  const cup = unofficialOfferFor(0, rocketStreetCupWeeksFor(0)[0], { userTeamRating: 60, rep: 0, t3EntriesThisSplit: 0, careerSeed: 1, region: "SAM" })!;
  const moves = [{ id: "t:1", seasonIndex: 0, day: 3, playerId: "p", playerName: "Kid", fromRef: null, toRef: "org:a", fee: 0, kind: "fa", region: "SAM" }] as TransferLogEntry[];
  for (const userRegion of ["NA", "EU", "MENA", "OCE", "APAC", "SSA"] as Region[]) {
   expect(rocketStreetCupPreview({ careerSeed: 1, userRegion, def: cup, orgName: "My Org" })).toBeNull();
   expect(rocketStreetResultStory({ careerSeed: 1, userRegion, result: { ...regional(1), name: ROCKET_STREET_EVENT_NAME } })).toBeNull();
   expect(rocketStreetBerths({ careerSeed: 1, userRegion, eventId: "0:s1:major", eventName: "Split 1 Major", names: ["Alpha"] })).toBeNull();
   expect(rocketStreetWindowWrap({ careerSeed: 1, userRegion, seasonIndex: 0, windowIdx: 0, moves, nameOf: (r) => r })).toBeNull();
   expect(rocketStreetRookieClass({ userRegion, rookies: [{ name: "a", region: "NA" }, { name: "b", region: "SAM" }] })).toBeNull();
  }
 });

 it("previews its championship week and no other cup", () => {
  const week = rocketStreetCupWeeksFor(0)[0];
  const offer = (w: number) => unofficialOfferFor(0, w, { userTeamRating: 60, rep: 0, t3EntriesThisSplit: 0, careerSeed: 1, region: "SAM" });
  const story = rocketStreetCupPreview({ careerSeed: 1, userRegion: "SAM", def: offer(week), orgName: "My Org" })!;
  expect(story.titleKey).toBe("rsCupPreview");
  expect(story.priority).toBe(2);
  expect(story.params).toMatchObject({ event: ROCKET_STREET_EVENT_NAME, org: "My Org", region: "SAM" });
  for (const w of WEEKS) if (!rocketStreetCupWeeksFor(0).includes(w)) expect(rocketStreetCupPreview({ careerSeed: 1, userRegion: "SAM", def: offer(w), orgName: "My Org" })).toBeNull();
  expect(rocketStreetCupPreview({ careerSeed: 1, userRegion: "SAM", def: null, orgName: "My Org" })).toBeNull();
 });

 it("always recaps its championship, with the user's finish", () => {
  const result: CompactEventResult = { eventId: "0:7:unofficial", tier: "t3", region: "SAM", seasonIndex: 0, week: 7, name: ROCKET_STREET_EVENT_NAME, rows: rows("Alpha", "Beta", "top4"), championRef: "org:a", userPlacement: "top4", fieldQuality: 1 };
  for (let seed = 1; seed <= 40; seed++) {
   const story = rocketStreetResultStory({ careerSeed: seed, userRegion: "SAM", result })!;
   expect(story.titleKey).toBe("rsCupRecap");
   expect(story.params).toMatchObject({ champion: "Alpha", runnerUp: "Beta", org: "My Org", placement: "top4", won: 0 });
  }
  const won = rocketStreetResultStory({ careerSeed: 1, userRegion: "SAM", result: { ...result, championRef: "user", rows: [{ ref: "user", name: "My Org", placement: "champion", points: 0, prize: 0 }, result.rows[1]] } })!;
  expect(won.params).toMatchObject({ champion: "My Org", won: 1 });
 });

 it("recaps about the configured share of SAM regionals, the same ones every time, and no other region's", () => {
  let covered = 0;
  let total = 0;
  for (let seed = 1; seed <= 200; seed++) for (let ordinal = 1; ordinal <= 3; ordinal++) {
   const story = rocketStreetResultStory({ careerSeed: seed, userRegion: "SAM", result: regional(ordinal) });
   expect(rocketStreetResultStory({ careerSeed: seed, userRegion: "SAM", result: regional(ordinal) })).toEqual(story);
   total += 1;
   if (story) { covered += 1; expect(story.titleKey).toBe("rsRegionalRecap"); expect(story.params).toMatchObject({ event: `SAM Regional ${ordinal}`, champion: "Alpha", runnerUp: "Beta", split: 1 }); }
  }
  expect(covered / total).toBeGreaterThan(CAREER_ROCKET_STREET.regionalRecapChance - 0.08);
  expect(covered / total).toBeLessThan(CAREER_ROCKET_STREET.regionalRecapChance + 0.08);
  for (let seed = 1; seed <= 40; seed++) {
   expect(rocketStreetResultStory({ careerSeed: seed, userRegion: "SAM", result: { ...regional(1), region: "EU", name: "EU Regional 1" } })).toBeNull();
   expect(rocketStreetResultStory({ careerSeed: seed, userRegion: "SAM", result: { ...regional(1), tier: "qualifier" } })).toBeNull();
  }
 });

 it("reports the region's Major berths and wraps the region's window around its biggest signing", () => {
  expect(rocketStreetBerths({ careerSeed: 1, userRegion: "SAM", eventId: "0:s1:major", eventName: "Split 1 Major", names: [] })).toBeNull();
  expect(rocketStreetBerths({ careerSeed: 1, userRegion: "SAM", eventId: "0:s1:major", eventName: "Split 1 Major", names: ["Alpha", "Beta"] })!.params).toMatchObject({ event: "Split 1 Major", t1: "Alpha", t2: "Beta", n: 2 });
  const move = (over: Partial<TransferLogEntry>): TransferLogEntry => ({ id: "t", seasonIndex: 0, day: 3, playerId: "p", playerName: "Kid", fromRef: null, toRef: "org:a", fee: 0, kind: "fa", region: "SAM", ...over });
  const moves = [move({ playerName: "Cheap", fee: 1000 }), move({ playerName: "Star", fee: 9000, toRef: "org:b" }), move({ playerName: "Elsewhere", fee: 99000, region: "EU" }), move({ playerName: "Released", toRef: null, fee: 0 })];
  const wrap = rocketStreetWindowWrap({ careerSeed: 1, userRegion: "SAM", seasonIndex: 0, windowIdx: 1, moves, nameOf: (ref) => `<${ref}>` })!;
  expect(wrap.params).toMatchObject({ n: 3, player: "Star", to: "<org:b>", fee: 9000, paid: 1, region: "SAM" });
  expect(rocketStreetWindowWrap({ careerSeed: 1, userRegion: "SAM", seasonIndex: 0, windowIdx: 1, moves: [moves[2]], nameOf: (r) => r })).toBeNull();
 });

 it("files the SAM rookie class only when the world's headline rookie is from elsewhere", () => {
  expect(rocketStreetRookieClass({ userRegion: "SAM", rookies: [{ name: "a", region: "NA" }, { name: "b", region: "SAM" }] })).toMatchObject({ titleKey: "rookieClass", params: { region: "SAM", name: "b" } });
  expect(rocketStreetRookieClass({ userRegion: "SAM", rookies: [{ name: "b", region: "SAM" }, { name: "a", region: "NA" }] })).toBeNull();
  expect(rocketStreetRookieClass({ userRegion: "SAM", rookies: [{ name: "a", region: "NA" }] })).toBeNull();
  expect(rocketStreetRookieClass({ userRegion: "SAM", rookies: [] })).toBeNull();
 });

 it("has every story written in EN and PT, one distinct line per variant, with no raw placeholder", () => {
  type Tpl = Record<string, (p: Record<string, string | number>) => string>;
  const params = { event: "EVENT", org: "ORG", champion: "CHAMP", runnerUp: "RUNNER", placement: "Top 4", won: 0, split: 2, t1: "ONE", t2: "TWO", n: 3, player: "PLAYER", to: "TO", fee: "$9,000", paid: 1, region: "SAM" };
  for (const copy of [CAREER_EN, CAREER_PT]) for (const key of ROCKET_STREET_KEYS) for (const group of [copy.news.tpl, copy.news.body] as unknown as Tpl[]) {
   expect(typeof group[key]).toBe("function");
   const lines = Array.from({ length: CAREER_ROCKET_STREET.variants }, (_, v) => group[key]({ ...params, v }));
   for (const line of lines) { expect(line.length).toBeGreaterThan(10); expect(line).not.toMatch(/undefined|NaN|\$\{/); }
   // The championship recap's body is one line by outcome; every other story has a line per variant.
   if (!(key === "rsCupRecap" && group === (copy.news.body as unknown as Tpl))) expect(new Set(lines).size).toBe(CAREER_ROCKET_STREET.variants);
   // One side, one move, a free signing, a title: the same story still reads.
   for (const v of [0, 1, 2]) expect(group[key]({ ...params, v, t2: "", n: 1, paid: 0, won: 1 })).not.toMatch(/undefined|NaN| {2}/);
  }
 });
});
