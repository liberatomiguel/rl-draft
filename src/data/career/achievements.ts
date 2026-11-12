/**
 * Road to Worlds — permanent career achievements (v2.0, R32). Hand-maintained
 * catalog: ids are forever (the career store keys unlock dates by them), XP is
 * the LIMITED Season XP the mode may grant (design: career never gates on the
 * season calendar, but milestones can feed it). Conditions are evaluated in
 * `src/engine/career/achievements.ts`; names/descriptions live in the career
 * copy (`achievements.items`).
 */

export type CareerAchievementTier = "common" | "rare" | "epic" | "legend";

export type CareerAchievementCondition =
  | { kind: "flag"; flag: string }
  | { kind: "stat"; stat: "titlesRegional" | "titlesMajor" | "titlesWorlds" | "majorsQualified" | "worldsQualified"; min: number }
  | { kind: "reputation"; min: number }
  | { kind: "seasonIndex"; min: number }
  /** rc.4: won a regional, Major or Worlds with a team overall at least `margin`
   *  below the average of the rest of that event's field. */
  | { kind: "titleUnderdog"; margin: number }
  | { kind: "worldsHomegrown" }
  | { kind: "allDifficulties" };

export interface CareerAchievementDef {
  id: string;
  tier: CareerAchievementTier;
  /** Season XP granted once, on unlock. */
  xp: number;
  condition: CareerAchievementCondition;
}

export const CAREER_ACHIEVEMENTS: readonly CareerAchievementDef[] = [
  { id: "car-first-sponsor", tier: "common", xp: 40, condition: { kind: "flag", flag: "achSponsorSigned" } },
  { id: "car-bank-cleared", tier: "common", xp: 40, condition: { kind: "flag", flag: "achBankCleared" } },
  { id: "car-first-qualifier", tier: "common", xp: 60, condition: { kind: "flag", flag: "achQualifierAdvanced" } },
  { id: "car-rep-50", tier: "rare", xp: 100, condition: { kind: "reputation", min: 50 } },
  // Persisted id stays stable; the corrected milestone is the fourth season.
  { id: "car-three-seasons", tier: "rare", xp: 120, condition: { kind: "seasonIndex", min: 3 } },
  { id: "car-major-qualified", tier: "rare", xp: 120, condition: { kind: "stat", stat: "majorsQualified", min: 1 } },
  { id: "car-first-regional", tier: "rare", xp: 150, condition: { kind: "stat", stat: "titlesRegional", min: 1 } },
  { id: "car-worlds-qualified", tier: "epic", xp: 200, condition: { kind: "stat", stat: "worldsQualified", min: 1 } },
  { id: "car-rep-100", tier: "epic", xp: 250, condition: { kind: "reputation", min: 100 } },
  { id: "car-first-major", tier: "epic", xp: 300, condition: { kind: "stat", stat: "titlesMajor", min: 1 } },
  { id: "car-first-worlds", tier: "legend", xp: 600, condition: { kind: "stat", stat: "titlesWorlds", min: 1 } },
  { id: "car-worlds-underdog", tier: "legend", xp: 500, condition: { kind: "titleUnderdog", margin: 3 } },
  { id: "car-worlds-homegrown", tier: "legend", xp: 500, condition: { kind: "worldsHomegrown" } },
  { id: "car-three-worlds", tier: "legend", xp: 800, condition: { kind: "stat", stat: "titlesWorlds", min: 3 } },
  { id: "car-all-difficulties", tier: "legend", xp: 400, condition: { kind: "allDifficulties" } },
  // E1 (Season 1 achievements review): depth past the first titles. Every
  // condition reuses a stat or a flag the flows ALREADY record (the two flags
  // are the rc.51 cosmetic facts, set at the Worlds win in careerFlow), so the
  // career engine and its flows are untouched. Appended: catalog order is the
  // list's order, and the ids above keep their place.
  { id: "car-seven-seasons", tier: "rare", xp: 150, condition: { kind: "seasonIndex", min: 6 } },
  { id: "car-worlds-regular", tier: "epic", xp: 200, condition: { kind: "stat", stat: "worldsQualified", min: 3 } },
  { id: "car-five-regionals", tier: "epic", xp: 250, condition: { kind: "stat", stat: "titlesRegional", min: 5 } },
  { id: "car-three-majors", tier: "epic", xp: 300, condition: { kind: "stat", stat: "titlesMajor", min: 3 } },
  { id: "car-two-worlds", tier: "legend", xp: 500, condition: { kind: "stat", stat: "titlesWorlds", min: 2 } },
  { id: "car-worlds-unchanged", tier: "legend", xp: 400, condition: { kind: "flag", flag: "cosDayOne" } },
  { id: "car-perfect-season", tier: "legend", xp: 600, condition: { kind: "flag", flag: "cosRegionalDynasty" } },
];

export const careerAchievementById = new Map(CAREER_ACHIEVEMENTS.map((a) => [a.id, a]));
