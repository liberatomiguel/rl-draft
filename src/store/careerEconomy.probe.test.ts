/**
 * Road to Worlds — the economy probe (rc.31, ROADMAP Etapa 2b ECO-01).
 *
 * MEASURES ONLY. Opt-in and skipped by default; never imported by the app.
 * It is the "today" (and, on the same seeds, the "after") of
 * docs/ECONOMY-CONTRACT.md:
 *
 *   CAREER_ECON=1 ECON_MD=econ.md npx vitest run src/store/careerEconomy.probe.test.ts
 *
 * Two parts, one Markdown file:
 *  - Pure curves (no career, about a second; `ECON_CURVES_ONLY=1` stops
 *    there): the season index of every money stream, the ask by overall and
 *    season, the rep premium, fees, the prize tables per tier, sponsor offers
 *    by reputation, the renewal jump, what the guaranteed income carries.
 *  - Careers: the long-career bot (`careerArcBot.ts`, unchanged) plays whole
 *    careers through the real flow. This file wraps the flow functions the
 *    bot calls (a `vi.mock` passthrough, so every number still comes from the
 *    real code) to read each save it passes: the ledger split by source and
 *    event tier, each Monday's runway, the Backer and the bank, every renewal
 *    priced against the wage it replaces, and the stars on the market at each
 *    season start against the user's books and the best AI rosters' wage bill.
 *
 * Knobs: ECON_REGIONS (default all seven), ECON_DIFFS (easy,normal,hard),
 * ECON_POLICIES (default all seven ARC_POLICIES), ECON_SEEDS (careers per
 * cell, default 1: seed 9100, the first seed of CAREER-BASELINE-rc30),
 * ECON_SEASONS (default 8), ECON_OUT (optional JSON dump of the records),
 * ECON_IN (re-render the Markdown from such a dump, no careers played;
 * ECON_RUNTIME, free text, names the original sweep's runtime in the footer).
 * One process; the bot is deterministic, so the same knobs give the same
 * tables. The contract's appendix is `CAREER_ECON=1 ECON_SEEDS=2`: the
 * baseline's 294 cells (7 regions × 3 difficulties × 7 policies × seeds 9100
 * and 17019), about 35 minutes (2,109 s) in one process.
 *
 * Limits: the tap sees only the saves the bot hands to the wrapped flows
 * (enough: every day passes through advanceDayFlow, every user event through
 * finishEvent). Insolvency is read from the phase, because `endCareer` keeps
 * an earlier `end.reason` (a career continued past a title or the timeline).
 */

import { readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import type { CareerDifficulty, CareerSave, LedgerEntry } from "@/engine/career/types";
import type { Region } from "@/engine/types";
import type { ArcCareer, ArcPolicyId } from "./careerArcBot";
import type { FlowResult } from "./careerFlow";

// ---------------------------------------------------------------------------
// The tap: a passthrough around the flow functions the bot calls
// ---------------------------------------------------------------------------

type TapEvent =
  | { kind: "create" | "pre" | "day" | "event" | "seasonEnd" | "rollover"; save: CareerSave }
  | { kind: "renew"; save: CareerSave; playerId: string; ask: number | undefined; res: FlowResult }
  | { kind: "sign"; save: CareerSave; playerId: string; res: FlowResult };

const hub = vi.hoisted(() => ({ tap: null as null | ((e: TapEvent) => void) }));

vi.mock("./careerFlow", async (importOriginal) => {
  const real = await importOriginal<typeof import("./careerFlow")>();
  const emit = (e: TapEvent) => hub.tap?.(e);
  return {
    ...real,
    createCareerSave: (...args: Parameters<typeof real.createCareerSave>) => {
      const save = real.createCareerSave(...args);
      emit({ kind: "create", save });
      return save;
    },
    advanceDayFlow: (save: CareerSave) => {
      emit({ kind: "pre", save });
      const out = real.advanceDayFlow(save);
      emit({ kind: "day", save: out });
      return out;
    },
    finishEvent: (save: CareerSave) => {
      const out = real.finishEvent(save);
      emit({ kind: "event", save: out });
      return out;
    },
    rolloverToNextSeason: (save: CareerSave) => {
      emit({ kind: "seasonEnd", save });
      const out = real.rolloverToNextSeason(save);
      emit({ kind: "rollover", save: out });
      return out;
    },
    renewPlayerFlow: (...args: Parameters<typeof real.renewPlayerFlow>) => {
      const res = real.renewPlayerFlow(...args);
      // rc.33 (ECO-11): the renewal's ask, read off the talk the flow answers
      // with (the bot's "selective" policy signs at the zone's floor).
      const player = args[0].squad.find((p) => p.id === args[1]);
      const ask = player ? real.renewalTalkFor(args[0], player, args[2]).ask.wagePerSplit : undefined;
      emit({ kind: "renew", save: args[0], playerId: args[1], ask, res });
      return res;
    },
    signPlayerFlow: (...args: Parameters<typeof real.signPlayerFlow>) => {
      const res = real.signPlayerFlow(...args);
      emit({ kind: "sign", save: args[0], playerId: args[1], res });
      return res;
    },
  };
});

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

const env = process.env;
const ALL_REGIONS: Region[] = ["NA", "EU", "SAM", "MENA", "OCE", "APAC", "SSA"];
const ALL_DIFFS: CareerDifficulty[] = ["easy", "normal", "hard"];
const list = <T extends string>(v: string | undefined, all: readonly T[]): T[] =>
  v ? (v.split(",").filter((x) => (all as readonly string[]).includes(x)) as T[]) : [...all];

const q = (xs: number[], p: number): number => {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.round(p * (s.length - 1))))];
};
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const pct = (n: number, d: number) => (d === 0 ? "–" : `${Math.round((100 * n) / d)}%`);
const money = (n: number): string => {
  if (Number.isNaN(n)) return "–";
  const sign = n < 0 ? "−" : "";
  const a = Math.abs(n);
  if (a >= 1_000_000) return `${sign}$${(a / 1_000_000).toFixed(2)}M`;
  if (a >= 1_000) return `${sign}$${(a / 1_000).toFixed(1)}k`;
  return `${sign}$${Math.round(a)}`;
};
const ratio = (n: number, digits = 2) => (Number.isNaN(n) || !Number.isFinite(n) ? "–" : `${n.toFixed(digits)}`);
const p3 = (xs: number[], f: (n: number) => string = money) =>
  xs.length ? `${f(q(xs, 0.1))} / ${f(q(xs, 0.5))} / ${f(q(xs, 0.9))}` : "–";

// ---------------------------------------------------------------------------
// Part 1 — pure curves
// ---------------------------------------------------------------------------

async function curvesReport(): Promise<string> {
  const B = await import("@/config/balance");
  const E = await import("@/engine/career/economy");
  const K = await import("@/engine/career/contract");
  const W = B.CAREER_PAYROLL.weeksPerSeason;
  const S = B.CAREER_PAYROLL.splitsPerSeason;
  const seasons = [0, 1, 2, 3, 4, 5, 6, 7];
  const lines: string[] = [];
  const row = (cells: (string | number)[]) => lines.push(`| ${cells.join(" | ")} |`);
  const head = (cells: string[]) => {
    row(cells);
    lines.push(`|${cells.map(() => "---").join("|")}|`);
  };

  /** Median ask over 101 jitter draws (the ±8 % personality jitter is per player). */
  const ask = (o: {
    overall: number;
    age?: number;
    potential?: number;
    rep?: number;
    seasonIndex: number;
    difficulty?: CareerDifficulty;
    lengthSeasons?: 1 | 2 | 3;
  }) =>
    q(
      Array.from({ length: 101 }, (_, k) =>
        E.computeSalaryAsk({
          overall: o.overall,
          age: o.age ?? 20,
          potential: o.potential ?? o.overall,
          rep: o.rep ?? 100,
          role: "starter",
          seasonIndex: o.seasonIndex,
          lengthSeasons: o.lengthSeasons ?? 2,
          difficulty: o.difficulty ?? "normal",
          careerSeed: 1,
          playerId: `probe:${k}`,
        }),
      ),
      0.5,
    );
  const perWeek = (perSplit: number) => (perSplit * S) / W;
  const sponsorAt = (rep: number, s: number) =>
    E.sponsorOffersFor(rep, s, 1, null, false, "normal").sort((a, b) => b.basePerSplit - a.basePerSplit)[0];

  // P0. Day one: the founding payroll against the start budget.
  const { createCareerSave } = await import("./careerFlow");
  lines.push("#### P0. Day one — the founding payroll against the start budget (median of the 7 regions, seed 9100)");
  lines.push("");
  lines.push(
    `No sponsor until rep ${B.CAREER_SPONSOR.firstOfferRepGate}; the fanbase at rep ${B.CAREER_REP.start} pays ${money(perWeek(B.CAREER_REP.start * B.CAREER_ECONOMY.passivePerRepPoint))}/wk. ${B.CAREER_SPONSOR.founding.enabled ? `The founding partner (M3) pays ${Math.round(B.CAREER_SPONSOR.founding.payrollShare * 100)}% of the founding wage bill through season ${B.CAREER_SPONSOR.founding.throughSeasonIndex} at least. ` : ""}Runway = weeks the start budget covers at that burn (wages − fanbase − founding partner, no prizes), then the Backer: ${B.CAREER_LOAN.sizing === "weeks" ? `floor ${B.CAREER_LOAN.floorWeeks} weeks of wages below zero, one rescue back to ${B.CAREER_LOAN.rescueToWeeks} weeks above (M4)` : `floor ${money(B.CAREER_LOAN.floor)}, one rescue back to ${money(B.CAREER_LOAN.rescueTo)}`}. The founders' deals end after season 1.`,
  );
  lines.push("");
  head(["Difficulty · founding roster", "wages / wk (season)", "founding partner / wk", "start budget", "Backer floor · rescue", "runway to $0", "… to the second breach", "S0 prizes / wk: out early · qualifier side"]);
  for (const difficulty of ["easy", "normal", "hard"] as const)
    for (const rosterKey of ["balanced", "prospects", "journeymen"] as const) {
      const bills = ALL_REGIONS.map((region) => {
        const save = createCareerSave(
          {
            identity: {
              orgName: "Probe",
              abbrev: "PRB",
              managerName: "Probe",
              country: "BR",
              region,
              crestId: "shield",
              colors: { primary: "#f97316", secondary: "#fde68a" },
              buffType: "consistency",
            },
            difficulty,
            style: "balanced",
            rosterKey,
          },
          9100,
        );
        return {
          wk: save.squad.reduce((n, p) => n + E.weeklyWage(p.salaryPerSplit), 0),
          partner: E.weeklyOf(E.foundingPartnerBaseFor(save.foundingPartner, 0)),
        };
      });
      const wk = q(bills.map((b) => b.wk), 0.5);
      const partner = q(bills.map((b) => b.partner), 0.5);
      const fan = E.weeklyOf(B.CAREER_REP.start * B.CAREER_ECONOMY.passivePerRepPoint);
      const burn = Math.max(1, wk - fan - partner);
      const budget = B.CAREER_ECONOMY.startingBudget[difficulty];
      const line = E.backerLineFor(wk, 0);
      const toZero = budget / burn;
      const toEnd = toZero + -line.floor / burn + (line.rescueTo - line.floor) / burn;
      const pzd = (tier: Parameters<typeof E.prizeFor>[0], pl: Parameters<typeof E.prizeFor>[1]) =>
        E.prizeFor(tier, pl, tier === "qualifier" ? "swissOnly" : "swiss", difficulty, 0);
      const outEarly = 6 * pzd("qualifier", "swiss_exit") + 3 * (pzd("qualifier", "top8") + pzd("regional", "swiss_exit"));
      const qualSide = 9 * (pzd("qualifier", "top8") + pzd("regional", "swiss_exit"));
      row([
        `${difficulty} · ${rosterKey}`,
        `${money(wk)} (${money(wk * W)})`,
        money(partner),
        money(budget),
        `${money(line.floor)} · ${money(line.rescueTo)}`,
        `${toZero.toFixed(0)} wk`,
        `${toEnd.toFixed(0)} wk`,
        `${money(outEarly / W)} · ${money(qualSide / W)}`,
      ]);
    }
  lines.push("");

  // P1. One index per stream.
  lines.push("#### P1. The season index of each money stream (season 0 = ×1.00)");
  lines.push("");
  lines.push(
    `Read off the engine's own functions at normal difficulty (\`CAREER_ECONOMY.indexMode\` "${B.CAREER_ECONOMY.indexMode}"). A flat row never grows, so it shrinks against the rest. rc.32 (M1): "single" puts every stream on one index; the Backer moves in weeks of the wage bill (M4), so it follows wages without being indexed again; the start budget is a day-one amount.`,
  );
  lines.push("");
  head(["Stream (engine source)", ...seasons.map((s) => `S${s}`)]);
  const idx = (f: (s: number) => number) => seasons.map((s) => `×${(f(s) / f(0)).toFixed(2)}`);
  const rate = (stream: Parameters<typeof E.moneyIndex>[1]) => `×${E.moneyIndex(1, stream).toFixed(2)}`;
  row([`Wage asks, new deals (\`computeSalaryAsk\`, ${rate("wages")})`, ...idx((s) => ask({ overall: 80, seasonIndex: s }))]);
  row([
    `Market value / fees (\`marketValueFor\`, ${rate("wages")})`,
    ...idx((s) => E.marketValueFor({ overall: 80, age: 20, potential: 80, seasonIndex: s })),
  ]);
  row([`Coach asks (\`coachSalaryFor\`, ${rate("wages")})`, ...idx((s) => E.coachSalaryFor(80, s, "normal"))]);
  row([
    `Prizes, every tier (\`prizeFor\`, ${rate("prizes")})`,
    ...idx((s) => E.prizeFor("regional", "champion", "swiss", "normal", s)),
  ]);
  row([`New sponsor deals (\`sponsorOffersFor\`, ${rate("sponsor")})`, ...idx((s) => sponsorAt(75, s).basePerSplit)]);
  row([
    `Fanbase (\`weeklyStatement\`, rep × $${B.CAREER_ECONOMY.passivePerRepPoint} a split, ${rate("flat")})`,
    ...idx((s) => 50 * B.CAREER_ECONOMY.passivePerRepPoint * E.moneyIndex(s, "flat")),
  ]);
  row([
    `Founding partner (\`foundingPartnerBaseFor\`, ${rate("sponsor")})`,
    ...idx((s) => E.foundingPartnerBaseFor({ wageBillPerSplit: 15_000, sizedSeason: 0 }, s) || 1),
  ]);
  row([
    `Bank limits, min fee, gear, scouting, stand-in, inserts (\`indexedAmount\`, ${rate("flat")})`,
    ...idx((s) => E.bankLoanLimitFor(50, s) + E.scoutReportCostFor(s) + E.standInFeeFor(s) + E.gearPriceFor(10_000, null, s)),
  ]);
  row([
    `Backer line (\`backerLineFor\`, ${B.CAREER_LOAN.sizing === "weeks" ? "weeks of a three-80 wage bill" : "flat"})`,
    ...idx((s) => -E.backerLineFor(3 * E.weeklyWage(ask({ overall: 80, seasonIndex: s })), s).floor),
  ]);
  row(["Start budget (day one only)", ...seasons.map(() => "×1.00")]);
  row([
    "Prizes ÷ asks",
    ...seasons.map((s) =>
      ratio(
        E.prizeFor("regional", "champion", "swiss", "normal", s) /
          E.prizeFor("regional", "champion", "swiss", "normal", 0) /
          (ask({ overall: 80, seasonIndex: s }) / ask({ overall: 80, seasonIndex: 0 })),
      ),
    ),
  ]);
  row([
    "Sponsors ÷ asks",
    ...seasons.map((s) =>
      ratio(
        sponsorAt(75, s).basePerSplit /
          sponsorAt(75, 0).basePerSplit /
          (ask({ overall: 80, seasonIndex: s }) / ask({ overall: 80, seasonIndex: 0 })),
      ),
    ),
  ]);
  lines.push("");

  // P2. The ask by overall and season.
  lines.push("#### P2. The wage ask by overall and season (per week · per season)");
  lines.push("");
  lines.push(
    "Prime age 20, potential = overall (no upside premium), rep 100 (no rep premium below the comfort cap — rc.32: a 90+ still pays it, P2b), normal, a 2-season deal, the median of the jitter. Each overall point is ×1.2 (`CAREER_SALARY.growthPerPoint`), so +5 points is ×2.49 and +10 is ×6.19.",
  );
  lines.push("");
  head(["Overall", ...seasons.map((s) => `S${s}`)]);
  for (const o of [70, 75, 80, 85, 90, 95]) {
    row([
      `${o}`,
      ...seasons.map((s) => {
        const a = ask({ overall: o, seasonIndex: s });
        return `${money(perWeek(a))}/wk · ${money(a * S)}`;
      }),
    ]);
  }
  lines.push("");

  // P2b. The rep premium and the signing cap.
  lines.push("#### P2b. The rep premium (× the ask at rep 100) and the signing cap, season 0");
  lines.push("");
  const reps = [5, 12, 25, 50, 75, 90];
  lines.push(
    `rc.32 (M6 lever 1): the comfort level stops at \`CAREER_SALARY.repComfortMax\` (${B.CAREER_SALARY.repComfortMax ?? "no cap"}), so the last column — the premium at rep 100 itself, × the premium-free ask — is above ×1.00 for a star.`,
  );
  lines.push("");
  head(["Overall", ...reps.map((r) => `rep ${r}`), "rep 100 (× premium-free)"]);
  for (const o of [75, 80, 85, 90, 95]) {
    row([
      `${o}`,
      ...reps.map((r) => `×${(ask({ overall: o, rep: r, seasonIndex: 0 }) / ask({ overall: o, rep: 100, seasonIndex: 0 })).toFixed(2)}`),
      `×${E.repPremiumFor(o, 100).toFixed(2)}`,
    ]);
  }
  row(["Signable cap (new signings)", ...reps.map((r) => `${Math.floor(E.signableOverallCap(r))}`), "99"]);
  lines.push("");

  // P3. Fees.
  lines.push("#### P3. What a signing costs up front (age 20, potential = overall)");
  lines.push("");
  lines.push(
    "Market value = the rep-neutral ask × 3.2 (`CAREER_TRANSFER.valueMultiple`). A free agent costs no fee, only the signing bonus (15 % of a season's wage); a contracted player costs value × (0.7 + 0.15 × splits left). AI bids for the user's players pay value × 1.0–1.35.",
  );
  lines.push("");
  head(["Overall", "S0 value", "S0 FA bonus", "S0 fee (1–6 splits left)", "S3 value", "S7 value", "S7 fee (1–6 splits left)"]);
  for (const o of [75, 80, 85, 90, 95]) {
    const v = (s: number) => E.marketValueFor({ overall: o, age: 20, potential: o, seasonIndex: s });
    row([
      `${o}`,
      money(v(0)),
      money(E.signingBonusFor(ask({ overall: o, seasonIndex: 0 }))),
      `${money(E.contractedFeeFor(v(0), 1))}–${money(E.contractedFeeFor(v(0), 6))}`,
      money(v(3)),
      money(v(7)),
      `${money(E.contractedFeeFor(v(7), 1))}–${money(E.contractedFeeFor(v(7), 6))}`,
    ]);
  }
  lines.push("");

  // P4. Prize tables.
  lines.push("#### P4. Prize tables by tier (normal; easy ×1.15, hard ×0.9)");
  lines.push("");
  const tiers = [
    { tier: "t3", format: "single", name: "Community Cup (t3)" },
    { tier: "t2", format: "single", name: "Invitational (t2)" },
    { tier: "qualifier", format: "swissOnly", name: "Regional qualifier" },
    { tier: "regional", format: "swiss", name: "Regional" },
    { tier: "major", format: "swiss", name: "Major" },
    { tier: "worlds", format: "swiss", name: "Worlds" },
  ] as const;
  head(["Event", "advertised pool", "table sums to", "paid S0", "paid S3", "paid S7", "S0: 1st · 2nd · 3rd · 4th · 5–6 · 7–8 · 9–16 (qualifier: advance · out)"]);
  const tables = E.prizeTables(); // rc.32 (M5): the active tables (`CAREER_PRIZES.tables`)
  for (const t of tiers) {
    const pool = B.CAREER_PRIZES.pools[t.tier];
    const pr = (pl: Parameters<typeof E.prizeFor>[1]) => E.prizeFor(t.tier, pl, t.format, "normal", 0);
    const sumPct =
      t.format === "swiss"
        ? Object.entries(tables.swiss16).reduce(
            (n, [k, v]) => n + v * ({ top6: 2, top8: 2, swiss_exit: 8 }[k] ?? 1),
            0,
          )
        : t.format === "single"
          ? tables.single8.champion + tables.single8.runner_up + 2 * tables.single8.top4 + 4 * tables.single8.top8
          : 8 * B.CAREER_PRIZES.swissOnlyPct.qualified + 8 * B.CAREER_PRIZES.swissOnlyPct.eliminated;
    const placements =
      t.format === "swiss"
        ? [pr("champion"), pr("runner_up"), pr("third"), pr("fourth"), pr("top6"), pr("top8"), pr("swiss_exit")]
        : t.format === "single"
          ? [pr("champion"), pr("runner_up"), pr("top4"), pr("top4"), pr("top8"), pr("top8"), 0]
          : [pr("top8"), pr("swiss_exit")];
    row([
      t.name,
      money(pool),
      `${sumPct}%`,
      money(E.prizePoolPaidFor(t.tier, t.format, "normal", 0)),
      money(E.prizePoolPaidFor(t.tier, t.format, "normal", 3)),
      money(E.prizePoolPaidFor(t.tier, t.format, "normal", 7)),
      placements.map(money).join(" · "),
    ]);
  }
  lines.push("");

  // P4b. A season's prizes by profile vs. a squad's wages.
  lines.push("#### P4b. A season's prize money by results profile vs. a squad's season wages (normal)");
  lines.push("");
  lines.push(
    "A season = 9 regional weeks (Saturday qualifier → Sunday regional), 3 Majors, Worlds. Profiles: **out early** (fails 6 of 9 qualifiers, exits 3 regional Swiss stages); **qualifier side** (advances every qualifier, exits every regional Swiss stage); **direct top-8** (9 × regional 7–8th); **contender** (9 × regional 3rd, 3 Majors 5–6th, Worlds 7–8th); **dominant** (9 regional titles, 3 Majors, Worlds). The squad rows are three starters at the P2 ask.",
  );
  lines.push("");
  const pz = (tier: Parameters<typeof E.prizeFor>[0], pl: Parameters<typeof E.prizeFor>[1], s: number) =>
    E.prizeFor(tier, pl, tier === "qualifier" ? "swissOnly" : "swiss", "normal", s);
  const profiles: { name: string; f: (s: number) => number }[] = [
    { name: "out early", f: (s) => 6 * pz("qualifier", "swiss_exit", s) + 3 * (pz("qualifier", "top8", s) + pz("regional", "swiss_exit", s)) },
    { name: "qualifier side", f: (s) => 9 * (pz("qualifier", "top8", s) + pz("regional", "swiss_exit", s)) },
    { name: "direct top-8", f: (s) => 9 * pz("regional", "top8", s) },
    { name: "contender", f: (s) => 9 * pz("regional", "third", s) + 3 * pz("major", "top6", s) + pz("worlds", "top8", s) },
    { name: "dominant", f: (s) => 9 * pz("regional", "champion", s) + 3 * pz("major", "champion", s) + pz("worlds", "champion", s) },
  ];
  head(["Season money", ...seasons.map((s) => `S${s}`)]);
  for (const p of profiles) row([`Prizes — ${p.name}`, ...seasons.map((s) => money(p.f(s)))]);
  // What the org keeps of the two podium profiles after the players' share — rc.33
  // (ECO-10): each contract's own share, here three 85s at the share they ask.
  const share85 = K.prizeShareAskFor({ overall: 85, age: 20 });
  const squad85 = [share85, share85, share85].map((prizeSharePct) => ({ prizeSharePct }));
  const net = (tier: Parameters<typeof E.prizeFor>[0], pl: Parameters<typeof E.prizeFor>[1], s: number) =>
    pz(tier, pl, s) - K.prizeShareOfPodium(squad85, tier, pl, pz(tier, pl, s));
  const netProfiles: { name: string; f: (s: number) => number }[] = [
    { name: "contender", f: (s) => 9 * net("regional", "third", s) + 3 * net("major", "top6", s) + net("worlds", "top8", s) },
    { name: "dominant", f: (s) => 9 * net("regional", "champion", s) + 3 * net("major", "champion", s) + net("worlds", "champion", s) },
  ];
  for (const p of netProfiles) row([`Prizes kept (after three 85s' ${share85} % shares) — ${p.name}`, ...seasons.map((s) => money(p.f(s)))]);
  for (const o of [75, 80, 85, 90]) row([`Wages — 3 × ${o}`, ...seasons.map((s) => money(3 * S * ask({ overall: o, seasonIndex: s })))]);
  row([
    "Dominant prizes kept ÷ 3 × 85 wages (e2)",
    ...seasons.map((s) => ratio(netProfiles[1].f(s) / (3 * S * ask({ overall: 85, seasonIndex: s })))),
  ]);
  lines.push("");

  // P5. Sponsors and fanbase.
  lines.push("#### P5. Guaranteed income: sponsor offers by reputation, and the fanbase (normal)");
  lines.push("");
  lines.push(
    `First offer at rep ${B.CAREER_SPONSOR.firstOfferRepGate} (\`firstOfferRepGate\`); deals last one season, pay ${B.CAREER_SPONSOR.signingBonusSplits}× base on signing and a bonus per split when the objective is hit. Fanbase = rep × $${B.CAREER_ECONOMY.passivePerRepPoint} a split at season 0 (rc.32 M1: ×the money index after). Cells: base per week · per season (bonus per split).`,
  );
  lines.push("");
  head(["Reputation (best tier)", ...[0, 1, 3, 5, 7].map((s) => `S${s}`), "fanbase per week · season (S0)"]);
  for (const rep of [5, 12, 25, 50, 75, 90]) {
    const fan = rep * B.CAREER_ECONOMY.passivePerRepPoint;
    row([
      rep < B.CAREER_SPONSOR.firstOfferRepGate ? `${rep} (no offer yet)` : `${rep} (T${sponsorAt(rep, 0).tier})`,
      ...[0, 1, 3, 5, 7].map((s) => {
        if (rep < B.CAREER_SPONSOR.firstOfferRepGate) return "–";
        const o = sponsorAt(rep, s);
        return `${money(perWeek(o.basePerSplit))}/wk · ${money(o.basePerSplit * S)} (+${money(o.bonus)})`;
      }),
      `${money(perWeek(fan))}/wk · ${money(fan * S)}`,
    ]);
  }
  lines.push("");

  // P6. The renewal jump.
  lines.push("#### P6. The renewal jump: a founder's fresh ask at the season-1 renewal ÷ his founding wage");
  lines.push("");
  lines.push(
    "Founders sign at season 0 at rep 5 (`CAREER_REP.start`) on deals that end after season 1; the renewal is a fresh ask one season of inflation later at the current overall, age and rep (here rep 20, a modest first year; at rep 50 the premium is gone). Founding overall 73, potential 82, normal. The jump compounds the overall (×1.2 a point), inflation (×1.08), the age band (×0.9 under 19 → ×1.1 at 19–22) and the rep premium, less the shrinking upside premium.",
  );
  lines.push("");
  const jump = (age: number, d: number, repAfter: number) =>
    ask({ overall: 73 + d, age: age + 1, potential: 82, rep: repAfter, seasonIndex: 1 }) /
    ask({ overall: 73, age, potential: 82, rep: B.CAREER_REP.start, seasonIndex: 0 });
  head(["Overall gained by the renewal", "age 16 → 17", "17 → 18", "18 → 19", "21 → 22", "18 → 19 at rep 5", "18 → 19 at rep 50"]);
  for (const d of [0, 2, 4, 6, 8]) {
    row([
      `+${d} (73 → ${73 + d})`,
      ...[16, 17, 18, 21].map((a) => `×${jump(a, d, 20).toFixed(2)}`),
      `×${jump(18, d, 5).toFixed(2)}`,
      `×${jump(18, d, 50).toFixed(2)}`,
    ]);
  }
  lines.push("");

  // P7. What the guaranteed income carries.
  lines.push("#### P7. What the guaranteed income carries: the best three-starter squad its base pays for (normal)");
  lines.push("");
  lines.push(
    "Guaranteed = the best sponsor base at that rep + the fanbase, per split. The squad overall is the highest even trio whose three P2 asks (at that rep's premium) fit inside it. A dash: not even three 60s.",
  );
  lines.push("");
  head(["Reputation", ...[0, 1, 3, 5, 7].map((s) => `S${s}`)]);
  for (const rep of [5, 12, 25, 50, 75, 90]) {
    row([
      `${rep}`,
      ...[0, 1, 3, 5, 7].map((s) => {
        const g =
          (rep >= B.CAREER_SPONSOR.firstOfferRepGate ? sponsorAt(rep, s).basePerSplit : 0) +
          rep * B.CAREER_ECONOMY.passivePerRepPoint * E.moneyIndex(s, "flat");
        let best = 0;
        for (let o = 60; o <= 99; o++) if (3 * ask({ overall: o, rep, seasonIndex: s }) <= g) best = o;
        return best ? `${best} (${money(perWeek(g))}/wk)` : `– (${money(perWeek(g))}/wk)`;
      }),
    ]);
  }
  lines.push("");

  // P8. The league's top budgets: what exists to anchor star prices on.
  lines.push("#### P8. Candidate anchors for \"the league's top budgets\" vs. a 90 star (normal, per season)");
  lines.push("");
  lines.push(
    "AI orgs hold no money: `CAREER_WORLD.walletByPrestige` is declared but read by no code, so the engine has no league budget today. The rows are the candidates the contract weighs. The best AI rosters' wage bill (measured, not pure) is in table C7.",
  );
  lines.push("");
  head(["Per season", ...seasons.map((s) => `S${s}`)]);
  row(["`walletByPrestige` [3] (unused, flat)", ...seasons.map(() => money(B.CAREER_WORLD.walletByPrestige[3]))]);
  row([
    "Top sponsor (T4) base + bonus, every split hit",
    ...seasons.map((s) => money(S * (sponsorAt(75, s).basePerSplit + sponsorAt(75, s).bonus))),
  ]);
  row(["Contender profile: T4 base + fanbase (rep 80) + contender prizes", ...seasons.map((s) => money(S * sponsorAt(80, s).basePerSplit + S * 80 * B.CAREER_ECONOMY.passivePerRepPoint * E.moneyIndex(s, "flat") + profiles[3].f(s)))]);
  row(["One 90 star's wage", ...seasons.map((s) => money(S * ask({ overall: 90, seasonIndex: s })))]);
  row([
    "Star ÷ contender income",
    ...seasons.map((s) =>
      ratio(
        (S * ask({ overall: 90, seasonIndex: s })) /
          (S * sponsorAt(80, s).basePerSplit + S * 80 * B.CAREER_ECONOMY.passivePerRepPoint * E.moneyIndex(s, "flat") + profiles[3].f(s)),
      ),
    ),
  ]);
  lines.push("");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Part 2 — careers through the real flow
// ---------------------------------------------------------------------------

interface EconSeason {
  s: number;
  income: Record<string, number>;
  spend: Record<string, number>;
  balanceStart: number;
  balanceEnd: number;
  balanceMin: number;
  backerOwedEnd: number;
  bankOwedEnd: number;
  backerGranted: boolean;
  bankLoans: number;
  mondays: number;
  /** Mondays whose runway (balance ÷ weekly burn) was 4 weeks or less, or the balance below 0. */
  mondaysTight: number;
  cashWarnings: number;
  wagesPerSplitEnd: number;
  coachPerSplitEnd: number;
  /** Sponsor base + fanbase, per split, at the season's end. */
  guaranteedPerSplitEnd: number;
  sponsorTierEnd: number;
  repEnd: number;
  ratingEnd: number;
  ended: boolean;
  /** Prize money from regional titles (the champion's line) this season. */
  regionalTitles: number;
}

interface RenewalRec {
  id: string;
  s: number;
  category: "founder" | "founder +3" | "signed ≤19" | "signed 20+";
  age: number;
  overall: number;
  gained: number;
  prevWage: number;
  ask: number;
  guaranteedPerSplit: number;
  kept: boolean | null;
}

interface StarRec {
  s: number;
  rep: number;
  balance: number;
  guaranteedPerSplit: number;
  payrollPerSplit: number;
  prizesLastSeason: number;
  n85: number;
  n90: number;
  n85signable: number;
  n90signable: number;
  /** Cheapest (fee + bonus + a season's wage) available player of each class, signable or not. */
  c85: { overall: number; upfront: number; wage: number; signable: boolean } | null;
  c90: { overall: number; upfront: number; wage: number; signable: boolean } | null;
  /** The best overall on the market (cheapest among equals). */
  best: { overall: number; upfront: number; wage: number; signable: boolean } | null;
  /** The best AI rosters' wage bill at the user's asks (per split): world #1, world top-5 mean, region #1. */
  aiWorld1: number;
  aiWorld5: number;
  aiRegion1: number;
}

interface SigningRec {
  s: number;
  overall: number;
  age: number;
  fee: number;
  bonus: number;
  wage: number;
}

interface EconCareer {
  region: Region;
  difficulty: CareerDifficulty;
  policy: ArcPolicyId;
  seed: number;
  seasons: EconSeason[];
  renewals: RenewalRec[];
  stars: StarRec[];
  signings: SigningRec[];
  ended: ArcCareer["ended"];
  /** Absolute weeks (season × 32 + week): the first cash warning, the Backer, the end. */
  firstWarningWeek: number | null;
  /** Every cash-warning mail (absolute weeks; rc.32: the 8-week notice counts too). */
  warningWeeks: number[];
  rescueWeek: number | null;
  /** The weekly burn (−net of the standing commitments) and the weekly wages on the rescue Monday. */
  rescueBurn: number | null;
  rescueWages: number | null;
  /** rc.32 (M4): the Backer's swing (rescue target − floor) on the rescue Monday's wage bill. */
  rescueSwing?: number | null;
  /** rc.32 (M4): every restructuring (absolute weeks). */
  restructureWeeks?: number[];
  endWeek: number | null;
  firstSponsorSeason: number | null;
  arcRows: Pick<ArcCareer["seasons"][number], "seasonIndex" | "regionRank" | "majorsQualified" | "worlds" | "titles" | "sales" | "signings" | "starSignings">[];
}

const SPEND_GROUPS: Record<string, string[]> = {
  wages: ["payroll", "salary"],
  coach: ["coachSalary"],
  "fees paid": ["transferOut"],
  "signing bonuses": ["signingBonus"],
  "severance / release": ["severance", "releaseFee"],
  "stand-in": ["standInFee"],
  "gear, upkeep, psychologist": ["facility", "upkeep", "buff"],
  "debt service (garnish, Backer, bank)": ["loanGarnish", "loanPayment", "bankPayment"],
  inserts: ["insert"],
  // rc.32 (M6, provisional).
  "players' prize share": ["playerShare"],
};
const INCOME_GROUPS: Record<string, string[]> = {
  "prizes — t3 cups": ["prize:t3"],
  "prizes — t2 invitationals": ["prize:t2"],
  "prizes — qualifiers": ["prize:qualifier"],
  "prizes — regionals": ["prize:regional"],
  "prizes — Majors": ["prize:major"],
  "prizes — Worlds": ["prize:worlds"],
  "sponsor base": ["sponsorBase"],
  "sponsor bonus": ["sponsorBonus"],
  "sponsor signing": ["sponsorSigning"],
  // rc.32 (M3, provisional).
  "founding partner": ["foundingPartner"],
  fanbase: ["fanbase"],
  "fees received (sales)": ["transferIn"],
  inserts: ["insert"],
};
const LOAN_KINDS = ["loanGrant", "bankLoan"];
const sumKeys = (r: Record<string, number>, keys: string[]) => keys.reduce((n, k) => n + (r[k] ?? 0), 0);
const earned = (x: EconSeason) =>
  Object.values(INCOME_GROUPS).reduce((n, keys) => n + sumKeys(x.income, keys), 0);
const prizes = (x: EconSeason) => Object.keys(x.income).filter((k) => k.startsWith("prize:")).reduce((n, k) => n + x.income[k], 0);
const spent = (x: EconSeason) => Object.values(SPEND_GROUPS).reduce((n, keys) => n + sumKeys(x.spend, keys), 0);

async function playEconCareers(cells: { region: Region; difficulty: CareerDifficulty; policy: ArcPolicyId; seed: number }[], seasons: number) {
  const { playArcCareer } = await import("./careerArcBot");
  const { weekOfDay, dayOfWeekOf } = await import("@/engine/career/calendar");
  const { ageOf, playerViewById } = await import("@/engine/career/development");
  const E = await import("@/engine/career/economy");
  const M = await import("@/engine/career/market");
  const { T2_EVENT_NAMES, T3_EVENT_NAMES } = await import("@/data/career/names");
  const B = await import("@/config/balance");
  const { userSeedRatingFor, weeklyStatementOf, backerLineOf } = await import("./careerFlow");
  const t2 = new Set<string>(T2_EVENT_NAMES);
  const t3 = new Set<string>(T3_EVENT_NAMES);
  const W = B.CAREER_PAYROLL.weeksPerSeason;

  const prizeTier = (name = ""): string => {
    if (/ Qualifier \d+$/.test(name)) return "qualifier";
    if (/ Regional \d+$/.test(name)) return "regional";
    if (/^Split \d Major$/.test(name)) return "major";
    if (name === "World Championship") return "worlds";
    if (t2.has(name)) return "t2";
    if (t3.has(name)) return "t3";
    return "other";
  };
  // rc.32: the statement the Monday books (the money index, the founding partner) — the screens' own.
  const statementOf = (save: CareerSave) => weeklyStatementOf(save);
  const guaranteedPerSplit = (save: CareerSave) => {
    const base =
      save.sponsor?.basePerSplit ?? Math.max(0, ...(save.sponsorOffers ?? []).map((o) => o.basePerSplit));
    // rc.32: the fanbase on the money index, and the founding partner (M3) is guaranteed income too.
    return (
      base +
      Math.max(0, save.reputation) * B.CAREER_ECONOMY.passivePerRepPoint * E.moneyIndex(save.clock.seasonIndex, "flat") +
      E.foundingPartnerBaseFor(save.foundingPartner, save.clock.seasonIndex)
    );
  };
  const absWeek = (save: CareerSave) => save.clock.seasonIndex * W + weekOfDay(save.clock.day);

  const out: EconCareer[] = [];
  for (const cell of cells) {
    let c: EconCareer | null = null;
    const seenLedger = new Set<string>();
    const seenMail = new Set<string>();
    const joined = new Map<string, { age: number; overall: number; founder: boolean }>();
    const renewSeen = new Set<string>();
    const seasonOf = (s: number): EconSeason => {
      const career = c!;
      let x = career.seasons.find((r) => r.s === s);
      if (!x) {
        const prev = career.seasons[career.seasons.length - 1];
        x = {
          s,
          income: {},
          spend: {},
          balanceStart: prev?.balanceEnd ?? 0,
          balanceEnd: 0,
          balanceMin: Infinity,
          backerOwedEnd: 0,
          bankOwedEnd: 0,
          backerGranted: false,
          bankLoans: 0,
          mondays: 0,
          mondaysTight: 0,
          cashWarnings: 0,
          wagesPerSplitEnd: 0,
          coachPerSplitEnd: 0,
          guaranteedPerSplitEnd: 0,
          sponsorTierEnd: 0,
          repEnd: 0,
          ratingEnd: 0,
          ended: false,
          regionalTitles: 0,
        };
        career.seasons.push(x);
      }
      return x;
    };
    const book = (line: LedgerEntry) => {
      const x = seasonOf(line.seasonIndex);
      const key = line.kind === "prize" ? `prize:${prizeTier(line.refName)}` : line.kind;
      const into = line.amount >= 0 ? x.income : x.spend;
      into[key] = (into[key] ?? 0) + Math.abs(line.amount);
      if (line.kind === "loanGrant") x.backerGranted = true;
      if (key === "prize:regional" && line.amount === E.prizeFor("regional", "champion", "swiss", cell.difficulty, line.seasonIndex))
        x.regionalTitles += line.amount;
      if (line.kind === "bankLoan") x.bankLoans += 1;
    };
    const snapshot = (save: CareerSave, kind: TapEvent["kind"]) => {
      if (!c) return;
      for (const line of save.finances.ledger) {
        if (seenLedger.has(line.id)) continue;
        seenLedger.add(line.id);
        book(line);
      }
      for (const m of save.mail) {
        if (seenMail.has(m.id)) continue;
        seenMail.add(m.id);
        // rc.32 (M4): the weekly warning and the one-off 8-week notice are both inbox warnings.
        if (m.titleKey === "cashWarning" || m.titleKey === "cashNotice") {
          seasonOf(m.seasonIndex).cashWarnings += 1;
          c.firstWarningWeek ??= m.seasonIndex * W + weekOfDay(m.day);
          c.warningWeeks.push(m.seasonIndex * W + weekOfDay(m.day));
        }
        if (m.titleKey === "backerIn" && c.rescueWeek === null) {
          c.rescueWeek = m.seasonIndex * W + weekOfDay(m.day);
          const stmt = statementOf(save);
          c.rescueBurn = Math.max(0, -stmt.net);
          c.rescueWages = stmt.payroll + stmt.coach;
          const line = backerLineOf(save);
          c.rescueSwing = line.rescueTo - line.floor;
        }
        if (m.titleKey === "restructured") {
          (c.restructureWeeks ??= []).push(m.seasonIndex * W + weekOfDay(m.day));
        }
      }
      const x = seasonOf(save.clock.seasonIndex);
      const fin = save.finances;
      x.balanceMin = Math.min(x.balanceMin, fin.balance);
      x.balanceEnd = fin.balance;
      x.backerOwedEnd = fin.loan?.remaining ?? 0;
      x.bankOwedEnd = fin.bankLoan?.remaining ?? 0;
      x.wagesPerSplitEnd = save.squad.reduce((n, p) => n + p.salaryPerSplit, 0);
      x.coachPerSplitEnd = save.coach?.salaryPerSplit ?? 0;
      x.guaranteedPerSplitEnd = guaranteedPerSplit(save);
      x.sponsorTierEnd = save.sponsor?.tier ?? 0;
      x.repEnd = save.reputation;
      if (save.sponsor && c.firstSponsorSeason === null) c.firstSponsorSeason = save.clock.seasonIndex;
      const isMonday = dayOfWeekOf(save.clock.day) === 1 && !(save.clock.seasonIndex === 0 && save.clock.day === 1);
      if ((kind === "day" || kind === "rollover") && isMonday && save.phase !== "ended") {
        x.mondays += 1;
        const runway = E.runwayWeeks(fin.balance, statementOf(save).net);
        if (fin.balance < 0 || (runway !== null && runway <= B.CAREER_PAYROLL.runwayWarnWeeks)) x.mondaysTight += 1;
      }
      if (save.phase === "ended") {
        x.ended = true;
        c.endWeek ??= absWeek(save);
        x.ratingEnd = save.squad.length ? userSeedRatingFor(save) : 0;
      }
      if (kind === "seasonEnd" || ((kind === "day" || kind === "event") && save.phase === "seasonReview")) {
        x.ratingEnd = save.squad.length ? userSeedRatingFor(save) : 0;
        for (const r of c.renewals) {
          if (r.s !== save.clock.seasonIndex || r.kept !== null) continue;
          const p = save.squad.find((sq) => sq.id === r.id);
          r.kept = Boolean(p && p.contractEndSeason > save.clock.seasonIndex);
        }
      }
    };
    const sampleStars = (save: CareerSave) => {
      const s = save.clock.seasonIndex;
      const listing = M.listingFor({ world: save.world, squadIds: save.squad.map((p) => p.id), seasonIndex: s, careerSeed: save.careerSeed });
      const cap = E.signableOverallCap(save.reputation);
      const pool = [
        ...listing.freeAgents.map((view) => ({ view, splitsRemaining: null as number | null })),
        ...listing.contracted.map((x) => ({ view: x.view, splitsRemaining: x.splitsRemaining })),
      ].filter((x) => Math.round(x.view.overall) >= 85);
      const priced = pool.map(({ view, splitsRemaining }) => {
        const pack = M.askPackageFor(view, {
          rep: save.reputation,
          seasonIndex: s,
          difficulty: save.difficulty,
          careerSeed: save.careerSeed,
          role: "starter",
          lengthSeasons: 2,
          contracted: splitsRemaining === null ? undefined : { splitsRemaining },
        });
        return {
          overall: Math.round(view.overall),
          upfront: pack.fee + pack.signingBonus,
          wage: pack.salaryPerSplit,
          signable: Math.round(view.overall) <= cap,
        };
      });
      const cheapest = (min: number) =>
        priced
          .filter((p) => p.overall >= min)
          .sort((a, b) => a.upfront + 3 * a.wage - (b.upfront + 3 * b.wage))[0] ?? null;
      const ctx = { careerSeed: save.careerSeed, seasonIndex: s, world: save.world };
      const bills = Object.values(save.world.orgs).map((org) => ({
        region: org.region,
        bill: org.playerIds.reduce((n, id) => {
          const v = playerViewById(id, ctx);
          if (!v) return n;
          return (
            n +
            E.computeSalaryAsk({
              overall: v.overall,
              age: v.age,
              potential: v.potential,
              rep: 100,
              role: "starter",
              seasonIndex: s,
              lengthSeasons: 2,
              difficulty: save.difficulty,
              careerSeed: save.careerSeed,
              playerId: v.id,
            })
          );
        }, 0),
      }));
      const world = bills.map((b) => b.bill).sort((a, b) => b - a);
      const prev = c!.seasons.find((r) => r.s === s - 1);
      c!.stars.push({
        s,
        rep: save.reputation,
        balance: save.finances.balance,
        guaranteedPerSplit: guaranteedPerSplit(save),
        payrollPerSplit: save.squad.reduce((n, p) => n + p.salaryPerSplit, 0) + (save.coach?.salaryPerSplit ?? 0),
        prizesLastSeason: prev ? prizes(prev) : 0,
        n85: priced.length,
        n90: priced.filter((p) => p.overall >= 90).length,
        n85signable: priced.filter((p) => p.signable).length,
        n90signable: priced.filter((p) => p.signable && p.overall >= 90).length,
        c85: cheapest(85),
        c90: cheapest(90),
        best: [...priced].sort((a, b) => b.overall - a.overall || a.upfront + 3 * a.wage - (b.upfront + 3 * b.wage))[0] ?? null,
        aiWorld1: world[0] ?? 0,
        aiWorld5: mean(world.slice(0, 5)),
        aiRegion1: Math.max(0, ...bills.filter((b) => b.region === save.identity.region).map((b) => b.bill)),
      });
    };

    hub.tap = (e) => {
      if (e.kind === "create") {
        c = {
          ...cell,
          seasons: [],
          renewals: [],
          stars: [],
          signings: [],
          ended: null,
          firstWarningWeek: null,
          warningWeeks: [],
          rescueBurn: null,
          rescueWages: null,
          rescueWeek: null,
          rescueSwing: null,
          restructureWeeks: [],
          endWeek: null,
          firstSponsorSeason: null,
          arcRows: [],
        };
        for (const p of e.save.squad) joined.set(p.id, { age: ageOf(p.birthYear, 0), overall: p.overall, founder: true });
        snapshot(e.save, e.kind);
        seasonOf(0).balanceStart = e.save.finances.balance;
        sampleStars(e.save);
        return;
      }
      if (!c) return;
      if (e.kind === "renew") {
        const key = `${e.save.clock.seasonIndex}:${e.playerId}`;
        if (e.ask === undefined || e.res.error || renewSeen.has(key)) return;
        renewSeen.add(key);
        const before = e.save.squad.find((p) => p.id === e.playerId);
        const after = e.res.save.squad.find((p) => p.id === e.playerId);
        if (!before || !after) return;
        const j = joined.get(e.playerId);
        const gained = j ? before.overall - j.overall : 0;
        const age = ageOf(before.birthYear, e.save.clock.seasonIndex);
        const category: RenewalRec["category"] = j?.founder
          ? gained >= 3
            ? "founder +3"
            : "founder"
          : (j?.age ?? age) <= 19
            ? "signed ≤19"
            : "signed 20+";
        const rec: RenewalRec = {
          id: e.playerId,
          s: e.save.clock.seasonIndex,
          category,
          age,
          overall: before.overall,
          gained,
          prevWage: before.salaryPerSplit,
          ask: e.ask,
          guaranteedPerSplit: guaranteedPerSplit(e.save),
          kept: null,
        };
        c.renewals.push(rec);
        return;
      }
      if (e.kind === "sign") {
        if (e.res.error) return;
        const p = e.res.save.squad.find((x) => x.id === e.playerId);
        if (!p) return;
        const s = e.save.clock.seasonIndex;
        const age = ageOf(p.birthYear, s);
        joined.set(p.id, { age, overall: p.overall, founder: false });
        const fresh = e.res.save.finances.ledger.filter((l) => !seenLedger.has(l.id) && l.refName === p.name);
        const paid = (kind: LedgerEntry["kind"]) => -fresh.filter((l) => l.kind === kind).reduce((n, l) => n + l.amount, 0);
        c.signings.push({ s, overall: p.overall, age, fee: paid("transferOut"), bonus: paid("signingBonus"), wage: p.salaryPerSplit });
        return;
      }
      snapshot(e.save, e.kind);
      if (e.kind === "rollover") sampleStars(e.save);
    };

    const arc = playArcCareer({ ...cell, seasons });
    hub.tap = null;
    const done = c as EconCareer | null;
    if (!done) throw new Error("the tap never saw the career start");
    done.ended = arc.ended;
    done.arcRows = arc.seasons.map((r) => ({
      seasonIndex: r.seasonIndex,
      regionRank: r.regionRank,
      majorsQualified: r.majorsQualified,
      worlds: r.worlds,
      titles: r.titles,
      sales: r.sales,
      signings: r.signings,
      starSignings: r.starSignings,
    }));
    for (const x of done.seasons) if (x.balanceMin === Infinity) x.balanceMin = x.balanceEnd;
    out.push(done);
  }
  return out;
}

/** Insolvent = the career's phase went "ended" (the bot never retires). Read from the save, not
 * `ArcCareer.ended`: past the timeline or a title, `endCareer` keeps the earlier reason. */
const insolvent = (c: EconCareer) => c.endWeek !== null;
/** rc.32 (M4): at least one restructuring (a breach that did not end the career). */
const restructured = (c: EconCareer) => (c.restructureWeeks?.length ?? 0) > 0;

function careersReport(careers: EconCareer[], seasons: number, rescueSwing: number): string {
  const lines: string[] = [];
  const row = (cells: (string | number)[]) => lines.push(`| ${cells.join(" | ")} |`);
  const head = (cells: string[]) => {
    row(cells);
    lines.push(`|${cells.map(() => "---").join("|")}|`);
  };
  const W = 32;
  const S = 3;
  const cols = Array.from({ length: seasons }, (_, s) => s);
  const rowsAt = (cs: EconCareer[], s: number) => cs.map((c) => c.seasons.find((x) => x.s === s)).filter((x): x is EconSeason => Boolean(x));
  const diffs = ALL_DIFFS.filter((d) => careers.some((c) => c.difficulty === d));
  const policies = [...new Set(careers.map((c) => c.policy))];

  lines.push(
    `Careers: ${careers.length} (${[...new Set(careers.map((c) => c.region))].length} regions × ${diffs.length} difficulties × ${policies.length} policies × ${new Set(careers.map((c) => c.seed)).size} seeds: ${[...new Set(careers.map((c) => c.seed))].join(", ")}) · ${seasons} seasons each, stopping early on insolvency. Money is in-game USD; "per week" = the season's total ÷ 32 (the payroll's own unit); "per split" = a contract's unit (a season is 3 splits).`,
  );
  lines.push("");

  // C1. Outcomes and the safety net.
  lines.push("#### C1. Outcomes and the safety net — by difficulty × policy");
  lines.push("");
  lines.push(
    "Rescued = the Emergency Backer granted (one per career). Restructured (rc.32, M4) = a later breach that sold the highest-paid player instead of ending the career (Easy and Normal). Warned = a cash-warning mail (rc.32: or the 8-week notice) in the 8 weeks before the rescue; lead = weeks from the last such mail to the rescue (rc.32's warnings are weekly, so it reads 1); first warning → rescue = from the earliest warning in the season before it. Rescue window = the weeks of the burn on the rescue Monday that the Backer's swing (floor → rescue, on that Monday's wage bill) buys. Rescue → end = weeks from the Backer to insolvency. Tight Mondays = runway ≤ 4 weeks or the balance below $0.",
  );
  lines.push("");
  head(["Difficulty · policy", "n", "insolvent", "insolvent by S3", "rescued", "rescued that survive", "restructured", "restructurings / career", "warned in the 8 weeks before the rescue", "warning lead p50", "first warning → rescue p50", "rescue window p50", "rescue → end p50", "bank loans / career", "tight Mondays p50 (per season)"]);
  for (const d of diffs)
    for (const p of policies) {
      const cs = careers.filter((c) => c.difficulty === d && c.policy === p);
      if (!cs.length) continue;
      const ins = cs.filter(insolvent);
      const resc = cs.filter((c) => c.rescueWeek !== null);
      // Strictly before: a rescue back to +$3k at a ~$750 burn leaves exactly 4 weeks, so a warning follows it in the same payroll.
      const lastWarning = (c: EconCareer) => Math.max(-1, ...(c.warningWeeks ?? []).filter((w) => w < c.rescueWeek!));
      const warned = resc.filter((c) => lastWarning(c) >= 0 && c.rescueWeek! - lastWarning(c) <= 8);
      const lead = warned.map((c) => c.rescueWeek! - lastWarning(c));
      // rc.32: warnings are weekly, so the last one is a week out — the first of the squeeze (a season back) is the real lead.
      const firstWarning = (c: EconCareer) =>
        Math.min(Infinity, ...(c.warningWeeks ?? []).filter((w) => w < c.rescueWeek! && w >= c.rescueWeek! - W));
      const firstLead = warned.map((c) => c.rescueWeek! - firstWarning(c));
      const toEnd = ins.filter((c) => c.rescueWeek !== null && c.endWeek !== null).map((c) => c.endWeek! - c.rescueWeek!);
      const tight = cs.flatMap((c) => c.seasons.map((x) => x.mondaysTight));
      const windows = resc
        .filter((c) => (c.rescueBurn ?? 0) > 0)
        .map((c) => (c.rescueSwing ?? rescueSwing) / c.rescueBurn!);
      row([
        `${d} · ${p}`,
        cs.length,
        pct(ins.length, cs.length),
        pct(ins.filter((c) => c.endWeek !== null && c.endWeek < 4 * W).length, cs.length),
        pct(resc.length, cs.length),
        pct(resc.filter((c) => !insolvent(c)).length, resc.length),
        pct(cs.filter(restructured).length, cs.length),
        ratio(mean(cs.map((c) => c.restructureWeeks?.length ?? 0)), 1),
        pct(warned.length, resc.length),
        lead.length ? `${q(lead, 0.5)} wk` : "–",
        firstLead.length ? `${q(firstLead, 0.5)} wk` : "–",
        windows.length ? `${ratio(q(windows, 0.5), 0)} wk` : "–",
        toEnd.length ? `${q(toEnd, 0.5)} wk` : "–",
        ratio(mean(cs.map((c) => c.seasons.reduce((n, x) => n + x.bankLoans, 0))), 1),
        ratio(q(tight, 0.5), 0),
      ]);
    }
  lines.push("");
  const masked = careers.filter((c) => insolvent(c) && c.ended !== "insolvency");
  lines.push(
    `Insolvent careers the harness's \`ArcCareer.ended\` reports under another reason (an insolvency in the infinite era keeps the earlier \`timeline_complete\` / \`worlds_won\`): ${masked.length} of ${careers.filter(insolvent).length}${masked.length ? ` (${masked.map((c) => `${c.region} ${c.difficulty} ${c.policy} S${Math.floor(c.endWeek! / W)}`).join(", ")})` : ""}.`,
  );
  lines.push("");

  // C1b. Region × difficulty.
  lines.push("#### C1b. Insolvent (rescued · restructured) by region × difficulty — every policy");
  lines.push("");
  head(["Region", ...diffs]);
  for (const region of ALL_REGIONS) {
    const cs = careers.filter((c) => c.region === region);
    if (!cs.length) continue;
    row([
      region,
      ...diffs.map((d) => {
        const xs = cs.filter((c) => c.difficulty === d);
        return xs.length
          ? `${pct(xs.filter(insolvent).length, xs.length)} (${pct(xs.filter((c) => c.rescueWeek !== null).length, xs.length)} · ${pct(xs.filter(restructured).length, xs.length)})`
          : "–";
      }),
    ]);
  }
  lines.push("");

  // C1c. Does a first career pay its way?
  lines.push("#### C1c. Does a first career pay its way? Seasons 0–1, by difficulty × policy");
  lines.push("");
  lines.push(
    "Net = earned − spent over the first two seasons. \"Without a big win\" leaves out Major and Worlds prizes and regional titles (a first-season title is the unlikely win the ROADMAP rules out).",
  );
  lines.push("");
  head(["Difficulty · policy", "n", "net S0–S1 ≥ 0", "… without a big win", "net S0–S1 p10 / p50 / p90", "big-win share of S0–S1 earned p50", "alive at the end of S1"]);
  for (const d of diffs)
    for (const p of policies) {
      const cs = careers.filter((c) => c.difficulty === d && c.policy === p);
      if (!cs.length) continue;
      const two = cs.map((c) => c.seasons.filter((x) => x.s <= 1));
      const net = two.map((xs) => xs.reduce((n, x) => n + earned(x) - spent(x), 0));
      const big = two.map((xs) => xs.reduce((n, x) => n + sumKeys(x.income, ["prize:major", "prize:worlds"]) + x.regionalTitles, 0));
      const earnedTwo = two.map((xs) => xs.reduce((n, x) => n + earned(x), 0));
      row([
        `${d} · ${p}`,
        cs.length,
        pct(net.filter((n) => n >= 0).length, cs.length),
        pct(net.filter((n, i) => n - big[i] >= 0).length, cs.length),
        p3(net),
        `${Math.round(100 * q(earnedTwo.map((e, i) => (e > 0 ? big[i] / e : 0)), 0.5))}%`,
        pct(cs.filter((c) => c.endWeek === null || c.endWeek >= 2 * W).length, cs.length),
      ]);
    }
  lines.push("");

  // C2. Where the week's money comes from and goes, by season (normal).
  const moneyBySeason = (d: CareerDifficulty) => {
    const cs = careers.filter((c) => c.difficulty === d);
    if (!cs.length) return;
    lines.push(`#### C2${d === "normal" ? "" : `-${d}`}. The week's money by source and season — ${d}, every policy (mean per week over the careers alive that season)`);
    lines.push("");
    head(["Per week", ...cols.map((s) => `S${s} (n ${rowsAt(cs, s).length})`)]);
    const line = (name: string, f: (x: EconSeason) => number) =>
      row([name, ...cols.map((s) => money(mean(rowsAt(cs, s).map(f)) / W))]);
    for (const [name, keys] of Object.entries(INCOME_GROUPS)) line(`in · ${name}`, (x) => sumKeys(x.income, keys));
    line("**in · earned, total**", earned);
    line("in · loans (Backer grant, bank)", (x) => sumKeys(x.income, LOAN_KINDS));
    for (const [name, keys] of Object.entries(SPEND_GROUPS)) line(`out · ${name}`, (x) => sumKeys(x.spend, keys));
    line("**out · total**", spent);
    line("**net (earned − out)**", (x) => earned(x) - spent(x));
    lines.push("");
  };
  moneyBySeason("normal");

  // C2b. Easy and hard, compact.
  lines.push("#### C2b. Earned income, wages and net per week by season — p50 by difficulty");
  lines.push("");
  head(["Difficulty · per week", ...cols.map((s) => `S${s}`)]);
  for (const d of diffs) {
    const cs = careers.filter((c) => c.difficulty === d);
    row([`${d} · earned`, ...cols.map((s) => money(q(rowsAt(cs, s).map(earned), 0.5) / W))]);
    row([`${d} · wages + coach`, ...cols.map((s) => money(q(rowsAt(cs, s).map((x) => sumKeys(x.spend, ["payroll", "salary", "coachSalary"])), 0.5) / W))]);
    row([`${d} · net`, ...cols.map((s) => money(q(rowsAt(cs, s).map((x) => earned(x) - spent(x)), 0.5) / W))]);
  }
  lines.push("");

  // C2c. The transfer market as a path, by policy.
  lines.push("#### C2c. The transfer market as a path — per career over its seasons, by policy (every difficulty)");
  lines.push("");
  head(["Policy", "careers", "fees received p50 · p90", "fees paid p50 · p90", "signing bonuses p50", "severance p50", "stand-in fees p50", "signings / career", "insolvent"]);
  for (const p of policies) {
    const cs = careers.filter((c) => c.policy === p);
    const tot = (c: EconCareer, side: "income" | "spend", keys: string[]) => c.seasons.reduce((n, x) => n + sumKeys(x[side], keys), 0);
    const recv = cs.map((c) => tot(c, "income", ["transferIn"]));
    const paid = cs.map((c) => tot(c, "spend", ["transferOut"]));
    row([
      p,
      cs.length,
      `${money(q(recv, 0.5))} · ${money(q(recv, 0.9))}`,
      `${money(q(paid, 0.5))} · ${money(q(paid, 0.9))}`,
      money(q(cs.map((c) => tot(c, "spend", ["signingBonus"])), 0.5)),
      money(q(cs.map((c) => tot(c, "spend", ["severance", "releaseFee"])), 0.5)),
      money(q(cs.map((c) => tot(c, "spend", ["standInFee"])), 0.5)),
      ratio(mean(cs.map((c) => c.signings.length)), 1),
      pct(cs.filter(insolvent).length, cs.length),
    ]);
  }
  lines.push("");

  // C3. Payroll vs guaranteed income.
  lines.push("#### C3. Payroll ÷ guaranteed income, and the prize share — p10 / p50 / p90 by season");
  lines.push("");
  lines.push(
    "Payroll = wages + coach paid that season; guaranteed = sponsor base + fanbase received. A season with no guaranteed income is left out of the ratio (it is infinite) and counted in its own row.",
  );
  lines.push("");
  head(["Difficulty", ...cols.map((s) => `S${s}`)]);
  for (const d of diffs) {
    const cs = careers.filter((c) => c.difficulty === d);
    row([
      `${d} · payroll ÷ guaranteed`,
      ...cols.map((s) =>
        p3(
          rowsAt(cs, s)
            .filter((x) => sumKeys(x.income, ["sponsorBase", "fanbase"]) > 0)
            .map((x) => sumKeys(x.spend, ["payroll", "salary", "coachSalary"]) / sumKeys(x.income, ["sponsorBase", "fanbase"])),
          (n) => ratio(n, 1),
        ),
      ),
    ]);
    row([
      `${d} · no sponsor all season`,
      ...cols.map((s) => {
        const xs = rowsAt(cs, s);
        return pct(xs.filter((x) => (x.income.sponsorBase ?? 0) === 0).length, xs.length);
      }),
    ]);
    row([
      `${d} · prize share of earned`,
      ...cols.map((s) =>
        p3(
          rowsAt(cs, s)
            .filter((x) => earned(x) > 0)
            .map((x) => prizes(x) / earned(x)),
          (n) => `${Math.round(n * 100)}%`,
        ),
      ),
    ]);
  }
  lines.push("");

  // C3b. What each sponsor tier's base carries in practice.
  lines.push("#### C3b. Payroll against the sponsor base, by the sponsor tier held at season end (every difficulty)");
  lines.push("");
  lines.push("Per split, at the season's end. Tier 0 = no deal. Guaranteed = the deal's base + the fanbase.");
  lines.push("");
  head(["Sponsor tier", "season-rows", "rep p50", "team rating p50", "wages + coach / split p50", "guaranteed / split p50", "payroll ÷ guaranteed p10 / p50 / p90"]);
  const endRows = careers.flatMap((c) => c.seasons);
  for (const tier of [0, 1, 2, 3, 4]) {
    const xs = endRows.filter((x) => x.sponsorTierEnd === tier);
    if (!xs.length) continue;
    row([
      tier === 0 ? "none" : `T${tier}`,
      xs.length,
      ratio(q(xs.map((x) => x.repEnd), 0.5), 0),
      ratio(q(xs.filter((x) => x.ratingEnd > 0).map((x) => x.ratingEnd), 0.5), 1),
      money(q(xs.map((x) => x.wagesPerSplitEnd + x.coachPerSplitEnd), 0.5)),
      money(q(xs.map((x) => x.guaranteedPerSplitEnd), 0.5)),
      p3(
        xs.filter((x) => x.guaranteedPerSplitEnd > 0).map((x) => (x.wagesPerSplitEnd + x.coachPerSplitEnd) / x.guaranteedPerSplitEnd),
        (n) => ratio(n, 1),
      ),
    ]);
  }
  lines.push("");

  // C4. Balance and debt.
  lines.push("#### C4. Balance and debt at season end — p10 / p50 / p90 by difficulty");
  lines.push("");
  head(["Difficulty", ...cols.map((s) => `S${s}`)]);
  for (const d of diffs) {
    const cs = careers.filter((c) => c.difficulty === d);
    row([`${d} · balance`, ...cols.map((s) => p3(rowsAt(cs, s).map((x) => x.balanceEnd)))]);
    row([`${d} · low point`, ...cols.map((s) => p3(rowsAt(cs, s).map((x) => x.balanceMin)))]);
    row([`${d} · debt owed (Backer + bank)`, ...cols.map((s) => p3(rowsAt(cs, s).map((x) => x.backerOwedEnd + x.bankOwedEnd)))]);
    row([
      `${d} · alive · rescued · ended`,
      ...cols.map((s) => {
        const xs = rowsAt(cs, s);
        return `${xs.length} · ${xs.filter((x) => x.backerGranted).length} · ${xs.filter((x) => x.ended).length}`;
      }),
    ]);
  }
  lines.push("");

  // C5. Regions (normal).
  lines.push("#### C5. Regions — normal difficulty, every policy");
  lines.push("");
  lines.push("Rep and the money columns are p50 at the end of the season named. First sponsor = the season the first deal was signed (– never).");
  lines.push("");
  head(["Region", "n", "insolvent", "rescued", "restructured", "first sponsor p50", "no sponsor by end S1", "rep S0 · S1", "guaranteed / wk S1", "wages / wk S1", "balance S1 · S3", "seasons alive p50"]);
  for (const region of ALL_REGIONS) {
    const cs = careers.filter((c) => c.difficulty === "normal" && c.region === region);
    if (!cs.length) continue;
    const at = (s: number, f: (x: EconSeason) => number) => q(rowsAt(cs, s).map(f), 0.5);
    const first = cs.map((c) => c.firstSponsorSeason).filter((x): x is number => x !== null);
    row([
      region,
      cs.length,
      pct(cs.filter(insolvent).length, cs.length),
      pct(cs.filter((c) => c.rescueWeek !== null).length, cs.length),
      pct(cs.filter(restructured).length, cs.length),
      first.length ? `S${q(first, 0.5)}` : "–",
      pct(cs.filter((c) => c.firstSponsorSeason === null || c.firstSponsorSeason > 1).length, cs.length),
      `${ratio(at(0, (x) => x.repEnd), 0)} · ${ratio(at(1, (x) => x.repEnd), 0)}`,
      money(at(1, (x) => sumKeys(x.income, ["sponsorBase", "fanbase"])) / W),
      money(at(1, (x) => sumKeys(x.spend, ["payroll", "salary"])) / W),
      `${money(at(1, (x) => x.balanceEnd))} · ${money(at(3, (x) => x.balanceEnd))}`,
      ratio(q(cs.map((c) => c.seasons.length), 0.5), 0),
    ]);
  }
  lines.push("");

  // C6. Renewals.
  lines.push("#### C6. The renewal shock — the fresh ask ÷ the wage it replaces");
  lines.push("");
  lines.push(
    "Every renewal the bot priced (autopilot renews all at the ask; the others keep a player only while the books carry him). Founder +3 = a founder who gained 3+ overall since day 1; signed ≤19 = a player signed at 19 or younger (the developed youth).",
  );
  lines.push("");
  head(["Who", "n", "ask ÷ old wage p10 / p50 / p90", "overall gained p50", "new ask ÷ guaranteed income p50", "kept"]);
  const recs = careers.flatMap((c) => c.renewals);
  for (const cat of ["founder", "founder +3", "signed ≤19", "signed 20+"] as const) {
    const rs = recs.filter((r) => r.category === cat && r.prevWage > 0);
    if (!rs.length) continue;
    row([
      cat,
      rs.length,
      p3(rs.map((r) => r.ask / r.prevWage), (n) => `×${n.toFixed(2)}`),
      ratio(q(rs.map((r) => r.gained), 0.5), 1),
      ratio(q(rs.filter((r) => r.guaranteedPerSplit > 0).map((r) => r.ask / r.guaranteedPerSplit), 0.5), 2),
      pct(rs.filter((r) => r.kept).length, rs.filter((r) => r.kept !== null).length),
    ]);
  }
  lines.push("");
  head(["Renewal season", "n", "ask ÷ old wage p10 / p50 / p90", "old wage / wk p50", "new ask / wk p50", "kept"]);
  for (const s of cols) {
    const rs = recs.filter((r) => r.s === s && r.prevWage > 0);
    if (!rs.length) continue;
    row([
      `S${s}`,
      rs.length,
      p3(rs.map((r) => r.ask / r.prevWage), (n) => `×${n.toFixed(2)}`),
      money((q(rs.map((r) => r.prevWage), 0.5) * S) / W),
      money((q(rs.map((r) => r.ask), 0.5) * S) / W),
      pct(rs.filter((r) => r.kept).length, rs.filter((r) => r.kept !== null).length),
    ]);
  }
  lines.push("");

  // C7. Star access.
  lines.push("#### C7. Star access at each season start — the market's 85+ and 90+ against the user's books");
  lines.push("");
  lines.push(
    "Sampled on day 1 of every season (the preseason window opens), before the bot moves. Cheapest = the lowest fee + bonus + a season's wage. Carry = the star's wage fits in the guaranteed income left after the current payroll; carry with prizes = in that plus last season's prizes ÷ 3. AI bill = the best AI rosters' three asks at the user's prices (world #1, region #1), the only measurable stand-in for a league budget.",
  );
  lines.push("");
  head(["Season", "n", "85+ on the market p50 (signable)", "90+ p50 (signable)", "best available p50: overall · up front · wage / wk", "cheapest 85+: up front · wage / wk", "cheapest 90+: up front · wage / wk", "balance p50 · p90", "can pay the 85+ up front", "can carry the 85+ (with prizes)", "can carry the 90+ (with prizes)", "AI bill / wk: world #1 · region #1", "a 90+ wage ÷ the region's #1 AI bill"]);
  for (const s of cols) {
    const st = careers.flatMap((c) => c.stars.filter((x) => x.s === s));
    if (!st.length) continue;
    const c85 = st.filter((x) => x.c85);
    const c90 = st.filter((x) => x.c90);
    const carry = (x: StarRec, k: "c85" | "c90", withPrizes: boolean) => {
      const star = x[k];
      if (!star) return false;
      const room = x.guaranteedPerSplit - x.payrollPerSplit + (withPrizes ? x.prizesLastSeason / S : 0);
      return star.wage <= room;
    };
    row([
      `S${s}`,
      st.length,
      `${ratio(q(st.map((x) => x.n85), 0.5), 0)} (${ratio(q(st.map((x) => x.n85signable), 0.5), 0)})`,
      `${ratio(q(st.map((x) => x.n90), 0.5), 0)} (${ratio(q(st.map((x) => x.n90signable), 0.5), 0)})`,
      st.some((x) => x.best)
        ? `${ratio(q(st.filter((x) => x.best).map((x) => x.best!.overall), 0.5), 0)} · ${money(q(st.filter((x) => x.best).map((x) => x.best!.upfront), 0.5))} · ${money((q(st.filter((x) => x.best).map((x) => x.best!.wage), 0.5) * S) / W)}`
        : "–",
      c85.length ? `${money(q(c85.map((x) => x.c85!.upfront), 0.5))} · ${money((q(c85.map((x) => x.c85!.wage), 0.5) * S) / W)}` : "–",
      c90.length ? `${money(q(c90.map((x) => x.c90!.upfront), 0.5))} · ${money((q(c90.map((x) => x.c90!.wage), 0.5) * S) / W)}` : "–",
      `${money(q(st.map((x) => x.balance), 0.5))} · ${money(q(st.map((x) => x.balance), 0.9))}`,
      pct(c85.filter((x) => x.balance >= x.c85!.upfront).length, st.length),
      `${pct(c85.filter((x) => carry(x, "c85", false)).length, st.length)} (${pct(c85.filter((x) => carry(x, "c85", true)).length, st.length)})`,
      `${pct(c90.filter((x) => carry(x, "c90", false)).length, st.length)} (${pct(c90.filter((x) => carry(x, "c90", true)).length, st.length)})`,
      `${money((q(st.map((x) => x.aiWorld1), 0.5) * S) / W)} · ${money((q(st.map((x) => x.aiRegion1), 0.5) * S) / W)}`,
      c90.length ? ratio(q(c90.map((x) => x.c90!.wage / Math.max(1, x.aiRegion1)), 0.5), 2) : "–",
    ]);
  }
  lines.push("");
  lines.push("Signings the bot actually made, by season (88+ = the harness's \"star\"):");
  lines.push("");
  head(["Season", "signings", "of them 85+", "88+", "90+", "85+ wage / wk p50", "85+ fee + bonus p50", "careers with an 88+ signing"]);
  for (const s of cols) {
    const sg = careers.flatMap((c) => c.signings.filter((x) => x.s === s));
    const alive = careers.filter((c) => c.seasons.some((x) => x.s === s)).length;
    const stars = sg.filter((x) => x.overall >= 85);
    row([
      `S${s}`,
      sg.length,
      stars.length,
      sg.filter((x) => x.overall >= 88).length,
      sg.filter((x) => x.overall >= 90).length,
      stars.length ? money((q(stars.map((x) => x.wage), 0.5) * S) / W) : "–",
      stars.length ? money(q(stars.map((x) => x.fee + x.bonus), 0.5)) : "–",
      pct(careers.filter((c) => c.signings.some((x) => x.s === s && x.overall >= 88)).length, alive),
    ]);
  }
  lines.push("");

  // C7b. Star access by difficulty (the bands of criteria c2 and c3).
  lines.push("#### C7b. Star access by difficulty — carrying the cheapest 90+ (guaranteed + last season's prizes) and signing an 88+");
  lines.push("");
  head(["Difficulty", "can carry a 90+ at S3", "S5", "S6", "S7", "careers with an 88+ signing by S4", "by S7"]);
  for (const d of diffs) {
    const cs = careers.filter((c) => c.difficulty === d);
    const carryAt = (s: number) => {
      const st = cs.flatMap((c) => c.stars.filter((x) => x.s === s));
      const ok = st.filter((x) => x.c90 && x.c90.wage <= x.guaranteedPerSplit - x.payrollPerSplit + x.prizesLastSeason / S);
      return st.length ? `${pct(ok.length, st.length)} (n ${st.length})` : "–";
    };
    const signedBy = (s: number) => pct(cs.filter((c) => c.signings.some((x) => x.s <= s && x.overall >= 88)).length, cs.length);
    row([d, carryAt(3), carryAt(5), carryAt(6), carryAt(7), signedBy(4), signedBy(7)]);
  }
  lines.push("");

  // C8. The slope: what a stronger squad costs and earns.
  lines.push("#### C8. The slope — a season's money by the team rating at its end (every difficulty)");
  lines.push("");
  lines.push("Does a stronger squad earn what it costs? Each row is one career-season; per week.");
  lines.push("");
  head(["Team rating", "n", "wages + coach / wk p50", "prizes / wk p50", "guaranteed / wk p50", "net / wk p10 / p50 / p90", "ended that season"]);
  const all = careers.flatMap((c) => c.seasons).filter((x) => x.ratingEnd > 0);
  for (const [lo, hi] of [[0, 76], [76, 79], [79, 82], [82, 85], [85, 88], [88, 99]] as const) {
    const xs = all.filter((x) => x.ratingEnd >= lo && x.ratingEnd < hi);
    if (!xs.length) continue;
    row([
      lo === 0 ? `< ${hi}` : hi === 99 ? `${lo}+` : `${lo}–${hi - 1}`,
      xs.length,
      money(q(xs.map((x) => sumKeys(x.spend, ["payroll", "salary", "coachSalary"])), 0.5) / W),
      money(q(xs.map(prizes), 0.5) / W),
      money(q(xs.map((x) => sumKeys(x.income, ["sponsorBase", "fanbase"])), 0.5) / W),
      p3(xs.map((x) => (earned(x) - spent(x)) / W)),
      pct(xs.filter((x) => x.ended).length, xs.length),
    ]);
  }
  lines.push("");

  // C9. Snowball.
  lines.push("#### C9. Snowball — the balance in seasons of payroll, by season (p50 / p90)");
  lines.push("");
  lines.push("Balance at season end ÷ that season's wages + coach. Above 2, money has stopped being a decision for that career.");
  lines.push("");
  head(["Difficulty", ...cols.map((s) => `S${s}`)]);
  for (const d of diffs) {
    const cs = careers.filter((c) => c.difficulty === d);
    const banked = (x: EconSeason) => x.balanceEnd / Math.max(1, sumKeys(x.spend, ["payroll", "salary", "coachSalary"]));
    row([
      `${d} · p50 / p90`,
      ...cols.map((s) => {
        const xs = rowsAt(cs, s);
        return xs.length ? `${ratio(q(xs.map(banked), 0.5), 1)} / ${ratio(q(xs.map(banked), 0.9), 1)}` : "–";
      }),
    ]);
    row([
      `${d} · above 2 seasons`,
      ...cols.map((s) => {
        const xs = rowsAt(cs, s);
        return pct(xs.filter((x) => banked(x) > 2).length, xs.length);
      }),
    ]);
    row([
      `${d} · with a tight Monday (money still decides)`,
      ...cols.map((s) => {
        const xs = rowsAt(cs, s);
        return pct(xs.filter((x) => x.mondaysTight > 0).length, xs.length);
      }),
    ]);
  }
  lines.push("");

  // C10. rc.32: Miguel's guardrail (30/10) — both sides on one table.
  lines.push("#### C10. Both sides of the guardrail — by difficulty (rc.32; Miguel, 30/10: not too easy, not punitive)");
  lines.push("");
  lines.push(
    "Left of the bar, the unfair break: insolvent (the career ended through money), the newcomer policies (autopilot, badSponsor, losingStart), rescued, restructured. Right of it, money still decides: the spender still going broke, season-rows with a tight Monday in S3–S5, the snowball p90 (balance in seasons of payroll, S2–S7 worst), careers with an 88+ signing by S4.",
  );
  lines.push("");
  head(["Difficulty", "n", "insolvent", "newcomers insolvent", "rescued", "restructured", "‖ spender insolvent", "tight Monday S3–S5", "snowball p90 S2–S7 (max)", "88+ signing by S4"]);
  const newcomer = new Set(["autopilot", "badSponsor", "losingStart"]);
  for (const d of diffs) {
    const cs = careers.filter((c) => c.difficulty === d);
    if (!cs.length) continue;
    const nw = cs.filter((c) => newcomer.has(c.policy));
    const sp = cs.filter((c) => c.policy === "spender");
    const mid = cs.flatMap((c) => c.seasons.filter((x) => x.s >= 3 && x.s <= 5));
    const banked = (x: EconSeason) => x.balanceEnd / Math.max(1, sumKeys(x.spend, ["payroll", "salary", "coachSalary"]));
    const p90s = cols.filter((s) => s >= 2).map((s) => rowsAt(cs, s)).filter((xs) => xs.length > 0).map((xs) => q(xs.map(banked), 0.9));
    row([
      d,
      cs.length,
      pct(cs.filter(insolvent).length, cs.length),
      pct(nw.filter(insolvent).length, nw.length),
      pct(cs.filter((c) => c.rescueWeek !== null).length, cs.length),
      pct(cs.filter(restructured).length, cs.length),
      pct(sp.filter(insolvent).length, sp.length),
      pct(mid.filter((x) => x.mondaysTight > 0).length, mid.length),
      p90s.length ? ratio(Math.max(...p90s), 1) : "–",
      pct(cs.filter((c) => c.signings.some((x) => x.s <= 4 && x.overall >= 88)).length, cs.length),
    ]);
  }
  lines.push("");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// The tests (opt-in)
// ---------------------------------------------------------------------------

describe.skipIf(!env.CAREER_ECON)("career economy probe (ECO-01, measures only)", () => {
  it(
    "writes the curves and the careers' money tables",
    async () => {
      const t0 = Date.now();
      const regions = list(env.ECON_REGIONS, ALL_REGIONS);
      const diffs = list<CareerDifficulty>(env.ECON_DIFFS, ALL_DIFFS);
      const { ARC_POLICIES } = await import("./careerArcBot");
      const policies = list<ArcPolicyId>(env.ECON_POLICIES, Object.keys(ARC_POLICIES) as ArcPolicyId[]);
      const seeds = Number(env.ECON_SEEDS ?? 1);
      const seasons = Number(env.ECON_SEASONS ?? 8);
      const knobs = [
        "CAREER_ECON=1",
        env.ECON_REGIONS ? `ECON_REGIONS=${env.ECON_REGIONS}` : "",
        env.ECON_DIFFS ? `ECON_DIFFS=${env.ECON_DIFFS}` : "",
        env.ECON_POLICIES ? `ECON_POLICIES=${env.ECON_POLICIES}` : "",
        env.ECON_SEEDS ? `ECON_SEEDS=${env.ECON_SEEDS}` : "",
        env.ECON_SEASONS ? `ECON_SEASONS=${env.ECON_SEASONS}` : "",
        env.ECON_CURVES_ONLY ? "ECON_CURVES_ONLY=1" : "",
      ]
        .filter(Boolean)
        .join(" ");
      const parts: string[] = [];
      parts.push(
        `> Generated by \`${knobs} ECON_MD=<file> npx vitest run src/store/careerEconomy.probe.test.ts\` (src/store/careerEconomy.probe.test.ts). Regenerate, never hand-edit.`,
      );
      parts.push("");
      parts.push("### Part 1 — the curves (pure engine functions)");
      parts.push("");
      parts.push(await curvesReport());
      if (!env.ECON_CURVES_ONLY) {
        const cells: { region: Region; difficulty: CareerDifficulty; policy: ArcPolicyId; seed: number }[] = [];
        for (const region of regions)
          for (const difficulty of diffs)
            for (const policy of policies)
              for (let k = 0; k < seeds; k++) cells.push({ region, difficulty, policy, seed: 9100 + k * 7919 });
        // ECON_IN re-renders a saved ECON_OUT dump without replaying the careers.
        const saved = env.ECON_IN ? (JSON.parse(readFileSync(env.ECON_IN, "utf8")) as { seasons: number; careers: EconCareer[] }) : null;
        const careers = saved ? saved.careers : await playEconCareers(cells, seasons);
        if (!saved) expect(careers).toHaveLength(cells.length);
        if (env.ECON_OUT && !saved) writeFileSync(env.ECON_OUT, JSON.stringify({ seasons, careers }));
        parts.push("### Part 2 — careers through the real flow (the long-career bot)");
        parts.push("");
        const { CAREER_LOAN } = await import("@/config/balance");
        parts.push(careersReport(careers, saved ? saved.seasons : seasons, CAREER_LOAN.rescueTo - CAREER_LOAN.floor));
      }
      const secs = Math.round((Date.now() - t0) / 1000);
      parts.push(
        env.ECON_IN && !env.ECON_CURVES_ONLY
          ? `_Re-rendered from a saved run (ECON_IN)${env.ECON_RUNTIME ? `; that sweep took ${env.ECON_RUNTIME} in one process` : ""}._`
          : `_Runtime: ${secs} s in one process._`,
      );
      const md = parts.join("\n");
      if (env.ECON_MD) writeFileSync(env.ECON_MD, md);
      else console.log(md);
    },
    7_200_000,
  );
});
