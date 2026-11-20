/** v2.1 Matchday slice 2: the engine hook for styles and traits (match.ts / teams.ts). */
import { afterEach, describe, expect, it } from "vitest";
import { FEATURES } from "@/config/balance";
import { createRng } from "@/lib/rng";
import { PLAY_STYLES } from "./career/styles";
import { simulateSeries } from "./match";
import { assembleTournamentTeam, type AssembleInput, type MemberView } from "./teams";
import type { PlayStyleId, Stats, TournamentTeam } from "./types";

const stats = (v: number): Stats => ({ offense: v, defense: v, mechanics: v, consistency: v, experience: v, clutch: v });

function fakeTeam(id: string, rating: number, extra: Partial<TournamentTeam> = {}): TournamentTeam {
  return {
    id, name: id, isUser: false, region: "EU",
    rating: { avgPlayerOverall: rating, coachMod: 0, subMod: 0, orgMod: 0, chemMod: 0, specialMod: 0, difficultyShift: 0, total: rating },
    chemistry: { raw: 0, max: 16, percent: 0, tier: "Poor", items: [] },
    stats: stats(85), specialIds: [], playerNames: ["A", "B", "C"], orgId: "",
    rollRange: [-4, 4], careerScoreline: true,
    ...extra,
  };
}

const fits = (v: number) => Object.fromEntries(PLAY_STYLES.map((s) => [s, v])) as Record<PlayStyleId, number>;
const opts = { bestOf: 5, stage: "playoff" as const, difficulty: "normal" as const };

function run(a: TournamentTeam, b: TournamentTeam, seed: number, n: number) {
  const rng = createRng(seed);
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const r = simulateSeries(a, b, opts, rng);
    out.push(`${r.winnerTeamId}:${r.score.join("-")}:${r.games.map((g) => g.score.join("")).join(",")}`);
  }
  return { out, cursor: rng.state };
}

const features = FEATURES as { matchdayStyles: boolean };
const initial = features.matchdayStyles;
afterEach(() => {
  features.matchdayStyles = initial;
});

describe("Matchday engine hook", () => {
  it("neutral fields (same style, no traits) play exactly the old path", () => {
    const plainA = fakeTeam("a", 90), plainB = fakeTeam("b", 89);
    const neutral = { style: { natural: "counter" as const, fit: fits(1) }, traits: [[], [], []] };
    const old = run(plainA, plainB, 31, 3000);
    const now = run(fakeTeam("a", 90, neutral), fakeTeam("b", 89, neutral), 31, 3000);
    expect(now).toEqual(old);
  });

  it("is deterministic with styles and traits", () => {
    const a = fakeTeam("a", 90, { style: { natural: "pressure", fit: fits(1) }, traits: [["streaky"], ["decisive"], []] });
    const b = fakeTeam("b", 90, { style: { natural: "possession", fit: fits(1) }, traits: [["leader"], [], ["slowStarter"]] });
    expect(run(a, b, 5, 2000)).toEqual(run(a, b, 5, 2000));
  });

  it("the full-fit matchup moves an even series by a few points, not more", () => {
    const n = 20000;
    const a = fakeTeam("a", 90, { style: { natural: "pressure", fit: fits(1) } });
    const b = fakeTeam("b", 90, { style: { natural: "possession", fit: fits(1) } });
    const wins = run(a, b, 99, n).out.filter((s) => s.startsWith("a:")).length / n;
    expect(wins).toBeGreaterThan(0.52);
    expect(wins).toBeLessThan(0.6);
  });

  it("a +6 favourite on the losing side of a full-fit matchup still wins ≥ 97%; worst-case traits cost ≤ 4 points", () => {
    const n = 10000;
    const winsOf = (a: TournamentTeam, b: TournamentTeam) => run(a, b, 7, n).out.filter((s) => s.startsWith("a:")).length / n;
    const plain = winsOf(fakeTeam("a", 96), fakeTeam("b", 90));
    const matchupOnly = winsOf(
      fakeTeam("a", 96, { style: { natural: "possession", fit: fits(1) } }),
      fakeTeam("b", 90, { style: { natural: "pressure", fit: fits(1) } }),
    );
    expect(matchupOnly).toBeGreaterThanOrEqual(0.97);
    const fav = fakeTeam("a", 96, { style: { natural: "possession", fit: fits(1) }, traits: [["hotHeaded"], ["slowStarter"], []] });
    const dog = fakeTeam("b", 90, { style: { natural: "pressure", fit: fits(1) }, traits: [["decisive"], ["decisive"], ["leader"]] });
    expect(plain - winsOf(fav, dog)).toBeLessThanOrEqual(0.04);
  });

  it("only career sides get a style and traits, and only with the flag on", () => {
    const players: MemberView[] = [0, 1, 2].map((i) => ({ name: `P${i}`, overall: 88, stats: { ...stats(86), mechanics: 92 }, lineupId: "x", orgId: "" }));
    const input: AssembleInput = { id: "t", name: "T", isUser: false, region: "EU", players, specialIds: [], difficulty: "normal", difficultyShift: 0 };
    features.matchdayStyles = false;
    const offCareer = assembleTournamentTeam({ ...input, rollRange: [-4, 4] });
    expect(offCareer.style).toBeUndefined();
    expect(offCareer.traits).toBeUndefined();
    features.matchdayStyles = true;
    expect(assembleTournamentTeam(input).style).toBeUndefined(); // the Draft path never gets one
    const onCareer = assembleTournamentTeam({ ...input, rollRange: [-4, 4] });
    expect(onCareer.style?.natural).toBe("individual");
    expect(onCareer.traits).toHaveLength(3);
    expect(assembleTournamentTeam({ ...input, rollRange: [-4, 4] })).toEqual(onCareer);
  });
});
