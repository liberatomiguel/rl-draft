/**
 * EN + localized-PT URL for each content page. Kept in its OWN module (no JSON
 * imports) so lightweight consumers — the home menu's locale-aware links, the
 * sitemap — can import the route map without pulling in the page COPY (which
 * would bloat their bundles). `pages.ts` re-exports these alongside the copy.
 */
export type PageSlug =
  | "about"
  | "faq"
  | "ratings"
  | "strategy"
  | "special-cards"
  | "sam";

export const PAGE_ROUTES: Record<PageSlug, { en: string; pt: string }> = {
  about: { en: "/about", pt: "/pt/sobre" },
  faq: { en: "/faq", pt: "/pt/faq" },
  ratings: { en: "/ratings", pt: "/pt/overalls" },
  strategy: { en: "/strategy", pt: "/pt/estrategia" },
  "special-cards": { en: "/special-cards", pt: "/pt/cartas-especiais" },
  sam: { en: "/sam", pt: "/pt/sam" },
};

/** Resolve a content page's URL for the active locale. */
export function localePath(slug: PageSlug, locale: "en" | "pt"): string {
  return PAGE_ROUTES[slug][locale];
}
