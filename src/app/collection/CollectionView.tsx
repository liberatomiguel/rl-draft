"use client";

/**
 * Collection album (special cards). Unlocked cards open a detail modal with
 * full stats; locked cards show as silhouettes with their rarity to chase.
 * rc.33 (COL-02c): a card collected and not opened yet wears NEW; opening its
 * detail clears it (visiting the tab does not). The tabs carry the dot of the
 * album that holds something new — the same items the nav dot counts.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { specialCards } from "@/data";
import { useCopy } from "@/content/copy";
import { effectiveStats, isSpecialPersonRarity, resolveSpecial } from "@/engine/cards";
import { isNationalTeamDiscovered } from "@/engine/collection";
import { specialKey } from "@/engine/profileNew";
import type { SpecialCard, SpecialRarity } from "@/engine/types";
import { cx, countryName, formatDate } from "@/lib/util";
import { useMounted } from "@/store/useMounted";
import { useProfileStore } from "@/store/profileStore";
import { useOpenContent, useProfileNew, useNewTab } from "@/store/useNewItems";
import { rankRewardsForXp, rankThatUnlocksRarity } from "@/engine/progression";
import { Badge } from "@/components/ui/Badge";
import { BackToMenu } from "@/components/layout/LeaveRunGuard";
import { Modal } from "@/components/ui/Modal";
import { NewDot } from "@/components/ui/NewDot";
import { Panel, SectionTitle } from "@/components/ui/Panel";
import { RankBadge } from "@/components/ui/RankBadge";
import { StatBar } from "@/components/ui/ProgressBar";
import { GameCard } from "@/components/cards/GameCard";
import { NATIONAL_CARD_IDS, NATIONAL_TEAMS, NationalAlbum } from "./NationalAlbum";

// Official catalogue groups, followed by discovered special-person families. The
// special-person rarities (community/wings/creator) are intentionally absent:
// those cards are hidden until owned (see `collectibleCards`), so they get no
// chase tile. Community gains its own group; Wings and Creator share Special.
type AlbumRarity = Exclude<SpecialRarity, "national" | "wings" | "creator"> | "special";
const RARITIES: AlbumRarity[] = ["legendary", "mythic", "epic", "rare"];
const albumRarityOf = (r: SpecialRarity): AlbumRarity | "national" => r === "wings" || r === "creator" ? "special" : r;
type StatusFilter = "all" | "unlocked" | "locked";
/** v2.0: the special-card album and the national-team album (its own set). */
type Album = "specials" | "national";

/**
 * Sort weight per rarity — higher = first within a lock state. Order by direction
 * (v1.4): legendary → mythic → epic → rare → content-creator → Wings → Creator. The
 * two easter-egg rarities (Wings, Creator) sit at the very end.
 */
const RARITY_RANK: Record<SpecialRarity, number> = {
  legendary: 6,
  mythic: 5,
  epic: 4,
  rare: 3,
  community: 2,
  wings: 1,
  creator: 0,
  national: -1,
};

/** Easter-egg rarities — masked in the collection until unlocked (Wings + Creator). */
const SECRET_RARITIES: SpecialRarity[] = ["creator", "wings"];
const isSecretRarity = (r: SpecialRarity) => SECRET_RARITIES.includes(r);

/**
 * Progressive reveal batch (UI/perf, not gameplay — stays out of balance.ts).
 * Each rarity renders this many cards up front and appends another batch as a
 * sentinel scrolls into view, so the initial paint mounts a few dozen cards
 * instead of the whole (ever-growing) catalogue — the lever that actually moves
 * the /collection LCP/INP. Cards still render in full (no clipping), preserving
 * the glows/tilt that overflow the frame and the continuous "album wall" feel.
 */
const PAGE_BATCH = 24;

export function CollectionView() {
  const { COLLECTION_UI: C, RARITY_LABELS, NATIONAL_UI: N, NAV_UI } = useCopy();
  const mounted = useMounted();
  const unlockedMap = useProfileStore((s) => s.unlockedSpecials);
  const nationalDiscovered = useProfileStore((s) => s.nationalDiscovered);
  const xp = useProfileStore((s) => s.xp);
  const fresh = useProfileNew();
  const openContent = useOpenContent();
  const [status, setStatus] = useState<StatusFilter>("all");
  const [rarity, setRarity] = useState<AlbumRarity | "all">("all");
  const [album, setAlbum] = useState<Album>("specials");
  const [collapsed, setCollapsed] = useState<Set<AlbumRarity>>(() => new Set());
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
  // National teams (rc.33): a page is revealed by the find, or by an owned card.
  const isDiscovered = useCallback(
    (lineupId: string) =>
      devPreview || (mounted && isNationalTeamDiscovered(lineupId, nationalDiscovered, unlockedMap)),
    [devPreview, mounted, nationalDiscovered, unlockedMap],
  );
  const foundOn = useCallback(
    (lineupId: string) => (mounted ? nationalDiscovered?.[lineupId] ?? null : null),
    [mounted, nationalDiscovered],
  );
  // Opening a card's detail is opening that content: it stops being new.
  const openDetail = useCallback(
    (sp: SpecialCard) => {
      openContent([specialKey(sp.id)]);
      setDetail(sp);
    },
    [openContent],
  );
  const specialsDot = useNewTab("album:specials", fresh.specials, album === "specials");
  const nationalDot = useNewTab("album:national", [...fresh.nationalCards, ...fresh.nationalTeams], album === "national");
  const albumDot: Record<Album, boolean> = { specials: specialsDot, national: nationalDot };

  // The album shows the OFFICIAL catalogue by default; the special-person cards
  // (creator / wings / community) only appear — and only count toward the total —
  // once OWNED. So the denominator reads the official count until one is unlocked,
  // then ticks up. devPreview keeps everything visible.
  // National-team cards (v2.0) live in their own album (NationalAlbum), so they
  // never count here.
  const collectibleCards = useMemo(
    () =>
      specialCards.filter(
        (sp) => sp.rarity !== "national" && (!isSpecialPersonRarity(sp.rarity) || isUnlocked(sp.id)),
      ),
    [isUnlocked],
  );
  const albumRarities = [...RARITIES, ...(["community", "special"] as AlbumRarity[]).filter(r => collectibleCards.some(sp => albumRarityOf(sp.rarity) === r))];
  const nationalGot = mounted ? NATIONAL_CARD_IDS.filter((id) => isUnlocked(id)).length : 0;
  const nationalFound = NATIONAL_TEAMS.filter((t) => isDiscovered(t.id)).length;
  const unlockedCount = devPreview
    ? collectibleCards.length
    : mounted
      ? collectibleCards.filter((sp) => isUnlocked(sp.id)).length
      : 0;

  // v1.3 rank gates: the Collection opens at Bronze, and each rarity unlocks at a
  // rank (Bronze rare → Diamond legendary). devPreview and pre-mount stay open to
  // avoid a hydration flash — the lock is a brief first-session state (Bronze is
  // one run away). `rarityLockedAt` returns the rank label that unlocks a still-
  // locked rarity (null = available to this player).
  const collectionLocked = mounted && !devPreview && !rankRewardsForXp(xp).collection;
  const unlockedRarities = mounted && !devPreview ? rankRewardsForXp(xp).rarities : null;
  const rarityLockedAt = (r: AlbumRarity): { id: string; label: string } | null =>
    r !== "special" && unlockedRarities && !unlockedRarities.includes(r) ? rankThatUnlocksRarity(r) : null;

  // Single grid (v0.6.1, by direction): UNLOCKED cards lead — ordered rarity
  // (legendary→rare) then overall — followed by the still-locked cards in the
  // same rarity→overall order.
  const visible = useMemo(() => {
    const filtered = collectibleCards.filter((sp) => {
      if (status === "unlocked" && !isUnlocked(sp.id)) return false;
      if (status === "locked" && isUnlocked(sp.id)) return false;
      if (rarity !== "all" && albumRarityOf(sp.rarity) !== rarity) return false;
      return true;
    });
    return [...filtered].sort((a, b) => {
      const lockDiff = Number(isUnlocked(b.id)) - Number(isUnlocked(a.id));
      if (lockDiff !== 0) return lockDiff; // unlocked first
      return RARITY_RANK[b.rarity] - RARITY_RANK[a.rarity] || b.overall - a.overall;
    });
  }, [collectibleCards, isUnlocked, status, rarity]);

  const firstVisibleRarity = albumRarities.find(r => !collapsed.has(r) && visible.some(sp => albumRarityOf(sp.rarity) === r));

  // Progressive reveal: only the first `limit` cards per rarity mount; a sentinel below the
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
  const shown = visible;
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
            {album === "national" ? (
              <Badge tone="gold" className="!text-sm">
                {C.progress(nationalGot, NATIONAL_CARD_IDS.length)}
              </Badge>
            ) : (
              <Badge tone="orange" className="!text-sm">
                {C.progress(unlockedCount, collectibleCards.length)}
              </Badge>
            )}
          </div>
        }
        className="mb-6"
      />

      {/* Album switch (v2.0): special cards · national teams. Each tab carries
          its own count, so the second album reads as a place with content. */}
      <div className="mb-6 inline-flex max-w-full rounded-xl border border-line bg-white/3 p-1" role="tablist">
        {(["specials", "national"] as Album[]).map((a) => (
          <button
            key={a}
            type="button"
            role="tab"
            aria-selected={album === a}
            onClick={() => setAlbum(a)}
            className={cx(
              "display relative flex min-w-0 items-baseline gap-2 rounded-lg px-4 py-1.5 text-xs font-bold uppercase tracking-[0.1em] transition-colors",
              album === a
                ? a === "national"
                  ? "bg-yellow-300/15 text-yellow-100"
                  : "bg-orange/15 text-orange-bright"
                : "text-sub hover:text-ink",
            )}
          >
            <span className="truncate">{a === "specials" ? N.tabSpecials : N.tabNational}</span>
            <span className={cx("shrink-0 text-[10px] font-semibold tracking-normal", album === a ? "opacity-70" : "text-faint")}>
              {a === "specials"
                ? `${unlockedCount}/${collectibleCards.length}`
                : `${nationalFound}/${NATIONAL_TEAMS.length}`}
            </span>
            {albumDot[a] ? <NewDot className="absolute right-1 top-1" label={NAV_UI.newHere} /> : null}
          </button>
        ))}
      </div>

      {album === "national" ? (
        <NationalAlbum isUnlocked={isUnlocked} isDiscovered={isDiscovered} foundOn={foundOn} onOpenCard={openDetail} />
      ) : (
        <>
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
          {albumRarities.map((r) => (
            <FilterChip key={r} active={rarity === r} onClick={() => setRarity(r)}>
              {RARITY_LABELS[r]}
            </FilterChip>
          ))}
        </div>

        {/* Grid — single grid, unlocked first (rarity → overall), then locked */}
        {visible.length === 0 ? (
          <Panel className="p-10 text-center text-sm text-sub">{C.empty}</Panel>
        ) : (
          <div className="space-y-5">
            {albumRarities.filter(r => visible.some(sp => albumRarityOf(sp.rarity) === r)).map(r => {
              const cards = collectibleCards.filter(sp => albumRarityOf(sp.rarity) === r);
              const got = cards.filter(sp => isUnlocked(sp.id)).length;
              const lockRank = rarityLockedAt(r);
              const closed = collapsed.has(r);
              return <section key={r} className="rounded-xl border border-line bg-white/[0.015]">
                <button type="button" aria-expanded={!closed} aria-controls={`rarity-${r}`} onClick={() => setCollapsed(prev => {
                  const next = new Set(prev); if (next.has(r)) next.delete(r); else next.add(r); return next;
                })} className="flex min-h-12 w-full items-center gap-3 rounded-xl px-4 py-3 text-left hover:bg-white/[0.03]">
                  <span className="display text-sm font-bold uppercase tracking-wider text-ink">{RARITY_LABELS[r]}</span>
                  <span className="font-mono text-xs text-sub">{got}/{cards.length}</span>
                  {lockRank ? <span className="ml-auto flex items-center gap-1 text-[10px] text-faint"><RankBadge rank={lockRank} variant="menu" size="sm" />{C.unlocksAt(lockRank.label)}</span> : null}
                  <span aria-hidden className="ml-auto text-sub">{closed ? "+" : "−"}</span>
                </button>
                {!closed ? <div id={`rarity-${r}`} className="grid grid-cols-2 gap-3 px-3 pb-3 sm:grid-cols-[repeat(auto-fill,minmax(160px,1fr))] md:gap-4">
            {shown.filter(sp => albumRarityOf(sp.rarity) === r).slice(0, limit).map((sp, i) => (
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
                    priority={r === firstVisibleRarity && i < 6}
                    newTag={fresh.keys.has(specialKey(sp.id))}
                    newTagText={C.newTag}
                    onClick={() => openDetail(sp)}
                  />
                ) : (
                  <LockedCard sp={sp} onClick={() => setDetail(sp)} />
                )}
              </FxCard>
            ))}
                </div> : null}
              </section>;
            })}
          </div>
        )}

        {/* Reveal sentinel — appending more cards as it nears the viewport keeps
            the initial mount small without a "load more" click. Rendered only
            while cards remain; the 600px rootMargin loads the next batch before
            the user reaches the bottom so the scroll stays seamless. */}
        {hasMore ? <div ref={sentinelRef} aria-hidden className="h-px w-full" /> : null}
        </>
      )}

      {/* Detail modal */}
      <Modal
        open={Boolean(detail)}
        title={
          detail
            ? isUnlocked(detail.id)
              ? detail.rarity === "national"
                ? N.teamName(resolveSpecial(detail).orgId ?? "", detail.title)
                : detail.title
              : C.lockedCard
            : ""
        }
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
            {isSecretRarity(sp.rarity)
              ? RARITY_LABELS[sp.rarity]
              : `${SPECIAL_TYPE_LABELS[sp.cardType]} · ${RARITY_LABELS[sp.rarity]}`}
          </Badge>
        </div>
      </div>
    </button>
  );
}

function UnlockedDetail({ sp, unlockedAt }: { sp: SpecialCard; unlockedAt: string }) {
  const { COLLECTION_UI: C, SPECIAL_TYPE_LABELS, RARITY_LABELS, EFFECT_LABELS, STAT_LABELS, NATIONAL_UI: N } =
    useCopy();
  const resolved = resolveSpecial(sp);
  const stats = effectiveStats(sp.overall, sp.stats);
  // National cards (v2.0): localized story + buff, one gold badge (type = rarity).
  const national = sp.rarity === "national";
  const nation = N.teamName(resolved.orgId ?? "", sp.title);
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-[auto_1fr]">
      <div className="mx-auto">
        {/* Detail view gets the strongest tilt of all (item: collection UX). */}
        <GameCard card={resolved} showOverall specialCollected size="lg" tilt="max" />
      </div>
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap gap-1.5">
          {!isSecretRarity(sp.rarity) ? (
            <Badge tone="gold">{SPECIAL_TYPE_LABELS[sp.cardType]}</Badge>
          ) : null}
          {!national ? <Badge tone="orange">{RARITY_LABELS[sp.rarity]}</Badge> : null}
          <Badge tone="neutral">{resolved.seasonLabel}</Badge>
          {resolved.country ? <Badge tone="neutral">{countryName(resolved.country)}</Badge> : null}
        </div>
        <div>
          <p className="kicker mb-1">{C.context}</p>
          <p className="text-sm leading-relaxed">
            {national ? N.flavor(resolved.name, nation, resolved.seasonLabel ?? "") : sp.flavor}
          </p>
        </div>
        <div>
          <p className="kicker mb-1">{C.effect}</p>
          <p className="text-sm">
            {/* Only the legacy situational effects have a label; the v3 boosts
                read as their description alone (no orphan dash). */}
            {EFFECT_LABELS[sp.effect.type] ? (
              <>
                <span className="font-semibold text-orange-bright">{EFFECT_LABELS[sp.effect.type]}</span>
                {" — "}
              </>
            ) : null}
            {national ? N.effect(sp.effect.value) : sp.effect.description}
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
        {!isSecretRarity(sp.rarity) ? (
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
