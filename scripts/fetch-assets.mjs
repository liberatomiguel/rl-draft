/**
 * Asset fetcher — bootstraps real images so nobody saves 200 files by hand:
 *
 *   node scripts/fetch-assets.mjs --flags     country flags → public/flags/<cc>.png
 *   node scripts/fetch-assets.mjs --orgs      org logos (Liquipedia) → public/orgs/<orgId>.png
 *   node scripts/fetch-assets.mjs --players   player photos (Liquipedia) → public/cards/specials/<specialId>.png
 *   node scripts/fetch-assets.mjs --all
 *
 * Liquipedia etiquette (api-terms-of-use): identified User-Agent and a global
 * ~2.6s gap between API calls — a full --orgs run takes ~10 minutes. Files
 * that already exist are SKIPPED, so re-runs only fetch what's missing and
 * hand-curated images are never overwritten.
 *
 * Misses are listed at the end; map them manually in
 * data-sources/asset-overrides.json:
 *   { "orgs": { "<orgId>": "Liquipedia Page Title" },
 *     "players": { "<playerId>": "Liquipedia Page Title" } }
 *
 * Images from Liquipedia are CC-BY-SA 3.0 — public/ATTRIBUTION.md is
 * (re)generated with the required credit. Flags come from flagcdn.com
 * (public domain).
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (p) => JSON.parse(readFileSync(join(root, p), "utf8"));

const API = "https://liquipedia.net/rocketleague/api.php";
const UA =
  "RocketDraft-AssetFetcher/0.5 (fan-made non-commercial game; contact: migliberato@gmail.com)";
const RATE_MS = 2600;

const overridesPath = join(root, "data-sources", "asset-overrides.json");
const overrides = existsSync(overridesPath)
  ? JSON.parse(readFileSync(overridesPath, "utf8"))
  : { orgs: {}, players: {} };

let lastCall = 0;
async function rateLimited(url, init = {}) {
  const wait = lastCall + RATE_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
  return fetch(url, { ...init, headers: { "User-Agent": UA, ...init.headers } });
}

async function apiGet(params) {
  const url = `${API}?${new URLSearchParams({ format: "json", ...params })}`;
  const res = await rateLimited(url);
  if (!res.ok) throw new Error(`API ${res.status} for ${url}`);
  return res.json();
}

async function download(url, outPath) {
  const res = await rateLimited(url);
  if (!res.ok) throw new Error(`download ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, buffer);
}

/** First search hit for a name (or the override). */
async function findPage(name, override) {
  if (override) return override;
  const data = await apiGet({ action: "opensearch", search: name, limit: "3" });
  return data?.[1]?.[0] ?? null;
}

/** Image files attached to a page (following redirects — org pages often are). */
async function pageImages(title) {
  const data = await apiGet({
    action: "query",
    titles: title,
    prop: "images",
    imlimit: "100",
    redirects: "1",
  });
  const pages = data?.query?.pages ?? {};
  const page = Object.values(pages)[0];
  return (page?.images ?? []).map((i) => i.title);
}

/** Direct URL (≤600px thumb) for a File: title. */
async function fileUrl(fileTitle) {
  const data = await apiGet({
    action: "query",
    titles: fileTitle,
    prop: "imageinfo",
    iiprop: "url",
    iiurlwidth: "600",
  });
  const page = Object.values(data?.query?.pages ?? {})[0];
  const info = page?.imageinfo?.[0];
  return info?.thumburl ?? info?.url ?? null;
}

const normalize = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Rank a page's files for "the org logo": allmode > lightmode > name match. */
function pickLogoFile(files, orgName) {
  const slug = normalize(orgName);
  const score = (title) => {
    const t = title.toLowerCase();
    if (!/\.(png|svg)$/.test(t)) return -1;
    if (/(map|icon_|flag|trophy|banner)/.test(t)) return -1;
    let s = 0;
    if (t.includes("allmode")) s += 6;
    if (t.includes("lightmode")) s += 5;
    if (t.includes("darkmode")) s += 2;
    if (t.includes("logo")) s += 3;
    if (normalize(t).includes(slug.slice(0, 8))) s += 4;
    return s;
  };
  return files
    .map((f) => ({ f, s: score(f) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)[0]?.f;
}

/** Player photos are usually JPGs named after the player. */
function pickPhotoFile(files, nickname) {
  const slug = normalize(nickname);
  const score = (title) => {
    const t = title.toLowerCase();
    if (!/\.(jpg|jpeg|png)$/.test(t)) return -1;
    if (/(logo|allmode|lightmode|darkmode|map|icon_|flag|banner)/.test(t)) return -1;
    let s = /\.(jpg|jpeg)$/.test(t) ? 3 : 0;
    if (normalize(t).includes(slug)) s += 5;
    return s;
  };
  return files
    .map((f) => ({ f, s: score(f) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)[0]?.f;
}

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------

async function fetchFlags() {
  const players = readJson("src/data/players.json");
  const coaches = readJson("src/data/coaches.json");
  const subs = readJson("src/data/subs.json");
  const codes = new Set(
    [...players, ...coaches, ...subs]
      .map((p) => p.country)
      .filter(Boolean)
      .map((c) => c.toLowerCase()),
  );
  console.log(`Flags: ${codes.size} country codes`);
  let done = 0;
  for (const cc of [...codes].sort()) {
    const out = join(root, "public", "flags", `${cc}.png`);
    if (existsSync(out)) continue;
    // flagcdn serves public-domain flags; w160 keeps card chips crisp.
    const res = await fetch(`https://flagcdn.com/w160/${cc}.png`, {
      headers: { "User-Agent": UA },
    });
    if (!res.ok) {
      console.warn(`  ✗ ${cc} (${res.status})`);
      continue;
    }
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, Buffer.from(await res.arrayBuffer()));
    done += 1;
  }
  console.log(`Flags done (${done} new).`);
}

async function fetchOrgLogos() {
  const orgs = readJson("src/data/orgs.json");
  const misses = [];
  console.log(`Org logos: ${orgs.length} orgs (≈2.6s/API call — be patient)`);
  for (const org of orgs) {
    const out = join(root, "public", "orgs", `${org.id}.png`);
    if (existsSync(out)) continue;
    // `false` override = auto-fetch finds the WRONG image (e.g. predecessor
    // org logos on rebrand pages) — leave for manual curation.
    if (overrides.orgs?.[org.id] === false) {
      misses.push(org.id);
      console.warn(`  – ${org.id}: skipped by override (manual curation)`);
      continue;
    }
    try {
      const page = await findPage(org.name, overrides.orgs?.[org.id]);
      if (!page) throw new Error("no search hit");
      const files = await pageImages(page);
      const logo = pickLogoFile(files, org.name);
      if (!logo) throw new Error(`no logo candidate on "${page}"`);
      const url = await fileUrl(logo);
      if (!url) throw new Error("no file url");
      await download(url, out);
      console.log(`  ✓ ${org.id}  ←  ${logo}`);
    } catch (error) {
      misses.push(org.id);
      console.warn(`  ✗ ${org.id}: ${error.message}`);
    }
  }
  report("orgs", misses);
}

async function fetchPlayerPhotos() {
  const players = readJson("src/data/players.json");
  const specials = readJson("src/data/specialCards.json");
  const byId = new Map(players.map((p) => [p.id, p]));
  // One photo per PERSON, copied to every special card of theirs that is
  // still missing art — drop curated images later to replace any of them.
  const byPerson = new Map();
  for (const sp of specials) {
    const list = byPerson.get(sp.playerId) ?? [];
    list.push(sp.id);
    byPerson.set(sp.playerId, list);
  }
  const misses = [];
  console.log(`Player photos: ${byPerson.size} people / ${specials.length} specials`);
  for (const [personId, specialIds] of byPerson) {
    const targets = specialIds
      .map((id) => join(root, "public", "cards", "specials", `${id}.png`))
      .filter((p) => !existsSync(p));
    if (targets.length === 0) continue;
    if (overrides.players?.[personId] === false) {
      misses.push(personId);
      console.warn(`  – ${personId}: skipped by override (manual curation)`);
      continue;
    }
    const nickname = byId.get(personId)?.nickname ?? personId;
    try {
      const page = await findPage(nickname, overrides.players?.[personId]);
      if (!page) throw new Error("no search hit");
      const files = await pageImages(page);
      const photo = pickPhotoFile(files, nickname);
      if (!photo) throw new Error(`no photo candidate on "${page}"`);
      const url = await fileUrl(photo);
      if (!url) throw new Error("no file url");
      await download(url, targets[0]);
      const data = readFileSync(targets[0]);
      for (const extra of targets.slice(1)) writeFileSync(extra, data);
      console.log(`  ✓ ${personId} → ${targets.length} card(s)  ←  ${photo}`);
    } catch (error) {
      misses.push(personId);
      console.warn(`  ✗ ${personId}: ${error.message}`);
    }
  }
  report("players", misses);
}

function report(kind, misses) {
  if (misses.length === 0) {
    console.log(`All ${kind} resolved.`);
    return;
  }
  console.log(
    `\n${misses.length} ${kind} missing — add Liquipedia page titles to ` +
      `data-sources/asset-overrides.json under "${kind}" and re-run:\n  ` +
      misses.join("\n  "),
  );
}

function writeAttribution() {
  writeFileSync(
    join(root, "public", "ATTRIBUTION.md"),
    `# Image attribution

- Team logos and player photos sourced from [Liquipedia](https://liquipedia.net/rocketleague/)
  (CC-BY-SA 3.0). Logos remain trademarks of their respective organizations.
- Country flags from [flagcdn.com](https://flagcdn.com) (public domain).

Rocket Draft is a fan-made, non-commercial project and is not affiliated with
Psyonix, Epic Games, Liquipedia or any esports organization.
`,
  );
}

// ---------------------------------------------------------------------------

const args = new Set(process.argv.slice(2));
const all = args.has("--all") || args.size === 0;
if (all) console.log("No flags given — running --flags --orgs --players.\n");

writeAttribution();
if (all || args.has("--flags")) await fetchFlags();
if (all || args.has("--orgs")) await fetchOrgLogos();
if (all || args.has("--players")) await fetchPlayerPhotos();
console.log("\nDone. Existing files were left untouched.");
