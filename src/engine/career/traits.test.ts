import { describe, expect, it } from "vitest";
import { CAREER_MATCHDAY as MD, SIMULATION } from "@/config/balance";
import type { TraitId, TournamentTeam } from "../types";
import { playerTraits, TRAIT_IDS, traitBounce, traitCountFor, traitGameEffects } from "./traits";

const withTraits = (traits: TraitId[][], extra: Partial<TournamentTeam> = {}) =>
  ({ id: "t", traits, ...extra }) as unknown as TournamentTeam;

describe("Matchday traits (MATCHDAY-SPEC §5)", () => {
  it("derives the same traits from the same key, overall and archetype", () => {
    for (let i = 0; i < 300; i++) {
      const key = `player-${i}`;
      expect(playerTraits(key, 85, "anchor")).toEqual(playerTraits(key, 85, "anchor"));
    }
    // Pinned: a change to the salt or the pick silently reshuffles every player.
    expect([0, 1, 2, 3, 4, 5].map((i) => playerTraits(`pin-${i}`, 86, "playmaker"))).toMatchSnapshot();
  });

  it("gives 0–2 distinct traits and never an exclusive pair", () => {
    for (let i = 0; i < 4000; i++) {
      const t = playerTraits(`k${i}`, 70 + (i % 28), ["mechanical", "anchor", "icecold", undefined][i % 4]);
      expect(t.length).toBeLessThanOrEqual(2);
      expect(new Set(t).size).toBe(t.length);
      for (const id of t) expect(TRAIT_IDS).toContain(id);
      expect(t.includes("streaky") && t.includes("consistent")).toBe(false);
      expect(t.includes("hotHeaded") && t.includes("iceCold")).toBe(false);
    }
  });

  it("matches the count chances at the pivot, and a higher overall carries more traits", () => {
    const n = 6000;
    const counts = [0, 0, 0];
    for (let i = 0; i < n; i++) counts[traitCountFor(`c${i}`, MD.traitCountOverallPivot)]++;
    MD.traitCountChance.forEach((p, k) => expect(Math.abs(counts[k] / n - p)).toBeLessThan(0.03));
    const mean = (ovr: number) => {
      let s = 0;
      for (let i = 0; i < n; i++) s += traitCountFor(`c${i}`, ovr);
      return s / n;
    };
    expect(mean(94)).toBeGreaterThan(mean(76) + 0.1);
  });

  it("tilts by archetype: ice-cold players are ice-cold far more often", () => {
    const share = (arch: string, id: TraitId) => {
      let hit = 0;
      for (let i = 0; i < 4000; i++) if (playerTraits(`a${i}`, 85, arch).includes(id)) hit++;
      return hit / 4000;
    };
    expect(share("icecold", "iceCold")).toBeGreaterThan(2 * share("mechanical", "iceCold"));
    expect(share("mechanical", "streaky")).toBeGreaterThan(2 * share("anchor", "streaky"));
  });

  it("is neutral without traits", () => {
    const plain = { id: "p" } as TournamentTeam;
    expect(traitGameEffects(plain, { gameIndex: 1, deciding: true })).toEqual({ shift: 0, overtime: 0, rollScale: 1 });
    expect(traitBounce(SIMULATION.momentumBounce, plain, plain, true)).toBe(SIMULATION.momentumBounce);
    expect(traitGameEffects(withTraits([[], [], []]), { gameIndex: 3, deciding: true }).shift).toBe(0);
  });

  it("applies the form traits in their moment and stays within the caps", () => {
    const decisive = withTraits([["decisive"], ["decisive"], ["decisive"]]);
    expect(traitGameEffects(decisive, { gameIndex: 2, deciding: false }).shift).toBe(0);
    expect(traitGameEffects(decisive, { gameIndex: 5, deciding: true }).shift).toBeCloseTo(Math.min(0.75, MD.traitCap), 10);
    expect(traitGameEffects(decisive, { gameIndex: 2, deciding: false }).overtime).toBeCloseTo(3 * MD.decisiveBonus, 10);

    const slow = withTraits([["slowStarter"], [], []]);
    expect(traitGameEffects(slow, { gameIndex: 1, deciding: false }).shift).toBe(MD.slowStarterGame1);
    expect(traitGameEffects(slow, { gameIndex: 2, deciding: false }).shift).toBe(0);
    expect(traitGameEffects(slow, { gameIndex: 3, deciding: false }).shift).toBe(MD.slowStarterFromGame3);

    expect(traitGameEffects(withTraits([["lan"], [], []]), { gameIndex: 1, deciding: false }).shift).toBe(0);
    expect(traitGameEffects(withTraits([["lan"], [], []], { lanEvent: true }), { gameIndex: 1, deciding: false }).shift).toBe(MD.lanBonus);

    expect(traitGameEffects(withTraits([["streaky"], ["streaky"], []]), { gameIndex: 1, deciding: false }).rollScale).toBeGreaterThan(1);
    expect(traitGameEffects(withTraits([["consistent"], [], []]), { gameIndex: 1, deciding: false }).rollScale).toBeLessThan(1);

    const all = withTraits([["decisive", "lan"], ["decisive", "slowStarter"], ["decisive", "streaky"]], { lanEvent: true });
    for (let g = 1; g <= 7; g++) for (const deciding of [false, true]) {
      const fx = traitGameEffects(all, { gameIndex: g, deciding });
      expect(Math.abs(fx.shift)).toBeLessThanOrEqual(MD.traitCap);
      expect(fx.rollScale).toBeGreaterThanOrEqual(MD.rollScaleRange[0]);
      expect(fx.rollScale).toBeLessThanOrEqual(MD.rollScaleRange[1]);
    }
  });

  it("bends the existing bounce with the behaviour traits, within the cap", () => {
    const base = SIMULATION.momentumBounce;
    const leaders = withTraits([["leader"], ["leader"], []]);
    const hot = withTraits([["hotHeaded"], ["hotHeaded"], ["hotHeaded"]]);
    const cold = withTraits([["iceCold"], [], []]);
    const none = withTraits([[], [], []]);
    expect(traitBounce(base, leaders, none, false)).toBeCloseTo(base + 2 * MD.leaderBounce, 10);
    expect(traitBounce(base, hot, none, false)).toBe(base);
    expect(traitBounce(base, hot, none, true)).toBeCloseTo(base - MD.bounceTraitCap, 10);
    expect(traitBounce(base, none, cold, false)).toBeCloseTo(base + MD.iceColdOpponentBounce, 10);
  });
});
