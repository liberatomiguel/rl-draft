/**
 * "Something new here" markers (rc.4 dot, rc.33 shared — COL-02c). The DOT goes
 * on the way in (a nav item, a tile, a tab, the locker button); the TAG goes on
 * the item itself (a card, a team page, a challenge). Both read the same "New"
 * state (engine/newItems), so outside and inside always agree. Light: no store,
 * no dataset — safe on the shared path (#142).
 */

import { cx } from "@/lib/util";

/** The small green dot (tabs, hero slots, nav items, tiles). */
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

/** The "NEW" pill on an item (same green as the dot). */
export function NewTag({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        "display pointer-events-none inline-flex items-center rounded-full border border-good/60 bg-[#0c2418] px-1.5 py-px text-[9px] font-bold uppercase leading-none tracking-[0.14em] text-good shadow-[0_0_10px_rgba(74,222,128,0.35)]",
        className,
      )}
    >
      {children}
    </span>
  );
}
