// Mundo vivo M3: tables from careerRegionCurve.probe dumps.
//   node scripts/region-curve-summary.mjs <dir> [--careers]
// "by T5" = seasonIndex 0..4 (the PostHog doc's T1 = seasonIndex 0).
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const dir = process.argv[2];
const careersOut = process.argv.includes("--careers");
const rows = readdirSync(dir)
  .filter((f) => f.endsWith(".json"))
  .flatMap((f) => JSON.parse(readFileSync(join(dir, f), "utf8")))
  // A career is deterministic (seed + config): the same one found in two dumps is counted once.
  .filter((c, i, all) => all.findIndex((x) => x.policy === c.policy && x.region === c.region && x.difficulty === c.difficulty && x.seed === c.seed) === i);
const k = (n) => `${Math.round(n / 1000)}k`;
const med = (xs) => {
  const s = xs.filter((x) => x != null && !Number.isNaN(x)).sort((a, b) => a - b);
  return s.length ? s[Math.floor((s.length - 1) / 2)] : null;
};
const f1 = (x) => (x == null ? "—" : (Math.round(x * 10) / 10).toString());

if (careersOut) {
  for (const c of rows)
    console.log(`${c.region}/${c.difficulty}/${c.policy}/${c.seed} ended=${c.ended} ` +
      c.seasons.map((s) => `S${s.season}:${s.regionalFinal ? (s.regionalTitle ? "T" : "F") : "-"} ${s.userRating}/${s.top4} o${s.starterOvr} ${k(s.balanceEnd)}(${k(s.balanceMin)})`).join(" | "));
}

const groups = new Map();
for (const c of rows) {
  const key = `${c.region} ${c.difficulty} ${c.policy}`;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(c);
}
const byFinal = (c, last) => c.seasons.some((s) => s.season <= last && s.regionalFinal);
const firstOf = (c, f) => c.seasons.find(f)?.season ?? null;

console.log("\n== milestones: n | ended early | final by T3/T5/T7/T9 | 1st final med | 1st title med | ovr T5/T7 p50 | gap(user-top4) T1/T3/T5/T7");
for (const [key, cs] of [...groups].sort()) {
  const n = cs.length;
  const pct = (last) => {
    const pool = cs.filter((c) => c.seasons.length > last || byFinal(c, last));
    return pool.length ? `${Math.round((100 * pool.filter((c) => byFinal(c, last)).length) / pool.length)}%` : "—";
  };
  const at = (si, f) => med(cs.map((c) => { const s = c.seasons.find((x) => x.season === si); return s ? f(s) : null; }));
  const gap = (s) => (s.top4 ? s.userRating - s.top4 : null);
  console.log(`${key} | ${n} | ${cs.filter((c) => c.ended).length} | ${pct(2)}/${pct(4)}/${pct(6)}/${pct(8)} | ` +
    `${f1(med(cs.map((c) => firstOf(c, (s) => s.regionalFinal))))} | ${f1(med(cs.map((c) => firstOf(c, (s) => s.regionalTitle))))} | ` +
    `${f1(at(4, (s) => s.starterOvr))}/${f1(at(6, (s) => s.starterOvr))} | ${[0, 2, 4, 6].map((i) => f1(at(i, gap))).join("/")}`);
}

console.log("\n== per season (p50): region diff policy | S: user/top4/top1 ovr bal(min) payroll");
for (const [key, cs] of [...groups].sort()) {
  const maxS = Math.max(...cs.flatMap((c) => c.seasons.map((s) => s.season)));
  const parts = [];
  for (let si = 0; si <= maxS; si++) {
    const ss = cs.map((c) => c.seasons.find((s) => s.season === si)).filter(Boolean);
    if (!ss.length) continue;
    parts.push(`S${si}:${f1(med(ss.map((s) => s.userRating)))}/${f1(med(ss.map((s) => s.top4)))}/${f1(med(ss.map((s) => s.top1)))} o${f1(med(ss.map((s) => s.starterOvr)))} ${k(med(ss.map((s) => s.balanceEnd)))}(${k(med(ss.map((s) => s.balanceMin)))}) p${k(med(ss.map((s) => s.payroll)))}`);
  }
  console.log(`${key} | ${parts.join(" | ")}`);
}
