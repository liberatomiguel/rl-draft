"use client";

/**
 * Collection album (special cards). Unlocked cards open a detail modal with
 * full stats; locked cards show as silhouettes with their rarity to chase.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { specialCards } from "@/data";
import { useCopy } from "@/content/copy";
import { effectiveStats, resolveSpecial } from "@/engine/cards";
import type { SpecialCard, SpecialRarity } from "@/engine/types";
import { cx, countryName, formatDate } from "@/lib/util";
import { useMounted } from "@/store/useMounted";
import { useProfileStore } from "@/store/profileStore";
import { rankRewardsForXp, rankThatUnlocksRarity } from "@/engine/progression";
import { Badge } from "@/components/ui/Badge";
import { BackToMenu } from "@/components/layout/LeaveRunGuard";
import { Modal } from "@/components/ui/Modal";
import { Panel, SectionTitle } from "@/components/ui/Panel";
import { RankBadge } from "@/components/ui/RankBadge";
import { StatBar } from "@/components/ui/ProgressBar";
import { GameCard } from "@/components/cards/GameCard";

const RARITIES: SpecialRarity[] = ["rare", "epic", "mythic", "legendary", "community"];
type StatusFilter = "all" | "unlocked" | "locked";

/** Sort weight per rarity — higher = rarer, ordered first within a lock state. */
const RARITY_RANK: Record<SpecialRarity, number> = {
  // Content-creator cards are showcased first — they're the community nods (v1.4).
  community: 5,
  legendary: 4,
  mythic: 3,
  epic: 2,
  rare: 1,
  // The unique Creator card carries the lowest weight — always last among
  // unlocked cards (by direction, v1.2.0).
  creator: 0,
};

/**
 * Progressive reveal batch (UI/perf, not gameplay — stays out of balance.ts).
 * The album renders this many cards up front and appends another batch as a
 * sentinel scrolls into view, so the initial paint mounts a few dozen cards
 * instead of the whole (ever-growing) catalogue — the lever that actually moves
 * the /collection LCP/INP. Cards still render in full (no clipping), preserving
 * the glows/tilt that overflow the frame and the continuous "album wall" feel.
 */
const PAGE_BATCH = 24;

export function CollectionView() {
  const { COLLECTION_UI: C, RARITY_LABELS } = useCopy();
  const mounted = useMounted();
  const unlockedMap = useProfileStore((s) => s.unlockedSpecials);
  const xp = useProfileStore((s) => s.xp);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [rarity, setRarity] = useState<SpecialRarity | "all">("all");
  const [detail, setDetail] = useState<SpecialCard | null>(null);

  // Hidden dev preview: visiting /collection?dev=1 renders EVERY special as
  // unlocked so the card art can be reviewed at a glance. VISUAL ONLY — it never
  // writes to the profile, so the real collection / achievements stay honest.
  // Gated by `mounted` so the URL is only read on the client (matches the app's
  // mounted-gate pattern: no hydration mismatch, no setState-in-effect).
  const devPreview = mounted && new URLSearchParams(window.location.search).get("dev") === "1";

  const isUnlocked = useCallback(
    (id: string) => devPreview || (mounted && Boolean(unlockedMap[id])),
    [devPreview, mounted, unlockedMap],
  );
  const unlockedCount = devPreview
    ? specialCards.length
    : mounted
      ? Object.keys(unlockedMap).length
      : 0;

  // v1.3 rank gates: the Collection opens at Bronze, and each rarity unlocks at a
  // rank (Bronze rare → Diamond legendary). devPreview and pre-mount stay open to
  // avoid a hydration flash — the lock is a brief first-session state (Bronze is
  // one run away). `rarityLockedAt` returns the rank label that unlocks a still-
  // locked rarity (null = available to this player).
  const collectionLocked = mounted && !devPreview && !rankRewardsForXp(xp).collection;
  const unlockedRarities = mounted && !devPreview ? rankRewardsForXp(xp).rarities : null;
  const rarityLockedAt = (r: SpecialRarity): { id: string; label: string } | null =>
    unlockedRarities && !unlockedRarities.includes(r) ? rankThatUnlocksRarity(r) : null;

  // Single grid (v0.6.1, by direction): UNLOCKED cards lead — ordered rarity
  // (legendary→rare) then overall — followed by the still-locked cards in the
  // same rarity→overall order.
  const visible = useMemo(() => {
    const filtered = specialCards.filter((sp) => {
      if (status === "unlocked" && !isUnlocked(sp.id)) return false;
      if (status === "locked" && isUnlocked(sp.id)) return false;
      if (rarity !== "all" && sp.rarity !== rarity) return false;
      return true;
    });
    return [...filtered].sort((a, b) => {
      const lockDiff = Number(isUnlocked(b.id)) - Number(isUnlocked(a.id));
      if (lockDiff !== 0) return lockDiff; // unlocked first
      return RARITY_RANK[b.rarity] - RARITY_RANK[a.rarity] || b.overall - a.overall;
    });
  }, [isUnlocked, status, rarity]);

  // Progressive reveal: only the first `limit` cards mount; a sentinel below the
  // grid bumps it by a batch as it nears the viewport. Reset to one batch when
  // the filtered set changes (new filter / first unlock load) so a fresh view
  // never carries a stale large count — done as a render-phase reset (React's
  // "adjust state when an input changes" pattern) to keep setState out of an
  // effect (avoids cascading renders).
  const [limit, setLimit] = useState(PAGE_BATCH);
  const filterKey = `${status}|${rarity}|${mounted}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setLimit(PAGE_BATCH);
  }
  const shown = visible.slice(0, limit);
  const hasMore = limit < visible.length;

  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setLimit((l) => l + PAGE_BATCH);
      },
      { rootMargin: "600px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
    // Re-observe on each `limit` change: IntersectionObserver only fires on
    // transitions, so if the sentinel is still visible after a batch (tall
    // viewport / short batch) re-attaching re-checks and appends again until the
    // 600px margin is filled or no cards remain.
  }, [hasMore, limit]);

  // Unranked: the album is sealed until Bronze. Shown after the hooks above so
  // the rules-of-hooks order is stable.
  if (collectionLocked) {
    return (
      <div className="rise-in">
        <BackToMenu />
        <SectionTitle kicker={C.subtitle} title={C.title} className="mb-6" />
        <Panel strong className="p-10 text-center">
          <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-line bg-white/5 text-faint">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <rect x="5" y="11" width="14" height="9" rx="2" />
              <path d="M8 11V8a4 4 0 0 1 8 0v3" />
            </svg>
          </span>
          <p className="display text-lg font-bold uppercase tracking-wide text-ink">{C.lockedTitle}</p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-sub">{C.lockedBody}</p>
        </Panel>
      </div>
    );
  }

  return (
    <div className="rise-in">
      <BackToMenu />
      <SectionTitle
        kicker={C.subtitle}
        title={C.title}
        right={
          <div className="flex items-center gap-2">
            {devPreview ? (
              <span className="display rounded-md border border-blue/50 bg-blue/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-bright">
                Dev preview
              </span>
            ) : null}
            <Badge tone="orange" className="!text-sm">
              {C.progress(unlockedCount, specialCards.length)}
            </Badge>
          </div>
        }
        className="mb-6"
      />

      {/* Rarity progress */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {RARITIES.map((r) => {
          const total = specialCards.filter((sp) => sp.rarity === r).length;
          const got = devPreview
            ? total
            : mounted
              ? specialCards.filter((sp) => sp.rarity === r && unlockedMap[sp.id]).length
              : 0;
          const lockRank = rarityLockedAt(r);
          return (
            <Panel key={r} className={cx("p-3 text-center", lockRank && "opacity-70")}>
              <p className="kicker !text-[10px]">{RARITY_LABELS[r]}</p>
              {lockRank ? (
                <div className="mt-1 flex flex-col items-center gap-1">
                  <RankBadge rank={lockRank} variant="menu" size="sm" />
                  <p className="display flex items-center justify-center gap-1 text-[11px] font-bold uppercase tracking-wide text-faint">
                    {C.unlocksAt(lockRank.label)}
                  </p>
                </div>
              ) : (
                <p className="display mt-1 text-xl font-bold text-ink">
                  {got}
                  <span className="text-sm text-faint">/{total}</span>
                </p>
              )}
            </Panel>
          );
        })}
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {(["all", "unlocked", "locked"] as StatusFilter[]).map((f) => (
          <FilterChip key={f} active={status === f} onClick={() => setStatus(f)}>
            {C.filters[f]}
          </FilterChip>
        ))}
        <span className="mx-1 h-4 w-px bg-line-strong" aria-hidden />
        <FilterChip active={rarity === "all"} onClick={() => setRarity("all")}>
          {C.filters.all}
        </FilterChip>
        {RARITIES.map((r) => (
          <FilterChip key={r} active={rarity === r} onClick={() => setRarity(r)}>
            {RARITY_LABELS[r]}
          </FilterChip>
        ))}
      </div>

      {/* Grid — single grid, unlocked first (rarity → overall), then locked */}
      {visible.length === 0 ? (
        <Panel className="p-10 text-center text-sm text-sub">{C.empty}</Panel>
      ) : (
        // Mobile (<640px): exactly 2 columns so cards aren't one-per-row huge
        // (v1.1.0). From sm: up, the original auto-fill grid is restored
        // unchanged — columns stretch (1fr) to fill the row with no empty
        // column on the right. Cards are fluid (w-full) to fill their cell, so
        // shrinking the cell is the intended resize path — no card internals
        // are touched, and only the collection uses this grid.
        <div className="grid grid-cols-2 sm:grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3 md:gap-4">
          {shown.map((sp, i) => (
            <FxCard key={sp.id}>
              {isUnlocked(sp.id) ? (
                <GameCard
                  card={resolveSpecial(sp)}
                  showOverall
                  specialCollected
                  size="md"
                  fluid
                  lite
                  // First row(s) are the LCP candidates: load their photos
                  // eagerly instead of lazily so the largest paint isn't gated
                  // on scroll/intersection. Unlocked cards sort first, so the
                  // leading indices are exactly the above-the-fold photos.
                  priority={i < 6}
                  onClick={() => setDetail(sp)}
                />
              ) : (
                <LockedCard sp={sp} onClick={() => setDetail(sp)} />
              )}
            </FxCard>
          ))}
        </div>
      )}

      {/* Reveal sentinel — appending more cards as it nears the viewport keeps
          the initial mount small without a "load more" click. Rendered only
          while cards remain; the 600px rootMargin loads the next batch before
          the user reaches the bottom so the scroll stays seamless. */}
      {hasMore ? <div ref={sentinelRef} aria-hidden className="h-px w-full" /> : null}

      {/* Detail modal */}
      <Modal
        open={Boolean(detail)}
        title={detail ? (isUnlocked(detail.id) ? detail.title : C.lockedCard) : ""}
        onClose={() => setDetail(null)}
        wide
      >
        {detail ? (
          isUnlocked(detail.id) ? (
            <UnlockedDetail sp={detail} unlockedAt={unlockedMap[detail.id] ?? ""} />
          ) : (
            <LockedDetail sp={detail} />
          )
        ) : null}
      </Modal>
    </div>
  );
}

/**
 * Pauses a card's remaining animations (the foil sheen) while it's scrolled
 * off-screen, resuming as it nears the viewport — so a near-complete album only
 * animates the cards actually in view. This is effective now that the heavy
 * always-on layers (blend modes, backdrop-blur, forced tilt layers) are gone in
 * `lite` mode. Card internals are untouched; lives only in the collection.
 */
function FxCard({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setPaused(!entry.isIntersecting), {
      rootMargin: "400px 0px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={paused ? "fx-paused" : undefined}>
      {children}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        "display rounded-full border px-3.5 py-1 text-xs font-bold uppercase tracking-[0.1em] transition-colors",
        active
          ? "border-orange/60 bg-orange/15 text-orange-bright"
          : "border-line bg-white/3 text-sub hover:border-line-strong hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

function LockedCard({ sp, onClick }: { sp: SpecialCard; onClick: () => void }) {
  const { SPECIAL_TYPE_LABELS, RARITY_LABELS } = useCopy();
  return (
    <button type="button" onClick={onClick} className="relative block w-full text-left">
      {/* Fluid (w-full) to fill its grid cell, matching the fluid unlocked
          GameCard so earned and locked cards stay the same size (v1.0.0). */}
      <div className="card-frame card-hidden flex aspect-[3/4.3] w-full flex-col p-3 opacity-80 transition-all hover:opacity-100">
        <div className="flex items-start justify-between">
          <span className="display text-3xl font-bold leading-none text-faint">??</span>
          <LockGlyph />
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="flex h-[72px] w-[72px] items-center justify-center bg-gradient-to-br from-slate-700/50 to-slate-900/60 [clip-path:polygon(50%_0,100%_25%,100%_75%,50%_100%,0_75%,0_25%)]">
            <span className="display text-2xl font-bold text-faint">?</span>
          </div>
        </div>
        <p className="display truncate text-sm font-bold uppercase tracking-wide text-faint">???</p>
        <div className="mt-1.5">
          <Badge tone="neutral" className="!text-[9px]">
            {sp.rarity === "creator"
              ? RARITY_LABELS[sp.rarity]
              : `${SPECIAL_TYPE_LABELS[sp.cardType]} · ${RARITY_LABELS[sp.rarity]}`}
          </Badge>
        </div>
      </div>
    </button>
  );
}

function UnlockedDetail({ sp, unlockedAt }: { sp: SpecialCard; unlockedAt: string }) {
  const { COLLECTION_UI: C, SPECIAL_TYPE_LABELS, RARITY_LABELS, EFFECT_LABELS, STAT_LABELS } = useCopy();
  const resolved = resolveSpecial(sp);
  const stats = effectiveStats(sp.overall, sp.stats);
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-[auto_1fr]">
      <div className="mx-auto">
        {/* Detail view gets the strongest tilt of all (item: collection UX). */}
        <GameCard card={resolved} showOverall specialCollected size="lg" tilt="max" />
      </div>
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap gap-1.5">
          {sp.rarity !== "creator" ? (
            <Badge tone="gold">{SPECIAL_TYPE_LABELS[sp.cardType]}</Badge>
          ) : null}
          <Badge tone="orange">{RARITY_LABELS[sp.rarity]}</Badge>
          <Badge tone="neutral">{resolved.seasonLabel}</Badge>
          {resolved.country ? <Badge tone="neutral">{countryName(resolved.country)}</Badge> : null}
        </div>
        <div>
          <p className="kicker mb-1">{C.context}</p>
          <p className="text-sm leading-relaxed">{sp.flavor}</p>
        </div>
        <div>
          <p className="kicker mb-1">{C.effect}</p>
          <p className="text-sm">
            <span className="font-semibold text-orange-bright">
              {EFFECT_LABELS[sp.effect.type]}
            </span>{" "}
            — {sp.effect.description}
          </p>
        </div>
        <div className="space-y-1.5">
          {(Object.keys(STAT_LABELS) as (keyof typeof stats)[]).map((key) => (
            <StatBar key={key} label={STAT_LABELS[key]} value={Math.round(stats[key])} />
          ))}
        </div>
        {unlockedAt ? (
          <p className="text-xs text-faint">{C.unlockedOn(formatDate(unlockedAt))}</p>
        ) : null}
      </div>
    </div>
  );
}

function LockedDetail({ sp }: { sp: SpecialCard }) {
  const { COLLECTION_UI: C, SPECIAL_TYPE_LABELS, RARITY_LABELS } = useCopy();
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {sp.rarity !== "creator" ? (
          <Badge tone="neutral">{SPECIAL_TYPE_LABELS[sp.cardType]}</Badge>
        ) : null}
        <Badge tone="neutral">{RARITY_LABELS[sp.rarity]}</Badge>
      </div>
      <p>{C.lockedHint}</p>
    </div>
  );
}

function LockGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 text-faint" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}
