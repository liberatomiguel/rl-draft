/**
 * Team-against-team duel (rc.9, DESIGN-DECISIONS #225-#229): the rules the
 * challenger sets. Pure and light: no dataset import, so the /duel page can
 * parse a link without loading the game's data.
 *
 * The draft is `duelDraft.ts`, the series is `duelMatch.ts`, the link is
 * `duelLink.ts`, the words for the screens are `duelViews.ts`.
 */

import { BALANCE_VERSION, DUEL_MATCH } from "@/config/balance";
import { deriveSeed } from "./career/seeds";
import type { Region } from "./types";

export type DuelMode = "classic" | "quick";

/** Who is who in a duel: the challenger sent the first link, the opponent answers it. */
export type DuelSideKey = "challenger" | "opponent";

/** Everything the challenger sets. Both friends draft and play on exactly this. */
export interface DuelRules {
  /** uint32: the boards both friends draft from, and the series' own rolls. */
  seed: number;
  mode: DuelMode;
  /** Rerolls for the whole draft (a preset: 0, 3 or 7). */
  rerolls: number;
  /** Overalls visible while drafting. The same for both sides. */
  showOverall: boolean;
  /** null = worldwide. */
  region: Region | null;
  /** BALANCE_VERSION the link was made on: another one may draw other boards. */
  balanceVersion: number;
}

/** One drafted card as the link carries it: ids only, never card data. */
export interface DuelCard {
  /** Player card, coach or sub id. */
  id: string;
  /** The special card it appeared as, if any. */
  sp?: string;
}

/**
 * A drafted team, normalised: the three players sorted by card id (which slot
 * a player took changes nothing), then the coach, sub and the lineup the org
 * was drafted from (Classic only; Quick is the three players).
 */
export interface DuelTeamCards {
  players: DuelCard[];
  coach?: DuelCard;
  sub?: DuelCard;
  orgLineup?: string;
}

/** A side of the duel: a display name (may be empty) and its team. */
export interface DuelSide {
  name: string;
  team: DuelTeamCards;
}

export const DUEL_REGIONS: readonly Region[] = ["NA", "EU", "SAM", "MENA", "OCE", "APAC", "SSA"];

/** The nearest allowed reroll count (0..maxRerolls, whole numbers). */
export function clampDuelRerolls(n: number): number {
  if (!Number.isFinite(n)) return DUEL_MATCH.defaultRerolls;
  return Math.min(DUEL_MATCH.maxRerolls, Math.max(0, Math.round(n)));
}

/**
 * New rules from what the challenger picked. The seed comes from the caller
 * (`randomSeed()`), so this stays deterministic. Unset options take the
 * defaults in `DUEL_MATCH`.
 */
export function makeDuelRules(
  opts: { mode?: DuelMode; rerolls?: number; showOverall?: boolean; region?: Region | null },
  seed: number,
): DuelRules {
  return {
    seed: seed >>> 0,
    mode: opts.mode ?? "classic",
    rerolls: clampDuelRerolls(opts.rerolls ?? DUEL_MATCH.defaultRerolls),
    showOverall: opts.showOverall ?? DUEL_MATCH.defaultShowOverall,
    region: opts.region ?? null,
    balanceVersion: BALANCE_VERSION,
  };
}

/** True when the link was made on another balance: the boards or the series may differ. */
export function isStaleDuel(rules: Pick<DuelRules, "balanceVersion">): boolean {
  return rules.balanceVersion !== BALANCE_VERSION;
}

/** The seed of the next match, derived from this one. */
export function nextDuelSeed(seed: number): number {
  return deriveSeed(seed >>> 0, "duel:next");
}

/** Sub-seed of one draft stream, so no friend's actions can move another's boards. */
export function duelStreamSeed(seed: number, stream: string): number {
  return deriveSeed(seed >>> 0, `duel:${stream}`);
}

/** The same rules on a new seed, for the next match. */
export function nextDuelRules(rules: DuelRules): DuelRules {
  return { ...rules, seed: nextDuelSeed(rules.seed), balanceVersion: BALANCE_VERSION };
}

/**
 * The exhibition rule (DESIGN-DECISIONS #184, kept): a duel pays nothing. The
 * duel modules never import the profile, progression, missions or achievements
 * (duelExhibition.test.ts reads their sources to prove it), so nothing in them
 * can grant. The screens read this to say it.
 */
export const DUEL_GRANTS = { xp: 0, seasonRating: 0, cards: false, missions: false, achievements: false } as const;
