// node scripts/report-career-pacing.mjs dump1.json dump2.json > report.md
// Historical raw dumps retain zero-based indices; ALL displayed seasons/splits are ordinals.
import { readFileSync } from "node:fs";

const files = process.argv.slice(2);
if (!files.length) throw new Error("Pass PACING_OUT JSON files (one snapshot per report)");
const dumps = files.map(f => JSON.parse(readFileSync(f, "utf8")));
const careers = dumps.flatMap(d => d.careers);
const versions = [...new Set(dumps.map(d => d.balanceVersion))];
// The first rc.36.3 dumps predate this metadata; their historical timeline was six seasons.
const timelineSeasons = dumps.find(d => d.timelineSeasons)?.timelineSeasons ?? 6;
if (versions.length !== 1) throw new Error("Do not mix balance versions in one report");
const ids = careers.map(c => [c.region, c.difficulty, c.policy, c.seed].join(":"));
if (new Set(ids).size !== ids.length) throw new Error("Duplicate careers; refuse to double-count");
const q = (xs, p = .5) => {
  const sorted = xs.filter(Number.isFinite).sort((a, b) => a - b);
  return sorted.length ? sorted[Math.round(p * (sorted.length - 1))] : null;
};
const n = x => x == null ? "—" : x.toFixed(1);
const pct = (count, total) => total ? `${Math.round(100 * count / total)}% (${count}/${total})` : "—";
const rate = xs => pct(xs.filter(Boolean).length, xs.length);
const groups = key => [...Map.groupBy(careers, key)].sort(([a], [b]) => a.localeCompare(b));
const first = (c, tier, title = false) => c.events.find(e => e.tier === tier && (!title || e.placement === "champion"));
const timing = (cs, tier, title = false, split = false) => {
  const values = cs.map(c => {
    const e = first(c, tier, title);
    return e ? (split ? e.season * 3 + e.split : e.season + 1) : null;
  }).filter(v => v !== null);
  return values.length ? `${n(q(values))} [${values.length}/${cs.length}]` : `— [0/${cs.length}]`;
};
const lines = ["# Career pacing — measured, not a human success forecast", "",
  `${careers.length} careers · balanceVersion ${versions[0]} · ${new Set(careers.map(c => c.seed)).size} seed(s) per cell · up to ${Math.max(...careers.map(c => c.seasons.length))} seasons (${timelineSeasons} historical, then infinite).`, "",
  "Seasons and cumulative splits below start at 1. Milestone timing is the median **among achievers**, with achievers / all starts in brackets; a dash means never reached in the observation window. Never interpret non-achievers as late successes. Bankruptcy remains in every start-based denominator. Policies are deterministic examples, not a distribution of human players. Regional identities and quotas remain unequal.", "",
  "## Timing by region and policy", "",
  "| Difficulty · region · policy | n | First regional (split) | First Major (season) | First Major title | First Worlds title | Insolvent | Softlock |",
  "|---|---:|---|---|---|---|---|---|",
];
for (const [key, cs] of groups(c => `${c.difficulty} · ${c.region} · ${c.policy}`)) {
  lines.push(`| ${key} | ${cs.length} | ${timing(cs, "regional", false, true)} | ${timing(cs, "major")} | ${timing(cs, "major", true)} | ${timing(cs, "worlds", true)} | ${rate(cs.map(c => c.ended === "insolvency"))} | ${cs.filter(c => c.softlock).length} |`);
}
lines.push("", "## Early outcomes and progression", "",
  `| Difficulty | n | Regional by split 1 | By split 2 | By split 3 | Major before season 3 | Major by season 4 | Worlds title before S${timelineSeasons - 2} | Worlds title by S${timelineSeasons} |`,
  "|---|---:|---|---|---|---|---|---|---|");
for (const [key, cs] of groups(c => c.difficulty)) {
  const reached = (c, limit) => c.events.some(e => e.tier === "regional" && e.season * 3 + e.split <= limit);
  lines.push(`| ${key} | ${cs.length} | ${rate(cs.map(c => reached(c, 1)))} | ${rate(cs.map(c => reached(c, 2)))} | ${rate(cs.map(c => reached(c, 3)))} | ${rate(cs.map(c => c.firstMajorSeason !== null && c.firstMajorSeason < 2))} | ${rate(cs.map(c => c.firstMajorSeason !== null && c.firstMajorSeason < 4))} | ${rate(cs.map(c => c.worldsTitleSeason !== null && c.worldsTitleSeason < timelineSeasons - 3))} | ${rate(cs.map(c => c.worldsTitleSeason !== null && c.worldsTitleSeason < timelineSeasons))} |`);
}
lines.push("", "## First-season money and development", "",
  "| Difficulty · policy | n | Minimum cash p10 / p50 / p90 | Ever below $0 | Emergency loan | Insolvent in S1 | Rep p50 | Player gain p50 | T3 series wins | Qualifier series wins |",
  "|---|---:|---|---|---|---|---:|---:|---|---|");
for (const [key, cs] of groups(c => `${c.difficulty} · ${c.policy}`)) {
  const rows = cs.map(c => c.seasons[0]);
  const lows = rows.map(r => r.balanceMin);
  const growth = rows.flatMap(r => r.training?.players.map(p => p.gain) ?? []);
  const wins = tier => {
    const wl = rows.reduce(([w, l], r) => [w + (r.series?.[tier]?.[0] ?? 0), l + (r.series?.[tier]?.[1] ?? 0)], [0, 0]);
    return pct(wl[0], wl[0] + wl[1]);
  };
  lines.push(`| ${key} | ${cs.length} | ${[.1, .5, .9].map(p => n(q(lows, p))).join(" / ")} | ${rate(lows.map(v => v < 0))} | ${rate(cs.map(c => c.checkpoints.some(p => p.season === 0 && p.emergencyLoans > 0)))} | ${rate(cs.map(c => c.ended === "insolvency" && c.seasons.length === 1))} | ${n(q(rows.map(r => r.rep)))} | ${n(q(growth))} | ${wins("t3")} | ${wins("qualifier")} |`);
}
lines.push("", "## By season (surviving rows; count included)", "",
  "| Difficulty · season | n | Majors entered / row | Worlds entries | Major titles | Worlds titles | Rep p10 / p50 / p90 | Cash end p10 / p50 / p90 |",
  "|---|---:|---:|---|---:|---:|---|---|");
for (const difficulty of ["easy", "normal", "hard"]) {
  const cs = careers.filter(c => c.difficulty === difficulty);
  for (let season = 0; season < 8; season++) {
    const alive = cs.filter(c => c.seasons[season]);
    if (!alive.length) continue;
    const rows = alive.map(c => c.seasons[season]);
    const titles = tier => alive.flatMap(c => c.events).filter(e => e.season === season && e.tier === tier && e.placement === "champion").length;
    lines.push(`| ${difficulty} · S${season + 1} | ${rows.length} | ${n(rows.reduce((a, r) => a + r.majorsQualified, 0) / rows.length)} | ${rate(rows.map(r => r.worlds !== null))} | ${titles("major")} | ${titles("worlds")} | ${[.1, .5, .9].map(p => n(q(rows.map(r => r.rep), p))).join(" / ")} | ${[.1, .5, .9].map(p => n(q(rows.map(r => r.balanceEnd), p))).join(" / ")} |`);
  }
}
lines.push("", "Full cell/seed/event/checkpoint data is in the input JSON files. Weekly cash is observed after real decisions; intraday cash before a rescue is not sampled. Loans and bankruptcy are also covered by focused flow tests. Neither a bot sweep nor a passing test is human playtest approval.");
console.log(lines.join("\n"));
