#!/usr/bin/env node
/**
 * rc.32 (WEB-02) — request budget: a cold home, and a whole Classic run from a
 * cold home, counted on a PRODUCTION export.
 *
 *   1. NEXT_PUBLIC_CAREER_MODE=1 npm run build     (built like staging)
 *   2. npm run preview:static                       (wrangler dev serving out/, :8787)
 *   3. node scripts/request-budget.mjs [baseUrl] [options]
 *                                                   (default http://127.0.0.1:8787)
 *   4. Stop the server (Ctrl+C in its terminal).
 *
 * Needs Playwright with its Chromium (not a project dependency: the cloud
 * sessions have it globally; elsewhere `npm i -g playwright` and
 * `npx playwright install chromium` once).
 *
 * Every run is a FRESH browser context (no cache, no storage): it lands on
 * `/`, lets the cold home settle, clicks "Play now", starts a Classic draft
 * with the setup's defaults, picks the first pickable card until the roster is
 * full, starts the tournament, skips to the end, opens the results and
 * dismisses whatever opens (first-visit dialogs, the tutorial, ceremonies).
 * Each screen is scrolled top to bottom once, the way a player reads it, so
 * lazy images below the fold count too (`--no-scroll` measures the clicks
 * only). Desktop uses mouse clicks; the mobile run (Pixel 7) uses taps, so
 * AppLink's intent prefetch behaves as it does on a phone.
 *
 * The draft is deterministic per seed: the page gets a seeded Math.random and
 * a fixed clock (`clock.setFixedTime`; timers still run), which pins
 * `randomSeed()` and with it the offers, the picks and the bracket. The same
 * seed on two builds compares like with like; several seeds show the spread.
 *
 * COUNTED: requests to the site's own origin that reached the network (the
 * Chrome DevTools protocol's requestWillBeSent, minus requestServedFromCache;
 * a redirect hop counts as a request). Cache hits and data: URLs are listed
 * separately; requests to other hosts are reported and fail the run (a local
 * build has no analytics or accounts configured, so there should be none).
 * The "cold home" figure is the same session's landing on `/` until the
 * network settles, before any interaction (stage "home"); "home+" is the
 * home's first-visit dialogs and the read-through.
 *
 * Reference (Turbopack export; desktop and mobile count alike on seeds 1–3;
 * ~90 s per run, a failure leaves a screenshot in the working directory):
 *   rc.31          seeds 1–3: 70–75 · seeds 1–10: 65–78 · natural mouse 78–83 · cold home 26
 *   rc.32 part E   seeds 1–3: 56–59 · seeds 1–10: 56–59 · natural mouse 56–59 · cold home 26
 *                  (DESIGN-DECISIONS #149–#150)
 *
 * Options:
 *   --seeds 1,2,3      seeds to run (default 1,2,3); "random" = unpinned
 *   --viewport both    desktop | mobile | both (default both)
 *   --budget 75        whole-run budget; the script exits 1 when a run is over
 *   --home-budget 28   cold-home budget (default: report only)
 *   --no-scroll        do not scroll the screens (clicks only)
 *   --natural-mouse    leave the cursor where the last click put it (desktop):
 *                      links that slide under it are hovered, as by a player
 *   --json <file>      write every run's requests and totals as JSON
 *   --verbose          print each counted request
 *   --headed           show the browser
 */

import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require("playwright");
} catch {
  console.error(
    "request-budget: Playwright not found. Install it globally (npm i -g playwright && npx playwright install chromium) or run where it is available.",
  );
  process.exit(2);
}
const { chromium, devices } = playwright;

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

const argv = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : fallback;
};
const flag = (name) => argv.includes(`--${name}`);
const base = (argv[0] && !argv[0].startsWith("--") ? argv[0] : "http://127.0.0.1:8787").replace(/\/$/, "");
const origin = new URL(base).origin;
const seedsArg = opt("seeds", "1,2,3");
const seeds = seedsArg === "random" ? [null] : seedsArg.split(",").map((s) => Number(s.trim()));
const viewports = { both: ["desktop", "mobile"], desktop: ["desktop"], mobile: ["mobile"] }[opt("viewport", "both")];
const budget = Number(opt("budget", "75"));
const homeBudget = opt("home-budget", null) === null ? null : Number(opt("home-budget"));
const scroll = !flag("no-scroll");
const naturalMouse = flag("natural-mouse");
const verbose = flag("verbose");
const jsonOut = opt("json", null);
if (!viewports || seeds.some((s) => s !== null && !Number.isFinite(s))) {
  console.error("request-budget: bad --viewport or --seeds");
  process.exit(2);
}

/** Fixed clock for pinned runs (any date works; this one sits inside Season 1). */
const FIXED_TIME = new Date("2026-10-29T15:00:00Z");
const STEP_TIMEOUT = 30_000;
const SETTLE_MS = 2500;

// ---------------------------------------------------------------------------
// Request classification
// ---------------------------------------------------------------------------

/** Request kind for the report, from the URL path and the CDP resource type. */
function kindOf(url, type) {
  const p = new URL(url).pathname;
  if (type === "Document") return "document";
  if (p.startsWith("/img/orgs/") || p.startsWith("/orgs/")) return "img:org";
  if (p.startsWith("/flags/") || p.startsWith("/img/flags/")) return "img:flag";
  if (p.startsWith("/img/specials/") || p.startsWith("/cards/")) return "img:special";
  if (p.startsWith("/img/ranks/") || p.startsWith("/ranks/")) return "img:rank";
  if (p.startsWith("/img/badges/") || p.startsWith("/badges/")) return "img:badge";
  if (p.startsWith("/img/banners/") || p.startsWith("/banners/")) return "img:banner";
  if (/^\/(favicon\.ico|icon\.svg|apple-icon\.png)/.test(p)) return "icon";
  if (p.endsWith(".webmanifest")) return "manifest";
  if (p.endsWith(".txt") || url.includes("_rsc=")) return "rsc";
  if (type === "Script" || p.endsWith(".js")) return "script";
  if (type === "Stylesheet" || p.endsWith(".css")) return "css";
  if (type === "Font" || /\.(woff2?|ttf|otf)$/.test(p)) return "font";
  if (type === "Image") return "img:other";
  return "other";
}

/** Attaches CDP network accounting to a page; returns a live record. */
async function track(context, page) {
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  const byId = new Map(); // requestId → entries (one per redirect hop)
  const rec = { entries: [], external: [], dataUrls: 0, stage: "home" };
  cdp.on("Network.requestWillBeSent", (e) => {
    const url = e.request.url;
    if (url.startsWith("data:") || url.startsWith("blob:")) {
      rec.dataUrls += 1;
      return;
    }
    let u;
    try {
      u = new URL(url);
    } catch {
      return;
    }
    if (u.origin !== origin) {
      rec.external.push(url);
      return;
    }
    const entry = {
      url,
      path: u.pathname + u.search,
      type: e.type ?? "Other",
      kind: kindOf(url, e.type),
      cached: false,
      status: null,
      t: Date.now(),
      stage: rec.stage,
    };
    const hops = byId.get(e.requestId) ?? [];
    // A redirect re-uses the requestId: the previous hop got its 3xx.
    if (e.redirectResponse && hops.length) hops[hops.length - 1].status = e.redirectResponse.status;
    hops.push(entry);
    byId.set(e.requestId, hops);
    rec.entries.push(entry);
  });
  cdp.on("Network.requestServedFromCache", (e) => {
    const hops = byId.get(e.requestId);
    if (hops) hops[hops.length - 1].cached = true;
  });
  cdp.on("Network.responseReceived", (e) => {
    const hops = byId.get(e.requestId);
    if (!hops) return;
    const last = hops[hops.length - 1];
    last.status = e.response.status;
    if (e.response.fromDiskCache || e.response.fromPrefetchCache || e.response.fromServiceWorker) last.cached = true;
  });
  cdp.on("Network.loadingFailed", (e) => {
    const hops = byId.get(e.requestId);
    if (hops && hops[hops.length - 1].status === null) hops[hops.length - 1].status = e.canceled ? "canceled" : "failed";
  });
  return rec;
}

const network = (rec) => rec.entries.filter((e) => !e.cached);

function tally(entries) {
  const byKind = {};
  for (const e of entries) byKind[e.kind] = (byKind[e.kind] ?? 0) + 1;
  return byKind;
}

// ---------------------------------------------------------------------------
// Driver
// ---------------------------------------------------------------------------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Mulberry32 Math.random + nothing else: injected before any page script. */
const seededRandomScript = (seed) => `(() => {
  let a = ${seed >>> 0} || 1;
  Math.random = function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
})();`;

async function idle(page, ms = SETTLE_MS) {
  await page.waitForLoadState("networkidle", { timeout: STEP_TIMEOUT }).catch(() => {});
  await sleep(ms);
}

/** The persisted run's phase/round (the run store writes it on every change). */
const runState = (page) =>
  page.evaluate(() => {
    try {
      const run = JSON.parse(localStorage.getItem("rocket-draft:run:v1") ?? "null")?.state?.run;
      return run ? { phase: run.phase, round: run.draft?.round ?? 0 } : null;
    } catch {
      return null;
    }
  });

/**
 * Click (desktop) or tap (mobile). Taps never fire AppLink's hover intent; a
 * desktop click parks the mouse in the empty left margin afterwards, so a
 * link that slides under a resting cursor (a dialog closing, a scroll) is not
 * prefetched by accident — the count is what the screens request.
 */
async function press(locator, mobile) {
  await locator.scrollIntoViewIfNeeded({ timeout: STEP_TIMEOUT });
  if (mobile) {
    await locator.tap({ timeout: STEP_TIMEOUT });
    return;
  }
  await locator.click({ timeout: STEP_TIMEOUT });
  if (naturalMouse) return;
  const page = locator.page();
  await page.mouse.move(2, Math.round((page.viewportSize()?.height ?? 800) / 2));
}

/** Scroll the page top → bottom in viewport steps, then back to the top. */
async function readThrough(page) {
  if (!scroll) return;
  const { h, vh } = await page.evaluate(() => ({ h: document.documentElement.scrollHeight, vh: innerHeight }));
  for (let y = 0; y < h; y += Math.round(vh * 0.8)) {
    await page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), y);
    await sleep(250);
  }
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
  await sleep(400);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await sleep(200);
}

/** Preferred buttons inside an open dialog, in order; else its last button. */
const DIALOG_BUTTONS = [/^let's play$/i, /^start season 1$/i, /^continue$/i, /^got it/i, /^next$/i, /^skip$/i, /^close$/i, /^ok$/i];

/** Dismisses every open modal dialog (first-visit pop-ups, tutorial, ceremonies). */
async function dismissDialogs(page, mobile, maxSteps = 25) {
  let steps = 0;
  for (; steps < maxSteps; steps++) {
    const dialog = page.locator('[role="dialog"][aria-modal="true"]:visible').last();
    if (!(await dialog.count())) break;
    const buttons = dialog.locator("button:visible:enabled");
    const n = await buttons.count();
    let target = null;
    if (n) {
      const labels = await buttons.evaluateAll((els) =>
        els.map((el) => (el.getAttribute("aria-label") || el.textContent || "").trim()),
      );
      for (const re of DIALOG_BUTTONS) {
        const i = labels.findIndex((l) => re.test(l));
        if (i >= 0) {
          target = buttons.nth(i);
          break;
        }
      }
      target ??= buttons.nth(n - 1);
    }
    if (target) await press(target, mobile).catch(() => page.keyboard.press("Escape"));
    else await page.keyboard.press("Escape");
    await sleep(500);
  }
  return steps;
}

async function waitFor(page, predicate, label) {
  const t0 = Date.now();
  while (Date.now() - t0 < STEP_TIMEOUT) {
    if (await predicate()) return;
    await sleep(200);
  }
  throw new Error(`timed out waiting for ${label}`);
}

async function classicRun(browser, { viewport, seed }) {
  const mobile = viewport === "mobile";
  const context = await browser.newContext(
    mobile ? { ...devices["Pixel 7"], locale: "en-US" } : { viewport: { width: 1366, height: 900 }, locale: "en-US" },
  );
  if (seed !== null) {
    await context.addInitScript(seededRandomScript(seed));
  }
  const page = await context.newPage();
  if (seed !== null) await page.clock.setFixedTime(FIXED_TIME);
  const rec = await track(context, page);
  /** Requests are labelled with the stage that is running when they start. */
  const enter = (stage) => {
    rec.stage = stage;
  };
  if (!mobile && !naturalMouse) await page.mouse.move(2, 450);

  try {
    // 1. Cold home.
    await page.goto(`${base}/`, { waitUntil: "load", timeout: STEP_TIMEOUT });
    await idle(page);
    enter("home+");
    await dismissDialogs(page, mobile);
    await readThrough(page);
    await idle(page, 800);
    enter("setup");

    // 2. Play now → /play (Classic setup).
    await press(page.getByRole("button", { name: "Play now →" }), mobile);
    await page.waitForURL(/\/play$/, { timeout: STEP_TIMEOUT });
    const start = page.getByRole("button", { name: "Start Draft" });
    await start.waitFor({ timeout: STEP_TIMEOUT });
    await idle(page, 800);
    await dismissDialogs(page, mobile);
    enter("draft");
    await press(start, mobile);

    // 3. Draft: first pickable card until the roster is full.
    for (let picks = 0; picks < 20; picks++) {
      await dismissDialogs(page, mobile);
      const st = await runState(page);
      if (!st || st.phase !== "draft") break;
      // The offer grid's card buttons (a card that cannot be drafted is a div).
      const card = page.locator("main div.grid.grid-cols-3 button:visible:enabled").first();
      const reroll = page.getByRole("button", { name: /^Free reroll/ });
      await waitFor(
        page,
        async () => (await card.count()) > 0 || (await reroll.count()) > 0 || (await runState(page))?.phase !== "draft",
        "a pickable card",
      );
      if ((await runState(page))?.phase !== "draft") break;
      if (picks === 0) await readThrough(page);
      if (await card.count()) await press(card, mobile);
      else await press(reroll.first(), mobile);
      await waitFor(
        page,
        async () => {
          const now = await runState(page);
          return !now || now.phase !== "draft" || now.round !== st.round;
        },
        "the next offer",
      );
      await sleep(400);
    }
    await idle(page, 800);
    enter("review");

    // 4. Review → Start Tournament.
    await dismissDialogs(page, mobile);
    const startT = page.getByRole("button", { name: "Start Tournament" });
    await startT.waitFor({ timeout: STEP_TIMEOUT });
    await readThrough(page);
    enter("tournament");
    await press(startT, mobile);

    // 5. Tournament → Skip to end → View results.
    await dismissDialogs(page, mobile);
    const skip = page.getByRole("button", { name: "Skip to end" });
    await skip.waitFor({ timeout: STEP_TIMEOUT });
    await press(skip, mobile);
    await idle(page, 1000);
    await dismissDialogs(page, mobile);
    await readThrough(page);
    const toResults = page.getByRole("button", { name: "View results" }).first();
    await toResults.waitFor({ timeout: STEP_TIMEOUT });
    enter("results");
    await press(toResults, mobile);

    // 6. Results: ceremonies, then read the page.
    await waitFor(page, async () => (await runState(page))?.phase === "results", "the results");
    await idle(page, 1500);
    await dismissDialogs(page, mobile);
    await idle(page, 1000);
    await dismissDialogs(page, mobile);
    await readThrough(page);
    await idle(page);
  } catch (err) {
    const shot = `request-budget-failure-${viewport}-${seed ?? "random"}.png`;
    await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
    await context.close();
    throw new Error(`${viewport} seed ${seed ?? "random"}: ${err.message} (screenshot: ${shot})`);
  }

  await context.close();
  return { viewport, seed, rec };
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

const KINDS = [
  "document",
  "script",
  "css",
  "font",
  "rsc",
  "img:org",
  "img:flag",
  "img:special",
  "img:rank",
  "img:badge",
  "img:banner",
  "img:other",
  "icon",
  "manifest",
  "other",
];

const STAGES = ["home", "home+", "setup", "draft", "review", "tournament", "results"];

function summarize({ viewport, seed, rec }) {
  const net = network(rec);
  const home = net.filter((e) => e.stage === "home");
  const byKind = tally(net);
  const dupes = {};
  for (const e of net) dupes[e.path] = (dupes[e.path] ?? 0) + 1;
  const repeated = Object.entries(dupes).filter(([, n]) => n > 1);
  const notFound = net.filter((e) => e.status === 404);
  return {
    viewport,
    seed,
    total: net.length,
    coldHome: home.length,
    coldHomeByKind: tally(home),
    byKind,
    byStage: Object.fromEntries(STAGES.map((st) => [st, net.filter((e) => e.stage === st).length])),
    distinct: {
      orgLogos: new Set(net.filter((e) => e.kind === "img:org").map((e) => e.path)).size,
      orgKeys: new Set(net.filter((e) => e.kind === "img:org").map((e) => e.path.split("/").pop().split(".")[0])).size,
      flags: new Set(net.filter((e) => e.kind === "img:flag").map((e) => e.path)).size,
    },
    cacheHits: rec.entries.length - net.length,
    dataUrls: rec.dataUrls,
    repeatedOverNetwork: repeated,
    notFound: notFound.map((e) => e.path),
    external: rec.external,
    requests: net.map((e) => ({ path: e.path, kind: e.kind, status: e.status, stage: e.stage })),
  };
}

const browser = await chromium.launch({ headless: !flag("headed") });
const results = [];
let failed = false;
try {
  for (const viewport of viewports) {
    for (const seed of seeds) {
      const t0 = Date.now();
      const s = summarize(await classicRun(browser, { viewport, seed }));
      results.push(s);
      const kinds = KINDS.filter((k) => s.byKind[k]).map((k) => `${k} ${s.byKind[k]}`).join(" · ");
      console.log(
        `${viewport.padEnd(7)} seed ${String(seed ?? "rnd").padEnd(3)}  run ${String(s.total).padStart(3)}  cold home ${String(s.coldHome).padStart(2)}  (${((Date.now() - t0) / 1000).toFixed(0)} s)`,
      );
      console.log(`    ${kinds}`);
      console.log(
        `    stages: ${Object.entries(s.byStage).map(([k, v]) => `${k} ${v}`).join(" · ")}  |  distinct logos ${s.distinct.orgLogos} (${s.distinct.orgKeys} orgs), flags ${s.distinct.flags}  |  cache hits ${s.cacheHits}, data: ${s.dataUrls}`,
      );
      if (s.repeatedOverNetwork.length) console.log(`    fetched twice: ${s.repeatedOverNetwork.map(([p, n]) => `${p} ×${n}`).join(", ")}`);
      if (s.notFound.length) console.log(`    404: ${s.notFound.join(", ")}`);
      if (verbose) for (const r of s.requests) console.log(`      ${r.stage.padEnd(10)} ${r.kind.padEnd(11)} ${r.status} ${r.path}`);
      if (s.external.length) {
        console.log(`    EXTERNAL: ${s.external.join(", ")}`);
        failed = true;
      }
      if (s.total > budget) failed = true;
      if (homeBudget !== null && s.coldHome > homeBudget) failed = true;
    }
  }
} finally {
  await browser.close();
}

const totals = results.map((r) => r.total);
const homes = results.map((r) => r.coldHome);
console.log(
  `\nrequest-budget: whole Classic run ${Math.min(...totals)}–${Math.max(...totals)} (budget ${budget}) · cold home ${Math.min(...homes)}–${Math.max(...homes)}${homeBudget !== null ? ` (budget ${homeBudget})` : ""} · ${results.length} run(s), scroll ${scroll ? "on" : "off"}${naturalMouse ? ", natural mouse" : ""} · ${base}`,
);
if (jsonOut) {
  writeFileSync(jsonOut, JSON.stringify({ base, scroll, naturalMouse, budget, results }, null, 2));
  console.log(`request-budget: wrote ${jsonOut}`);
}
if (failed) {
  console.error("request-budget: OVER BUDGET (or external requests) — see above");
  process.exit(1);
}
