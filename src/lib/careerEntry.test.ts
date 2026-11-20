import { describe, expect, it } from "vitest";
import { CAREER_QUICK_START_HREF, newCareerHref, wantsQuickStart } from "./careerEntry";

describe("career entry from the search pages", () => {
  it("reads the quick-start flag from a query string", () => {
    expect(wantsQuickStart("?start=quick")).toBe(true);
    expect(wantsQuickStart("?utm_source=x&start=quick")).toBe(true);
    expect(wantsQuickStart("")).toBe(false);
    expect(wantsQuickStart("?start=custom")).toBe(false);
    expect(wantsQuickStart("?quick")).toBe(false);
  });

  it("keeps the flag on the way to the founding wizard", () => {
    expect(newCareerHref("?start=quick")).toBe("/career/new?start=quick");
    expect(newCareerHref("")).toBe("/career/new");
  });

  it("the landing link carries the flag", () => {
    expect(wantsQuickStart(new URL(CAREER_QUICK_START_HREF, "https://rocketdraft.app").search)).toBe(true);
    expect(new URL(CAREER_QUICK_START_HREF, "https://rocketdraft.app").pathname).toBe("/career");
  });
});
