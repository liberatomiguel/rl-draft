/** Test/authoring support only. Every action is available in the UI; the match
 * continues the draft's RNG. Decision randomness NEVER enters the game RNG. */
import { coachById, playerById, playerCardById, specialCardById, subById } from "@/data";
import { createRng } from "@/lib/rng";
import { finalOverall } from "../cards";
import { buildChallengeOpponent, challengeRerolls, createChallengeDraft, resolveChallengeAttempt } from "../challenges";
import { applyFreeReroll, applyPick, applyReroll, slotsForKind } from "../draft";
import { buildUserTeam } from "../teams";
import type { Challenge, DraftOfferCard, DraftState, RosterSlotId } from "../types";

export type ChallengeAction = { kind: "pick"; refId: string; slot: RosterSlotId; specialId?: string } | { kind: "reroll" } | { kind: "freeReroll" };

export function finishChallenge(ch: Challenge, draft: DraftState, rngState: number) {
  const rng = createRng(rngState);
  const user = buildUserTeam(draft.roster, ch.sim.difficulty, { mode: "challenge" });
  const opponent = buildChallengeOpponent(ch);
  const result = resolveChallengeAttempt(ch, user, opponent, draft.roster,
    challengeRerolls(ch) - draft.rerollsLeft, rng);
  return { mask: result.starsEarned, user, opponent,
    all: [...(result.stages?.results ?? []), ...(result.series ? [result.series] : [])], draft, rngState };

}

export function replayChallenge(ch: Challenge, actions: ChallengeAction[]) {
  const rng = createRng(ch.seed);
  let draft = createChallengeDraft(ch, rng);
  for (const action of actions) {
    if (draft.complete) throw new Error("Action after completed draft");
    if (action.kind === "freeReroll") draft = applyFreeReroll(draft, rng);
    else if (action.kind === "reroll") {
      if (!draft.offer?.hasPickableCard) throw new Error("Dead offer must use a free reroll");
      draft = applyReroll(draft, rng);
    } else {
      const card = draft.offer?.cards.find(c => c.refId === action.refId && c.specialId === action.specialId && slotsForKind(c.kind).includes(action.slot));
      if (!card) throw new Error(`Pick not offered: ${action.refId}`);
      draft = applyPick(draft, card, action.slot, rng);
    }
  }
  if (!draft.complete) throw new Error("Incomplete solution");
  return finishChallenge(ch, draft, rng.state);
}

/** A family of visible-information policies: strength, chemistry, era, restraint.
 * This is a search for reproducible solutions, NOT an estimate of human success. */
export function exploreChallenge(ch: Challenge, policySeed: number) {
  const decisions = createRng(policySeed);
  const rng = createRng(ch.seed);
  let draft = createChallengeDraft(ch, rng);
  const actions: ChallengeAction[] = [];
  const focus = policySeed % 8;
  const rerollChance = decisions.range(0, 0.32);
  const objectives = [ch.objective, ...(ch.stars ?? [])];
  const avoidSpecials = objectives.some(s => s?.kind === "noSpecials");
  const rerollLimit = objectives.find(s => s?.kind === "maxRerolls");
  const maxRerolls = rerollLimit?.kind === "maxRerolls" ? rerollLimit.max : challengeRerolls(ch);
  const playerPriority = decisions.range(0, 18);
  for (let guard = 0; !draft.complete && guard < 60; guard++) {
    const offer = draft.offer;
    if (!offer) return null;
    if (!offer.hasPickableCard) {
      actions.push({ kind: "freeReroll" });
      draft = applyFreeReroll(draft, rng);
      continue;
    }
    if (draft.rerollsLeft > 0 && actions.filter(a => a.kind === "reroll").length < maxRerolls && decisions.chance(rerollChance)) {
      actions.push({ kind: "reroll" });
      draft = applyReroll(draft, rng);
      continue;
    }
    const picked = Object.values(draft.roster).filter(p => p?.kind === "player").map(p => playerCardById.get(p!.refId)!);
    function score(c: DraftOfferCard) {
      let value = 50;
      if (c.kind === "player") {
        const card = playerCardById.get(c.refId)!;
        value = finalOverall(card) + playerPriority;
        const special = c.specialId ? specialCardById.get(c.specialId) : undefined;
        if (special) value += 5;
        if (focus === 1 && special) value -= 40;
        if (focus === 2) value = 100 - finalOverall(card) + playerPriority;
        const identity = playerById.get(card.playerId);
        for (const prev of picked) {
          const p = playerById.get(prev.playerId);
          if (focus === 3 && prev.seasonId === card.seasonId) value += 25;
          if (focus === 4 && p?.region === identity?.region) value += 18;
          if ((focus === 5 || focus === 6) && p?.country === identity?.country) value += 25;
          if (prev.lineupId === card.lineupId) value += 12;
        }
      } else if (c.kind === "coach") value = coachById.get(c.refId)?.overall ?? 50;
      else if (c.kind === "sub") value = subById.get(c.refId)?.overall ?? 50;
      if (avoidSpecials && c.specialId) value -= 150;
      return value + decisions.range(0, focus === 7 ? 65 : 25);
    }
    const cards = offer.cards.filter(c => c.availability === "available" && slotsForKind(c.kind).some(s => !draft.roster[s]));
    const best = cards.map(c => ({ c, score: score(c) })).sort((a, b) => b.score - a.score)[0]?.c;
    if (!best) return null;
    const slot = slotsForKind(best.kind).find(s => !draft.roster[s])!;
    actions.push({ kind: "pick", refId: best.refId, slot, ...(best.specialId ? { specialId: best.specialId } : {}) });
    draft = applyPick(draft, best, slot, rng);
  }
  if (!draft.complete) return null;
  return { ...finishChallenge(ch, draft, rng.state), actions };
}
