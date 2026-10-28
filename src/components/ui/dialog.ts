"use client";

/**
 * Dialog plumbing shared by every overlay (rc.29, E2E DRAFT-04/06/07/13): the
 * Modal, the results ceremonies, the cosmetic unlock pop-up and the first-run
 * tour.
 *
 *  - `lockPageScroll` / `usePageScrollLock`: a ref-counted body scroll lock
 *    that does not move the page. `html { scrollbar-gutter: stable }`
 *    (globals.css) keeps the scrollbar's space reserved while it is hidden, so
 *    the sticky header, the fixed bars and the centred content stay put; a
 *    browser without scrollbar-gutter gets the lost width back as body padding.
 *    The reserved gutter lies outside every fixed overlay, so while locked the
 *    canvas it shows is dimmed with the scrims (review R3).
 *    Overlapping owners (a Modal over a ceremony) release in any order.
 *  - `useDialogFocus`: the focus moves into the dialog on open, Tab and
 *    Shift+Tab stay inside it, Escape (and optionally Enter) reach only the
 *    TOPMOST dialog, and the focus goes back to whatever opened it on close.
 */

import { useEffect, useEffectEvent, type RefObject } from "react";

// ---------------------------------------------------------------------------
// Scroll lock
// ---------------------------------------------------------------------------

let lockCount = 0;
let saved: { overflow: string; paddingRight: string; backgroundColor: string } | null = null;

/** The canvas under a locked page (globals.css `--bg-dimmed`). */
export const DIMMED_CANVAS = "var(--bg-dimmed)";

/** Lock the page scroll; returns the release (idempotent). */
export function lockPageScroll(doc: Document = document): () => void {
  const body = doc.body;
  if (lockCount === 0) {
    saved = {
      overflow: body.style.overflow,
      paddingRight: body.style.paddingRight,
      backgroundColor: body.style.backgroundColor,
    };
    // The body's own width, not the root's clientWidth: with the gutter
    // reserved, Chrome reports the root at full width once the scrollbar is
    // hidden, though the layout keeps the gutter.
    const before = body.clientWidth;
    body.style.overflow = "hidden";
    // With scrollbar-gutter the width does not change. Without it the
    // scrollbar just went away: give its width back so nothing shifts.
    const gained = body.clientWidth - before;
    if (gained > 0) {
      const pad = Number.parseFloat(doc.defaultView?.getComputedStyle(body).paddingRight ?? "") || 0;
      body.style.paddingRight = `${pad + gained}px`;
    }
    // A gutter left reserved (classic scrollbars) lies outside every fixed
    // overlay, so it shows the canvas: a strip of undimmed page at the window's
    // edge (review R3). The canvas is the body's background (propagated), so
    // dim that while locked. On <body>, never on <html>: an <html> background
    // would stop the propagation and hide the ambient glow (body::before).
    // Overlay scrollbars and the padding fallback leave no gutter: no change.
    const viewport = doc.defaultView?.innerWidth ?? 0;
    if (viewport - body.clientWidth > 1) body.style.backgroundColor = DIMMED_CANVAS;
  }
  lockCount += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    lockCount -= 1;
    if (lockCount === 0 && saved) {
      body.style.overflow = saved.overflow;
      body.style.paddingRight = saved.paddingRight;
      body.style.backgroundColor = saved.backgroundColor;
      saved = null;
    }
  };
}

/** Lock the page scroll while `active`. */
export function usePageScrollLock(active: boolean): void {
  useEffect(() => (active ? lockPageScroll() : undefined), [active]);
}

// ---------------------------------------------------------------------------
// Focus: initial focus, Tab trap, topmost-only keys, restore on close
// ---------------------------------------------------------------------------

/** Open dialogs, oldest first: only the last one reacts to keys and focus. */
const openDialogs: object[] = [];

export function pushDialog(el: object): void {
  openDialogs.push(el);
}

export function popDialog(el: object): void {
  const i = openDialogs.lastIndexOf(el);
  if (i !== -1) openDialogs.splice(i, 1);
}

export function isTopDialog(el: object): boolean {
  return openDialogs.length > 0 && openDialogs[openDialogs.length - 1] === el;
}

/**
 * Where Tab (or Shift+Tab with `back`) sends the focus inside a dialog with
 * `count` focusable elements. `current` is the focused element's index in
 * that list: -1 when the dialog itself holds the focus, -2 when it is outside.
 * Returns the index to focus (-1 = the dialog itself), or null to let the
 * browser move normally.
 */
export function nextTrapIndex(current: number, count: number, back: boolean): number | null {
  if (count === 0) return -1;
  if (back) return current <= 0 ? count - 1 : null;
  if (current === -2 || current >= count - 1) return 0;
  return null;
}

/** Elements that handle Enter themselves (a native click, a newline, a submit). */
export function handlesEnter(target: EventTarget | null): boolean {
  const el = target as { closest?: (selector: string) => unknown } | null;
  return typeof el?.closest === "function" && Boolean(el.closest("button, a[href], input, select, textarea, summary, [role='button'], [contenteditable='true']"));
}

const FOCUSABLE =
  "a[href], area[href], button:not([disabled]), input:not([disabled]):not([type='hidden']), select:not([disabled]), textarea:not([disabled]), iframe, [contenteditable='true'], [tabindex]:not([tabindex='-1'])";

function focusableIn(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.tabIndex >= 0 && el.getClientRects().length > 0,
  );
}

export interface DialogKeys {
  /** Escape on the topmost dialog. */
  onEscape?: () => void;
  /** Enter on the topmost dialog, unless a button / link / field has the focus. */
  onEnter?: () => void;
}

/**
 * Dialog focus handling for `ref` (the element that holds the dialog's
 * content; give it `tabIndex={-1}`) while `active`.
 */
export function useDialogFocus(ref: RefObject<HTMLElement | null>, active: boolean, keys: DialogKeys = {}): void {
  const escape = useEffectEvent(() => keys.onEscape?.());
  const enter = useEffectEvent(() => keys.onEnter?.());

  useEffect(() => {
    const root = ref.current;
    if (!active || !root) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    pushDialog(root);
    // A child with autoFocus keeps it; otherwise the dialog takes the focus.
    if (!root.contains(document.activeElement)) root.focus({ preventScroll: true });

    const onKeyDown = (e: KeyboardEvent) => {
      if (!isTopDialog(root) || e.defaultPrevented) return;
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        escape();
      } else if (e.key === "Enter") {
        if (!e.repeat && !handlesEnter(e.target)) enter();
      } else if (e.key === "Tab") {
        const items = focusableIn(root);
        const focused = document.activeElement;
        const current =
          focused === root ? -1 : focused instanceof HTMLElement && root.contains(focused) ? items.indexOf(focused) : -2;
        const next = nextTrapIndex(current, items.length, e.shiftKey);
        if (next === null) return;
        e.preventDefault();
        (next === -1 ? root : items[next]).focus();
      }
    };
    // Focus that wanders behind the dialog (a script, a stray click) comes back.
    const onFocusIn = (e: FocusEvent) => {
      if (isTopDialog(root) && e.target instanceof Node && !root.contains(e.target)) root.focus({ preventScroll: true });
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("focusin", onFocusIn);
      popDialog(root);
      // Back to the opener — unless the focus has already moved on (to another
      // dialog, say). A removed dialog leaves the focus on <body>.
      const now = document.activeElement;
      const lost = !now || now === document.body || root.contains(now);
      if (lost && opener && opener.isConnected) opener.focus({ preventScroll: true });
    };
  }, [ref, active]);
}
