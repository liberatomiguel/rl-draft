import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { expect, it } from "vitest";

const cell = (profile: string, seed = 9100) => ({ region: "NA", difficulty: "easy", roster: "balanced", profile, seed, seasons: 10 });
const keyOf = (profile: string, seed = 9100) => ["coverage", "NA", "easy", "balanced", profile, seed, 10, 0].join("|");
const season = (i: number, extra: Record<string, unknown> = {}) => ({
  seasonIndex: i, label: `S${i + 1}`, balanceEnd: 10_000 + i * 1000, balanceMin: 5000, mondaysNegative: 0, debtEnd: 0, backerActive: false, bankLoans: 0,
  payrollPerSplit: 3000, sponsorBasePerSplit: 2000, weeklyNet: 10, income: { prize: 5000, sponsorBase: 6000 }, spend: { payroll: 8000, coachSalary: 1000, playerShare: 500 },
  regionRank: 5, seasonPoints: 100, majorsQualified: 0, worlds: null, titles: 0, rep: 20 + i, teamRating: 75, signings: 0, starSignings: 0, sales: 0, squad: [],
  crisis: { creditOffers: 1, creditTaken: 1, creditPrincipal: 5000, emergencyOffers: 0, emergencyAccepted: 0, emergencyFees: 0 },
  chemistry: { percent: 67, tier: "Good", pairTenure: [3, 3, 3], heritage: { country: 0, region: 0, none: 3 } },
  market: { day: 10, signable: 50, wageP50: 1000, wageP90: 3000, feeP50: 5000, byBand: { "90+": { n: 1, wageP50: 50_000, feeP50: 200_000 } }, payrollPerSplit: 3000 },
  ...extra,
});
const snapshots = (n: number, lastPhase = "seasonReview") => Array.from({ length: n }, (_, i) => [
  { moment: "start", season: i + 1, phase: "running", balance: 0, debt: 0, end: { ended: false, infinite: false } },
  { moment: "end", season: i + 1, phase: i === n - 1 ? lastPhase : "seasonReview", balance: 0, debt: 0, end: { ended: false, infinite: false } },
]).flat();
/** A titled learner career: Worlds title in S2 (its first Worlds, so the fork is S2). */
function learner(worldsS2: string | null, cohort = "coverage", worldsExtra = 0, seasons = 10) {
  const rows = Array.from({ length: seasons }, (_, i) => season(i, i === 1 ? { worlds: worldsS2, majorsQualified: 1, balanceEnd: worldsS2 === "champion" ? 50_000 : 40_000 } : {}));
  return { unit: keyOf("learner"), tier: "A", ...cell("learner"), seasons, cohort, worldsExtra, ...(cohort === "worldsPair" ? { exposed: true, spyApplications: 1 } : {}),
    ...(cohort === "endless" ? { extendedFrom: 10 } : { forkAt: { season: 2, day: 223, week: 32, absoluteDay: 447 } }),
    arc: { seasons: rows, ended: null, softlock: null, firstMajorSeason: 1, firstWorldsSeason: 1, worldsTitleSeason: worldsS2 === "champion" ? 1 : null, firstSponsorSeason: 0 },
    milestones: { firstSeries: { season: 1, week: 3 }, regional: { season: 1, week: 8 }, swissWin: { season: 1, week: 24 }, playoffs: { season: 1, week: 24 },
      major: { season: 2, week: 20 }, worlds: { season: 2, week: 32 }, ...(worldsS2 === "champion" ? { "title:worlds": { season: 2, week: 32 } } : {}) },
    events: [
      { season: 1, week: 8, id: "0:1:reg1:NA", tier: "regional", placement: "swiss_exit", swissWins: 0, swissLosses: 3, playoffWins: 0, repBefore: 10, repDelta: 0, prize: 700, playerShare: 0 },
      { season: 1, week: 24, id: "0:3:reg1:NA", tier: "regional", placement: "top8", swissWins: 3, swissLosses: 1, playoffWins: 0, repBefore: 12, repDelta: 1, prize: 3000, playerShare: 0 },
      { season: 2, week: 32, id: "1:worlds", tier: "worlds", placement: worldsS2 ?? "swiss_exit", swissWins: 3, swissLosses: 0, playoffWins: 3, repBefore: 60, repDelta: 5, prize: 400_000, playerShare: 40_000 },
    ],
    actions: [
      { season: 1, week: 9, kind: "gear", item: "peripherals", cashDelta: -1500, weeklyCostDelta: 0, effect: { rating: 0, trainingBonus: 0.05, fullDayGain: 0.002 } },
      { season: 2, week: 24, kind: "renewal", item: "p1", cashDelta: 0, weeklyCostDelta: 200, effect: { rating: 0 },
        renewal: { oldWage: 1000, newWage: 2000, freshAsk: 4000, bound: "jump", tenure: 1, renewalCount: 0, overall: 78, age: 21 } },
      { season: 1, week: 8, kind: "briefing", item: "prepare", cashDelta: 0, weeklyCostDelta: 0, effect: { rating: 0 },
        briefing: { requested: "prepare", effective: "prepare", tier: "regional", playing: true, coached: true, stage: "regional", swiss: 0.4, playoffs: -0.15 } },
    ],
    seasonSnapshots: snapshots(seasons),
    activeEffects: [{ season: 1, item: "peripherals", samples: 2, rating: 0, fullDayGain: 0.004, paidDayGain: 0.004, stats: { consistency: 0 } }],
    finances: { observedDays: 2240, negativeDays: 0, longestNegativeDays: 0, emergencyLoans: 0, bankLoans: 1, minimumBalance: 5000, minimumPayrollWeeks: null, redWeeksBySeason: {}, end: { reason: "worlds_won" } },
  };
}
/** An old-schema academy career gone insolvent in S3: no market, no rep/prize on events. */
function academy() {
  const rows = [0, 1, 2].map((i) => { const s: Record<string, unknown> = season(i, { balanceEnd: i === 2 ? -9000 : 2000 }); delete s.market; return s; });
  return { unit: keyOf("academy"), tier: "A", ...cell("academy"), cohort: "coverage", worldsExtra: 0, forkAt: null,
    arc: { seasons: rows, ended: "insolvency", softlock: null, firstMajorSeason: null, firstWorldsSeason: null, worldsTitleSeason: null },
    milestones: { regional: { season: 2, week: 5 }, negative: { season: 2, week: 30 } },
    events: [{ season: 2, week: 5, id: "1:1:reg1:NA", tier: "regional", placement: "swiss_exit", swissWins: 1, playoffWins: 0 }],
    actions: [], seasonSnapshots: snapshots(3, "ended"), activeEffects: [],
    finances: { observedDays: 600, negativeDays: 40, longestNegativeDays: 40, emergencyLoans: 1, bankLoans: 0, minimumBalance: -9000, minimumPayrollWeeks: -9.5, end: { reason: "insolvency", moneyCause: "deadline" } },
  };
}
const unexposed = (profile: string, worldsExtra: number) => ({ unit: keyOf(profile), tier: "A", ...cell(profile), cohort: "worldsPair", worldsExtra, exposed: false });

it("reports the cohort battery from done units only, deduped, with nulls kept null and no raw records", () => {
  const dir = mkdtempSync(resolve(tmpdir(), "rtw-report-"));
  try {
    const failed = { ...learner("champion"), arc: { ...learner("champion").arc, softlock: "budget: season 3 day 9" } };
    const lines = [
      failed, unexposed("learner", 0.5), unexposed("learner", 1), // attempt 1 (budget softlock, not done), superseded
      learner("champion"), learner("runner_up", "worldsPair", 0.5), learner("champion", "worldsPair", 1), learner("champion", "endless", 0, 20),
      academy(), unexposed("academy", 0.5), unexposed("academy", 1),
      { ...learner(null), unit: keyOf("known"), profile: "known" }, // pending: never in done
      { unit: keyOf("stars"), tier: "A", ...cell("stars"), cohort: "error", worldsExtra: 0, error: "Boom\n    at stack" },
    ].map((r) => JSON.stringify(r));
    writeFileSync(resolve(dir, "shard-0.jsonl"), lines.join("\n") + "\n" + '{"unit":"coverage|NA|easy|balanced|novice|9100|10|0","tier":"A","re');
    writeFileSync(resolve(dir, "done-0.txt"), [keyOf("learner"), keyOf("academy"), keyOf("stars"), keyOf("trader")].join("\n") + "\n");
    writeFileSync(resolve(dir, "identity-0.json"), JSON.stringify({ identity: { protocol: "rc37-human-v2", shards: 1, shard: 0 }, revision: "abc1234",
      aliases: { "style-consistency": "coachUpgrades", "briefing-adaptive": "coachUpgrades" }, planned: 882, totalUnits: 4914 }));
    writeFileSync(resolve(dir, "baseline.json"), JSON.stringify({ identities: [{ version: "2.0.0-rc.36.10" }], cells: [{ ...cell("learner"), seeds: [9100], cohort: "coverage", worldsExtra: 0, horizon: 10, n: 1,
      funnel: { major: { reached: 0, season: { p50: null } }, worlds: { reached: 0, season: { p50: null } } }, finances: { insolvencies: 0, negativeMondays: 3, bankLoans: 0 } }] }));
    const out = resolve(dir, "out", "report");
    const stdout = execFileSync(process.execPath, ["src/store/auditHumanSummaryReport.mjs", "--input", dir, "--out", out, "--baseline", resolve(dir, "baseline.json")], { encoding: "utf8" });
    for (const suffix of [".md", ".json", "-cells.csv"]) expect(existsSync(out + suffix)).toBe(true);
    expect(stdout.trim().split("\n").length).toBeLessThanOrEqual(6);
    const report = JSON.parse(readFileSync(out + ".json", "utf8"));
    const cov = report.coverage;
    expect(cov.plan.tiers).toEqual(["A"]);
    expect(cov.done).toMatchObject({ units: 4, withoutLines: 1, outsidePlan: 0 });
    expect(cov.lines).toMatchObject({ superseded: 3, pendingNotDone: 1, partialOrMalformed: 1 });
    expect(cov.careersByCohort).toEqual({ coverage: 2, "worldsPair exposto": 2, "worldsPair não exposto": 2, endless: 1, error: 1 });
    expect(cov.softlocks.careers).toBe(0); // the budget softlock was retried and superseded
    const base = report.groups["base: todas"];
    expect(base.n).toBe(2);
    expect(base.failures).toMatchObject({ insolvencies: 1, causes: { deadline: 1 } });
    expect(base.failures.season.p50).toBe(3);
    expect(base.funnel["title:worlds"].reached).toBe(1);
    expect(base.funnel["title:worlds"].unconditional.p50).toBe(">10"); // 1 of 2: the median is censored, not invented
    expect(base.finances.crossedMinus8).toBe(0.5);
    expect(report.worldsPairs.paired["0.5"]).toMatchObject({ units: 1, fewerTitles: 1 });
    expect(report.worldsPairs.paired["1"]).toMatchObject({ units: 1, sameTitles: 1 });
    expect(report.checks.pairPrefixMismatch).toEqual([]);
    expect(report.checks.endlessPrefixMismatch).toEqual([]);
    expect(report.postTitle).toMatchObject({ eligibleControls: 1, endlessRecords: 1 });
    expect(report.renewals["S1-10"].all.n).toBe(1);
    expect(report.renewals["S1-10"].all.ratio.p50).toBe(0.5);
    // Old-schema fields stay null / uncounted, never zero.
    expect(report.reputation.eventsWithoutRep).toBe(1);
    expect(report.reputation.regionalS1toS3BySwiss.map((r: { record: string }) => r.record)).toEqual(["3-1", "0-3"]);
    expect(report.endgame.market.find((m: { season: number }) => m.season === 3).absent).toBe(1);
    expect(report.baseline.overall.matched).toBe(1);
    expect(report.baseline.overall.reach.major).toMatchObject({ baseline: 0, now: 1, delta: 1 });
    const csv = readFileSync(out + "-cells.csv", "utf8").trim().split("\n");
    expect(csv.length).toBe(3);
    const md = readFileSync(out + ".md", "utf8");
    expect(md).toContain("## 13. Comparação com a baseline");
    for (const text of [stdout, md, readFileSync(out + ".json", "utf8")]) {
      expect(text).not.toContain('"seasonSnapshots"');
      expect(text).not.toContain("at stack");
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
