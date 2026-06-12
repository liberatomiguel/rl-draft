"use client";

/**
 * Leave-run navigation guard (v0.5).
 *
 * Going to the home menu ABANDONS an in-progress run (v0.2 rule — the home
 * page clears it on mount). Playtesters lost drafts to a stray Home click,
 * so every route to "/" now passes through one confirmation modal while a
 * run is in progress (draft/review/tournament). Results phase never warns —
 * rewards are already applied when the tournament finishes.
 *
 * Use `GuardedHomeLink` for nav links and `BackToMenu` for the standard
 * page-corner back link. Both fall back to plain navigation with no run.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useState } from "react";
import { NAV_UI } from "@/content/copy";
import { useRunStore } from "@/store/runStore";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

const LeaveRunContext = createContext<(href: string) => boolean>(() => false);

/**
 * Returns `requestLeave(href)`: true → navigation was intercepted (a modal is
 * asking for confirmation); false → no active run, navigate freely.
 */
export function useLeaveRunGuard() {
  return useContext(LeaveRunContext);
}

export function LeaveRunProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const clearRun = useRunStore((s) => s.clearRun);
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  const requestLeave = useCallback((href: string): boolean => {
    const run = useRunStore.getState().run;
    if (!run || run.phase === "results") return false;
    setPendingHref(href);
    return true;
  }, []);

  const confirmLeave = () => {
    const href = pendingHref ?? "/";
    setPendingHref(null);
    clearRun();
    router.push(href);
  };

  return (
    <LeaveRunContext.Provider value={requestLeave}>
      {children}
      <Modal
        open={pendingHref !== null}
        title={NAV_UI.leaveTitle}
        onClose={() => setPendingHref(null)}
        actions={
          <>
            <Button variant="secondary" onClick={() => setPendingHref(null)}>
              {NAV_UI.leaveCancel}
            </Button>
            <Button variant="danger" onClick={confirmLeave}>
              {NAV_UI.leaveConfirm}
            </Button>
          </>
        }
      >
        {NAV_UI.leaveBody}
      </Modal>
    </LeaveRunContext.Provider>
  );
}

/** A <Link> that asks for confirmation when it would abandon an active run. */
export function GuardedHomeLink({
  href = "/",
  className,
  children,
  ...rest
}: React.ComponentProps<typeof Link>) {
  const requestLeave = useLeaveRunGuard();
  return (
    <Link
      href={href}
      className={className}
      onClick={(e) => {
        if (requestLeave(String(href))) e.preventDefault();
      }}
      {...rest}
    >
      {children}
    </Link>
  );
}

/** Standard top-of-page back link (profile, collection, achievements…). */
export function BackToMenu() {
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
