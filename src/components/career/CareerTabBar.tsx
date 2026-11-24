"use client";

/**
 * Road to Worlds on a phone: the career's own tab bar (mobile redesign, stage
 * 3). It takes the place of the site's bottom nav inside the career (the shell
 * sets `html[data-career]`, see globals.css), so the phone shows ONE bottom bar
 * and the tabs are one thumb away. It replaces the `<select>` that sat under
 * the top bar (rc.50): a closed select hides where the player can go, and it
 * cost a 53px row of every career screen.
 *
 * Four destinations the player opens every week (HQ, Squad, Market, Training)
 * and "More", a sheet with the rest and the way back to the game's menu.
 * Rendered by CareerTopBar, which owns the "new" dots and the unread count.
 * From 640px the tab row of the top bar is the navigation and this is off.
 */

import { useState } from "react";
import { AppLink } from "@/components/ui/AppLink";
import { useCareerCopy } from "@/content/careerCopy";
import { cx } from "@/lib/util";
import { Modal } from "@/components/ui/Modal";
import { NewDot } from "@/components/ui/NewDot";
import { HqIcon, ShieldIcon, TargetIcon } from "@/components/ui/icons";

function MarketGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <path d="M4 8h13m0 0-3.5-3.5M17 8l-3.5 3.5M20 16H7m0 0 3.5-3.5M7 16l3.5 3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MoreGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <circle cx="5" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="19" cy="12" r="1.8" />
    </svg>
  );
}

type TabKey = "hub" | "squad" | "market" | "training";

const PRIMARY: { key: TabKey; href: string; icon: (p: { className?: string }) => React.ReactNode }[] = [
  { key: "hub", href: "/career", icon: HqIcon },
  { key: "squad", href: "/career/squad", icon: ShieldIcon },
  { key: "market", href: "/career/market", icon: MarketGlyph },
  { key: "training", href: "/career/training", icon: TargetIcon },
];

/** The sheet's rows, in the top bar's order. */
const MORE: { key: "calendar" | "finances" | "standings" | "news" | "club" | "saves"; href: string }[] = [
  { key: "calendar", href: "/career/calendar" },
  { key: "finances", href: "/career/finances" },
  { key: "standings", href: "/career/standings" },
  { key: "news", href: "/career/news" },
  { key: "club", href: "/career/club" },
  { key: "saves", href: "/career/saves" },
];

const ITEM =
  "relative flex min-h-14 min-w-0 flex-col items-center justify-center gap-0.5 px-0.5 py-1.5 transition-colors";
const ITEM_ON = "text-orange-bright after:absolute after:inset-x-3 after:top-[-1px] after:h-0.5 after:bg-orange";

export function CareerTabBar({
  pathname,
  hasNew,
  unreadMail,
}: {
  pathname: string;
  /** The top bar's "new" dots, by tab key. */
  hasNew: (key: string) => boolean;
  unreadMail: number;
}) {
  const C = useCareerCopy();
  const [more, setMore] = useState(false);
  const isOn = (href: string) => (href === "/career" ? pathname === "/career" : pathname.startsWith(href));
  const moreOn = MORE.some((t) => isOn(t.href));
  const moreNew = unreadMail > 0 || MORE.some((t) => hasNew(t.key));

  return (
    <>
      <nav
        data-tour="career-nav"
        aria-label={C.meta.title}
        className="career-tab-bar fixed inset-x-0 bottom-0 z-40 border-t border-line bg-raised pb-[env(safe-area-inset-bottom)] sm:hidden"
      >
        <div className="mx-auto grid max-w-md grid-cols-5">
          {PRIMARY.map((tab) => {
            const Icon = tab.icon;
            const on = isOn(tab.href);
            return (
              <AppLink
                key={tab.key}
                href={tab.href}
                aria-current={on ? "page" : undefined}
                className={cx(ITEM, on ? ITEM_ON : "text-sub")}
              >
                <span className="relative">
                  <Icon className="h-6 w-6" />
                  {hasNew(tab.key) ? <NewDot className="absolute -right-1 -top-0.5" label={C.toolbox.newTag} /> : null}
                </span>
                <span className="display max-w-full truncate text-[11px] font-semibold leading-tight">{C.nav[tab.key]}</span>
              </AppLink>
            );
          })}
          <button
            type="button"
            onClick={() => setMore(true)}
            aria-haspopup="dialog"
            aria-expanded={more}
            className={cx(ITEM, moreOn ? ITEM_ON : "text-sub")}
          >
            <span className="relative">
              <MoreGlyph className="h-6 w-6" />
              {moreNew ? <NewDot className="absolute -right-1 -top-0.5" label={C.toolbox.newTag} /> : null}
            </span>
            <span className="display max-w-full truncate text-[11px] font-semibold leading-tight">{C.nav.more}</span>
          </button>
        </div>
      </nav>

      <Modal open={more} title={C.nav.more} onClose={() => setMore(false)}>
        {/* Rows, not boxes: one list, a hairline between destinations. */}
        <ul className="border-t border-line">
          {MORE.map((tab) => {
            const on = isOn(tab.href);
            return (
              <li key={tab.key} className="border-b border-line">
                <AppLink
                  href={tab.href}
                  onClick={() => setMore(false)}
                  aria-current={on ? "page" : undefined}
                  className={cx(
                    "display flex min-h-12 items-center justify-between gap-3 px-2 text-base uppercase tracking-[0.03em]",
                    on ? "font-bold text-ink shadow-[inset_3px_0_0_var(--orange)]" : "font-semibold text-sub",
                  )}
                >
                  <span className="flex items-center gap-2">
                    {C.nav[tab.key]}
                    {hasNew(tab.key) ? <NewDot label={C.toolbox.newTag} /> : null}
                  </span>
                  {tab.key === "news" && unreadMail > 0 ? (
                    <span className="inline-flex min-w-5 items-center justify-center rounded-sm bg-orange/20 px-1 text-xs tabular-nums leading-5 text-orange-bright">
                      {unreadMail}
                    </span>
                  ) : (
                    <svg viewBox="0 0 24 24" className="h-4 w-4 text-faint" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                      <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </AppLink>
              </li>
            );
          })}
          <li>
            <AppLink
              href="/"
              onClick={() => setMore(false)}
              className="flex min-h-12 items-center px-2 text-sm font-semibold text-sub"
            >
              {C.nav.exit}
            </AppLink>
          </li>
        </ul>
      </Modal>
    </>
  );
}
