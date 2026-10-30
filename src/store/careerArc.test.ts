/**
 * Road to Worlds — the long-career harness (rc.30, ROADMAP Etapa 2a OBS-02).
 *
 * The smoke test always runs: one engaged and one hands-off career through the
 * real flow (careerArcBot.ts), so the harness cannot rot. The sweep is opt-in,
 * like difficulty.matrix.test.ts, and only MEASURES (no balance assertion yet —
 * 2b re-runs the same seeds for the "after" curves):
 *
 *   CAREER_ARC=1 ARC_OUT=arc.json npx vitest run src/store/careerArc.test.ts
 *
 * Knobs: ARC_REGIONS (default all seven), ARC_DIFFS (easy,normal,hard),
 * ARC_POLICIES (every ARC_POLICIES id), ARC_SEEDS (careers per cell, default 2),
 * ARC_SEASONS (default 8), ARC_SLICE "i/n" (this process plays every n-th cell,
 * so 4 processes split one matrix). ARC_REPORT=1 ARC_IN=a.json,b.json
 * ARC_MD=report.md merges slices into the Markdown summary (p10/p50/p90).
 *
 * CAREER_CURVES=1 CURVES_MD=curves.md (CURVES_SEEDS, default 40) samples the
 * development model straight from the engine, no career needed: rookie
 * classes (age, potential, by era), the season-0 fillers, real players'
 * potential against their special cards, where the truth sits inside a
 * scouting band (rc.33: DEV-04's band against rc.32's, same players), and the
 * world's growth curve by age over nine seasons.
 */

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CAREER_ARC, CAREER_CALENDAR, CAREER_DEV, CAREER_SEASONS, CAREER_WORLD } from "@/config/balance";
import { specialCards } from "@/data";
import {
  bestEligibleSpecialOverall,
  derivePotential,
  derivePotentialV2,
  developmentProfileOf,
  exactAgeOf,
  isGrowthContract,
  nestedBand,
  playerViewById,
  rookieView,
  scoutedBand,
} from "@/engine/career/development";
import type { CareerDifficulty, CareerPlayerView, EventTier, ScoutLevel, WorldState } from "@/engine/career/types";
import { agePassAndIntake, buildWorldAtCreation, worldGrowthWeek } from "@/engine/career/worldSim";
import type { Region } from "@/engine/types";
import {
  ARC_GAP_BUCKETS,
  ARC_POLICIES,
  playArcCareer,
  type ArcCareer,
  type ArcPolicyId,
  type ArcSeason,
} from "./careerArcBot";

const env = process.env;
const ALL_REGIONS: Region[] = ["NA", "EU", "SAM", "MENA", "OCE", "APAC", "SSA"];
const list = <T extends string>(v: string | undefined, all: readonly T[]): T[] =>
  v ? (v.split(",").filter((x) => (all as readonly string[]).includes(x)) as T[]) : [...all];

/** Every non-test source file under src/ (the app's code). */
function appSources(dir = "src"): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isDirectory()) return appSources(path);
    return /\.(ts|tsx)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [path] : [];
  });
}

describe("career arc harness — smoke (rc.30 OBS-02)", { timeout: 60_000 }, () => {
  it("the bot is test support: no app file imports it", () => {
    const importers = appSources().filter((f) => !f.endsWith("careerArcBot.ts") && readFileSync(f, "utf8").includes("careerArcBot"));
    expect(importers).toEqual([]);
  });

  it("an engaged and a hands-off career each play a season through the real flow, deterministically", () => {
    const tuned = playArcCareer({ region: "SAM", difficulty: "normal", policy: "tuned", seed: 31337, seasons: 1 });
    expect(tuned.softlock).toBeNull();
    expect(tuned.seasons).toHaveLength(1);
    const s0 = tuned.seasons[0];
    expect(s0.regionRank).toBeGreaterThanOrEqual(1);
    expect(s0.income.prize ?? 0).toBeGreaterThan(0);
    expect(s0.spend.payroll ?? 0).toBeGreaterThan(0);
    expect(s0.squad.length).toBeGreaterThanOrEqual(3);
    // rc.33 (BAL-04 / RTW-02): the series record by tier and by rating gap, and the first sponsor.
    const byTier = Object.values(s0.series ?? {});
    const byGap = Object.values(s0.seriesByGap ?? {});
    const sum = (xs: [number, number][]) => xs.reduce((n, [w, l]) => n + w + l, 0);
    expect(sum(byTier)).toBeGreaterThan(10);
    expect(sum(byGap)).toBe(sum(byTier));
    expect(tuned.firstSponsorSeason === null || tuned.firstSponsorSeason === 0).toBe(true);
    // Same seed, same story.
    const again = playArcCareer({ region: "SAM", difficulty: "normal", policy: "tuned", seed: 31337, seasons: 1 });
    expect(again.seasons).toEqual(tuned.seasons);
    const auto = playArcCareer({ region: "EU", difficulty: "hard", policy: "autopilot", seed: 31337, seasons: 1 });
    expect(auto.softlock).toBeNull();
    expect(auto.seasons[0].sponsorBasePerSplit).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// The sweep (opt-in)
// ---------------------------------------------------------------------------

it.skipIf(!env.CAREER_ARC)(
  "career arc sweep (measures only)",
  () => {
    const regions = list(env.ARC_REGIONS, ALL_REGIONS);
    const diffs = list<CareerDifficulty>(env.ARC_DIFFS, ["easy", "normal", "hard"]);
    const policies = list<ArcPolicyId>(env.ARC_POLICIES, Object.keys(ARC_POLICIES) as ArcPolicyId[]);
    const seeds = Number(env.ARC_SEEDS ?? 2);
    const seasons = Number(env.ARC_SEASONS ?? 8);
    const [slice, slices] = (env.ARC_SLICE ?? "0/1").split("/").map(Number);
    const cells: { region: Region; difficulty: CareerDifficulty; policy: ArcPolicyId; seed: number }[] = [];
    for (const region of regions)
      for (const difficulty of diffs)
        for (const policy of policies)
          for (let k = 0; k < seeds; k++) cells.push({ region, difficulty, policy, seed: 9100 + k * 7919 });
    const mine = cells.filter((_, i) => i % slices === slice);
    const careers: ArcCareer[] = [];
    for (const cell of mine) {
      careers.push(playArcCareer({ ...cell, seasons }));
      if (env.ARC_OUT) writeFileSync(env.ARC_OUT, JSON.stringify({ seasons, careers }));
    }
    console.log(`career arc: ${careers.length} careers, ${careers.reduce((n, c) => n + c.ms, 0) / 1000}s`);
  },
  7_200_000,
);

// ---------------------------------------------------------------------------
// The report (opt-in): merges slices into Markdown
// ---------------------------------------------------------------------------

const q = (xs: number[], p: number): number => {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.round(p * (s.length - 1))))];
};
const pct = (n: number, d: number) => (d === 0 ? "–" : `${Math.round((100 * n) / d)}%`);
const money = (n: number) => (Number.isNaN(n) ? "–" : `${n < 0 ? "−" : ""}$${(Math.abs(n) / 1000).toFixed(1)}k`);

/** One Markdown table per question; rows grouped by `by`. */
function arcReport(careers: ArcCareer[], seasons: number): string {
  const lines: string[] = [];
  const group = (key: (c: ArcCareer) => string) => {
    const m = new Map<string, ArcCareer[]>();
    for (const c of careers) m.set(key(c), [...(m.get(key(c)) ?? []), c]);
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  };
  const lastDataset = CAREER_SEASONS.length - 1;
  lines.push(`Careers: ${careers.length} · seasons per career: ${seasons} · seeds per cell: ${new Set(careers.map((c) => c.seed)).size}`);
  lines.push("");

  // 1. The arc against CAREER_ARC, by difficulty × policy.
  lines.push("### Competitive arc (CAREER_ARC) — by difficulty × policy");
  lines.push("");
  lines.push("| Difficulty · policy | n | first Major by S2 | first Worlds by S4 | Worlds title by 2026 | insolvent | softlock |");
  lines.push("|---|---|---|---|---|---|---|");
  for (const [k, cs] of group((c) => `${c.difficulty} · ${c.policy}`)) {
    const n = cs.length;
    const major = cs.filter((c) => c.firstMajorSeason !== null && c.firstMajorSeason <= 2).length;
    const worlds = cs.filter((c) => c.firstWorldsSeason !== null && c.firstWorldsSeason <= 4).length;
    const title = cs.filter((c) => c.worldsTitleSeason !== null && c.worldsTitleSeason <= lastDataset).length;
    const insolvent = cs.filter((c) => c.ended === "insolvency").length;
    const soft = cs.filter((c) => c.ended === "softlock").length;
    lines.push(`| ${k} | ${n} | ${pct(major, n)} | ${pct(worlds, n)} | ${pct(title, n)} | ${pct(insolvent, n)} | ${soft} |`);
  }
  lines.push("");
  lines.push(
    `Targets (normal unless noted): first Major by S2 ≥ ${CAREER_ARC.firstMajorBySeason2 * 100}%, first Worlds by S4 ≥ ${CAREER_ARC.firstWorldsBySeason4 * 100}%, Worlds title by 2026 easy ${CAREER_ARC.worldsTitleBy2026.easy.map((x) => x * 100).join("–")}% · normal ${CAREER_ARC.worldsTitleBy2026.normal.map((x) => x * 100).join("–")}% · hard ${CAREER_ARC.worldsTitleBy2026.hard.map((x) => x * 100).join("–")}%, insolvency ≤ easy ${CAREER_ARC.insolvencyRateMax.easy * 100}% · normal ${CAREER_ARC.insolvencyRateMax.normal * 100}% · hard ${CAREER_ARC.insolvencyRateMax.hard * 100}%.`,
  );
  lines.push("");

  // 2. Money by season (all careers alive at that season), by difficulty.
  lines.push("### Money by season — balance at season end p10 / p50 / p90, by difficulty");
  lines.push("");
  lines.push(`| Difficulty | ${Array.from({ length: seasons }, (_, s) => `S${s}`).join(" | ")} |`);
  lines.push(`|---|${Array.from({ length: seasons }, () => "---").join("|")}|`);
  for (const [k, cs] of group((c) => c.difficulty)) {
    const cells = Array.from({ length: seasons }, (_, s) => {
      const xs = cs.map((c) => c.seasons[s]?.balanceEnd).filter((x): x is number => x !== undefined);
      return xs.length ? `${money(q(xs, 0.1))} / ${money(q(xs, 0.5))} / ${money(q(xs, 0.9))}` : "–";
    });
    lines.push(`| ${k} | ${cells.join(" | ")} |`);
  }
  lines.push("");

  // 3. Money health by policy.
  lines.push("### Money health — by policy (every season of every career)");
  lines.push("");
  lines.push("| Policy | season-rows | below $0 at season end | Backer owed at end | bank loans / career | low point p10 | payroll ÷ guaranteed income p50 | prize share of income p50 | star signing by S4 |");
  lines.push("|---|---|---|---|---|---|---|---|---|");
  for (const [k, cs] of group((c) => c.policy)) {
    const rows = cs.flatMap((c) => c.seasons);
    const neg = rows.filter((r) => r.balanceEnd < 0).length;
    const backer = rows.filter((r) => r.backerActive).length;
    const loans = cs.reduce((n, c) => n + c.seasons.reduce((m, r) => m + r.bankLoans, 0), 0) / cs.length;
    const low = q(rows.map((r) => r.balanceMin), 0.1);
    const ratio = q(
      rows
        .map((r) => {
          const guaranteed = (r.income.sponsorBase ?? 0) + (r.income.fanbase ?? 0);
          const wages = (r.spend.payroll ?? 0) + (r.spend.coachSalary ?? 0);
          return guaranteed > 0 ? wages / guaranteed : NaN;
        })
        .filter((x) => !Number.isNaN(x)),
      0.5,
    );
    const prizeShare = q(
      rows
        .map((r) => {
          const total = Object.values(r.income).reduce((a, b) => a + b, 0);
          return total > 0 ? (r.income.prize ?? 0) / total : NaN;
        })
        .filter((x) => !Number.isNaN(x)),
      0.5,
    );
    const stars = cs.filter((c) => c.seasons.slice(0, 5).some((r) => r.starSignings > 0)).length;
    lines.push(
      `| ${k} | ${rows.length} | ${pct(neg, rows.length)} | ${pct(backer, rows.length)} | ${loans.toFixed(1)} | ${money(low)} | ${ratio.toFixed(2)} | ${Number.isNaN(prizeShare) ? "–" : `${Math.round(prizeShare * 100)}%`} | ${pct(stars, cs.length)} |`,
    );
  }
  lines.push("");

  // 4. Region spread (normal only, every policy).
  lines.push("### Region spread — normal difficulty, every policy");
  lines.push("");
  lines.push("| Region | n | first Major by S2 | Worlds by S4 | title by 2026 | insolvent | balance S3 p50 |");
  lines.push("|---|---|---|---|---|---|---|");
  for (const [k, cs] of group((c) => c.region).map(([r, cs]) => [r, cs.filter((c) => c.difficulty === "normal")] as const)) {
    if (cs.length === 0) continue;
    const n = cs.length;
    lines.push(
      `| ${k} | ${n} | ${pct(cs.filter((c) => c.firstMajorSeason !== null && c.firstMajorSeason <= 2).length, n)} | ${pct(cs.filter((c) => c.firstWorldsSeason !== null && c.firstWorldsSeason <= 4).length, n)} | ${pct(cs.filter((c) => c.worldsTitleSeason !== null && c.worldsTitleSeason <= lastDataset).length, n)} | ${pct(cs.filter((c) => c.ended === "insolvency").length, n)} | ${money(q(cs.map((c) => c.seasons[3]?.balanceEnd).filter((x): x is number => x !== undefined), 0.5))} |`,
    );
  }
  lines.push("");

  // 4b. rc.32 (BAL-02): region × difficulty, every policy — the presets' slices.
  lines.push("### Region × difficulty — every policy (insolvent · first Major by S2 · Worlds by S4 · team rating at S3 p50)");
  lines.push("");
  lines.push("| Region | easy | normal | hard |");
  lines.push("|---|---|---|---|");
  for (const [region, rcs] of group((c) => c.region)) {
    const cells = (["easy", "normal", "hard"] as const).map((d) => {
      const cs = rcs.filter((c) => c.difficulty === d);
      if (cs.length === 0) return "–";
      const n = cs.length;
      const rating = q(cs.map((c) => c.seasons[3]?.teamRating).filter((x): x is number => x !== undefined), 0.5);
      return `${pct(cs.filter((c) => c.ended === "insolvency").length, n)} · ${pct(cs.filter((c) => c.firstMajorSeason !== null && c.firstMajorSeason <= 2).length, n)} · ${pct(cs.filter((c) => c.firstWorldsSeason !== null && c.firstWorldsSeason <= 4).length, n)} · ${Number.isNaN(rating) ? "–" : rating.toFixed(1)}`;
    });
    lines.push(`| ${region} | ${cells.join(" | ")} |`);
  }
  lines.push("");
  // 4c. rc.32 (BAL-02): the competitive line by difficulty — Majors and Worlds per season played.
  lines.push("### Competitive line by difficulty — per season played (every policy)");
  lines.push("");
  lines.push("| Difficulty | season-rows | Majors qualified per season | Worlds reached | titles per season | region rank p50 |");
  lines.push("|---|---|---|---|---|---|");
  for (const [d, cs] of group((c) => c.difficulty)) {
    const rows = cs.flatMap((c) => c.seasons);
    const majors = rows.reduce((n, r) => n + r.majorsQualified, 0) / Math.max(1, rows.length);
    const worlds = rows.filter((r) => r.worlds !== null).length;
    const titles = rows.reduce((n, r) => n + r.titles, 0) / Math.max(1, rows.length);
    lines.push(
      `| ${d} | ${rows.length} | ${majors.toFixed(2)} | ${pct(worlds, rows.length)} | ${titles.toFixed(2)} | ${q(rows.map((r) => r.regionRank).filter((x) => x > 0), 0.5)} |`,
    );
  }
  lines.push("");

  // 4d. rc.33 (BAL-04): the user's series win rate — difficulty × region, by
  // season, by tier, and at an even rating gap (the presets' intent row).
  // Dumps from before rc.33 carry no series record: their cells read "–".
  const sumSeries = (rows: ArcSeason[], pick: (r: ArcSeason) => readonly [number, number] | undefined): [number, number] => {
    let won = 0;
    let lost = 0;
    for (const r of rows) {
      const x = pick(r);
      if (x) {
        won += x[0];
        lost += x[1];
      }
    }
    return [won, lost];
  };
  const allSeries = (r: ArcSeason): [number, number] | undefined => {
    if (!r.series) return undefined;
    let won = 0;
    let lost = 0;
    for (const x of Object.values(r.series)) {
      won += x?.[0] ?? 0;
      lost += x?.[1] ?? 0;
    }
    return [won, lost];
  };
  const winCell = ([won, lost]: [number, number]) =>
    won + lost === 0 ? "–" : `${Math.round((100 * won) / (won + lost))}% · ${won + lost}`;
  const DIFFS = ["easy", "normal", "hard"] as const;
  lines.push("### Series win rate — difficulty × region (every policy, every season; won % · series)");
  lines.push("");
  lines.push("| Region | easy | normal | hard |");
  lines.push("|---|---|---|---|");
  for (const [region, rcs] of [...group((c) => c.region), ["all", careers] as [string, ArcCareer[]]]) {
    const cells = DIFFS.map((d) => winCell(sumSeries(rcs.filter((c) => c.difficulty === d).flatMap((c) => c.seasons), allSeries)));
    lines.push(`| ${region} | ${cells.join(" | ")} |`);
  }
  lines.push("");
  lines.push("### Series win rate at an even rating gap (±2, the AI shift left out) — difficulty × region");
  lines.push("");
  lines.push("| Region | easy | normal | hard |");
  lines.push("|---|---|---|---|");
  for (const [region, rcs] of [...group((c) => c.region), ["all", careers] as [string, ArcCareer[]]]) {
    const cells = DIFFS.map((d) =>
      winCell(sumSeries(rcs.filter((c) => c.difficulty === d).flatMap((c) => c.seasons), (r) => r.seriesByGap?.[ARC_GAP_BUCKETS[2].key])),
    );
    lines.push(`| ${region} | ${cells.join(" | ")} |`);
  }
  lines.push("");
  lines.push("### Series win rate by rating gap (user − opponent) — by difficulty, every region");
  lines.push("");
  lines.push(`| Difficulty | ${ARC_GAP_BUCKETS.map((b) => b.key).join(" | ")} |`);
  lines.push(`|---|${ARC_GAP_BUCKETS.map(() => "---").join("|")}|`);
  for (const d of DIFFS) {
    const rows = careers.filter((c) => c.difficulty === d).flatMap((c) => c.seasons);
    if (rows.length === 0) continue;
    lines.push(`| ${d} | ${ARC_GAP_BUCKETS.map((b) => winCell(sumSeries(rows, (r) => r.seriesByGap?.[b.key]))).join(" | ")} |`);
  }
  lines.push("");
  const TIERS: EventTier[] = ["t3", "t2", "qualifier", "regional", "major", "worlds"];
  lines.push("### Series win rate by event tier — by difficulty, every region");
  lines.push("");
  lines.push(`| Difficulty | ${TIERS.join(" | ")} |`);
  lines.push(`|---|${TIERS.map(() => "---").join("|")}|`);
  for (const d of DIFFS) {
    const rows = careers.filter((c) => c.difficulty === d).flatMap((c) => c.seasons);
    if (rows.length === 0) continue;
    lines.push(`| ${d} | ${TIERS.map((tier) => winCell(sumSeries(rows, (r) => r.series?.[tier]))).join(" | ")} |`);
  }
  lines.push("");
  lines.push("### Series win rate by season — by difficulty, every region");
  lines.push("");
  lines.push(`| Difficulty | ${Array.from({ length: seasons }, (_, s) => `S${s}`).join(" | ")} |`);
  lines.push(`|---|${Array.from({ length: seasons }, () => "---").join("|")}|`);
  for (const d of DIFFS) {
    const cs = careers.filter((c) => c.difficulty === d);
    if (cs.length === 0) continue;
    const cells = Array.from({ length: seasons }, (_, s) =>
      winCell(sumSeries(cs.map((c) => c.seasons[s]).filter((r): r is ArcSeason => r !== undefined), allSeries)),
    );
    lines.push(`| ${d} | ${cells.join(" | ")} |`);
  }
  lines.push("");

  // 4e. rc.33 (RTW-02): the path to reputation — rep at the end of S0 / S1 / S2
  // (careers alive then) and the first real sponsor deal, region × difficulty.
  lines.push("### Reputation path (RTW-02) — region × difficulty, every policy");
  lines.push("");
  lines.push("| Region · difficulty | n | rep S0 p50 (p10–p90) | rep S1 p50 (p10–p90) | rep S2 p50 | sponsor by end S1 | first sponsor p50 |");
  lines.push("|---|---|---|---|---|---|---|");
  for (const [k, cs] of group((c) => `${c.region} · ${c.difficulty}`)) {
    const repAt = (s: number) => cs.map((c) => c.seasons[s]?.rep).filter((x): x is number => x !== undefined);
    const spread = (xs: number[]) => (xs.length ? `${q(xs, 0.5)} (${q(xs, 0.1)}–${q(xs, 0.9)})` : "–");
    const known = cs.filter((c) => c.firstSponsorSeason !== undefined);
    const first = known.map((c) => (c.firstSponsorSeason === null ? Infinity : c.firstSponsorSeason!));
    const p50 = q(first, 0.5);
    lines.push(
      `| ${k} | ${cs.length} | ${spread(repAt(0))} | ${spread(repAt(1))} | ${repAt(2).length ? q(repAt(2), 0.5) : "–"} | ${known.length ? pct(known.filter((c) => c.firstSponsorSeason !== null && c.firstSponsorSeason! <= 1).length, known.length) : "–"} | ${known.length === 0 ? "–" : p50 === Infinity ? "never" : `S${p50}`} |`,
    );
  }
  lines.push("");

  // 5. Squad development: overall gained per season by age (every squad player seen two seasons running).
  lines.push("### Squad development — overall gained over a season, by age at its start");
  lines.push("");
  lines.push("| Age | n | gain p10 | gain p50 | gain p90 | gap to potential at season end p50 |");
  lines.push("|---|---|---|---|---|---|");
  const byAge = new Map<number, { gain: number; gap: number }[]>();
  for (const c of careers) {
    for (let s = 1; s < c.seasons.length; s++) {
      const prev = new Map(c.seasons[s - 1].squad.map((p) => [p.id, p]));
      for (const p of c.seasons[s].squad) {
        const was = prev.get(p.id);
        if (!was) continue;
        const age = Math.min(30, was.age);
        byAge.set(age, [...(byAge.get(age) ?? []), { gain: p.overall - was.overall, gap: p.potential - p.overall }]);
      }
    }
  }
  for (const age of [...byAge.keys()].sort((a, b) => a - b)) {
    const xs = byAge.get(age)!;
    const gains = xs.map((x) => x.gain);
    lines.push(
      `| ${age}${age === 30 ? "+" : ""} | ${xs.length} | ${q(gains, 0.1).toFixed(1)} | ${q(gains, 0.5).toFixed(1)} | ${q(gains, 0.9).toFixed(1)} | ${q(xs.map((x) => x.gap), 0.5).toFixed(1)} |`,
    );
  }
  lines.push("");
  const soft = careers.filter((c) => c.softlock);
  if (soft.length) {
    lines.push("### Softlocks (reproduce with the cell's region / difficulty / policy / seed)");
    lines.push("");
    for (const c of soft) lines.push(`- ${c.region} · ${c.difficulty} · ${c.policy} · seed ${c.seed}: ${c.softlock}`);
    lines.push("");
  }
  return lines.join("\n");
}

it.skipIf(!env.ARC_REPORT)("career arc report (merges ARC_IN slices)", () => {
  const files = (env.ARC_IN ?? "").split(",").filter(Boolean);
  let seasons = 0;
  const careers: ArcCareer[] = [];
  for (const f of files) {
    const data = JSON.parse(readFileSync(f, "utf8")) as { seasons: number; careers: ArcCareer[] };
    seasons = Math.max(seasons, data.seasons);
    careers.push(...data.careers);
  }
  const md = arcReport(careers, seasons);
  if (env.ARC_MD) writeFileSync(env.ARC_MD, md);
  else console.log(md);
});

// ---------------------------------------------------------------------------
// Development curves (opt-in): the model itself, sampled from the engine
// ---------------------------------------------------------------------------

function worldViews(world: WorldState, seasonIndex: number, careerSeed: number): CareerPlayerView[] {
  const ctx = { careerSeed, seasonIndex, world };
  const ids = [...new Set([...Object.values(world.orgs).flatMap((o) => o.playerIds), ...world.freeAgentIds])];
  return ids.map((id) => playerViewById(id, ctx)).filter((v): v is CareerPlayerView => v !== null);
}

function curvesReport(seeds: number): string {
  const lines: string[] = [];
  // rc.32 (DEV-01): sample the model a new career runs (CAREER_DEV.growthModel).
  const model = CAREER_DEV.growthModel;
  lines.push(`Development model: ${model} (${isGrowthContract(model) ? "DEV-01, rc.32" : "rc.31"}).`);
  lines.push("");
  const share = (n: number, d: number) => (d === 0 ? "–" : `${((100 * n) / d).toFixed(1)}%`);
  const seedOf = (k: number) => 1000 + k * 7919;

  // 1. Rookie classes (DEV-01a): intake age and potential, dataset era vs infinite.
  lines.push("### Rookie classes (DEV-01a) — intake age and potential");
  lines.push("");
  lines.push("| Era | rookies | age 13 | 14 | 15 | 16 | pot ≥ 88 | pot 93–95 | pot 96–98 | 13–15 with pot ≥ 93 | max pot |");
  lines.push("|---|---|---|---|---|---|---|---|---|---|---|");
  for (const era of ["dataset (S0–S5)", "infinite (S6–S9)"] as const) {
    const from = era.startsWith("dataset") ? 0 : CAREER_SEASONS.length;
    const to = era.startsWith("dataset") ? CAREER_SEASONS.length - 1 : CAREER_SEASONS.length + 3;
    const rows: { age: number; pot: number }[] = [];
    for (let k = 0; k < seeds; k++)
      for (let season = from; season <= to; season++)
        for (const region of ALL_REGIONS)
          for (let n = 0; n < CAREER_WORLD.rookiesPerRegionPerSeason; n++) {
            const v = rookieView(region, season, n, seedOf(k), season >= CAREER_SEASONS.length, undefined, model);
            rows.push({ age: v.age, pot: v.potential });
          }
    const at = (a: number) => share(rows.filter((r) => r.age === a).length, rows.length);
    lines.push(
      `| ${era} | ${rows.length} | ${at(13)} | ${at(14)} | ${at(15)} | ${at(16)} | ${share(rows.filter((r) => r.pot >= 88).length, rows.length)} | ${share(rows.filter((r) => r.pot >= 93 && r.pot <= 95).length, rows.length)} | ${share(rows.filter((r) => r.pot >= 96 && r.pot <= 98).length, rows.length)} | ${share(rows.filter((r) => r.age <= 15 && r.pot >= 93).length, rows.length)} | ${Math.max(...rows.map((r) => r.pot))} |`,
    );
  }
  lines.push("");

  // 2. The season-0 world: fillers and the free-agent pool a new career sees.
  lines.push("### The season-0 world — generated players and the free-agent pool");
  lines.push("");
  lines.push("| Pool | players | age ≤ 15 | age 16–19 | pot ≥ 88 | pot ≥ 93 | max pot |");
  lines.push("|---|---|---|---|---|---|---|");
  const fillers: CareerPlayerView[] = [];
  const freeAgents: CareerPlayerView[] = [];
  for (let k = 0; k < Math.min(seeds, 12); k++) {
    const world = buildWorldAtCreation(seedOf(k));
    const views = worldViews(world, 0, seedOf(k));
    fillers.push(...views.filter((v) => v.kind === "fictional"));
    const fa = new Set(world.freeAgentIds);
    freeAgents.push(...views.filter((v) => fa.has(v.id)));
  }
  for (const [name, vs] of [["fillers (rosters + free agency)", fillers], ["free agents (real + fillers)", freeAgents]] as const) {
    lines.push(
      `| ${name} | ${vs.length} | ${share(vs.filter((v) => v.age <= 15).length, vs.length)} | ${share(vs.filter((v) => v.age >= 16 && v.age <= 19).length, vs.length)} | ${share(vs.filter((v) => v.potential >= 88).length, vs.length)} | ${share(vs.filter((v) => v.potential >= 93).length, vs.length)} | ${Math.max(...vs.map((v) => v.potential))} |`,
    );
  }
  lines.push("");

  // 3. Real players against their special cards (DEV-01c).
  lines.push("### Real players' potential against their special cards (DEV-01c)");
  lines.push("");
  const best = new Map<string, { overall: number }>();
  for (const sp of specialCards) {
    const was = best.get(sp.playerId);
    if (!was || sp.overall > was.overall) best.set(sp.playerId, { overall: sp.overall });
  }
  const gaps: number[] = [];
  let below = 0;
  for (const [playerId, sp] of best) {
    for (let k = 0; k < 5; k++) {
      const pot = isGrowthContract(model) ? derivePotentialV2(playerId, seedOf(k)) : derivePotential(playerId, seedOf(k), 60);
      gaps.push(sp.overall - pot);
      if (sp.overall > pot) below += 1;
    }
  }
  const sorted = [...gaps].sort((a, b) => a - b);
  lines.push(
    `Players with a special card: ${best.size}. Potential (the model's, 5 seeds) sits BELOW the best special's overall in ${share(below, gaps.length)} of samples; special − potential p50 ${sorted[Math.floor(sorted.length / 2)]}, p90 ${sorted[Math.floor(sorted.length * 0.9)]}, max ${sorted[sorted.length - 1]}.`,
  );
  // rc.32 (DEV-01c): against the ELIGIBLE special only (the rule: own real-moment
  // player cards of the career's era; never national, community, Creator, Wings, coach).
  let eligiblePlayers = 0;
  let eligibleBelow = 0;
  let eligibleSamples = 0;
  for (const playerId of best.keys()) {
    const sp = bestEligibleSpecialOverall(playerId);
    if (sp === null) continue;
    eligiblePlayers += 1;
    for (let k = 0; k < 5; k++) {
      const pot = isGrowthContract(model) ? derivePotentialV2(playerId, seedOf(k)) : derivePotential(playerId, seedOf(k), 60);
      eligibleSamples += 1;
      if (sp > pot) eligibleBelow += 1;
    }
  }
  lines.push(
    `With an eligible special (DEV-01c's rule): ${eligiblePlayers} players; potential below it in ${share(eligibleBelow, eligibleSamples)} of samples.`,
  );
  lines.push("");

  // 4. Scouting bands (DEV-01e): where the truth sits inside the band shown.
  lines.push("### Scouting bands (DEV-01e) — where the true potential sits in the band (0 = floor, 1 = ceiling)");
  lines.push("");
  lines.push("| Report level | headroom (pot − ovr) | players | mean position | at the floor (≤ 0.15) | at the ceiling (≥ 0.85) | ceiling − truth p50 |");
  lines.push("|---|---|---|---|---|---|---|");
  const sample: CareerPlayerView[] = [];
  for (let k = 0; k < Math.min(seeds, 12); k++) sample.push(...worldViews(buildWorldAtCreation(seedOf(k)), 0, seedOf(k)));
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
      const ab = [...above].sort((a, b) => a - b);
      lines.push(
        `| ${level} | ${label} | ${pos.length} | ${(pos.reduce((a, b) => a + b, 0) / Math.max(1, pos.length)).toFixed(2)} | ${share(pos.filter((x) => x <= 0.15).length, pos.length)} | ${share(pos.filter((x) => x >= 0.85).length, pos.length)} | ${ab.length ? ab[Math.floor(ab.length / 2)].toFixed(1) : "–"} |`,
      );
    }
  }
  lines.push("");

  // 4b. DEV-04 (rc.33): rc.32's band against the band shown now, on the same players
  // (mid-season, the market's view: the age clock's cap included).
  lines.push("### Scouting bands (DEV-04) — rc.32's band vs rc.33's (a new career, and an rc.32 career whose reports only narrow), same players (season 0, mid-season)");
  lines.push("");
  lines.push(
    "| Report level | band | players | width p50 / max | top − truth p50 / p90 / max | reads 99 with potential ≤ 93 | past his plateau: top over his overall |",
  );
  lines.push("|---|---|---|---|---|---|---|");
  const DAY = 80;
  const seeded: { v: CareerPlayerView; seed: number }[] = [];
  for (let k = 0; k < Math.min(seeds, 12); k++)
    for (const v of worldViews(buildWorldAtCreation(seedOf(k)), 0, seedOf(k))) seeded.push({ v, seed: seedOf(k) });
  for (const level of [0, 1, 2] as ScoutLevel[]) {
    for (const which of ["rc.32", "rc.33 new career", "rc.33 rc.32 career"] as const) {
      const widths: number[] = [];
      const over: number[] = [];
      let at99 = 0;
      let past = 0;
      let pastOver = 0;
      for (const { v, seed } of seeded) {
        const truth = Math.round(v.potential);
        const exactAge = exactAgeOf(v.age, DAY);
        const band =
          which === "rc.32"
            ? nestedBand(v.potential, level, seed, v.id)
            : scoutedBand(v.potential, v.overall, level, seed, v.id, model, {
                arc: { peakAge: v.peakAge, exactAge },
                rc32Reports: which === "rc.33 rc.32 career",
              });
        widths.push(band.max - band.min);
        over.push(band.max - truth);
        if (band.max === 99 && truth <= 93) at99 += 1;
        if (exactAge >= v.peakAge + developmentProfileOf(v.id, seed).plateauYears) {
          past += 1;
          if (band.max > Math.round(v.overall)) pastOver += 1;
        }
      }
      const q = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(xs.length * p))];
      lines.push(
        `| ${level} | ${which} | ${seeded.length} | ${q(widths, 0.5)} / ${Math.max(...widths)} | ${q(over, 0.5)} / ${q(over, 0.9)} / ${Math.max(...over)} | ${share(at99, seeded.length)} | ${share(pastOver, past)} of ${past} |`,
      );
    }
  }
  lines.push("");

  // 5. The world's growth curve (DEV-01b/d): generated players rolled nine seasons.
  lines.push("### World growth (DEV-01b/d) — generated players over nine season passes, by age");
  lines.push("");
  lines.push("| Age | n | overall p50 | gain over the season p50 | gap to potential p50 | within 2 of potential |");
  lines.push("|---|---|---|---|---|---|");
  const byAge = new Map<number, { ovr: number; gain: number; gap: number }[]>();
  for (let k = 0; k < Math.min(seeds, 6); k++) {
    const seed = seedOf(k);
    let world = buildWorldAtCreation(seed);
    let prev = new Map(worldViews(world, 0, seed).filter((v) => v.kind === "fictional").map((v) => [v.id, v]));
    for (let season = 1; season <= 9; season++) {
      // DEV-01 (model 2): the world grows every Monday; rc.31's grows at the rollover.
      if (isGrowthContract(model))
        for (let week = 1; week <= CAREER_CALENDAR.weeksPerSeason; week++)
          world = worldGrowthWeek(world, { seasonIndex: season - 1, week, careerSeed: seed, userSquadIds: [] });
      world = agePassAndIntake(world, season, seed, [], season >= CAREER_SEASONS.length, []).world;
      const now = worldViews(world, season, seed).filter((v) => v.kind === "fictional");
      for (const v of now) {
        const was = prev.get(v.id);
        if (!was) continue;
        const age = Math.min(30, was.age);
        byAge.set(age, [...(byAge.get(age) ?? []), { ovr: v.overall, gain: v.overall - was.overall, gap: v.potential - v.overall }]);
      }
      prev = new Map(now.map((v) => [v.id, v]));
    }
  }
  const p50 = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  for (const age of [...byAge.keys()].sort((a, b) => a - b)) {
    const xs = byAge.get(age)!;
    lines.push(
      `| ${age}${age === 30 ? "+" : ""} | ${xs.length} | ${p50(xs.map((x) => x.ovr)).toFixed(1)} | ${p50(xs.map((x) => x.gain)).toFixed(1)} | ${p50(xs.map((x) => x.gap)).toFixed(1)} | ${share(xs.filter((x) => x.gap <= 2).length, xs.length)} |`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

it.skipIf(!env.CAREER_CURVES)(
  "development curves (measures only)",
  () => {
    const md = curvesReport(Number(env.CURVES_SEEDS ?? 40));
    if (env.CURVES_MD) writeFileSync(env.CURVES_MD, md);
    else console.log(md);
  },
  1_800_000,
);
