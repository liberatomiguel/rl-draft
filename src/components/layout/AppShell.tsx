"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useCopy } from "@/content/copy";
import { cx } from "@/lib/util";
import { sfx } from "@/lib/sfx";
import { useRunStore } from "@/store/runStore";
import { useSettings } from "@/store/settingsStore";
import { useAccountStore } from "@/store/accountStore";
import { useProfileStore } from "@/store/profileStore";
import { useMounted } from "@/store/useMounted";
import { rankForXp } from "@/engine/progression";
import { RankBadge } from "@/components/ui/RankBadge";
import { AchievementToaster } from "@/components/AchievementToaster";
import { GuardedHomeLink, LeaveRunProvider } from "./LeaveRunGuard";
import { SiteFooter } from "./SiteFooter";
import { SettingsEffects } from "./SettingsEffects";

type NavKey = "home" | "play" | "challenges" | "collection" | "profile";
const NAV_ITEMS: { href: string; key: NavKey; icon: (p: { className?: string }) => React.ReactNode }[] = [
  { href: "/", key: "home", icon: HomeIcon },
  { href: "/play", key: "play", icon: PlayIcon },
  { href: "/challenges", key: "challenges", icon: ChallengesIcon },
  { href: "/collection", key: "collection", icon: CollectionIcon },
  { href: "/profile", key: "profile", icon: ProfileIcon },
];

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cx("display font-bold uppercase tracking-[0.18em]", className)}>
      <span className="text-ink">Rocket</span>
      <span className="text-orange">Draft</span>
    </span>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const t = useCopy();

  // Leaving the run (any page that isn't /play) RESETS it automatically
  // (v0.7.0 — the leave-confirmation modal was removed by direction). The run
  // only lives on /play; a refresh there still resumes because pathname stays
  // /play on load. Idempotent and safe under React strict mode (no cleanup).
  useEffect(() => {
    if (pathname !== "/play" && useRunStore.getState().run) {
      useRunStore.getState().clearRun();
    }
  }, [pathname]);

  // Wire the account session once (no-op when accounts are disabled) — v1.4.
  useEffect(() => useAccountStore.getState().init(), []);

  // Home links abandon a run in progress → they go through the leave guard.
  const NavLink = ({
    item,
    className,
    children,
  }: {
    item: (typeof NAV_ITEMS)[number];
    className: string;
    children: React.ReactNode;
  }) =>
    item.href === "/" ? (
      <GuardedHomeLink href="/" className={className} onClick={() => sfx.click()}>
        {children}
      </GuardedHomeLink>
    ) : (
      <Link
        href={item.href}
        className={className}
        onClick={() => {
          sfx.click();
          // Play always starts a fresh run at Setup — clear any run in progress so
          // /play shows Setup even when you're already on /play mid-run (v1.3.1).
          if (item.key === "play") useRunStore.getState().clearRun();
        }}
      >
        {children}
      </Link>
    );

  return (
    <LeaveRunProvider>
      <SettingsEffects />
      <AchievementToaster />

      <div className="flex min-h-dvh flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-40 border-b border-line bg-bg/80 backdrop-blur-md">
          <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4">
            <GuardedHomeLink href="/" className="flex items-center gap-2" aria-label={t.APP.name}>
              <LogoMark />
              <Logo className="text-sm" />
            </GuardedHomeLink>
            <div className="flex items-center gap-1">
              <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
                {NAV_ITEMS.map((item) => {
                  const active =
                    item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                  return (
                    <NavLink
                      key={item.href}
                      item={item}
                      className={cx(
                        "display rounded-lg px-4 py-1.5 text-sm font-semibold uppercase tracking-[0.14em] transition-colors",
                        active
                          ? "bg-orange/12 text-orange-bright"
                          : "text-sub hover:bg-white/5 hover:text-ink",
                      )}
                    >
                      {t.NAV[item.key]}
                    </NavLink>
                  );
                })}
              </nav>
              <LangToggle />
              <Link
                href="/settings"
                aria-label={t.NAV.settings}
                title={t.NAV.settings}
                onClick={() => sfx.click()}
                className={cx(
                  "flex h-9 w-9 items-center justify-center rounded-lg transition-colors",
                  pathname.startsWith("/settings")
                    ? "bg-orange/12 text-orange-bright"
                    : "text-sub hover:bg-white/5 hover:text-ink",
                )}
              >
                <GearIcon className="h-5 w-5" />
              </Link>
              <AccountChip />
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-6 md:pb-12">
          {children}
        </main>

        {/* Footer */}
        <SiteFooter />

        {/* Bottom nav (mobile) */}
        <nav
          aria-label="Main"
          className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-raised/95 backdrop-blur-md md:hidden"
        >
          <div className="mx-auto grid max-w-md grid-cols-5">
            {NAV_ITEMS.map((item) => {
              const active =
                item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.href}
                  item={item}
                  className={cx(
                    "flex flex-col items-center gap-1 py-2.5 text-[10px] font-semibold uppercase tracking-wider transition-colors",
                    active ? "text-orange-bright" : "text-sub",
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {t.NAV[item.key]}
                </NavLink>
              );
            })}
          </div>
        </nav>
      </div>
    </LeaveRunProvider>
  );
}

/** Header account chip (v1.4): "Log in" when signed out, username + rank emblem
 *  when signed in. Both route to /profile (the account hub). Hidden entirely when
 *  accounts aren't configured, so the guest header is unchanged. */
function AccountChip() {
  const t = useCopy();
  const mounted = useMounted();
  const enabled = useAccountStore((s) => s.enabled);
  const status = useAccountStore((s) => s.status);
  const username = useAccountStore((s) => s.username);
  const xp = useProfileStore((s) => s.xp);
  if (!mounted || !enabled || status === "loading") return null;

  if (status === "signedIn") {
    return (
      <Link
        href="/profile"
        onClick={() => sfx.click()}
        className="flex items-center gap-1.5 rounded-lg px-1.5 py-1 transition-colors hover:bg-white/5"
        title={username ?? undefined}
      >
        <span className="hidden max-w-[110px] truncate text-xs font-semibold text-sub sm:inline">
          {username}
        </span>
        <RankBadge rank={rankForXp(xp)} variant="menu" size="sm" />
      </Link>
    );
  }
  return (
    <Link
      href="/profile"
      onClick={() => sfx.click()}
      className="display rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-sub transition-colors hover:bg-white/5 hover:text-ink"
    >
      {t.NAV_UI.logIn}
    </Link>
  );
}

/** EN / PT language switch — always visible in the header. */
function LangToggle() {
  const lang = useSettings((s) => s.lang);
  const set = useSettings((s) => s.set);
  const mounted = useMounted();
  const active = mounted ? lang : "en";
  return (
    <div className="mr-0.5 flex overflow-hidden rounded-lg border border-line" role="group" aria-label="Language">
      {(["en", "pt"] as const).map((l) => (
        <button
          key={l}
          type="button"
          aria-pressed={active === l}
          onClick={() => {
            sfx.click();
            set("lang", l);
          }}
          className={cx(
            "display px-2 py-1 text-[11px] font-bold uppercase tracking-wider transition-colors",
            active === l ? "bg-orange/20 text-orange-bright" : "text-sub hover:text-ink",
          )}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

function LogoMark() {
  // Renders the same file as the favicon (public/icon.svg) so updating the icon
  // in one place updates the header too. (v1.1.x — was an inline SVG before.)
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/icon.svg" alt="" aria-hidden className="h-7 w-7" />;
}

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden>
      <path d="M3 11.5 12 4l9 7.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.5 10v9.5h13V10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden>
      <path d="M7 4.5v15l12-7.5Z" strokeLinejoin="round" />
    </svg>
  );
}

function ChallengesIcon({ className }: { className?: string }) {
  // A target — the "missions / out-draft the line" objective (v1.4).
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function CollectionIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden>
      <rect x="4" y="3.5" width="10" height="14" rx="2" />
      <path d="M9 20.5h9a2 2 0 0 0 2-2V8" strokeLinecap="round" />
    </svg>
  );
}

function GearIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function ProfileIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c1.2-3.4 3.8-5 7-5s5.8 1.6 7 5" strokeLinecap="round" />
    </svg>
  );
}
