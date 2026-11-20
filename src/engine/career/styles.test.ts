import { describe, expect, it } from "vitest";
import { CAREER_DEV, CAREER_MATCHDAY as MD } from "@/config/balance";
import { createRng } from "@/lib/rng";
import type { PlayStyleId, Stats, TournamentTeam } from "../types";
import { deriveAttrOffsets } from "./development";
import type { ArchetypeId } from "./types";
import { PLAY_STYLES, styleBeats, styleMatchupBonus, teamStyleFor, type StylePlayer } from "./styles";

const flat = (v: number): Stats => ({ offense: v, defense: v, mechanics: v, consistency: v, experience: v, clutch: v });
const ARCHETYPES = ["mechanical", "anchor", "playmaker", "icecold", "veteranmind", "allround"];

function randomPlayer(rng: ReturnType<typeof createRng>, withArchetype: boolean): StylePlayer {
  const base = rng.int(72, 95);
  const stats = {} as Stats;
  for (const k of Object.keys(flat(0)) as (keyof Stats)[]) stats[k] = base + rng.int(-5, 5);
  return withArchetype ? { stats, archetype: rng.pick(ARCHETYPES) } : { stats };
}

function side(id: string, played: PlayStyleId, fit: number): TournamentTeam {
  const fits = Object.fromEntries(PLAY_STYLES.map((s) => [s, fit])) as Record<PlayStyleId, number>;
  return { id, style: { natural: played, fit: fits } } as unknown as TournamentTeam;
}

describe("Matchday styles (MATCHDAY-SPEC §4)", () => {
  it("is a five-style cycle: each style beats exactly the next one", () => {
    expect(PLAY_STYLES).toEqual(["pressure", "possession", "counter", "individual", "teamplay"]);
    expect(styleBeats("pressure")).toBe("possession");
    expect(styleBeats("possession")).toBe("counter");
    expect(styleBeats("counter")).toBe("individual");
    expect(styleBeats("individual")).toBe("teamplay");
    expect(styleBeats("teamplay")).toBe("pressure");
    expect(new Set(PLAY_STYLES.map(styleBeats)).size).toBe(5);
  });

  it("is deterministic and does not touch its input", () => {
    const rng = createRng(77);
    const players = [randomPlayer(rng, true), randomPlayer(rng, true), randomPlayer(rng, false)];
    const copy = JSON.parse(JSON.stringify(players));
    expect(teamStyleFor(players)).toEqual(teamStyleFor(copy));
    expect(players).toEqual(copy);
  });

  it("reads attributes against each player's own mean, so overall alone never picks a style", () => {
    const lowFlat = teamStyleFor([{ stats: flat(70) }, { stats: flat(70) }, { stats: flat(70) }]);
    const highFlat = teamStyleFor([{ stats: flat(95) }, { stats: flat(95) }, { stats: flat(95) }]);
    expect(highFlat).toEqual(lowFlat);
  });

  it("leans on the archetype and on the attributes", () => {
    const mech = teamStyleFor([0, 1, 2].map(() => ({ stats: flat(85), archetype: "mechanical" })));
    expect(mech.natural).toBe("individual");
    const wall = { ...flat(84), defense: 92, clutch: 88 };
    expect(teamStyleFor([{ stats: wall }, { stats: wall }, { stats: wall }]).natural).toBe("counter");
    const thinkers = { ...flat(84), experience: 92, consistency: 88 };
    expect(teamStyleFor([{ stats: thinkers }, { stats: thinkers }, { stats: thinkers }]).natural).toBe("teamplay");
  });

  it("keeps every fit in [fitMin, 1], with the natural style the best fit", () => {
    const rng = createRng(4242);
    for (let i = 0; i < 2000; i++) {
      const s = teamStyleFor([randomPlayer(rng, i % 2 === 0), randomPlayer(rng, true), randomPlayer(rng, false)]);
      for (const style of PLAY_STYLES) {
        expect(s.fit[style]).toBeGreaterThanOrEqual(MD.fitMin);
        expect(s.fit[style]).toBeLessThanOrEqual(s.fit[s.natural]);
      }
      expect(s.fit[s.natural]).toBeGreaterThanOrEqual(MD.fitNaturalBase);
      expect(s.fit[s.natural]).toBeLessThanOrEqual(1);
    }
  });

  it("spreads natural styles over the five (no style dominates the world)", () => {
    // Real career players: the archetype mix of CAREER_DEV and development.ts's offsets.
    const rng = createRng(9100);
    const weights = Object.entries(CAREER_DEV.archetypeWeights as Record<string, number>);
    const total = weights.reduce((s, [, w]) => s + w, 0);
    const pickArchetype = () => {
      let u = rng.next() * total;
      for (const [id, w] of weights) if ((u -= w) < 0) return id;
      return weights[weights.length - 1][0];
    };
    const count = Object.fromEntries(PLAY_STYLES.map((s) => [s, 0])) as Record<PlayStyleId, number>;
    const n = 5000;
    for (let i = 0; i < n; i++) {
      const players = [0, 1, 2].map((j) => {
        const archetype = pickArchetype();
        const off = deriveAttrOffsets(`p${i}-${j}`, 9100, archetype as ArchetypeId);
        const s = flat(85);
        for (const k of Object.keys(s) as (keyof Stats)[]) s[k] += off[k];
        return { stats: s };
      });
      count[teamStyleFor(players).natural]++;
    }
    for (const style of PLAY_STYLES) {
      expect(count[style] / n).toBeGreaterThan(0.1);
      expect(count[style] / n).toBeLessThan(0.34);
    }
  });

  it("gives the matchup to one side at most, never above matchupCap × fit", () => {
    for (const a of PLAY_STYLES) for (const b of PLAY_STYLES) {
      const ta = side("a", a, 1), tb = side("b", b, 0.7);
      const ba = styleMatchupBonus(ta, tb), bb = styleMatchupBonus(tb, ta);
      expect(ba === 0 || bb === 0).toBe(true);
      if (styleBeats(a) === b) expect(ba).toBeCloseTo(MD.matchupCap, 10);
      else expect(ba).toBe(0);
      if (styleBeats(b) === a) expect(bb).toBeCloseTo(MD.matchupCap * 0.7, 10);
      if (a === b) expect(ba + bb).toBe(0);
    }
    const plain = { id: "c" } as TournamentTeam;
    expect(styleMatchupBonus(side("a", "pressure", 1), plain)).toBe(0);
    expect(styleMatchupBonus(plain, side("a", "possession", 1))).toBe(0);
  });

  it("uses the played style when a plan sets one", () => {
    const a = side("a", "teamplay", 1);
    a.style!.played = "pressure";
    expect(styleMatchupBonus(a, side("b", "possession", 1))).toBeCloseTo(MD.matchupCap, 10);
  });
});
