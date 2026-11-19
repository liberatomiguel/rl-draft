#!/usr/bin/env node
/**
 * v2.0.33 — the career landing's share image (Open Graph and the X card), EN and PT.
 *
 *   node scripts/build-og-career.mjs
 *
 * Renders a 1200×630 card with Chrome's own headless screenshot (CHROME_PATH, or
 * the usual install paths; no Playwright needed) using the site's font
 * (src/app/fonts/rajdhani-*.woff2), the career HQ capture (public/landing) and
 * the icon, converts it to JPEG with sharp and writes
 * public/landing/career-share-{en,pt}.jpg (`careerShareSrc` in lib/assets).
 * The landing routes pass it to their metadata with the H1 as its alt text.
 * Not the opengraph-image file convention: Turbopack drops its .alt.txt in a
 * nested route. Re-run it after a new HQ capture or a copy change, and commit
 * the output.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

const ROOT = process.cwd();
const CANDIDATES = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter(Boolean);
const chromePath = CANDIDATES.find((p) => existsSync(p));
if (!chromePath) {
  console.error("build-og-career: no Chrome/Edge found — set CHROME_PATH");
  process.exit(1);
}

const WIDTH = 1200;
const HEIGHT = 630;
const dataUrl = (file, type) => `data:${type};base64,${readFileSync(join(ROOT, file)).toString("base64")}`;
const FONT_700 = dataUrl("src/app/fonts/rajdhani-700.woff2", "font/woff2");
const FONT_600 = dataUrl("src/app/fonts/rajdhani-600.woff2", "font/woff2");
const SHOT = dataUrl("public/landing/career-hq.webp", "image/webp");
const ICON = dataUrl("src/app/icon.svg", "image/svg+xml");

const CARDS = [
  {
    out: "public/landing/career-share-en.jpg",
    lang: "en",
    title: ["Rocket League", "Career Mode"],
    size: 92,
    points: ["Run an RLCS club", "Free in your browser", "No download, no mod"],
  },
  {
    out: "public/landing/career-share-pt.jpg",
    lang: "pt-BR",
    title: ["Modo Carreira", "de Rocket League"],
    size: 76,
    points: ["Comande um clube da RLCS", "Grátis no navegador", "Sem download, sem mod"],
  },
];

// The page marks <html data-overflow> once the fonts are in, so a title too
// wide for its column fails the build instead of shipping clipped.
const html = (card) => `<!doctype html><html lang="${card.lang}"><head><meta charset="utf-8"><style>
@font-face{font-family:Rajdhani;font-weight:700;src:url(${FONT_700}) format("woff2")}
@font-face{font-family:Rajdhani;font-weight:600;src:url(${FONT_600}) format("woff2")}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${WIDTH}px;height:${HEIGHT}px;overflow:hidden}
body{background:#05080f;font-family:Rajdhani,sans-serif;color:#f8fafc;position:relative}
.glow{position:absolute;inset:0;background:radial-gradient(55% 70% at 88% 28%,rgba(249,115,22,.30),transparent 70%),radial-gradient(45% 60% at 0% 100%,rgba(56,189,248,.10),transparent 70%)}
.shot{position:absolute;left:600px;top:96px;width:720px;border-radius:18px;border:2px solid rgba(255,255,255,.16);box-shadow:0 30px 80px rgba(0,0,0,.65);transform:perspective(1500px) rotateY(-16deg) rotateX(3deg);transform-origin:left center}
.fade{position:absolute;inset:0;background:linear-gradient(90deg,#05080f 0%,#05080f 46%,rgba(5,8,15,.6) 60%,rgba(5,8,15,0) 76%)}
.copy{position:absolute;left:72px;top:84px;width:640px}
.kicker{font-weight:700;font-size:28px;letter-spacing:.24em;text-transform:uppercase;color:#fb923c}
h1{margin-top:12px;font-weight:700;line-height:.92;letter-spacing:.02em;text-transform:uppercase;white-space:nowrap}
ul{list-style:none;margin-top:30px}
li{font-weight:600;font-size:32px;line-height:1.4;color:#cbd5e1;display:flex;align-items:center;gap:14px}
li::before{content:"";flex:none;width:10px;height:10px;border-radius:50%;background:#fb923c}
.brand{position:absolute;left:72px;bottom:52px;display:flex;align-items:center;gap:16px;font-weight:700;font-size:34px;letter-spacing:.14em;text-transform:uppercase}
.brand img{width:52px;height:52px}
.brand span{color:#94a3b8;font-weight:600;font-size:26px;letter-spacing:.06em;text-transform:none}
</style></head><body>
<div class="glow"></div>
<img class="shot" src="${SHOT}" alt="">
<div class="fade"></div>
<div class="copy">
<p class="kicker">Road to Worlds</p>
<h1 style="font-size:${card.size}px">${card.title.join("<br>")}</h1>
<ul>${card.points.map((p) => `<li>${p}</li>`).join("")}</ul>
</div>
<div class="brand"><img src="${ICON}" alt="">Rocket Draft <span>rocketdraft.app</span></div>
<script>document.fonts.ready.then(() => {
  const h1 = document.querySelector("h1");
  document.documentElement.dataset.overflow = h1.scrollWidth > h1.parentElement.clientWidth ? "yes" : "no";
});</script>
</body></html>`;

const work = mkdtempSync(join(tmpdir(), "og-career-"));
const chrome = (args) =>
  execFileSync(
    chromePath,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--no-first-run",
      "--no-default-browser-check",
      `--user-data-dir=${join(work, "profile")}`,
      "--force-device-scale-factor=1",
      `--window-size=${WIDTH},${HEIGHT}`,
      "--virtual-time-budget=5000",
      ...args,
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 64 * 1024 * 1024 },
  );

try {
  for (const card of CARDS) {
    const page = join(work, `${card.lang}.html`);
    writeFileSync(page, html(card));
    const url = pathToFileURL(page).href;
    const dom = chrome(["--dump-dom", url]);
    if (!dom.includes('data-overflow="no"')) {
      throw new Error(`${card.lang}: the title does not fit its column (or the fonts never loaded) — lower its size`);
    }
    const png = join(work, `${card.lang}.png`);
    chrome([`--screenshot=${png}`, url]);
    const jpg = await sharp(png)
      .resize(WIDTH, HEIGHT, { fit: "cover", position: "left top" })
      .jpeg({ quality: 88, mozjpeg: true })
      .toBuffer();
    writeFileSync(join(ROOT, card.out), jpg);
    console.log(`  ${card.out}: ${(jpg.length / 1024).toFixed(0)} KB`);
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}
