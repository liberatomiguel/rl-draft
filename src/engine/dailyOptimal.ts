/**
 * Daily: the best draft the day allowed, and where a draft sits among
 * simulated ones (v2.1, Daily optimal + percentile).
 *
 * READ-ONLY by construction. Everything here starts from `createDailyDraft`
 * (the same function the run store uses to open the day) on a COPY of the
 * day's RNG and walks the real draft actions (`applyPick`, `applyReroll`,
 * `applyFreeReroll`). Nothing is stored, nothing is fed back into a run, so
 * what a daily generates cannot change. The bots' own choices come from a
 * separate decision RNG that never touches the game's stream.
 *
 * The score is the team rating the game itself computes (`buildUserTeam` →
 * `rating.total`: player overall, coach, sub, org, chemistry, specials). On a
 * day whose objective caps the team overall (Underdog), a team over the cap
 * is ineligible and the best draft is the strongest one at or under it.
 */

import { DIFFICULTY } from "@/config/balance";
import {
  coachById,
  lineupById,
  playerById,
  playerCardById,
  specialCardById,
  specialCards,
  specialsByPlayerId,
  subById,
} from "@/data";
import { createRng, type Rng } from "@/lib/rng";
import { finalOverall } from "./cards";
import {
  applyFreeReroll,
  applyPick,
  applyReroll,
  createDraft,
  draftLineupPool,
  drawNextOffer,
  eventSpecialsFor,
  filledCount,
  neededKinds,
  slotsForKind,
} from "./draft";
import { computeTeamRating, displayTeamOverall } from "./rating";
import { buildUserTeam } from "./teams";
import type {
  BuffLevel,
  DailyInfo,
  Difficulty,
  DraftOffer,
  DraftOfferCard,
  DraftScriptStep,
  DraftState,
  Roster,
  RosterSlotId,
} from "./types";

/**
 * Analysis bounds, not gameplay values: they change nothing a Daily generates
 * or scores, so they live here and not in balance.ts (which would move
 * BALANCE_VERSION, like `SIGN_OUT_FLUSH_MS` in accountStore). The solver is
 * exact within `solverNodeBudget` (the reviewed year needs at most ~30k,
 * `dailyOptimal.test.ts` / the DAILY_OPT_PROBE); `maxDraws` stops a
 * pathological free-reroll chain; `referenceDrafts` is the size of the
 * simulated field the percentile is measured against.
 */
export const DAILY_INSIGHT = {
  solverNodeBudget: 400_000,
  maxDraws: 40,
  referenceDrafts: 200,
} as const;

/** The day's draft rules (a structural subset of `DailyConfig` in `@/lib/daily`). */
export interface DailyDraftRules {
  info: DailyInfo;
  difficulty: Difficulty;
  poolLineupIds?: string[];
  rerollsOverride?: number;
  specialChanceMult?: number;
  scriptedLineups?: DraftScriptStep[];
}

/**
 * The day's opening draft state. The run store opens the Daily with this, so
 * the solver and the bots below start from exactly the state a player sees.
 * Advances `rng` by the first draw, like `startDailyRun` always did.
 */
export function createDailyDraft(rules: DailyDraftRules, date: string, rng: Rng): DraftState {
  return drawNextOffer(
    createDraft(rules.difficulty, {
      mode: "daily",
      poolLineupIds: rules.poolLineupIds,
      rerollsOverride: rules.rerollsOverride,
      specialChanceMult: rules.specialChanceMult,
      scriptedLineups: rules.scriptedLineups,
      // The daily is shared, so only the WINDOW applies (no per-player hunt
      // boost) — everyone sees the same odds on the same day.
      eventSpecials: (() => {
        const ev = eventSpecialsFor(specialCards, date, undefined);
        return ev ? { active: ev.active, boosted: [] } : undefined;
      })(),
    }),
    rng,
  );
}

export type DailyDraftAction =
  | { kind: "pick"; refId: string; slot: RosterSlotId; specialId?: string }
  | { kind: "reroll" }
  | { kind: "freeReroll" };

export interface DraftScore {
  /** `rating.total` — the ordering value. */
  rating: number;
  /** Team overall as the game displays it. */
  overall: number;
  chemistry: number;
  /** False when the day's overall cap (Underdog) rules the team out. */
  eligible: boolean;
}

export interface DailyStart {
  rules: DailyDraftRules;
  date: string;
  seed: number;
}

/** The day's overall cap, when its objective has one. */
export function dailyOverallCap(info: DailyInfo): number | undefined {
  return info.objective?.type === "team_overall_under" ? info.objective.value : undefined;
}

export function scoreRoster(roster: Roster, rules: DailyDraftRules): DraftScore {
  const team = buildUserTeam(roster, rules.difficulty, { mode: "daily" });
  const overall = displayTeamOverall(team.rating);
  const cap = dailyOverallCap(rules.info);
  return {
    rating: team.rating.total,
    overall,
    chemistry: team.chemistry.percent,
    eligible: cap === undefined || overall <= cap,
  };
}

/** Total order on scores: eligible first, then rating. Positive = a beats b. */
export function compareScores(a: DraftScore, b: DraftScore): number {
  if (a.eligible !== b.eligible) return a.eligible ? 1 : -1;
  return a.rating - b.rating;
}

// ---------------------------------------------------------------------------
// The optimal draft (exact search)
// ---------------------------------------------------------------------------

export interface DailyOptimal {
  roster: Roster;
  actions: DailyDraftAction[];
  score: DraftScore;
  /** Draft states visited. */
  nodes: number;
  /** False only when the node budget ran out (never on the shipped calendar; tested). */
  exhaustive: boolean;
}

type Move = { action: DailyDraftAction; card?: DraftOfferCard; order: number };

function pickOverall(card: DraftOfferCard): number {
  if (card.kind !== "player") return 0;
  const sp = card.specialId ? specialCardById.get(card.specialId) : undefined;
  return sp ? sp.overall : finalOverall(playerCardById.get(card.refId)!);
}

function staffOverall(card: DraftOfferCard): number {
  const sp = card.specialId ? specialCardById.get(card.specialId) : undefined;
  if (sp) return sp.overall;
  if (card.kind === "coach") return coachById.get(card.refId)?.overall ?? 0;
  if (card.kind === "sub") return subById.get(card.refId)?.overall ?? 0;
  return 0;
}

/** Legal moves of an offer, the way the UI offers them. Player slots are
 * interchangeable (nothing reads which one), so a player goes to the first
 * open one. Strong cards first, so a good bound is found early. */
function movesOf(draft: DraftState): Move[] {
  const offer = draft.offer;
  if (!offer) return [];
  if (!offer.hasPickableCard) return [{ action: { kind: "freeReroll" }, order: 0 }];
  const moves: Move[] = [];
  for (const card of offer.cards) {
    if (card.availability !== "available") continue;
    const slot = (card.kind === "player"
      ? (["player1", "player2", "player3"] as RosterSlotId[])
      : ([card.kind] as RosterSlotId[])
    ).find((s) => !draft.roster[s]);
    if (!slot) continue;
    const order = card.kind === "player" ? pickOverall(card) : card.kind === "org" ? 50 : staffOverall(card) - 30;
    moves.push({
      action: { kind: "pick", refId: card.refId, slot, ...(card.specialId ? { specialId: card.specialId } : {}) },
      card,
      order,
    });
  }
  moves.sort((a, b) => b.order - a.order);
  if (draft.rerollsLeft > 0) moves.push({ action: { kind: "reroll" }, order: -Infinity });
  return moves;
}

/**
 * The draft actions with the offer stream memoised. Outside the staff-only
 * end of a draft, the next offer does not depend on which card was picked:
 * it follows from the RNG cursor and the lineups already shown, and only the
 * cards' availability reads the roster. So the solver and the bots draw each
 * offer once through the real `drawNextOffer` and re-derive availability for
 * every other branch that reaches the same draw. `dailyOptimal.test.ts`
 * replays every line found here through the real `applyPick` / `applyReroll`
 * / `applyFreeReroll` and requires the same roster and score.
 */
interface CachedDraw {
  round: number;
  shownLineupIds: string[];
  offer: DraftOffer;
  /** Person behind each offer card (null for orgs and vacant cards). */
  personIds: (string | null)[];
  rngAfter: number;
}

function personIdOf(card: DraftOfferCard): string | null {
  if (card.availability === "vacant") return null;
  if (card.kind === "player") return playerCardById.get(card.refId)?.playerId ?? null;
  if (card.kind === "coach") return coachById.get(card.refId)?.personId ?? null;
  if (card.kind === "sub") return subById.get(card.refId)?.personId ?? null;
  return null;
}

function slotOpen(roster: Roster, kind: DraftOfferCard["kind"]): boolean {
  return slotsForKind(kind).some((slot) => !roster[slot]);
}

export class DailyDraftStepper {
  private draws = new Map<string, CachedDraw>();
  readonly start: DailyStart;
  readonly root: DraftState;
  readonly rootRng: number;

  constructor(start: DailyStart) {
    this.start = start;
    const rng = createRng(start.seed);
    this.root = createDailyDraft(start.rules, start.date, rng);
    this.rootRng = rng.state;
  }

  /** `drawNextOffer(draft, createRng(rngState))`, memoised. */
  draw(draft: DraftState, rngState: number): { draft: DraftState; rngState: number } {
    const key = `${rngState}|${filledCount(draft.roster)}|${neededKinds(draft.roster, draft.mode).join(",")}|${draft.shownLineupIds.join(",")}`;
    let hit = this.draws.get(key);
    if (!hit) {
      const rng = createRng(rngState);
      const next = drawNextOffer(draft, rng);
      hit = {
        round: next.round - draft.round,
        shownLineupIds: next.shownLineupIds,
        offer: next.offer!,
        personIds: next.offer!.cards.map(personIdOf),
        rngAfter: rng.state,
      };
      this.draws.set(key, hit);
      return { draft: next, rngState: rng.state };
    }
    const cards = hit.offer.cards.map((card, i): DraftOfferCard => {
      if (card.availability === "vacant" || card.availability === "ineligible") return card;
      const person = hit!.personIds[i];
      const availability = person && draft.takenPersonIds.includes(person)
        ? "already_drafted"
        : slotOpen(draft.roster, card.kind) ? "available" : "slot_full";
      return availability === card.availability ? card : { ...card, availability };
    });
    return {
      draft: {
        ...draft,
        round: draft.round + hit.round,
        shownLineupIds: hit.shownLineupIds,
        offer: { lineupId: hit.offer.lineupId, cards, hasPickableCard: cards.some((c) => c.availability === "available") },
      },
      rngState: hit.rngAfter,
    };
  }

  /** `applyPick` (same state update), then the memoised draw. */
  pick(draft: DraftState, card: DraftOfferCard, slot: RosterSlotId, rngState: number): { draft: DraftState; rngState: number } {
    const person = personIdOf(card);
    const roster: Roster = {
      ...draft.roster,
      [slot]: { slot, kind: card.kind, refId: card.refId, specialId: card.specialId, fromLineupId: draft.offer!.lineupId },
    };
    const takenPersonIds = person ? [...draft.takenPersonIds, person] : draft.takenPersonIds;
    const complete = filledCount(roster) === (draft.mode === "quick" ? 3 : 6);
    const next: DraftState = { ...draft, roster, takenPersonIds, offer: null, complete };
    return complete ? { draft: next, rngState } : this.draw(next, rngState);
  }

  apply(draft: DraftState, move: Move, rngState: number): { draft: DraftState; rngState: number } {
    const a = move.action;
    if (a.kind === "freeReroll") return this.draw(draft, rngState);
    if (a.kind === "reroll") return this.draw({ ...draft, rerollsLeft: draft.rerollsLeft - 1 }, rngState);
    return this.pick(draft, move.card!, a.slot, rngState);
  }
}

/** Replays actions through the REAL draft functions (no memo). */
export function replayDailyDraft(start: DailyStart, actions: DailyDraftAction[]): DraftState {
  const rng = createRng(start.seed);
  let draft = createDailyDraft(start.rules, start.date, rng);
  for (const action of actions) {
    if (action.kind === "freeReroll") draft = applyFreeReroll(draft, rng);
    else if (action.kind === "reroll") {
      if (!draft.offer?.hasPickableCard) throw new Error("A dead offer takes a free reroll");
      draft = applyReroll(draft, rng);
    } else {
      const card = draft.offer?.cards.find((c) => c.refId === action.refId && c.specialId === action.specialId);
      if (!card) throw new Error(`Pick not offered: ${action.refId}`);
      draft = applyPick(draft, card, action.slot, rng);
    }
  }
  return draft;
}

/**
 * Highest player overall the day's pool can offer: base cards and, when
 * specials can appear, every special a player in the pool could show.
 */
function maxPlayerOverall(draft: DraftState): number {
  const mult = draft.specialChanceMult ?? 1;
  let max = 0;
  for (const lineup of draftLineupPool(draft)) {
    for (const id of lineup.playerCardIds) {
      const card = playerCardById.get(id);
      if (!card) continue;
      max = Math.max(max, finalOverall(card));
      if (mult > 0) for (const sp of specialsByPlayerId.get(card.playerId) ?? []) max = Math.max(max, sp.overall);
    }
  }
  for (const step of draft.scriptedLineups ?? []) {
    const sp = step.special ? specialCardById.get(step.special.specialId) : undefined;
    if (sp) max = Math.max(max, sp.overall);
  }
  return max;
}

/** An upper bound on `rating.total` for any completion of `draft`, from the
 * game's own rating formula: the picked cards as they are, the pool's best
 * player for each open player slot, every open staff / org slot at its cap
 * and chemistry at 100 %. Never below the truth. */
function ratingCeiling(draft: DraftState, maxPlayer: number, difficulty: Difficulty, maxOverallBonus: number): number {
  const r = draft.roster;
  const specialOf = (id?: string) => (id ? specialCardById.get(id) : undefined);
  let specials = 0;
  let bonus = 0;
  let open = 0;
  const playerOveralls = [r.player1, r.player2, r.player3].map((p) => {
    if (!p) {
      open++;
      return maxPlayer;
    }
    const sp = specialOf(p.specialId);
    if (sp) {
      specials++;
      bonus += sp.effect.overallBonus ?? 0;
    }
    return sp ? sp.overall : finalOverall(playerCardById.get(p.refId)!);
  });
  let coach: { overall: number; bonusLevel: BuffLevel } = { overall: 999, bonusLevel: "+++" };
  if (r.coach) {
    const card = coachById.get(r.coach.refId);
    const sp = specialOf(r.coach.specialId);
    if (sp) {
      specials++;
      bonus += sp.effect.overallBonus ?? 0;
    }
    coach = card ? { overall: sp ? sp.overall : card.overall, bonusLevel: card.bonusLevel } : { overall: 0, bonusLevel: "~" };
  } else open++;
  let sub = { overall: 999 };
  if (r.sub) {
    const card = subById.get(r.sub.refId);
    const sp = specialOf(r.sub.specialId);
    if (sp) {
      specials++;
      bonus += sp.effect.overallBonus ?? 0;
    }
    sub = { overall: card ? (sp ? sp.overall : card.overall) : 0 };
  } else open++;
  const orgBuffLevel: BuffLevel | undefined = r.org ? lineupById.get(r.org.fromLineupId)?.orgBuffLevel : "+++";
  const rating = computeTeamRating({
    playerOveralls,
    coach,
    sub,
    orgBuffLevel,
    chemistryPercent: 100,
    chemistryMaxBonus: DIFFICULTY[difficulty].chemistryMaxBonus,
    specialCount: specials + open,
    specialOverallBonus: bonus + open * maxOverallBonus,
  });
  // `computeTeamRating` rounds to one decimal: allow for it.
  return rating.total + 0.051;
}

export interface DailySolver {
  /** Visits up to `nodeBudget` more draft states; true once the search is over. */
  step(nodeBudget: number): boolean;
  readonly done: boolean;
  /** The best line (call once `done`). */
  result(): DailyOptimal;
}

/**
 * The solver as a resumable search (an explicit stack), so the screen can run
 * it in small slices and never hold the main thread. Same visiting order as
 * a plain depth-first recursion: the result does not depend on the slicing.
 */
export function createDailySolver(
  start: DailyStart,
  maxNodes: number = DAILY_INSIGHT.solverNodeBudget,
  stepper: DailyDraftStepper = new DailyDraftStepper(start),
): DailySolver {
  const maxPlayer = maxPlayerOverall(stepper.root);
  const maxOverallBonus = Math.max(0, ...specialCards.map((sp) => sp.effect.overallBonus ?? 0));
  type Frame = { draft: DraftState; rngState: number; depth: number; moves: Move[] | null; i: number };
  const stack: Frame[] = [{ draft: stepper.root, rngState: stepper.rootRng, depth: 0, moves: null, i: 0 }];
  const path: DailyDraftAction[] = [];
  let best: { score: DraftScore; roster: Roster; actions: DailyDraftAction[] } | null = null;
  let nodes = 0;
  let exhaustive = true;
  let done = false;

  const pop = () => {
    stack.pop();
    if (stack.length > 0) path.pop();
  };

  const solver: DailySolver = {
    get done() {
      return done;
    },
    step(nodeBudget) {
      let visited = 0;
      while (!done) {
        const top = stack[stack.length - 1];
        if (!top) {
          done = true;
          break;
        }
        if (top.moves === null) {
          if (visited >= nodeBudget) return false;
          visited++;
          nodes++;
          if (nodes > maxNodes) {
            exhaustive = false;
            done = true;
            break;
          }
          if (top.draft.complete) {
            const score = scoreRoster(top.draft.roster, start.rules);
            if (!best || compareScores(score, best.score) > 0) best = { score, roster: top.draft.roster, actions: [...path] };
            pop();
            continue;
          }
          // Prune: no completion can beat the incumbent. (An ineligible
          // incumbent, over a day's cap, prunes nothing.)
          if (
            (best && best.score.eligible &&
              ratingCeiling(top.draft, maxPlayer, start.rules.difficulty, maxOverallBonus) <= best.score.rating) ||
            top.depth > DAILY_INSIGHT.maxDraws
          ) {
            pop();
            continue;
          }
          top.moves = movesOf(top.draft);
        }
        if (top.i >= top.moves.length) {
          pop();
          continue;
        }
        const move = top.moves[top.i++];
        const next = stepper.apply(top.draft, move, top.rngState);
        path.push(move.action);
        stack.push({ draft: next.draft, rngState: next.rngState, depth: top.depth + 1, moves: null, i: 0 });
      }
      return true;
    },
    result() {
      if (!done) throw new Error("The daily solver has not finished");
      if (!best) throw new Error(`No complete daily draft for ${start.date}`);
      const found = best as { score: DraftScore; roster: Roster; actions: DailyDraftAction[] };
      return { ...found, nodes, exhaustive };
    },
  };
  return solver;
}

/**
 * The best draft the day's rules allow: an exhaustive branch-and-bound over
 * every legal pick, paid reroll and free reroll, on the day's seeded stream.
 * Deterministic (fixed move order, first-found wins ties).
 */
export function solveDailyOptimal(
  start: DailyStart,
  maxNodes: number = DAILY_INSIGHT.solverNodeBudget,
  stepper: DailyDraftStepper = new DailyDraftStepper(start),
): DailyOptimal {
  const solver = createDailySolver(start, maxNodes, stepper);
  solver.step(Infinity);
  return solver.result();
}

// ---------------------------------------------------------------------------
// Reference drafts and the percentile
// ---------------------------------------------------------------------------

/**
 * Where a score comes from. "simulated" = the seeded reference drafts below;
 * "players" is reserved for a real board, when there is one (same shape, so
 * the screen swaps the source without other changes).
 */
export interface ScoreDistribution {
  source: "simulated" | "players";
  /** Ratings, ascending. Ineligible drafts are stored as -Infinity. */
  ratings: number[];
}

/** A score as a distribution entry (ineligible = -Infinity, below every eligible draft). */
export function distributionValue(score: DraftScore): number {
  return score.eligible ? score.rating : -Infinity;
}
const sortValue = distributionValue;

/**
 * One reference draft: a bot that reads the visible offer (overall, specials,
 * chemistry links) with a seeded taste of its own — some chase overall, some
 * chemistry by lineup, country, season or region, some reroll freely, some
 * draft loosely. A family of plausible drafts, NOT a model of real players.
 */
export function referenceDraft(
  start: DailyStart,
  policySeed: number,
  stepper: DailyDraftStepper = new DailyDraftStepper(start),
): { score: DraftScore; roster: Roster; actions: DailyDraftAction[] } {
  const decisions = createRng(policySeed);
  let draft = stepper.root;
  let rngState = stepper.rootRng;
  const actions: DailyDraftAction[] = [];
  const step = (move: Move) => {
    actions.push(move.action);
    ({ draft, rngState } = stepper.apply(draft, move, rngState));
  };
  const focus = policySeed % 8;
  const rerollChance = decisions.range(0, 0.3);
  const playerPriority = decisions.range(0, 20);
  const noise = focus === 7 ? 60 : decisions.range(4, 26);
  const cap = dailyOverallCap(start.rules.info);
  for (let guard = 0; !draft.complete && guard < DAILY_INSIGHT.maxDraws; guard++) {
    if (!draft.offer?.hasPickableCard) {
      step({ action: { kind: "freeReroll" }, order: 0 });
      continue;
    }
    if (draft.rerollsLeft > 0 && decisions.chance(rerollChance)) {
      step({ action: { kind: "reroll" }, order: 0 });
      continue;
    }
    const picked = [draft.roster.player1, draft.roster.player2, draft.roster.player3]
      .filter(Boolean)
      .map((p) => playerCardById.get(p!.refId)!);
    const value = (c: DraftOfferCard): number => {
      let v = 50;
      if (c.kind === "player") {
        const card = playerCardById.get(c.refId)!;
        const person = playerById.get(card.playerId);
        const overall = pickOverall(c);
        v = (cap !== undefined && focus < 4 ? 100 - Math.abs(overall - (cap - 7)) : overall) + playerPriority;
        if (c.specialId) v += 5;
        for (const prev of picked) {
          if (prev.lineupId === card.lineupId) v += 15;
          if (focus >= 3 && playerById.get(prev.playerId)?.country === person?.country) v += 22;
          if (focus === 4 && prev.seasonId === card.seasonId) v += 22;
          if (focus === 5 && playerById.get(prev.playerId)?.region === person?.region) v += 12;
        }
      } else if (c.kind === "coach" || c.kind === "sub") {
        v = staffOverall(c);
      } else if (c.kind === "org") {
        const lineup = lineupById.get(draft.offer!.lineupId);
        v = 50 + (lineup?.orgBuffLevel ? lineup.orgBuffLevel.length * 6 : 0);
      }
      return v + decisions.range(0, noise);
    };
    let bestCard: DraftOfferCard | undefined;
    let bestValue = -Infinity;
    for (const c of draft.offer.cards) {
      if (c.availability !== "available") continue;
      const v = value(c);
      if (v > bestValue) {
        bestValue = v;
        bestCard = c;
      }
    }
    if (!bestCard) break;
    const slot = (bestCard.kind === "player"
      ? (["player1", "player2", "player3"] as RosterSlotId[])
      : ([bestCard.kind] as RosterSlotId[])
    ).find((s) => !draft.roster[s])!;
    step({
      action: { kind: "pick", refId: bestCard.refId, slot, ...(bestCard.specialId ? { specialId: bestCard.specialId } : {}) },
      card: bestCard,
      order: 0,
    });
  }
  if (!draft.complete) throw new Error(`Reference draft ${policySeed} did not complete on ${start.date}`);
  return { score: scoreRoster(draft.roster, start.rules), roster: draft.roster, actions };
}

/** The day's reference distribution: `n` seeded bots (policy seeds 1..n). */
export function referenceDistribution(
  start: DailyStart,
  n: number = DAILY_INSIGHT.referenceDrafts,
  stepper: DailyDraftStepper = new DailyDraftStepper(start),
): ScoreDistribution {
  const ratings: number[] = [];
  for (let policy = 1; policy <= n; policy++) ratings.push(sortValue(referenceDraft(start, policy, stepper).score));
  ratings.sort((a, b) => a - b);
  return { source: "simulated", ratings };
}

/**
 * Percent of the distribution a score beats (ties count half), 0-100,
 * rounded. "Better than 73 % of the reference drafts."
 */
export function percentileOf(score: DraftScore, dist: ScoreDistribution): number {
  const n = dist.ratings.length;
  if (n === 0) return 0;
  const v = sortValue(score);
  let below = 0;
  let equal = 0;
  for (const r of dist.ratings) {
    if (r < v - 1e-9) below++;
    else if (Math.abs(r - v) <= 1e-9 || (r === -Infinity && v === -Infinity)) equal++;
  }
  return Math.round(((below + equal / 2) / n) * 100);
}

export interface DailyInsight {
  optimal: DailyOptimal;
  yours: DraftScore;
  /** Rating points between the best draft and yours (≥ 0). */
  gap: number;
  /** Your draft IS a best draft (same score). */
  matched: boolean;
  percentile: number;
  distribution: ScoreDistribution;
}

/**
 * Everything the results screen shows, for a finished Daily. The optimum
 * covers every legal line, so a player's draft can only tie it; if a save
 * from an older dataset ever scores higher, the player's own draft is the
 * best known one and the gap is 0.
 */
export function summarizeDailyInsight(
  optimal: DailyOptimal,
  roster: Roster,
  rules: DailyDraftRules,
  distribution: ScoreDistribution,
): DailyInsight {
  const yours = scoreRoster(roster, rules);
  const cmp = compareScores(yours, optimal.score);
  const best = cmp > 0 ? { ...optimal, roster, score: yours, actions: [] } : optimal;
  return {
    optimal: best,
    yours,
    gap: yours.eligible ? Math.max(0, Math.round((best.score.rating - yours.rating) * 10) / 10) : 0,
    matched: compareScores(yours, best.score) >= 0,
    percentile: percentileOf(yours, distribution),
    distribution,
  };
}

/** `summarizeDailyInsight` in one go (tests, scripts). */
export function dailyInsight(start: DailyStart, roster: Roster): DailyInsight {
  const stepper = new DailyDraftStepper(start);
  const optimal = solveDailyOptimal(start, undefined, stepper);
  return summarizeDailyInsight(optimal, roster, start.rules, referenceDistribution(start, undefined, stepper));
}
