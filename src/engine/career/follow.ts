/**
 * Road to Worlds rc.36 (SUN-03, R88) — following an event the user is OUT
 * of (pure TS): the user's own regional after a lost Saturday qualifier, or a
 * Major / Worlds they are not in. When such an event resolves headlessly its
 * result is banked as always (`eventResults`); this keeps a compact copy of
 * how it went — the field, every round's series and scores, the bracket —
 * so HQ and /career/follow can show who played, the rounds and the results,
 * and replay them round by round (watch), all at once (results) or not at
 * all (skip). Display only: nothing here feeds the sim or the economy.
 */

import type { SeriesResult, TournamentState } from "@/engine/types";
import type { CareerEventDef, FollowEventState, FollowSeries } from "./types";

function compactSeries(s: SeriesResult): FollowSeries {
  return { a: s.teamAId, b: s.teamBId, sa: s.score[0], sb: s.score[1] };
}

/** The compact follow record of a finished event (`t` as the headless sim left it). */
export function followRecordOf(
  def: CareerEventDef,
  t: TournamentState,
  opts: { reason: FollowEventState["reason"]; qualifiedIds?: string[] },
): FollowEventState {
  return {
    def,
    reason: opts.reason,
    teams: Object.values(t.teams).map((team) => ({
      id: team.id,
      name: team.name,
      rating: Math.round(team.rating.total * 10) / 10,
    })),
    qualifiedIds: opts.qualifiedIds ?? [],
    swiss: t.swiss.rounds.map((r) => r.series.map(compactSeries)),
    playoffs: (t.playoffs?.rounds ?? []).map((r) => ({ name: r.name, series: r.series.map(compactSeries) })),
    seeds: t.playoffs?.seeds ?? [],
    champion: t.playoffs?.championTeamId ?? null,
    view: null,
    dismissed: false,
  };
}

/** The winner of a compact series. */
export function followWinnerOf(s: FollowSeries): string {
  return s.sa >= s.sb ? s.a : s.b;
}

/** One revealable step of a followed event: a Swiss round, or a playoff round. */
export interface FollowRound {
  key: string;
  stage: "swiss" | "playoffs";
  /** 1-based Swiss round number, or the playoff round's name. */
  label: number | string;
  series: FollowSeries[];
}

/** Every round in play order: the Swiss rounds, then the playoff rounds. */
export function followRoundsOf(f: Pick<FollowEventState, "swiss" | "playoffs">): FollowRound[] {
  return [
    ...f.swiss.map((series, i) => ({ key: `sw:${i}`, stage: "swiss" as const, label: i + 1, series })),
    ...f.playoffs.map((r, i) => ({ key: `po:${i}`, stage: "playoffs" as const, label: r.name, series: r.series })),
  ];
}

export interface FollowRecordRow {
  id: string;
  wins: number;
  losses: number;
  gameDiff: number;
}

/**
 * The Swiss table after the first `swissRounds` rounds (wins ↓, losses ↑,
 * game difference ↓, then the field order) — never a round not yet revealed.
 */
export function followSwissTable(
  f: Pick<FollowEventState, "teams" | "swiss">,
  swissRounds: number,
): FollowRecordRow[] {
  const rows = new Map<string, FollowRecordRow>(f.teams.map((t) => [t.id, { id: t.id, wins: 0, losses: 0, gameDiff: 0 }]));
  for (const round of f.swiss.slice(0, Math.max(0, swissRounds))) {
    for (const s of round) {
      const winner = followWinnerOf(s);
      const loser = winner === s.a ? s.b : s.a;
      const margin = Math.abs(s.sa - s.sb);
      const w = rows.get(winner);
      const l = rows.get(loser);
      if (w) {
        w.wins += 1;
        w.gameDiff += margin;
      }
      if (l) {
        l.losses += 1;
        l.gameDiff -= margin;
      }
    }
  }
  const order = new Map(f.teams.map((t, i) => [t.id, i]));
  return [...rows.values()].sort(
    (x, y) =>
      y.wins - x.wins ||
      x.losses - y.losses ||
      y.gameDiff - x.gameDiff ||
      (order.get(x.id) ?? 0) - (order.get(y.id) ?? 0),
  );
}

/**
 * rc.36 (SUN-03): the load repair for the follow record — idempotent; an
 * unreadable one is dropped (absent = nothing to follow).
 */
export function repairFollowState(save: { followEvent?: unknown }): void {
  const f = save.followEvent as Partial<FollowEventState> | null | undefined;
  if (f === undefined || f === null) return;
  const ok =
    typeof f === "object" &&
    typeof f.def === "object" &&
    f.def !== null &&
    typeof (f.def as CareerEventDef).id === "string" &&
    Array.isArray(f.teams) &&
    Array.isArray(f.swiss) &&
    Array.isArray(f.playoffs);
  if (!ok) {
    save.followEvent = null;
    return;
  }
  if (!Array.isArray(f.seeds)) f.seeds = [];
  if (!Array.isArray(f.qualifiedIds)) f.qualifiedIds = [];
  if (f.view !== "watch" && f.view !== "results") f.view = null;
  if (typeof f.dismissed !== "boolean") f.dismissed = false;
  if (f.reason !== "eliminated" && f.reason !== "notQualified") f.reason = "notQualified";
  if (f.champion === undefined) f.champion = null;
}
