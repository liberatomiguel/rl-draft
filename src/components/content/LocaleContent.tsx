"use client";

import { useSettings } from "@/store/settingsStore";
import { useMounted } from "@/store/useMounted";
import { NAV_UI } from "@/content/copy.en";
import { PT } from "@/content/copy.pt";
import { ContentArticle, type ContentPageCopy, type LandingConfig, type RelatedLink } from "./ContentArticle";
import { RegionShowcase } from "@/components/database/RegionShowcase";
import type { DbRegionShowcase } from "@/lib/database";
import { SyncLocale } from "./SyncLocale";

/**
 * Locale-aware content body. Follows the EN/PT toggle exactly like the rest of
 * the app (mounted-gated: renders `initialLocale` on the server / first paint to
 * match SSR, then the player's chosen language). `initialLocale` is the URL's
 * canonical language, so /about ships EN HTML (crawlable) and /pt/sobre ships PT
 * HTML — while the toggle still translates either in place for the player. The
 * related links switch with it, so a PT reader is sent on to the PT pages.
 */
export function LocaleContent({
  en,
  pt,
  relatedEn,
  relatedPt,
  region,
  landingEn,
  landingPt,
  initialLocale,
  backHref,
  ctaHref,
}: {
  en: ContentPageCopy;
  pt: ContentPageCopy;
  relatedEn: RelatedLink[];
  relatedPt: RelatedLink[];
  /** A regional page's data from the public database (its showcase block). */
  region?: DbRegionShowcase;
  /** The landing layout, with its guide links in each language. */
  landingEn?: LandingConfig;
  landingPt?: LandingConfig;
  initialLocale: "en" | "pt";
  backHref: string;
  ctaHref: string;
}) {
  const lang = useSettings((s) => s.lang);
  const mounted = useMounted();
  const active = mounted ? lang : initialLocale;
  const isPt = active === "pt";
  const nav = isPt ? PT.NAV_UI : NAV_UI;

  return (
    <>
      {initialLocale === "pt" ? <SyncLocale locale="pt" /> : null}
      <ContentArticle
        copy={isPt ? pt : en}
        ctaHref={ctaHref}
        backHref={backHref}
        backLabel={nav.backToMenu}
        related={isPt ? relatedPt : relatedEn}
        relatedLabel={nav.moreGuides}
        landing={isPt ? landingPt : landingEn}
      >
        {region ? <RegionShowcase data={region} /> : null}
      </ContentArticle>
    </>
  );
}
