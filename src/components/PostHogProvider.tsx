"use client";

/**
 * PostHog (product analytics) bootstrap — funnels, retention and the typed
 * game events from `src/lib/analytics.ts`. Mounted once in the root layout.
 *
 * Privacy: configured cookieless + anonymous to match the privacy policy —
 * persistence is localStorage (no cookies), `identify()` is never called
 * (`person_profiles: "identified_only"` keeps everyone anonymous), DOM
 * autocapture and session recording are off, and "Do Not Track" is respected.
 * Only pageviews (incl. SPA route changes) and the explicit events we send are
 * collected, all aggregate and non-PII.
 *
 * No-op until configured: with no NEXT_PUBLIC_POSTHOG_KEY (e.g. local dev, or a
 * build before the key is set) init never runs and `trackEvent` skips the
 * PostHog sink — the app behaves exactly as before.
 */

import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { useEffect } from "react";

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key || posthog.__loaded) return;
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
      // no session replay; web performance is left to Vercel Speed Insights.
      capture_pageview: "history_change", // SPA-aware pageviews (App Router)
      autocapture: false,
      capture_dead_clicks: false,
      disable_surveys: true,
      capture_performance: false,
      disable_session_recording: true,
    });
  }, []);

  return <PHProvider client={posthog}>{children}</PHProvider>;
}
