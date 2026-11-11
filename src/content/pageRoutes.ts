/**
 * EN + localized-PT URL for each content page. Kept in its OWN module (no JSON
 * imports) so lightweight consumers — the home menu's locale-aware links, the
 * footer, the sitemap — can import the route map without pulling in the page
 * COPY (which would bloat their bundles). `pages.ts` re-exports these alongside
 * the copy.
 */
import { FEATURES } from "@/config/balance";

export type PageSlug =
  | "about"
  | "faq"
  | "ratings"
  | "strategy"
  | "special-cards"
  | "sam"
  | "simulator"
  | "manager"
  | "fantasy";

export const PAGE_ROUTES: Record<PageSlug, { en: string; pt: string }> = {
  about: { en: "/about", pt: "/pt/sobre" },
  faq: { en: "/faq", pt: "/pt/faq" },
  ratings: { en: "/ratings", pt: "/pt/overalls" },
  strategy: { en: "/strategy", pt: "/pt/estrategia" },
  "special-cards": { en: "/special-cards", pt: "/pt/cartas-especiais" },
  sam: { en: "/sam", pt: "/pt/sam" },
  // v2.0 (WEB-01): one page per search intent that had impressions and no page
  // of its own (Search Console, Aug–Nov 2026).
  simulator: { en: "/rocket-league-simulator", pt: "/pt/simulador-rocket-league" },
  // The Road to Worlds landing page. Its URL must not contain "/career":
  // scripts/postexport.mjs refuses a sitemap that lists the career app itself.
  manager: { en: "/rocket-league-manager", pt: "/pt/manager-rocket-league" },
  fantasy: { en: "/rlcs-fantasy-draft", pt: "/pt/fantasy-rlcs" },
};

/**
 * Pages that describe Road to Worlds exist only in a build that ships it
 * (`FEATURES.careerMode`). With the flag off their routes call notFound(),
 * `scripts/postexport.mjs` deletes the exported files (keep its
 * CAREER_LANDING list in sync with this one), and nothing links to them.
 */
export const CAREER_ONLY_PAGES: readonly PageSlug[] = ["manager"];

/** Does this build export the page? */
export function isPageLive(slug: PageSlug): boolean {
  return FEATURES.careerMode || !CAREER_ONLY_PAGES.includes(slug);
}

/** The content pages this build exports, in menu order. */
export const LIVE_PAGE_SLUGS: readonly PageSlug[] = (Object.keys(PAGE_ROUTES) as PageSlug[]).filter(isPageLive);

/**
 * Date of the last meaningful change to the pages' content: the sitemap's
 * `lastmod` and the articles' `dateModified`. Bump it when the copy changes.
 */
export const CONTENT_DATE = "2026-11-11"; // v2.0

/** Resolve a content page's URL for the active locale. */
export function localePath(slug: PageSlug, locale: "en" | "pt"): string {
  return PAGE_ROUTES[slug][locale];
}
