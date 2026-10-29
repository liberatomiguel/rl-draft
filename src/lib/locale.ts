/**
 * The URL's language (rc.32, DRAFT-11; DESIGN-DECISIONS #148).
 *
 * The site is a static export: every page's HTML is rendered once, at build
 * time, so the only thing that can choose the language of that HTML (its
 * `<html lang>` and the chrome's copy) is the page's URL. The PT landing page
 * and the PT content pages are Portuguese; every other URL is English. After
 * mount the UI follows the player's saved language instead (`useUiLocale`),
 * and the PT pages set that language to PT before the first paint
 * (`SyncLocale`), so a PT page never shows an English frame.
 *
 * Exact URLs, not a "/pt/" prefix: the 404 page is rendered once (in English)
 * and served for any missing URL, `/pt/<typo>` included; a prefix rule would
 * make its hydration disagree with its HTML. A new PT page joins the list
 * through `PAGE_ROUTES` (or `PT_PATHS` below); `scripts/postexport.mjs` fails
 * the build when an exported PT page does not carry the PT `lang`.
 */

import { PAGE_ROUTES } from "@/content/pageRoutes";

export type UiLocale = "en" | "pt";

/** `<html lang>` per UI language (hreflang uses `pt-BR` too). */
export const HTML_LANG: Record<UiLocale, string> = { en: "en", pt: "pt-BR" };

/** Every exported Portuguese URL: the `/pt` landing page and the PT content pages. */
export const PT_PATHS: ReadonlySet<string> = new Set([
  "/pt",
  ...Object.values(PAGE_ROUTES).map((r) => r.pt),
]);

/** The language of a URL path (slash-less, as `usePathname` returns it). */
export function localeOfPath(pathname: string | null | undefined): UiLocale {
  if (!pathname) return "en";
  const path = pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  return PT_PATHS.has(path) ? "pt" : "en";
}
