"use client";

/**
 * Road to Worlds — the career shell (v1.5).
 *
 * Guards the whole route group: feature flag off → home; no saves → the
 * creation wizard; saves but none active → the slot picker. Renders the
 * persistent CareerTopBar everywhere except the wizard. The careerStore is
 * PERSISTENT — AppShell's leave-run clearing never touches it.
 */

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { FEATURES } from "@/config/balance";
import { useMounted } from "@/store/useMounted";
import { useCareerStore } from "@/store/careerStore";
import { CareerTopBar } from "@/components/career/CareerTopBar";

// Full-screen routes without the career top bar. EXACT match — "/career/news"
// must NOT be caught by a "/career/new" prefix (that hid the nav in the inbox).
const BARE_ROUTES = ["/career/new", "/career/saves"];
const isBareRoute = (pathname: string | null): boolean =>
  BARE_ROUTES.some((r) => pathname === r || pathname?.startsWith(`${r}/`));

export default function CareerLayout({ children }: { children: React.ReactNode }) {
  const mounted = useMounted();
  const router = useRouter();
  const pathname = usePathname();
  const slots = useCareerStore((s) => s.slots);
  const activeSlot = useCareerStore((s) => s.activeSlot);

  const hasAnySave = slots.some(Boolean);
  const hasActive = activeSlot !== null && Boolean(slots[activeSlot]);
  const bare = isBareRoute(pathname);

  useEffect(() => {
    if (!mounted) return;
    if (!FEATURES.careerMode) {
      router.replace("/");
      return;
    }
    if (bare) return;
    if (!hasAnySave) {
      router.replace("/career/new");
      return;
    }
    if (!hasActive) {
      router.replace("/career/saves");
    }
  }, [mounted, bare, hasAnySave, hasActive, router]);

  // SSR-safe skeleton until the persisted store hydrates.
  if (!mounted) {
    return <div className="min-h-[60vh]" />;
  }
  if (!FEATURES.careerMode) return null;
  if (!bare && !hasActive) return <div className="min-h-[60vh]" />;

  return (
    <div className="pb-20 md:pb-8">
      {!bare && hasActive ? <CareerTopBar /> : null}
      {children}
    </div>
  );
}
