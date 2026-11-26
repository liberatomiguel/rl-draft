/**
 * v2.2 Pro spine round 2 (PROSPINE): the season's gala and the scene
 * nicknames, fed from what the save and the world can prove.
 *
 * Candidates: every player on a world roster (his org included while it sits
 * on the host seat), with his overall, age and his team's share of the
 * region's season points; the Pro also with his box-score line (games,
 * average rating, game MVPs). No deciding-moment count exists yet, so the
 * "most decisive" award reads 0 for everyone and is not given (gala.ts gives
 * nothing the data does not support). Nickname facts are career totals the
 * spine counts from his own game lines and his titles; the facts it has no
 * record of (demos, deciding wins, clutch games, comebacks) stay at 0.
 */

import { ageOf, playerViewById, seasonYear } from "@/engine/career/development";
import { awardKey } from "@/engine/career/pro/card";
import { galaForSeason, honorsOf, type GalaAward, type GalaCandidate } from "@/engine/career/pro/gala";
import { activeNickname, type NicknameFacts } from "@/engine/career/pro/nickname";
import { proOverall } from "@/engine/career/pro/attrs";
import type { ProHonor, ProSave } from "@/engine/career/pro/types";
import { PRO_SELF_ID } from "@/engine/career/pro/world";

/** The share of the region's season points his team holds (0-1). */
function teamResultOf(points: Record<string, number> | undefined, ref: string | null): number {
  if (!points || !ref) return 0;
  const max = Math.max(0, ...Object.values(points));
  return max > 0 ? Math.min(1, (points[ref] ?? 0) / max) : 0;
}

/**
 * The season's gala (region and world) with the Pro among the candidates.
 * `teamRef`: the ref his team's points are under ("user" for the host seat
 * and the amateur side, the org's ref for an org off the seat), or null.
 */
export function seasonGalaOf(save: ProSave, teamRef: string | null): { awards: GalaAward[]; honors: ProHonor[] } {
  const seasonIndex = save.clock.seasonIndex;
  const view = { careerSeed: save.careerSeed, seasonIndex, world: save.world };
  const candidates: GalaCandidate[] = [];
  const seen = new Set<string>();
  for (const ref of Object.keys(save.world.orgs).sort()) {
    const org = save.world.orgs[ref];
    const result = teamResultOf(save.competition.seasonPoints[org.region], ref);
    for (const id of org.playerIds) {
      if (id === PRO_SELF_ID || seen.has(id)) continue;
      const v = playerViewById(id, view);
      if (!v) continue;
      seen.add(id);
      candidates.push({ id, name: v.name, region: v.region, age: v.age, overall: v.overall, overallStart: v.overall, seasonsPro: Math.max(1, v.age - 16), teamResult: result });
    }
  }
  const ss = save.seasonSeries;
  const overall = proOverall(save.player.attrs);
  candidates.push({
    id: PRO_SELF_ID,
    name: save.player.name,
    region: save.player.region,
    age: ageOf(save.player.birthYear, seasonIndex),
    overall,
    overallStart: save.seasonStartOverall ?? overall,
    seasonsPro: Math.max(1, save.history.filter((h) => h.role === "starter" || h.role === "rotation").length + (save.stage === "org" ? 1 : 0)),
    teamResult: teamResultOf(save.competition.seasonPoints[save.player.region], teamRef),
    ...(ss && ss.played > 0 ? { line: { games: ss.games ?? 0, avgRating: ss.ratingSum / ss.played, mvps: ss.mvps ?? 0, decidingMoments: 0 } } : {}),
  });
  const awards = galaForSeason(seasonIndex, save.player.region, candidates);
  return { awards, honors: honorsOf(awards, PRO_SELF_ID, seasonIndex) };
}

/** The card's award lines: his wins only, as the card page's language-free keys. */
export function awardLinesOf(honors: readonly ProHonor[]): string[] {
  return honors.map((h) => awardKey(h, seasonYear(h.seasonIndex))).filter((x): x is string => x !== null);
}

/** Career totals the nicknames read, after one series line of his. */
export function factsAfterGames(facts: NicknameFacts | undefined, games: readonly { pro: { goals: number; assists: number; saves: number } | null }[]): NicknameFacts {
  const f = { ...(facts ?? {}) };
  for (const g of games) {
    if (!g.pro) continue;
    f.goals = (f.goals ?? 0) + g.pro.goals;
    f.assists = (f.assists ?? 0) + g.pro.assists;
    f.saves = (f.saves ?? 0) + g.pro.saves;
  }
  return f;
}

/** The nickname he wears after the facts moved (never taken once earned). */
export function nicknameAfter(save: ProSave): string | undefined {
  return activeNickname(save.careerFacts ?? {}, save.player.nickname ?? null) ?? save.player.nickname;
}
