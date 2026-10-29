"use client";

/**
 * The document's `<html>` element, with its language (rc.32, DRAFT-11; #148).
 *
 * The root layout is a Server Component and cannot see the URL, but in the
 * static export each page's HTML is rendered with its own pathname, so this
 * Client Component can: `/pt` and the PT content pages export `lang="pt-BR"`
 * and PT chrome (every `useCopy()` below reads `UrlLocaleContext` until the
 * client has mounted), the rest `lang="en"`, exactly as before. After mount
 * `lang` follows the player's language, as SettingsEffects used to set it.
 *
 * React owns only `lang` and the font `className` (constant) here; the classes
 * and styles SettingsEffects and the dialog lock add to <html> at runtime are
 * left alone, because React only writes a prop when its value changes.
 */

import { usePathname } from "next/navigation";
import { UrlLocaleContext } from "@/content/copy";
import { HTML_LANG, localeOfPath } from "@/lib/locale";
import { useSettings } from "@/store/settingsStore";
import { useMounted } from "@/store/useMounted";

export function LocaleRoot({ className, children }: { className: string; children: React.ReactNode }) {
  const urlLocale = localeOfPath(usePathname());
  const lang = useSettings((s) => s.lang);
  const mounted = useMounted();
  return (
    <UrlLocaleContext value={urlLocale}>
      <html lang={HTML_LANG[mounted ? lang : urlLocale]} className={className}>
        {children}
      </html>
    </UrlLocaleContext>
  );
}
