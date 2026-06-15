"use client";

/**
 * Collection album (special cards). Unlocked cards open a detail modal with
 * full stats; locked cards show as silhouettes with their rarity to chase.
 */

import { useMemo, useState } from "react";
import { specialCards } from "@/data";
import {
  COLLECTION_UI as C,
  EFFECT_LABELS,
  RARITY_LABELS,
  SPECIAL_TYPE_LABELS,
  STAT_LABELS,
} from "@/content/copy";
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

/** Album order (v0.7.0): highest rarity first, then by overall within each. */
const RARITY_DISPLAY_ORDER: SpecialRarity[] = ["legendary", "mythic", "epic", "rare"];

/** Section-heading tint per rarity — matches the new card-frame palette. */
const RARITY_HEADING: Record<SpecialRarity, string> = {
  legendary: "text-amber-200",
  mythic: "text-red-300",
  epic: "text-fuchsia-300",
  rare: "text-violet-300",
};

export default function CollectionPage() {
  const mounted = useMounted();
  const unlockedMap = useProfileStore((s) => s.unlockedSpecials);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [rarity, setRarity] = useState<SpecialRarity | "all">("all");
  const [detail, setDetail] = useState<SpecialCard | null>(null);

  const unlockedCount = mounted ? Object.keys(unlockedMap).length : 0;

  // Grouped by rarity (legendary → rare), sorted by overall within each group
  // (v0.7.0). Locked cards are grouped the same way — their rarity is known,
  // only the overall number is hidden on the silhouette.
  const groups = useMemo(() => {
    const isUnlocked = (id: string) => mounted && Boolean(unlockedMap[id]);
    const filtered = specialCards.filter((sp) => {
      if (status === "unlocked" && !isUnlocked(sp.id)) return false;
      if (status === "locked" && isUnlocked(sp.id)) return false;
      if (rarity !== "all" && sp.rarity !== rarity) return false;
      return true;
    });
    return RARITY_DISPLAY_ORDER.filter((r) => rarity === "all" || rarity === r)
      .map((r) => ({
        rarity: r,
        cards: filtered
          .filter((sp) => sp.rarity === r)
          .sort(
            (a, b) =>
              b.overall - a.overall ||
              Number(isUnlocked(b.id)) - Number(isUnlocked(a.id)),
          ),
      }))
      .filter((g) => g.cards.length > 0);
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

      {/* Grid — one section per rarity, highest first */}
      {groups.length === 0 ? (
        <Panel className="p-10 text-center text-sm text-sub">{C.empty}</Panel>
      ) : (
        <div className="space-y-8">
          {groups.map((group) => (
            <section key={group.rarity}>
              <div className="mb-3 flex items-center gap-3">
                <h2
                  className={cx(
                    "display text-sm font-bold uppercase tracking-[0.16em]",
                    RARITY_HEADING[group.rarity],
                  )}
                >
                  {RARITY_LABELS[group.rarity]}
                </h2>
                <span className="h-px flex-1 bg-line" aria-hidden />
                <span className="text-xs text-faint">{group.cards.length}</span>
              </div>
              <div className="flex flex-wrap justify-center gap-3 md:justify-start md:gap-4">
                {group.cards.map((sp) => {
                  const isUnlocked = mounted && Boolean(unlockedMap[sp.id]);
                  return isUnlocked ? (
                    <GameCard
                      key={sp.id}
                      card={resolveSpecial(sp)}
                      showOverall
                      specialCollected
                      size="md"
                      onClick={() => setDetail(sp)}
                    />
                  ) : (
                    <LockedCard key={sp.id} sp={sp} onClick={() => setDetail(sp)} />
                  );
                })}
              </div>
            </section>
          ))}
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
  return (
    <button type="button" onClick={onClick} className="relative block text-left">
      {/* Match the unlocked GameCard md footprint exactly (w-36 md:w-44, p-3)
          so earned and locked cards never differ in size (v0.7.0). */}
      <div className="card-frame card-hidden flex aspect-[3/4.3] w-36 flex-col p-3 opacity-80 transition-all hover:opacity-100 md:w-44">
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
