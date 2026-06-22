/**
 * Achievement evaluation (v1.4 — rebuilt around Miguel's set, grouped by theme).
 *
 * Split so achievements can fire the MOMENT they're earned, not only at run end:
 *   · teamAchievements  — when a team is built (review).
 *   · liveAchievements  — in-match / series feats (after each tournament round).
 *   · evaluateRunAchievements — team + live + win-conditions, at run end.
 *   · evaluateCounterAchievements — lifetime counters / collection / rank,
 *     against the PROFILE AFTER this run's results are applied.
 * Every function filters out already-earned ids and returns only the new ones.
 * Pure + deterministic (no React, no storage).
 */

import { lineupById, playerById, playerCardById, seasonById } from "@/data";
import { userPlayoffSeries } from "./playoffs";
import { userSwissRecord } from "./swiss";
import type {
  ChemistryResult,
  Region,
  Roster,
  RosterPick,
  RunState,
  SeriesResult,
  TournamentState,
} from "./types";

export const CREATOR_SPECIAL_ID = "sp-liberatorl-rocket-draft-creator";

// --- roster helpers -------------------------------------------------------

function rosterPlayers(roster: Roster): RosterPick[] {
  return [roster.player1, roster.player2, roster.player3].filter(Boolean) as RosterPick[];
}
function regionOf(pick: RosterPick): Region | undefined {
  const card = playerCardById.get(pick.refId);
  return card ? playerById.get(card.playerId)?.region : undefined;
}
function yearOf(pick: RosterPick): number {
  const card = playerCardById.get(pick.refId);
  const season = card ? seasonById.get(card.seasonId) : undefined;
  return season ? parseInt(season.year, 10) : NaN;
}
function isEliteCard(pick: RosterPick): boolean {
  const card = playerCardById.get(pick.refId);
  return card ? lineupById.get(card.lineupId)?.historicalStrength === "elite" : false;
}
function allThreePlayers(roster: Roster): boolean {
  return rosterPlayers(roster).length === 3;
}

// --- series / game views --------------------------------------------------

function userSeries(t: TournamentState): SeriesResult[] {
  const swiss = t.swiss.rounds.flatMap((r) =>
    r.series.filter((s) => s.teamAId === "user" || s.teamBId === "user"),
  );
  const playoffs = userPlayoffSeries(t.playoffs).map((e) => e.series);
  return [...swiss, ...playoffs];
}
const userWon = (s: SeriesResult) => s.winnerTeamId === "user";
/** user rating minus opponent rating in a series. */
const userRatingDiff = (s: SeriesResult) =>
  s.teamAId === "user" ? s.ratingDiff : -s.ratingDiff;

interface UserGame {
  goals: number[]; // per user player
  team: number;
  opp: number;
  won: boolean;
}
function gamesOf(seriesList: SeriesResult[]): UserGame[] {
  const out: UserGame[] = [];
  for (const s of seriesList) {
    const userIsA = s.teamAId === "user";
    for (const g of s.games) {
      const goals = (userIsA ? g.scorers?.a : g.scorers?.b) ?? [];
      const team = goals.reduce((x, y) => x + y, 0);
      const won = g.winnerTeamId === "user";
      const opp = won ? team - (g.score[0] - g.score[1]) : team + (g.score[0] - g.score[1]);
      out.push({ goals, team, opp, won });
    }
  }
  return out;
}
function userGames(t: TournamentState): UserGame[] {
  return gamesOf(userSeries(t));
}
function goalsConceded(t: TournamentState): number {
  return userGames(t).reduce((sum, g) => sum + Math.max(0, g.opp), 0);
}
/**
 * User series in REVEAL order (swiss rounds first, then playoff rounds), each
 * tagged with whether it's a FINAL (grand_final / final). The order matches
 * `TournamentScreen`'s reveal order (one user series per round), so the UI can
 * slice the first N revealed series — see `liveAchievements`'s `revealedUserSeries`.
 */
function userSeriesWithMeta(t: TournamentState): { series: SeriesResult; isFinal: boolean }[] {
  const swiss = t.swiss.rounds.flatMap((r) =>
    r.series
      .filter((s) => s.teamAId === "user" || s.teamBId === "user")
      .map((series) => ({ series, isFinal: false })),
  );
  const playoffs = userPlayoffSeries(t.playoffs).map((e) => ({
    series: e.series,
    isFinal: e.round === "grand_final" || e.round === "final",
  }));
  return [...swiss, ...playoffs];
}

const only = (ids: string[], earned: ReadonlySet<string>) =>
  [...new Set(ids)].filter((id) => !earned.has(id));

// --- team feats (review-time) --------------------------------------------

export function teamAchievements(
  roster: Roster,
  chemistry: ChemistryResult,
  specialsCount: number,
  earned: ReadonlySet<string>,
): string[] {
  const ids: string[] = ["ach-first-team"];
  if (chemistry.tier === "Perfect") ids.push("ach-perfect-chem");
  if (specialsCount >= 3) ids.push("ach-three-specials");

  if (allThreePlayers(roster)) {
    const players = rosterPlayers(roster);
    const regions = players.map(regionOf);
    const byRegion: Record<Region, string> = {
      SAM: "ach-all-sam",
      EU: "ach-all-eu",
      NA: "ach-all-na",
      SSA: "ach-all-ssa",
      MENA: "ach-all-mena",
      OCE: "ach-all-oce",
      APAC: "ach-all-apac",
    };
    if (regions[0] && regions.every((r) => r === regions[0])) ids.push(byRegion[regions[0]]);
    if (players.every(isEliteCard)) ids.push("ach-all-champions");
    // Three players from the SAME ORG (v1.4.1). The old "same lineup" check was
    // unreachable: the draft offers each lineup at most once (shownLineupIds), so you
    // can never field 3 cards of one lineup. Org is reachable — different seasons of
    // the same org (e.g. NRG '16/'19/'25) share an orgId, and that's a real build.
    const orgs = players.map((p) => playerCardById.get(p.refId)?.orgId);
    if (orgs[0] && orgs.every((o) => o === orgs[0])) ids.push("ach-same-team");
  }
  return only(ids, earned);
}

// --- live feats (in-match / series) --------------------------------------

/**
 * In-match / series feats (hat-trick, 7-goal win, reverse sweep, giant-slayer,
 * game-7…). `revealedUserSeries`, when given, restricts evaluation to the first N
 * user series in REVEAL order — so the UI can fire a feat the moment its series is
 * revealed on screen, NOT when the engine simulates the whole bracket ahead of the
 * animation (which made e.g. a hat-trick pop before the match visibly started).
 * Omit it to evaluate the whole tournament (the run-end safety net in
 * `evaluateRunAchievements`). `awardAchievements` dedupes, so re-evaluating a
 * revealed series can never double-award.
 */
export function liveAchievements(
  t: TournamentState,
  earned: ReadonlySet<string>,
  revealedUserSeries?: number,
): string[] {
  const meta = userSeriesWithMeta(t);
  const considered =
    revealedUserSeries === undefined ? meta : meta.slice(0, Math.max(0, revealedUserSeries));
  const consideredSeries = considered.map((m) => m.series);
  const ids: string[] = [];
  for (const g of gamesOf(consideredSeries)) {
    if (g.won && g.team - g.opp >= 7) ids.push("ach-blowout");
    const top = Math.max(0, ...g.goals);
    if (top >= 3) ids.push("ach-hattrick");
    if (top >= 4) ids.push("ach-four-goals");
    if (g.team >= 3 && g.goals.some((x) => x === g.team)) ids.push("ach-solo-show");
  }
  for (const s of consideredSeries) {
    if (!userWon(s)) continue;
    if (userRatingDiff(s) < 0) ids.push("ach-giant-slayer");
    // Reverse sweep: fell behind by two games, then won.
    let u = 0;
    let o = 0;
    for (const g of s.games) {
      if (g.winnerTeamId === "user") u += 1;
      else o += 1;
      if (o - u >= 2) {
        ids.push("ach-reverse-sweep");
        break;
      }
    }
  }
  for (const { series } of considered.filter((m) => m.isFinal)) {
    if (!userWon(series)) continue;
    const total = series.score[0] + series.score[1];
    if (total === 7) ids.push("ach-game7");
    const decider = series.games[series.games.length - 1];
    if (total === 7 && decider?.overtime) ids.push("ach-ot-game7");
    if (Math.abs(decider?.score[0] - decider?.score[1]) === 1) ids.push("ach-one-goal-final");
  }
  return only(ids, earned);
}

// --- win-conditions (run-end) --------------------------------------------

function conditionAchievements(
  run: RunState,
  t: TournamentState,
  chemistry: ChemistryResult,
  earned: ReadonlySet<string>,
): string[] {
  const champion = t.playoffs?.championTeamId === "user";
  const ids: string[] = [];
  const players = rosterPlayers(run.draft.roster);

  if (run.mode === "quick" && userSeries(t).some(userWon)) ids.push("ach-quick-win");
  const swiss = userSwissRecord(t.swiss);
  if (swiss.wins === 3 && swiss.losses === 0) ids.push("ach-swiss-flawless");

  if (champion) {
    ids.push("ach-first-title");
    if (run.difficulty === "hard") ids.push("ach-hard-title");
    if (run.difficulty === "legacy") ids.push("ach-legacy-title");
    if (run.difficulty === "legacy" && run.regionLock) ids.push("ach-legacy-regional");
    if (run.mode === "daily") ids.push("ach-daily-win");
    if (userSeries(t).every(userWon)) ids.push("ach-undefeated");
    if (goalsConceded(t) === 0 && userSeries(t).length > 0) ids.push("ach-clean-sheet");
    // Lower-bracket title: lost an upper-bracket series on the way.
    if (userPlayoffSeries(t.playoffs).some((e) => e.round.startsWith("ub_") && !userWon(e.series))) {
      ids.push("ach-lower-bracket");
    }
    if (chemistry.tier === "Perfect") ids.push("ach-perfect-chem-title");
    if (chemistry.percent === 0) ids.push("ach-no-chem-title");
    if (allThreePlayers(run.draft.roster)) {
      const years = players.map(yearOf);
      if (years.every((y) => Number.isFinite(y) && y <= 2019)) ids.push("ach-early-era-title");
      if (years.every((y) => Number.isFinite(y) && y >= 2020)) ids.push("ach-open-era-title");
    }
    // Ever-present: a player scored in EVERY user game of the (finished) run.
    const games = userGames(t);
    if (games.length > 0 && [0, 1, 2].some((i) => games.every((g) => (g.goals[i] ?? 0) >= 1))) {
      ids.push("ach-scored-every-game");
    }
  }
  return only(ids, earned);
}

export function evaluateRunAchievements(
  run: RunState,
  t: TournamentState,
  earned: ReadonlySet<string>,
): string[] {
  const user = t.teams["user"];
  const chemistry: ChemistryResult =
    user?.chemistry ?? { raw: 0, max: 1, percent: 0, tier: "Poor", items: [] };
  const specialsCount = user?.specialIds.length ?? 0;
  return only(
    [
      ...teamAchievements(run.draft.roster, chemistry, specialsCount, earned),
      ...liveAchievements(t, earned),
      ...conditionAchievements(run, t, chemistry, earned),
    ],
    earned,
  );
}

// --- lifetime counters / collection / rank (post-update profile) ---------

export interface CounterSnapshot {
  runsCompleted: number;
  titlesTotal: number;
  legacyTitles: number;
  gamesWon: number;
  goalsScored: number;
  specialsOwned: number;
  totalSpecials: number;
  specialIds: ReadonlySet<string>;
  dailyStreak: number;
  rankId: string;
}

export function evaluateCounterAchievements(
  s: CounterSnapshot,
  earned: ReadonlySet<string>,
): string[] {
  const ids: string[] = [];
  if (s.runsCompleted >= 1) ids.push("ach-first-run");
  if (s.runsCompleted >= 10) ids.push("ach-runs-10");
  if (s.runsCompleted >= 50) ids.push("ach-runs-50");
  if (s.runsCompleted >= 200) ids.push("ach-runs-200");
  if (s.titlesTotal >= 5) ids.push("ach-titles-5");
  if (s.titlesTotal >= 15) ids.push("ach-titles-15");
  if (s.titlesTotal >= 50) ids.push("ach-titles-50");
  if (s.legacyTitles >= 10) ids.push("ach-legacy-10");
  if (s.gamesWon >= 50) ids.push("ach-games-50");
  if (s.gamesWon >= 200) ids.push("ach-games-200");
  if (s.goalsScored >= 100) ids.push("ach-goals-100");
  if (s.goalsScored >= 250) ids.push("ach-goals-250");
  if (s.goalsScored >= 500) ids.push("ach-goals-500");
  if (s.specialsOwned >= 1) ids.push("ach-first-special");
  if (s.specialsOwned >= 15) ids.push("ach-specials-15");
  if (s.specialsOwned >= 50) ids.push("ach-specials-50");
  if (s.totalSpecials > 0 && s.specialsOwned >= s.totalSpecials) ids.push("ach-specials-all");
  if (s.specialIds.has(CREATOR_SPECIAL_ID)) ids.push("ach-creator");
  if (s.dailyStreak >= 7) ids.push("ach-daily-7");
  if (s.rankId === "supersonic-legend") ids.push("ach-ssl");
  return only(ids, earned);
}

/** Per-run user totals (goals scored, individual game wins) for the counters. */
export function userRunTotals(t: TournamentState): { goals: number; gameWins: number } {
  const games = userGames(t);
  return {
    goals: games.reduce((sum, g) => sum + g.team, 0),
    gameWins: games.filter((g) => g.won).length,
  };
}
