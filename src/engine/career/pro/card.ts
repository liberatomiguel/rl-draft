/**
 * v2.2 Pro (PRO-SPEC §9, R150): the final card. A small, versioned payload that
 * travels in the URL hash (`/career/pro/card#<payload>`, base64url), so the
 * site stays static: nothing is stored or served. `decodeCard` trusts nothing:
 * a tampered, truncated or foreign payload gives null or a clamped card, never
 * a throw. Which real legends he sits beside is NOT in the payload: it is
 * computed from the dataset when the page is drawn (`legendNeighbours`).
 */

import { CAREER_PRO, CAREER_PRO_AGING as A } from "@/config/balance";
import { clamp } from "@/lib/util";
import type { ArchetypeId } from "../types";
import { proOverall, round2 } from "./attrs";
import type { ProHonor, ProSave } from "./types";

export const CARD_VERSION = 1;

const ARCHETYPES: readonly string[] = ["mechanical", "anchor", "playmaker", "icecold", "veteranmind", "allround"];

export interface ProCard {
  v: typeof CARD_VERSION;
  name: string;
  /** ISO 3166-1 alpha-2, upper case ("" when unknown). */
  country: string;
  style: ArchetypeId;
  /** The highest overall he reached, one decimal. */
  peak: number;
  seasons: number;
  orgs: string[];
  /** Titles, one line each ("Worlds 2026"). */
  titles: string[];
  /** Gala awards, one line each ("MVP 2026"). */
  awards: string[];
  /** The best season average match rating, 0-10, one decimal (0 = none yet). */
  bestRating: number;
  /** A scene nickname earned on the way, or null. */
  nickname: string | null;
}

const text = (x: unknown, max: number = A.card.maxText): string =>
  typeof x === "string" ? x.replace(/[\u0000-\u001f\u007f<>]/g, "").replace(/\s+/g, " ").trim().slice(0, max) : "";

const list = (x: unknown): string[] =>
  Array.isArray(x) ? x.map((e) => text(e)).filter((e) => e.length > 0).slice(0, A.card.maxList) : [];

const num = (x: unknown, lo: number, hi: number, fallback: number): number =>
  typeof x === "number" && Number.isFinite(x) ? clamp(x, lo, hi) : fallback;

/**
 * The titles a card shows: the most important first (Worlds, Majors,
 * regionals, the rest), then the most recent, repeats of one event collapsed
 * ("SAM Regional 2 ×3"), and never more than the payload holds.
 */
export function titlesForCard(titles: readonly string[], cap: number = A.card.maxList): string[] {
  const groups = new Map<string, { name: string; years: number[]; tier: number }>();
  for (const raw of titles) {
    const m = /^(.*?)\s+(\d{4})$/.exec(raw.trim());
    const name = (m ? m[1] : raw).trim();
    if (!name) continue;
    const year = m ? Number(m[2]) : 0;
    const g = groups.get(name) ?? { name, years: [], tier: /world/i.test(name) ? 3 : /major/i.test(name) ? 2 : /regional/i.test(name) ? 1 : 0 };
    g.years.push(year);
    groups.set(name, g);
  }
  return [...groups.values()]
    .sort((a, b) => b.tier - a.tier || Math.max(...b.years) - Math.max(...a.years) || a.name.localeCompare(b.name))
    .slice(0, cap)
    .map((g) => (g.years.length > 1 ? `${g.name} ×${g.years.length}` : g.years[0] ? `${g.name} ${g.years[0]}` : g.name));
}

/** What a card needs beyond the save (the world's honours are the spine's and the gala's to hand over). */
export interface CardExtras {
  orgs?: string[];
  titles?: string[];
  awards?: string[];
  bestRating?: number;
  nickname?: string | null;
  /** Seasons played, when the clock is not the answer (a career that started mid-way). */
  seasons?: number;
}

/** The card of a career, from the save and what the world remembers. */
export function cardFromSave(save: ProSave, extras: CardExtras = {}): ProCard {
  const p = save.player;
  const last = save.bridge?.atSeason ?? save.clock.seasonIndex;
  return sanitizeCard({
    v: CARD_VERSION,
    name: p.name,
    country: p.country,
    style: p.archetype,
    peak: Math.max(p.peakOverall ?? 0, proOverall(p.attrs)),
    seasons: extras.seasons ?? last + 1,
    orgs: extras.orgs ?? [],
    titles: extras.titles ?? [],
    awards: extras.awards ?? [],
    bestRating: extras.bestRating ?? 0,
    nickname: extras.nickname ?? p.nickname ?? null,
  });
}

/**
 * The card's line for a gala win: a language-free key the page translates
 * ("mvp.world.2026"). Only wins go on the card, never a nomination.
 */
export function awardKey(h: Pick<ProHonor, "kind" | "scope" | "seasonIndex" | "place">, year: number): string | null {
  return h.place === "winner" ? `${h.kind}.${h.scope}.${year}` : null;
}

const AWARD_KEY = /^(mvp|breakout|teamOfSeason|mostDecisive)\.(region|world)\.(\d{4})$/;

/** The parts of an award key, or null when the line is plain text. */
export function parseAwardKey(line: string): { kind: string; scope: string; year: number } | null {
  const m = AWARD_KEY.exec(line);
  return m ? { kind: m[1], scope: m[2], year: Number(m[3]) } : null;
}

/** Clamp and clean every field; the one place a card gets its shape. */
export function sanitizeCard(c: object): ProCard {
  const r = c as Record<string, unknown>;
  const style = typeof r.style === "string" && ARCHETYPES.includes(r.style) ? (r.style as ArchetypeId) : "allround";
  const nick = text(r.nickname);
  return {
    v: CARD_VERSION,
    name: text(r.name, CAREER_PRO.nameMax) || "?",
    country: typeof r.country === "string" && /^[A-Za-z]{2}$/.test(r.country) ? r.country.toUpperCase() : "",
    style,
    peak: round2(num(r.peak, CAREER_PRO.attrMin, CAREER_PRO.attrMax, CAREER_PRO.attrMin)),
    seasons: Math.round(num(r.seasons, 0, 60, 0)),
    orgs: list(r.orgs),
    titles: list(r.titles),
    awards: list(r.awards),
    bestRating: Math.round(num(r.bestRating, 0, 10, 0) * 10) / 10,
    nickname: nick || null,
  };
}

/** The compact wire form: a fixed-order array, so the keys are not paid for. */
function toWire(c: ProCard): unknown[] {
  return [c.v, c.name, c.country, ARCHETYPES.indexOf(c.style), Math.round(c.peak * 10), c.seasons, c.orgs, c.titles, c.awards, Math.round(c.bestRating * 10), c.nickname];
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
}

export function encodeCard(card: ProCard): string {
  const json = JSON.stringify(toWire(sanitizeCard(card)));
  return toBase64Url(new TextEncoder().encode(json));
}

/** The card in a payload, or null when it is not one of ours. Never throws. */
export function decodeCard(payload: string): ProCard | null {
  try {
    const raw = payload.startsWith("#") ? payload.slice(1) : payload;
    if (raw.length === 0 || raw.length > 4000 || !/^[A-Za-z0-9_-]+$/.test(raw)) return null;
    const w: unknown = JSON.parse(new TextDecoder().decode(fromBase64Url(raw)));
    if (!Array.isArray(w) || w[0] !== CARD_VERSION) return null;
    const style = typeof w[3] === "number" ? ARCHETYPES[w[3]] : undefined;
    return sanitizeCard({
      name: w[1],
      country: w[2],
      style: style as string | undefined,
      peak: typeof w[4] === "number" ? w[4] / 10 : undefined,
      seasons: w[5],
      orgs: w[6],
      titles: w[7],
      awards: w[8],
      bestRating: typeof w[9] === "number" ? w[9] / 10 : undefined,
      nickname: w[10],
    });
  } catch {
    return null;
  }
}

export interface LegendEntry {
  name: string;
  /** The legend's best card overall in the dataset. */
  peak: number;
}

/**
 * The all-time ranking of real players: each one's best card overall, highest
 * first (ties: name). The card page builds it from `playerCards` + `players`.
 */
export function allTimeRanking(cards: readonly { playerId: string; overall: number }[], names: ReadonlyMap<string, string>): LegendEntry[] {
  const best = new Map<string, number>();
  for (const c of cards) best.set(c.playerId, Math.max(best.get(c.playerId) ?? 0, c.overall));
  return [...best.entries()]
    .map(([id, peak]) => ({ name: names.get(id) ?? id, peak }))
    .sort((a, b) => b.peak - a.peak || a.name.localeCompare(b.name));
}

export interface LegendNeighbours {
  /** His place if he were in the list (1 = above everyone), counting only legends above him. */
  place: number;
  of: number;
  /** The legends just above him (nearest first), and just below (nearest first). */
  above: LegendEntry[];
  below: LegendEntry[];
}

/** Where a peak overall sits in the all-time ranking, and between whom. A tie sits above the legend (he is the later arrival, so the tie is a credit to him). */
export function legendNeighbours(peak: number, ranking: readonly LegendEntry[], each = A.card.legendsEachSide): LegendNeighbours {
  const idx = ranking.findIndex((l) => l.peak <= peak);
  const cut = idx < 0 ? ranking.length : idx;
  return {
    place: cut + 1,
    of: ranking.length,
    above: ranking.slice(Math.max(0, cut - each), cut).reverse(),
    below: ranking.slice(cut, cut + each),
  };
}
