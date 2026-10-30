#!/usr/bin/env node
/**
 * rc.32 — the browser E2E smoke of a release candidate, on a PRODUCTION export.
 *
 *   1. NEXT_PUBLIC_CAREER_MODE=1 NEXT_PUBLIC_NOINDEX=1 npm run build   (built like staging)
 *   2. npx wrangler dev --port 8787 --ip 127.0.0.1                     (serves out/; stop it after)
 *   3. node scripts/e2e-smoke.mjs [base] [shotsDir] [scenario] [viewport] [locale]
 *        base      default http://127.0.0.1:8787
 *        shotsDir  where the full-page screenshots go (default .)
 *        scenario  all | home | classic | career   (default all; classic runs in PT only —
 *                  `scripts/request-budget.mjs` already plays the EN Classic run)
 *        viewport  both | desktop | mobile          (desktop 1366×900, mobile Pixel 7)
 *        locale    both | en | pt
 *
 * A fresh browser context per (viewport, locale). Each scenario collects console
 * errors, page errors and same-origin 4xx/5xx, checks the page language, and saves a
 * screenshot per step:
 *  - home: the raw HTML and the hydrated chrome are in the URL's language (DRAFT-11);
 *  - classic (PT): /pt sets the saved language, then a whole Classic run to the results;
 *  - career: /career → Quick start → the presets step (labels, the money row) → found →
 *    HQ → a week of "+1 day" (a weekly decision card is answered with its first option; rc.34:
 *    HQ's decision block — the coach's training proposal on Normal — is approved)
 *    → Finances (no founding partner, rc.33), Market (the reputation filter; no sale
 *    listing in the deals tab, rc.33), Squad, Training, Standings,
 *    Calendar, News, each in the right language.
 * The labels it presses are the copy's (EN and PT, `L` below): update them with the copy.
 * Needs Playwright with its Chromium (cloud sessions have it; never `playwright install`).
 * Prints one line per scenario ("n/m checks ok, k errors") and the failures.
 */
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium, devices } = require("playwright");

const [base = "http://127.0.0.1:8787", shots = ".", scenarioArg = "all", vpArg = "both", locArg = "both"] = process.argv.slice(2);
const VIEWPORTS = vpArg === "both" ? ["desktop", "mobile"] : [vpArg];
const LOCALES = locArg === "both" ? ["en", "pt"] : [locArg];
const SCEN = scenarioArg === "all" ? ["home", "classic", "career"] : [scenarioArg];
const T = 30_000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const L = {
  en: {
    playNow: /^Play now/, startDraft: /^Start Draft$/, reroll: /^Free reroll/, startT: /^Start Tournament$/, skip: /^Skip to end$/,
    results: /^View results$/, quick: /^Quick start$/, next: /^Next$/, found: /^Found /, presets: ["Easy", "Normal", "Hard"],
    moneyRow: "bank loan", advance: /^(\+1 day|Advance one day)$/i, founding: "Founding partner", sell: "Sell a player",
    signable: "Signable at my reputation", approve: /^Approve$/,
  },
  pt: {
    playNow: /^Jogar agora/, startDraft: /^Começar Draft$/, reroll: /^Reroll grátis/, startT: /^Começar Torneio$/, skip: /^Pular para o fim$/,
    results: /^Ver resultados$/, quick: /^Início rápido$/, next: /^(Próximo|Avançar)$/, found: /^Fundar /, presets: ["Fácil", "Normal", "Difícil"],
    moneyRow: "empréstimo", advance: /^(\+1 dia|Avançar um dia)$/i, founding: "Parceiro fundador", sell: "Vender um jogador",
    signable: "Contratáveis com minha reputação", approve: /^Aprovar$/,
  },
};
const DIALOG_PREF = [/^let's (play|go)$/i, /^vamos (jogar|lá)/i, /^start season 1$/i, /^continue$/i, /^continuar$/i, /^got it/i, /^entendi/i, /^next$/i, /^próximo$/i, /^skip$/i, /^pular$/i, /^close$/i, /^fechar$/i, /^ok$/i];

function collect(page, origin, bag) {
  page.on("console", (m) => {
    if (m.type() === "error") bag.push(`console: ${m.text().slice(0, 300)}`);
  });
  page.on("pageerror", (e) => bag.push(`pageerror: ${e.message.slice(0, 300)}`));
  page.on("response", (r) => {
    if (r.status() >= 400 && r.url().startsWith(origin)) bag.push(`${r.status()} ${r.url()}`);
  });
}

async function press(loc, mobile) {
  await loc.scrollIntoViewIfNeeded({ timeout: T });
  if (mobile) await loc.tap({ timeout: T });
  else await loc.click({ timeout: T });
}

async function settle(page, ms = 600) {
  await page.waitForLoadState("networkidle", { timeout: T }).catch(() => {});
  await sleep(ms);
}

async function dismiss(page, mobile, max = 15) {
  for (let i = 0; i < max; i++) {
    const dialog = page.locator('[role="dialog"][aria-modal="true"]:visible').last();
    if (!(await dialog.count())) return i;
    const buttons = dialog.locator("button:visible:enabled");
    const n = await buttons.count();
    let target = null;
    if (n) {
      const labels = await buttons.evaluateAll((els) => els.map((el) => (el.getAttribute("aria-label") || el.textContent || "").trim()));
      for (const re of DIALOG_PREF) {
        const k = labels.findIndex((l) => re.test(l));
        if (k >= 0) {
          target = buttons.nth(k);
          break;
        }
      }
      target ??= buttons.nth(n - 1);
    }
    if (target) await press(target, mobile).catch(() => page.keyboard.press("Escape"));
    else await page.keyboard.press("Escape");
    await sleep(400);
  }
  return max;
}

const shot = (page, name) => page.screenshot({ path: `${shots}/${name}.png`, fullPage: true }).catch(() => {});
const bodyText = (page) => page.evaluate(() => document.body.innerText);

async function newCtx(browser, viewport, locale) {
  const ctx = await browser.newContext(
    viewport === "mobile"
      ? { ...devices["Pixel 7"], locale: locale === "pt" ? "pt-BR" : "en-US" }
      : { viewport: { width: 1366, height: 900 }, locale: locale === "pt" ? "pt-BR" : "en-US" },
  );
  return ctx;
}

async function landing(page, locale, mobile, tag, checks) {
  await page.goto(`${base}${locale === "pt" ? "/pt" : "/"}`, { waitUntil: "load", timeout: T });
  const htmlLang = await page.evaluate(() => document.documentElement.lang);
  checks.push({ step: `${tag} landing lang`, ok: htmlLang === (locale === "pt" ? "pt-BR" : "en"), value: htmlLang });
  await settle(page);
  await dismiss(page, mobile);
}

async function scenarioHome(browser, viewport, locale) {
  const ctx = await newCtx(browser, viewport, locale);
  const page = await ctx.newPage();
  const errors = [];
  const checks = [];
  collect(page, new URL(base).origin, errors);
  const mobile = viewport === "mobile";
  const tag = `home-${viewport}-${locale}`;
  // First paint: the raw HTML before hydration must already be in the URL's language.
  const res = await page.request.get(`${base}${locale === "pt" ? "/pt" : "/"}`);
  const html = await res.text();
  const navWord = locale === "pt" ? ">Início<" : ">Home<";
  checks.push({ step: `${tag} static html: lang + nav in the URL's language`, ok: html.includes(`lang="${locale === "pt" ? "pt-BR" : "en"}"`) && html.includes(navWord) });
  await landing(page, locale, mobile, tag, checks);
  const txt = await bodyText(page);
  checks.push({ step: `${tag} hydrated chrome`, ok: locale === "pt" ? /in[íi]cio/i.test(txt) && /carreira/i.test(txt) : /play now/i.test(txt) });
  await shot(page, tag);
  await ctx.close();
  return { tag, errors, checks };
}

async function scenarioClassic(browser, viewport, locale) {
  const ctx = await newCtx(browser, viewport, locale);
  const page = await ctx.newPage();
  const errors = [];
  const checks = [];
  collect(page, new URL(base).origin, errors);
  const mobile = viewport === "mobile";
  const C = L[locale];
  const tag = `classic-${viewport}-${locale}`;
  try {
    await landing(page, locale, mobile, tag, checks);
    // The saved language is now the landing's (SyncLocale); the Draft lives at /play.
    await page.goto(`${base}/play`, { waitUntil: "load", timeout: T });
    const start = page.getByRole("button", { name: C.startDraft });
    await start.waitFor({ timeout: T });
    await settle(page);
    await dismiss(page, mobile);
    await shot(page, `${tag}-setup`);
    await press(start, mobile);
    for (let picks = 0; picks < 20; picks++) {
      await dismiss(page, mobile);
      const phase = await page.evaluate(() => JSON.parse(localStorage.getItem("rocket-draft:run:v1") ?? "null")?.state?.run?.phase ?? null);
      if (phase !== "draft") break;
      const card = page.locator("main div.grid.grid-cols-3 button:visible:enabled").first();
      const reroll = page.getByRole("button", { name: C.reroll });
      const t0 = Date.now();
      while (Date.now() - t0 < T && !(await card.count()) && !(await reroll.count())) await sleep(200);
      if (picks === 0) await shot(page, `${tag}-draft`);
      if (await card.count()) await press(card, mobile);
      else if (await reroll.count()) await press(reroll.first(), mobile);
      await sleep(900);
    }
    await settle(page);
    await dismiss(page, mobile);
    const startT = page.getByRole("button", { name: C.startT });
    await startT.waitFor({ timeout: T });
    await shot(page, `${tag}-review`);
    await press(startT, mobile);
    await dismiss(page, mobile);
    const skip = page.getByRole("button", { name: C.skip });
    await skip.waitFor({ timeout: T });
    await press(skip, mobile);
    await settle(page, 1000);
    await dismiss(page, mobile);
    const toResults = page.getByRole("button", { name: C.results }).first();
    await toResults.waitFor({ timeout: T });
    await shot(page, `${tag}-bracket`);
    await press(toResults, mobile);
    await settle(page, 1500);
    await dismiss(page, mobile);
    await settle(page, 800);
    await dismiss(page, mobile);
    await shot(page, `${tag}-results`);
    const lang = await page.evaluate(() => document.documentElement.lang);
    checks.push({ step: `${tag} results reached`, ok: true });
    checks.push({ step: `${tag} lang after run`, ok: lang === (locale === "pt" ? "pt-BR" : "en"), value: lang });
  } catch (e) {
    checks.push({ step: `${tag} FAILED`, ok: false, value: e.message.slice(0, 300) });
    await shot(page, `${tag}-failure`);
  }
  await ctx.close();
  return { tag, errors, checks };
}

async function scenarioCareer(browser, viewport, locale) {
  const ctx = await newCtx(browser, viewport, locale);
  const page = await ctx.newPage();
  const errors = [];
  const checks = [];
  collect(page, new URL(base).origin, errors);
  const mobile = viewport === "mobile";
  const C = L[locale];
  const tag = `career-${viewport}-${locale}`;
  try {
    await landing(page, locale, mobile, tag, checks);
    await page.goto(`${base}/career`, { waitUntil: "load", timeout: T });
    await settle(page);
    await dismiss(page, mobile);
    await press(page.getByRole("button", { name: C.quick }), mobile);
    await sleep(500);
    for (let i = 0; i < 8; i++) {
      await dismiss(page, mobile);
      if (await page.getByRole("button", { name: C.found }).count()) break;
      const next = page.getByRole("button", { name: C.next }).last();
      if (!(await next.count())) break;
      await press(next, mobile);
      await sleep(500);
    }
    const found = page.getByRole("button", { name: C.found }).first();
    await found.waitFor({ timeout: T });
    const txt5 = await bodyText(page);
    const low5 = txt5.toLowerCase();
    checks.push({ step: `${tag} presets listed`, ok: C.presets.every((p) => low5.includes(p.toLowerCase())) });
    checks.push({ step: `${tag} money row`, ok: low5.includes(C.moneyRow.toLowerCase()) });
    checks.push({ step: `${tag} no management-style step`, ok: !/Management style|Estilo de gestão/i.test(txt5) });
    await shot(page, `${tag}-wizard-final`);
    await press(found, mobile);
    await page.waitForURL(/\/career(\/)?$/, { timeout: T }).catch(() => {});
    await settle(page, 1500);
    await dismiss(page, mobile);
    await shot(page, `${tag}-hq`);
    // Advance a week, day by day (Monday payroll lands on the way).
    for (let d = 0; d < 18; d++) {
      await dismiss(page, mobile);
      // A weekly decision card (R33/R37) blocks the clock: take its first option.
      const option = page.locator("main button.min-h-24:visible").first();
      if (await option.count()) {
        await press(option, mobile).catch(() => {});
        checks.push({ step: `${tag} answered a decision card`, ok: true });
        await sleep(700);
        continue;
      }
      // rc.34 (UX-01, R71): HQ's decision block holds the clock — on Normal the coach's
      // training proposal waits on each period's first Monday.
      const approve = page.locator("main").getByRole("button", { name: C.approve }).first();
      if (await approve.count()) {
        await press(approve, mobile).catch(() => {});
        checks.push({ step: `${tag} approved the coach's training proposal`, ok: true });
        await sleep(700);
        continue;
      }
      const adv = page.getByRole("button", { name: C.advance }).first();
      if (!(await adv.count())) break;
      await press(adv, mobile).catch(() => {});
      await sleep(700);
    }
    await settle(page);
    await dismiss(page, mobile);
    const day = await page.evaluate(() => {
      try {
        const st = JSON.parse(localStorage.getItem("rocket-draft:career:v1") ?? "null")?.state;
        return st?.slots?.[st.activeSlot]?.clock?.day ?? null;
      } catch {
        return null;
      }
    });
    checks.push({ step: `${tag} advanced past the first Monday`, ok: typeof day === "number" && day >= 8, value: day });
    await shot(page, `${tag}-hq-week2`);
    for (const route of ["finances", "market", "squad", "training", "standings", "calendar", "news"]) {
      await page.goto(`${base}/career/${route}`, { waitUntil: "load", timeout: T });
      await settle(page, 900);
      await dismiss(page, mobile);
      const txt = await bodyText(page);
      // rc.33 (ECO-07): a new career has no day-one founding partner.
      if (route === "finances") checks.push({ step: `${tag} no founding partner on Finances`, ok: !txt.toLowerCase().includes(C.founding.toLowerCase()) });
      if (route === "market") {
        // rc.33 (UX-07): the reputation filter on the players tab.
        checks.push({ step: `${tag} signable-at-my-reputation filter`, ok: txt.toLowerCase().includes(C.signable.toLowerCase()) });
        // rc.33 (ECO-12): the deals tab no longer offers a sale listing.
        const deals = page.getByRole("button", { name: /^(My deals|Meus negócios|Minhas negociações)/ }).or(page.getByRole("tab", { name: /^(My deals|Meus)/ })).first();
        if (await deals.count()) {
          await press(deals, mobile).catch(() => {});
          await sleep(600);
        }
        const t2 = await bodyText(page);
        checks.push({ step: `${tag} no sale listing`, ok: !t2.toLowerCase().includes(C.sell.toLowerCase()) });
        await shot(page, `${tag}-market-deals`);
      }
      const lang = await page.evaluate(() => document.documentElement.lang);
      checks.push({ step: `${tag} /career/${route} lang`, ok: lang === (locale === "pt" ? "pt-BR" : "en"), value: lang });
      await shot(page, `${tag}-${route}`);
    }
  } catch (e) {
    checks.push({ step: `${tag} FAILED`, ok: false, value: e.message.slice(0, 300) });
    await shot(page, `${tag}-failure`);
  }
  await ctx.close();
  return { tag, errors, checks };
}

const browser = await chromium.launch();
const out = [];
for (const viewport of VIEWPORTS) {
  for (const locale of LOCALES) {
    if (SCEN.includes("home")) out.push(await scenarioHome(browser, viewport, locale));
    if (SCEN.includes("classic") && locale === "pt") out.push(await scenarioClassic(browser, viewport, locale));
    if (SCEN.includes("career")) out.push(await scenarioCareer(browser, viewport, locale));
  }
}
await browser.close();
for (const r of out) {
  const bad = r.checks.filter((c) => !c.ok);
  console.log(`${r.tag}: ${r.checks.length - bad.length}/${r.checks.length} checks ok, ${r.errors.length} errors`);
  for (const c of bad) console.log(`   ✗ ${c.step}${c.value !== undefined ? ` (${c.value})` : ""}`);
  for (const e of r.errors.slice(0, 8)) console.log(`   ! ${e}`);
}
