import { describe, expect, it } from "vitest";
import { lineupById, lineupPoolForRegion } from "@/data";
import { duelBoardLineup, duelReroll, startDuelDraft } from "./duelDraft";
import { makeDuelRules, DUEL_REGIONS } from "./duelRules";
import { botDraft } from "./duelTestKit";

const rules = (over: Parameters<typeof makeDuelRules>[0] = {}, seed = 20251127) => makeDuelRules(over, seed);

describe("duel draft: boards are a function of (seed, slot, reroll index)", () => {
  it("two different reroll paths see identical boards wherever (slot, index) coincide", () => {
    const r = rules({ rerolls: 7 });
    const quiet = botDraft(r, { pickSeed: 1 });
    const busy = botDraft(r, { pickSeed: 2, rerollsAt: { 0: 3, 2: 2, 4: 2 } });
    const heavy = botDraft(r, { pickSeed: 3, rerollsAt: { 0: 1, 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 } });
    let shared = 0;
    for (const [a, b] of [[quiet, busy], [quiet, heavy], [busy, heavy]]) {
      for (const [key, board] of a.seen) {
        const other = b.seen.get(key);
        if (other === undefined) continue;
        shared += 1;
        expect(other, `board ${key}`).toBe(board);
      }
    }
    expect(shared).toBeGreaterThan(8);
    // The busy friend really did see boards the quiet one did not.
    expect([...busy.seen.keys()].some((k) => !quiet.seen.has(k))).toBe(true);
  });

  it("the first board of the first slot is the same for everyone, and a reroll walks the same boards", () => {
    const r = rules();
    const a = startDuelDraft(r);
    const b = startDuelDraft(r);
    expect(a).toEqual(b);
    const a1 = duelReroll(a);
    const b1 = duelReroll(duelReroll(b));
    expect(a1.boardIndex).toBe(1);
    expect(a1.draft.offer!.lineupId).toBe(duelBoardLineup(r, 0, 1));
    expect(b1.boardIndex).toBe(2);
    expect(b1.draft.offer!.lineupId).toBe(duelBoardLineup(r, 0, 2));
  });

  it("a different seed draws different boards", () => {
    const lineups = (seed: number) => Array.from({ length: 6 }, (_, i) => duelBoardLineup(rules({}, seed), i, 0));
    expect(lineups(1)).not.toEqual(lineups(2));
  });

  it("is deterministic and keeps nothing between calls", () => {
    const r = rules();
    expect(duelBoardLineup(r, 3, 2)).toBe(duelBoardLineup(r, 3, 2));
    expect(botDraft(r, { pickSeed: 9 }).team).toEqual(botDraft(r, { pickSeed: 9 }).team);
  });
});

describe("duel draft: rules", () => {
  it("spends exactly the rerolls the rules give, for the whole draft", () => {
    for (const rerolls of [0, 3, 7]) {
      let d = startDuelDraft(rules({ rerolls }));
      expect(d.draft.rerollsLeft).toBe(rerolls);
      for (let i = 0; i < rerolls; i++) d = duelReroll(d);
      expect(d.draft.rerollsLeft).toBe(0);
      expect(() => duelReroll(d)).toThrow();
    }
  });

  it("completes a classic and a quick draft, with the cards the mode needs", () => {
    const classic = botDraft(rules({ mode: "classic" }), { pickSeed: 5 });
    expect(classic.team.players).toHaveLength(3);
    expect(classic.team.coach && classic.team.sub && classic.team.orgLineup).toBeTruthy();
    expect(classic.team.players.map((p) => p.id)).toEqual([...classic.team.players.map((p) => p.id)].sort());
    const quick = botDraft(rules({ mode: "quick" }), { pickSeed: 5 });
    expect(quick.team.players).toHaveLength(3);
    expect(quick.team.coach).toBeUndefined();
    expect(quick.team.orgLineup).toBeUndefined();
  });

  it("draws only from the region's pool, and every region can finish a draft", () => {
    for (const region of DUEL_REGIONS) {
      const r = rules({ region }, 777);
      const pool = new Set(lineupPoolForRegion(region));
      const log = botDraft(r, { pickSeed: 4 });
      expect(log.draft.draft.complete).toBe(true);
      for (let slot = 0; slot < 6; slot++) expect(pool.has(duelBoardLineup(r, slot, 0))).toBe(true);
      expect(lineupById.get(log.team.orgLineup!)).toBeTruthy();
    }
  });

  it("never offers a person already drafted as a pickable card", () => {
    const log = botDraft(rules({}, 31337), { pickSeed: 11 });
    const ids = [...log.team.players.map((p) => p.id), log.team.coach!.id, log.team.sub!.id];
    expect(new Set(ids).size).toBe(ids.length);
  });
});
