/**
 * rc9 LEGACY: the player's series of a finished Draft run, reduced to the
 * facts analytics needs to see "absurd" losses on real players
 * (`run_completed`, docs/ANALYTICS-EVENTS-2.0.md). Pure, draws nothing.
 *
 * "Shown" = displayTeamOverall (what the screens print, before any hidden
 * lift). "Strength" = the rating the opponent actually played the series at
 * (hidden difficulty / region lift included, upset guard applied).
 */

import { guardedSide } from "./match";
import { displayTeamOverall } from "./rating";
import type { SeriesResult, TournamentState } from "./types";

export interface RunSeriesFacts {
  seriesWon: number;
  seriesLost: number;
  /** Average shown overall of every opponent the player met (0 when none). */
  oppOverallAvg: number;
  /** Lost series against an opponent shown at least 5 / 8 / 10 below the player. */
  lostToLowerBy5: number;
  lostToLowerBy8: number;
  lostToLowerBy10: number;
  /** Largest shown gap (player minus opponent) among the lost series; null if none lost. */
  worstLossGap: number | null;
  /** The series that ended the run (null for the champion). */
  endOppOverall: number | null;
  endOppStrength: number | null;
  endGap: number | null;
  /** "2-4", the player's games first. */
  endScore: string | null;
  /** "swiss" or the playoff round name. */
  endRound: string | null;
}

export function runSeriesFacts(t: TournamentState | null | undefined): RunSeriesFacts {
  const empty: RunSeriesFacts = {
    seriesWon: 0, seriesLost: 0, oppOverallAvg: 0, lostToLowerBy5: 0, lostToLowerBy8: 0, lostToLowerBy10: 0,
    worstLossGap: null, endOppOverall: null, endOppStrength: null, endGap: null, endScore: null, endRound: null,
  };
  const user = t?.teams.user;
  if (!t || !user) return empty;
  const list: { s: SeriesResult; round: string }[] = [];
  for (const r of t.swiss.rounds) for (const s of r.series) if (s.teamAId === "user" || s.teamBId === "user") list.push({ s, round: "swiss" });
  for (const r of t.playoffs?.rounds ?? []) for (const s of r.series) if (s.teamAId === "user" || s.teamBId === "user") list.push({ s, round: r.name });
  if (list.length === 0) return empty;

  const userShown = displayTeamOverall(user.rating);
  const out = { ...empty };
  let oppSum = 0;
  for (const { s } of list) {
    const opp = t.teams[s.teamAId === "user" ? s.teamBId : s.teamAId];
    const gap = userShown - displayTeamOverall(opp.rating);
    oppSum += displayTeamOverall(opp.rating);
    if (s.winnerTeamId === "user") { out.seriesWon++; continue; }
    out.seriesLost++;
    if (gap >= 5) out.lostToLowerBy5++;
    if (gap >= 8) out.lostToLowerBy8++;
    if (gap >= 10) out.lostToLowerBy10++;
    out.worstLossGap = out.worstLossGap == null ? gap : Math.max(out.worstLossGap, gap);
  }
  out.oppOverallAvg = Math.round((oppSum / list.length) * 10) / 10;

  // The run-ending loss: the last lost series that is not the 3rd-place match.
  if (t.playoffs?.championTeamId !== "user") {
    for (let i = list.length - 1; i >= 0; i--) {
      const { s, round } = list[i];
      if (s.winnerTeamId === "user" || round === "third_place") continue;
      const opp = t.teams[s.teamAId === "user" ? s.teamBId : s.teamAId];
      const score = s.teamAId === "user" ? s.score : [s.score[1], s.score[0]];
      out.endOppOverall = displayTeamOverall(opp.rating);
      out.endOppStrength = Math.round(guardedSide(opp, user).rating.total * 10) / 10;
      out.endGap = userShown - out.endOppOverall;
      out.endScore = `${score[0]}-${score[1]}`;
      out.endRound = round;
      break;
    }
  }
  return out;
}
