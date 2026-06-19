/**
 * Dataset integrity. Importing the data module runs schema validation and
 * referential checks — this suite makes that a first-class CI gate.
 * Run alone with: npm run validate:data
 */

import { describe, expect, it } from "vitest";
import {
  achievements,
  challenges,
  coaches,
  datasetSummary,
  lineupById,
  lineups,
  orgs,
  playerCardById,
  playerCards,
  players,
  specialCards,
  subs,
} from "./index";

describe("dataset", () => {
  it("loads and validates every JSON file", () => {
    expect(datasetSummary).toEqual({
      players: players.length,
      playerCards: playerCards.length,
      lineups: lineups.length,
      orgs: orgs.length,
      coaches: coaches.length,
      subs: subs.length,
      specialCards: specialCards.length,
      achievements: achievements.length,
      challenges: challenges.length,
    });
  });

  it("meets the base-document minimum dataset size (§36)", () => {
    expect(lineups.length).toBeGreaterThanOrEqual(15);
    expect(playerCards.length).toBeGreaterThanOrEqual(45);
    expect(orgs.length).toBeGreaterThanOrEqual(10);
    expect(coaches.length).toBeGreaterThanOrEqual(8);
    expect(specialCards.length).toBeGreaterThanOrEqual(5);
  });

  it("every lineup has exactly its 3 player cards pointing back at it", () => {
    for (const lineup of lineups) {
      expect(lineup.playerCardIds).toHaveLength(3);
      for (const id of lineup.playerCardIds) {
        expect(playerCardById.get(id)?.lineupId).toBe(lineup.id);
      }
    }
  });

  it("special cards map to real base cards inside real lineups", () => {
    for (const sp of specialCards) {
      if (sp.kind === "coach") {
        const base = coaches.find((c) => c.id === sp.baseCardId);
        expect(base, sp.id).toBeDefined();
        expect(lineupById.get(base!.lineupId)).toBeDefined();
      } else {
        const base = playerCardById.get(sp.baseCardId);
        expect(base, sp.id).toBeDefined();
        expect(lineupById.get(base!.lineupId)).toBeDefined();
      }
    }
  });

  it("players can have multiple cards across seasons (core rule §9)", () => {
    const byPlayer = new Map<string, number>();
    for (const card of playerCards) {
      byPlayer.set(card.playerId, (byPlayer.get(card.playerId) ?? 0) + 1);
    }
    const multiCard = [...byPlayer.values()].filter((n) => n >= 2);
    expect(multiCard.length).toBeGreaterThanOrEqual(8);
  });

  // -------------------------------------------------------------------------
  // Identity unification contract (v0.5/v0.5.1). Spelling variants of the
  // same person/org MUST share one id; same-name strangers MUST NOT.
  // -------------------------------------------------------------------------

  it("zen (EU) and ZeN (OCE) are different people", () => {
    const zenEu = players.find((p) => p.id === "zen");
    const zenOce = players.find((p) => p.id === "zen-oce");
    expect(zenEu?.region).toBe("EU");
    expect(zenOce?.region).toBe("OCE");
  });

  it("org era spellings are unified — alias sources never become orgs", () => {
    const ids = new Set(orgs.map((o) => o.id));
    // Aliased era spellings (see ORG_ALIAS in scripts/build-dataset.mjs):
    for (const stale of [
      "renault-vitality",
      "team-dignitas",
      "chiefs-esc",
      "mockit-esports",
      "mock-it-esports-eu",
      "quiktrip-pioneers-gaming",
    ]) {
      expect(ids.has(stale), `"${stale}" should be an alias, not an org`).toBe(false);
    }
    // Their canonical identities exist:
    for (const canonical of ["team-vitality", "dignitas", "chiefs-esports-club", "mock-it-esports"]) {
      expect(ids.has(canonical), canonical).toBe(true);
    }
  });

  it("same-name orgs from different regions stay separate", () => {
    const ids = new Set(orgs.map((o) => o.id));
    for (const split of ["pioneers-oce", "pioneers-ssa", "fut-esports-na", "fut-esports-ssa"]) {
      expect(ids.has(split), split).toBe(true);
    }
    expect(ids.has("pioneers")).toBe(false);
    expect(ids.has("fut-esports")).toBe(false);
  });
});
