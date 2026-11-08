/** Opt-in authoring; emits candidates, never mutates the shipped catalog. */
import { writeFileSync } from "node:fs";
import { it } from "vitest";
import { challenges } from "@/data";
import type { Challenge } from "./types";
import { exploreChallenge } from "./testing/challengeReplay";

function measure(ch: Challenge, n = 320) {
  const counts = [0, 0, 0, 0];
  let solution: ReturnType<typeof exploreChallenge> = null;
  for (let i = 1; i <= n; i++) {
    const result = exploreChallenge(ch, i);
    if (!result) continue;
    for (let bit = 0; bit < 3; bit++) if (result.mask & (1 << bit)) counts[bit]++;
    if (result.mask === 7) { counts[3]++; solution ??= result; }
  }
  return { counts, solution: solution?.actions, n };
}

it.skipIf(!(process.env.CH_CALIBRATE || process.env.CH_TUNE))("authoring: find fair fixed-seed candidates", () => {
  const out: Record<string, unknown> = {};
  for (const base of challenges.filter(c => !process.env.CH_IDS || process.env.CH_IDS.split(",").includes(c.id))) {
    const band = base.kind === "draft" ? [0.04, 1] : { common: [0.35, 0.85], rare: [0.25, 0.8], epic: [0.15, 0.75], legend: [0.07, 0.65] }[base.tier];
    let chosen = null;
    for (let seedOffset = 0; seedOffset < 50 && !chosen; seedOffset++) {
      const seed = base.seed + seedOffset * 101;
      const shifts = base.kind === "draft" ? [0] : [0, -2, 2, -4, 4, -6, -8];
      for (const delta of shifts) {
        const ch = { ...base, seed, sim: { ...base.sim, opponentShift: (base.sim.opponentShift ?? 0) + delta } };
        const result = measure(ch);
        if (result.counts[3] >= (base.tier === "legend" ? 2 : 4) && result.counts[0] / result.n >= band[0] && result.counts[0] / result.n <= band[1]) {
          chosen = { challenge: ch, ...result };
          break;
        }
      }
    }
    out[base.id] = chosen ?? { failed: true };
    console.log(base.id, chosen ? `${chosen.challenge.seed} ${chosen.challenge.sim.opponentShift} ${chosen.counts}` : "NO CANDIDATE");
    if (process.env.CH_OUT) writeFileSync(process.env.CH_OUT, JSON.stringify(out, null, 2));
  }
}, 1_800_000);
