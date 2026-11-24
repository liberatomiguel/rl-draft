/**
 * Friend duel (v2.1, O2 — DESIGN-DECISIONS #178): a Classic or Quick draft
 * played from a seed that travels in a link, so two players draft from the
 * same offers and face the same bracket field, then compare results.
 *
 * Pure: no React, no store, no dataset. This module owns the link format and
 * the comparison; the run store builds the draft from a `DuelSetup` the same
 * way the Daily builds its own (a fixed seed, a profile-independent pool).
 *
 * The link carries no personal data: the draft settings, the balance version
 * it was made on and up to `DUEL.maxEntries` anonymous results (placement and
 * the score line), in the URL hash, which the browser never sends to the
 * server. The code ends with a check value, so an edited or truncated link is
 * refused instead of opening a different draft. It is an integrity check, not
 * a signature: a link built by hand with a valid check still opens.
 *
 *   1.<seed>.<mode><difficulty><overall>.<region>.<balance>.<entries>.<check>
 *   entries = entry_entry_…   entry = p-sw-sl-pw-gw-gf-ga-ovr  (base 36)
 */

import { BALANCE_VERSION, DIFFICULTY, DUEL } from "@/config/balance";
import type { Difficulty, Placement, Region, RunMode, RunResults } from "./types";

export type DuelMode = Extract<RunMode, "classic" | "quick">;

/** Everything that decides the draft and the bracket field. */
export interface DuelSetup {
  /** The run seed (uint32): the draft's offers and the tournament field. */
  seed: number;
  mode: DuelMode;
  difficulty: Difficulty;
  /** null = worldwide. */
  region: Region | null;
  /** Overall visibility, the same for every side (Hard and Legacy hide it anyway). */
  showOverall: boolean;
  /** BALANCE_VERSION the link was made on: a different one may draw other offers. */
  balanceVersion: number;
}

/** One anonymous result in the link. */
export interface DuelEntry {
  placement: Placement;
  swissWins: number;
  swissLosses: number;
  playoffWins: number;
  gameWins: number;
  goalsFor: number;
  goalsAgainst: number;
  teamOverall: number;
}

export interface DuelLink {
  setup: DuelSetup;
  /** In the order they were played (the first is the one who sent the first link). */
  entries: DuelEntry[];
}

export type DuelParseError = "missing" | "malformed" | "tampered" | "unsupported";

export type DuelParseResult =
  | { ok: true; link: DuelLink }
  | { ok: false; reason: DuelParseError };

/** Best first. Quick Draft's bracket uses the same names (no Swiss → no swiss_exit). */
export const DUEL_PLACEMENT_ORDER: readonly Placement[] = [
  "champion",
  "runner_up",
  "third",
  "fourth",
  "top4",
  "top6",
  "top8",
  "swiss_exit",
];

const FORMAT = "1";
const MODES: Record<string, DuelMode> = { c: "classic", q: "quick" };
const DIFFS: Record<string, Difficulty> = { e: "easy", n: "normal", h: "hard", l: "legacy" };
const REGIONS: readonly Region[] = ["NA", "EU", "SAM", "MENA", "OCE", "APAC", "SSA"];
/** Upper bounds per entry field (generous; a real run stays well inside). */
const ENTRY_MAX = [DUEL_PLACEMENT_ORDER.length - 1, 9, 9, 9, 99, 999, 999, 199] as const;

/** The hash key of the link (`/duel#c=<code>`). */
export const DUEL_HASH_KEY = "c";

const invert = <T extends string>(m: Record<string, T>) =>
  Object.fromEntries(Object.entries(m).map(([k, v]) => [v, k])) as Record<T, string>;
const MODE_CODE = invert(MODES);
const DIFF_CODE = invert(DIFFS);

/** FNV-1a, 32 bits, base 36 — the link's check value. */
function check(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/**
 * The tournament's own seed, derived from the run seed: the bracket field no
 * longer depends on how many rerolls a side spent in the draft, so both sides
 * face the same opponents.
 */
export function duelTournamentSeed(seed: number): number {
  return (Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) ^ 0x5bd1e995) >>> 0;
}

/**
 * A new duel on a player's setup, with no runs yet. The seed comes from the
 * caller (`randomSeed()`), so this stays deterministic. Hard and Legacy hide
 * the overalls whatever the toggle says, as in a normal run.
 */
export function freshDuel(
  opts: { mode: DuelMode; difficulty: Difficulty; region: Region | null; showOverall: boolean },
  seed: number,
): DuelLink {
  return {
    setup: {
      seed: seed >>> 0,
      mode: opts.mode,
      difficulty: opts.difficulty,
      region: opts.region,
      showOverall: DIFFICULTY[opts.difficulty].overallLockedHidden ? false : opts.showOverall,
      balanceVersion: BALANCE_VERSION,
    },
    entries: [],
  };
}

/** This run's line in the link (the team overall as the player saw it). */
export function duelEntryFromResults(results: RunResults, teamOverall: number): DuelEntry {
  return {
    placement: results.placement,
    swissWins: results.swissRecord.wins,
    swissLosses: results.swissRecord.losses,
    playoffWins: results.playoffWins,
    gameWins: results.userGameWins,
    goalsFor: results.userGoals,
    goalsAgainst: results.goalsConceded,
    teamOverall,
  };
}

/** The kept entries: the first run and the latest replies, at most `DUEL.maxEntries`. */
export function capEntries(entries: readonly DuelEntry[]): DuelEntry[] {
  const max = DUEL.maxEntries;
  if (entries.length <= max) return [...entries];
  return [entries[0], ...entries.slice(entries.length - (max - 1))];
}

function encodeEntry(e: DuelEntry): string {
  const p = DUEL_PLACEMENT_ORDER.indexOf(e.placement);
  return [p, e.swissWins, e.swissLosses, e.playoffWins, e.gameWins, e.goalsFor, e.goalsAgainst, e.teamOverall]
    .map((n, i) => Math.min(ENTRY_MAX[i], Math.max(0, Math.round(n))).toString(36))
    .join("-");
}

/** The link code (the part after `#c=`). */
export function encodeDuel(link: DuelLink): string {
  const s = link.setup;
  const body = [
    FORMAT,
    (s.seed >>> 0).toString(36),
    `${MODE_CODE[s.mode]}${DIFF_CODE[s.difficulty]}${s.showOverall ? 1 : 0}`,
    s.region ?? "w",
    Math.max(0, Math.round(s.balanceVersion)).toString(36),
    capEntries(link.entries).map(encodeEntry).join("_"),
  ].join(".");
  return `${body}.${check(body)}`;
}

const B36 = /^[0-9a-z]{1,7}$/;

function int36(text: string, max: number): number | null {
  if (!B36.test(text)) return null;
  const n = parseInt(text, 36);
  return Number.isSafeInteger(n) && n >= 0 && n <= max ? n : null;
}

function parseEntry(text: string): DuelEntry | null {
  const parts = text.split("-");
  if (parts.length !== ENTRY_MAX.length) return null;
  const n = parts.map((p, i) => int36(p, ENTRY_MAX[i]));
  if (n.some((v) => v === null)) return null;
  const [p, sw, sl, pw, gw, gf, ga, ovr] = n as number[];
  return {
    placement: DUEL_PLACEMENT_ORDER[p],
    swissWins: sw,
    swissLosses: sl,
    playoffWins: pw,
    gameWins: gw,
    goalsFor: gf,
    goalsAgainst: ga,
    teamOverall: ovr,
  };
}

/** Parse a link code. Never throws: anything off reads as an error reason. */
export function parseDuel(code: string | null | undefined): DuelParseResult {
  if (typeof code !== "string" || code.trim() === "") return { ok: false, reason: "missing" };
  const text = code.trim();
  if (text.length > 400) return { ok: false, reason: "malformed" };
  const parts = text.split(".");
  if (parts[0] !== FORMAT) return { ok: false, reason: parts.length >= 3 && /^\d+$/.test(parts[0]) ? "unsupported" : "malformed" };
  if (parts.length !== 7) return { ok: false, reason: "malformed" };
  const [, seedText, flags, regionText, balanceText, entriesText, checkText] = parts;
  if (check(parts.slice(0, 6).join(".")) !== checkText) return { ok: false, reason: "tampered" };

  const seed = int36(seedText, 0xffffffff);
  const mode = MODES[flags[0]];
  const difficulty = DIFFS[flags[1]];
  const overall = flags[2];
  const region = regionText === "w" ? null : (REGIONS as readonly string[]).includes(regionText) ? (regionText as Region) : undefined;
  const balanceVersion = int36(balanceText, 99999);
  if (seed === null || !mode || !difficulty || flags.length !== 3 || (overall !== "0" && overall !== "1") || region === undefined || balanceVersion === null) {
    return { ok: false, reason: "malformed" };
  }
  const entries: DuelEntry[] = [];
  if (entriesText !== "") {
    const list = entriesText.split("_");
    if (list.length > DUEL.maxEntries) return { ok: false, reason: "malformed" };
    for (const item of list) {
      const entry = parseEntry(item);
      if (!entry) return { ok: false, reason: "malformed" };
      // Quick Draft has no Swiss stage: a Swiss record or a Swiss exit there is not a real run.
      if (mode === "quick" && (entry.swissWins > 0 || entry.swissLosses > 0 || entry.placement === "swiss_exit")) {
        return { ok: false, reason: "malformed" };
      }
      entries.push(entry);
    }
  }
  return {
    ok: true,
    link: {
      setup: { seed, mode, difficulty, region, showOverall: overall === "1", balanceVersion },
      entries,
    },
  };
}

/** Read the code out of a URL hash (`#c=…`), tolerant of a leading `#` and other keys. */
export function duelCodeFromHash(hash: string): string | null {
  const text = hash.startsWith("#") ? hash.slice(1) : hash;
  for (const pair of text.split("&")) {
    const eq = pair.indexOf("=");
    if (eq > 0 && pair.slice(0, eq) === DUEL_HASH_KEY) {
      try {
        return decodeURIComponent(pair.slice(eq + 1));
      } catch {
        return null;
      }
    }
  }
  return null;
}

/** The share path of a duel (`/duel#c=…`), to be joined to the site URL. */
export function duelPath(link: DuelLink): string {
  return `/duel#${DUEL_HASH_KEY}=${encodeDuel(link)}`;
}

/**
 * Order two results: placement first, then Swiss wins, playoff series won,
 * games won and goal difference. Negative = `a` is better, 0 = dead level.
 */
export function compareEntries(a: DuelEntry, b: DuelEntry): number {
  const place = DUEL_PLACEMENT_ORDER.indexOf(a.placement) - DUEL_PLACEMENT_ORDER.indexOf(b.placement);
  if (place !== 0) return place;
  const keys: ((e: DuelEntry) => number)[] = [
    (e) => e.swissWins,
    (e) => e.playoffWins,
    (e) => e.gameWins,
    (e) => e.goalsFor - e.goalsAgainst,
  ];
  for (const key of keys) {
    const d = key(b) - key(a);
    if (d !== 0) return d;
  }
  return 0;
}

/** Standings of the runs (competition ranking: equal results share a place). */
export function duelStandings(entries: readonly DuelEntry[]): { entry: DuelEntry; index: number; rank: number }[] {
  const sorted = entries
    .map((entry, index) => ({ entry, index }))
    .sort((x, y) => compareEntries(x.entry, y.entry) || x.index - y.index);
  return sorted.map((row, i) => {
    let rank = i + 1;
    for (let j = i - 1; j >= 0 && compareEntries(sorted[j].entry, row.entry) === 0; j--) rank = j + 1;
    return { ...row, rank };
  });
}

/** How `mine` did against each earlier run in the link: wins, draws, losses. */
export function duelVerdict(mine: DuelEntry, others: readonly DuelEntry[]): { beat: number; level: number; lost: number } {
  let beat = 0;
  let level = 0;
  let lost = 0;
  for (const o of others) {
    const c = compareEntries(mine, o);
    if (c < 0) beat += 1;
    else if (c === 0) level += 1;
    else lost += 1;
  }
  return { beat, level, lost };
}
