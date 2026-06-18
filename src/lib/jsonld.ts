/**
 * Structured-data (schema.org / JSON-LD) builders — pure, server-safe helpers.
 *
 * Search engines use these to understand page structure beyond the single
 * site-wide VideoGame node in the root layout. Rendered via <JsonLd> in
 * `@/components/seo/JsonLd`. Keep absolute URLs (crawlers want them) sourced
 * from SITE.url so canonical host stays consistent.
 */
import { SITE } from "@/config/site";

/** Absolute URL on the canonical host for a route path ("/" → site root). */
export function absoluteUrl(path: string): string {
  if (!path || path === "/") return SITE.url;
  return `${SITE.url}${path.startsWith("/") ? path : `/${path}`}`;
}

type Crumb = { name: string; path: string };

/** BreadcrumbList for a content/hub page. Always lead with Home. */
export function breadcrumbJsonLd(crumbs: Crumb[]) {
  const items = [{ name: "Home", path: "/" }, ...crumbs];
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: absoluteUrl(c.path),
    })),
  };
}

type QA = { q: string; a: string };

/** FAQPage — pairs of question/answer. `a` is plain text (no markup). */
export function faqJsonLd(qa: QA[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: qa.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };
}

type HowToStep = { name: string; text: string };

/** HowTo — an ordered guide (the /how-to-play steps). */
export function howToJsonLd(opts: { name: string; description: string; steps: HowToStep[] }) {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: opts.name,
    description: opts.description,
    step: opts.steps.map((s, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      name: s.name,
      text: s.text,
    })),
  };
}

type ItemEntry = { name: string; url?: string; description?: string };

/** ItemList — e.g. the special-cards showcase. */
export function itemListJsonLd(opts: { name: string; items: ItemEntry[] }) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: opts.name,
    numberOfItems: opts.items.length,
    itemListElement: opts.items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      ...(it.url ? { url: absoluteUrl(it.url) } : {}),
      ...(it.description ? { description: it.description } : {}),
    })),
  };
}
