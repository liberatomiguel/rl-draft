"use client";

/**
 * Phone only (mobile redesign, stages 3 and 4): a section that opens on demand.
 *
 * The career's screens on a phone were the desktop dashboards stacked (HQ was
 * 7.5 screens). The rule is "summary first, detail on demand": the part of a
 * screen that is its job stays open, and every secondary board shows its head
 * alone (the title and the one figure the head already carries) until the
 * player opens it. Nothing is removed: the board is the same component,
 * mounted as before, and the rules live in globals.css (`.phone-fold`): when
 * closed, whatever follows the board's head is hidden. From 640px the fold
 * does nothing and the toggle is off.
 *
 * The board's head must be a `.card-head` or carry `phone-fold-head`. Wrap a
 * `<Panel>` in it, or give it the board's own classes (HQ's rail sections).
 */

import { useState } from "react";
import { cx } from "@/lib/util";

export function PhoneFold({
  label,
  className,
  children,
  ...rest
}: {
  /** The section's name, for the toggle. */
  label: string;
  className?: string;
  children: React.ReactNode;
} & Omit<React.HTMLAttributes<HTMLDivElement>, "className" | "children" | "onClick">) {
  const [open, setOpen] = useState(false);
  return (
    <div
      {...rest}
      data-open={open}
      className={cx("phone-fold relative", className)}
      // A tap on the head opens it too (the button is the keyboard's way in).
      onClick={(e) => {
        if (window.matchMedia("(min-width: 640px)").matches) return;
        const target = e.target as HTMLElement;
        if (target.closest("a, button, input, select, [role='tab']")) return;
        if (target.closest(".card-head, .phone-fold-head")) setOpen((o) => !o);
      }}
    >
      {children}
      <button
        type="button"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((o) => !o)}
        className="phone-fold-toggle absolute right-0 top-0 flex h-12 w-11 items-center justify-center text-sub sm:hidden"
      >
        <svg
          viewBox="0 0 24 24"
          className={cx("h-4 w-4 transition-transform", open && "rotate-180")}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden
        >
          <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}
