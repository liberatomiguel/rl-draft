/**
 * Road to Worlds save file (v2.0.26) — export a career to a file and import it
 * back, on this browser or another one. It is the way to move a career without
 * an account (roadmap decision D4: the cloud copy needs an account; a guest gets
 * the file).
 *
 * PURE: text in, text out. The store supplies `migrate` (the existing additive
 * save migrations) and `probe` (a read of the save the way the screens read it),
 * so this module needs neither the engine nor the store.
 *
 * The file is plain JSON, readable and editable. The checksum catches a
 * truncated or damaged file; it is not a lock. A player who edits the file could
 * already edit localStorage, so nothing new is exposed.
 */

import type { CareerSave } from "@/engine/career/types";

export const SAVE_FILE_FORMAT = "rocket-draft-career-save";
export const SAVE_FILE_VERSION = 1;
/** Refuse anything larger before parsing it (a real save is under 1 MB). */
export const SAVE_FILE_MAX_CHARS = 6_000_000;

export interface SaveFileEnvelope {
  format: typeof SAVE_FILE_FORMAT;
  formatVersion: number;
  /** ISO time of the export, and the release that wrote it (for support). */
  exportedAt: string;
  release: string;
  /** FNV-1a (32-bit, hex) of `JSON.stringify(save)`. */
  checksum: string;
  save: CareerSave;
}

export type SaveFileError =
  /** Not JSON at all, or far too large. */
  | "unreadable"
  /** JSON, but not a Rocket Draft career save file. */
  | "not-a-save"
  /** Written by a newer build than this one. */
  | "newer"
  /** The checksum does not match: truncated or damaged. */
  | "damaged"
  /** It parses and matches, but the game cannot load it. */
  | "invalid";

export type SaveFileResult = { ok: true; save: CareerSave } | { ok: false; error: SaveFileError };

/** FNV-1a over UTF-16 code units, as 8 hex digits. */
export function checksumOf(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/** The file's text for one save. */
export function buildSaveFile(save: CareerSave, meta: { release: string; now: Date }): string {
  const envelope: SaveFileEnvelope = {
    format: SAVE_FILE_FORMAT,
    formatVersion: SAVE_FILE_VERSION,
    exportedAt: meta.now.toISOString(),
    release: meta.release,
    checksum: checksumOf(JSON.stringify(save)),
    save,
  };
  return JSON.stringify(envelope);
}

/** A safe file name: `rocket-draft-<abbrev>-season-<n>.json`. */
export function saveFileName(save: CareerSave): string {
  const tag = (save.identity?.abbrev || save.identity?.orgName || "career")
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "") // "Ação" -> "Acao", not "Ac-a-o"
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 24);
  return `rocket-draft-${tag || "career"}-season-${(save.clock?.seasonIndex ?? 0) + 1}.json`;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isCount = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0;
const isOptionalCount = (v: unknown): boolean => v === undefined || v === null || isCount(v);

/** The fields every screen reads before anything else. A save that lacks one
 *  would crash the saves list itself, so it is refused here. */
export function looksLikeCareerSave(v: unknown): v is CareerSave {
  if (!isObject(v)) return false;
  const identity = v.identity;
  const clock = v.clock;
  const finances = v.finances;
  return (
    isCount(v.saveVersion) &&
    v.saveVersion >= 1 &&
    isObject(identity) &&
    typeof identity.orgName === "string" &&
    isObject(clock) &&
    isCount(clock.seasonIndex) &&
    Array.isArray(v.squad) &&
    Array.isArray(v.starterIds) &&
    isObject(finances) &&
    typeof finances.balance === "number" &&
    isObject(v.world) &&
    isObject(v.stats) &&
    typeof v.difficulty === "string" &&
    // What the account copy is keyed and compared by: a hand-edited id of the
    // wrong type or length would fail every write, and a non-number stamp or
    // counter would break the comparisons.
    (v.careerId === undefined || (typeof v.careerId === "string" && v.careerId.length >= 1 && v.careerId.length <= 64)) &&
    isOptionalCount(v.seq) &&
    isOptionalCount(v.lastPlayedAt) &&
    typeof v.careerSeed === "number"
  );
}

export interface ParseSaveFileOptions {
  /** The newest `saveVersion` this build can load. */
  maxSaveVersion: number;
  /** The game's own additive migrations, run on a copy; null = cannot be loaded. */
  migrate: (raw: CareerSave) => CareerSave | null;
  /** Reads the save the way the screens do; must throw when it cannot. */
  probe: (save: CareerSave) => void;
}

/** Read a save file. Never throws: every problem is a named error. */
export function parseSaveFile(text: string, opts: ParseSaveFileOptions): SaveFileResult {
  if (typeof text !== "string" || text.length === 0 || text.length > SAVE_FILE_MAX_CHARS) return { ok: false, error: "unreadable" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: "unreadable" };
  }
  if (!isObject(parsed) || parsed.format !== SAVE_FILE_FORMAT || !isCount(parsed.formatVersion)) return { ok: false, error: "not-a-save" };
  if (parsed.formatVersion > SAVE_FILE_VERSION) return { ok: false, error: "newer" };
  const raw = parsed.save;
  if (!looksLikeCareerSave(raw)) return { ok: false, error: "not-a-save" };
  if (raw.saveVersion > opts.maxSaveVersion) return { ok: false, error: "newer" };
  if (typeof parsed.checksum !== "string" || parsed.checksum !== checksumOf(JSON.stringify(raw))) return { ok: false, error: "damaged" };
  try {
    const save = opts.migrate(raw);
    if (!save || !looksLikeCareerSave(save)) return { ok: false, error: "invalid" };
    opts.probe(save);
    return { ok: true, save };
  } catch {
    return { ok: false, error: "invalid" };
  }
}
