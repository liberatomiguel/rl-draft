/**
 * Match simulation (base doc §25).
 *
 * Each game: effective score = team rating + bounded random roll + small
 * situational modifiers (clutch in deciding games, experience in playoffs,
 * consistency dampening bad rolls, mechanics high-roll procs, special card
 * effects). Higher effective score wins the game; first to the series target
 * wins the series. Overall remains the dominant factor — see tests.
 */

import { CAREER_MATCHDAY, DIFFICULTY, SIMULATION as SIM } from "@/config/balance";
import { specialCardById } from "@/data";
import { createRng, type Rng } from "@/lib/rng";
import { clamp } from "@/lib/util";
import {
  aiQualityOf,
  coachBreakOn,
  coachPlanFor,
  initMatchday,
  kickoffFactor,
  momentumTerm,
  planShift,
  playmakerMarked,
  updateMomentum,
  withPlayed,
  type MatchdaySeriesState,
} from "./career/matchday";
import { styleMatchupBonus } from "./career/styles";
import { traitBounce, traitGameEffects } from "./career/traits";
import type {
  Difficulty,
  GameResult,
  SeriesPlan,
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
  /** v2.1 Matchday: extra score in the overtime roll (decisive trait). */
  overtimeBonus: number;
}

/** v2.1 Matchday slice 3: one side's plan and momentum for this game (career `matchday` series only). */
interface MatchdaySide {
  /** Plan shift (off-style cost, wrong mark), already within ±planCap. */
  planShift: number;
  /** Both kickoffs multiplied. */
  kickoff: number;
  /** This side's playmaker is marked by the opponent. */
  marked: boolean;
  /** Momentum term, already within ±momentumCap. */
  momentum: number;
}

function gameSide(
  team: TournamentTeam,
  opponent: TournamentTeam,
  effects: EffectTotals,
  seriesForm: number,
  ctx: { deciding: boolean; stage: "swiss" | "playoff"; difficulty: Difficulty; gameIndex: number },
  rng: Rng,
  md: MatchdaySide | null = null,
): GameSideResult {
  const notes: string[] = [];
  const profile = DIFFICULTY[ctx.difficulty];
  // Road to Worlds (rc.32, BAL-02) carries its own roll range on the team;
  // every Draft team reads its difficulty profile, as always.
  const [rollMin, rollMax] = team.rollRange ?? (team.isUser ? profile.userRollRange : profile.aiRollRange);

  // v2.1 Matchday: only a side carrying style / traits reads them (career,
  // FEATURES.matchdayStyles); every other side takes the old path untouched.
  const matchday = team.style !== undefined || team.traits !== undefined;
  const traitFx = matchday ? traitGameEffects(team, ctx) : null;
  let rawRoll = rng.roll(rollMin, rollMax);
  let rollScale = traitFx ? traitFx.rollScale : 1;
  if (md) rollScale = clamp(rollScale * md.kickoff, CAREER_MATCHDAY.kickoffScaleRange[0], CAREER_MATCHDAY.kickoffScaleRange[1]);
  if (rollScale !== 1) {
    const centre = (rollMin + rollMax) / 2;
    rawRoll = centre + (rawRoll - centre) * rollScale;
  }
  const roll = dampenIfNegative(rawRoll, team, effects);

  let score = team.rating.total + seriesForm + roll;
  if (traitFx || md) {
    // §7: matchup + traits + plan + the Sunday briefing, together within ±combinedCap.
    const cap = CAREER_MATCHDAY.combinedCap;
    const plan = md ? md.planShift + (team.briefingEdge ?? 0) : 0;
    score += clamp(styleMatchupBonus(team, opponent) + (traitFx ? traitFx.shift : 0) + plan, -cap, cap);
  }
  if (md) score += md.momentum;

  // v2.0: offense/defense weigh on every game (they used to be cosmetic).
  score += SIM.offenseWeight * norm(team.stats.offense) + SIM.defenseWeight * norm(team.stats.defense);

  // Mechanics high-roll proc.
  const procChance = SIM.mechProcBaseChance * (0.5 + Math.max(0, norm(team.stats.mechanics)));
  // Slice 3: a marked playmaker makes fewer special plays (the same single draw).
  if (rng.chance(md?.marked ? procChance * (1 - CAREER_MATCHDAY.markProcCut) : procChance)) {
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

  return { score, notes, overtimeBonus: traitFx ? traitFx.overtime : 0 };
}

/** Split `total` goals among `n` players. Deterministic and WITHOUT consuming the
 *  series RNG (a local RNG seeded off the cursor + game index) — so the seeded
 *  draw sequence and every existing seed stay byte-identical. */
function distributeGoals(n: number, total: number, seed: number): number[] {
  const out = new Array(n).fill(0) as number[];
  if (n <= 0 || total <= 0) return out;
  const r = createRng(seed >>> 0);
  for (let i = 0; i < total; i += 1) out[r.int(0, n - 1)] += 1;
  return out;
}

/** Narrative scoreline for one game (v2.0 re-tune, SIMULATION.goals). Same two
 *  RNG draws as before, so the seeded draw sequence is unchanged. */
function flavorGoals(margin: number, overtime: boolean, rng: Rng, career: boolean): [number, number] {
  if (career) return careerFlavorGoals(margin, overtime, rng);
  const g = SIM.goals;
  const winnerGoals = clamp(
    Math.round(g.winnerBase + margin * g.winnerPerMargin + rng.range(0, g.winnerSpread)),
    1,
    g.max,
  );
  if (overtime) return [winnerGoals, winnerGoals - 1];
  const loserGoals = clamp(
    winnerGoals - 1 - Math.round(margin * g.loserPerMargin + rng.range(0, g.loserSpread)),
    0,
    winnerGoals - 1,
  );
  return [winnerGoals, loserGoals];
}

/** v2.0.34: the career's scoreline (SIMULATION.goals.career) — the margin levels off; the same draws as `flavorGoals`. */
function careerFlavorGoals(margin: number, overtime: boolean, rng: Rng): [number, number] {
  const g = SIM.goals.career;
  const level = 1 - Math.exp(-margin / g.marginScale);
  const winnerGoals = clamp(Math.round(g.winnerBase + g.winnerCap * level + rng.range(0, g.winnerSpread)), 1, g.max);
  if (overtime) return [winnerGoals, winnerGoals - 1];
  const loserGoals = clamp(
    winnerGoals - 1 - Math.round(g.loserCap * level + rng.range(0, g.loserSpread)),
    0,
    winnerGoals - 1,
  );
  return [winnerGoals, loserGoals];
}

/**
 * A series in progress (Matchday slice 1, docs/MATCHDAY-SPEC.md §3 B).
 *
 * Plain JSON on purpose: the career will persist it between games (slice 3).
 * It holds no team objects, only their ids; every step takes the two teams
 * again, in the same order as `startSeries`. Everything here is exactly what
 * the old one-shot loop kept in locals, so a series driven step by step
 * consumes the RNG byte for byte as `simulateSeries` always has.
 */
export interface SeriesState {
  teamAId: string;
  teamBId: string;
  options: SeriesOptions;
  /** Games needed to win (ceil(bestOf / 2)). */
  target: number;
  /** Series form, one roll per team per series — the main upset source. */
  formA: number;
  formB: number;
  winsA: number;
  winsB: number;
  /** Momentum (v2.0): the loser of the previous game bounces back a little. */
  lastWinner: "a" | "b" | null;
  maxDeficitA: number;
  maxDeficitB: number;
  games: GameResult[];
  /**
   * v2.1 Matchday slice 3: the plan / momentum layer. Present only when a side
   * carries `matchday` (FEATURES.matchdayDecisions) or plans were given;
   * absent → the fixed bounce, as always.
   */
  matchday?: MatchdaySeriesState;
}

function assertTeams(state: SeriesState, teamA: TournamentTeam, teamB: TournamentTeam): void {
  if (teamA.id !== state.teamAId || teamB.id !== state.teamBId) {
    throw new Error(
      `series teams mismatch: state ${state.teamAId}/${state.teamBId}, got ${teamA.id}/${teamB.id}`,
    );
  }
}

/** Opens a series: draws both series-form rolls (the first two RNG draws). */
export function startSeries(
  teamA: TournamentTeam,
  teamB: TournamentTeam,
  options: SeriesOptions,
  rng: Rng,
  /** Slice 3: the sides' plans and the series seed (the user's series); defaults otherwise. */
  matchday?: { planA?: SeriesPlan; planB?: SeriesPlan; seed?: number },
): SeriesState {
  const startCursor = rng.state;
  const formA = dampenIfNegative(
    rng.roll(-SIM.seriesFormRange, SIM.seriesFormRange),
    teamA,
    effectTotals(teamA),
  );
  const formB = dampenIfNegative(
    rng.roll(-SIM.seriesFormRange, SIM.seriesFormRange),
    teamB,
    effectTotals(teamB),
  );
  return {
    teamAId: teamA.id,
    teamBId: teamB.id,
    options: { ...options },
    target: Math.ceil(options.bestOf / 2),
    formA,
    formB,
    winsA: 0,
    winsB: 0,
    lastWinner: null,
    maxDeficitA: 0,
    maxDeficitB: 0,
    games: [],
    ...(matchday || teamA.matchday || teamB.matchday
      ? { matchday: openMatchday(teamA, teamB, matchday, startCursor) }
      : {}),
  };
}

/**
 * The matchday layer at the start of a series. A side with no plan given
 * plans with its coach (R139 rev.: the AI plans exactly like the user's
 * "leave it to the coach"); a world series hashes its decisions from the
 * series' starting RNG cursor, so nothing extra is drawn.
 */
function openMatchday(
  teamA: TournamentTeam,
  teamB: TournamentTeam,
  given: { planA?: SeriesPlan; planB?: SeriesPlan; seed?: number } | undefined,
  startCursor: number,
): MatchdaySeriesState {
  const seed = given?.seed ?? startCursor;
  const autoPlan = (me: TournamentTeam, opp: TournamentTeam, key: string) =>
    me.matchday ? coachPlanFor(me, opp, aiQualityOf(me), seed, key) : undefined;
  return initMatchday(given?.planA ?? autoPlan(teamA, teamB, "a"), given?.planB ?? autoPlan(teamB, teamA, "b"), seed);
}

/** Between two games of a series nobody steers: each marked side's coach makes its calls. */
function coachBreaks(state: SeriesState, teamA: TournamentTeam, teamB: TournamentTeam): SeriesState {
  const md = state.matchday;
  if (!md || state.games.length === 0) return state;
  const ctx = (side: "a" | "b") => ({ gamesPlayed: state.games.length, lostLast: state.lastWinner !== null && state.lastWinner !== side });
  let next = md;
  if (teamA.matchday) next = coachBreakOn(next, "a", teamA, teamB, aiQualityOf(teamA), ctx("a"));
  if (teamB.matchday) next = coachBreakOn(next, "b", teamB, teamA, aiQualityOf(teamB), ctx("b"));
  return next === md ? state : { ...state, matchday: next };
}

/** True once one side has reached the target. */
export function isSeriesOver(state: SeriesState): boolean {
  return state.winsA >= state.target || state.winsB >= state.target;
}

/**
 * Plays the next game and returns the NEW state (the given one is untouched).
 * Throws if the series is already over or the teams are not the state's.
 */
export function playNextGame(
  state: SeriesState,
  teamA: TournamentTeam,
  teamB: TournamentTeam,
  rng: Rng,
): SeriesState {
  assertTeams(state, teamA, teamB);
  if (isSeriesOver(state)) throw new Error("series is already over");

  const { target, winsA: prevA, winsB: prevB, options } = state;
  const effectsA = effectTotals(teamA);
  const effectsB = effectTotals(teamB);
  const careerScoreline = teamA.careerScoreline === true || teamB.careerScoreline === true;

  const deciding = prevA === target - 1 && prevB === target - 1;
  const ctx = { deciding, stage: options.stage, difficulty: options.difficulty, gameIndex: state.games.length + 1 };

  const md = state.matchday;
  let a: GameSideResult;
  let b: GameSideResult;
  if (md) {
    // Slice 3: each side plays its plan's style; momentum replaces the bounce.
    const pa = withPlayed(teamA, md.planA.style);
    const pb = withPlayed(teamB, md.planB.style);
    const kickoff = kickoffFactor(md.planA, md.planB);
    a = gameSide(pa, pb, effectsA, state.formA, ctx, rng, {
      planShift: planShift(pa, pb, md.planA),
      kickoff,
      marked: playmakerMarked(pa, md.planB),
      momentum: momentumTerm(md.momentumA),
    });
    b = gameSide(pb, pa, effectsB, state.formB, ctx, rng, {
      planShift: planShift(pb, pa, md.planB),
      kickoff,
      marked: playmakerMarked(pb, md.planA),
      momentum: momentumTerm(md.momentumB),
    });
  } else {
    a = gameSide(teamA, teamB, effectsA, state.formA, ctx, rng);
    b = gameSide(teamB, teamA, effectsB, state.formB, ctx, rng);
  }
  if (state.lastWinner !== null && !md) {
    // v2.1 Matchday: behaviour traits bend the bounce (traitBounce returns the
    // base untouched when neither side carries traits).
    const loserIsA = state.lastWinner === "b";
    const prev = state.games[state.games.length - 1];
    const bounce = traitBounce(
      SIM.momentumBounce,
      loserIsA ? teamA : teamB,
      loserIsA ? teamB : teamA,
      prev?.overtime === true,
    );
    if (loserIsA) a.score += bounce;
    else b.score += bounce;
  }

  let overtime = false;
  let aWins: boolean;
  const gap = a.score - b.score;
  if (Math.abs(gap) < SIM.overtimeThreshold) {
    overtime = true;
    const otA = a.score + SIM.overtimeClutchWeight * norm(teamA.stats.clutch) + rng.roll(-1, 1) + a.overtimeBonus;
    const otB = b.score + SIM.overtimeClutchWeight * norm(teamB.stats.clutch) + rng.roll(-1, 1) + b.overtimeBonus;
    aWins = otA >= otB;
  } else {
    aWins = gap > 0;
  }

  const winsA = prevA + (aWins ? 1 : 0);
  const winsB = prevB + (aWins ? 0 : 1);

  const margin = Math.abs(gap);
  const notes = [...(aWins ? a.notes : b.notes)];
  if (overtime) notes.unshift("overtime");
  if (deciding) notes.unshift("deciding");

  // Star of the game: a player from the winning side (narration flavor).
  const winnerTeam = aWins ? teamA : teamB;
  const starName =
    winnerTeam.playerNames.length > 0 ? rng.pick(winnerTeam.playerNames) : undefined;

  const score = flavorGoals(margin, overtime, rng, careerScoreline);
  // Per-player goals — deterministic from the cursor + game index, no RNG draw.
  const gi = state.games.length + 1;
  const seed = (rng.state ^ (gi * 0x9e3779b1)) >>> 0;
  const aGoals = distributeGoals(teamA.playerNames.length, aWins ? score[0] : score[1], seed);
  const bGoals = distributeGoals(teamB.playerNames.length, aWins ? score[1] : score[0], (seed ^ 0x85ebca6b) >>> 0);

  const game: GameResult = {
    index: gi,
    winnerTeamId: aWins ? teamA.id : teamB.id,
    score,
    overtime,
    deciding,
    notes,
    starName,
    scorers: { a: aGoals, b: bGoals },
  };

  const nextMatchday = md
    ? updateMomentum(
        md,
        { winner: aWins ? "a" : "b", overtime, goalDiff: score[0] - score[1], comeback: aWins ? prevA < prevB : prevB < prevA },
        teamA,
        teamB,
      )
    : undefined;

  return {
    ...state,
    ...(nextMatchday ? { matchday: nextMatchday } : {}),
    winsA,
    winsB,
    lastWinner: aWins ? "a" : "b",
    maxDeficitA: Math.max(state.maxDeficitA, winsB - winsA),
    maxDeficitB: Math.max(state.maxDeficitB, winsA - winsB),
    games: [...state.games, game],
  };
}

/** Closes a finished series into its result. Draws nothing from the RNG. */
export function finishSeries(
  state: SeriesState,
  teamA: TournamentTeam,
  teamB: TournamentTeam,
): SeriesResult {
  assertTeams(state, teamA, teamB);
  if (!isSeriesOver(state)) throw new Error("series is not over yet");

  const { winsA, winsB } = state;
  const winnerTeamId = winsA > winsB ? teamA.id : teamB.id;
  const winnerRating = winnerTeamId === teamA.id ? teamA.rating.total : teamB.rating.total;
  const loserRating = winnerTeamId === teamA.id ? teamB.rating.total : teamA.rating.total;
  const comeback =
    (winnerTeamId === teamA.id ? state.maxDeficitA : state.maxDeficitB) >= SIM.comebackDeficit;

  const games = state.games.slice();
  if (comeback) {
    const last = games[games.length - 1];
    games[games.length - 1] = { ...last, notes: ["comeback", ...last.notes] };
  }

  return {
    teamAId: teamA.id,
    teamBId: teamB.id,
    games,
    score: [winsA, winsB],
    winnerTeamId,
    ratingDiff: Math.round((teamA.rating.total - teamB.rating.total) * 10) / 10,
    upset: winnerRating < loserRating - 3,
    ...(comeback ? { comeback: true } : {}),
  };
}

/**
 * v2.1 Matchday slice 3: resolves the USER's series of a round off the round
 * RNG (its own seed, its own pace). The rounds call it instead of
 * `simulateSeries` for the pair holding the user; absent → as always.
 */
export type UserSeriesResolver = (
  teamA: TournamentTeam,
  teamB: TournamentTeam,
  options: SeriesOptions,
) => SeriesResult;

/** The whole series at once — a loop over the three steps above. */
export function simulateSeries(
  teamA: TournamentTeam,
  teamB: TournamentTeam,
  options: SeriesOptions,
  rng: Rng,
): SeriesResult {
  let state = startSeries(teamA, teamB, options, rng);
  while (!isSeriesOver(state)) {
    // v2.1 Matchday slice 3: the coaches' breaks (no matchday layer → the same state, nothing drawn).
    if (state.matchday) state = coachBreaks(state, teamA, teamB);
    state = playNextGame(state, teamA, teamB, rng);
  }
  return finishSeries(state, teamA, teamB);
}
