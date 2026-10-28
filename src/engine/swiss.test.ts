import { describe, expect, it } from "vitest";
import { createRng, type Rng } from "@/lib/rng";
import {
  createSwissState,
  pairActiveTeams,
  playSwissRound,
  seedsFromSwiss,
  swissHistory,
  upcomingSwissPairings,
} from "./swiss";
import type { SwissState, SwissTeamRecord, TournamentTeam } from "./types";

function fakeTeam(id: string, rating: number): TournamentTeam {
  return {
    id,
    name: id,
    isUser: false,
    region: "NA",
    rating: {
      avgPlayerOverall: rating,
      coachMod: 0,
      subMod: 0,
      orgMod: 0,
      chemMod: 0,
      specialMod: 0,
      difficultyShift: 0,
      total: rating,
    },
    chemistry: { raw: 0, max: 16, percent: 0, tier: "Poor", items: [] },
    stats: { offense: 85, defense: 85, mechanics: 85, consistency: 85, experience: 85, clutch: 85 },
    specialIds: [],
    playerNames: ["A", "B", "C"],
    orgId: "",
  };
}

describe("swiss stage (§24)", () => {
  it("16 teams resolve into exactly 8 advanced and 8 eliminated within 5 rounds", () => {
    for (const seed of [3, 17, 256]) {
      const rng = createRng(seed);
      const teams: Record<string, TournamentTeam> = {};
      for (let i = 0; i < 16; i++) {
        teams[`t${i}`] = fakeTeam(`t${i}`, 80 + i);
      }

      let state = createSwissState(Object.keys(teams), rng);
      let guard = 0;
      while (!state.finished && guard < 6) {
        state = playSwissRound(state, teams, "normal", rng);
        guard += 1;
      }

      expect(state.finished).toBe(true);
      expect(state.rounds.length).toBeLessThanOrEqual(5);

      const advanced = state.records.filter((r) => r.status === "advanced");
      const eliminated = state.records.filter((r) => r.status === "eliminated");
      expect(advanced).toHaveLength(8);
      expect(eliminated).toHaveLength(8);
      for (const r of advanced) {
        expect(r.wins).toBe(3);
        expect(r.losses).toBeLessThan(3);
      }
      for (const r of eliminated) {
        expect(r.losses).toBe(3);
        expect(r.wins).toBeLessThan(3);
      }

      // Game diff is zero-sum across the field.
      expect(state.records.reduce((sum, r) => sum + r.gameDiff, 0)).toBe(0);

      const seeds = seedsFromSwiss(state, teams);
      expect(seeds).toHaveLength(8);
      expect(new Set(seeds).size).toBe(8);
    }
  });

  it("pre-computes next pairings so the UI can show the upcoming opponent", () => {
    const rng = createRng(9);
    const teams: Record<string, TournamentTeam> = {};
    for (let i = 0; i < 16; i++) teams[`t${i}`] = fakeTeam(`t${i}`, 84 + (i % 8));

    let state = createSwissState(Object.keys(teams), rng);
    expect(state.nextPairings).toHaveLength(8);

    state = playSwissRound(state, teams, "normal", rng);
    expect(state.nextPairings).toHaveLength(8); // round 2: 4 in 1-0, 4 in 0-1
  });
});

// ---------------------------------------------------------------------------
// v2.0 rc.27 — no rematch inside one Swiss (DESIGN-DECISIONS #143)
// ---------------------------------------------------------------------------

const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/** The pre-rc.27 pairer, verbatim: one shuffle per record group, pairs popped off the end. */
function legacyPairActiveTeams(records: SwissTeamRecord[], rng: Rng): [string, string][] {
  const active = records.filter((r) => r.status === "active");
  const groups = new Map<string, SwissTeamRecord[]>();
  for (const record of active) {
    const key = `${record.wins}-${record.losses}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(record);
  }
  const orderedKeys = [...groups.keys()].sort((a, b) => {
    const [aw, al] = a.split("-").map(Number);
    const [bw, bl] = b.split("-").map(Number);
    return bw - aw || al - bl;
  });
  const pairs: [string, string][] = [];
  let carry: SwissTeamRecord | null = null;
  for (const key of orderedKeys) {
    const group = rng.shuffle(groups.get(key)!);
    if (carry) {
      group.unshift(carry);
      carry = null;
    }
    while (group.length >= 2) {
      const a = group.pop()!;
      const b = group.pop()!;
      pairs.push([a.teamId, b.teamId]);
    }
    if (group.length === 1) carry = group[0];
  }
  return pairs;
}

function freshRecords(n: number): SwissTeamRecord[] {
  return Array.from({ length: n }, (_, i) => ({
    teamId: `t${i}`,
    wins: 0,
    losses: 0,
    gameDiff: 0,
    status: "active" as const,
  }));
}

/** Applies coin-flip results to a pairing (bookkeeping only — no match sim). */
function applyCoinFlips(records: SwissTeamRecord[], pairs: [string, string][], flips: Rng): SwissTeamRecord[] {
  const next = records.map((r) => ({ ...r }));
  for (const [a, b] of pairs) {
    const aWins = flips.chance(0.5);
    const w = next.find((r) => r.teamId === (aWins ? a : b))!;
    const l = next.find((r) => r.teamId === (aWins ? b : a))!;
    w.wins += 1;
    l.losses += 1;
    if (w.wins >= 3) w.status = "advanced";
    if (l.losses >= 3) l.status = "eliminated";
  }
  return next;
}

/**
 * Every round pairs each active team exactly once, inside its own record, with
 * no rematch. Returns the first violation (plain checks: the sweeps below run
 * tens of thousands of rounds and `expect` per pair would dominate the time).
 */
function roundViolation(
  records: SwissTeamRecord[],
  pairs: [string, string][],
  played: Set<string>,
): string | null {
  const active = records.filter((r) => r.status === "active");
  const byId = new Map(active.map((r) => [r.teamId, r]));
  const seen = new Set<string>();
  for (const [a, b] of pairs) {
    const ra = byId.get(a);
    const rb = byId.get(b);
    if (!ra || !rb) return `inactive team in ${a}-${b}`;
    if (seen.has(a) || seen.has(b)) return `team twice in one round: ${a}-${b}`;
    seen.add(a);
    seen.add(b);
    if (ra.wins !== rb.wins || ra.losses !== rb.losses) return `cross-record pair ${a}-${b}`;
    if (played.has(pairKey(a, b))) return `rematch ${a}-${b}`;
  }
  return seen.size === active.length ? null : `${active.length - seen.size} active team(s) unpaired`;
}

function fieldOf(shape: "equal" | "spread" | "random", seed: number): Record<string, TournamentTeam> {
  const teams: Record<string, TournamentTeam> = {};
  const r = createRng(seed ^ 0x5bd1e995);
  for (let i = 0; i < 16; i++) {
    const rating = shape === "equal" ? 85 : shape === "spread" ? 78 + i : Math.round(r.range(76, 94) * 10) / 10;
    teams[`t${i}`] = fakeTeam(`t${i}`, rating);
  }
  return teams;
}

function runSwiss(teams: Record<string, TournamentTeam>, seed: number): SwissState {
  const rng = createRng(seed);
  let state = createSwissState(Object.keys(teams), rng);
  let guard = 0;
  while (!state.finished && guard++ < 6) state = playSwissRound(state, teams, "normal", rng);
  return state;
}

describe("swiss pairing never repeats a series (rc.27, #143)", () => {
  it("5,000 coin-flip campaigns: every round complete, same-record and rematch-free; always 8/8", () => {
    const failures: string[] = [];
    for (let seed = 1; seed <= 5000; seed++) {
      const rng = createRng(seed);
      const flips = createRng((seed * 2654435761) >>> 0);
      let records = freshRecords(16);
      const played = new Set<string>();
      let rounds = 0;
      while (records.some((r) => r.status === "active")) {
        const pairs = pairActiveTeams(records, played, rng);
        const bad = roundViolation(records, pairs, played);
        if (bad) failures.push(`seed ${seed} round ${rounds + 1}: ${bad}`);
        for (const [a, b] of pairs) played.add(pairKey(a, b));
        records = applyCoinFlips(records, pairs, flips);
        rounds += 1;
      }
      const advanced = records.filter((r) => r.status === "advanced").length;
      if (rounds > 5 || advanced !== 8) failures.push(`seed ${seed}: ${rounds} rounds, ${advanced} advanced`);
    }
    expect(failures).toEqual([]);
  }, 30_000);

  it("simulated campaigns (equal, spread and random fields) never rematch and replay identically", () => {
    const failures: string[] = [];
    for (const shape of ["equal", "spread", "random"] as const) {
      for (let seed = 1; seed <= 300; seed++) {
        const teams = fieldOf(shape, seed);
        const state = runSwiss(teams, seed);
        const played = new Set<string>();
        for (const round of state.rounds) {
          for (const s of round.series) {
            if (played.has(pairKey(s.teamAId, s.teamBId))) {
              failures.push(`${shape} seed ${seed}: rematch ${s.teamAId}-${s.teamBId}`);
            }
            played.add(pairKey(s.teamAId, s.teamBId));
          }
        }
        if (state.records.filter((r) => r.status === "advanced").length !== 8) {
          failures.push(`${shape} seed ${seed}: not 8 advanced`);
        }
        if (seed <= 20 && JSON.stringify(runSwiss(teams, seed)) !== JSON.stringify(state)) {
          failures.push(`${shape} seed ${seed}: replay differs`);
        }
      }
    }
    expect(failures).toEqual([]);
  }, 30_000);

  it("is byte-identical to the old pairer (pairs, sides, RNG cursor) whenever that one had no rematch", () => {
    const failures: string[] = [];
    let compared = 0;
    let repaired = 0;
    for (let seed = 1; seed <= 2000; seed++) {
      const rng = createRng(seed);
      const flips = createRng((seed * 40503) >>> 0);
      let records = freshRecords(16);
      const played = new Set<string>();
      while (records.some((r) => r.status === "active")) {
        const legacyRng = createRng(rng.state);
        const legacy = legacyPairActiveTeams(records, legacyRng);
        const pairs = pairActiveTeams(records, played, rng);
        if (legacy.every(([a, b]) => !played.has(pairKey(a, b)))) {
          if (JSON.stringify(pairs) !== JSON.stringify(legacy)) failures.push(`seed ${seed}: pairs differ`);
          compared += 1;
        } else {
          repaired += 1;
        }
        // Same draws either way: the search itself never touches the RNG.
        if (rng.state !== legacyRng.state) failures.push(`seed ${seed}: rng cursor differs`);
        for (const [a, b] of pairs) played.add(pairKey(a, b));
        records = applyCoinFlips(records, pairs, flips);
      }
    }
    expect(failures).toEqual([]);
    expect(compared).toBeGreaterThan(5000);
    expect(repaired).toBeGreaterThan(500); // the old pairer rematched often (the bug)
  }, 30_000);

  it("keeps a valid stored round untouched", () => {
    const teams = fieldOf("spread", 7);
    const rng = createRng(7);
    let state = createSwissState(Object.keys(teams), rng);
    for (let r = 0; r < 3; r++) {
      expect(upcomingSwissPairings(state)).toBe(state.nextPairings);
      state = playSwissRound(state, teams, "normal", rng);
    }
  });

  it("repairs a stored round that replays a series (pre-rc.27 saves) without touching the run RNG", () => {
    let checked = 0;
    for (let seed = 1; seed <= 400 && checked < 25; seed++) {
      const teams = fieldOf("equal", seed);
      const rng = createRng(seed);
      let state = createSwissState(Object.keys(teams), rng);
      state = playSwissRound(state, teams, "normal", rng);
      state = playSwissRound(state, teams, "normal", rng);
      // Forge the old bug: swap partners so two teams that already met face again.
      const played = swissHistory(state.rounds);
      const pairs = state.nextPairings!;
      let forged: [string, string][] | null = null;
      for (let i = 0; i < pairs.length && !forged; i++) {
        for (let j = i + 1; j < pairs.length && !forged; j++) {
          const [a, b] = pairs[i];
          const [c, d] = pairs[j];
          if (played.has(pairKey(a, c))) {
            forged = pairs.map((p, k) => (k === i ? [a, c] : k === j ? [b, d] : p) as [string, string]);
          }
        }
      }
      if (!forged) continue;
      const legacyState: SwissState = { ...state, nextPairings: forged };
      const fixed = upcomingSwissPairings(legacyState)!;
      expect(roundViolation(state.records, fixed, played)).toBeNull();
      expect(upcomingSwissPairings(legacyState)).toEqual(fixed); // deterministic

      const rngA = createRng(rng.state);
      const rngB = createRng(rng.state);
      const viaRepair = playSwissRound(legacyState, teams, "normal", rngA);
      const viaFixed = playSwissRound({ ...state, nextPairings: fixed }, teams, "normal", rngB);
      expect(JSON.stringify(viaRepair)).toBe(JSON.stringify(viaFixed));
      expect(rngA.state).toBe(rngB.state);
      expect(viaRepair.rounds[2].series.map((s) => [s.teamAId, s.teamBId])).toEqual(fixed);
      checked += 1;
    }
    expect(checked).toBeGreaterThan(5);
  });

  it("a repair only moves the pairs around the rematch and keeps the player's announced opponent", () => {
    let checked = 0;
    for (let seed = 1; seed <= 600 && checked < 40; seed++) {
      const teams = fieldOf("equal", seed);
      teams.user = { ...teams.t0, id: "user", name: "user", isUser: true };
      delete teams.t0;
      const rng = createRng(seed);
      let state = createSwissState(Object.keys(teams), rng);
      state = playSwissRound(state, teams, "normal", rng);
      state = playSwissRound(state, teams, "normal", rng);
      const played = swissHistory(state.rounds);
      const pairs = state.nextPairings!;
      // Forge the old bug between two AI pairs of one record group (what the old
      // pairer produced): (a,b)(c,d) -> (a,c)(b,d) with a-c already played.
      const recordOf = new Map(state.records.map((r) => [r.teamId, `${r.wins}-${r.losses}`]));
      let forged: [string, string][] | null = null;
      let touched: Set<string> | null = null;
      for (let i = 0; i < pairs.length && !forged; i++) {
        for (let j = i + 1; j < pairs.length && !forged; j++) {
          const [a, b] = pairs[i];
          const [c, d] = pairs[j];
          if ([a, b, c, d].includes("user") || !played.has(pairKey(a, c))) continue;
          if (recordOf.get(a) !== recordOf.get(c)) continue;
          forged = pairs.map((p, k) => (k === i ? [a, c] : k === j ? [b, d] : p) as [string, string]);
          touched = new Set([a, b, c, d]);
        }
      }
      if (!forged || !touched) continue;
      const fixed = upcomingSwissPairings({ ...state, nextPairings: forged })!;
      expect(roundViolation(state.records, fixed, played)).toBeNull();
      const userPair = (ps: [string, string][]) => ps.find(([a, b]) => a === "user" || b === "user");
      expect(userPair(fixed)).toEqual(userPair(forged));
      // The closest clean round: two stored pairs change (the minimum to break
      // one rematch), and every other record group keeps its pairs and sides.
      const changed = forged.filter((p) => !fixed.some((q) => q[0] === p[0] && q[1] === p[1]));
      expect(changed.length).toBeLessThanOrEqual(2);
      const forgedGroup = recordOf.get([...touched][0]);
      for (const p of forged) {
        if (recordOf.get(p[0]) !== forgedGroup) expect(fixed).toContainEqual(p);
      }
      checked += 1;
    }
    expect(checked).toBeGreaterThan(10);
  });

  it("floats one team out of an odd group when that is the only rematch-free way", () => {
    // 2-0: a1 a2 a3 · 1-1: b1 b2 b3. a1 met a2, a3, b1 and b2 → the only clean
    // round is a2–a3, a1 floats to face b3, and b1–b2.
    const rec = (teamId: string, wins: number, losses: number): SwissTeamRecord => ({
      teamId,
      wins,
      losses,
      gameDiff: 0,
      status: "active",
    });
    const records = [rec("a1", 2, 0), rec("a2", 2, 0), rec("a3", 2, 0), rec("b1", 1, 1), rec("b2", 1, 1), rec("b3", 1, 1)];
    const played = new Set([pairKey("a1", "a2"), pairKey("a1", "a3"), pairKey("a1", "b1"), pairKey("a1", "b2")]);
    for (let seed = 1; seed <= 60; seed++) {
      const pairs = pairActiveTeams(records, played, createRng(seed));
      expect(new Set(pairs.map(([a, b]) => pairKey(a, b)))).toEqual(
        new Set([pairKey("a2", "a3"), pairKey("a1", "b3"), pairKey("b1", "b2")]),
      );
    }
  });

  it("falls back to the fewest rematches when none can be avoided — nobody is dropped", () => {
    const rec = (teamId: string): SwissTeamRecord => ({ teamId, wins: 2, losses: 2, gameDiff: 0, status: "active" });
    // Four teams that all met each other: two rematches are unavoidable.
    const records = ["w", "x", "y", "z"].map(rec);
    const played = new Set([
      pairKey("w", "x"), pairKey("w", "y"), pairKey("w", "z"),
      pairKey("x", "y"), pairKey("x", "z"), pairKey("y", "z"),
    ]);
    const pairs = pairActiveTeams(records, played, createRng(3));
    expect(pairs).toHaveLength(2);
    expect(new Set(pairs.flat())).toEqual(new Set(["w", "x", "y", "z"]));
    // Only w–x met before: the other two pairings stay clean.
    const one = pairActiveTeams(records, new Set([pairKey("w", "x")]), createRng(3));
    expect(one.some(([a, b]) => pairKey(a, b) === pairKey("w", "x"))).toBe(false);
  });
});
