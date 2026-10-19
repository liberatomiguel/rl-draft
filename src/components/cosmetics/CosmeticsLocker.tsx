"use client";

/**
 * Locker (v2.0, rebuilt rc.2): a MODAL that opens on the slot the player tapped
 * in the profile hero. One tab per kind (avatar · frame · title · badges ·
 * banner). Owned items equip on tap (badges: up to three, toggled); items still
 * to earn show how; exclusive items the player does not own are hidden (they
 * cannot be earned any more). No auto mode: a slot is a choice or empty.
 * Opening a tab marks its owned items as seen (clears the "new" count).
 */

import { useEffect, useState } from "react";
import { RANKS } from "@/config/balance";
import { SEASON } from "@/config/season";
import { COSMETICS, type CosmeticDef, type CosmeticKind, type CosmeticSource } from "@/data/cosmetics";
import { lockerItems, MAX_BADGES, resolveEquipped, unseenOwnedIds } from "@/engine/cosmetics";
import { useCopy } from "@/content/copy";
import { cx } from "@/lib/util";
import { sfx } from "@/lib/sfx";
import { useProfileStore } from "@/store/profileStore";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { CosmeticArt, TIER_ACCENT, TIER_RING, useCosmeticCopy } from "./CosmeticViews";

export const LOCKER_KINDS: CosmeticKind[] = ["avatar", "frame", "title", "badge", "banner"];

const rankLabel = (id: string): string => RANKS.find((r) => r.id === id)?.label ?? id;

export function sourceLabel(source: CosmeticSource, C: ReturnType<typeof useCopy>["COSMETICS"]): string {
  switch (source.type) {
    case "default":
      return C.sources.default;
    case "legacy-participation":
      return C.sources["legacy-participation"];
    case "legacy-rank":
      return C.sources["legacy-rank"](rankLabel(source.rankId));
    case "legacy-position":
      return C.sources["legacy-position"](source.maxPosition);
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
    case "career-mark":
      return C.sources["career-mark"];
  }
}

/** Count of owned items the player has not looked at yet (profile badge). */
export function useUnseenCosmetics(): number {
  const cosmetics = useProfileStore((s) => s.cosmetics);
  return unseenOwnedIds(cosmetics).length;
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
  const unseen = new Set(unseenOwnedIds(cosmetics));
  const isNew = (id: string) => unseen.has(id) || now - Date.parse(cosmetics.owned[id] ?? "") < 7 * 86_400_000;

  // Looking at a tab = seeing its items (the "new" count on the profile drops).
  useEffect(() => {
    if (!open) return;
    const ids = owned.map((c) => c.id).filter((id) => unseen.has(id));
    if (ids.length) markSeen(ids);
    // `owned`/`unseen` are derived from the store on every render; the effect
    // only needs to re-run when the tab or the store changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, kind, cosmetics.owned, markSeen]);

  const choose = (def: CosmeticDef) => {
    sfx.click();
    if (def.kind === "badge") {
      const current = cosmetics.equipped.badges ?? [];
      const next = current.includes(def.id) ? current.filter((id) => id !== def.id) : [...current, def.id].slice(-MAX_BADGES);
      setEquipped({ badges: next });
    } else if (shownIds.has(def.id) && def.kind !== "avatar") {
      setEquipped({ [def.kind]: null });
    } else {
      setEquipped({ [def.kind]: def.id });
    }
  };

  const clearSlot = () => {
    sfx.click();
    if (kind === "badge") setEquipped({ badges: [] });
    else setEquipped({ [kind]: null });
  };

  return (
    <Modal open={open} title={C.locker} onClose={onClose} wide>
      <div className="-mx-1 mb-3 flex flex-wrap items-center gap-1">
        {LOCKER_KINDS.map((k) => {
          const total = COSMETICS.filter((c) => c.kind === k && !c.exclusive).length + COSMETICS.filter((c) => c.kind === k && c.exclusive && cosmetics.owned[c.id]).length;
          const have = COSMETICS.filter((c) => c.kind === k && cosmetics.owned[c.id]).length;
          const fresh = COSMETICS.filter((c) => c.kind === k && unseen.has(c.id)).length;
          return (
            <button
              key={k}
              type="button"
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
              {fresh > 0 ? (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-good px-1 text-[9px] font-bold text-[#05140c]">
                  {fresh}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-sub">
        <span>{kind === "badge" ? C.badgesHint(MAX_BADGES) : C.kindHint[kind]}</span>
        {kind !== "avatar" && (kind === "badge" ? resolved.badges.length > 0 : resolved[kind]) ? (
          <button type="button" onClick={clearSlot} className="font-semibold text-faint underline-offset-4 hover:text-ink hover:underline">
            {C.unequip}
          </button>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {owned.map((def) => {
          const shown = shownIds.has(def.id);
          return (
            <button
              key={def.id}
              type="button"
              onClick={() => choose(def)}
              className={cx(
                "group relative flex flex-col items-center gap-2 rounded-xl border bg-white/[0.03] p-3 text-center transition-colors hover:bg-white/[0.06]",
                TIER_RING[def.tier],
                shown && "ring-2 ring-orange/70",
              )}
            >
              <span className="flex h-20 items-center justify-center">
                <CosmeticArt def={def} size="md" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-xs font-bold text-ink">{copy.name(def.id)}</span>
                <span className="block text-[10px]" style={{ color: TIER_ACCENT[def.tier] }}>
                  {copy.tier(def.tier)}
                </span>
              </span>
              <span className="absolute left-2 top-2 flex gap-1">
                {shown ? <Badge tone="orange">{C.equipped}</Badge> : null}
              </span>
              {isNew(def.id) && def.source.type !== "default" ? (
                <span className="absolute right-2 top-2">
                  <Badge tone="good">{C.newTag}</Badge>
                </span>
              ) : null}
            </button>
          );
        })}
        {locked.map((def) => (
          <div
            key={def.id}
            className="relative flex flex-col items-center gap-2 rounded-xl border border-line bg-white/[0.02] p-3 text-center"
            title={copy.desc(def.id)}
          >
            <span className="flex h-20 items-center justify-center opacity-35 saturate-50">
              <CosmeticArt def={def} size="md" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-xs font-bold text-sub">{copy.name(def.id)}</span>
              <span className="block text-[10px] leading-snug text-faint">{sourceLabel(def.source, C)}</span>
            </span>
            <span className="absolute right-2 top-2 text-faint" aria-hidden>
              <LockGlyph />
            </span>
          </div>
        ))}
      </div>
      {owned.length === 0 && locked.length === 0 ? <p className="py-6 text-center text-sm text-faint">{C.empty}</p> : null}
    </Modal>
  );
}

function LockGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}
