/**
 * Liquipedia team fetcher (TEMPLATE / model) — pulls participant rosters from
 * Liquipedia tournament (or team) pages so we can propose NEW lineups to add to
 * data-sources/teams.md. ANALYSIS ONLY: writes proposal files, never touches
 * game data.
 *
 *   node scripts/fetch-liquipedia-teams.mjs
 *
 * Fill TARGETS below with the Liquipedia page titles you want to harvest (one per
 * tournament/region/season). Output:
 *   data-sources/liquipedia-teams-proposed.json   machine-readable (resumable cache)
 *   data-sources/liquipedia-teams-proposed.csv    rows for the "New Team Suggestions"
 *                                                 tab of community-suggestions.xlsx
 *   data-sources/liquipedia-teams-audit.md        human review (per target)
 *
 * Liquipedia etiquette (api-terms-of-use): identified User-Agent + a global 2.6s
 * gap between calls. Progress is written incrementally so a re-run resumes.
 *
 * Roster parsing is a BEST-EFFORT heuristic (Liquipedia templates vary by event):
 * it reads {{TeamCard}} / {{ParticipantTable}} blocks and {{Player|p#=...}} args.
 * Everything is graded so a human confirms before anything reaches teams.md —
 * NEVER bulk-trust the output. Refine extractTeams() per event format as needed.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const API = "https://liquipedia.net/rocketleague/api.php";
const UA =
  "RocketDraft-TeamFetcher/0.1 (fan-made non-commercial game; contact: migliberato@gmail.com)";
const RATE_MS = 2600;

// -------------------------------------------------------------------------
// WHAT TO HARVEST — fill these in for the run. Each entry is one Liquipedia
// page title plus the metadata we can't infer (season label / year / region /
// pool). Example titles are commented; replace with the real targets.
// -------------------------------------------------------------------------
const TARGETS = [
  // { title: "Rocket_League_Championship_Series/2024/Major_1", season: "RLCS 2024", year: "2024", region: "EU", pool: "Worlds" },
  // { title: "Team_Falcons", season: "RLCS 2024", year: "2024", region: "MENA", pool: "" },
];

const PROPOSED = join(root, "data-sources", "liquipedia-teams-proposed.json");
const CSV = join(root, "data-sources", "liquipedia-teams-proposed.csv");
const AUDIT = join(root, "data-sources", "liquipedia-teams-audit.md");

let lastCall = 0;
async function api(params) {
  const wait = lastCall + RATE_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
  const url = `${API}?${new URLSearchParams({ format: "json", formatversion: "2", ...params })}`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`API ${res.status} for ${params.titles ?? params.page}`);
  return res.json();
}

/** Raw wikitext of a page (follows redirects). "" if missing. */
async function getWikitext(title) {
  const data = await api({
    action: "query",
    prop: "revisions",
    titles: title,
    rvprop: "content",
    rvslots: "main",
    redirects: "1",
  });
  const page = data?.query?.pages?.[0];
  if (!page || page.missing) return { wikitext: "", resolvedTitle: null };
  return { wikitext: page.revisions?.[0]?.slots?.main?.content ?? "", resolvedTitle: page.title };
}

/**
 * Heuristic roster extraction from a tournament page's participant templates.
 * Handles the common {{TeamCard|team=...|p1=..|p2=..|p3=..|c=..}} shape and the
 * {{ParticipantTable}} wrapper. Returns [{ team, players:[], coach, raw }]. REFINE
 * per event when a format doesn't match — log the raw block for inspection.
 */
function extractTeams(wt) {
  const teams = [];
  if (!wt) return teams;
  // Grab each {{TeamCard ...}} (or {{TeamOpponent ...}}) block.
  const blockRe = /\{\{\s*(TeamCard|TeamOpponent)\b([\s\S]*?)\}\}/gi;
  let m;
  while ((m = blockRe.exec(wt)) !== null) {
    const body = m[2];
    const arg = (name) => {
      const r = new RegExp(`\\|\\s*${name}\\s*=\\s*([^|}\\n]+)`, "i").exec(body);
      return r ? r[1].trim() : "";
    };
    const team = arg("team") || arg("1");
    const players = [arg("p1"), arg("p2"), arg("p3")].filter(Boolean);
    const coach = arg("c") || arg("coach");
    if (team || players.length) {
      teams.push({ team, players, coach, raw: m[0].slice(0, 400) });
    }
  }
  return teams;
}

const csvCell = (s) => `"${String(s ?? "").replace(/"/g, '""')}"`;

async function main() {
  if (TARGETS.length === 0) {
    console.log(
      "No TARGETS set. Edit scripts/fetch-liquipedia-teams.mjs and add Liquipedia\n" +
        "page titles to the TARGETS array, then re-run. (This is the template.)",
    );
    return;
  }

  const cache = existsSync(PROPOSED) ? JSON.parse(readFileSync(PROPOSED, "utf8")) : {};
  const auditSections = [];
  const csvRows = [
    [
      "Org / Time", "Temporada (ex: RLCS 2024)", "Ano", "Região", "Player 1",
      "Player 2", "Player 3", "Coach (opcional)", "Sub (opcional)",
      "Org buff (~/+/++/+++)", "Força histórica", "Liquipedia URL", "Notas",
    ].map(csvCell).join(","),
  ];

  for (const t of TARGETS) {
    let entry = cache[t.title];
    if (!entry) {
      const { wikitext, resolvedTitle } = await getWikitext(t.title);
      entry = { ...t, resolvedTitle, teams: extractTeams(wikitext), found: Boolean(resolvedTitle) };
      cache[t.title] = entry;
      writeFileSync(PROPOSED, JSON.stringify(cache, null, 2)); // incremental
      console.log(`fetched ${t.title} → ${entry.teams.length} teams`);
    }

    const url = `https://liquipedia.net/rocketleague/${encodeURIComponent(t.title)}`;
    auditSections.push(
      `## ${t.title} (${t.season}, ${t.region})\n` +
        (entry.found ? "" : "**PAGE NOT FOUND — check the title.**\n") +
        entry.teams
          .map(
            (tm) =>
              `- **${tm.team || "?"}** — ${tm.players.join(", ") || "(no players parsed)"}` +
              (tm.coach ? ` · coach: ${tm.coach}` : ""),
          )
          .join("\n"),
    );
    for (const tm of entry.teams) {
      csvRows.push(
        [
          tm.team, t.season, t.year, t.region, tm.players[0] ?? "", tm.players[1] ?? "",
          tm.players[2] ?? "", tm.coach ?? "", "", "", "", url, "auto — REVIEW",
        ].map(csvCell).join(","),
      );
    }
  }

  writeFileSync(CSV, csvRows.join("\n"), "utf8");
  writeFileSync(
    AUDIT,
    `# Liquipedia team harvest — proposals (REVIEW before adding to teams.md)\n\n` +
      auditSections.join("\n\n") +
      "\n",
    "utf8",
  );
  console.log(`Wrote ${CSV} and ${AUDIT}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
