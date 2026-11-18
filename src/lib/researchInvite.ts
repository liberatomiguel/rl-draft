/**
 * The player-research invitation (v2.0.31): who is asked, and the one stored
 * answer that keeps it from asking twice. Config: `src/config/research.ts`.
 *
 * Who: a RETURNING player only. From the second distinct day with the game
 * open (`minActiveDays`), `minRuns` completed draft runs or `minCareerSeasons`
 * completed seasons in the career on screen; on the first day only a heavy
 * session (`firstDayRuns` / `firstDayCareerSeasons`). A new or light player
 * never sees it.
 *
 * Once: the answer lives in its own plain localStorage key (not a zustand
 * store, so the frozen persist contract does not move). It is PER DEVICE, not
 * per account owner: the form asks about the person, and since v2.0.29 a
 * sign-out leaves a fresh guest that is not eligible anyway (no runs, no
 * days), so the device-wide answer can never hide the card from someone who
 * should see it, and two accounts on one device are not asked twice. A click
 * on the link or a dismiss ends it for the campaign; an unanswered card (the
 * tab closed while it was open) may open again up to `maxShows` times.
 *
 * Each step falls back to memory when storage is missing or blocked.
 */

import { RESEARCH_INVITE } from "@/config/research";

export const RESEARCH_INVITE_KEY = "rocket-draft:research-invite:v1";

export type ResearchOutcome = "opened" | "dismissed";
export type ResearchSurface = "draft" | "career";

export interface ResearchRecord {
  campaign: string;
  shows: number;
  outcome: ResearchOutcome | null;
}

/** What the client knows about the player when a pause comes. */
export interface ResearchSignals {
  /** Distinct days the game was opened (profile `login.total`). */
  activeDays: number;
  /** Completed draft runs (profile `runsCompleted`). */
  runsCompleted: number;
  /** Completed seasons in the career on screen (0 outside the career). */
  careerSeasons: number;
}

export interface ResearchConfig {
  enabled: boolean;
  campaign: string;
  minActiveDays: number;
  minRuns: number;
  minCareerSeasons: number;
  firstDayRuns: number;
  firstDayCareerSeasons: number;
  maxShows: number;
}

/**
 * A returning player: from `minActiveDays` (day 2) on, enough play in either
 * mode; before that (the first day) only a heavy session qualifies.
 */
export function isReturningPlayer(s: ResearchSignals, cfg: ResearchConfig = RESEARCH_INVITE): boolean {
  if (s.activeDays >= cfg.minActiveDays) {
    return s.runsCompleted >= cfg.minRuns || s.careerSeasons >= cfg.minCareerSeasons;
  }
  if (s.activeDays < 1) return false;
  return s.runsCompleted >= cfg.firstDayRuns || s.careerSeasons >= cfg.firstDayCareerSeasons;
}

/** Whether the card may still open for this campaign (no answer, shows left). */
export function inviteStillOpen(record: ResearchRecord | null, cfg: ResearchConfig = RESEARCH_INVITE): boolean {
  if (!record || record.campaign !== cfg.campaign) return true;
  return record.outcome === null && record.shows < cfg.maxShows;
}

export function shouldInvite(
  s: ResearchSignals,
  record: ResearchRecord | null,
  cfg: ResearchConfig = RESEARCH_INVITE,
): boolean {
  return cfg.enabled && isReturningPlayer(s, cfg) && inviteStillOpen(record, cfg);
}

// --- storage -----------------------------------------------------------------

type KeyStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

let memory: ResearchRecord | null = null;
let testStorage: KeyStore | null | undefined;
/** The card opens at most once per page load, whatever the storage says. */
let shownThisLoad = false;

function storage(): KeyStore | null {
  if (testStorage !== undefined) return testStorage;
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

function parse(raw: string | null): ResearchRecord | null {
  if (!raw) return null;
  try {
    const r = JSON.parse(raw) as Partial<ResearchRecord>;
    if (typeof r.campaign !== "string") return null;
    const shows = typeof r.shows === "number" && Number.isFinite(r.shows) ? Math.max(0, r.shows) : 0;
    const outcome = r.outcome === "opened" || r.outcome === "dismissed" ? r.outcome : null;
    return { campaign: r.campaign, shows, outcome };
  } catch {
    return null;
  }
}

export function readResearchRecord(): ResearchRecord | null {
  try {
    const ls = storage();
    if (ls) return parse(ls.getItem(RESEARCH_INVITE_KEY)) ?? memory;
  } catch {
    // fall through to memory
  }
  return memory;
}

function write(record: ResearchRecord): void {
  memory = record;
  try {
    storage()?.setItem(RESEARCH_INVITE_KEY, JSON.stringify(record));
  } catch {
    // memory still holds it for this tab
  }
}

/** This campaign's record, or a fresh one (an older campaign's answer does not carry over). */
function current(cfg: ResearchConfig): ResearchRecord {
  const r = readResearchRecord();
  return r && r.campaign === cfg.campaign ? r : { campaign: cfg.campaign, shows: 0, outcome: null };
}

/** Decide at a pause: true = open the card now (and count the show). */
export function claimResearchInvite(s: ResearchSignals, cfg: ResearchConfig = RESEARCH_INVITE): boolean {
  if (shownThisLoad) return false;
  if (!shouldInvite(s, readResearchRecord(), cfg)) return false;
  const r = current(cfg);
  write({ ...r, shows: r.shows + 1 });
  shownThisLoad = true;
  return true;
}

/** The player answered: the card never opens again for this campaign. */
export function settleResearchInvite(outcome: ResearchOutcome, cfg: ResearchConfig = RESEARCH_INVITE): void {
  const r = current(cfg);
  if (r.outcome) return; // the first answer stands
  write({ ...r, outcome });
}

/** Tests only: a stand-in storage (null = none), or undefined for the real one. */
export function setResearchStorageForTests(s: KeyStore | null | undefined): void {
  testStorage = s;
}

/** Tests only: forget the memory copy and the per-load guard. */
export function resetResearchInviteForTests(): void {
  memory = null;
  shownThisLoad = false;
}
