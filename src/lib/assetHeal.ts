/**
 * v2.0.32 — a page whose build files failed to load repairs itself
 * (DESIGN-DECISIONS #171).
 *
 * The incident (18/11/2026): a player's Road to Worlds stayed on the career
 * shell's loading placeholder in one browser, across reloads, with the save
 * intact; another browser opened the game normally. Three facts lined up:
 *  1. Version skew: while a deploy spreads across Cloudflare (a few seconds),
 *     HTML from the new version can ask for a JavaScript chunk at a location
 *     still on the old version, which answers 404.
 *  2. `public/_headers` gives everything under `/_next/static/*` a one-year
 *     `immutable` Cache-Control, and Cloudflare sends it on that 404 too. The
 *     browser keeps the 404 and reuses it on every load, a normal reload
 *     included (an immutable file is never revalidated).
 *  3. Turbopack's runtime, for a chunk whose <script> tag is already in the
 *     HTML, only listens for that tag's `error` event. A tag that had already
 *     failed (a 404 served at once from the cache) never settles the chunk's
 *     promise, so the hydration that needs it waits forever: no error screen,
 *     no analytics event, the server-rendered skeleton stays on screen.
 *
 * `assetHealScript` runs inline on every page, before React. It watches the
 * page's resource entries: a `/_next/static/` script (or an applied
 * stylesheet) that came back 400 or more, from the network or from the cache,
 * is fetched again with `cache: "reload"`, which replaces the cached copy
 * with the real file, and the page loads again, once. Browsers without
 * `responseStatus` (Safari) get a watchdog instead: an app that has not
 * mounted `watchdogMs` after `load` has the page's own build files fetched
 * again the same way. One repair per tab per `windowMs`, never without
 * sessionStorage (nothing could stop a loop), never for a network failure
 * (status 0) or a prefetch. The note it leaves is reported once on the next
 * load (`AssetHealReport`, `quality_error` with source "heal").
 *
 * The script is inlined with Function#toString, so `assetHealScript` must
 * stay self-contained: no imports, nothing from module scope, plain ES2019
 * once the types are stripped.
 */

export interface AssetHealConfig {
  /** sessionStorage key: when this tab last repaired (ms). */
  key: string;
  /** sessionStorage key: what the last repair saw, for the next load to report. */
  noteKey: string;
  /** No second repair within this window (ms): a file still missing after it is left alone. */
  windowMs: number;
  /** Without `responseStatus`: repair when the app has not mounted this long after `load` (ms). */
  watchdogMs: number;
  /** The global the app sets once it has mounted (`markAppBooted`). */
  bootFlag: string;
  /** A file that is still missing when fetched again is asked again this many times... */
  retries: number;
  /** ...this far apart (ms): a deploy reaches every location within a few seconds. */
  retryMs: number;
}

export const ASSET_HEAL: AssetHealConfig = {
  key: "rd:asset-heal",
  noteKey: "rd:asset-heal:note",
  windowMs: 60_000,
  watchdogMs: 20_000,
  bootFlag: "__rdBooted",
  retries: 3,
  retryMs: 1_500,
};

/** The browser half. Inlined as `(${assetHealScript})(config)`: keep it self-contained. */
export function assetHealScript(c: AssetHealConfig): void {
  try {
    const w = window;
    const d = document;
    const prefix = w.location.origin + "/_next/static/";
    let started = false;

    const isBuildFile = (url: unknown): url is string => typeof url === "string" && url.indexOf(prefix) === 0;

    const appliedStylesheet = (url: string): boolean => {
      const links = d.querySelectorAll("link[rel=stylesheet]");
      for (let i = 0; i < links.length; i++) if ((links[i] as HTMLLinkElement).href === url) return true;
      return false;
    };

    const pageBuildFiles = (): string[] => {
      const out: string[] = [];
      const els = d.querySelectorAll("script[src],link[rel=stylesheet][href]");
      for (let i = 0; i < els.length; i++) {
        const el = els[i] as HTMLScriptElement & HTMLLinkElement;
        const url = el.src || el.href;
        if (isBuildFile(url) && out.indexOf(url) < 0) out.push(url);
      }
      return out;
    };

    const repair = (reason: string, urls: string[]): void => {
      if (started || urls.length === 0) return;
      started = true;
      let store: Storage | null = null;
      try {
        store = w.sessionStorage;
      } catch {
        store = null;
      }
      if (!store) return;
      try {
        const last = Number(store.getItem(c.key)) || 0;
        if (Date.now() - last < c.windowMs) return;
        store.setItem(c.key, String(Date.now()));
        const files = urls.map((u) => u.slice(prefix.length));
        store.setItem(c.noteKey, reason + " " + files.slice(0, 3).join(",") + (files.length > 3 ? ",+" + (files.length - 3) : ""));
      } catch {
        return;
      }
      const refetch = (url: string, left: number): Promise<void> =>
        fetch(url, { cache: "reload", credentials: "same-origin" }).then(
          (res) => {
            if (res.ok || left <= 0) return undefined;
            return new Promise<void>((done) => w.setTimeout(done, c.retryMs)).then(() => refetch(url, left - 1));
          },
          () => undefined,
        );
      Promise.all(urls.map((u) => refetch(u, c.retries))).then(() => w.location.reload());
    };

    const check = (entries: PerformanceEntryList): void => {
      const failed: string[] = [];
      for (let i = 0; i < entries.length; i++) {
        const e = entries[i] as PerformanceResourceTiming;
        if (!isBuildFile(e.name) || !(e.responseStatus >= 400)) continue;
        // A chunk the page runs, or a stylesheet it applies: never a prefetch or a preload.
        if (e.initiatorType !== "script" && !(e.initiatorType === "link" && appliedStylesheet(e.name))) continue;
        if (failed.indexOf(e.name) < 0) failed.push(e.name);
      }
      if (failed.length > 0) repair("status", failed);
    };

    const hasStatus =
      typeof PerformanceObserver !== "undefined" &&
      typeof PerformanceResourceTiming !== "undefined" &&
      "responseStatus" in PerformanceResourceTiming.prototype;
    if (hasStatus) {
      // `buffered` also hands over the entries recorded before this script ran (the head's chunks).
      new PerformanceObserver((list) => check(list.getEntries())).observe({ type: "resource", buffered: true });
      return;
    }
    const watch = (): void => {
      w.setTimeout(() => {
        if ((w as unknown as Record<string, unknown>)[c.bootFlag]) return;
        repair("stalled", pageBuildFiles());
      }, c.watchdogMs);
    };
    if (d.readyState === "complete") watch();
    else w.addEventListener("load", watch);
  } catch {
    // A repair script must never break the page it is trying to save.
  }
}

/** The `<script>` body for the root layout. */
export function assetHealInlineScript(config: AssetHealConfig = ASSET_HEAL): string {
  return `(${assetHealScript.toString()})(${JSON.stringify(config)});`;
}

/** The app mounted: the watchdog (browsers without `responseStatus`) stands down. */
export function markAppBooted(config: AssetHealConfig = ASSET_HEAL): void {
  try {
    (window as unknown as Record<string, unknown>)[config.bootFlag] = true;
  } catch {
    // nothing to mark outside a browser
  }
}

/** What the last repair saw ("status 0abc.js,1def.js"), once: it is removed when read. */
export function takeAssetHealNote(
  store: Pick<Storage, "getItem" | "removeItem"> | null,
  config: AssetHealConfig = ASSET_HEAL,
): string | null {
  if (!store) return null;
  try {
    const note = store.getItem(config.noteKey);
    if (note) store.removeItem(config.noteKey);
    return note || null;
  } catch {
    return null;
  }
}

/**
 * The error screen's own reload for a chunk that failed (app/error.tsx): fetch
 * that file again first, so a 404 the browser cached does not come back on the
 * reload. Reloads whatever the fetch says.
 */
export function refetchThenReload(url: string | null): void {
  const reload = (): void => window.location.reload();
  if (!url) return reload();
  try {
    fetch(url, { cache: "reload", credentials: "same-origin" }).then(reload, reload);
  } catch {
    reload();
  }
}
