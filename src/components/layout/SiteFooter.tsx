"use client";

import Link from "next/link";
import { useCopy } from "@/content/copy";
import { SITE } from "@/config/site";

const linkCls =
  "text-sub transition-colors hover:text-ink underline-offset-4 hover:underline";

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={linkCls}>
      {children}
    </a>
  );
}

/** Global footer (v1.0): attribution, credits, community/support and version. */
export function SiteFooter() {
  const { APP, NAV_UI } = useCopy();
  return (
    <footer className="border-t border-line">
      {/* Extra bottom padding on mobile clears the fixed bottom nav. */}
      <div className="mx-auto w-full max-w-6xl px-4 py-6 pb-24 md:pb-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <nav className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-semibold" aria-label="Footer">
            <Link href="/changelog" className={linkCls}>
              {NAV_UI.changelog}
            </Link>
            <Link href="/how-to-play" className={linkCls}>
              {NAV_UI.howToPlay}
            </Link>
            <Link href="/privacy" className={linkCls}>
              {NAV_UI.privacy}
            </Link>
            {SITE.discordUrl ? <ExternalLink href={SITE.discordUrl}>{NAV_UI.discord}</ExternalLink> : null}
            {SITE.supportUrl ? <ExternalLink href={SITE.supportUrl}>{NAV_UI.support}</ExternalLink> : null}
          </nav>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-faint">
            v{SITE.version} · {SITE.versionName}
          </span>
        </div>

        <div className="mt-4 space-y-1 text-[11px] leading-relaxed text-faint">
          <p>
            {NAV_UI.madeBy}{" "}
            <ExternalLink href={SITE.authorUrl}>{SITE.author}</ExternalLink>
            {" · "}
            {NAV_UI.inspiredBy}{" "}
            <ExternalLink href={SITE.inspiredByUrl}>{SITE.inspiredByName}</ExternalLink>{" "}
            {NAV_UI.by} {SITE.inspiredByAuthor}
          </p>
          <p>{APP.disclaimer}</p>
        </div>
      </div>
    </footer>
  );
}
