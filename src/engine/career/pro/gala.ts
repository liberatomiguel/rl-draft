/**
 * v2.2 Pro (PRO-SPEC §8, R150): the end-of-season gala. Pure and deterministic:
 * the spine supplies one candidate per player of the region (or of the world),
 * with what the world knows about him, and gets back who won what and who was
 * named. The Pro is a candidate like any other (`pro:self`); he can win or be
 * a nominee.
 *
 * An award is only given on data that supports it:
 *  - MVP and the team of the season rank on overall and the team's result,
 *    plus the average rating where a box score exists (for the AI there is none:
 *    §8 says result and overall);
 *  - the breakout needs a young player with a real overall gain;
 *  - the most decisive needs a box-score line with enough games and enough
 *    series MVPs / deciding moments. With no such line, nobody gets it.
 */

import { CAREER_PRO_GALA as G } from "@/config/balance";
import type { Region } from "../../types";
import type { ProHonor } from "./types";

export type { ProHonor };

export type GalaAwardKind = "mvp" | "breakout" | "teamOfSeason" | "mostDecisive";
export type GalaScope = "region" | "world";

/** What a box score says about a player's season (only where one exists: the Pro's own games). */
export interface GalaLine {
  games: number;
  /** Mean 0-10 rating over the season. */
  avgRating: number;
  /** Series MVPs. */
  mvps: number;
  /** Key moments that decided a game and were his. */
  decidingMoments: number;
}

export interface GalaCandidate {
  id: string;
  name: string;
  region: Region;
  age: number;
  overall: number;
  /** His overall when the season began (the breakout reads the gain). */
  overallStart: number;
  /** Seasons as a pro, this one included. */
  seasonsPro: number;
  /** The team's season, 0 (nothing) to 1 (won everything). */
  teamResult: number;
  line?: GalaLine;
}

export interface GalaAward {
  kind: GalaAwardKind;
  scope: GalaScope;
  /** One winner; three for the team of the season. Empty when no data supports the award. */
  winners: string[];
  /** The next names behind the winners, best first (G.nominees of them). */
  nominees: string[];
}

export interface GalaInput {
  seasonIndex: number;
  scope: GalaScope;
  /** The region the scope is about (required for "region"). */
  region?: Region;
  candidates: GalaCandidate[];
}

const r3 = (x: number) => Math.round(x * 1000) / 1000;

/** Best first; ties by id so the order never depends on the input order. */
function rank(cs: GalaCandidate[], score: (c: GalaCandidate) => number): GalaCandidate[] {
  return cs
    .map((c) => ({ c, s: r3(score(c)) }))
    .sort((a, b) => b.s - a.s || (a.c.id < b.c.id ? -1 : a.c.id > b.c.id ? 1 : 0))
    .map((x) => x.c);
}

export function mvpScore(c: GalaCandidate): number {
  const base = c.overall * G.mvp.overallW + c.teamResult * G.mvp.resultW;
  return c.line && c.line.games > 0 ? base + (c.line.avgRating - 6) * G.mvp.ratingW : base;
}

export function breakoutScore(c: GalaCandidate): number {
  return (c.overall - c.overallStart) * G.breakout.gainW + c.overall * G.breakout.overallW + c.teamResult * G.breakout.resultW;
}

export function decisiveShare(line: GalaLine): number {
  return line.games > 0 ? (line.mvps + line.decidingMoments) / line.games : 0;
}

export function decisiveScore(line: GalaLine): number {
  return (
    (line.mvps / line.games) * G.decisive.mvpW + (line.decidingMoments / line.games) * G.decisive.momentW + (line.avgRating - 6) * G.decisive.ratingW
  );
}

function award(kind: GalaAwardKind, scope: GalaScope, ordered: GalaCandidate[], winnersN: number): GalaAward {
  const winners = ordered.slice(0, winnersN).map((c) => c.id);
  const nominees = ordered.slice(winnersN, winnersN + G.nominees).map((c) => c.id);
  return { kind, scope, winners, nominees };
}

/** The four awards of one scope. */
export function galaAwards(input: GalaInput): GalaAward[] {
  const pool = input.scope === "region" && input.region ? input.candidates.filter((c) => c.region === input.region) : input.candidates;
  const out: GalaAward[] = [];

  const eligible = pool.filter((c) => c.overall >= G.mvp.minOverall);
  const byMvp = rank(eligible, mvpScore);
  out.push(award("mvp", input.scope, byMvp, 1));

  const young = pool.filter(
    (c) => c.age <= G.breakout.maxAge && c.seasonsPro <= G.breakout.maxSeasonsPro && c.overall - c.overallStart >= G.breakout.minGain,
  );
  out.push(award("breakout", input.scope, rank(young, breakoutScore), 1));

  out.push(award("teamOfSeason", input.scope, byMvp, G.teamSize));

  const lined = pool.filter((c) => c.line && c.line.games >= G.decisive.minGames && decisiveShare(c.line) >= G.decisive.minShare);
  out.push(award("mostDecisive", input.scope, rank(lined, (c) => decisiveScore(c.line!)), 1));
  return out;
}

/** The region's and the world's gala together. */
export function galaForSeason(seasonIndex: number, region: Region, candidates: GalaCandidate[]): GalaAward[] {
  return [
    ...galaAwards({ seasonIndex, scope: "region", region, candidates }),
    ...galaAwards({ seasonIndex, scope: "world", candidates }),
  ];
}

/** What the gala says about one player: a win or a nomination in each award he is named in. */
export function honorsOf(awards: GalaAward[], id: string, seasonIndex: number): ProHonor[] {
  const out: ProHonor[] = [];
  for (const a of awards) {
    if (a.winners.includes(id)) out.push({ kind: a.kind, scope: a.scope, seasonIndex, place: "winner" });
    else if (a.nominees.includes(id)) out.push({ kind: a.kind, scope: a.scope, seasonIndex, place: "nominee" });
  }
  return out;
}
