/**
 * Supabase accounts + cloud sync + leaderboards (v1.4) — client wrapper.
 *
 * STRICTLY OPTIONAL: with no `NEXT_PUBLIC_SUPABASE_URL` / `_ANON_KEY` set, every
 * function below is a safe no-op and `accountsEnabled` is false — the game runs
 * exactly as the guest-only build does today. Wiring it up is a config step
 * (see docs/ACCOUNTS-SETUP.md), not a code change.
 *
 * Lazy SDK (static-export move): `@supabase/supabase-js` (~61 KB gz) is NOT in the
 * page bundle. The client is created on first use through a dynamic `import()`:
 * at startup only for a returning signed-in player (a persisted
 * `sb-<ref>-auth-token` session in localStorage, see `hasStoredAuthSession`), and
 * otherwise only when a guest actually uses an account or leaderboard feature.
 * Client options are unchanged (persistSession + autoRefreshToken +
 * detectSessionInUrl, DEFAULT storageKey), so existing sessions keep working.
 * A failed download is reported as an error (never as "no data") and retried on
 * the next call.
 *
 * Engine purity (DESIGN-DECISIONS #55.1): NOTHING under src/engine imports this.
 * Auth/sync/network live only here + in store/UI.
 */

import type { AuthChangeEvent, Session, SupabaseClient } from "@supabase/supabase-js";
import type { DurableProfile } from "./profileSync";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** True only when both env vars are present — gates every account feature. */
export const accountsEnabled = Boolean(SUPABASE_URL && SUPABASE_ANON);

/** Error text when the client isn't available (disabled build vs. failed download). */
const UNAVAILABLE = accountsEnabled ? "accounts unavailable" : "accounts disabled";

type AuthListener = (session: Session | null, event: AuthChangeEvent) => void;
interface AuthSub {
  cb: AuthListener;
  unsubscribe?: () => void;
}
/** Listeners registered before the client exists are bound when it is created. */
const authSubs = new Set<AuthSub>();

let _client: SupabaseClient | null = null;
let _loading: Promise<SupabaseClient | null> | null = null;

function bindAuthSub(c: SupabaseClient, sub: AuthSub): void {
  const { data } = c.auth.onAuthStateChange((event, session) => sub.cb(session, event));
  sub.unsubscribe = () => data.subscription.unsubscribe();
}

/** The shared client, downloading supabase-js on first call. Resolves null when
 *  accounts are disabled or the download failed (a later call retries). */
function client(): Promise<SupabaseClient | null> {
  if (!accountsEnabled) return Promise.resolve(null);
  if (_client) return Promise.resolve(_client);
  if (!_loading) {
    _loading = import("@supabase/supabase-js")
      .then(({ createClient }) => {
        const c = createClient(SUPABASE_URL!, SUPABASE_ANON!, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            // Client-side OAuth: Supabase parses the session out of the redirect URL.
            detectSessionInUrl: true,
          },
        });
        _client = c;
        authSubs.forEach((sub) => bindAuthSub(c, sub));
        return c;
      })
      .catch(() => {
        _loading = null; // let the next call retry
        return null;
      });
  }
  return _loading;
}

// --- Startup detection (no download) --------------------------------------

/** supabase-js v2's DEFAULT storage key: `sb-<first label of the URL host>-auth-token`
 *  (SupabaseClient constructor). We never override `storageKey`, so this is it. */
function authStorageKey(): string | null {
  if (!accountsEnabled) return null;
  try {
    return `sb-${new URL(SUPABASE_URL!.trim()).hostname.split(".")[0]}-auth-token`;
  } catch {
    return null;
  }
}

/** The URL carries an auth redirect the client must parse on startup
 *  (detectSessionInUrl — mirrors auth-js `_isImplicitGrantCallback`). */
function isAuthCallbackUrl(): boolean {
  try {
    const { hash, search } = window.location;
    const query = new URLSearchParams(search);
    const fragment = hash.startsWith("#") ? new URLSearchParams(hash.slice(1)) : null;
    return ["access_token", "error", "error_description", "error_code"].some(
      (k) => query.has(k) || Boolean(fragment?.has(k)),
    );
  } catch {
    return false;
  }
}

/**
 * True when auth must start at page load: a persisted Supabase session (or a
 * PKCE code-verifier mid-flow) is in localStorage, or the URL is an auth
 * redirect. Reads storage only — never downloads supabase-js.
 */
export function hasStoredAuthSession(): boolean {
  if (!accountsEnabled || typeof window === "undefined") return false;
  const key = authStorageKey();
  try {
    if (key && (localStorage.getItem(key) !== null || localStorage.getItem(`${key}-code-verifier`) !== null)) {
      return true;
    }
  } catch {
    // storage blocked → supabase-js could not have persisted a session either
  }
  return isAuthCallbackUrl();
}

/** Fires when another tab writes a Supabase session (cross-tab sign-in while
 *  this tab has not loaded the client yet). Returns an unsubscribe fn. */
export function onStoredAuthSession(cb: () => void): () => void {
  const key = authStorageKey();
  if (!key || typeof window === "undefined") return () => {};
  const handler = (e: StorageEvent) => {
    if (e.key === key && e.newValue) cb();
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}

/** Create the client now (downloads supabase-js). Registered `onAuthChange`
 *  listeners then receive INITIAL_SESSION. Resolves false if unavailable. */
export async function startAuth(): Promise<boolean> {
  return (await client()) !== null;
}

// --- Auth (email one-time code) -------------------------------------------

/** Email the player a 6-digit sign-in code. `shouldCreateUser` makes first-time
 *  emails register automatically. Returns the error message + Supabase error `code`
 *  (e.g. `over_email_send_rate_limit`) so the UI can react instead of dead-ending. */
export async function sendEmailCode(email: string): Promise<{ error?: string; code?: string }> {
  const c = await client();
  if (!c) return { error: UNAVAILABLE };
  const { error } = await c.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
  return error ? { error: error.message, code: error.code } : {};
}

/** Verify the code from the email and create the session. Returns the error `code`
 *  (e.g. `otp_expired`) so the UI can tell "expired" from "wrong code". */
export async function verifyEmailCode(
  email: string,
  token: string,
): Promise<{ error?: string; code?: string }> {
  const c = await client();
  if (!c) return { error: UNAVAILABLE };
  const { error } = await c.auth.verifyOtp({ email, token, type: "email" });
  return error ? { error: error.message, code: error.code } : {};
}

export async function signOut(): Promise<void> {
  await (await client())?.auth.signOut();
}

export async function getSession(): Promise<Session | null> {
  const c = await client();
  if (!c) return null;
  const { data } = await c.auth.getSession();
  return data.session;
}

/**
 * Subscribe to auth changes (session + the Supabase event name); returns an
 * unsubscribe fn (no-op when disabled). Does NOT download supabase-js: if the
 * client doesn't exist yet the listener is bound when it is created, and then
 * receives INITIAL_SESSION like any fresh subscriber.
 */
export function onAuthChange(cb: AuthListener): () => void {
  if (!accountsEnabled) return () => {};
  const sub: AuthSub = { cb };
  authSubs.add(sub);
  if (_client) bindAuthSub(_client, sub);
  return () => {
    authSubs.delete(sub);
    sub.unsubscribe?.();
  };
}

// --- Cloud profile --------------------------------------------------------

/**
 * Derived, server-sortable leaderboard columns (flattened from the durable
 * profile so the DB can ORDER BY them without digging into jsonb).
 */
export interface LeaderboardStats {
  best_easy: number;
  best_normal: number;
  best_hard: number;
  best_legacy: number;
  best_worldwide: number;
  best_sam: number;
  championships: number;
  titles_easy: number;
  titles_normal: number;
  titles_hard: number;
  titles_legacy: number;
  daily_streak: number;
  challenges_cleared: number;
  /** Cosmetic skill rating (v1.4) — the leaderboard category that replaced XP. */
  mmr: number;
}

export function leaderboardStats(p: DurableProfile, dailyStreak: number): LeaderboardStats {
  const championships = p.wins.easy + p.wins.normal + p.wins.hard + p.wins.legacy;
  return {
    best_easy: p.records.bestOverall.easy,
    best_normal: p.records.bestOverall.normal,
    best_hard: p.records.bestOverall.hard,
    best_legacy: p.records.bestOverall.legacy,
    best_worldwide: p.records.bestOverallWorldwide,
    best_sam: p.records.bestOverallSam,
    championships,
    titles_easy: p.wins.easy,
    titles_normal: p.wins.normal,
    titles_hard: p.wins.hard,
    titles_legacy: p.wins.legacy,
    daily_streak: dailyStreak,
    challenges_cleared: Object.keys(p.challengesCompleted).length,
    mmr: p.mmr,
  };
}

/**
 * Result of reading the player's cloud row — TAGGED so a failed read can never
 * be mistaken for "no row yet" (which would let an empty/older local profile
 * overwrite the only cloud backup):
 *  - `ok`     — the row exists (`durable` may be null on a row without a blob)
 *  - `no-row` — the read SUCCEEDED and the player has no row yet
 *  - `error`  — the read failed (network, 5xx, timeout, auth, SDK download…):
 *               the caller must not push.
 */
export type CloudRowResult =
  | { status: "ok"; durable: DurableProfile | null; username: string | null }
  | { status: "no-row" }
  | { status: "error"; error: string };

/** Fetch the user's stored durable profile + chosen display name (for merge +
 *  to keep their name on subsequent syncs). */
export async function fetchCloudRow(userId: string): Promise<CloudRowResult> {
  try {
    const c = await client();
    if (!c) return { status: "error", error: UNAVAILABLE };
    const { data, error } = await c
      .from("profiles")
      .select("durable, username")
      .eq("id", userId)
      .maybeSingle();
    if (error) return { status: "error", error: error.message || "read failed" };
    if (!data) return { status: "no-row" };
    return {
      status: "ok",
      durable: (data.durable as DurableProfile) ?? null,
      username: data.username ?? null,
    };
  } catch (e) {
    return { status: "error", error: e instanceof Error ? e.message : String(e) };
  }
}

/** Upsert the user's profile: the full durable blob + the flattened columns.
 *  Returns the error message on failure. */
export async function pushCloudProfile(
  userId: string,
  username: string,
  durable: DurableProfile,
  stats: LeaderboardStats,
): Promise<{ error?: string }> {
  try {
    const c = await client();
    if (!c) return { error: UNAVAILABLE };
    const { error } = await c.from("profiles").upsert(
      {
        id: userId,
        username,
        xp: durable.xp,
        durable,
        ...stats,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
    return error ? { error: error.message || "write failed" } : {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

/** Update the public display name. Returns an error message on failure — the
 *  DB unique index on lower(username) rejects a name already taken. */
export async function updateUsername(userId: string, username: string): Promise<{ error?: string }> {
  const c = await client();
  if (!c) return { error: UNAVAILABLE };
  const { error } = await c.from("profiles").update({ username }).eq("id", userId);
  if (!error) return {};
  // Postgres unique-violation code is 23505.
  if (error.code === "23505") return { error: "taken" };
  return { error: error.message };
}

/** Pre-check whether a display name is free (case-insensitive). The unique index
 *  is the real guard; this just gives nicer UX before saving. */
export async function isUsernameAvailable(
  username: string,
  currentUsername: string,
): Promise<boolean> {
  const name = username.trim();
  if (!name) return false;
  if (name.toLowerCase() === currentUsername.trim().toLowerCase()) return true; // unchanged
  const c = await client();
  if (!c) return true;
  const { data, error } = await c.from("leaderboard").select("username").ilike("username", name).limit(1);
  if (error || !data) return true; // fail open — the DB unique index still guards
  return data.length === 0;
}

/** Delete the signed-in user's account (auth user + profile row, via cascade). */
export async function deleteAccount(): Promise<void> {
  const c = await client();
  if (!c) return;
  await c.rpc("delete_own_account");
  await c.auth.signOut();
}

// --- Leaderboards ---------------------------------------------------------

export type LeaderboardCategory = keyof LeaderboardStats | "xp";

export interface LeaderboardRow {
  username: string;
  value: number;
}

/**
 * Top `limit` players by a leaderboard column (descending). Reads the PUBLIC
 * `leaderboard` view (safe columns only) — NOT the profiles table, whose full
 * durable blob is owner-only. So a public read never exposes a player's history.
 */
export async function fetchLeaderboard(
  category: LeaderboardCategory,
  limit = 100,
): Promise<LeaderboardRow[]> {
  const c = await client();
  if (!c) return [];
  const { data, error } = await c
    .from("leaderboard")
    .select(`username, value:${category}`)
    .order(category, { ascending: false })
    .gt(category, 0)
    .limit(limit);
  if (error || !data) return [];
  return data as unknown as LeaderboardRow[];
}
