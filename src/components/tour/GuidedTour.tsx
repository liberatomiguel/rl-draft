"use client";

/**
 * Guided tour (T1, v2.0): a step-by-step walkthrough that spotlights the REAL
 * element on the screen and explains it in a card beside it, with Next, Back
 * and Skip. Used by Road to Worlds (`CareerTour`) and the draft (`DraftTour`).
 *
 * - A step names its element by a `data-tour` token. The first VISIBLE match
 *   wins, so a desktop bar and its phone twin can share a token. A step with
 *   no target, or whose element is not on the screen, shows a centred card.
 * - The dim is the spotlight's own box-shadow (one element, no SVG mask), and
 *   a transparent layer under it swallows clicks: the page is shown, not used.
 * - The frame loop re-reads the element's box while the tour is open, so the
 *   spotlight follows scrolling, resizes, late layout and entrance animations.
 * - Rendered in a portal on <body> (animated ancestors re-anchor `fixed`).
 * - NO motion (rc.54, Miguel): the dim, the spotlight and the card appear in
 *   place and jump from step to step. Nothing transitions, fades or pulses, and
 *   the page scrolls to a step's element instantly. The first measure runs in a
 *   layout effect, so the very first painted frame is already the final one.
 *   (Before: the spotlight grew out of a zero-size box at the centre of the
 *   screen and the card slid in from the top-left corner, because both started
 *   at their unmeasured placeholder position with a CSS transition on
 *   top / left / width / height.)
 * - Closing it (Done or Skip) puts the page back at the top.
 * - 360 px: the card is the viewport's width minus a 12 px gutter, and docks
 *   to the bottom edge when the element leaves no room above or below.
 */

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/Button";
import { useDialogFocus } from "@/components/ui/dialog";
import { cx } from "@/lib/util";
import { useMounted } from "@/store/useMounted";
import { useOverlayHold } from "@/store/overlayHoldStore";

export type TourTone = "blue" | "orange" | "cyan" | "good";

export interface TourPoint {
  icon?: ReactNode;
  label: string;
  text?: string;
}

export interface TourStep {
  id: string;
  /** `data-tour` token of the element to spotlight; none = a centred card. */
  target?: string;
  tone?: TourTone;
  icon: ReactNode;
  title: string;
  body: string;
  /** Short key facts under the body: icon + label (+ a muted detail). */
  points?: TourPoint[];
  /** "grid" packs the points two per row (the tab directory). */
  pointsLayout?: "list" | "grid";
}

export interface TourLabels {
  next: string;
  back: string;
  skip: string;
  done: string;
  /** "2 of 8" — read with the kicker. */
  progress: (step: number, total: number) => string;
}

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

const TONES: Record<TourTone, { chip: string; text: string; bar: string; ring: string }> = {
  blue: { chip: "border-blue/40 bg-blue/10 text-blue-bright", text: "text-blue-bright", bar: "bg-blue-bright", ring: "var(--blue-bright)" },
  orange: { chip: "border-orange/40 bg-orange/10 text-orange-bright", text: "text-orange-bright", bar: "bg-orange", ring: "var(--orange-bright)" },
  cyan: { chip: "border-cyan/40 bg-cyan/10 text-cyan", text: "text-cyan", bar: "bg-cyan", ring: "var(--cyan)" },
  good: { chip: "border-good/40 bg-good/10 text-good", text: "text-good", bar: "bg-good", ring: "var(--good)" },
};

const GUTTER = 12;
const PAD = 6;
const CARD_MAX = 384;
/** The least of a tall element the spotlight keeps when it makes room for the card. */
const MIN_SPOT = 104;

/** The page back at the top, at once (`instant` also beats a CSS `scroll-behavior: smooth`). */
function scrollPageToTop(): void {
  window.scrollTo({ top: 0, left: 0, behavior: "instant" });
}

/** The first on-screen element carrying the token (a hidden twin is skipped). */
function findTarget(token: string | undefined): HTMLElement | null {
  if (!token) return null;
  for (const el of document.querySelectorAll<HTMLElement>(`[data-tour~="${token}"]`)) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}

/** Inside a sticky or fixed bar: it is already on screen, never scroll for it. */
function isPinned(el: HTMLElement): boolean {
  for (let node: HTMLElement | null = el; node && node !== document.body; node = node.parentElement) {
    const position = getComputedStyle(node).position;
    if (position === "fixed" || position === "sticky") return true;
  }
  return false;
}

/** How much of a tall element the spotlight shows, so the card still fits. */
const spotCap = (vh: number): number => Math.round(vh * (vh < 720 ? 0.34 : 0.48));

export function GuidedTour({
  steps,
  labels,
  kicker,
  topInset = 150,
  onClose,
}: {
  steps: TourStep[];
  labels: TourLabels;
  /** The chapter's name, shown above the title with the step count ("Training · 1 of 3"). */
  kicker: string;
  /** Height of the sticky bars above the page: a scrolled element lands below it. */
  topInset?: number;
  onClose: (reason: "done" | "skip") => void;
}) {
  const mounted = useMounted();
  // rc.54: a guide in front holds the quieter pop-ups (a reward unlock, the login
  // calendar) until it closes, so two dialogs never stack.
  useOverlayHold("intro", true);
  const [index, setIndex] = useState(0);
  const [spot, setSpot] = useState<Box | null>(null);
  const [card, setCard] = useState<{ top: number; left: number; width: number; caret: number | null; side: "below" | "above" | "dock" | "center" } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const scrolledFor = useRef<string | null>(null);
  const titleId = useId();
  const bodyId = useId();

  const step = steps[Math.min(index, steps.length - 1)];
  const last = index >= steps.length - 1;
  const tone = TONES[step?.tone ?? "blue"];

  // Done and Skip both leave the page at the top (the tour scrolled it to its
  // elements). Once now, and once after the caller's own re-render has landed
  // (the draft swaps its demo for the real board when the tour closes).
  const close = useCallback(
    (reason: "done" | "skip") => {
      onClose(reason);
      scrollPageToTop();
      requestAnimationFrame(scrollPageToTop);
    },
    [onClose],
  );
  const skip = useCallback(() => close("skip"), [close]);
  const next = useCallback(() => {
    if (last) close("done");
    else setIndex((i) => i + 1);
  }, [last, close]);
  const back = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  useDialogFocus(cardRef, mounted, { onEscape: skip });

  // Arrow keys step through; the page itself does not scroll under the tour
  // (wheel / touch / keys), only the card's own content does.
  useEffect(() => {
    if (!mounted) return;
    const inCard = (t: EventTarget | null) => t instanceof Node && cardRef.current?.contains(t) === true;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        back();
      } else if ([" ", "PageDown", "PageUp", "ArrowDown", "ArrowUp", "Home", "End"].includes(e.key) && !inCard(e.target)) {
        e.preventDefault();
      }
    };
    const onScrollIntent = (e: Event) => {
      if (!inCard(e.target)) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("wheel", onScrollIntent, { passive: false });
    window.addEventListener("touchmove", onScrollIntent, { passive: false });
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("wheel", onScrollIntent);
      window.removeEventListener("touchmove", onScrollIntent);
    };
  }, [mounted, next, back]);

  // The frame loop: find the element, bring it into view once per step, then
  // keep the spotlight and the card on it. A LAYOUT effect, and it measures
  // once before the loop starts: the tour (and every new step) is placed before
  // the browser paints, so nothing is ever seen at a placeholder position.
  useLayoutEffect(() => {
    if (!mounted || !step) return;
    let frame = 0;
    const measure = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const el = findTarget(step.target);
      const node = cardRef.current;
      const cardHeight = node?.offsetHeight ?? 0;

      let box: Box | null = null;
      if (el) {
        if (scrolledFor.current !== step.id) {
          scrolledFor.current = step.id;
          if (!isPinned(el)) {
            const r = el.getBoundingClientRect();
            const shown = Math.min(r.height, spotCap(vh));
            const room = vh - topInset - shown;
            // Sit the element in the upper part of the free area: the card goes below.
            const wantTop = topInset + Math.max(10, Math.min(48, room * 0.18));
            const delta = r.top - wantTop;
            if (Math.abs(delta) > 4) window.scrollBy({ top: delta, behavior: "instant" });
          }
        }
        const r = el.getBoundingClientRect();
        const top = Math.max(4, r.top - PAD);
        const left = Math.max(4, r.left - PAD);
        const right = Math.min(vw - 4, r.right + PAD);
        let bottom = Math.min(vh - 4, r.bottom + PAD, top + spotCap(vh) + PAD * 2);
        // A tall element with no room for the card above or below: show its top
        // part only, so the card sits under the spotlight instead of over it.
        const fitsBelow = vh - bottom - GUTTER >= cardHeight + 12;
        const fitsAbove = top - GUTTER >= cardHeight + 12;
        if (cardHeight > 0 && !fitsBelow && !fitsAbove) {
          bottom = Math.min(bottom, Math.max(top + MIN_SPOT, vh - GUTTER - cardHeight - 12));
        }
        if (right - left > 8 && bottom - top > 8) box = { top, left, width: right - left, height: bottom - top };
      } else if (!step.target) {
        scrolledFor.current = step.id;
      }

      setSpot((prev) =>
        prev === box || (prev && box && prev.top === box.top && prev.left === box.left && prev.width === box.width && prev.height === box.height)
          ? prev
          : box,
      );

      if (!node) return;
      const width = Math.min(CARD_MAX, vw - GUTTER * 2);
      const height = cardHeight;
      let top: number;
      let left: number;
      let caret: number | null = null;
      let side: "below" | "above" | "dock" | "center";
      if (!box) {
        side = "center";
        top = Math.max(GUTTER, (vh - height) / 2);
        left = (vw - width) / 2;
      } else {
        const centre = box.left + box.width / 2;
        left = Math.min(vw - width - GUTTER, Math.max(GUTTER, centre - width / 2));
        const below = vh - (box.top + box.height) - GUTTER;
        const above = box.top - GUTTER;
        if (below >= height + 12) {
          side = "below";
          top = box.top + box.height + 12;
        } else if (above >= height + 12) {
          side = "above";
          top = box.top - 12 - height;
        } else {
          side = "dock";
          top = vh - height - GUTTER;
        }
        if (side !== "dock") caret = Math.min(width - 28, Math.max(28, centre - left));
      }
      top = Math.round(top);
      left = Math.round(left);
      setCard((prev) =>
        prev && prev.top === top && prev.left === left && prev.width === width && prev.caret === caret && prev.side === side
          ? prev
          : { top, left, width, caret, side },
      );
    };
    const tick = () => {
      frame = requestAnimationFrame(tick);
      measure();
    };
    measure();
    frame = requestAnimationFrame(tick);
    // A throttled page (an embedded or background view) gets few frames: the
    // timer keeps the spotlight honest there too.
    const timer = window.setInterval(measure, 200);
    return () => {
      cancelAnimationFrame(frame);
      window.clearInterval(timer);
    };
  }, [mounted, step, topInset]);

  if (!mounted || !step) return null;

  // No element: a zero-size spotlight at the centre, so its shadow dims it all.
  const spotStyle: CSSProperties = spot
    ? { top: spot.top, left: spot.left, width: spot.width, height: spot.height }
    : { top: "50%", left: "50%", width: 0, height: 0 };

  return createPortal(
    <div className="fixed inset-0 z-[90]" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={bodyId}>
      {/* Click shield: the page under the tour is shown, not used. */}
      <div className="absolute inset-0" aria-hidden />

      {/* Spotlight: the hole is this box, the dim its shadow. No transition: it is
          placed, never animated (see the header). */}
      <div
        aria-hidden
        className="pointer-events-none fixed rounded-xl shadow-[0_0_0_200vmax_rgba(4,7,14,0.76)]"
        style={spotStyle}
      />
      {spot ? (
        <div
          aria-hidden
          className="pointer-events-none fixed rounded-xl"
          style={{
            ...spotStyle,
            boxShadow: `0 0 0 2px ${tone.ring}, 0 0 0 6px color-mix(in srgb, ${tone.ring} 22%, transparent), 0 0 26px 2px color-mix(in srgb, ${tone.ring} 45%, transparent)`,
          }}
        />
      ) : null}

      {/* The card. Measured and placed before the first paint; `opacity-0` (not
          `invisible`: it must stay focusable) only covers a card with no place yet. */}
      <div
        ref={cardRef}
        tabIndex={-1}
        className={cx(
          "panel-strong fixed flex max-h-[calc(100dvh-1.5rem)] flex-col p-4 shadow-[0_18px_60px_rgba(0,0,0,0.6)] outline-none sm:p-5",
          card ? "opacity-100" : "opacity-0",
        )}
        style={{ top: card?.top ?? 0, left: card?.left ?? 0, width: card?.width ?? `min(${CARD_MAX}px, calc(100vw - ${GUTTER * 2}px))` }}
      >
        {card?.caret != null ? (
          <span
            aria-hidden
            className={cx(
              "absolute h-3 w-3 rotate-45 border-line-strong bg-[#141d33]",
              card.side === "below" ? "-top-1.5 border-l border-t" : "-bottom-1.5 border-b border-r bg-[#0d1424]",
            )}
            style={{ left: card.caret - 6 }}
          />
        ) : null}

        <div className="flex shrink-0 items-start gap-3">
          <span className={cx("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border", tone.chip)}>
            {step.icon}
          </span>
          <div className="min-w-0 flex-1">
            <p className={cx("kicker flex min-w-0 text-[10px]", tone.text)}>
              <span className="truncate">{kicker}</span>
              <span className="shrink-0 whitespace-pre text-faint"> · {labels.progress(index + 1, steps.length)}</span>
            </p>
            <h3 id={titleId} className="display mt-0.5 text-lg font-bold uppercase leading-tight tracking-wide text-ink">
              {step.title}
            </h3>
          </div>
          <button
            type="button"
            onClick={skip}
            className="-mr-1 -mt-1 shrink-0 rounded-md px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-faint transition-colors hover:bg-white/5 hover:text-ink"
          >
            {labels.skip}
          </button>
        </div>

        <div className="-mr-2 mt-3 min-h-0 overflow-y-auto pr-2" aria-live="polite">
          <p id={bodyId} className="text-sm leading-relaxed text-sub">
            {step.body}
          </p>
          {step.points?.length ? (
            <ul className={cx("mt-3 grid gap-1.5", step.pointsLayout === "grid" ? "grid-cols-2" : "grid-cols-1")}>
              {step.points.map((point) => (
                <li
                  key={point.label}
                  className="flex min-w-0 items-center gap-2 rounded-lg border border-line bg-white/[0.03] px-2.5 py-1.5"
                >
                  {point.icon ? <span className={cx("shrink-0", tone.text)}>{point.icon}</span> : null}
                  <span className="min-w-0 leading-tight">
                    <span className="block truncate text-xs font-semibold text-ink">{point.label}</span>
                    {point.text ? <span className="block text-[11px] leading-snug text-faint">{point.text}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="mt-4 flex shrink-0 items-center gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-1" aria-hidden>
            {steps.map((s, i) => (
              <span
                key={s.id}
                className={cx(
                  "h-1 max-w-7 flex-1 rounded-full",
                  i === index ? tone.bar : i < index ? "bg-white/35" : "bg-white/12",
                )}
              />
            ))}
          </div>
          {index > 0 ? (
            <Button variant="ghost" size="sm" onClick={back}>
              {labels.back}
            </Button>
          ) : null}
          <Button variant="primary" size="sm" onClick={next} autoFocus>
            {last ? labels.done : labels.next}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
