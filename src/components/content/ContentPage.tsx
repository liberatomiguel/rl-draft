import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbJsonLd, faqJsonLd } from "@/lib/jsonld";
import type { ContentPageCopy } from "./ContentArticle";
import { LocaleContent } from "./LocaleContent";

/**
 * One content page. JSON-LD (Breadcrumb + FAQPage) is server-rendered in the
 * URL's canonical language so crawlers get the right structured data per URL;
 * the visible article (LocaleContent) follows the player's EN/PT toggle.
 */
export function ContentPage({
  en,
  pt,
  initialLocale,
  path,
  backHref,
  ctaHref,
}: {
  en: ContentPageCopy;
  pt: ContentPageCopy;
  initialLocale: "en" | "pt";
  path: string;
  backHref: string;
  ctaHref: string;
}) {
  const canonical = initialLocale === "pt" ? pt : en;
  return (
    <>
      <JsonLd data={breadcrumbJsonLd([{ name: canonical.title, path }])} />
      {canonical.faqs && canonical.faqs.length > 0 ? (
        <JsonLd data={faqJsonLd(canonical.faqs)} />
      ) : null}
      <LocaleContent
        en={en}
        pt={pt}
        initialLocale={initialLocale}
        backHref={backHref}
        ctaHref={ctaHref}
      />
    </>
  );
}
