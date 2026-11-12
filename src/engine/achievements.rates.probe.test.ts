/**
 * Achievement RATES — an opt-in probe (E1, the Season 1 achievements review).
 * Skipped in the normal suite:
 *
 *   ACH_RATES=1 ACH_RUNS=600 npx vitest run src/engine/achievements.rates.probe.test.ts
 *
 * Plays N classic worldwide runs per difficulty with the matrix's realistic
 * draft bot and prints how often each run feat happens (per run and per title).
 * It is the evidence behind the tiers of the run feats: a feat a first run
 * trips by accident is not an achievement. Simulation policy, not a forecast.
 */
import { expect, it } from "vitest";
import { coachById, playerById, playerCardById, specialCardById, subById } from "@/data";
import { createRng, type Rng } from "@/lib/rng";
import { finalOverall } from "./cards";
import { applyFreeReroll, applyPick, applyReroll, createDraft, drawNextOffer, neededKinds, slotsForKind } from "./draft";
import { evaluateRunAchievements } from "./achievements";
import { userPlayoffSeries } from "./playoffs";
import { displayTeamOverall } from "./rating";
import { buildUserTeam } from "./teams";
import { fastForward, initTournament } from "./tournament";
import type { CardKind, Difficulty, DraftOfferCard, Roster, RosterPick, RunState } from "./types";

const RUNS = Number(process.env.ACH_RUNS ?? 400);
const DIFFS = (process.env.ACH_DIFFS ?? "easy,normal,hard,legacy").split(",") as Difficulty[];
const SPECIAL_MULT: Record<Difficulty, number> = { easy: 1, normal: 1, hard: 2, legacy: 4 };

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
function realisticDraft(difficulty: Difficulty, rng: Rng) {
  let draft = drawNextOffer(
    createDraft(difficulty, { mode: "classic", specialChanceMult: SPECIAL_MULT[difficulty], nationalTeams: { discovered: [] } } as Parameters<typeof createDraft>[1]),
    rng,
  );
  let guard = 0;
  while (!draft.complete && guard++ < 200) {
    const offer = draft.offer; if (!offer) break;
    const need = neededKinds(draft.roster, draft.mode);
    const pickable = offer.cards.filter((c) => c.availability === "available" && need.includes(c.kind)).filter((c) => slotsForKind(c.kind).some((s) => !draft.roster[s]));
    const score = (c: DraftOfferCard) => cardOverall(c) + 3.5 * synergy(c.kind, c.refId, draft.roster);
    pickable.sort((a, b) => (a.kind === "player" ? 1 : 0) - (b.kind === "player" ? 1 : 0) || score(b) - score(a));
    const best = pickable.find((c) => c.kind === "player") ?? pickable[pickable.length - 1] ?? null;
    if (!best) {
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
  return draft.complete ? draft : null;
}

it.skipIf(!process.env.ACH_RATES)("achievement rates per difficulty (classic, worldwide)", () => {
  for (const d of DIFFS) {
    const tally: Record<string, number> = {};
    const bump = (k: string) => { tally[k] = (tally[k] ?? 0) + 1; };
    let runs = 0;
    const champOvr: number[] = [];
    for (let i = 0; i < RUNS; i++) {
      const seed = 7_000_003 * (i + 1) + d.length;
      const draft = realisticDraft(d, createRng(seed));
      if (!draft) continue;
      const team = buildUserTeam(draft.roster, d, { mode: "classic" });
      const rng = createRng(seed ^ 0x5bd1e995);
      const t = fastForward(initTournament(team, d, rng, {}), d, rng);
      runs++;
      const champion = t.playoffs?.championTeamId === "user";
      if (champion) { bump("title"); champOvr.push(displayTeamOverall(team.rating)); }
      const run = { mode: "classic", difficulty: d, showOverall: true, draft } as unknown as RunState;
      for (const id of evaluateRunAchievements(run, t, new Set())) bump(id);
      // Raw signals the review weighed but did not necessarily ship.
      const all = [
        ...t.swiss.rounds.flatMap((r) => r.series.filter((s) => s.teamAId === "user" || s.teamBId === "user")),
        ...userPlayoffSeries(t.playoffs).map((e) => e.series),
      ];
      let top = 0, teamTop = 0;
      for (const s of all) for (const g of s.games) {
        const goals = (s.teamAId === "user" ? g.scorers?.a : g.scorers?.b) ?? [];
        top = Math.max(top, ...goals);
        teamTop = Math.max(teamTop, goals.reduce((x, y) => x + y, 0));
      }
      for (const n of [3, 4, 5, 6, 7]) if (top >= n) bump(`raw:player>=${n}`);
      for (const n of [8, 10, 12]) if (teamTop >= n) bump(`raw:team>=${n}`);
      if (all.some((s) => s.winnerTeamId === "user" && s.games.filter((g) => g.overtime).length >= 4)) bump("raw:4ot-series-won");
      const sw = t.swiss.rounds.flatMap((r) => r.series.filter((s) => s.teamAId === "user" || s.teamBId === "user"));
      const lost = (i: number) => sw[i] && sw[i].winnerTeamId !== "user";
      const swLosses = sw.filter((s) => s.winnerTeamId !== "user").length;
      const po = userPlayoffSeries(t.playoffs);
      const final = po.find((e) => e.round === "grand_final");
      if (lost(0) && lost(1)) { bump("raw:0-2start"); if (po.length) bump("raw:0-2start+playoffs"); if (final) bump("raw:0-2start+final"); }
      if (champion && swLosses === 2) bump("raw:swiss3-2+title");
      if (champion && lost(0)) bump("raw:lost-opener+title");
      const diff = (s: (typeof all)[number]) => (s.teamAId === "user" ? s.ratingDiff : -s.ratingDiff);
      if (final && final.series.winnerTeamId === "user") {
        for (const n of [0, 1, 2, 3]) if (diff(final.series) < -n) bump(`raw:final-won-diff<-${n}`);
      }
      if (champion && po.filter((e) => diff(e.series) < 0).length >= 2) bump("raw:title+2po-underdog");
      if (champion && po.filter((e) => diff(e.series) < 0).length >= 3) bump("raw:title+3po-underdog");
      const ovr = displayTeamOverall(team.rating);
      if (champion) for (const n of [86, 88, 89, 90, 91, 92, 94, 95]) if (ovr <= n) bump(`raw:title-ovr<=${n}`);
      if (champion && !team.specialIds.length) bump("raw:title-no-specials");
      if (champion && all.every((s) => s.winnerTeamId === "user") && d !== "easy") bump("raw:undefeated");
    }
    const titles = tally.title ?? 0;
    champOvr.sort((a, b) => a - b);
    const q = (p: number) => champOvr[Math.floor(p * (champOvr.length - 1))] ?? 0;
    const rows = Object.entries(tally)
      .sort((a, b) => b[1] - a[1])
      .map(([k, n]) => `${k.padEnd(28)} ${String(n).padStart(5)}  ${(100 * n / runs).toFixed(1).padStart(5)}%/run  ${titles ? (100 * n / titles).toFixed(1).padStart(6) : "     -"}%/title`);
    console.log(`\n=== ${d}: ${runs} runs, ${titles} titles; champion overall p10/p50/p90 = ${q(0.1)}/${q(0.5)}/${q(0.9)} ===\n${rows.join("\n")}`);
  }
  expect(true).toBe(true);
});
