/**
 * v2.2 board front — every org is different (FEATURES.realOrgStart). Pure.
 *
 * An org's STATURE comes from what the data proves: its squad rating rank in
 * its region's AI field (the ratings computeStars stores) and its curated
 * prestige (0-3, the dataset's historical strength). The stature sets the
 * club reputation a takeover starts on, the money (starting cash, the
 * board's seasonal budget, the wage ceiling, all in weeks of the squad's own
 * wage bill so they scale with the squad and the money index), the board's
 * expectation and its patience (CAREER_BOARD.profiles).
 *
 * `takeoverSquadOf` turns an AI org's roster into the user's squad on the
 * market's own asks; `realOrgChoicesFor` is the wizard's pick screen.
 */

import { CAREER_BOARD, CAREER_ECONOMY, CAREER_SEASONS, FEATURES } from "@/config/balance";
import { coachById, lineups } from "@/data";
import type { Region } from "../types";
import { intakeSeasonIdFor } from "./calendar";
import { playerViewById, seasonYear } from "./development";
import { coachWageFor, computeSalaryAsk, gearOwned, moneyIndex, quantize, weeklyWageBill } from "./economy";
import { inheritedGearFor, standingViewFor, structureWeeklyOf, type StandingView } from "./established";
import { sponsorLadderLevelFor } from "./ladder";
import { tierStandardOf } from "./orgCatalogue"; // rc9 org
import { askInputOf } from "./market";
import { coachBonusLevelFor } from "./training";
import type { CareerDifficulty, CoachState, SquadPlayer, WorldOrgState, WorldState } from "./types";
import type { Stature } from "./boardTypes";

export type ProfileKey = Stature | "owners";
export type StatureProfile = (typeof CAREER_BOARD.profiles)[ProfileKey];

const ratingOf = (o: WorldOrgState) => o.rating ?? 70 + o.prestige * 6;

/** The region's AI orgs, strongest first (rating, then ref: deterministic). */
export function regionOrgsByRating(world: WorldState, region: Region): WorldOrgState[] {
  return Object.values(world.orgs)
    .filter((o) => o.region === region)
    .sort((a, b) => ratingOf(b) - ratingOf(a) || a.ref.localeCompare(b.ref));
}

/** The stature a rank (1 = the region's best squad) and a prestige prove; the first rule met wins. */
export function statureFor(rank: number, prestige: number): Stature {
  const S = CAREER_BOARD.stature;
  for (const key of ["elite", "contender", "mid"] as const) {
    const r = S[key];
    if (rank <= r.maxRank || (rank <= r.maxRankWithPrestige && prestige >= r.prestige)) return key;
  }
  return "underdog";
}

export function orgRankOf(world: WorldState, ref: string): { rank: number; teams: number } | null {
  const org = world.orgs[ref];
  if (!org) return null;
  const list = regionOrgsByRating(world, org.region);
  return { rank: list.findIndex((o) => o.ref === ref) + 1, teams: list.length };
}

export function statureOfOrg(world: WorldState, ref: string): Stature | null {
  const org = world.orgs[ref];
  const r = orgRankOf(world, ref);
  return org && r ? statureFor(r.rank, org.prestige) : null;
}

export function profileOf(key: ProfileKey): StatureProfile {
  return CAREER_BOARD.profiles[key];
}

/** Patience as one multiplier on confidence losses: the stature's × the difficulty's. */
export function patienceOf(key: ProfileKey, difficulty: CareerDifficulty): number {
  return profileOf(key).patience * (CAREER_BOARD.difficulty[difficulty]?.patience ?? 1);
}

/** A two-to-four letter tag from an org name ("Gentle Mates" → GM, "Vitality" → VIT). */
export function abbrevFor(name: string): string {
  const words = name.toUpperCase().replace(/[^A-Z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
  if (words.length === 0) return "ORG";
  const tag = words.length >= 2 ? words.map((w) => w[0]).join("").slice(0, 4) : words[0].slice(0, 3);
  return tag.length >= 2 ? tag : (words[0] + "XX").slice(0, 3);
}

interface SquadCtx {
  careerSeed: number;
  seasonIndex: number;
  difficulty: CareerDifficulty;
  world: WorldState;
}

/**
 * The dataset coach of an org's lineup this season (a real coach, when the data has one).
 * v2.2 ORGMODE-2027: a world built at the late wave's season (`eraStart`) reads that wave's coaches.
 */
export function datasetCoachOf(ref: string, seasonIndex: number, difficulty: CareerDifficulty, eraStart?: number): CoachState | null {
  const lateWave = seasonIndex >= CAREER_SEASONS.length && eraStart === seasonIndex;
  const seasonId = lateWave ? intakeSeasonIdFor(seasonIndex) : CAREER_SEASONS[Math.min(seasonIndex, CAREER_SEASONS.length - 1)]?.seasonId;
  if (!seasonId || (seasonIndex >= CAREER_SEASONS.length && !lateWave)) return null;
  const lineup = lineups.find((l) => l.seasonId === seasonId && l.orgId === ref && !l.rareSpawn && !l.national);
  const coach = lineup?.coachId ? coachById.get(lineup.coachId) : undefined;
  if (!coach) return null;
  const experience = 3;
  return {
    id: `coach:staff:${coach.personId}`,
    name: coach.name,
    overall: coach.overall,
    bonusType: coach.bonusType,
    bonusLevel: coachBonusLevelFor(coach.overall),
    salaryPerSplit: coachWageFor({ quality: coach.overall, experience, exPro: false }, seasonIndex, difficulty),
    source: "dataset",
    experience,
    contractEndSeason: seasonIndex + 1,
  };
}

/**
 * The org's three players as the user's squad: their views today, on the
 * market's two-season ask at the stature's reputation; deals run one or two
 * more seasons (seeded per player). Null when a seat does not resolve.
 */
export function takeoverSquadOf(ref: string, stature: ProfileKey, ctx: SquadCtx): SquadPlayer[] | null {
  const org = ctx.world.orgs[ref];
  if (!org) return null;
  const rep = profileOf(stature).rep;
  const out: SquadPlayer[] = [];
  for (const [i, id] of org.playerIds.entries()) {
    const view = playerViewById(id, ctx);
    if (!view) return null;
    const ask = computeSalaryAsk(askInputOf(view, { careerSeed: ctx.careerSeed, seasonIndex: ctx.seasonIndex, rep, lengthSeasons: 2, difficulty: ctx.difficulty }));
    out.push({
      id: view.id,
      kind: view.kind,
      name: view.name,
      ...(view.country !== undefined ? { country: view.country } : {}),
      region: view.region,
      birthYear: seasonYear(ctx.seasonIndex) - view.age,
      archetype: view.archetype,
      overall: view.overall,
      attrOffsets: { ...view.attrOffsets },
      potential: view.potential,
      peakAge: view.peakAge,
      declineRate: view.declineRate,
      role: "starter",
      salaryPerSplit: ask,
      prizeSharePct: 0,
      contractEndSeason: ctx.seasonIndex + 2 + (i % 2),
      trainingFocus: "auto",
      trainingIntensity: "normal",
      scoutLevel: 2,
      splitsTogether: 2,
      joinedSeason: ctx.seasonIndex,
      gainedThisSplit: 0,
      gainedThisSeason: 0,
    });
  }
  return out;
}

export interface OrgMoney {
  weekWages: number;
  startCash: number;
  grant: number;
  wageRoom: number;
}

/**
 * The money a stature means for a squad's weekly wage bill (in the season's money).
 * rc.6 (R169): `weekRunning` is the org's whole weekly running bill (wages + the
 * structure it arrives with: staff, psychologist, upkeep); the cash and the
 * budget are weeks of it. The wage ceiling stays weeks of the wage bill.
 * Omitted = the wage bill (a founded club, the flag off).
 */
export function orgMoneyFor(stature: ProfileKey, weekWages: number, difficulty: CareerDifficulty, seasonIndex: number, weekRunning = weekWages): OrgMoney {
  const p = profileOf(stature);
  const floor = CAREER_ECONOMY.startingBudget[difficulty] * moneyIndex(seasonIndex);
  return {
    weekWages,
    startCash: quantize(Math.max(floor, weekRunning * p.runwayWeeks)),
    grant: quantize(weekRunning * p.grantWeeks),
    wageRoom: quantize(weekWages * p.wageRoom),
  };
}

/** The region's usual nationality when the roster has none on record. */
const REGION_COUNTRY: Record<Region, string> = { NA: "US", EU: "FR", SAM: "BR", MENA: "SA", OCE: "AU", APAC: "JP", SSA: "ZA" };

/** The most common country among a roster (ties: the first seen), else the region's. */
export function rosterCountryOf(countries: readonly (string | undefined)[], region: Region): string {
  const n = new Map<string, number>();
  for (const c of countries) if (c) n.set(c.toUpperCase(), (n.get(c.toUpperCase()) ?? 0) + 1);
  let best: string | null = null;
  for (const [c, k] of n) if (best === null || k > n.get(best)!) best = c;
  return best ?? REGION_COUNTRY[region];
}

export interface RealOrgChoice {
  ref: string;
  name: string;
  region: Region;
  stature: Stature;
  rank: number;
  teams: number;
  rating: number;
  prestige: number;
  players: { id: string; name: string; overall: number; age: number }[];
  /** The roster's most common nationality (ISO alpha-2), else the region's usual one: the manager's flag. */
  country: string;
  coach: { name: string; overall: number } | null;
  money: OrgMoney;
  /** The finish the board expects (its region rank). */
  expectedRank: number;
  /** Confidence a missed objective costs on the expected package (patience, in points). */
  missCost: number;
  /** Seasons before the board can issue an ultimatum. */
  graceSeasons: number;
  rep: number;
  /** rc.6 (ORGMODE E5): the installations the org owns at the takeover (CAREER_GEAR item ids). */
  gear: string[];
  /** rc.6: the staff it retains ("psychologist" or a CAREER_STAFF role). */
  staff: string[];
  /** rc.6: the best signing level a new signing accepts at this tier. */
  signCap: number;
  /** rc.6: the sponsor ladder level its Standing opens (0-4). */
  sponsorLevel: number;
  /** rc.6: the Standing track at the takeover. */
  standing: StandingView;
  /** rc.6: the board's confidence on day one. */
  confidenceStart: number;
  /** v2.2 ORGMODE-2027: a returning org (no lineup in the start era), from its last lineup's era index. */
  returningFrom?: number;
  /**
   * rc9 org (R220): the structure in the org catalogue's terms (facility levels, departments staffed).
   * The pick screen reads this, not `gear` / `staff` (founded ids), nor `standing.value` / `rep` /
   * `sponsorLevel` (figures an established org does not show).
   */
  structure: { facilities: Record<"trainingCentre" | "performanceCentre", number>; departments: string[] };
}

/** The region's real orgs a manager can take over this season, strongest first (fillers excluded). */
export function realOrgChoicesFor(region: Region, ctx: SquadCtx): RealOrgChoice[] {
  const list = regionOrgsByRating(ctx.world, region);
  const out: RealOrgChoice[] = [];
  list.forEach((org, i) => {
    if (org.ref.startsWith("fill:") || org.ref.includes(":")) return;
    const stature = statureFor(i + 1, org.prestige);
    const squad = takeoverSquadOf(org.ref, stature, ctx);
    if (!squad) return;
    const coach = datasetCoachOf(org.ref, ctx.seasonIndex, ctx.difficulty, ctx.world.eraStart);
    const week = weeklyWageBill(squad.map((p) => p.salaryPerSplit), coach?.salaryPerSplit ?? null);
    const p = profileOf(stature);
    out.push({
      ref: org.ref,
      name: org.name,
      region,
      stature,
      rank: i + 1,
      teams: list.length,
      rating: Math.round(ratingOf(org) * 10) / 10,
      prestige: org.prestige,
      players: squad.map((s) => ({ id: s.id, name: s.name, overall: Math.round(s.overall), age: seasonYear(ctx.seasonIndex) - s.birthYear })),
      country: rosterCountryOf(squad.map((s) => s.country), region),
      coach: coach ? { name: coach.name, overall: coach.overall } : null,
      money: orgMoneyFor(
        stature,
        week,
        ctx.difficulty,
        ctx.seasonIndex,
        FEATURES.realOrgStart ? week + structureWeeklyOf(inheritedGearFor(stature), ctx.seasonIndex) : week,
      ),
      expectedRank: p.expectedRank,
      missCost: Math.round(Math.abs(CAREER_BOARD.packages.expected.miss) * patienceOf(stature, ctx.difficulty)),
      graceSeasons: CAREER_BOARD.graceSeasons.board,
      rep: p.rep,
      gear: gearOwned(inheritedGearFor(stature)),
      staff: [...p.staff],
      signCap: p.signCap,
      sponsorLevel: sponsorLadderLevelFor(p.rep),
      standing: standingViewFor(stature, p.rep),
      confidenceStart: CAREER_BOARD.confidence.start,
      structure: tierStandardOf(stature),
      ...(org.returningFrom !== undefined ? { returningFrom: org.returningFrom } : {}),
    });
  });
  return out;
}
