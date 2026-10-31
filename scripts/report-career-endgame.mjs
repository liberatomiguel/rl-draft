// node scripts/report-career-endgame.mjs <directory-of-ENDGAME-dumps> > report.md
// Displayed seasons start at 1; raw dumps retain zero-based indices.
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.argv[2];
if (!root) throw new Error("Pass the directory with endgame-before/after-0..3 and mixed dumps");
const read = name => JSON.parse(readFileSync(join(root, name), "utf8"));
const load = names => {
  const dumps = names.map(read);
  const careers = dumps.flatMap(d => d.careers);
  const ids = careers.map(key);
  if (new Set(ids).size !== ids.length) throw new Error("Duplicate career in one cohort");
  if (dumps.some(d => d.timelineSeasons !== 6)) throw new Error("Review historical boundary");
  return careers;
};
const key = x => [x.region, x.difficulty, x.rosterKey, x.policy, x.seed].join(":");
const cohorts = [
  ["Matrix · control", load([0, 1, 2, 3].map(i => `endgame-before-${i}.json`))],
  ["Matrix · candidate", load([0, 1, 2, 3].map(i => `endgame-after-${i}.json`))],
  ["Prospects · control", load(["endgame-mixed-baseline.json"])],
  ["Prospects · candidate", load(["endgame-mixed-candidate.json"])],
];
for (const [old, updated] of [[0, 1], [2, 3]]) {
  if (cohorts[old][1].map(key).sort().join() !== cohorts[updated][1].map(key).sort().join()) throw new Error("Unpaired starts");
}
const required = ["NA", "EU", "SAM", "MENA", "OCE", "APAC", "SSA"].flatMap(r =>
  ["easy", "normal", "hard"].flatMap(d => ["balanced", "prospects", "journeymen"].map(s => `${r}:${d}:${s}`)));
for (const [, careers] of cohorts.slice(0, 2)) {
  const cells = careers.map(x => `${x.region}:${x.difficulty}:${x.rosterKey}`).sort();
  if (cells.join() !== [...required].sort().join()) throw new Error("Incomplete 3 × 3 × 7 matrix");
}
const events = (a, tier) => a.flatMap(x => x.events.filter(e => e.tier === tier && e.season < 6));
const achieved = (a, k) => a.filter(x => x[k] !== null && x[k] < 6).length;
const seasons = a => a.flatMap(x => x.seasons.filter(s => s.seasonIndex < 6));
const medal = (a, tier) => events(a, tier).filter(e => e.placement === "champion").length;
const everGear = (a, k) => a.filter(x => x.support.some(s => s.season < 6 && s.gear[k])).length;
const median = a => {
  if (!a.length) return "—";
  const s = [...a].sort((x, y) => x - y), i = Math.floor(s.length / 2);
  return (s.length % 2 ? s[i] : (s[i - 1] + s[i]) / 2).toFixed(1);
};
const lines = ["# Paid endgame progression — measured cohorts", "",
  "The full matrix is 3 difficulties × 3 founding rosters × 7 regions, one seed (9100) per cell. The supplement is Normal/prospects/contender, seven regions × two seeds (9100, 17019). Each snapshot contains 77 starts. The report verifies all 63 cells and paired identities. Six historical seasons; years 7–8 are additional observation, never historical success.", "",
  "The professional policy buys current upgrades; the contender policy develops prospects then buys strength after reaching a Major. Both attempt real paid facilities, staff and bootcamps subject to reputation, prerequisites, affordability and runway. Attempting purchases is not forcing ownership. These deterministic policies do not estimate the distribution of human choices.", "",
  "## Historical outcomes (S1–6)", "",
  "| Cohort | Difficulty | Starts | Reached Major | Major titles | Reached Worlds | Worlds entries | Worlds titles | Insolvent over 8 seasons | Softlock |",
  "|---|---|---:|---:|---:|---:|---:|---:|---:|---:|"];
for (const [name, a] of cohorts) for (const diff of ["easy", "normal", "hard"]) {
  const g = a.filter(x => x.difficulty === diff);
  if (!g.length) continue;
  lines.push(`| ${name} | ${diff} | ${g.length} | ${achieved(g, "firstMajorSeason")} | ${medal(g, "major")} | ${achieved(g, "firstWorldsSeason")} | ${events(g, "worlds").length} | ${medal(g, "worlds")} | ${g.filter(x => x.ended === "insolvency").length} | ${g.filter(x => x.softlock).length} |`);
}
lines.push("", "## Actual purchases in S1–6", "",
  "Ownership is the number of careers owning an item at a historical season-end snapshot. Camps and signings count successful transactions; a star signing is overall ≥88 at signing, per the arc harness.", "",
  "| Cohort | Starts | Peripherals | Monitors | PCs | Centre | Psychologist | Paid/free legal camps | Signings | Star signings |",
  "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|");
for (const [name, a] of cohorts) {
  const ss = seasons(a);
  lines.push(`| ${name} | ${a.length} | ${["peripherals", "monitors", "pcs", "perfCenter", "psychologist"].map(k => everGear(a, k)).join(" | ")} | ${ss.reduce((s, x) => s + x.bootcamps, 0)} | ${ss.reduce((s, x) => s + x.signings, 0)} | ${ss.reduce((s, x) => s + x.starSignings, 0)} |`);
}
lines.push("", "## Worlds strength in S1–6", "",
  "| Cohort | Difficulty | Entries | Median user rating | Median gap to strongest opponent |",
  "|---|---|---:|---:|---:|");
for (const [name, a] of cohorts) for (const diff of ["easy", "normal", "hard"]) {
  const es = events(a.filter(x => x.difficulty === diff), "worlds");
  if (es.length) lines.push(`| ${name} | ${diff} | ${es.length} | ${median(es.map(e => e.rating))} | ${median(es.map(e => e.maxOpponent - e.rating))} |`);
}
lines.push("", "## Controlled replay — conditional on already qualifying", "",
  "Each row freezes the latest historical Worlds field actually reached by that candidate career and replays 128 matched tournament seeds. The control removes only the new flat centre/structured-camp edge; rosters, psychology stats, opponents and difficulty are identical. This isolates a rating effect, not complete old-vs-new careers. No extra money, overall or qualification is granted. These are NOT 128 new careers, nor a human title probability per start.", "",
  "| Cohort | Region | Difficulty | Roster | Career seed | Worlds season | Added rating | Titles control → candidate / 128 | Playoffs control → candidate / 128 |",
  "|---|---|---|---|---:|---:|---:|---|---|");
for (const index of [1, 3]) {
  const [name, a] = cohorts[index];
  const rs = a.filter(x => x.replay);
  for (const x of rs) {
    const r = x.replay;
    lines.push(`| ${name} | ${x.region} | ${x.difficulty} | ${x.rosterKey} | ${x.seed} | ${r.season + 1} | ${r.ratingChange} | ${r.titles.join(" → ")} | ${r.playoffs.join(" → ")} |`);
  }
  const total = rs.reduce((s, x) => s + x.replay.repetitions, 0);
  const counts = k => [0, 1].map(i => rs.reduce((s, x) => s + x.replay[k][i], 0)).join(" → ");
  lines.push("", `${name}: ${rs.length} qualified fields, ${total} replays per variant; titles ${counts("titles")}; playoffs ${counts("playoffs")}.`, "");
}
lines.push("## Candidate matrix — every cell", "",
  "First milestones show the historical season, or — if absent in S1–6. Insolvency includes the two infinite years.", "",
  "| Region | Difficulty | Roster | First Major | First Worlds | Centre by S6 | Insolvent |",
  "|---|---|---|---:|---:|---|---|");
for (const x of [...cohorts[1][1]].sort((a, b) => key(a).localeCompare(key(b)))) {
  const first = k => x[k] !== null && x[k] < 6 ? x[k] + 1 : "—";
  lines.push(`| ${x.region} | ${x.difficulty} | ${x.rosterKey} | ${first("firstMajorSeason")} | ${first("firstWorldsSeason")} | ${everGear([x], "perfCenter") ? "yes" : "no"} | ${x.ended === "insolvency" ? "yes" : "no"} |`);
}
console.log(lines.join("\n"));
