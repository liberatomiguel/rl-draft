import { JsonLd } from "@/components/seo/JsonLd";
import { DATABASE_UI, NAV_UI } from "@/content/copy.en";
import { PT } from "@/content/copy.pt";
import { LIVE_PAGE_SLUGS, PAGES_EN, PAGES_PT, PAGE_ROUTES, REGION_PAGES, type PageSlug } from "@/content/pages";
import { regionShowcase } from "@/lib/database";
import { articleJsonLd, breadcrumbJsonLd, faqJsonLd } from "@/lib/jsonld";
import type { ContentPageCopy, RelatedLink } from "./ContentArticle";
import { LocaleContent } from "./LocaleContent";

/**
 * The other content pages, as links in one language (v2.0, WEB-01). Every
 * article ends with them, so each page is one click from all the others and a
 * crawler that lands on any of them finds the rest. The PT list points at the
 * PT URLs. Anchor text is each page's own H1.
 */
function relatedLinks(slug: PageSlug, locale: "en" | "pt"): RelatedLink[] {
  const pages = locale === "pt" ? PAGES_PT : PAGES_EN;
  const db = locale === "pt" ? PT.DATABASE_UI : DATABASE_UI;
  const region = REGION_PAGES[slug];
  return [
    // A regional page leads with its own teams; every page links the database.
    ...(region ? [{ href: `/rlcs/teams#${region}`, label: db.regionTeams(region) }] : []),
    { href: "/rlcs", label: db.hubTitle },
    ...LIVE_PAGE_SLUGS.filter((s) => s !== slug).map((s) => ({
      href: PAGE_ROUTES[s][locale],
      label: pages[s].title,
    })),
  ];
}

/**
 * One content page. JSON-LD (Breadcrumb + Article + FAQPage) is server-rendered
 * in the URL's canonical language so crawlers get the right structured data per
 * URL; the visible article (LocaleContent) follows the player's EN/PT toggle.
 */
export function ContentPage({
  slug,
  en,
  pt,
  initialLocale,
  path,
  backHref,
  ctaHref,
}: {
  slug: PageSlug;
  en: ContentPageCopy;
  pt: ContentPageCopy;
  initialLocale: "en" | "pt";
  path: string;
  backHref: string;
  ctaHref: string;
}) {
  const isPt = initialLocale === "pt";
  const canonical = isPt ? pt : en;
  const home = isPt ? { name: PT.NAV_UI.home, path: "/pt" } : { name: NAV_UI.home, path: "/" };
  return (
    <>
      <JsonLd data={breadcrumbJsonLd([{ name: canonical.title, path }], home)} />
      <JsonLd
        data={articleJsonLd({
          headline: canonical.title,
          description: canonical.metaDescription,
          path,
          inLanguage: isPt ? "pt-BR" : "en",
        })}
      />
      {canonical.faqs && canonical.faqs.length > 0 ? (
        <JsonLd data={faqJsonLd(canonical.faqs)} />
      ) : null}
      <LocaleContent
        en={en}
        pt={pt}
        relatedEn={relatedLinks(slug, "en")}
        relatedPt={relatedLinks(slug, "pt")}
        region={REGION_PAGES[slug] ? regionShowcase(REGION_PAGES[slug]) : undefined}
        initialLocale={initialLocale}
        backHref={backHref}
        ctaHref={ctaHref}
      />
    </>
  );
}
