#!/usr/bin/env node
/**
 * v2.0 (WEB-02) — what moves: every layout shift of a cold first visit, with
 * the elements that moved and their old and new position. Use it when
 * scripts/render-probe.mjs reports a CLS above zero.
 *
 *   node scripts/cls-sources.mjs http://127.0.0.1:8787 mobile /collection /profile
 *   node scripts/cls-sources.mjs http://127.0.0.1:8787 desktop /play
 *
 * Same requirements as render-probe (Playwright via NODE_PATH, CHROME_PATH,
 * MSYS_NO_PATHCONV=1 in Git Bash).
 */
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium, devices } = require("playwright");
const base = process.argv[2].replace(/\/$/, "");
const mode = process.argv[3] ?? "mobile";
const routes = process.argv.slice(4);
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
for (const route of routes) {
  const context = await browser.newContext(mode === "mobile" ? { ...devices["Pixel 7"] } : { viewport: { width: 1366, height: 900 } });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await page.addInitScript(() => {
    window.__shifts = [];
    const desc = (n) => {
      if (!n) return "(gone)";
      const el = n.nodeType === 1 ? n : n.parentElement;
      if (!el) return "(text)";
      const cls = (el.getAttribute("class") || "").split(/\s+/).slice(0, 5).join(".");
      return `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}${cls ? "." + cls : ""} "${(el.textContent || "").trim().slice(0, 30)}"`;
    };
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) {
        if (e.hadRecentInput) continue;
        window.__shifts.push({
          t: Math.round(e.startTime), v: +e.value.toFixed(4),
          src: (e.sources || []).slice(0, 4).map((s) => `${desc(s.node)} y:${Math.round(s.previousRect.y)}→${Math.round(s.currentRect.y)} h:${Math.round(s.previousRect.height)}→${Math.round(s.currentRect.height)}`),
        });
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
  await page.goto(base + route, { waitUntil: "load" });
  await page.waitForTimeout(4000);
  const shifts = await page.evaluate(() => window.__shifts);
  console.log(`\n== ${route} (${mode}) total ${shifts.reduce((t, s) => t + s.v, 0).toFixed(3)}`);
  for (const s of shifts) { console.log(`  t=${s.t}ms v=${s.v}`); for (const x of s.src) console.log("     ", x); }
  await context.close();
}
await browser.close();
