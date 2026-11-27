/**
 * v2.2 rc.6 (ORGMODE UI-B): the board's season brief (`board.season.brief`,
 * engine `SeasonBrief`) as copy. One reading for every screen that shows it:
 * the pick's dossier, the arrival splash, the season plan and the Board page.
 *
 * `reason` is the sentence (C.board.brief[reason]({ org, tier, goal })); last
 * season's region rank and best finish are the facts under it. A brief is
 * written only for an established org; a founded club's owners have none.
 */

import type { CareerCopy } from "@/content/careerCopy";
import { goalTotalOf } from "@/engine/career/board";
import type { SeasonBrief } from "@/engine/career/boardTypes";
import type { SeasonGoalSpec } from "@/engine/career/types";

export interface BriefLines {
  /** Why the board asks what it asks. */
  reason: string;
  /** Last season, as facts ("#3 in the region", "best finish: top 4 at a Major"). */
  facts: string[];
}

/** The board's objective as a sentence, with the season's total where a count needs it ("top 4 in 3 of the 9 regionals"). */
export function objectiveText(C: CareerCopy, spec: Pick<SeasonGoalSpec, "kind" | "count" | "place">): string {
  return C.goals.seasonTotal(spec.kind, spec.count, spec.place ?? 0, goalTotalOf(spec.kind)) || C.goals.season(spec.kind, spec.count, spec.place ?? 0);
}

/** A brief that reads (older saves and UI-A's preview may hand anything): the engine's shape or null. */
export function asBrief(brief: unknown): SeasonBrief | null {
  if (!brief || typeof brief !== "object") return null;
  const b = brief as Partial<SeasonBrief>;
  return typeof b.reason === "string" && typeof b.tier === "string" ? (b as SeasonBrief) : null;
}

export function briefLinesOf(C: CareerCopy, brief: unknown, org: string): BriefLines | null {
  const b = asBrief(brief);
  if (!b) return null;
  const line = C.board.brief[b.reason];
  if (typeof line !== "function") return null;
  const tier = C.board.standing.phrase[b.tier] ?? b.tier;
  const goal = b.lastObjective ? objectiveText(C, b.lastObjective) : undefined;
  const facts: string[] = [];
  if (b.lastRegionalRank) facts.push(C.board.brief.lastRank(b.lastRegionalRank));
  if (b.bestFinish) facts.push(C.board.brief.bestFinish(b.bestFinish.tier, b.bestFinish.place));
  return { reason: line({ org, tier, goal }), facts };
}
