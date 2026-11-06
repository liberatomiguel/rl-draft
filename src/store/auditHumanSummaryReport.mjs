/**
 * rc.37 "Road to Worlds" career battery report. Reads evidence only; never simulates a career.
 *   node src/store/auditHumanSummaryReport.mjs --input <run dir> --out <prefix> [--baseline <F4a-baseline-summary.json>]
 * Writes <prefix>.md (compact tables), <prefix>.json (every aggregate, no raw record) and
 * <prefix>-cells.csv (one row per region × difficulty × roster × profile). Stdout: a short summary.
 * Evidence rules: a unit counts only once its key is in a done-N.txt; a resumed unit keeps its last
 * attempt, deduped by (unit, cohort, worldsExtra) (last line wins). Absent fields stay null, never zero.
 * The JSONL is streamed twice (line heads first, then only the selected lines), so file size is no limit.
 */
import { createReadStream, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

// ------------------------------------------------------------------ plan and definitions
// Mirrors humanCohortPlan (auditHumanMatrix.ts) and the profile order of auditHumanProfiles.ts. Checked
// against identity-N.json (totalUnits, planned per shard); on a mismatch the per-tier plan is null.
const REGIONS = ["NA", "EU", "SAM", "MENA", "OCE", "APAC", "SSA"];
const DIFFICULTIES = ["easy", "normal", "hard"];
const ROSTERS = ["balanced", "prospects", "journeymen"];
const SEEDS = [9100, 17019];
const TIERS = ["A", "B", "C", "D"];
const BASE_PROFILES = ["learner", "academy", "known", "ambitious", "homegrown", "prospectsOnly", "stars", "trader",
  "continuous", "buyAll", "experienced", "novice", "coachFixed", "coachUpgrades"];
const FACTOR_PROFILES = [
  ...["offense", "defense", "mechanics", "consistency", "experience", "clutch"].map((x) => "style-" + x),
  ...["development", "preparation", "recovery"].map((x) => "plan-" + x), "load-light", "load-heavy",
  ...["mechanics-lab", "rotations", "set-plays", "film-room", "clutch-sets"].map((x) => "focus-" + x),
  "scrim-easy", "scrim-hard", "scrim-auto", "scrim-off", "plan-base", "plan-delegated",
  ...["none", "keep", "recover", "prepare", "adaptive"].map((x) => "briefing-" + x),
];
const DEFAULT_ALIASES = { "style-consistency": "coachUpgrades", "briefing-adaptive": "coachUpgrades" };
const BASELINE_PROFILES = ["learner", "academy", "known", "ambitious"];
const CONTROL = "coachUpgrades";
const FUNNEL = ["firstSeries", "regional", "swiss", "swissWin", "playoffs", "major", "title:major", "worlds", "title:worlds"];
const EXTRA_MILESTONES = ["title:t3", "title:t2", "title:qualifier", "title:regional", "negative", "emergencyLoan"];
const ANY_TITLE = ["title:t3", "title:t2", "title:qualifier", "title:regional", "title:major", "title:worlds"];
const REGIONAL_PLUS_TITLE = ["title:regional", "title:major", "title:worlds"];
const CHECK_SEASONS = [2, 3, 5, 7, 8, 10];
const SPONSOR_KINDS = ["sponsorBase", "sponsorBonus", "sponsorSigning", "sponsorMilestone"];
const PLACE_ORDER = ["champion", "runner_up", "third", "fourth", "top4", "top6", "top8", "swiss_exit"];
const PLACE_RANK = { champion: 1, runner_up: 2, third: 3, fourth: 4, top4: 3.5, top6: 5.5, top8: 7.5, swiss_exit: 12 };
const TENURE_BUCKETS = [["<1", 1], ["1–2", 2], ["2–4", 4], ["4–8", 8], ["8+", Infinity]];
const PRIZE_BUCKETS = [["S1–2", 2], ["S3–4", 4], ["S5–6", 6], ["S7–8", 8], ["S9–10", 10], ["S11–15", 15], ["S16–20", 20]];
const EFFECT_BUCKETS = [["S1–3", 3], ["S4–6", 6], ["S7–10", 10], ["S11–20", 20]];
const PURCHASE_KINDS = ["coach", "psychologist", "bootcamp"];
const MIN_N_COMPARE = 5;
/** Reputation reads 0–100 in the data (rep before p50 = 100 for titles): comparisons use events with room below it. */
const REP_CEILING = 100, REP_HEADROOM = 90, REP_MIN_GAP = 0.25;
/** Miguel's references are distributions, not a calendar: the flags only say where the median sits. */
const TARGETS = {
  early: { maxRegionalTitleByS2: 0.2, text: "Poucos triunfos cedo (título Regional+ até S2 ≤ 20%; títulos t3/t2 só informativos)" },
  regional: { maxShareBySplit2: 0.5, text: "Normalmente sem Regional nos 2 primeiros splits (alcance até o split 2 < 50%); chances a partir do split 3" },
  s3: { minMeanSplits: 2, text: "Presença mais constante em S3 (média ≥ 2 de 3 splits com Regional)" },
  major: { window: [4, 5], text: "Major por S4–5 (mediana incondicional)" },
  worlds: { window: [6, 7], text: "Worlds por S6–7 (mediana incondicional)" },
  "title:worlds": { window: [7, 8], text: "Título idealmente S7–8 (mediana incondicional)" },
  insolvency: { max: 0.25, text: "Finanças desafiadoras, recuperação possível, algumas falências (0% = nenhuma; > 25% = alta)" },
  stars: { text: "Caixa para estrelas no endgame (temporadas dominantes com saldo ≥ fee p50 da faixa 90+ do mercado)" },
};

// ------------------------------------------------------------------ small statistics
const isNum = (x) => typeof x === "number" && Number.isFinite(x);
const r4 = (x) => (isNum(x) ? Math.round(x * 1e4) / 1e4 : null);
const sumOf = (a) => a.reduce((n, x) => n + (isNum(x) ? x : 0), 0);
const meanOf = (a) => { const v = a.filter(isNum); return v.length ? r4(sumOf(v) / v.length) : null; };
const count = (a, f) => a.reduce((n, x) => n + (f(x) ? 1 : 0), 0);
const share = (k, n) => (n > 0 ? r4(k / n) : null);
const uniq = (a) => [...new Set(a.filter((x) => x !== null && x !== undefined))].sort();
const inc = (o, k, by = 1) => { o[k] = (o[k] ?? 0) + by; };
const push = (o, k, v) => { (o[k] ??= []).push(v); };
const bucketOf = (buckets, x) => (buckets.find(([, max]) => x <= max) ?? buckets.at(-1))[0];
function dist(values) {
  const s = values.filter(isNum).sort((a, b) => a - b);
  const q = (p) => r4(s[Math.round((s.length - 1) * p)]);
  return s.length ? { n: s.length, p10: q(0.1), p50: q(0.5), p90: q(0.9), mean: r4(sumOf(s) / s.length) } : { n: 0, p10: null, p50: null, p90: null, mean: null };
}
/** Quantiles over every career, a non-reacher counting as beyond the horizon (">10"): censoring stays visible. */
function uncond(seasons, n, horizon) {
  if (!n) return { p10: null, p50: null, p90: null };
  const s = [...seasons].sort((a, b) => a - b);
  const q = (p) => { const i = Math.round((n - 1) * p); return i < s.length ? s[i] : ">" + horizon; };
  return { p10: q(0.1), p50: q(0.5), p90: q(0.9) };
}
const splitOfWeek = (week) => (week <= 10 ? 1 : week <= 20 ? 2 : 3);
const byNumber = (a, b) => Number(a.match(/\d+/)?.[0] ?? 0) - Number(b.match(/\d+/)?.[0] ?? 0);
function readJson(path) { try { return JSON.parse(readFileSync(path, "utf8")); } catch { return null; } }

// ------------------------------------------------------------------ the plan from the identity files
function planUnits(aliases) {
  const keep = (p) => !Object.hasOwn(aliases, p);
  const base = BASE_PROFILES.filter(keep), factors = FACTOR_PROFILES.filter(keep);
  const tiers = [["A", base, SEEDS[0], true, true], ["B", base, SEEDS[1], true, false], ["C", factors, SEEDS[0], false, false], ["D", factors, SEEDS[1], false, false]];
  const units = [];
  for (const [tier, profiles, seed, pairs, endless] of tiers) for (const difficulty of DIFFICULTIES) for (const region of REGIONS)
    for (const roster of ROSTERS) for (const profile of profiles)
      units.push({ key: ["coverage", region, difficulty, roster, profile, seed, 10, 0].join("|"), tier, region, difficulty, roster, profile, seed, pairs, endless });
  return units;
}
function planFor(identities, done) {
  const id0 = identities[0];
  const aliases = id0?.aliases ?? DEFAULT_ALIASES;
  if (!id0) return { units: null, aliases, tiers: null, note: "sem identity-N.json: plano por tier desconhecido" };
  const all = planUnits(aliases), shards = id0.identity?.shards ?? identities.length;
  if (isNum(id0.totalUnits) && all.length !== id0.totalUnits) return { units: null, aliases, tiers: null, note: `plano reconstruído (${all.length}) ≠ totalUnits (${id0.totalUnits})` };
  // HUMAN_TIERS may have narrowed the run: find the tier subset whose per-shard counts match `planned`;
  // equal-sized tiers (A and B) are told apart by the done units, then by the larger subset, then A first.
  let best = null;
  for (let mask = 1; mask <= 15; mask++) {
    const subset = TIERS.filter((_, i) => mask & (1 << i));
    const ok = identities.every((d) => !isNum(d.planned) || all.filter((u, i) => i % shards === d.identity?.shard && subset.includes(u.tier)).length === d.planned);
    if (!ok) continue;
    const score = [count(all, (u) => subset.includes(u.tier) && done.has(u.key)), subset.length];
    if (!best || score[0] > best.score[0] || (score[0] === best.score[0] && score[1] > best.score[1])) best = { subset, score };
  }
  if (!best) return { units: null, aliases, tiers: null, note: "planned por shard não confere com o plano reconstruído" };
  const units = all.map((u, i) => ({ ...u, shard: i % shards })).filter((u) => best.subset.includes(u.tier));
  return { units, aliases, tiers: best.subset, shards, note: best.subset.length < 4 ? `execução restrita aos tiers ${best.subset.join("+")} (HUMAN_TIERS)` : null };
}

// ------------------------------------------------------------------ pass 1: line heads, last attempt per unit
/** A fresh copy: a regex capture is a V8 sliced string that would keep its whole 100–200 KB line alive. */
const own = (s) => JSON.parse(JSON.stringify(s));
function headOf(line) {
  const head = line.slice(0, 1024);
  const unit = /"unit":"([^"]*)"/.exec(head)?.[1], cohort = /"cohort":"([^"]*)"/.exec(head)?.[1];
  const extra = /"worldsExtra":(-?\d+(?:\.\d+)?)/.exec(head)?.[1];
  return unit && cohort && extra !== undefined ? { unit: own(unit), cohort: own(cohort), worldsExtra: Number(extra) } : null;
}
/**
 * readline's 'line' event with a synchronous handler: each chunk's lines are handled as they are split, so
 * memory stays at one chunk + one line (the async iterator would queue up to 1024 lines of 100–200 KB).
 * The handler returns false to stop early.
 */
function eachLine(path, onLine) {
  return new Promise((resolvePromise, reject) => {
    const stream = createReadStream(path);
    const rl = createInterface({ input: stream, crlfDelay: Infinity });
    let lineNo = -1, stopped = false, failure = null;
    const stop = () => { stopped = true; rl.close(); stream.destroy(); };
    rl.on("line", (line) => {
      if (stopped) return;
      lineNo++;
      try { if (onLine(line, lineNo) === false) stop(); } catch (error) { failure = error; stop(); }
    });
    rl.on("close", () => (failure ? reject(failure) : resolvePromise()));
    stream.on("error", (error) => { failure = error; stop(); });
  });
}
async function indexShard(path, file) {
  const entries = [];
  let partial = 0;
  await eachLine(path, (line, lineNo) => {
    if (!line.trim()) return;
    let h = line.endsWith("}") ? headOf(line) : null;
    if (!h) {
      try { const r = JSON.parse(line); h = { unit: r.unit, cohort: r.cohort, worldsExtra: r.worldsExtra ?? 0 }; } catch { partial++; return; }
    }
    entries.push({ file, line: lineNo, ...h });
  });
  return { entries, partial };
}
function selectLines(entries, done) {
  const byUnit = new Map();
  for (const e of entries) { if (!byUnit.has(e.unit)) byUnit.set(e.unit, []); byUnit.get(e.unit).push(e); }
  const selected = [];
  let superseded = 0, pending = 0;
  for (const [unit, list] of byUnit) {
    if (!done.has(unit)) { pending += list.length; continue; }
    // A unit's attempt is written in one append that starts with its control (or error) line.
    let start = 0;
    list.forEach((e, i) => { if (e.cohort === "coverage" || e.cohort === "error") start = i; });
    superseded += start;
    const last = new Map();
    for (const e of list.slice(start)) { const k = e.cohort + "|" + e.worldsExtra; if (last.has(k)) superseded++; last.set(k, e); }
    selected.push(...last.values());
  }
  return { selected, superseded, pending, unitsWithLines: byUnit.size };
}
async function readSelected(path, wanted, onRecord) {
  if (!wanted.size) return;
  const maxLine = Math.max(...wanted.keys());
  await eachLine(path, (line, lineNo) => {
    const e = wanted.get(lineNo);
    if (e) {
      const r = JSON.parse(line);
      if (r.unit !== e.unit || r.cohort !== e.cohort || (r.worldsExtra ?? 0) !== e.worldsExtra) throw Error(`${path}: line ${lineNo + 1} changed between passes; rerun the report`);
      onRecord(r);
    }
    return lineNo < maxLine;
  });
}

// ------------------------------------------------------------------ per-record summaries (compact, no raw data kept)
function milestoneOf(r, key, checks) {
  const m = r.milestones?.[key];
  if (m && isNum(m.season)) {
    const split = isNum(m.week) ? splitOfWeek(m.week) : null;
    return { season: m.season, abs: split === null ? null : (m.season - 1) * 3 + split, precision: split === null ? "season" : "day" };
  }
  const arcKey = { major: "firstMajorSeason", worlds: "firstWorldsSeason", "title:worlds": "worldsTitleSeason" }[key];
  if (arcKey && isNum(r.arc?.[arcKey])) { checks.milestoneFromArc++; return { season: r.arc[arcKey] + 1, abs: null, precision: "season" }; }
  return null;
}
function seasonRowOf(s, endSnaps, majorTitles, regionalSplits) {
  const season = s.seasonIndex + 1;
  const ledger = Boolean(s.income && s.spend);
  const i = s.income ?? {}, o = s.spend ?? {};
  const payroll = ledger ? (o.payroll ?? 0) + (o.salary ?? 0) + (o.coachSalary ?? 0) : null;
  const netPrize = ledger ? (i.prize ?? 0) - (o.playerShare ?? 0) : null;
  const netSponsor = ledger ? sumOf(SPONSOR_KINDS.map((k) => i[k])) - (o.sponsorFine ?? 0) : null;
  const revenue = ledger ? netPrize + netSponsor : null;
  const snap = endSnaps.get(season);
  return {
    season, balanceEnd: s.balanceEnd ?? null, balanceMin: s.balanceMin ?? null,
    backer: typeof s.backerActive === "boolean" ? s.backerActive : null, bankLoans: s.bankLoans ?? null,
    mondaysNegative: s.mondaysNegative ?? null, worlds: s.worlds ?? null, starSignings: s.starSignings ?? null,
    complete: snap?.phase ? snap.phase === "seasonReview" : (s.regionRank ?? 0) > 0,
    payroll, revenue, netPrize, netSponsor, ratio: isNum(revenue) && revenue > 0 ? payroll / revenue : null,
    crisis: s.crisis ?? null, fee90: s.market?.byBand?.["90+"]?.feeP50 ?? null,
    dominant: s.worlds === "champion" || majorTitles.has(season), regionalSplits: regionalSplits.get(season)?.size ?? 0,
  };
}
function careerOf(r, checks) {
  const seasons = r.arc.seasons ?? [];
  const endSnaps = new Map((r.seasonSnapshots ?? []).filter((x) => x.moment === "end").map((x) => [x.season, x]));
  const events = r.events ?? [];
  const majorTitles = new Set(events.filter((e) => e.tier === "major" && e.placement === "champion").map((e) => e.season));
  const regionalSplits = new Map();
  for (const e of events) {
    if (e.tier !== "regional" || !isNum(e.season) || !isNum(e.week)) continue;
    if (!regionalSplits.has(e.season)) regionalSplits.set(e.season, new Set());
    regionalSplits.get(e.season).add(splitOfWeek(e.week));
  }
  const rows = seasons.map((s) => seasonRowOf(s, endSnaps, majorTitles, regionalSplits));
  rows.forEach((row, i) => { if (!row.complete && i < rows.length - 1) checks.incompleteBeforeLast++; });
  const ms = Object.fromEntries([...FUNNEL, ...EXTRA_MILESTONES].map((k) => [k, milestoneOf(r, k, checks)]));
  const f = r.finances;
  const fin = f ? {
    negativeDays: f.negativeDays ?? null, longestNegativeDays: f.longestNegativeDays ?? null, minimumBalance: f.minimumBalance ?? null,
    // null means "never below zero" only when the record shows no negative day; otherwise it stays unknown.
    minPayrollWeeks: isNum(f.minimumPayrollWeeks) ? f.minimumPayrollWeeks : f.negativeDays === 0 ? 0 : null,
    emergencyLoans: f.emergencyLoans ?? null, bankLoans: f.bankLoans ?? null, redWeeks: f.redWeeksBySeason ?? null,
  } : null;
  if (f && !isNum(f.minimumPayrollWeeks) && f.negativeDays > 0) checks.minPayrollWeeksUnknown++;
  const ended = r.arc.ended ?? null, last = seasons.at(-1);
  const snapCause = [...(r.seasonSnapshots ?? [])].reverse().find((x) => x.end?.moneyCause)?.end.moneyCause;
  return {
    unit: r.unit, tier: r.tier ?? null, cohort: r.cohort, region: r.region, difficulty: r.difficulty, roster: r.roster,
    profile: r.profile, seed: r.seed, horizon: r.seasons ?? 10, played: seasons.length, ended,
    softlock: r.arc.softlock ?? null, censored: ended === "softlock" || Boolean(r.arc.softlock),
    insolvent: ended === "insolvency", endSeason: last ? last.seasonIndex + 1 : null,
    moneyCause: ended === "insolvency" ? f?.end?.moneyCause ?? snapCause ?? "unrecorded" : null,
    ms, fin, rows, forkSeason: r.forkAt?.season ?? null,
    worldsTitleSeason: isNum(r.arc.worldsTitleSeason) ? r.arc.worldsTitleSeason + 1 : null,
  };
}
function pairOf(r) {
  const seasons = r.arc?.seasons ?? [];
  return {
    unit: r.unit, tier: r.tier ?? null, region: r.region, difficulty: r.difficulty, profile: r.profile, worldsExtra: r.worldsExtra,
    exposed: r.exposed === true, hasArc: Boolean(r.arc), forkSeason: r.forkAt?.season ?? null, spy: r.spyApplications ?? null,
    censored: Boolean(r.arc?.softlock) || r.arc?.ended === "softlock", insolvent: r.arc?.ended === "insolvency",
    worlds: seasons.map((s) => s.worlds ?? null), balance: seasons.map((s) => s.balanceEnd ?? null), played: seasons.length,
  };
}

// ------------------------------------------------------------------ global accumulators (sections 6–12)
function newGlobal() {
  return {
    market: {}, endgame: {}, endgameByDiff: {}, prize: {}, prizeMissing: 0,
    purchases: { "S1-10": { careers: 0, items: {} }, "S11-20": { careers: 0, items: {} } }, effects: {},
    chem: {}, renewals: {}, rep: { byTierPlacement: { "S1-10": {}, "S11-20": {} }, early: {}, later: {}, missing: 0 },
    briefings: { byStage: {}, byProfile: {}, missing: 0 }, fields: {}, scan: {},
  };
}
function field(G, name, present) { const f = (G.fields[name] ??= { present: 0, total: 0 }); f.total++; if (present) f.present++; }
/** Generic scan: a numeric/boolean field that is null or zero in every observation is reported, not trusted. */
const SCAN_SEASON = ["balanceEnd", "balanceMin", "mondaysNegative", "debtEnd", "backerActive", "bankLoans", "payrollPerSplit", "sponsorBasePerSplit",
  "weeklyNet", "regionRank", "seasonPoints", "majorsQualified", "worlds", "titles", "rep", "teamRating", "signings", "starSignings", "sales", "bootcamps"];
const SCAN_NESTED = [["crisis", ["creditOffers", "creditTaken", "creditPrincipal", "emergencyOffers", "emergencyAccepted", "emergencyFees"]],
  ["chemistry", ["percent"]], ["market", ["signable", "wageP50", "feeP50", "payrollPerSplit"]], ["training", ["summaries", "prompts", "scrimsWon", "unavailable"]]];
const SCAN_FINANCES = ["observedDays", "negativeDays", "longestNegativeDays", "emergencyLoans", "bankLoans", "minimumBalance", "minimumPayrollWeeks"];
function scan(G, name, v) {
  const f = (G.scan[name] ??= { n: 0, nulls: 0, zeros: 0 });
  f.n++;
  if (v === null || v === undefined) f.nulls++;
  else if (v === 0 || v === false) f.zeros++;
}
function feed(r, c, G, lo, hi) {
  const range = lo > 10 ? "S11-20" : "S1-10";
  const inRange = (season) => isNum(season) && season >= lo && season <= hi;
  for (const s of r.arc.seasons ?? []) {
    const season = s.seasonIndex + 1;
    if (!inRange(season)) continue;
    const row = c.rows.find((x) => x.season === season);
    field(G, "season.market", s.market !== undefined); field(G, "season.chemistry", Boolean(s.chemistry));
    field(G, "season.crisis", Boolean(s.crisis)); field(G, "season.series", Boolean(s.series));
    for (const k of SCAN_SEASON) scan(G, "season." + k, s[k]);
    for (const [obj, keys] of SCAN_NESTED) if (s[obj]) for (const k of keys) scan(G, `season.${obj}.${k}`, s[obj][k]);
    const M = (G.market[season] ??= { seasons: 0, absent: 0, visits: 0, signable: [], wageP50: [], wageP90: [], feeP50: [], band: {}, payroll: [], payrollToWage: [] });
    M.seasons++;
    if (s.market === undefined) M.absent++;
    else if (s.market) {
      const m = s.market;
      M.visits++; M.signable.push(m.signable); M.wageP50.push(m.wageP50); M.wageP90.push(m.wageP90); M.feeP50.push(m.feeP50); M.payroll.push(m.payrollPerSplit);
      if (isNum(m.wageP50) && m.wageP50 > 0 && isNum(m.payrollPerSplit)) M.payrollToWage.push(m.payrollPerSplit / m.wageP50);
      for (const [band, v] of Object.entries(m.byBand ?? {})) {
        const B = (M.band[band] ??= { n: [], wage: [], fee: [] });
        B.n.push(v.n); B.wage.push(v.wageP50); B.fee.push(v.feeP50);
      }
    }
    const C = (G.chem[range] ??= { seasons: 0, absent: 0, byMix: {}, byTenure: {}, tenure2: { n: 0, le67: 0, at67: 0, byMix: {} }, tiers: {} });
    C.seasons++;
    const ch = s.chemistry;
    if (!ch || !isNum(ch.percent)) C.absent++;
    else {
      const h = ch.heritage ?? {};
      const mix = `c${h.country ?? 0}-r${h.region ?? 0}-n${h.none ?? 0}`;
      const minT = ch.pairTenure?.length ? Math.min(...ch.pairTenure) : null;
      push(C.byMix, mix, ch.percent); inc(C.tiers, ch.tier ?? "?");
      push(C.byTenure, minT === null ? "?" : bucketOf(TENURE_BUCKETS, minT - 1e-9), ch.percent);
      if (minT !== null && minT >= 2) {
        C.tenure2.n++; if (ch.percent <= 67) C.tenure2.le67++; if (ch.percent === 67) C.tenure2.at67++;
        push(C.tenure2.byMix, mix, ch.percent);
      }
    }
    if (season >= 6 && row) {
      const E = (G.endgame[season] ??= { complete: 0, partial: 0, payroll: [], revenue: [], ratio: [], netPrize: [], netSponsor: [] });
      if (!row.complete || row.payroll === null) E.partial++;
      else {
        E.complete++; E.payroll.push(row.payroll); E.revenue.push(row.revenue); E.ratio.push(row.ratio); E.netPrize.push(row.netPrize); E.netSponsor.push(row.netSponsor);
        const D = (G.endgameByDiff[`${r.difficulty}|${season > 10 ? "S11-20" : "S6-10"}`] ??= { payroll: [], revenue: [], ratio: [] });
        D.payroll.push(row.payroll); D.revenue.push(row.revenue); D.ratio.push(row.ratio);
      }
    }
  }
  for (const e of r.events ?? []) {
    if (!inRange(e.season)) continue;
    field(G, "event.prize", isNum(e.prize)); field(G, "event.repDelta", isNum(e.repDelta)); field(G, "event.swissLosses", isNum(e.swissLosses));
    if (isNum(e.prize)) {
      const P = (G.prize[`${e.tier}|${e.placement}|${bucketOf(PRIZE_BUCKETS, e.season)}`] ??= { prize: [], share: [] });
      P.prize.push(e.prize); if (isNum(e.playerShare)) P.share.push(e.playerShare);
    } else G.prizeMissing++;
    if (!isNum(e.repDelta)) { G.rep.missing++; continue; }
    const T = (G.rep.byTierPlacement[range][`${e.tier}|${e.placement}`] ??= { delta: [], before: [] });
    T.delta.push(e.repDelta); T.before.push(isNum(e.repBefore) ? e.repBefore : NaN);
    if (e.tier === "regional" && range === "S1-10") {
      const R = ((e.season <= 3 ? G.rep.early : G.rep.later)[`${e.swissWins}-${e.swissLosses ?? "?"}`] ??= { rep: [], before: [], prize: [], placements: {} });
      R.rep.push(e.repDelta); R.before.push(e.repBefore); R.prize.push(e.prize); inc(R.placements, e.placement);
    }
  }
  const PU = G.purchases[range];
  PU.careers++;
  const bought = new Set();
  for (const a of r.actions ?? []) {
    if (!inRange(a.season)) continue;
    const item = a.kind === "gear" ? a.item : PURCHASE_KINDS.includes(a.kind) ? a.kind : null;
    if (item) {
      const P = (PU.items[item] ??= { careers: 0, buys: 0, spend: 0, cash: [], weekly: [], rating: [], trainingBonus: [], fullDayGain: [] });
      P.buys++; if (isNum(a.cashDelta) && a.cashDelta < 0) P.spend += -a.cashDelta;
      P.cash.push(isNum(a.cashDelta) ? -a.cashDelta : null); P.weekly.push(a.weeklyCostDelta);
      P.rating.push(a.effect?.rating); P.trainingBonus.push(a.effect?.trainingBonus); P.fullDayGain.push(a.effect?.fullDayGain);
      bought.add(item);
    }
    if (a.kind === "renewal") {
      const R = (G.renewals[range] ??= { actions: 0, missing: 0, rows: [] });
      R.actions++;
      const x = a.renewal;
      field(G, "action.renewal.terms", Boolean(x));
      if (!x || !isNum(x.newWage) || !isNum(x.freshAsk) || x.freshAsk <= 0) R.missing++;
      else R.rows.push([x.newWage / x.freshAsk, x.renewalCount ?? null, x.bound ?? null, isNum(x.oldWage) && x.oldWage > 0 ? x.newWage / x.oldWage : null]);
    }
    if (a.kind === "briefing" && range === "S1-10") {
      const b = a.briefing;
      field(G, "action.briefing.coached", typeof b?.coached === "boolean");
      if (!b) { G.briefings.missing++; continue; }
      const coach = typeof b.coached === "boolean" ? (b.coached ? "com coach" : "sem coach") : "?";
      const B = (G.briefings.byStage[`${b.stage ?? "?"}|${b.tier ?? "?"}|${coach}`] ??= { n: 0, playing: 0, mismatch: 0, requested: {}, effective: {}, edges: {} });
      B.n++; if (b.playing) B.playing++;
      if (b.coached && b.effective !== (b.requested ?? a.item)) B.mismatch++;
      inc(B.requested, b.requested ?? a.item); inc(B.effective, b.effective ?? "null");
      const edge = (B.edges[b.requested ?? a.item] ??= { n: 0 });
      edge.n++;
      for (const k of ["swiss", "playoffs", "quarters", "semis", "other", "final"]) if (isNum(b[k])) inc(edge, k, b[k]);
      const P = (G.briefings.byProfile[r.profile] ??= { n: 0, requested: {}, effective: {} });
      P.n++; inc(P.requested, b.requested ?? a.item); inc(P.effective, b.effective ?? "null");
    }
  }
  for (const item of bought) PU.items[item].careers++;
  for (const x of r.activeEffects ?? []) {
    if (!inRange(x.season)) continue;
    const E = ((G.effects[x.item] ??= {})[bucketOf(EFFECT_BUCKETS, x.season)] ??= { samples: 0, rating: 0, fullDayGain: 0, paidDayGain: 0, statsSamples: 0, stats: {} });
    E.samples += x.samples ?? 0; E.rating += x.rating ?? 0; E.fullDayGain += x.fullDayGain ?? 0; E.paidDayGain += x.paidDayGain ?? 0;
    if (x.stats) { E.statsSamples += x.samples ?? 0; for (const [k, v] of Object.entries(x.stats)) inc(E.stats, k, v); }
  }
}

// ------------------------------------------------------------------ group blocks (cells, profiles, difficulties)
function funnelOf(careers, horizon = 10) {
  const n = careers.length;
  return Object.fromEntries(FUNNEL.map((key) => {
    const ms = careers.map((c) => c.ms[key]).filter((m) => m && m.season <= horizon);
    const seasons = ms.map((m) => m.season);
    return [key, {
      reached: ms.length, n, share: share(ms.length, n), notReached: n - ms.length,
      season: dist(seasons), split: dist(ms.map((m) => m.abs)),
      bySeason: Object.fromEntries(CHECK_SEASONS.map((x) => ["S" + x, share(count(seasons, (s) => s <= x), n)])),
      unconditional: uncond(seasons, n, horizon), seasonPrecisionOnly: count(ms, (m) => m.precision === "season"),
    }];
  }));
}
const titleSeasonOf = (c, keys) => Math.min(...keys.map((k) => c.ms[k]?.season ?? Infinity));
function earlyOf(careers) {
  const n = careers.length;
  const reg = careers.map((c) => c.ms.regional);
  const rowsOf = (s) => careers.map((c) => c.rows.find((r) => r.season === s)).filter(Boolean);
  const s3 = rowsOf(3);
  return {
    regionalBySplit: Object.fromEntries([1, 2, 3, 4, 5, 6].map((k) => ["split" + k, share(count(reg, (m) => m && isNum(m.abs) && m.abs <= k), n)])),
    regionalBySplit2: share(count(reg, (m) => m && isNum(m.abs) && m.abs <= 2), n),
    anyTitleByS2: share(count(careers, (c) => titleSeasonOf(c, ANY_TITLE) <= 2), n),
    regionalTitleByS2: share(count(careers, (c) => titleSeasonOf(c, REGIONAL_PLUS_TITLE) <= 2), n),
    regionalPresenceBySeason: Object.fromEntries(Array.from({ length: 10 }, (_, i) => i + 1).map((s) => ["S" + s, meanOf(rowsOf(s).map((r) => r.regionalSplits))])),
    s3MeanSplits: meanOf(s3.map((r) => r.regionalSplits)), s3AllSplits: share(count(s3, (r) => r.regionalSplits === 3), s3.length),
  };
}
function windowFlag(p50, [lo, hi]) {
  if (p50 === null) return "sem dados";
  if (typeof p50 === "string") return ">S10";
  return p50 < lo ? "cedo" : p50 > hi ? "tarde" : "ok";
}
function flagsOf(b) {
  const ins = b.failures.share;
  return {
    early: b.early.regionalTitleByS2 === null ? "sem dados" : b.early.regionalTitleByS2 > TARGETS.early.maxRegionalTitleByS2 ? "muitos" : "ok",
    regional: b.early.regionalBySplit2 === null ? "sem dados" : b.early.regionalBySplit2 >= TARGETS.regional.maxShareBySplit2 ? "cedo" : "ok",
    s3: b.early.s3MeanSplits === null ? "sem dados" : b.early.s3MeanSplits >= TARGETS.s3.minMeanSplits ? "ok" : "baixa",
    major: windowFlag(b.funnel.major.unconditional.p50, TARGETS.major.window),
    worlds: windowFlag(b.funnel.worlds.unconditional.p50, TARGETS.worlds.window),
    title: windowFlag(b.funnel["title:worlds"].unconditional.p50, TARGETS["title:worlds"].window),
    insolvency: ins === null ? "sem dados" : ins === 0 ? "nenhuma" : ins > TARGETS.insolvency.max ? "alta" : "ok",
  };
}
function failuresOf(careers) {
  const n = careers.length, insolvent = careers.filter((c) => c.insolvent);
  const causes = {}, bySeason = {}, otherEnds = {};
  for (const c of insolvent) { inc(causes, c.moneyCause ?? "unrecorded"); inc(bySeason, "S" + c.endSeason); }
  for (const c of careers) if (c.ended && c.ended !== "insolvency" && c.ended !== "softlock") inc(otherEnds, c.ended);
  return {
    insolvencies: insolvent.length, share: share(insolvent.length, n), causes, season: dist(insolvent.map((c) => c.endSeason)), bySeason, otherEnds,
    neverReached: Object.fromEntries(FUNNEL.map((k) => [k, share(count(careers, (c) => !(c.ms[k] && c.ms[k].season <= 10)), n)])),
  };
}
const seasonsSum = (c, f) => { const v = c.rows.filter((r) => r.season <= 10).map(f); return v.some(isNum) ? sumOf(v) : null; };
function financesOf(careers) {
  const det = careers.filter((c) => c.fin);
  const mpw = det.map((c) => c.fin.minPayrollWeeks).filter(isNum);
  const ever = det.filter((c) => c.fin.negativeDays > 0 || (isNum(c.fin.minimumBalance) && c.fin.minimumBalance < 0));
  const recovered = ever.filter((c) => !c.insolvent && c.played >= 10 && (c.rows.find((r) => r.season === 10)?.balanceEnd ?? -1) >= 0);
  const crisis = (k) => careers.map((c) => seasonsSum(c, (r) => r.crisis?.[k]));
  const withCrisis = careers.filter((c) => c.rows.some((r) => r.crisis));
  const backerRows = careers.flatMap((c) => c.rows.filter((r) => r.season <= 10 && r.backer !== null));
  return {
    careers: careers.length, detailed: det.length,
    negativeDays: dist(det.map((c) => c.fin.negativeDays)), longestNegativeDays: dist(det.map((c) => c.fin.longestNegativeDays)),
    everNegative: share(ever.length, det.length), recoveredAmongNegative: share(recovered.length, ever.length),
    minimumBalance: dist(det.map((c) => c.fin.minimumBalance)),
    minPayrollWeeks: dist(mpw), crossedMinus4: share(count(mpw, (w) => w <= -4), mpw.length), crossedMinus8: share(count(mpw, (w) => w <= -8), mpw.length),
    negativeMondays: dist(careers.map((c) => seasonsSum(c, (r) => r.mondaysNegative))),
    bankLoans: dist(det.map((c) => c.fin.bankLoans)), bankLoanCareers: share(count(det, (c) => c.fin.bankLoans > 0), det.length),
    botBankLoans: dist(careers.map((c) => seasonsSum(c, (r) => r.bankLoans))),
    backerCareers: share(count(det, (c) => c.fin.emergencyLoans > 0 || Boolean(c.ms.emergencyLoan)), det.length),
    backerSeasonEndShare: share(count(backerRows, (r) => r.backer), backerRows.length),
    credit: { careersObserved: withCrisis.length, offers: dist(crisis("creditOffers")), taken: dist(crisis("creditTaken")),
      takenCareers: share(count(withCrisis, (c) => seasonsSum(c, (r) => r.crisis?.creditTaken) > 0), withCrisis.length), principal: dist(crisis("creditPrincipal")) },
    emergency: { offers: dist(crisis("emergencyOffers")), accepted: dist(crisis("emergencyAccepted")),
      acceptedCareers: share(count(withCrisis, (c) => seasonsSum(c, (r) => r.crisis?.emergencyAccepted) > 0), withCrisis.length), fees: dist(crisis("emergencyFees")) },
  };
}
function cashOf(careers) {
  const at = (s) => careers.map((c) => c.rows.find((r) => r.season === s)?.balanceEnd);
  const dom = careers.flatMap((c) => c.rows.filter((r) => r.season <= 10 && r.dominant));
  const withFee = dom.filter((r) => isNum(r.fee90) && isNum(r.balanceEnd));
  return {
    S1: dist(at(1)), S2: dist(at(2)), S3: dist(at(3)), S10: dist(at(10)),
    dominantSeasons: { n: dom.length, balance: dist(dom.map((r) => r.balanceEnd)), withMarketFee: withFee.length,
      affordStar90Fee: share(count(withFee, (r) => r.balanceEnd >= r.fee90), withFee.length) },
    starSigningS6to10: share(count(careers, (c) => c.rows.some((r) => r.season >= 6 && r.season <= 10 && r.starSignings > 0)), careers.length),
  };
}
function lateOf(careers) {
  const rows = careers.flatMap((c) => c.rows.filter((r) => r.season >= 6 && r.season <= 10));
  const ok = rows.filter((r) => r.complete && r.payroll !== null);
  const withRatio = ok.filter((r) => isNum(r.ratio));
  return {
    basis: "S6–S10 completas; folha = payroll + salary + coachSalary; receita = prêmio − playerShare + patrocínio − multas",
    complete: ok.length, partialExcluded: rows.length - ok.length, nonPositiveRevenue: count(ok, (r) => !(r.revenue > 0)),
    payroll: dist(ok.map((r) => r.payroll)), revenue: dist(ok.map((r) => r.revenue)), ratio: dist(withRatio.map((r) => r.ratio)),
    ratioAbove1: share(count(withRatio, (r) => r.ratio > 1), withRatio.length),
  };
}
function groupBlock(list) {
  const careers = list.filter((c) => !c.censored);
  const b = {
    n: careers.length, censored: list.length - careers.length, tiers: uniq(list.map((c) => c.tier)), seeds: uniq(list.map((c) => c.seed)),
    funnel: funnelOf(careers), early: earlyOf(careers), failures: failuresOf(careers), finances: financesOf(careers),
    cash: cashOf(careers), late: lateOf(careers),
  };
  b.flags = flagsOf(b);
  return b;
}
function groupBy(list, keyOf) {
  const m = new Map();
  for (const x of list) { const k = keyOf(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); }
  return m;
}

// ------------------------------------------------------------------ sections 6–13
function endgameSection(G) {
  const bySeason = Object.keys(G.endgame).map(Number).sort((a, b) => a - b).map((season) => {
    const E = G.endgame[season];
    return { season, complete: E.complete, partialExcluded: E.partial, payroll: dist(E.payroll), revenue: dist(E.revenue),
      netPrize: dist(E.netPrize), netSponsor: dist(E.netSponsor), ratio: dist(E.ratio), ratioAbove1: share(count(E.ratio, (x) => isNum(x) && x > 1), count(E.ratio, isNum)) };
  });
  const byDifficulty = Object.entries(G.endgameByDiff).map(([k, D]) => {
    const [difficulty, range] = k.split("|");
    return { difficulty, range, seasons: D.payroll.length, payroll: dist(D.payroll), revenue: dist(D.revenue), ratio: dist(D.ratio),
      ratioAbove1: share(count(D.ratio, (x) => isNum(x) && x > 1), count(D.ratio, isNum)) };
  }).sort((a, b) => a.range.localeCompare(b.range) || DIFFICULTIES.indexOf(a.difficulty) - DIFFICULTIES.indexOf(b.difficulty));
  const market = Object.keys(G.market).map(Number).sort((a, b) => a - b).map((season) => {
    const M = G.market[season];
    return { season, seasons: M.seasons, absent: M.absent, visits: M.visits, signable: dist(M.signable), wageP50: dist(M.wageP50), wageP90: dist(M.wageP90),
      feeP50: dist(M.feeP50), ownPayrollPerSplit: dist(M.payroll), ownPayrollToMarketWageP50: dist(M.payrollToWage),
      byBand: Object.fromEntries(Object.entries(M.band).map(([band, B]) => [band, { listed: dist(B.n), wageP50: dist(B.wage), feeP50: dist(B.fee) }])) };
  });
  const prize = Object.entries(G.prize).map(([k, P]) => {
    const [tier, placement, bucket] = k.split("|");
    return { tier, placement, bucket, prize: dist(P.prize), playerShare: dist(P.share) };
  }).sort((a, b) => a.tier.localeCompare(b.tier) || PLACE_ORDER.indexOf(a.placement) - PLACE_ORDER.indexOf(b.placement)
    || PRIZE_BUCKETS.findIndex(([x]) => x === a.bucket) - PRIZE_BUCKETS.findIndex(([x]) => x === b.bucket));
  return { bySeason, byDifficulty, market, prizePerEvent: prize, eventsWithoutPrize: G.prizeMissing };
}
function purchasesSection(G) {
  const out = {};
  for (const [range, PU] of Object.entries(G.purchases)) {
    out[range] = { careers: PU.careers, items: Object.fromEntries(Object.entries(PU.items).sort().map(([item, P]) => [item, {
      careers: P.careers, careerShare: share(P.careers, PU.careers), purchases: P.buys, spend: P.spend, cashPerPurchase: dist(P.cash),
      weeklyCostDelta: dist(P.weekly), instantRatingDelta: dist(P.rating), trainingBonusDelta: dist(P.trainingBonus), fullDayGainDelta: dist(P.fullDayGain),
    }])) };
  }
  const summarize = (E) => ({ samples: E.samples, meanRating: E.samples ? r4(E.rating / E.samples) : null, meanFullDayGain: E.samples ? r4(E.fullDayGain / E.samples) : null,
    meanPaidDayGain: E.samples ? r4(E.paidDayGain / E.samples) : null,
    meanStats: E.statsSamples ? Object.fromEntries(Object.entries(E.stats).map(([k, v]) => [k, r4(v / E.statsSamples)])) : null });
  const effects = Object.fromEntries(Object.entries(G.effects).sort().map(([item, buckets]) => {
    const early = EFFECT_BUCKETS.slice(0, 3).map(([b]) => buckets[b]).filter(Boolean);
    const pooled = { samples: sumOf(early.map((E) => E.samples)), rating: sumOf(early.map((E) => E.rating)), fullDayGain: sumOf(early.map((E) => E.fullDayGain)),
      paidDayGain: sumOf(early.map((E) => E.paidDayGain)), statsSamples: sumOf(early.map((E) => E.statsSamples)), stats: {} };
    for (const E of early) for (const [k, v] of Object.entries(E.stats)) inc(pooled.stats, k, v);
    return [item, { ...Object.fromEntries(EFFECT_BUCKETS.filter(([b]) => buckets[b]).map(([b]) => [b, summarize(buckets[b])])), "S1–10": summarize(pooled) }];
  }));
  return { ...out, marginalAfterCaps: effects,
    basis: "Compras = ações aceitas (S1–S10 controles; S11–S20 extensão). Marginal após caps = activeEffects (amostra semanal com plano ativo; contrafactual local, não causal)." };
}
function ratioBlock(rows) {
  const ratios = rows.map((r) => r[0]);
  return { n: rows.length, ratio: dist(ratios), vsOldWage: dist(rows.map((r) => r[3])),
    atMost10pctOfMarket: share(count(ratios, (x) => x <= 0.1), ratios.length), atMost25pctOfMarket: share(count(ratios, (x) => x <= 0.25), ratios.length),
    discountAtLeast10pct: share(count(ratios, (x) => x < 0.9), ratios.length), discountAtLeast25pct: share(count(ratios, (x) => x < 0.75), ratios.length) };
}
function renewalsSection(G) {
  return Object.fromEntries(Object.entries(G.renewals).map(([range, R]) => {
    const byCount = groupBy(R.rows, (r) => (r[1] === null ? "?" : r[1] >= 3 ? "3+" : String(r[1])));
    const byBound = groupBy(R.rows, (r) => r[2] ?? "?");
    return [range, { actions: R.actions, withoutTerms: R.missing, all: ratioBlock(R.rows),
      byRenewalCount: Object.fromEntries([...byCount].sort().map(([k, rows]) => [k, ratioBlock(rows)])),
      byBound: Object.fromEntries([...byBound].sort().map(([k, rows]) => [k, ratioBlock(rows)])) }];
  }));
}
function chemistrySection(G) {
  const block = (values) => ({ ...dist(values), atMost67: share(count(values, (x) => x <= 67), values.length), at67: share(count(values, (x) => x === 67), values.length) });
  return Object.fromEntries(Object.entries(G.chem).map(([range, C]) => [range, {
    seasons: C.seasons, absent: C.absent, tiers: C.tiers,
    byHeritageMix: Object.fromEntries(Object.entries(C.byMix).sort().map(([k, v]) => [k, block(v)])),
    byMinPairTenure: Object.fromEntries(TENURE_BUCKETS.map(([k]) => k).concat("?").filter((k) => C.byTenure[k]).map((k) => [k, block(C.byTenure[k])])),
    tenureAtLeast2: { seasons: C.tenure2.n, atMost67: share(C.tenure2.le67, C.tenure2.n), at67: share(C.tenure2.at67, C.tenure2.n),
      byHeritageMix: Object.fromEntries(Object.entries(C.tenure2.byMix).sort().map(([k, v]) => [k, block(v)])) },
  }]));
}
function reputationSection(G) {
  const repBlock = (v) => ({ ...dist(v), zero: share(count(v, (x) => x === 0), v.length), positive: share(count(v, (x) => x > 0), v.length) });
  const byTP = Object.fromEntries(Object.entries(G.rep.byTierPlacement).map(([range, m]) => [range, Object.entries(m).map(([k, v]) => {
    const [tier, placement] = k.split("|");
    const room = v.delta.filter((_, i) => v.before[i] < REP_HEADROOM);
    return { tier, placement, ...repBlock(v.delta), repBefore: dist(v.before),
      atCeiling: share(count(v.before, (x) => x >= REP_CEILING), v.delta.length), withHeadroom: { n: room.length, mean: meanOf(room), zero: share(count(room, (x) => x === 0), room.length) } };
  }).sort((a, b) => a.tier.localeCompare(b.tier) || PLACE_ORDER.indexOf(a.placement) - PLACE_ORDER.indexOf(b.placement))]));
  // A better placement in the same tier paying less reputation on average, among events with headroom below
  // the ceiling (rep before < REP_HEADROOM, n ≥ MIN_N_COMPARE each side): the ceiling alone explains the rest.
  const placementFindings = [];
  let ceilingExplained = 0;
  for (const a of byTP["S1-10"] ?? []) for (const b of byTP["S1-10"] ?? []) {
    if (a.tier !== b.tier || PLACE_RANK[a.placement] >= PLACE_RANK[b.placement]) continue;
    if (a.n >= MIN_N_COMPARE && b.n >= MIN_N_COMPARE && a.mean < b.mean - REP_MIN_GAP) ceilingExplained++;
    const x = a.withHeadroom, y = b.withHeadroom;
    if (x.n >= MIN_N_COMPARE && y.n >= MIN_N_COMPARE && x.mean < y.mean - REP_MIN_GAP) placementFindings.push(`${a.tier}: ${a.placement} (n=${x.n}) média ${x.mean} < ${b.placement} (n=${y.n}) média ${y.mean}`);
  }
  ceilingExplained -= placementFindings.length;
  const worldsEvents = Object.entries(G.rep.byTierPlacement["S1-10"]).filter(([k]) => k.startsWith("worlds|")).flatMap(([, v]) => v.delta);
  const swiss = (m) => Object.entries(m).map(([wl, R]) => {
    const [w, l] = wl.split("-").map(Number);
    return { record: wl, wins: w, losses: l, ...repBlock(R.rep), repBefore: dist(R.before), prize: dist(R.prize), placements: R.placements };
  }).sort((a, b) => b.wins - a.wins || a.losses - b.losses);
  const early = swiss(G.rep.early), later = swiss(G.rep.later);
  const findings = [];
  for (const a of early) for (const b of early) {
    if (a.wins > b.wins && a.losses <= b.losses && a.n >= MIN_N_COMPARE && b.n >= MIN_N_COMPARE && a.mean < b.mean)
      findings.push(`${a.record} (n=${a.n}) rende rep média ${a.mean} < ${b.record} (n=${b.n}) média ${b.mean}`);
  }
  const good = early.filter((r) => r.wins >= 3), poor = early.filter((r) => r.wins <= 1);
  const pooled = (rows, f) => { const n = sumOf(rows.map((r) => r.n)); return n ? r4(sumOf(rows.map((r) => f(r) * r.n)) / n) : null; };
  return { byTierPlacement: byTP, regionalS1toS3BySwiss: early, regionalS4toS10BySwiss: later, eventsWithoutRep: G.rep.missing,
    inconsistencies: { goodSwissZeroRep: pooled(good, (r) => r.zero), goodSwissN: sumOf(good.map((r) => r.n)),
      poorSwissPositiveRep: pooled(poor, (r) => r.positive), poorSwissN: sumOf(poor.map((r) => r.n)), monotonicity: findings,
      placementVsRep: placementFindings, placementVsRepOnlyAtCeiling: Math.max(0, ceilingExplained),
      negativeAtWorlds: share(count(worldsEvents, (x) => x < 0), worldsEvents.length) } };
}
function oneFactorSection(careers, factorsPlayed) {
  const key = (c) => [c.region, c.difficulty, c.roster, c.seed].join("|");
  const ctrl = new Map(careers.filter((c) => c.profile === CONTROL && !c.censored).map((c) => [key(c), c]));
  const keys = ["playoffs", "major", "title:major", "worlds", "title:worlds"];
  const reach = (c, k) => Boolean(c.ms[k] && c.ms[k].season <= 10);
  return factorsPlayed.map((profile) => {
    const list = careers.filter((c) => c.profile === profile && !c.censored);
    const matched = list.map((c) => [c, ctrl.get(key(c))]).filter(([, k]) => k);
    const m = matched.length;
    const reachOut = Object.fromEntries(keys.map((k) => {
      const f = count(matched, ([c]) => reach(c, k)), g = count(matched, ([, k2]) => reach(k2, k));
      return [k, { factor: share(f, m), control: share(g, m), delta: m ? r4((f - g) / m) : null }];
    }));
    const both = matched.filter(([c, k]) => c.ms.major && k.ms.major && c.ms.major.season <= 10 && k.ms.major.season <= 10);
    const cash = (c) => c.rows.find((r) => r.season === 10)?.balanceEnd;
    const titles = (c) => count(c.rows, (r) => r.worlds === "champion");
    return { profile, n: list.length, paired: m, reach: reachOut,
      insolvency: { factor: share(count(matched, ([c]) => c.insolvent), m), control: share(count(matched, ([, k]) => k.insolvent), m) },
      majorSeasonDelta: dist(both.map(([c, k]) => c.ms.major.season - k.ms.major.season)),
      cashS10Delta: dist(matched.map(([c, k]) => (isNum(cash(c)) && isNum(cash(k)) ? cash(c) - cash(k) : null))),
      worldsTitlesVsControl: { more: count(matched, ([c, k]) => titles(c) > titles(k)), same: count(matched, ([c, k]) => titles(c) === titles(k)), fewer: count(matched, ([c, k]) => titles(c) < titles(k)) } };
  });
}
function pairsSection(careers, pairs, checks) {
  const control = new Map(careers.map((c) => [c.unit, c]));
  const units = new Map();
  for (const p of pairs) { if (!units.has(p.unit)) units.set(p.unit, {}); units.get(p.unit)[String(p.worldsExtra)] = p; }
  const exposure = {};
  const arms = { control: [], "0.5": [], "1": [] };
  const paired = { "0.5": [], "1": [] };
  const postFork = (worlds, fork) => worlds.filter((w, i) => i + 1 >= fork && i < 10 && w !== null);
  for (const [unit, byX] of units) {
    const c = control.get(unit);
    const exposed = Object.values(byX).some((p) => p.exposed);
    for (const k of ["all", c?.difficulty ?? "?"]) { const E = (exposure[k] ??= { units: 0, exposed: 0 }); E.units++; if (exposed) E.exposed++; }
    if (!c || c.censored || !exposed) continue;
    const fork = c.forkSeason ?? Object.values(byX).find((p) => p.forkSeason)?.forkSeason ?? 1;
    if (c.rows.some((r) => r.season < fork && r.worlds !== null)) checks.worldsBeforeFork++;
    const ctl = { worlds: postFork(c.rows.map((r) => r.worlds), fork), cash: c.rows.find((r) => r.season === 10)?.balanceEnd ?? null, insolvent: c.insolvent };
    arms.control.push(ctl);
    for (const x of ["0.5", "1"]) {
      const p = byX[x];
      if (!p || !p.exposed || !p.hasArc) continue;
      if (p.spy === 0) checks.exposedWithoutSpy++;
      for (let i = 0; i < Math.min(fork - 1, p.balance.length, c.rows.length); i++) if (p.balance[i] !== c.rows[i].balanceEnd) { checks.pairPrefixMismatch.push(unit + " +" + x); break; }
      const arm = { worlds: postFork(p.worlds, fork), cash: p.played >= 10 ? p.balance[9] : null, insolvent: p.insolvent, spy: p.spy };
      arms[x].push(arm);
      const t = (a) => count(a.worlds, (w) => w === "champion");
      const rank = (a) => meanOf(a.worlds.map((w) => PLACE_RANK[w]));
      paired[x].push({ dTitles: t(arm) - t(ctl), dRank: isNum(rank(arm)) && isNum(rank(ctl)) ? rank(arm) - rank(ctl) : null,
        dCash: isNum(arm.cash) && isNum(ctl.cash) ? arm.cash - ctl.cash : null, ctlTitled: t(ctl) > 0, pairTitled: t(arm) > 0 });
    }
  }
  const armBlock = (list) => {
    const placements = {};
    for (const a of list) for (const w of a.worlds) inc(placements, w);
    return { units: list.length, worldsEntries: sumOf(list.map((a) => a.worlds.length)), titles: sumOf(list.map((a) => count(a.worlds, (w) => w === "champion"))),
      titledShare: share(count(list, (a) => a.worlds.includes("champion")), list.length), meanPlacementRank: meanOf(list.flatMap((a) => a.worlds.map((w) => PLACE_RANK[w]))),
      placements, cashS10: dist(list.map((a) => a.cash)), insolvencies: count(list, (a) => a.insolvent), spyApplications: dist(list.map((a) => a.spy)) };
  };
  return {
    exposure: Object.fromEntries(Object.entries(exposure).map(([k, E]) => [k, { ...E, share: share(E.exposed, E.units) }])),
    arms: Object.fromEntries(Object.entries(arms).map(([k, v]) => [k, armBlock(v)])),
    paired: Object.fromEntries(Object.entries(paired).map(([x, list]) => [x, { units: list.length, titlesDelta: dist(list.map((d) => d.dTitles)),
      moreTitles: count(list, (d) => d.dTitles > 0), sameTitles: count(list, (d) => d.dTitles === 0), fewerTitles: count(list, (d) => d.dTitles < 0),
      titledControl: share(count(list, (d) => d.ctlTitled), list.length), titledPair: share(count(list, (d) => d.pairTitled), list.length),
      placementRankDelta: dist(list.map((d) => d.dRank)), cashS10Delta: dist(list.map((d) => d.dCash)) }])),
    basis: "Pós-fork (manhã do 1º Worlds do controle) até S10; mesma seed e mesmo passado; Δ = par − controle; rank: champion 1 … swiss_exit 12",
  };
}
function postTitleSection(careers, endless, checks) {
  const control = new Map(careers.map((c) => [c.unit, c]));
  const eligible = careers.filter((c) => c.tier === "A" && !c.censored && !c.insolvent && c.played >= 10 && isNum(c.worldsTitleSeason) && c.worldsTitleSeason <= 10);
  const found = endless.filter((e) => control.has(e.unit));
  for (const e of found) {
    const c = control.get(e.unit);
    if (c.rows.some((r, i) => e.rows[i]?.balanceEnd !== r.balanceEnd)) checks.endlessPrefixMismatch.push(e.unit);
    if (!(isNum(c.worldsTitleSeason) && c.worldsTitleSeason <= 10)) checks.endlessWithoutTitle++;
  }
  const late = (e) => e.rows.filter((r) => r.season > 10);
  const negDelta = (e) => { const c = control.get(e.unit); return isNum(e.fin?.negativeDays) && isNum(c?.fin?.negativeDays) ? e.fin.negativeDays - c.fin.negativeDays : null; };
  const redLate = (e) => { const w = Object.entries(e.fin?.redWeeks ?? {}).filter(([s]) => Number(s) > 10).map(([, v]) => v); return w.length ? Math.min(...w) : e.fin?.redWeeks ? 0 : null; };
  const rows = found.flatMap(late).filter((r) => r.complete && isNum(r.ratio));
  return {
    eligibleControls: eligible.length, endlessRecords: found.length, eligibleWithoutEndless: count(eligible, (c) => !endless.some((e) => e.unit === c.unit)),
    seasonsAfterS10: dist(found.map((e) => late(e).length)), insolventAfterTitle: count(found, (e) => e.insolvent && e.endSeason > 10),
    softlocks: count(found, (e) => e.censored), worldsTitlesS11toS20: dist(found.map((e) => count(late(e), (r) => r.worlds === "champion"))),
    titledAgainShare: share(count(found, (e) => late(e).some((r) => r.worlds === "champion")), found.length),
    cashS20: dist(found.map((e) => e.rows.find((r) => r.season === 20)?.balanceEnd)), minBalanceS11toS20: dist(found.map((e) => Math.min(...late(e).map((r) => r.balanceMin).filter(isNum)))),
    negativeDaysS11toS20: dist(found.map(negDelta)), deepestRedWeeksS11toS20: dist(found.map(redLate)),
    crossedMinus8S11toS20: share(count(found, (e) => redLate(e) <= -8), count(found, (e) => isNum(redLate(e)))),
    ratioS11toS20: dist(rows.map((r) => r.ratio)),
  };
}
function briefingsSection(G, careers, factorRows) {
  const byStage = Object.entries(G.briefings.byStage).map(([k, B]) => {
    const [stage, tier, coach] = k.split("|");
    return { stage, tier, coach, n: B.n, playingShare: share(B.playing, B.n), requestedNotEffective: coach === "com coach" ? share(B.mismatch, B.n) : null,
      requested: B.requested, effective: B.effective,
      meanEdgeByRequested: Object.fromEntries(Object.entries(B.edges).map(([req, e]) => [req, Object.fromEntries(Object.entries(e).filter(([x]) => x !== "n").map(([x, v]) => [x, r4(v / e.n)]))])) };
  }).sort((a, b) => a.stage.localeCompare(b.stage) || a.tier.localeCompare(b.tier) || a.coach.localeCompare(b.coach));
  const cohorts = [CONTROL, ...FACTOR_PROFILES.filter((p) => p.startsWith("briefing-"))];
  const perCareer = (p) => { const n = count(careers, (c) => c.profile === p); return n ? r4((G.briefings.byProfile[p]?.n ?? 0) / n) : null; };
  return { byStage, actionsWithoutBriefing: G.briefings.missing,
    cohorts: cohorts.map((p) => ({ profile: p, careers: count(careers, (c) => c.profile === p), briefingsPerCareer: perCareer(p),
      requested: G.briefings.byProfile[p]?.requested ?? {}, effective: G.briefings.byProfile[p]?.effective ?? {} })),
    vsControl: factorRows.filter((r) => r.profile.startsWith("briefing-")) };
}
function baselineMetrics(cell) {
  const f = cell.funnel ?? {}, fin = cell.finances ?? {};
  return {
    reach: Object.fromEntries(FUNNEL.map((k) => [k, f[k] ? f[k].reached > 0 : null])),
    season: Object.fromEntries(FUNNEL.map((k) => [k, f[k]?.season?.p50 ?? null])),
    insolvent: isNum(fin.insolvencies) ? fin.insolvencies > 0 : null, negativeMondays: fin.negativeMondays ?? null, bankLoans: fin.bankLoans ?? null,
    cash: [1, 2, 3].map((s) => fin.earlyCash?.find((x) => x.season === s)?.cash?.p50 ?? null), finalCash: fin.cashP90 ?? null,
    lateRatio: fin.latePayrollToPrizeSponsor?.p50 ?? null, emergencyLoan: isNum(fin.careersWithEmergencyLoan) ? fin.careersWithEmergencyLoan > 0 : null,
  };
}
function newMetrics(c) {
  const late = c.rows.filter((r) => r.season >= 6 && r.season <= 10 && r.complete && isNum(r.ratio)).map((r) => r.ratio);
  return {
    reach: Object.fromEntries(FUNNEL.map((k) => [k, Boolean(c.ms[k] && c.ms[k].season <= 10)])),
    season: Object.fromEntries(FUNNEL.map((k) => [k, c.ms[k] && c.ms[k].season <= 10 ? c.ms[k].season : null])),
    insolvent: c.insolvent, negativeMondays: seasonsSum(c, (r) => r.mondaysNegative), bankLoans: seasonsSum(c, (r) => r.bankLoans),
    cash: [1, 2, 3].map((s) => c.rows.find((r) => r.season === s)?.balanceEnd ?? null), finalCash: c.rows.at(-1)?.balanceEnd ?? null,
    lateRatio: dist(late).p50, emergencyLoan: Boolean(c.ms.emergencyLoan),
  };
}
function compareBlock(matches) {
  const m = matches.length;
  const sh = (side, f) => share(count(matches, (x) => f(x[side]) === true), count(matches, (x) => f(x[side]) !== null));
  const reach = Object.fromEntries(FUNNEL.map((k) => {
    const b = sh("b", (x) => x.reach[k]), n = sh("n", (x) => x.reach[k]);
    const both = matches.filter((x) => isNum(x.b.season[k]) && isNum(x.n.season[k]));
    return [k, { baseline: b, now: n, delta: isNum(b) && isNum(n) ? r4(n - b) : null, seasonDeltaBothReached: dist(both.map((x) => x.n.season[k] - x.b.season[k])) }];
  }));
  const pair = (f) => ({ baseline: dist(matches.map((x) => f(x.b))), now: dist(matches.map((x) => f(x.n))) });
  return { matched: m, reach, insolvency: { baseline: sh("b", (x) => x.insolvent), now: sh("n", (x) => x.insolvent) },
    emergencyLoan: { baseline: sh("b", (x) => x.emergencyLoan), now: sh("n", (x) => x.emergencyLoan) },
    negativeMondays: pair((x) => x.negativeMondays), bankLoans: pair((x) => x.bankLoans), cashS1: pair((x) => x.cash[0]), cashS2: pair((x) => x.cash[1]),
    cashS3: pair((x) => x.cash[2]), finalCash: pair((x) => x.finalCash), lateRatio: pair((x) => x.lateRatio) };
}
function baselineIndex(doc) {
  const index = new Map();
  for (const cell of doc?.cells ?? []) {
    if (!BASELINE_PROFILES.includes(cell.profile) || cell.n !== 1 || (cell.horizon ?? 10) !== 10 || (cell.worldsExtra ?? 0) !== 0) continue;
    index.set([cell.region, cell.difficulty, cell.roster, cell.profile, cell.seeds?.[0]].join("|"), { cohort: cell.cohort, m: baselineMetrics(cell) });
  }
  return index;
}
function baselineSection(careers, doc, path) {
  if (!doc) return null;
  const index = baselineIndex(doc);
  const matches = [];
  for (const c of careers) {
    if (!BASELINE_PROFILES.includes(c.profile) || c.censored) continue;
    const b = index.get([c.region, c.difficulty, c.roster, c.profile, c.seed].join("|"));
    if (b) matches.push({ c, b: b.m, n: newMetrics(c), cohort: b.cohort });
  }
  const by = (f) => Object.fromEntries([...groupBy(matches, f)].sort().map(([k, v]) => [k, compareBlock(v)]));
  return { source: path, version: doc.identities?.[0]?.version ?? null, baselineCareers: index.size, overall: compareBlock(matches),
    byProfile: by((x) => x.c.profile), byDifficulty: by((x) => x.c.difficulty), byBaselineCohort: by((x) => x.cohort),
    note: "Pareado por região × dificuldade × elenco × perfil × seed (baseline coverage = seed 9100, holdout = 17019). Marcos de série da baseline têm precisão de temporada; dias negativos não existem nela (só segundas negativas)." };
}

// ------------------------------------------------------------------ CSV rows (one per region × difficulty × roster × profile)
const CSV_COLUMNS = ["region", "difficulty", "roster", "profile", "tiers", "n", "censored", "reach_firstSeries", "reach_regional", "reach_regional_by_split2",
  "reach_swissWin", "reach_playoffs", "reach_major", "reach_title_major", "reach_worlds", "reach_title_worlds", "season_regional_p50", "season_major_p50",
  "season_worlds_p50", "season_title_worlds_p50", "flag_regional", "flag_major", "flag_worlds", "flag_title", "insolvency", "insolvency_season_p50",
  "negative_days_p50", "longest_negative_p50", "min_payroll_weeks_p50", "share_below_4w", "share_below_8w", "bank_loans_p50", "backer_share",
  "credit_taken_share", "emergency_accepted_share", "cash_s1_p50", "cash_s2_p50", "cash_s3_p50", "cash_s10_p50", "dominant_seasons", "late_ratio_p50",
  "pairs_exposed", "baseline_n", "baseline_reach_major", "baseline_reach_worlds", "baseline_reach_title_worlds", "baseline_insolvency",
  "delta_reach_major", "delta_reach_worlds", "delta_reach_title_worlds", "delta_insolvency"];
function csvRowOf(dims, list, bIndex, pairs) {
  const b = groupBlock(list), f = b.funnel, fin = b.finances;
  const matches = bIndex ? list.filter((c) => !c.censored).map((c) => ({ c, b: bIndex.get([c.region, c.difficulty, c.roster, c.profile, c.seed].join("|"))?.m, n: newMetrics(c) })).filter((x) => x.b) : [];
  const cmp = matches.length ? compareBlock(matches) : null;
  const exposedUnits = pairs ? count(uniq(list.map((c) => c.unit)), (u) => pairs.get(u)) : null;
  return { ...dims, tiers: b.tiers.join("+"), n: b.n, censored: b.censored,
    reach_firstSeries: f.firstSeries.share, reach_regional: f.regional.share, reach_regional_by_split2: b.early.regionalBySplit2,
    reach_swissWin: f.swissWin.share, reach_playoffs: f.playoffs.share, reach_major: f.major.share, reach_title_major: f["title:major"].share,
    reach_worlds: f.worlds.share, reach_title_worlds: f["title:worlds"].share, season_regional_p50: f.regional.season.p50, season_major_p50: f.major.season.p50,
    season_worlds_p50: f.worlds.season.p50, season_title_worlds_p50: f["title:worlds"].season.p50, flag_regional: b.flags.regional, flag_major: b.flags.major,
    flag_worlds: b.flags.worlds, flag_title: b.flags.title, insolvency: b.failures.share, insolvency_season_p50: b.failures.season.p50,
    negative_days_p50: fin.negativeDays.p50, longest_negative_p50: fin.longestNegativeDays.p50, min_payroll_weeks_p50: fin.minPayrollWeeks.p50,
    share_below_4w: fin.crossedMinus4, share_below_8w: fin.crossedMinus8, bank_loans_p50: fin.bankLoans.p50, backer_share: fin.backerCareers,
    credit_taken_share: fin.credit.takenCareers, emergency_accepted_share: fin.emergency.acceptedCareers, cash_s1_p50: b.cash.S1.p50,
    cash_s2_p50: b.cash.S2.p50, cash_s3_p50: b.cash.S3.p50, cash_s10_p50: b.cash.S10.p50, dominant_seasons: b.cash.dominantSeasons.n,
    late_ratio_p50: b.late.ratio.p50, pairs_exposed: exposedUnits, baseline_n: cmp ? cmp.matched : null,
    baseline_reach_major: cmp?.reach.major.baseline ?? null, baseline_reach_worlds: cmp?.reach.worlds.baseline ?? null,
    baseline_reach_title_worlds: cmp?.reach["title:worlds"].baseline ?? null, baseline_insolvency: cmp?.insolvency.baseline ?? null,
    delta_reach_major: cmp?.reach.major.delta ?? null, delta_reach_worlds: cmp?.reach.worlds.delta ?? null,
    delta_reach_title_worlds: cmp?.reach["title:worlds"].delta ?? null,
    delta_insolvency: cmp && isNum(cmp.insolvency.now) && isNum(cmp.insolvency.baseline) ? r4(cmp.insolvency.now - cmp.insolvency.baseline) : null };
}
function csvText(rows) {
  const cell = (v) => { if (v === null || v === undefined) return ""; const s = String(v); return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s; };
  return [CSV_COLUMNS.join(","), ...rows.map((r) => CSV_COLUMNS.map((k) => cell(r[k])).join(","))].join("\n") + "\n";
}

// ------------------------------------------------------------------ build the report
export async function buildHumanReport({ input, baselinePath = null }) {
  const t0 = Date.now();
  const dir = resolve(input);
  const names = readdirSync(dir);
  const shardFiles = names.filter((f) => /^shard-\d+\.jsonl$/.test(f)).sort(byNumber);
  if (!shardFiles.length) throw Error(`No shard-N.jsonl in ${dir} (no battery evidence)`);
  const identityFiles = names.filter((f) => /^identity-\d+\.json$/.test(f)).sort(byNumber);
  const identities = identityFiles.map((f) => readJson(resolve(dir, f))).filter(Boolean);
  const progress = names.filter((f) => /^progress-\d+\.json$/.test(f)).sort(byNumber).map((f) => readJson(resolve(dir, f))).filter(Boolean);
  const softlockFiles = names.filter((f) => /^softlocks-\d+\.json$/.test(f)).sort(byNumber).map((f) => ({ file: f, entries: readJson(resolve(dir, f)) }));
  // done-N.txt is read first: a unit's lines are appended before its done line, so every done unit is whole in the JSONL read next.
  const done = new Set();
  for (const f of names.filter((f) => /^done-\d+\.txt$/.test(f))) for (const k of readFileSync(resolve(dir, f), "utf8").split("\n")) if (k.trim()) done.add(k.trim());
  const plan = planFor(identities, done);
  const signature = new Set(identities.map((d) => JSON.stringify({ ...d.identity, shard: undefined })));
  const indexed = [];
  let partialLines = 0;
  for (const [i, f] of shardFiles.entries()) { const r = await indexShard(resolve(dir, f), i); indexed.push(...r.entries); partialLines += r.partial; }
  const sel = selectLines(indexed, done);
  const checks = { milestoneFromArc: 0, minPayrollWeeksUnknown: 0, incompleteBeforeLast: 0, worldsBeforeFork: 0, exposedWithoutSpy: 0,
    pairPrefixMismatch: [], endlessPrefixMismatch: [], endlessWithoutTitle: 0, unknownCohort: 0, noArc: 0, qualifierPlacements: {}, hugeNegative: 0 };
  const S = { careers: [], pairs: [], endless: [], errors: [], cohorts: {}, G: newGlobal() };
  const unitsWithLines = new Set(sel.selected.map((e) => e.unit));
  for (const [i, f] of shardFiles.entries()) {
    const wanted = new Map(sel.selected.filter((e) => e.file === i).map((e) => [e.line, e]));
    await readSelected(resolve(dir, f), wanted, (r) => {
      inc(S.cohorts, r.cohort === "worldsPair" ? (r.exposed ? "worldsPair exposto" : "worldsPair não exposto") : r.cohort);
      if (r.cohort === "error") { S.errors.push({ unit: r.unit, message: String(r.error ?? "").split("\n")[0].slice(0, 200) }); return; }
      if (r.cohort === "worldsPair") { if (r.exposed) scan(S.G, "pair.spyApplications", r.spyApplications); S.pairs.push(pairOf(r)); return; }
      if (!r.arc) { checks.noArc++; return; }
      if (r.cohort !== "coverage" && r.cohort !== "endless" && r.cohort !== "smoke") { checks.unknownCohort++; return; }
      if (r.cohort !== "endless") {
        for (const k of SCAN_FINANCES) scan(S.G, "finances." + k, r.finances?.[k]);
        scan(S.G, "arc.firstSponsorSeason", r.arc.firstSponsorSeason);
      }
      const c = careerOf(r, checks);
      if (isNum(r.finances?.minimumBalance) && r.finances.minimumBalance < -1e6) checks.hugeNegative++;
      if (r.cohort === "endless") { S.endless.push(c); feed(r, c, S.G, 11, 20); return; }
      for (const e of r.events ?? []) if (e.tier === "qualifier" && isNum(e.season) && e.season <= 10) inc(checks.qualifierPlacements, e.placement);
      S.careers.push(c);
      feed(r, c, S.G, 1, 10);
    });
  }
  const careers = S.careers;
  const planByKey = plan.units ? new Map(plan.units.map((u) => [u.key, u])) : null;
  for (const c of careers) if (!c.tier && planByKey?.get(c.unit)) c.tier = planByKey.get(c.unit).tier;
  // ---- 1. coverage
  const tierOf = (key) => planByKey?.get(key)?.tier ?? careers.find((c) => c.unit === key)?.tier ?? "?";
  const doneByTier = {}, plannedByTier = {};
  for (const k of done) inc(doneByTier, tierOf(k));
  if (plan.units) for (const u of plan.units) inc(plannedByTier, u.tier);
  const pairMap = new Map();
  for (const p of S.pairs) if (p.exposed) pairMap.set(p.unit, true);
  const softlockList = [...careers, ...S.endless].filter((c) => c.softlock).map((c) => ({ unit: c.unit, cohort: c.cohort, softlock: String(c.softlock).slice(0, 160) }));
  const pairSoftlocks = S.pairs.filter((p) => p.censored).length;
  const coverage = {
    identity: identities[0] ? { ...identities[0].identity, shard: undefined, revision: identities[0].revision, aliases: plan.aliases,
      totalUnits: identities[0].totalUnits ?? null, shardsWithIdentity: identities.length, consistent: signature.size <= 1 } : null,
    plan: { reconstructed: Boolean(plan.units), tiers: plan.tiers, note: plan.note, plannedUnits: plan.units?.length ?? null, plannedByTier: plan.units ? plannedByTier : null,
      pairUnitsPlanned: plan.units ? count(plan.units, (u) => u.pairs) : null, endlessCandidatesPlanned: plan.units ? count(plan.units, (u) => u.endless) : null },
    done: { units: done.size, byTier: doneByTier, share: plan.units ? share(count([...done], (k) => planByKey.has(k)), plan.units.length) : null,
      outsidePlan: planByKey ? count([...done], (k) => !planByKey.has(k)) : null, withoutLines: count([...done], (k) => !unitsWithLines.has(k)) },
    lines: { indexed: indexed.length, selected: sel.selected.length, superseded: sel.superseded, pendingNotDone: sel.pending, partialOrMalformed: partialLines },
    careersByCohort: S.cohorts,
    coverageByTier: Object.fromEntries([...groupBy(careers, (c) => c.tier ?? "?")].sort().map(([t, l]) => [t, l.length])),
    seasonsSimulated: { coverage: sumOf(careers.map((c) => c.played)), endlessAfterS10: sumOf(S.endless.map((e) => Math.max(0, e.played - 10))),
      pairsAfterFork: sumOf(S.pairs.filter((p) => p.exposed && p.hasArc).map((p) => Math.max(0, p.played - (p.forkSeason ?? 1) + 1))) },
    softlocks: { careers: softlockList.length, pairs: pairSoftlocks, list: softlockList.slice(0, 10),
      files: softlockFiles.map((x) => ({ file: x.file, entries: Array.isArray(x.entries) ? x.entries.length : null })) },
    errors: { count: S.errors.length, list: S.errors.slice(0, 10) },
    censoring: { endedBeforeHorizon: count(careers, (c) => c.played < c.horizon), insolvent: count(careers, (c) => c.insolvent), softlocked: count(careers, (c) => c.censored),
      otherEnds: count(careers, (c) => c.ended && !["insolvency", "softlock"].includes(c.ended)) },
    progress: progress.map((p) => ({ shard: p.shard, done: p.done, planned: p.planned, elapsedMin: p.elapsedMin, softlocks: p.softlocks, last: p.last })),
  };
  // ---- 2–5: group blocks
  const isBase = (c) => BASE_PROFILES.includes(c.profile), isFactor = (c) => FACTOR_PROFILES.includes(c.profile);
  const base = careers.filter(isBase), factors = careers.filter(isFactor);
  const groups = { "base: todas": groupBlock(base) };
  for (const d of DIFFICULTIES) groups["base: " + d] = groupBlock(base.filter((c) => c.difficulty === d));
  groups["um fator: todas"] = groupBlock(factors);
  for (const d of DIFFICULTIES) groups["um fator: " + d] = groupBlock(factors.filter((c) => c.difficulty === d));
  const cells = [];
  for (const d of DIFFICULTIES) for (const region of REGIONS) for (const roster of ROSTERS) {
    const list = base.filter((c) => c.difficulty === d && c.region === region && c.roster === roster);
    if (list.length) cells.push({ region, difficulty: d, roster, ...groupBlock(list) });
  }
  const profilesPlayed = [...BASE_PROFILES, ...FACTOR_PROFILES.filter((p) => !Object.hasOwn(plan.aliases, p))].filter((p) => careers.some((c) => c.profile === p));
  const profiles = profilesPlayed.map((profile) => {
    const list = careers.filter((c) => c.profile === profile);
    return { profile, kind: BASE_PROFILES.includes(profile) ? "base" : "um fator", all: groupBlock(list),
      byDifficulty: Object.fromEntries(DIFFICULTIES.map((d) => [d, groupBlock(list.filter((c) => c.difficulty === d))])) };
  });
  const aliases = Object.entries(plan.aliases).map(([alias, of]) => ({ alias, of, note: "mesma política efetiva: jogado uma vez, reportado como alias" }));
  const factorRows = oneFactorSection(careers, profilesPlayed.filter((p) => FACTOR_PROFILES.includes(p)));
  // ---- CSV rows
  const baselineDoc = baselinePath ? readJson(resolve(baselinePath)) : null;
  if (baselinePath && !baselineDoc) throw Error(`Baseline not readable: ${baselinePath}`);
  const bIdx = baselineDoc ? baselineIndex(baselineDoc) : null;
  const csvRows = [];
  for (const [, list] of [...groupBy(careers, (c) => [c.region, c.difficulty, c.roster, c.profile].join("|"))].sort((a, b) => {
    const [ra, da, oa, pa] = a[0].split("|"), [rb, db, ob, pb] = b[0].split("|");
    const prof = (p) => (BASE_PROFILES.includes(p) ? BASE_PROFILES.indexOf(p) : 100 + FACTOR_PROFILES.indexOf(p));
    return DIFFICULTIES.indexOf(da) - DIFFICULTIES.indexOf(db) || REGIONS.indexOf(ra) - REGIONS.indexOf(rb) || ROSTERS.indexOf(oa) - ROSTERS.indexOf(ob) || prof(pa) - prof(pb);
  })) {
    const c0 = list[0];
    csvRows.push(csvRowOf({ region: c0.region, difficulty: c0.difficulty, roster: c0.roster, profile: c0.profile }, list, bIdx, pairMap));
  }
  const report = {
    schema: "rc37-report-1", generatedAt: new Date().toISOString(), input: dir, coverage, targets: TARGETS,
    definitions: {
      funnel: "Marcos da telemetria (temporada 1-based); 'by S10' = alcançado até S10 entre carreiras-controle (coverage) não censuradas. p50* incondicional: não-alcançadas contam como >10.",
      split: "semana ≤10 → split 1, ≤20 → 2, senão 3; split absoluto = (temporada−1)×3 + split",
      censored: "softlock (bot/simulação travou): fora dos denominadores; insolvência é desfecho real e fica",
      minPayrollWeeks: "menor saldo ÷ folha semanal (≤0); 0 quando a carreira nunca ficou negativa",
      dominantSeason: "temporada com título de Major ou de Worlds",
      endgame: "folha anual = payroll + salary + coachSalary; receita = prêmio − playerShare + (sponsorBase+Bonus+Signing+Milestone − sponsorFine); só temporadas completas",
      renewals: "razão = newWage ÷ freshAsk (pedido do mercado no mesmo dia); desconto ≥10%/≥25% = razão < 0.90/< 0.75; ≤10%/≤25% do mercado = razão ≤ 0.10/≤ 0.25",
      chemistry: "percentual do trio escalado no fim da temporada; mistura = pares (país c, região r, nenhum n); posse = menor tempo juntos (splits) entre os 3 pares",
    },
    groups, cells, profiles, aliases, oneFactorVsControl: factorRows,
    endgame: endgameSection(S.G), postTitle: postTitleSection(careers, S.endless, checks), purchases: purchasesSection(S.G),
    worldsPairs: pairsSection(careers, S.pairs, checks), chemistry: chemistrySection(S.G), renewals: renewalsSection(S.G),
    reputation: reputationSection(S.G), briefings: briefingsSection(S.G, careers, factorRows),
    baseline: baselineSection(careers, baselineDoc, baselinePath ? resolve(baselinePath) : null),
    fieldPresence: Object.fromEntries(Object.entries(S.G.fields).sort().map(([k, v]) => [k, { ...v, share: share(v.present, v.total) }])),
    fieldScan: Object.fromEntries(Object.entries(S.G.scan).sort().map(([k, v]) => [k, { ...v, nullShare: share(v.nulls, v.n), zeroShare: share(v.zeros, v.n) }])),
    checks, cellProfileRows: csvRows, elapsedMs: 0,
  };
  report.dataNotes = dataNotes(report);
  report.elapsedMs = Date.now() - t0;
  return report;
}
function dataNotes(rep) {
  const notes = [], c = rep.checks;
  for (const [k, v] of Object.entries(rep.fieldPresence)) if (v.total && v.present === 0) notes.push(`Campo ${k} ausente em todas as ${v.total} observações (schema anterior?); as seções que dependem dele ficam null.`);
  const alwaysNull = Object.entries(rep.fieldScan).filter(([, v]) => v.n >= 10 && v.nulls === v.n).map(([k]) => k);
  const alwaysZero = Object.entries(rep.fieldScan).filter(([, v]) => v.n >= 10 && v.zeros === v.n).map(([k]) => k);
  const almostZero = Object.entries(rep.fieldScan).filter(([, v]) => v.n >= 50 && v.zeros < v.n && v.zeros / v.n >= 0.98).map(([k, v]) => `${k} (${Math.round((v.zeros / v.n) * 1000) / 10}%)`);
  if (alwaysNull.length) notes.push(`Sempre null/ausente: ${alwaysNull.join(", ")}.`);
  if (alwaysZero.length) notes.push(`Sempre 0/false: ${alwaysZero.map((k) => (k === "arc.firstSponsorSeason" ? k + " (índice 0 = todo controle assina patrocínio em S1)" : k)).join(", ")}.`);
  if (almostZero.length) notes.push(`Quase sempre 0 (≥98%): ${almostZero.join(", ")}.`);
  for (const [item, E] of Object.entries(rep.purchases.marginalAfterCaps)) {
    const e = E["S1–10"];
    const statMax = Math.max(0, ...Object.values(e?.meanStats ?? {}).map(Math.abs));
    if (e?.samples >= 20 && statMax >= 0.5 && Math.abs(e.meanRating ?? 0) < 0.005) notes.push(`${item}: stats marginais sobem (até ${fmt(statMax, 2)}) mas o rating marginal é 0 em ${e.samples} amostras (rating ignora esses stats?).`);
  }
  const ri = rep.reputation.inconsistencies;
  if (ri.placementVsRepOnlyAtCeiling) notes.push(`Reputação: títulos rendem ~0 de rep porque chegam no teto (${REP_CEILING}); ${ri.placementVsRepOnlyAtCeiling} inversões colocação × rep somem com folga.`);
  if (ri.placementVsRep.length) notes.push(`Reputação: ${ri.placementVsRep.length} inversões colocação × rep persistem com folga (ex.: ${ri.placementVsRep[0]}).`);
  if (isNum(ri.negativeAtWorlds) && ri.negativeAtWorlds > 0) notes.push(`Worlds: ${Math.round(ri.negativeAtWorlds * 100)}% dos resultados têm Δrep negativo (inclusive campeões) — a verificar se o settlement do Worlds inclui algum ajuste de fim de temporada.`);
  const q = c.qualifierPlacements, qTotal = sumOf(Object.values(q));
  if (qTotal && q.swiss_exit === qTotal) notes.push(`Todos os ${qTotal} eventos 'qualifier' têm placement swiss_exit (formato só-Swiss: o placement não distingue quem avançou).`);
  if (c.milestoneFromArc) notes.push(`${c.milestoneFromArc} marcos vieram do arc (firstMajorSeason/firstWorldsSeason/worldsTitleSeason) por falta do milestone na telemetria.`);
  if (c.minPayrollWeeksUnknown) notes.push(`${c.minPayrollWeeksUnknown} carreiras com dias negativos mas minimumPayrollWeeks null (folha 0 no dia negativo?).`);
  if (c.incompleteBeforeLast) notes.push(`${c.incompleteBeforeLast} temporadas marcadas incompletas antes da última (snapshot sem seasonReview).`);
  if (c.worldsBeforeFork) notes.push(`${c.worldsBeforeFork} controles com Worlds antes do forkAt (o fork deveria ser o 1º Worlds).`);
  if (c.exposedWithoutSpy) notes.push(`${c.exposedWithoutSpy} pares expostos com spyApplications 0 (tratamento não aplicado).`);
  if (c.pairPrefixMismatch.length) notes.push(`Prefixo par ≠ controle antes do fork: ${c.pairPrefixMismatch.slice(0, 5).join(", ")}${c.pairPrefixMismatch.length > 5 ? " …" : ""}.`);
  if (c.endlessPrefixMismatch.length) notes.push(`Endless S1–S10 ≠ coverage em ${c.endlessPrefixMismatch.length} unidades (ex.: ${c.endlessPrefixMismatch[0]}).`);
  if (c.endlessWithoutTitle) notes.push(`${c.endlessWithoutTitle} registros endless sem título de Worlds até S10 no controle.`);
  if (c.hugeNegative) notes.push(`${c.hugeNegative} registros com saldo mínimo abaixo de −1.000.000.`);
  if (c.unknownCohort || c.noArc) notes.push(`Registros ignorados: coorte desconhecida ${c.unknownCohort}, sem arc ${c.noArc}.`);
  if (rep.coverage.done.withoutLines) notes.push(`${rep.coverage.done.withoutLines} unidades em done-N.txt sem linha no JSONL.`);
  if (rep.coverage.lines.partialOrMalformed) notes.push(`${rep.coverage.lines.partialOrMalformed} linhas parciais/ilegíveis (escrita em andamento) ignoradas.`);
  if (rep.coverage.identity && !rep.coverage.identity.consistent) notes.push("identity-N.json divergem entre shards (simulação/plano diferentes): resumir pastas separadamente.");
  if (rep.postTitle.eligibleWithoutEndless) notes.push(`${rep.postTitle.eligibleWithoutEndless} controles tier A com título até S10 ainda sem registro endless.`);
  const reg = rep.groups["base: todas"]?.early.regionalBySplit.split1;
  if (isNum(reg) && reg >= 0.5) notes.push(`${Math.round(reg * 100)}% das carreiras base já jogam um Regional no split 1 de S1 (referência: normalmente nenhum nos 2 primeiros splits).`);
  const inc0 = rep.reputation.inconsistencies;
  if (isNum(inc0.goodSwissZeroRep) && inc0.goodSwissZeroRep > 0) notes.push(`Regionais S1–S3: ${Math.round(inc0.goodSwissZeroRep * 100)}% dos Swiss com ≥3 vitórias renderam 0 de reputação (n=${inc0.goodSwissN}).`);
  return notes;
}

// ------------------------------------------------------------------ markdown
const dash = "–";
const fmt = (x, digits = 0) => (x === null || x === undefined ? dash : typeof x === "string" ? x : !Number.isFinite(x) ? dash
  : digits === 0 ? String(Math.round(x)) : String(Math.round(x * 10 ** digits) / 10 ** digits));
const pct = (x) => (isNum(x) ? Math.round(x * 100) + "%" : dash);
const pp = (x) => (isNum(x) ? (x > 0 ? "+" : "") + Math.round(x * 100) + "pp" : dash);
const trio = (d, digits = 0) => (d && d.n ? `${fmt(d.p10, digits)}/${fmt(d.p50, digits)}/${fmt(d.p90, digits)}` : dash);
const med = (d, digits = 0) => (d && d.n ? fmt(d.p50, digits) : dash);
const kv = (o) => Object.entries(o ?? {}).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(", ") || dash;
function mdTable(headers, rows) {
  if (!rows.length) return "_sem dados_";
  const esc = (v) => String(v ?? dash).replaceAll("|", "\\|");
  return [`| ${headers.join(" | ")} |`, `|${headers.map(() => "---").join("|")}|`, ...rows.map((r) => `| ${r.map(esc).join(" | ")} |`)].join("\n");
}
function renderMd(rep) {
  const L = [];
  const cov = rep.coverage, id = cov.identity;
  const FKEYS = ["firstSeries", "regional", "swissWin", "playoffs", "major", "title:major", "worlds", "title:worlds"];
  L.push("# Rocket Draft rc.37 — relatório da bateria de carreiras (Road to Worlds)", "");
  const idText = id ? [["protocolo", id.protocol], ["revisão", id.revision?.slice(0, 7)], ["balance v", id.balanceVersion], ["simulationHash", id.simulationHash?.slice(0, 12)]]
    .filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => (k.endsWith("v") ? k + v : `${k} ${v}`)).join(" · ") : "";
  L.push(`Fonte: \`${rep.input}\` · gerado ${rep.generatedAt}${idText ? " · " + idText : ""}${id && !id.consistent ? " · **identities divergentes entre shards**" : ""}`);
  L.push(`Unidades concluídas: **${cov.done.units}${cov.plan.plannedUnits ? "/" + cov.plan.plannedUnits : ""}**${cov.done.share !== null ? ` (${pct(cov.done.share)})` : ""}. Dados parciais: referências do Miguel são distribuições, não calendário; n pequeno = leitura indicativa.`, "");
  // 1
  L.push("## 1. Cobertura e exposição", "");
  const tierRows = TIERS.map((t) => [t, fmt(cov.plan.plannedByTier?.[t] ?? null), fmt(cov.done.byTier[t] ?? 0), pct(cov.plan.plannedByTier?.[t] ? (cov.done.byTier[t] ?? 0) / cov.plan.plannedByTier[t] : null), fmt(cov.coverageByTier[t] ?? 0)]);
  L.push(mdTable(["Tier", "Planejadas", "Concluídas", "%", "Controles lidos"], tierRows), "");
  L.push(`Registros por coorte: ${kv(cov.careersByCohort)}. Temporadas simuladas: controles ${cov.seasonsSimulated.coverage}, pares pós-fork ${cov.seasonsSimulated.pairsAfterFork}, extensão S11–S20 ${cov.seasonsSimulated.endlessAfterS10}.`);
  L.push(`Linhas: ${cov.lines.selected} usadas de ${cov.lines.indexed} (substituídas por retomada ${cov.lines.superseded}, pendentes sem done ${cov.lines.pendingNotDone}, parciais ${cov.lines.partialOrMalformed}). Softlocks: ${cov.softlocks.careers} carreiras + ${cov.softlocks.pairs} pares; erros: ${cov.errors.count}.`);
  L.push(`Censura: terminaram antes do horizonte ${cov.censoring.endedBeforeHorizon} (insolvência ${cov.censoring.insolvent}, softlock ${cov.censoring.softlocked}, outro fim ${cov.censoring.otherEnds}).`);
  const ex = rep.worldsPairs.exposure;
  L.push(`Exposição dos pares de Worlds (A/B): ${ex.all ? `${ex.all.exposed}/${ex.all.units} unidades expostas (${pct(ex.all.share)})` : dash}${DIFFICULTIES.filter((d) => ex[d]).map((d) => ` · ${d} ${pct(ex[d].share)} (n=${ex[d].units})`).join("")}. Extensão S20: ${rep.postTitle.endlessRecords} registros de ${rep.postTitle.eligibleControls} controles elegíveis (tier A com título até S10).`);
  if (cov.plan.note) L.push(`Plano: ${cov.plan.note}.`);
  if (cov.softlocks.list.length) L.push("", "Softlocks: " + cov.softlocks.list.slice(0, 5).map((s) => `\`${s.unit}\` ${s.softlock}`).join("; "));
  if (cov.errors.list.length) L.push("", "Erros: " + cov.errors.list.slice(0, 5).map((e) => `\`${e.unit}\` ${e.message}`).join("; "));
  if (cov.progress.length) L.push("", "Progresso: " + cov.progress.map((p) => `shard ${p.shard} ${p.done}/${p.planned} (${p.elapsedMin} min)`).join(" · "));
  L.push("");
  // 2
  L.push("## 2. Funil competitivo", "");
  L.push("Referências: " + ["early", "regional", "s3", "major", "worlds", "title:worlds"].map((k) => TARGETS[k].text).join(" · ") + ".", "");
  L.push("### 2.1 Marcos até S10 (perfis base agregados)", "");
  L.push("Temporada/split: p10/p50/p90 entre quem alcançou. p50* = mediana incondicional (todas as carreiras; >10 = metade ou mais não alcançou). ≤Sx = % acumulado de todas as carreiras.", "");
  const msRows = [];
  for (const key of FKEYS) for (const g of ["todas", ...DIFFICULTIES]) {
    const b = rep.groups["base: " + g];
    if (!b?.n) continue;
    const f = b.funnel[key];
    const target = { major: b.flags.major, worlds: b.flags.worlds, "title:worlds": b.flags.title, regional: b.flags.regional }[key] ?? "";
    msRows.push([key, g, b.n, pct(f.share), trio(f.season), trio(f.split), ...CHECK_SEASONS.map((s) => pct(f.bySeason["S" + s])), fmt(f.unconditional.p50), target]);
  }
  L.push(mdTable(["Marco", "Dif.", "n", "Alcance", "Temp.", "Split abs.", ...CHECK_SEASONS.map((s) => "≤S" + s), "p50*", "Alvo"], msRows), "");
  L.push("### 2.2 Começo de carreira (splits 1–3, presença em Regionais)", "");
  const earlyRows = ["todas", ...DIFFICULTIES].map((g) => rep.groups["base: " + g]).map((b, i) => [["todas", ...DIFFICULTIES][i], b.n,
    ...[1, 2, 3, 6].map((k) => pct(b.early.regionalBySplit["split" + k])), fmt(b.early.s3MeanSplits, 2), pct(b.early.s3AllSplits),
    pct(b.early.anyTitleByS2), pct(b.early.regionalTitleByS2), Array.from({ length: 10 }, (_, j) => fmt(b.early.regionalPresenceBySeason["S" + (j + 1)], 1)).join(" "),
    `${b.flags.regional}/${b.flags.s3}/${b.flags.early}`]);
  L.push(mdTable(["Dif.", "n", "Reg ≤sp1", "≤sp2", "≤sp3", "≤sp6", "S3 splits c/ Reg", "S3 3/3", "Título qq ≤S2", "Título Reg+ ≤S2", "Splits c/ Regional S1…S10 (média)", "Alvo reg/S3/cedo"], earlyRows), "");
  L.push("### 2.3 Por célula (região × dificuldade × elenco; perfis base)", "");
  L.push(mdTable(["Região", "Dif.", "Elenco", "n", "Reg ≤sp2", "Major ≤S5", "Worlds ≤S7", "Título ≤S8", "Título ≤S10", "Major p50*", "Worlds p50*", "Título p50*", "Insolv.", "Caixa S3 p50", "Alvos reg/major/worlds/título"],
    rep.cells.map((c) => [c.region, c.difficulty, c.roster, c.n, pct(c.early.regionalBySplit2), pct(c.funnel.major.bySeason.S5), pct(c.funnel.worlds.bySeason.S7),
      pct(c.funnel["title:worlds"].bySeason.S8), pct(c.funnel["title:worlds"].share), fmt(c.funnel.major.unconditional.p50), fmt(c.funnel.worlds.unconditional.p50),
      fmt(c.funnel["title:worlds"].unconditional.p50), pct(c.failures.share), med(c.cash.S3), `${c.flags.regional}/${c.flags.major}/${c.flags.worlds}/${c.flags.title}`])), "");
  L.push("### 2.4 Por perfil × dificuldade (valores easy / normal / hard)", "");
  const t3 = (p, f) => DIFFICULTIES.map((d) => f(p.byDifficulty[d])).join(" / ");
  const profRows = rep.profiles.map((p) => [p.profile, p.kind, t3(p, (b) => b.n), t3(p, (b) => pct(b.early.regionalBySplit2)), t3(p, (b) => pct(b.funnel.playoffs.share)),
    t3(p, (b) => pct(b.funnel.major.share)), t3(p, (b) => pct(b.funnel.worlds.share)), t3(p, (b) => pct(b.funnel["title:worlds"].share)),
    t3(p, (b) => fmt(b.funnel.major.unconditional.p50)), t3(p, (b) => fmt(b.funnel["title:worlds"].unconditional.p50)), t3(p, (b) => pct(b.failures.share)), t3(p, (b) => med(b.cash.S10))]);
  for (const a of rep.aliases) profRows.push([a.alias, "alias", `≡ ${a.of}`, "", "", "", "", "", "", "", "", ""]);
  L.push(mdTable(["Perfil", "Tipo", "n", "Reg ≤sp2", "Playoffs", "Major", "Worlds", "Título", "Major p50*", "Título p50*", "Insolv.", "Caixa S10 p50"], profRows), "");
  L.push("### 2.5 Coortes de um fator vs coachUpgrades (pareadas por região × dificuldade × elenco × seed)", "");
  L.push(mdTable(["Perfil", "Pares", "Major (Δ)", "Título Major (Δ)", "Worlds (Δ)", "Título Worlds (Δ)", "Títulos W +/=/−", "Δ temp. Major p50", "Insolv. fator/ctrl", "Δ caixa S10 p50"],
    rep.oneFactorVsControl.filter((r) => r.paired).map((r) => [r.profile, r.paired, `${pct(r.reach.major.factor)} (${pp(r.reach.major.delta)})`,
      `${pct(r.reach["title:major"].factor)} (${pp(r.reach["title:major"].delta)})`, `${pct(r.reach.worlds.factor)} (${pp(r.reach.worlds.delta)})`,
      `${pct(r.reach["title:worlds"].factor)} (${pp(r.reach["title:worlds"].delta)})`, `${r.worldsTitlesVsControl.more}/${r.worldsTitlesVsControl.same}/${r.worldsTitlesVsControl.fewer}`,
      med(r.majorSeasonDelta, 1), `${pct(r.insolvency.factor)}/${pct(r.insolvency.control)}`, med(r.cashS10Delta)])), "");
  // 3
  const groupRows = (f) => [...["todas", ...DIFFICULTIES].map((g) => ["base " + g, rep.groups["base: " + g]]), ["um fator todas", rep.groups["um fator: todas"]],
    ...rep.profiles.filter((p) => p.kind === "base").map((p) => [p.profile, p.all])].filter(([, b]) => b?.n).map(([k, b]) => [k, b.n, ...f(b)]);
  L.push("## 3. Falhas", "");
  L.push(mdTable(["Grupo", "n", "Insolv.", "Causas", "Temp. insolv. p10/p50/p90", "Nunca: Regional", "Playoffs", "Major", "Worlds", "Título W", "Alvo"],
    groupRows((b) => [pct(b.failures.share), kv(b.failures.causes), trio(b.failures.season), pct(b.failures.neverReached.regional), pct(b.failures.neverReached.playoffs),
      pct(b.failures.neverReached.major), pct(b.failures.neverReached.worlds), pct(b.failures.neverReached["title:worlds"]), b.flags.insolvency])), "");
  // 4
  L.push("## 4. Finanças", "");
  L.push(mdTable(["Grupo", "n", "Já negativo", "Recuperou", "Dias neg. p50/p90", "Maior seq. p50/p90", "Folha mín. (sem.) p10/p50", "≤−4 sem", "≤−8 sem", "Segundas neg. p50"],
    groupRows((b) => { const f = b.finances; return [pct(f.everNegative), pct(f.recoveredAmongNegative), `${med(f.negativeDays)}/${fmt(f.negativeDays.p90)}`,
      `${med(f.longestNegativeDays)}/${fmt(f.longestNegativeDays.p90)}`, `${fmt(f.minPayrollWeeks.p10, 2)}/${fmt(f.minPayrollWeeks.p50, 2)}`, pct(f.crossedMinus4), pct(f.crossedMinus8), med(f.negativeMondays)]; })), "");
  L.push("Empréstimos: ledger = toda entrada bankLoan (inclui ofertas de crédito aceitas); bot = `season.bankLoans`, só o `borrow` próprio do bot (perfis com bank). Backer = empréstimo emergencial. Fees de emergência = valor das vendas abaixo do mercado aceitas.", "");
  L.push(mdTable(["Grupo", "n", "Emprést. ledger (carreiras / p50)", "Emprést. bot p50/p90", "Backer (carreiras / fim de temp.)", "Crédito: ofertas p50 / tomou / principal p50", "Emergência: ofertas p50 / aceitou / fees p50"],
    groupRows((b) => { const f = b.finances; return [`${pct(f.bankLoanCareers)} / ${med(f.bankLoans)}`, `${med(f.botBankLoans)}/${fmt(f.botBankLoans.p90)}`, `${pct(f.backerCareers)} / ${pct(f.backerSeasonEndShare)}`,
      `${med(f.credit.offers)} / ${pct(f.credit.takenCareers)} / ${med(f.credit.principal)}`, `${med(f.emergency.offers)} / ${pct(f.emergency.acceptedCareers)} / ${med(f.emergency.fees)}`]; })), "");
  // 5
  L.push("## 5. Caixa", "");
  L.push(mdTable(["Grupo", "n", "S1 p10/p50/p90", "S2 p10/p50/p90", "S3 p10/p50/p90", "S10 p50/p90", "Temp. dominantes", "Dominantes p50/p90", "Cobre fee 90+", "Estrela S6–10"],
    groupRows((b) => [trio(b.cash.S1), trio(b.cash.S2), trio(b.cash.S3), `${med(b.cash.S10)}/${fmt(b.cash.S10.p90)}`, b.cash.dominantSeasons.n,
      `${med(b.cash.dominantSeasons.balance)}/${fmt(b.cash.dominantSeasons.balance.p90)}`, pct(b.cash.dominantSeasons.affordStar90Fee), pct(b.cash.starSigningS6to10)])), "");
  // 6
  const eg = rep.endgame;
  L.push("## 6. Folha × receita no endgame", "", "Folha anual = payroll + salary + coachSalary; receita = prêmio − playerShare + patrocínio − multas; razão = folha ÷ receita. Só temporadas completas (S11–S20 = extensão endless).", "");
  L.push("### 6.1 Por temporada", "");
  L.push(mdTable(["Temp.", "Completas", "Parciais", "Folha p50", "Prêmio líq. p50", "Patrocínio líq. p50", "Receita p50", "Razão p10/p50/p90", "Razão > 1"],
    eg.bySeason.map((s) => ["S" + s.season, s.complete, s.partialExcluded, med(s.payroll), med(s.netPrize), med(s.netSponsor), med(s.revenue), trio(s.ratio, 2), pct(s.ratioAbove1)])), "");
  L.push(mdTable(["Faixa", "Dif.", "Temporadas", "Folha p50", "Receita p50", "Razão p10/p50/p90", "Razão > 1"],
    eg.byDifficulty.map((d) => [d.range, d.difficulty, d.seasons, med(d.payroll), med(d.revenue), trio(d.ratio, 2), pct(d.ratioAbove1)])), "");
  L.push("### 6.2 Mercado (1ª visita à janela) vs folha própria — medianas entre carreiras", "");
  const marketAbsent = sumOf(eg.market.map((m) => m.absent));
  if (marketAbsent) L.push(`Temporadas sem o campo market (schema antigo): ${marketAbsent}.`, "");
  L.push(mdTable(["Temp.", "Visitas", "Listados", "Pedido p50", "Pedido p90", "<80", "80–84", "85–89", "90+", "Fee 90+", "Folha própria/split", "Folha ÷ pedido p50"],
    eg.market.filter((m) => m.visits > 0).map((m) => ["S" + m.season, m.visits, med(m.signable), med(m.wageP50), med(m.wageP90), ...["<80", "80-84", "85-89", "90+"].map((b) => med(m.byBand[b]?.wageP50)),
      med(m.byBand["90+"]?.feeP50), med(m.ownPayrollPerSplit), med(m.ownPayrollToMarketWageP50, 2)])), "");
  L.push("### 6.3 Prêmio por evento (p50, n) por nível × colocação", "");
  const prizeTiers = ["regional", "major", "worlds"];
  const prizeKeys = uniq(eg.prizePerEvent.filter((p) => prizeTiers.includes(p.tier)).map((p) => p.tier + "|" + p.placement))
    .sort((a, b) => prizeTiers.indexOf(a.split("|")[0]) - prizeTiers.indexOf(b.split("|")[0]) || PLACE_ORDER.indexOf(a.split("|")[1]) - PLACE_ORDER.indexOf(b.split("|")[1]));
  const buckets = PRIZE_BUCKETS.map(([b]) => b).filter((b) => eg.prizePerEvent.some((p) => p.bucket === b));
  L.push(mdTable(["Nível", "Colocação", ...buckets], prizeKeys.map((k) => { const [tier, placement] = k.split("|");
    return [tier, placement, ...buckets.map((b) => { const p = eg.prizePerEvent.find((x) => x.tier === tier && x.placement === placement && x.bucket === b); return p ? `${fmt(p.prize.p50)} (${p.prize.n})` : dash; })]; })), "");
  if (eg.eventsWithoutPrize) L.push(`Eventos sem campo prize: ${eg.eventsWithoutPrize}.`, "");
  const pt = rep.postTitle;
  L.push("### 6.4 Depois do título (extensão S11–S20)", "");
  L.push(mdTable(["Elegíveis", "Registros", "Temporadas após S10 p50", "Insolv. pós-título", "Novo título S11–20", "Caixa S20 p10/p50/p90", "Saldo mín. S11–20 p50", "Dias neg. S11–20 p50", "Pior vermelho (sem.) p50", "≤−8 sem", "Razão p50"],
    pt.endlessRecords || pt.eligibleControls ? [[pt.eligibleControls, pt.endlessRecords, med(pt.seasonsAfterS10), pt.insolventAfterTitle, pct(pt.titledAgainShare), trio(pt.cashS20),
      med(pt.minBalanceS11toS20), med(pt.negativeDaysS11toS20), med(pt.deepestRedWeeksS11toS20, 2), pct(pt.crossedMinus8S11toS20), med(pt.ratioS11toS20, 2)]] : []), "");
  // 7
  const pu = rep.purchases;
  L.push("## 7. Compras e benefício após caps", "", "Compras aceitas nos controles S1–S10. Marginal = efeito local do item na amostra semanal com plano ativo (após caps), média por amostra; não é efeito causal em vitórias.", "");
  const items = uniq([...Object.keys(pu["S1-10"].items), ...Object.keys(pu.marginalAfterCaps)]);
  const topStats = (s) => Object.entries(s ?? {}).filter(([, v]) => Math.abs(v) >= 0.005).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 3)
    .map(([k, v]) => `${k} ${v > 0 ? "+" : ""}${fmt(v, 2)}`).join(", ") || (s ? "0" : dash);
  L.push(mdTable(["Item", "Carreiras", "Compras", "Gasto total", "Caixa/compra p50", "Δ custo sem. p50", "Δ rating inst. p50", "Δ bônus treino p50", "Marginal rating S1–3/S4–6/S7–10/S11–20", "Marginal ganho/dia S1–3/S4–6/S7–10", "Stats marginais S1–10", "Amostras"],
    items.map((item) => { const P = pu["S1-10"].items[item], E = pu.marginalAfterCaps[item] ?? {};
      return [item, P ? pct(P.careerShare) : dash, P?.purchases ?? 0, P ? fmt(P.spend) : dash, med(P?.cashPerPurchase), med(P?.weeklyCostDelta), med(P?.instantRatingDelta, 2), med(P?.trainingBonusDelta, 3),
        EFFECT_BUCKETS.map(([b]) => fmt(E[b]?.meanRating ?? null, 2)).join(" / "), EFFECT_BUCKETS.slice(0, 3).map(([b]) => fmt(E[b]?.meanFullDayGain ?? null, 4)).join(" / "),
        topStats(E["S1–10"]?.meanStats), sumOf(EFFECT_BUCKETS.map(([b]) => E[b]?.samples))]; })), "");
  // 8
  const wp = rep.worldsPairs;
  L.push("## 8. Pares de Worlds (oponentes de Worlds +0.5 / +1)", "", wp.basis + ".", "");
  L.push(mdTable(["Braço", "Unidades", "Worlds jogados", "Títulos", "≥1 título até S10", "Rank médio", "Colocações", "Caixa S10 p50", "Spy p50"],
    ["control", "0.5", "1"].map((k) => { const a = wp.arms[k]; return [k === "control" ? "controle" : "+" + k, a.units, a.worldsEntries, a.titles, pct(a.titledShare), fmt(a.meanPlacementRank, 2), kv(a.placements), med(a.cashS10), k === "control" ? dash : med(a.spyApplications)]; })), "");
  L.push(mdTable(["Par", "Unidades", "Δ títulos média", "Mais/igual/menos", "Título ctrl → par", "Δ rank médio", "Δ caixa S10 p10/p50/p90"],
    ["0.5", "1"].filter((x) => wp.paired[x].units).map((x) => { const d = wp.paired[x]; return ["+" + x, d.units, fmt(d.titlesDelta.mean, 2), `${d.moreTitles}/${d.sameTitles}/${d.fewerTitles}`, `${pct(d.titledControl)} → ${pct(d.titledPair)}`, fmt(d.placementRankDelta.mean, 2), trio(d.cashS10Delta)]; })), "");
  // 9
  L.push("## 9. Química", "", "Percentual do trio escalado no fim da temporada; mistura c/r/n = pares com mesmo país / mesma região / nenhum; posse = menor tempo juntos entre os pares (splits).", "");
  for (const [range, ch] of Object.entries(rep.chemistry)) {
    L.push(`**${range}** — ${ch.seasons} temporadas (sem dado ${ch.absent}); tiers ${kv(ch.tiers)}. Posse ≥ 2 splits: ${ch.tenureAtLeast2.seasons} temporadas, ≤67%: ${pct(ch.tenureAtLeast2.atMost67)} (exatamente 67%: ${pct(ch.tenureAtLeast2.at67)}).`, "");
    L.push(mdTable(["Recorte", "Valor", "n", "% p10/p50/p90", "≤67%", "=67%"], [
      ...Object.entries(ch.byHeritageMix).map(([k, v]) => ["mistura", k, v.n, trio(v), pct(v.atMost67), pct(v.at67)]),
      ...Object.entries(ch.byMinPairTenure).map(([k, v]) => ["posse mín.", k, v.n, trio(v), pct(v.atMost67), pct(v.at67)]),
      ...Object.entries(ch.tenureAtLeast2.byHeritageMix).map(([k, v]) => ["posse ≥2 × mistura", k, v.n, trio(v), pct(v.atMost67), pct(v.at67)]),
    ]), "");
  }
  // 10
  L.push("## 10. Renovações", "", "Razão = newWage ÷ freshAsk (pedido de mercado do jogador no dia). Desconto ≥10%/≥25% = razão < 0.90/< 0.75.", "");
  for (const [range, rn] of Object.entries(rep.renewals)) {
    const row = (label, v) => [label, v.n, trio(v.ratio, 2), pct(v.atMost10pctOfMarket), pct(v.atMost25pctOfMarket), pct(v.discountAtLeast25pct), pct(v.discountAtLeast10pct), med(v.vsOldWage, 2)];
    L.push(`**${range}** — ${rn.actions} renovações (sem termos ${rn.withoutTerms}).`, "");
    L.push(mdTable(["Recorte", "n", "Razão p10/p50/p90", "≤10% mercado", "≤25% mercado", "Desconto ≥25%", "Desconto ≥10%", "Novo ÷ antigo p50"], [row("todas", rn.all),
      ...Object.entries(rn.byRenewalCount).map(([k, v]) => row("renovação nº " + k, v)), ...Object.entries(rn.byBound).map(([k, v]) => row("bound " + k, v))]), "");
  }
  // 11
  const rp = rep.reputation;
  L.push("## 11. Reputação", "");
  L.push(`Todas as temporadas S1–S10 dos controles, por nível × colocação. Rep vai até ${REP_CEILING}: "no teto" = rep antes ≥ ${REP_CEILING}; "com folga" = rep antes < ${REP_HEADROOM}.`, "");
  L.push(mdTable(["Nível", "Colocação", "n", "Δrep p10/p50/p90", "Média", "Zero", "Positiva", "Rep antes p50", "No teto", "Com folga: n / média / zero"],
    (rp.byTierPlacement["S1-10"] ?? []).map((r) => [r.tier, r.placement, r.n, trio(r, 1), fmt(r.mean, 2), pct(r.zero), pct(r.positive), med(r.repBefore), pct(r.atCeiling),
      `${r.withHeadroom.n} / ${fmt(r.withHeadroom.mean, 2)} / ${pct(r.withHeadroom.zero)}`])), "");
  L.push("Regionais S1–S3 por campanha no Swiss (vitórias–derrotas):", "");
  L.push(mdTable(["Swiss", "n", "Δrep p10/p50/p90", "Média", "Zero", "Positiva", "Rep antes p50", "Prêmio p50", "Colocações"],
    rp.regionalS1toS3BySwiss.map((r) => [r.record, r.n, trio(r, 1), fmt(r.mean, 2), pct(r.zero), pct(r.positive), med(r.repBefore), med(r.prize), kv(r.placements)])), "");
  const ic = rp.inconsistencies;
  L.push(`Inconsistências S1–S3: Swiss com ≥3 vitórias e 0 de rep ${pct(ic.goodSwissZeroRep)} (n=${ic.goodSwissN}); Swiss com ≤1 vitória e rep > 0 ${pct(ic.poorSwissPositiveRep)} (n=${ic.poorSwissN}).`);
  for (const m of ic.monotonicity.slice(0, 8)) L.push(`- Swiss: ${m}`);
  L.push(`Colocação melhor rendendo menos rep no mesmo nível (diferença > ${REP_MIN_GAP}): ${ic.placementVsRepOnlyAtCeiling} pares explicados só pelo teto; ${ic.placementVsRep.length} persistem com folga (rep antes < ${REP_HEADROOM}, n ≥ ${MIN_N_COMPARE}). Worlds com Δrep negativo: ${pct(ic.negativeAtWorlds)}.`);
  for (const m of ic.placementVsRep.slice(0, 10)) L.push(`- ${m}`);
  if (rp.eventsWithoutRep) L.push(`Eventos sem repDelta (schema antigo): ${rp.eventsWithoutRep}.`);
  L.push("");
  // 12
  const br = rep.briefings;
  L.push("## 12. Preleções (F3)", "");
  L.push("Sem coach não há preleção (F3): efetiva null, edge 0. Pedido ≠ efetivo só conta com coach.", "");
  L.push(mdTable(["Etapa", "Nível", "Coach", "n", "Jogando", "Pedido ≠ efetivo", "Pedidas", "Efetivas", "Edge médio por pedido"],
    br.byStage.map((s) => [s.stage, s.tier, s.coach, s.n, pct(s.playingShare), pct(s.requestedNotEffective), kv(s.requested), kv(s.effective),
      Object.entries(s.meanEdgeByRequested).map(([k, e]) => `${k}: ${Object.entries(e).map(([x, v]) => `${x} ${fmt(v, 2)}`).join(" ")}`).join("; ") || dash])), "");
  L.push(mdTable(["Coorte", "Carreiras", "Preleções/carreira", "Pedidas", "Efetivas"],
    br.cohorts.filter((c) => c.careers > 0).map((c) => [c.profile + (c.profile === CONTROL ? " (adaptive, controle)" : ""), c.careers, fmt(c.briefingsPerCareer, 1), kv(c.requested), kv(c.effective)])), "");
  L.push("briefing-adaptive ≡ coachUpgrades (alias). Funil vs controle pareado:", "");
  L.push(mdTable(["Coorte", "Pares", "Playoffs (Δ)", "Major (Δ)", "Título Major (Δ)", "Worlds (Δ)", "Título Worlds (Δ)", "Insolv. fator/ctrl"],
    br.vsControl.filter((r) => r.paired).map((r) => [r.profile, r.paired, ...["playoffs", "major", "title:major", "worlds", "title:worlds"].map((k) => `${pct(r.reach[k].factor)} (${pp(r.reach[k].delta)})`),
      `${pct(r.insolvency.factor)}/${pct(r.insolvency.control)}`])), "");
  // 13
  L.push("## 13. Comparação com a baseline 04/11 (rc.36.10, nunca re-rodada)", "");
  const bl = rep.baseline;
  if (!bl) L.push("_baseline não informada (--baseline)_", "");
  else {
    L.push(`${bl.note} Baseline ${bl.version ?? ""}: ${bl.baselineCareers} carreiras; pareadas agora: ${bl.overall.matched}.`, "");
    const rows = [["todas", bl.overall], ...Object.entries(bl.byProfile), ...Object.entries(bl.byDifficulty)].filter(([, b]) => b.matched);
    L.push(mdTable(["Recorte", "Pares", ...["regional", "playoffs", "major", "title:major", "worlds", "title:worlds"].map((k) => k + " base→agora"), "Δ temp. Major p50", "Insolv. base→agora"],
      rows.map(([k, b]) => [k, b.matched, ...["regional", "playoffs", "major", "title:major", "worlds", "title:worlds"].map((x) => `${pct(b.reach[x].baseline)}→${pct(b.reach[x].now)} (${pp(b.reach[x].delta)})`),
        med(b.reach.major.seasonDeltaBothReached, 1), `${pct(b.insolvency.baseline)}→${pct(b.insolvency.now)}`])), "");
    L.push(mdTable(["Recorte", "Pares", "Segundas neg. p50", "Emprést. bot (arc) p50", "Caixa S1 p50", "Caixa S2 p50", "Caixa S3 p50", "Caixa final p50", "Razão folha/receita S6–10 p50", "Backer"],
      rows.map(([k, b]) => [k, b.matched, `${med(b.negativeMondays.baseline)}→${med(b.negativeMondays.now)}`, `${med(b.bankLoans.baseline)}→${med(b.bankLoans.now)}`,
        `${med(b.cashS1.baseline)}→${med(b.cashS1.now)}`, `${med(b.cashS2.baseline)}→${med(b.cashS2.now)}`, `${med(b.cashS3.baseline)}→${med(b.cashS3.now)}`,
        `${med(b.finalCash.baseline)}→${med(b.finalCash.now)}`, `${med(b.lateRatio.baseline, 2)}→${med(b.lateRatio.now, 2)}`, `${pct(b.emergencyLoan.baseline)}→${pct(b.emergencyLoan.now)}`])), "");
  }
  // notes
  L.push("## Notas de dados", "");
  if (!rep.dataNotes.length) L.push("Nenhuma anomalia detectada pelas checagens automáticas.");
  for (const n of rep.dataNotes) L.push(`- ${n}`);
  const fp = Object.entries(rep.fieldPresence).map(([k, v]) => `${k} ${pct(v.share)}`).join(" · ");
  if (fp) L.push("", `Presença de campos: ${fp}.`);
  L.push("");
  return L.join("\n");
}

// ------------------------------------------------------------------ CLI
function argOf(args, name) { const i = args.indexOf(name); return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : null; }
async function main(args) {
  const input = argOf(args, "--input"), out = argOf(args, "--out"), baseline = argOf(args, "--baseline");
  if (!input || !out) throw Error("Usage: node src/store/auditHumanSummaryReport.mjs --input <run dir> --out <prefix> [--baseline <F4a-baseline-summary.json>]");
  const report = await buildHumanReport({ input, baselinePath: baseline });
  const prefix = resolve(out);
  mkdirSync(dirname(prefix), { recursive: true });
  writeFileSync(prefix + ".json", JSON.stringify(report, null, 1));
  writeFileSync(prefix + ".md", renderMd(report));
  writeFileSync(prefix + "-cells.csv", csvText(report.cellProfileRows));
  const cov = report.coverage, b = report.groups["base: todas"], f = b.funnel;
  const tiers = TIERS.map((t) => `${t} ${cov.done.byTier[t] ?? 0}/${cov.plan.plannedByTier?.[t] ?? "?"}`).join(" · ");
  console.log(`rc.37 report: ${report.input}`);
  console.log(`  units done ${cov.done.units}/${cov.plan.plannedUnits ?? "?"} (${tiers}); lines used ${cov.lines.selected} (superseded ${cov.lines.superseded}, pending ${cov.lines.pendingNotDone}, partial ${cov.lines.partialOrMalformed})`);
  console.log(`  records: ${Object.entries(cov.careersByCohort).map(([k, v]) => `${k} ${v}`).join(" · ")}; softlocks ${cov.softlocks.careers}+${cov.softlocks.pairs}; errors ${cov.errors.count}`);
  console.log(`  base careers ${b.n}: regional ≤split2 ${pct(b.early.regionalBySplit2)} · major ${pct(f.major.share)} · worlds ${pct(f.worlds.share)} · title ${pct(f["title:worlds"].share)} · insolvency ${pct(b.failures.share)}`);
  console.log(`  baseline pairs ${report.baseline?.overall.matched ?? "-"}; data notes ${report.dataNotes.length}; wrote ${prefix}.md, .json, -cells.csv (${report.cellProfileRows.length} rows) in ${(report.elapsedMs / 1000).toFixed(1)}s`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exit(1); });
}
