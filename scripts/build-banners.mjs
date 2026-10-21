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
// profile hero shows that life as a SECOND layer over the WebP: a small SVG
// holding ONLY the elements that animate (with their ancestors and the
// gradients / clips they reference), every filter stripped — so nothing in the
// browser ever runs turbulence, displacement or blur. Everything static stays
// in the raster. A banner with no animation gets no overlay.
function parseSvg(src) {
  const root = { tag: "#root", attrs: "", children: [], parent: null };
  let cur = root;
  const re = /<\/([\w:-]+)\s*>|<([\w:-]+)((?:\s+[^>]*?)?)(\/?)>|([^<]+)/g;
  let m;
  while ((m = re.exec(src))) {
    if (m[1]) cur = cur.parent ?? root;
    else if (m[2]) {
      const node = { tag: m[2], attrs: m[3] ?? "", children: [], parent: cur };
      cur.children.push(node);
      if (!m[4]) cur = node;
    } else if (m[5] && m[5].trim()) cur.children.push({ tag: "#text", text: m[5], children: [], parent: cur });
  }
  return root;
}
const ANIM = new Set(["animate", "animateTransform", "animateMotion", "set"]);
function hasAnim(n) {
  return ANIM.has(n.tag) || n.children.some(hasAnim);
}
function refsOf(attrs) {
  return [...attrs.matchAll(/url\(#([\w:-]+)\)/g)].map((x) => x[1]);
}
function idOf(attrs) {
  return /\sid="([^"]+)"/.exec(attrs)?.[1] ?? null;
}
function serialize(n) {
  if (n.tag === "#text") return n.text;
  const attrs = n.attrs.replace(/\sfilter="[^"]*"/g, "").replace(/filter:\s*url\([^)]*\);?/g, "");
  const inner = n.children.map(serialize).join("");
  return inner ? `<${n.tag}${attrs}>${inner}</${n.tag}>` : `<${n.tag}${attrs}/>`;
}
function animOverlay(svgText) {
  const root = parseSvg(svgText);
  const svg = root.children.find((c) => c.tag === "svg");
  if (!svg || !hasAnim(svg)) return null;
  const defs = svg.children.find((c) => c.tag === "defs");
  const body = svg.children.filter((c) => c !== defs);
  // Prune: keep a node only if it animates or holds something that does.
  const prune = (n) => {
    n.children = n.children.filter((c) => c.tag === "#text" || hasAnim(c));
    n.children.forEach((c) => c.tag !== "#text" && prune(c));
  };
  body.forEach(prune);
  const kept = body.filter(hasAnim);
  // Defs the kept tree references (transitively), filters excluded.
  const byId = new Map((defs?.children ?? []).map((d) => [idOf(d.attrs), d]).filter(([k]) => k));
  const need = new Set();
  const visit = (n) => {
    if (n.tag === "#text") return;
    for (const r of refsOf(n.attrs)) if (!need.has(r) && byId.has(r) && byId.get(r).tag !== "filter") {
      need.add(r);
      visit(byId.get(r));
    }
    n.children.forEach(visit);
  };
  kept.forEach(visit);
  const defsOut = [...need].map((id) => serialize(byId.get(id))).join("");
  const open = /<svg[^>]*>/.exec(svgText)[0].replace(/\swidth="[^"]*"|\sheight="[^"]*"|\srole="[^"]*"|\saria-label="[^"]*"/g, "");
  return `${open}<defs>${defsOut}</defs>${kept.map(serialize).join("")}</svg>`;
}
const animated = [];
for (const b of BANNERS) {
  const overlay = animOverlay(String(bannerSVG(b.key, { frame: false, animated: true })));
  if (!overlay) continue;
  if (/<filter|<feTurbulence|<feGaussianBlur|filter=/.test(overlay)) throw new Error(`${b.key}: a filter survived in the overlay`);
  writeFileSync(join(OUT, `${b.key}.anim.svg`), `${overlay}\n`);
  animated.push([b.key, overlay.length]);
}
mkdirSync("src/generated", { recursive: true });
writeFileSync("src/generated/banner-anim.json", `${JSON.stringify(animated.map(([k]) => k).sort(), null, 2)}\n`);
console.log(`animated overlays: ${animated.map(([k, n]) => `${k} (${(n / 1024).toFixed(0)} KB)`).join(", ")}`);

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
    "Banners that animate also get `<art>.anim.svg`: the animated elements only, no filters (the profile hero's overlay).",
    "",
    "| File | Name | Rarity |",
    "|---|---|---|",
    ...written.map(([key, name, r]) => `| \`${key}.svg\` | ${name} | ${r} |`),
    "",
  ].join("\n"),
);

const kb = written.reduce((n, [, , , len]) => n + len, 0) / 1024;
console.log(`wrote ${written.length} banners to ${OUT}/ (${kb.toFixed(0)} KB raw)`);
