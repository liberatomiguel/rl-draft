import { describe, expect, it } from "vitest";
import { DUEL_MATCH } from "@/config/balance";
import { buildDuelTeam, duelTeamKey, isKnownDuelTeam, playDuel } from "./duelMatch";
import { makeDuelRules, type DuelRules } from "./duelRules";
import { botDraft } from "./duelTestKit";

const rulesOf = (seed: number, over: Parameters<typeof makeDuelRules>[0] = {}): DuelRules => makeDuelRules(over, seed);
const draftTeam = (draftSeed: number, pickSeed: number, over: Parameters<typeof makeDuelRules>[0] = {}) =>
  botDraft(rulesOf(draftSeed, over), { pickSeed }).team;

const TA = draftTeam(101, 1);
const TB = draftTeam(202, 2);

describe("duel match", () => {
  it("builds known teams and plays a best of 7 to four wins", () => {
    expect(isKnownDuelTeam(TA, "classic")).toBe(true);
    expect(isKnownDuelTeam({ ...TA, players: TA.players.slice(0, 2) }, "classic")).toBe(false);
    expect(isKnownDuelTeam({ ...TA, players: [{ id: "nobody-x-s1" }, ...TA.players.slice(1)] }, "classic")).toBe(false);
    const s = playDuel(rulesOf(5), TA, TB);
    const target = Math.ceil(DUEL_MATCH.bestOf / 2);
    expect(Math.max(...s.score)).toBe(target);
    expect(Math.min(...s.score)).toBeLessThan(target);
    expect(s.games).toHaveLength(s.score[0] + s.score[1]);
    expect(s.games.at(-1)!.after).toEqual(s.score);
    expect(s.games.at(-1)!.winner).toBe(s.winner);
  });

  it("is a function of (seed, both teams) only", () => {
    const r = rulesOf(5);
    const first = playDuel(r, TA, TB);
    expect(playDuel(r, TA, TB)).toEqual(first);
    // The slot a player took, and the order the link lists them in, change nothing.
    expect(playDuel(r, { ...TA, players: [...TA.players].reverse() }, TB)).toEqual(first);
    // Another seed is another series.
    const other = Array.from({ length: 12 }, (_, i) => JSON.stringify(playDuel(rulesOf(1000 + i), TA, TB).games.map((g) => g.final)));
    expect(new Set(other).size).toBeGreaterThan(3);
  });

  it("swapping A and B mirrors the result and changes nothing else", () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const r = rulesOf(seed);
      const ab = playDuel(r, TA, TB);
      const ba = playDuel(r, TB, TA);
      expect(ba.score).toEqual([ab.score[1], ab.score[0]]);
      expect(ba.winner).toBe(ab.winner === "a" ? "b" : "a");
      expect(ba.sides.a).toEqual(ab.sides.b);
      expect(ba.sides.b).toEqual(ab.sides.a);
      expect(ba.games).toHaveLength(ab.games.length);
      ab.games.forEach((g, i) => {
        const m = ba.games[i];
        expect(m.final).toEqual([g.final[1], g.final[0]]);
        expect(m.after).toEqual([g.after[1], g.after[0]]);
        expect(m.winner).toBe(g.winner === "a" ? "b" : "a");
        expect(m.overtime).toBe(g.overtime);
        expect(m.timeline.overtimeSeconds).toBe(g.timeline.overtimeSeconds);
        // The same goals at the same minutes, by the same players, on the other side.
        const key = (beats: typeof g.timeline.beats, swap: boolean) =>
          beats.map((b) =>
            b.kind === "goal"
              ? ["goal", swap ? (b.side === "a" ? "b" : "a") : b.side, b.playerIdx, b.period, b.clock, b.golden]
              : ["ot"],
          );
        expect(key(m.timeline.beats, true)).toEqual(key(g.timeline.beats, false));
        expect(m.box.players.a).toEqual(g.box.players.b);
        expect(m.box.players.b).toEqual(g.box.players.a);
        expect(m.team.a).toEqual(g.team.b);
        expect(m.running.a).toEqual(g.running.b);
      });
      expect(ba.box.totals.a).toEqual(ab.box.totals.b);
    }
  });

  it("gives equal teams about half the series each", () => {
    const n = 500;
    let aWins = 0;
    for (let seed = 1; seed <= n; seed++) if (playDuel(rulesOf(seed), TA, TA).winner === "a") aWins += 1;
    expect(aWins / n).toBeGreaterThan(0.42);
    expect(aWins / n).toBeLessThan(0.58);
  });

  it("lets the stronger team win more often, whichever side it is on", () => {
    const strength = (t: typeof TA) => playDuel(rulesOf(1), t, t).sides.a.rating;
    const pool = [TA, TB, draftTeam(303, 3), draftTeam(404, 4), draftTeam(505, 5), draftTeam(606, 6)].sort((x, y) => strength(y) - strength(x));
    const [best, worst] = [pool[0], pool[pool.length - 1]];
    expect(strength(best)).toBeGreaterThan(strength(worst) + 2);
    let bestWins = 0;
    for (let seed = 1; seed <= 100; seed++) {
      const r = rulesOf(seed);
      if (playDuel(r, best, worst).winner === "a") bestWins += 1;
      if (playDuel(r, worst, best).winner === "b") bestWins += 1;
    }
    expect(bestWins / 200).toBeGreaterThan(0.6);
  });

  it("exposes a clock timeline, team stats and running totals for every game", () => {
    const s = playDuel(rulesOf(9), TA, TB);
    const run = { a: 0, b: 0 };
    for (const g of s.games) {
      expect(g.timeline.final).toEqual(g.final);
      const goals = g.timeline.beats.filter((b) => b.kind === "goal");
      const goalsByTeam = { a: goals.filter((b) => b.kind === "goal" && b.side === "a").length, b: goals.filter((b) => b.kind === "goal" && b.side === "b").length };
      expect([goalsByTeam.a, goalsByTeam.b]).toEqual(g.final);
      expect(g.team.a.goals).toBe(g.final[0]);
      expect(g.team.b.goals).toBe(g.final[1]);
      run.a += g.final[0];
      run.b += g.final[1];
      expect(g.running.a.goals).toBe(run.a);
      expect(g.running.b.goals).toBe(run.b);
      expect(g.overtime).toBe(g.timeline.overtimeSeconds !== null);
      for (const b of g.timeline.beats) {
        if (b.kind === "goal" && b.period === "regulation") {
          expect(b.clock).toBeGreaterThan(0);
          expect(b.clock).toBeLessThan(300);
        }
      }
    }
    expect(s.box.totals.a.length).toBe(3);
    expect(s.sides.a.playerNames).toHaveLength(3);
  });

  it("plays Quick teams too, and refuses cards it does not know", () => {
    const qa = draftTeam(11, 1, { mode: "quick" });
    const qb = draftTeam(12, 2, { mode: "quick" });
    const r = rulesOf(3, { mode: "quick" });
    const s = playDuel(r, qa, qb);
    expect(Math.max(...s.score)).toBe(4);
    expect(() => playDuel(r, { players: [{ id: "x" }, { id: "y" }, { id: "z" }] }, qb)).toThrow();
    expect(() => buildDuelTeam(qa, "classic", "t")).toThrow();
  });

  it("orders teams by their cards, not by the order they are given", () => {
    expect(duelTeamKey({ ...TA, players: [...TA.players].reverse() })).toBe(duelTeamKey(TA));
    expect(duelTeamKey(TA)).not.toBe(duelTeamKey(TB));
  });
});
