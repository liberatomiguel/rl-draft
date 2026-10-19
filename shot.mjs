// Screenshot helper (dev only, not committed): node shot.mjs <path> <out.png> [--preview] [--mobile] [--click=selector]
import { chromium } from "playwright-core";

const [, , path = "/", out = "shot.png", ...flags] = process.argv;
const preview = flags.includes("--preview");
const mobile = flags.includes("--mobile");
const clickSel = flags.find((f) => f.startsWith("--click="))?.slice(8);
const full = !flags.includes("--viewport");

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(`http://localhost:3000${path}`, { waitUntil: "networkidle" });
if (preview) {
  await page.evaluate((equip) => {
    const key = "rocket-draft:profile:v1";
    const raw = localStorage.getItem(key);
    const obj = raw ? JSON.parse(raw) : { state: {}, version: 12 };
    const today = new Date().toISOString().slice(0, 10);
    obj.state = {
      ...obj.state,
      previewUnlockAll: true,
      flags: { ...(obj.state.flags ?? {}), seenTutorial: true },
      login: { lastDay: today, streak: 5, best: 9, total: 20 },
      xp: 1400,
      mmr: 1180,
    };
    if (equip) {
      obj.state.cosmetics = {
        ...(obj.state.cosmetics ?? { owned: {} }),
        equipped: {
          title: "legacy-title-champion",
          frame: "s1-frame-supersonic",
          banner: "legacy-banner-champion",
          badges: ["career-badge-dynasty", "grant-badge-pro-player", "stars-badge-10"],
          avatar: "avatar-phoenix",
        },
      };
    }
    localStorage.setItem(key, JSON.stringify(obj));
  }, flags.includes("--equip"));
  await page.reload({ waitUntil: "networkidle" });
}
if (clickSel) {
  await page.click(clickSel);
  await page.waitForTimeout(600);
}
await page.waitForTimeout(800);
await page.screenshot({ path: out, fullPage: full });
console.log("saved", out, "errors:", errors.length ? errors : "none");
await browser.close();
