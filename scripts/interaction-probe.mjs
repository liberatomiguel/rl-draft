#!/usr/bin/env node
/**
 * v2.0 (P1) — interaction cost on a PRODUCTION export, on an emulated phone
 * (Pixel 7, CPU 4x slowdown). For each interaction of the draft, the profile
 * and Road to Worlds it reports:
 *   INP     the slowest input of the step, input to next paint (Event Timing), ms
 *   LT      long tasks after the step started: count, longest, total (ms)
 *   main    main-thread time until the page is quiet again, split into script,
 *           layout and style recalculation, and the number of layouts
 *   writes  localStorage writes of the step (count, KB)
 *   nodes   DOM size afterwards
 * "layouts" is the one to watch for an animation that is not on the
 * compositor: a transition on width / left runs one layout per frame (about
 * 40 per advanced day before v2.0 P1; 2 after).
 *
 *   npm run build   (NEXT_PUBLIC_CAREER_MODE=1), then serve out/ (npm run preview:static)
 *   node scripts/interaction-probe.mjs <base> <fixturesDir> <out.json> [scenario ...]
 *
 * Scenarios: loads · career-s1 · career-late · career-x3 · career-event · draft
 * (draft also walks the profile, the locker, achievements and the collection).
 * The career scenarios load a saved career into localStorage: write the
 * fixtures with
 *   P1_FIX=1 P1_FIX_OUT=<fixturesDir> npx vitest run src/store/careerPerfFixtures.probe.test.ts
 * (career-s1.json, career-late.json, career-late-x3.json, career-late-matchday.json).
 *
 * Needs Playwright (not a project dependency), as scripts/render-probe.mjs
 * does: install it anywhere, point NODE_PATH at its node_modules and set
 * CHROME_PATH to an installed Chrome. In Git Bash set MSYS_NO_PATHCONV=1.
 * CPU=<n> changes the slowdown, REPS=<n> the repetitions of `loads`.
 * Timings move with the machine's load (run the two builds back to back and
 * repeat); layout counts, writes and node counts do not.
 */
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const require = createRequire(import.meta.url);
const { chromium, devices } = require("playwright");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function launch() {
  return chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
}

/** A phone context with localStorage seeded once (never re-seeded on reload/navigation). */
async function phone(browser, { storage = {}, cpu = 4, mobile = true } = {}) {
  const context = await browser.newContext(mobile ? { ...devices["Pixel 7"], locale: "en-US" } : { viewport: { width: 1366, height: 900 }, locale: "en-US" });
  const seed = Object.fromEntries(Object.entries(storage).map(([k, v]) => [k, typeof v === "string" && v.endsWith(".json") ? readFileSync(v, "utf8") : v]));
  await context.addInitScript((seed) => {
    try {
      if (!localStorage.getItem("__p1_seeded")) {
        for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
        localStorage.setItem("__p1_seeded", "1");
      }
    } catch {}
    // --- instrumentation -------------------------------------------------
    const P = (window.__p = { lt: [], ev: [], writes: [], lastBusy: 0 });
    try {
      new PerformanceObserver((l) => {
        for (const e of l.getEntries()) {
          P.lt.push({ s: Math.round(e.startTime), d: Math.round(e.duration) });
          P.lastBusy = Math.max(P.lastBusy, e.startTime + e.duration);
        }
      }).observe({ type: "longtask", buffered: true });
      new PerformanceObserver((l) => {
        for (const e of l.getEntries()) {
          if (!e.interactionId) continue;
          P.ev.push({ n: e.name, d: Math.round(e.duration), delay: Math.round(e.processingStart - e.startTime), proc: Math.round(e.processingEnd - e.processingStart), s: Math.round(e.startTime) });
        }
      }).observe({ type: "event", durationThreshold: 16, buffered: true });
    } catch {}
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      const t0 = performance.now();
      const out = set.call(this, k, v);
      if (k !== "__p1_seeded") P.writes.push({ k, kb: Math.round(String(v).length / 1024), ms: Math.round((performance.now() - t0) * 10) / 10, s: Math.round(t0) });
      return out;
    };
  }, seed);
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  if (cpu > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpu });
  await cdp.send("Performance.enable");
  page._cdp = cdp;
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 300)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 300)}`); });
  return { context, page, cdp, errors };
}

/** Wait until the main thread has been quiet (no long task) for `quiet` ms. */
async function settle(page, quiet = 500, max = 20000) {
  await page.evaluate(
    ({ quiet, max }) =>
      new Promise((res) => {
        const t0 = performance.now();
        const tick = () => {
          const now = performance.now();
          if (now - Math.max(window.__p.lastBusy, t0) >= quiet || now - t0 > max) res();
          else setTimeout(tick, 50);
        };
        setTimeout(tick, quiet);
      }),
    { quiet, max },
  );
}

/**
 * One measured interaction: runs `action`, waits for quiet, returns
 *  inp = the slowest input event's duration (input → next paint, Event Timing),
 *  lt = long tasks after the action started (count / longest / total),
 *  writes = localStorage writes (count / KB / ms).
 */
const metricsOf = async (page) => Object.fromEntries((await page._cdp.send("Performance.getMetrics")).metrics.map((x) => [x.name, x.value]));
async function measure(page, label, action, { quiet = 500, after } = {}) {
  await settle(page, 300);
  const m0 = await metricsOf(page);
  const mark = await page.evaluate(() => {
    const P = window.__p;
    P.lt.length = 0; P.ev.length = 0; P.writes.length = 0;
    return performance.now();
  });
  const t0 = Date.now();
  await action();
  if (after) await after();
  await settle(page, quiet);
  const wall = Date.now() - t0;
  const m1 = await metricsOf(page);
  const d = (k) => Math.round((m1[k] - m0[k]) * 1000);
  const split = { task: d("TaskDuration"), script: d("ScriptDuration"), layout: d("LayoutDuration"), style: d("RecalcStyleDuration"), layouts: m1.LayoutCount - m0.LayoutCount };
  const r = await page.evaluate((mark) => {
    const P = window.__p;
    const lt = P.lt.filter((e) => e.s + e.d >= mark);
    const ev = P.ev.filter((e) => e.s >= mark - 5);
    return {
      inp: ev.reduce((m, e) => Math.max(m, e.d), 0),
      proc: ev.reduce((m, e) => Math.max(m, e.proc), 0),
      ltN: lt.length,
      ltMax: lt.reduce((m, e) => Math.max(m, e.d), 0),
      ltSum: lt.reduce((s, e) => s + e.d, 0),
      wN: P.writes.length,
      wKb: P.writes.reduce((s, w) => s + w.kb, 0),
      wMs: Math.round(P.writes.reduce((s, w) => s + w.ms, 0)),
      nodes: document.getElementsByTagName("*").length,
    };
  }, mark);
  return { label, wall, ...r, ...split };
}

/** Dismiss any open modal dialogs (first-visit pop-ups, tutorials, ceremonies). */
const DIALOG_BUTTONS = [/^let's play$/i, /^start season 1$/i, /^continue$/i, /^got it/i, /^next$/i, /^skip$/i, /^close$/i, /^ok$/i, /^later$/i];
async function dismissDialogs(page, maxSteps = 20) {
  for (let i = 0; i < maxSteps; i++) {
    const dialog = page.locator('[role="dialog"][aria-modal="true"]:visible').last();
    if (!(await dialog.count())) return i;
    const buttons = dialog.locator("button:visible:enabled");
    const labels = await buttons.evaluateAll((els) => els.map((el) => (el.getAttribute("aria-label") || el.textContent || "").trim()));
    let idx = -1;
    for (const re of DIALOG_BUTTONS) { idx = labels.findIndex((l) => re.test(l)); if (idx >= 0) break; }
    if (idx < 0) idx = labels.length - 1;
    if (idx >= 0) await buttons.nth(idx).tap({ timeout: 5000 }).catch(() => page.keyboard.press("Escape"));
    else await page.keyboard.press("Escape");
    await sleep(400);
  }
  return maxSteps;
}

const fmt = (r) =>
  `${r.label.padEnd(34)} INP ${String(r.inp).padStart(4)} · LT ${String(r.ltN).padStart(2)} max ${String(r.ltMax).padStart(4)} sum ${String(r.ltSum).padStart(5)}` +
  (r.task !== undefined ? ` · main ${String(r.task).padStart(5)} (script ${String(r.script).padStart(4)}, layout ${String(r.layout).padStart(4)}, style ${String(r.style).padStart(4)}, ${String(r.layouts).padStart(3)} layouts)` : "") +
  ` · writes ${r.wN} (${r.wKb} KB) · nodes ${r.nodes}`;

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

const [base, fixtures, outFile, ...wanted] = process.argv.slice(2);
const scenarios = wanted.length ? wanted : ["career-s1", "career-late", "draft", "profile", "home"];
const CPU = Number(process.env.CPU ?? 4);
const out = {};
const browser = await launch();

const row = (rows, r) => { rows.push(r); console.log("  " + fmt(r)); return r; };
const tap = (loc) => loc.tap({ timeout: 15000 });

/** Cold load of a route: main-thread work until quiet. */
async function load(page, rows, label, path) {
  await page.evaluate(() => { const P = window.__p; if (P) { P.lt.length = 0; P.ev.length = 0; P.writes.length = 0; } }).catch(() => {});
  const t0 = Date.now();
  const mOf = async () => Object.fromEntries((await page._cdp.send("Performance.getMetrics")).metrics.map((x) => [x.name, x.value]));
  const m0 = await mOf();
  await page.goto(base + path, { waitUntil: "load" });
  await settle(page, 700);
  const m1 = await mOf();
  // A navigation to a new document resets the counters: then the "after" value is the load's own.
  const fresh = m1.TaskDuration < m0.TaskDuration;
  const d = (k) => Math.round((m1[k] - (fresh ? 0 : m0[k])) * 1000);
  const split = { task: d("TaskDuration"), script: d("ScriptDuration"), layout: d("LayoutDuration"), style: d("RecalcStyleDuration"), layouts: m1.LayoutCount - (fresh ? 0 : m0.LayoutCount) };
  const r = await page.evaluate(() => {
    const P = window.__p;
    return { ltN: P.lt.length, ltMax: P.lt.reduce((m, e) => Math.max(m, e.d), 0), ltSum: P.lt.reduce((s, e) => s + e.d, 0), wN: P.writes.length, wKb: P.writes.reduce((s, w) => s + w.kb, 0), wMs: Math.round(P.writes.reduce((s, w) => s + w.ms, 0)), nodes: document.getElementsByTagName("*").length };
  });
  return row(rows, { label, wall: Date.now() - t0, inp: 0, proc: 0, ...r, ...split });
}

async function career(name, fixture) {
  console.log(`\n### ${name}`);
  const rows = (out[name] = []);
  const { page, context, errors } = await phone(browser, { storage: { "rocket-draft:career:v1": join(fixtures, fixture) }, cpu: CPU });
  await load(page, rows, "load /career (HQ)", "/career");
  await dismissDialogs(page);
  const bar = page.locator("div.sticky.top-0 > div").first();
  const nav = (href) => page.locator(`div.sticky.top-0 nav a[href="${href}"]`);
  const saveState = () => page.evaluate(() => { const s = JSON.parse(localStorage.getItem("rocket-draft:career:v1")).state; const v = s.slots[s.activeSlot]; return { day: v.clock.day, season: v.clock.seasonIndex, pending: v.pendingEventDef?.day ?? null, active: Boolean(v.activeEvent), phase: v.phase }; });

  // Tabs (first visit = chunk + first render; second visit = render only).
  for (const pass of [1, 2]) {
    for (const [tab, href] of [["calendar", "/career/calendar"], ["squad", "/career/squad"], ["training", "/career/training"], ["market", "/career/market"], ["finances", "/career/finances"], ["standings", "/career/standings"], ["news", "/career/news"], ["club", "/career/club"], ["hq", "/career"]]) {
      await row(rows, await measure(page, `tab ${tab} (visit ${pass})`, async () => { await tap(nav(href)); await page.waitForURL((u) => u.pathname === href, { timeout: 20000 }); }));
      await dismissDialogs(page);
    }
  }

  // Market: its own controls.
  await tap(nav("/career/market")); await page.waitForURL(/market/); await settle(page);
  const marketTabs = page.locator("main [role=tab]:visible");
  const nTabs = Math.min(await marketTabs.count(), 4);
  for (let i = 0; i < nTabs; i++) {
    const label = ((await marketTabs.nth(i).textContent()) ?? "").trim().slice(0, 14);
    await row(rows, await measure(page, `market control "${label}"`, () => tap(marketTabs.nth(i))));
  }
  const firstRow = page.locator("main ul li button:visible, main table tbody tr:visible").first();
  if (await firstRow.count()) {
    await row(rows, await measure(page, "market open player", () => tap(firstRow)));
    await page.keyboard.press("Escape"); await sleep(300); await dismissDialogs(page);
  }

  // The clock, from HQ.
  await tap(nav("/career")); await page.waitForURL((u) => u.pathname === "/career"); await settle(page);
  await dismissDialogs(page);
  const plusDay = page.locator("main button:visible:enabled", { hasText: /\+\s*1 day/i }).first();
  for (let i = 0; i < 2; i++) {
    if (!(await plusDay.count())) break;
    await row(rows, await measure(page, `advance +1 day (#${i + 1})`, () => tap(plusDay)));
    await dismissDialogs(page);
  }
  // Autoplay: 3 s of ticks (850 ms each), the frames it drops included.
  const play = bar.locator("button[aria-pressed]:visible").first();
  if (await play.count()) {
    const before = await saveState();
    await page.evaluate(() => { const F = (window.__frames = { n: 0, long: 0, worst: 0, last: performance.now(), on: true }); const tick = (t) => { const d = t - F.last; F.last = t; F.n++; if (d > 50) F.long++; if (d > F.worst) F.worst = d; if (F.on) requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
    const r = await measure(page, "autoplay 3 s", async () => { await tap(play); await sleep(3000); if ((await play.count()) && (await play.getAttribute("aria-pressed")) === "true") await tap(play); }, { quiet: 600 });
    const frames = await page.evaluate(() => { window.__frames.on = false; return window.__frames; });
    const after = await saveState();
    r.label = `autoplay 3 s (${after.day - before.day} d; frames>50ms ${frames.long}, worst ${Math.round(frames.worst)})`;
    row(rows, r);
    await dismissDialogs(page);
  }
  for (let i = 2; i < 4; i++) {
    if (!(await plusDay.count())) break;
    await row(rows, await measure(page, `advance +1 day (#${i + 1})`, () => tap(plusDay)));
    await dismissDialogs(page);
  }
  // Skip to the next stop (batched days), three times.
  for (let i = 0; i < 3; i++) {
    const skip = bar.locator("button:visible:enabled:not([aria-pressed])").last();
    if (!(await skip.count())) break;
    const before = await saveState();
    const r = await measure(page, "skip", () => tap(skip), { quiet: 700 });
    const after = await saveState();
    r.label = `skip ahead (#${i + 1}: ${after.season === before.season ? after.day - before.day : "?"} days)`;
    row(rows, r);
    await dismissDialogs(page);
    if (page.url().includes("/career/event")) break;
  }
  if (errors.length) console.log("  errors: " + [...new Set(errors)].slice(0, 5).join(" || "));
  out[name + ":errors"] = [...new Set(errors)];
  await context.close();
}

/** The live event, from a save on a qualifier's morning. */
async function careerEvent(name, fixture) {
  console.log(`\n### ${name}`);
  const rows = (out[name] = []);
  const { page, context, errors } = await phone(browser, { storage: { "rocket-draft:career:v1": join(fixtures, fixture) }, cpu: CPU });
  const saveState = () => page.evaluate(() => { const s = JSON.parse(localStorage.getItem("rocket-draft:career:v1")).state; const v = s.slots[s.activeSlot]; return { day: v.clock.day, season: v.clock.seasonIndex, pending: v.pendingEventDef?.day ?? null, active: Boolean(v.activeEvent), phase: v.phase }; });
  await load(page, rows, "load /career/event (lobby)", "/career/event");
  await dismissDialogs(page);
  const watch = page.locator("main button:visible:enabled", { hasText: /play it out/i }).first();
  if (await watch.count()) {
    await row(rows, await measure(page, "event: play it out (start)", () => tap(watch), { quiet: 800 }));
    await row(rows, await measure(page, "event: live playback 8 s", () => sleep(8000), { quiet: 300 }));
    const simEnd = page.locator("main button:visible:enabled", { hasText: /sim|skip to|instant|to the end/i }).last();
    if (await simEnd.count()) await row(rows, await measure(page, "event: sim to end", () => tap(simEnd), { quiet: 900 }));
    await sleep(1500);
    const done = page.locator("main button:visible:enabled", { hasText: /continue|back to hq|see results|on to/i }).first();
    if (await done.count()) await row(rows, await measure(page, "event: results → continue", () => tap(done), { quiet: 900 }));
  } else {
    console.log("  (no matchday lobby reached: " + JSON.stringify(await saveState()) + ")");
  }
  if (errors.length) console.log("  errors: " + [...new Set(errors)].slice(0, 5).join(" || "));
  out[name + ":errors"] = [...new Set(errors)];
  await context.close();
}

async function draft() {
  console.log("\n### draft");
  const rows = (out.draft = []);
  const { page, context, errors } = await phone(browser, { cpu: CPU });
  const runState = () => page.evaluate(() => { try { const run = JSON.parse(localStorage.getItem("rocket-draft:run:v1") ?? "null")?.state?.run; return run ? { phase: run.phase, round: run.draft?.round ?? 0 } : null; } catch { return null; } });
  await load(page, rows, "load / (home, first visit)", "/");
  await dismissDialogs(page);
  await row(rows, await measure(page, "home → play", async () => { await tap(page.getByRole("button", { name: "Play now →" })); await page.waitForURL(/\/play$/); }));
  await dismissDialogs(page);
  const start = page.getByRole("button", { name: "Start Draft" });
  await start.waitFor({ timeout: 20000 });
  await row(rows, await measure(page, "start draft", () => tap(start), { quiet: 700 }));
  const picks = [];
  for (let i = 0; i < 20; i++) {
    await dismissDialogs(page);
    const st = await runState();
    if (!st || st.phase !== "draft") break;
    const card = page.locator("main div.grid.grid-cols-3 button:visible:enabled").first();
    const reroll = page.getByRole("button", { name: /^Free reroll/ });
    for (let w = 0; w < 60 && !(await card.count()) && !(await reroll.count()); w++) await sleep(200);
    if ((await runState())?.phase !== "draft") break;
    const useCard = (await card.count()) > 0;
    const r = await measure(page, useCard ? `pick ${i + 1}` : `reroll ${i + 1}`, () => tap(useCard ? card : reroll.first()), { quiet: 600 });
    picks.push(r); row(rows, r);
  }
  await dismissDialogs(page);
  const startT = page.getByRole("button", { name: "Start Tournament" });
  if (await startT.count().then(() => startT.waitFor({ timeout: 20000 }).then(() => true).catch(() => false))) {
    await row(rows, await measure(page, "start tournament", () => tap(startT), { quiet: 800 }));
    await dismissDialogs(page);
    await row(rows, await measure(page, "tournament playback 6 s", () => sleep(6000), { quiet: 300 }));
    const skip = page.getByRole("button", { name: "Skip to end" });
    if (await skip.count()) await row(rows, await measure(page, "tournament: skip to end", () => tap(skip), { quiet: 900 }));
    await dismissDialogs(page);
    const toResults = page.getByRole("button", { name: "View results" }).first();
    if (await toResults.waitFor({ timeout: 20000 }).then(() => true).catch(() => false)) {
      await row(rows, await measure(page, "view results", () => tap(toResults), { quiet: 1200 }));
      for (let i = 0; i < 6; i++) {
        const d = page.locator('[role="dialog"][aria-modal="true"]:visible').last();
        if (!(await d.count())) break;
        const b = d.locator("button:visible:enabled").last();
        await row(rows, await measure(page, `results ceremony ${i + 1}`, () => tap(b), { quiet: 700 }));
      }
    }
  }
  if (errors.length) console.log("  errors: " + [...new Set(errors)].slice(0, 5).join(" || "));
  out["draft:errors"] = [...new Set(errors)];
  return context;
}

/** Profile / home, on the profile the finished run left (plus a played draft's XP). */
async function profile(context) {
  console.log("\n### profile");
  const rows = (out.profile = []);
  const page = context.pages()[0];
  await load(page, rows, "load /profile", "/profile");
  await dismissDialogs(page);
  const sw = page.locator("[role=switch]:visible");
  for (let i = 0; i < (await sw.count()); i++) {
    const text = await sw.nth(i).evaluate((el) => el.closest("label,div")?.textContent ?? "");
    if (/Unlock every cosmetic/i.test(text) && (await sw.nth(i).getAttribute("aria-checked")) !== "true") { await tap(sw.nth(i)); await settle(page); }
  }
  await load(page, rows, "load /profile (all cosmetics)", "/profile");
  await dismissDialogs(page);
  const tabs = page.locator("main [role=tab]:visible");
  for (let i = 0; i < Math.min(await tabs.count(), 6); i++) {
    const label = ((await tabs.nth(i).textContent()) ?? "").trim().slice(0, 16);
    await row(rows, await measure(page, `profile tab "${label}"`, () => tap(tabs.nth(i))));
  }
  const locker = page.locator("main button:visible", { hasText: /open the locker/i }).first();
  if (await locker.count()) {
    await row(rows, await measure(page, "open the locker", () => tap(locker), { quiet: 700 }));
    const dtabs = page.locator("[role=dialog] [role=tab]:visible");
    for (let i = 0; i < Math.min(await dtabs.count(), 5); i++) {
      const label = ((await dtabs.nth(i).textContent()) ?? "").trim().slice(0, 16);
      await row(rows, await measure(page, `locker tab "${label}"`, () => tap(dtabs.nth(i)), { quiet: 600 }));
    }
    const tile = page.locator("[role=dialog] .grid > button:visible").nth(2);
    if (await tile.count()) await row(rows, await measure(page, "locker: equip a tile", () => tap(tile)));
    await page.keyboard.press("Escape"); await sleep(400);
  }
  await load(page, rows, "load /achievements", "/achievements");
  await load(page, rows, "load /collection", "/collection");
  await load(page, rows, "load / (home, returning)", "/");
  await context.close();
}

/** Cold loads, REPS times each in a fresh context; prints every run and the median. */
async function loads() {
  console.log("\n### loads");
  const rows = (out.loads = []);
  const REPS = Number(process.env.REPS ?? 3);
  const routes = [
    ["load /career S7 (cold)", "/career", "career-late.json"],
    ["load /career S7 x3 slots (cold)", "/career", "career-late-x3.json"],
    ["load /career S1 (cold)", "/career", "career-s1.json"],
    ["load / (first visit)", "/", null],
    ["load /play (first visit)", "/play", null],
    ["load /profile (first visit)", "/profile", null],
  ];
  for (const [label, path, fixture] of routes) {
    const runs = [];
    for (let i = 0; i < REPS; i++) {
      const { page, context } = await phone(browser, { storage: fixture ? { "rocket-draft:career:v1": join(fixtures, fixture) } : {}, cpu: CPU });
      const quiet = [];
      runs.push(await load(page, quiet, label, path));
      await context.close();
    }
    const med = (k) => [...runs].map((r) => r[k]).sort((a, b) => a - b)[Math.floor(runs.length / 2)];
    const m = { ...runs[0] };
    for (const k of ["ltN", "ltMax", "ltSum", "task", "script", "layout", "style", "layouts", "nodes"]) m[k] = med(k);
    m.label = `${label} · median of ${REPS}`;
    rows.push(m);
    console.log("  = " + fmt(m));
  }
}

for (const s of scenarios) {
  try {
    if (s === "loads") await loads();
    else if (s === "career-s1") await career("career S1", "career-s1.json");
    else if (s === "career-late") await career("career S7", "career-late.json");
    else if (s === "career-x3") await career("career S7 (3 slots)", "career-late-x3.json");
    else if (s === "career-event") await careerEvent("career S7 event", "career-late-matchday.json");
    else if (s === "draft") { const ctx = await draft(); await profile(ctx); }
  } catch (e) {
    console.log(`  !! ${s} aborted: ${String(e.message).split("\n")[0]}`);
    out[s + ":aborted"] = String(e.message).split("\n")[0];
  }
  if (outFile) writeFileSync(outFile, JSON.stringify(out, null, 1));
}
await browser.close();
