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
import { SEASON } from "@/config/season";
import { totalStars } from "@/engine/challengeStars";
import { EMPTY_COSMETICS, equippedColumns } from "@/engine/cosmetics";
import { PRESEASON_BOARDS, type PreseasonBoard } from "@/engine/season";
import type { CloudSlotMeta } from "./careerCloud";
import type { DurableProfile } from "./profileSync";
import type { SavePayload } from "./saveCodec";
import { classifySyncError, type SyncFailure } from "./syncErrors";

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

// --- Auth (Google / Discord, v2.0.7) ---------------------------------------

/** The OAuth sign-ins offered next to the email code (they send no email). Each
 *  must be enabled in the Supabase project (Authentication -> Providers). */
export const OAUTH_PROVIDERS = ["google", "discord"] as const;
export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

/** Come back to the page the player was on (must match the project's redirect
 *  allow list; Supabase falls back to the Site URL otherwise). */
function oauthReturnUrl(): string {
  return `${window.location.origin}${window.location.pathname}`;
}

/** Leave for the provider's consent page. On success the browser navigates away;
 *  the session arrives on the way back (`detectSessionInUrl`). An email that
 *  already has an account lands on that same account (Supabase links identities
 *  by verified email). */
export async function signInWithProvider(provider: OAuthProvider): Promise<{ error?: string }> {
  const c = await client();
  if (!c) return { error: UNAVAILABLE };
  const { error } = await c.auth.signInWithOAuth({ provider, options: { redirectTo: oauthReturnUrl() } });
  return error ? { error: error.message } : {};
}

/** Attach a provider to the SIGNED-IN account (its email may differ from the
 *  account's). Needs "manual linking" enabled in the Supabase project. */
export async function linkProvider(provider: OAuthProvider): Promise<{ error?: string }> {
  const c = await client();
  if (!c) return { error: UNAVAILABLE };
  const { error } = await c.auth.linkIdentity({ provider, options: { redirectTo: oauthReturnUrl() } });
  return error ? { error: error.message } : {};
}

/** Which of the offered providers this session's account already has. */
export function linkedProviders(session: Session | null): OAuthProvider[] {
  const ids = new Set<string>([
    ...((session?.user.app_metadata?.providers as string[] | undefined) ?? []),
    ...(session?.user.identities?.map((i) => i.provider) ?? []),
  ]);
  return OAUTH_PROVIDERS.filter((p) => ids.has(p));
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
  /** Season columns (v2.0). The pre-season `xp` / `mmr` columns are a FROZEN
   *  archive now: the client never writes them again (docs/V2-IMPLEMENTATION-PLAN §2.5). */
  season_id: number;
  season_xp: number;
  season_mmr: number;
  season_peak_mmr: number;
  season_titles: number;
  season_runs: number;
  /** rc.54 boards: Legacy titles, titles per region lock, Road to Worlds titles. */
  season_legacy_titles: number;
  season_titles_sam: number;
  season_titles_na: number;
  season_titles_eu: number;
  season_titles_oce: number;
  season_titles_mena: number;
  season_worlds: number;
  lifetime_xp: number;
  quiz_solved: number;
  login_streak: number;
  challenge_stars: number;
  /** What the player shows on the boards (resolved from `cosmetics`, v2.0). */
  equipped_title: string | null;
  equipped_frame: string | null;
  equipped_banner: string | null;
  equipped_badges: string[];
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
    season_id: p.season?.id ?? SEASON.id,
    season_xp: p.xp,
    season_mmr: p.mmr,
    season_peak_mmr: p.season?.peakMmr ?? p.mmr,
    season_titles: p.season?.titles ?? 0,
    season_runs: p.season?.runs ?? 0,
    season_legacy_titles: p.season?.legacyTitles ?? 0,
    season_titles_sam: p.season?.regionTitles?.SAM ?? 0,
    season_titles_na: p.season?.regionTitles?.NA ?? 0,
    season_titles_eu: p.season?.regionTitles?.EU ?? 0,
    season_titles_oce: p.season?.regionTitles?.OCE ?? 0,
    season_titles_mena: p.season?.regionTitles?.MENA ?? 0,
    season_worlds: p.season?.careerWorlds ?? 0,
    lifetime_xp: p.lifetime?.xp ?? p.xp,
    quiz_solved: p.quiz?.solved ?? 0,
    login_streak: p.login?.best ?? 0,
    challenge_stars: totalStars(p.challengeStars ?? {}),
    ...equippedColumns(p.cosmetics ?? EMPTY_COSMETICS),
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
  | {
      status: "ok";
      durable: DurableProfile | null;
      username: string | null;
      /** Manual grants (supporter / pro / contributor) — dashboard-only writes (v2.0). */
      grants: string[];
      /** Frozen final pre-season place on the rating board, once the freeze SQL ran (v2.0). */
      preseasonPosition: number | null;
      /** rc.54: frozen final place per pre-season board (only the boards the player ranked on). */
      preseasonPositions: Partial<Record<PreseasonBoard, number>>;
    }
  | { status: "no-row" }
  | ({ status: "error" } & SyncFailure);

/** A failed cloud call, named (v2.0.25): the reason goes out with the analytics
 *  event and decides whether the sync tries again. */
function failure(message: string | null | undefined, fallback: string, code?: string | null, status?: number | null): SyncFailure {
  const error = message || fallback;
  const online = typeof navigator !== "undefined" ? navigator.onLine : undefined;
  return { error, reason: classifySyncError({ message: error, code, status, online }), ...(code ? { code } : {}) };
}

const SDK_UNAVAILABLE: SyncFailure = { error: UNAVAILABLE, reason: "unavailable" };

/**
 * v2.0.25: a cloud call for `userId` must carry THAT user's token. supabase-js
 * falls back to the public anon key when it has no session to offer (an expired
 * token whose refresh failed: a phone waking a tab after an hour). The read then
 * ran as nobody, row-level security hid the row, and the sync took an existing
 * account for a new one and failed on the push. Returns that user's token, or
 * the failure. The caller puts the token on the request itself (`setHeader`):
 * supabase-js only adds its own Authorization when none is set, so the request
 * can never go out as nobody, even if the session vanishes in between. A stale
 * token is then a 401 (`auth`), never an empty read.
 */
async function ownToken(c: SupabaseClient, userId: string): Promise<{ token: string } | SyncFailure> {
  const { data, error } = await c.auth.getSession();
  const session = data.session;
  if (session?.user.id === userId && session.access_token) return { token: session.access_token };
  const fallback = session ? "session of another user" : "no session";
  const named = failure(error?.message, fallback, null, (error as { status?: number } | null)?.status ?? null);
  // A refresh that failed on the network is a network problem; anything else is auth.
  const keep = named.reason === "network" || named.reason === "offline" || named.reason === "server" || named.reason === "rate";
  return { error: named.error, reason: keep ? named.reason : "auth" };
}

/** The `preseason_positions` jsonb, trusted only as far as its shape goes. */
function readPlaces(raw: unknown): Partial<Record<PreseasonBoard, number>> {
  const out: Partial<Record<PreseasonBoard, number>> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const board of PRESEASON_BOARDS) {
    const place = (raw as Record<string, unknown>)[board];
    if (typeof place === "number" && Number.isInteger(place) && place > 0) out[board] = place;
  }
  return out;
}

/** Fetch the user's stored durable profile + chosen display name (for merge +
 *  to keep their name on subsequent syncs), plus the server-owned extras (v2.0):
 *  the manual grants and the frozen pre-season position. One request: the grants
 *  come embedded through the `profile_grants.user_id → profiles.id` relation. */
export async function fetchCloudRow(userId: string): Promise<CloudRowResult> {
  try {
    const c = await client();
    if (!c) return { status: "error", ...SDK_UNAVAILABLE };
    const auth = await ownToken(c, userId);
    if (!("token" in auth)) return { status: "error", ...auth };
    const { data, error, status } = await c
      .from("profiles")
      .select("durable, username, preseason_position, preseason_positions, profile_grants(grant_id)")
      .eq("id", userId)
      .setHeader("Authorization", `Bearer ${auth.token}`)
      .maybeSingle();
    if (error) return { status: "error", ...failure(error.message, "read failed", error.code, status) };
    if (!data) return { status: "no-row" };
    const grantRows = (data.profile_grants as { grant_id: string }[] | null) ?? [];
    return {
      status: "ok",
      // v2.0.30: an emptied row (`durable = '{}'`, the column is NOT NULL) reads as
      // "no saved profile": the next push writes the device's profile over it.
      durable:
        data.durable && typeof data.durable === "object" && Object.keys(data.durable).length > 0
          ? (data.durable as DurableProfile)
          : null,
      username: data.username ?? null,
      grants: grantRows.map((g) => g.grant_id).filter((g) => typeof g === "string"),
      preseasonPosition:
        typeof data.preseason_position === "number" && data.preseason_position > 0
          ? data.preseason_position
          : null,
      preseasonPositions: readPlaces(data.preseason_positions),
    };
  } catch (e) {
    return { status: "error", ...failure(e instanceof Error ? e.message : String(e), "read failed") };
  }
}

/** Upsert the user's profile: the full durable blob + the flattened columns.
 *  Returns the failure (message + reason) when it did not go through. */
export async function pushCloudProfile(
  userId: string,
  username: string,
  durable: DurableProfile,
  stats: LeaderboardStats,
): Promise<Partial<SyncFailure>> {
  try {
    const c = await client();
    if (!c) return SDK_UNAVAILABLE;
    const auth = await ownToken(c, userId);
    if (!("token" in auth)) return auth;
    // v2.0: `xp` / `mmr` are deliberately NOT written — they are the frozen
    // pre-season archive (a DB trigger also refuses them). Season values travel in
    // the `season_*` columns of `stats`.
    const { error, status } = await c
      .from("profiles")
      .upsert(
        {
          id: userId,
          username,
          durable,
          ...stats,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      )
      .setHeader("Authorization", `Bearer ${auth.token}`);
    return error ? failure(error.message, "write failed", error.code, status) : {};
  } catch (e) {
    return failure(e instanceof Error ? e.message : String(e), "write failed");
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

export type LeaderboardCategory = Exclude<
  keyof LeaderboardStats,
  "season_id" | "equipped_title" | "equipped_frame" | "equipped_banner" | "equipped_badges"
>;

/** Columns that only make sense inside the current season (filtered by `season_id`). */
const SEASON_SCOPED: ReadonlySet<string> = new Set([
  "season_xp",
  "season_mmr",
  "season_peak_mmr",
  "season_titles",
  "season_runs",
  "season_legacy_titles",
  "season_titles_sam",
  "season_titles_na",
  "season_titles_eu",
  "season_titles_oce",
  "season_titles_mena",
  "season_worlds",
]);

/** The public cosmetics every board row carries (v2.0): what the player chose to
 *  show (equipped) plus the server-side grants. Nulls / empty when unset. */
export interface RowCosmetics {
  equipped_title: string | null;
  equipped_frame: string | null;
  equipped_banner: string | null;
  equipped_badges: string[];
  grants: string[];
  preseason_position: number | null;
}

export interface LeaderboardRow extends RowCosmetics {
  username: string;
  value: number;
  /** Context for the row (rank emblem, the profile peek). */
  season_xp: number;
  season_mmr: number;
  season_titles: number;
  championships: number;
}

const ROW_COSMETIC_COLUMNS =
  "equipped_title, equipped_frame, equipped_banner, equipped_badges, grants, preseason_position, season_xp, season_mmr, season_titles, championships";

function normalizeRow<T extends Partial<RowCosmetics>>(r: T): T & RowCosmetics {
  const num = (k: string): number => {
    const v = (r as Record<string, unknown>)[k];
    return typeof v === "number" ? v : 0;
  };
  return {
    ...r,
    season_xp: num("season_xp"),
    season_mmr: num("season_mmr"),
    season_titles: num("season_titles"),
    championships: num("championships"),
    equipped_title: r.equipped_title ?? null,
    equipped_frame: r.equipped_frame ?? null,
    equipped_banner: r.equipped_banner ?? null,
    equipped_badges: Array.isArray(r.equipped_badges) ? r.equipped_badges : [],
    grants: Array.isArray(r.grants) ? r.grants : [],
    preseason_position:
      typeof r.preseason_position === "number" && r.preseason_position > 0
        ? r.preseason_position
        : null,
  };
}

/**
 * Top `limit` players by a leaderboard column (descending). Reads the PUBLIC
 * `leaderboard` view (safe columns only) — NOT the profiles table, whose full
 * durable blob is owner-only. So a public read never exposes a player's history.
 * Season-scoped columns are filtered to the current season.
 */
export async function fetchLeaderboard(
  category: LeaderboardCategory,
  limit = 100,
): Promise<LeaderboardRow[]> {
  const c = await client();
  if (!c) return [];
  let q = c
    .from("leaderboard")
    .select(`username, value:${category}, ${ROW_COSMETIC_COLUMNS}`)
    .order(category, { ascending: false })
    .gt(category, 0);
  if (SEASON_SCOPED.has(category)) q = q.eq("season_id", SEASON.id);
  const { data, error } = await q.limit(limit);
  if (error || !data) return [];
  return (data as unknown as Partial<LeaderboardRow>[]).map((r) => normalizeRow(r) as LeaderboardRow);
}

export interface HallOfFameRow extends RowCosmetics {
  username: string;
  position: number;
  mmr: number;
  xp: number;
  championships: number;
  season_xp: number;
  season_mmr: number;
  season_titles: number;
}

/** The frozen pre-season final board (v2.0), best place first. Empty until the
 *  freeze SQL has run (docs/V2-IMPLEMENTATION-PLAN §6-C). */
export async function fetchHallOfFame(limit = 100): Promise<HallOfFameRow[]> {
  const c = await client();
  if (!c) return [];
  const { data, error } = await c
    .from("preseason_hall_of_fame")
    .select("username, position, mmr, xp, championships, equipped_title, equipped_frame, equipped_banner, grants")
    .order("position", { ascending: true })
    .limit(limit);
  if (error || !data) return [];
  return (data as unknown as Partial<HallOfFameRow>[]).map((r) => normalizeRow(r) as HallOfFameRow);
}

// ---------------------------------------------------------------------------
// Road to Worlds cloud save (v2.0.26) — table `career_saves`
// (docs/sql/v2026-career-saves.sql). One row per account and slot. Every call
// carries the player's own token (`ownToken`), like the profile calls above.
// ---------------------------------------------------------------------------

type CareerRow = Record<string, unknown>;

const CAREER_META_COLUMNS = "slot, career_id, save_version, seq, summary, device_id, saved_at, revision, updated_at";

const msOf = (v: unknown): number => {
  const ms = typeof v === "string" ? Date.parse(v) : NaN;
  return Number.isFinite(ms) ? ms : 0;
};

/** One row's metadata, trusted only as far as its shape goes (null = unusable). */
function careerMetaOf(row: CareerRow | null | undefined): CloudSlotMeta | null {
  if (!row || typeof row.career_id !== "string" || typeof row.revision !== "number" || typeof row.slot !== "number") return null;
  return {
    slot: row.slot,
    careerId: row.career_id,
    saveVersion: typeof row.save_version === "number" ? row.save_version : 0,
    seq: typeof row.seq === "number" ? row.seq : 0,
    revision: row.revision,
    savedAt: msOf(row.saved_at),
    updatedAt: msOf(row.updated_at),
    deviceId: typeof row.device_id === "string" ? row.device_id : "",
    summary: row.summary && typeof row.summary === "object" ? (row.summary as CloudSlotMeta["summary"]) : {},
  };
}

export type CareerMetasResult = { status: "ok"; slots: CloudSlotMeta[] } | ({ status: "error" } & SyncFailure);

/** The account's career slots, without their payloads. */
export async function fetchCareerMetas(userId: string): Promise<CareerMetasResult> {
  try {
    const c = await client();
    if (!c) return { status: "error", ...SDK_UNAVAILABLE };
    const auth = await ownToken(c, userId);
    if (!("token" in auth)) return { status: "error", ...auth };
    const { data, error, status } = await c
      .from("career_saves")
      .select(CAREER_META_COLUMNS)
      .eq("user_id", userId)
      .setHeader("Authorization", `Bearer ${auth.token}`);
    if (error) return { status: "error", ...failure(error.message, "read failed", error.code, status) };
    const slots = ((data as CareerRow[] | null) ?? []).map(careerMetaOf).filter((m): m is CloudSlotMeta => m !== null);
    return { status: "ok", slots };
  } catch (e) {
    return { status: "error", ...failure(e instanceof Error ? e.message : String(e), "read failed") };
  }
}

export type CareerSaveResult =
  | { status: "ok"; meta: CloudSlotMeta; payload: SavePayload }
  /** The read succeeded and the slot has no row. */
  | { status: "empty" }
  | ({ status: "error" } & SyncFailure);

/** One slot WITH its payload. */
export async function fetchCareerSave(userId: string, slot: number): Promise<CareerSaveResult> {
  try {
    const c = await client();
    if (!c) return { status: "error", ...SDK_UNAVAILABLE };
    const auth = await ownToken(c, userId);
    if (!("token" in auth)) return { status: "error", ...auth };
    const { data, error, status } = await c
      .rpc("get_career_save", { p_slot: slot })
      .setHeader("Authorization", `Bearer ${auth.token}`);
    if (error) return { status: "error", ...failure(error.message, "read failed", error.code, status) };
    if (!data) return { status: "empty" };
    const row = data as CareerRow;
    const meta = careerMetaOf(row);
    const encoding = row.encoding;
    if (!meta || (encoding !== "gzip" && encoding !== "json") || typeof row.payload !== "string") {
      return { status: "error", error: "malformed row", reason: "other" };
    }
    return { status: "ok", meta, payload: { encoding, payload: row.payload } };
  } catch (e) {
    return { status: "error", ...failure(e instanceof Error ? e.message : String(e), "read failed") };
  }
}

export interface CareerPushInput {
  slot: number;
  careerId: string;
  saveVersion: number;
  seq: number;
  summary: CloudSlotMeta["summary"];
  payload: SavePayload;
  deviceId: string;
  release: string;
  /** The device's clock at the save's last action (ms). */
  savedAt: number;
  /** The revision this device last saw; null = it knows of no row. */
  expectedRevision: number | null;
  /** The player chose this device's copy in the notice: write regardless. */
  force?: boolean;
}

export type CareerPushResult =
  | { status: "ok"; revision: number; updatedAt: number }
  /** The account copy moved on (another device wrote it): nothing was written. */
  | { status: "conflict"; meta: CloudSlotMeta }
  /** The row this device last saw is gone (deleted elsewhere): nothing was written. */
  | { status: "missing" }
  | ({ status: "error" } & SyncFailure);

/** Write one slot through `push_career_save` (the only way to write the table).
 *  Every argument is sent, null when empty: PostgREST finds the function by the
 *  names it receives. */
export async function pushCareerSave(userId: string, input: CareerPushInput): Promise<CareerPushResult> {
  try {
    const c = await client();
    if (!c) return { status: "error", ...SDK_UNAVAILABLE };
    const auth = await ownToken(c, userId);
    if (!("token" in auth)) return { status: "error", ...auth };
    const { data, error, status } = await c
      .rpc("push_career_save", {
        p_slot: input.slot,
        p_career_id: input.careerId,
        p_save_version: input.saveVersion,
        p_seq: input.seq,
        p_summary: input.summary ?? {},
        p_encoding: input.payload.encoding,
        p_payload: input.payload.payload,
        p_device_id: input.deviceId,
        p_client_release: input.release ?? null,
        // A save that was never stamped (0) says so: the epoch, not "now", so the
        // account row still equals the local stamp and the same copy is recognised.
        p_saved_at: new Date(Math.max(0, input.savedAt || 0)).toISOString(),
        p_expected_revision: input.expectedRevision ?? null,
        p_force: Boolean(input.force),
      })
      .setHeader("Authorization", `Bearer ${auth.token}`);
    if (error) return { status: "error", ...failure(error.message, "write failed", error.code, status) };
    const out = (data ?? {}) as CareerRow;
    if (out.status === "ok" && typeof out.revision === "number") {
      return { status: "ok", revision: out.revision, updatedAt: msOf(out.updated_at) };
    }
    if (out.status === "missing") return { status: "missing" };
    if (out.status === "conflict") {
      const meta = careerMetaOf({ ...out, slot: input.slot });
      if (meta) return { status: "conflict", meta };
    }
    return { status: "error", error: "malformed answer", reason: "other" };
  } catch (e) {
    return { status: "error", ...failure(e instanceof Error ? e.message : String(e), "write failed") };
  }
}

export type CareerDeleteResult =
  /** `deleted` false: the row is not the one this device saw (another device has
   *  written it since, or it is already gone). Nothing was deleted. */
  | { status: "ok"; deleted: boolean }
  | ({ status: "error" } & SyncFailure);

/** Delete the account copy of `careerId` in `slot`, but only the very revision
 *  this device last saw: a copy another device has played since is left alone. */
export async function deleteCareerSave(
  userId: string,
  slot: number,
  careerId: string,
  revision: number,
): Promise<CareerDeleteResult> {
  try {
    const c = await client();
    if (!c) return { status: "error", ...SDK_UNAVAILABLE };
    const auth = await ownToken(c, userId);
    if (!("token" in auth)) return { status: "error", ...auth };
    const { data, error, status } = await c
      .from("career_saves")
      .delete()
      .eq("user_id", userId)
      .eq("slot", slot)
      .eq("career_id", careerId)
      .eq("revision", revision)
      .select("slot")
      .setHeader("Authorization", `Bearer ${auth.token}`);
    if (error) return { status: "error", ...failure(error.message, "delete failed", error.code, status) };
    return { status: "ok", deleted: Array.isArray(data) && data.length > 0 };
  } catch (e) {
    return { status: "error", ...failure(e instanceof Error ? e.message : String(e), "delete failed") };
  }
}

// --- Friends brought to play (v2.2 share kit, docs/sql/v2.2-referrals.sql) ---
// Every failure reads as "nothing" (null / "error"): a build that runs before
// the SQL is applied, offline or signed out simply counts nothing.

/** The signed-in player's code (the server makes it on the first call). */
export async function fetchReferralCode(userId: string): Promise<string | null> {
  try {
    const c = await client();
    if (!c) return null;
    const auth = await ownToken(c, userId);
    if (!("token" in auth)) return null;
    const { data, error } = await c.rpc("referral_code").setHeader("Authorization", `Bearer ${auth.token}`);
    if (error || typeof data !== "string" || !/^[a-z0-9]{8}$/.test(data)) return null;
    return data;
  } catch {
    return null;
  }
}

/** A new browser's first play after arriving through `code` (signed in or not). */
export async function claimReferral(code: string, deviceId: string): Promise<"counted" | "refused" | "error"> {
  try {
    const c = await client();
    if (!c) return "error";
    const { data, error } = await c.rpc("claim_referral", { p_code: code, p_device: deviceId });
    if (error) return "error";
    return data === true ? "counted" : "refused";
  } catch {
    return "error";
  }
}

/** Friends counted for the signed-in player's code. */
export async function fetchReferralCount(userId: string): Promise<number | null> {
  try {
    const c = await client();
    if (!c) return null;
    const auth = await ownToken(c, userId);
    if (!("token" in auth)) return null;
    const { data, error } = await c.rpc("my_referral_count").setHeader("Authorization", `Bearer ${auth.token}`);
    if (error || typeof data !== "number" || !Number.isInteger(data) || data < 0) return null;
    return data;
  } catch {
    return null;
  }
}
