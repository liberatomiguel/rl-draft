/**
 * rc9 SHARE: when the game may suggest a share (DESIGN-DECISIONS #256, #257).
 * Numbers: `SHARE_PROMPTS` (config/balance.sharePrompts.ts).
 *
 *  · The invite prompt ("send the game to a friend") opens at most ONCE per
 *    device, ever: a returning player (not the first day), at a good moment
 *    (a podium run after a few runs, or the end of a career season). Shown is
 *    done: closing it in any way never brings it back.
 *  · The share-image prompt opens after a title (a draft won, a career
 *    regional, Major or Worlds), sparsely: never the first title, never on the
 *    title right after a prompted one, a cooldown of days between two, a cap
 *    per device, and "Don't show again" ends it. A lost run never asks.
 *  · Both share one budget: one prompt per session at most. The caller checks
 *    that nothing else is on screen before it claims.
 *
 * The record is one plain localStorage key outside the zustand stores (the
 * persist contract is frozen), per device like the research invitation. Every
 * read and write is wrapped: a blocked storage falls back to memory for the
 * tab, so a private window is asked at most once per load.
 */

import { SHARE_PROMPTS } from "@/config/balance";

export const SHARE_PROMPTS_KEY = "rocket-draft:share-prompts:v1";
const SESSION_KEY = "rocket-draft:share-prompt-session";

export type SharePromptConfig = typeof SHARE_PROMPTS;

export interface SharePromptRecord {
  /** ISO time the invite prompt opened (null = never). */
  inviteShownAt: string | null;
  /** Times the share-image prompt opened. */
  imageShows: number;
  imageLastShownAt: string | null;
  /** Titles won since the last image prompt (or since the start). */
  titlesSince: number;
  /** "Don't show again". */
  imageOptOut: boolean;
  /** The last title counted (a run or an event), so a remount never counts it twice. */
  lastTitleKey: string | null;
}

export const EMPTY_SHARE_PROMPTS: SharePromptRecord = {
  inviteShownAt: null,
  imageShows: 0,
  imageLastShownAt: null,
  titlesSince: 0,
  imageOptOut: false,
  lastTitleKey: null,
};

export interface InviteSignals {
  /** Distinct days the game was opened (profile `login.total`). */
  activeDays: number;
  runsCompleted: number;
  /** Completed seasons in the career on screen (0 outside the career). */
  careerSeasons: number;
  /** Where the pause is: the end of a draft run or a career season review. */
  moment: "run" | "season";
  /** The run's placement id (draft moment only). */
  placement?: string | null;
  /** A duel or a challenge run is not a moment to invite (it has its own link). */
  ordinaryRun?: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

// --- the rules (pure) ---------------------------------------------------------

export function inviteDue(s: InviteSignals, r: SharePromptRecord, promptedThisSession: boolean, cfg: SharePromptConfig = SHARE_PROMPTS): boolean {
  if (r.inviteShownAt || promptedThisSession) return false;
  if (s.activeDays < cfg.invite.minActiveDays) return false;
  if (s.moment === "season") return s.careerSeasons >= cfg.invite.minCareerSeasons;
  if (s.ordinaryRun === false) return false;
  return s.runsCompleted >= cfg.invite.minRuns && cfg.invite.goodPlacements.includes(s.placement ?? "");
}

export function imageDue(r: SharePromptRecord, now: number, promptedThisSession: boolean, cfg: SharePromptConfig = SHARE_PROMPTS): boolean {
  if (r.imageOptOut || promptedThisSession) return false;
  if (r.imageShows >= cfg.image.maxShows) return false;
  if (r.imageShows === 0) return r.titlesSince >= cfg.image.titlesBeforeFirst;
  if (r.titlesSince < cfg.image.titlesBetween) return false;
  const last = r.imageLastShownAt ? Date.parse(r.imageLastShownAt) : NaN;
  return !Number.isFinite(last) || now - last >= cfg.image.cooldownDays * DAY_MS;
}

/**
 * A title is won: the record after it, and whether the prompt opens for it.
 * The same title (a remount of the results) is decided once.
 */
export function onTitle(
  r: SharePromptRecord,
  titleKey: string,
  now: number,
  promptedThisSession: boolean,
  cfg: SharePromptConfig = SHARE_PROMPTS,
): { record: SharePromptRecord; show: boolean } {
  if (r.lastTitleKey === titleKey) return { record: r, show: false };
  if (imageDue(r, now, promptedThisSession, cfg)) {
    return {
      record: { ...r, imageShows: r.imageShows + 1, imageLastShownAt: new Date(now).toISOString(), titlesSince: 0, lastTitleKey: titleKey },
      show: true,
    };
  }
  return { record: { ...r, titlesSince: r.titlesSince + 1, lastTitleKey: titleKey }, show: false };
}

/** A career event's title may prompt only at the tiers named in the config. */
export function careerTitlePrompts(tier: string | null | undefined, cfg: SharePromptConfig = SHARE_PROMPTS): boolean {
  return Boolean(tier) && cfg.image.careerTiers.includes(tier as string);
}

// --- storage ---------------------------------------------------------------

type KeyStore = Pick<Storage, "getItem" | "setItem">;

let memory: SharePromptRecord | null = null;
let promptedThisLoad = false;
let testStorage: { local: KeyStore | null; session: KeyStore | null } | undefined;

function local(): KeyStore | null {
  if (testStorage) return testStorage.local;
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

function session(): KeyStore | null {
  if (testStorage) return testStorage.session;
  try {
    return typeof sessionStorage !== "undefined" ? sessionStorage : null;
  } catch {
    return null;
  }
}

function parse(raw: string | null): SharePromptRecord | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as Partial<SharePromptRecord>;
    if (!o || typeof o !== "object") return null;
    const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0);
    const str = (v: unknown) => (typeof v === "string" ? v : null);
    return {
      inviteShownAt: str(o.inviteShownAt),
      imageShows: num(o.imageShows),
      imageLastShownAt: str(o.imageLastShownAt),
      titlesSince: num(o.titlesSince),
      imageOptOut: o.imageOptOut === true,
      lastTitleKey: str(o.lastTitleKey),
    };
  } catch {
    return null;
  }
}

export function readSharePrompts(): SharePromptRecord {
  try {
    const parsed = parse(local()?.getItem(SHARE_PROMPTS_KEY) ?? null);
    if (parsed) return parsed;
  } catch {
    /* memory below */
  }
  return memory ?? EMPTY_SHARE_PROMPTS;
}

function write(r: SharePromptRecord): void {
  memory = r;
  try {
    local()?.setItem(SHARE_PROMPTS_KEY, JSON.stringify(r));
  } catch {
    /* memory holds it for this tab */
  }
}

export function promptedThisSession(): boolean {
  if (promptedThisLoad) return true;
  try {
    return session()?.getItem(SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

function markSession(): void {
  promptedThisLoad = true;
  try {
    session()?.setItem(SESSION_KEY, "1");
  } catch {
    /* the per-load flag holds */
  }
}

/** A title was won and the screen is clear: true = open the share-image prompt now. */
export function claimImagePrompt(titleKey: string, now = Date.now()): boolean {
  const { record, show } = onTitle(readSharePrompts(), titleKey, now, promptedThisSession());
  write(record);
  if (show) markSession();
  return show;
}

/** A good moment and the screen is clear: true = open the invite prompt now (its one time). */
export function claimInvitePrompt(s: InviteSignals, now = Date.now()): boolean {
  const r = readSharePrompts();
  if (!inviteDue(s, r, promptedThisSession())) return false;
  write({ ...r, inviteShownAt: new Date(now).toISOString() });
  markSession();
  return true;
}

/** "Don't show again" on the share-image prompt. */
export function optOutImagePrompt(): void {
  write({ ...readSharePrompts(), imageOptOut: true });
}

/** Tests only: stand-in storages (null = none), or undefined for the real ones. */
export function setSharePromptStorageForTests(s: { local: KeyStore | null; session: KeyStore | null } | undefined): void {
  testStorage = s;
}

/** Tests only: forget the memory copy and the per-load flag. */
export function resetSharePromptsForTests(): void {
  memory = null;
  promptedThisLoad = false;
}
