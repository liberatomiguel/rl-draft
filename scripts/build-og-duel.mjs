#!/usr/bin/env node
/**
 * v2.1 — the friend duel's share image (Open Graph and the X card) for /duel.
 *
 *   node scripts/build-og-duel.mjs
 *
 * Same pipeline as build-og-career.mjs: a 1200×630 card rendered with Chrome's
 * own headless screenshot (CHROME_PATH, or the usual install paths) in the
 * site's font, converted to JPEG with sharp, written to
 * public/landing/duel-share.jpg (`duelShareSrc` in lib/assets). One static image
 * for every duel link: the link itself lives in the hash, which a link preview
 * never sees. Re-run after a copy change and commit the output.
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
  console.error("build-og-duel: no Chrome/Edge found — set CHROME_PATH");
  process.exit(1);
}

const WIDTH = 1200;
const HEIGHT = 630;
const dataUrl = (file, type) => `data:${type};base64,${readFileSync(join(ROOT, file)).toString("base64")}`;
const FONT_700 = dataUrl("src/app/fonts/rajdhani-700.woff2", "font/woff2");
const FONT_600 = dataUrl("src/app/fonts/rajdhani-600.woff2", "font/woff2");
const ICON = dataUrl("src/app/icon.svg", "image/svg+xml");

const CARDS = [
  {
    out: "public/landing/duel-share.jpg",
    lang: "en",
    title: ["Same draft.", "Same bracket."],
    size: 88,
    points: ["Your friend drafted this seed", "Same offers, same field", "Beat their run, send it back"],
  },
];

// Two run lines facing each other, the duel in one look. The page marks
// <html data-overflow> once the fonts are in, so a title too wide fails the build.
const html = (card) => `<!doctype html><html lang="${card.lang}"><head><meta charset="utf-8"><style>
@font-face{font-family:Rajdhani;font-weight:700;src:url(${FONT_700}) format("woff2")}
@font-face{font-family:Rajdhani;font-weight:600;src:url(${FONT_600}) format("woff2")}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${WIDTH}px;height:${HEIGHT}px;overflow:hidden}
body{background:#05080f;font-family:Rajdhani,sans-serif;color:#f8fafc;position:relative}
.glow{position:absolute;inset:0;background:radial-gradient(50% 70% at 86% 40%,rgba(249,115,22,.28),transparent 70%),radial-gradient(45% 60% at 0% 100%,rgba(56,189,248,.12),transparent 70%)}
.copy{position:absolute;left:72px;top:84px;width:640px}
.kicker{font-weight:700;font-size:28px;letter-spacing:.24em;text-transform:uppercase;color:#fb923c}
h1{margin-top:12px;font-weight:700;line-height:.92;letter-spacing:.02em;text-transform:uppercase;white-space:nowrap}
ul{list-style:none;margin-top:30px}
li{font-weight:600;font-size:32px;line-height:1.4;color:#cbd5e1;display:flex;align-items:center;gap:14px}
li::before{content:"";flex:none;width:10px;height:10px;border-radius:50%;background:#fb923c}
.board{position:absolute;right:72px;top:150px;width:380px;border-top:2px solid rgba(255,255,255,.14)}
.row{display:flex;align-items:center;gap:18px;padding:22px 6px;border-bottom:2px solid rgba(255,255,255,.14)}
.rank{font-weight:700;font-size:44px;width:34px;text-align:center;color:#64748b}
.row.top .rank{color:#fb923c}
.who{flex:1}
.who small{display:block;font-weight:600;font-size:22px;color:#94a3b8}
.who b{display:block;font-weight:700;font-size:36px;text-transform:uppercase;line-height:1}
.ovr{font-weight:700;font-size:34px;text-align:right}
.ovr small{display:block;font-weight:600;font-size:18px;color:#64748b;letter-spacing:.1em}
.vs{position:absolute;right:72px;top:96px;width:380px;font-weight:700;font-size:26px;letter-spacing:.24em;color:#94a3b8;text-transform:uppercase}
.brand{position:absolute;left:72px;bottom:52px;display:flex;align-items:center;gap:16px;font-weight:700;font-size:34px;letter-spacing:.14em;text-transform:uppercase}
.brand img{width:52px;height:52px}
.brand span{color:#94a3b8;font-weight:600;font-size:26px;letter-spacing:.06em;text-transform:none}
</style></head><body>
<div class="glow"></div>
<div class="copy">
<p class="kicker">Friend duel</p>
<h1 style="font-size:${card.size}px">${card.title.join("<br>")}</h1>
<ul>${card.points.map((p) => `<li>${p}</li>`).join("")}</ul>
</div>
<p class="vs">Standings</p>
<div class="board">
<div class="row top"><span class="rank">1</span><span class="who"><small>Run 1</small><b>On the board</b></span></div>
<div class="row"><span class="rank">2</span><span class="who"><small>You</small><b>Your turn</b></span></div>
</div>
<div class="brand"><img src="${ICON}" alt="">Rocket Draft <span>rocketdraft.app</span></div>
<script>document.fonts.ready.then(() => {
  const h1 = document.querySelector("h1");
  document.documentElement.dataset.overflow = h1.scrollWidth > h1.parentElement.clientWidth ? "yes" : "no";
});</script>
</body></html>`;

const work = mkdtempSync(join(tmpdir(), "og-duel-"));
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
