/**
 * Liquipedia INTERNATIONAL MAJOR harvester (RLCS split era → present).
 * Fetches every international Major's participant list, parses each {{TeamCard}}
 * (team / p1-p3 / sub / coach), and cross-references our existing dataset to keep
 * ONLY teams that did NOT reach Worlds (Worlds orgs are already in src/data).
 *
 *   node scripts/fetch-liquipedia-majors.mjs
 *
 * ANALYSIS ONLY — writes proposal files under data-sources/, never touches game
 * data. Liquipedia etiquette: identified UA + 2.6s gap; resumable (raw cache).
 * Outputs:
 *   data-sources/majors-raw.json          every parsed Major team (cache)
 *   data-sources/majors-new-teams.json    NEW teams only (not in our Worlds DB),
 *                                          player overalls seeded from our DB
 *   data-sources/majors-harvest-report.md  human summary per Major
 *
 * Overalls are SEEDS for manual review: a player already in our DB carries their
 * existing overall; brand-new players are left blank. Final overalls are reviewed
 * by hand (see the review workbook).
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const API = "https://liquipedia.net/rocketleague/api.php";
const UA = "RocketDraft-TeamFetcher/0.1 (fan-made non-commercial game; contact: migliberato@gmail.com)";
const RATE_MS = 2600;

// Verified international Major event pages (each has {{TeamCard}} rosters). 2026
// Majors exist but have no confirmed participants yet, so they are omitted.
const MAJORS = [
  { title: "Rocket League Championship Series/2021-22/Fall", season: "rlcs-2021-22", year: "2021-22", label: "RLCS 2021-22 Fall Major" },
  { title: "Rocket League Championship Series/2021-22/Winter", season: "rlcs-2021-22", year: "2021-22", label: "RLCS 2021-22 Winter Major" },
  { title: "Rocket League Championship Series/2021-22/Spring", season: "rlcs-2021-22", year: "2021-22", label: "RLCS 2021-22 Spring Major" },
  { title: "Rocket League Championship Series/2022-23/Fall", season: "rlcs-2022-23", year: "2022-23", label: "RLCS 2022-23 Fall Major" },
  { title: "Rocket League Championship Series/2022-23/Winter", season: "rlcs-2022-23", year: "2022-23", label: "RLCS 2022-23 Winter Major" },
  { title: "Rocket League Championship Series/2022-23/Spring", season: "rlcs-2022-23", year: "2022-23", label: "RLCS 2022-23 Spring Major" },
  { title: "Rocket League Championship Series/2024/Major 1", season: "rlcs-2024", year: "2024", label: "RLCS 2024 Major 1" },
  { title: "Rocket League Championship Series/2024/Major 2", season: "rlcs-2024", year: "2024", label: "RLCS 2024 Major 2" },
  { title: "RLCS 2025 Birmingham Major", season: "rlcs-2025", year: "2025", label: "RLCS 2025 Birmingham Major" },
  { title: "RLCS 2025 Raleigh Major", season: "rlcs-2025", year: "2025", label: "RLCS 2025 Raleigh Major" },
];

const RAW = join(root, "data-sources", "majors-raw.json");
const NEW = join(root, "data-sources", "majors-new-teams.json");
const REPORT = join(root, "data-sources", "majors-harvest-report.md");

let lastCall = 0;
async function api(params) {
  const wait = lastCall + RATE_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
  const url = `${API}?${new URLSearchParams({ format: "json", formatversion: "2", ...params })}`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`API ${res.status} for ${params.titles}`);
  return res.json();
}
async function getWikitext(title) {
  const d = await api({ action: "query", prop: "revisions", titles: title, rvprop: "content", rvslots: "main", redirects: "1" });
  const p = d?.query?.pages?.[0];
  return p?.missing ? "" : p?.revisions?.[0]?.slots?.main?.content ?? "";
}

/** Parse all real {{TeamCard|team=...}} blocks (brace-depth aware). */
function parseTeamCards(wt) {
  const teams = [];
  let i = 0;
  while ((i = wt.indexOf("{{TeamCard", i)) >= 0) {
    if (wt.substr(i, 30).includes("Toggle") || wt.substr(i, 30).includes("columns")) { i += 10; continue; }
    let depth = 0, end = i;
    for (let j = i; j < wt.length; j++) {
      if (wt.substr(j, 2) === "{{") { depth++; j++; }
      else if (wt.substr(j, 2) === "}}") { depth--; j++; if (depth === 0) { end = j + 1; break; } }
    }
    const body = wt.slice(i, end);
    const arg = (name) => {
      const r = new RegExp(`\\|\\s*${name}\\s*=\\s*([^|}\\n]+)`, "i").exec(body);
      return r ? r[1].trim() : "";
    };
    const team = arg("team");
    if (team) {
      const players = [arg("p1"), arg("p2"), arg("p3")].map((s) => s.replace(/\s+$/, "")).filter(Boolean);
      teams.push({ team, players, sub: arg("sub4") || arg("sub"), coach: arg("c") || arg("coach"), qualifier: arg("qualifier") });
    }
    i = end;
  }
  return teams;
}

// --- our existing dataset (to exclude Worlds orgs + seed overalls) ---
const J = (p) => JSON.parse(readFileSync(join(root, p), "utf8"));
const lineups = J("src/data/lineups.json");
const orgs = J("src/data/orgs.json");
const players = J("src/data/players.json");
const playerCards = J("src/data/playerCards.json");
const orgName = new Map(orgs.map((o) => [o.id, o.name]));
const playerNick = new Map(players.map((p) => [p.id, p.nickname]));

const norm = (s) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/\b(the|esports|e-sports|gaming|clan|team|gg|club|sports)\b/g, "")
    .replace(/[^a-z0-9]/g, "");

// orgs present in our DB per season (normalized) — these went to Worlds.
const dbOrgsBySeason = {};
for (const l of lineups) {
  (dbOrgsBySeason[l.seasonId] = dbOrgsBySeason[l.seasonId] || new Set()).add(norm(orgName.get(l.orgId) || l.orgId));
}
// DB lineups per season as sets of normalized nicknames. The dedup signal is a
// SAME-LINEUP overlap: a Major team is a Worlds duplicate only if some DB lineup
// of that season shares >=2 of its players (same CORE). Counting players anywhere
// in the season over-skips, because rosters shuffle between splits (e.g. eRa
// Eternity's three players each reached Worlds on three DIFFERENT teams — eRa
// itself is a distinct, new team). Org-name is a secondary signal (sponsor
// prefixes / rebrands make it unreliable on its own).
const cardNick = new Map(playerCards.map((c) => [c.id, norm(playerNick.get(c.playerId) || c.playerId)]));
const dbLineupsBySeason = {};
for (const l of lineups) {
  (dbLineupsBySeason[l.seasonId] = dbLineupsBySeason[l.seasonId] || []).push(
    new Set(l.playerCardIds.map((id) => cardNick.get(id))),
  );
}
const maxSameLineupOverlap = (season, playerNames) => {
  const ns = playerNames.map(norm);
  let best = 0;
  for (const set of dbLineupsBySeason[season] || []) {
    const k = ns.filter((n) => set.has(n)).length;
    if (k > best) best = k;
  }
  return best;
};
// existing player overalls (normalized nickname → peak overall in our DB).
const dbPlayerOverall = new Map();
for (const c of playerCards) {
  const n = norm(playerNick.get(c.playerId) || c.playerId);
  const ov = c.overall + (c.manualAdjustment || 0);
  if (!dbPlayerOverall.has(n) || ov > dbPlayerOverall.get(n)) dbPlayerOverall.set(n, ov);
}

async function main() {
  const cache = existsSync(RAW) ? JSON.parse(readFileSync(RAW, "utf8")) : {};
  for (const M of MAJORS) {
    if (!cache[M.title]) {
      const teams = parseTeamCards(await getWikitext(M.title));
      cache[M.title] = { ...M, teams };
      writeFileSync(RAW, JSON.stringify(cache, null, 2));
      console.log(`${M.label}: ${teams.length} teams`);
    }
  }

  const report = ["# International Major harvest — NEW teams (not in our Worlds DB)\n",
    "Cross-referenced by org+season. Overalls are SEEDS (existing DB players carry their overall; new players blank) — MANUAL REVIEW required.\n"];
  const newTeams = [];
  for (const M of MAJORS) {
    const orgSet = dbOrgsBySeason[M.season] || new Set();
    const fresh = [], skipped = [], review = [];
    for (const t of cache[M.title].teams) {
      const orgMatch = orgSet.has(norm(t.team));
      const overlap = maxSameLineupOverlap(M.season, t.players); // shared with a single DB lineup
      // Skip = clearly a Worlds team: org name matches, OR a DB lineup shares the
      // same 2+ core players. A single shared player (core moved teams) is flagged
      // for manual review, not silently added/dropped.
      const dup = orgMatch || overlap >= 2;
      const status = dup ? "skip" : overlap === 1 ? "review" : "new";
      if (status === "skip") { skipped.push(t); continue; }
      const entry = {
        major: M.label, season: M.season, year: M.year, team: t.team, status,
        sameLineupOverlap: overlap,
        players: t.players.map((p) => ({ name: p, seedOverall: dbPlayerOverall.get(norm(p)) ?? null, knownPlayer: dbPlayerOverall.has(norm(p)) })),
        sub: t.sub || null, subSeed: t.sub ? dbPlayerOverall.get(norm(t.sub)) ?? null : null,
        coach: t.coach || null, qualifier: t.qualifier || null,
      };
      newTeams.push(entry);
      (status === "review" ? review : fresh).push(t);
    }
    report.push(`\n## ${M.label} — ${fresh.length} NEW / ${review.length} REVIEW / ${skipped.length} skipped (Worlds)`);
    const line = (t, tag) => {
      const seeds = t.players.map((p) => `${p}${dbPlayerOverall.has(norm(p)) ? `(${dbPlayerOverall.get(norm(p))})` : "(?)"}`).join(", ");
      return `- ${tag}**${t.team}** — ${seeds}${t.sub ? ` · sub: ${t.sub}` : ""}${t.coach ? ` · coach: ${t.coach}` : ""}`;
    };
    for (const t of fresh) report.push(line(t, ""));
    for (const t of review) report.push(line(t, "⚠️ REVIEW (1 player already in DB) "));
    if (skipped.length) report.push(`  _skipped: ${skipped.map((t) => t.team).join(", ")}_`);
  }

  writeFileSync(NEW, JSON.stringify(newTeams, null, 2));
  writeFileSync(REPORT, report.join("\n") + "\n");
  console.log(`\nNEW teams (not in Worlds DB): ${newTeams.length}`);
  console.log(`Wrote ${NEW} and ${REPORT}.`);
}
main().catch((e) => { console.error(e); process.exit(1); });
