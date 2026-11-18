import { JsonLd } from "@/components/seo/JsonLd";
import { DATABASE_UI, NAV_UI } from "@/content/copy.en";
import { PT } from "@/content/copy.pt";
import { LIVE_PAGE_SLUGS, PAGES_EN, PAGES_PT, PAGE_ROUTES, REGION_PAGES, type PageSlug } from "@/content/pages";
import { careerShareSrc, careerShotSrc, type CareerShotId } from "@/lib/assets";
import { CAREER_QUICK_START_HREF } from "@/lib/careerEntry";
import { regionShowcase } from "@/lib/database";
import { articleJsonLd, breadcrumbJsonLd, careerGameJsonLd, faqJsonLd } from "@/lib/jsonld";
import type { ContentPageCopy, LandingConfig, RelatedLink } from "./ContentArticle";
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

/** The Road to Worlds guides, as cards on the landing page. */
const CAREER_GUIDES: readonly PageSlug[] = ["career-guide", "career-market", "career-finances", "career-training"];

/** The landing layout of the pages that have one (v2.0.21: the career landing). */
function landingFor(slug: PageSlug, locale: "en" | "pt"): LandingConfig | undefined {
  if (slug !== "manager") return undefined;
  const pages = locale === "pt" ? PAGES_PT : PAGES_EN;
  return {
    hero: "hq",
    // Sections: the career-mode answer (v2.0.33), club, calendar, signings and
    // training, business, world, data.
    shots: { 2: "calendar", 3: "market", 4: "finances", 5: "standings" },
    guides: CAREER_GUIDES.filter((s) => LIVE_PAGE_SLUGS.includes(s)).map((s) => ({
      href: PAGE_ROUTES[s][locale],
      label: pages[s].title,
    })),
    // v2.0.33 (R136): the hero button founds a club step by step; this one
    // starts with a random club (the wizard's Quick start).
    ...(pages.manager.ctaAltLabel
      ? { secondaryCta: { href: CAREER_QUICK_START_HREF, label: pages.manager.ctaAltLabel } }
      : {}),
  };
}

/**
 * v2.0.33: the career landing has its own share image (careerShareSrc, made by
 * scripts/build-og-career.mjs; its route passes it to the metadata too) and its
 * own VideoGame node.
 */
const CAREER_SHOTS: readonly CareerShotId[] = ["hq", "calendar", "market", "finances", "standings"];

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
  const inLanguage = isPt ? "pt-BR" : "en";
  const shareImage = slug === "manager" ? careerShareSrc(initialLocale) : undefined;
  return (
    <>
      <JsonLd data={breadcrumbJsonLd([{ name: canonical.title, path }], home)} />
      <JsonLd
        data={articleJsonLd({
          headline: canonical.title,
          description: canonical.metaDescription,
          path,
          inLanguage,
          image: shareImage,
        })}
      />
      {shareImage ? (
        <JsonLd
          data={careerGameJsonLd({
            description: canonical.metaDescription,
            path,
            inLanguage,
            image: shareImage,
            screenshots: CAREER_SHOTS.map((id) => careerShotSrc(id).src),
          })}
        />
      ) : null}
      {canonical.faqs && canonical.faqs.length > 0 ? (
        <JsonLd data={faqJsonLd(canonical.faqs)} />
      ) : null}
      <LocaleContent
        en={en}
        pt={pt}
        relatedEn={relatedLinks(slug, "en")}
        relatedPt={relatedLinks(slug, "pt")}
        region={REGION_PAGES[slug] ? regionShowcase(REGION_PAGES[slug]) : undefined}
        landingEn={landingFor(slug, "en")}
        landingPt={landingFor(slug, "pt")}
        initialLocale={initialLocale}
        backHref={backHref}
        ctaHref={ctaHref}
      />
    </>
  );
}
