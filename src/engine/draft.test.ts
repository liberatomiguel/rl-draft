import { describe, expect, it } from "vitest";
import { coachById, lineupById, playerCardById, subById } from "@/data";
import { createRng, type Rng } from "@/lib/rng";
import {
  applyPick,
  applyReroll,
  applySkip,
  createDraft,
  drawNextOffer,
  filledCount,
} from "./draft";
import type { DraftState, RosterPick } from "./types";

function firstPickable(draft: DraftState) {
  return draft.offer!.cards.find(
    (c) => c.availability === "available" || c.availability === "as_sub",
  );
}

/** Plays a full draft picking the first pickable card every round. */
function autoDraft(seed: number): DraftState {
  const rng = createRng(seed);
  let draft = drawNextOffer(createDraft("normal"), rng);
  let guard = 0;
  while (!draft.complete && guard < 120) {
    const card = firstPickable(draft);
    draft = card ? applyPick(draft, card, rng) : applySkip(draft, rng);
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
  if (pick.kind === "player") return playerCardById.get(pick.refId)!.playerId;
  if (pick.kind === "coach") return coachById.get(pick.refId)!.personId;
  if (pick.kind === "sub") return subById.get(pick.refId)!.personId;
  return `org:${pick.refId}`;
}

describe("draft (§4-§6)", () => {
  it("completes with 6 filled slots and no duplicate person", () => {
    for (const seed of [1, 7, 42, 1337, 90210]) {
      const draft = autoDraft(seed);
      expect(draft.complete).toBe(true);
      expect(filledCount(draft.roster)).toBe(6);

      const picks = Object.values(draft.roster) as RosterPick[];
      const persons = picks.map(personOfPick);
      expect(new Set(persons).size).toBe(persons.length);
    }
  });

  it("draws lineups without replacement within a run", () => {
    const rng = createRng(5);
    let draft = drawNextOffer(createDraft("normal"), rng);
    for (let i = 0; i < 20; i++) draft = drawNextOffer(draft, rng);
    expect(new Set(draft.shownLineupIds).size).toBe(draft.shownLineupIds.length);
  });

  it("blocks every other card of an already-drafted person (core rule)", () => {
    const rng = createRng(11);
    let draft = drawNextOffer(createDraft("normal"), rng);

    // Draft Kaydop's Gale Force S4 card…
    draft = huntOffer(draft, rng, (d) => d.offer!.lineupId === "gale-force-s4");
    const kaydop = draft.offer!.cards.find((c) => c.refId === "kaydop-gale-force-s4")!;
    expect(kaydop.availability).toBe("available");
    draft = applyPick(draft, kaydop, rng);

    // …then any lineup containing another Kaydop card must mark it taken.
    draft = huntOffer(draft, rng, (d) =>
      d.offer!.cards.some((c) => playerCardById.get(c.refId)?.playerId === "kaydop"),
    );
    const otherKaydop = draft.offer!.cards.find(
      (c) => playerCardById.get(c.refId)?.playerId === "kaydop",
    )!;
    expect(otherKaydop.availability).toBe("already_drafted");
  });

  it("lets player cards fill the sub slot once player slots are full", () => {
    const rng = createRng(23);
    let draft = drawNextOffer(createDraft("normal"), rng);

    for (let i = 0; i < 3; i++) {
      draft = huntOffer(draft, rng, (d) =>
        d.offer!.cards.some((c) => c.kind === "player" && c.availability === "available"),
      );
      const card = draft.offer!.cards.find(
        (c) => c.kind === "player" && c.availability === "available",
      )!;
      draft = applyPick(draft, card, rng);
    }

    draft = huntOffer(draft, rng, (d) =>
      d.offer!.cards.some((c) => c.kind === "player" && c.availability === "as_sub"),
    );
    const asSub = draft.offer!.cards.find(
      (c) => c.kind === "player" && c.availability === "as_sub",
    )!;
    draft = applyPick(draft, asSub, rng);
    expect(draft.roster.sub?.kind).toBe("player");
    expect(draft.roster.sub?.asSub).toBe(true);
  });

  it("allows a free skip only when nothing is pickable", () => {
    const rng = createRng(31);
    // Everything filled except the coach slot.
    let draft: DraftState = {
      ...createDraft("normal"),
      roster: {
        player1: { slot: "player1", kind: "player", refId: "kronovi-ibuypower-s1", fromLineupId: "x" },
        player2: { slot: "player2", kind: "player", refId: "lachinio-ibuypower-s1", fromLineupId: "x" },
        player3: { slot: "player3", kind: "player", refId: "gambit-ibuypower-s1", fromLineupId: "x" },
        sub: { slot: "sub", kind: "sub", refId: "express-renegades-x", fromLineupId: "x" },
        org: { slot: "org", kind: "org", refId: "ibuypower", fromLineupId: "x" },
      },
      takenPersonIds: ["kronovi", "lachinio", "gambit", "express"],
    };

    // Gale Force S4 has no coach card → nothing fits the remaining slot.
    draft = { ...draft, shownLineupIds: [] };
    let hunted = drawNextOffer(draft, rng);
    let guard = 0;
    while (hunted.offer!.lineupId !== "gale-force-s4" && guard < 60) {
      hunted = drawNextOffer(hunted, rng);
      guard += 1;
    }
    expect(lineupById.get("gale-force-s4")?.coachId).toBeUndefined();
    expect(hunted.offer!.hasPickableCard).toBe(false);

    const blocked = hunted.offer!.cards[0];
    expect(() => applyPick(hunted, blocked, rng)).toThrow();
    const skipped = applySkip(hunted, rng);
    expect(skipped.round).toBe(hunted.round + 1);
  });

  it("limits rerolls by difficulty and throws at zero", () => {
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
