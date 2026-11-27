/**
 * Share kit (v2.2): friends brought to play, the device's side
 * (server: docs/sql/v2.2-referrals.sql).
 *
 *  · A signed-in player's share links carry their code (`?ref=<8 chars>`).
 *  · A browser that lands with a code and has never played here keeps it as
 *    `pending`; its first finished draft run (a duel too) or its first career
 *    event sends one claim. Signed in or not.
 *  · The code's owner reads the count (cached ten minutes per account).
 *
 * Light on purpose: the root shell captures the code on every page, so this
 * module reads localStorage only and loads the Supabase wrapper on demand. One
 * localStorage key of its own, outside the zustand stores (no persist
 * contract): `rocket-draft:referral:v1`.
 */

import { trackEvent } from "@/lib/analytics";

export const REFERRAL_KEY = "rocket-draft:referral:v1";
/** Friends who must come for the Party Leader banner (`share-friends-5`). */
export const FRIENDS_GOAL = 5;
export const FRIENDS_MARK = "share-friends-5";
/** The banner that reads the mark, once Miguel's art is in the catalog. */
export const PARTY_LEADER_ID = "share-banner-party-leader";
const COUNT_TTL_MS = 10 * 60 * 1000;

export interface ReferralBook {
  /** This browser, for the server's one-claim-per-device rule. */
  deviceId: string;
  /** The code a link brought this (new) browser with, until claimed. */
  pending: string | null;
  /** The claim is settled (counted, or refused for good). */
  done: boolean;
  /** Each signed-in account's own code on this device. */
  own: Record<string, string>;
  /** The last count read per account. */
  count: Record<string, { n: number; at: number }>;
}

export const isReferralCode = (s: unknown): s is string => typeof s === "string" && /^[a-z0-9]{8}$/.test(s);

function newDeviceId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  } catch {
    /* fall through */
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

/** A stored book, trusted only as far as its shape goes. */
export function parseBook(raw: string | null): ReferralBook {
  let src: Partial<ReferralBook> = {};
  try {
    src = raw ? (JSON.parse(raw) as Partial<ReferralBook>) : {};
  } catch {
    src = {};
  }
  const deviceId =
    typeof src.deviceId === "string" && src.deviceId.length >= 16 && src.deviceId.length <= 64 ? src.deviceId : newDeviceId();
  const own: Record<string, string> = {};
  for (const [k, v] of Object.entries(src.own ?? {})) if (isReferralCode(v)) own[k] = v;
  const count: Record<string, { n: number; at: number }> = {};
  for (const [k, v] of Object.entries(src.count ?? {})) {
    if (v && Number.isInteger(v.n) && v.n >= 0 && Number.isFinite(v.at)) count[k] = { n: v.n, at: v.at };
  }
  return { deviceId, pending: isReferralCode(src.pending) ? src.pending : null, done: src.done === true, own, count };
}

function readBook(): ReferralBook {
  try {
    return parseBook(localStorage.getItem(REFERRAL_KEY));
  } catch {
    return parseBook(null);
  }
}

function writeBook(book: ReferralBook): void {
  try {
    localStorage.setItem(REFERRAL_KEY, JSON.stringify(book));
  } catch {
    /* private mode: nothing is kept, nothing breaks */
  }
}

/** Whether this browser already played (a finished run or a career): read raw, no store. */
export function deviceHasPlayed(read: (key: string) => string | null): boolean {
  try {
    const profile = JSON.parse(read("rocket-draft:profile:v1") ?? "null") as { state?: { runsCompleted?: unknown } } | null;
    if (typeof profile?.state?.runsCompleted === "number" && profile.state.runsCompleted > 0) return true;
    const career = JSON.parse(read("rocket-draft:career:v1") ?? "null") as { state?: { slots?: unknown[] } } | null;
    if (Array.isArray(career?.state?.slots) && career.state.slots.some(Boolean)) return true;
  } catch {
    /* an unreadable save is no proof of play */
  }
  return false;
}

/** The book after landing with `ref` (pure: the rules, for tests). */
export function withLanding(book: ReferralBook, ref: string | null, hasPlayed: boolean): ReferralBook {
  if (!isReferralCode(ref) || book.pending || book.done || hasPlayed) return book;
  return { ...book, pending: ref };
}

/** Root shell, every page: keep the code a link brought, for a browser that never played. */
export function captureReferralFromLocation(): void {
  try {
    const ref = new URLSearchParams(window.location.search).get("ref")?.toLowerCase() ?? null;
    if (!ref) return;
    const book = readBook();
    const next = withLanding(book, ref, deviceHasPlayed((k) => localStorage.getItem(k)));
    if (next !== book) writeBook(next);
  } catch {
    /* no storage: nothing to keep */
  }
}

let claiming = false;

/** The first play on a browser that came through a link: one claim, then settled. */
export async function claimPendingReferral(via: "draft" | "career"): Promise<void> {
  if (claiming || typeof window === "undefined") return;
  const book = readBook();
  if (!book.pending || book.done) return;
  claiming = true;
  try {
    const { accountsEnabled, claimReferral } = await import("./supabase");
    if (!accountsEnabled) return;
    const result = await claimReferral(book.pending, book.deviceId);
    if (result === "error") return; // tried again on the next play
    writeBook({ ...readBook(), pending: null, done: true });
    trackEvent("referral_claimed", { result, via, gameMode: via });
  } catch {
    /* offline or the SDK failed to load: the next play tries again */
  } finally {
    claiming = false;
  }
}

/** The account's own code on this device (null until fetched once). */
export function cachedReferralCode(userId: string | null | undefined): string | null {
  if (!userId) return null;
  return readBook().own[userId] ?? null;
}

export async function ensureReferralCode(userId: string): Promise<string | null> {
  const cached = cachedReferralCode(userId);
  if (cached) return cached;
  try {
    const { fetchReferralCode } = await import("./supabase");
    const code = await fetchReferralCode(userId);
    if (!isReferralCode(code)) return null;
    const book = readBook();
    writeBook({ ...book, own: { ...book.own, [userId]: code } });
    return code;
  } catch {
    return null;
  }
}

/** Friends counted for the account (cached ten minutes; null = unknown). */
export async function referralCount(userId: string, now = Date.now()): Promise<number | null> {
  const book = readBook();
  const hit = book.count[userId];
  if (hit && now - hit.at < COUNT_TTL_MS) return hit.n;
  try {
    const { fetchReferralCount } = await import("./supabase");
    const n = await fetchReferralCount(userId);
    if (n === null) return hit?.n ?? null;
    const fresh = readBook();
    writeBook({ ...fresh, count: { ...fresh.count, [userId]: { n, at: now } } });
    return n;
  } catch {
    return hit?.n ?? null;
  }
}

/** A link with the player's code (when there is one). */
export function withReferral(url: string, code: string | null): string {
  if (!isReferralCode(code)) return url;
  try {
    const u = new URL(url);
    u.searchParams.set("ref", code);
    return u.toString();
  } catch {
    return url;
  }
}
