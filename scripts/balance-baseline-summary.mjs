// node scripts/balance-baseline-summary.mjs <dir-with-pace*.json-and-end*.json> [gap.json]
// Prints markdown tables for docs/BALANCE-BASELINE-v2.0.35.md. Reads PACING_OUT / ENDGAME_OUT / GAP_OUT dumps.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
const dir = process.argv[2];
const files = readdirSync(dir).filter(f => f.endsWith(".json"));
const load = p => files.filter(f => f.startsWith(p)).flatMap(f => JSON.parse(readFileSync(join(dir, f), "utf8")).careers);
const pace = load("pace"), end = load("end");
const med = xs => { xs = xs.filter(Number.isFinite).sort((a, b) => a - b); return xs.length ? xs[Math.floor(xs.length / 2)] : null; };
const f = (xs, n) => xs.length ? `${med(xs)} [${xs.length}/${n}]` : `— [0/${n}]`;
const first = (c, tier, title) => c.events.find(e => e.tier === tier && (!title || e.placement === "champion"));
console.log(`pace careers ${pace.length}, endgame careers ${end.length}, softlock flagged ${pace.filter(c => c.softlock).length + end.filter(c => c.softlock).length}`);
console.log("\n## Career-real series win rate by gap (user - opponent), pacing dumps\n| diff | bucket | won | lost | win % |\n|---|---|--:|--:|--:|");
for (const diff of ["normal", "hard"]) {
  const t = {};
  for (const c of pace.filter(c => c.difficulty === diff)) for (const s of c.seasons) for (const [k, [w, l]] of Object.entries(s.seriesByGap ?? {})) { t[k] ??= [0, 0]; t[k][0] += w; t[k][1] += l; }
  for (const k of ["≤ −6", "−6 to −2", "even (±2)", "2 to 6", "≥ 6"]) if (t[k]) console.log(`| ${diff} | ${k} | ${t[k][0]} | ${t[k][1]} | ${(100 * t[k][0] / (t[k][0] + t[k][1])).toFixed(1)} |`);
}
console.log("\n## Milestones: median season (1-based) among achievers [achievers/starts], pooled autopilot+tuned x 3 seeds\n| region | diff | 1st regional final* | 1st regional title | 1st Worlds | Worlds title | insolvent |\n|---|---|---|---|---|---|---|");
for (const r of ["NA", "EU", "SAM", "MENA", "OCE", "APAC", "SSA"]) for (const d of ["normal", "hard"]) {
  const cs = pace.filter(c => c.region === r && c.difficulty === d);
  const at = (tier, title, pl) => cs.map(c => { const e = c.events.find(e => e.tier === tier && (pl ? pl(e.placement) : !title || e.placement === "champion")); return e ? e.season + 1 : null; }).filter(x => x !== null);
  console.log(`| ${r} | ${d} | ${f(at("regional", false, p => p === "champion" || p === "runner_up"), cs.length)} | ${f(at("regional", true), cs.length)} | ${f(cs.map(c => c.firstWorldsSeason !== null ? c.firstWorldsSeason + 1 : null).filter(x => x !== null), cs.length)} | ${f(cs.map(c => c.worldsTitleSeason !== null ? c.worldsTitleSeason + 1 : null).filter(x => x !== null), cs.length)} | ${cs.filter(c => c.ended === "insolvency").length}/${cs.length} |`);
}
console.log("\n## Endgame (professional, paid, 8 seasons): events where user rating >= 100\n| diff | tier | events | titles | title % | series won | series lost | loss % | careers w/ >=1 event |\n|---|---|--:|--:|--:|--:|--:|--:|--:|");
for (const d of ["normal", "hard"]) for (const tier of ["major", "worlds"]) {
  const cs = end.filter(c => c.difficulty === d);
  const es = cs.flatMap(c => c.events.filter(e => e.tier === tier && e.rating >= 100));
  const w = es.reduce((s, e) => s + e.series.filter(x => x.won).length, 0), l = es.reduce((s, e) => s + e.series.filter(x => !x.won).length, 0);
  const t = es.filter(e => e.placement === "champion").length;
  console.log(`| ${d} | ${tier} | ${es.length} | ${t} | ${es.length ? (100 * t / es.length).toFixed(0) : "—"} | ${w} | ${l} | ${w + l ? (100 * l / (w + l)).toFixed(0) : "—"} | ${cs.filter(c => c.events.some(e => e.tier === tier && e.rating >= 100)).length} |`);
}
const ratings = end.flatMap(c => c.events.filter(e => e.tier === "worlds").map(e => e.rating)).filter(Number.isFinite);
console.log(`\nWorlds-entry rating, all endgame careers: median ${med(ratings)}, p90 ${ratings.sort((a, b) => a - b)[Math.floor(.9 * ratings.length)]}, max ${Math.max(...ratings)}, n=${ratings.length}`);
if (process.argv[3]) { const g = JSON.parse(readFileSync(process.argv[3], "utf8")); console.log("\n## Gap probe (engine, bo5, normal)"); for (const r of g.rows.filter(r => r.difficulty === "normal" && r.stage === "swiss" && r.bestOf === 5 && r.base === 88)) console.log(`+${r.gap}: fav ${(100 * r.favouriteWin).toFixed(1)}% upset ${(100 * r.upset).toFixed(1)}%`); }
console.log("\n## Endgame, ALL events (no 100+ team ever appears: see max rating above)\n| diff | tier | events | titles | title % | series loss % | median rating | median gap to strongest |\n|---|---|--:|--:|--:|--:|--:|--:|");
for (const d of ["normal", "hard"]) for (const tier of ["major", "worlds"]) {
  const es = end.filter(c => c.difficulty === d).flatMap(c => c.events.filter(e => e.tier === tier));
  const w = es.reduce((s, e) => s + e.series.filter(x => x.won).length, 0), l = es.reduce((s, e) => s + e.series.filter(x => !x.won).length, 0), t = es.filter(e => e.placement === "champion").length;
  console.log(`| ${d} | ${tier} | ${es.length} | ${t} | ${(100 * t / es.length).toFixed(0)} | ${(100 * l / (w + l)).toFixed(0)} | ${med(es.map(e => e.rating))} | ${med(es.map(e => e.maxOpponent - e.rating))} |`);
}
console.log("\n## Pacing: careers reaching a Major / Worlds / Worlds title within 8 seasons (of 6 per cell)\n| region | diff | Major | Worlds | Worlds title |\n|---|---|--:|--:|--:|");
for (const r of ["NA", "EU", "SAM", "MENA", "OCE", "APAC", "SSA"]) for (const d of ["normal", "hard"]) {
  const cs = pace.filter(c => c.region === r && c.difficulty === d);
  console.log(`| ${r} | ${d} | ${cs.filter(c => c.firstMajorSeason !== null).length} | ${cs.filter(c => c.firstWorldsSeason !== null).length} | ${cs.filter(c => c.worldsTitleSeason !== null).length} |`);
}
