/**
 * Road to Worlds — rc9 LOCKER (R218): what the Squad screen and HQ show for
 * each player, as pure reads of the save. No rule here; the numbers come from
 * `lockerRoom.ts` and CAREER_LOCKER.
 *
 * Per player: his morale and the mood a screen shows (held by the
 * hysteresis), the trend of the last weeks, the main reason as a copy key
 * (`locker.why.<reason>`) with its params, whether something waits for the
 * manager (a talk about him, a minutes promise one bench from breaking), and
 * the match effect his mood carries into an official event.
 */

import { CAREER_LOCKER as L } from "@/config/balance.lockerRoom";
import {
  lockerDaysBetween,
  moodMatchEffectOf,
  moraleOf,
  openTalksOf,
  promiseProgressOf,
  shownMoodOf,
  type LockerDate,
  type LockerRoomState,
  type MoodId,
  type MoraleReason,
} from "./lockerRoom";

export type MoodTrend = "up" | "down" | "steady";

export interface LockerPlayerView {
  playerId: string;
  morale: number;
  mood: MoodId;
  trend: MoodTrend;
  /** The change that explains his mood now: copy key `locker.why[reason]`, null = nothing recent. */
  reason: { key: MoraleReason; params: Record<string, string | number> } | null;
  /** A talk about him is open, or his minutes promise breaks on one more bench. */
  waiting: boolean;
  /** The open talk about him, if any. */
  talkId: string | null;
  /** Rating points his mood carries into an official event (before the lineup average and clamp). */
  matchEffect: number;
}

/** The window the trend and the reason read, in days; a trend needs this much net change in it. */
const RECENT_DAYS = L.view.recentDays;
const TREND_MIN = L.view.trendMin;

export function lockerPlayerViewOf(
  save: { clock: LockerDate; lockerRoom?: LockerRoomState | null },
  playerId: string,
): LockerPlayerView {
  const st = save.lockerRoom ?? null;
  const mood = shownMoodOf(st, playerId);
  const recent = (st?.log ?? []).filter((e) => e.playerId === playerId && lockerDaysBetween(e.on, save.clock) <= RECENT_DAYS);
  const net = recent.reduce((n, e) => n + e.delta, 0);
  const trend: MoodTrend = net >= TREND_MIN ? "up" : net <= -TREND_MIN ? "down" : "steady";
  // The reason: the biggest recent change in the trend's direction, else the newest change.
  const pool = trend === "up" ? recent.filter((e) => e.delta > 0) : trend === "down" ? recent.filter((e) => e.delta < 0) : recent;
  const main = pool.slice().sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0] ?? recent[0] ?? null;
  const talk = openTalksOf(st).find((t) => t.playerId === playerId) ?? null;
  const atRisk = (st?.promises ?? []).some((p) => p.playerId === playerId && promiseProgressOf(p).atRisk);
  return {
    playerId,
    morale: moraleOf(st, playerId),
    mood,
    trend,
    reason: main ? { key: main.reason, params: { delta: main.delta } } : null,
    waiting: Boolean(talk) || atRisk,
    talkId: talk?.id ?? null,
    matchEffect: moodMatchEffectOf(mood),
  };
}

/** The view of every squad player, in squad order. */
export function lockerSquadViewOf(save: {
  clock: LockerDate;
  squad: { id: string }[];
  lockerRoom?: LockerRoomState | null;
}): LockerPlayerView[] {
  return save.squad.map((p) => lockerPlayerViewOf(save, p.id));
}

/** The match effect table by mood (for a legend on the screen). */
export function moodMatchTable(): { mood: MoodId; points: number }[] {
  return L.moods.map((m) => ({ mood: m.id as MoodId, points: moodMatchEffectOf(m.id as MoodId) }));
}
