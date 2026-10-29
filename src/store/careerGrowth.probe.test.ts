/**
 * Road to Worlds — the growth probe (rc.32, ROADMAP Etapa 2b DEV-01).
 *
 * MEASURES ONLY. Opt-in and skipped by default; never imported by the app. It
 * generates docs/CAREER-GROWTH-rc32.md: both development models on the same
 * seeds, side by side — model 1 = rc.31's (what an rc.31 save keeps for
 * life), model 2 = the DEV-01 growth contract (what a new career runs):
 *
 *   CAREER_GROWTH=1 GROWTH_MD=docs/CAREER-GROWTH-rc32.md npx vitest run src/store/careerGrowth.probe.test.ts
 *
 * Knobs: GROWTH_SEEDS (careers sampled, default 24). Pure engine functions
 * only (no career is played), about a minute. Regenerate, never hand-edit.
 *
 * What it samples:
 *  - G1 the prospect classes: every rookie intake (rookieView), by era,
 *    region, class (the intake season) and potential, 97/98 included.
 *  - G2 the season-0 world (fillers and free agents).
 *  - G3 real players against their eligible special cards.
 *  - G4/G5 a squad player's arc: generated prospects trained through the real
 *    daily tick (trainDay), match XP (applyMatchXp) and rollover
 *    (squadRollover) on a fixed schedule — overall by age and maturity
 *    profile, the age he reaches his peak, and his peak against his potential.
 *  - G6 where the truth sits in a scouting band, and whether a band moves.
 *  - G7 the AI world's growth over nine seasons (worldGrowthWeek every Monday
 *    on model 2; the rollover pass on model 1).
 */

import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CAREER_CALENDAR, CAREER_DEV, CAREER_SEASONS, CAREER_TRAINING, CAREER_WORLD } from "@/config/balance";
import { specialCards } from "@/data";
import {
  ageOf,
  applyMatchXp,
  bestEligibleSpecialOverall,
  derivePotential,
  derivePotentialV2,
  developmentProfileOf,
  peakTargetOf,
  playerViewById,
  rookieView,
  scoutedBand,
  seasonYear,
  squadRollover,
  trainDay,
  type MaturityProfile,
} from "@/engine/career/development";
import type { CareerPlayerView, ScoutLevel, SquadPlayer, WorldState } from "@/engine/career/types";
import { agePassAndIntake, buildWorldAtCreation, worldGrowthWeek } from "@/engine/career/worldSim";
import type { Region } from "@/engine/types";
import { createRng } from "@/lib/rng";

const env = process.env;
const REGIONS: Region[] = ["NA", "EU", "SAM", "MENA", "OCE", "APAC", "SSA"];
const MODELS = [1, 2] as const;
const seedOf = (k: number) => 1000 + k * 7919;
const share = (n: number, d: number) => (d === 0 ? "–" : `${((100 * n) / d).toFixed(1)}%`);
const q = (xs: number[], p: number): number => {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.round(p * (s.length - 1))))];
};
const f1 = (n: number) => (Number.isNaN(n) ? "–" : n.toFixed(1));

/** The headline numbers each section reports, for the generated summary table. */
const S = new Map<string, string>();

/** A world on `model` (rc.31's = the same world without the field). */
function worldFor(seed: number, model: number): WorldState {
  const world = buildWorldAtCreation(seed);
  if (model >= 2) return { ...world, growthModel: 2 };
  const legacy = { ...world };
  delete legacy.growthModel;
  return legacy;
}

function worldViews(world: WorldState, seasonIndex: number, careerSeed: number): CareerPlayerView[] {
  const ctx = { careerSeed, seasonIndex, world };
  const ids = [...new Set([...Object.values(world.orgs).flatMap((o) => o.playerIds), ...world.freeAgentIds])];
  return ids.map((id) => playerViewById(id, ctx)).filter((v): v is CareerPlayerView => v !== null);
}

// ---------------------------------------------------------------------------
// G1 — prospect classes
// ---------------------------------------------------------------------------

interface RookieRow {
  model: number;
  season: number;
  region: Region;
  age: number;
  pot: number;
}

function rookieRows(seeds: number): RookieRow[] {
  const rows: RookieRow[] = [];
  const last = CAREER_SEASONS.length + 3;
  for (const model of MODELS)
    for (let k = 0; k < seeds; k++)
      for (let season = 1; season <= last; season++)
        for (const region of REGIONS)
          for (let n = 0; n < CAREER_WORLD.rookiesPerRegionPerSeason; n++) {
            const v = rookieView(region, season, n, seedOf(k), season >= CAREER_SEASONS.length, undefined, model);
            rows.push({ model, season, region, age: v.age, pot: v.potential });
          }
  return rows;
}

function g1(lines: string[], rows: RookieRow[], seeds: number): void {
  const dataset = (r: RookieRow) => r.season < CAREER_SEASONS.length;
  const elite = (r: RookieRow) => r.age <= CAREER_WORLD.eliteProspect.maxAge && r.pot >= 93;
  lines.push("### G1. Prospect classes (DEV-01a) — every rookie intake, by era and model");
  lines.push("");
  lines.push("| Era · model | rookies | pot ≥ 88 | 93 | 94 | 95 | 96 | 97 | 98 | 99 | aged 13–15 with pot ≥ 93 | max |");
  lines.push("|---|---|---|---|---|---|---|---|---|---|---|---|");
  for (const era of ["dataset (S1–S5)", "infinite (S6–S9)"] as const)
    for (const model of MODELS) {
      const rs = rows.filter((r) => r.model === model && (era.startsWith("dataset") ? dataset(r) : !dataset(r)));
      const at = (p: number) => share(rs.filter((r) => r.pot === p).length, rs.length);
      lines.push(
        `| ${era} · ${model} | ${rs.length} | ${share(rs.filter((r) => r.pot >= 88).length, rs.length)} | ${at(93)} | ${at(94)} | ${at(95)} | ${at(96)} | ${at(97)} | ${at(98)} | ${at(99)} | ${share(rs.filter(elite).length, rs.length)} | ${Math.max(...rs.map((r) => r.pot))} |`,
      );
    }
  lines.push("");
  for (const model of MODELS) {
    const ds = rows.filter((r) => r.model === model && dataset(r));
    S.set(`elite${model}`, share(ds.filter(elite).length, ds.length));
    S.set(`wk${model}`, share(ds.filter((r) => r.pot >= 88).length, ds.length));
    S.set(`top${model}`, String(ds.filter((r) => elite(r) && r.pot >= 97).length));
    S.set(`max${model}`, String(Math.max(...ds.map((r) => r.pot))));
  }
  S.set("rookies", String(rows.filter((r) => r.model === 2 && dataset(r)).length));
  lines.push(
    `Model 2's dataset-era elite roll: CAREER_WORLD.eliteProspect (chance ${CAREER_WORLD.eliteProspect.chance} of a capped top-tier kid aged ≤ ${CAREER_WORLD.eliteProspect.maxAge}). The infinite era keeps its pyramid.`,
  );
  lines.push("");

  const m2 = rows.filter((r) => r.model === 2);
  lines.push("#### G1b. Elite prospects (aged 13–15, potential 93+) by region — model 2");
  lines.push("");
  lines.push("| Region | rookies | dataset era: elite | per career (S1–S5, one region) | 97–98 | infinite era: elite |");
  lines.push("|---|---|---|---|---|---|");
  for (const region of REGIONS) {
    const rs = m2.filter((r) => r.region === region);
    const ds = rs.filter(dataset);
    const inf = rs.filter((r) => !dataset(r));
    const e = ds.filter(elite).length;
    lines.push(
      `| ${region} | ${rs.length} | ${share(e, ds.length)} | ${(e / seeds).toFixed(2)} | ${ds.filter((r) => elite(r) && r.pot >= 97).length} | ${share(inf.filter(elite).length, inf.length)} |`,
    );
  }
  lines.push("");

  lines.push("#### G1c. By class (the intake season) — aged 13–15 with potential 93+");
  lines.push("");
  lines.push(`| Class | ${MODELS.map((m) => `model ${m}`).join(" | ")} | model 2: 97–98 |`);
  lines.push(`|---|${MODELS.map(() => "---").join("|")}|---|`);
  for (let season = 1; season <= CAREER_SEASONS.length + 3; season++) {
    const label = season < CAREER_SEASONS.length ? `S${season} (${CAREER_SEASONS[season].year})` : `S${season} (infinite)`;
    const cells = MODELS.map((m) => {
      const rs = rows.filter((r) => r.model === m && r.season === season);
      return share(rs.filter(elite).length, rs.length);
    });
    const top = rows.filter((r) => r.model === 2 && r.season === season && elite(r) && r.pot >= 97).length;
    lines.push(`| ${label} | ${cells.join(" | ")} | ${top} |`);
  }
  lines.push("");
}

// ---------------------------------------------------------------------------
// G2 — the season-0 world
// ---------------------------------------------------------------------------

function g2(lines: string[], seeds: number): void {
  lines.push("### G2. The season-0 world — generated players and the free-agent pool");
  lines.push("");
  lines.push("| Pool · model | players | pot ≥ 88 | pot ≥ 93 | max pot | headroom (pot − ovr) p50 |");
  lines.push("|---|---|---|---|---|---|");
  for (const model of MODELS) {
    const fillers: CareerPlayerView[] = [];
    const fas: CareerPlayerView[] = [];
    for (let k = 0; k < Math.min(seeds, 12); k++) {
      const world = worldFor(seedOf(k), model);
      const views = worldViews(world, 0, seedOf(k));
      fillers.push(...views.filter((v) => v.kind === "fictional"));
      const fa = new Set(world.freeAgentIds);
      fas.push(...views.filter((v) => fa.has(v.id)));
    }
    for (const [name, vs] of [["fillers", fillers], ["free agents", fas]] as const) {
      lines.push(
        `| ${name} · ${model} | ${vs.length} | ${share(vs.filter((v) => v.potential >= 88).length, vs.length)} | ${share(vs.filter((v) => v.potential >= 93).length, vs.length)} | ${Math.max(...vs.map((v) => v.potential))} | ${f1(q(vs.map((v) => v.potential - v.overall), 0.5))} |`,
      );
    }
  }
  lines.push("");
}

// ---------------------------------------------------------------------------
// G3 — real players against their specials
// ---------------------------------------------------------------------------

function g3(lines: string[]): void {
  const eligible = new Map<string, number>();
  let excluded = 0;
  for (const sp of specialCards) {
    const best = bestEligibleSpecialOverall(sp.playerId);
    if (best === null) {
      if (sp.kind !== "coach") excluded += 1;
      continue;
    }
    eligible.set(sp.playerId, best);
  }
  lines.push("### G3. Real players against their eligible special cards (DEV-01c)");
  lines.push("");
  lines.push(
    `Players with an eligible special: ${eligible.size} (player specials that never count — national, community, Creator, Wings: ${excluded}). Five seeds each.`,
  );
  lines.push("");
  lines.push("| Model | samples | potential below the special | special − potential p50 | p90 | max |");
  lines.push("|---|---|---|---|---|---|");
  for (const model of MODELS) {
    const gaps: number[] = [];
    for (const [playerId, sp] of eligible)
      for (let k = 0; k < 5; k++) {
        const pot = model >= 2 ? derivePotentialV2(playerId, seedOf(k)) : derivePotential(playerId, seedOf(k), 60);
        gaps.push(sp - pot);
      }
    lines.push(
      `| ${model} | ${gaps.length} | ${share(gaps.filter((g) => g > 0).length, gaps.length)} | ${q(gaps, 0.5)} | ${q(gaps, 0.9)} | ${Math.max(...gaps)} |`,
    );
    S.set(`special${model}`, share(gaps.filter((g) => g > 0).length, gaps.length));
  }
  lines.push("");
}

// ---------------------------------------------------------------------------
// G4/G5 — a squad player's arc through the real daily tick
// ---------------------------------------------------------------------------

interface ArcSample {
  profile: MaturityProfile;
  potential: number;
  target: number;
  peakAge: number;
  /** overall at each age (season start) */
  byAge: Map<number, number>;
  max: number;
  /** first exact age within 0.5 of his max */
  reachedAt: number;
}

/** Plays `seasons` seasons of the default setup: 16 open weeks, 16 event weeks of 4 series at field quality 0.85 (≈ 64 series, a mid team). */
function simulateArc(player: SquadPlayer, intakeSeason: number, model: number, careerSeed: number, seasons: number): ArcSample {
  let p: SquadPlayer = { ...player };
  const byAge = new Map<number, number>();
  const rng = createRng(careerSeed);
  let max = p.overall;
  let reachedAt = Number.NaN;
  const trail: { age: number; overall: number }[] = [];
  for (let s = 0; s < seasons; s++) {
    const seasonIndex = intakeSeason + s;
    const age = ageOf(p.birthYear, seasonIndex);
    byAge.set(age, p.overall);
    for (let week = 1; week <= CAREER_CALENDAR.weeksPerSeason; week++) {
      const event = week % 2 === 0;
      for (let dow = 1; dow <= CAREER_TRAINING.trainingDaysPerWeek; dow++) {
        const day = (week - 1) * CAREER_CALENDAR.daysPerWeek + dow;
        p = trainDay(
          p,
          {
            seasonIndex,
            coachOverall: null,
            gearBonus: 0,
            trainingWeekBonus: !event,
            splitGained: p.gainedThisSplit,
            seasonGained: p.gainedThisSeason,
            model,
            day,
            careerSeed,
            aging: true,
          },
          event ? CAREER_TRAINING.matchPrepShare : 1,
        ).player;
      }
      if (event) {
        p = applyMatchXp(p, {
          seasonIndex,
          fieldQuality: 0.85,
          isSub: false,
          coachOverall: null,
          gearBonus: 0,
          seriesPlayed: 4,
          model,
          day: week * CAREER_CALENDAR.daysPerWeek,
          careerSeed,
        });
      }
      if (model < 2 && (week === 11 || week === 21 || week === 31)) p = { ...p, gainedThisSplit: 0 };
      trail.push({ age: age + week / CAREER_CALENDAR.weeksPerSeason, overall: p.overall });
      max = Math.max(max, p.overall);
    }
    const roll = squadRollover(p, seasonIndex + 1, rng, { model, careerSeed });
    p = { ...roll.player, finalSeasonAnnounced: false, gainedThisSeason: 0, gainedThisSplit: 0 };
    trail.push({ age: age + 1, overall: p.overall });
    max = Math.max(max, p.overall);
  }
  for (const t of trail) {
    if (t.overall >= max - 0.5) {
      reachedAt = t.age;
      break;
    }
  }
  const profile = developmentProfileOf(player.id, careerSeed);
  return {
    profile: profile.maturity,
    potential: player.potential,
    target: model >= 2 ? peakTargetOf(player.potential, profile) : player.potential,
    peakAge: player.peakAge,
    byAge,
    max,
    reachedAt,
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
    contractEndSeason: seasonIndex + 9,
    trainingFocus: "auto",
    trainingIntensity: "normal",
    scoutLevel: 0,
    splitsTogether: 0,
    joinedSeason: seasonIndex,
    gainedThisSplit: 0,
    gainedThisSeason: 0,
  };
}

function arcs(seeds: number, model: number): ArcSample[] {
  const out: ArcSample[] = [];
  for (let k = 0; k < seeds; k++)
    for (const region of REGIONS)
      for (let n = 0; n < CAREER_WORLD.rookiesPerRegionPerSeason; n++) {
        const v = rookieView(region, 1, n, seedOf(k), false, undefined, model);
        out.push(simulateArc(squadOf(v, 1), 1, model, seedOf(k), 16));
      }
  return out;
}

function g4g5(lines: string[], seeds: number): void {
  const byModel = new Map(MODELS.map((m) => [m, arcs(seeds, m)] as const));
  lines.push("### G4. A prospect's arc by age — overall p50 at each season start (the default setup, through the real daily tick)");
  lines.push("");
  lines.push(
    "Every rookie of one intake (S1, aged 13–16), trained with no coach, no gear, auto focus and normal intensity: 16 open weeks (the Training Week bonus) and 16 event weeks (match prep, four series at field quality 0.85, about 64 series a season). Model 2 splits by maturity profile.",
  );
  lines.push("");
  const ages = Array.from({ length: 16 }, (_, i) => 13 + i);
  lines.push(`| Model · profile | n | ${ages.join(" | ")} |`);
  lines.push(`|---|---|${ages.map(() => "---").join("|")}|`);
  const row = (label: string, xs: ArcSample[]) => {
    const cells = ages.map((a) => f1(q(xs.map((x) => x.byAge.get(a)).filter((o): o is number => o !== undefined), 0.5)));
    lines.push(`| ${label} | ${xs.length} | ${cells.join(" | ")} |`);
  };
  row("1 · all", byModel.get(1)!);
  row("2 · all", byModel.get(2)!);
  for (const prof of ["early", "standard", "late"] as const) row(`2 · ${prof}`, byModel.get(2)!.filter((x) => x.profile === prof));
  lines.push("");

  lines.push("#### G4b. Season gain by age (p50 / p90)");
  lines.push("");
  lines.push(`| Model | ${ages.slice(0, -1).join(" | ")} |`);
  lines.push(`|---|${ages.slice(0, -1).map(() => "---").join("|")}|`);
  for (const model of MODELS) {
    const xs = byModel.get(model)!;
    const cells = ages.slice(0, -1).map((a) => {
      const gains = xs
        .map((x) => {
          const a0 = x.byAge.get(a);
          const a1 = x.byAge.get(a + 1);
          return a0 !== undefined && a1 !== undefined ? a1 - a0 : undefined;
        })
        .filter((g): g is number => g !== undefined);
      if (a === 15) S.set(`gain15_${model}`, f1(q(gains, 0.5)));
      if (a === 18) S.set(`gain18_${model}`, f1(q(gains, 0.5)));
      return gains.length ? `${f1(q(gains, 0.5))} / ${f1(q(gains, 0.9))}` : "–";
    });
    lines.push(`| ${model} | ${cells.join(" | ")} |`);
  }
  lines.push("");

  lines.push("### G5. Peak age and peak against potential");
  lines.push("");
  lines.push(
    `Peak = his best overall over 16 seasons; reached = the first age within 0.5 of it. Model 2's tolerance: ±${CAREER_DEV.peakTolerance} (CAREER_DEV.peakTolerance).`,
  );
  lines.push("");
  lines.push("| Model · profile | n | peak age (profile) p50 | reached at p10 / p50 / p90 | peak − potential p10 / p50 / p90 | within ±tolerance | over +tolerance | under −tolerance |");
  lines.push("|---|---|---|---|---|---|---|---|");
  const tol = CAREER_DEV.peakTolerance;
  const r5 = (label: string, xs: ArcSample[]) => {
    const d = xs.map((x) => Math.round((x.max - x.potential) * 10) / 10);
    const reached = xs.map((x) => x.reachedAt).filter((a) => !Number.isNaN(a));
    S.set(`reached:${label}`, f1(q(reached, 0.5)));
    S.set(`tol:${label}`, share(d.filter((x) => Math.abs(x) <= tol + 0.05).length, d.length));
    lines.push(
      `| ${label} | ${xs.length} | ${q(xs.map((x) => x.peakAge), 0.5)} | ${f1(q(reached, 0.1))} / ${f1(q(reached, 0.5))} / ${f1(q(reached, 0.9))} | ${f1(q(d, 0.1))} / ${f1(q(d, 0.5))} / ${f1(q(d, 0.9))} | ${share(d.filter((x) => Math.abs(x) <= tol + 0.05).length, d.length)} | ${share(d.filter((x) => x > tol + 0.05).length, d.length)} | ${share(d.filter((x) => x < -tol - 0.05).length, d.length)} |`,
    );
  };
  r5("1 · all", byModel.get(1)!);
  r5("2 · all", byModel.get(2)!);
  for (const prof of ["early", "standard", "late"] as const) r5(`2 · ${prof}`, byModel.get(2)!.filter((x) => x.profile === prof));
  lines.push("");
  const m2 = byModel.get(2)!;
  const kids = m2.filter((x) => (x.byAge.has(13) || x.byAge.has(14)) && x.potential >= 85);
  S.set("kidSeason", f1(q(kids.map((x) => x.reachedAt - Math.min(...x.byAge.keys())), 0.5)));
  lines.push(
    `Signed at 13–14 with potential 85+ (model 2, n ${kids.length}): reaches his peak at ${f1(q(kids.map((x) => x.reachedAt), 0.5))} (p50), ${f1(q(kids.map((x) => x.reachedAt), 0.9))} (p90) — season ${f1(q(kids.map((x) => x.reachedAt - Math.min(...x.byAge.keys())), 0.5))} of his career (p50).`,
  );
  lines.push("");
}

// ---------------------------------------------------------------------------
// G6 — scouting bands
// ---------------------------------------------------------------------------

function g6(lines: string[], seeds: number): void {
  lines.push("### G6. Scouting bands (DEV-01e) — where the true potential sits in the band (0 = the floor, 1 = the ceiling)");
  lines.push("");
  lines.push("| Model · level | headroom | players | mean position | at the floor (≤ 0.15) | middle | at the ceiling (≥ 0.85) | ceiling − truth p50 |");
  lines.push("|---|---|---|---|---|---|---|---|");
  const moved: Record<number, { moved: number; nested: number; n: number }> = { 1: { moved: 0, nested: 0, n: 0 }, 2: { moved: 0, nested: 0, n: 0 } };
  for (const model of MODELS) {
    const sample: CareerPlayerView[] = [];
    for (let k = 0; k < Math.min(seeds, 12); k++) sample.push(...worldViews(worldFor(seedOf(k), model), 0, seedOf(k)));
    for (const level of [0, 1, 2] as ScoutLevel[]) {
      for (const [label, lo, hi] of [["0–2", 0, 2], ["3–5", 3, 5], ["6–10", 6, 10], ["11+", 11, 99]] as const) {
        const pos: number[] = [];
        const above: number[] = [];
        for (const v of sample) {
          const h = Math.round(v.potential - v.overall);
          if (h < lo || h > hi) continue;
          const band = scoutedBand(v.potential, v.overall, level, 1, v.id, model);
          if (band.max <= band.min) continue;
          pos.push((v.potential - band.min) / (band.max - band.min));
          above.push(band.max - v.potential);
        }
        if (level === 0 && label === "0–2") {
          S.set(`floor${model}`, share(pos.filter((x) => x <= 0.15).length, pos.length));
          S.set(`mean${model}`, (pos.reduce((a, b) => a + b, 0) / Math.max(1, pos.length)).toFixed(2));
        }
        lines.push(
          `| ${model} · ${level} | ${label} | ${pos.length} | ${(pos.reduce((a, b) => a + b, 0) / Math.max(1, pos.length)).toFixed(2)} | ${share(pos.filter((x) => x <= 0.15).length, pos.length)} | ${share(pos.filter((x) => x > 0.15 && x < 0.85).length, pos.length)} | ${share(pos.filter((x) => x >= 0.85).length, pos.length)} | ${f1(q(above, 0.5))} |`,
        );
      }
    }
    for (const v of sample) {
      const b0 = scoutedBand(v.potential, v.overall, 0, 1, v.id, model);
      const b1 = scoutedBand(v.potential, v.overall, 1, 1, v.id, model);
      const b2 = scoutedBand(v.potential, v.overall, 2, 1, v.id, model);
      const later = scoutedBand(v.potential, v.overall + 3, 1, 1, v.id, model);
      const m = moved[model];
      m.n += 1;
      if (later.min !== b1.min || later.max !== b1.max) m.moved += 1;
      if (b1.min >= b0.min && b1.max <= b0.max && b2.min >= b1.min && b2.max <= b1.max) m.nested += 1;
    }
  }
  lines.push("");
  for (const model of MODELS) {
    const m = moved[model];
    S.set(`nested${model}`, share(m.nested, m.n));
    S.set(`moved${model}`, share(m.moved, m.n));
    lines.push(
      `Model ${model}: a report narrows inside the band shown before (L1 ⊆ L0, L2 ⊆ L1) for ${share(m.nested, m.n)} of players; the band moves when his overall grows by 3 for ${share(m.moved, m.n)}.`,
    );
  }
  lines.push("");
}

// ---------------------------------------------------------------------------
// G7 — the AI world's growth
// ---------------------------------------------------------------------------

function g7(lines: string[], seeds: number): void {
  lines.push("### G7. The AI world's growth — generated players over nine seasons, by age at the season start");
  lines.push("");
  lines.push("| Age | model 1: overall p50 | gain p50 | gap to potential p50 | model 2: overall p50 | gain p50 | gap to his real peak p50 | at his real peak (±0.5) |");
  lines.push("|---|---|---|---|---|---|---|---|");
  const rows = new Map<number, Record<number, { ovr: number; gain: number; gap: number }[]>>();
  for (const model of MODELS)
    for (let k = 0; k < Math.min(seeds, 6); k++) {
      const seed = seedOf(k);
      let world = worldFor(seed, model);
      let prev = new Map(worldViews(world, 0, seed).filter((v) => v.kind === "fictional").map((v) => [v.id, v]));
      for (let season = 0; season < 9; season++) {
        if (model >= 2)
          for (let week = 1; week <= CAREER_CALENDAR.weeksPerSeason; week++)
            world = worldGrowthWeek(world, { seasonIndex: season, week, careerSeed: seed, userSquadIds: [] });
        world = agePassAndIntake(world, season + 1, seed, [], season + 1 >= CAREER_SEASONS.length, []).world;
        const now = worldViews(world, season + 1, seed).filter((v) => v.kind === "fictional");
        for (const v of now) {
          const was = prev.get(v.id);
          if (!was) continue;
          const age = Math.min(30, was.age);
          const target = model >= 2 ? peakTargetOf(v.potential, developmentProfileOf(v.id, seed)) : v.potential;
          const slot = rows.get(age) ?? { 1: [], 2: [] };
          slot[model].push({ ovr: v.overall, gain: v.overall - was.overall, gap: target - v.overall });
          rows.set(age, slot);
        }
        prev = new Map(now.map((v) => [v.id, v]));
      }
    }
  for (const age of [...rows.keys()].sort((a, b) => a - b)) {
    const r = rows.get(age)!;
    const cell = (m: number, key: "ovr" | "gain" | "gap") => f1(q(r[m].map((x) => x[key]), 0.5));
    if (age === 21) {
      S.set("worldGap1", cell(1, "gap"));
      S.set("worldGap2", cell(2, "gap"));
    }
    lines.push(
      `| ${age}${age === 30 ? "+" : ""} | ${cell(1, "ovr")} | ${cell(1, "gain")} | ${cell(1, "gap")} | ${cell(2, "ovr")} | ${cell(2, "gain")} | ${cell(2, "gap")} | ${share(r[2].filter((x) => Math.abs(x.gap) <= 0.5).length, r[2].length)} |`,
    );
  }
  lines.push("");
}

// ---------------------------------------------------------------------------
// The document
// ---------------------------------------------------------------------------

function header(seeds: number): string[] {
  return [
    "# Career growth — rc.32 (DEV-01, the growth contract)",
    "",
    `> **Generated** by \`CAREER_GROWTH=1 GROWTH_SEEDS=${seeds} GROWTH_MD=docs/CAREER-GROWTH-rc32.md npx vitest run src/store/careerGrowth.probe.test.ts\`` +
      " (src/store/careerGrowth.probe.test.ts). Regenerate, never hand-edit. Pure engine functions on fixed seeds, both development models side by side:" +
      " **model 1** = rc.31's (an rc.31 save keeps it for life), **model 2** = DEV-01 (every new career, `CAREER_DEV.growthModel`). Decisions: ROAD-TO-WORLDS-DECISIONS R55–R57.",
    "",
    "What model 2 changes (each number a `balance.ts` key):",
    "",
    "- **a) Elite prospects in every era.** A dataset-era kid aged 13–15 from a top tier the era caps at 88 becomes a 93–98 prospect with `CAREER_WORLD.eliteProspect.chance` (97/98 the rarest); the 88+ share does not grow; the infinite era keeps its pyramid.",
    "- **b) An individual arc.** Maturity (early / standard / late, `CAREER_DEV.maturity`) sets the peak age, a plateau (`plateauYearsWeights`) holds the top, then a gradual decline (`declinePerYear` × the decline rate). A real player peaks at his best moment's age (`realPeakAgeRange`). Fixed per (career seed, player id). The potential is the **expected** peak: the real one sits within ±`peakTolerance`.",
    "- **c) Specials.** A real player's potential is max(best club card + jitter, his best eligible special): his own real-moment player cards of the career's era (`potentialSpecialTypes` / `potentialSpecialRarities`, `potentialSpecialCareerEraOnly`); national, community, Creator, Wings and coach cards never count. His debut overall is unchanged.",
    "- **d) The curve.** No split cap; a season cap (`seasonGainCap`); the pace = `paceCurvature` × gap ÷ years to the peak (floor `paceFloorPerYear`, at most the season cap a year), in training-week equivalents (`trainingWeeksPerYear`). Days plus the series a player actually plays (`xpWeeksPerSeries`); a reserve who did not play earns no event XP. No step on a birthday or at the rollover: the decline lands day by day and the AI world grows every Monday.",
    "- **e) Scouting.** Bands read the potential only and nest (a report narrows inside the band shown before); the truth's place is uniform, so it can sit at the floor, the middle or the top.",
    "",
  ];
}

function summary(): string[] {
  const g = (k: string) => S.get(k) ?? "–";
  return [
    "## Summary — model 1 (rc.31) → model 2 (DEV-01), same seeds",
    "",
    "| Measure | model 1 | model 2 |",
    "|---|---|---|",
    `| Dataset-era rookies aged 13–15 with potential 93+ (of ${g("rookies")}) | ${g("elite1")} | ${g("elite2")} |`,
    `| … of them 97–98 · the era's max potential | ${g("top1")} · ${g("max1")} | ${g("top2")} · ${g("max2")} |`,
    `| Dataset-era rookies at 88+ (wonderkids) | ${g("wk1")} | ${g("wk2")} |`,
    `| Real players under their eligible special | ${g("special1")} | ${g("special2")} |`,
    `| A prospect's season gain at 15 · at 18 (p50, default setup) | ${g("gain15_1")} · ${g("gain18_1")} | ${g("gain15_2")} · ${g("gain18_2")} |`,
    `| Age he reaches his peak (p50): all · early · standard · late | ${g("reached:1 · all")} | ${g("reached:2 · all")} · ${g("reached:2 · early")} · ${g("reached:2 · standard")} · ${g("reached:2 · late")} |`,
    `| Peak within ±tolerance of his potential | ${g("tol:1 · all")} | ${g("tol:2 · all")} |`,
    `| A 13–14-year-old (potential 85+) reaches his peak in season (p50) | – | ${g("kidSeason")} |`,
    `| No report, settled players (headroom 0–2): truth at the band's floor · mean position | ${g("floor1")} · ${g("mean1")} | ${g("floor2")} · ${g("mean2")} |`,
    `| A report narrows inside the band shown before | ${g("nested1")} | ${g("nested2")} |`,
    `| The band moves when his overall grows | ${g("moved1")} | ${g("moved2")} |`,
    `| AI world at 21: gap to potential (model 1) / to his real peak (model 2), p50 | ${g("worldGap1")} | ${g("worldGap2")} |`,
    "",
    "## Appendix — the growth tables",
    "",
  ];
}

// ---------------------------------------------------------------------------

describe.skipIf(!env.CAREER_GROWTH)("career growth probe (DEV-01, measures only)", () => {
  it(
    "writes the growth tables",
    () => {
      const seeds = Number(env.GROWTH_SEEDS ?? 24);
      const t0 = Date.now();
      S.clear();
      const body: string[] = [];
      g1(body, rookieRows(seeds), seeds);
      g2(body, seeds);
      g3(body);
      g4g5(body, Math.min(seeds, 8));
      g6(body, seeds);
      g7(body, seeds);
      const md = [...header(seeds), ...summary(), ...body, `_Probe runtime: ${Math.round((Date.now() - t0) / 1000)} s._`].join("\n") + "\n";
      if (env.GROWTH_MD) writeFileSync(env.GROWTH_MD, md);
      else console.log(md);
      expect(md.length).toBeGreaterThan(0);
    },
    1_800_000,
  );
});
