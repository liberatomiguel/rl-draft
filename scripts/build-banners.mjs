#!/usr/bin/env node
/**
 * rc.21 — exports the banner art from Miguel's design file
 * (`data-sources/banners/banners-rocket-draft.html`, the `RDBanners`
 * generator) into one static SVG per banner: `public/banners/<art>.svg`.
 *
 * The HTML carries a self-contained generator (`bannerSVG(key, opts)` and the
 * `BANNERS` catalog, bundled into `window.RDBanners`); everything after it is
 * page wiring that touches the DOM. We evaluate ONLY the generator script
 * (`<script id="gen">`) in an empty `node:vm` context and write every banner
 * WITHOUT its frame (the card draws its own border) and WITHOUT the SMIL
 * animation (the game animates with CSS, transform only — the SVGs carry
 * turbulence / blur / displacement filters that must never run in the
 * browser: build-images rasterises them to WebP). Then it checks that every
 * banner art key in `src/data/cosmetics.ts` exists.
 *
 * When Miguel sends a new design file: replace the HTML, run
 * `npm run build:banners`, then `npm run build:images`, commit `public/banners/`
 * and the manifest.
 */
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { animationOverlay, staticMotionBase, motionRasterSource, partitionMotion, frameAt, frameTimes, moverLayers } from "./lib/banner-animation.mjs";

const SRC = "data-sources/banners/banners-rocket-draft.html";
const OUT = "public/banners";

const html = readFileSync(SRC, "utf8");
const marker = '<script id="gen">';
const open = html.indexOf(marker);
if (open < 0) throw new Error(`${SRC}: no <script id="gen"> block`);
const script = html.slice(open + marker.length, html.indexOf("</script>", open));

const sandbox = vm.createContext({ TextEncoder, TextDecoder });
vm.runInContext(`${script}\n;globalThis.__out = RDBanners;`, sandbox, { timeout: 20_000 });
const { BANNERS, bannerSVG } = sandbox.__out;

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const written = [];
for (const b of BANNERS) {
  if (!/^[a-z0-9-]+$/.test(b.key)) throw new Error(`unsafe banner key: ${b.key}`);
  const svg = String(bannerSVG(b.key, { frame: false, animated: false }));
  if (!svg.startsWith("<svg")) throw new Error(`${b.key}: generator did not return an SVG`);
  writeFileSync(join(OUT, `${b.key}.svg`), `${svg}\n`);
  written.push([b.key, b.name, b.rarity, svg.length]);
}

// --- Animated overlay (rc.23) ------------------------------------------------
// The design file animates sparkles, dust, flames and rings with SMIL. The
// Keep authoring overlays, then freeze their painted subtrees as transparent
// textures. Production uses WebP planes animated by CSS transform/opacity only;
// reusable href geometry, paint servers and clips must survive extraction.
// rc.51: these keep the rc.23 plane split Miguel has already reviewed. Every
// other banner (Wildfire, Heatwave and Cosmic Ascension, whose split looked
// wrong, and every banner added from rc.51 on) uses the FRAME pipeline: frames
// of the design file's own animation, baked with their filters and cross-faded,
// plus the travelling shapes as planes (see lib/banner-animation.mjs).
const PLANE_SPLIT = new Set([
  "after-hours", "solar-flare", "neon-grid", "slipstream", "singularity", "overdrive", "blueprint",
  "victory-lane", "the-vault", "target-practice", "playbook", "golden-era", "back-to-basics",
]);
/** Seconds for one pass through the frames (default: a calm 8 s). */
const FRAME_CYCLE = { wildfire: 2.4, heatwave: 4.2, "cosmic-ascension": 7.5, "world-class": 7.5 };
const animated = [];
const motionParts = {};
for (const b of BANNERS) {
  const source = String(bannerSVG(b.key, { frame: false, animated: true }));
  if (!PLANE_SPLIT.has(b.key)) {
    if (!/<animate/.test(source)) continue;
    const times = frameTimes(source);
    const planes = moverLayers(source);
    writeFileSync(join(OUT, `${b.key}.base.svg`), `${frameAt(source, times[0] ?? 0)}\n`);
    times.slice(1).forEach((t, i) => writeFileSync(join(OUT, `${b.key}.f${i + 1}.svg`), `${frameAt(source, t)}\n`));
    const roles = ["drift", "drift2"];
    planes.forEach((p, i) => writeFileSync(join(OUT, `${b.key}.${roles[i]}.svg`), `${p.svg}\n`));
    motionParts[b.key] = {
      frames: Math.max(0, times.length - 1),
      cycle: FRAME_CYCLE[b.key] ?? 8,
      times,
      layers: planes.map((p, i) => ({ role: roles[i], from: p.from, to: p.to, dur: p.dur, sway: p.sway })),
    };
    animated.push([b.key, 0]);
    continue;
  }
  const overlay = animationOverlay(source);
  if (!overlay) continue;
  if (/<filter|<feTurbulence|<feGaussianBlur|filter=/.test(overlay)) throw new Error(`${b.key}: a filter survived in the overlay`);
  writeFileSync(join(OUT, `${b.key}.anim.svg`), `${overlay}\n`);
  writeFileSync(join(OUT, `${b.key}.base.svg`), `${staticMotionBase(source)}\n`);
  const layers = ["slipstream", "singularity"].includes(b.key) ? partitionMotion(overlay, b.key) : {motion:overlay};
  for (const [role, layer] of Object.entries(layers)) writeFileSync(join(OUT, `${b.key}.${role}.svg`), `${motionRasterSource(layer, b.key === "overdrive")}\n`);
  motionParts[b.key] = { parts: Object.keys(layers).filter(role => role !== "motion") };
  animated.push([b.key, overlay.length]);
}
mkdirSync("src/generated", { recursive: true });
writeFileSync("src/generated/banner-anim.json", `${JSON.stringify(animated.map(([k]) => k).sort(), null, 2)}\n`);
writeFileSync("src/generated/banner-motion.json", `${JSON.stringify(motionParts, null, 2)}\n`);
console.log(`animated: ${animated.map(([k]) => (motionParts[k].parts ? k : `${k} [${motionParts[k].frames + 1} frames @ ${motionParts[k].times.join("/")} s, ${motionParts[k].layers.length} planes]`)).join(", ")}`);

// Every art key the catalog references must exist.
const catalog = readFileSync("src/data/cosmetics.ts", "utf8");
const arts = [...catalog.matchAll(/\bart:\s*"([a-z0-9-]+)"/g)].map((m) => m[1]);
const files = new Set(readdirSync(OUT).map((f) => f.replace(/\.svg$/, "")));
const missing = arts.filter((k) => !files.has(k));
if (missing.length) throw new Error(`banner art missing for: ${missing.join(", ")}`);

writeFileSync(
  join(OUT, "README.md"),
  [
    "# Banner art (generated)",
    "",
    "GENERATED by `npm run build:banners` from `data-sources/banners/banners-rocket-draft.html` — do not hand-edit.",
    "Replace the design file and re-run the script (then `npm run build:images`) to update the art.",
    "Static, frameless SVGs (1240 × 200); production serves the WebP that build-images renders from them.",
    "",
    "Animated banners get `<art>.base.svg` (static background) and `<art>.motion.svg` (transparent moving art), both rasterised to WebP. The UI animates the motion texture with CSS transform/opacity only. `<art>.anim.svg` retains the filter-free reference motion for authoring, never runtime animation. The complete `<art>.svg` is the reduced-effects fallback.",
    "",
    "FRAME pipeline (rc.51: Wildfire, Heatwave, Cosmic Ascension and every later banner): `<art>.base.svg`, `<art>.f1.svg` and `<art>.f2.svg` are three moments of the design file's own animation, baked with their filters; the UI cross-fades them (opacity only). `<art>.drift.svg` / `<art>.drift2.svg` hold the travelling shapes (embers, dust), moved by a CSS transform along the design vector (`src/generated/banner-motion.json`).",
    "",
    "| File | Name | Rarity |",
    "|---|---|---|",
    ...written.map(([key, name, r]) => `| \`${key}.svg\` | ${name} | ${r} |`),
    "",
  ].join("\n"),
);

const kb = written.reduce((n, [, , , len]) => n + len, 0) / 1024;
console.log(`wrote ${written.length} banners to ${OUT}/ (${kb.toFixed(0)} KB raw)`);
