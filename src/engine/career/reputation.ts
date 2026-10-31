/**
 * Road to Worlds — the newcomer's path to reputation (rc.33, RTW-02).
 *
 * Miguel (30/10): "playing EU, the reputation did not rise". Reputation is
 * paid by placements (`economy.eventRepKindFor`), and in the deep pools an
 * org built from three starters never reaches one that pays:
 *  - its Community Cup seats the two orgs rated closest above it (R23's
 *    t3MaxStrongerTeams) — in EU and NA 10+ points up — so the bracket,
 *    seeded by rating, sends the user (seed 3) into seed 2 in the
 *    semi-final, every cup; a cup pays only for a final;
 *  - its Saturday qualifier holds the eight orgs outside the direct 8, all
 *    stronger, so it goes out in the Swiss; only qualifying pays;
 *  - Sunday's regional (whose Swiss exit pays the floor) is never reached.
 * EU sat at reputation 5 for two seasons (no sponsor before S4).
 *
 * The path pays what an underdog can reach — a result measured against the
 * user's SEED in that event (its rank by team rating), not only the
 * placement: a cup semi-final as the third seed or lower, a qualifier run
 * (rc.36.3: one Swiss win) when seeded outside the qualifying eight. It pays only
 * while the org is still making its name (`CAREER_REP.newcomer.repCeiling`):
 * APAC and SSA pass the ceiling in their first season, so the easy regions
 * gain at most a couple of points. Pure; no React.
 */

import { CAREER_QUALIFIER, CAREER_REP } from "@/config/balance";
import type { Placement, TournamentState } from "@/engine/types";
import type { EventTier } from "./types";

export type NewcomerRepKind = "t3Semi" | "qualifierDeepRun";

/** The user's seed in an event: 1 + the teams rated above it (the bracket's own order; a tie seeds the user higher). */
export function userSeedIn(t: TournamentState): number {
  const user = t.teams.user;
  if (!user) return 1;
  return 1 + Object.values(t.teams).filter((team) => !team.isUser && team.rating.total > user.rating.total).length;
}

/** The user's Swiss wins in an event (0 for a bracket-only cup). */
export function userSwissWinsIn(t: TournamentState): number {
  return t.swiss.records.find((r) => r.teamId === "user")?.wins ?? 0;
}

/** The save flag counting a split's paid qualifier deciders (`CAREER_REP.newcomer.deepRunsPerSplit`). */
export function deepRunKeyFor(seasonIndex: number, split: number | null): string {
  return `deeprun:${seasonIndex}:${split ?? 0}`;
}

/** Context of a newcomer award: the reputation now and the two per-split caps already used. */
export interface NewcomerRepCtx {
  rep: number;
  /** The cup's shared per-split cap (CAREER_UNOFFICIAL.t3RepCapPerSplit) is spent. */
  t3CapReached: boolean;
  /** Paid qualifier deciders this split (the `deepRunKeyFor` flag). */
  deepRunsThisSplit: number;
}

/**
 * The newcomer's reputation for a result no placement pays, or null: a cup
 * semi-final as seed `t3SemiMinSeed` or lower (it shares the cup's per-split
 * cap with the win and the final); a qualifier run — `deepRunWins` Swiss
 * wins, out — seeded outside the advancing slots, `deepRunsPerSplit` a split.
 * Only below the ceiling.
 */
export function newcomerRepKindFor(
  tier: EventTier,
  placement: Placement,
  ctx: NewcomerRepCtx & { seed: number; swissWins: number },
): NewcomerRepKind | null {
  const N = CAREER_REP.newcomer;
  if (ctx.rep >= N.repCeiling) return null;
  if (tier === "t3") {
    if (ctx.t3CapReached) return null;
    const semi = placement === "top4" || placement === "third" || placement === "fourth";
    return semi && ctx.seed >= N.t3SemiMinSeed ? "t3Semi" : null;
  }
  if (tier === "qualifier") {
    if (ctx.deepRunsThisSplit >= N.deepRunsPerSplit) return null;
    const out = placement === "swiss_exit";
    return out && ctx.swissWins >= N.deepRunWins && ctx.seed > CAREER_QUALIFIER.advanceSlots ? "qualifierDeepRun" : null;
  }
  return null;
}

/** The newcomer kind for a finished tournament (finishEvent and the digest preview read the same one). */
export function newcomerRepKindOf(
  tier: EventTier,
  placement: Placement,
  t: TournamentState,
  ctx: NewcomerRepCtx,
): NewcomerRepKind | null {
  return newcomerRepKindFor(tier, placement, { ...ctx, seed: userSeedIn(t), swissWins: userSwissWinsIn(t) });
}
