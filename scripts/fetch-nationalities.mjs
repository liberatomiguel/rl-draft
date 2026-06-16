/**
 * Nationality auditor — proposes a country (ISO-2) for every player by reading
 * their Liquipedia infobox, and compares it to what `COUNTRY` in
 * build-dataset.mjs currently has. ANALYSIS ONLY: writes two reports, never
 * touches game data.
 *
 *   node scripts/fetch-nationalities.mjs            audit all players
 *   node scripts/fetch-nationalities.mjs --missing  only players with no country yet
 *
 * Output:
 *   data-sources/nationalities-proposed.json   machine-readable proposals
 *   data-sources/nationalities-audit.md        human review (grouped by status)
 *
 * Liquipedia etiquette (api-terms-of-use): identified User-Agent + a global
 * 2.6s gap between calls. A full run is ~300 players → ~15-20 min. Progress is
 * written incrementally, so a re-run resumes (already-resolved players cached).
 *
 * How a proposal is graded:
 *   HIGH   — page resolved directly from the nickname, has an {{Infobox player}},
 *            and the country name is in NAME2ISO. Safe to apply in bulk.
 *   MEDIUM — resolved only via opensearch fallback (fuzzier match). Eyeball it.
 *   REVIEW — known-collision id, unknown country name, or region looks off.
 *   UNRESOLVED — no page / no infobox / no country found.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const API = "https://liquipedia.net/rocketleague/api.php";
const UA =
  "RocketDraft-AssetFetcher/0.5 (fan-made non-commercial game; contact: migliberato@gmail.com)";
const RATE_MS = 2600;

const PROPOSED = join(root, "data-sources", "nationalities-proposed.json");
const AUDIT = join(root, "data-sources", "nationalities-audit.md");

// Liquipedia country name → ISO-3166-1 alpha-2 (lowercased flag code lives in
// public/flags/<cc>.png). UK home nations all map to GB for the flag.
const NAME2ISO = {
  "united states": "US", usa: "US", "united states of america": "US",
  canada: "CA",
  england: "GB", scotland: "GB", wales: "GB", "northern ireland": "GB",
  "united kingdom": "GB", "great britain": "GB", britain: "GB",
  france: "FR", germany: "DE", italy: "IT", spain: "ES", portugal: "PT",
  netherlands: "NL", "the netherlands": "NL", belgium: "BE", luxembourg: "LU",
  sweden: "SE", norway: "NO", finland: "FI", denmark: "DK", iceland: "IS",
  poland: "PL", "czech republic": "CZ", czechia: "CZ", slovakia: "SK",
  austria: "AT", switzerland: "CH", ireland: "IE", hungary: "HU",
  romania: "RO", bulgaria: "BG", greece: "GR", croatia: "HR", serbia: "RS",
  slovenia: "SI", ukraine: "UA", russia: "RU", turkey: "TR", "türkiye": "TR",
  lithuania: "LT", latvia: "LV", estonia: "EE", cyprus: "CY", malta: "MT",
  australia: "AU", "new zealand": "NZ",
  brazil: "BR", argentina: "AR", chile: "CL", uruguay: "UY", peru: "PE",
  colombia: "CO", mexico: "MX", ecuador: "EC", bolivia: "BO", paraguay: "PY",
  venezuela: "VE",
  "saudi arabia": "SA", "united arab emirates": "AE", uae: "AE", qatar: "QA",
  kuwait: "KW", bahrain: "BH", oman: "OM", jordan: "JO", lebanon: "LB",
  iraq: "IQ", egypt: "EG", morocco: "MA", tunisia: "TN", algeria: "DZ",
  israel: "IL", iran: "IR",
  japan: "JP", "south korea": "KR", korea: "KR", china: "CN", singapore: "SG",
  malaysia: "MY", thailand: "TH", philippines: "PH", indonesia: "ID",
  india: "IN", vietnam: "VN", "hong kong": "HK", taiwan: "TW",
  "south africa": "ZA", nigeria: "NG", kenya: "KE", ghana: "GH",
  zimbabwe: "ZW", namibia: "NA", mauritius: "MU",
};

// Rough region each ISO usually belongs to (RL competitive regions) — only used
// to flag a proposal whose country looks unusual for the player's region. NOT a
// rejection (players migrate); it just surfaces a row for human eyes.
const ISO_REGION = {
  US: "NA", CA: "NA",
  GB: "EU", FR: "EU", DE: "EU", IT: "EU", ES: "EU", PT: "EU", NL: "EU",
  BE: "EU", LU: "EU", SE: "EU", NO: "EU", FI: "EU", DK: "EU", IS: "EU",
  PL: "EU", CZ: "EU", SK: "EU", AT: "EU", CH: "EU", IE: "EU", HU: "EU",
  RO: "EU", BG: "EU", GR: "EU", HR: "EU", RS: "EU", SI: "EU", UA: "EU",
  RU: "EU", TR: "EU", LT: "EU", LV: "EU", EE: "EU", CY: "EU", MT: "EU", IL: "EU",
  AU: "OCE", NZ: "OCE",
  BR: "SAM", AR: "SAM", CL: "SAM", UY: "SAM", PE: "SAM", CO: "SAM",
  MX: "SAM", EC: "SAM", BO: "SAM", PY: "SAM", VE: "SAM",
  SA: "MENA", AE: "MENA", QA: "MENA", KW: "MENA", BH: "MENA", OM: "MENA",
  JO: "MENA", LB: "MENA", IQ: "MENA", EG: "MENA", MA: "MENA", TN: "MENA",
  DZ: "MENA", IR: "MENA",
  JP: "APAC", KR: "APAC", CN: "APAC", SG: "APAC", MY: "APAC", TH: "APAC",
  PH: "APAC", ID: "APAC", IN: "APAC", VN: "APAC", HK: "APAC", TW: "APAC",
  ZA: "SSA", NG: "SSA", KE: "SSA", GH: "SSA", ZW: "SSA", NA: "SSA", MU: "SSA",
};

// Ids whose nickname is ambiguous on Liquipedia (a search can land on the wrong
// person) — always graded REVIEW so a human confirms.
const COLLISION_IDS = new Set(["zen-oce"]);

let lastCall = 0;
async function api(params) {
  const wait = lastCall + RATE_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
  const url = `${API}?${new URLSearchParams({ format: "json", formatversion: "2", ...params })}`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

/** Raw wikitext of a title (follows redirects). Returns "" if the page is missing. */
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
  const wikitext = page.revisions?.[0]?.slots?.main?.content ?? "";
  return { wikitext, resolvedTitle: page.title };
}

async function openSearch(name) {
  const d = await api({ action: "opensearch", search: name, limit: "3" });
  return d?.[1]?.[0] ?? null;
}

function extractCountry(wt) {
  if (!wt) return null;
  // Prefer the first |country= / |country1= / |nationality= in the infobox.
  const m =
    wt.match(/\|\s*country\d*\s*=\s*([^\n|}]+)/i) ??
    wt.match(/\|\s*nationality\d*\s*=\s*([^\n|}]+)/i);
  if (!m) return null;
  // Strip wiki markup: {{flag/USA}}, [[United States]], templates, links.
  let v = m[1].trim();
  const flagTpl = v.match(/\{\{\s*flag\/?\s*([a-z ]{2,40})\s*\}\}/i)?.[1];
  if (flagTpl) v = flagTpl;
  v = v.replace(/\[\[|\]\]|\{\{|\}\}/g, "").split("|").pop().trim();
  return v || null;
}

function hasPlayerInfobox(wt) {
  return /\{\{\s*infobox[ _]player/i.test(wt);
}

async function main() {
  const players = JSON.parse(readFileSync(join(root, "src/data/players.json"), "utf8"));
  const byId = new Map();
  for (const p of players) if (!byId.has(p.id)) byId.set(p.id, p);
  let work = [...byId.values()];
  if (process.argv.includes("--missing")) work = work.filter((p) => !p.country);

  // Resume from any prior partial run.
  const cache = existsSync(PROPOSED)
    ? new Map(JSON.parse(readFileSync(PROPOSED, "utf8")).map((r) => [r.id, r]))
    : new Map();

  let done = 0;
  for (const p of work) {
    if (cache.has(p.id)) { done++; continue; }
    const row = {
      id: p.id, nickname: p.nickname, region: p.region,
      current: p.country ?? null, proposedISO: null, lpCountry: null,
      lpPage: null, via: null, status: "UNRESOLVED", confidence: "—", regionOdd: false,
    };
    try {
      // 1) direct title = nickname
      let { wikitext, resolvedTitle } = await getWikitext(p.nickname);
      let via = "direct";
      // 2) fallback: opensearch
      if (!hasPlayerInfobox(wikitext)) {
        const hit = await openSearch(p.nickname);
        if (hit) {
          ({ wikitext, resolvedTitle } = await getWikitext(hit));
          via = "opensearch";
        }
      }
      row.lpPage = resolvedTitle;
      row.via = via;
      if (hasPlayerInfobox(wikitext)) {
        const name = extractCountry(wikitext);
        row.lpCountry = name;
        const iso = name ? NAME2ISO[name.toLowerCase()] : null;
        if (iso) {
          row.proposedISO = iso;
          row.regionOdd = ISO_REGION[iso] && ISO_REGION[iso] !== p.region;
          const high =
            via === "direct" && !COLLISION_IDS.has(p.id);
          if (!p.country) row.status = "FILL";
          else if (p.country === iso) row.status = "MATCH";
          else row.status = "MISMATCH";
          row.confidence = COLLISION_IDS.has(p.id)
            ? "REVIEW"
            : high
              ? "HIGH"
              : "MEDIUM";
        } else if (name) {
          row.status = "REVIEW";
          row.confidence = "REVIEW";
          row.note = `country name "${name}" not in NAME2ISO`;
        }
      }
    } catch (e) {
      row.note = `error: ${e.message}`;
    }
    cache.set(p.id, row);
    done++;
    // incremental flush every player (cheap, resumable)
    writeFileSync(PROPOSED, JSON.stringify([...cache.values()], null, 1));
    if (done % 10 === 0) console.log(`  ${done}/${work.length}  (last: ${p.nickname} → ${row.proposedISO ?? "?"} [${row.status}])`);
  }

  // Build the human audit.
  const rows = [...cache.values()].filter((r) => work.some((w) => w.id === r.id));
  const group = (s) => rows.filter((r) => r.status === s);
  const fmt = (r) =>
    `| ${r.nickname} | \`${r.id}\` | ${r.region} | ${r.current ?? "—"} | ${r.proposedISO ?? "—"} | ${r.lpCountry ?? "—"} | ${r.confidence}${r.regionOdd ? " ⚠region" : ""} | ${r.lpPage ?? "—"}${r.note ? ` · ${r.note}` : ""} |`;
  const section = (title, list) =>
    list.length
      ? `\n## ${title} (${list.length})\n\n| Nick | id | Region | Current | Proposed | LP country | Confidence | LP page / note |\n|---|---|---|---|---|---|---|---|\n${list.map(fmt).join("\n")}\n`
      : `\n## ${title} (0)\n`;

  const counts = ["FILL", "MISMATCH", "MATCH", "REVIEW", "UNRESOLVED"]
    .map((s) => `${s}: ${group(s).length}`)
    .join(" · ");
  const md =
    `# Player nationality audit (Liquipedia)\n\n` +
    `Generated by \`scripts/fetch-nationalities.mjs\`. Source: each player's ` +
    `Liquipedia \`{{Infobox player}}\` \`|country=\`.\n\n` +
    `**${rows.length} players checked** — ${counts}\n\n` +
    `Apply **FILL** + **MISMATCH** rows graded HIGH to \`COUNTRY\` in ` +
    `\`scripts/build-dataset.mjs\`; eyeball MEDIUM/REVIEW/⚠region before trusting.\n` +
    section("FILL — no country today, proposing one", group("FILL")) +
    section("MISMATCH — current differs from Liquipedia", group("MISMATCH")) +
    section("REVIEW — needs a human", group("REVIEW")) +
    section("UNRESOLVED — no page/infobox/country", group("UNRESOLVED")) +
    section("MATCH — already correct", group("MATCH"));
  writeFileSync(AUDIT, md);
  console.log(`\nDone. ${rows.length} players.\n  ${counts}\n  → ${AUDIT}\n  → ${PROPOSED}`);
}

main();
