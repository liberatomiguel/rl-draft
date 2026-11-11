/**
 * SEO content-page copy (server-only). These long-form pages (/about, /faq,
 * /ratings, /strategy, /special-cards, the regional pages, /rocket-league-simulator,
 * /rocket-league-manager, /rlcs-fantasy-draft and their /pt mirrors) are
 * rendered server-side per locale, so their copy lives HERE rather than in the
 * runtime `copy.{en,pt}.ts` dictionary — that dictionary is imported by the
 * client `useCopy()` layer and ships in the client bundle, so adding ~8k words
 * of page prose to it would bloat every page's JS. Keeping it in JSON imported
 * only by the server routes keeps it out of the client bundle while staying
 * fully translated and shape-checked. (Documented in DESIGN-DECISIONS.)
 *
 * Two things are resolved here, once, at build time:
 *  - `{specialCards}` in any string becomes the dataset's special-card count,
 *    so the prose can never drift from the collection again (it said 84 while
 *    the game had 111), and `{NA.lineups}`-style tokens become that region's
 *    numbers in the public database (`@/lib/database`);
 *  - a section or FAQ entry marked `"requires": "career"` is dropped from a
 *    build that does not ship Road to Worlds (`FEATURES.careerMode`).
 */
import type { ContentPageCopy } from "@/components/content/ContentArticle";
import { FEATURES } from "@/config/balance";
import { COUNTS } from "@/data/counts";
import { regionFacts, regionHighlights } from "@/lib/database";
import { REGION_PAGES, type PageSlug } from "./pageRoutes";
import enJson from "./pages.en.json";
import ptJson from "./pages.pt.json";

// Re-export the (JSON-free) route map so route files keep a single import.
export {
  PAGE_ROUTES,
  LIVE_PAGE_SLUGS,
  CAREER_ONLY_PAGES,
  REGION_PAGES,
  isPageLive,
  localePath,
  type PageSlug,
} from "./pageRoutes";

type Gated = { requires?: "career" };
type RawPage = Omit<ContentPageCopy, "sections" | "faqs"> & {
  sections: (ContentPageCopy["sections"][number] & Gated)[];
  faqs?: (NonNullable<ContentPageCopy["faqs"]>[number] & Gated)[];
};

// `{specialCards}`, and one set per regional page: `{NA.lineups}`, `{NA.orgs}`,
// `{NA.players}`, `{NA.seasons}`, `{NA.firstSeason}`, `{NA.lastSeason}`, `{NA.topOrgs}`.
const TOKENS: Record<string, string> = { specialCards: String(COUNTS.specialCards) };
for (const region of Object.values(REGION_PAGES)) {
  for (const [key, value] of Object.entries({ ...regionFacts(region), ...regionHighlights(region) })) {
    TOKENS[`${region}.${key}`] = value;
  }
}
const fill = (text: string): string =>
  text.replace(/\{([\w.]+)\}/g, (whole, key: string) => TOKENS[key] ?? whole);
const live = (item: Gated): boolean => item.requires !== "career" || FEATURES.careerMode;

function prepare(raw: RawPage): ContentPageCopy {
  return {
    metaTitle: fill(raw.metaTitle),
    metaDescription: fill(raw.metaDescription),
    kicker: fill(raw.kicker),
    title: fill(raw.title),
    intro: fill(raw.intro),
    sections: raw.sections.filter(live).map((s) => ({ heading: fill(s.heading), body: fill(s.body) })),
    ...(raw.faqs ? { faqs: raw.faqs.filter(live).map((f) => ({ q: fill(f.q), a: fill(f.a) })) } : {}),
    ctaLabel: fill(raw.ctaLabel),
  };
}

function prepareAll(json: unknown): Record<PageSlug, ContentPageCopy> {
  const raw = json as Record<PageSlug, RawPage>;
  return Object.fromEntries(
    (Object.keys(raw) as PageSlug[]).map((slug) => [slug, prepare(raw[slug])]),
  ) as Record<PageSlug, ContentPageCopy>;
}

export const PAGES_EN = prepareAll(enJson);
export const PAGES_PT = prepareAll(ptJson);
