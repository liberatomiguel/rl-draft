"use client";

/**
 * Road to Worlds — the career shell (v1.5).
 *
 * Client half of the /career route group, rendered by the server
 * `layout.tsx` — which already 404s the whole group when FEATURES.careerMode
 * is off, so the shell only ever renders with the flag ON.
 *
 * Guards the route group: no saves → the creation wizard; saves but none
 * active → the slot picker. Renders the persistent CareerTopBar everywhere
 * except the wizard. The careerStore is PERSISTENT — AppShell's leave-run
 * clearing never touches it.
 */

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useLayoutEffect } from "react";
import { useCareerNavigation, finishCareerNavigation } from "@/components/career/careerNavigation";
import { useCareerCopy } from "@/content/careerCopy";
import { pendingDecisionsOf } from "@/store/careerDecisions";
import { SponsorDecisionPrompt } from "@/components/career/sponsors/SponsorDecisionPrompt";
import { useMounted } from "@/store/useMounted";
import { useCareerStore } from "@/store/careerStore";
import { CareerAutopilot } from "@/components/career/CareerAutopilot";
import { SponsorAutoBootcamp } from "@/components/career/sponsors/SponsorAutoBootcamp";
import { CareerAnnouncement } from "@/components/career/news/CareerAnnouncement";
import { CareerToaster } from "@/components/career/CareerToaster";
import { CareerTopBar } from "@/components/career/CareerTopBar";
import { CareerTour } from "@/components/career/tour/CareerTour";
import { ScrimBroadcast } from "@/components/career/ScrimBroadcast";
import { MoneyNoticeModal } from "@/components/career/MoneyNoticeModal";
import { TrainingReportModal } from "@/components/career/training/TrainingReportModal";

// Full-screen routes without the career top bar. EXACT match — "/career/news"
// must NOT be caught by a "/career/new" prefix (that hid the nav in the inbox).
const BARE_ROUTES = ["/career/new", "/career/saves"];
const isBareRoute = (pathname: string | null): boolean =>
  BARE_ROUTES.some((r) => pathname === r || pathname?.startsWith(`${r}/`));

export function CareerShell({ children }: { children: React.ReactNode }) {
  const C = useCareerCopy();
  const mounted = useMounted();
  const router = useRouter();
  const pathname = usePathname();
  const destination = useCareerNavigation(s => s.destination);
  useLayoutEffect(() => { if (destination === pathname) finishCareerNavigation(); }, [destination, pathname]);
  useEffect(() => {
    if (!destination) return;
    const timer = setTimeout(finishCareerNavigation, 8000);
    return () => clearTimeout(timer);
  }, [destination]);
  const slots = useCareerStore((s) => s.slots);
  const activeSlot = useCareerStore((s) => s.activeSlot);

  const save = activeSlot === null ? null : slots[activeSlot];
  const sponsor = save ? pendingDecisionsOf(save).find(d => d.kind === "sponsor" && !d.parked) : null;
  const hasAnySave = slots.some(Boolean);
  const hasActive = activeSlot !== null && Boolean(slots[activeSlot]);
  const bare = isBareRoute(pathname);

  useEffect(() => {
    if (!mounted) return;
    if (bare) return;
    if (!hasAnySave) {
      router.replace("/career/new");
      return;
    }
    if (!hasActive) {
      router.replace("/career/saves");
    }
  }, [mounted, bare, hasAnySave, hasActive, router]);

  // v0.3 mobile fix: switching career screens always lands at the top —
  // Next preserves scroll on client nav, which read as broken on phones.
  // A layout effect, so it runs before any screen's own mount-time scroll
  // (passive effects run child-first: the Calendar's jump to the current month
  // must land last, now that screens render their content on the first pass).
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  // rc.2: leaving a screen pauses the clock — autoplay only runs while the
  // player is looking at the hub.
  const setAutoAdvance = useCareerStore((s) => s.setAutoAdvance);
  useEffect(() => {
    setAutoAdvance(false);
  }, [pathname, setAutoAdvance]);

  // SSR-safe skeleton until the persisted store hydrates.
  if (!mounted) {
    return <div className="min-h-[60vh]" />;
  }
  if (destination && destination !== pathname) return <div className="min-h-[60vh]" aria-busy />;
  if (!bare && !hasActive) return <div className="min-h-[60vh]" />;

  return (
    <div className="pb-20 md:pb-8">
      {!bare && hasActive ? (
        <>
          <CareerTopBar />
          <ScrimBroadcast />
          <CareerAutopilot />
          <CareerToaster />
          {/* T1 (v2.0): the guided tour and its help button. */}
          <CareerTour />
          <CareerAnnouncement />
          <SponsorAutoBootcamp />
          {/* rc.34: the money notice (the emergency loan, its deadline) on every career screen. */}
          {sponsor && save ? <SponsorDecisionPrompt key={sponsor.id} save={save} C={C} canWait={sponsor.canWait} onSign={id => useCareerStore.getState().chooseSponsor(id)} onLater={() => useCareerStore.getState().parkDecision(sponsor.id)} /> : <MoneyNoticeModal />}
          {/* rc.35 (front T): a finished training cycle's results, once per cycle. */}
          {!sponsor ? <TrainingReportModal /> : null}
        </>
      ) : null}
      {children}
    </div>
  );
}
