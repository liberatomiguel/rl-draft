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
    const silver = rankRewardsForXp(1500).rarities; // Silver
    expect(silver).toContain("epic");
    expect(silver).not.toContain("mythic");
    expect(rankRewardsForXp(4000).rarities).toContain("mythic"); // Gold
    expect(rankRewardsForXp(4000).rarities).not.toContain("legendary"); // …not yet
    expect(rankRewardsForXp(8500).rarities).toContain("legendary"); // Platinum (v1.4)
  });

  it("the secret Creator card is eligible from Bronze (easter egg, not advertised)", () => {
    expect(rankRewardsForXp(0).rarities).not.toContain("creator"); // Unranked: nothing
    expect(rankRewardsForXp(250).rarities).toContain("creator"); // Bronze+
  });

  it("every difficulty is open from any rank (v1.3.2 — Hard no longer gated)", () => {
    expect(rankRewardsForXp(0).hardMode).toBe(true); // Unranked
    expect(rankRewardsForXp(250).hardMode).toBe(true); // Bronze
  });

  it("appearance chance ramps from Diamond up (v1.4)", () => {
    expect(rankRewardsForXp(250).specialChance).toBe(0.04); // Bronze..Platinum flat
    expect(rankRewardsForXp(8500).specialChance).toBe(0.04); // Platinum (legendary unlocks, chance flat)
    expect(rankRewardsForXp(15000).specialChance).toBe(0.06); // Diamond — ramp begins
    expect(rankRewardsForXp(24000).specialChance).toBe(0.09); // Champion
    expect(rankRewardsForXp(38000).specialChance).toBe(0.12); // Grand Champion
    expect(rankRewardsForXp(60000).specialChance).toBe(0.16); // SSL
  });

  it("rankThatUnlocksRarity reports the gating rank (id + label)", () => {
    expect(rankThatUnlocksRarity("rare")).toEqual({ id: "bronze", label: "Bronze" });
    expect(rankThatUnlocksRarity("epic")?.label).toBe("Silver");
    expect(rankThatUnlocksRarity("mythic")?.label).toBe("Gold");
    expect(rankThatUnlocksRarity("legendary")?.label).toBe("Platinum");
  });
});

describe("rollSpecial — rank gate + per-rarity rates (v1.4)", () => {
  const fake = (id: string, rarity: SpecialCard["rarity"]): SpecialCard =>
    ({ id, rarity }) as SpecialCard;
  const pool = [fake("r", "rare"), fake("e", "epic"), fake("l", "legendary")];

  it("an empty allow-list (Unranked) yields no special even at a huge mult", () => {
    expect(rollSpecial(pool, 100, createRng(1), [])).toBeUndefined();
  });

  it("a rare-only gate never shows epic/legendary, even at a huge mult", () => {
    for (let i = 0; i < 50; i++) {
      expect(rollSpecial(pool, 100, createRng(i + 1), ["rare"])).toBe("r");
    }
  });

  it("no gate (undefined) lets a higher rarity surface — rarest-first wins at huge mult", () => {
    // ORDER is rarest-first, so a huge mult forces the rarest OWNED tier.
    expect(rollSpecial(pool, 100, createRng(7))).toBe("l");
  });

  it("a lone legendary appears far less often than a lone rare (the v1.4 decoupling)", () => {
    // The core fix: a player whose ONLY special is legendary (kronovi) must show
    // it at the LEGENDARY rate, not at the flat special-trigger rate — i.e. the
    // appearance rate is per-rarity and independent of pool size.
    const loneRare = [fake("r", "rare")];
    const loneLegend = [fake("l", "legendary")];
    let rares = 0;
    let legends = 0;
    for (let i = 0; i < 8000; i++) {
      if (rollSpecial(loneRare, 1, createRng(i + 1))) rares++;
      if (rollSpecial(loneLegend, 1, createRng(i + 100001))) legends++;
    }
    // rate 0.045 vs 0.010 → rare ~4.5x more common than legendary.
    expect(rares).toBeGreaterThan(legends * 2.5);
    expect(legends).toBeGreaterThan(0); // legendaries still appear sometimes
  });
});
