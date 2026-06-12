import { describe, expect, it } from "vitest";
import { coachById, lineupById, playerCardById, subById } from "@/data";
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
  while (!predicate(draft) && guard < 80) {
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
    const rng = createRng(11);
    let draft = drawNextOffer(createDraft("normal"), rng);

    // Draft Kaydop's Gale Force S4 card…
    draft = huntOffer(draft, rng, (d) => d.offer!.lineupId === "gale-force-s4");
    const kaydop = draft.offer!.cards.find((c) => c.refId === "kaydop-gale-force-s4")!;
    expect(kaydop.availability).toBe("available");
    draft = applyPick(draft, kaydop, "player1", rng);

    // …then any lineup containing another Kaydop card must mark it taken.
    draft = huntOffer(draft, rng, (d) =>
      d.offer!.cards.some((c) => playerCardById.get(c.refId)?.playerId === "kaydop"),
    );
    const otherKaydop = draft.offer!.cards.find(
      (c) => playerCardById.get(c.refId)?.playerId === "kaydop",
    )!;
    expect(otherKaydop.availability).toBe("already_drafted");
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
    // Only player slots remain — and every Gale Force player is already taken,
    // so the whole offer is blocked (vacant coach/sub can't help: slots full).
    let draft: DraftState = {
      ...createDraft("normal"),
      roster: {
        coach: { slot: "coach", kind: "coach", refId: "satthew-spacestation-x", fromLineupId: "x" },
        sub: { slot: "sub", kind: "sub", refId: "express-renegades-x", fromLineupId: "x" },
        org: { slot: "org", kind: "org", refId: "ibuypower", fromLineupId: "x" },
      },
      takenPersonIds: ["satthew", "express", "kaydop", "turbopolsa", "violentpanda"],
    };

    let hunted = drawNextOffer(draft, rng);
    let guard = 0;
    while (hunted.offer!.lineupId !== "gale-force-s4" && guard < 60) {
      hunted = drawNextOffer(hunted, rng);
      guard += 1;
    }
    expect(hunted.offer!.lineupId).toBe("gale-force-s4");
    expect(hunted.offer!.hasPickableCard).toBe(false);

    const blocked = hunted.offer!.cards[0];
    expect(() => applyPick(hunted, blocked, "player1", rng)).toThrow();
    const rerolled = applyFreeReroll(hunted, rng);
    expect(rerolled.round).toBe(hunted.round + 1);
    // Free reroll never touches the paid reroll budget.
    expect(rerolled.rerollsLeft).toBe(hunted.rerollsLeft);

    // And it is rejected while something IS pickable.
    let open = drawNextOffer(createDraft("normal"), rng);
    expect(open.offer!.hasPickableCard).toBe(true);
    expect(() => applyFreeReroll(open, rng)).toThrow();
  });

  it("offers pickable vacant cards when a lineup has no coach/sub", () => {
    const rng = createRng(77);
    let draft = drawNextOffer(createDraft("normal"), rng);
    // Gale Force S4 has neither coach nor sub in the dataset.
    draft = huntOffer(draft, rng, (d) => d.offer!.lineupId === "gale-force-s4");

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
