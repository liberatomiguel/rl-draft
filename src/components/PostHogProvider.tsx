"use client";

/**
 * PostHog (product analytics) bootstrap — funnels, retention and the typed
 * game events from `src/lib/analytics.ts`. Mounted once in the root layout.
 *
 * Privacy: configured cookieless + anonymous to match the privacy policy —
 * persistence is localStorage (no cookies), `identify()` is never called
 * (`person_profiles: "identified_only"` keeps everyone anonymous), DOM
 * autocapture and session recording are off, and "Do Not Track" is respected.
 * Only pageviews and the explicit events we send are collected, all aggregate
 * and non-PII.
 *
 * 2.0 budget (docs/ANALYTICS-EVENTS-2.0.md): the SDK's own pageview capture is
 * OFF. `lib/analytics.ts` sends `$pageview` itself, once per route per session,
 * and applies the budget guard to everything. The guard's one input, the static
 * file `/analytics-budget.json`, is fetched here before the SDK connects (a
 * missing or broken file leaves the built-in defaults). Uncaught errors and
 * unhandled rejections are reported as `quality_error`.
 *
 * Lazy load: `posthog-js` (~75 KB gz) is NOT in the page bundle. It is fetched
 * with a dynamic `import()` after the window `load` event, in an idle callback,
 * so it never competes with hydration or first paint. Game events and pathname
 * changes that happen before it is ready are queued by `lib/analytics.ts` and
 * flushed with their original timestamps. The
 * token, host, `defaults`, persistence (`localStorage`, default persistence
 * name) and the anonymous distinct id are unchanged, so returning players keep
 * their identity and localhost stays flagged internal (via `defaults`).
 *
 * No-op until configured: with no NEXT_PUBLIC_POSTHOG_KEY (e.g. local dev, or a
 * build before the key is set) nothing is downloaded, init never runs and
 * `trackEvent` skips the PostHog sink — the app behaves exactly as before.
 *
 * Production only (OBS-01, #145): the SDK is never downloaded unless
 * `analyticsAllowed()` — a production build (no NEXT_PUBLIC_NOINDEX /
 * NEXT_PUBLIC_PLAYTEST) running on rocketdraft.app. Staging, playtest, a local
 * preview and dev send nothing, not even pageviews, even with a key set.
 */

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import {
  analyticsAllowed,
  connectAnalytics,
  disableAnalytics,
  notePageview,
  reportScreenError,
  setAnalyticsBudget,
} from "@/lib/analytics";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;

/** Not gameplay values — load-scheduling only. rIC deadline, so a page that is
 *  never idle still gets analytics; and a cap on waiting for `load` (a stalled
 *  image must not hold analytics back indefinitely). */
const IDLE_TIMEOUT_MS = 3000;
const LOAD_WAIT_CAP_MS = 10000;
/** The budget file must never hold the SDK back: past this, the defaults apply. */
const BUDGET_WAIT_CAP_MS = 3000;
const BUDGET_URL = "/analytics-budget.json";

/** Module-level so React strict mode / remounts can never init twice. */
let scheduled = false;

function whenIdle(run: () => void): void {
  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(() => run(), { timeout: IDLE_TIMEOUT_MS });
  } else {
    setTimeout(run, 1); // Safari: no requestIdleCallback
  }
}

function afterLoadThenIdle(run: () => void): void {
  let fired = false;
  const go = () => {
    if (fired) return;
    fired = true;
    whenIdle(run);
  };
  if (document.readyState === "complete") {
    go();
    return;
  }
  window.addEventListener("load", go, { once: true });
  setTimeout(go, LOAD_WAIT_CAP_MS);
}

/** The budget override (a static asset; never a Worker request). Resolves either way. */
function loadBudget(): Promise<void> {
  const fetched = fetch(BUDGET_URL, { cache: "no-cache" })
    .then((res) => (res.ok ? res.json() : null))
    .then((json) => setAnalyticsBudget(json))
    .catch(() => undefined);
  const capped = new Promise<void>((resolve) => setTimeout(resolve, BUDGET_WAIT_CAP_MS));
  return Promise.race([fetched, capped]);
}

function loadPostHog(key: string): void {
  Promise.all([import("posthog-js"), loadBudget()])
    .then(([{ default: posthog }]) => {
      if (!posthog.__loaded) {
        posthog.init(key, {
          api_host:
            process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com",
          defaults: "2026-05-30",
          // Anonymous by design: we never call identify(), so no person profiles
          // are created and every event stays attributed to an anonymous id (which
          // is enough for funnels + retention).
          person_profiles: "identified_only",
          persistence: "localStorage", // no cookies
          respect_dnt: true,
          // Keep the footprint to exactly what the privacy policy describes:
          // pageviews + our explicit game events. Everything `defaults` would
          // otherwise switch on is off — no DOM/dead-click autocapture, no surveys,
          // no session replay, no web-vitals capture.
          // 2.0: pageviews are sent by lib/analytics.ts (once per route per
          // session, under the budget guard), not by the SDK.
          capture_pageview: false,
          autocapture: false,
          capture_dead_clicks: false,
          disable_surveys: true,
          capture_performance: false,
          disable_session_recording: true,
          // No feature flags are used anywhere in src/ — skip the remote
          // config.js + /flags requests and the 5-minute /flags polling.
          advanced_disable_flags: true,
          // No insight in docs/ANALYTICS.md uses $pageleave — one event + one
          // beacon per visit saved.
          capture_pageleave: false,
        });
      }
      connectAnalytics(posthog);
    })
    .catch(() => disableAnalytics());
}

/** Reports every pathname change: `$pageview` once per route per session, and the career tab counters. */
function PageviewRecorder() {
  const pathname = usePathname();
  useEffect(() => {
    notePageview();
  }, [pathname]);
  return null;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!POSTHOG_KEY || scheduled || !analyticsAllowed()) return;
    scheduled = true;
    afterLoadThenIdle(() => loadPostHog(POSTHOG_KEY));
    // Health: what no error boundary caught (the boundary reports its own).
    window.addEventListener("error", (event) => reportScreenError("window", event.error ?? { message: event.message }));
    window.addEventListener("unhandledrejection", (event) => reportScreenError("promise", event.reason));
  }, []);

  return (
    <>
      {children}
      {POSTHOG_KEY ? <PageviewRecorder /> : null}
    </>
  );
}
