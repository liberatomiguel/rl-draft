/**
 * rc.36 (ROADMAP UX-03): the feed's lead story, crests and actions.
 */

import { describe, expect, it } from "vitest";
import type { CareerSave, NewsItem } from "@/engine/career/types";
import { leadStoryOf, newsActionOf, newsCrestsOf, newsRegionOf } from "./newsView";

const item = (over: Partial<NewsItem>): NewsItem => ({
  id: over.id ?? "n",
  seasonIndex: 0,
  week: 10,
  day: 70,
  type: "result",
  priority: 1,
  titleKey: "result",
  read: false,
  ...over,
});

const save = (news: NewsItem[], day = 72): CareerSave =>
  ({
    clock: { seasonIndex: 0, day },
    news,
    identity: { orgName: "My Org" },
    world: { orgs: { "team-bds": { ref: "team-bds", name: "Team BDS" }, "fill:EU:1": { ref: "fill:EU:1", name: "Garage Five" } } },
  }) as unknown as CareerSave;

describe("the feed's view (UX-03)", () => {
  it("the lead is the most important headline of the last week, the newest on a tie", () => {
    const news = [
      item({ id: "a", priority: 1, day: 72 }),
      item({ id: "b", priority: 2, day: 71 }),
      item({ id: "c", priority: 2, day: 70 }),
      item({ id: "d", priority: 3, day: 60 }),
    ];
    expect(leadStoryOf(save(news), 1, 7)?.id).toBe("b");
    expect(leadStoryOf(save(news), 3, 7)).toBeNull();
    expect(leadStoryOf(save(news, 90), 1, 7)).toBeNull();
  });

  it("crests: the user's own news, the orgs a headline names, a beat's orgs", () => {
    const s = save([]);
    expect(newsCrestsOf(item({ titleKey: "qualifiedMajor", type: "milestone" }), s)).toEqual(["user"]);
    expect(newsCrestsOf(item({ titleKey: "transferFee", type: "transfer", params: { to: "Team BDS", from: "Garage Five" } }), s)).toEqual([
      "team-bds",
      "fill:EU:1",
    ]);
    expect(newsCrestsOf(item({ titleKey: "orgEnters", params: { org: "Unknown" } }), s)).toEqual([]);
    expect(newsCrestsOf(item({ type: "beat", titleKey: "beat" }), s, ["team-vitality"])).toEqual(["team-vitality"]);
  });

  it("the action leads to the screen that handles the consequence", () => {
    expect(newsActionOf(item({ titleKey: "transferFee", type: "transfer" }))?.href).toBe("/career/market");
    expect(newsActionOf(item({ titleKey: "contractReminder", type: "org" }))?.href).toBe("/career/squad");
    expect(newsActionOf(item({ titleKey: "cashWarning", type: "org" }))?.href).toBe("/career/finances");
    expect(newsActionOf(item({ titleKey: "repUp", type: "rep" }))?.href).toBe("/career/club");
    expect(newsActionOf(item({ titleKey: "beat", type: "beat" }))).toBeNull();
    expect(newsRegionOf(item({ params: { region: "EU" } }))).toBe("EU");
    expect(newsRegionOf(item({ params: { region: "Mars" } }))).toBeNull();
  });
});
