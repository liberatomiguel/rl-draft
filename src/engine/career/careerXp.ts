/**
 * Road to Worlds — profile (Season) XP from career play (v2.0, C1). Pure.
 *
 * The career feeds the same profile XP the draft does, so a manager's season
 * moves the rank ladder too: a series played (more for a win), an event
 * finished (by tier), a title (by tier) and a season completed. Every figure
 * is in CAREER_XP (provisional — session C2 calibrates them against the
 * draft's pace). MMR / Season Rating stays the draft's alone: nothing here
 * touches it.
 *
 * `careerXpBetween(prev, next)` reads one write of the SAME save: lifetime
 * counters only go up, so the difference is what the write earned. A save
 * that is not the same career (another slot, a reload of an older copy)
 * earns nothing.
 */

import { CAREER_XP } from "@/config/balance";
import type { CareerSave, EventTier } from "./types";

export interface CareerXpGain {
  total: number;
  series: number;
  events: number;
  titles: number;
  seasons: number;
}

const NONE: CareerXpGain = { total: 0, series: 0, events: 0, titles: 0, seasons: 0 };

const up = (a: number | undefined, b: number | undefined): number => Math.max(0, (b ?? 0) - (a ?? 0));

export function careerXpBetween(prev: CareerSave | null | undefined, next: CareerSave | null | undefined): CareerXpGain {
  if (!prev || !next || prev === next || prev.careerSeed !== next.careerSeed) return NONE;
  const a = prev.stats;
  const b = next.stats;
  if (!a || !b) return NONE;

  const wins = up(a.seriesWins, b.seriesWins);
  const losses = up(a.seriesLosses, b.seriesLosses);
  const series = wins * (CAREER_XP.seriesPlayed + CAREER_XP.seriesWinBonus) + losses * CAREER_XP.seriesPlayed;

  // Events the user finished in this write: results that were not there before.
  const known = new Set(prev.eventResults.map((r) => r.eventId));
  let events = 0;
  for (const r of next.eventResults) {
    if (r.userPlacement === undefined || known.has(r.eventId)) continue;
    events += CAREER_XP.eventFinished[r.tier as EventTier] ?? 0;
  }

  const titles =
    up(a.titlesT3, b.titlesT3) * CAREER_XP.title.t3 +
    up(a.titlesT2, b.titlesT2) * CAREER_XP.title.t2 +
    up(a.titlesRegional, b.titlesRegional) * CAREER_XP.title.regional +
    up(a.titlesMajor, b.titlesMajor) * CAREER_XP.title.major +
    up(a.titlesWorlds, b.titlesWorlds) * CAREER_XP.title.worlds;

  // A season completed: its review was filed (a history row for a later season than the last one known).
  const last = (s: CareerSave): number => (s.history?.length ? s.history[s.history.length - 1].seasonIndex : -1);
  const seasons = last(next) > last(prev) ? CAREER_XP.seasonCompleted : 0;

  const total = Math.min(CAREER_XP.maxPerWrite, Math.round(series + events + titles + seasons));
  return total > 0 ? { total, series, events, titles, seasons } : NONE;
}
