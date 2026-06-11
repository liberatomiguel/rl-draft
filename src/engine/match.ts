/**
 * Match simulation (base doc §25).
 *
 * Each game: effective score = team rating + bounded random roll + small
 * situational modifiers (clutch in deciding games, experience in playoffs,
 * consistency dampening bad rolls, mechanics high-roll procs, special card
 * effects). Higher effective score wins the game; first to the series target
 * wins the series. Overall remains the dominant factor — see tests.
 */

import { DIFFICULTY, SIMULATION as SIM } from "@/config/balance";
import { specialCardById } from "@/data";
import type { Rng } from "@/lib/rng";
import { clamp } from "@/lib/util";
import type {
  Difficulty,
  GameResult,
  SeriesResult,
  SpecialEffectType,
  TournamentTeam,
} from "./types";

export interface SeriesOptions {
  bestOf: number;
  stage: "swiss" | "playoff";
  difficulty: Difficulty;
}

type EffectTotals = Partial<Record<SpecialEffectType, number>>;

function effectTotals(team: TournamentTeam): EffectTotals {
  const totals: EffectTotals = {};
  for (const id of team.specialIds) {
    const special = specialCardById.get(id);
    if (!special) continue;
    totals[special.effect.type] =
      (totals[special.effect.type] ?? 0) + special.effect.value;
  }
  return totals;
}

function norm(stat: number): number {
  return clamp((stat - SIM.statBaseline) / SIM.statDivisor, -1.2, 1.2);
}

/** Consistency (and defensive-stability specials) soften negative variance. */
function dampenIfNegative(
  value: number,
  team: TournamentTeam,
  effects: EffectTotals,
): number {
  if (value >= 0) return value;
  const dampen =
    SIM.consistencyDampen * Math.max(0, norm(team.stats.consistency)) +
    SIM.defenseStabilityDampenPerPoint * (effects.defense_stability ?? 0);
  return value * Math.max(0, 1 - dampen);
}

interface GameSideResult {
  score: number;
  notes: string[];
}

function gameSide(
  team: TournamentTeam,
  opponent: TournamentTeam,
  effects: EffectTotals,
  seriesForm: number,
  ctx: { deciding: boolean; stage: "swiss" | "playoff"; difficulty: Difficulty },
  rng: Rng,
): GameSideResult {
  const notes: string[] = [];
  const profile = DIFFICULTY[ctx.difficulty];
  const [rollMin, rollMax] = team.isUser ? profile.userRollRange : profile.aiRollRange;

  const roll = dampenIfNegative(rng.roll(rollMin, rollMax), team, effects);

  let score = team.rating.total + seriesForm + roll;

  // Mechanics high-roll proc.
  const procChance = SIM.mechProcBaseChance * (0.5 + Math.max(0, norm(team.stats.mechanics)));
  if (rng.chance(procChance)) {
    score += SIM.mechProcBonus + (effects.high_roll ?? 0);
    notes.push("high_roll");
  }

  if (ctx.deciding) {
    score += SIM.clutchWeight * norm(team.stats.clutch);
    if (effects.clutch_boost) {
      score += effects.clutch_boost;
      notes.push("special_clutch");
    }
  }

  if (ctx.stage === "playoff") {
    score += SIM.experienceWeight * norm(team.stats.experience);
    if (effects.playoff_experience) score += effects.playoff_experience * 0.4;
  } else if (effects.swiss_consistency) {
    score += effects.swiss_consistency * 0.4;
  }

  if (
    effects.upset_boost &&
    team.rating.total < opponent.rating.total - SIM.upsetActivationGap
  ) {
    score += effects.upset_boost;
    notes.push("upset_factor");
  }

  return { score, notes };
}

function flavorGoals(margin: number, overtime: boolean, rng: Rng): [number, number] {
  const winnerGoals = clamp(Math.round(1 + margin * 0.6 + rng.range(0, 2.4)), 1, 7);
  if (overtime) return [winnerGoals, winnerGoals - 1];
  const loserGoals = clamp(
    winnerGoals - 1 - Math.round(margin * 0.5 + rng.range(0, 1.5)),
    0,
    winnerGoals - 1,
  );
  return [winnerGoals, loserGoals];
}

export function simulateSeries(
  teamA: TournamentTeam,
  teamB: TournamentTeam,
  options: SeriesOptions,
  rng: Rng,
): SeriesResult {
  const target = Math.ceil(options.bestOf / 2);
  const effectsA = effectTotals(teamA);
  const effectsB = effectTotals(teamB);

  // Series form: one roll per team per series — the main upset source.
  const formA = dampenIfNegative(
    rng.roll(-SIM.seriesFormRange, SIM.seriesFormRange),
    teamA,
    effectsA,
  );
  const formB = dampenIfNegative(
    rng.roll(-SIM.seriesFormRange, SIM.seriesFormRange),
    teamB,
    effectsB,
  );

  const games: GameResult[] = [];
  let winsA = 0;
  let winsB = 0;

  while (winsA < target && winsB < target) {
    const deciding = winsA === target - 1 && winsB === target - 1;
    const ctx = { deciding, stage: options.stage, difficulty: options.difficulty };

    const a = gameSide(teamA, teamB, effectsA, formA, ctx, rng);
    const b = gameSide(teamB, teamA, effectsB, formB, ctx, rng);

    let overtime = false;
    let aWins: boolean;
    const gap = a.score - b.score;
    if (Math.abs(gap) < SIM.overtimeThreshold) {
      overtime = true;
      const otA =
        a.score + SIM.overtimeClutchWeight * norm(teamA.stats.clutch) + rng.roll(-1, 1);
      const otB =
        b.score + SIM.overtimeClutchWeight * norm(teamB.stats.clutch) + rng.roll(-1, 1);
      aWins = otA >= otB;
    } else {
      aWins = gap > 0;
    }

    if (aWins) winsA += 1;
    else winsB += 1;

    const margin = Math.abs(gap);
    const notes = [...(aWins ? a.notes : b.notes)];
    if (overtime) notes.unshift("overtime");
    if (deciding) notes.unshift("deciding");

    games.push({
      index: games.length + 1,
      winnerTeamId: aWins ? teamA.id : teamB.id,
      score: flavorGoals(margin, overtime, rng),
      overtime,
      deciding,
      notes,
    });
  }

  const winnerTeamId = winsA > winsB ? teamA.id : teamB.id;
  const winnerRating = winnerTeamId === teamA.id ? teamA.rating.total : teamB.rating.total;
  const loserRating = winnerTeamId === teamA.id ? teamB.rating.total : teamA.rating.total;

  return {
    teamAId: teamA.id,
    teamBId: teamB.id,
    games,
    score: [winsA, winsB],
    winnerTeamId,
    ratingDiff: Math.round((teamA.rating.total - teamB.rating.total) * 10) / 10,
    upset: winnerRating < loserRating - 3,
  };
}
