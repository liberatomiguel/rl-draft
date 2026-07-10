"use client";

/**
 * Road to Worlds — shared sub-components for the Hub + Calendar screens
 * (owned by the hub/calendar UI agent; other screens have their own namespaces).
 *
 * Thin skins over careerUi/copy: tier chips, the lastError banner, week-kind
 * labels and event-stakes helpers. Org marks live in the canonical
 * `@/components/career/OrgMark` (re-exported here for existing importers).
 * News/mail TEXT resolution lives in `news/newsText` — the old `newsTitleOf`
 * duplicate was removed with the v0.2 hub rebuild.
 */

import { CAREER_POINTS, CAREER_PRIZES } from "@/config/balance";
import { useCopy } from "@/content/copy";
import type { CareerCopy } from "@/content/copy.career.en";
import type { CalendarWeek, EventTier, MailItem, NewsItem } from "@/engine/career/types";
import { formatMoney } from "@/lib/format";
import { cx } from "@/lib/util";
import { useCareerStore } from "@/store/careerStore";
import { Badge } from "@/components/ui/Badge";

// Canonical org-logo dispatcher (user crest / procedural filler / real logo).
export { OrgMark } from "@/components/career/OrgMark";

// ---------------------------------------------------------------------------
// Tier chip
// ---------------------------------------------------------------------------

const TIER_TONE: Record<EventTier, "gold" | "orange" | "blue" | "neutral"> = {
  worlds: "gold",
  major: "orange",
  regional: "blue",
  t2: "neutral",
  t3: "neutral",
};

export function TierChip({ tier, className }: { tier: EventTier; className?: string }) {
  const C = useCopy().CAREER;
  return (
    <Badge tone={TIER_TONE[tier]} className={className}>
      {C.common.tier[tier]}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// lastError → inline dismissible warning (nearest copy key; see report)
// ---------------------------------------------------------------------------

function errorTextFor(C: CareerCopy, key: string): string {
  switch (key) {
    case "windowClosed":
      return C.market.windowClosed;
    case "squadFull":
    case "alreadySigned":
      return C.squad.squadFull;
    case "funds":
      return C.finances.backerWarning;
    case "loanActive":
      return C.finances.insolvencyWarning;
    default:
      // locked / maxed / used / none / unknown / invalid — no CAREER.errors.*
      // group exists yet; "Locked" is the least-wrong neutral fallback.
      return C.common.locked;
  }
}

export function ErrorBanner({ className }: { className?: string }) {
  const copy = useCopy();
  const lastError = useCareerStore((s) => s.lastError);
  const clearError = useCareerStore((s) => s.clearError);
  if (!lastError) return null;
  return (
    <div
      role="alert"
      className={cx(
        "mb-4 flex items-center justify-between gap-3 rounded-lg border border-bad/40 bg-bad/10 px-3 py-2",
        className,
      )}
    >
      <span className="text-sm text-bad">{errorTextFor(copy.CAREER, lastError)}</span>
      <button
        onClick={clearError}
        aria-label={copy.CAREER.common.close}
        className="shrink-0 rounded-md p-1.5 text-bad transition-colors hover:bg-white/10"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Week-kind labels (agenda rows + the Hub's advance card share this)
// ---------------------------------------------------------------------------

export function kindLabelOf(C: CareerCopy, cal: CalendarWeek): string {
  switch (cal.kind) {
    case "preseason":
      return C.calendar.preseason;
    case "open":
      return C.calendar.openWeek;
    case "window":
      return C.calendar.window;
    case "worldsWindow":
      return C.calendar.worldsWindow;
    case "regional":
      return C.calendar.regional(cal.ordinal ?? 1);
    case "major":
      return C.calendar.major;
    case "worlds":
      return C.calendar.worlds;
  }
}

// ---------------------------------------------------------------------------
// Event stakes (display-side reads over the prize/points tables)
// ---------------------------------------------------------------------------

export function prizePoolOf(tier: EventTier): number {
  return CAREER_PRIZES.pools[tier];
}

/** Max Season Points on the line (champion row); null for unofficials/Worlds. */
export function maxPointsOf(tier: EventTier): number | null {
  if (tier === "regional") return CAREER_POINTS.regional.champion;
  if (tier === "major") return CAREER_POINTS.regional.champion * CAREER_POINTS.majorMultiplier;
  return null;
}

// ---------------------------------------------------------------------------
// Money params — the flow layer stores raw numbers for {fee}/{bonus}; the
// resolver templates print params verbatim, so format before resolving.
// ---------------------------------------------------------------------------

export function withMoneyParams<T extends NewsItem | MailItem>(item: T): T {
  const p = item.params;
  if (!p) return item;
  const fee = typeof p.fee === "number" ? formatMoney(p.fee, { compact: true }) : p.fee;
  const bonus = typeof p.bonus === "number" ? formatMoney(p.bonus, { compact: true }) : p.bonus;
  if (fee === p.fee && bonus === p.bonus) return item;
  return { ...item, params: { ...p, ...(fee !== undefined ? { fee } : {}), ...(bonus !== undefined ? { bonus } : {}) } };
}
