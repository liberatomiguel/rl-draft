"use client";

/**
 * Locker (v2.0, rebuilt rc.2, reworked rc.4): a MODAL that opens on the slot
 * the player tapped in the profile hero. One tab per kind (title · badges ·
 * banner); a green DOT on a tab means it holds something new.
 *  · Owned items equip on tap. Badges: up to three, in order — the first is
 *    FEATURED (the showcase strip on top re-orders them: tap one to feature it).
 *  · Items still to earn by playing show as anonymous LOCKED slots, like the
 *    collection's silhouettes: rarity only, never their art or name.
 *  · Exclusive items, the season track and leaderboard rewards the player does
 *    not own are not listed at all (they have their own screens or cannot be
 *    chased) — `lockerItems` decides.
 * Opening a tab marks its owned items as seen (clears the dots).
 */

import { useEffect, useState } from "react";
import { RANKS } from "@/config/balance";
import { SEASON } from "@/config/season";
import { cosmeticById, type CosmeticDef, type CosmeticKind, type CosmeticSource } from "@/data/cosmetics";
import { featureBadge, lockerItems, MAX_BADGES, resolveEquipped, unseenOfKind, unseenOwnedIds } from "@/engine/cosmetics";
import { useCopy } from "@/content/copy";
import { cx } from "@/lib/util";
import { sfx } from "@/lib/sfx";
import { useProfileStore } from "@/store/profileStore";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { BadgeEmblem, CosmeticArt, TIER_ACCENT, TIER_RING, useCosmeticCopy } from "./CosmeticViews";

export const LOCKER_KINDS: CosmeticKind[] = ["title", "badge", "banner"];

const rankLabel = (id: string): string => RANKS.find((r) => r.id === id)?.label ?? id;

export function sourceLabel(source: CosmeticSource, C: ReturnType<typeof useCopy>["COSMETICS"]): string {
  switch (source.type) {
    case "legacy-participation":
      return C.sources["legacy-participation"];
    case "legacy-rank":
      return C.sources["legacy-rank"](rankLabel(source.rankId));
    case "legacy-position":
      return C.sources["legacy-position"](source.minPosition, source.maxPosition);
    case "grant":
      return C.sources[`grant-${source.grantId}`];
    case "season-rank":
      return C.sources["season-rank"](rankLabel(source.rankId), SEASON.name);
    case "login-streak":
      return C.sources["login-streak"](source.days);
    case "challenge-stars":
      return C.sources["challenge-stars"](source.stars);
    case "quiz-solved":
      return C.sources["quiz-solved"](source.count);
    case "missions-completed":
      return C.sources["missions-completed"](source.count);
    case "runs-won":
      return C.sources["runs-won"](source.count);
    case "career-mark":
      return C.sources["career-mark"];
    case "career-worlds":
      return C.sources["career-worlds"](source.count);
    case "season-feat":
      return C.sources["season-feat"];
  }
}

/** Count of owned items the player has not looked at yet (profile badge). */
export function useUnseenCosmetics(): number {
  const cosmetics = useProfileStore((s) => s.cosmetics);
  return unseenOwnedIds(cosmetics).length;
}

/** rc.4: the small green "something new here" dot (tabs, hero slots). */
export function NewDot({ className, label }: { className?: string; label?: string }) {
  return (
    <span
      className={cx("pointer-events-none block h-2 w-2 rounded-full bg-good shadow-[0_0_0_2px_var(--bg-raised),0_0_8px_rgba(74,222,128,0.6)]", className)}
      role={label ? "status" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}

export function CosmeticsLockerModal({
  open,
  kind: initialKind,
  onClose,
}: {
  open: boolean;
  kind: CosmeticKind;
  onClose: () => void;
}) {
  const { COSMETICS: C } = useCopy();
  const copy = useCosmeticCopy();
  const cosmetics = useProfileStore((s) => s.cosmetics);
  const setEquipped = useProfileStore((s) => s.setEquipped);
  const markSeen = useProfileStore((s) => s.markCosmeticsSeen);
  const [kind, setKind] = useState<CosmeticKind>(initialKind);
  // Follow the slot the player tapped each time the modal opens.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setKind(initialKind);
  }
  // Captured once per mount (render must stay pure); "NEW" = owned under a week.
  const [now] = useState(() => Date.now());
  const resolved = resolveEquipped(cosmetics);
  const { owned, locked } = lockerItems(cosmetics.owned, kind);
  const shownIds = new Set(kind === "badge" ? resolved.badges.map((b) => b.id) : [resolved[kind]?.id].filter(Boolean));
  const featuredId = resolved.badges[0]?.id ?? null;
  const unseen = new Set(unseenOwnedIds(cosmetics));
  const isNew = (id: string) => unseen.has(id) || now - Date.parse(cosmetics.owned[id] ?? "") < 7 * 86_400_000;

  // Looking at a tab = seeing its items (the dots on the tab and the hero go).
  useEffect(() => {
    if (!open) return;
    const ids = owned.map((c) => c.id).filter((id) => unseen.has(id));
    if (ids.length) markSeen(ids);
    // `owned`/`unseen` are derived from the store on every render; the effect
    // only needs to re-run when the tab or the store changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, kind, cosmetics.owned, markSeen]);

  const equippedBadges = resolved.badges.map((b) => b.id);

  const choose = (def: CosmeticDef) => {
    sfx.click();
    if (def.kind === "badge") {
      const current = equippedBadges;
      let next: string[];
      if (current.includes(def.id)) next = current.filter((id) => id !== def.id);
      // Full: the newcomer takes the LAST slot, so the featured badge stays put.
      else if (current.length >= MAX_BADGES) next = [...current.slice(0, MAX_BADGES - 1), def.id];
      else next = [...current, def.id];
      setEquipped({ badges: next });
    } else if (shownIds.has(def.id)) {
      setEquipped({ [def.kind]: null });
    } else {
      setEquipped({ [def.kind]: def.id });
    }
  };

  const feature = (id: string) => {
    if (id === featuredId) return;
    sfx.click();
    setEquipped({ badges: featureBadge(equippedBadges, id) });
  };

  const clearSlot = () => {
    sfx.click();
    if (kind === "badge") setEquipped({ badges: [] });
    else setEquipped({ [kind]: null });
  };

  return (
    <Modal open={open} title={C.locker} onClose={onClose} wide>
      <div className="-mx-1 mb-3 flex flex-wrap items-center gap-1" role="tablist">
        {LOCKER_KINDS.map((k) => {
          const items = lockerItems(cosmetics.owned, k);
          const have = items.owned.length;
          const total = have + items.locked.length;
          const fresh = unseenOfKind(cosmetics, k).length > 0;
          return (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={kind === k}
              onClick={() => {
                sfx.click();
                setKind(k);
              }}
              className={cx(
                "display relative rounded-md px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-colors",
                kind === k ? "bg-orange/15 text-orange-bright" : "text-sub hover:text-ink",
              )}
            >
              {C.kindsPlural[k]} <span className="text-faint">{have}/{total}</span>
              {fresh ? <NewDot className="absolute -right-0.5 -top-0.5" label={C.newItems} /> : null}
            </button>
          );
        })}
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-sub">
        <span>{kind === "badge" ? C.badgesHint(MAX_BADGES) : C.kindHint[kind]}</span>
        {(kind === "badge" ? resolved.badges.length > 0 : resolved[kind]) ? (
          <button type="button" onClick={clearSlot} className="font-semibold text-faint underline-offset-4 hover:text-ink hover:underline">
            {C.unequip}
          </button>
        ) : null}
      </div>

      {kind === "badge" ? (
        <div className="mb-4 rounded-xl border border-line bg-white/[0.02] p-3">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <p className="kicker !text-[10px]">{C.showcase}</p>
            {resolved.badges.length > 1 ? <p className="text-[11px] text-faint">{C.featureHint}</p> : null}
          </div>
          <div className="flex items-end gap-3 pt-2">
            {Array.from({ length: MAX_BADGES }, (_, i) => {
              const b = resolved.badges[i];
              const isFeatured = i === 0;
              if (!b) {
                return (
                  <span
                    key={`empty-${i}`}
                    className={cx(
                      "flex flex-col items-center justify-center rounded-lg border border-dashed border-line-strong text-[10px] font-semibold uppercase tracking-wider text-faint",
                      isFeatured ? "h-[88px] w-[88px]" : "h-16 w-16",
                    )}
                  >
                    {C.emptySlot}
                  </span>
                );
              }
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => feature(b.id)}
                  title={isFeatured ? copy.name(b.id) : `${C.feature} · ${copy.name(b.id)}`}
                  aria-pressed={isFeatured}
                  className={cx(
                    "group relative flex flex-col items-center justify-center rounded-lg border transition-colors",
                    isFeatured ? "h-[88px] w-[88px] border-amber-300/50 bg-amber-300/[0.06]" : "h-16 w-16 border-line hover:border-amber-300/40",
                  )}
                >
                  <BadgeEmblem badge={b} size={isFeatured ? "xl" : "md"} />
                  {isFeatured ? (
                    <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap">
                      <Badge tone="gold" className="!bg-[#1a1405] !px-1.5 !py-0 !text-[9px]">
                        ★ {C.featured}
                      </Badge>
                    </span>
                  ) : (
                    <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                      <Badge tone="neutral" className="!bg-raised !px-1.5 !py-0 !text-[9px]">
                        ★ {C.feature}
                      </Badge>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {owned.map((def) => {
          const shown = shownIds.has(def.id);
          const featured = def.kind === "badge" && def.id === featuredId;
          return (
            <button
              key={def.id}
              type="button"
              onClick={() => choose(def)}
              title={`${copy.desc(def.id)}${copy.desc(def.id) ? " · " : ""}${sourceLabel(def.source, C)}`}
              className={cx(
                "group relative flex flex-col items-center gap-2 rounded-xl border bg-white/[0.03] p-3 text-center transition-colors hover:bg-white/[0.06]",
                TIER_RING[def.tier],
                shown && "ring-2 ring-orange/70",
              )}
            >
              <span className="flex h-20 items-center justify-center">
                <CosmeticArt def={def} size={def.kind === "badge" ? "xl" : "md"} />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-xs font-bold text-ink">{copy.name(def.id)}</span>
                <span className="block text-[10px]" style={{ color: TIER_ACCENT[def.tier] }}>
                  {copy.tier(def.tier)}
                </span>
              </span>
              <span className="absolute left-2 top-2 flex gap-1">
                {featured ? <Badge tone="gold">★ {C.featured}</Badge> : shown ? <Badge tone="orange">{C.equipped}</Badge> : null}
              </span>
              {isNew(def.id) ? (
                <span className="absolute right-2 top-2">
                  <Badge tone="good">{C.newTag}</Badge>
                </span>
              ) : null}
            </button>
          );
        })}
        {locked.map((def) => (
          <LockedTile key={def.id} tier={def.tier} label={C.locked} hint={C.lockedHint} tierLabel={copy.tier(def.tier)} />
        ))}
      </div>
      {owned.length === 0 && locked.length === 0 ? <p className="py-6 text-center text-sm text-faint">{C.empty}</p> : null}
    </Modal>
  );
}

/** A locked slot: the collection's silhouette treatment — rarity, no spoiler. */
function LockedTile({ tier, label, hint, tierLabel }: { tier: CosmeticDef["tier"]; label: string; hint: string; tierLabel: string }) {
  return (
    <div className="relative flex flex-col items-center gap-2 rounded-xl border border-dashed border-line bg-white/[0.015] p-3 text-center" title={hint}>
      <span className="flex h-20 w-full items-center justify-center">
        <span
          className="flex h-14 w-14 items-center justify-center rounded-full border border-line-strong bg-[radial-gradient(circle_at_50%_35%,rgba(255,255,255,0.06),transparent_70%)] text-faint"
          style={{ boxShadow: `inset 0 0 0 1px ${TIER_ACCENT[tier]}22` }}
          aria-hidden
        >
          <LockGlyph />
        </span>
      </span>
      <span className="min-w-0">
        <span className="block truncate text-xs font-bold text-faint">{label}</span>
        <span className="block text-[10px]" style={{ color: TIER_ACCENT[tier] }}>
          {tierLabel}
        </span>
      </span>
    </div>
  );
}

function LockGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

/** Ids the hero / profile can show a dot for: unseen owned items of one kind. */
export function useUnseenOfKind(kind: CosmeticKind): boolean {
  const cosmetics = useProfileStore((s) => s.cosmetics);
  return unseenOfKind(cosmetics, kind).some((id) => cosmeticById.has(id));
}
