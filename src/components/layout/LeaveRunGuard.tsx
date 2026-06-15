"use client";

/**
 * Navigation helpers for the menu links (v0.7.0).
 *
 * The leave-run CONFIRMATION MODAL was removed by direction: returning to the
 * menu — or any page other than /play — now resets the run automatically and
 * silently (the reset is owned by AppShell, which clears the run whenever the
 * pathname is not /play). An explicit "Reset run" button in the run header
 * covers deliberate restarts.
 *
 * These components are kept as thin wrappers so existing call sites keep
 * working; `useLeaveRunGuard` always declines to intercept, so callers fall
 * back to plain navigation.
 */

import Link from "next/link";
import { useCopy } from "@/content/copy";

/**
 * Back-compat shim: returns a no-op `requestLeave` that NEVER intercepts
 * navigation (always false), so `if (!requestLeave(href)) navigate()` callers
 * just navigate. Navigation away resets the run via AppShell.
 */
export function useLeaveRunGuard(): (href: string) => boolean {
  return () => false;
}

/** Passthrough provider — kept so AppShell's tree shape is unchanged. */
export function LeaveRunProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

/** A plain <Link> to the home menu (no confirmation anymore). */
export function GuardedHomeLink({
  href = "/",
  className,
  children,
  ...rest
}: React.ComponentProps<typeof Link>) {
  return (
    <Link href={href} className={className} {...rest}>
      {children}
    </Link>
  );
}

/** Standard top-of-page back link (profile, collection, achievements…). */
export function BackToMenu() {
  const { NAV_UI } = useCopy();
  return (
    <GuardedHomeLink
      href="/"
      className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-sub transition-colors hover:text-ink"
    >
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        aria-hidden
      >
        <path d="M15 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {NAV_UI.backToMenu}
    </GuardedHomeLink>
  );
}
