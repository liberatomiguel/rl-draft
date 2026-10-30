"use client";

/**
 * Road to Worlds — the org crest renderer (v2).
 *
 * A crest is composed from three layers encoded in ONE string so the save
 * schema stays frozen (CareerIdentity.crestId is still a plain string):
 *
 *   crestId = "shape[:symbol[:pattern]]"
 *     "shield"              → legacy crest (base + accent + monogram)
 *     "shield:wolf"         → shape + center symbol (no monogram)
 *     "shield:wolf:stripes" → shape + clipped pattern + symbol
 *     "shield::stripes"     → shape + pattern, monogram kept
 *
 * Unknown/absent parts fall back gracefully, so legacy saves render exactly
 * as they always did. Colors stay {primary, secondary} (CareerColors).
 *
 * All geometry is hand-authored on a 64×64 grid: 14 base silhouettes,
 * 18 center symbols (~24–30px, centered ≈(32,34)), 7 clipped patterns.
 * v0.3: classic-tone palette (22 swatches — the length is load-bearing:
 * contrastingSecondaryIndex steps +5, coprime with 22) + badge/banner shapes,
 * lion/comet/anchor/trident symbols, sash/quarters patterns.
 *
 * rc.36 (UX-04, R88): six more shapes, eight more symbols (a battle car, the
 * ball, a wheel, a trophy…), four more patterns and a LAYOUT — a fourth part,
 * "shape:symbol:pattern:layout": the emblem alone (the default, omitted),
 * the emblem over the letters ("stacked") or a band carrying them ("band").
 * The new ids live in their own lists: the procedural filler crests
 * (OrgMark.proceduralCrestFor) index CREST_IDS / SYMBOL_IDS / PATTERN_IDS
 * by hash, so those three stay exactly as they were — every filler org keeps
 * its crest — and every saved id renders as it always did.
 */

import { useId } from "react";
import type { CareerColors } from "@/engine/career/types";

// ---------------------------------------------------------------------------
// Catalogue ids
// ---------------------------------------------------------------------------

// Order = wizard display order (strong classics first). Ids are the contract —
// never rename; appending is always safe (parse falls back on unknowns).
// FROZEN for the procedural pool (its hash indexes this length): append new
// ids to CREST_IDS_RC36 instead.
export const CREST_IDS = [
  "shield", "badge", "banner", "crown", "hex", "circle", "diamond",
  "star", "blade", "flame", "wing", "bolt", "orbit", "wave",
] as const;
/** rc.36 (UX-04): the wizard's further shapes (never in the procedural pool). */
export const CREST_IDS_RC36 = ["heater", "notch", "squircle", "octagon", "pentagon", "arch"] as const;
/** Every shape the wizard offers and the parser accepts. */
export const ALL_CREST_IDS = [...CREST_IDS, ...CREST_IDS_RC36] as const;
export type CrestId = (typeof ALL_CREST_IDS)[number];

/** FROZEN for the procedural pool — append to SYMBOL_IDS_RC36. */
export const SYMBOL_IDS = [
  "lion", "wolf", "dragon", "phoenix", "falcon", "crown", "blade",
  "trident", "anchor", "star", "comet", "bolt", "flame", "wave",
  "rocket", "gear", "orb", "arrow",
] as const;
/** rc.36 (UX-04): the wizard's further symbols. */
export const SYMBOL_IDS_RC36 = ["car", "ball", "wheel", "trophy", "wings", "peak", "gem", "chevrons"] as const;
export const ALL_SYMBOL_IDS = [...SYMBOL_IDS, ...SYMBOL_IDS_RC36] as const;
export type SymbolId = (typeof ALL_SYMBOL_IDS)[number];

/** FROZEN for the procedural pool — append to PATTERN_IDS_RC36. */
export const PATTERN_IDS = [
  "stripes", "sash", "split", "quarters", "chevron", "rays", "ring",
] as const;
/** rc.36 (UX-04): the wizard's further patterns. */
export const PATTERN_IDS_RC36 = ["hoops", "halves", "cross", "border"] as const;
export const ALL_PATTERN_IDS = [...PATTERN_IDS, ...PATTERN_IDS_RC36] as const;
export type PatternId = (typeof ALL_PATTERN_IDS)[number];

/**
 * rc.36 (UX-04): how the emblem and the letters sit — the emblem alone (the
 * default; the letters on a symbol-less crest, as ever), the emblem over the
 * letters, or a band across the crest carrying the letters.
 */
export const LAYOUT_IDS = ["emblem", "stacked", "band"] as const;
export type LayoutId = (typeof LAYOUT_IDS)[number];

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

/**
 * Single swatches for independent primary/secondary picks (wizard v2 +
 * procedural filler crests). v0.3: CLASSIC CLUB TONES (navies, forest,
 * burgundy, gold, ivory…) replacing the neon Tailwind brights — Miguel's
 * "tons mais clássicos". EXACTLY 22 entries: contrastingSecondaryIndex steps
 * +5 (coprime with 22) and procedural filler crests index by hash, so the
 * length is a compatibility surface — swap hexes, never the count.
 */
export const CREST_PALETTE: { id: string; hex: string }[] = [
  { id: "navy", hex: "#1f3a5f" },
  { id: "gold", hex: "#c9a227" },
  { id: "burgundy", hex: "#7f1d2d" },
  { id: "ivory", hex: "#f2efe3" },
  { id: "royal", hex: "#1d4ed8" },
  { id: "silver", hex: "#cbd5e1" },
  { id: "forest", hex: "#1d5c3a" },
  { id: "cream", hex: "#e8dfc8" },
  { id: "scarlet", hex: "#c81e2e" },
  { id: "sky", hex: "#4da3e8" },
  { id: "charcoal", hex: "#262b33" },
  { id: "amber", hex: "#d97706" },
  { id: "petrol", hex: "#155e75" },
  { id: "white", hex: "#f5f7fa" },
  { id: "plum", hex: "#6d2f6b" },
  { id: "steel", hex: "#7c8aa0" },
  { id: "wine", hex: "#5c1a2e" },
  { id: "olive", hex: "#5c6b2f" },
  { id: "indigo", hex: "#4338ca" },
  { id: "burnt-orange", hex: "#c2540a" },
  { id: "teal", hex: "#0f766e" },
  { id: "slate", hex: "#475569" },
];

/** Legacy curated pairs — kept for old call sites; every color is in CREST_PALETTE. */
/**
 * v2.0 (R34) curated KITS — harmonious primary/secondary pairs with names,
 * the wizard's first choice (custom swatches stay one tap away). Every hex is
 * in CREST_PALETTE so crests, kits and procedural fillers share one palette.
 */
export const CREST_KITS: { id: string; primary: string; secondary: string }[] = [
  { id: "navy-gold", primary: "#1f3a5f", secondary: "#c9a227" },
  { id: "burgundy-ivory", primary: "#7f1d2d", secondary: "#f2efe3" },
  { id: "forest-cream", primary: "#1d5c3a", secondary: "#e8dfc8" },
  { id: "royal-silver", primary: "#1d4ed8", secondary: "#cbd5e1" },
  { id: "charcoal-amber", primary: "#262b33", secondary: "#d97706" },
  { id: "scarlet-ivory", primary: "#c81e2e", secondary: "#f2efe3" },
  { id: "petrol-sky", primary: "#155e75", secondary: "#4da3e8" },
  { id: "plum-silver", primary: "#6d2f6b", secondary: "#cbd5e1" },
  { id: "teal-cream", primary: "#0f766e", secondary: "#e8dfc8" },
  { id: "slate-white", primary: "#475569", secondary: "#f5f7fa" },
  { id: "indigo-gold", primary: "#4338ca", secondary: "#c9a227" },
  { id: "wine-gold", primary: "#5c1a2e", secondary: "#c9a227" },
  { id: "olive-ivory", primary: "#5c6b2f", secondary: "#f2efe3" },
  { id: "orange-charcoal", primary: "#c2540a", secondary: "#262b33" },
  { id: "white-royal", primary: "#f5f7fa", secondary: "#1d4ed8" },
  { id: "steel-scarlet", primary: "#7c8aa0", secondary: "#c81e2e" },
];

export const CREST_COLOR_PAIRS: { primary: string; secondary: string }[] = [
  { primary: "#1f3a5f", secondary: "#c9a227" }, // navy & gold
  { primary: "#7f1d2d", secondary: "#f2efe3" }, // burgundy & ivory
  { primary: "#1d5c3a", secondary: "#e8dfc8" }, // forest & cream
  { primary: "#1d4ed8", secondary: "#cbd5e1" }, // royal & silver
  { primary: "#262b33", secondary: "#d97706" }, // charcoal & amber
  { primary: "#c81e2e", secondary: "#f2efe3" }, // scarlet & ivory
  { primary: "#155e75", secondary: "#4da3e8" }, // petrol & sky
  { primary: "#6d2f6b", secondary: "#cbd5e1" }, // plum & silver
  { primary: "#0f766e", secondary: "#e8dfc8" }, // teal & cream
  { primary: "#475569", secondary: "#f5f7fa" }, // slate & white
];

/** WCAG-ish relative luminance of a #rrggbb hex (0 = black, 1 = white). */
export function crestLuminance(hex: string): number {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return 0.5;
  const n = parseInt(m[1], 16);
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin((n >>> 16) & 255) + 0.7152 * lin((n >>> 8) & 255) + 0.0722 * lin(n & 255);
}

/**
 * Pick a secondary CREST_PALETTE index that reads against the given primary
 * index: never the same swatch, and luminance-separated enough for the symbol
 * layer to stay legible. Deterministic (no RNG) — safe for procedural crests.
 */
export function contrastingSecondaryIndex(primaryIndex: number, preferredIndex: number): number {
  const n = CREST_PALETTE.length;
  const pi = ((primaryIndex % n) + n) % n;
  let si = ((preferredIndex % n) + n) % n;
  const pLum = crestLuminance(CREST_PALETTE[pi].hex);
  for (let guard = 0; guard < n; guard++) {
    if (si !== pi && Math.abs(pLum - crestLuminance(CREST_PALETTE[si].hex)) >= 0.18) return si;
    si = (si + 5) % n; // gcd(5, 22) = 1 → visits every swatch
  }
  return si === pi ? (si + 1) % n : si;
}

// ---------------------------------------------------------------------------
// crestId encoding — "shape[:symbol[:pattern]]"
// ---------------------------------------------------------------------------

export interface CrestConfig {
  shape: CrestId;
  symbol?: SymbolId;
  pattern?: PatternId;
  /** rc.36: absent = "emblem" (every id saved before rc.36). */
  layout?: LayoutId;
}

/** Parse any crestId string; unknown/absent parts fall back (legacy-safe). */
export function parseCrestId(raw: string): CrestConfig {
  const [s, sy, pt, ly] = (raw ?? "").split(":");
  const shape = (ALL_CREST_IDS as readonly string[]).includes(s) ? (s as CrestId) : "shield";
  const symbol = (ALL_SYMBOL_IDS as readonly string[]).includes(sy) ? (sy as SymbolId) : undefined;
  const pattern = (ALL_PATTERN_IDS as readonly string[]).includes(pt) ? (pt as PatternId) : undefined;
  const layout = ly && ly !== "emblem" && (LAYOUT_IDS as readonly string[]).includes(ly) ? (ly as LayoutId) : undefined;
  return { shape, symbol, pattern, layout };
}

/**
 * Compose the compact crestId string ("shield" stays "shield" — legacy-stable;
 * the default layout is never written, so every pre-rc.36 id composes as before).
 */
export function composeCrestId(cfg: {
  shape: string;
  symbol?: string | null;
  pattern?: string | null;
  layout?: string | null;
}): string {
  if (cfg.layout && cfg.layout !== "emblem") return `${cfg.shape}:${cfg.symbol ?? ""}:${cfg.pattern ?? ""}:${cfg.layout}`;
  if (cfg.pattern) return `${cfg.shape}:${cfg.symbol ?? ""}:${cfg.pattern}`;
  if (cfg.symbol) return `${cfg.shape}:${cfg.symbol}`;
  return cfg.shape;
}

// ---------------------------------------------------------------------------
// Geometry — base silhouettes (64×64, primary fill)
// ---------------------------------------------------------------------------

const SIZE: Record<"xs" | "sm" | "md" | "lg" | "xl", number> = {
  xs: 20, sm: 28, md: 40, lg: 64, xl: 112,
};

/** Base silhouette per crest id (drawn in a 64x64 box, primary fill). */
const BASE_PATH: Record<CrestId, string> = {
  shield: "M32 4 L56 12 V32 C56 46 46 56 32 60 C18 56 8 46 8 32 V12 Z",
  hex: "M32 4 L54 17 V47 L32 60 L10 47 V17 Z",
  circle: "M32 6 A26 26 0 1 1 31.99 6 Z",
  diamond: "M32 4 L58 32 L32 60 L6 32 Z",
  wing: "M6 44 C14 20 34 8 58 10 C50 22 46 26 44 34 C36 34 24 38 6 44 Z M14 50 C26 44 36 42 46 40 C42 48 34 54 20 56 Z",
  bolt: "M36 4 L14 36 H28 L24 60 L50 26 H34 Z",
  star: "M32 4 L39 24 H60 L43 36 L49 58 L32 45 L15 58 L21 36 L4 24 H25 Z",
  flame: "M32 4 C40 16 50 22 50 38 A18 18 0 0 1 14 38 C14 28 20 24 22 16 C26 22 28 24 32 24 C30 16 30 10 32 4 Z",
  orbit: "M32 6 A26 26 0 1 1 31.99 6 Z M32 18 A14 14 0 1 0 32.01 18 Z",
  blade: "M20 4 L44 4 L54 32 L44 60 L20 60 L10 32 Z",
  crown: "M8 22 L20 32 L32 12 L44 32 L56 22 L52 48 H12 Z",
  wave: "M6 40 C14 28 22 28 30 36 C38 44 46 44 58 32 L58 48 C46 58 34 58 26 50 C18 42 12 44 6 52 Z",
  // v0.3 — the classic football-club badge (rounded top, tapered bottom).
  badge:
    "M14 6 H50 A6 6 0 0 1 56 12 V36 C56 49 46 57 32 60 C18 57 8 49 8 36 V12 A6 6 0 0 1 14 6 Z",
  // v0.3 — hanging pennant banner with a swallowtail bottom.
  banner: "M14 4 H50 V54 L32 45 L14 54 Z",
  // rc.36 (UX-04) — the classic heater: flat top, straight flanks, a long curve to the point.
  heater: "M8 6 H56 V22 C56 40 46 53 32 60 C18 53 8 40 8 22 Z",
  // rc.36 — a heraldic shield with a notched top.
  notch: "M8 6 H22 L26 11 H38 L42 6 H56 V30 C56 46 45 56 32 60 C19 56 8 46 8 30 Z",
  // rc.36 — the modern esports tile (a squircle).
  squircle: "M32 5 C52 5 59 12 59 32 C59 52 52 59 32 59 C12 59 5 52 5 32 C5 12 12 5 32 5 Z",
  // rc.36 — octagon.
  octagon: "M22 5 H42 L59 22 V42 L42 59 H22 L5 42 V22 Z",
  // rc.36 — pentagon, point up.
  pentagon: "M32 4 L59 24 L49 59 H15 L5 24 Z",
  // rc.36 — the arch (a domed top on a flat base).
  arch: "M8 59 V30 A24 24 0 0 1 56 30 V59 Z",
};

/** Legacy accent detail (secondary fill) — rendered ONLY on symbol-less, pattern-less crests. */
const ACCENT_PATH: Record<CrestId, string> = {
  shield: "M32 10 L50 16 V31 C50 42 42 50 32 53 V10 Z",
  hex: "M32 10 L48 20 V44 L32 53 Z",
  circle: "M32 12 A20 20 0 0 1 52 32 L32 32 Z",
  diamond: "M32 12 L52 32 L32 52 Z",
  wing: "M24 30 C32 20 42 16 52 14 C46 22 44 26 42 32 C36 32 30 32 24 30 Z",
  bolt: "M33 10 L22 32 H30 L28 46 L41 28 H32 Z",
  star: "M32 14 L37 27 H50 L39 35 L43 49 L32 41 Z",
  flame: "M32 16 C36 24 42 28 42 38 A10 10 0 0 1 32 48 Z",
  orbit: "M46 14 A6 6 0 1 1 45.9 14 Z",
  blade: "M24 10 L40 10 L47 32 L40 54 L32 54 L40 32 Z",
  crown: "M32 20 L40 34 L48 27 L45 44 H32 Z",
  wave: "M6 48 C14 40 20 40 26 46 C34 52 44 52 58 42 L58 48 C46 58 34 58 26 50 C18 42 12 44 6 52 Z",
  badge: "M32 12 L50 12 V36 C50 46 43 52 32 55 Z",
  banner: "M32 10 L44 10 V45 L32 40 Z",
  heater: "M32 12 L50 12 V23 C50 37 43 48 32 54 Z",
  notch: "M32 15 H39 L42 12 H50 V30 C50 42 43 50 32 54 Z",
  squircle: "M32 11 C47 11 53 17 53 32 C53 47 47 53 32 53 Z",
  octagon: "M32 11 H40 L53 24 V40 L40 53 H32 Z",
  pentagon: "M32 11 L52 26 L45 53 H32 Z",
  arch: "M32 12 A18 18 0 0 1 50 30 V53 H32 Z",
};

// ---------------------------------------------------------------------------
// Geometry — center symbols
// ---------------------------------------------------------------------------

/**
 * Hand-authored center emblems. Each entry is a list of path `d` strings
 * (rendered as separate <path fillRule="evenodd">, so subpath holes work and
 * overlapping groups just paint over each other). Drawn for the 64×64 grid,
 * centered ≈(32,34), ~24–30px tall — strong silhouettes, readable at 20px.
 */
const SYMBOL_PATHS: Record<SymbolId, string[]> = {
  // Upright rocket: nose cone + window hole, side fins, exhaust flick.
  rocket: [
    "M32 16.5 C36.6 20.8 38.6 26.2 38.6 32.4 L38.6 41 L25.4 41 L25.4 32.4 C25.4 26.2 27.4 20.8 32 16.5 Z " +
      "M32 25.2 A3.4 3.4 0 1 1 31.99 25.2 Z " +
      "M25.4 33.5 L18.6 44.5 L25.4 42.7 Z " +
      "M38.6 33.5 L45.4 44.5 L38.6 42.7 Z " +
      "M28.6 43.2 L32 49.5 L35.4 43.2 L32 45.1 Z",
  ],
  // Front-facing angular wolf mask, ears up, eye notches cut out.
  wolf: [
    "M20 18.5 L27.2 23.6 L32 22.2 L36.8 23.6 L44 18.5 L45 29.6 L40.2 35.8 L36.4 39.8 L32 47.5 L27.6 39.8 L23.8 35.8 L19 29.6 Z " +
      "M26.4 30.2 L31 31.9 L27.4 34.6 Z " +
      "M37.6 30.2 L33 31.9 L36.6 34.6 Z",
  ],
  // Dragon head in profile (facing right): swept horn, snout, jaw barbs.
  dragon: [
    "M23.5 18.5 C29.8 18.7 34.2 21.8 36.2 26.2 L46.5 30.2 L38.2 32.6 L45 39.2 L35 36.8 L31.6 45.5 L28.8 37.8 L20.5 41 " +
      "C19.6 35 21 29.8 25 27 C26.2 23.8 25.4 20.8 23.5 18.5 Z " +
      "M31.2 27.6 L35.4 29.2 L31.6 31.4 Z",
  ],
  // Rising fire-bird: two up-swept crescent wings, head orb, leaf body.
  phoenix: [
    "M16 19.5 C24 22.5 29.2 29.5 30.2 40.5 C25 37.2 20.4 33 18.3 27.2 C17.2 24.4 16.3 22 16 19.5 Z " +
      "M48 19.5 C40 22.5 34.8 29.5 33.8 40.5 C39 37.2 43.6 33 45.7 27.2 C46.8 24.4 47.7 22 48 19.5 Z " +
      "M32 17.6 A3 3 0 1 1 31.99 17.6 Z",
    "M32 23.5 C34.6 27.8 35.8 32 35.8 36.6 C35.8 41.6 34.4 45.4 32 49.5 C29.6 45.4 28.2 41.6 28.2 36.6 C28.2 32 29.4 27.8 32 23.5 Z",
  ],
  // Sword point-up: blade, crossguard, grip; pommel painted over the grip.
  blade: [
    "M32 15 L35.4 21 L35.4 40.5 L28.6 40.5 L28.6 21 Z " +
      "M23.4 40.5 L40.6 40.5 L40.6 43.6 L23.4 43.6 Z " +
      "M30.2 43.6 L33.8 43.6 L33.8 47 L30.2 47 Z",
    "M32 46.4 A2.2 2.2 0 1 1 31.99 46.4 Z",
  ],
  // Three-point crown over a band.
  crown: [
    "M19.5 23 L26.5 31.5 L32 21.5 L37.5 31.5 L44.5 23 L42.4 39.5 L21.6 39.5 Z " +
      "M21.6 41.7 L42.4 41.7 L42.4 45 L21.6 45 Z",
  ],
  // Five-point star (outer r 14.5 / inner r 5.8, center 32,33).
  star: [
    "M32 18.5 L35.4 28.3 L45.8 28.5 L37.5 34.8 L40.5 44.7 L32 38.8 L23.5 44.7 L26.5 34.8 L18.2 28.5 L28.6 28.3 Z",
  ],
  // Lightning strike.
  bolt: ["M35.5 15.5 L21.5 35.5 L29.7 35.5 L27 49.5 L42.5 28.8 L33.7 28.8 Z"],
  // Twin-tongue flame with an inner ember hole.
  flame: [
    "M32 16.5 C36.4 22.4 41.2 26.4 41.2 34.4 A9.2 9.2 0 0 1 22.8 34.4 C22.8 29.2 25.6 26 27.2 21.4 C29 24.6 30.4 26 32.4 26.6 C31.2 22.8 31.2 19.6 32 16.5 Z " +
      "M32 30 C34 33 36 34.5 36 37.6 A4 4 0 0 1 28 37.6 C28 34.8 30.4 33.2 32 30 Z",
  ],
  // Curling breaker wave.
  wave: [
    "M17.5 42.5 C17.5 30.5 25.5 22.5 38 22.5 C34 25.6 32.2 28.8 32.8 32.8 C36.4 29.2 42.6 30 45.8 34 C41.6 33.4 38.8 35 37.6 38.8 C35 45.6 26.6 48.4 17.5 42.5 Z",
  ],
  // 8-tooth gear with hub hole (outer 15 / valley 10.8 / hub 4.6, center 32,33).
  gear: [
    "M29.1 18.3 L34.9 18.3 L35.2 22.7 L37.1 23.5 L40.4 20.6 L44.4 24.6 L41.5 27.9 L42.3 29.8 L46.7 30.1 L46.7 35.9 L42.3 36.2 " +
      "L41.5 38.1 L44.4 41.4 L40.4 45.4 L37.1 42.5 L35.2 43.3 L34.9 47.7 L29.1 47.7 L28.8 43.3 L26.9 42.5 L23.6 45.4 L19.6 41.4 " +
      "L22.5 38.1 L21.7 36.2 L17.3 35.9 L17.3 30.1 L21.7 29.8 L22.5 27.9 L19.6 24.6 L23.6 20.6 L26.9 23.5 L28.8 22.7 Z " +
      "M32 28.4 A4.6 4.6 0 1 1 31.99 28.4 Z",
  ],
  // Falcon head in profile (facing right): hooked beak, eye cut, cheek sweep.
  falcon: [
    "M23.5 21 C33 17.5 41.5 21.5 44 29 L47.5 32.5 L43.2 33.6 C43.6 39.4 39.8 44.8 32.5 47.5 C35.2 43.2 35.8 39.4 33.6 36.2 " +
      "C26.8 35.8 22.8 31.2 23.5 21 Z " +
      "M34.6 24.4 A2 2 0 1 1 34.59 24.4 Z",
  ],
  // Ringed planet: disc + tilted orbit band (annulus, painted over the disc).
  orb: [
    "M32 22.5 A10.5 10.5 0 1 1 31.99 22.5 Z",
    "M49.1 27.4 A18 6.2 -18 1 1 14.9 38.6 A18 6.2 -18 1 1 49.1 27.4 Z " +
      "M45.9 28.5 A14.6 3.4 -18 1 1 18.1 37.5 A14.6 3.4 -18 1 1 45.9 28.5 Z",
  ],
  // Bold ascent arrow.
  arrow: ["M32 15.5 L45 31 L37.6 31 L37.6 47 L26.4 47 L26.4 31 L19 31 Z"],
  // v0.3 — heraldic lion: 8-lobe mane ring (face hole) + eyes and muzzle.
  lion: [
    "M32 18.5 C36 18.5 38.2 20.6 41.6 21.2 C43.2 24.2 46.6 25.2 46.8 28.8 C48.8 31.4 48.8 36.6 46.8 39.2 C46.6 42.8 43.2 43.8 41.6 46.8 " +
      "C38.2 47.4 36 49.5 32 49.5 C28 49.5 25.8 47.4 22.4 46.8 C20.8 43.8 17.4 42.8 17.2 39.2 C15.2 36.6 15.2 31.4 17.2 28.8 " +
      "C17.4 25.2 20.8 24.2 22.4 21.2 C25.8 20.6 28 18.5 32 18.5 Z " +
      "M32 25.5 A8.5 8.5 0 1 0 32.01 25.5 Z",
    "M28.9 31 A1.9 1.9 0 1 1 28.89 31 Z M37 31 A1.9 1.9 0 1 1 36.99 31 Z " +
      "M32 34.8 L28.4 38.2 C29.6 40.6 34.4 40.6 35.6 38.2 Z",
  ],
  // v0.3 — comet: head disc low-right, tail wedges sweeping to upper-left.
  comet: [
    "M38.2 31 A7.2 7.2 0 1 1 38.19 31 Z",
    "M31.8 33.8 L14.5 22 L27.9 37.2 Z M35 29.8 L22.5 13.8 L31.7 32 Z M42.2 30 L38.8 14.5 L37.5 30.3 Z",
  ],
  // v0.3 — anchor: ring, shank + stock, curved flukes.
  anchor: [
    "M32 13.4 A4.6 4.6 0 1 1 31.99 13.4 Z M32 15.8 A2.2 2.2 0 1 0 32.01 15.8 Z",
    "M30.4 22.4 L33.6 22.4 L33.6 44.5 L30.4 44.5 Z M24 26.8 L40 26.8 L40 29.8 L24 29.8 Z",
    "M32 49.5 C24.6 49 19.6 44.6 18 37.6 L23 40.6 L22.2 34.8 C24.9 40 27.7 43 30.4 43.9 L33.6 43.9 C36.3 43 39.1 40 41.8 34.8 " +
      "L41 40.6 L46 37.6 C44.4 44.6 39.4 49 32 49.5 Z",
  ],
  // rc.36 (UX-04) — a battle car in profile (facing right): body with a window cut, two wheels with hubs.
  car: [
    "M11 39.5 C11 36.6 12.8 34.6 15.6 33.8 L23.4 28.2 C25.2 26.9 27.3 26.3 29.6 26.3 L38.4 26.3 C40.8 26.3 42.8 27.3 44.3 29.1 L47.2 32.6 L51.6 33.4 C54.2 33.9 55.8 35.9 55.8 38.4 L55.8 41 L11 41 Z " +
      "M26.6 31.6 L30.6 28.8 L37.6 28.8 L40.6 32.4 Z",
    "M21 36.4 A5.6 5.6 0 1 1 20.99 36.4 Z M21 39.8 A2.2 2.2 0 1 0 21.01 39.8 Z " +
      "M46.4 36.4 A5.6 5.6 0 1 1 46.39 36.4 Z M46.4 39.8 A2.2 2.2 0 1 0 46.41 39.8 Z",
  ],
  // rc.36 — the ball: a ring, a pentagon panel and five seams.
  ball: [
    "M32 20.5 A13.5 13.5 0 1 1 31.99 20.5 Z M32 23.2 A10.8 10.8 0 1 0 32.01 23.2 Z",
    "M32 28.6 L37.2 32.4 L35.2 38.5 L28.8 38.5 L26.8 32.4 Z " +
      "M31 23.2 H33 V29.3 H31 Z " +
      "M36.7 31.5 L42.6 29.7 L43.2 31.6 L37.3 33.4 Z " +
      "M34.9 37.5 L38.6 42.5 L37 43.7 L33.3 38.7 Z " +
      "M29.1 37.5 L30.7 38.7 L27 43.7 L25.4 42.5 Z " +
      "M27.3 31.5 L26.7 33.4 L20.8 31.6 L21.4 29.7 Z",
  ],
  // rc.36 — a wheel: rim, six spokes, the hub.
  wheel: [
    "M32 20.5 A13.5 13.5 0 1 1 31.99 20.5 Z M32 23.6 A10.4 10.4 0 1 0 32.01 23.6 Z",
    "M22 32.6 H42 V35.4 H22 Z " +
      "M35.79 43.36 L37.21 41.96 L28.21 24.64 L26.79 26.04 Z " +
      "M25.79 41.96 L28.21 43.36 L38.21 26.04 L35.79 24.64 Z",
    "M32 29.6 A4.4 4.4 0 1 1 31.99 29.6 Z",
  ],
  // rc.36 — a trophy: the cup with its handles, the stem, the base.
  trophy: [
    "M23 18.5 H41 V27 C41 33 37.2 37 32 37 C26.8 37 23 33 23 27 Z " +
      "M23 20.6 H19.2 C17 20.6 15.8 22.2 15.8 24.4 C15.8 27.9 18.9 30.2 23.2 30.6 V28 C20.4 27.6 18.6 26.4 18.6 24.6 C18.6 23.8 19 23.4 19.8 23.4 H23 Z " +
      "M41 20.6 H44.8 C47 20.6 48.2 22.2 48.2 24.4 C48.2 27.9 45.1 30.2 40.8 30.6 V28 C43.6 27.6 45.4 26.4 45.4 24.6 C45.4 23.8 45 23.4 44.2 23.4 H41 Z",
    "M30 36.4 H34 V43 H30 Z M23.5 43 H40.5 V47.6 H23.5 Z",
  ],
  // rc.36 — wings spread around a gem.
  wings: [
    "M30.6 30.2 C25.2 22.6 17.2 20.4 10.6 22 C13.6 23.8 14.8 25.8 15 27.8 C12.2 28.4 10.2 30 9.2 32.2 C13 32 15.2 33 16.4 34.4 C14.4 35.6 13.2 37.2 13.2 39.4 C19.2 37.4 26 36.4 30.6 38.4 Z " +
      "M33.4 30.2 C38.8 22.6 46.8 20.4 53.4 22 C50.4 23.8 49.2 25.8 49 27.8 C51.8 28.4 53.8 30 54.8 32.2 C51 32 48.8 33 47.6 34.4 C49.6 35.6 50.8 37.2 50.8 39.4 C44.8 37.4 38 36.4 33.4 38.4 Z",
    "M32 26.6 L35.2 33.4 L32 41.2 L28.8 33.4 Z",
  ],
  // rc.36 — a peak: two summits, a snowcap cut into the tall one.
  peak: [
    "M11.5 46.5 L25.5 25 L31.5 33 L38.5 21.5 L52.5 46.5 Z " +
      "M38.5 21.5 L43 29 L40.2 27.6 L38 30.4 L35.6 28.2 L34.2 29 Z",
  ],
  // rc.36 — a cut gem: the girdle and a pavilion facet cut out.
  gem: [
    "M21 26.5 L27 19 H37 L43 26.5 L32 47.5 Z " +
      "M22.6 26.2 H41.4 L40.4 28 H23.6 Z " +
      "M30 30 H34 L32 41 Z",
  ],
  // rc.36 — three rising chevrons (a rank climb).
  chevrons: [
    "M20 26.5 L32 17.5 L44 26.5 V31.5 L32 22.5 L20 31.5 Z " +
      "M20 35.5 L32 26.5 L44 35.5 V40.5 L32 31.5 L20 40.5 Z " +
      "M20 44.5 L32 35.5 L44 44.5 V49.5 L32 40.5 L20 49.5 Z",
  ],
  // v0.3 — trident: three prongs over a crossbar, shaft down.
  trident: [
    "M32 13.5 L36.2 20.5 L33.6 20.5 L33.6 32 L30.4 32 L30.4 20.5 L27.8 20.5 Z " +
      "M22.5 17.5 L26.3 23.8 L24.1 23.8 L24.1 32 L20.9 32 L20.9 23.8 L18.7 23.8 Z " +
      "M41.5 17.5 L45.3 23.8 L43.1 23.8 L43.1 32 L39.9 32 L39.9 23.8 L37.7 23.8 Z " +
      "M20.9 32 L43.1 32 L43.1 35 L20.9 35 Z " +
      "M30.4 35 L33.6 35 L33.6 49.5 L30.4 49.5 Z",
  ],
};

/**
 * Per-shape symbol fit (scale + center) so emblems sit inside narrow or
 * off-center silhouettes (bolt, wing, wave…) instead of spilling out.
 * Symbols are authored around (32,34); the transform re-centers to (cx,cy).
 */
const SYMBOL_FIT: Record<CrestId, { s: number; cx: number; cy: number }> = {
  shield: { s: 0.82, cx: 32, cy: 31.5 },
  hex: { s: 0.85, cx: 32, cy: 32.5 },
  circle: { s: 0.8, cx: 32, cy: 32.5 },
  diamond: { s: 0.76, cx: 32, cy: 32.5 },
  wing: { s: 0.6, cx: 31, cy: 31 },
  bolt: { s: 0.6, cx: 32, cy: 32 },
  star: { s: 0.56, cx: 32, cy: 33.5 },
  flame: { s: 0.66, cx: 32, cy: 38 },
  orbit: { s: 0.6, cx: 32, cy: 32.5 },
  blade: { s: 0.8, cx: 32, cy: 32.5 },
  crown: { s: 0.62, cx: 32, cy: 34.5 },
  wave: { s: 0.6, cx: 32, cy: 42 },
  badge: { s: 0.82, cx: 32, cy: 31.5 },
  banner: { s: 0.7, cx: 32, cy: 28.5 },
  heater: { s: 0.8, cx: 32, cy: 29.5 },
  notch: { s: 0.78, cx: 32, cy: 32.5 },
  squircle: { s: 0.86, cx: 32, cy: 32.5 },
  octagon: { s: 0.84, cx: 32, cy: 32.5 },
  pentagon: { s: 0.78, cx: 32, cy: 35 },
  arch: { s: 0.82, cx: 32, cy: 35 },
};

// ---------------------------------------------------------------------------
// Geometry — patterns (clipped to the base silhouette, secondary fill)
// ---------------------------------------------------------------------------

/**
 * One path per pattern (evenodd), oversized past the 64×64 box — the base
 * shape clipPath crops them. Rays use explicit wedge paths (the project's
 * conic-gradient pitfall: plain conic segments do not repeat).
 */
const PATTERN_DEFS: Record<PatternId, string> = {
  // Three rising diagonal bands.
  stripes:
    "M24 -20 L-20 24 L-20 38 L38 -20 Z " +
    "M50 -20 L-20 50 L-20 64 L64 -20 Z " +
    "M76 -20 L-20 76 L-20 90 L90 -20 Z",
  // Diagonal half fill (lower-right).
  split: "M-2 66 L66 -2 L66 66 Z",
  // Two stacked chevron bands pointing up.
  chevron:
    "M-4 34 L32 16 L68 34 L68 45 L32 27 L-4 45 Z " +
    "M-4 56 L32 38 L68 56 L68 67 L32 49 L-4 67 Z",
  // Pinwheel of four 45° wedges from center (explicit wedges, not conic).
  rays:
    "M32 32 L-38 32 L-17.5 -17.5 Z " +
    "M32 32 L32 -38 L81.5 -17.5 Z " +
    "M32 32 L102 32 L81.5 81.5 Z " +
    "M32 32 L32 102 L-17.5 81.5 Z",
  // Annulus ring around center.
  ring: "M32 11 A21 21 0 1 1 31.99 11 Z M32 18 A14 14 0 1 1 31.99 18 Z",
  // v0.3 — one thick heraldic sash (top-left → bottom-right).
  sash: "M-22 12 L12 -22 L86 52 L52 86 Z",
  // v0.3 — quartered field (two opposite quarters filled).
  quarters: "M-2 -2 H32 V32 H-2 Z M32 32 H66 V66 H32 Z",
  // rc.36 (UX-04) — three horizontal hoops.
  hoops: "M-2 13 H66 V21 H-2 Z M-2 29 H66 V37 H-2 Z M-2 45 H66 V53 H-2 Z",
  // rc.36 — a vertical half.
  halves: "M32 -2 H66 V66 H32 Z",
  // rc.36 — a centred cross.
  cross: "M27 -2 H37 V66 H27 Z M-2 27 H66 V37 H-2 Z",
  // rc.36 — "border" is drawn as a thick inner outline of the shape itself (the renderer).
  border: "",
};

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------

const DARK_INK = "rgba(5,8,15,0.88)";
const LIGHT_INK = "rgba(245,248,255,0.92)";
/** Primaries darker than this get a light monogram (dark ink vanished on them). */
const INK_LUMINANCE_THRESHOLD = 0.16;
const SYMBOL_SHADOW = "rgba(5,8,15,0.5)";
/** rc.36 (UX-04): the stacked / band letters need this many pixels to read (smaller: the emblem alone). */
const LAYOUT_LETTERS_MIN_PX = 40;
/** rc.36: the emblem's size and rise when it shares the crest with the letters. */
const LAYOUT_SYMBOL_SCALE = 0.72;
const LAYOUT_SYMBOL_LIFT = 6;

export function UserCrest({
  crestId,
  colors,
  abbrev,
  size = "md",
  className,
}: {
  crestId: string;
  colors: CareerColors;
  abbrev?: string;
  size?: keyof typeof SIZE;
  className?: string;
}) {
  const uid = useId();
  const { shape, symbol, pattern, layout = "emblem" } = parseCrestId(crestId);
  const px = SIZE[size];
  // rc.36 (UX-04): stacked / band letters only where they read (the band itself always shows).
  const layoutLetters = Boolean(abbrev) && px >= LAYOUT_LETTERS_MIN_PX;
  const stacked = layout === "stacked" && Boolean(symbol) && layoutLetters;
  const band = layout === "band";
  // Symbol crests drop the monogram at every size — the emblem IS the mark.
  const showTag = Boolean(abbrev) && px >= 28 && !symbol && !band;
  const legacy = !symbol && !pattern && !band;
  const clipId = `crest-clip-${uid.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const ink = crestLuminance(colors.primary) >= INK_LUMINANCE_THRESHOLD ? DARK_INK : LIGHT_INK;
  const bandInk = crestLuminance(colors.secondary) >= INK_LUMINANCE_THRESHOLD ? DARK_INK : LIGHT_INK;
  const fit = SYMBOL_FIT[shape];
  // The emblem shrinks and rises to make room for the letters / the band.
  const lifted = stacked || (band && Boolean(symbol));
  const symbolScale = lifted ? fit.s * LAYOUT_SYMBOL_SCALE : fit.s;
  const symbolY = lifted ? fit.cy - LAYOUT_SYMBOL_LIFT : fit.cy;
  const symbolTransform = `translate(${fit.cx} ${symbolY}) scale(${symbolScale}) translate(-32 -34)`;
  const bandY = fit.cy + (symbol ? 6 : -6);
  const letters = abbrev ?? "";
  const letterSize = letters.length > 3 ? 9.5 : 11;

  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 64 64"
      className={className}
      role="img"
      aria-label={abbrev ? `${abbrev} crest` : "Org crest"}
    >
      {pattern || band ? (
        <defs>
          <clipPath id={clipId}>
            <path d={BASE_PATH[shape]} />
          </clipPath>
        </defs>
      ) : null}

      {/* 1 — base silhouette */}
      <path d={BASE_PATH[shape]} fill={colors.primary} opacity={0.92} />

      {/* 2 — pattern, clipped inside the base (rc.36 "border": a thick inner outline) */}
      {pattern === "border" ? (
        <g clipPath={`url(#${clipId})`}>
          <path d={BASE_PATH[shape]} fill="none" stroke={colors.secondary} strokeWidth={9} opacity={0.45} />
        </g>
      ) : pattern ? (
        <g clipPath={`url(#${clipId})`}>
          <path d={PATTERN_DEFS[pattern]} fill={colors.secondary} opacity={0.35} fillRule="evenodd" />
        </g>
      ) : null}

      {/* legacy accent — only on plain shape crests (old saves render unchanged) */}
      {legacy ? <path d={ACCENT_PATH[shape]} fill={colors.secondary} opacity={0.55} /> : null}

      {/* rc.36 (UX-04): the band layout — a secondary band across the crest, the letters on it */}
      {band ? (
        <g clipPath={`url(#${clipId})`}>
          <rect x={-2} y={bandY} width={68} height={13} fill={colors.secondary} opacity={0.92} />
          <rect x={-2} y={bandY} width={68} height={1.2} fill="rgba(255,255,255,0.35)" />
        </g>
      ) : null}
      {band && layoutLetters ? (
        <text
          x="32"
          y={bandY + 10}
          textAnchor="middle"
          fontSize={letterSize}
          fontWeight={700}
          fill={bandInk}
          style={{ fontFamily: "var(--font-rajdhani), sans-serif", letterSpacing: 0.6 }}
        >
          {letters}
        </text>
      ) : null}

      {/* 3 — center symbol: dark drop shape for contrast, then the emblem */}
      {symbol ? (
        <g transform={symbolTransform}>
          <g transform="translate(1 1.6)" aria-hidden>
            {SYMBOL_PATHS[symbol].map((d, i) => (
              <path key={`s${i}`} d={d} fill={SYMBOL_SHADOW} fillRule="evenodd" />
            ))}
          </g>
          {SYMBOL_PATHS[symbol].map((d, i) => (
            <path key={i} d={d} fill={colors.secondary} opacity={0.9} fillRule="evenodd" />
          ))}
        </g>
      ) : null}

      {/* rc.36 (UX-04): the stacked layout's letters under the raised emblem */}
      {stacked ? (
        <text
          x="32"
          y={Math.min(56, fit.cy + 17)}
          textAnchor="middle"
          fontSize={letterSize}
          fontWeight={700}
          fill={ink}
          style={{ fontFamily: "var(--font-rajdhani), sans-serif", letterSpacing: 0.6 }}
        >
          {letters}
        </text>
      ) : null}

      {/* 4 — outline */}
      <path d={BASE_PATH[shape]} fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth={2} />

      {/* 5 — monogram (no-symbol crests only), luminance-aware ink */}
      {showTag ? (
        <text
          x="32"
          y="38"
          textAnchor="middle"
          fontSize={abbrev && abbrev.length > 3 ? 13 : 16}
          fontWeight={700}
          fill={ink}
          style={{ fontFamily: "var(--font-rajdhani), sans-serif", letterSpacing: 0.5 }}
        >
          {abbrev}
        </text>
      ) : null}
    </svg>
  );
}
