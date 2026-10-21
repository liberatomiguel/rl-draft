#!/usr/bin/env node
/**
 * rc.13 — performance probe for visual effects (DESIGN-DECISIONS #130).
 *
 * Measures, on a PRODUCTION build, how much main-thread time the profile and
 * the leaderboard burn while idle, and whether any animation fails to run on
 * the compositor (GPU). "transform/opacity only" is not enough on its own: one
 * animation the GPU can't take forces main-thread frames, and then every
 * animation on the page updates on the main thread.
 *
 *   1. NEXT_PUBLIC_NOINDEX=1 npm run build      (staging-like: preview tools on)
 *   2. npm run preview:static                    (wrangler dev serving out/)
 *   3. node scripts/perf-probe.mjs [baseUrl]     (default http://localhost:8787)
 *
 * It drives a headless Chrome (CHROME_PATH, or the usual install paths) with a
 * throwaway profile over the DevTools Protocol: skips the first-run flow,
 * switches on "Unlock every cosmetic", equips three badges and a legendary
 * banner (the worst case), then reports idle main-thread ms per second
 * (Performance.getMetrics TaskDuration) and any `compositeFailed` animation in
 * a trace. Budgets (rc.13 measured ~40 and ~15–35 — run-to-run noise is ±15):
 * profile ≤ 80 ms/s, board ≤ 60 ms/s, zero failures. They exist to catch the
 * kind of regression rc.13 fixed (300–480 ms/s), not to chase noise.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const base = process.argv[2] ?? "http://localhost:8787";
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
  console.error("perf-probe: no Chrome/Edge found — set CHROME_PATH");
  process.exit(1);
}

const port = 9339;
const chrome = spawn(
  chromePath,
  [
    "--headless=new",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${mkdtempSync(join(tmpdir(), "rd-perf-"))}`,
    "--window-size=1280,900",
    "--no-first-run",
    // Containers that run as root (the cloud sessions) need the sandbox off.
    ...(process.env.CHROME_NO_SANDBOX ? ["--no-sandbox"] : []),
    "--no-default-browser-check",
    "about:blank",
  ],
  { stdio: "ignore" },
);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let info;
for (let i = 0; i < 50 && !info; i++) {
  try {
    info = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
  } catch {
    await sleep(200);
  }
}
const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));

let seq = 0;
const pending = new Map();
const traceEvents = [];
let traceDone = null;
ws.addEventListener("message", (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m);
    pending.delete(m.id);
  } else if (m.method === "Tracing.dataCollected") traceEvents.push(...m.params.value);
  else if (m.method === "Tracing.tracingComplete") traceDone?.();
});
const send = (method, params = {}) =>
  new Promise((res) => {
    const id = ++seq;
    pending.set(id, res);
    ws.send(JSON.stringify({ id, method, params }));
  });
const run = async (js) => {
  const r = await send("Runtime.evaluate", { expression: `(async()=>{${js}})()`, awaitPromise: true, returnByValue: true });
  return r.result?.result?.value;
};
const go = async (path) => {
  await send("Page.navigate", { url: base + path });
  await sleep(3500);
};
const idleMsPerSec = async () => {
  const get = async () => Object.fromEntries((await send("Performance.getMetrics")).result.metrics.map((x) => [x.name, x.value]));
  const a = await get();
  await sleep(4000);
  const b = await get();
  return Math.round(((b.TaskDuration - a.TaskDuration) / 4) * 1000);
};
const compositeFailures = async (path) => {
  traceEvents.length = 0;
  await send("Tracing.start", { categories: "blink.animations,devtools.timeline", transferMode: "ReportEvents" });
  await go(path);
  await sleep(1500);
  const done = new Promise((r) => (traceDone = r));
  await send("Tracing.end");
  await done;
  return traceEvents.filter((e) => e.name === "Animation" && e.args?.data?.compositeFailed).length;
};

await send("Page.enable");
await send("Performance.enable");

// Worst case: every cosmetic unlocked, three badges and a legendary banner on.
await go("/");
await run(`for(let k=0;k<5;k++){document.querySelectorAll('button').forEach(b=>{if(/^(skip|let.s go)$/i.test(b.textContent.trim()))b.click()});await new Promise(r=>setTimeout(r,400));}`);
await go("/profile");
const ready = await run(`
  const wait=(ms)=>new Promise(r=>setTimeout(r,ms));
  const sw=[...document.querySelectorAll('[role=switch]')].find(b=>/Unlock every cosmetic/.test(b.closest('label,div')?.textContent||''));
  if(!sw) return false;
  if(sw.getAttribute('aria-checked')!=='true') sw.click();
  await wait(400);
  const open=async(tab)=>{[...document.querySelectorAll('button')].find(b=>/open the locker/i.test(b.textContent))?.click();await wait(400);const d=document.querySelector('[role=dialog]');[...d.querySelectorAll('[role=tab]')].find(t=>new RegExp(tab,'i').test(t.textContent))?.click();await wait(300);return d;};
  let d=await open('badges');
  const tiles=[...d.querySelectorAll('.grid > button')];
  for(const n of ['Dynasty','Season Champion','Supernova']){tiles.find(t=>t.textContent.includes(n))?.click();await wait(100);}
  d.querySelector('button[aria-label]')?.click();await wait(300);
  d=await open('banners');
  [...d.querySelectorAll('.grid > button')].find(t=>/Champion Banner/.test(t.textContent))?.click();await wait(200);
  d.querySelector('button[aria-label]')?.click();
  return true;`);
if (!ready) {
  console.error("perf-probe: no preview switch — build with NEXT_PUBLIC_NOINDEX=1 (staging-like) first");
  chrome.kill();
  process.exit(1);
}

let worst = 0;
for (const [label, path, budget] of [
  ["profile", "/profile", 80],
  ["leaderboard", "/leaderboards", 60],
]) {
  await go(path);
  await sleep(1500);
  const ms = await idleMsPerSec();
  const failed = await compositeFailures(path);
  const ok = ms <= budget && failed === 0;
  if (!ok) worst = 1;
  console.log(`${ok ? "ok  " : "FAIL"} ${label.padEnd(12)} ${String(ms).padStart(4)} ms/s main thread (budget ${budget}) · ${failed} non-composited animation(s)`);
}

ws.close();
chrome.kill();
process.exit(worst);
