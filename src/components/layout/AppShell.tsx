"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP } from "@/content/copy";
import { cx } from "@/lib/util";

const NAV = [
  { href: "/", label: "Home", icon: HomeIcon },
  { href: "/play", label: "Play", icon: PlayIcon },
  { href: "/collection", label: "Collection", icon: CollectionIcon },
  { href: "/profile", label: "Profile", icon: ProfileIcon },
] as const;

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

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-line bg-bg/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2" aria-label={APP.name}>
            <LogoMark />
            <Logo className="text-sm" />
          </Link>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
            {NAV.map((item) => {
              const active =
                item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cx(
                    "display rounded-lg px-4 py-1.5 text-sm font-semibold uppercase tracking-[0.14em] transition-colors",
                    active
                      ? "bg-orange/12 text-orange-bright"
                      : "text-sub hover:bg-white/5 hover:text-ink",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-6 md:pb-12">
        {children}
      </main>

      {/* Footer (desktop) */}
      <footer className="hidden border-t border-line py-5 md:block">
        <p className="mx-auto max-w-6xl px-4 text-xs leading-relaxed text-faint">
          {APP.disclaimer}
        </p>
      </footer>

      {/* Bottom nav (mobile) */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-raised/95 backdrop-blur-md md:hidden"
      >
        <div className="mx-auto grid max-w-md grid-cols-4">
          {NAV.map((item) => {
            const active =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cx(
                  "flex flex-col items-center gap-1 py-2.5 text-[10px] font-semibold uppercase tracking-wider transition-colors",
                  active ? "text-orange-bright" : "text-sub",
                )}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function LogoMark() {
  return (
    <svg viewBox="0 0 64 64" className="h-7 w-7" aria-hidden>
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#38bdf8" />
          <stop offset="0.55" stopColor="#3b82f6" />
          <stop offset="1" stopColor="#f97316" />
        </linearGradient>
      </defs>
      <path d="M32 7 53 19.5v25L32 57 11 44.5v-25Z" fill="none" stroke="url(#lg)" strokeWidth="4" />
      <path
        d="M24 40 40 24M40 24h-9.5M40 24v9.5"
        fill="none"
        stroke="#f97316"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
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

function CollectionIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden>
      <rect x="4" y="3.5" width="10" height="14" rx="2" />
      <path d="M9 20.5h9a2 2 0 0 0 2-2V8" strokeLinecap="round" />
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
