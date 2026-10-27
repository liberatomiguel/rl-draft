/**
 * Challenge RE-TUNE scan — an opt-in tool (v2.0, DESIGN-DECISIONS #137).
 * Skipped in the normal suite. Any change to the draft pool or the special-roll
 * RNG moves the fixed-seed challenge drafts out of their bands; this finds the
 * fix:
 *
 *   CH_TUNE=1 CH_IDS=ch-a,ch-b CH_OUT=tune.json npx vitest run src/engine/challenges.tune.test.ts
 *
 * Mirrors challenges.test.ts (competent fixed-seed auto-draft + 200 sampled
 * attempts) and scans the boss opponentShift per seed, keeping the original
 * seed when it can land the tier target (Common 65 · Rare 55 · Epic 45 ·
 * Legend 30 %, outcome stars reachable), else trying derived seeds. Themes are
 * enforced by `constraint`, not the seed, so a re-seed is theme-safe.
 */
import { writeFileSync } from "node:fs";
import { it } from "vitest";
import { challenges, coachById, playerCardById, subById } from "@/data";
import { createRng, type Rng } from "@/lib/rng";
import { finalOverall } from "./cards";
import {
  buildChallengeOpponent,
  buildGauntletOpponents,
  createChallengeDraft,
  evaluateStars,
  playChallengeSeries,
  playGauntletStage,
  STAR_2,
  STAR_3,
} from "./challenges";
import { displayTeamOverall } from "./rating";
import { applyPick, applyReroll, neededKinds, slotsForKind } from "./draft";
import { buildUserTeam } from "./teams";
import type { Challenge, DraftOfferCard, Roster } from "./types";

function cardScore(c: DraftOfferCard): number {
  if (c.kind === "player") return finalOverall(playerCardById.get(c.refId)!);
  if (c.kind === "coach") return coachById.get(c.refId)?.overall ?? 0;
  if (c.kind === "sub") return subById.get(c.refId)?.overall ?? 0;
  return 50;
}
function autoDraft(ch: Challenge, rng: Rng): Roster | null {
  let draft = createChallengeDraft(ch, rng);
  let guard = 0;
  while (!draft.complete && guard++ < 120) {
    const offer = draft.offer;
    if (!offer) break;
    const need = neededKinds(draft.roster, draft.mode);
    const pickable = offer.cards
      .filter((c) => c.availability === "available" && need.includes(c.kind))
      .filter((c) => slotsForKind(c.kind).some((s) => !draft.roster[s]))
      .sort((a, b) => (a.kind === "player" ? 1 : 0) - (b.kind === "player" ? 1 : 0) || cardScore(b) - cardScore(a));
    const best = pickable.find((c) => c.kind === "player") ?? pickable[pickable.length - 1] ?? null;
    if (!best) {
      if (draft.rerollsLeft > 0) { draft = applyReroll(draft, rng); continue; }
      const any = offer.cards.find((c) => c.availability === "available" && slotsForKind(c.kind).some((s) => !draft.roster[s]));
      if (!any) return null;
      draft = applyPick(draft, any, slotsForKind(any.kind).find((s) => !draft.roster[s])!, rng);
      continue;
    }
    if (best.kind === "player" && cardScore(best) < 80 && draft.rerollsLeft > 3) { draft = applyReroll(draft, rng); continue; }
    draft = applyPick(draft, best, slotsForKind(best.kind).find((s) => !draft.roster[s])!, rng);
  }
  return draft.complete ? draft.roster : null;
}
function rates(ch: Challenge, sims = 200) {
  const roster = autoDraft(ch, createRng(ch.seed));
  if (!roster) return null;
  const user = buildUserTeam(roster, ch.sim.difficulty, { mode: "challenge" });
  const opponent = buildChallengeOpponent(ch);
  const stages = buildGauntletOpponents(ch);
  let wins = 0, s2 = 0, s3 = 0;
  for (let i = 0; i < sims; i++) {
    const rng = createRng(ch.seed + 1 + i * 131);
    let ok = true;
    const all = [];
    for (const o of stages) {
      const r = playGauntletStage(user, o, ch, rng);
      all.push(r);
      if (r.winnerTeamId !== "user") { ok = false; break; }
    }
    if (!ok) continue;
    const boss = playChallengeSeries(user, opponent, ch, rng);
    all.push(boss);
    const mask = evaluateStars(ch, { user, boss, all, bossOverall: displayTeamOverall(opponent.rating), rerollsUsed: 0 });
    if (boss.winnerTeamId === "user") wins++;
    if (mask & STAR_2) s2++;
    if (mask & STAR_3) s3++;
  }
  return { win: wins / sims, star2: s2 / sims, star3: s3 / sims };
}

const TARGET: Record<string, number> = { common: 0.65, rare: 0.55, epic: 0.45, legend: 0.3 };
const OUTCOME = new Set(["sweep", "goals", "concede"]);

it.skipIf(!process.env.CH_TUNE)("challenge re-tune scan", () => {
  const ids = (process.env.CH_IDS ?? "").split(",").filter(Boolean);
  const out: Record<string, unknown> = {};
  for (const base of challenges.filter((c) => ids.length === 0 || ids.includes(c.id))) {
    const target = TARGET[base.tier];
    const floor = base.tier === "legend" ? 0.2 : 0.35;
    const okStars = (r: { star2: number; star3: number }) =>
      (!base.stars || !OUTCOME.has(base.stars[0].kind) || r.star2 >= 0.05) &&
      (!base.stars || !OUTCOME.has(base.stars[1].kind) || r.star3 >= 0.05);
    const seeds = [base.seed, ...Array.from({ length: 60 }, (_, k) => base.seed + 101 * (k + 1))];
    let best: { seed: number; shift: number; win: number; star2: number; star3: number; err: number } | null = null;
    for (const seed of seeds) {
      // coarse scan, then refine around the closest shift
      const probe = (shift: number) => {
        const ch = { ...base, seed, sim: { ...base.sim, opponentShift: shift } };
        return rates(ch);
      };
      if (!probe(0)) continue; // roster can't be assembled on this seed
      let cand: { shift: number; r: NonNullable<ReturnType<typeof rates>> } | null = null;
      for (let shift = -16; shift <= 12; shift += 1) {
        const r = probe(shift)!;
        if (!cand || Math.abs(r.win - target) < Math.abs(cand.r.win - target)) cand = { shift, r };
      }
      for (let shift = cand!.shift - 0.75; shift <= cand!.shift + 0.75; shift += 0.25) {
        const r = probe(Math.round(shift * 100) / 100)!;
        if (Math.abs(r.win - target) < Math.abs(cand!.r.win - target)) cand = { shift: Math.round(shift * 100) / 100, r };
      }
      const { r, shift } = cand!;
      if (r.win < floor || r.win > 0.8 || !okStars(r)) continue;
      const err = Math.abs(r.win - target) + (seed === base.seed ? 0 : 0.03); // prefer the original seed
      if (!best || err < best.err) best = { seed, shift, ...r, err };
      if (seed === base.seed && err <= 0.06) break; // good enough on the original seed
      if (best.err <= 0.05) break;
    }
    out[base.id] = best ? { tier: base.tier, ...best, original: { seed: base.seed, shift: base.sim.opponentShift ?? 0 } } : { tier: base.tier, none: true };
    console.log(base.id.padEnd(28), JSON.stringify(out[base.id]));
    if (process.env.CH_OUT) writeFileSync(process.env.CH_OUT, JSON.stringify(out, null, 1));
  }
}, 3_600_000);
