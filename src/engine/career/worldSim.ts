/**
 * Road to Worlds — world simulation (design doc §7 calendar sims, §10 living
 * world, §12 filler world). Owns:
 *
 *  - world creation (`buildWorldAtCreation`): every real RLCS Season X lineup
 *    becomes an AI org; thin regions are padded with fictional filler orgs to
 *    exactly CAREER_WORLD.minOrgsPerRegion; the free-agent pool is derived
 *    from real players active before Season X but on no Season X roster.
 *  - team assembly for career entities (`userTeamFor`, `orgTeamFor`) on top of
 *    `assembleTournamentTeam` — the user org rides `orgOverride`, AI orgs ride
 *    the dataset org (real) or a derived override (fillers).
 *  - event fields + headless AI events (`fieldForEvent`, `simulateAiEvent`).
 *  - the season-boundary world pass (`agePassAndIntake`): retirement rolls
 *    (anchor-protected), FA backfill, off-anchor development, rookie intake.
 *  - cosmetic org stars (`computeStars`).
 *
 * Engine rules: pure TS, deterministic — all randomness from `createRng` over
 * derived stream seeds or cursor-free `derivedFloat` (see ./seeds.ts).
 *
 * CHEMISTRY ID CONVENTION (user squad — consumed by computeChemistry):
 *  - lineupId: "career:core" once a player has ≥1 full split together,
 *    else "solo:{playerId}" (fresh signings share no lineup yet).
 *  - orgId: always "career:org" (they play for YOUR org now), and
 *    careerOrgIds always include "career:org".
 *  - careerLineupIds: derived shared-history tags — a player with
 *    `splitsTogether = s` carries ["career:t0" … "career:t{floor(s)-1}"], so
 *    two squad players share exactly min(floor(sA), floor(sB)) tags. This is a
 *    pure DERIVATION of SquadPlayer.splitsTogether (the store does not persist
 *    tag lists); subs accrue 0.5 credit per split (CAREER_SUB), so a sub
 *    reaches its first shared tag after two splits.
 */

import {
  CAREER_AGE,
  CAREER_CALENDAR,
  CAREER_CHEMISTRY,
  CAREER_GEAR,
  CAREER_SEASONS,
  CAREER_SUB,
  CAREER_TRAINING,
  CAREER_WORLD,
  CHEMISTRY,
  DIFFICULTY,
  RARITY,
  TOURNAMENT,
} from "@/config/balance";
import {
  coachById,
  lineups,
  orgById,
  playerCardById,
  playerCards,
  players,
  seasonById,
} from "@/data";
import { FILLER_ORG_NAME_BANK, PLAYER_NAME_BANK, STAND_IN_NAMES } from "@/data/career/names";
import { createRng, type Rng } from "@/lib/rng";
import { clamp } from "@/lib/util";
import { effectiveStats } from "../cards";
import { assembleTournamentTeam, type AssembleInput, type MemberView } from "../teams";
import { fastForward, initFieldTournament } from "../tournament";
import type {
  HistoricalStrength,
  Region,
  StatKey,
  TournamentState,
  TournamentTeam,
} from "../types";
import {
  anchorOverall,
  deriveArchetype,
  deriveAttrOffsets,
  deriveDeclineRate,
  derivePeakAge,
  fieldQualityFor,
  fillerPlayerView,
  playerViewById,
  rookieView,
  statsFromView,
} from "./development";
import { gearBuffLevels, starsFor } from "./economy";
import { deriveSeed, derivedFloat, streams } from "./seeds";
import type {
  CareerDifficulty,
  CareerEventDef,
  CareerIdentity,
  CareerPlayerView,
  CoachState,
  CompetitionState,
  DeclineRate,
  GearState,
  SquadPlayer,
  WorldOrgState,
  WorldState,
} from "./types";

// ---------------------------------------------------------------------------
// Shared derivation tables (structural constants, not balance tunables; the
// gameplay numbers all live in balance.ts CAREER_* groups)
// ---------------------------------------------------------------------------

/** Canonical region order — keeps every world iteration deterministic. */
const REGIONS: Region[] = ["NA", "EU", "SAM", "MENA", "OCE", "APAC", "SSA"];

const STAT_KEYS: StatKey[] = [
  "offense",
  "defense",
  "mechanics",
  "consistency",
  "experience",
  "clutch",
];

const PRESTIGE_BY_STRENGTH: Record<HistoricalStrength, WorldOrgState["prestige"]> = {
  elite: 3,
  strong: 2,
  solid: 1,
  underdog: 0,
};

/** Facilities level 0-3 → the user org's buff level fed to the assembler. */
const FACILITY_BUFF_LEVEL = ["~", "+", "++", "+++"] as const;

/** initFieldTournament's single-elim contract (unofficial cups are 8 teams). */
const SINGLE_ELIM_TEAMS = 8;

// Derivation shapes below are structural (documented in the design doc §6/§10
// prose rather than a CAREER_* group — candidates to hoist into balance.ts):
/** Chance a filler org rolls prestige 1 instead of 0 ("a few 1"). */
const FILLER_PRESTIGE_ONE_CHANCE = 0.15;
/** Hard cap on the creation FA pool (save size / market scan cost). */
const FA_POOL_CAP = 300;
/** "Stars linger" retirement dampening applies at/above the blue-card bar. */
const STAR_RETIREMENT_OVERALL = RARITY.blueMin;
/** AI coach bonus level thresholds (orgTeamFor contract). */
const COACH_BONUS_STRONG = 85;
const COACH_BONUS_MID = 75;
/** Starter-offer generation shapes (design §6: prospects/journeymen/balanced). */
const STARTER_OFFERS = [
  { key: "prospects", ageMin: 14, ageSpan: 3, ovrMin: 64, ovrSpan: 4, potMin: 78, potSpan: 10 },
  { key: "journeymen", ageMin: 21, ageSpan: 3, ovrMin: 70, ovrSpan: 4, potMin: 0, potSpan: 0 },
  { key: "balanced", ageMin: 16, ageSpan: 5, ovrMin: 67, ovrSpan: 4, potMin: 74, potSpan: 8 },
] as const;
/** Journeymen potential ceiling ("the scene's veterans, low POT"). */
const JOURNEYMAN_POTENTIAL_CAP = 76;

/** Dataset season order for a career seasonIndex (infinite era keeps counting). */
function orderFor(seasonIndex: number): number {
  const last = CAREER_SEASONS.length - 1;
  return seasonIndex <= last
    ? CAREER_SEASONS[seasonIndex].order
    : CAREER_SEASONS[last].order + (seasonIndex - last);
}

/** Latest dataset-card season order per player (anchor-protection lookup). */
let lastOrderByPlayer: Map<string, number> | null = null;
function lastDatasetCardOrder(playerId: string): number | undefined {
  if (!lastOrderByPlayer) {
    lastOrderByPlayer = new Map();
    for (const card of playerCards) {
      const order = seasonById.get(card.seasonId)?.order ?? 0;
      const cur = lastOrderByPlayer.get(card.playerId);
      if (cur === undefined || order > cur) lastOrderByPlayer.set(card.playerId, order);
    }
  }
  return lastOrderByPlayer.get(playerId);
}

function pickStat(f: number): StatKey {
  return STAT_KEYS[Math.min(STAT_KEYS.length - 1, Math.floor(f * STAT_KEYS.length))];
}

const ROMAN = ["", "II", "III", "IV", "V", "VI"];
function fillerOrgName(region: Region, i: number): string {
  const bank = FILLER_ORG_NAME_BANK[region];
  const wrap = Math.floor(i / bank.length);
  const base = bank[i % bank.length];
  return wrap === 0 ? base : `${base} ${ROMAN[wrap] ?? String(wrap + 1)}`;
}

// ---------------------------------------------------------------------------
// World creation
// ---------------------------------------------------------------------------

/**
 * Build the season-0 world (RLCS Season X): one AI org per real Season X
 * lineup orgId (rareSpawn easter-egg lineups excluded), every region padded
 * with filler orgs to exactly CAREER_WORLD.minOrgsPerRegion (the user's home
 * regional later fields the top 15 + the user team), plus the derived
 * free-agent pool (real pre-Season-X players not on any Season X roster,
 * padded with fillers to faPoolFloorPerRegion, capped at FA_POOL_CAP with
 * best-overall priority).
 */
export function buildWorldAtCreation(careerSeed: number): WorldState {
  const season0 = CAREER_SEASONS[0];
  const orgs: Record<string, WorldOrgState> = {};
  const rosteredPlayerIds = new Set<string>();

  // 1. Real Season X lineups → AI orgs (one per orgId, dataset order).
  for (const lineup of lineups) {
    if (lineup.seasonId !== season0.seasonId || lineup.rareSpawn) continue;
    if (orgs[lineup.orgId]) continue; // one org per orgId
    const playerIds = lineup.playerCardIds.map(
      (cardId) => playerCardById.get(cardId)!.playerId,
    ) as [string, string, string];
    const coach = lineup.coachId ? coachById.get(lineup.coachId) : undefined;
    const prestige = PRESTIGE_BY_STRENGTH[lineup.historicalStrength];
    orgs[lineup.orgId] = {
      ref: lineup.orgId,
      name: orgById.get(lineup.orgId)?.name ?? lineup.name,
      region: lineup.region,
      prestige,
      playerIds,
      coachOverall: coach?.overall,
      // Provisional cosmetic value — the store recomputes via computeStars.
      stars: prestige,
    };
    for (const id of playerIds) rosteredPlayerIds.add(id);
  }

  // 2. Pad every region to exactly minOrgsPerRegion with filler orgs.
  //    fic:{region}:{n} player ids are unique across the region: each filler
  //    org consumes 3 consecutive n, FA-floor fillers continue the counter.
  const ficNext: Record<Region, number> = {
    NA: 0, EU: 0, SAM: 0, MENA: 0, OCE: 0, APAC: 0, SSA: 0,
  };
  for (const region of REGIONS) {
    const realCount = Object.values(orgs).filter((o) => o.region === region).length;
    for (let i = 0; realCount + i < CAREER_WORLD.minOrgsPerRegion; i++) {
      const ref = `fill:${region}:${i}`;
      const prestige: WorldOrgState["prestige"] =
        derivedFloat(careerSeed, streams.gen("fillerOrgPrestige", `${region}:${i}`)) <
        FILLER_PRESTIGE_ONE_CHANCE
          ? 1
          : 0;
      const base = ficNext[region];
      ficNext[region] += 3;
      orgs[ref] = {
        ref,
        name: fillerOrgName(region, i),
        region,
        prestige,
        playerIds: [
          `fic:${region}:${base}`,
          `fic:${region}:${base + 1}`,
          `fic:${region}:${base + 2}`,
        ],
        stars: prestige,
      };
    }
  }

  // 3. Free agents: real players who debuted by Season X's order but have no
  //    Season X card and sit on no built org (best overall first).
  const hasSeason0Card = new Set(
    playerCards.filter((c) => c.seasonId === season0.seasonId).map((c) => c.playerId),
  );
  const candidates = players
    .filter((p) => !rosteredPlayerIds.has(p.id) && !hasSeason0Card.has(p.id))
    .map((p) => ({ id: p.id, region: p.region, overall: anchorOverall(p.id, season0.order) }))
    .filter((p): p is { id: string; region: Region; overall: number } => p.overall !== null)
    .sort((a, b) => b.overall - a.overall || a.id.localeCompare(b.id));

  const fillersNeededFor = (real: { region: Region }[]): number => {
    let need = 0;
    for (const region of REGIONS) {
      const have = real.filter((r) => r.region === region).length;
      need += Math.max(0, CAREER_WORLD.faPoolFloorPerRegion - have);
    }
    return need;
  };
  let realFAs = candidates;
  let fillerCount = fillersNeededFor(realFAs);
  for (let guard = 0; guard < 8 && realFAs.length + fillerCount > FA_POOL_CAP; guard++) {
    realFAs = realFAs.slice(0, Math.max(0, FA_POOL_CAP - fillerCount));
    fillerCount = fillersNeededFor(realFAs);
  }
  const fillerFAIds: string[] = [];
  for (const region of REGIONS) {
    const have = realFAs.filter((r) => r.region === region).length;
    for (let j = have; j < CAREER_WORLD.faPoolFloorPerRegion; j++) {
      fillerFAIds.push(`fic:${region}:${ficNext[region]++}`);
    }
  }

  return {
    orgs,
    overallDelta: {},
    freeAgentIds: [...realFAs.map((r) => r.id), ...fillerFAIds],
    retiredIds: [],
    version: 0,
  };
}

// ---------------------------------------------------------------------------
// Starter roster offers (career creation, step 4)
// ---------------------------------------------------------------------------

export interface StarterOffer {
  key: "prospects" | "journeymen" | "balanced";
  players: CareerPlayerView[];
}

/**
 * The three creation-wizard roster offers (3 players each), generated as
 * DEDICATED fictional players (ids "fic:{region}:starter{0..8}") so they can
 * never collide with the world's numeric filler ids. Fully deterministic per
 * (careerSeed, region) via derivedFloat — no RNG cursor consumed. Once signed
 * they live as full SquadPlayer records; nothing resolves these ids later.
 */
export function starterRosterOffers(region: Region, careerSeed: number): StarterOffer[] {
  // Nine distinct names: rank the bank deterministically, take the first nine.
  const bank = PLAYER_NAME_BANK[region];
  const names = bank
    .map((name, i) => ({
      name,
      f: derivedFloat(careerSeed, streams.gen("starterName", `${region}:${i}`)),
    }))
    .sort((a, b) => a.f - b.f || a.name.localeCompare(b.name))
    .slice(0, 9)
    .map((x) => x.name);

  const offers: StarterOffer[] = [];
  for (let o = 0; o < STARTER_OFFERS.length; o++) {
    const shape = STARTER_OFFERS[o];
    const group: CareerPlayerView[] = [];
    for (let j = 0; j < 3; j++) {
      const k = o * 3 + j;
      const id = `fic:${region}:starter${k}`;
      const f = (what: string) =>
        derivedFloat(careerSeed, streams.gen("starter", `${region}:${k}:${what}`));
      const age = shape.ageMin + Math.floor(f("age") * shape.ageSpan);
      const overall = Math.round(shape.ovrMin + f("ovr") * shape.ovrSpan);
      const potential =
        shape.key === "journeymen"
          ? clamp(
              overall + 1 + Math.round(f("pot") * 3),
              overall,
              JOURNEYMAN_POTENTIAL_CAP,
            )
          : clamp(Math.round(shape.potMin + f("pot") * shape.potSpan), overall, 99);
      const archetype = deriveArchetype(id, careerSeed);
      group.push({
        id,
        kind: "fictional",
        name: names[k] ?? `${bank[k % bank.length]} ${ROMAN[2]}`,
        region,
        age,
        archetype,
        overall,
        attrOffsets: deriveAttrOffsets(id, careerSeed, archetype),
        potential,
        peakAge: derivePeakAge(id, careerSeed),
        declineRate: deriveDeclineRate(id, careerSeed),
        anchored: false,
      });
    }
    offers.push({ key: shape.key, players: group });
  }
  return offers;
}

// ---------------------------------------------------------------------------
// User team assembly
// ---------------------------------------------------------------------------

export interface UserTeamInput {
  identity: CareerIdentity;
  squad: SquadPlayer[];
  starterIds: [string, string, string];
  coach: CoachState | null;
  /** v0.2 gear ladder — buff levels, psychologist and training live here. */
  gear: GearState;
  /** Armed bootcamp "Sharp" rating (0 = none). */
  bootcampSharp: number;
  seasonIndex: number;
  careerSeed: number;
  difficulty: CareerDifficulty;
  /** A starter (or the sub) ruled out for this event by a random event. */
  unavailablePlayerId?: string | null;
}

function squadMemberView(p: SquadPlayer, psychologist: boolean): MemberView {
  return {
    name: p.name,
    overall: p.overall,
    stats: statsFromView(
      p,
      psychologist
        ? (CAREER_GEAR.psychologistStatBonus as Partial<Record<StatKey, number>>)
        : undefined,
    ),
    // Chemistry is injected via chemistryOverride (earned over time), so these
    // ids are cosmetic only — they must NOT grant id-based chemistry.
    lineupId: `solo:${p.id}`,
    orgId: `solo-org:${p.id}`,
    country: p.country,
    region: p.region,
  };
}

/**
 * Career chemistry (v0.1 adjustment) — EARNED over time, not granted. Per
 * fielded pair: connection = min(cap, splitsTogether × perSplit) using the
 * pair's SHARED tenure (the newer member's), plus heritage (country/region).
 * A brand-new squad sits near the floor; a core kept 2+ splits together
 * climbs to High. Swapping a starter drops it (the new pair has 0 tenure).
 */
function careerChemistry(fielded: SquadPlayer[]): {
  raw: number;
  max: number;
  percent: number;
  tier: string;
  items: { label: string; points: number }[];
} {
  const C = CAREER_CHEMISTRY;
  const items: { label: string; points: number }[] = [];

  // Pairwise shared tenure, then the v0.2 newcomer grace: an established core
  // absorbs a new face — a newcomer's pairs inherit a slice of the strongest
  // incumbent pair's tenure instead of restarting from zero. A fully fresh
  // squad (max tenure 0) is unaffected.
  const pairsIdx: [number, number, number][] = [];
  let maxTenure = 0;
  for (let i = 0; i < fielded.length; i++) {
    for (let j = i + 1; j < fielded.length; j++) {
      const tenure = Math.min(fielded[i].splitsTogether, fielded[j].splitsTogether);
      pairsIdx.push([i, j, tenure]);
      if (tenure > maxTenure) maxTenure = tenure;
    }
  }
  const graceTenure = maxTenure * C.newcomerGraceFactor;

  let raw = 0;
  for (const [i, j, tenure] of pairsIdx) {
    const a = fielded[i];
    const b = fielded[j];
    const effTenure = Math.max(tenure, graceTenure);
    const conn = Math.min(C.connMaxPerPair, effTenure * C.connPerSplitTogether);
    let her = 0;
    let herLabel = "";
    if (a.country && b.country && a.country === b.country) {
      her = C.herCountry;
      herLabel = `Same country (${a.country})`;
    } else if (a.region === b.region) {
      her = C.herRegion;
      herLabel = `Same region (${a.region})`;
    }
    raw += conn + her;
    if (conn > 0) items.push({ label: `${a.name} · ${b.name} — time together`, points: conn });
    if (her > 0) items.push({ label: `${a.name} · ${b.name} — ${herLabel}`, points: her });
  }
  const max = Math.max(1, C.maxRawPerPair * pairsIdx.length);
  const percent = Math.min(100, Math.round((raw / max) * 100));
  const tier = CHEMISTRY.tiers.find((t) => percent >= t.min)?.tier ?? "Poor";
  return { raw, max, percent, tier, items };
}

/** Emergency Stand-in: a 60-OVR rental with NO chemistry history. */
function standInMemberView(region: Region): MemberView {
  return {
    name: STAND_IN_NAMES[region],
    overall: CAREER_SUB.standInOverall,
    stats: effectiveStats(CAREER_SUB.standInOverall),
    lineupId: "standin",
    orgId: "standin",
  };
}

/**
 * Assemble the user's TournamentTeam for one event. The fielded trio is
 * `starterIds`; an unavailable starter is replaced by the squad sub (role
 * "sub") or, without one, by the Emergency Stand-in. The bench sub (when not
 * fielded and not unavailable) rides AssembleInput.sub for depth + chemistry.
 */
export function userTeamFor(input: UserTeamInput): {
  team: TournamentTeam;
  usedStandIn: boolean;
  usedSubId: string | null;
} {
  const byId = new Map(input.squad.map((p) => [p.id, p]));
  const unavailable = input.unavailablePlayerId ?? null;
  const subPlayer =
    input.squad.find((p) => p.role === "sub" && !input.starterIds.includes(p.id)) ?? null;

  let usedStandIn = false;
  let usedSubId: string | null = null;
  // Track the actual fielded squad players (for earned chemistry); a stand-in
  // contributes no history.
  const fieldedPlayers: (SquadPlayer | null)[] = [];
  // Defensive: a starter id that isn't on the squad (e.g. a released player
  // whose slot wasn't repaired) must NEVER throw — the fielded lineup renders
  // on every top-bar render. Fall back to the squad sub, then an emergency
  // stand-in, so a stale roster degrades gracefully instead of crashing the
  // whole /career layout (and corrupting the save on the next write).
  const fielded: MemberView[] = input.starterIds.map((starterId) => {
    const p = starterId && starterId !== unavailable ? byId.get(starterId) : undefined;
    if (p) {
      fieldedPlayers.push(p);
      return squadMemberView(p, input.gear.psychologist);
    }
    if (subPlayer && subPlayer.id !== unavailable && !fieldedPlayers.includes(subPlayer)) {
      usedSubId = subPlayer.id;
      fieldedPlayers.push(subPlayer);
      return squadMemberView(subPlayer, input.gear.psychologist);
    }
    usedStandIn = true;
    fieldedPlayers.push(null);
    return standInMemberView(input.identity.region);
  });

  const chem = careerChemistry(fieldedPlayers.filter((p): p is SquadPlayer => p !== null));

  const benchSub =
    subPlayer && !usedSubId && subPlayer.id !== unavailable
      ? {
          name: subPlayer.name,
          overall: subPlayer.overall,
          lineupId: `solo:${subPlayer.id}`,
          orgId: `solo-org:${subPlayer.id}`,
          country: subPlayer.country,
          region: subPlayer.region,
        }
      : undefined;

  const team = assembleTournamentTeam({
    id: "user",
    name: input.identity.orgName,
    isUser: true,
    region: input.identity.region,
    players: fielded,
    coach: input.coach
      ? {
          name: input.coach.name,
          overall: input.coach.overall,
          bonusType: input.coach.bonusType,
          bonusLevel: input.coach.bonusLevel,
          // Cosmetic ids only — coach chemistry contribution folds into the
          // earned career chemistry below, so keep it out of the id graph.
          lineupId: "coach-solo",
          orgId: "coach-solo",
        }
      : undefined,
    sub: benchSub,
    orgOverride: {
      name: input.identity.orgName,
      buffType: input.identity.buffType,
      buffLevel: FACILITY_BUFF_LEVEL[gearBuffLevels(input.gear)],
    },
    chemistryOverride: {
      raw: chem.raw,
      max: chem.max,
      percent: chem.percent,
      tier: chem.tier as TournamentTeam["chemistry"]["tier"],
      items: chem.items,
    },
    specialIds: [],
    difficulty: input.difficulty,
    difficultyShift: 0,
    ratingBonus: Math.min(input.bootcampSharp, CAREER_GEAR.tempRatingMax),
  });

  return { team, usedStandIn, usedSubId };
}

// ---------------------------------------------------------------------------
// AI org team assembly
// ---------------------------------------------------------------------------

export interface OrgTeamCtx {
  world: WorldState;
  seasonIndex: number;
  careerSeed: number;
  difficulty: CareerDifficulty;
}

/** Defensive-only replacement id when a roster id fails to resolve. */
function defensiveFillerN(orgRef: string, slot: number): number {
  return 1_000_000 + (deriveSeed(0, `fallback:${orgRef}`) % 100_000) * 3 + slot;
}

/**
 * Assemble one AI org's TournamentTeam. Real orgs keep their dataset orgId
 * (era buffs apply); filler orgs ride a derived orgOverride. All members share
 * lineupId = orgRef (a standing roster saturates chemistry like real lineups).
 */
export function orgTeamFor(orgRef: string, ctx: OrgTeamCtx): TournamentTeam {
  const org = ctx.world.orgs[orgRef];
  if (!org) throw new Error(`orgTeamFor: unknown org ref "${orgRef}"`);
  const viewCtx = {
    careerSeed: ctx.careerSeed,
    seasonIndex: ctx.seasonIndex,
    world: ctx.world,
  };
  const isFiller = !orgById.has(orgRef);

  const memberViews: MemberView[] = org.playerIds.map((pid, slot) => {
    const view: CareerPlayerView =
      playerViewById(pid, viewCtx) ??
      // Defensive: a roster id that no longer resolves (retired under our
      // feet / bad save) is replaced by a deterministic filler view.
      fillerPlayerView(org.region, defensiveFillerN(orgRef, slot), viewCtx);
    return {
      name: view.name,
      overall: view.overall,
      stats: statsFromView(view),
      lineupId: orgRef,
      orgId: orgRef,
      country: view.country,
      region: view.region,
    };
  });

  const coach =
    org.coachOverall !== undefined
      ? {
          name: "Coach",
          overall: org.coachOverall,
          bonusType: pickStat(
            derivedFloat(ctx.careerSeed, streams.gen("orgCoachBuff", orgRef)),
          ),
          bonusLevel:
            org.coachOverall >= COACH_BONUS_STRONG
              ? "++"
              : org.coachOverall >= COACH_BONUS_MID
                ? "+"
                : "~",
          lineupId: orgRef,
          orgId: orgRef,
        }
      : undefined;

  const input: AssembleInput = {
    id: orgRef,
    name: org.name,
    isUser: false,
    region: org.region,
    players: memberViews,
    coach,
    orgId: isFiller ? undefined : orgRef,
    orgOverride: isFiller
      ? {
          name: org.name,
          buffType: pickStat(
            derivedFloat(ctx.careerSeed, streams.gen("fillerOrgBuff", orgRef)),
          ),
          buffLevel: "~",
        }
      : undefined,
    specialIds: [],
    difficulty: ctx.difficulty,
    difficultyShift: DIFFICULTY[ctx.difficulty].opponentRatingShift,
  };
  return assembleTournamentTeam(input);
}

// ---------------------------------------------------------------------------
// Event fields
// ---------------------------------------------------------------------------

export interface FieldCtx {
  world: WorldState;
  competition: CompetitionState;
  userTeam: TournamentTeam | null;
  userRegion: Region;
  careerSeed: number;
  difficulty: CareerDifficulty;
}

/** Intrinsic (shift-stripped) rating — comparisons and field quality use this. */
function intrinsicRating(team: TournamentTeam): number {
  return team.rating.total - team.rating.difficultyShift;
}

function expectedFieldSize(def: CareerEventDef): number {
  return def.format === "swiss" ? TOURNAMENT.swiss.teams : SINGLE_ELIM_TEAMS;
}

/**
 * Build the field for one career event.
 *  - regional: that region's orgs ranked by splitPoints → prestige → rating;
 *    top 15 + the user when it's the user's home regional, else top 16.
 *  - major/worlds: the announced competition refs ("user" → the user team; a
 *    dangling "user" ref without a user team backfills best-by-seasonPoints).
 *  - t3: user + the 7 closest AI orgs by rating (±t3RatingBand preferred —
 *    taking the 7 closest implements the "closest regardless" fallback).
 *  - t2: user + the region's top 7 by seasonPoints.
 */
export function fieldForEvent(
  def: CareerEventDef,
  ctx: FieldCtx,
): { field: TournamentTeam[]; fieldQuality: number } {
  const teamCache = new Map<string, TournamentTeam>();
  const teamFor = (ref: string): TournamentTeam => {
    let team = teamCache.get(ref);
    if (!team) {
      team = orgTeamFor(ref, {
        world: ctx.world,
        seasonIndex: def.seasonIndex,
        careerSeed: ctx.careerSeed,
        difficulty: ctx.difficulty,
      });
      teamCache.set(ref, team);
    }
    return team;
  };
  const pointsRank =
    (points: Record<string, number>) =>
    (a: WorldOrgState, b: WorldOrgState): number =>
      (points[b.ref] ?? 0) - (points[a.ref] ?? 0) ||
      b.prestige - a.prestige ||
      intrinsicRating(teamFor(b.ref)) - intrinsicRating(teamFor(a.ref)) ||
      a.ref.localeCompare(b.ref);
  const regionOrgs = (region: Region): WorldOrgState[] =>
    Object.values(ctx.world.orgs)
      .filter((o) => o.region === region)
      .sort((a, b) => a.ref.localeCompare(b.ref));

  let field: TournamentTeam[];

  if (def.tier === "regional") {
    const region = def.region ?? ctx.userRegion;
    const ranked = regionOrgs(region).sort(
      pointsRank(ctx.competition.splitPoints[region] ?? {}),
    );
    const includeUser = Boolean(ctx.userTeam) && region === ctx.userRegion;
    const take = includeUser ? TOURNAMENT.swiss.teams - 1 : TOURNAMENT.swiss.teams;
    field = ranked.slice(0, take).map((o) => teamFor(o.ref));
    if (includeUser) field.push(ctx.userTeam!);
  } else if (def.tier === "major" || def.tier === "worlds") {
    const refs =
      def.tier === "major"
        ? ctx.competition.majorFieldRefs
        : ctx.competition.worldsFieldRefs;
    if (!refs) throw new Error(`fieldForEvent: ${def.tier} field not announced (${def.id})`);
    field = [];
    let missing = 0;
    for (const ref of refs) {
      if (ref === "user") {
        if (ctx.userTeam) field.push(ctx.userTeam);
        else missing += 1; // defensive: qualified slot with no user team
      } else {
        field.push(teamFor(ref));
      }
    }
    if (missing > 0) {
      // Backfill the dangling slot(s) with the best not-included orgs by
      // season points (their own region's table) → prestige → rating.
      const included = new Set(refs);
      const backfill = Object.values(ctx.world.orgs)
        .filter((o) => !included.has(o.ref))
        .sort((a, b) => {
          const pa = ctx.competition.seasonPoints[a.region]?.[a.ref] ?? 0;
          const pb = ctx.competition.seasonPoints[b.region]?.[b.ref] ?? 0;
          return (
            pb - pa ||
            b.prestige - a.prestige ||
            intrinsicRating(teamFor(b.ref)) - intrinsicRating(teamFor(a.ref)) ||
            a.ref.localeCompare(b.ref)
          );
        })
        .slice(0, missing);
      for (const o of backfill) field.push(teamFor(o.ref));
    }
  } else {
    // Unofficials always field the user team.
    if (!ctx.userTeam) {
      throw new Error(`fieldForEvent: ${def.tier} event "${def.id}" requires the user team`);
    }
    const region = def.region ?? ctx.userRegion;
    if (def.tier === "t3") {
      const userRating = ctx.userTeam.rating.total;
      const closest = regionOrgs(region)
        .map((o) => ({
          ref: o.ref,
          diff: Math.abs(intrinsicRating(teamFor(o.ref)) - userRating),
        }))
        .sort((a, b) => a.diff - b.diff || a.ref.localeCompare(b.ref))
        .slice(0, SINGLE_ELIM_TEAMS - 1);
      field = [ctx.userTeam, ...closest.map((c) => teamFor(c.ref))];
    } else {
      const ranked = regionOrgs(region).sort(
        pointsRank(ctx.competition.seasonPoints[region] ?? {}),
      );
      field = [
        ctx.userTeam,
        ...ranked.slice(0, SINGLE_ELIM_TEAMS - 1).map((o) => teamFor(o.ref)),
      ];
    }
  }

  const want = expectedFieldSize(def);
  if (field.length !== want) {
    throw new Error(
      `fieldForEvent: "${def.id}" needs ${want} teams, built ${field.length}`,
    );
  }

  const fieldQuality = fieldQualityFor(
    field.map((t) => (t.isUser ? t.rating.total : intrinsicRating(t))),
  );
  return { field, fieldQuality };
}

/**
 * Headless AI-only event (spectator weeks / other regions): builds the field
 * WITHOUT the user and runs it to completion on the event's own seed stream
 * ("evt:" + def.id — def.id IS the stream suffix, stable forever).
 */
export function simulateAiEvent(
  def: CareerEventDef,
  ctx: {
    world: WorldState;
    competition: CompetitionState;
    careerSeed: number;
    difficulty: CareerDifficulty;
  },
): TournamentState {
  const { field } = fieldForEvent(def, {
    world: ctx.world,
    competition: ctx.competition,
    userTeam: null,
    userRegion: def.region ?? REGIONS[0], // unused without a user team
    careerSeed: ctx.careerSeed,
    difficulty: ctx.difficulty,
  });
  const rng: Rng = createRng(deriveSeed(ctx.careerSeed, `evt:${def.id}`));
  const state = initFieldTournament(field, def.format, rng);
  return fastForward(state, ctx.difficulty, rng);
}

// ---------------------------------------------------------------------------
// Season-boundary world pass
// ---------------------------------------------------------------------------

function growthMultFor(age: number): number {
  const g = CAREER_AGE.growthMult;
  if (age <= 16) return g.u16;
  if (age <= 18) return g.a17_18;
  if (age <= 20) return g.a19_20;
  if (age <= 22) return g.a21_22;
  if (age <= 24) return g.a23_24;
  return g.a25plus;
}

function declineFor(age: number, rate: DeclineRate): number {
  if (age < 22) return 0;
  const d = CAREER_AGE.declineByAge;
  const base = age === 22 ? d.a22 : age <= 24 ? d.a23_24 : age <= 26 ? d.a25_26 : d.a27plus;
  return base * CAREER_AGE.declineRateMult[rate];
}

/** Next unused numeric "fic:{region}:{n}" id across the whole world state. */
function nextFillerId(region: Region, world: WorldState): string {
  const prefix = `fic:${region}:`;
  let max = -1;
  const scan = (id: string) => {
    if (!id.startsWith(prefix)) return;
    const n = Number(id.slice(prefix.length));
    if (Number.isInteger(n) && n > max) max = n;
  };
  for (const org of Object.values(world.orgs)) org.playerIds.forEach(scan);
  world.freeAgentIds.forEach(scan);
  world.retiredIds.forEach(scan);
  return `${prefix}${max + 1}`;
}

/**
 * The rollover world pass into `toSeasonIndex` (stream world:{i}:rollover):
 *  1. Retirement rolls for every world player (org rosters in sorted-ref
 *     order, then FAs in pool order; user squad skipped). Anchor protection:
 *     a real player can only retire once his LAST dataset card's season order
 *     is ≤ the new season's order. Stars (overall ≥ blue-card bar) linger at
 *     retirementStarMult.
 *  2. Org holes backfill from the FA pool, best regional overall first (a
 *     fresh filler id is minted if a region's pool runs dry).
 *  3. Off-anchor development (ids present in overallDelta — presence in the
 *     delta map IS the un-anchored marker): one season of growth/decline via
 *     the CAREER_AGE/CAREER_TRAINING curves, rng-free. Anchored players stay
 *     absent — they snap to their new season card via anchorOverall.
 *  4. Rookie intake: rookiesPerRegionPerSeason procedural rookies per region
 *     into the FA pool ("rook:{toSeasonIndex}:{region}:{i}").
 */
export function agePassAndIntake(
  world: WorldState,
  toSeasonIndex: number,
  careerSeed: number,
  userSquadIds: string[],
  infinite: boolean,
): {
  world: WorldState;
  retired: { id: string; name: string }[];
  rookies: { id: string; name: string; region: Region }[];
} {
  const rng = createRng(deriveSeed(careerSeed, streams.rollover(toSeasonIndex)));
  // Views resolve against the INCOMING world — decisions this pass makes are
  // tracked locally and written to `next`.
  const viewCtx = { careerSeed, seasonIndex: toSeasonIndex, world };
  const userSquad = new Set(userSquadIds);
  const orderNow = orderFor(toSeasonIndex);

  const next: WorldState = {
    orgs: {},
    overallDelta: { ...world.overallDelta },
    freeAgentIds: [...world.freeAgentIds],
    retiredIds: [...world.retiredIds],
    version: world.version + 1,
  };
  for (const ref of Object.keys(world.orgs)) {
    next.orgs[ref] = {
      ...world.orgs[ref],
      playerIds: [...world.orgs[ref].playerIds] as [string, string, string],
    };
  }

  const retirementTable = CAREER_AGE.retirementByAge;
  const tableAges = Object.keys(retirementTable).map(Number);
  const minRetireAge = Math.min(...tableAges);
  const maxRetireAge = Math.max(...tableAges);

  const rollsRetirement = (view: CareerPlayerView): boolean => {
    if (view.age < minRetireAge) return false;
    if (view.kind === "real") {
      // Anchor protection: never before the real career's last dataset card.
      const last = lastDatasetCardOrder(view.id);
      if (last !== undefined && last > orderNow) return false;
    }
    let p = retirementTable[Math.min(view.age, maxRetireAge)] ?? 0;
    if (view.overall >= STAR_RETIREMENT_OVERALL) p *= CAREER_AGE.retirementStarMult;
    return p > 0 && rng.chance(p);
  };

  const retired: { id: string; name: string }[] = [];
  const retiredNow = new Set<string>();
  const retire = (id: string, name: string) => {
    retired.push({ id, name });
    retiredNow.add(id);
    next.retiredIds.push(id);
    delete next.overallDelta[id];
  };

  // 1a. Org rosters (sorted refs → slots in order: stable rng consumption).
  const holes: { ref: string; slot: number }[] = [];
  for (const ref of Object.keys(next.orgs).sort()) {
    const org = next.orgs[ref];
    org.playerIds.forEach((id, slot) => {
      if (userSquad.has(id)) return;
      const view = playerViewById(id, viewCtx);
      if (!view || !rollsRetirement(view)) return;
      retire(id, view.name);
      holes.push({ ref, slot });
    });
  }
  // 1b. Free agents (pool order).
  for (const id of next.freeAgentIds) {
    if (userSquad.has(id)) continue;
    const view = playerViewById(id, viewCtx);
    if (view && rollsRetirement(view)) retire(id, view.name);
  }
  next.freeAgentIds = next.freeAgentIds.filter((id) => !retiredNow.has(id));

  // 2. Backfill org holes: best regional FA by overall (deterministic).
  for (const { ref, slot } of holes) {
    const org = next.orgs[ref];
    let bestId: string | null = null;
    let bestOverall = -Infinity;
    for (const id of next.freeAgentIds) {
      const view = playerViewById(id, viewCtx);
      if (!view || view.region !== org.region) continue;
      if (view.overall > bestOverall) {
        bestOverall = view.overall;
        bestId = id;
      }
    }
    if (bestId) {
      org.playerIds[slot] = bestId;
      next.freeAgentIds = next.freeAgentIds.filter((id) => id !== bestId);
    } else {
      org.playerIds[slot] = nextFillerId(org.region, next);
    }
  }

  // 3. Off-anchor development pass (rng-free; sorted for determinism).
  //    v0.3: ALL fictional players (fic:/rook:) develop too — previously only
  //    ids the market had touched (present in overallDelta) ever grew, so
  //    fillers and rookies never reached their potential. Growth is written
  //    into overallDelta (a fictional's first entry initializes at 0).
  const devIds = new Set<string>(Object.keys(next.overallDelta));
  const addFictional = (id: string) => {
    if (id.startsWith("fic:") || id.startsWith("rook:")) devIds.add(id);
  };
  for (const ref of Object.keys(next.orgs)) next.orgs[ref].playerIds.forEach(addFictional);
  next.freeAgentIds.forEach(addFictional);
  for (const id of [...devIds].sort()) {
    if (userSquad.has(id) || retiredNow.has(id)) continue;
    const view = playerViewById(id, viewCtx);
    if (!view) continue;
    if (!(id in next.overallDelta)) next.overallDelta[id] = 0;
    const headroom = Math.max(0, view.potential - view.overall);
    const headroomMult = headroom / (headroom + CAREER_TRAINING.headroomSoftK);
    const raw =
      CAREER_TRAINING.weeklyBase *
      CAREER_CALENDAR.weeksPerSeason *
      growthMultFor(view.age) *
      headroomMult;
    const growth = Math.min(raw, CAREER_TRAINING.maxSeasonGain, headroom);
    const newOverall = clamp(
      view.overall + growth - declineFor(view.age, view.declineRate),
      60,
      99,
    );
    next.overallDelta[id] += newOverall - view.overall;
  }

  // 4. Rookie intake.
  const rookies: { id: string; name: string; region: Region }[] = [];
  for (const region of REGIONS) {
    for (let i = 0; i < CAREER_WORLD.rookiesPerRegionPerSeason; i++) {
      const view = rookieView(region, toSeasonIndex, i, careerSeed, infinite);
      next.freeAgentIds.push(view.id);
      rookies.push({ id: view.id, name: view.name, region });
    }
  }

  return { world: next, retired, rookies };
}

// ---------------------------------------------------------------------------
// Cosmetic org stars
// ---------------------------------------------------------------------------

/**
 * Recompute every org's stars (v0.2: 0-5★ half-steps) via economy.starsFor:
 * intrinsic team rating percentile across the WHOLE live world + a prestige
 * component. AI orgs carry no reputation scalar, so repTier approximates from
 * prestige (prestige + 1, capped at 4) — a real elite org reads as an
 * established brand, a filler as a newcomer.
 */
export function computeStars(
  world: WorldState,
  ctx: { seasonIndex: number; careerSeed: number; difficulty: CareerDifficulty },
): WorldState {
  const ratingByRef: Record<string, number> = {};
  const worldRatings: number[] = [];
  for (const ref of Object.keys(world.orgs).sort()) {
    const team = orgTeamFor(ref, {
      world,
      seasonIndex: ctx.seasonIndex,
      careerSeed: ctx.careerSeed,
      difficulty: ctx.difficulty,
    });
    const rating = intrinsicRating(team);
    ratingByRef[ref] = rating;
    worldRatings.push(rating);
  }
  const orgs: Record<string, WorldOrgState> = {};
  for (const ref of Object.keys(world.orgs)) {
    const org = world.orgs[ref];
    orgs[ref] = {
      ...org,
      rating: ratingByRef[ref],
      stars: starsFor({
        rating: ratingByRef[ref],
        worldRatings,
        repTier: Math.min(4, org.prestige + 1),
      }),
    };
  }
  return { ...world, orgs };
}

/**
 * The user org's star read (v0.2): same percentile scale as the AI world —
 * the user team's intrinsic rating vs the org rating snapshots stored by the
 * last computeStars pass, with the reputation tier as the prestige component.
 * Cheap enough for render-time use (no team assembly).
 */
export function userStarsFor(input: {
  userRating: number;
  world: WorldState;
  repTier: number;
}): number {
  const worldRatings = Object.values(input.world.orgs)
    .map((o) => o.rating)
    .filter((r): r is number => r !== undefined);
  return starsFor({
    rating: input.userRating,
    worldRatings,
    repTier: input.repTier,
  });
}
