import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BrandMark } from "./NewsFeed";
import { EventBrand, eventBrandIdOf } from "../event/EventBrand";
import { describe, expect, it } from "vitest";
import type { NewsItem } from "@/engine/career/types";
import type { CareerCopy } from "@/content/careerCopy";
import { CAREER_EN } from "@/content/copy.career.en";
import { CAREER_PT } from "@/content/copy.career.pt";
import { newsActionOf, rocketStreetNews } from "./newsView";
import { resolveNews } from "./newsText";
const item=(over:Partial<NewsItem>):NewsItem=>({id:"qa",seasonIndex:0,week:1,type:"beat",priority:1,titleKey:"beat",read:false,...over});
describe("curated Rocket Street news",()=>{
 it("uses the supplied artwork for the news desk and tournament",()=>{
  const brand=renderToStaticMarkup(createElement(BrandMark,{brand:"rocketStreet",name:"Rocket Street"}));
  const event=renderToStaticMarkup(createElement(EventBrand,{name:"Rocket Street LATAM Championship"}));
  for(const html of [brand,event]) { expect(html).toContain('/partners/rocketstreet.png'); expect(html).toContain('alt="Rocket Street"'); }
 });
 it("brands the international SAM overview and SAM rookie classes",()=>{
  expect(rocketStreetNews(item({beatId:"sx-sam-hungry"}))).toBe(true);
  expect(rocketStreetNews(item({titleKey:"rookieClass",params:{region:"SAM",name:"QA"}}))).toBe(true);
 });
 it("keeps Brazil-focused, club/transfer and other-region news with the existing desk",()=>{
  expect(rocketStreetNews(item({beatId:"s4-sam-worlds"}))).toBe(false);
  expect(rocketStreetNews(item({type:"transfer",titleKey:"transfer",params:{region:"SAM",org:"Furia"}}))).toBe(false);
  expect(rocketStreetNews(item({titleKey:"rookieClass",params:{region:"NA"}}))).toBe(false);
  expect(rocketStreetNews(item({}))).toBe(false);
 });
 // Season 1 (R133)
 it("signs a SAM organisation leaving the scene, and the desk's own stories",()=>{
  expect(rocketStreetNews(item({type:"milestone",titleKey:"orgLeaves",params:{org:"QA",region:"SAM"}}))).toBe(true);
  expect(rocketStreetNews(item({type:"milestone",titleKey:"orgLeaves",params:{org:"QA",region:"OCE"}}))).toBe(false);
  for(const titleKey of ["rsCupPreview","rsCupRecap","rsRegionalRecap","rsBerths","rsWindowWrap"]) {
   expect(rocketStreetNews(item({titleKey,params:{region:"SAM",v:0}}))).toBe(true);
   expect(newsActionOf(item({titleKey}))).not.toBeNull();
  }
 });
 it("resolves the desk's stories in both languages, the user's finish as a label and the fee as money",()=>{
  const recap=item({type:"result",titleKey:"rsCupRecap",params:{event:"Rocket Street LATAM Championship",champion:"Alpha",runnerUp:"Beta",org:"QA Org",placement:"top4",won:0,region:"SAM",v:1}});
  const en=resolveNews(recap,CAREER_EN as unknown as CareerCopy,"en");
  const pt=resolveNews(recap,CAREER_PT as unknown as CareerCopy,"pt");
  expect(en.title).toBe("Alpha take the Rocket Street LATAM Championship title");
  expect(en.body).toContain("QA Org finished: Top 4.");
  expect(pt.title).toBe("Alpha fica com o título do Rocket Street LATAM Championship");
  expect(pt.body).toContain("QA Org terminou: Top 4.");
  const wrap=resolveNews(item({type:"window",titleKey:"rsWindowWrap",params:{n:4,player:"Kid",to:"Alpha",fee:12000,paid:1,region:"SAM",v:0}}),CAREER_EN as unknown as CareerCopy,"en");
  expect(wrap.title).toBe("South America's window closes: 4 moves");
  expect(wrap.body).toMatch(/Kid to Alpha for \$12/);
  expect(wrap.body).not.toContain("12000");
 });
 it("shows each partner's art on its event, whatever the cup's format",()=>{
  const art=(name:string)=>renderToStaticMarkup(createElement(EventBrand,{name,size:"sm"}));
  for(const name of ["50/50 Community Cup","50/50 Community Cup · 2v2","50/50 Community Cup · 1v1"]) { expect(eventBrandIdOf(name)).toBe("fiftyfifty"); expect(art(name)).toContain("/partners/fiftyfifty.png"); expect(art(name)).toContain('alt="50/50"'); }
  expect(art("Duds Cup Invitational")).toContain("/partners/duds.png");
  expect(art("Rocket Street LATAM Championship")).toContain("/partners/rocketstreet.png");
  expect(art("Boost Bracket")).toBe("");
 });
});
