"use client";

/**
 * The way back to the game (the home page, its main menu), under every page that has none of its own (v2.0,
 * WEB-01). The content articles and the database pages end with a "play"
 * button; the app pages (collection, profile, challenges, leaderboards, quiz,
 * achievements, changelog, privacy, settings, the 404 page) did not, and
 * several of them render nothing inside <main> until they hydrate, so a
 * crawler found no in-content link there at all. `scripts/link-audit.mjs`
 * checks it on the export.
 *
 * It sits BETWEEN <main> and the footer, not inside <main>: <main> is at
 * least one screen tall, so the strip always starts below the first screen and
 * cannot shift while the page above it hydrates (see AppShell).
 */

import { usePathname } from "next/navigation";
import { AppLink } from "@/components/ui/AppLink";
import { useCopy, useUiLocale } from "@/content/copy";
import { PAGE_ROUTES, localePath } from "@/content/pageRoutes";

/** Pages that already end with their own call to play, or are the game. */
const OWN_CTA: ReadonlySet<string> = new Set([
  "/",
  "/pt",
  "/play",
  "/how-to-play",
  ...Object.values(PAGE_ROUTES).flatMap((r) => [r.en, r.pt]),
]);

export function PlayStrip() {
  const pathname = usePathname() ?? "/";
  const { HOME_SEO, NAV_UI } = useCopy();
  const locale = useUiLocale();
  if (OWN_CTA.has(pathname) || pathname.startsWith("/rlcs") || pathname.startsWith("/career")) return null;
  const linkCls = "text-sub underline underline-offset-4 transition-colors hover:text-ink";
  return (
    <nav
      data-play-strip
      aria-label={HOME_SEO.links.heading}
      className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-center gap-x-6 gap-y-3 border-t border-line px-4 py-8 text-sm font-semibold"
    >
      {/* The button goes to the home page, the game's main menu (Miguel, 11/11). */}
      <AppLink
        href="/"
        className="display inline-flex items-center justify-center rounded-xl bg-gradient-to-b from-orange-bright to-orange px-6 py-2.5 text-xs font-bold uppercase tracking-[0.14em] text-[#1a0d02] transition-all hover:brightness-110"
      >
        {HOME_SEO.links.play}
      </AppLink>
      <AppLink href="/how-to-play" className={linkCls}>
        {NAV_UI.howToPlay}
      </AppLink>
      <AppLink href={localePath("strategy", locale)} className={linkCls}>
        {HOME_SEO.links.strategy}
      </AppLink>
      <AppLink href="/rlcs" className={linkCls}>
        {NAV_UI.database}
      </AppLink>
    </nav>
  );
}
