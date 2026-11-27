/**
 * v2.2 event formats (docs/handoff-2.2/FORMATS-SPEC.md): every Major / Worlds
 * shape of CAREER_EVENT_LAYOUTS plays to a champion with the right number of
 * series, each team finishes on exactly one of the bracket's placements (the
 * counts the prize tables pay), the stages advance the right sides, the
 * Saturday / Sunday boundary sits where the calendar expects it, and the
 * classic shapes (no layout) are untouched.
 */

import { describe, expect, it } from "vitest";
import { CAREER_EVENT_LAYOUTS, CAREER_POINTS, TOURNAMENT } from "@/config/balance";
import { createRng } from "@/lib/rng";
import { placementOf } from "./career/careerResults";
import { pointsFor, prizePoolPaidFor, prizeScheduleFor, prizeShapeOf } from "./career/economy";
import {
  LAYOUT_PLACEMENTS,
  bracketSlotsFor,
  drawGroups,
  groupTable,
  layoutPlacementValues,
  placementRanksOf,
} from "./eventLayouts";
import { roundOrderFor } from "./playoffs";
import { atPlayoffsStart, fastForward, initFieldTournament, playNextRound, upcomingUserPairing } from "./tournament";
import type { EventLayout, Placement, Region, Stats, TournamentState, TournamentTeam } from "./types";

const REGIONS: Region[] = ["EU", "NA", "SAM", "MENA", "OCE", "APAC", "SSA"];

function fakeTeam(id: string, rating: number, region: Region): TournamentTeam {
  const stat = (v: number) => Math.min(99, Math.max(60, v));
  const stats: Stats = {
    offense: stat(rating),
    defense: stat(rating),
    mechanics: stat(rating),
    consistency: stat(rating),
    experience: stat(rating),
    clutch: stat(rating),
  };
  return {
    id,
    name: id,
    isUser: id === "user",
    region,
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
    chemistry: { raw: 0, max: 10, percent: 0, tier: "Poor", items: [] },
    stats,
    specialIds: [],
    playerNames: [`${id}-a`, `${id}-b`, `${id}-c`],
    orgId: id,
  };
}

function field(): TournamentTeam[] {
  return Array.from({ length: 16 }, (_, i) =>
    fakeTeam(i === 7 ? "user" : `t${String(i).padStart(2, "0")}`, 92 - i * 0.8, REGIONS[i % 4]),
  );
}

const LAYOUTS: EventLayout[] = [];
for (const row of CAREER_EVENT_LAYOUTS.seasons) {
  for (const l of [row.major, row.worlds]) {
    if (!LAYOUTS.some((x) => x.stage === l.stage && x.bracket === l.bracket)) LAYOUTS.push(l);
  }
}

/** Series a full bracket plays (a hybrid adds its two upper-round losses, a double elimination one per team but the champion). */
const BRACKET_SERIES: Record<string, number> = { single8: 7, hybrid8: 9, hybrid12: 13, single12: 11, double16: 30 };
const STAGE_SERIES: Record<string, [number, number]> = { groups4: [24, 24], gsl8: [20, 20], swiss: [32, 40], none: [0, 0] };

function seriesCount(t: TournamentState): { stage: number; bracket: number } {
  return {
    stage: t.swiss.rounds.reduce((n, r) => n + r.series.length, 0),
    bracket: t.playoffs?.rounds.reduce((n, r) => n + r.series.length, 0) ?? 0,
  };
}

describe("event layouts: every Major / Worlds shape", () => {
  it.each(LAYOUTS.map((l) => [`${l.stage} → ${l.bracket}`, l] as const))("%s plays to one champion", (_, layout) => {
    for (let seed = 1; seed <= 12; seed++) {
      const rng = createRng(seed * 7919);
      const t = fastForward(initFieldTournament(field(), "swiss", rng, layout), "normal", rng);
      expect(t.stage).toBe("finished");
      expect(t.playoffs?.championTeamId).toBeTruthy();
      expect(t.layout).toEqual(layout);
      const n = seriesCount(t);
      const [lo, hi] = STAGE_SERIES[layout.stage];
      expect(n.stage).toBeGreaterThanOrEqual(lo);
      expect(n.stage).toBeLessThanOrEqual(hi);
      expect(n.bracket).toBe(BRACKET_SERIES[layout.bracket]);
      expect(t.playoffs!.rounds.map((r) => r.name)).toEqual(roundOrderFor(t.playoffs!.format));

      // Every team on exactly one placement, in the counts the prize table pays.
      const counts = new Map<Placement, number>();
      for (const id of Object.keys(t.teams)) {
        const p = placementOf(t, id);
        counts.set(p, (counts.get(p) ?? 0) + 1);
      }
      const expected = new Map(LAYOUT_PLACEMENTS[layout.bracket as Exclude<typeof layout.bracket, "double8">]);
      expect(counts).toEqual(expected);

      // No team plays twice in one round.
      for (const r of [...t.swiss.rounds.map((x) => x.series), ...t.playoffs!.rounds.map((x) => x.series)]) {
        const ids = r.flatMap((s) => [s.teamAId, s.teamBId]);
        expect(new Set(ids).size).toBe(ids.length);
      }
    }
  });

  it("is deterministic per seed", () => {
    for (const layout of LAYOUTS) {
      const a = fastForward(initFieldTournament(field(), "swiss", createRng(42), layout), "hard", createRng(43));
      const b = fastForward(initFieldTournament(field(), "swiss", createRng(42), layout), "hard", createRng(43));
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    }
  });

  it("the classic Swiss draws the same with or without the swiss / double8 layout", () => {
    const a = fastForward(initFieldTournament(field(), "swiss", createRng(5)), "normal", createRng(6));
    const b = fastForward(
      initFieldTournament(field(), "swiss", createRng(5), { stage: "swiss", bracket: "double8" }),
      "normal",
      createRng(6),
    );
    expect(b.playoffs).toEqual(a.playoffs);
    expect(b.swiss.rounds).toEqual(a.swiss.rounds);
  });
});

describe("event layouts: stages", () => {
  it("the group draw: four pots by rating, one per group, regions apart when possible", () => {
    const teams = Object.fromEntries(field().map((t) => [t.id, t]));
    const groups = drawGroups(Object.keys(teams), teams, 4, createRng(3));
    expect(groups.map((g) => g.length)).toEqual([4, 4, 4, 4]);
    const ranked = Object.keys(teams).sort((a, b) => teams[b].rating.total - teams[a].rating.total);
    for (let pot = 0; pot < 4; pot++) {
      const members = new Set(ranked.slice(pot * 4, pot * 4 + 4));
      expect(groups.every((g) => members.has(g[pot]))).toBe(true);
    }
    // The fixture has four regions in rotation: every group gets one of each.
    for (const g of groups) expect(new Set(g.map((id) => teams[id].region)).size).toBe(4);
  });

  it("groups of four: three rounds, everyone meets everyone in the group, the table decides", () => {
    const rng = createRng(11);
    let t = initFieldTournament(field(), "swiss", rng, { stage: "groups4", bracket: "hybrid8" });
    for (let i = 0; i < 3; i++) t = playNextRound(t, "normal", rng);
    expect(t.stage).toBe("playoffs");
    for (const g of t.swiss.groups!) {
      const met = new Set<string>();
      for (const r of t.swiss.rounds) for (const s of r.series) if (g.includes(s.teamAId)) met.add([s.teamAId, s.teamBId].sort().join());
      expect(met.size).toBe(6);
      const table = groupTable(t.swiss, g, t.teams);
      const status = table.map((id) => t.swiss.records.find((r) => r.teamId === id)!.status);
      expect(status).toEqual(["advanced", "advanced", "eliminated", "eliminated"]);
    }
    // hybrid8: the four group winners start in the upper bracket.
    const winners = t.swiss.groups!.map((g) => groupTable(t.swiss, g, t.teams)[0]);
    expect(new Set(t.playoffs!.seeds.slice(0, 4))).toEqual(new Set(winners));
  });

  it("groups of four into 12: three sides a group go on, second meets a third of another group", () => {
    const rng = createRng(13);
    let t = initFieldTournament(field(), "swiss", rng, { stage: "groups4", bracket: "hybrid12" });
    for (let i = 0; i < 3; i++) t = playNextRound(t, "normal", rng);
    const groupOf = (id: string) => t.swiss.groups!.findIndex((g) => g.includes(id));
    const s = t.playoffs!.seeds;
    expect(s).toHaveLength(12);
    for (let k = 0; k < 4; k++) expect(groupOf(s[4 + 2 * k])).not.toBe(groupOf(s[5 + 2 * k]));
  });

  it("single 12: a group winner never meets its own group in the quarterfinal draw", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const rng = createRng(seed);
      let t = initFieldTournament(field(), "swiss", rng, { stage: "groups4", bracket: "single12" });
      for (let i = 0; i < 3; i++) t = playNextRound(t, "normal", rng);
      const groupOf = (id: string) => t.swiss.groups!.findIndex((g) => g.includes(id));
      const s = t.playoffs!.seeds;
      for (let k = 0; k < 4; k++) {
        expect(groupOf(s[4 + 2 * k])).not.toBe(groupOf(s[k]));
        expect(groupOf(s[5 + 2 * k])).not.toBe(groupOf(s[k]));
      }
    }
  });

  it("double-elimination groups of eight: 2 wins in, 2 losses out, 2-0 sides start upper", () => {
    const rng = createRng(17);
    let t = initFieldTournament(field(), "swiss", rng, { stage: "gsl8", bracket: "hybrid8" });
    let guard = 0;
    while (t.stage === "swiss" && guard++ < 5) t = playNextRound(t, "normal", rng);
    expect(t.swiss.rounds).toHaveLength(3);
    for (const g of t.swiss.groups!) {
      const recs = g.map((id) => t.swiss.records.find((r) => r.teamId === id)!);
      expect(recs.filter((r) => r.status === "advanced")).toHaveLength(4);
      expect(recs.filter((r) => r.status === "advanced" && r.losses === 0)).toHaveLength(2);
      // Nobody meets the same side twice inside its group.
      const pairs = t.swiss.rounds.flatMap((r) => r.series).filter((s) => g.includes(s.teamAId)).map((s) => [s.teamAId, s.teamBId].sort().join());
      expect(new Set(pairs).size).toBe(pairs.length);
    }
    const upper = t.playoffs!.seeds.slice(0, 4);
    for (const id of upper) expect(t.swiss.records.find((r) => r.teamId === id)!.losses).toBe(0);
  });

  it("the user's next pairing in a group stage is the group's own", () => {
    const rng = createRng(19);
    const t = initFieldTournament(field(), "swiss", rng, { stage: "groups4", bracket: "hybrid8" });
    const next = upcomingUserPairing(t, "normal");
    const group = t.swiss.groups!.find((g) => g.includes("user"))!;
    expect(next).not.toBeNull();
    expect(group).toContain(next!.teamAId);
    expect(group).toContain(next!.teamBId);
    expect(next!.options.bestOf).toBe(TOURNAMENT.swiss.bestOf);
  });
});

describe("event layouts: brackets", () => {
  it("the Saturday / Sunday boundary: after the stage, or after four rounds of the 16-team bracket", () => {
    for (const layout of LAYOUTS) {
      const rng = createRng(23);
      let t = initFieldTournament(field(), "swiss", rng, layout);
      expect(atPlayoffsStart(t)).toBe(false);
      let guard = 0;
      while (!atPlayoffsStart(t) && t.stage !== "finished" && guard++ < 20) t = playNextRound(t, "normal", rng);
      expect(atPlayoffsStart(t)).toBe(true);
      const left = new Set(
        t.stage === "playoffs" && layout.bracket === "double16"
          ? t.playoffs!.rounds.slice(-1).flatMap((r) => r.series.map((s) => s.winnerTeamId))
          : [],
      );
      if (layout.bracket === "double16") {
        expect(t.playoffs!.rounds.map((r) => r.name)).toEqual(["ub_round1", "lb_round1", "ub_quarterfinal", "lb_round2"]);
        expect(left.size).toBe(4);
      } else {
        expect(t.playoffs!.rounds).toHaveLength(0);
      }
    }
  });

  it("hybrid: an upper-bracket loss is not the end, a lower-bracket loss is", () => {
    for (let seed = 1; seed <= 30; seed++) {
      const rng = createRng(seed);
      const t = fastForward(initFieldTournament(field(), "swiss", rng, { stage: "swiss", bracket: "hybrid8" }), "normal", rng);
      const upper = t.playoffs!.rounds.find((r) => r.name === "upper_round")!;
      const qf = t.playoffs!.rounds.find((r) => r.name === "quarterfinal")!;
      for (const s of upper.series) {
        const lost = s.winnerTeamId === s.teamAId ? s.teamBId : s.teamAId;
        expect(qf.series.some((q) => q.teamAId === lost || q.teamBId === lost)).toBe(true);
      }
      const sf = t.playoffs!.rounds.find((r) => r.name === "semifinal")!;
      for (const s of upper.series) expect(sf.series.some((q) => q.teamAId === s.winnerTeamId)).toBe(true);
    }
  });

  it("the 16-team double elimination: two losses to go out, the grand final is one series", () => {
    const rng = createRng(29);
    const t = fastForward(initFieldTournament(field(), "swiss", rng, { stage: "none", bracket: "double16" }), "normal", rng);
    const losses = new Map<string, number>();
    for (const r of t.playoffs!.rounds) {
      for (const s of r.series) {
        const lost = s.winnerTeamId === s.teamAId ? s.teamBId : s.teamAId;
        losses.set(lost, (losses.get(lost) ?? 0) + 1);
      }
    }
    const champion = t.playoffs!.championTeamId!;
    const runnerUp = Object.keys(t.teams).find((id) => placementOf(t, id) === "runner_up")!;
    for (const id of Object.keys(t.teams)) {
      if (id === champion) expect(losses.get(id) ?? 0).toBeLessThanOrEqual(1);
      else if (id === runnerUp) expect([1, 2]).toContain(losses.get(id));
      else expect(losses.get(id)).toBe(2);
    }
    expect(t.playoffs!.rounds.at(-1)!.series).toHaveLength(1);
  });

  it("bracket series are Bo7, stage series Bo5", () => {
    const rng = createRng(31);
    let t = initFieldTournament(field(), "swiss", rng, { stage: "groups4", bracket: "hybrid12" });
    for (let i = 0; i < 3; i++) t = playNextRound(t, "normal", rng);
    const next = upcomingUserPairing(t, "normal");
    if (next) expect(next.options.bestOf).toBe(TOURNAMENT.playoffs.bestOf);
    expect(bracketSlotsFor(t, t.layout!)).toEqual(t.playoffs!.seeds);
  });
});

describe("event layouts: the same points and prize total (FORMATS-SPEC §4)", () => {
  const classicPoints = 400 + 320 + 260 + 210 + 160 * 2 + 120 * 2 + 60 * 8;

  it.each(Object.keys(LAYOUT_PLACEMENTS))("%s keeps the classic points total", (bracket) => {
    const rows = LAYOUT_PLACEMENTS[bracket as keyof typeof LAYOUT_PLACEMENTS];
    const total = rows.reduce((sum, [p, n]) => sum + pointsFor("regional", p, bracket as never) * n, 0);
    expect(total).toBe(classicPoints);
    expect(CAREER_POINTS.regional.champion).toBe(400);
  });

  it("a Major's prize pool is the classic event's, whatever its bracket", () => {
    for (const season of [0, 3, 6]) {
      const classic = prizePoolPaidFor("major", "swiss", "normal", season);
      for (const bracket of Object.keys(LAYOUT_PLACEMENTS)) {
        const paid = prizePoolPaidFor("major", bracket as never, "normal", season);
        expect(Math.abs(paid - classic) / classic).toBeLessThan(0.02);
        const schedule = prizeScheduleFor("major", bracket as never, "normal", season);
        // Better placements never pay less.
        const values = LAYOUT_PLACEMENTS[bracket as keyof typeof LAYOUT_PLACEMENTS].map(([p]) => schedule[p]);
        for (let i = 1; i < values.length; i++) expect(values[i]).toBeLessThanOrEqual(values[i - 1]);
      }
    }
  });

  it("9th-12th pays above 13th-16th when the bracket separates them", () => {
    const v = layoutPlacementValues("hybrid12", { champion: 400, runner_up: 320, third: 260, fourth: 210, top6: 160, top8: 120, swiss_exit: 60 }, CAREER_EVENT_LAYOUTS.nineToTwelveLift);
    expect(v.top12).toBeCloseTo(70);
    expect(v.swiss_exit).toBeCloseTo(50);
    expect(placementRanksOf("hybrid12")).toMatchObject({ top4: "3–4", top6: "5–6", top8: "7–8", top12: "9–12", swiss_exit: "13–16" });
  });

  it("prizeShapeOf: a def's bracket, the classic format otherwise", () => {
    expect(prizeShapeOf({ format: "swiss" })).toBe("swiss");
    expect(prizeShapeOf({ format: "swiss", layout: { stage: "swiss", bracket: "double8" } })).toBe("swiss");
    expect(prizeShapeOf({ format: "swiss", layout: { stage: "groups4", bracket: "hybrid12" } })).toBe("hybrid12");
  });
});
