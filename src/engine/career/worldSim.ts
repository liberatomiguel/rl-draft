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
  CAREER_QUALIFIER,
  CAREER_SEASONS,
  CAREER_SUB,
  CAREER_TRAINING,
  CAREER_UNOFFICIAL,
  CAREER_WORLD,
  CHEMISTRY,
  DIFFICULTY,
  RARITY,
  TOURNAMENT,
} from "@/config/balance";
import {
  coachById,
  lineupById,
  lineups,
  orgById,
  playerCardById,
  playerCards,
  players,
  seasonById,
} from "@/data";
import {
  FILLER_ORG_NAME_BANK,
  PLAYER_NAME_BANK,
  STAND_IN_NAMES,
  STARTER_NAME_BANK,
  playerNameBankFor,
} from "@/data/career/names";
import {
  isLocalRef,
  localPlayerNames,
  localSceneRefs,
  localTeamName,
  localTeamOffset,
} from "./localScene";
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
  peakAgeOf,
  playerViewById,
  retirementChanceFor,
  rookieView,
  seasonYear,
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
/**
 * v2.0 (R24) starter rosters rebalanced: the three shapes now overlap in
 * day-one strength (prospects 65-68 / journeymen 71-74 / balanced 68-71) so
 * none is a dead start — prospects trade ~5 OVR today for 80-90 potential,
 * journeymen are the strongest now but capped at JOURNEYMAN_POTENTIAL_CAP.
 */
const STARTER_OFFERS = [
  { key: "prospects", ageMin: 15, ageSpan: 3, ovrMin: 65, ovrSpan: 3, potMin: 80, potSpan: 10 },
  { key: "journeymen", ageMin: 21, ageSpan: 3, ovrMin: 71, ovrSpan: 3, potMin: 0, potSpan: 0 },
  { key: "balanced", ageMin: 17, ageSpan: 4, ovrMin: 68, ovrSpan: 3, potMin: 76, potSpan: 8 },
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
      if (lineupById.get(card.lineupId)?.national) continue; // FIFAe ≠ club history (v2.0)
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
  //    rc.29 (CAR-01): a player who changed teams during Season X sits on two
  //    of its lineups (Itachi: FC Barcelona and Vodafone Giants; Erased shares
  //    all three with Dracon, The Three Sins and PDHM), and the world fielded
  //    him for both — one gamertag scoring for both sides of a regional
  //    fixture. He stays on the FIRST org in dataset order; the later seat is
  //    a hole the best regional free agent fills (below), so no player is ever
  //    on two rosters.
  const holes: { ref: string; slot: number; region: Region }[] = [];
  for (const lineup of lineups) {
    if (lineup.seasonId !== season0.seasonId || lineup.rareSpawn) continue;
    if (orgs[lineup.orgId]) continue; // one org per orgId
    const playerIds = lineup.playerCardIds.map(
      (cardId) => playerCardById.get(cardId)!.playerId,
    ) as [string, string, string];
    playerIds.forEach((id, slot) => {
      if (rosteredPlayerIds.has(id)) holes.push({ ref: lineup.orgId, slot, region: lineup.region });
    });
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

  // rc.29: the step-1 holes sign the best free agent of their region (a
  // region with none left gets a fresh filler, numbered after the filler orgs).
  let pool = candidates;
  for (const hole of holes) {
    const pick = pool.find((c) => c.region === hole.region);
    if (pick) {
      orgs[hole.ref].playerIds[hole.slot] = pick.id;
      pool = pool.filter((c) => c.id !== pick.id);
    } else {
      orgs[hole.ref].playerIds[hole.slot] = `fic:${hole.region}:${ficNext[hole.region]++}`;
    }
  }

  const fillersNeededFor = (real: { region: Region }[]): number => {
    let need = 0;
    for (const region of REGIONS) {
      const have = real.filter((r) => r.region === region).length;
      need += Math.max(0, CAREER_WORLD.faPoolFloorPerRegion - have);
    }
    return need;
  };
  let realFAs = pool;
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
    // rc.29 (CAR-01): this world's fillers never wear a real nickname.
    nameBankVersion: 2,
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
 * rc.29 (CAR-01): the names come from STARTER_NAME_BANK, disjoint from the
 * filler / rookie bank — in MENA, APAC and SSA every PLAYER_NAME_BANK name is
 * a filler pro's, so each starter shared a gamertag with a regional opponent.
 */
export function starterRosterOffers(region: Region, careerSeed: number): StarterOffer[] {
  // Nine distinct names: rank the bank deterministically, take the first nine.
  const bank = STARTER_NAME_BANK[region];
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
  /** v2.0 (R40 review): the squad players actually fielded (a stand-in is not one). */
  fieldedIds: string[];
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

  const fieldedIds = fieldedPlayers.filter((p): p is SquadPlayer => p !== null).map((p) => p.id);
  return { team, usedStandIn, usedSubId, fieldedIds };
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
  /** v2.0 (R30): the user's seeding prestige (reputation tier) for the direct-8 race. */
  userPrestige?: number;
  /**
   * v2.0 (R40 review): the user's seeding row for an AI-resolved event of the
   * user's region (no `userTeam`): a qualifier played while the user holds a
   * direct regional seat must seed the region exactly as Sunday's regional
   * will — the user takes one of the direct 8, so the 8th org plays Saturday
   * instead of missing both events. The user is never fielded from it.
   */
  userSeedRow?: { rating: number; prestige: number } | null;
}

/** Intrinsic (shift-stripped) rating — comparisons and field quality use this. */
function intrinsicRating(team: TournamentTeam): number {
  return team.rating.total - team.rating.difficultyShift;
}

function expectedFieldSize(def: CareerEventDef): number {
  // "swiss" and "swissOnly" (R40 qualifier) both field 16; cups field 8.
  return def.format === "single" ? SINGLE_ELIM_TEAMS : TOURNAMENT.swiss.teams;
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
/**
 * v2.0 (R23) Community Cup field selection — ONE rule for the engine and the
 * lobby preview: the closest orgs by rating, at most t3MaxStrongerTeams of
 * them rated above the user; when the region has fewer weaker orgs than the
 * cup needs, the remaining seats go to the local amateur scene.
 */
export function t3FieldRefsFor(input: {
  region: Region;
  seasonIndex: number;
  userRating: number;
  orgRatings: { ref: string; rating: number }[];
  seats: number;
}): string[] {
  const byDiff = [...input.orgRatings]
    .map((o) => ({ ref: o.ref, diff: Math.abs(o.rating - input.userRating), stronger: o.rating > input.userRating }))
    .sort((a, b) => a.diff - b.diff || a.ref.localeCompare(b.ref));
  const picked: string[] = [];
  let strongerTaken = 0;
  for (const c of byDiff) {
    if (picked.length >= input.seats) break;
    if (c.stronger) {
      if (strongerTaken >= CAREER_UNOFFICIAL.t3MaxStrongerTeams) continue;
      strongerTaken += 1;
    }
    picked.push(c.ref);
  }
  for (const ref of localSceneRefs(input.region, input.seasonIndex)) {
    if (picked.length >= input.seats) break;
    picked.push(ref);
  }
  return picked;
}

/**
 * rc.29 (CAR-06): a region's orgs ranked for a points-seeded field (split
 * points → prestige → intrinsic team rating → ref) — the order fieldForEvent
 * seeds an Invitational or a regional without Saturday's qualified list by,
 * shared with the event lobby (it used the orgs' STORED ratings for the
 * tie-break, which can lag the rosters, and listed another team).
 */
export function orgsByPointsFor(input: {
  world: WorldState;
  region: Region;
  points: Record<string, number>;
  seasonIndex: number;
  careerSeed: number;
  difficulty: CareerDifficulty;
  /** fieldForEvent passes its team cache; the lobby builds the teams here. */
  teamFor?: (ref: string) => TournamentTeam;
}): string[] {
  const cache = new Map<string, number>();
  const ratingOf = (ref: string): number => {
    let r = cache.get(ref);
    if (r === undefined) {
      r = intrinsicRating(
        input.teamFor?.(ref) ??
          orgTeamFor(ref, {
            world: input.world,
            seasonIndex: input.seasonIndex,
            careerSeed: input.careerSeed,
            difficulty: input.difficulty,
          }),
      );
      cache.set(ref, r);
    }
    return r;
  };
  const pts = input.points;
  return Object.values(input.world.orgs)
    .filter((o) => o.region === input.region)
    .sort(
      (a, b) =>
        (pts[b.ref] ?? 0) - (pts[a.ref] ?? 0) ||
        b.prestige - a.prestige ||
        ratingOf(b.ref) - ratingOf(a.ref) ||
        a.ref.localeCompare(b.ref),
    )
    .map((o) => o.ref);
}

/**
 * rc.29 (CAR-06): the Community Cup's opponents — the ONE selection
 * fieldForEvent fields and the event lobby lists. The lobby used to rank by
 * the orgs' STORED ratings against the preview rating while the engine ranked
 * intrinsic team ratings against the fielded user team, so "The field" could
 * list a team that did not play and miss one that did. `userRating` is the
 * fielded user team's rating.total (careerFlow.userTeamForEvent).
 */
export function t3CupRefsFor(input: {
  world: WorldState;
  region: Region;
  seasonIndex: number;
  careerSeed: number;
  difficulty: CareerDifficulty;
  userRating: number;
  /** fieldForEvent passes its team cache; the lobby builds the teams here. */
  teamFor?: (ref: string) => TournamentTeam;
}): string[] {
  const teamFor =
    input.teamFor ??
    ((ref: string) =>
      orgTeamFor(ref, {
        world: input.world,
        seasonIndex: input.seasonIndex,
        careerSeed: input.careerSeed,
        difficulty: input.difficulty,
      }));
  const orgs = Object.values(input.world.orgs)
    .filter((o) => o.region === input.region)
    .sort((a, b) => a.ref.localeCompare(b.ref));
  return t3FieldRefsFor({
    region: input.region,
    seasonIndex: input.seasonIndex,
    userRating: input.userRating,
    orgRatings: orgs.map((o) => ({ ref: o.ref, rating: intrinsicRating(teamFor(o.ref)) })),
    seats: SINGLE_ELIM_TEAMS - 1,
  });
}

/**
 * A local amateur side for a Community Cup: three generated gamertags whose
 * overalls are fitted (two passes) so the assembled intrinsic rating lands on
 * userRating + localTeamOffset. Never persisted; same inputs → same team.
 */
export function localTeamFor(
  ref: string,
  ctx: { careerSeed: number; seasonIndex: number; difficulty: CareerDifficulty; userRating: number; region: Region },
): TournamentTeam {
  const name = localTeamName(ref, ctx.careerSeed);
  const target = clamp(ctx.userRating + localTeamOffset(ref, ctx.careerSeed), 55, 96);
  const names = localPlayerNames(ref, ctx.careerSeed);
  const assemble = (shift: number): TournamentTeam => {
    const players: MemberView[] = names.map((n, i) => {
      const id = `${ref}:${i}`;
      const archetype = deriveArchetype(id, ctx.careerSeed);
      const jitter = Math.round((derivedFloat(ctx.careerSeed, streams.gen("localJit", id)) - 0.5) * 2);
      const overall = clamp(Math.round(target + shift + jitter), 50, 99);
      return {
        name: n,
        overall,
        stats: statsFromView({ overall, attrOffsets: deriveAttrOffsets(id, ctx.careerSeed, archetype) }),
        lineupId: ref,
        orgId: ref,
        region: ctx.region,
      };
    });
    return assembleTournamentTeam({
      id: ref,
      name,
      isUser: false,
      region: ctx.region,
      players,
      orgOverride: {
        name,
        buffType: pickStat(derivedFloat(ctx.careerSeed, streams.gen("localBuff", ref))),
        buffLevel: "~",
      },
      specialIds: [],
      difficulty: ctx.difficulty,
      difficultyShift: DIFFICULTY[ctx.difficulty].opponentRatingShift,
    });
  };
  const first = assemble(0);
  const delta = target - intrinsicRating(first);
  return Math.abs(delta) < 0.5 ? first : assemble(Math.round(delta));
}

/**
 * v2.0 (R30): the split's regional seeding for a region — the direct top 8
 * and everyone else — from STORED fields only (split points → prestige →
 * stored rating → ref), so the hub, the calendar, the lobby and the engine
 * all agree without building a single team. The user (when given) competes
 * for a direct slot like any org, with reputation tier as prestige.
 */
export function regionalSeedingFor(input: {
  orgs: WorldOrgState[];
  splitPoints: Record<string, number>;
  user: { rating: number; prestige: number } | null;
}): { direct: string[]; rest: string[] } {
  const rows = input.orgs.map((o) => ({
    ref: o.ref,
    points: input.splitPoints[o.ref] ?? 0,
    prestige: o.prestige,
    rating: o.rating ?? 70 + o.prestige * 6,
  }));
  if (input.user) {
    rows.push({
      ref: "user",
      points: input.splitPoints.user ?? 0,
      prestige: input.user.prestige as WorldOrgState["prestige"],
      rating: input.user.rating,
    });
  }
  rows.sort(
    (a, b) =>
      b.points - a.points || b.prestige - a.prestige || b.rating - a.rating || a.ref.localeCompare(b.ref),
  );
  const direct = rows.slice(0, CAREER_QUALIFIER.directSlots).map((r) => r.ref);
  const rest = rows.slice(CAREER_QUALIFIER.directSlots).map((r) => r.ref);
  return { direct, rest };
}

/**
 * v2.0 (R30): the refs of a qualifier field (R40: Saturday) — the non-direct orgs
 * (and the user when not direct) plus local amateur sides up to 16 (the
 * lowest-seeded orgs drop out when the pool overflows).
 */
export function qualifierFieldRefsFor(input: {
  region: Region;
  seasonIndex: number;
  seeding: { direct: string[]; rest: string[] };
  seats: number;
}): string[] {
  const refs = input.seeding.rest.slice(0, input.seats);
  for (const ref of localSceneRefs(input.region, input.seasonIndex)) {
    if (refs.length >= input.seats) break;
    refs.push(ref);
  }
  return refs;
}

/**
 * R40: the user's own qualifier / regional always fields the user — the
 * week's commit is the authority. If today's seeding drifted the user out of
 * the list (a signing or the Mon-Fri training lifted them into the direct 8),
 * the lowest seat makes room.
 */
export function withUserSeat(refs: string[], seats: number): string[] {
  if (refs.includes("user")) return refs;
  return [...(refs.length >= seats ? refs.slice(0, seats - 1) : refs), "user"];
}

/** The inputs of a seeded official field (a Saturday qualifier, a Sunday regional). */
interface SeededFieldInput {
  world: WorldState;
  competition: CompetitionState;
  region: Region;
  /** The event's season and week — the key of the committed `competition.weekSeeding`. */
  seasonIndex: number;
  week: number;
  /**
   * The user's row in the region's direct-8 race, or null (another region) —
   * read only when the week has no committed seeding (a save from before
   * rc.30 that the load repair could not date). fieldForEvent: the fielded
   * team's rating.total with the reputation tier as prestige; an AI
   * resolution: its seeding row.
   */
  userSeed: { rating: number; prestige: number } | null;
  /** The user plays this event: they always take a seat (withUserSeat). */
  fieldsUser: boolean;
}

/**
 * rc.30 (direct-8): the region's committed seeding for a week
 * (`competition.weekSeeding`, decided on its Monday), or null.
 */
export function committedSeedingFor(
  competition: CompetitionState,
  at: { region: Region; seasonIndex: number; week: number },
): { direct: string[]; rest: string[] } | null {
  const s = competition.weekSeeding;
  if (!s || s.region !== at.region || s.seasonIndex !== at.seasonIndex || s.week !== at.week) return null;
  return { direct: s.direct, rest: s.rest };
}

function seedingOfField(input: SeededFieldInput): { direct: string[]; rest: string[] } {
  // rc.30 (direct-8): the week's Monday decision is the authority — the
  // user's rating is never re-read on Saturday or Sunday.
  const committed = committedSeedingFor(input.competition, input);
  if (committed) return committed;
  return regionalSeedingFor({
    orgs: Object.values(input.world.orgs)
      .filter((o) => o.region === input.region)
      .sort((a, b) => a.ref.localeCompare(b.ref)),
    splitPoints: input.competition.splitPoints[input.region] ?? {},
    user: input.userSeed,
  });
}

/**
 * rc.29 review (CAREER-UX-R1): the refs a Saturday qualifier fields ("user" =
 * the user's team) — the ONE selection fieldForEvent builds and the event
 * lobby lists. The lobby seeded the user with the starters' plain average
 * (careerFlow.userSeedingFor, the Monday commit's read) while the engine
 * seeds with the fielded team's rating, so near the direct-8 line the lobby
 * listed a local side in place of the org the engine dropped into Saturday.
 * rc.30 (direct-8): both now read the week's committed seeding.
 */
export function qualifierEventRefsFor(input: SeededFieldInput): string[] {
  const seeding = seedingOfField(input);
  const refs = qualifierFieldRefsFor({
    region: input.region,
    seasonIndex: input.seasonIndex,
    // A seeding row without a team (AI resolution) never takes a seat.
    seeding: input.fieldsUser ? seeding : { ...seeding, rest: seeding.rest.filter((r) => r !== "user") },
    seats: TOURNAMENT.swiss.teams,
  });
  return input.fieldsUser ? withUserSeat(refs, TOURNAMENT.swiss.teams) : refs;
}

/**
 * rc.29 review (CAREER-UX-R1): the refs a Sunday regional with Saturday's
 * qualified list fields — the week's direct top 8 (rc.30: Monday's committed
 * seeding, the user's row as in qualifierEventRefsFor) + the qualified
 * eight, backfilled with the next-best non-direct orgs when a qualified ref
 * no longer resolves. Shared by fieldForEvent and the event lobby.
 */
export function regionalEventRefsFor(input: SeededFieldInput & { qualified: string[] }): string[] {
  const seats = TOURNAMENT.swiss.teams;
  const seeding = seedingOfField(input);
  // fieldForEvent's teamForRef: "user" needs the fielded team; an org must still exist.
  const resolves = (ref: string): boolean =>
    ref === "user" ? input.fieldsUser : isLocalRef(ref) || Boolean(input.world.orgs[ref]);
  const listed = [...seeding.direct, ...input.qualified.filter((r) => !seeding.direct.includes(r))];
  const refs = listed.filter(resolves);
  for (const ref of seeding.rest) {
    if (refs.length >= seats) break;
    if (listed.includes(ref)) continue;
    if (resolves(ref)) refs.push(ref);
  }
  return input.fieldsUser ? withUserSeat(refs, seats) : refs;
}

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
  // rc.29 (CAR-06): points-seeded fields share the lobby's ranking helper.
  const rankedByPoints = (region: Region, points: Record<string, number>): string[] =>
    orgsByPointsFor({
      world: ctx.world,
      region,
      points,
      seasonIndex: def.seasonIndex,
      careerSeed: ctx.careerSeed,
      difficulty: ctx.difficulty,
      teamFor,
    });
  const regionOrgs = (region: Region): WorldOrgState[] =>
    Object.values(ctx.world.orgs)
      .filter((o) => o.region === region)
      .sort((a, b) => a.ref.localeCompare(b.ref));

  let field: TournamentTeam[];

  // v2.0 (R30): a ref from the seeding/qualifier lists → a team (user, org, local).
  const localAnchor = (region: Region): number => {
    if (ctx.userTeam && region === ctx.userRegion) return ctx.userTeam.rating.total;
    const ratings = regionOrgs(region).map((o) => o.rating ?? 70 + o.prestige * 6).sort((a, b) => a - b);
    return ratings.length ? ratings[Math.floor(ratings.length / 2)] : 72;
  };
  const teamForRef = (ref: string, region: Region): TournamentTeam | null => {
    if (ref === "user") return ctx.userTeam;
    if (isLocalRef(ref)) {
      return localTeamFor(ref, {
        careerSeed: ctx.careerSeed,
        seasonIndex: def.seasonIndex,
        difficulty: ctx.difficulty,
        userRating: localAnchor(region),
        region,
      });
    }
    return ctx.world.orgs[ref] ? teamFor(ref) : null;
  };
  const userSeed = (region: Region) =>
    region !== ctx.userRegion
      ? null
      : ctx.userTeam
        ? { rating: ctx.userTeam.rating.total, prestige: ctx.userPrestige ?? 0 }
        : (ctx.userSeedRow ?? null);

  if (def.tier === "qualifier") {
    const region = def.region ?? ctx.userRegion;
    // The user's qualifier must field the user; AI qualifiers never do. R40:
    // the week's commit is the authority — if today's seeding drifted since
    // Monday (a signing or the Mon-Fri training lifted the user into the
    // direct 8), the committed user still plays; the lowest seat makes room.
    // rc.29 review (R1): the selection the event lobby lists too.
    const refs = qualifierEventRefsFor({
      world: ctx.world,
      competition: ctx.competition,
      region,
      seasonIndex: def.seasonIndex,
      week: def.week,
      userSeed: userSeed(region),
      fieldsUser: Boolean(ctx.userTeam) && region === ctx.userRegion,
    });
    field = refs.map((ref) => teamForRef(ref, region)).filter((t): t is TournamentTeam => t !== null);
  } else if (def.tier === "regional") {
    const region = def.region ?? ctx.userRegion;
    const qualified = ctx.competition.qualifiedRefs?.[region];
    if (qualified && qualified.eventId === def.id) {
      // v2.0 (R30): direct top 8 + the qualifier's 8 (R40: Saturday → Sunday).
      // R40: the user's own regional always fields the user — committed as
      // direct on Monday (or qualified on Saturday) even if today's seeding
      // drifted; the lowest qualified seat makes room. rc.29 review (R1): the
      // selection the event lobby lists too.
      const refs = regionalEventRefsFor({
        world: ctx.world,
        competition: ctx.competition,
        region,
        seasonIndex: def.seasonIndex,
        week: def.week,
        qualified: qualified.refs,
        userSeed: userSeed(region),
        fieldsUser: Boolean(ctx.userTeam) && region === ctx.userRegion,
      });
      field = refs
        .map((ref) => teamForRef(ref, region))
        .filter((t): t is TournamentTeam => t !== null);
    } else {
      const ranked = rankedByPoints(region, ctx.competition.splitPoints[region] ?? {});
      const includeUser = Boolean(ctx.userTeam) && region === ctx.userRegion;
      const take = includeUser ? TOURNAMENT.swiss.teams - 1 : TOURNAMENT.swiss.teams;
      field = ranked.slice(0, take).map((ref) => teamFor(ref));
      if (includeUser) field.push(ctx.userTeam!);
    }
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
      // v2.0 (R23): the local scene around the user — rc.29: t3CupRefsFor, the
      // selection the lobby lists too.
      const userRating = ctx.userTeam.rating.total;
      const refs = t3CupRefsFor({
        world: ctx.world,
        region,
        seasonIndex: def.seasonIndex,
        careerSeed: ctx.careerSeed,
        difficulty: ctx.difficulty,
        userRating,
        teamFor,
      });
      field = [
        ctx.userTeam,
        ...refs.map((ref) =>
          isLocalRef(ref)
            ? localTeamFor(ref, {
                careerSeed: ctx.careerSeed,
                seasonIndex: def.seasonIndex,
                difficulty: ctx.difficulty,
                userRating,
                region,
              })
            : teamFor(ref),
        ),
      ];
    } else {
      const ranked = rankedByPoints(region, ctx.competition.seasonPoints[region] ?? {});
      field = [ctx.userTeam, ...ranked.slice(0, SINGLE_ELIM_TEAMS - 1).map((ref) => teamFor(ref))];
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
    /** R40 review: the user's seeding row when the user holds a seat in this region (FieldCtx.userSeedRow). */
    userSeedRow?: { rating: number; prestige: number } | null;
  },
): TournamentState {
  const { field } = fieldForEvent(def, {
    world: ctx.world,
    competition: ctx.competition,
    userTeam: null,
    userRegion: def.region ?? REGIONS[0], // only the seeding row reads it
    careerSeed: ctx.careerSeed,
    difficulty: ctx.difficulty,
    userSeedRow: ctx.userSeedRow ?? null,
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
 *     is < the new season's order (R48: he plays his final real season). The
 *     roll is DEV-02's `retirementChanceFor` on the season just played: the
 *     24–29 window, never before the peak, stars (overall ≥ blue-card bar)
 *     lingering at retirementStarMult inside it.
 *  2. Org holes backfill from the FA pool, best regional overall first (a
 *     fresh filler id is minted if a region's pool runs dry).
 *  3. Off-anchor development (ids present in overallDelta — presence in the
 *     delta map IS the un-anchored marker): one season of growth/decline via
 *     the CAREER_AGE/CAREER_TRAINING curves, rng-free. Anchored players stay
 *     absent — they snap to their new season card via anchorOverall.
 *  4. Rookie intake: rookiesPerRegionPerSeason procedural rookies per region
 *     into the FA pool ("rook:{toSeasonIndex}:{region}:{i}"). rc.29: each
 *     rookie's gamertag is picked here and stored (world.rookieNames) — see
 *     pickRookieName.
 */
export function agePassAndIntake(
  world: WorldState,
  toSeasonIndex: number,
  careerSeed: number,
  userSquadIds: string[],
  infinite: boolean,
  /** rc.29: the user's squad names — a rookie never takes one of them. */
  userSquadNames: readonly string[] = [],
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
    ...(world.rookieNames ? { rookieNames: { ...world.rookieNames } } : {}),
    ...(world.nameBankVersion !== undefined ? { nameBankVersion: world.nameBankVersion } : {}),
  };
  for (const ref of Object.keys(world.orgs)) {
    next.orgs[ref] = {
      ...world.orgs[ref],
      playerIds: [...world.orgs[ref].playerIds] as [string, string, string],
    };
  }

  // DEV-02 (R48): the decision is whether the season just played was his last
  // (the age he played it at = this season's age − the calendar step, two
  // years across 2022 → 2024), inside the 24–29 window and never before his
  // peak; a season at 30 is never played.
  const calendarStep = seasonYear(toSeasonIndex) - seasonYear(Math.max(0, toSeasonIndex - 1));
  const rollsRetirement = (view: CareerPlayerView): boolean => {
    if (view.kind === "real") {
      // Anchor protection: a real player plays every season he has a club
      // card for (R48 fixes the off-by-one that let him retire before his
      // final dataset season). Once his history ends, the window applies — a
      // player already past it retires at that first rollover.
      const last = lastDatasetCardOrder(view.id);
      if (last !== undefined && last >= orderNow) return false;
    }
    const p = retirementChanceFor({
      age: view.age - calendarStep,
      nextAge: view.age,
      peakAge: peakAgeOf(view),
      overall: view.overall,
      starOverall: STAR_RETIREMENT_OVERALL,
    });
    return p > 0 && rng.chance(p);
  };

  const retired: { id: string; name: string }[] = [];
  const retiredNow = new Set<string>();
  const retire = (id: string, name: string) => {
    retired.push({ id, name });
    retiredNow.add(id);
    next.retiredIds.push(id);
    delete next.overallDelta[id];
    // A retired id never resolves again — its stored name can go (bounded save).
    if (next.rookieNames) delete next.rookieNames[id];
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

  // 4. Rookie intake. rc.29 (CAR-01): the gamertag is chosen here, against
  //    every name already held in the rookie's region, and stored.
  const held = heldNamesByRegion(next, toSeasonIndex, careerSeed, userSquadNames);
  const rookies: { id: string; name: string; region: Region }[] = [];
  const rookieNames: Record<string, string> = { ...(next.rookieNames ?? {}) };
  for (const region of REGIONS) {
    for (let i = 0; i < CAREER_WORLD.rookiesPerRegionPerSeason; i++) {
      const view = rookieView(region, toSeasonIndex, i, careerSeed, infinite);
      const name = pickRookieName(
        region,
        view.name,
        held.get(region)!,
        playerNameBankFor(region, next.nameBankVersion),
      );
      held.get(region)!.add(nameKey(name));
      rookieNames[view.id] = name;
      next.freeAgentIds.push(view.id);
      rookies.push({ id: view.id, name, region });
    }
  }
  next.rookieNames = rookieNames;

  return { world: next, retired, rookies };
}

/** Case-insensitive name key (accents and punctuation folded). */
function nameKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** Every real nickname in the dataset — a rookie never borrows one (a real
 *  player may debut, or return, after the rookie's intake). */
let realNameKeys: Set<string> | null = null;
function realNicknameKeys(): Set<string> {
  realNameKeys ??= new Set(players.map((p) => nameKey(p.nickname)));
  return realNameKeys;
}

/**
 * rc.29 (CAR-01): the gamertags already in use per region — every org roster
 * and free agent of the region (their views, stored rookie names included)
 * plus the user's squad (held in every region: it meets them all).
 */
function heldNamesByRegion(
  world: WorldState,
  seasonIndex: number,
  careerSeed: number,
  userSquadNames: readonly string[],
): Map<Region, Set<string>> {
  const held = new Map<Region, Set<string>>(REGIONS.map((r) => [r, new Set<string>()]));
  const ctx = { careerSeed, seasonIndex, world };
  for (const org of Object.values(world.orgs)) {
    for (const id of org.playerIds) {
      const view = playerViewById(id, ctx);
      if (view) held.get(org.region)?.add(nameKey(view.name));
    }
  }
  for (const id of world.freeAgentIds) {
    const view = playerViewById(id, ctx);
    if (view) held.get(view.region)?.add(nameKey(view.name));
  }
  for (const name of userSquadNames) for (const set of held.values()) set.add(nameKey(name));
  return held;
}

/**
 * rc.29 (CAR-01): a rookie's gamertag — the derived bank pick (read through
 * the world's bank) when nobody in the region holds it and no real player
 * carries it, else the next free bank name, else the fillers' own numeral
 * wrap ("Name II"). The bare pick used to collide: in MENA, APAC and SSA every
 * bank name is a filler pro's, and eight picks a season from forty names
 * repeat inside the class.
 */
export function pickRookieName(
  region: Region,
  derived: string,
  held: ReadonlySet<string>,
  bank: readonly string[] = playerNameBankFor(region, 2),
): string {
  const real = realNicknameKeys();
  const free = (name: string) => !held.has(nameKey(name)) && !real.has(nameKey(name));
  const start = Math.max(0, PLAYER_NAME_BANK[region].indexOf(derived));
  for (let k = 0; k < bank.length; k++) {
    const name = bank[(start + k) % bank.length];
    if (free(name)) return name;
  }
  for (let wrap = 1; ; wrap++) {
    for (let k = 0; k < bank.length; k++) {
      const name = `${bank[(start + k) % bank.length]} ${ROMAN[wrap] ?? String(wrap + 1)}`;
      if (free(name)) return name;
    }
  }
}

/**
 * rc.30 (A4): the one-time repair of a world built before rc.29 (CAR-01),
 * run once by the save migration (careerFlow.migrateSaveToV5). Org refs,
 * player ids, the user's squad, contracts, results and cards are untouched.
 *  1. One roster per player. A Season X player who changed teams sat on two
 *     lineups (Itachi, Erased), and a player the user signed could still be
 *     listed by a second org: the user's squad keeps its players, the first
 *     org in dataset order (then by ref) keeps the rest, and every other seat
 *     signs the best free agent of its region (a fresh filler when the region
 *     has none). No rostered player stays a free agent.
 *  2. One gamertag per player in a region, as rc.29 gives new worlds: the
 *     world moves to nameBankVersion 2 (the bank without real nicknames); a
 *     filler or a pre-rc.29 rookie whose name is already held — by a real
 *     player, by the user's squad (held in every region: it meets them all)
 *     or by an earlier player of the region — or is a real nickname takes the
 *     next free bank name (pickRookieName), stored in `rookieNames`. Real
 *     players and the user's players are never renamed; a filler the user
 *     signed keeps its squad name for good through a stored entry (unless
 *     that name is a real nickname — back in the world, he reads the new bank).
 * Idempotent: a repaired world comes back unchanged.
 */
export function repairLegacyWorld(
  world: WorldState,
  ctx: { seasonIndex: number; careerSeed: number; userSquad: readonly { id: string; name: string }[] },
): { world: WorldState; reseated: number; renamed: number } {
  const next: WorldState = structuredClone(world);
  const userIds = new Set(ctx.userSquad.map((p) => p.id));

  // 1. Rosters — dataset order first (the season-0 builder's order), then by ref.
  const datasetOrder = new Map<string, number>();
  for (const lineup of lineups) {
    if (lineup.seasonId !== CAREER_SEASONS[0].seasonId || lineup.rareSpawn) continue;
    if (!datasetOrder.has(lineup.orgId)) datasetOrder.set(lineup.orgId, datasetOrder.size);
  }
  const orderOf = (ref: string) => datasetOrder.get(ref) ?? Number.MAX_SAFE_INTEGER;
  const refs = Object.keys(next.orgs).sort((a, b) => orderOf(a) - orderOf(b) || a.localeCompare(b));
  const seated = new Set<string>(userIds);
  const holes: { ref: string; slot: number; region: Region }[] = [];
  for (const ref of refs) {
    const org = next.orgs[ref];
    org.playerIds.forEach((id, slot) => {
      if (seated.has(id)) holes.push({ ref, slot, region: org.region });
      else seated.add(id);
    });
  }
  const freeAgents = [...new Set(next.freeAgentIds)].filter((id) => !seated.has(id));
  const viewCtx = { careerSeed: ctx.careerSeed, seasonIndex: ctx.seasonIndex, world: next };
  let pool = freeAgents
    .map((id) => playerViewById(id, viewCtx))
    .filter((v): v is CareerPlayerView => v !== null)
    .sort((a, b) => b.overall - a.overall || a.id.localeCompare(b.id));
  for (const hole of holes) {
    const pick = pool.find((v) => v.region === hole.region);
    if (pick) pool = pool.filter((v) => v.id !== pick.id);
    next.orgs[hole.ref].playerIds[hole.slot] = pick ? pick.id : nextFillerId(hole.region, next);
  }
  const signed = new Set(holes.map((h) => next.orgs[h.ref].playerIds[h.slot]));
  next.freeAgentIds = freeAgents.filter((id) => !signed.has(id));

  // 2. Names — read every name through the new bank, then settle clashes.
  const renames: Record<string, string> = { ...(next.rookieNames ?? {}) };
  const real = realNicknameKeys();
  // A world filler the user signed keeps the name on its squad record (stored;
  // the founders' "fic:{region}:starterN" ids never resolve in the world) —
  // unless it is one of the old bank's real nicknames: back in the world, he
  // then reads the new bank's name instead of meeting the real player.
  for (const p of ctx.userSquad) {
    if (/^fic:[A-Z]+:\d+$/.test(p.id) && !real.has(nameKey(p.name))) renames[p.id] = p.name;
  }
  next.nameBankVersion = 2;
  next.rookieNames = renames;
  const squadKeys = new Set(ctx.userSquad.map((p) => nameKey(p.name)));
  const held = new Map<Region, Set<string>>(REGIONS.map((r) => [r, new Set(squadKeys)]));
  const worldIds = [...new Set([...Object.values(next.orgs).flatMap((o) => o.playerIds), ...next.freeAgentIds])];
  const views = worldIds
    .map((id) => playerViewById(id, { ...viewCtx, world: next }))
    .filter((v): v is CareerPlayerView => v !== null);
  // Real players hold their names first; generated players settle in id order.
  for (const v of views) if (v.kind === "real") held.get(v.region)?.add(nameKey(v.name));
  let renamed = 0;
  const generated = views.filter((v) => v.kind !== "real").sort((a, b) => a.id.localeCompare(b.id));
  for (const v of generated) {
    const set = held.get(v.region)!;
    const k = nameKey(v.name);
    const clash = set.has(k) || real.has(k);
    // The user's own filler is the squad's player: its name is never moved.
    if (clash && !userIds.has(v.id)) {
      const name = pickRookieName(v.region, v.name, set, playerNameBankFor(v.region, 2));
      renames[v.id] = name;
      set.add(nameKey(name));
      renamed += 1;
    } else {
      set.add(k);
    }
  }
  if (Object.keys(renames).length === 0 && !world.rookieNames) delete next.rookieNames;
  if (holes.length > 0 || renamed > 0 || world.nameBankVersion !== 2) next.version = world.version + 1;
  return { world: next, reseated: holes.length, renamed };
}

// ---------------------------------------------------------------------------
// Cosmetic org stars
// ---------------------------------------------------------------------------

/**
 * v2.0 (R31) — REAL ORGS ENTER WHEN THEIR SEASON ARRIVES. The season-0 world
 * is built from Season X lineups; every later dataset season brings orgs that
 * did not exist yet (Karmine Corp, Moist, Gen.G, …). At rollover into a
 * dataset season, each such lineup's org replaces the REGION'S WEAKEST FILLER
 * org (by stored rating): the filler's players go to free agency, the real
 * org arrives with the filler roster and the next preseason anchor pass
 * (market.ts) pulls its real players in with the usual fidelity. Regions
 * with no filler left keep their field. Deterministic (sorted scans).
 */
export function realOrgIntake(
  world: WorldState,
  toSeasonIndex: number,
): { world: WorldState; entered: { ref: string; name: string; region: Region }[] } {
  if (toSeasonIndex <= 0 || toSeasonIndex >= CAREER_SEASONS.length) return { world, entered: [] };
  const seasonId = CAREER_SEASONS[toSeasonIndex].seasonId;
  const next: WorldState = {
    ...world,
    orgs: { ...world.orgs },
    freeAgentIds: [...world.freeAgentIds],
    version: world.version,
  };
  const entered: { ref: string; name: string; region: Region }[] = [];
  const seen = new Set<string>();
  for (const lineup of lineups) {
    if (lineup.seasonId !== seasonId || lineup.rareSpawn) continue;
    if (next.orgs[lineup.orgId] || seen.has(lineup.orgId)) continue;
    seen.add(lineup.orgId);
    const fillers = Object.values(next.orgs)
      .filter((o) => o.region === lineup.region && o.ref.startsWith("fill:"))
      .sort((a, b) => (a.rating ?? 0) - (b.rating ?? 0) || a.ref.localeCompare(b.ref));
    const victim = fillers[0];
    if (!victim) continue;
    delete next.orgs[victim.ref];
    next.freeAgentIds.push(...victim.playerIds);
    const coach = lineup.coachId ? coachById.get(lineup.coachId) : undefined;
    const prestige = PRESTIGE_BY_STRENGTH[lineup.historicalStrength];
    const name = orgById.get(lineup.orgId)?.name ?? lineup.name;
    next.orgs[lineup.orgId] = {
      ref: lineup.orgId,
      name,
      region: lineup.region,
      prestige,
      // The filler roster keeps the seat warm; the preseason anchor pass
      // brings the real lineup in (fidelity-gated, like every anchor).
      playerIds: [...victim.playerIds] as [string, string, string],
      coachOverall: coach?.overall,
      stars: prestige,
      rating: victim.rating,
    };
    // The seat's players are now free agents of the real org, not the filler.
    next.freeAgentIds = next.freeAgentIds.filter((id) => !victim.playerIds.includes(id));
    next.version += 1;
    entered.push({ ref: lineup.orgId, name, region: lineup.region });
  }
  return { world: next, entered };
}

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
