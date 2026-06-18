/**
 * Rank-gated rewards (v1.3) — pins the unlock ladder the player was promised:
 * Unranked locks specials + collection, Bronze opens rare + collection, each tier
 * adds a rarity, and the top ranks raise the appearance chance. A config typo in
 * RANK_REWARDS that breaks the progression fails here.
 */

import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/rng";
import { rollSpecial } from "./draft";
import { rankRewardsForXp, rankThatUnlocksRarity } from "./progression";
import type { SpecialCard } from "./types";

describe("rank rewards (v1.3 unlock ladder)", () => {
  it("Unranked locks specials and the collection", () => {
    const r = rankRewardsForXp(0);
    expect(r.rarities).toEqual([]);
    expect(r.specialChance).toBe(0);
    expect(r.collection).toBe(false);
  });

  it("Bronze (≈one run) opens rare + collection", () => {
    const r = rankRewardsForXp(250);
    expect(r.rarities).toContain("rare");
    expect(r.rarities).not.toContain("epic");
    expect(r.collection).toBe(true);
  });

  it("each rank adds the next rarity in order", () => {
    expect(rankRewardsForXp(1200).rarities).toEqual(["rare", "epic"]); // Silver
    expect(rankRewardsForXp(3000).rarities).toContain("mythic"); // Gold
    expect(rankRewardsForXp(3000).rarities).not.toContain("legendary");
    expect(rankRewardsForXp(11500).rarities).toContain("legendary"); // Diamond
  });

  it("every difficulty is open from any rank (v1.3.2 — Hard no longer gated)", () => {
    expect(rankRewardsForXp(0).hardMode).toBe(true); // Unranked
    expect(rankRewardsForXp(250).hardMode).toBe(true); // Bronze
  });

  it("appearance chance ramps only at the very top", () => {
    expect(rankRewardsForXp(250).specialChance).toBe(0.05); // Bronze..Diamond
    expect(rankRewardsForXp(11500).specialChance).toBe(0.05); // Diamond
    expect(rankRewardsForXp(19000).specialChance).toBe(0.08); // Champion
    expect(rankRewardsForXp(29000).specialChance).toBe(0.12); // Grand Champion
    expect(rankRewardsForXp(50000).specialChance).toBe(0.16); // SSL
  });

  it("rankThatUnlocksRarity reports the gating rank label", () => {
    expect(rankThatUnlocksRarity("rare")).toBe("Bronze");
    expect(rankThatUnlocksRarity("epic")).toBe("Silver");
    expect(rankThatUnlocksRarity("mythic")).toBe("Gold");
    expect(rankThatUnlocksRarity("legendary")).toBe("Diamond");
  });
});

describe("rollSpecial rarity gate", () => {
  const fake = (id: string, rarity: SpecialCard["rarity"]): SpecialCard =>
    ({ id, rarity }) as SpecialCard;
  const pool = [fake("r", "rare"), fake("e", "epic"), fake("l", "legendary")];

  it("an empty allow-list (Unranked) yields no special even at 100% chance", () => {
    expect(rollSpecial(pool, 1, createRng(1), [])).toBeUndefined();
  });

  it("only allowed rarities can appear", () => {
    // rare-only allow-list, 100% chance, many draws → always the rare card.
    for (let i = 0; i < 50; i++) {
      expect(rollSpecial(pool, 1, createRng(i + 1), ["rare"])).toBe("r");
    }
  });

  it("undefined allow-list = no gate (daily / legacy callers)", () => {
    const got = new Set<string | undefined>();
    for (let i = 0; i < 200; i++) got.add(rollSpecial(pool, 1, createRng(i + 1)));
    expect(got.size).toBeGreaterThan(1); // a mix of rarities appears
  });
});
