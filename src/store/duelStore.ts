/**
 * rc9 duel-ui (DESIGN-DECISIONS #294-#297): the team-against-team duel's bits
 * that are not the draft. Light on purpose (no dataset, no run store), so
 * /duel can read a link before the game's data loads.
 *
 *  - `trackDuel`: the one analytics event of the loop, `duel_played`.
 *  - The duel record: which duels this browser took part in, so the same link
 *    reads right for each side (the challenger's own link is "send it", not
 *    "answer it"; a challenge already answered offers the match). A plain
 *    localStorage key, not a zustand store: nothing in the persist contract
 *    moves. It holds link codes only (no profile data), at most
 *    `RECORD_MAX` entries, and the game works without it (private window).
 *
 * The v2.1 duel's session notice (`useDuelNotice`) is gone with that duel.
 * It was never persisted.
 */

import type { DuelRules, DuelSideKey } from "@/engine/duelRules";
import { isStaleDuel } from "@/engine/duelRules";
import { trackEvent } from "@/lib/analytics";

export type DuelAction = "created" | "answered" | "finished" | "rematch" | "invalid";

/** One `duel_played` event. Never the seed, the names or the link. */
export function trackDuel(
  action: DuelAction,
  rules: DuelRules | null,
  extra: { rerollsUsed?: number; games?: number; winner?: DuelSideKey; viewer?: DuelSideKey; reason?: string } = {},
): void {
  trackEvent("duel_played", {
    action,
    mode: rules?.mode ?? null,
    region: rules ? (rules.region ?? "worldwide") : null,
    rerolls: rules?.rerolls ?? null,
    showOverall: rules?.showOverall ?? null,
    staleVersion: rules ? isStaleDuel(rules) : null,
    rerollsUsed: extra.rerollsUsed ?? null,
    games: extra.games ?? null,
    winner: extra.winner ?? null,
    viewer: extra.viewer ?? null,
    reason: extra.reason ?? null,
  });
}

// --- the duel record --------------------------------------------------------

/** Plain localStorage key (outside the zustand persist contract, like the share prompts' record). */
export const DUEL_RECORD_KEY = "rocket-draft:duels:v1";
const RECORD_MAX = 20;

interface DuelRecordEntry {
  /** The challenge's check value (the last field of its code). */
  k: string;
  /** This browser's side: c = challenger, o = opponent. */
  r: "c" | "o";
  /** The opponent's reply code, once they drafted. */
  reply?: string;
  t: number;
}

/** The key of a duel: the check value of its challenge code (a reply's challenge has the same). */
export function duelKeyOf(challengeCode: string): string {
  const parts = challengeCode.split(".");
  return parts[parts.length - 1] ?? "";
}

function readRecord(): DuelRecordEntry[] {
  try {
    const raw = window.localStorage.getItem(DUEL_RECORD_KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(list)) return [];
    return list.filter(
      (e): e is DuelRecordEntry =>
        !!e && typeof e === "object" && typeof (e as DuelRecordEntry).k === "string" && ((e as DuelRecordEntry).r === "c" || (e as DuelRecordEntry).r === "o"),
    );
  } catch {
    return [];
  }
}

/** Note this browser's side of a duel (and the reply it made). Never throws. */
export function rememberDuel(challengeCode: string, role: DuelSideKey, replyCode?: string): void {
  try {
    const k = duelKeyOf(challengeCode);
    const rest = readRecord().filter((e) => e.k !== k);
    const entry: DuelRecordEntry = { k, r: role === "challenger" ? "c" : "o", t: Date.now(), ...(replyCode ? { reply: replyCode } : {}) };
    window.localStorage.setItem(DUEL_RECORD_KEY, JSON.stringify([entry, ...rest].slice(0, RECORD_MAX)));
  } catch {
    // Storage off or full: the link still works, it reads as a stranger's.
  }
}

/** This browser's side of the duel with that challenge code, and its reply; null when it took no part. */
export function myDuelSide(challengeCode: string): { role: DuelSideKey; reply?: string } | null {
  const k = duelKeyOf(challengeCode);
  const e = readRecord().find((x) => x.k === k);
  if (!e) return null;
  return { role: e.r === "c" ? "challenger" : "opponent", ...(e.reply ? { reply: e.reply } : {}) };
}

// --- the name ---------------------------------------------------------------

const NAME_KEY = "rocket-draft:duel-name:v1";

/** The name the player last put on a duel ("" when none). */
export function lastDuelName(): string {
  try {
    return window.localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveDuelName(name: string): void {
  try {
    window.localStorage.setItem(NAME_KEY, name);
  } catch {
    // nothing to do
  }
}
