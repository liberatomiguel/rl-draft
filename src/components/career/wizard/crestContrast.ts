/**
 * Road to Worlds rc.36 (UX-04, R88) — the crest colours' contrast guard
 * (pure TS). Two WCAG contrast ratios: the accent on the base (the symbol,
 * the letters, the pattern) and the base on a dark card (HQ, the tables,
 * the top bar). Under CAREER_CREST.contrast's floors the wizard WARNS and
 * suggests one-tap fixes — a palette accent or base near the pick that
 * clears the floor, or swapping the two — and never blocks or rewrites a
 * pick on its own.
 */

import { CAREER_CREST } from "@/config/balance";
import type { CareerColors } from "@/engine/career/types";
import { CREST_PALETTE, crestLuminance } from "@/components/career/UserCrest";

/** What a crest sits on: `.panel`'s mid stop (globals.css) — a design token mirror, not a tunable. */
export const CREST_CARD_BG = "#0f1729";

export function contrastRatio(a: string, b: string): number {
  const la = crestLuminance(a);
  const lb = crestLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

function rgbOf(hex: string): [number, number, number] {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  const n = m ? parseInt(m[1], 16) : 0;
  return [(n >>> 16) & 255, (n >>> 8) & 255, n & 255];
}

/** Squared RGB distance — "near the pick" for the suggestions. */
function distance(a: string, b: string): number {
  const [r1, g1, b1] = rgbOf(a);
  const [r2, g2, b2] = rgbOf(b);
  return (r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2;
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export interface Swatch {
  id: string;
  hex: string;
}

export interface CrestContrast {
  /** The accent on the base. */
  pair: number;
  /** The base on a dark card. */
  card: number;
  pairOk: boolean;
  cardOk: boolean;
  /** A palette accent near the pick that clears the pair floor (shown only when it fails). */
  fixAccent: Swatch | null;
  /** A palette base near the pick that clears the card floor and keeps the pair (shown only when it fails). */
  fixPrimary: Swatch | null;
  /** Swapping the two colours clears whatever fails now. */
  swapFixes: boolean;
}

/** The nearest swatch to `near` that passes `ok` with a margin; else the best by `score`. */
function suggest(near: string, exclude: string, ok: (hex: string) => boolean, score: (hex: string) => number): Swatch | null {
  const pool = CREST_PALETTE.filter((s) => !same(s.hex, exclude) && !same(s.hex, near));
  const passing = pool.filter((s) => ok(s.hex));
  if (passing.length > 0) return [...passing].sort((a, b) => distance(a.hex, near) - distance(b.hex, near))[0];
  return pool.length ? [...pool].sort((a, b) => score(b.hex) - score(a.hex))[0] : null;
}

export function crestContrastOf(colors: CareerColors): CrestContrast {
  const { pairMin, cardMin, fixMargin } = CAREER_CREST.contrast;
  const pair = contrastRatio(colors.primary, colors.secondary);
  const card = contrastRatio(colors.primary, CREST_CARD_BG);
  const pairOk = pair >= pairMin;
  const cardOk = card >= cardMin;
  const fixAccent = pairOk
    ? null
    : suggest(
        colors.secondary,
        colors.primary,
        (hex) => contrastRatio(colors.primary, hex) >= pairMin * fixMargin,
        (hex) => contrastRatio(colors.primary, hex),
      );
  const fixPrimary = cardOk
    ? null
    : suggest(
        colors.primary,
        colors.secondary,
        (hex) => contrastRatio(hex, CREST_CARD_BG) >= cardMin * fixMargin && contrastRatio(hex, colors.secondary) >= pairMin,
        (hex) => contrastRatio(hex, CREST_CARD_BG),
      );
  // A swap keeps the pair ratio; it helps when the accent is the one that reads on a card.
  const swapFixes = !cardOk && pairOk && contrastRatio(colors.secondary, CREST_CARD_BG) >= cardMin;
  return { pair, card, pairOk, cardOk, fixAccent, fixPrimary, swapFixes };
}

/** "1.6:1"-style label (one decimal). */
export function ratioLabel(ratio: number): string {
  return `${(Math.round(ratio * 10) / 10).toFixed(1)}:1`;
}
