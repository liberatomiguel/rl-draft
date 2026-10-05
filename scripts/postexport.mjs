/**
 * Post-export fix-ups and checks for the static export in out/ (runs as
 * `postbuild`, i.e. after every `npm run build`).
 *
 *   node scripts/postexport.mjs
 *
 * Exits non-zero when a step fails, so a broken export never reaches
 * `wrangler deploy` (npm run deploy = build && deploy).
 *
 * Steps run in order; each is a small named function `(ctx) => void` that
 * throws to fail the build. To add a step, write the function and append it
 * to STEPS. `ctx.files` is the out/ file list (POSIX paths relative to out/)
 * and is refreshed after every step that changes files (`mutates: true`).
 *
 * The env is loaded ONCE in main(), the way `next build` loads it (shell
 * first, then .env.production.local, .env.local, .env.production, .env — a file
 * never overrides a variable the shell already set), so every step sees the
 * same NEXT_PUBLIC_* values that were inlined into out/.
 *
 * Measurement builds against local mock services: set
 * ROCKET_DRAFT_ALLOW_LOCAL_ENDPOINTS=1 IN THE SHELL (env files are ignored for
 * it) to let http/loopback analytics + Supabase endpoints through the
 * "check service endpoints" step. Such an out/ must never be deployed.
 */

import { existsSync } from "node:fs";
import { readdir, readFile, rename, rm, rmdir, stat } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const OUT = join(ROOT, "out");
const MANIFEST_PATH = join(ROOT, "src", "generated", "asset-manifest.json");

/** Build-time URLs inlined into the client bundle; must be https + public. */
const ENDPOINT_VARS = ["NEXT_PUBLIC_POSTHOG_HOST", "NEXT_PUBLIC_SUPABASE_URL"];
/** Shell-only opt-out for local measurement builds (see the header). */
const ALLOW_LOCAL_ENDPOINTS = "ROCKET_DRAFT_ALLOW_LOCAL_ENDPOINTS";

/** Cloudflare Workers Static Assets limits (Free plan). */
const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MiB per asset
const MAX_FILES = 20_000; // assets per Worker version

const REQUIRED_FILES = ["index.html", "404.html", "_headers", "opengraph-image.png"];

/**
 * Top-level out/ entries of the /career route group: the `career/` folder and
 * `career.html` / `career.txt` (plus any other `career.<ext>` sibling).
 */
const CAREER_ENTRY = /^career(\.[a-z]+)?$/;

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const toPosix = (p) => p.split(sep).join("/");

/** All files under `dir`, as POSIX paths relative to `base`. */
async function listFiles(dir, base = dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await listFiles(p, base)));
    else out.push(toPosix(relative(base, p)));
  }
  return out;
}

/** Directories under `dir` whose name matches `test` (not descending into matches). */
async function findDirs(dir, test, found = []) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const p = join(dir, e.name);
    if (test(e.name)) found.push(p);
    else await findDirs(p, test, found);
  }
  return found;
}

async function removeEmptyTree(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.isDirectory()) await removeEmptyTree(join(dir, e.name));
  }
  await rmdir(dir); // throws if anything is left behind — on purpose
}

const mb = (n) => `${(n / 1024 / 1024).toFixed(2)} MB`;
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;

/**
 * Load .env* files exactly like `next build` (@next/env, production mode,
 * never overriding the shell). Called once, before any step. Captures the
 * shell-only opt-out BEFORE the files are loaded, and remembers where each
 * variable came from so the build log can say e.g. "from .env.local".
 */
async function loadBuildEnv() {
  const shellEnv = { ...process.env };
  const allowLocalEndpoints = shellEnv[ALLOW_LOCAL_ENDPOINTS] === "1";
  let loaded = [];
  try {
    const { default: nextEnv } = await import("@next/env");
    ({ loadedEnvFiles: loaded } = nextEnv.loadEnvConfig(ROOT, false, { info: () => {}, error: console.error }));
  } catch (err) {
    console.warn(`postexport: could not load .env files via @next/env (${err.message}); using the shell env only`);
  }
  const files = loaded.map((f) => f.path);
  console.log(`postexport: env files loaded: ${files.length ? files.join(", ") : "none (shell env only)"}`);
  if (!allowLocalEndpoints && shellEnv[ALLOW_LOCAL_ENDPOINTS] !== undefined) {
    console.warn(`postexport: ${ALLOW_LOCAL_ENDPOINTS}=${JSON.stringify(shellEnv[ALLOW_LOCAL_ENDPOINTS])} in the shell — IGNORED (only the exact value "1" opts out)`);
  } else if (!allowLocalEndpoints && process.env[ALLOW_LOCAL_ENDPOINTS] !== undefined) {
    console.warn(`postexport: ${ALLOW_LOCAL_ENDPOINTS} found in an env file — IGNORED (it only counts when set in the shell)`);
  }
  /** "shell", the env file that supplied `name`, or null when unset. */
  const sourceOf = (name) => {
    if (shellEnv[name] !== undefined) return "shell";
    return loaded.find((f) => f.env && f.env[name] !== undefined)?.path ?? null;
  };
  return { files, allowLocalEndpoints, sourceOf };
}

/** localhost, *.localhost, 127.0.0.0/8, 0.0.0.0, ::1, ::, IPv4-mapped loopback.
 *  `hostname` comes from WHATWG URL, which already normalises forms like
 *  127.1, 2130706433 or [::ffff:127.0.0.1]. */
function isLocalHost(hostname) {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  return (
    h === "localhost" ||
    h.endsWith(".localhost") ||
    /^127(\.\d{1,3}){3}$/.test(h) ||
    h === "0.0.0.0" ||
    h === "::1" ||
    h === "::" ||
    /^::ffff:(127\.|7f[0-9a-f]{2}:)/.test(h)
  );
}

/** Same rule as scripts/build-images.mjs assertWidths(). */
const validWidths = (w) =>
  Array.isArray(w) && w.length > 0 && w.every((x, i) => Number.isInteger(x) && x > 0 && (i === 0 || x > w[i - 1]));

/** A site URL path → the out/-relative file the static host serves for it
 *  (each segment percent-decoded, e.g. "%40" → "@"). */
const urlToOutFile = (url) => url.split("/").filter(Boolean).map(decodeURIComponent).join("/");

// ---------------------------------------------------------------------------
// steps
// ---------------------------------------------------------------------------

/**
 * ENDPOINT GUARD. NEXT_PUBLIC_POSTHOG_HOST and NEXT_PUBLIC_SUPABASE_URL are
 * inlined into the client bundle at build time, so whatever the build saw is
 * what production calls. Fail when either is set to something that is not an
 * https URL on a public host (http://, localhost, 127.x, ::1 …) — e.g. a
 * leftover measurement env pointing at local mock servers. Opt-out for local
 * measurement builds: ROCKET_DRAFT_ALLOW_LOCAL_ENDPOINTS=1 in the shell.
 *
 * Also logs (never fails on) whether accounts (Supabase) and analytics
 * (PostHog) are ENABLED in this build and where the values came from — so a
 * local `npm run deploy` that silently picked up .env.local is visible. The
 * enabled rules mirror src/lib/supabase.ts (`accountsEnabled`) and
 * src/components/PostHogProvider.tsx (key set) — KEEP IN SYNC.
 */
async function checkServiceEndpoints(ctx) {
  const { sourceOf, allowLocalEndpoints } = ctx.env;
  const analytics = Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY);
  const accounts = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  const problems = [];
  for (const name of ENDPOINT_VARS) {
    const value = process.env[name];
    if (value === undefined) continue; // unset → PostHog's EU default host / accounts off
    if (value === "") {
      // PostHogProvider reads the host with `??`, so an empty string is NOT
      // replaced by the default — events would go to the site's own origin.
      if (name === "NEXT_PUBLIC_POSTHOG_HOST" && analytics) {
        problems.push(`${name} is set but empty (from ${sourceOf(name)})`);
      }
      continue;
    }
    let url;
    try {
      url = new URL(value);
    } catch {
      problems.push(`${name} is not a valid URL (from ${sourceOf(name)})`);
      continue;
    }
    const why = [];
    if (url.protocol !== "https:") why.push("not https");
    if (isLocalHost(url.hostname)) why.push("loopback/localhost host");
    if (why.length) problems.push(`${name}=${url.origin} — ${why.join(", ")} (from ${sourceOf(name)})`);
  }

  if (problems.length && !allowLocalEndpoints) {
    throw new Error(
      `non-production service endpoint(s) would be baked into this build:\n    ${problems.join("\n    ")}\n` +
        "  Fix the variable (shell / Workers Builds dashboard / .env*.local). For a LOCAL measurement build " +
        `that will never be deployed, set ${ALLOW_LOCAL_ENDPOINTS}=1 in the shell.`,
    );
  }
  if (problems.length) {
    const bar = "!".repeat(78);
    console.warn(`  ${bar}`);
    console.warn(`  ${ALLOW_LOCAL_ENDPOINTS}=1 — LOCAL / NON-HTTPS ENDPOINTS ARE BAKED INTO out/:`);
    for (const p of problems) console.warn(`    ${p}`);
    console.warn("  This out/ is for local measurement ONLY. Do NOT deploy it — rebuild without the opt-out first.");
    console.warn(`  ${bar}`);
  } else if (allowLocalEndpoints) {
    console.log(`  ${ALLOW_LOCAL_ENDPOINTS}=1 is set, but every endpoint is https and public — the opt-out changed nothing`);
  } else {
    console.log("  service endpoints: https + public host (or unset)");
  }

  const where = (name) => {
    const v = process.env[name];
    let origin = v;
    try {
      origin = new URL(v).origin;
    } catch {
      // keep the raw value (already reported above when it matters)
    }
    return `${origin} (from ${sourceOf(name)})`;
  };
  const accountsLine = accounts
    ? `ENABLED → ${where("NEXT_PUBLIC_SUPABASE_URL")}; anon key from ${sourceOf("NEXT_PUBLIC_SUPABASE_ANON_KEY")}`
    : "DISABLED (needs both NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY)";
  const analyticsLine = analytics
    ? `ENABLED → ${
        process.env.NEXT_PUBLIC_POSTHOG_HOST === undefined
          ? "PostHogProvider's default host (NEXT_PUBLIC_POSTHOG_HOST unset)"
          : where("NEXT_PUBLIC_POSTHOG_HOST")
      }; key from ${sourceOf("NEXT_PUBLIC_POSTHOG_KEY")}`
    : "DISABLED (NEXT_PUBLIC_POSTHOG_KEY not set)";
  console.log(`  accounts  (Supabase): ${accountsLine}`);
  console.log(`  analytics (PostHog):  ${analyticsLine}`);
  ctx.summary.push(
    `accounts ${accounts ? "ENABLED" : "DISABLED"}`,
    `analytics ${analytics ? "ENABLED" : "DISABLED"}`,
  );
  if (problems.length) ctx.summary.push("LOCAL ENDPOINTS — DO NOT DEPLOY");
}

/**
 * WINDOWS FIX. Next's export copies each route's prefetch segments to
 * `<route>/__next.<segment path with "/" → ".">.txt`, but it derives the
 * segment path with path.relative() — backslashes on Windows — and only
 * replaces "/" (next/dist/export/index.js collectSegmentPathsImpl;
 * shared/lib/segment-cache/segment-value-encoding.js
 * convertSegmentPathToStaticExportFilename). On Windows the files land in a
 * folder instead:
 *     play/__next.play/__PAGE__.txt         (should be play/__next.play.__PAGE__.txt)
 *     career/new/__next.career/new.txt      (should be career/new/__next.career.new.txt)
 * and every prefetch of them 404s. Flatten every "__next.*" DIRECTORY back to
 * the dotted file name the client requests. Linux/macOS builds never produce
 * such directories, so there this step finds nothing and is a no-op.
 */
async function flattenWindowsSegmentDirs() {
  const dirs = await findDirs(OUT, (name) => name.startsWith("__next."));
  let moved = 0;
  for (const dir of dirs) {
    const parent = dirname(dir);
    const prefix = dir.slice(parent.length + 1); // "__next.<segment>"
    for (const rel of await listFiles(dir)) {
      const target = join(parent, `${prefix}.${rel.split("/").join(".")}`);
      const source = join(dir, ...rel.split("/"));
      if (existsSync(target)) {
        const [a, b] = await Promise.all([readFile(source), readFile(target)]);
        if (!a.equals(b)) {
          throw new Error(`segment flatten collision with different content: ${toPosix(relative(OUT, target))}`);
        }
        await rm(source);
      } else {
        await rename(source, target);
      }
      moved++;
    }
    await removeEmptyTree(dir);
  }
  console.log(
    dirs.length
      ? `  flattened ${moved} segment file(s) from ${dirs.length} "__next.*" folder(s)`
      : `  no "__next.*" folders — nothing to do (always the case on Linux/macOS builds)`,
  );
}

/**
 * CAREER GATE. Road to Worlds (alpha) is OFF in production builds unless the
 * build sets NEXT_PUBLIC_CAREER_MODE=1 — `FEATURES.careerMode` in
 * src/config/balance.ts is
 *     NODE_ENV !== "production" || NEXT_PUBLIC_CAREER_MODE === "1"
 * and `next build` always runs with NODE_ENV=production, so only the second
 * half matters here (KEEP THE TWO IN SYNC). With the flag off the career
 * layout calls notFound(), but a static export still writes out/career.html,
 * out/career.txt and out/career/** — 404 boundaries the host would serve with
 * HTTP 200. Delete them so the host serves the real 404 page instead.
 *
 * The env was loaded by main() the way `next build` reads it
 * (.env.production.local, .env.local, .env.production, .env — never
 * overriding the shell), so a flag set in an env file can't make this script
 * disagree with the build. As a second guard the home page is checked: a
 * flag-off build must not link to /career, and the sitemap must never list it.
 */
async function stripCareerWhenDisabled(ctx) {
  const careerOn = process.env.NEXT_PUBLIC_CAREER_MODE === "1";
  ctx.summary.push(`career ${careerOn ? "ON" : "OFF"}`);
  const home = await readFile(join(ctx.out, "index.html"), "utf8");
  const homeLinksCareer = home.includes('href="/career');
  const sitemap = join(ctx.out, "sitemap.xml");
  if (existsSync(sitemap) && (await readFile(sitemap, "utf8")).includes("/career")) {
    throw new Error("sitemap.xml lists /career — the alpha career mode must never be in the sitemap");
  }

  if (careerOn) {
    if (!homeLinksCareer) {
      console.warn("  WARNING: NEXT_PUBLIC_CAREER_MODE=1 but the home page has no /career link — was the build made with the flag off?");
    }
    console.log("  career mode ON (NEXT_PUBLIC_CAREER_MODE=1) — /career kept (pages carry noindex)");
    return;
  }
  if (homeLinksCareer) {
    throw new Error(
      "career mode is OFF for this script but out/index.html links to /career — the build saw a different " +
        "NEXT_PUBLIC_CAREER_MODE (or NODE_ENV) than this step; refusing to delete pages the site links to",
    );
  }
  const entries = (await readdir(ctx.out, { withFileTypes: true })).filter((e) => CAREER_ENTRY.test(e.name));
  const removed = [];
  for (const e of entries) {
    const p = join(ctx.out, e.name);
    const count = e.isDirectory() ? (await listFiles(p)).length : 1;
    await rm(p, { recursive: true, force: true });
    removed.push(e.isDirectory() ? `${e.name}/ (${count} files)` : e.name);
  }
  console.log(
    removed.length
      ? `  career mode OFF — removed ${removed.join(", ")} (host now serves 404.html for /career*)`
      : "  career mode OFF — no career files in out/, nothing to remove",
  );
}

/**
 * Every exported route folder must contain the page segment the client
 * prefetches: `<route>/__next.<route with "/" → ".">.__PAGE__.txt`
 * (e.g. career/new/__next.career.new.__PAGE__.txt). Catches a regression of
 * the Windows bug above or a change in Next's naming scheme.
 */
async function checkSegmentNames(ctx) {
  const files = new Set(ctx.files);
  const routeDirs = ctx.files
    .filter((f) => f.endsWith("/__next._tree.txt"))
    .map((f) => f.slice(0, -"/__next._tree.txt".length));
  const missing = routeDirs
    .map((route) => `${route}/__next.${route.split("/").join(".")}.__PAGE__.txt`)
    .filter((expected) => !files.has(expected));
  if (!files.has("__next.__PAGE__.txt")) missing.push("__next.__PAGE__.txt");
  if (missing.length) {
    throw new Error(`missing prefetch segment file(s):\n    ${missing.join("\n    ")}`);
  }
  console.log(`  ${routeDirs.length + 1} route(s) have their __PAGE__ prefetch segment`);
}

async function checkRequiredFiles(ctx) {
  const files = new Set(ctx.files);
  const missing = REQUIRED_FILES.filter((f) => !files.has(f));
  if (missing.length) throw new Error(`missing required file(s): ${missing.join(", ")}`);
  console.log(`  required files present: ${REQUIRED_FILES.join(", ")}`);
}

/**
 * GENERATED IMAGES. src/lib/assets.ts only ever builds URLs for assets in
 * src/generated/asset-manifest.json, choosing a width from the manifest's
 * `widths`. Rebuild every URL it can return — each org key × widths.orgs,
 * each special × widths.specials, each rank, each flag — with the SAME
 * formats as orgLogoSrc / specialPhotoSrc / rankSrc / flagSrc (KEEP IN SYNC),
 * and fail if the file the static host would serve is missing from out/. A
 * miss here would otherwise ship as a 404 cached `immutable` for a year
 * (public/_headers applies to error responses too).
 */
async function checkGeneratedImages(ctx) {
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
  const widths = manifest.widths ?? {};
  for (const kind of ["orgs", "specials"]) {
    if (!validWidths(widths[kind])) {
      throw new Error(
        `asset-manifest.json widths.${kind} must be non-empty, ascending, unique positive integers ` +
          `(got ${JSON.stringify(widths[kind])}) — re-run npm run build:images`,
      );
    }
  }
  const seg = encodeURIComponent; // = assets.ts `seg`
  const urls = [];
  for (const [key, hash] of Object.entries(manifest.orgs ?? {})) {
    for (const w of widths.orgs) urls.push(`/img/orgs/${seg(key)}.${hash}.${w}.webp`);
  }
  for (const [id, hash] of Object.entries(manifest.specials ?? {})) {
    for (const w of widths.specials) urls.push(`/img/specials/${seg(id)}.${hash}.${w}.webp`);
  }
  for (const [key, hash] of Object.entries(manifest.ranks ?? {})) {
    const slash = key.indexOf("/");
    const variant = key.slice(0, slash);
    const rankId = key.slice(slash + 1);
    urls.push(`/img/ranks/${variant}/${seg(rankId)}.${hash}.webp`);
  }
  for (const cc of manifest.flags ?? []) urls.push(`/flags/${cc}.png`);

  const files = new Set(ctx.files);
  const missing = urls.filter((u) => !files.has(urlToOutFile(u)));
  if (missing.length) {
    const shown = missing.slice(0, 20);
    throw new Error(
      `${missing.length} of ${urls.length} image URL(s) that src/lib/assets.ts can request are missing from out/ ` +
        `(stale asset-manifest.json or public/img/? re-run npm run build:images, then rebuild):\n    ` +
        shown.join("\n    ") +
        (missing.length > shown.length ? `\n    … and ${missing.length - shown.length} more` : ""),
    );
  }
  const n = (o) => Object.keys(o ?? {}).length;
  console.log(
    `  all ${urls.length} manifest image URL(s) exist in out/: ${n(manifest.orgs)} orgs × [${widths.orgs}], ` +
      `${n(manifest.specials)} specials × [${widths.specials}], ${n(manifest.ranks)} ranks, ${(manifest.flags ?? []).length} flags`,
  );
}

async function checkHostLimits(ctx) {
  if (ctx.files.length >= MAX_FILES) {
    throw new Error(`${ctx.files.length} files — Cloudflare allows < ${MAX_FILES} assets`);
  }
  const tooBig = ctx.sizes.filter(([, size]) => size > MAX_FILE_BYTES);
  if (tooBig.length) {
    throw new Error(
      `file(s) over the 25 MiB asset limit: ${tooBig.map(([f, s]) => `${f} (${mb(s)})`).join(", ")}`,
    );
  }
  console.log(`  ${ctx.files.length} files (< ${MAX_FILES}), none over 25 MiB`);
}

async function report(ctx) {
  const total = ctx.sizes.reduce((sum, [, size]) => sum + size, 0);
  console.log(`  out/: ${ctx.files.length} files, ${mb(total)}`);
  console.log("  largest files:");
  for (const [file, size] of [...ctx.sizes].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
    console.log(`    ${kb(size).padStart(10)}  ${file}`);
  }
}

/** Ordered pipeline. `mutates: true` → the file list is re-read afterwards. */
const STEPS = [
  { name: "check service endpoints", run: checkServiceEndpoints },
  { name: "flatten Windows segment folders", run: flattenWindowsSegmentDirs, mutates: true },
  { name: "strip /career when career mode is off", run: stripCareerWhenDisabled, mutates: true },
  { name: "check prefetch segment names", run: checkSegmentNames },
  { name: "check required files", run: checkRequiredFiles },
  { name: "check generated images", run: checkGeneratedImages },
  { name: "check Cloudflare limits", run: checkHostLimits },
  { name: "report", run: report },
];

// ---------------------------------------------------------------------------

async function scan() {
  const files = await listFiles(OUT);
  const sizes = await Promise.all(files.map(async (f) => [f, (await stat(join(OUT, f))).size]));
  return { files, sizes };
}

async function main() {
  if (!existsSync(OUT)) {
    console.error("postexport: out/ not found — is `output: \"export\"` set in next.config.ts?");
    process.exit(1);
  }
  const env = await loadBuildEnv();
  /** `summary`: short status parts steps push for the final OK line. */
  const ctx = { root: ROOT, out: OUT, env, summary: [], ...(await scan()) };
  for (const step of STEPS) {
    console.log(`postexport: ${step.name}`);
    try {
      await step.run(ctx);
    } catch (err) {
      console.error(`postexport: FAILED at "${step.name}": ${err.message}`);
      process.exit(1);
    }
    if (step.mutates) Object.assign(ctx, await scan());
  }
  console.log(`postexport: OK — ${ctx.summary.join(" · ")}`);
}

await main();
