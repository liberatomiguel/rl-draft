"use client";

/**
 * The way back to the game (the home page, its main menu), under the READING
 * pages that have no call to play of their own (v2.0, WEB-01): the changelog
 * and the privacy page. The content articles (`PAGE_ROUTES`), /how-to-play and
 * the database pages end with their own "play" button, so they do not get a
 * second one.
 *
 * It never renders on a game screen (home, /play, collection, profile,
 * challenges, leaderboards, quiz, missions, achievements, settings, career):
 * there it read as an ad for the game inside the game (Miguel, 11/11). The
 * list below is an allowlist on purpose, so a new game screen starts without
 * it. `scripts/link-audit.mjs` checks the export and exempts the game screens.
 *
 * It sits BETWEEN <main> and the footer, not inside <main>: <main> is at
 * least one screen tall, so the strip always starts below the first screen and
 * cannot shift while the page above it hydrates (see AppShell).
 */

import { usePathname } from "next/navigation";
import { AppLink } from "@/components/ui/AppLink";
import { useCopy, useUiLocale } from "@/content/copy";
import { localePath } from "@/content/pageRoutes";

/** Reading pages with no call to play of their own. */
const STRIP_PAGES: ReadonlySet<string> = new Set(["/changelog", "/privacy"]);

export function PlayStrip() {
  const pathname = usePathname() ?? "/";
  const { HOME_SEO, NAV_UI } = useCopy();
  const locale = useUiLocale();
  if (!STRIP_PAGES.has(pathname.replace(/\/+$/, ""))) return null;
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
