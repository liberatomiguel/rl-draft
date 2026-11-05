import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, unlinkSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { expect, it } from "vitest";

it("summarizes baseline precision, failure censoring and annual finances without dumping raw careers", () => {
  const dir = mkdtempSync(resolve(tmpdir(), "rtw-summary-"));
  const season = (seasonIndex: number, regionRank: number) => ({ seasonIndex, regionRank, balanceEnd: 100,
    income: { prize: 1000, sponsorBase: 500 }, spend: { payroll: 400, coachSalary: 100, playerShare: 100, sponsorFine: 50 },
    mondaysNegative: 1, bankLoans: 0, payrollPerSplit: 9999, signings: 0, sales: 0, worlds: null,
    series: { regional: [1, 3] } });
  try {
    writeFileSync(resolve(dir, "shard-0.json"), JSON.stringify({ schema: 1, careers: [{
      region: "EU", difficulty: "hard", roster: "journeymen", profile: "learner", seed: 1, cohort: "baseline",
      arc: { seasons: [season(5, 4), season(6, 0)], ended: "insolvency", softlock: null },
      milestones: { regional: { season: 6, week: 5, day: 35 } },
      purchases: [], events: [], seasonSnapshots: [{ moment: "end", season: 7, end: { moneyCause: "deadline" } }],
    }] }));
    const output = execFileSync(process.execPath, ["src/store/auditHumanSummary.mjs", "--input", dir], { encoding: "utf8" });
    const summary = JSON.parse(output);
    const cell = summary.cells[0];
    expect(summary.limitations.join(" ")).toContain("never rerun");
    expect(cell.funnel.firstSeries.seasonOnly).toBe(1);
    expect(cell.funnel["title:worlds"].notReached).toBe(1);
    expect(cell.finances.negativeCalendarDays).toBeNull();
    expect(cell.finances.insolvencies).toBe(1);
    expect(cell.finances.causes).toEqual({ deadline: 1 });
    expect(cell.finances.lateSeasons).toBe(1);
    expect(cell.finances.partialLateSeasonsExcluded).toBe(1);
    expect(cell.finances.latePayroll.p50).toBe(500); // Actual annual ledger, NOT split snapshot × arbitrary weeks.
    expect(cell.finances.latePrizeSponsor.p50).toBe(1350);
    expect(output).not.toContain('"careers":');
    expect(output).not.toContain('"squad":');
  } finally { unlinkSync(resolve(dir, "shard-0.json")); rmdirSync(dir); }
});
