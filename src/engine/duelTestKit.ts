/** Test helpers for the duel modules: a scripted friend that drafts a team. Not used by the app. */

import { createRng } from "@/lib/rng";
import { openPlayerSlot, slotsForKind } from "./draft";
import { duelPick, duelReroll, duelTeamFromRoster, startDuelDraft, type DuelDraft } from "./duelDraft";
import type { DuelRules, DuelTeamCards } from "./duelRules";
import type { DraftOfferCard, RosterSlotId } from "./types";

export interface BotOptions {
  /** Picks the card by this seed (default: the first available). */
  pickSeed?: number;
  /** Rerolls to spend on each slot (by picks made), as long as any are left. */
  rerollsAt?: Record<number, number>;
}

export interface BoardLog {
  /** `${slot}:${boardIndex}` -> the offer's lineup and cards, without availability. */
  seen: Map<string, string>;
  draft: DuelDraft;
  team: DuelTeamCards;
}

const sig = (d: DuelDraft): string => {
  const o = d.draft.offer!;
  return `${o.lineupId}|${o.cards.map((c) => `${c.kind}:${c.refId}:${c.specialId ?? ""}`).join(",")}`;
};

function slotFor(card: DraftOfferCard, d: DuelDraft): RosterSlotId | null {
  if (card.kind === "player") return openPlayerSlot(d.draft.roster);
  return slotsForKind(card.kind).find((s) => !d.draft.roster[s]) ?? null;
}

/** Drafts a whole team, logging every board shown. */
export function botDraft(rules: DuelRules, opts: BotOptions = {}): BoardLog {
  const rng = createRng(opts.pickSeed ?? 0);
  let d = startDuelDraft(rules);
  const seen = new Map<string, string>();
  let picks = 0;
  while (!d.draft.complete) {
    seen.set(`${picks}:${d.boardIndex}`, sig(d));
    let spend = opts.rerollsAt?.[picks] ?? 0;
    while (spend > 0 && d.draft.rerollsLeft > 0) {
      d = duelReroll(d);
      seen.set(`${picks}:${d.boardIndex}`, sig(d));
      spend -= 1;
    }
    const options = d.draft.offer!.cards.filter((c) => c.availability === "available" && slotFor(c, d));
    if (options.length === 0) throw new Error("bot: no pickable card on a board the draft returned");
    const card = opts.pickSeed === undefined ? options[0] : rng.pick(options);
    d = duelPick(d, card, slotFor(card, d)!);
    picks += 1;
  }
  return { seen, draft: d, team: duelTeamFromRoster(d.draft.roster, rules.mode) };
}
