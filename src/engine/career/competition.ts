/**
 * The empty competition state a career starts with (manager and Pro alike).
 * v2.2 (R148): moved here from store/careerFlow so the Pro's engine can create
 * a save; careerFlow re-exports it unchanged.
 */

import type { Region } from "../types";
import type { CompetitionState } from "./types";

const REGIONS: Region[] = ["NA", "EU", "SAM", "MENA", "OCE", "APAC", "SSA"];

export function emptyCompetition(): CompetitionState {
  const empty = () => Object.fromEntries(REGIONS.map((r) => [r, {}])) as Record<Region, Record<string, number>>;
  return {
    splitPoints: empty(),
    seasonPoints: empty(),
    majorFieldRefs: null,
    worldsFieldRefs: null,
    newFacesThisSplit: [],
    squadAtSplitStart: [],
    stabilityTierApplied: 0,
  };
}
