/**
 * Difficulty simulation — REALISTIC-draft win-rate curves (v1.4).
 *
 * The old `balance.test.ts` difficulty anchors fed the sim HARDCODED team objects
 * (a fixed 92.5 / 95.5 / 97.5), which (a) don't reflect what a real draft produces and
 * (b) made the Legacy anchor flaky on thin margins. This harness instead models REAL
 * play and is fully DETERMINISTIC (fixed seeds → identical every run):
 *
 *   - a competent player DRAFTS via the real engine (best available for an open slot,
 *     weighted toward SYNERGY so chemistry is built like a person, not a pile of
 *     best-overall cards), with the rank special-chance of a high-rank Legacy player;
 *   - the player RESETS the run until satisfied (real reset rate is ~40 drafts per kept
 *     team) — modelled as the best-overall of N drafts, so the measured teams are the
 *     ones players actually compete with;
 *   - we then measure the TITLE rate by the team's FINAL displayed overall.
 *
 * Design targets (Miguel, v1.4): Legacy is the all-time wall, but the elite tier must have
 * a real, satisfying shot (no "can never win" frustration), while non-elite teams almost
 * never take it. Worldwide: a ~92 team ≈ 0%, the elite tier climbs — 96-97 ≈ 15%, a 98+
 * pinnacle ≈ 49%. SAM lives on a LOWER, FLATTER scale (a weaker pool, ~93 ceiling, high
 * chemistry): its ~92-93 pinnacle ≈ 34%, and it's never impossible. Tuned via Legacy
 * `opponentRatingShift` (worldwide) and `REGION_LOCK.opponentRatingBoost.legacy` (SAM,
 * raised in lockstep when the shift drops so the SAM curve stays put).
 *
 * This doubles as the TUNING TOOL: the per-bucket curve is logged; tweak the knobs in
 * balance.ts and re-run to read the new curve. Slower than a unit test (it drafts +
 * simulates thousands of tournaments) but deterministic, so the asserts never flake.
 */

import { describe, expect, it } from "vitest";
import { coachById, lineupPoolForRegion, playerById, playerCardById, specialCardById, subById } from "@/data";
import { REGION_LOCK } from "@/config/balance";
import { createRng, type Rng } from "@/lib/rng";
import { finalOverall } from "./cards";
import { applyPick, applyReroll, createDraft, drawNextOffer, neededKinds, slotsForKind } from "./draft";
import { displayTeamOverall } from "./rating";
import { buildUserTeam } from "./teams";
import { fastForward, initTournament, userPlacement } from "./tournament";
import type { CardKind, Difficulty, DraftOfferCard, Roster, RosterPick, TournamentTeam } from "./types";

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
/** Chemistry a candidate forms with already-drafted players (real play drafts for synergy). */
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
const SPECIAL_MULT = 4; // a top-rank Legacy player's special chance (SSL)
function realisticDraft(difficulty: Difficulty, rng: Rng, poolLineupIds?: string[]): Roster | null {
  let draft = drawNextOffer(createDraft(difficulty, { mode: "classic", poolLineupIds, specialChanceMult: SPECIAL_MULT }), rng);
  let guard = 0;
  while (!draft.complete && guard++ < 200) {
    const offer = draft.offer; if (!offer) break;
    const need = neededKinds(draft.roster, draft.mode);
    const pickable = offer.cards.filter((c) => c.availability === "available" && need.includes(c.kind)).filter((c) => slotsForKind(c.kind).some((s) => !draft.roster[s]));
    const score = (c: DraftOfferCard) => cardOverall(c) + SYN_W * synergy(c.kind, c.refId, draft.roster);
    pickable.sort((a, b) => (a.kind === "player" ? 1 : 0) - (b.kind === "player" ? 1 : 0) || score(b) - score(a));
    const best = pickable.find((c) => c.kind === "player") ?? pickable[pickable.length - 1] ?? null;
    if (!best) {
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

/** The player RESETS until satisfied: best (highest-overall) of `resets+1` drafts. */
function draftBestOf(difficulty: Difficulty, baseSeed: number, pool: string[] | undefined, resets: number): { team: TournamentTeam; ovr: number } | null {
  let bestTeam: TournamentTeam | null = null, bestOvr = -1;
  for (let r = 0; r <= resets; r++) {
    const roster = realisticDraft(difficulty, createRng(baseSeed + r * 9973), pool);
    if (!roster) continue;
    const team = buildUserTeam(roster, difficulty, { mode: "classic" });
    const ovr = displayTeamOverall(team.rating);
    if (ovr > bestOvr) { bestOvr = ovr; bestTeam = team; }
  }
  return bestTeam ? { team: bestTeam, ovr: bestOvr } : null;
}

const BUCKETS_WW: [string, (r: number) => boolean][] = [
  ["<90", (r) => r < 90], ["90-91", (r) => r >= 90 && r < 92], ["92-93", (r) => r >= 92 && r < 94],
  ["94-95", (r) => r >= 94 && r < 96], ["96-97", (r) => r >= 96 && r < 98], ["98+", (r) => r >= 98],
];
const BUCKETS_SAM: [string, (r: number) => boolean][] = [
  ["<86", (r) => r < 86], ["86-87", (r) => r >= 86 && r < 88], ["88-89", (r) => r >= 88 && r < 90],
  ["90-91", (r) => r >= 90 && r < 92], ["92-93", (r) => r >= 92 && r < 94], ["94+", (r) => r >= 94],
];

/** Win-rate-by-final-overall curve from realistic reset-drafts. Returns title rate per bucket. */
function curve(label: string, difficulty: Difficulty, region: "SAM" | undefined, sessions: number, maxResets: number, perTeam: number): Record<string, number> {
  const pool = region === "SAM" ? lineupPoolForRegion("SAM") : undefined;
  const oppBoost = region === "SAM" ? REGION_LOCK.opponentRatingBoost[difficulty] : 0;
  const buckets = region === "SAM" ? BUCKETS_SAM : BUCKETS_WW;
  const tally: Record<string, { runs: number; titles: number }> = {};
  let runs = 0, titles = 0;
  for (let i = 0; i < sessions; i++) {
    const resets = i % (maxResets + 1);
    const got = draftBestOf(difficulty, 200000 + i * 131, pool, resets);
    if (!got) continue;
    const key = buckets.find(([, hit]) => hit(got.ovr))![0];
    tally[key] = tally[key] ?? { runs: 0, titles: 0 };
    for (let j = 0; j < perTeam; j++) {
      const rng = createRng(700000 + i * 311 + j * 17);
      const t = fastForward(initTournament(got.team, difficulty, rng, { poolLineupIds: pool, opponentRatingBoost: oppBoost }), difficulty, rng);
      tally[key].runs++; runs++;
      if (userPlacement(t) === "champion") { tally[key].titles++; titles++; }
    }
  }
  const rate: Record<string, number> = {};
  console.log(`\n=== ${label} — ${sessions} reset-sessions × ${perTeam} tourneys ===`);
  for (const [key] of buckets) {
    const x = tally[key]; if (!x || x.runs === 0) continue;
    rate[key] = x.titles / x.runs;
    console.log(`  final OVR ${key.padEnd(6)}  ${(rate[key] * 100).toFixed(1)}%  (n=${x.runs})`);
  }
  console.log(`  >>> blended: ${(titles / runs * 100).toFixed(1)}%`);
  return rate;
}

// Moderate, deterministic sample (fixed seeds → identical every run; wide design bounds).
describe("Legacy difficulty — realistic-draft win-rate curve (v1.4)", () => {
  it("worldwide: a ~92 team almost never wins; the elite tier climbs to a real shot (96-97 ~15%, 98+ ~49%)", () => {
    const r = curve("Legacy worldwide", "legacy", undefined, 320, 32, 12);
    expect(r["92-93"]).toBeLessThan(0.05); // non-elite ≈ never
    expect(r["94-95"]).toBeLessThan(0.07);
    expect(r["96-97"]).toBeGreaterThan(0.1); // the elite tier has a real, growing shot…
    expect(r["96-97"]).toBeLessThan(0.22); // …~15%
    expect(r["98+"]).toBeGreaterThan(0.38); // the pinnacle is rewarding (no "never win")…
    expect(r["98+"]).toBeLessThan(0.62); // …but the wall still holds
    expect(r["98+"]).toBeGreaterThan(r["96-97"]); // monotonic at the top
  }, 120000);

  it("SAM: lower, flatter scale — the ~92-93 pinnacle has a real shot (~34%), never impossible", () => {
    const r = curve("Legacy SAM", "legacy", "SAM", 320, 32, 12);
    expect(r["88-89"]).toBeLessThan(0.15); // mid-SAM is a fight
    expect(r["92-93"]).toBeGreaterThan(0.22); // the SAM ceiling has a real shot…
    expect(r["92-93"]).toBeLessThan(0.5); // …but stays the wall
  }, 120000);
});
