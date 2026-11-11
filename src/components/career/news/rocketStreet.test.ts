import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BrandMark } from "./NewsFeed";
import { EventBrand } from "../event/EventBrand";
import { describe, expect, it } from "vitest";
import type { NewsItem } from "@/engine/career/types";
import { rocketStreetNews } from "./newsView";
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
});
