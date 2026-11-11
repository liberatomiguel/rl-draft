#!/usr/bin/env node
/**
 * v2.0 (WEB-02) — static weight of an export, per route: the HTML plus every
 * script, stylesheet and preloaded font it references (what a cold hard load
 * fetches before hydration), raw and Brotli (Cloudflare serves br).
 *
 *   npm run build                       (or NEXT_PUBLIC_CAREER_MODE=1 npm run build)
 *   node scripts/route-weight.mjs out [result.json]
 *
 * No dependencies and no server. The script count includes Next's `noModule`
 * polyfill bundle (~37 KB br), which a modern browser never downloads: subtract
 * it when quoting what a player pays. Keep a result.json per build to compare.
 *
 * Reference (career on, Brotli q9, JS incl. the noModule bundle):
 *   rc.45        home 330.0 KB · /play 448.3 · /collection 389.2 · /profile 394.5 · content page 313.0
 *   rc.45 + C4   home 327.7 KB · /play 445.9 · /collection 386.6 · /profile 394.9 · content page 310.0
 */
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { brotliCompressSync, constants } from "node:zlib";

const out = process.argv[2];
const jsonOut = process.argv[3];
const br = (buf) =>
  brotliCompressSync(buf, { params: { [constants.BROTLI_PARAM_QUALITY]: 9 } }).length;
const cache = new Map();
function size(file) {
  if (cache.has(file)) return cache.get(file);
  const buf = readFileSync(file);
  const v = { raw: buf.length, br: br(buf) };
  cache.set(file, v);
  return v;
}
function walk(dir, acc = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "_next" || e.name === "img") continue;
      walk(p, acc);
    } else if (e.name.endsWith(".html")) acc.push(p);
  }
  return acc;
}
const routes = {};
for (const file of walk(out)) {
  const rel = relative(out, file).split(sep).join("/");
  const route = "/" + rel.replace(/\.html$/, "").replace(/^index$/, "");
  const html = readFileSync(file, "utf8");
  const refs = new Set();
  for (const m of html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)) refs.add(m[1]);
  for (const m of html.matchAll(/<link\b[^>]*\brel="stylesheet"[^>]*\bhref="([^"]+)"/g)) refs.add(m[1]);
  for (const m of html.matchAll(/<link\b[^>]*\bhref="([^"]+)"[^>]*\brel="stylesheet"/g)) refs.add(m[1]);
  for (const m of html.matchAll(/<link\b[^>]*\brel="preload"[^>]*\bhref="([^"]+)"/g)) refs.add(m[1]);
  const h = size(file);
  const r = { html: h, js: { n: 0, raw: 0, br: 0 }, css: { n: 0, raw: 0, br: 0 }, font: { n: 0, raw: 0 }, other: 0, inlineStyleRaw: 0 };
  for (const m of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)) r.inlineStyleRaw += m[1].length;
  for (const ref of refs) {
    const path = decodeURIComponent(ref.split("?")[0]);
    if (!path.startsWith("/")) continue;
    const f = join(out, path);
    if (!existsSync(f)) continue;
    if (path.endsWith(".js")) { const s = size(f); r.js.n++; r.js.raw += s.raw; r.js.br += s.br; }
    else if (path.endsWith(".css")) { const s = size(f); r.css.n++; r.css.raw += s.raw; r.css.br += s.br; }
    else if (/\.woff2?$/.test(path)) { r.font.n++; r.font.raw += statSync(f).size; }
    else r.other++;
  }
  r.totalBr = h.br + r.js.br + r.css.br + r.font.raw;
  r.requests = 1 + r.js.n + r.css.n + r.font.n;
  routes[route] = r;
}
// All chunks (whole-site JS/CSS inventory).
const chunkDir = join(out, "_next", "static", "chunks");
const chunks = [];
if (existsSync(chunkDir)) {
  for (const n of readdirSync(chunkDir)) {
    if (!/\.(js|css)$/.test(n)) continue;
    const s = size(join(chunkDir, n));
    chunks.push({ name: n, ...s });
  }
}
chunks.sort((a, b) => b.raw - a.raw);
const kb = (n) => (n / 1024).toFixed(1).padStart(7);
console.log("route".padEnd(34), "html br", "  js n/br", "     css n/br", "  fonts", "  total br", " req");
for (const [route, r] of Object.entries(routes).sort()) {
  console.log(
    (route || "/").padEnd(34), kb(r.html.br), `${String(r.js.n).padStart(3)}/${kb(r.js.br)}`,
    `${String(r.css.n).padStart(3)}/${kb(r.css.br)}`, kb(r.font.raw), kb(r.totalBr), String(r.requests).padStart(4),
  );
}
const js = chunks.filter((c) => c.name.endsWith(".js"));
const css = chunks.filter((c) => c.name.endsWith(".css"));
const sum = (a, k) => a.reduce((t, c) => t + c[k], 0);
console.log(`\nchunks: ${js.length} js = ${kb(sum(js, "raw"))} KB raw / ${kb(sum(js, "br"))} KB br · ${css.length} css = ${kb(sum(css, "raw"))} raw / ${kb(sum(css, "br"))} br`);
console.log("largest:");
for (const c of chunks.slice(0, 14)) console.log("  ", c.name.padEnd(28), kb(c.raw), "raw", kb(c.br), "br");
if (jsonOut) writeFileSync(jsonOut, JSON.stringify({ routes, chunks }, null, 1));
