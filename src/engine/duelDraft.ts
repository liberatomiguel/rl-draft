/**
 * Team-against-team duel: the draft (rc.9, DESIGN-DECISIONS #225-#226).
 *
 * Both friends must meet the same boards. The classic draft draws offers from
 * ONE running RNG and drops lineups already shown, so one friend's reroll
 * would change everything they see afterwards. Here the board a friend sees
 * for a slot is a function of (seed, slot, board index) only:
 *
 *  - slot = the picks made so far; board index = how many boards of this slot
 *    were shown before (a paid reroll or a skipped dead board moves it by one);
 *  - the LINEUP comes from `drawNextOffer` on a canonical draft (nothing
 *    drafted, nothing shown) with an RNG seeded from (seed, slot, index), so it
 *    never depends on what the friend already holds;
 *  - the CARDS of that lineup (the specials they roll) come from a second RNG
 *    seeded from the same three numbers, through `drawNextOffer`'s scripted
 *    path, so only their availability reflects the friend's own roster;
 *  - a board with no pickable card for the friend is skipped on its own (what
 *    the classic draft calls a free reroll), never costs a reroll, and the next
 *    index is the one the other friend would see at that index.
 *
 * Both friends may draft the same card. Pure and deterministic, no store.
 */

import { DUEL, DUEL_MATCH } from "@/config/balance";
import { lineupPoolForRegion } from "@/data";
import { createRng } from "@/lib/rng";
import { applyPick, createDraft, drawNextOffer, filledCount } from "./draft";
import { duelStreamSeed, type DuelCard, type DuelRules, type DuelTeamCards } from "./duelRules";
import type { DraftOfferCard, DraftState, Roster, RosterSlotId } from "./types";

/** A friend's draft in progress. Plain JSON, so a store can keep it. */
export interface DuelDraft {
  rules: DuelRules;
  /** The classic draft's own state (roster, offer, rerolls left). */
  draft: DraftState;
  /** Which board of the current slot is on screen (0 = the first one). */
  boardIndex: number;
}

/** The pool of lineups the rules draw from (undefined = worldwide), as the old duel did. */
function poolOf(rules: DuelRules): string[] | undefined {
  return rules.region ? lineupPoolForRegion(rules.region) : undefined;
}

function baseDraft(rules: DuelRules): DraftState {
  return createDraft("normal", {
    mode: rules.mode,
    poolLineupIds: poolOf(rules),
    rerollsOverride: rules.rerolls,
    specialChanceMult: DUEL.specialChanceMult,
    specialRarities: [...DUEL.specialRarities],
  });
}

/** The lineup of board (slot, index): a function of the rules and those two numbers alone. */
export function duelBoardLineup(rules: DuelRules, slot: number, index: number): string {
  const offer = drawNextOffer(baseDraft(rules), createRng(duelStreamSeed(rules.seed, `lineup:${slot}:${index}`))).offer;
  if (!offer) throw new Error("duel board: no lineup drawn");
  return offer.lineupId;
}

/**
 * The first board at or after `from` that the friend can pick from. The board
 * shown at index i is the same for everyone who reaches i; only the cards the
 * friend already holds make a board dead for them.
 */
function boardFrom(rules: DuelRules, draft: DraftState, from: number): { draft: DraftState; boardIndex: number } {
  const slot = filledCount(draft.roster);
  let last: DraftState | null = null;
  for (let i = from; i < from + DUEL_MATCH.maxBlockedSkips; i++) {
    const lineupId = duelBoardLineup(rules, slot, i);
    const script = Array.from({ length: slot + 1 }, () => ({ lineupId }));
    const probe = drawNextOffer(
      { ...draft, shownLineupIds: [], scriptedLineups: script },
      createRng(duelStreamSeed(rules.seed, `cards:${slot}:${i}`)),
    );
    // A dead scripted board makes drawNextOffer draw something else on the same
    // RNG: accept only the lineup we asked for, and only if it has a pickable card.
    const board: DraftState = { ...probe, shownLineupIds: draft.shownLineupIds, scriptedLineups: draft.scriptedLineups };
    last = board;
    if (probe.offer?.lineupId === lineupId && probe.offer.hasPickableCard) return { draft: board, boardIndex: i };
  }
  if (!last) throw new Error("duel board: nothing drawn");
  return { draft: last, boardIndex: from + DUEL_MATCH.maxBlockedSkips - 1 };
}

/** A new draft on the rules: the first board of the first slot, rerolls as the rules say. */
export function startDuelDraft(rules: DuelRules): DuelDraft {
  const shown = boardFrom(rules, baseDraft(rules), 0);
  return { rules, draft: shown.draft, boardIndex: shown.boardIndex };
}

/** Pick a card from the offer onto a slot (the classic draft's own validation), then the next slot's first board. */
export function duelPick(d: DuelDraft, card: DraftOfferCard, slot: RosterSlotId): DuelDraft {
  // applyPick validates and records the pick; its own next offer is discarded.
  const picked = applyPick(d.draft, card, slot, createRng(0));
  const cleared: DraftState = { ...picked, shownLineupIds: [], offer: null };
  if (picked.complete) return { rules: d.rules, draft: cleared, boardIndex: 0 };
  const next = boardFrom(d.rules, cleared, 0);
  return { rules: d.rules, draft: next.draft, boardIndex: next.boardIndex };
}

/** Spend one reroll on the next board of this slot. Throws with none left, like the classic draft. */
export function duelReroll(d: DuelDraft): DuelDraft {
  if (d.draft.rerollsLeft <= 0) throw new Error("No rerolls left");
  if (!d.draft.offer) throw new Error("No active offer to reroll");
  const next = boardFrom(d.rules, { ...d.draft, rerollsLeft: d.draft.rerollsLeft - 1 }, d.boardIndex + 1);
  return { rules: d.rules, draft: next.draft, boardIndex: next.boardIndex };
}

export const duelRerollsLeft = (d: DuelDraft): number => d.draft.rerollsLeft;
export const duelDraftComplete = (d: DuelDraft): boolean => d.draft.complete;

const card = (p: { refId: string; specialId?: string }): DuelCard => (p.specialId ? { id: p.refId, sp: p.specialId } : { id: p.refId });

/**
 * The finished roster as the link carries it. Players are sorted by card id,
 * so the slot a player took never changes the team. Throws on an unfinished roster.
 */
export function duelTeamFromRoster(roster: Roster, mode: DuelRules["mode"]): DuelTeamCards {
  const picks = [roster.player1, roster.player2, roster.player3];
  if (picks.some((p) => !p)) throw new Error("Roster incomplete");
  const players = picks.map((p) => card(p!)).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  if (mode === "quick") return { players };
  if (!roster.coach || !roster.sub || !roster.org) throw new Error("Roster incomplete");
  return { players, coach: card(roster.coach), sub: card(roster.sub), orgLineup: roster.org.fromLineupId };
}
