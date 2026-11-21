/** Opt-in (v2.1 Matchday slice 3): the quick-vs-custom gap and the momentum anchors. Not part of the normal suite.
 * GAP_MODES=1 GAP_N=20000 GAP_MODES_OUT=modes.json npx vitest run src/engine/match.modes.probe.test.ts
 * The user side (a = base + gap) against an AI side (b = base), both with a style, traits and a
 * playmaker drawn from career-like lineups (match.gap.probe's pool). Policies for the user:
 *   old      no matchday layer (the fixed bounce, slice 2)
 *   none     matchday layer, no coach: the default plan and no breaks
 *   coachQ   "leave it to the coach" at quality Q (an average hired coach is overall ~72 → 0.4)
 *   manual   the "good manual" policy: every call right (quality 1)
 * Every policy plays the same series seeds; AI sides use the default plan and adjust after losses.
 */
import { writeFileSync } from "node:fs";
import { it } from "vitest";
import { CAREER_DEV, CAREER_MATCHDAY as MD } from "@/config/balance";
import { createRng } from "@/lib/rng";
import { deriveAttrOffsets } from "./career/development";
import { bestStyleAgainst, coachQualityOf, kickoffFor, playmakerIndexOf, shownStyle } from "./career/matchday";
import { adjustSeriesPlan, autoUserSeries, callTimeout, openUserSeries, playUserGame } from "./career/matchdaySeries";
import { deriveSeed } from "./career/seeds";
import { teamStyleFor } from "./career/styles";
import { playerTraits } from "./career/traits";
import type { ArchetypeId } from "./career/types";
import { finishSeries, isSeriesOver, simulateSeries, type SeriesOptions } from "./match";
import type { Difficulty, Stats, TournamentTeam } from "./types";

const env = process.env;

function fakeTeam(id: string, rating: number, isUser: boolean): TournamentTeam {
  return {
    id, name: id, isUser, region: "EU",
    rating: { avgPlayerOverall: rating, coachMod: 0, subMod: 0, orgMod: 0, chemMod: 0, specialMod: 0, difficultyShift: 0, total: rating },
    chemistry: { raw: 0, max: 16, percent: 0, tier: "Poor", items: [] },
    stats: { offense: 85, defense: 85, mechanics: 85, consistency: 85, experience: 85, clutch: 85 },
    specialIds: [], playerNames: ["A", "B", "C"], orgId: "",
  };
}

type Profile = Pick<TournamentTeam, "style" | "traits" | "playmakerIndex">;
function profilePool(size: number, overall: number): Profile[] {
  const rng = createRng(777);
  const weights = Object.entries(CAREER_DEV.archetypeWeights as Record<string, number>);
  const total = weights.reduce((s, [, w]) => s + w, 0);
  const pick = () => { let u = rng.next() * total; for (const [id, w] of weights) if ((u -= w) < 0) return id; return weights[0][0]; };
  const out: Profile[] = [];
  for (let i = 0; i < size; i++) {
    const players = [0, 1, 2].map((j) => {
      const off = deriveAttrOffsets(`gp${i}-${j}`, 777, pick() as ArchetypeId);
      const stats = {} as Stats;
      for (const k of Object.keys(off) as (keyof Stats)[]) stats[k] = 85 + off[k];
      return { name: `gp${i}-${j}`, stats };
    });
    out.push({
      style: teamStyleFor(players),
      traits: players.map((p) => playerTraits(p.name, overall + rng.int(-3, 3))),
      playmakerIndex: playmakerIndexOf(players),
    });
  }
  return out;
}

type Part = "style" | "kickoff" | "mark" | "timeout" | "adjust";
/** A manual policy that makes only the listed calls (every one right). */
function manualSeries(a: TournamentTeam, b: TournamentTeam, options: SeriesOptions, seed: number, parts: Part[]) {
  const has = (x: Part) => parts.includes(x);
  const style = has("style") && b.style ? bestStyleAgainst(a, b, b.style.natural) : undefined;
  const plan = { kickoff: has("kickoff") ? kickoffFor(a, b) : ("standard" as const), ...(style ? { style } : {}), ...(has("mark") ? { mark: b.playmakerIndex } : {}) };
  let cur = openUserSeries(a, b, options, seed, { userSide: "a", userQuality: null }, plan);
  while (!isSeriesOver(cur.state)) {
    let st = cur.state;
    const md = st.matchday!;
    if (st.games.length > 0 && has("timeout") && !md.timeoutA && md.momentumB >= MD.timeoutTrigger) st = callTimeout(st, "a");
    if (st.games.length > 0 && has("adjust") && st.lastWinner === "b") {
      const os = shownStyle(b, st.matchday!.planB);
      if (os) st = adjustSeriesPlan(st, "a", { style: bestStyleAgainst(a, b, os) ?? null });
    }
    cur = playUserGame(st, cur.rngState, a, b, "a");
  }
  return finishSeries(cur.state, a, b);
}

const PARTS = env.GAP_MODES_PARTS === "1";
const POLICIES: { key: string; quality: number | null | "old"; parts?: Part[] }[] = [
  { key: "old", quality: "old" },
  { key: "none", quality: null },
  { key: "coach0.4", quality: coachQualityOf(72) },
  { key: "coach0.7", quality: 0.7 },
  { key: "manual", quality: 1 },
  ...(PARTS
    ? (["style", "kickoff", "mark", "timeout", "adjust"] as Part[]).map((p) => ({ key: `only-${p}`, quality: null, parts: [p] }))
    : []),
];

it.skipIf(!env.GAP_MODES)("quick vs custom: series win rate by policy", () => {
  const n = Number(env.GAP_N ?? 20000);
  const rows: Record<string, number | string>[] = [];
  for (const difficulty of ["normal", "hard"] as Difficulty[]) for (const [stage, bestOf] of [["swiss", 5], ["playoff", 7]] as const)
    for (const gap of [-6, -5, -2, 0, 2, 5, 6]) {
      const base = 88;
      const pool = profilePool(600, base);
      const row: Record<string, number | string> = { difficulty, stage, bestOf, gap };
      for (const pol of POLICIES) {
        const pr = createRng(31337 + gap);
        const rng = createRng(4242 + gap);
        let wins = 0;
        for (let i = 0; i < n; i++) {
          const pa = pool[pr.int(0, pool.length - 1)];
          const pb = pool[pr.int(0, pool.length - 1)];
          const old = pol.quality === "old";
          const a = { ...fakeTeam("user", base + gap, false), ...pa, ...(old ? {} : { matchday: true as const }) };
          const b = { ...fakeTeam("b", base, false), ...pb, ...(old ? {} : { matchday: true as const }) };
          const options = { bestOf, stage, difficulty };
          const seed = deriveSeed(4242 + gap, `s${i}`);
          const res = old
            ? simulateSeries(a, b, options, rng)
            : pol.parts
            ? manualSeries(a, b, options, seed, pol.parts)
            : autoUserSeries(a, b, options, seed, { userSide: "a", userQuality: pol.quality as number | null });
          if (res.winnerTeamId === "user") wins++;
        }
        row[pol.key] = Math.round((wins / n) * 1000) / 10;
      }
      rows.push(row);
    }
  if (env.GAP_MODES_OUT) writeFileSync(env.GAP_MODES_OUT, JSON.stringify({ n, rows }));
  for (const r of rows) console.log(JSON.stringify(r));
}, 3_600_000);
