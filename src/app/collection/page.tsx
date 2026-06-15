"use client";

/**
 * Collection album (special cards). Unlocked cards open a detail modal with
 * full stats; locked cards show as silhouettes with their rarity to chase.
 */

import { useMemo, useState } from "react";
import { specialCards } from "@/data";
import { useCopy } from "@/content/copy";
import { effectiveStats, resolveSpecial } from "@/engine/cards";
import type { SpecialCard, SpecialRarity } from "@/engine/types";
import { cx, countryName, formatDate } from "@/lib/util";
import { useMounted } from "@/store/useMounted";
import { useProfileStore } from "@/store/profileStore";
import { Badge } from "@/components/ui/Badge";
import { BackToMenu } from "@/components/layout/LeaveRunGuard";
import { Modal } from "@/components/ui/Modal";
import { Panel, SectionTitle } from "@/components/ui/Panel";
import { StatBar } from "@/components/ui/ProgressBar";
import { GameCard } from "@/components/cards/GameCard";

const RARITIES: SpecialRarity[] = ["rare", "epic", "mythic", "legendary"];
type StatusFilter = "all" | "unlocked" | "locked";

/** Sort weight per rarity — higher = rarer, ordered first within a lock state. */
const RARITY_RANK: Record<SpecialRarity, number> = {
  legendary: 4,
  mythic: 3,
  epic: 2,
  rare: 1,
};

export default function CollectionPage() {
  const { COLLECTION_UI: C, RARITY_LABELS } = useCopy();
  const mounted = useMounted();
  const unlockedMap = useProfileStore((s) => s.unlockedSpecials);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [rarity, setRarity] = useState<SpecialRarity | "all">("all");
  const [detail, setDetail] = useState<SpecialCard | null>(null);

  const unlockedCount = mounted ? Object.keys(unlockedMap).length : 0;

  // Single grid (v0.6.1, by direction): UNLOCKED cards lead — ordered rarity
  // (legendary→rare) then overall — followed by the still-locked cards in the
  // same rarity→overall order.
  const visible = useMemo(() => {
    const isUnlocked = (id: string) => mounted && Boolean(unlockedMap[id]);
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
  }, [mounted, unlockedMap, status, rarity]);

  return (
    <div className="rise-in">
      <BackToMenu />
      <SectionTitle
        kicker={C.subtitle}
        title={C.title}
        right={
          <Badge tone="orange" className="!text-sm">
            {C.progress(unlockedCount, specialCards.length)}
          </Badge>
        }
        className="mb-6"
      />

      {/* Rarity progress */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {RARITIES.map((r) => {
          const total = specialCards.filter((sp) => sp.rarity === r).length;
          const got = mounted
            ? specialCards.filter((sp) => sp.rarity === r && unlockedMap[sp.id]).length
            : 0;
          return (
            <Panel key={r} className="p-3 text-center">
              <p className="kicker !text-[10px]">{RARITY_LABELS[r]}</p>
              <p className="display mt-1 text-xl font-bold text-ink">
                {got}
                <span className="text-sm text-faint">/{total}</span>
              </p>
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
          {visible.map((sp) => {
            const isUnlocked = mounted && Boolean(unlockedMap[sp.id]);
            return isUnlocked ? (
              <GameCard
                key={sp.id}
                card={resolveSpecial(sp)}
                showOverall
                specialCollected
                size="md"
                fluid
                onClick={() => setDetail(sp)}
              />
            ) : (
              <LockedCard key={sp.id} sp={sp} onClick={() => setDetail(sp)} />
            );
          })}
        </div>
      )}

      {/* Detail modal */}
      <Modal
        open={Boolean(detail)}
        title={detail ? (mounted && unlockedMap[detail.id] ? detail.title : C.lockedCard) : ""}
        onClose={() => setDetail(null)}
        wide
      >
        {detail ? (
          mounted && unlockedMap[detail.id] ? (
            <UnlockedDetail sp={detail} unlockedAt={unlockedMap[detail.id]} />
          ) : (
            <LockedDetail sp={detail} />
          )
        ) : null}
      </Modal>
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
            {SPECIAL_TYPE_LABELS[sp.cardType]} · {RARITY_LABELS[sp.rarity]}
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
          <Badge tone="gold">{SPECIAL_TYPE_LABELS[sp.cardType]}</Badge>
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
        <p className="text-xs text-faint">{C.unlockedOn(formatDate(unlockedAt))}</p>
      </div>
    </div>
  );
}

function LockedDetail({ sp }: { sp: SpecialCard }) {
  const { COLLECTION_UI: C, SPECIAL_TYPE_LABELS, RARITY_LABELS } = useCopy();
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        <Badge tone="neutral">{SPECIAL_TYPE_LABELS[sp.cardType]}</Badge>
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
