/**
 * rc.29 (E2E DRAFT-04 / DRAFT-06 / DRAFT-07): the shared dialog plumbing —
 * a scroll lock that never moves the page and survives overlapping owners,
 * the Tab trap, which keys reach a dialog, and the topmost-dialog stack.
 */

import { describe, expect, it } from "vitest";
import {
  DIMMED_CANVAS,
  handlesEnter,
  isTopDialog,
  lockPageScroll,
  nextTrapIndex,
  popDialog,
  pushDialog,
} from "./dialog";

/** A 1280 px window with a classic 15 px scrollbar that disappears under
 *  `overflow: hidden` unless the gutter is reserved (`scrollbar-gutter`);
 *  `overlayScrollbars` = a phone / default macOS (the scrollbar takes no room). */
function fakeDocument({ gutterReserved = false, bodyPadding = "0px", overlayScrollbars = false } = {}) {
  const style: Record<string, string> = { overflow: "", paddingRight: "", backgroundColor: "" };
  const doc = {
    body: {
      style,
      get clientWidth() {
        if (overlayScrollbars) return 1280;
        return style.overflow === "hidden" && !gutterReserved ? 1280 : 1265;
      },
    },
    // Chrome reports the root at full width under the lock even when the
    // gutter stays reserved — the lock must not trust it.
    documentElement: {
      get clientWidth() {
        return style.overflow === "hidden" || overlayScrollbars ? 1280 : 1265;
      },
    },
    defaultView: { innerWidth: 1280, getComputedStyle: () => ({ paddingRight: bodyPadding }) },
  };
  return { doc: doc as unknown as Document, style };
}

describe("lockPageScroll", () => {
  it("gives the vanished scrollbar's width back as body padding (no sideways jump)", () => {
    const { doc, style } = fakeDocument();
    const release = lockPageScroll(doc);
    expect(style.overflow).toBe("hidden");
    expect(style.paddingRight).toBe("15px");
    release();
    expect(style.overflow).toBe("");
    expect(style.paddingRight).toBe("");
  });

  it("adds nothing when scrollbar-gutter keeps the space reserved", () => {
    const { doc, style } = fakeDocument({ gutterReserved: true });
    const release = lockPageScroll(doc);
    expect(style.overflow).toBe("hidden");
    expect(style.paddingRight).toBe("");
    release();
    expect(style.overflow).toBe("");
  });

  it("stacks on an existing body padding", () => {
    const { doc, style } = fakeDocument({ bodyPadding: "8px" });
    const release = lockPageScroll(doc);
    expect(style.paddingRight).toBe("23px");
    release();
  });

  it("dims the reserved gutter with the scrims while locked, then gives the page its own colour back (review R3)", () => {
    // The gutter lies outside every fixed overlay and shows the canvas — the
    // body's background — so an undimmed strip stayed at the window's edge.
    const { doc, style } = fakeDocument({ gutterReserved: true });
    const modal = lockPageScroll(doc);
    const ceremony = lockPageScroll(doc);
    expect(style.backgroundColor).toBe(DIMMED_CANVAS);
    modal();
    expect(style.backgroundColor).toBe(DIMMED_CANVAS); // the ceremony still holds the lock
    ceremony();
    expect(style.backgroundColor).toBe("");
  });

  it("leaves the canvas alone when no gutter is left (the padding fallback, overlay scrollbars)", () => {
    for (const opts of [{}, { overlayScrollbars: true }]) {
      const { doc, style } = fakeDocument(opts);
      const release = lockPageScroll(doc);
      expect(style.backgroundColor).toBe("");
      release();
    }
  });

  it("is ref-counted: overlapping owners release in any order, the page unlocks after the last", () => {
    const { doc, style } = fakeDocument();
    style.overflow = "auto"; // whatever the page had before
    const modal = lockPageScroll(doc);
    const ceremony = lockPageScroll(doc);
    expect(style.paddingRight).toBe("15px"); // measured once, not doubled
    modal();
    expect(style.overflow).toBe("hidden");
    modal(); // idempotent: a second call must not release the ceremony's hold
    expect(style.overflow).toBe("hidden");
    ceremony();
    expect(style.overflow).toBe("auto");
    expect(style.paddingRight).toBe("");
  });
});

describe("nextTrapIndex (Tab stays inside the dialog)", () => {
  it("wraps forward from the last element and backward from the first", () => {
    expect(nextTrapIndex(2, 3, false)).toBe(0);
    expect(nextTrapIndex(0, 3, true)).toBe(2);
  });

  it("lets the browser move between the elements in the middle", () => {
    expect(nextTrapIndex(0, 3, false)).toBeNull();
    expect(nextTrapIndex(1, 3, true)).toBeNull();
  });

  it("from the dialog itself: Tab goes to the first element, Shift+Tab to the last", () => {
    expect(nextTrapIndex(-1, 3, false)).toBeNull(); // the next in DOM order is the first one
    expect(nextTrapIndex(-1, 3, true)).toBe(2);
  });

  it("pulls a focus that escaped back in, and keeps it on an empty dialog", () => {
    expect(nextTrapIndex(-2, 3, false)).toBe(0);
    expect(nextTrapIndex(-2, 3, true)).toBe(2);
    expect(nextTrapIndex(-1, 0, false)).toBe(-1);
    expect(nextTrapIndex(-1, 0, true)).toBe(-1);
  });
});

describe("handlesEnter", () => {
  const at = (match: boolean) => ({ closest: () => (match ? {} : null) });
  it("leaves Enter to buttons, links and fields (their own activation)", () => {
    expect(handlesEnter(at(true) as unknown as EventTarget)).toBe(true);
  });
  it("a ceremony overlay or a plain element continues on Enter", () => {
    expect(handlesEnter(at(false) as unknown as EventTarget)).toBe(false);
    expect(handlesEnter(null)).toBe(false);
  });
});

describe("dialog stack", () => {
  it("only the most recently opened dialog is on top", () => {
    const a = {};
    const b = {};
    pushDialog(a);
    expect(isTopDialog(a)).toBe(true);
    pushDialog(b);
    expect(isTopDialog(a)).toBe(false);
    expect(isTopDialog(b)).toBe(true);
    popDialog(b);
    expect(isTopDialog(a)).toBe(true);
    popDialog(a);
    expect(isTopDialog(a)).toBe(false);
  });

  it("closing a lower dialog first keeps the upper one on top", () => {
    const a = {};
    const b = {};
    pushDialog(a);
    pushDialog(b);
    popDialog(a);
    expect(isTopDialog(b)).toBe(true);
    popDialog(b);
  });
});
