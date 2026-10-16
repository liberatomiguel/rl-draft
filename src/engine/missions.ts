/**
 * Missions + login streak (v2.0) — pure engine.
 *
 * MISSIONS: a catalog of templates (daily / weekly, tier easy / mid / hard). For
 * a period key (the UTC day, or the ISO week) the catalog is filtered to what the
 * player can actually do (`requires`), shuffled with the seeded RNG from the key,
 * and one mission per tier is taken. The chosen ids are stored with the key, so
 * a set never changes mid-period even if the player ranks up. Progress comes
 * from typed events the stores emit after the fact (`MissionEvent`); each
 * template says how much one event contributes. Rewards auto-grant when the
 * target is reached; completing all three pays the period bonus.
 *
 * LOGIN STREAK: the first open of a UTC day counts; consecutive days extend the
 * streak, a gap resets it to 1 (rewards already earned stay — the cosmetics read
 * `best`).
 *
 * Nothing here touches storage or React; the profile store owns the state.
 */

import { LOGIN_STREAK, MISSIONS, RANKS } from "@/config/balance";
import { createRng } from "@/lib/rng";
import type { Difficulty, Placement, Region, RunMode } from "./types";

/** FNV-1a over the period key (same hash the daily uses) — stable across platforms. */
function seedFromKey(key: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export type MissionPeriod = "daily" | "weekly";
export type MissionTier = "easy" | "mid" | "hard";

/** Facts about one finished tournament run (Classic / Quick / Daily). */
export interface RunCompletedEvent {
  type: "run_completed";
  mode: RunMode;
  difficulty: Difficulty;
  placement: Placement;
  region: Region | null;
  hiddenOverall: boolean;
  /** Series won across Swiss + playoffs. */
  seriesWins: number;
  gameWins: number;
  goals: number;
  /** Special cards fielded on the user's team. */
  specialsFielded: number;
  chemistryTier: string;
  /** All three starters drafted from the same lineup. */
  sameLineupTrio: boolean;
  /** The team's displayed overall. */
  teamOverall: number;
}

export type MissionEvent =
  | RunCompletedEvent
  | { type: "special_selected" }
  | { type: "challenge_cleared"; newStars: number }
  | { type: "quiz_played"; solved: boolean; attempt: number }
  | { type: "career_matchday" }
  | { type: "career_title" };

export interface MissionRequires {
  /** Rank id the player must have reached (ladder order). */
  minRank?: string;
  legacyUnlocked?: boolean;
  /** Road to Worlds must be available (build flag + the player has a save). */
  career?: boolean;
}

export interface MissionDef {
  id: string;
  period: MissionPeriod;
  tier: MissionTier;
  target: number;
  requires?: MissionRequires;
  /** Contribution of one event (0 = unrelated). */
  progress: (e: MissionEvent) => number;
}

/** What the picker knows about the player (evaluated at pick time). */
export interface MissionEligibility {
  rankId: string;
  legacyUnlocked: boolean;
  careerAvailable: boolean;
}

const rankIndex = (id: string): number => Math.max(0, RANKS.findIndex((r) => r.id === id));

const isTournament = (e: MissionEvent): e is RunCompletedEvent => e.type === "run_completed";
const won = (e: MissionEvent): boolean => isTournament(e) && e.placement === "champion";
const playoffs = (e: MissionEvent): boolean => isTournament(e) && e.placement !== "swiss_exit";
const atLeast = (e: RunCompletedEvent, d: Difficulty): boolean =>
  rankDifficulty(e.difficulty) >= rankDifficulty(d);
const rankDifficulty = (d: Difficulty): number => ({ easy: 0, normal: 1, hard: 2, legacy: 3 })[d];

function run(fn: (e: RunCompletedEvent) => number | boolean): (e: MissionEvent) => number {
  return (e) => (isTournament(e) ? Number(fn(e)) : 0);
}

/**
 * The catalog. Ids are a compatibility surface (stored in saves) — never rename.
 * Titles / descriptions live in copy (`MISSIONS.items[id]`), templated by target.
 */
export const MISSION_CATALOG: MissionDef[] = [
  // ---------------- DAILY · easy ----------------
  { id: "d-draft-1", period: "daily", tier: "easy", target: 1, progress: run(() => 1) },
  { id: "d-series-3", period: "daily", tier: "easy", target: 3, progress: run((e) => e.seriesWins) },
  { id: "d-daily-play", period: "daily", tier: "easy", target: 1, progress: run((e) => e.mode === "daily") },
  { id: "d-quick-1", period: "daily", tier: "easy", target: 1, progress: run((e) => e.mode === "quick") },
  { id: "d-goals-10", period: "daily", tier: "easy", target: 10, progress: run((e) => e.goals) },
  { id: "d-games-6", period: "daily", tier: "easy", target: 6, progress: run((e) => e.gameWins) },
  { id: "d-quiz-play", period: "daily", tier: "easy", target: 1, progress: (e) => (e.type === "quiz_played" ? 1 : 0) },
  { id: "d-special-pick", period: "daily", tier: "easy", target: 1, requires: { minRank: "bronze" }, progress: (e) => (e.type === "special_selected" ? 1 : 0) },
  // ---------------- DAILY · mid ----------------
  { id: "d-draft-2", period: "daily", tier: "mid", target: 2, progress: run(() => 1) },
  { id: "d-series-6", period: "daily", tier: "mid", target: 6, progress: run((e) => e.seriesWins) },
  { id: "d-playoffs-1", period: "daily", tier: "mid", target: 1, progress: (e) => Number(playoffs(e)) },
  { id: "d-win-1", period: "daily", tier: "mid", target: 1, progress: (e) => Number(won(e)) },
  { id: "d-chem-great", period: "daily", tier: "mid", target: 1, progress: run((e) => e.chemistryTier === "Great" || e.chemistryTier === "Perfect") },
  { id: "d-hidden-1", period: "daily", tier: "mid", target: 1, progress: run((e) => e.hiddenOverall) },
  { id: "d-regional-1", period: "daily", tier: "mid", target: 1, progress: run((e) => e.region !== null) },
  { id: "d-goals-20", period: "daily", tier: "mid", target: 20, progress: run((e) => e.goals) },
  { id: "d-special-field-2", period: "daily", tier: "mid", target: 2, requires: { minRank: "bronze" }, progress: run((e) => e.specialsFielded) },
  { id: "d-quiz-solve", period: "daily", tier: "mid", target: 1, progress: (e) => (e.type === "quiz_played" && e.solved ? 1 : 0) },
  { id: "d-challenge-1", period: "daily", tier: "mid", target: 1, requires: { minRank: "bronze" }, progress: (e) => (e.type === "challenge_cleared" ? 1 : 0) },
  { id: "d-career-matchday", period: "daily", tier: "mid", target: 1, requires: { career: true }, progress: (e) => (e.type === "career_matchday" ? 1 : 0) },
  // ---------------- DAILY · hard ----------------
  { id: "d-draft-3", period: "daily", tier: "hard", target: 3, progress: run(() => 1) },
  { id: "d-win-normal", period: "daily", tier: "hard", target: 1, progress: run((e) => e.placement === "champion" && atLeast(e, "normal")) },
  { id: "d-win-hard", period: "daily", tier: "hard", target: 1, requires: { minRank: "silver" }, progress: run((e) => e.placement === "champion" && atLeast(e, "hard")) },
  { id: "d-chem-perfect", period: "daily", tier: "hard", target: 1, progress: run((e) => e.chemistryTier === "Perfect") },
  { id: "d-trio-lineup", period: "daily", tier: "hard", target: 1, progress: run((e) => e.sameLineupTrio) },
  { id: "d-series-10", period: "daily", tier: "hard", target: 10, progress: run((e) => e.seriesWins) },
  { id: "d-daily-win", period: "daily", tier: "hard", target: 1, progress: run((e) => e.mode === "daily" && e.placement === "champion") },
  { id: "d-legacy-series-2", period: "daily", tier: "hard", target: 2, requires: { legacyUnlocked: true }, progress: run((e) => (e.difficulty === "legacy" ? e.seriesWins : 0)) },
  { id: "d-hidden-playoffs", period: "daily", tier: "hard", target: 1, progress: run((e) => e.hiddenOverall && e.placement !== "swiss_exit") },
  { id: "d-quiz-first-try", period: "daily", tier: "hard", target: 1, progress: (e) => (e.type === "quiz_played" && e.solved && e.attempt === 1 ? 1 : 0) },
  { id: "d-star-1", period: "daily", tier: "hard", target: 1, requires: { minRank: "bronze" }, progress: (e) => (e.type === "challenge_cleared" ? e.newStars : 0) },
  // ---------------- WEEKLY · easy ----------------
  { id: "w-draft-7", period: "weekly", tier: "easy", target: 7, progress: run(() => 1) },
  { id: "w-series-15", period: "weekly", tier: "easy", target: 15, progress: run((e) => e.seriesWins) },
  { id: "w-daily-3", period: "weekly", tier: "easy", target: 3, progress: run((e) => e.mode === "daily") },
  { id: "w-quiz-3", period: "weekly", tier: "easy", target: 3, progress: (e) => (e.type === "quiz_played" ? 1 : 0) },
  { id: "w-goals-60", period: "weekly", tier: "easy", target: 60, progress: run((e) => e.goals) },
  { id: "w-quick-3", period: "weekly", tier: "easy", target: 3, progress: run((e) => e.mode === "quick") },
  // ---------------- WEEKLY · mid ----------------
  { id: "w-draft-12", period: "weekly", tier: "mid", target: 12, progress: run(() => 1) },
  { id: "w-win-3", period: "weekly", tier: "mid", target: 3, progress: (e) => Number(won(e)) },
  { id: "w-playoffs-5", period: "weekly", tier: "mid", target: 5, progress: (e) => Number(playoffs(e)) },
  { id: "w-series-30", period: "weekly", tier: "mid", target: 30, progress: run((e) => e.seriesWins) },
  { id: "w-chem-great-3", period: "weekly", tier: "mid", target: 3, progress: run((e) => e.chemistryTier === "Great" || e.chemistryTier === "Perfect") },
  { id: "w-special-field-5", period: "weekly", tier: "mid", target: 5, requires: { minRank: "bronze" }, progress: run((e) => e.specialsFielded) },
  { id: "w-quiz-solve-4", period: "weekly", tier: "mid", target: 4, progress: (e) => (e.type === "quiz_played" && e.solved ? 1 : 0) },
  { id: "w-challenge-2", period: "weekly", tier: "mid", target: 2, requires: { minRank: "bronze" }, progress: (e) => (e.type === "challenge_cleared" ? 1 : 0) },
  { id: "w-regional-3", period: "weekly", tier: "mid", target: 3, progress: run((e) => e.region !== null) },
  { id: "w-career-matchdays-5", period: "weekly", tier: "mid", target: 5, requires: { career: true }, progress: (e) => (e.type === "career_matchday" ? 1 : 0) },
  // ---------------- WEEKLY · hard ----------------
  { id: "w-win-hard-2", period: "weekly", tier: "hard", target: 2, requires: { minRank: "silver" }, progress: run((e) => e.placement === "champion" && atLeast(e, "hard")) },
  { id: "w-win-legacy-1", period: "weekly", tier: "hard", target: 1, requires: { legacyUnlocked: true }, progress: run((e) => e.placement === "champion" && e.difficulty === "legacy") },
  { id: "w-daily-win-3", period: "weekly", tier: "hard", target: 3, progress: run((e) => e.mode === "daily" && e.placement === "champion") },
  { id: "w-stars-5", period: "weekly", tier: "hard", target: 5, requires: { minRank: "bronze" }, progress: (e) => (e.type === "challenge_cleared" ? e.newStars : 0) },
  { id: "w-chem-perfect-2", period: "weekly", tier: "hard", target: 2, progress: run((e) => e.chemistryTier === "Perfect") },
  { id: "w-hidden-win-1", period: "weekly", tier: "hard", target: 1, progress: run((e) => e.hiddenOverall && e.placement === "champion") },
  { id: "w-series-50", period: "weekly", tier: "hard", target: 50, progress: run((e) => e.seriesWins) },
  { id: "w-career-title", period: "weekly", tier: "hard", target: 1, requires: { career: true }, progress: (e) => (e.type === "career_title" ? 1 : 0) },
];

export const missionById: ReadonlyMap<string, MissionDef> = new Map(MISSION_CATALOG.map((m) => [m.id, m]));

export function missionEligible(m: MissionDef, el: MissionEligibility): boolean {
  const r = m.requires;
  if (!r) return true;
  if (r.minRank && rankIndex(el.rankId) < rankIndex(r.minRank)) return false;
  if (r.legacyUnlocked && !el.legacyUnlocked) return false;
  if (r.career && !el.careerAvailable) return false;
  return true;
}

/** ISO-8601 week key for a UTC date, e.g. "2026-W43" (weeks start on Monday). */
export function weekKey(now = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = d.getUTCDay() || 7; // Mon=1 … Sun=7
  d.setUTCDate(d.getUTCDate() + 4 - day); // Thursday of this week decides the year
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - yearStart) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** The period key for "now": the UTC day for dailies, the ISO week for weeklies. */
export function periodKey(period: MissionPeriod, now = new Date()): string {
  return period === "daily" ? now.toISOString().slice(0, 10) : weekKey(now);
}

/**
 * Deterministic pick: one eligible mission per tier for the period key. Every
 * player with the same eligibility gets the same set for the same key.
 */
export function pickMissions(period: MissionPeriod, key: string, el: MissionEligibility): string[] {
  const rng = createRng(seedFromKey(`${period}:${key}`));
  const out: string[] = [];
  for (const tier of ["easy", "mid", "hard"] as MissionTier[]) {
    const pool = MISSION_CATALOG.filter((m) => m.period === period && m.tier === tier && missionEligible(m, el));
    if (pool.length === 0) continue;
    out.push(pool[rng.int(0, pool.length - 1)].id);
  }
  return out;
}

export interface MissionSlotState {
  key: string;
  ids: string[];
  progress: Record<string, number>;
  /** id → ISO date completed (reward already granted). */
  completedAt: Record<string, string>;
  /** ISO date the all-three bonus was granted, or null. */
  bonusAt: string | null;
}

export interface MissionsState {
  daily: MissionSlotState | null;
  weekly: MissionSlotState | null;
  /** Lifetime count of completed missions (cosmetic source). */
  completedTotal: number;
}

export const EMPTY_MISSIONS: MissionsState = { daily: null, weekly: null, completedTotal: 0 };

/** A fresh slot for the key (progress 0, nothing completed). */
export function newSlot(period: MissionPeriod, key: string, el: MissionEligibility): MissionSlotState {
  return { key, ids: pickMissions(period, key, el), progress: {}, completedAt: {}, bonusAt: null };
}

/** Roll the periods whose key moved on. Returns the same object when nothing changed. */
export function rollMissions(state: MissionsState, el: MissionEligibility, now = new Date()): MissionsState {
  const dKey = periodKey("daily", now);
  const wKey = periodKey("weekly", now);
  const daily = state.daily?.key === dKey ? state.daily : newSlot("daily", dKey, el);
  const weekly = state.weekly?.key === wKey ? state.weekly : newSlot("weekly", wKey, el);
  if (daily === state.daily && weekly === state.weekly) return state;
  return { ...state, daily, weekly };
}

export interface MissionApplyResult {
  state: MissionsState;
  /** Season XP to grant (missions + bonuses). */
  xp: number;
  /** Mission ids completed by this event, in order. */
  completed: string[];
  /** Periods whose all-three bonus was just earned. */
  bonuses: MissionPeriod[];
}

/** Fold one event into both periods (after `rollMissions`). Pure. */
export function applyMissionEvent(state: MissionsState, event: MissionEvent, now = new Date()): MissionApplyResult {
  const nowIso = now.toISOString();
  let xp = 0;
  const completed: string[] = [];
  const bonuses: MissionPeriod[] = [];
  let completedTotal = state.completedTotal;

  const fold = (slot: MissionSlotState | null, period: MissionPeriod): MissionSlotState | null => {
    if (!slot) return slot;
    let changed = false;
    const progress = { ...slot.progress };
    const completedAt = { ...slot.completedAt };
    for (const id of slot.ids) {
      if (completedAt[id]) continue;
      const def = missionById.get(id);
      if (!def) continue;
      const delta = def.progress(event);
      if (!(delta > 0)) continue;
      changed = true;
      progress[id] = Math.min(def.target, (progress[id] ?? 0) + delta);
      if (progress[id] >= def.target) {
        completedAt[id] = nowIso;
        completed.push(id);
        completedTotal += 1;
        xp += MISSIONS[period].xp[def.tier];
      }
    }
    if (!changed) return slot;
    let bonusAt = slot.bonusAt;
    if (!bonusAt && slot.ids.length > 0 && slot.ids.every((id) => completedAt[id])) {
      bonusAt = nowIso;
      bonuses.push(period);
      xp += MISSIONS[period].allBonus;
    }
    return { ...slot, progress, completedAt, bonusAt };
  };

  const daily = fold(state.daily, "daily");
  const weekly = fold(state.weekly, "weekly");
  if (daily === state.daily && weekly === state.weekly) return { state, xp: 0, completed, bonuses };
  return { state: { daily, weekly, completedTotal }, xp, completed, bonuses };
}

/** Merge two slots of the SAME key: per-mission MAX progress, union completions. */
export function mergeSlots(a: MissionSlotState | null, b: MissionSlotState | null): MissionSlotState | null {
  if (!a) return b;
  if (!b) return a;
  if (a.key !== b.key) return a.key > b.key ? a : b; // the newer period wins
  const ids = a.ids.length ? a.ids : b.ids;
  const progress: Record<string, number> = { ...a.progress };
  for (const [id, n] of Object.entries(b.progress)) progress[id] = Math.max(progress[id] ?? 0, n);
  const completedAt: Record<string, string> = { ...a.completedAt };
  for (const [id, d] of Object.entries(b.completedAt)) completedAt[id] = completedAt[id] ? (completedAt[id] < d ? completedAt[id] : d) : d;
  const bonusAt = a.bonusAt && b.bonusAt ? (a.bonusAt < b.bonusAt ? a.bonusAt : b.bonusAt) : a.bonusAt ?? b.bonusAt;
  return { key: a.key, ids, progress, completedAt, bonusAt };
}

export function mergeMissions(a: MissionsState, b: MissionsState): MissionsState {
  return {
    daily: mergeSlots(a.daily, b.daily),
    weekly: mergeSlots(a.weekly, b.weekly),
    completedTotal: Math.max(a.completedTotal, b.completedTotal),
  };
}

// ---------------------------------------------------------------------------
// Login streak
// ---------------------------------------------------------------------------

export interface LoginState {
  /** UTC day of the last counted login, or null. */
  lastDay: string | null;
  streak: number;
  best: number;
  /** Total days logged in (lifetime). */
  total: number;
}

export const EMPTY_LOGIN: LoginState = { lastDay: null, streak: 0, best: 0, total: 0 };

export interface LoginResult {
  state: LoginState;
  /** True when this call counted a new day. */
  counted: boolean;
  xp: number;
  /** Milestone reached today (3 / 7 / 14 / 30), if any. */
  milestone: number | null;
}

const dayKey = (d: Date): string => d.toISOString().slice(0, 10);

/** XP for the Nth consecutive day. */
export function loginDayXp(streak: number): number {
  return Math.min(LOGIN_STREAK.perDayMax, LOGIN_STREAK.perDayBase + LOGIN_STREAK.perDayStep * Math.max(0, streak - 1));
}

/** Count today's login (idempotent within a UTC day). */
export function recordLogin(state: LoginState, now = new Date()): LoginResult {
  const today = dayKey(now);
  if (state.lastDay === today) return { state, counted: false, xp: 0, milestone: null };
  const yesterday = dayKey(new Date(now.getTime() - 86_400_000));
  const streak = state.lastDay === yesterday ? state.streak + 1 : 1;
  const milestone = LOGIN_STREAK.milestoneBonus[streak] !== undefined ? streak : null;
  const xp = loginDayXp(streak) + (milestone ? LOGIN_STREAK.milestoneBonus[milestone] : 0);
  return {
    state: { lastDay: today, streak, best: Math.max(state.best, streak), total: state.total + 1 },
    counted: true,
    xp,
    milestone,
  };
}

/** Merge two login states (cloud ↔ local): latest day, MAX of the rest. A streak
 *  is only as long as the latest side knows; `best` and `total` are monotonic. */
export function mergeLogin(a: LoginState, b: LoginState): LoginState {
  const latest = (a.lastDay ?? "") >= (b.lastDay ?? "") ? a : b;
  const sameDay = a.lastDay !== null && a.lastDay === b.lastDay;
  return {
    lastDay: latest.lastDay,
    streak: sameDay ? Math.max(a.streak, b.streak) : latest.streak,
    best: Math.max(a.best, b.best, a.streak, b.streak),
    total: Math.max(a.total, b.total),
  };
}
