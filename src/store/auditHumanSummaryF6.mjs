#!/usr/bin/env node
/**
 * rc.37 F6: paired comparison of experiment arms (auditHumanExperiment.test.ts)
 * with the battery's controls — the same unit key = the same region,
 * difficulty, roster, profile and seed, so each career is compared with
 * itself under the old balance. Read-only; prints Markdown.
 *
 *   node src/store/auditHumanSummaryF6.mjs --battery <run1 dir> --arm <dir> [--arm <dir> ...] [--by profile|family|region]
 *
 * Per group: Worlds title / Major title / Worlds reach / Major reach by S10,
 * insolvency, cash S10 p50, payroll ÷ revenue S6–S10 p50, team rating S6
 * and S10 p50, and the renewals (new wage ÷ market ask p50, raise × old wage
 * p50 / p90 / max). Paired title moves: careers that gained / lost a Worlds
 * title against the same career in the control.
 */
import { createReadStream, readdirSync } from "node:fs";
import { createInterface } from "node:readline";

const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const arms = args.flatMap((a, i) => (a === "--arm" ? [args[i + 1]] : []));
const batteryDir = opt("--battery") ?? "C:/Users/Miguel/CLAUDE/rc37-battery/run1";
const by = opt("--by") ?? "profile";
const FAMILY = { academy: "youth", prospectsOnly: "youth", stars: "buy", ambitious: "buy", buyAll: "buy", known: "buy",
  trader: "trade", continuous: "trade", homegrown: "keep", coachFixed: "keep", experienced: "keep",
  learner: "other", novice: "other", coachUpgrades: "other" };
const SPONSOR = ["sponsorBase", "sponsorBonus", "sponsorSigning"];

const q = (a, p = 0.5) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s.length ? s[Math.floor(p * (s.length - 1) + 0.5)] : null; };
const pct = (k, n) => (n ? `${Math.round((100 * k) / n)}%` : "–");
const money = (x) => (x === null ? "–" : Math.abs(x) >= 1e6 ? `${(x / 1e6).toFixed(2)}M` : `${Math.round(x / 1e3)}k`);
const r2 = (x) => (x === null ? "–" : String(Math.round(x * 100) / 100));

/** One career's outcome from a coverage line. */
function careerOf(r) {
  const seasons = (r.arc?.seasons ?? []).filter((s) => s.seasonIndex < 10);
  const ms = r.milestones ?? {};
  const seasonOf = (k, arcKey) => ms[k]?.season ?? (Number.isFinite(r.arc?.[arcKey]) ? r.arc[arcKey] + 1 : null);
  const ratios = [];
  for (const s of seasons) {
    if (s.seasonIndex + 1 < 6 || !s.income || !s.spend) continue;
    const i = s.income, o = s.spend;
    const revenue = (i.prize ?? 0) - (o.playerShare ?? 0) + SPONSOR.reduce((n, k) => n + (i[k] ?? 0), 0);
    const payroll = (o.payroll ?? 0) + (o.coachSalary ?? 0);
    if (revenue > 0) ratios.push(payroll / revenue);
  }
  const renewals = (r.actions ?? []).filter((a) => a.kind === "renewal" && a.renewal && a.season <= 10 && a.renewal.freshAsk > 0 && a.renewal.oldWage > 0)
    .map((a) => ({ ratio: a.renewal.newWage / a.renewal.freshAsk, raise: a.renewal.newWage / a.renewal.oldWage }));
  const rating = (n) => seasons.find((s) => s.seasonIndex === n - 1)?.teamRating ?? null;
  return {
    key: r.unit, region: r.region, difficulty: r.difficulty, roster: r.roster, profile: r.profile,
    worldsTitle: seasonOf("title:worlds", "worldsTitleSeason"), majorTitle: ms["title:major"]?.season ?? null,
    worlds: seasonOf("worlds", "firstWorldsSeason"), major: seasonOf("major", "firstMajorSeason"),
    insolvent: r.arc?.ended === "insolvency", softlock: Boolean(r.arc?.softlock),
    cash10: seasons.at(-1)?.balanceEnd ?? null, ratio: q(ratios), rating6: rating(6), rating10: rating(10),
    sales: seasons.reduce((n, s) => n + (s.sales ?? 0), 0), signings: seasons.reduce((n, s) => n + (s.signings ?? 0), 0),
    renewals,
  };
}

async function readDir(dir, keep) {
  const out = new Map();
  for (const f of readdirSync(dir).filter((x) => /^shard-\d+\.jsonl$/.test(x))) {
    for await (const line of createInterface({ input: createReadStream(`${dir}/${f}`), crlfDelay: Infinity })) {
      if (!line.includes('"cohort":"coverage"')) continue;
      const key = line.slice(9, line.indexOf('"', 9));
      if (keep && !keep.has(key)) continue;
      const r = JSON.parse(line);
      if (r.cohort !== "coverage" || !r.arc) continue;
      out.set(r.unit, careerOf(r));
    }
  }
  return out;
}

const groupOf = (c) => (by === "family" ? FAMILY[c.profile] ?? "1factor" : by === "region" ? c.region : by === "all" ? "all" : c.profile);
function block(list) {
  const n = list.length;
  const ren = list.flatMap((c) => c.renewals);
  return {
    n,
    worldsTitle: pct(list.filter((c) => c.worldsTitle !== null).length, n),
    majorTitle: pct(list.filter((c) => c.majorTitle !== null).length, n),
    worlds: pct(list.filter((c) => c.worlds !== null).length, n),
    major: pct(list.filter((c) => c.major !== null).length, n),
    firstWorlds: q(list.map((c) => c.worlds ?? NaN)),
    insolvent: pct(list.filter((c) => c.insolvent).length, n),
    cash10: money(q(list.map((c) => c.cash10))),
    ratio: r2(q(list.map((c) => c.ratio))),
    rating6: r2(q(list.map((c) => c.rating6))), rating10: r2(q(list.map((c) => c.rating10))),
    sales: r2(q(list.map((c) => c.sales))),
    renewRatio: r2(q(ren.map((x) => x.ratio))), raiseP50: r2(q(ren.map((x) => x.raise))), raiseP90: r2(q(ren.map((x) => x.raise), 0.9)),
    raiseMax: ren.length ? r2(Math.max(...ren.map((x) => x.raise))) : "–",
  };
}

const COLS = ["n", "worldsTitle", "majorTitle", "worlds", "major", "firstWorlds", "insolvent", "cash10", "ratio", "rating6", "rating10", "sales", "renewRatio", "raiseP50", "raiseP90", "raiseMax"];
const HEAD = ["n", "Worlds title", "Major title", "Worlds", "Major", "1st Worlds p50", "insolvent", "cash S10 p50", "payroll/revenue S6-10", "rating S6", "rating S10", "sales S1-10", "renewal ÷ market p50", "raise ×old p50", "p90", "max"];

for (const dir of arms) {
  const arm = await readDir(dir);
  const base = await readDir(batteryDir, new Set(arm.keys()));
  const name = dir.split(/[\\/]/).filter(Boolean).at(-1);
  console.log(`\n## ${name} vs battery control (${arm.size} paired careers; missing in control: ${[...arm.keys()].filter((k) => !base.has(k)).length})\n`);
  console.log(`| group | arm | ${HEAD.join(" | ")} | Worlds title gained / lost (paired) |`);
  console.log(`|---|---|${HEAD.map(() => "---").join("|")}|---|`);
  const groups = [...new Set([...arm.values()].map(groupOf))].sort();
  for (const g of [...groups, "ALL"]) {
    const inG = (c) => g === "ALL" || groupOf(c) === g;
    const A = [...arm.values()].filter(inG), B = A.map((c) => base.get(c.key)).filter(Boolean);
    let gained = 0, lost = 0;
    for (const c of A) { const b = base.get(c.key); if (!b) continue; if (c.worldsTitle !== null && b.worldsTitle === null) gained++; if (c.worldsTitle === null && b.worldsTitle !== null) lost++; }
    const bb = block(B), aa = block(A);
    console.log(`| ${g} | control | ${COLS.map((k) => bb[k] ?? "–").join(" | ")} | |`);
    console.log(`| ${g} | **${name}** | ${COLS.map((k) => aa[k] ?? "–").join(" | ")} | +${gained} / −${lost} |`);
  }
}
