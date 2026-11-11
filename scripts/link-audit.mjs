#!/usr/bin/env node
/**
 * v2.0 (WEB-01) — internal links of an export, read from the HTML a crawler
 * gets (no JS): for every page, the links inside <main>, and whether one of
 * them leads to the game (/play, or /career on the Road to Worlds landing
 * page) and to the home page. "Inside <main>" includes the play strip that
 * AppShell renders right under it on the pages with no call to play of their
 * own (src/components/layout/PlayStrip.tsx). Pages are grouped by
 * route pattern; the row shows the WORST page of the group.
 *
 *   npm run build && node scripts/link-audit.mjs [out]
 *
 * Exits 1 when an indexable page has no in-content link to the home page
 * (the game's main menu; "/" or "/pt"). The /play column is informative.
 * The career app (/career/**) is skipped: it is never indexed.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const out = process.argv[2] ?? "out";
const SKIP_DIRS = new Set(["_next", "img", "career"]);
function walk(dir, acc = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) walk(p, acc);
    } else if (e.name.endsWith(".html")) acc.push(p);
  }
  return acc;
}
const group = (route) =>
  route.startsWith("/rlcs/players/")
    ? "/rlcs/players/*"
    : route.startsWith("/rlcs/teams/")
      ? "/rlcs/teams/*"
      : /^\/rlcs\/[^/]+$/.test(route) && route !== "/rlcs/teams" && route !== "/rlcs/players"
        ? "/rlcs/<season>"
        : route;

const groups = new Map();
for (const file of walk(out)) {
  const route = "/" + relative(out, file).split(sep).join("/").replace(/\.html$/, "").replace(/^index$/, "");
  if (route === "/career") continue;
  const html = readFileSync(file, "utf8");
  // In-content = <main> plus the play strip AppShell renders right under it.
  const main =
    (html.match(/<main[\s\S]*?<\/main>/)?.[0] ?? "") + (html.match(/<nav data-play-strip[\s\S]*?<\/nav>/)?.[0] ?? "");
  const links = [...main.matchAll(/<a\b[^>]*href="(\/[^"]*)"/g)].map((m) => m[1]);
  const noindex = /<meta name="robots" content="[^"]*noindex/.test(html);
  const row = { route, links: links.length, play: route === "/play" || links.includes("/play") || links.includes("/career"),home: links.includes("/") || links.includes("/pt"), noindex };
  const key = group(route);
  groups.set(key, [...(groups.get(key) ?? []), row]);
}
let failed = 0;
console.log("route".padEnd(30), "pages", " min links", " to /play", " to home");
for (const [key, rows] of [...groups.entries()].sort()) {
  const min = Math.min(...rows.map((r) => r.links));
  const play = rows.every((r) => r.play);
  const home = rows.every((r) => r.home);
  const noindex = rows.every((r) => r.noindex);
  if (!home && !noindex && key !== "/" && key !== "/pt" && key !== "/play") failed++; // the home pages themselves, and the game screen
  console.log(
    key.padEnd(30), String(rows.length).padStart(5), String(min).padStart(10),
    (play ? "yes" : "no").padStart(9), (home ? "yes" : noindex ? "no (noindex)" : "NO").padStart(8),
  );
}
if (failed) {
  console.error(`link-audit: ${failed} indexable route group(s) with no in-content link to the home page`);
  process.exit(1);
}
