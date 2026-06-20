/**
 * Profile sync — pure merge logic (v1.4).
 *
 * The hard rule (DESIGN-DECISIONS #55.7): a guest with local progress who signs
 * in MUST NOT lose anything. `mergeProfiles` guarantees the result is >= BOTH
 * inputs in every dimension:
 *   - monotonic counters (xp, wins, lifetime totals, peak overalls) → MAX
 *   - collections (specials, achievements, challenges) → UNION, earliest date
 *   - dailyResults → per-date best (higher xp)
 *   - runHistory → union by runId, newest first, capped
 *   - onboarding flags → OR (seen if either saw it)
 *   - setup memory → prefer `local` (the device the player is on)
 *
 * This module is PURE (no network, no React) so it's unit-tested in isolation.
 * The Supabase/auth wiring that calls it lives in `lib/supabase.ts` + UI.
 */

import { HISTORY_LIMIT } from "@/config/balance";
import type { DailyResult, ProfileState } from "@/store/profileStore";

/** The durable, sync-worthy slice of the profile (no action methods). */
export type DurableProfile = Pick<
  ProfileState,
  | "xp"
  | "mmr"
  | "runsCompleted"
  | "wins"
  | "playoffAppearances"
  | "podiums"
  | "swissWinsTotal"
  | "gamesWon"
  | "goalsScored"
  | "unlockedSpecials"
  | "achievements"
  | "runHistory"
  | "dailyResults"
  | "challengesCompleted"
  | "records"
  | "settings"
  | "flags"
>;

const DURABLE_KEYS: (keyof DurableProfile)[] = [
  "xp",
  "mmr",
  "runsCompleted",
  "wins",
  "playoffAppearances",
  "podiums",
  "swissWinsTotal",
  "gamesWon",
  "goalsScored",
  "unlockedSpecials",
  "achievements",
  "runHistory",
  "dailyResults",
  "challengesCompleted",
  "records",
  "settings",
  "flags",
];

/** Extract the durable slice from a full ProfileState (drops the action fns). */
export function toDurable(p: ProfileState): DurableProfile {
  const out = {} as DurableProfile;
  for (const k of DURABLE_KEYS) (out as Record<string, unknown>)[k] = p[k];
  return out;
}

/** Union two `id → ISO date` maps, keeping the EARLIEST date (first unlock). */
function mergeDateMap(
  a: Record<string, string>,
  b: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = { ...a };
  for (const [id, date] of Object.entries(b)) {
    out[id] = out[id] ? (out[id] < date ? out[id] : date) : date;
  }
  return out;
}

function maxRecord<K extends string>(
  a: Record<K, number>,
  b: Record<K, number>,
): Record<K, number> {
  const out = { ...a };
  for (const k of Object.keys(b) as K[]) out[k] = Math.max(out[k] ?? 0, b[k] ?? 0);
  return out;
}

/**
 * Merge two durable profiles. Commutative and idempotent. The result never
 * regresses below either input — so merging local into cloud (or vice-versa)
 * can only preserve or gain progress, never lose it.
 */
export function mergeProfiles(local: DurableProfile, cloud: DurableProfile): DurableProfile {
  // runHistory: union by runId, newest first, capped.
  const byId = new Map<string, DurableProfile["runHistory"][number]>();
  for (const e of [...cloud.runHistory, ...local.runHistory]) {
    if (!byId.has(e.runId)) byId.set(e.runId, e);
  }
  const runHistory = [...byId.values()]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, HISTORY_LIMIT);

  // dailyResults: per-date best (higher xp wins).
  const dailyResults: Record<string, DailyResult> = { ...cloud.dailyResults };
  for (const [date, res] of Object.entries(local.dailyResults)) {
    const cur = dailyResults[date];
    if (!cur || res.xp > cur.xp) dailyResults[date] = res;
  }

  return {
    xp: Math.max(local.xp, cloud.xp),
    // MMR is monotonic like every other counter; `?? 1000` seeds legacy rows saved
    // before MMR existed (the MMR.start floor) so a pre-MMR cloud row can't drag a
    // player below the starting value. The backfill floor (applied on hydrate)
    // lifts veterans above this from history.
    mmr: Math.max(local.mmr ?? 1000, cloud.mmr ?? 1000),
    runsCompleted: Math.max(local.runsCompleted, cloud.runsCompleted),
    wins: maxRecord(local.wins, cloud.wins),
    playoffAppearances: Math.max(local.playoffAppearances, cloud.playoffAppearances),
    podiums: Math.max(local.podiums, cloud.podiums),
    swissWinsTotal: Math.max(local.swissWinsTotal, cloud.swissWinsTotal),
    gamesWon: Math.max(local.gamesWon, cloud.gamesWon),
    goalsScored: Math.max(local.goalsScored, cloud.goalsScored),
    unlockedSpecials: mergeDateMap(local.unlockedSpecials, cloud.unlockedSpecials),
    achievements: mergeDateMap(local.achievements, cloud.achievements),
    challengesCompleted: mergeDateMap(local.challengesCompleted, cloud.challengesCompleted),
    dailyResults,
    runHistory,
    records: {
      bestOverall: maxRecord(local.records.bestOverall, cloud.records.bestOverall),
      bestOverallWorldwide: Math.max(
        local.records.bestOverallWorldwide,
        cloud.records.bestOverallWorldwide,
      ),
      bestOverallSam: Math.max(local.records.bestOverallSam, cloud.records.bestOverallSam),
    },
    // Onboarding flags: seen if EITHER saw it (OR). Setup memory: prefer local.
    flags: {
      seenHowToPlay: local.flags.seenHowToPlay || cloud.flags.seenHowToPlay,
      seenLegacyIntro: local.flags.seenLegacyIntro || cloud.flags.seenLegacyIntro,
      seenRegionalIntro: local.flags.seenRegionalIntro || cloud.flags.seenRegionalIntro,
      seenTutorial: local.flags.seenTutorial || cloud.flags.seenTutorial,
    },
    settings: local.settings,
  };
}
