/** Reads evidence, never simulates careers. Works with zip schema 1 and this tool's schema 2.
 * node src/store/auditHumanSummary.mjs --input <external-folder> [--out <summary.json>]
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const FUNNEL = ["firstSeries", "regional", "swiss", "swissWin", "playoffs", "major", "title:major", "worlds", "title:worlds"];
const SPONSORS = ["sponsorBase", "sponsorBonus", "sponsorSigning", "sponsorMilestone"];
const quantile = (a, p) => {
  const sorted = a.filter(Number.isFinite).sort((x, y) => x - y);
  return sorted.length ? Math.round(sorted[Math.round((sorted.length - 1) * p)] * 10000) / 10000 : null;
};
const distribution = a => ({ n: a.filter(Number.isFinite).length, p10: quantile(a, 0.1), p50: quantile(a, 0.5), p90: quantile(a, 0.9) });
const sum = a => a.reduce((n, x) => n + (Number.isFinite(x) ? x : 0), 0);
function milestone(r, key) {
  const m = r.milestones ?? {};
  if (m[key]) return { ...m[key], precision: "day" };
  if (key === "playoffs" && m.regionalAfterSwiss) return { ...m.regionalAfterSwiss, precision: "day" };
  if (key === "swiss" && m.regional) return { ...m.regional, precision: "day" };
  if (key === "firstSeries" || key === "swissWin") {
    const season = r.arc.seasons.find(s => key === "firstSeries"
      ? Object.values(s.series ?? {}).some(([won]) => won > 0) : (s.series?.regional?.[0] ?? 0) > 0);
    if (season) return { season: season.seasonIndex + 1, precision: "season" };
  }
  const arcKey = { major: "firstMajorSeason", worlds: "firstWorldsSeason", "title:worlds": "worldsTitleSeason" }[key];
  if (arcKey && r.arc[arcKey] != null) return { season: r.arc[arcKey] + 1, precision: "season" };
  return null;
}
const seasonOf = s => s.seasonIndex + 1;
function annualMoney(s) {
  const i = s.income ?? {}, o = s.spend ?? {};
  const payroll = (o.payroll ?? 0) + (o.salary ?? 0) + (o.coachSalary ?? 0);
  const grossPrize = i.prize ?? 0;
  const netPrize = grossPrize - (o.playerShare ?? 0);
  const netSponsor = sum(SPONSORS.map(k => i[k])) - (o.sponsorFine ?? 0);
  return { season: seasonOf(s), payroll, grossPrize, netPrize, netSponsor,
    payrollToPrizeSponsor: netPrize + netSponsor > 0 ? payroll / (netPrize + netSponsor) : null,
    endPayrollPerSplit: s.payrollPerSplit, balance: s.balanceEnd };
}
function completeSeason(r, s) {
  const snapshot = r.seasonSnapshots?.find(x => x.moment === "end" && x.season === seasonOf(s));
  return snapshot?.phase ? snapshot.phase === "seasonReview" : s.regionRank > 0;
}
function groupSummary(rows) {
  const n = rows.length, allSeasons = rows.flatMap(r => r.arc.seasons);
  const funnel = Object.fromEntries(FUNNEL.map(key => {
    const reached = rows.map(r => milestone(r, key)).filter(Boolean);
    return [key, { reached: reached.length, total: n, season: distribution(reached.map(m => m.season)),
      ordinalSplit: distribution(reached.filter(m => m.week != null).map(m => (m.season - 1) * 3 + Math.min(3, Math.floor((m.week - 1) / 10) + 1))),
      seasonOnly: reached.filter(m => m.precision === "season").length,
      // Completion/censoring stays visible. No success-only median is presented as a guarantee.
      notReached: n - reached.length }];
  }));
  const causes = {};
  for (const r of rows.filter(r => r.arc.ended === "insolvency")) {
    const snapshots = r.seasonSnapshots ?? [];
    const cause = r.finances?.end?.moneyCause ?? snapshots.at(-1)?.end?.moneyCause ?? "unrecorded";
    causes[cause] = (causes[cause] ?? 0) + 1;
  }
  const detailed = rows.filter(r => r.finances);
  const earlyCash = [1, 2, 3].map(season => ({ season, cash: distribution(allSeasons.filter(s => seasonOf(s) === season).map(s => s.balanceEnd)) }));
  const late = rows.flatMap(r => r.arc.seasons.filter(s => seasonOf(s) >= 6 && completeSeason(r, s)).map(annualMoney));
  const partialLateSeasons = rows.flatMap(r => r.arc.seasons.filter(s => seasonOf(s) >= 6 && !completeSeason(r, s))).length;
  const dominantSeasons = rows.flatMap(r => r.arc.seasons.filter(s => s.worlds === "champion"
    || (r.milestones?.["title:major"]?.season <= seasonOf(s)
      && (r.events ?? []).some(e => (e.tier === "major") && (e.placement === "champion" || e.userPlacement === "champion")
        && (e.season ?? e.seasonIndex + 1) === seasonOf(s)))).map(s => s.balanceEnd));
  const purchaseIds = [...new Set([
    "peripherals", "monitors", "pcs", "perfCenter", "coach", "psychologist", "bootcamp",
    ...rows.flatMap(r => r.actions?.filter(a => a.kind === "gear").map(a => a.item) ?? []),
  ])];
  const purchases = Object.fromEntries(purchaseIds.map(item => {
    const actions = rows.flatMap(r => r.actions?.filter(a => a.kind === "gear" ? a.item === item : a.kind === item) ?? []);
    const baseline = rows.filter(r => !r.actions).flatMap(r => (r.purchases ?? []).filter(p => p.id === item));
    const samples = rows.flatMap(r => r.activeEffects?.filter(e => e.item === item) ?? []);
    const sampleCount = sum(samples.map(e => e.samples));
    return [item, { purchases: detailed.length === n ? actions.length : (baseline.length ? baseline.length : null),
      // Schema 1 logs only the first owned installation, not every consumable purchase.
      recording: detailed.length === n ? "all accepted actions" : "baseline first acquisitions; consumables incomplete",
      spent: actions.length ? -sum(actions.map(a => a.cashDelta)) : null,
      instantRatingDelta: distribution(actions.map(a => a.effect.rating)),
      activePlanSamples: sampleCount,
      meanMarginalStatsAfterCaps: Object.fromEntries(["offense", "defense", "mechanics", "consistency", "experience", "clutch"].map(stat => {
        const measured = samples.filter(s => s.stats);
        const n = sum(measured.map(s => s.samples));
        return [stat, n ? sum(measured.map(s => s.stats[stat])) / n : null];
      })),
      meanMarginalRatingAfterCaps: sampleCount ? sum(samples.map(e => e.rating)) / sampleCount : null,
      meanMarginalFullDayGainAfterCaps: sampleCount ? sum(samples.map(e => e.fullDayGain)) / sampleCount : null,
      meanMarginalPaidDayGainAfterCaps: sampleCount ? sum(samples.map(e => e.paidDayGain)) / sampleCount : null,
    }];
  }));
  const titles = rows.filter(r => milestone(r, "title:worlds"));
  const postTitle = titles.map(r => {
    const title = milestone(r, "title:worlds").season;
    return { seasons: r.arc.seasons.filter(s => seasonOf(s) > title && completeSeason(r, s)).length,
      insolvent: r.arc.ended === "insolvency" && seasonOf(r.arc.seasons.at(-1)) > title };
  });
  const competitiveSeasons = [...new Set(allSeasons.map(seasonOf))].sort((a, b) => a - b).map(season => {
    const observed = rows.filter(r => r.arc.seasons.some(s => seasonOf(s) === season));
    const events = observed.flatMap(r => (r.events ?? []).filter(e => (e.season ?? e.seasonIndex + 1) === season));
    const tiers = {};
    for (const tier of ["regional", "major", "worlds"]) {
      const entered = events.filter(e => e.tier === tier);
      const placements = {};
      for (const event of entered) { const place = event.placement ?? event.userPlacement; placements[place] = (placements[place] ?? 0) + 1; }
      tiers[tier] = { entries: entered.length, placements };
    }
    return { season, careersObserved: observed.length, completed: observed.filter(r => r.arc.seasons.some(s => seasonOf(s) === season && completeSeason(r, s))).length, tiers,
      series: Object.fromEntries(["t3", "t2", "qualifier", "regional", "major", "worlds"].map(tier => [tier, [
        sum(observed.map(r => r.arc.seasons.find(s => seasonOf(s) === season)?.series?.[tier]?.[0])),
        sum(observed.map(r => r.arc.seasons.find(s => seasonOf(s) === season)?.series?.[tier]?.[1])),
      ]])) };
  });
  return { n, seeds: [...new Set(rows.map(r => r.seed))].sort((a, b) => a - b), funnel, competitiveSeasons, finances: {
    insolvencies: rows.filter(r => r.arc.ended === "insolvency").length, causes,
    softlocks: rows.filter(r => r.arc.softlock).length,
    negativeCalendarDays: detailed.length ? distribution(detailed.map(r => r.finances.negativeDays)) : null,
    longestNegativeStreakDays: detailed.length ? distribution(detailed.map(r => r.finances.longestNegativeDays)) : null,
    observedCalendarDays: sum(detailed.map(r => r.finances.observedDays)),
    negativeMondays: sum(allSeasons.map(s => s.mondaysNegative)),
    emergencyLoans: detailed.length ? sum(detailed.map(r => r.finances.emergencyLoans)) : null,
    careersWithEmergencyLoan: rows.filter(r => r.milestones?.emergencyLoan).length,
    bankLoans: sum(allSeasons.map(s => s.bankLoans)),
    earlyCash, cashP90: quantile(rows.map(r => r.arc.seasons.at(-1)?.balanceEnd), 0.9),
    dominantSeasonCashP90: quantile(dominantSeasons, 0.9), dominantSeasonN: dominantSeasons.length,
    lateSeasonBasis: "Completed S6+ only; actual annual payroll and prize net of player shares, sponsor net of fines",
    partialLateSeasonsExcluded: partialLateSeasons,
    lateSeasons: late.length, latePayroll: distribution(late.map(s => s.payroll)),
    latePrizeSponsor: distribution(late.map(s => s.netPrize + s.netSponsor)),
    latePayrollToPrizeSponsor: distribution(late.map(s => s.payrollToPrizeSponsor)),
  }, purchases,
  transfers: { signings: sum(allSeasons.map(s => s.signings)), sales: sum(allSeasons.map(s => s.sales)),
    prospectPolicyFallbacks: rows.filter(r => r.profile === "prospectsOnly").flatMap(r => r.actions ?? []).filter(a => a.kind === "signing" && a.age > 19).length },
  briefings: Object.fromEntries(["none", "keep", "recover", "prepare", "adaptive"].map(choice => [choice,
    rows.flatMap(r => r.actions ?? []).filter(a => a.kind === "briefing" && a.briefing?.requested === choice).length])),
  postTitle: { titledCareers: titles.length, withFollowup: postTitle.filter(r => r.seasons > 0).length,
    completeSeasonsObserved: sum(postTitle.map(r => r.seasons)), insolvencies: postTitle.filter(r => r.insolvent).length },
  exposure: { playedSeasons: allSeasons.length, seasonsPerCareer: distribution(rows.map(r => r.arc.seasons.length)),
    endedBeforeHorizon: rows.filter(r => r.arc.seasons.length < (r.seasons ?? 10)).length },
  };
}
export function summarizeHumanAudit(folder) {
  const paths = readdirSync(folder).filter(p => /^shard-\d+\.json$/.test(p)).sort();
  if (!paths.length) throw Error("No shard files found (no simulation was started)");
  const groups = new Map(), identities = [], seen = new Set();
  let legacy = false, signature = null;
  const files = [];
  for (const path of paths) {
    const doc = JSON.parse(readFileSync(resolve(folder, path), "utf8"));
    const common = doc.identity ? Object.fromEntries(Object.entries(doc.identity).filter(([k]) => k !== "shard"))
      : { commit: doc.commit, version: doc.version, balanceVersion: doc.balanceVersion };
    const current = JSON.stringify({ schema: doc.schema ?? 1, ...common });
    if (signature !== null && signature !== current) throw Error("Mixed revisions/protocols/manifests; summarize folders separately");
    signature = current;
    files.push({ file: path, recorded: doc.careers.length, planned: doc.planned ?? null });
    identities.push(doc.identity ?? { commit: doc.commit, version: doc.version, balanceVersion: doc.balanceVersion });
    legacy ||= doc.schema !== 2;
    for (const r of doc.careers) {
      const dimensions = { region: r.region, difficulty: r.difficulty, roster: r.roster, profile: r.profile,
        cohort: r.cohort ?? "baseline", worldsExtra: r.worldsExtra ?? 0, horizon: r.seasons ?? 10 };
      const groupKey = JSON.stringify(dimensions), runKey = groupKey + "|" + r.seed;
      if (seen.has(runKey)) throw Error("Duplicate career evidence: " + runKey);
      seen.add(runKey);
      if (!groups.has(groupKey)) groups.set(groupKey, []);
      groups.get(groupKey).push(r);
    }
  }
  return { schema: 1, source: resolve(folder), identities, files, expectedShards: identities[0]?.shards ?? null,
    reference: { firstSplits: "Few wins; first two splits usually no regional (not a hard rule)",
      regional: "From split 3 more plausible; S3 more consistent, initially weak results",
      major: "Chances from S4–5, better results around S6", worlds: "Qualification S6–7, title ideally S7–8",
      finances: "Challenge with recovery choices; some failures; late cash for stars. Descriptive targets, no calendar enforced." },
    definitions: { swiss: "First regional Swiss entry", swissWin: "First regional Swiss series won", playoffs: "First regional playoff berth",
      firstSeries: "First series win in any entered event, including community cups",
      cashP90: "Final observed cash per career; dominants = seasons with Major/Worlds title",
      negativeDays: "Calendar dates observed negative at least once; not hours or all day negative",
      effects: "Same-state marginal engine effects after caps; weekly active-plan samples, not causal win-rate estimates" },
    limitations: legacy ? ["Baseline reused from zip; never rerun.", "Baseline series milestones have season precision; negative time is Monday samples only.",
      "Baseline repeated consumables and post-cap effects unrecorded (null). New profiles have no matched baseline."] : ["Smoke is not a balance verdict; inspect sample sizes and exposure.", "No title by S20 means no post-title evidence, not a fabricated championship.", "Stat marginals added after this smoke; missing fields remain null, never inferred from zero rating."],
    cells: [...groups].map(([key, rows]) => ({ ...JSON.parse(key), ...groupSummary(rows) })),
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const input = args[args.indexOf("--input") + 1];
  if (!args.includes("--input") || !input) throw Error("Usage: --input <external evidence folder> [--out <summary.json>]");
  const text = JSON.stringify(summarizeHumanAudit(resolve(input)), null, 2);
  if (args.includes("--out")) writeFileSync(resolve(args[args.indexOf("--out") + 1]), text);
  else console.log(text); // Only the funnel and per-cell financial/progression summary, never raw shards.
}
