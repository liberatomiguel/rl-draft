/**
 * Special-card photo optimizer.
 *
 *   node scripts/optimize-images.mjs            optimize public/cards/specials/*.png in place
 *   node scripts/optimize-images.mjs --check    report only, exit 1 if any file is too heavy (CI/pre-commit)
 *
 * Why: the curated source PNGs come out of editing tools at ~500KB (600x823).
 * The client never receives them — `next/image` transcodes to a ~256px WebP/AVIF
 * — but on a COLD Vercel cache the optimizer must still download + transform the
 * full source before serving the first request, so a fat source = slow first
 * paint (this measurably dropped the /collection Speed Insights score in v1.1.2).
 *
 * The fix: cap the source at 512px wide (plenty — the largest on-screen use is
 * the detail modal at ~208px CSS) and re-encode as a quantized PNG. Alpha on
 * cut-out player photos is preserved; fully-opaque stage shots correctly drop
 * the redundant channel. Result: ~46MB -> ~12MB, no visible quality change
 * (the client output WebP is byte-for-byte indistinguishable at display size).
 *
 * Idempotent: files already within budget (<= MAX_WIDTH and < SKIP_BYTES) are
 * skipped, so re-running never re-quantizes an already-light file.
 */

import { readdirSync, statSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const DIR = "public/cards/specials";
const MAX_WIDTH = 512; // covers the detail modal (~208px CSS) at >2x DPR
const SKIP_BYTES = 240 * 1024; // already-light files are left untouched
const PNG_OPTS = { palette: true, quality: 90, effort: 9, compressionLevel: 9 };

const checkOnly = process.argv.includes("--check");
const files = readdirSync(DIR).filter((f) => f.endsWith(".png"));

let touched = 0;
let savedBytes = 0;
const tooHeavy = [];

for (const f of files) {
  const p = join(DIR, f);
  const bytes = statSync(p).size;
  const { width } = await sharp(p).metadata();
  const withinBudget = width <= MAX_WIDTH && bytes < SKIP_BYTES;

  if (checkOnly) {
    if (!withinBudget) tooHeavy.push(`${f} — ${(bytes / 1024) | 0}KB, ${width}px`);
    continue;
  }

  if (withinBudget) continue;

  const buf = await sharp(readFileSync(p))
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .png(PNG_OPTS)
    .toBuffer();
  writeFileSync(p, buf);
  touched++;
  savedBytes += bytes - buf.length;
}

if (checkOnly) {
  if (tooHeavy.length) {
    console.error(`${tooHeavy.length} photo(s) over budget (run \`npm run optimize:images\`):`);
    for (const t of tooHeavy) console.error("  " + t);
    process.exit(1);
  }
  console.log(`OK — all ${files.length} photos within budget.`);
} else {
  console.log(
    `optimized ${touched}/${files.length} photo(s); saved ${(savedBytes / 1024 / 1024).toFixed(1)}MB`,
  );
}
