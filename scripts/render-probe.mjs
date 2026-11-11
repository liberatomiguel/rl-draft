#!/usr/bin/env node
/**
 * v2.0 (WEB-02) — render cost per route on a PRODUCTION export: a cold first
 * visit in a fresh context on an emulated phone (Pixel 7, CPU 4x slowdown),
 * then an idle window. Median of RUNS loads (default 3). Reports FCP / LCP /
 * CLS, main-thread work to settle (task, script, layout ms), long tasks, DOM
 * size, transfer and the idle main-thread cost (ms of task time per second).
 *
 *   npm run build && npm run preview:static        (wrangler dev serving out/)
 *   node scripts/render-probe.mjs http://127.0.0.1:8787 result.json [route ...]
 *
 * Needs Playwright (not a project dependency), as scripts/request-budget.mjs
 * does: install it anywhere and point NODE_PATH at its node_modules, and set
 * CHROME_PATH to an installed Chrome/Edge to skip the browser download. In Git
 * Bash pass routes with MSYS_NO_PATHCONV=1, or "/play" becomes a Windows path.
 * Timings move with the machine's load; CLS, node and request counts do not.
 *
 * Reference (first visit, phone): CLS rc.45 → rc.45 + C4
 *   /collection 0.35 → 0.00 · /profile 0.33 → 0 · /challenges 0.31 → 0 · /play 0.14 → 0
 * (the footer moved in view while the page hydrated; see AppShell's <main>).
 * Idle cost 0–1 ms/s on every route. scripts/cls-sources.mjs names what moved.
 */
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const { chromium, devices } = require("playwright");

const base = (process.argv[2] ?? "http://127.0.0.1:8787").replace(/\/$/, "");
const jsonOut = process.argv[3];
const routes = process.argv.slice(4);
if (!routes.length) routes.push("/", "/play", "/collection", "/profile", "/challenges", "/leaderboards", "/quiz", "/how-to-play", "/about");
const RUNS = Number(process.env.RUNS ?? 3);
const CPU = Number(process.env.CPU ?? 4);

const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
});
const metricsOf = async (cdp) => {
  const { metrics } = await cdp.send("Performance.getMetrics");
  return Object.fromEntries(metrics.map((m) => [m.name, m.value]));
};
const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
const out = {};
for (const route of routes) {
  const runs = [];
  for (let i = 0; i < RUNS; i++) {
    const context = await browser.newContext({ ...devices["Pixel 7"] });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send("Performance.enable");
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU });
    let bytes = 0;
    let reqs = 0;
    await cdp.send("Network.enable");
    cdp.on("Network.loadingFinished", (e) => { bytes += e.encodedDataLength; reqs++; });
    await page.addInitScript(() => {
      window.__lt = [];
      try {
        new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push(Math.round(e.duration)); }).observe({ type: "longtask", buffered: true });
        new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp = Math.round(e.startTime); }).observe({ type: "largest-contentful-paint", buffered: true });
        new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls = (window.__cls ?? 0) + e.value; }).observe({ type: "layout-shift", buffered: true });
      } catch {}
    });
    const t0 = Date.now();
    await page.goto(base + route, { waitUntil: "load" });
    const loadMs = Date.now() - t0;
    await page.waitForTimeout(3500); // hydration + first-visit UI settle
    const settled = await metricsOf(cdp);
    const info = await page.evaluate(() => ({
      lt: window.__lt, lcp: window.__lcp ?? null, cls: window.__cls ?? 0,
      nodes: document.getElementsByTagName("*").length,
      fcp: Math.round(performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? 0),
      anims: document.getAnimations().filter((a) => a.playState === "running").length,
    }));
    // idle window
    const a = await metricsOf(cdp);
    await page.waitForTimeout(4000);
    const b = await metricsOf(cdp);
    runs.push({
      loadMs, fcp: info.fcp, lcp: info.lcp, cls: +info.cls.toFixed(4),
      taskMs: Math.round(settled.TaskDuration * 1000), scriptMs: Math.round(settled.ScriptDuration * 1000),
      layoutMs: Math.round((settled.LayoutDuration + settled.RecalcStyleDuration) * 1000),
      longTasks: info.lt.length, longestTask: Math.max(0, ...info.lt), nodes: info.nodes,
      heapMB: +(settled.JSHeapUsedSize / 1048576).toFixed(1), kb: Math.round(bytes / 1024), reqs,
      idleMsPerS: Math.round(((b.TaskDuration - a.TaskDuration) * 1000) / 4), runningAnims: info.anims,
    });
    await context.close();
  }
  const m = {};
  for (const k of Object.keys(runs[0])) m[k] = median(runs.map((r) => r[k]));
  out[route] = m;
  console.log(route.padEnd(16), JSON.stringify(m));
}
await browser.close();
if (jsonOut) writeFileSync(jsonOut, JSON.stringify(out, null, 1));
