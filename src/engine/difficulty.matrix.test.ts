/**
 * Difficulty MATRIX — an opt-in tuning tool (v2.0, DESIGN-DECISIONS #136).
 * Skipped in the normal suite; run it before AND after any data expansion:
 *
 *   SIM_MATRIX=1 SIM_POOLS=WW,SAM,EU SIM_OUT=before.json npx vitest run src/engine/difficulty.matrix.test.ts
 *
 * Same methodology as difficulty.sim.test.ts (synergy-aware realistic drafts,
 * best-of-N resets → title / reach-final rate by final overall) for EVERY
 * difficulty and any pool (WW or a region), plus the "population" metric (every
 * lineup of the pool as the user's team — close to the live analytics blend).
 * Knobs: SIM_DIFFS, SIM_SESSIONS, SIM_RESETS, SIM_PER, SIM_POP_PER,
 * SIM_SKIP_REAL / SIM_SKIP_POP, and SIM_BOOST={"EU":{"hard":1.2}} to override a
 * region's boost without editing balance.ts. SIM_SWEEP=-0.4,0.2,0.4 measures
 * additive deltas with cached drafts and paired tournament seeds. Writes JSON
 * (including the reset schedule and per-session results) to $SIM_OUT.
 */
import { writeFileSync } from "node:fs";
import { expect, it } from "vitest";
import * as balance from "@/config/balance";
import { coachById, lineupPoolForRegion, lineups, playerById, playerCardById, specialCardById, subById } from "@/data";
import { createRng, type Rng } from "@/lib/rng";
import { finalOverall } from "./cards";
import { rosterFromLineup } from "./challenges";
import { applyFreeReroll, applyPick, applyReroll, createDraft, drawNextOffer, neededKinds, slotsForKind } from "./draft";
import { displayTeamOverall } from "./rating";
import { buildUserTeam } from "./teams";
import { generateOpponents } from "./opponents";
import { fastForward, initTournament, userPlacement } from "./tournament";
import type { CardKind, Difficulty, DraftOfferCard, Region, Roster, RosterPick, TournamentTeam } from "./types";

const env = process.env;
const OUT = env.SIM_OUT;
const DIFFS = (env.SIM_DIFFS ?? "easy,normal,hard,legacy").split(",") as Difficulty[];
const POOLS = (env.SIM_POOLS ?? "WW,SAM").split(",");
const SESS = Number(env.SIM_SESSIONS ?? 200);
const RESETS = Number(env.SIM_RESETS ?? 16);
const PER = Number(env.SIM_PER ?? 8);
const POP_PER = Number(env.SIM_POP_PER ?? 10);
const SKIP_REAL = env.SIM_SKIP_REAL === "1";
/**
 * Reset profile: session i resets SIM_RESET_SET[i % n] times (e.g. "0,1,2,3,5,8,12,20")
 * — every session's count is recorded, so any player mix (casual / grinder / a fit
 * to live analytics) can be weighted afterwards. Unset: uniform 0..SIM_RESETS.
 */
const RESET_SET = env.SIM_RESET_SET ? env.SIM_RESET_SET.split(",").map(Number) : null;
const resetsFor = (i: number) => (RESET_SET ? RESET_SET[i % RESET_SET.length] : i % (RESETS + 1));
const SKIP_POP = env.SIM_SKIP_POP === "1";
/** Optional override: {"SAM":{"legacy":4}} or {"*":{"hard":-0.2}} (WW shift delta). */
const BOOST_OVERRIDE: Record<string, Partial<Record<Difficulty, number>>> | null = env.SIM_BOOST
  ? JSON.parse(env.SIM_BOOST)
  : null;
const SPECIAL_MULT: Record<Difficulty, number> = { easy: 1, normal: 1, hard: 2, legacy: 4 };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const B = balance as any;
function boostFor(pool: string, d: Difficulty): number {
  const o = BOOST_OVERRIDE?.[pool]?.[d];
  if (o != null) return o;
  if (pool === "WW") return BOOST_OVERRIDE?.["*"]?.[d] ?? 0;
  if (typeof B.regionOpponentBoost === "function") return B.regionOpponentBoost(pool, d);
  const raw = B.REGION_LOCK.opponentRatingBoost;
  if (typeof raw[d] === "number") return raw[d];
  return raw[pool]?.[d] ?? 0;
}
/** SIM_DEPTH={"MENA":{"legacy":0.5}} overrides REGION_LOCK.fieldDepth for a pool. */
const DEPTH_OVERRIDE: Record<string, Partial<Record<Difficulty, number>>> | null = env.SIM_DEPTH ? JSON.parse(env.SIM_DEPTH) : null;
function depthFor(pool: string, d: Difficulty): number {
  const o = DEPTH_OVERRIDE?.[pool]?.[d];
  if (o != null) return o;
  if (pool === "WW") return 0;
  return typeof B.regionFieldDepth === "function" ? B.regionFieldDepth(pool, d) : 0;
}
function poolIds(pool: string): string[] | undefined {
  return pool === "WW" ? undefined : lineupPoolForRegion(pool as Region);
}

function cardOverall(c: DraftOfferCard): number {
  if (c.specialId) return specialCardById.get(c.specialId)?.overall ?? 0;
  if (c.kind === "player") return finalOverall(playerCardById.get(c.refId)!);
  if (c.kind === "coach") return coachById.get(c.refId)?.overall ?? 0;
  if (c.kind === "sub") return subById.get(c.refId)?.overall ?? 0;
  return 60;
}
function ident(kind: CardKind, refId: string): { lineupId?: string; orgId?: string; country?: string } {
  if (kind === "player") { const c = playerCardById.get(refId); return { lineupId: c?.lineupId, orgId: c?.orgId, country: c ? playerById.get(c.playerId)?.country : undefined }; }
  if (kind === "coach") { const c = coachById.get(refId); return { lineupId: c?.lineupId, orgId: c?.orgId, country: c?.country }; }
  if (kind === "sub") { const c = subById.get(refId); return { lineupId: c?.lineupId, orgId: c?.orgId, country: c?.country }; }
  return { orgId: refId };
}
function synergy(kind: CardKind, refId: string, roster: Roster): number {
  const me = ident(kind, refId);
  let s = 0;
  for (const slot of ["player1", "player2", "player3"] as const) {
    const p = roster[slot] as RosterPick | undefined; if (!p) continue;
    const d = ident("player", p.refId);
    if (me.lineupId && d.lineupId === me.lineupId) s += 4; else if (me.orgId && d.orgId === me.orgId) s += 2.5;
    if (me.country && d.country === me.country) s += 2.5;
  }
  return s;
}
const SYN_W = 3.5;
function realisticDraft(difficulty: Difficulty, rng: Rng, pool?: string[]): Roster | null {
  // Like a real classic run: national teams can be drawn (v2.0; older builds ignore the option).
  let draft = drawNextOffer(
    createDraft(difficulty, {
      mode: "classic",
      poolLineupIds: pool,
      specialChanceMult: SPECIAL_MULT[difficulty],
      nationalTeams: { discovered: [] },
    } as Parameters<typeof createDraft>[1]),
    rng,
  );
  let guard = 0;
  while (!draft.complete && guard++ < 200) {
    const offer = draft.offer; if (!offer) break;
    const need = neededKinds(draft.roster, draft.mode);
    const pickable = offer.cards.filter((c) => c.availability === "available" && need.includes(c.kind)).filter((c) => slotsForKind(c.kind).some((s) => !draft.roster[s]));
    const score = (c: DraftOfferCard) => cardOverall(c) + SYN_W * synergy(c.kind, c.refId, draft.roster);
    pickable.sort((a, b) => (a.kind === "player" ? 1 : 0) - (b.kind === "player" ? 1 : 0) || score(b) - score(a));
    const best = pickable.find((c) => c.kind === "player") ?? pickable[pickable.length - 1] ?? null;
    if (!best) {
      // Nothing pickable: the game grants a FREE reroll (it never ends the draft).
      if (!offer.hasPickableCard) { draft = applyFreeReroll(draft, rng); continue; }
      if (draft.rerollsLeft > 0) { draft = applyReroll(draft, rng); continue; }
      const any = offer.cards.find((c) => c.availability === "available" && slotsForKind(c.kind).some((s) => !draft.roster[s]));
      if (!any) return null;
      draft = applyPick(draft, any, slotsForKind(any.kind).find((s) => !draft.roster[s])!, rng);
      continue;
    }
    if (best.kind === "player" && score(best) < 86 && draft.rerollsLeft > 0) { draft = applyReroll(draft, rng); continue; }
    draft = applyPick(draft, best, slotsForKind(best.kind).find((s) => !draft.roster[s])!, rng);
  }
  return draft.complete ? draft.roster : null;
}
function draftBestOf(d: Difficulty, baseSeed: number, pool: string[] | undefined, resets: number) {
  let bestTeam: TournamentTeam | null = null, bestOvr = -1;
  for (let r = 0; r <= resets; r++) {
    const roster = realisticDraft(d, createRng(baseSeed + r * 9973), pool);
    if (!roster) continue;
    const team = buildUserTeam(roster, d, { mode: "classic" });
    const ovr = displayTeamOverall(team.rating);
    if (ovr > bestOvr) { bestOvr = ovr; bestTeam = team; }
  }
  return bestTeam ? { team: bestTeam, ovr: bestOvr } : null;
}
const BUCKETS: [string, (r: number) => boolean][] = [
  ["<84", (r) => r < 84], ["84-85", (r) => r >= 84 && r < 86], ["86-87", (r) => r >= 86 && r < 88],
  ["88-89", (r) => r >= 88 && r < 90], ["90-91", (r) => r >= 90 && r < 92], ["92-93", (r) => r >= 92 && r < 94],
  ["94-95", (r) => r >= 94 && r < 96], ["96-97", (r) => r >= 96 && r < 98], ["98+", (r) => r >= 98],
];
function play(team: TournamentTeam, d: Difficulty, seed: number, pool: string[] | undefined, boost: number, depth = 0) {
  const rng = createRng(seed);
  const t = fastForward(initTournament(team, d, rng, { poolLineupIds: pool, opponentRatingBoost: boost, opponentFieldDepth: depth }), d, rng);
  return userPlacement(t);
}
const draftCache = new Map<string, ReturnType<typeof draftBestOf>>();
function realistic(poolName: string, d: Difficulty, boost = boostFor(poolName, d)) {
  const pool = poolIds(poolName);
  const tally: Record<string, { n: number; t: number; f: number }> = {};
  /** Placement counts over every tournament (top-4 reach drives the Season Rating). */
  const places: Record<string, number> = {};
  const ovrs: number[] = [];
  /** One row per session: [resets, kept OVR, titles, finals] out of PER tourneys. */
  const sessions: [number, number, number, number][] = [];
  let n = 0, t = 0, f = 0;
  for (let i = 0; i < SESS; i++) {
    const r = resetsFor(i);
    const cacheKey = `${poolName}/${d}/${i}/${r}`;
    if (!draftCache.has(cacheKey)) draftCache.set(cacheKey, draftBestOf(d, 200000 + i * 131, pool, r));
    const got = draftCache.get(cacheKey);
    if (!got) continue;
    ovrs.push(got.ovr);
    const key = BUCKETS.find(([, hit]) => hit(got.ovr))![0];
    tally[key] = tally[key] ?? { n: 0, t: 0, f: 0 };
    let st = 0, sf = 0;
    for (let j = 0; j < PER; j++) {
      const place = play(got.team, d, 700000 + i * 311 + j * 17, pool, boost, depthFor(poolName, d));
      tally[key].n++; n++;
      places[place] = (places[place] ?? 0) + 1;
      if (place === "champion") { tally[key].t++; t++; st++; }
      if (place === "champion" || place === "runner_up") { tally[key].f++; f++; sf++; }
    }
    sessions.push([r, got.ovr, st, sf]);
  }
  ovrs.sort((a, b) => a - b);
  expect(sessions).toHaveLength(SESS);
  const q = (p: number) => ovrs[Math.min(ovrs.length - 1, Math.floor(p * ovrs.length))];
  return {
    boost, blendedTitle: t / n, blendedFinal: f / n,
    blendedTop4: ((places.champion ?? 0) + (places.runner_up ?? 0) + (places.third ?? 0) + (places.fourth ?? 0)) / n,
    swissExit: (places.swiss_exit ?? 0) / n,
    places,
    ovr: { mean: ovrs.reduce((s, x) => s + x, 0) / ovrs.length, p10: q(0.1), p50: q(0.5), p90: q(0.9), max: ovrs[ovrs.length - 1] },
    buckets: Object.fromEntries(BUCKETS.filter(([k]) => tally[k]).map(([k]) => [k, { n: tally[k].n, title: tally[k].t / tally[k].n, final: tally[k].f / tally[k].n }])),
    per: PER,
    sessions,
  };
}
function population(poolName: string, d: Difficulty) {
  const pool = poolIds(poolName);
  const boost = boostFor(poolName, d);
  const ids = (pool ?? lineups.filter((l) => !l.samOnly).map((l) => l.id))
    .filter((id) => { const l = lineups.find((x) => x.id === id)!; return !l.rareSpawn && !(l as { national?: boolean }).national; });
  let n = 0, t = 0, f = 0;
  ids.forEach((id, k) => {
    const team = buildUserTeam(rosterFromLineup(id), d, { mode: "classic" });
    for (let j = 0; j < POP_PER; j++) {
      const place = play(team, d, 900000 + k * 977 + j * 31, pool, boost, depthFor(poolName, d));
      n++; if (place === "champion") t++; if (place === "champion" || place === "runner_up") f++;
    }
  });
  return { lineups: ids.length, blendedTitle: t / n, blendedFinal: f / n };
}

it.skipIf(!env.SIM_MATRIX)("difficulty matrix", () => {
  const out: Record<string, unknown> = { label: env.SIM_LABEL ?? "", params: { SESS, RESETS, PER, POP_PER, RESET_SET, POOLS, DIFFS } };
  for (const pool of POOLS) {
    for (const d of DIFFS) {
      const t0 = Date.now();
      const r = SKIP_REAL ? null : realistic(pool, d);
      const p = SKIP_POP ? null : population(pool, d);
      // Reuse the exact drafts and match seeds when sweeping shifts. This avoids
      // redrafting every candidate and makes comparisons paired experiments.
      const sweep = env.SIM_SWEEP ? Object.fromEntries(env.SIM_SWEEP.split(",").map(Number).map(delta => {
        const boost = boostFor(pool, d) + delta;
        return [delta, realistic(pool, d, boost)];
      })) : undefined;
      out[`${pool}/${d}`] = { realistic: r, population: p, sweep };
      const fmt = (x: number | undefined) => (x == null ? "  -  " : (x * 100).toFixed(1).padStart(5));
      console.log(
        `${pool}/${d}`.padEnd(14),
        `real title ${fmt(r?.blendedTitle)}% final ${fmt(r?.blendedFinal)}% top4 ${fmt(r?.blendedTop4)}% swiss ${fmt(r?.swissExit)}% ovr ${r ? r.ovr.mean.toFixed(1) : "-"}`,
        `| pop title ${fmt(p?.blendedTitle)}% final ${fmt(p?.blendedFinal)}%`,
        `| boost ${boostFor(pool, d)} | ${((Date.now() - t0) / 1000).toFixed(0)}s`,
      );
      if (r) console.log("   ", Object.entries(r.buckets).map(([k, v]) => `${k}:${(v.title * 100).toFixed(0)}/${(v.final * 100).toFixed(0)}(${v.n})`).join("  "));
      if (OUT) writeFileSync(OUT, JSON.stringify(out, null, 1));
    }
  }
}, 3_600_000);

it("Legacy can draw every eligible lineup, including expansions, in each open pool", () => {
  for (const region of [undefined, ...balance.REGION_LOCK.regions]) {
    const ids = region ? lineupPoolForRegion(region) : undefined;
    const eligible = lineups.filter(l => (ids ? ids.includes(l.id) : !l.samOnly) && !l.rareSpawn && !l.national);
    // Asking for the full pool also exercises the org-unique first pass and
    // repeat-org fallback; no low-probability sampling assertion is needed.
    const opponents = generateOpponents("legacy", createRng(314159), eligible.length, ids);
    expect(opponents.map(t => t.lineupId).sort()).toEqual(eligible.map(l => l.id).sort());
    expect(eligible.every(l => balance.DIFFICULTY.legacy.opponentTierWeights[l.historicalStrength] > 0)).toBe(true);
  }
});
