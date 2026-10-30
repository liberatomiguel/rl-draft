/**
 * Road to Worlds — the training probe (rc.34, DEV-03, TRAINING-CONTRACT §7).
 *
 * MEASURES ONLY. Opt-in and skipped by default; never imported by the app:
 *
 *   CAREER_TRAINING=1 TRAINING_MD=out.md npx vitest run src/store/careerTraining.probe.test.ts
 *
 * Knobs: TRAINING_SEEDS (prospect samples, default 12), TRAINING_FLOW (0 skips
 * the whole-career section P7; default on), TRAINING_FLOW_SEASONS (default 2).
 * The pure sections take seconds; P7 plays real careers through the arc bot.
 *
 *  - P1 a season's gain with and without a package, by age (t2, t3, t4) —
 *    generated prospects through the real daily tick (`trainDay` with the
 *    package's effect), the package scrims (`scrimXpWeeksFor`, the period cap
 *    from a sessions-only pass, as the flow does) and four series every other
 *    week (the growth probe's G4 schedule). rc.33's delegated coach is the
 *    "before" row (its multiplier × auto focus × the coach's drill, its two
 *    run-now scrims a week). rc.36 (front T2, R83): a package pays
 *    CAREER_PLAN.payout.alongShare along the way and its held rest at each
 *    28-day cycle's end, as the flow does.
 *  - P2 the coach profiles (none; generic 75 / 2; generic 88 / 6 development;
 *    ex-pro peak 85; ex-pro peak 99): a period's expected gain by age.
 *  - P3 the scrim levels: XP, chemistry, wear, confidence per period.
 *  - P4 wear → the pre-event unavailability chance (t6).
 *  - P5 plan quality by experience (t5).
 *  - P6 the coach market (t7): quality by source, a generic within 5 of the
 *    best ex-pro, wages.
 *  - P7 whole careers (the arc bot): base, delegated, trainer, tuned —
 *    prompts (t1), summaries, scrims, unavailability, gain by source.
 */

import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CAREER_CALENDAR, CAREER_DEV, CAREER_PLAN, CAREER_SCRIM, CAREER_TRAINING, CAREER_WORLD } from "@/config/balance";
import {
  ageOf,
  applyMatchXp,
  coachMultFor,
  developmentProfileOf,
  fieldQualityFor,
  peakTargetOf,
  rookieView,
  seasonYear,
  squadRollover,
  trainDay,
  trainWeek,
} from "@/engine/career/development";
import { coachWageFor } from "@/engine/career/economy";
import { coachCandidatesFor, exProCoachQuality } from "@/engine/career/market";
import {
  coachEfficiencyFor,
  coachProfileOf,
  packageEffectFor,
  paidSessionMultFor,
  planQualityFor,
  scrimCapRatio,
  scrimXpWeeksFor,
  unavailabilityAddFor,
  type CoachTrainingProfile,
} from "@/engine/career/training";
import type { CareerPlayerView, CoachState, ScrimLevel, SquadPlayer, TrainingObjective, TrainingPackage, TrainingWorkload } from "@/engine/career/types";
import { agePassAndIntake, buildWorldAtCreation } from "@/engine/career/worldSim";
import type { Region } from "@/engine/types";
import { createRng } from "@/lib/rng";

const env = process.env;
const REGIONS: Region[] = ["NA", "EU", "SAM", "MENA", "OCE", "APAC", "SSA"];
const seedOf = (k: number) => 1000 + k * 7919;
const q = (xs: number[], p: number): number => {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.round(p * (s.length - 1))))];
};
const f2 = (n: number) => (Number.isNaN(n) ? "–" : n.toFixed(2));
const f1 = (n: number) => (Number.isNaN(n) ? "–" : n.toFixed(1));
const pct = (n: number, d: number) => (d === 0 ? "–" : `${((100 * n) / d).toFixed(0)}%`);

// ---------------------------------------------------------------------------
// Coach profiles (P1, P2)
// ---------------------------------------------------------------------------

function coach(id: string, quality: number, experience: number, specialty: TrainingObjective, source: CoachState["source"] = "generated"): CoachState {
  return {
    id,
    name: id,
    overall: quality,
    bonusType: "mechanics",
    bonusLevel: "+",
    salaryPerSplit: 0,
    source,
    experience,
    specialty,
  };
}

const COACHES: { key: string; coach: CoachState | null }[] = [
  { key: "none", coach: null },
  { key: "generic 75 · 2 exp · preparation", coach: coach("g75", 75, 2, "preparation") },
  { key: "generic 88 · 6 exp · development", coach: coach("g88", 88, 6, "development") },
  { key: `ex-pro peak 85 (q ${exProCoachQuality(85, 0.5)}) · 3 exp · development`, coach: coach("x85", exProCoachQuality(85, 0.5), 3, "development", "real") },
  { key: `ex-pro peak 99 (q ${exProCoachQuality(99, 0.5)}) · 3 exp · development`, coach: coach("x99", exProCoachQuality(99, 0.5), 3, "development", "real") },
];

const DEV_PKG: TrainingPackage = { objective: "development", focus: "balanced", workload: "normal", scrimsPerWeek: 2, scrimLevel: "even" };

// ---------------------------------------------------------------------------
// P1 — a season through the real tick
// ---------------------------------------------------------------------------

interface Setup {
  key: string;
  pkg: TrainingPackage | null;
  coach: CoachTrainingProfile | null;
  unsupervised?: boolean;
  /** rc.33's "before": a flat multiplier on the base and run-now scrims (0.5 weeks × quality each, no cap). */
  rc33?: { mult: number; scrims: number };
}

interface SeasonSample {
  age: number;
  gain: number;
  sessions: number;
  scrims: number;
  series: number;
  over: boolean;
  /** Each period's scrim share of its gain (sessions + scrims + series). */
  shares: number[];
}

const LEVEL_GAP: Record<ScrimLevel, number> = { easy: -5.5, even: 0, hard: 5.5 };

/** One season of the G4 schedule: odd weeks open (Training Week bonus), even weeks an event (match prep, four series at 0.85). */
function season(p0: SquadPlayer, seasonIndex: number, careerSeed: number, s: Setup): { p: SquadPlayer; sample: SeasonSample } {
  let p: SquadPlayer = { ...p0, gainedThisSeason: 0, gainedThisSplit: 0 };
  const start = p.overall;
  let sessions = 0;
  let scrims = 0;
  let series = 0;
  const shares: number[] = [];
  const periodWeeks = CAREER_PLAN.periodDays / CAREER_CALENDAR.daysPerWeek;
  const fx = packageEffectFor(s.pkg, s.coach, p.id, { unsupervised: s.unsupervised });
  const level = s.pkg && s.pkg.scrimsPerWeek > 0 ? (s.pkg.scrimLevel === "auto" ? "even" : s.pkg.scrimLevel) : null;
  const days = s.pkg ? (CAREER_SCRIM.package.days[s.pkg.scrimsPerWeek] ?? []) : [];
  // rc.36 (front T2, CAREER_PLAN.payout): a package pays alongShare along the way
  // (never under the base) and the held rest on its cycle's last day, as the flow does.
  const hold = Boolean(s.pkg) && !s.rc33;
  const fullMult = s.rc33 ? s.rc33.mult : fx.sessionMult;
  const paidMult = hold ? paidSessionMultFor(fx.sessionMult) : fullMult;
  const sessionDay = (pl: SquadPlayer, week: number, dow: number, mult: number = fullMult) => {
    const event = week % 2 === 0;
    return trainDay(
      pl,
      {
        seasonIndex,
        coachOverall: null,
        gearBonus: 0,
        trainingWeekBonus: !event,
        splitGained: pl.gainedThisSplit,
        seasonGained: pl.gainedThisSeason,
        model: 2,
        day: (week - 1) * CAREER_CALENDAR.daysPerWeek + dow,
        careerSeed,
        aging: true,
        packageMult: mult,
        offsetGrowth: fx.offsets,
        declineMult: fx.declineMult,
      },
      event ? CAREER_TRAINING.matchPrepShare : 1,
    );
  };
  /** The held gain lands at the cycle's end, inside today's caps (the flow's landHeldGain). */
  const land = (pl: SquadPlayer, amount: number, day: number): SquadPlayer => {
    if (amount <= 1e-6) return pl;
    const room = trainWeek(pl, {
      seasonIndex,
      coachOverall: null,
      gearBonus: 0,
      trainingWeekBonus: false,
      splitGained: pl.gainedThisSplit,
      seasonGained: pl.gainedThisSeason,
      weeks: CAREER_CALENDAR.weeksPerSeason,
      model: 2,
      day,
      careerSeed,
    }).gained;
    const pay = Math.max(0, Math.min(amount, room));
    return { ...pl, overall: Math.min(99, pl.overall + pay), gainedThisSplit: pl.gainedThisSplit + pay, gainedThisSeason: pl.gainedThisSeason + pay };
  };
  for (let period = 0; period < CAREER_CALENDAR.weeksPerSeason / periodWeeks; period++) {
    // The flow's cap: a sessions-only pass over the period.
    let dry = { ...p };
    let drySessions = 0;
    for (let w = 1; w <= periodWeeks; w++) {
      const week = period * periodWeeks + w;
      for (let dow = 1; dow <= CAREER_TRAINING.trainingDaysPerWeek; dow++) {
        const r = sessionDay(dry, week, dow);
        drySessions += r.gained;
        dry = r.player;
      }
    }
    const cap = scrimCapRatio() * drySessions;
    let pSessions = 0;
    let pScrims = 0;
    let pSeries = 0;
    let held = 0;
    for (let w = 1; w <= periodWeeks; w++) {
      const week = period * periodWeeks + w;
      const event = week % 2 === 0;
      for (let dow = 1; dow <= CAREER_TRAINING.trainingDaysPerWeek; dow++) {
        const r = sessionDay(p, week, dow);
        const paid = hold && paidMult < fullMult - 1e-9 ? sessionDay(p, week, dow, paidMult) : r;
        pSessions += r.gained;
        held += Math.max(0, r.gained - paid.gained);
        p = paid.player;
        const k = days.indexOf(dow);
        const scrimN = s.rc33 ? s.rc33.scrims : 0;
        const rc33Scrim = s.rc33 && (dow === 2 || dow === 4) && scrimN > 0;
        if ((k >= 0 && level) || rc33Scrim) {
          const quality = fieldQualityFor([p.overall + (level ? LEVEL_GAP[level] : 0)]);
          const weeks = rc33Scrim ? 0.5 * quality : scrimXpWeeksFor(level!, k, quality, fx.scrimMult);
          const room = rc33Scrim ? Infinity : Math.max(0, cap - pScrims);
          if (room > 0) {
            const ctx = {
              seasonIndex,
              coachOverall: null,
              gearBonus: 0,
              trainingWeekBonus: false,
              splitGained: p.gainedThisSplit,
              seasonGained: p.gainedThisSeason,
              weeks,
              model: 2,
              day: (week - 1) * CAREER_CALENDAR.daysPerWeek + dow,
              careerSeed,
              packageMult: s.rc33 ? s.rc33.mult : 1,
            };
            let w2 = weeks;
            let r2 = trainWeek(p, ctx);
            if (r2.gained > room) {
              w2 = weeks * (room / r2.gained);
              r2 = trainWeek(p, { ...ctx, weeks: w2 });
            }
            const paid2 = hold ? trainWeek(p, { ...ctx, weeks: w2 * CAREER_PLAN.payout.alongShare }) : r2;
            pScrims += r2.gained;
            held += Math.max(0, r2.gained - paid2.gained);
            p = paid2.player;
          }
        }
      }
      if (event) {
        const before = p.overall;
        p = applyMatchXp(p, {
          seasonIndex,
          fieldQuality: 0.85,
          isSub: false,
          coachOverall: null,
          gearBonus: 0,
          seriesPlayed: 4,
          model: 2,
          day: week * CAREER_CALENDAR.daysPerWeek,
          careerSeed,
        });
        pSeries += p.overall - before;
      }
    }
    // rc.36: the cycle completes — its held gain lands (the next period's arrival).
    p = land(p, held, (period + 1) * periodWeeks * CAREER_CALENDAR.daysPerWeek);
    sessions += pSessions;
    scrims += pScrims;
    series += pSeries;
    const total = pSessions + pScrims + pSeries;
    if (total > 0.01) shares.push(pScrims / total);
  }
  const target = peakTargetOf(p.potential, developmentProfileOf(p.id, careerSeed));
  const over = p.overall > Math.min(target, p.potential + CAREER_DEV.peakTolerance) + 1e-6;
  const roll = squadRollover(p, seasonIndex + 1, createRng(careerSeed), { model: 2, careerSeed });
  return {
    p: { ...roll.player, finalSeasonAnnounced: false },
    sample: { age: ageOf(p0.birthYear, seasonIndex), gain: p.overall - start, sessions, scrims, series, over, shares },
  };
}

function squadOf(v: CareerPlayerView, seasonIndex: number): SquadPlayer {
  return {
    id: v.id,
    kind: v.kind,
    name: v.name,
    region: v.region,
    birthYear: seasonYear(seasonIndex) - v.age,
    archetype: v.archetype,
    overall: v.overall,
    attrOffsets: v.attrOffsets,
    potential: v.potential,
    peakAge: v.peakAge,
    declineRate: v.declineRate,
    role: "starter",
    salaryPerSplit: 1_000,
    contractEndSeason: seasonIndex + 12,
    trainingFocus: "auto",
    trainingIntensity: "normal",
    scoutLevel: 0,
    splitsTogether: 0,
    joinedSeason: seasonIndex,
    gainedThisSplit: 0,
    gainedThisSeason: 0,
  };
}

/**
 * Every rookie of an intake (S1, aged 13–16) on the BASE trajectory for 12
 * seasons; each season is forked from the same base state under every setup,
 * so a season's gain compares like with like (t2). Then each setup's own
 * trajectory from the intake: the season the player first reaches within
 * 0.5 of his real peak (the "faster road", decision 2-A).
 */
function samples(seeds: number, setups: Setup[]): { fork: Map<string, SeasonSample[]>; reach: Map<string, number[]> } {
  const fork = new Map(setups.map((s) => [s.key, [] as SeasonSample[]]));
  const reach = new Map(setups.map((s) => [s.key, [] as number[]]));
  const baseSetup = setups[0];
  for (let k = 0; k < seeds; k++)
    for (const region of REGIONS)
      for (let n = 0; n < CAREER_WORLD.rookiesPerRegionPerSeason; n++) {
        const v = rookieView(region, 1, n, seedOf(k), false, undefined, 2);
        const p0 = squadOf(v, 1);
        let p = p0;
        for (let si = 1; si <= 12; si++) {
          for (const s of setups) fork.get(s.key)!.push(season(p, si, seedOf(k), s).sample);
          p = season(p, si, seedOf(k), baseSetup).p;
        }
        const target = Math.min(peakTargetOf(p0.potential, developmentProfileOf(p0.id, seedOf(k))), p0.potential + CAREER_DEV.peakTolerance);
        if (ageOf(p0.birthYear, 1) > 15) continue;
        for (const s of setups) {
          let ps = p0;
          let reached = 13;
          for (let si = 1; si <= 12; si++) {
            ps = season(ps, si, seedOf(k), s).p;
            if (ps.overall >= target - 0.5) {
              reached = si;
              break;
            }
          }
          reach.get(s.key)!.push(reached);
        }
      }
  return { fork, reach };
}

const AGES = [13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 24, 26];

function byAge(xs: SeasonSample[], age: number, pick: (x: SeasonSample) => number): number[] {
  return xs.filter((x) => x.age === age).map(pick);
}

// ---------------------------------------------------------------------------
// The probe
// ---------------------------------------------------------------------------

describe.skipIf(!env.CAREER_TRAINING)("training probe (rc.34 DEV-03, measures only)", () => {
  it(
    "writes the package, coach, scrim, wear and market tables",
    async () => {
      const t0 = Date.now();
      const seeds = Number(env.TRAINING_SEEDS ?? 12);
      const lines: string[] = [];
      const H = (s: string) => lines.push("", s, "");
      lines.push("# Training probe (rc.34, DEV-03)");
      lines.push("");
      lines.push(`Generated by \`CAREER_TRAINING=1\` (${seeds} seeds × 7 regions × ${CAREER_WORLD.rookiesPerRegionPerSeason} rookies × 12 seasons). Regenerate, never hand-edit.`);

      // P1 ------------------------------------------------------------------
      const prof = (c: CoachState | null) => coachProfileOf(c);
      const g75 = COACHES[1].coach!;
      const setups: Setup[] = [
        { key: "base (no package; rc.33 no coach = the same)", pkg: null, coach: null },
        {
          key: "rc.33 before: coach 75 delegated + 2 run-now scrims",
          pkg: null,
          coach: null,
          rc33: { mult: (coachMultFor(75) / CAREER_TRAINING.coachMult.min) * CAREER_TRAINING.autoShare * CAREER_TRAINING.drillOverallMult, scrims: 2 },
        },
        { key: "dev package · no coach", pkg: DEV_PKG, coach: null },
        { key: "dev package · generic 75/2 (supervised)", pkg: DEV_PKG, coach: prof(g75) },
        { key: "dev package · generic 75/2 (the coach runs it)", pkg: DEV_PKG, coach: prof(g75), unsupervised: true },
        { key: "dev package · generic 88/6 development", pkg: DEV_PKG, coach: prof(COACHES[2].coach) },
        { key: "dev package · ex-pro peak 99", pkg: DEV_PKG, coach: prof(COACHES[4].coach) },
        { key: "dev · heavy · 3 hard scrims · generic 88/6", pkg: { ...DEV_PKG, workload: "heavy", scrimsPerWeek: 3, scrimLevel: "hard" }, coach: prof(COACHES[2].coach) },
      ];
      const { fork, reach } = samples(seeds, setups);
      const base = fork.get(setups[0].key)!;
      H("## P1. A season's gain by age from the same starting state — p50 (p90); the ratio to the base (t2: 1.10–1.35 at 13–19)");
      lines.push(`| Setup | ${AGES.join(" | ")} | ratio 13–19 p50 | over peak+tol (t3) | scrim share p90 (t4 ≤ 25 %) | seasons to peak, 13–15 p50 / p90 |`);
      lines.push(`|---|${AGES.map(() => "---").join("|")}|---|---|---|---|`);
      for (const s of setups) {
        const xs = fork.get(s.key)!;
        const cells = AGES.map((a) => {
          const g = byAge(xs, a, (x) => x.gain);
          return `${f1(q(g, 0.5))} (${f1(q(g, 0.9))})`;
        });
        // The ratio per sample (same player, same season, same start), then its p50 over ages 13–19.
        const ratios: number[] = [];
        for (let i = 0; i < xs.length; i++) {
          if (xs[i].age < 13 || xs[i].age > 19 || base[i].gain < 0.3) continue;
          ratios.push(xs[i].gain / base[i].gain);
        }
        const over = xs.filter((x) => x.over).length;
        const shares = xs.flatMap((x) => x.shares);
        const r = reach.get(s.key)!;
        lines.push(
          `| ${s.key} | ${cells.join(" | ")} | ${f2(q(ratios, 0.5))} | ${pct(over, xs.length)} | ${pct(q(shares, 0.9) * 1000, 1000)} | ${q(r, 0.5)} / ${q(r, 0.9)} |`,
        );
      }
      lines.push("");
      lines.push("Ratio: each sample's package season ÷ the base season from the same state (a season with a base gain ≥ 0.3). Seasons to peak: from the intake (ages 13–15) to within 0.5 of his real peak on the setup's own trajectory (13 = not inside 12 seasons). Nobody passes his peak (t3: the target caps every tick).");

      // P2 ------------------------------------------------------------------
      H("## P2. The coach profiles — a period's expected gain per player (28 days, development, normal, 2 even scrims), p50 by age");
      lines.push("| Coach | efficiency | plan quality | wear cut | Development effect | " + [15, 17, 19, 22].map((a) => `${a}`).join(" | ") + " |");
      lines.push("|---|---|---|---|---|---|---|---|---|");
      const coachSetups: Setup[] = [{ key: "base", pkg: null, coach: null }, ...COACHES.map((c) => ({ key: c.key, pkg: DEV_PKG, coach: prof(c.coach) }))];
      const coachFork = samples(Math.max(2, Math.round(seeds / 3)), coachSetups).fork;
      for (const c of COACHES) {
        const pr = prof(c.coach);
        const xs = coachFork.get(c.key)!;
        const fx = packageEffectFor(DEV_PKG, pr, "x");
        const cells = [15, 17, 19, 22].map((a) => f2(q(byAge(xs, a, (x) => (x.sessions + x.scrims) / 8), 0.5)));
        lines.push(
          `| ${c.key} | ${pr ? pr.efficiency.toFixed(2) : CAREER_PLAN.coach.coachless.toFixed(2)} | ${pr ? pr.planQuality.toFixed(2) : "–"} | ${pr ? pr.wearCut.toFixed(2) : "–"} | +${Math.round((fx.sessionMult - 1) * 100)} % | ${cells.join(" | ")} |`,
        );
      }

      // P3 ------------------------------------------------------------------
      H("## P3. Scrim levels — one period (4 weeks), two or three scrims a week, a 17-year-old at 76 (an even opponent ≈ 76)");
      lines.push("| Level | scrims/wk | XP weeks / period | chemistry (splits) / period | wear / period | confidence (consistency) / period |");
      lines.push("|---|---|---|---|---|---|");
      const fxBase = packageEffectFor(DEV_PKG, prof(g75), "x");
      for (const level of ["easy", "even", "hard"] as ScrimLevel[]) {
        for (const n of [2, 3]) {
          const row = CAREER_SCRIM.levels[level];
          const quality = fieldQualityFor([76 + LEVEL_GAP[level]]);
          let xp = 0;
          let chem = 0;
          let conf = 0;
          for (let k = 0; k < n; k++) {
            xp += scrimXpWeeksFor(level, k, quality, fxBase.scrimMult) * 4;
            chem += row.chemistry * (CAREER_SCRIM.package.weekShare[k] ?? 0) * fxBase.scrimMult * 4;
            conf += row.consistency * (CAREER_SCRIM.package.weekShare[k] ?? 0) * 4;
          }
          lines.push(`| ${level} | ${n} | ${f2(xp)} | ${f2(chem)} | ${f1(row.wear * n * 4 * fxBase.wearMult)} | +${f2(conf)} |`);
        }
      }

      // P4 ------------------------------------------------------------------
      H("## P4. Wear → the pre-event unavailability chance (t6: ≤ +4 points), per period, coach generic 75/2");
      lines.push("| Objective | Workload | scrims | level | wear / period | + points per event |");
      lines.push("|---|---|---|---|---|---|");
      let maxPts = 0;
      for (const objective of ["development", "preparation", "recovery"] as TrainingObjective[]) {
        for (const workload of ["light", "normal", "heavy"] as TrainingWorkload[]) {
          for (const [n, level] of [[0, "even"], [2, "even"], [3, "hard"], [3, "easy"]] as [number, ScrimLevel][]) {
            const fx = packageEffectFor({ objective, focus: "balanced", workload, scrimsPerWeek: n, scrimLevel: level }, prof(g75), "x");
            const wear = Math.max(0, (fx.wearPerWeek * 4 + CAREER_SCRIM.levels[level].wear * n * 4) * fx.wearMult);
            const pts = unavailabilityAddFor(wear, CAREER_PLAN.periodDays) * 100;
            maxPts = Math.max(maxPts, pts);
            if (workload === "light" && n === 0) continue;
            lines.push(`| ${objective} | ${workload} | ${n} | ${level} | ${f1(wear)} | +${f1(pts)} |`);
          }
        }
      }
      lines.push("");
      lines.push(`Heaviest: +${f1(maxPts)} points (cap ${CAREER_PLAN.wear.chanceMax * 100}).`);

      // P5 ------------------------------------------------------------------
      H("## P5. Plan quality by experience (t5: ≥ 0.85 new coach, ≥ 0.95 experienced) and the efficiency by quality");
      lines.push("| Experience | " + [0, 1, 2, 3, 4, 5, 6, 7, 8, 10].join(" | ") + " |");
      lines.push("|---|" + [0, 1, 2, 3, 4, 5, 6, 7, 8, 10].map(() => "---").join("|") + "|");
      lines.push("| plan quality | " + [0, 1, 2, 3, 4, 5, 6, 7, 8, 10].map((e) => planQualityFor(e).toFixed(3)).join(" | ") + " |");
      lines.push("");
      lines.push("| Quality | " + [60, 65, 70, 72, 75, 80, 85, 90, 94].join(" | ") + " |");
      lines.push("|---|" + [60, 65, 70, 72, 75, 80, 85, 90, 94].map(() => "---").join("|") + "|");
      lines.push("| focus efficiency | " + [60, 65, 70, 72, 75, 80, 85, 90, 94].map((v) => coachEfficiencyFor(v).toFixed(2)).join(" | ") + " |");

      // P6 ------------------------------------------------------------------
      H("## P6. The coach market — shortlists over seasons 1–8 × 4 windows (t7: a generic within 5 of the best ex-pro in ≥ 90 % of windows)");
      const bySource: Record<string, number[]> = { generated: [], real: [] };
      const exp: Record<string, number[]> = { generated: [], real: [] };
      let windows = 0;
      let withExPro = 0;
      let goodGeneric = 0;
      const wages: { q: number; e: number; real: boolean; w: number }[] = [];
      for (let k = 0; k < Math.max(2, Math.round(seeds / 3)); k++) {
        const seed = seedOf(k);
        let world = buildWorldAtCreation(seed);
        for (let si = 1; si <= 8; si++) {
          world = agePassAndIntake(world, si, seed, [], false).world;
          for (let windowIdx = 0; windowIdx < 4; windowIdx++) {
            for (const region of ["EU", "SAM"] as Region[]) {
              const list = coachCandidatesFor({ world, region, seasonIndex: si, windowIdx, careerSeed: seed, difficulty: "normal", nameBank: ["A", "B", "C", "D"] });
              windows += 1;
              for (const c of list) {
                bySource[c.source === "real" ? "real" : "generated"].push(c.overall);
                exp[c.source === "real" ? "real" : "generated"].push(c.experience ?? 0);
                wages.push({ q: c.overall, e: c.experience ?? 0, real: c.source === "real", w: c.salaryPerSplit });
              }
              const ex = list.filter((c) => c.source === "real").map((c) => c.overall);
              const gen = list.filter((c) => c.source !== "real").map((c) => c.overall);
              if (ex.length > 0) {
                withExPro += 1;
                if (gen.length > 0 && Math.max(...gen) >= Math.max(...ex) - 5) goodGeneric += 1;
              }
            }
          }
        }
      }
      lines.push(`| Source | n | quality p10 / p50 / p90 | max | experience p50 |`);
      lines.push(`|---|---|---|---|---|`);
      for (const src of ["generated", "real"]) {
        const xs = bySource[src];
        lines.push(`| ${src} | ${xs.length} | ${q(xs, 0.1)} / ${q(xs, 0.5)} / ${q(xs, 0.9)} | ${xs.length ? Math.max(...xs) : "–"} | ${q(exp[src], 0.5)} |`);
      }
      lines.push("");
      lines.push(`Windows: ${windows}; with an ex-pro: ${withExPro}; a generic within 5 of the best ex-pro: ${pct(goodGeneric, withExPro)} (t7).`);
      lines.push("");
      lines.push("| Wage per split, season 0, Normal | generic exp 0 | generic exp 4 | generic exp 8 | ex-pro exp 3 |");
      lines.push("|---|---|---|---|---|");
      for (const quality of [62, 70, 75, 80, 85, 90]) {
        lines.push(
          `| quality ${quality} | $${coachWageFor({ quality, experience: 0, exPro: false }, 0, "normal")} | $${coachWageFor({ quality, experience: 4, exPro: false }, 0, "normal")} | $${coachWageFor({ quality, experience: 8, exPro: false }, 0, "normal")} | $${coachWageFor({ quality, experience: 3, exPro: true }, 0, "normal")} |`,
        );
      }

      // P7 ------------------------------------------------------------------
      if (env.TRAINING_FLOW !== "0") {
        const { playArcCareer } = await import("./careerArcBot");
        const seasons = Number(env.TRAINING_FLOW_SEASONS ?? 2);
        H(`## P7. Whole careers (the arc bot, Normal, seed 9100, ${seasons} seasons): training per season`);
        lines.push("| Region · policy | season | periods filed | prompts (t1) | objectives | scrims W–L | scrim share p90 | ruled out | squad gain avg (sessions / scrims / series) | coach share avg |");
        lines.push("|---|---|---|---|---|---|---|---|---|---|");
        for (const region of ["EU", "SAM"] as Region[]) {
          for (const policy of ["autopilot", "delegator", "trainer", "tuned"] as const) {
            const career = playArcCareer({ region, difficulty: "normal", policy, seed: 9100, seasons });
            expect(career.softlock).toBeNull();
            for (const s of career.seasons) {
              if (!s.training) continue;
              const tr = s.training;
              const rows = tr.players;
              const n = Math.max(1, rows.length);
              const avg = (pick: (x: (typeof rows)[number]) => number) => rows.reduce((a, x) => a + pick(x), 0) / n;
              lines.push(
                `| ${region} · ${policy} | ${s.seasonIndex} | ${tr.summaries} | ${tr.prompts} | ${tr.objectives.map((o) => o[0]).join("")} | ${tr.scrimsWon}–${tr.scrimsLost} | ${pct(tr.scrimShareP90 * 100, 100)} | ${tr.unavailable} | ${f2(avg((x) => x.gain))} (${f2(avg((x) => x.sessions))} / ${f2(avg((x) => x.scrims))} / ${f2(avg((x) => x.series))}) | ${f2(avg((x) => x.coachShare))} |`,
              );
            }
          }
        }
        lines.push("");
        lines.push("Objectives: d = development, p = preparation, r = recovery, b = the base. A delegated coach meets no prompt; the trainer's repeated package needs none.");
      }

      lines.push("");
      lines.push(`_Runtime ${Math.round((Date.now() - t0) / 1000)} s._`);
      const md = lines.join("\n");
      if (env.TRAINING_MD) writeFileSync(env.TRAINING_MD, md);
      else console.log(md);
      expect(lines.length).toBeGreaterThan(10);
    },
    3_600_000,
  );
});
