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
 *   badges   public/badges/<art>.svg           → img/badges/<art>.<hash>.<w>.webp     w ∈ BADGE_WIDTHS
 *            (rc.9: the SVGs carry 3–4 blur filters each; rasterising them in the
 *            browser — ~180 on a leaderboard — froze it. Pre-rendered once here.)
 *            + img/badges/<art>.<glowHash>.glow.webp (rc.11): the art's silhouette
 *            in gold, blurred once here, padded — the legendary glow behind the
 *            badge, so the browser never blurs anything.
 *   partners public/partners/<id>.png         → img/partners/<id>.<hash>.webp (rc.36, PARTNER_BOX_PX):
 *            a news partner's logo (UX-03's 50/50 desk); absent → the styled fallback
 *   flags    public/flags/<cc>.png             → img/flags/flags.<hash>.png (rc.32): ONE sprite
 *            of every flag (FLAG_SPRITE), so a run's flags cost one request; the
 *            source PNGs stay in /flags/ (dev, and the manifest's flag list).
 *
 * <hash> = first 10 hex chars of sha256(source file bytes + that category's
 * ENCODER SETTINGS below — orgs: ORG_WEBP, specials: SPECIAL_WEBP, ranks:
 * { box, webp }; the flag sprite: every flag's code and bytes + FLAG_SPRITE).
 * A replaced PNG OR a changed quality/box size gets a new URL,
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
/** rc.36 (UX-03): a news partner's logo, fitted inside this box (the news desk shows it at ≤ 64 CSS px, 3×). */
const PARTNER_BOX_PX = 192;
const PARTNER_WEBP = { quality: 90, alphaQuality: 100, effort: 5, smartSubsample: true };

/** Badges render at 28–108 CSS px (BadgeEmblem); assets.ts picks the smallest
 *  width ≥ 2 × the CSS size: 96 covers the board rows, 224 the locker / hero /
 *  peek. Rendered from the 256 px SVG at 2× density, then fitted. */
const BADGE_WIDTHS = [96, 224];
const BADGE_SVG_DENSITY = 144;
const BADGE_WEBP = { quality: 88, alphaQuality: 100, effort: 5, smartSubsample: true };
/** Legendary glow: the silhouette at BADGE_GLOW.size px, tinted, padded by
 *  BADGE_GLOW.pad px each side (CSS: inset = -pad/size), blurred by sigma. */
/** rc.18: two layers — a tight, strong core hugging the silhouette (sigma)
 *  over a wide, faint halo (haloSigma at haloAlpha). */
const BADGE_GLOW = { size: 224, pad: 84, sigma: 2.2, haloSigma: 16, haloAlpha: 0.3, rgb: [255, 238, 196] /* white gold (rc.17) */, webp: { quality: 80, alphaQuality: 90, effort: 5 } };

/** Banners (rc.21): the 1240 × 200 SVGs from build-banners → WebP. The profile
 *  hero shows them up to ~1120 CSS px wide, the board rows ~800, the locker /
 *  calendar thumbnails far smaller; assets.ts picks the smallest width ≥ the
 *  CSS width × 2 (2480 = the hero on a retina screen; rc.22 — 1× was soft). The SVGs carry
 *  turbulence / blur / displacement filters: NEVER serve them in production. */
const BANNER_WIDTHS = [800, 1240, 2480];
const BANNER_SVG_DENSITY = 192;
const BANNER_WEBP = { quality: 88, alphaQuality: 100, effort: 5 };

/** Flags (rc.32, WEB-02, DESIGN-DECISIONS #149): every flag in ONE sprite, so
 *  the 10–15 flags of a draft cost one request (cached a year) instead of one
 *  each. CountryChip shows a flag in an 18 × 12 CSS px box (h-3.5 w-5 minus
 *  its 1 px border) with object-cover: each cell is that box at `density` 3
 *  (the logos' density), cover-cropped from the centre here as object-cover
 *  crops it, laid out in one row in manifest.flags order, with an edge-copied
 *  `gutter` so a downscaled neighbour never bleeds into the box. `cell` and
 *  `gutter` are source px. A palette PNG: 9 KB for 34 flags, smaller than WebP
 *  at the same look (measured rc.32: q90 14 KB, q85 12 KB, lossless 21 KB).
 *  Written to the manifest (`flagSprite`); src/lib/assets.ts positions from it. */
const FLAG_SPRITE = { cell: [54, 36], gutter: 3, density: 3, png: { palette: true, effort: 10 } };

const force = process.argv.includes("--force");
const CONCURRENCY = Math.max(1, Math.min(8, availableParallelism()));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Plain code-unit sort — deterministic on every OS/locale (no localeCompare). */
const byCodeUnit = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

const toPosix = (p) => p.split(sep).join("/");

async function listSvgs(dir) {
  if (!existsSync(dir)) return [];
  const entries = await readdir(dir, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".svg"))
    .map((e) => e.name)
    .sort(byCodeUnit);
}

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
 *             fit: "inside" | "width", webp: object, density?: number, glow?: object }} Job
 */

async function plan() {
  /** @type {Job[]} */
  const jobs = [];
  assertWidths("ORG_WIDTHS", ORG_WIDTHS);
  assertWidths("SPECIAL_WIDTHS", SPECIAL_WIDTHS);
  assertWidths("BADGE_WIDTHS", BADGE_WIDTHS);
  assertWidths("BANNER_WIDTHS", BANNER_WIDTHS);
  const manifest = {
    widths: { orgs: [...ORG_WIDTHS], specials: [...SPECIAL_WIDTHS], badges: [...BADGE_WIDTHS], banners: [...BANNER_WIDTHS] },
    flags: [],
    orgs: {},
    specials: {},
    ranks: {},
    badges: {},
    badgeGlows: {},
    /** rc.21: art key → [dx, dy], the offset (fraction of the box) that moves
     *  the badge's VISUAL centre (alpha-weighted centroid) onto the box centre. */
    badgeShifts: {},
    banners: {},
    partners: {},
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

  // news partners' logos (rc.36, UX-03): one WebP each, fitted inside PARTNER_BOX_PX
  const partnerDir = join(PUBLIC, "partners");
  for (const name of await listPngs(partnerDir)) {
    const id = stripPng(name);
    const src = join(partnerDir, name);
    const hash = hashOf(await read(src), { box: PARTNER_BOX_PX, webp: PARTNER_WEBP });
    manifest.partners[id] = hash;
    jobs.push({
      src,
      dest: join(OUT_DIR, "partners", `${id}.${hash}.webp`),
      width: PARTNER_BOX_PX,
      height: PARTNER_BOX_PX,
      fit: "inside",
      webp: PARTNER_WEBP,
    });
  }

  // badges (rc.9): the generated SVGs → raster WebP
  const badgeDir = join(PUBLIC, "badges");
  for (const name of await listSvgs(badgeDir)) {
    const art = name.replace(/\.svg$/i, "");
    const src = join(badgeDir, name);
    const hash = hashOf(await read(src), { density: BADGE_SVG_DENSITY, webp: BADGE_WEBP });
    manifest.badges[art] = hash;
    for (const w of BADGE_WIDTHS) {
      jobs.push({
        src,
        dest: join(OUT_DIR, "badges", `${art}.${hash}.${w}.webp`),
        width: w,
        height: w,
        fit: "inside",
        webp: BADGE_WEBP,
        density: BADGE_SVG_DENSITY,
      });
    }
    const glowHash = hashOf(await readFile(src), { density: BADGE_SVG_DENSITY, glow: BADGE_GLOW });
    manifest.badgeGlows[art] = glowHash;
    jobs.push({
      src,
      dest: join(OUT_DIR, "badges", `${art}.${glowHash}.glow.webp`),
      width: BADGE_GLOW.size,
      height: BADGE_GLOW.size,
      fit: "inside",
      webp: BADGE_GLOW.webp,
      density: BADGE_SVG_DENSITY,
      glow: BADGE_GLOW,
    });
  }

  // badge visual centre (rc.21): some badges carry a crest or a tab on one
  // side, so their bounding box and their visual weight disagree and they look
  // off-centre next to the others. Measure the alpha-weighted centroid of the
  // raster and record the shift that re-centres it (BadgeEmblem applies it).
  for (const name of await listSvgs(badgeDir)) {
    const art = name.replace(/\.svg$/i, "");
    const { data, info } = await sharp(join(badgeDir, name), { density: BADGE_SVG_DENSITY })
      .resize({ width: 128, height: 128, fit: "inside" })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    let sx = 0;
    let sy = 0;
    let sum = 0;
    for (let y = 0; y < info.height; y++) {
      for (let x = 0; x < info.width; x++) {
        const a = data[(y * info.width + x) * info.channels + 3];
        if (!a) continue;
        sx += a * (x + 0.5);
        sy += a * (y + 0.5);
        sum += a;
      }
    }
    if (!sum) continue;
    const dx = 0.5 - sx / sum / info.width;
    const dy = 0.5 - sy / sum / info.height;
    const r3 = (v) => Math.round(v * 1000) / 1000;
    if (Math.abs(dx) >= 0.004 || Math.abs(dy) >= 0.004) manifest.badgeShifts[art] = [r3(dx), r3(dy)];
  }

  // banners (rc.21): the generated SVGs → raster WebP, width-fitted
  const bannerDir = join(PUBLIC, "banners");
  for (const name of await listSvgs(bannerDir)) {
    const art = name.replace(/\.svg$/i, "");
    const src = join(bannerDir, name);
    const hash = hashOf(await read(src), { density: BANNER_SVG_DENSITY, webp: BANNER_WEBP });
    manifest.banners[art] = hash;
    for (const w of BANNER_WIDTHS) {
      jobs.push({
        src,
        dest: join(OUT_DIR, "banners", `${art}.${hash}.${w}.webp`),
        width: w,
        fit: "width",
        webp: BANNER_WEBP,
        density: BANNER_SVG_DENSITY,
      });
    }
  }

  // flags: the manifest lists the codes (sprite order); rc.32: one sprite of all
  const flagDir = join(PUBLIC, "flags");
  const flagFiles = new Map((await listPngs(flagDir)).map((n) => [stripPng(n).toLowerCase(), n]));
  manifest.flags = [...flagFiles.keys()].sort(byCodeUnit);
  if (manifest.flags.length) {
    const srcs = manifest.flags.map((cc) => join(flagDir, flagFiles.get(cc)));
    const parts = [];
    for (const [i, src] of srcs.entries()) parts.push(Buffer.from(`${manifest.flags[i]}\0`), await read(src));
    const hash = hashOf(Buffer.concat(parts), FLAG_SPRITE);
    const { cell, gutter, density } = FLAG_SPRITE;
    manifest.flagSprite = { hash, cell: [...cell], gutter, density };
    jobs.push({ src: flagDir, dest: join(OUT_DIR, "flags", `flags.${hash}.png`), sprite: srcs });
  }

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
        let buf;
        if (job.sprite) {
          buf = await encodeFlagSprite(job.sprite);
        } else {
          const resize =
            job.fit === "inside"
              ? { width: job.width, height: job.height, fit: "inside", withoutEnlargement: true }
              : { width: job.width, withoutEnlargement: true };
          const input = job.density ? sharp(job.src, { density: job.density }) : sharp(job.src);
          buf = job.glow ? await encodeGlow(input.resize(resize), job.glow) : await input.resize(resize).webp(job.webp).toBuffer();
        }
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

/** The flag sprite (FLAG_SPRITE): each flag cover-cropped into its cell, its
 *  edges copied into the gutter, the cells side by side in `srcs` order. */
async function encodeFlagSprite(srcs) {
  const [cw, ch] = FLAG_SPRITE.cell;
  const g = FLAG_SPRITE.gutter;
  const pitch = cw + 2 * g;
  const cells = [];
  for (const src of srcs) {
    const cell = await sharp(src).resize({ width: cw, height: ch, fit: "cover", position: "centre" }).png().toBuffer();
    cells.push(await sharp(cell).extend({ top: g, bottom: g, left: g, right: g, extendWith: "copy" }).png().toBuffer());
  }
  return sharp({ create: { width: srcs.length * pitch, height: ch + 2 * g, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(cells.map((input, i) => ({ input, left: i * pitch, top: 0 })))
    .png(FLAG_SPRITE.png)
    .toBuffer();
}

/** The legendary glow: keep the art's alpha, paint every pixel one gold (so the
 *  blur only spreads alpha — the padding is the same gold at alpha 0, no dark
 *  fringe), pad, blur once. */
async function encodeGlow(pipeline, glow) {
  const { data, info } = await pipeline.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const [r, g, b] = glow.rgb;
  for (let i = 0; i < info.width * info.height; i++) {
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
  }
  const padded = await sharp(data, { raw: info })
    .extend({ top: glow.pad, bottom: glow.pad, left: glow.pad, right: glow.pad, background: { r, g, b, alpha: 0 } })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const raw = { raw: padded.info };
  const core = await sharp(padded.data, raw).blur(glow.sigma).raw().toBuffer();
  const halo = await sharp(padded.data, raw).blur(glow.haloSigma).raw().toBuffer();
  // Alpha = core over a faint halo (source-over on alpha only; colour is uniform).
  const out = Buffer.from(core);
  for (let i = 3; i < out.length; i += 4) {
    const a = core[i] / 255;
    const h = (halo[i] / 255) * glow.haloAlpha;
    out[i] = Math.round((a + h * (1 - a)) * 255);
  }
  return sharp(out, raw).webp(glow.webp).toBuffer();
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
    widths: { orgs: manifest.widths.orgs, specials: manifest.widths.specials, badges: manifest.widths.badges, banners: manifest.widths.banners },
    flags: manifest.flags,
    flagSprite: manifest.flagSprite,
    orgs: sortKeys(manifest.orgs),
    specials: sortKeys(manifest.specials),
    ranks: sortKeys(manifest.ranks),
    badges: sortKeys(manifest.badges),
    badgeGlows: sortKeys(manifest.badgeGlows),
    badgeShifts: sortKeys(manifest.badgeShifts),
    banners: sortKeys(manifest.banners),
    // rc.36: written only once a partner's art exists (the manifest stays byte-identical until then).
    ...(Object.keys(manifest.partners).length ? { partners: sortKeys(manifest.partners) } : {}),
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
    badges: Object.keys(manifest.badges).length,
    banners: Object.keys(manifest.banners).length,
    flags: manifest.flags.length,
  };
  const secs = ((performance.now() - t0) / 1000).toFixed(1);
  console.log(
    `build-images: ${counts.orgs} orgs, ${counts.specials} specials, ${counts.ranks} ranks, ${counts.badges} badges, ${counts.banners} banners, ${counts.flags} flags (1 sprite)` +
      ` → ${jobs.length} WebP/PNG files (${written} written, ${skipped} skipped, ${deleted} stale deleted) in ${secs}s`,
  );
  console.log(
    `build-images: sources ${mb(sourceBytes)} PNG → outputs ${mb(afterBytes)} WebP` +
      ` (avg ${kb(afterBytes / Math.max(1, jobs.length))}/file); manifest ${manifestChanged ? "updated" : "unchanged"}`,
  );
}

await main();
