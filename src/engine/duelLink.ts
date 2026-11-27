/**
 * Team-against-team duel: the links (rc.9, DESIGN-DECISIONS #228).
 *
 * Two links, same style as the old duel's (compact, base 36, a check value at
 * the end, in the URL hash, which the browser never sends to a server):
 *
 *   challenge  2.c.<seed>.<rules>.<region>.<balance>.<name>.<team>.<check>
 *   reply      2.r.<seed>.<rules>.<region>.<balance>.<nameA>.<teamA>.<nameB>.<teamB>.<check>
 *
 *   rules = <mode c|q><overall 0|1><rerolls base 36>
 *   team  = card_card_card[_coach_sub_orgLineup]     card = id | id+special
 *   name  = letters, digits and "-" as they are; anything else as ~xxxx (the
 *           UTF-16 unit in hex); at most DUEL_MATCH.maxNameLength units
 *
 * The challenge carries the rules, the seed and the challenger's name and
 * team. The reply adds the opponent's, so the challenger opens it and plays
 * the same series (`playDuel`). Cards go by id, never by data. The check is an
 * integrity value, not a signature: a link built by hand with a valid check
 * still opens (nothing is at stake). The old duel's links start with `1.` and
 * parse as "unsupported".
 *
 * Light on purpose: no dataset import. Whether the cards exist in this version
 * is `isKnownDuelTeam` in duelMatch.ts.
 */

import { DUEL_MATCH } from "@/config/balance";
import {
  DUEL_REGIONS,
  nextDuelRules,
  type DuelCard,
  type DuelMode,
  type DuelRules,
  type DuelSide,
  type DuelSideKey,
  type DuelTeamCards,
} from "./duelRules";
import type { Region } from "./types";

/** The challenger's link: rules, seed, and the challenger's name and team. */
export interface DuelChallenge {
  kind: "challenge";
  rules: DuelRules;
  challenger: DuelSide;
}

/** The reply: both teams, so the challenger can watch the same series. */
export interface DuelReply {
  kind: "reply";
  rules: DuelRules;
  challenger: DuelSide;
  opponent: DuelSide;
}

export type DuelCode = DuelChallenge | DuelReply;

export type DuelParseError = "missing" | "malformed" | "tampered" | "unsupported";

export type DuelParseResult = { ok: true; code: DuelCode } | { ok: false; reason: DuelParseError };

const FORMAT = "2";
const MODES: Record<string, DuelMode> = { c: "classic", q: "quick" };
const MODE_CODE: Record<DuelMode, string> = { classic: "c", quick: "q" };
const ID = /^[a-z0-9-]{1,64}$/;
const B36 = /^[0-9a-z]{1,7}$/;

/** The hash key of the link (`/duel#c=<code>`), as before. */
export const DUEL_CODE_KEY = "c";

/** FNV-1a, 32 bits, base 36 — the link's check value (the old duel's). */
function check(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

// --- names -----------------------------------------------------------------

/** A name a link can carry: trimmed, single spaces, no control characters, at most 16 units. */
export function sanitizeDuelName(name: string): string {
  const cleaned = name.replace(/[\p{Cc}\p{Zl}\p{Zp}]/gu, " ").replace(/\s+/g, " ").trim();
  let out = "";
  for (const ch of Array.from(cleaned)) {
    if ((out + ch).length > DUEL_MATCH.maxNameLength) break;
    out += ch;
  }
  return out;
}

function encodeName(name: string): string {
  let out = "";
  for (const ch of sanitizeDuelName(name)) {
    for (let i = 0; i < ch.length; i++) {
      const code = ch.charCodeAt(i);
      const plain = (code >= 48 && code <= 57) || (code >= 65 && code <= 90) || (code >= 97 && code <= 122) || code === 45;
      out += plain ? ch[i] : `~${code.toString(16).padStart(4, "0")}`;
    }
  }
  return out;
}

function decodeName(text: string): string | null {
  if (!/^(?:[A-Za-z0-9-]|~[0-9a-f]{4})*$/.test(text)) return null;
  const name = text.replace(/~([0-9a-f]{4})/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)));
  return name.length <= DUEL_MATCH.maxNameLength ? name : null;
}

// --- teams -----------------------------------------------------------------

const encodeCard = (c: DuelCard) => (c.sp ? `${c.id}+${c.sp}` : c.id);

function encodeTeam(team: DuelTeamCards): string {
  const cards = [...team.players].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)).map(encodeCard);
  if (team.coach && team.sub && team.orgLineup) cards.push(encodeCard(team.coach), encodeCard(team.sub), team.orgLineup);
  return cards.join("_");
}

function parseCard(text: string): DuelCard | null {
  const [id, sp, extra] = text.split("+");
  if (extra !== undefined || !ID.test(id) || (sp !== undefined && !ID.test(sp))) return null;
  return sp === undefined ? { id } : { id, sp };
}

function parseTeam(text: string, mode: DuelMode): DuelTeamCards | null {
  const parts = text.split("_");
  if (parts.length !== (mode === "quick" ? 3 : 6)) return null;
  const cards = parts.slice(0, mode === "quick" ? 3 : 5).map(parseCard);
  if (cards.some((c) => c === null)) return null;
  const [p1, p2, p3, coach, sub] = cards as DuelCard[];
  if (new Set([p1.id, p2.id, p3.id]).size !== 3) return null;
  if (mode === "quick") return { players: [p1, p2, p3] };
  const orgLineup = parts[5];
  if (!ID.test(orgLineup)) return null;
  return { players: [p1, p2, p3], coach, sub, orgLineup };
}

// --- encode ----------------------------------------------------------------

function rulesFields(r: DuelRules): string[] {
  return [
    (r.seed >>> 0).toString(36),
    `${MODE_CODE[r.mode]}${r.showOverall ? 1 : 0}${Math.min(DUEL_MATCH.maxRerolls, Math.max(0, Math.round(r.rerolls))).toString(36)}`,
    r.region ?? "w",
    Math.max(0, Math.round(r.balanceVersion)).toString(36),
  ];
}

/** The link code (the part after `#c=`). */
export function encodeDuelCode(code: DuelCode): string {
  const fields = [FORMAT, code.kind === "challenge" ? "c" : "r", ...rulesFields(code.rules)];
  fields.push(encodeName(code.challenger.name), encodeTeam(code.challenger.team));
  if (code.kind === "reply") fields.push(encodeName(code.opponent.name), encodeTeam(code.opponent.team));
  const body = fields.join(".");
  return `${body}.${check(body)}`;
}

/** A challenge link: the rules and the challenger. */
export function makeDuelChallenge(rules: DuelRules, challenger: DuelSide): DuelChallenge {
  return { kind: "challenge", rules, challenger: { name: sanitizeDuelName(challenger.name), team: challenger.team } };
}

/** The reply to a challenge: the same rules and challenger, plus the opponent. */
export function makeDuelReply(challenge: DuelChallenge | DuelReply, opponent: DuelSide): DuelReply {
  return {
    kind: "reply",
    rules: challenge.rules,
    challenger: challenge.challenger,
    opponent: { name: sanitizeDuelName(opponent.name), team: opponent.team },
  };
}

// --- parse -----------------------------------------------------------------

function int36(text: string, max: number): number | null {
  if (!B36.test(text)) return null;
  const n = parseInt(text, 36);
  return Number.isSafeInteger(n) && n >= 0 && n <= max ? n : null;
}

function parseRules(seedText: string, flags: string, regionText: string, balanceText: string): DuelRules | null {
  const seed = int36(seedText, 0xffffffff);
  const mode = MODES[flags[0]];
  const overall = flags[1];
  const rerolls = int36(flags.slice(2), DUEL_MATCH.maxRerolls);
  const region: Region | null | undefined =
    regionText === "w" ? null : (DUEL_REGIONS as readonly string[]).includes(regionText) ? (regionText as Region) : undefined;
  const balanceVersion = int36(balanceText, 99999);
  if (seed === null || !mode || (overall !== "0" && overall !== "1") || rerolls === null || region === undefined || balanceVersion === null) {
    return null;
  }
  return { seed, mode, rerolls, showOverall: overall === "1", region, balanceVersion };
}

function parseSide(nameText: string, teamText: string, mode: DuelMode): DuelSide | null {
  const name = decodeName(nameText);
  const team = parseTeam(teamText, mode);
  return name === null || !team ? null : { name, team };
}

/** Parse a link code. Never throws: anything off reads as an error reason. */
export function parseDuelCode(code: string | null | undefined): DuelParseResult {
  if (typeof code !== "string" || code.trim() === "") return { ok: false, reason: "missing" };
  const text = code.trim();
  if (text.length > DUEL_MATCH.maxCodeLength) return { ok: false, reason: "malformed" };
  const parts = text.split(".");
  if (parts[0] !== FORMAT) {
    return { ok: false, reason: parts.length >= 3 && /^\d+$/.test(parts[0]) ? "unsupported" : "malformed" };
  }
  const kind = parts[1];
  const expected = kind === "c" ? 9 : kind === "r" ? 11 : 0;
  if (parts.length !== expected) return { ok: false, reason: "malformed" };
  if (check(parts.slice(0, -1).join(".")) !== parts[parts.length - 1]) return { ok: false, reason: "tampered" };

  const rules = parseRules(parts[2], parts[3], parts[4], parts[5]);
  if (!rules) return { ok: false, reason: "malformed" };
  const challenger = parseSide(parts[6], parts[7], rules.mode);
  if (!challenger) return { ok: false, reason: "malformed" };
  if (kind === "c") return { ok: true, code: { kind: "challenge", rules, challenger } };
  const opponent = parseSide(parts[8], parts[9], rules.mode);
  if (!opponent) return { ok: false, reason: "malformed" };
  return { ok: true, code: { kind: "reply", rules, challenger, opponent } };
}

/** Read the code out of a URL hash (`#c=…`), tolerant of a leading `#` and other keys. */
export function readDuelHash(hash: string): string | null {
  const text = hash.startsWith("#") ? hash.slice(1) : hash;
  for (const pair of text.split("&")) {
    const eq = pair.indexOf("=");
    if (eq > 0 && pair.slice(0, eq) === DUEL_CODE_KEY) {
      try {
        return decodeURIComponent(pair.slice(eq + 1));
      } catch {
        return null;
      }
    }
  }
  return null;
}

/** The share path of a link (`/duel#c=…`), to be joined to the site URL. */
export function duelCodePath(code: DuelCode): string {
  return `/duel#${DUEL_CODE_KEY}=${encodeDuelCode(code)}`;
}

/**
 * The next match after a finished one: the same rules on a new seed derived
 * from the old, and whoever asks becomes the challenger (they draft first and
 * send the new challenge). Nothing is stored between matches: a record of wins
 * is out of scope, and the persist contract stays as it is.
 */
export function duelRematch(
  finished: DuelReply,
  asker: DuelSideKey,
): { rules: DuelRules; challengerName: string; opponentName: string } {
  const other: DuelSideKey = asker === "challenger" ? "opponent" : "challenger";
  return {
    rules: nextDuelRules(finished.rules),
    challengerName: finished[asker].name,
    opponentName: finished[other].name,
  };
}
