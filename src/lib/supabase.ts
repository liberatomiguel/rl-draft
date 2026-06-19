/**
 * Supabase accounts + cloud sync + leaderboards (v1.4) — client wrapper.
 *
 * STRICTLY OPTIONAL: with no `NEXT_PUBLIC_SUPABASE_URL` / `_ANON_KEY` set, every
 * function below is a safe no-op and `accountsEnabled` is false — the game runs
 * exactly as the guest-only build does today. Wiring it up is a config step
 * (see docs/ACCOUNTS-SETUP.md), not a code change.
 *
 * Engine purity (DESIGN-DECISIONS #55.1): NOTHING under src/engine imports this.
 * Auth/sync/network live only here + in store/UI.
 */

import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import type { DurableProfile } from "./profileSync";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** True only when both env vars are present — gates every account feature. */
export const accountsEnabled = Boolean(URL && ANON);

let _client: SupabaseClient | null = null;
function client(): SupabaseClient | null {
  if (!accountsEnabled) return null;
  if (!_client) {
    _client = createClient(URL!, ANON!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // Client-side OAuth: Supabase parses the session out of the redirect URL.
        detectSessionInUrl: true,
      },
    });
  }
  return _client;
}

// --- Auth -----------------------------------------------------------------

/** Kick off the Discord OAuth redirect. Returns to `redirectTo` signed in. */
export async function signInWithDiscord(redirectTo: string): Promise<void> {
  const c = client();
  if (!c) return;
  await c.auth.signInWithOAuth({ provider: "discord", options: { redirectTo } });
}

export async function signOut(): Promise<void> {
  await client()?.auth.signOut();
}

export async function getSession(): Promise<Session | null> {
  const c = client();
  if (!c) return null;
  const { data } = await c.auth.getSession();
  return data.session;
}

/** Subscribe to auth changes; returns an unsubscribe fn (no-op when disabled). */
export function onAuthChange(cb: (session: Session | null) => void): () => void {
  const c = client();
  if (!c) return () => {};
  const { data } = c.auth.onAuthStateChange((_e, session) => cb(session));
  return () => data.subscription.unsubscribe();
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
  daily_streak: number;
  challenges_cleared: number;
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
    daily_streak: dailyStreak,
    challenges_cleared: Object.keys(p.challengesCompleted).length,
  };
}

/** Fetch the signed-in user's stored durable profile (for merge on login). */
export async function fetchCloudProfile(userId: string): Promise<DurableProfile | null> {
  const c = client();
  if (!c) return null;
  const { data, error } = await c.from("profiles").select("durable").eq("id", userId).maybeSingle();
  if (error || !data) return null;
  return (data.durable as DurableProfile) ?? null;
}

/** Upsert the user's profile: the full durable blob + the flattened columns. */
export async function pushCloudProfile(
  userId: string,
  username: string,
  avatarUrl: string | null,
  durable: DurableProfile,
  stats: LeaderboardStats,
): Promise<void> {
  const c = client();
  if (!c) return;
  await c.from("profiles").upsert(
    {
      id: userId,
      username,
      avatar_url: avatarUrl,
      xp: durable.xp,
      durable,
      ...stats,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
}

// --- Leaderboards ---------------------------------------------------------

export type LeaderboardCategory = keyof LeaderboardStats | "xp";

export interface LeaderboardRow {
  username: string;
  avatar_url: string | null;
  value: number;
}

/** Top `limit` players by a leaderboard column (descending). */
export async function fetchLeaderboard(
  category: LeaderboardCategory,
  limit = 100,
): Promise<LeaderboardRow[]> {
  const c = client();
  if (!c) return [];
  const { data, error } = await c
    .from("profiles")
    .select(`username, avatar_url, value:${category}`)
    .order(category, { ascending: false })
    .gt(category, 0)
    .limit(limit);
  if (error || !data) return [];
  return data as unknown as LeaderboardRow[];
}
