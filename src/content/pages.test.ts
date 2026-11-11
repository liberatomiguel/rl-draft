import { describe, expect, it } from "vitest";
import { COUNTS } from "@/data/counts";
import { contentMetadata, pageMetadata, withBrand } from "@/lib/contentMeta";
import { PT_PATHS, localeOfPath } from "@/lib/locale";
import enJson from "./pages.en.json";
import ptJson from "./pages.pt.json";
import { CAREER_ONLY_PAGES, LIVE_PAGE_SLUGS, PAGE_ROUTES, type PageSlug } from "./pageRoutes";
import { PAGES_EN, PAGES_PT } from "./pages";

/**
 * The content pages (v2.0, WEB-01): the route map, the EN and PT copy and the
 * metadata they produce stay in step. Dataset-agnostic: no page text is pinned.
 */
const SLUGS = Object.keys(PAGE_ROUTES) as PageSlug[];
const strings = (value: unknown): string[] =>
  typeof value === "string"
    ? [value]
    : Array.isArray(value)
      ? value.flatMap(strings)
      : value && typeof value === "object"
        ? Object.values(value).flatMap(strings)
        : [];

describe("content pages", () => {
  it("every route has EN and PT copy, and nothing else does", () => {
    expect(Object.keys(enJson).sort()).toEqual([...SLUGS].sort());
    expect(Object.keys(ptJson).sort()).toEqual([...SLUGS].sort());
  });

  it("EN and PT twins have the same shape", () => {
    for (const slug of SLUGS) {
      const en = PAGES_EN[slug];
      const pt = PAGES_PT[slug];
      expect(pt.sections.length, `${slug} sections`).toBe(en.sections.length);
      expect(pt.faqs?.length ?? 0, `${slug} faqs`).toBe(en.faqs?.length ?? 0);
    }
  });

  it("routes are unique, PT routes are Portuguese URLs, none collides with the career app", () => {
    const all = SLUGS.flatMap((s) => [PAGE_ROUTES[s].en, PAGE_ROUTES[s].pt]);
    expect(new Set(all).size).toBe(all.length);
    for (const slug of SLUGS) {
      const { en, pt } = PAGE_ROUTES[slug];
      expect(localeOfPath(en), en).toBe("en");
      expect(localeOfPath(pt), pt).toBe("pt");
      expect(pt.startsWith("/pt/"), pt).toBe(true);
      expect(PT_PATHS.has(pt), pt).toBe(true);
      // scripts/postexport.mjs refuses a sitemap that contains "/career".
      expect(en.includes("/career") || pt.includes("/career"), slug).toBe(false);
    }
  });

  it("titles and descriptions fit a search result", () => {
    for (const [locale, pages] of [["en", PAGES_EN], ["pt", PAGES_PT]] as const) {
      for (const slug of SLUGS) {
        const { metaTitle, metaDescription } = pages[slug];
        // The <title> is the meta title plus the brand, where it is not in it already.
        expect(withBrand(metaTitle).length, `${locale} ${slug} title`).toBeLessThanOrEqual(66);
        expect(metaDescription.length, `${locale} ${slug} description`).toBeGreaterThanOrEqual(110);
        expect(metaDescription.length, `${locale} ${slug} description`).toBeLessThanOrEqual(170);
      }
    }
  });

  it("fills every token from the dataset and leaves none behind", () => {
    for (const text of [...strings(PAGES_EN), ...strings(PAGES_PT)]) {
      expect(text).not.toMatch(/\{\w+\}/);
    }
    // The special-card count in the prose is the dataset's (it once said 84).
    expect(PAGES_EN["special-cards"].metaDescription).toContain(String(COUNTS.specialCards));
    expect(PAGES_PT["special-cards"].metaDescription).toContain(String(COUNTS.specialCards));
  });

  it("career-only pages are a subset of the routes and live in a career build", () => {
    for (const slug of CAREER_ONLY_PAGES) expect(SLUGS).toContain(slug);
    // Tests run with FEATURES.careerMode on (NODE_ENV !== "production").
    expect([...LIVE_PAGE_SLUGS].sort()).toEqual([...SLUGS].sort());
  });
});

describe("page metadata", () => {
  it("carries a self canonical, the share image and its own social card", () => {
    const meta = pageMetadata({ title: "T", description: "D", path: "/play" });
    expect(meta.alternates?.canonical).toBe("/play");
    expect(meta.openGraph).toMatchObject({ title: "T", description: "D", siteName: "Rocket Draft" });
    expect(JSON.stringify(meta.openGraph)).toContain("/opengraph-image.png");
    expect(meta.twitter).toMatchObject({ title: "T", description: "D" });
    expect(JSON.stringify(meta.twitter)).toContain("/opengraph-image.png");
    // No robots of its own: the staging build's blanket noindex must win.
    expect(meta.robots).toBeUndefined();
    expect(pageMetadata({ title: "T", description: "D", path: "/settings", index: false }).robots).toEqual({
      index: false,
      follow: true,
    });
  });

  it("a content page points at its twin in the other language", () => {
    for (const slug of SLUGS) {
      const { en, pt } = PAGE_ROUTES[slug];
      const meta = contentMetadata(PAGES_PT[slug], { enPath: en, ptPath: pt, locale: "pt" });
      expect(meta.alternates?.canonical).toBe(pt);
      expect(meta.alternates?.languages).toMatchObject({ "en-US": en, "pt-BR": pt, "x-default": en });
      expect(meta.openGraph).toMatchObject({ locale: "pt_BR" });
    }
  });
});
