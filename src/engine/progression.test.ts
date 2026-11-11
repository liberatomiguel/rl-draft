/**
 * Rank-gated rewards (v1.3) — pins the unlock ladder the player was promised:
 * Unranked locks specials + collection, Bronze opens rare + collection, each tier
 * adds a rarity, and the top ranks raise the appearance chance. A config typo in
 * RANK_REWARDS that breaks the progression fails here.
 */

import { describe, expect, it } from "vitest";
import { RANKS } from "@/config/balance";
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

  it("Bronze (one run) opens the collection; the special curve starts at Silver", () => {
    const r = rankRewardsForXp(250);
    expect(r.rarities).toEqual([]);
    expect(r.specialChance).toBe(0);
    expect(r.collection).toBe(true);
  });

  it("each rank from Silver adds the next rarity in order", () => {
    const at = (id: string) => rankRewardsForXp(RANKS.find((r) => r.id === id)!.minXp).rarities;
    expect(at("silver")).toContain("rare");
    expect(at("silver")).not.toContain("epic");
    expect(at("gold")).toContain("epic");
    expect(at("gold")).not.toContain("mythic");
    expect(at("platinum")).toContain("mythic");
    expect(at("platinum")).not.toContain("legendary");
    expect(at("diamond")).toContain("legendary");
  });

  it("FIFAe national teams join the curve at Gold", () => {
    const at = (id: string) => rankRewardsForXp(RANKS.find((r) => r.id === id)!.minXp).rarities;
    expect(at("silver")).not.toContain("national");
    expect(at("gold")).toContain("national");
    expect(rankThatUnlocksRarity("national")?.id).toBe("gold");
  });

  it("the secret Creator card is eligible with the first rarity (easter egg, not advertised)", () => {
    expect(rankRewardsForXp(250).rarities).not.toContain("creator"); // Bronze: nothing
    expect(rankRewardsForXp(RANKS.find((r) => r.id === "silver")!.minXp).rarities).toContain("creator");
  });

  it("every difficulty is open from any rank (v1.3.2 — Hard no longer gated)", () => {
    expect(rankRewardsForXp(0).hardMode).toBe(true); // Unranked
    expect(rankRewardsForXp(250).hardMode).toBe(true); // Bronze
  });

  it("appearance chance is flat to Platinum and ramps from Diamond up", () => {
    const at = (id: string) => rankRewardsForXp(RANKS.find((r) => r.id === id)!.minXp).specialChance;
    expect(at("silver")).toBe(0.04);
    expect(at("platinum")).toBe(0.04);
    expect(at("diamond")).toBe(0.05);
    expect(at("champion")).toBe(0.08);
    expect(at("grand-champion")).toBe(0.12);
    expect(at("supersonic-legend")).toBe(0.16);
  });

  it("the Season ladder climbs strictly and closes at 675k", () => {
    for (let i = 1; i < RANKS.length; i++) expect(RANKS[i].minXp).toBeGreaterThan(RANKS[i - 1].minXp);
    expect(RANKS[1].minXp).toBe(200);
    expect(RANKS[RANKS.length - 1].minXp).toBe(675000);
  });

  it("rankThatUnlocksRarity reports the gating rank (id + label)", () => {
    expect(rankThatUnlocksRarity("rare")).toEqual({ id: "silver", label: "Silver" });
    expect(rankThatUnlocksRarity("epic")?.label).toBe("Gold");
    expect(rankThatUnlocksRarity("mythic")?.label).toBe("Platinum");
    expect(rankThatUnlocksRarity("legendary")?.label).toBe("Diamond");
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
