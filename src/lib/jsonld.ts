/**
 * Structured-data (schema.org / JSON-LD) builders — pure, server-safe helpers.
 *
 * Search engines use these to understand page structure beyond the single
 * site-wide VideoGame node in the root layout. Rendered via <JsonLd> in
 * `@/components/seo/JsonLd`. Keep absolute URLs (crawlers want them) sourced
 * from SITE.url so canonical host stays consistent.
 */
import { SITE } from "@/config/site";
import { CONTENT_DATE } from "@/content/pageRoutes";

/** Absolute URL on the canonical host for a route path ("/" → site root). */
export function absoluteUrl(path: string): string {
  if (!path || path === "/") return SITE.url;
  return `${SITE.url}${path.startsWith("/") ? path : `/${path}`}`;
}

type Crumb = { name: string; path: string };

/**
 * BreadcrumbList for a content/hub page. Always lead with the home page: the
 * EN home by default, the PT landing page ("Início", /pt) for a PT page.
 */
export function breadcrumbJsonLd(crumbs: Crumb[], home: Crumb = { name: "Home", path: "/" }) {
  const items = [home, ...crumbs];
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

/**
 * Article — one long-form content page, attributed to the site and its author
 * (v2.0, WEB-01). `dateModified` is the content date the sitemap also reports.
 */
export function articleJsonLd(opts: {
  headline: string;
  description: string;
  path: string;
  inLanguage: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: opts.headline,
    description: opts.description,
    inLanguage: opts.inLanguage,
    url: absoluteUrl(opts.path),
    mainEntityOfPage: absoluteUrl(opts.path),
    image: absoluteUrl("/opengraph-image.png"),
    dateModified: CONTENT_DATE,
    author: { "@type": "Person", name: SITE.author, url: SITE.authorUrl },
    publisher: { "@type": "Organization", name: SITE.name, url: SITE.url },
    isPartOf: { "@type": "WebSite", name: SITE.name, url: SITE.url },
  };
}

/**
 * WebSite — the site's name for search results ("Rocket Draft", with the
 * one-word spelling people also search for) and its languages.
 */
export function webSiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE.name,
    alternateName: ["RocketDraft", SITE.domain],
    url: SITE.url,
    inLanguage: ["en", "pt-BR"],
  };
}
