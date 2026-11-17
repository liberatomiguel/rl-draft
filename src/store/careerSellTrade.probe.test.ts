/**
 * R135 (ECO-06) — transfer list / trade probe (opt-in: SELLTRADE_PROBE=1).
 * Plays whole careers with the arc bot and, on top of its normal play, drives
 * the list and the trades at random (seeded, deterministic):
 *
 *   every window day: list up to 2 squad players at a seeded ask in [min, max];
 *   propose a trade for a seeded same-region contracted player with seeded cash
 *   when none is pending; answer every listed offer and every agreed / countered
 *   trade with a seeded yes / no (the bot never sees a trade decision).
 *
 * It hooks `advanceDayFlow` (the bot's clock): before the real step it files the
 * day's listings and proposal; after it, it answers what arrived. Per day it
 * asserts the world's invariants (3 distinct players per org, nobody in two
 * places, squad unique and under the cap) and that the clock keeps moving.
 *
 *   SELLTRADE_PROBE=1 SELLTRADE_SEASONS=4 SELLTRADE_REGIONS=NA,SAM npx vitest run src/store/careerSellTrade.probe.test.ts
 */
import { describe, expect, it, vi } from "vitest";
import { CAREER_CONTRACT } from "@/config/balance";
import { weekOfDay, windowIndexOf } from "@/engine/career/calendar";
import { quantize } from "@/engine/career/economy";
import type { CareerSave } from "@/engine/career/types";
import type { Region } from "@/engine/types";
import { playArcCareer } from "./careerArcBot";

const hook = vi.hoisted(() => ({ fn: null as null | ((save: CareerSave, real: (s: CareerSave) => CareerSave) => CareerSave) }));

vi.mock("./careerFlow", async (importOriginal) => {
  const m = await importOriginal<typeof import("./careerFlow")>();
  return {
    ...m,
    advanceDayFlow: (save: CareerSave) => (hook.fn ? hook.fn(save, m.advanceDayFlow) : m.advanceDayFlow(save)),
  };
});

const env = process.env;
const ON = env.SELLTRADE_PROBE === "1";
const SEASONS = Number(env.SELLTRADE_SEASONS ?? 4);
const REGIONS = (env.SELLTRADE_REGIONS ?? "NA,SAM").split(",") as Region[];
const STALL_BOUND = 8;

/** mulberry32: a tiny deterministic PRNG. */
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Stats {
  listings: number;
  offers: number;
  counters: number;
  noTakers: number;
  sales: number;
  salesFees: number;
  proposed: number;
  agreed: number;
  countered: number;
  refused: number;
  lapsed: number;
  completed: number;
  tradeCash: number;
  userInFees: number;
  bonuses: number;
  declined: number;
  acceptErrors: Record<string, number>;
}

const newStats = (): Stats => ({
  listings: 0, offers: 0, counters: 0, noTakers: 0, sales: 0, salesFees: 0, proposed: 0, agreed: 0,
  countered: 0, refused: 0, lapsed: 0, completed: 0, tradeCash: 0, userInFees: 0, bonuses: 0, declined: 0, acceptErrors: {},
});

describe.skipIf(!ON)("R135 transfer list / trade probe", () => {
  it(
    "whole careers: the world stays consistent, the clock never sticks, nothing throws",
    async () => {
      const flow = await import("./careerFlow");
      const out: string[] = [];
      const allFindings: string[] = [];

      for (const region of REGIONS) {
        const seed = 9300 + REGIONS.indexOf(region) * 7919;
        const rng = prng(seed);
        const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rng() * xs.length)];
        const stats = newStats();
        const findings: string[] = [];
        const seenMail = new Set<string>();
        const seenLedger = new Set<string>();
        let lastKey = "";
        let stalls = 0;
        const at = (s: CareerSave) => `${region} S${s.clock.seasonIndex} d${s.clock.day}`;

        const invariants = (s: CareerSave) => {
          const seen = new Map<string, string>();
          const squadIds = s.squad.map((p) => p.id);
          if (new Set(squadIds).size !== squadIds.length) findings.push(`${at(s)}: squad ids not unique`);
          if (s.squad.length > CAREER_CONTRACT.squadCap) findings.push(`${at(s)}: squad ${s.squad.length} over the cap`);
          for (const id of squadIds) seen.set(id, "squad");
          for (const org of Object.values(s.world.orgs)) {
            if (org.playerIds.length !== 3 || new Set(org.playerIds).size !== 3) {
              findings.push(`${at(s)}: ${org.ref} has ${org.playerIds.length} players (${new Set(org.playerIds).size} distinct)`);
            }
            for (const id of org.playerIds) {
              const prev = seen.get(id);
              if (prev) findings.push(`${at(s)}: ${id} on ${org.ref} and ${prev}`);
              seen.set(id, org.ref);
            }
          }
        };

        const countMail = (s: CareerSave) => {
          for (const m of s.mail) {
            if (seenMail.has(m.id)) continue;
            seenMail.add(m.id);
            switch (m.titleKey) {
              case "listingOffer": stats.offers++; break;
              case "listingCounter": stats.counters++; break;
              case "listingTooDear":
              case "listingNoBuyer": stats.noTakers++; break;
              case "tradeAgreed": stats.agreed++; break;
              case "tradeCountered": stats.countered++; break;
              case "tradeRefusedFit":
              case "tradeRefusedValue": stats.refused++; break;
              default:
            }
          }
          for (const n of s.news) {
            if (n.titleKey === "tradeLapsed" && !seenMail.has(n.id)) {
              seenMail.add(n.id);
              stats.lapsed++;
            }
          }
        };

        const countLedger = (s: CareerSave) => {
          for (const l of s.finances.ledger) {
            if (seenLedger.has(l.id)) continue;
            seenLedger.add(l.id);
            if (l.kind === "transferOut") stats.userInFees += -l.amount;
            else if (l.kind === "signingBonus") stats.bonuses += -l.amount;
          }
        };

        hook.fn = (input, real) => {
          let save = input;
          const day = save.clock.day;
          const windowIdx = windowIndexOf(weekOfDay(day));
          // ---- before the day: list and propose ----
          if (save.phase === "running" && windowIdx !== null) {
            for (const p of [...save.squad]) {
              if (flow.transferListOf(save).length >= 2) break;
              const plan = flow.listingPlanFor(save, p.id);
              if (!plan || plan.error || plan.current) continue;
              const ask = quantize(plan.min + rng() * (plan.max - plan.min));
              const res = flow.listPlayerFlow(save, p.id, ask);
              if (!res.error) {
                save = res.save;
                stats.listings++;
              }
            }
            if (flow.tradeProposalsOf(save).length === 0 && save.squad.length > 0) {
              const give = pick(save.squad);
              const orgs = Object.values(save.world.orgs).filter((o) => o.region === give.region && o.playerIds.length > 0);
              if (orgs.length > 0) {
                const takeId = pick(pick(orgs).playerIds);
                const probe = flow.tradePlanFor(save, give.id, takeId, { lengthSeasons: 2, cash: 0 });
                if ("plan" in probe) {
                  const cash = quantize(rng() * probe.plan.fee * 1.1);
                  const res = flow.proposeTradeFlow(save, give.id, takeId, { lengthSeasons: 2, cash });
                  if (!res.error) {
                    save = res.save;
                    stats.proposed++;
                  }
                }
              }
            }
          }
          // ---- the real day ----
          const before = save;
          save = real(save);
          countMail(save);
          // ---- after the day: answer what arrived ----
          if (save.phase === "running") {
            for (const offer of save.pendingOffers.filter((o) => o.listed && o.status === "pending")) {
              if (rng() < 0.5) {
                const res = flow.acceptBidFlow(save, offer.id);
                if (!res.error) {
                  save = res.save;
                  stats.sales++;
                  stats.salesFees += offer.fee;
                  continue;
                }
                stats.acceptErrors[res.error] = (stats.acceptErrors[res.error] ?? 0) + 1;
              }
              save = flow.declineBidFlow(save, offer.id);
              stats.declined++;
            }
            for (const prop of flow.tradeProposalsOf(save).filter((p) => p.status !== "waiting")) {
              if (rng() < 0.5) {
                const res = flow.acceptBidFlow(save, prop.id);
                if (!res.error) {
                  save = res.save;
                  stats.completed++;
                  stats.tradeCash += flow.tradeCashOf(prop);
                  continue;
                }
                stats.acceptErrors[res.error] = (stats.acceptErrors[res.error] ?? 0) + 1;
              }
              save = flow.declineBidFlow(save, prop.id);
              stats.declined++;
            }
          }
          countLedger(save);
          invariants(save);
          const key = `${save.clock.seasonIndex}:${save.clock.day}:${save.phase}`;
          if (key === lastKey && save.clock.day === before.clock.day) {
            stalls++;
            if (stalls > STALL_BOUND) findings.push(`${at(save)}: the clock repeats ${stalls} steps`);
          } else stalls = 0;
          lastKey = key;
          return save;
        };

        const t0 = Date.now();
        let note = "";
        try {
          const career = playArcCareer({ region, difficulty: "normal", policy: "autopilot", seed, seasons: SEASONS, budgetMs: 1_800_000 });
          if (career.softlock) findings.push(`bot softlock: ${career.softlock}`);
          note = `${career.seasons.length} seasons, final balance ${career.seasons.at(-1)?.balanceEnd ?? "?"}`;
        } catch (e) {
          findings.push(`career throws: ${(e as Error).message}\n${(e as Error).stack?.split("\n").slice(1, 5).join("\n")}`);
        } finally {
          hook.fn = null;
        }
        const errs = Object.entries(stats.acceptErrors).map(([k, v]) => `${k}:${v}`).join(",") || "-";
        const line =
          `${region} seed ${seed}: ${note}; listings ${stats.listings}, offers ${stats.offers}, counters ${stats.counters}, noTakers ${stats.noTakers}, ` +
          `sales ${stats.sales} (fees ${stats.salesFees}); trades proposed ${stats.proposed}, agreed ${stats.agreed}, countered ${stats.countered}, ` +
          `refused ${stats.refused}, lapsed ${stats.lapsed}, completed ${stats.completed} (cash ${stats.tradeCash}); ` +
          `bought fees+cash ${stats.userInFees} + bonuses ${stats.bonuses}; declined ${stats.declined}, acceptErrors ${errs}; ${Math.round((Date.now() - t0) / 1000)}s`;
        out.push(line, ...findings.slice(0, 20).map((f) => `   ! ${f}`));
        const emit = (text: string) => process.stdout.write(text + String.fromCharCode(10));
        emit(line);
        for (const f of findings.slice(0, 20)) emit(`   ! ${f}`);
        if (findings.length > 20) emit(`   ! ... ${findings.length - 20} more`);
        allFindings.push(...findings);
      }
      expect(allFindings).toEqual([]);
    },
    3_600_000,
  );
});
