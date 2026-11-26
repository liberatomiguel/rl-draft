/**
 * v2.2 Pro (PRO-SPEC §6, R150): the one decision per game. A game's key moments
 * (boxScore.ts) become a choice of two to four calls for the Pro, some behind a
 * signature mechanic. Each call has a chance that comes from its linked
 * attribute, his confidence and his energy; the screen shows a hint word, never
 * the number. Resolving returns a BOUNDED effect:
 *
 *   per game  ±bounds.teamPerGame on the team's rating
 *   per series ±bounds.teamPerSeries over all the decisions (the ledger)
 *   the Pro's own game rating ±bounds.ratingPerGame
 *
 * "On instinct" lets the style choose and pays with zero expected value: the
 * player who skips the decision neither gains nor loses on average, so deciding
 * well is the only way to gain and deciding badly is the only way to lose.
 *
 * Pure and deterministic: the roll is a stream of the career seed.
 */

import { CAREER_PRO_MOMENTS as M } from "@/config/balance";
import { createRng } from "@/lib/rng";
import { clamp } from "@/lib/util";
import type { StatKey } from "../../types";
import type { GameBoxScore, KeyMoment, MomentType } from "../boxScore";
import { deriveSeed } from "../seeds";
import { ratingBonusOf } from "./form";
import { MECHANIC_IDS } from "./mechanics";
import type { ProPlayer } from "./types";

export type CallKind = "safe" | "bold" | "mechanic";
export type ProHint = "risky" | "uncertain" | "likely" | "mastered";

export interface ProDecisionOption {
  /** A copy key (proMoments.options). */
  id: string;
  kind: CallKind;
  /** The attribute that decides it. */
  attr: StatKey;
  /** The mechanic it needs (a mechanic call); locked until he has it. */
  requires?: string;
  locked: boolean;
  /** Null while locked. */
  hint: ProHint | null;
}

export interface ProDecision {
  gameIndex: number;
  momentType: MomentType;
  /** The moment the call comes from (for the line the screen shows). */
  moment: Pick<KeyMoment, "type" | "gameIndex" | "side" | "period" | "clock" | "n" | "variant">;
  options: ProDecisionOption[];
}

/** The series' running total of decision effects on the team (the ±1.0 ledger). */
export interface DecisionLedger {
  team: number;
}

export const EMPTY_LEDGER: DecisionLedger = { team: 0 };

interface CallDef {
  id: string;
  attr: StatKey;
}

/** The two base calls of each kind of moment: a safe one and a bold one. */
const BASE_CALLS: Record<MomentType, { safe: CallDef; bold: CallDef }> = {
  decider: { safe: { id: "holdForSupport", attr: "experience" }, bold: { id: "takeTheShot", attr: "clutch" } },
  overtimeWinner: { safe: { id: "holdForSupport", attr: "experience" }, bold: { id: "takeTheShot", attr: "clutch" } },
  lateGoal: { safe: { id: "holdForSupport", attr: "experience" }, bold: { id: "takeTheShot", attr: "clutch" } },
  comeback: { safe: { id: "holdForSupport", attr: "experience" }, bold: { id: "takeTheShot", attr: "clutch" } },
  cleanSheet: { safe: { id: "stayBack", attr: "defense" }, bold: { id: "challengeEarly", attr: "clutch" } },
  saveMarathon: { safe: { id: "stayBack", attr: "defense" }, bold: { id: "challengeEarly", attr: "clutch" } },
  hatTrick: { safe: { id: "resetPlay", attr: "consistency" }, bold: { id: "keepPushing", attr: "offense" } },
  demoBlitz: { safe: { id: "resetPlay", attr: "consistency" }, bold: { id: "keepPushing", attr: "offense" } },
};

/** The ids of every call a decision can offer (the copy has one line for each). */
export const CALL_IDS: readonly string[] = [
  ...new Set(Object.values(BASE_CALLS).flatMap((c) => [c.safe.id, c.bold.id])),
  ...MECHANIC_IDS,
];

/** The chance a call comes off, from the player as he is now. Not shown to the player: the hint word is. */
export function chanceOf(player: ProPlayer, option: Pick<ProDecisionOption, "kind" | "attr" | "requires">): number {
  const C = M.chance;
  const spec = M.options[option.kind];
  const tier = option.requires ? Math.max(0, MECHANIC_IDS.indexOf(option.requires)) : 0;
  const base = spec.base + (option.kind === "mechanic" ? tier * M.options.mechanic.perTier : 0);
  const tired = Math.max(0, C.tiredBelow - player.energy) * C.perTiredPoint;
  return clamp(base + (player.attrs[option.attr] - C.attrCenter) * C.perAttr + player.confidence * C.perConfidence - tired, C.floor, C.ceil);
}

export function hintOf(chance: number): ProHint {
  if (chance < M.hints.risky) return "risky";
  if (chance < M.hints.uncertain) return "uncertain";
  if (chance < M.hints.likely) return "likely";
  return "mastered";
}

/** The moment a decision is built from: his own first, then his side's, then the first of the game. */
function pickMoment(game: GameBoxScore, side: "a" | "b", proIdx: number): KeyMoment | null {
  const own = game.moments.find((m) => m.side === side && m.playerIdx === proIdx);
  return own ?? game.moments.find((m) => m.side === side) ?? game.moments[0] ?? null;
}

function mechanicOption(id: string, owned: boolean, player: ProPlayer): ProDecisionOption {
  const o: ProDecisionOption = { id, kind: "mechanic", attr: "mechanics", requires: id, locked: !owned, hint: null };
  return owned ? { ...o, hint: hintOf(chanceOf(player, o)) } : o;
}

/**
 * The decision of one game: two base calls (a safe one, a bold one), plus the
 * best mechanic he owns and the next one he does not (locked, a goal on the
 * screen). Three or four options, never fewer than two playable. Null when the
 * game has no key moment.
 */
export function buildDecision(
  game: GameBoxScore,
  ctx: { side: "a" | "b"; proIdx: number; player: ProPlayer },
): ProDecision | null {
  const moment = pickMoment(game, ctx.side, ctx.proIdx);
  if (!moment) return null;
  const base = BASE_CALLS[moment.type];
  const mk = (call: CallDef, kind: CallKind): ProDecisionOption => {
    const o = { id: call.id, kind, attr: call.attr, locked: false } as ProDecisionOption;
    return { ...o, hint: hintOf(chanceOf(ctx.player, o)) };
  };
  const options: ProDecisionOption[] = [mk(base.safe, "safe"), mk(base.bold, "bold")];
  const owned = MECHANIC_IDS.filter((id) => ctx.player.mechanics.includes(id));
  const best = owned[owned.length - 1];
  const next = MECHANIC_IDS.find((id) => !owned.includes(id));
  if (best) options.push(mechanicOption(best, true, ctx.player));
  if (next) options.push(mechanicOption(next, false, ctx.player));
  return {
    gameIndex: game.index,
    momentType: moment.type,
    moment: { type: moment.type, gameIndex: moment.gameIndex, side: moment.side, period: moment.period, clock: moment.clock, n: moment.n, variant: moment.variant },
    options,
  };
}

export interface DecisionResult {
  optionId: string;
  success: boolean;
  /** True when the style chose (the player skipped the decision, or picked a locked call). */
  instinct: boolean;
  /** The change to the team's rating in this game, inside ±teamPerGame and the series ledger. */
  teamDelta: number;
  /** The change to the Pro's own rating, inside ±ratingPerGame. */
  ratingDelta: number;
  ledger: DecisionLedger;
}

export interface ResolveCtx {
  careerSeed: number;
  /** The series' stream key (e.g. the event stream + round key): with the game index it pins the roll. */
  streamKey: string;
  ledger?: DecisionLedger;
}

/** The option instinct picks: his style's preferred kind among the playable calls; "allround" draws one. */
export function instinctOption(decision: ProDecision, player: ProPlayer, roll: number): ProDecisionOption {
  const playable = decision.options.filter((o) => !o.locked);
  const want = M.instinct[player.archetype] ?? "any";
  const preferred = want === "any" ? null : playable.filter((o) => o.kind === want).pop();
  if (preferred) return preferred;
  if (want === "mechanic") return playable.filter((o) => o.kind === "bold").pop() ?? playable[0];
  return playable[Math.min(playable.length - 1, Math.floor(roll * playable.length))];
}

const r2 = (x: number) => Math.round(x * 100) / 100;

/**
 * Resolve a decision. `choice` is an option id, or "instinct". A choice that is
 * not on the screen or is locked falls back to instinct (never a dead button).
 */
export function resolveDecision(decision: ProDecision, choice: string | "instinct", player: ProPlayer, ctx: ResolveCtx): DecisionResult {
  const rng = createRng(deriveSeed(ctx.careerSeed, `pro:moment:${ctx.streamKey}:${decision.gameIndex}`));
  const pickRoll = rng.next();
  const hitRoll = rng.next();
  const ledger = ctx.ledger ?? EMPTY_LEDGER;
  const picked = choice === "instinct" ? undefined : decision.options.find((o) => o.id === choice && !o.locked);
  const instinct = !picked;
  const option = picked ?? instinctOption(decision, player, pickRoll);
  const p = chanceOf(player, option);
  const success = hitRoll < p;
  const spec = M.options[option.kind];

  let team: number;
  let rating: number;
  if (instinct) {
    // Zero expected value: a hit pays x, a miss costs x·p/(1−p), with x held down so the miss stays inside the bounds.
    const scale = (cap: number, up: number) => {
      const x = Math.min(up, (cap * (1 - p)) / p);
      return success ? x : -(x * p) / (1 - p);
    };
    team = scale(M.bounds.teamPerGame, spec.up.team);
    rating = scale(M.bounds.ratingPerGame, spec.up.rating);
  } else {
    team = success ? spec.up.team : -spec.down.team;
    rating = success ? spec.up.rating : -spec.down.rating;
  }
  team = clamp(team, -M.bounds.teamPerGame, M.bounds.teamPerGame);
  rating = clamp(rating, -M.bounds.ratingPerGame, M.bounds.ratingPerGame);
  // The series ledger: all decisions together stay inside ±teamPerSeries.
  const total = clamp(ledger.team + team, -M.bounds.teamPerSeries, M.bounds.teamPerSeries);
  const teamDelta = total - ledger.team;
  return { optionId: option.id, success, instinct, teamDelta: r2(teamDelta), ratingDelta: r2(rating), ledger: { team: r2(total) } };
}

/**
 * The Pro's rating of a game: the box score's, plus the decision, plus what his
 * form adds, with the whole change held inside ±ratingPerGame, and 0-10.
 */
export function finalProRating(boxRating: number, ratingDelta: number, confidence: number): number {
  const change = clamp(ratingDelta + ratingBonusOf(confidence), -M.bounds.ratingPerGame, M.bounds.ratingPerGame);
  return Math.round(clamp(boxRating + change, 0, 10) * 10) / 10;
}
