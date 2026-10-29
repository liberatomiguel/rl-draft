"use client";

/**
 * AppLink — drop-in replacement for next/link's <Link> with INTENT-ONLY prefetch.
 *
 * Why: Next 16 prefetches every <Link> that scrolls into the viewport. In the
 * static export each prefetched route costs ~5 requests (HEAD + 4 segment .txt
 * files) and is re-fetched once the 5-minute client cache goes stale; it was
 * the largest request multiplier on the site (cold home 80 → 25 requests with
 * prefetch off). See node_modules/next/dist/docs/01-app/02-guides/prefetching.md
 * ("Hover-triggered prefetch").
 *
 * Behaviour:
 * - Renders with `prefetch={false}` (no viewport prefetch).
 * - Switches to `prefetch={null}` (Next's default "auto") once the user shows
 *   intent: a real MOUSE pointer moving over the link, or KEYBOARD focus. A
 *   link that slides under a resting cursor (the page scrolls, a dialog
 *   closes) gets pointer events with zero movement: not intent (rc.32,
 *   WEB-02 — one such accidental prefetch cost a run 8 requests). The
 *   re-render re-registers the link with Next's visibility observer, which
 *   finds it on screen and prefetches it (later hovers also bump it to intent
 *   priority). The switch is sticky for the life of this link.
 * - Touch never triggers it (no touchstart, and the emulated pointer/mouse/
 *   focus events a tap produces are ignored), so a tap does not race a prefetch
 *   against the navigation: a click on a non-prefetched route fetches a single
 *   small `<route>.txt`. This is why intent is read from `pointerType` and
 *   `:focus-visible` instead of plain onMouseEnter/onFocus, which mobile
 *   browsers also fire on tap.
 * - An explicit `prefetch` prop from the caller (including `null`) always wins.
 *
 * All other props (href, className, aria-*, title, onClick, onMouseEnter,
 * onPointerEnter, scroll, replace, ref, children…) are forwarded unchanged,
 * and the caller's onPointerMove / onFocus handlers are still called.
 */

import Link from "next/link";
import { useState, type ComponentProps } from "react";

export type AppLinkProps = ComponentProps<typeof Link>;

/** True for keyboard focus; false for focus that came from a click or tap. */
function isKeyboardFocus(el: Element): boolean {
  try {
    return el.matches(":focus-visible");
  } catch {
    // Browser without :focus-visible support — treat focus as intent.
    return true;
  }
}

/** A mouse pointer that really moved: the browser's own pointer events for a
 *  link that slid under a resting cursor carry no movement. */
export function isMouseIntent(e: { pointerType: string; movementX: number; movementY: number }): boolean {
  return e.pointerType === "mouse" && (e.movementX !== 0 || e.movementY !== 0);
}

export function AppLink({ prefetch, onPointerMove, onFocus, ...rest }: AppLinkProps) {
  const [intent, setIntent] = useState(false);

  return (
    <Link
      {...rest}
      prefetch={prefetch !== undefined ? prefetch : intent ? null : false}
      onPointerMove={(e) => {
        onPointerMove?.(e);
        if (!intent && isMouseIntent(e)) setIntent(true);
      }}
      onFocus={(e) => {
        onFocus?.(e);
        if (!intent && isKeyboardFocus(e.currentTarget)) setIntent(true);
      }}
    />
  );
}
