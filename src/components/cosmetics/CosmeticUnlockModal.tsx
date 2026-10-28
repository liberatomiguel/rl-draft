"use client";

/**
 * Cosmetic unlock pop-up (rc.20): the moment a title, badge or banner is
 * earned, it gets its own beat — the same ceremony language as a special
 * card reveal (burst, ring, float), the item at full size, its rarity, a
 * short description, how it was earned, and a one-tap "wear it now".
 *
 * Reads `useCosmeticUnlocks` (fed by profileStore) and shows one item at a
 * time. It waits while the login modal is up and, since rc.29, while an
 * overlay hold is active (`overlayHoldStore`): a Draft tournament in progress,
 * a challenge series playing, the run ceremonies (special reveal, rank-up,
 * Legacy unlock), the first-run tour. Unlocks earned mid-tournament queue up
 * and appear after the results ceremonies (E2E DRAFT-02).
 */

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cosmeticById, type CosmeticDef } from "@/data/cosmetics";
import { addBadge, MAX_BADGES, resolveEquipped } from "@/engine/cosmetics";
import { useCopy } from "@/content/copy";
import { cx } from "@/lib/util";
import { sfx } from "@/lib/sfx";
import { useAccountStore } from "@/store/accountStore";
import { useCosmeticUnlocks } from "@/store/cosmeticUnlockStore";
import { useMounted } from "@/store/useMounted";
import { selectHeld, useOverlayHolds, useSettled } from "@/store/overlayHoldStore";
import { useProfileStore } from "@/store/profileStore";
import { useRewardToasts } from "@/store/rewardToastStore";
import { Button } from "@/components/ui/Button";
import { useDialogFocus, usePageScrollLock } from "@/components/ui/dialog";
import { BadgeEmblem, BannerSurface, TIER_ACCENT, TitleTag, useCosmeticCopy } from "./CosmeticViews";
import { sourceLabel } from "./CosmeticsLocker";

const TIER_RING: Record<CosmeticDef["tier"], string> = {
  common: "rgba(148, 163, 184, 0.45)",
  uncommon: "rgba(159, 227, 184, 0.5)",
  rare: "rgba(96, 165, 250, 0.55)",
  epic: "rgba(192, 132, 252, 0.6)",
  legend: "rgba(252, 211, 77, 0.7)",
};

export function CosmeticUnlockModal() {
  const mounted = useMounted();
  const { COSMETICS: C } = useCopy();
  const copy = useCosmeticCopy();
  const queue = useCosmeticUnlocks((s) => s.queue);
  const shift = useCosmeticUnlocks((s) => s.shift);
  const loginOpen = useRewardToasts((s) => !!s.loginModal);
  const held = useOverlayHolds(selectHeld);
  const cosmetics = useProfileStore((s) => s.cosmetics);
  const setEquipped = useProfileStore((s) => s.setEquipped);
  const nickname = useAccountStore((s) => s.username);
  // "i of n" for a batch: n grows while items keep arriving; reset on the last.
  const [batch, setBatch] = useState({ done: 0, total: 0 });
  const total = Math.max(batch.total, batch.done + queue.length);
  const id = queue[0];
  const def = id ? cosmeticById.get(id) : undefined;
  const defId = def?.id ?? null;
  // Ready, and still ready a frame later (see `useSettled`).
  const visible = useSettled(mounted && !!def && !loginOpen && !held);
  const rootRef = useRef<HTMLDivElement>(null);

  // An id the catalog no longer knows would block the queue (and the results
  // XP count-up waiting for it) forever: drop it.
  useEffect(() => {
    if (id && !def) shift();
  }, [id, def, shift]);

  // One sting per item, once it is actually on screen.
  useEffect(() => {
    if (defId && visible) sfx.unlock();
  }, [defId, visible]);

  const next = () => {
    setBatch((b) => (queue.length <= 1 ? { done: 0, total: 0 } : { done: b.done + 1, total: Math.max(b.total, b.done + queue.length) }));
    shift();
  };

  usePageScrollLock(visible);
  useDialogFocus(rootRef, visible, { onEscape: next });

  if (!visible || !def) return null;

  const resolved = resolveEquipped(cosmetics);
  const worn = def.kind === "badge" ? resolved.badges.some((b) => b.id === def.id) : resolved[def.kind]?.id === def.id;
  const slotsFull = def.kind === "badge" && !worn && resolved.badges.length >= MAX_BADGES;
  const equip = () => {
    sfx.pick();
    if (def.kind === "badge") setEquipped({ badges: addBadge(resolved.badges.map((b) => b.id), def.id) });
    else setEquipped({ [def.kind]: def.id });
  };
  const done = batch.done;
  const last = queue.length <= 1;

  return createPortal(
    <div
      ref={rootRef}
      tabIndex={-1}
      style={{ outline: "none" }}
      className="fixed inset-0 z-[58] flex items-center justify-center overflow-y-auto overscroll-contain bg-black/85 p-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={C.unlockKicker}
    >
      <div key={def.id} className="rise-in flex w-full max-w-sm flex-col items-center gap-5 text-center">
        <div>
          <p className="kicker text-orange-bright">{C.unlockKicker}</p>
          <p className="display mt-1 text-2xl font-bold uppercase tracking-wide text-ink md:text-3xl">{C.unlockKind[def.kind]}</p>
        </div>

        <div className="ceremony-burst relative">
          <span className="ceremony-ring" aria-hidden style={{ borderColor: TIER_RING[def.tier] }} />
          <div className="card-float flex items-center justify-center">
            <UnlockArt def={def} name={nickname} />
          </div>
        </div>

        <div className="w-full">
          <p className="display text-xl font-bold uppercase tracking-wide text-ink">{copy.name(def.id)}</p>
          <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: TIER_ACCENT[def.tier] }}>
            {copy.tier(def.tier)} · {copy.kind(def.kind)}
          </p>
          {copy.desc(def.id) ? <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-sub">{copy.desc(def.id)}</p> : null}
          <p className="mt-3 text-[11px] text-faint">
            <span className="uppercase tracking-wider">{C.unlockHow}</span> · {sourceLabel(def.source, C)}
          </p>
        </div>

        <div className="flex w-full flex-col items-center gap-2">
          <div className="flex flex-wrap items-center justify-center gap-2">
            {worn ? (
              <Button variant="ghost" disabled>
                ✓ {C.unlockEquipped}
              </Button>
            ) : (
              <Button variant="primary" onClick={equip} disabled={slotsFull} title={slotsFull ? C.unlockSlotsFull : undefined}>
                {C.unlockEquip}
              </Button>
            )}
            <Button variant={worn ? "primary" : "ghost"} onClick={next}>
              {last ? C.unlockContinue : C.unlockNext}
            </Button>
          </div>
          {slotsFull ? <p className="text-[11px] text-faint">{C.unlockSlotsFull}</p> : null}
          {total > 1 ? <p className="text-[11px] text-faint">{C.unlockCount(done + 1, total)}</p> : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** The item at ceremony size: a badge with its effects, a banner as a wide
 *  hero strip wearing the player's name, a title at its large size. */
function UnlockArt({ def, name }: { def: CosmeticDef; name: string | null }) {
  const { COSMETICS: C } = useCopy();
  if (def.kind === "badge") return <BadgeEmblem badge={def} size={128} />;
  if (def.kind === "title") {
    return (
      <span className="inline-flex items-center justify-center px-2 py-4">
        <TitleTag title={def} size="xl" />
      </span>
    );
  }
  return (
    <BannerSurface banner={def} glow displayPx={400} className={cx("w-[min(20rem,calc(100vw-4rem))] rounded-2xl border", "border-line-strong")}>
      <div className="flex h-28 flex-col justify-end p-4 text-left">
        <p className="kicker !text-[9px]">{C.kinds.banner}</p>
        <p className="display truncate text-lg font-bold uppercase tracking-wide text-ink">{name ?? "Rocket Draft"}</p>
      </div>
    </BannerSurface>
  );
}
