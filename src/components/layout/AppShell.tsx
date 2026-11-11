"use client";

import { AppLink } from "@/components/ui/AppLink";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { FEATURES } from "@/config/balance";
import { useCopy, useUiLocale } from "@/content/copy";
import { cx } from "@/lib/util";
import { sfx } from "@/lib/sfx";
import { clearRunInProgress } from "@/store/lazyRunStore";
import { useSettings } from "@/store/settingsStore";
import { useAccountStore } from "@/store/accountStore";
import { useProfileStore } from "@/store/profileStore";
import { useMounted } from "@/store/useMounted";
import { useNewDots } from "@/store/useNewItems";
import { rankForXp } from "@/engine/progression";
import { SITE } from "@/config/site";
import { DiscordIcon } from "@/components/ui/icons";
import { NewDot } from "@/components/ui/NewDot";
import { RankBadge } from "@/components/ui/RankBadge";
import { AchievementToaster } from "@/components/AchievementToaster";
import { RewardToaster } from "@/components/RewardToaster";
import { LoginStreakModal } from "@/components/LoginStreakModal";
import { CosmeticUnlockModal } from "@/components/cosmetics/CosmeticUnlockModal";
import { GuardedHomeLink, LeaveRunProvider } from "./LeaveRunGuard";
import { PlayStrip } from "./PlayStrip";
import { SiteFooter } from "./SiteFooter";
import { SettingsEffects } from "./SettingsEffects";

type NavKey = "home" | "play" | "career" | "challenges" | "collection" | "profile";
const BASE_NAV_ITEMS: { href: string; key: NavKey; icon: (p: { className?: string }) => React.ReactNode }[] = [
  { href: "/", key: "home", icon: HomeIcon },
  { href: "/play", key: "play", icon: PlayIcon },
  { href: "/challenges", key: "challenges", icon: ChallengesIcon },
  { href: "/collection", key: "collection", icon: CollectionIcon },
  { href: "/profile", key: "profile", icon: ProfileIcon },
];
// Road to Worlds (v1.5): a 6th destination, flag-gated — the grid grows with it.
const NAV_ITEMS: typeof BASE_NAV_ITEMS = FEATURES.careerMode
  ? [
      BASE_NAV_ITEMS[0],
      BASE_NAV_ITEMS[1],
      { href: "/career", key: "career", icon: CareerIcon },
      ...BASE_NAV_ITEMS.slice(2),
    ]
  : BASE_NAV_ITEMS;

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
  // rc.33 (COL-02c): a dot on the destinations holding something not opened yet
  // (the same items as the NEW tags inside them).
  const dots = useNewDots();
  const hasDot = (key: NavKey): boolean =>
    (key === "collection" || key === "challenges" || key === "profile") && dots[key];

  // Leaving the run (any page that isn't /play) RESETS it automatically
  // (v0.7.0 — the leave-confirmation modal was removed by direction). The run
  // only lives on /play; a refresh there still resumes because pathname stays
  // /play on load. Idempotent and safe under React strict mode (no cleanup).
  // The run store (dataset + engine) loads only when a run exists (#60).
  useEffect(() => {
    if (pathname !== "/play") clearRunInProgress();
  }, [pathname]);

  // Wire the account session once (no-op when accounts are disabled) — v1.4.
  useEffect(() => useAccountStore.getState().init(), []);

  // v2.0: count today's login and roll the mission periods once the persisted
  // profile is loaded (never on the server; idempotent per UTC day).
  useEffect(() => {
    if (FEATURES.playtest) return; // playtest build: no login streak or missions
    const run = () => {
      useProfileStore.getState().recordLogin();
      useProfileStore.getState().rollMissions();
    };
    const p = useProfileStore.persist;
    if (!p || p.hasHydrated()) {
      run();
      return;
    }
    const unsub = p.onFinishHydration(() => {
      unsub();
      run();
    });
    return unsub;
  }, []);

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
      <AppLink
        href={item.href}
        className={className}
        onClick={() => {
          sfx.click();
          // Play always starts a fresh run at Setup — clear any run in progress so
          // /play shows Setup even when you're already on /play mid-run (v1.3.1).
          if (item.key === "play") clearRunInProgress();
        }}
      >
        {children}
      </AppLink>
    );

  return (
    <LeaveRunProvider>
      <SettingsEffects />
      <AchievementToaster />
      <RewardToaster />
      {FEATURES.playtest ? null : (
        <>
          <LoginStreakModal />
          <CosmeticUnlockModal />
        </>
      )}

      <div className="flex min-h-dvh flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-40 border-b border-line bg-bg/80 backdrop-blur-md">
          {/* v2.0 (G2): three zones. Brand (home) · destinations, left-aligned
              beside it · utilities on the right, with language and account
              split off by a rule. The logo is the Home link on desktop, so the
              nav carries destinations only. */}
          <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-2 px-4 lg:gap-4">
            <GuardedHomeLink href="/" className="flex shrink-0 items-center gap-2" aria-label={t.APP.name}>
              <LogoMark />
              {/* Wordmark hidden where the bar is tight (phones, and tablets with the full nav). */}
              <Logo className="hidden text-sm sm:inline-block md:hidden lg:inline-block" />
            </GuardedHomeLink>
            <nav className="hidden min-w-0 items-center gap-0.5 md:flex" aria-label="Main">
              {NAV_ITEMS.filter((item) => item.key !== "home").map((item) => {
                const active = pathname.startsWith(item.href);
                return (
                  <NavLink
                    key={item.href}
                    item={item}
                    className={cx(
                      "display relative flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[13px] font-semibold uppercase tracking-[0.12em] transition-colors lg:px-3.5 lg:text-sm",
                      active
                        ? "bg-orange/12 text-orange-bright"
                        : "text-sub hover:bg-white/5 hover:text-ink",
                    )}
                  >
                    {t.NAV[item.key]}
                    {item.key === "career" ? (
                      <span className="pointer-events-none -ml-0.5 rounded border border-orange/40 bg-orange/15 px-1 py-0.5 text-[9px] font-bold leading-none tracking-[0.08em] text-orange-bright">
                        {t.HOME.careerBadge}
                      </span>
                    ) : null}
                    {hasDot(item.key) ? (
                      <NewDot className="absolute right-1 top-1" label={t.NAV_UI.newHere} />
                    ) : null}
                  </NavLink>
                );
              })}
            </nav>
            <div className="ml-auto flex shrink-0 items-center gap-0.5">
              {SITE.discordUrl ? (
                <a
                  href={SITE.discordUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={t.NAV_UI.joinDiscord}
                  title={t.NAV_UI.joinDiscord}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-sub transition-colors hover:bg-white/5 hover:text-ink"
                >
                  <DiscordIcon className="h-5 w-5" />
                </a>
              ) : null}
              <AppLink
                href="/leaderboards"
                aria-label={t.NAV.leaderboards}
                title={t.NAV.leaderboards}
                onClick={() => sfx.click()}
                className={cx(
                  "flex h-9 w-9 items-center justify-center rounded-lg transition-colors",
                  pathname.startsWith("/leaderboards")
                    ? "bg-orange/12 text-orange-bright"
                    : "text-sub hover:bg-white/5 hover:text-ink",
                )}
              >
                <TrophyIcon className="h-5 w-5" />
              </AppLink>
              <AppLink
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
              </AppLink>
              <span className="mx-1 h-5 w-px bg-line" aria-hidden />
              <LangToggle />
              <AccountChip />
            </div>
          </div>
        </header>

        {/* Content */}
        {/* min-h-svh (v2.0, WEB-02): the footer always starts below the first
            screen. The pages that render from the saved profile (collection,
            profile, challenges, play) change height when they hydrate, and a
            footer in view moved with them: a layout shift of 0.14–0.35 on a
            phone. Out of view, it cannot shift anything the player sees. */}
        <main className="mx-auto min-h-svh w-full max-w-6xl flex-1 px-4 pb-24 pt-6 md:pb-12">
          {children}
        </main>

        {/* Footer */}
        <PlayStrip />
        <SiteFooter />

        {/* Bottom nav (mobile) */}
        <nav
          aria-label="Main"
          className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-raised/95 backdrop-blur-md md:hidden"
        >
          <div className={cx("mx-auto grid max-w-md", FEATURES.careerMode ? "grid-cols-6" : "grid-cols-5")}>
            {NAV_ITEMS.map((item) => {
              const active =
                item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.href}
                  item={item}
                  className={cx(
                    "flex items-center justify-center py-3.5 transition-colors",
                    active ? "text-orange-bright" : "text-sub",
                  )}
                >
                  <span className="relative">
                    <Icon className="h-6 w-6" />
                    {hasDot(item.key) ? (
                      <NewDot className="absolute -right-1 -top-0.5" label={t.NAV_UI.newHere} />
                    ) : null}
                  </span>
                  <span className="sr-only">{t.NAV[item.key]}</span>
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
      <AppLink
        href="/profile"
        onClick={() => sfx.click()}
        className="flex items-center gap-1.5 rounded-lg px-1.5 py-1 transition-colors hover:bg-white/5"
        title={username ?? undefined}
      >
        <span className="hidden max-w-[110px] truncate text-xs font-semibold text-sub sm:inline">
          {username}
        </span>
        <RankBadge rank={rankForXp(xp)} variant="menu" size="sm" />
      </AppLink>
    );
  }
  return (
    <AppLink
      href="/profile"
      onClick={() => sfx.click()}
      className="display rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-sub transition-colors hover:bg-white/5 hover:text-ink"
    >
      {t.NAV_UI.logIn}
    </AppLink>
  );
}

/** EN / PT language switch — always visible in the header. */
function LangToggle() {
  const set = useSettings((s) => s.set);
  // The URL's language in the static HTML (PT on /pt pages), then the player's.
  const active = useUiLocale();
  return (
    <div className="flex overflow-hidden rounded-lg border border-line" role="group" aria-label="Language">
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

function CareerIcon({ className }: { className?: string }) {
  // A road to the summit — Road to Worlds (v1.5).
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden>
      <path d="M4 20c3-6 5.5-9 8-12l4-4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 4h4v4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 20h6" strokeLinecap="round" />
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

function TrophyIcon({ className }: { className?: string }) {
  // A cup — the global leaderboards (v1.4).
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden>
      <path d="M7 4h10v4a5 5 0 0 1-10 0V4Z" strokeLinejoin="round" />
      <path d="M7 6H4.5v1.5A2.5 2.5 0 0 0 7 10M17 6h2.5v1.5A2.5 2.5 0 0 1 17 10" strokeLinecap="round" />
      <path d="M12 13v3m-3 4h6m-5 0c0-1.5 1-2 2-2s2 .5 2 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
