/**
 * Standalone validator for teams-sam.md — mirrors scripts/build-dataset.mjs
 * parse logic and simulates the MERGE (existing teams.md + teams-sam.md) to
 * catch the only hard failure (duplicate lineup ids) plus parse errors, and to
 * dump personKeys/flags for eyeballing. No file writes, no side effects.
 *
 * Usage: node validate-sam.mjs <path-to-real-teams.md> <path-to-teams-sam.md>
 */
import { readFileSync } from "node:fs";

const realPath = process.argv[2];
const newPath = process.argv[3];

const stripDiacritics = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const personKeyOf = (nick) => stripDiacritics(nick).toLowerCase().replace(/[^a-z0-9]/g, "");
const slugOf = (name) =>
  stripDiacritics(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const SEASON_SLUG = {
  S1: "s1", S2: "s2", S3: "s3", S4: "s4", S5: "s5", S6: "s6", S7: "s7", S8: "s8",
  S9: "s9", "RLCS X": "x", "2021-22": "2122", "2022-23": "2223", 2024: "2024",
  2025: "2025", 2026: "2026",
};
const ORG_ALIAS = {
  "chiefs-esc": "chiefs-esports-club", "team-dignitas": "dignitas",
  "renault-vitality": "team-vitality", "mockit-esports": "mock-it-esports",
  "mock-it-esports-eu": "mock-it-esports", "quiktrip-pioneers-gaming": "pioneers",
};
const REGION_SPLIT_ORGS = new Set(["pioneers", "fut-esports"]);
const orgIdOf = (name, region) => {
  const id = ORG_ALIAS[slugOf(name)] ?? slugOf(name);
  return REGION_SPLIT_ORGS.has(id) ? `${id}-${region.toLowerCase()}` : id;
};

function parseFile(src, label) {
  const lines = src.split(/\r?\n/);
  let region = null, block = null;
  const teams = [];
  for (const line of lines) {
    const m = line.match(/^###\s+([A-Z]+)\s*$/);
    if (m) region = m[1];
    if (line.startsWith("```team:")) {
      block = { region, teamLine: line.replace(/^```team:\s*/, "").trim(), rows: [], label };
      continue;
    }
    if (block) {
      if (line.startsWith("```")) { teams.push(block); block = null; }
      else if (line.trim()) block.rows.push(line.trim());
    }
  }
  return teams;
}

const parsePerson = (v) => {
  const first = (v ?? "-").split("/")[0].trim();
  if (!first || first === "-") return null;
  const mt = first.match(/^(.*\S)\s+(\d{2})$/);
  if (!mt) throw new Error(`Cannot parse person entry: "${v}"`);
  return { nick: mt[1].trim(), overall: Number(mt[2]) };
};

const real = parseFile(readFileSync(realPath, "utf8"), "real");
const neu = parseFile(readFileSync(newPath, "utf8"), "new");

const ids = new Map();      // lineupId -> label
const dupes = [];
const parseErrors = [];
const newPersons = new Map(); // key -> {nick, overalls:Set, seasons:Set}
let newCount = 0, flaggedCount = 0;

for (const t of [...real, ...neu]) {
  const get = (p) => t.rows.find((r) => r.toLowerCase().startsWith(p))?.split(/:(.*)/s)[1]?.trim() ?? "-";
  const [orgName, seasonKey] = t.teamLine.split("·").map((s) => s.trim());
  const slug = SEASON_SLUG[seasonKey];
  if (!slug) { parseErrors.push(`${t.label}: unknown season "${seasonKey}" in "${t.teamLine}"`); continue; }
  const orgId = orgIdOf(orgName, t.region ?? "??");
  const lineupId = `${orgId}-${slug}`;
  if (ids.has(lineupId)) dupes.push(`${lineupId}  (${ids.get(lineupId)}  ↔  ${t.label}:${t.teamLine})`);
  else ids.set(lineupId, `${t.label}:${t.teamLine}`);

  const people = [];
  try {
    for (const n of [1, 2, 3]) { const p = parsePerson(get(`player ${n}`)); if (!p) throw new Error(`missing player ${n}`); people.push(p); }
    const sub = parsePerson(get("sub")); if (sub) people.push(sub);
    const coach = parsePerson(get("coach")); if (coach) people.push(coach);
  } catch (e) { parseErrors.push(`${t.label}: ${t.teamLine} → ${e.message}`); }

  if (t.label === "new") {
    newCount++;
    if (/\bsam-only\b/i.test(get("flag"))) flaggedCount++;
    else parseErrors.push(`new: ${t.teamLine} → MISSING flag: sam-only`);
    for (const p of people) {
      const k = personKeyOf(p.nick);
      if (!newPersons.has(k)) newPersons.set(k, { nick: p.nick, overalls: new Set(), seasons: new Set() });
      newPersons.get(k).overalls.add(p.overall);
      newPersons.get(k).seasons.add(seasonKey);
    }
  }
}

console.log(`Parsed: ${real.length} real teams + ${neu.length} new teams`);
console.log(`New lineups: ${newCount}  ·  carrying flag: ${flaggedCount}`);
console.log(`Total unique lineup ids: ${ids.size}`);
console.log(`\n${dupes.length ? "❌ DUPLICATE lineup ids (would break build:data):" : "✅ no duplicate lineup ids (merge is clean)"}`);
dupes.forEach((d) => console.log("   " + d));
console.log(`\n${parseErrors.length ? "❌ PARSE/FLAG errors:" : "✅ no parse/flag errors"}`);
parseErrors.forEach((e) => console.log("   " + e));

console.log(`\nDistinct persons introduced/used in new file: ${newPersons.size}`);
const multi = [...newPersons.entries()].filter(([, v]) => v.overalls.size > 1);
console.log(`Persons with multiple overalls across seasons (career arc — expected):`);
multi.sort((a,b)=>a[0].localeCompare(b[0])).forEach(([k, v]) =>
  console.log(`   ${k} (${v.nick}): ${[...v.overalls].sort((a,b)=>a-b).join("/")}  [${[...v.seasons].join(", ")}]`));
