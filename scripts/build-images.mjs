/**
 * Build-time image pipeline (runs as `prebuild`; also `npm run build:images`).
 *
 *   node scripts/build-images.mjs           incremental: only missing outputs are encoded
 *   node scripts/build-images.mjs --force   re-encode everything (e.g. after a
 *                                           sharp/libvips upgrade — the visual
 *                                           settings, and so the URLs, are unchanged)
 *
 * Why: the site is a pure static export on Cloudflare Workers Static Assets.
 * There is no runtime image optimizer, so the browser-sized variants are made
 * here, once, from the curated source PNGs in public/ (which stay the source of
 * truth — Miguel keeps dropping PNGs in, nothing else changes).
 *
 * Outputs (all under public/img/, git-ignored, served with a 1-year immutable
 * Cache-Control — see public/_headers):
 *   orgs     public/orgs/<key>.png             → img/orgs/<key>.<hash>.<w>.webp       w ∈ ORG_WIDTHS
 *            (<key> is "<orgId>" or an era variant "<orgId>@<era>")
 *   specials public/cards/specials/<id>.png    → img/specials/<id>.<hash>.<w>.webp    w ∈ SPECIAL_WIDTHS
 *   ranks    public/ranks/<variant>/<id>.png   → img/ranks/<variant>/<id>.<hash>.webp (RANK_BOX_PX[variant])
 *   flags    public/flags/<cc>.png             → not converted (tiny); listed in the manifest only
 *
 * <hash> = first 10 hex chars of sha256(source file bytes + that category's
 * ENCODER SETTINGS below — orgs: ORG_WEBP, specials: SPECIAL_WEBP, ranks:
 * { box, webp }). A replaced PNG OR a changed quality/box size gets a new URL,
 * so the immutable cache can never serve a stale encode. (Widths need no
 * hashing: they are already a URL segment.)
 *
 * Manifest: src/generated/asset-manifest.json (committed, sorted keys, 2-space
 * JSON). src/lib/assets.ts reads it so production only ever requests files that
 * exist (no 404s for logo-less orgs / photo-less specials / region "flags"). It
 * also carries the generated `widths` per category — the ONE source of truth
 * that assets.ts picks variants from — and scripts/postexport.mjs checks that
 * every URL assets.ts can build exists in out/img/.
 *
 * Deterministic + incremental: same sources + same settings → same file names
 * and the same manifest bytes; outputs that already exist are skipped (their
 * name already pins source + settings); anything under public/img/ that is not
 * an expected output is deleted (old hashes, removed sources, dropped widths).
 *
 * Separate concern: scripts/optimize-images.mjs caps the SOURCE photo PNGs.
 */

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rename, rm, rmdir, stat, writeFile } from "node:fs/promises";
import { availableParallelism } from "node:os";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PUBLIC = join(ROOT, "public");
const OUT_DIR = join(PUBLIC, "img");
const MANIFEST_PATH = join(ROOT, "src", "generated", "asset-manifest.json");

// ---------------------------------------------------------------------------
// Encoder settings. Display sizes come from the components that render them.
//
// effort 5, not 6: measured on the full set, effort 6 took ~50 s per category
// (vs ~2–3 s) for a ~3% smaller output. alphaQuality 100 keeps cut-out edges
// crisp. smartSubsample (sharper chroma on saturated edges, ~+5% bytes) is on
// for the flat-colour logo/emblem art, off for the photos.
// ---------------------------------------------------------------------------

/** TeamLogo renders at 16–88 CSS px (xs…xl). 96 covers ≤32 CSS px at 3×;
 *  264 covers the largest (xl, 88 CSS px) at 3× (high-DPR phones). Fit
 *  "inside" a w×w box. Written to the manifest (`widths.orgs`); src/lib/assets.ts
 *  picks the smallest width ≥ 3 × the CSS size from it — edit ONLY here.
 *  Ascending, unique, positive integers (checked below). */
const ORG_WIDTHS = [96, 264];
const ORG_WEBP = { quality: 82, alphaQuality: 100, effort: 5, smartSubsample: true };

/** Special-card photo (GameCard SpecialArt, next/image `fill`, ≤256 CSS px wide).
 *  The custom loader (src/lib/imageLoader.ts → assets.ts) maps any srcset width
 *  onto the smallest of these that covers it (manifest `widths.specials`). */
const SPECIAL_WIDTHS = [256, 512];
const SPECIAL_WEBP = { quality: 80, alphaQuality: 100, effort: 5 };

/** RankBadge renders both variants at most at size "lg" = 112 CSS px
 *  (ResultsScreen rank-up ceremony → menu; profile page → profile), so 2× =
 *  224 px. withoutEnlargement keeps the 160 px menu sources at 160. The box is
 *  not in the file name, so it is part of the rank hash instead. */
const RANK_BOX_PX = { menu: 224, profile: 224 };
const RANK_WEBP = { quality: 90, alphaQuality: 100, effort: 5, smartSubsample: true };

const force = process.argv.includes("--force");
const CONCURRENCY = Math.max(1, Math.min(8, availableParallelism()));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Plain code-unit sort — deterministic on every OS/locale (no localeCompare). */
const byCodeUnit = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

const toPosix = (p) => p.split(sep).join("/");

async function listPngs(dir) {
  if (!existsSync(dir)) return [];
  const entries = await readdir(dir, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".png"))
    .map((e) => e.name)
    .sort(byCodeUnit);
}

const stripPng = (name) => name.replace(/\.png$/i, "");

/**
 * URL hash of one output family: the source bytes PLUS the encoder settings
 * that shape its pixels, so a settings change can never reuse an immutable
 * URL. JSON.stringify of these literal objects is stable (fixed key order).
 */
function hashOf(buf, settings) {
  return createHash("sha256").update(buf).update(JSON.stringify(settings)).digest("hex").slice(0, 10);
}

/** Widths go into URLs and the manifest; assets.ts assumes this shape. */
function assertWidths(name, widths) {
  const ok =
    Array.isArray(widths) &&
    widths.length > 0 &&
    widths.every((w, i) => Number.isInteger(w) && w > 0 && (i === 0 || w > widths[i - 1]));
  if (!ok) throw new Error(`${name} must be non-empty, ascending, unique positive integers: ${JSON.stringify(widths)}`);
}

/** Run async jobs with a fixed concurrency (sharp is itself multi-threaded). */
async function runPool(jobs, limit) {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, jobs.length) }, async () => {
    while (next < jobs.length) {
      const job = jobs[next++];
      await job();
    }
  });
  await Promise.all(workers);
}

async function listFilesRecursive(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await listFilesRecursive(p)));
    else out.push(p);
  }
  return out;
}

/** Remove empty directories bottom-up (never the root itself). */
async function pruneEmptyDirs(dir, isRoot = true) {
  if (!existsSync(dir)) return;
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.isDirectory()) await pruneEmptyDirs(join(dir, e.name), false);
  }
  if (!isRoot && (await readdir(dir)).length === 0) await rmdir(dir);
}

const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
const mb = (n) => `${(n / 1024 / 1024).toFixed(2)} MB`;

// ---------------------------------------------------------------------------
// Plan: every expected output, derived from the sources
// ---------------------------------------------------------------------------

/**
 * @typedef {{ src: string, dest: string, width: number, height?: number,
 *             fit: "inside" | "width", webp: object }} Job
 */

async function plan() {
  /** @type {Job[]} */
  const jobs = [];
  assertWidths("ORG_WIDTHS", ORG_WIDTHS);
  assertWidths("SPECIAL_WIDTHS", SPECIAL_WIDTHS);
  const manifest = {
    widths: { orgs: [...ORG_WIDTHS], specials: [...SPECIAL_WIDTHS] },
    flags: [],
    orgs: {},
    specials: {},
    ranks: {},
  };
  let sourceBytes = 0;

  const read = async (p) => {
    const buf = await readFile(p);
    sourceBytes += buf.length;
    return buf;
  };

  // orgs (default logos + era variants)
  const orgDir = join(PUBLIC, "orgs");
  for (const name of await listPngs(orgDir)) {
    const key = stripPng(name);
    const src = join(orgDir, name);
    const hash = hashOf(await read(src), ORG_WEBP);
    manifest.orgs[key] = hash;
    for (const w of ORG_WIDTHS) {
      jobs.push({
        src,
        dest: join(OUT_DIR, "orgs", `${key}.${hash}.${w}.webp`),
        width: w,
        height: w,
        fit: "inside",
        webp: ORG_WEBP,
      });
    }
  }

  // special-card photos
  const specialDir = join(PUBLIC, "cards", "specials");
  for (const name of await listPngs(specialDir)) {
    const id = stripPng(name);
    const src = join(specialDir, name);
    const hash = hashOf(await read(src), SPECIAL_WEBP);
    manifest.specials[id] = hash;
    for (const w of SPECIAL_WIDTHS) {
      jobs.push({
        src,
        dest: join(OUT_DIR, "specials", `${id}.${hash}.${w}.webp`),
        width: w,
        fit: "width",
        webp: SPECIAL_WEBP,
      });
    }
  }

  // rank emblems
  for (const variant of Object.keys(RANK_BOX_PX)) {
    const rankDir = join(PUBLIC, "ranks", variant);
    const box = RANK_BOX_PX[variant];
    for (const name of await listPngs(rankDir)) {
      const rankId = stripPng(name);
      const src = join(rankDir, name);
      const hash = hashOf(await read(src), { box, webp: RANK_WEBP });
      manifest.ranks[`${variant}/${rankId}`] = hash;
      jobs.push({
        src,
        dest: join(OUT_DIR, "ranks", variant, `${rankId}.${hash}.webp`),
        width: box,
        height: box,
        fit: "inside",
        webp: RANK_WEBP,
      });
    }
  }

  // flags: listed only (served as-is from /flags/<cc>.png)
  manifest.flags = (await listPngs(join(PUBLIC, "flags")))
    .map((n) => stripPng(n).toLowerCase())
    .sort(byCodeUnit);

  return { jobs, manifest, sourceBytes };
}

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

async function encode(jobs, rebuildAll) {
  let written = 0;
  let skipped = 0;
  const failures = [];
  await runPool(
    jobs.map((job) => async () => {
      if (!rebuildAll && existsSync(job.dest)) {
        skipped++;
        return;
      }
      try {
        const resize =
          job.fit === "inside"
            ? { width: job.width, height: job.height, fit: "inside", withoutEnlargement: true }
            : { width: job.width, withoutEnlargement: true };
        const buf = await sharp(job.src).resize(resize).webp(job.webp).toBuffer();
        await mkdir(dirname(job.dest), { recursive: true });
        // Write-then-rename so an interrupted run never leaves a truncated file
        // that the "skip existing" check would trust next time.
        const tmp = `${job.dest}.tmp`;
        await writeFile(tmp, buf);
        await rename(tmp, job.dest);
        written++;
      } catch (err) {
        failures.push(`${toPosix(relative(ROOT, job.src))}: ${err.message}`);
      }
    }),
    CONCURRENCY,
  );
  return { written, skipped, failures };
}

async function deleteStale(jobs) {
  const expected = new Set(jobs.map((j) => j.dest));
  let deleted = 0;
  for (const file of await listFilesRecursive(OUT_DIR)) {
    if (!expected.has(file)) {
      await rm(file, { force: true });
      deleted++;
    }
  }
  await pruneEmptyDirs(OUT_DIR);
  return deleted;
}

function sortKeys(obj) {
  return Object.fromEntries(Object.keys(obj).sort(byCodeUnit).map((k) => [k, obj[k]]));
}

async function writeManifest(manifest) {
  const ordered = {
    widths: { orgs: manifest.widths.orgs, specials: manifest.widths.specials },
    flags: manifest.flags,
    orgs: sortKeys(manifest.orgs),
    specials: sortKeys(manifest.specials),
    ranks: sortKeys(manifest.ranks),
  };
  const text = `${JSON.stringify(ordered, null, 2)}\n`;
  let current = null;
  try {
    current = await readFile(MANIFEST_PATH, "utf8");
  } catch {
    // first run
  }
  if (current === text) return false;
  await mkdir(dirname(MANIFEST_PATH), { recursive: true });
  await writeFile(MANIFEST_PATH, text);
  return true;
}

async function outputBytes(jobs) {
  let total = 0;
  for (const j of jobs) total += (await stat(j.dest)).size;
  return total;
}

// ---------------------------------------------------------------------------

async function main() {
  const t0 = performance.now();
  const { jobs, manifest, sourceBytes } = await plan();
  // No settings stamp needed: the settings are part of every output's hash,
  // so a settings change simply produces new (missing) names.
  const { written, skipped, failures } = await encode(jobs, force);
  if (failures.length) {
    console.error(`build-images: ${failures.length} source image(s) failed to encode:`);
    for (const f of failures) console.error(`  ${f}`);
    process.exit(1);
  }

  const deleted = await deleteStale(jobs);
  const manifestChanged = await writeManifest(manifest);
  const afterBytes = await outputBytes(jobs);

  const counts = {
    orgs: Object.keys(manifest.orgs).length,
    specials: Object.keys(manifest.specials).length,
    ranks: Object.keys(manifest.ranks).length,
    flags: manifest.flags.length,
  };
  const secs = ((performance.now() - t0) / 1000).toFixed(1);
  console.log(
    `build-images: ${counts.orgs} orgs, ${counts.specials} specials, ${counts.ranks} ranks, ${counts.flags} flags` +
      ` → ${jobs.length} WebP files (${written} written, ${skipped} skipped, ${deleted} stale deleted) in ${secs}s`,
  );
  console.log(
    `build-images: sources ${mb(sourceBytes)} PNG → outputs ${mb(afterBytes)} WebP` +
      ` (avg ${kb(afterBytes / Math.max(1, jobs.length))}/file); manifest ${manifestChanged ? "updated" : "unchanged"}`,
  );
}

await main();
