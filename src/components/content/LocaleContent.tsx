"use client";

import { useSettings } from "@/store/settingsStore";
import { useMounted } from "@/store/useMounted";
import { NAV_UI } from "@/content/copy.en";
import { PT } from "@/content/copy.pt";
import { ContentArticle, type ContentPageCopy } from "./ContentArticle";
import { SyncLocale } from "./SyncLocale";

/**
 * Locale-aware content body. Follows the EN/PT toggle exactly like the rest of
 * the app (mounted-gated: renders `initialLocale` on the server / first paint to
 * match SSR, then the player's chosen language). `initialLocale` is the URL's
 * canonical language, so /about ships EN HTML (crawlable) and /pt/sobre ships PT
 * HTML — while the toggle still translates either in place for the player.
 */
export function LocaleContent({
  en,
  pt,
  initialLocale,
  backHref,
  ctaHref,
}: {
  en: ContentPageCopy;
  pt: ContentPageCopy;
  initialLocale: "en" | "pt";
  backHref: string;
  ctaHref: string;
}) {
  const lang = useSettings((s) => s.lang);
  const mounted = useMounted();
  const active = mounted ? lang : initialLocale;
  const copy = active === "pt" ? pt : en;
  const backLabel = active === "pt" ? PT.NAV_UI.backToMenu : NAV_UI.backToMenu;

  return (
    <>
      {initialLocale === "pt" ? <SyncLocale locale="pt" /> : null}
      <ContentArticle copy={copy} ctaHref={ctaHref} backHref={backHref} backLabel={backLabel} />
    </>
  );
}
