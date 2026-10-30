/**
 * National teams → album (rc.33, COL-01b / COL-02a). Discovery is separate from
 * ownership: SEEING a national team in a classic draft reveals its album page
 * and grants no card; DRAFTING one of its cards and finishing the run collects
 * that card (like every special), and an abandoned run keeps the discovery
 * only. The NEW tag of an offer is decided against the inventory before the
 * offer and kept with it. Drives the REAL runStore actions.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { lineupById, nationalSpecialIdsByLineupId } from "@/data";
import { isNationalTeamDiscovered, nationalCardIdsOf } from "@/engine/collection";
import { neededKinds, slotsForKind } from "@/engine/draft";
import type { DraftOfferCard } from "@/engine/types";
import { useProfileStore } from "./profileStore";
import { useRewardToasts } from "./rewardToastStore";
import { useRunStore } from "./runStore";

const DATE = "2026-01-01T00:00:00.000Z";
const run = () => useRunStore.getState().run!;
const profile = () => useProfileStore.getState();

beforeEach(() => {
  useProfileStore.getState().resetAll();
  useRewardToasts.setState({ queue: [] });
  useRunStore.setState({ run: null });
});

/** A classic run with a deep reroll budget, so a national offer can be reached. */
function startClassic(): void {
  useRunStore.getState().startRun({ mode: "classic", difficulty: "normal", showOverall: true, regionLock: null });
  const r = run();
  useRunStore.setState({ run: { ...r, draft: { ...r.draft, rerollsLeft: 5000 } } });
}

/** Reroll until the current offer is a national team (bounded); returns its lineup id. */
function rerollToNational(): string | null {
  for (let i = 0; i < 2000; i++) {
    const offer = run().draft.offer!;
    if (lineupById.get(offer.lineupId)?.national) return offer.lineupId;
    useRunStore.getState().reroll();
  }
  return null;
}

/** The first pickable national PLAYER card of the current offer. */
function nationalPlayerCard(): DraftOfferCard {
  const card = run().draft.offer!.cards.find(
    (c) => c.kind === "player" && c.availability === "available" && c.specialId?.startsWith("nt-"),
  );
  expect(card).toBeTruthy();
  return card!;
}

function pick(card: DraftOfferCard): void {
  useRunStore.getState().pickCard(card, slotsForKind(card.kind).find((s) => !run().draft.roster[s])!);
}

/** Draft through: a needed card for a free slot, else any card, else a reroll. */
function draftThrough(): void {
  for (let i = 0; i < 400 && run().phase === "draft"; i++) {
    const { draft } = run();
    const fits = (kind: DraftOfferCard["kind"]) => slotsForKind(kind).some((s) => !draft.roster[s]);
    const cards = (draft.offer?.cards ?? []).filter((c) => c.availability === "available" && fits(c.kind));
    const need = neededKinds(draft.roster, draft.mode);
    const next = cards.find((c) => need.includes(c.kind)) ?? cards[0];
    if (!next) {
      useRunStore.getState().reroll();
      continue;
    }
    pick(next);
  }
  expect(run().phase).toBe("review");
}

function playToResults(): void {
  useRunStore.getState().startTournament();
  for (let i = 0; i < 40 && run().tournament!.stage !== "finished"; i++) useRunStore.getState().playRound();
  useRunStore.getState().finishRun();
  expect(run().phase).toBe("results");
}

/** One card of EVERY national team owned: any national draw is then a team found before rc.33. */
function ownOneCardPerTeam(): Record<string, string> {
  return Object.fromEntries([...nationalSpecialIdsByLineupId.values()].map((ids) => [ids[0], DATE]));
}

describe("national teams — finding one reveals its page (COL-01b)", () => {
  it("the find records the discovery and toasts once, but grants no card", () => {
    startClassic();
    expect(run().draft.nationalTeams?.complete).toEqual([]); // classic runs opt in; nothing complete
    const lineupId = rerollToNational();
    expect(lineupId).not.toBeNull();

    expect(profile().nationalDiscovered?.[lineupId!]).toBeTruthy();
    expect(isNationalTeamDiscovered(lineupId!, profile().nationalDiscovered, profile().unlockedSpecials)).toBe(true);
    for (const id of nationalCardIdsOf(lineupId!)) expect(profile().unlockedSpecials[id], id).toBeUndefined();

    const toasts = useRewardToasts.getState().queue.filter((t) => t.kind === "nationalTeam");
    expect(toasts).toHaveLength(1);
    expect(toasts[0]).toMatchObject({ kind: "nationalTeam", orgId: lineupById.get(lineupId!)!.orgId });
  });

  it("a team found before rc.33 (a card owned) counts as discovered: no record, no toast, cards kept", () => {
    const owned = ownOneCardPerTeam();
    useProfileStore.setState({ unlockedSpecials: owned });
    startClassic();
    const lineupId = rerollToNational();
    expect(lineupId).not.toBeNull();

    expect(isNationalTeamDiscovered(lineupId!, profile().nationalDiscovered, profile().unlockedSpecials)).toBe(true);
    expect(profile().nationalDiscovered).toEqual({}); // derived, never written back
    expect(useRewardToasts.getState().queue.some((t) => t.kind === "nationalTeam")).toBe(false);
    expect(profile().unlockedSpecials).toEqual(owned); // granted cards are kept
  });
});

describe("national teams — drafting a card collects it (COL-01b)", () => {
  it("collects the drafted card when the run ends — only that card", () => {
    startClassic();
    const lineupId = rerollToNational()!;
    const card = nationalPlayerCard();
    pick(card);
    // Drafted, not collected yet: like every special, it is yours when the run ends.
    expect(profile().unlockedSpecials[card.specialId!]).toBeUndefined();

    draftThrough();
    playToResults();

    expect(profile().unlockedSpecials[card.specialId!]).toBeTruthy();
    expect(run().results!.unlockedSpecialIds).toContain(card.specialId);
    const rest = nationalCardIdsOf(lineupId).filter((id) => id !== card.specialId);
    for (const id of rest) expect(profile().unlockedSpecials[id], id).toBeUndefined();
  });

  it("an abandoned run keeps the discovery and collects nothing", () => {
    startClassic();
    const lineupId = rerollToNational()!;
    const card = nationalPlayerCard();
    pick(card);
    useRunStore.getState().clearRun();

    expect(profile().nationalDiscovered?.[lineupId]).toBeTruthy();
    expect(profile().unlockedSpecials[card.specialId!]).toBeUndefined();
  });

  it("the draw favours what is not complete: a complete team is passed to the engine, a partial one is not", () => {
    const [teamA, teamB] = [...nationalSpecialIdsByLineupId.entries()];
    const owned = {
      ...Object.fromEntries(teamA[1].map((id) => [id, DATE])), // every card: complete
      [teamB[1][0]]: DATE, // one card: found, still incomplete
    };
    useProfileStore.setState({ unlockedSpecials: owned });
    startClassic();
    expect(run().draft.nationalTeams?.complete).toEqual([teamA[0]]);
  });
});

describe("NEW in the draft is decided before the offer (COL-02a)", () => {
  it("every unowned special of the offer is NEW, recorded with the offer's round", () => {
    startClassic();
    const lineupId = rerollToNational()!;
    const offerNew = run().offerNew!;
    expect(offerNew.round).toBe(run().draft.round);
    const offered = run().draft.offer!.cards.map((c) => c.specialId).filter((id): id is string => Boolean(id));
    expect(offered.length).toBeGreaterThan(0);
    expect([...offerNew.ids].sort()).toEqual([...offered].sort());
    expect(offered.every((id) => nationalCardIdsOf(lineupId).includes(id))).toBe(true);
  });

  it("a card shows NEW in the offer that collects it: a grant after the offer does not hide the tag", () => {
    startClassic();
    rerollToNational();
    const card = nationalPlayerCard();
    // Something collects the card while its offer is on screen (the pre-rc.33 find
    // did exactly this): the record taken before the offer still says NEW.
    useProfileStore.getState().collectSpecials([card.specialId!], "classic");
    expect(profile().unlockedSpecials[card.specialId!]).toBeTruthy();
    expect(run().offerNew!.ids).toContain(card.specialId);
  });

  it("a card owned before the offer is not NEW; the rest of the team is", () => {
    const owned = ownOneCardPerTeam();
    useProfileStore.setState({ unlockedSpecials: owned });
    startClassic();
    const lineupId = rerollToNational()!;
    const ids = run().offerNew!.ids;
    const ownedHere = nationalCardIdsOf(lineupId)[0];
    expect(ids).not.toContain(ownedHere);
    const offered = run().draft.offer!.cards.map((c) => c.specialId).filter((id): id is string => Boolean(id));
    for (const id of offered.filter((id) => id !== ownedHere)) expect(ids).toContain(id);
  });

  it("every new offer gets its own record (pick, reroll)", () => {
    startClassic();
    const before = run().draft.round;
    useRunStore.getState().reroll();
    expect(run().offerNew!.round).toBe(run().draft.round);
    expect(run().draft.round).toBeGreaterThan(before);
  });
});
