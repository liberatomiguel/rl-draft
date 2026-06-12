/**
 * Dataset integrity. Importing the data module runs schema validation and
 * referential checks — this suite makes that a first-class CI gate.
 * Run alone with: npm run validate:data
 */

import { describe, expect, it } from "vitest";
import {
  achievements,
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
});
