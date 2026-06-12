import { describe, expect, it } from "vitest";
import { coachById, coaches, lineups, orgs, playerCardById, playerCards, subById, subs } from "@/data";
import { createRng, type Rng } from "@/lib/rng";
import {
  applyFreeReroll,
  applyPick,
  applyReroll,
  createDraft,
  drawNextOffer,
  filledCount,
  openPlayerSlot,
} from "./draft";
import type { DraftOfferCard, DraftState, RosterPick, RosterSlotId } from "./types";

function targetSlotFor(draft: DraftState, card: DraftOfferCard): RosterSlotId | null {
  switch (card.kind) {
    case "player":
      return openPlayerSlot(draft.roster);
    case "coach":
      return draft.roster.coach ? null : "coach";
    case "sub":
      return draft.roster.sub ? null : "sub";
    case "org":
      return draft.roster.org ? null : "org";
  }
}

function firstPickable(draft: DraftState) {
  return draft.offer!.cards.find((c) => c.availability === "available");
}

/** Plays a full draft picking the first pickable card every round. */
function autoDraft(seed: number): DraftState {
  const rng = createRng(seed);
  let draft = drawNextOffer(createDraft("normal"), rng);
  let guard = 0;
  while (!draft.complete && guard < 200) {
    const card = firstPickable(draft);
    if (card) {
      const slot = targetSlotFor(draft, card)!;
      draft = applyPick(draft, card, slot, rng);
    } else {
      draft = applyFreeReroll(draft, rng);
    }
    guard += 1;
  }
  return draft;
}

/** Draws offers (no picks) until the predicate matches the current offer. */
function huntOffer(
  draft: DraftState,
  rng: Rng,
  predicate: (draft: DraftState) => boolean,
): DraftState {
  let guard = 0;
  // Pool is 200+ lineups (drawn without replacement, so this terminates).
  while (!predicate(draft) && guard < 500) {
    draft = drawNextOffer(draft, rng);
    guard += 1;
  }
  expect(predicate(draft)).toBe(true);
  return draft;
}

function personOfPick(pick: RosterPick): string {
  if (pick.refId.startsWith("vacant-")) return pick.refId;
  if (pick.kind === "player") return playerCardById.get(pick.refId)!.playerId;
  if (pick.kind === "coach") return coachById.get(pick.refId)!.personId;
  if (pick.kind === "sub") return subById.get(pick.refId)!.personId;
  return `org:${pick.refId}`;
}

describe("draft (§4-§6, v0.2 rules)", () => {
  it("completes with 6 filled slots and no duplicate person", () => {
    for (const seed of [1, 7, 42, 1337, 90210]) {
      const draft = autoDraft(seed);
      expect(draft.complete).toBe(true);
      expect(filledCount(draft.roster)).toBe(6);

      const picks = Object.values(draft.roster) as RosterPick[];
      const persons = picks.map(personOfPick);
      expect(new Set(persons).size).toBe(persons.length);

      // Only sub cards in the sub slot (player-as-sub was removed in v0.2).
      expect(draft.roster.sub?.kind).toBe("sub");
    }
  });

  it("draws lineups without replacement within a run", () => {
    const rng = createRng(5);
    let draft = drawNextOffer(createDraft("normal"), rng);
    for (let i = 0; i < 20; i++) draft = drawNextOffer(draft, rng);
    expect(new Set(draft.shownLineupIds).size).toBe(draft.shownLineupIds.length);
  });

  it("places a player on the chosen player slot", () => {
    const rng = createRng(3);
    let draft = drawNextOffer(createDraft("normal"), rng);
    const card = draft.offer!.cards.find(
      (c) => c.kind === "player" && c.availability === "available",
    )!;
    draft = applyPick(draft, card, "player3", rng);
    expect(draft.roster.player3?.refId).toBe(card.refId);
    expect(draft.roster.player1).toBeUndefined();
  });

  it("rejects placing a card on an incompatible or filled slot", () => {
    const rng = createRng(4);
    const draft = drawNextOffer(createDraft("normal"), rng);
    const player = draft.offer!.cards.find((c) => c.kind === "player")!;
    const org = draft.offer!.cards.find((c) => c.kind === "org")!;
    expect(() => applyPick(draft, player, "coach", rng)).toThrow();
    expect(() => applyPick(draft, org, "player1", rng)).toThrow();

    const placed = applyPick(draft, player, "player1", rng);
    const nextPlayer = placed.offer!.cards.find(
      (c) => c.kind === "player" && c.availability === "available",
    )!;
    expect(() => applyPick(placed, nextPlayer, "player1", rng)).toThrow();
  });

  it("blocks every other card of an already-drafted person (core rule)", () => {
    // Find any person with multiple cards in the dataset.
    const byPlayer = new Map<string, string[]>();
    for (const card of playerCards) {
      byPlayer.set(card.playerId, [...(byPlayer.get(card.playerId) ?? []), card.id]);
    }
    const [playerId, cardIds] = [...byPlayer.entries()].find(([, ids]) => ids.length >= 2)!;
    const firstCard = playerCardById.get(cardIds[0])!;

    const rng = createRng(11);
    let draft = drawNextOffer(createDraft("normal"), rng);

    // Draft one version of the player…
    draft = huntOffer(draft, rng, (d) => d.offer!.lineupId === firstCard.lineupId);
    const offerCard = draft.offer!.cards.find((c) => c.refId === firstCard.id)!;
    expect(offerCard.availability).toBe("available");
    draft = applyPick(draft, offerCard, "player1", rng);

    // …then any lineup containing another card of theirs must mark it taken.
    draft = huntOffer(draft, rng, (d) =>
      d.offer!.cards.some(
        (c) => c.kind === "player" && playerCardById.get(c.refId)?.playerId === playerId,
      ),
    );
    const otherCard = draft.offer!.cards.find(
      (c) => c.kind === "player" && playerCardById.get(c.refId)?.playerId === playerId,
    )!;
    expect(otherCard.availability).toBe("already_drafted");
  });

  it("marks player cards slot_full once the three player slots are taken", () => {
    const rng = createRng(23);
    let draft = drawNextOffer(createDraft("normal"), rng);

    for (const slot of ["player1", "player2", "player3"] as RosterSlotId[]) {
      draft = huntOffer(draft, rng, (d) =>
        d.offer!.cards.some((c) => c.kind === "player" && c.availability === "available"),
      );
      const card = draft.offer!.cards.find(
        (c) => c.kind === "player" && c.availability === "available",
      )!;
      draft = applyPick(draft, card, slot, rng);
    }

    draft = huntOffer(draft, rng, (d) => d.offer!.cards.some((c) => c.kind === "player"));
    for (const card of draft.offer!.cards.filter((c) => c.kind === "player")) {
      expect(["slot_full", "already_drafted"]).toContain(card.availability);
    }
  });

  it("grants a free reroll only when nothing is pickable", () => {
    const rng = createRng(31);
    // Only player slots remain — and every player of the target lineup is
    // already taken, so its offer is fully blocked (vacant coach/sub can't
    // help: those slots are filled).
    const target = lineups[0];
    const targetPlayerIds = target.playerCardIds.map(
      (id) => playerCardById.get(id)!.playerId,
    );
    let draft: DraftState = {
      ...createDraft("normal"),
      roster: {
        coach: { slot: "coach", kind: "coach", refId: coaches[0].id, fromLineupId: "x" },
        sub: { slot: "sub", kind: "sub", refId: subs[0].id, fromLineupId: "x" },
        org: { slot: "org", kind: "org", refId: orgs[0].id, fromLineupId: "x" },
      },
      takenPersonIds: [coaches[0].personId, subs[0].personId, ...targetPlayerIds],
    };

    let hunted = drawNextOffer(draft, rng);
    let guard = 0;
    while (hunted.offer!.lineupId !== target.id && guard < 400) {
      hunted = drawNextOffer(hunted, rng);
      guard += 1;
    }
    expect(hunted.offer!.lineupId).toBe(target.id);
    expect(hunted.offer!.hasPickableCard).toBe(false);

    const blocked = hunted.offer!.cards[0];
    expect(() => applyPick(hunted, blocked, "player1", rng)).toThrow();
    const rerolled = applyFreeReroll(hunted, rng);
    expect(rerolled.round).toBe(hunted.round + 1);
    // Free reroll never touches the paid reroll budget.
    expect(rerolled.rerollsLeft).toBe(hunted.rerollsLeft);

    // And it is rejected while something IS pickable.
    const open = drawNextOffer(createDraft("normal"), rng);
    expect(open.offer!.hasPickableCard).toBe(true);
    expect(() => applyFreeReroll(open, rng)).toThrow();
  });

  it("offers pickable vacant cards when a lineup has no coach/sub", () => {
    // Find a lineup with neither coach nor sub in the dataset.
    const target = lineups.find((l) => !l.coachId && !l.subId)!;
    expect(target).toBeDefined();

    const rng = createRng(77);
    let draft = drawNextOffer(createDraft("normal"), rng);
    draft = huntOffer(draft, rng, (d) => d.offer!.lineupId === target.id);

    const vacantCoach = draft.offer!.cards.find((c) => c.refId === "vacant-coach");
    const vacantSub = draft.offer!.cards.find((c) => c.refId === "vacant-sub");
    expect(vacantCoach?.availability).toBe("available");
    expect(vacantSub?.availability).toBe("available");

    draft = applyPick(draft, vacantCoach!, "coach", rng);
    expect(draft.roster.coach?.refId).toBe("vacant-coach");
    // Vacant picks exclude nobody.
    expect(draft.takenPersonIds).toHaveLength(0);
  });

  it("limits paid rerolls by difficulty and throws at zero", () => {
    const rng = createRng(99);
    let draft = drawNextOffer(createDraft("easy"), rng);
    expect(draft.rerollsLeft).toBe(3);
    draft = applyReroll(draft, rng);
    draft = applyReroll(draft, rng);
    draft = applyReroll(draft, rng);
    expect(draft.rerollsLeft).toBe(0);
    expect(() => applyReroll(draft, rng)).toThrow();

    const hard = drawNextOffer(createDraft("hard"), rng);
    expect(hard.rerollsLeft).toBe(0);
  });
});
