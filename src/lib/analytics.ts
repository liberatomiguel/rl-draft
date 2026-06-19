/**
 * Custom game-event analytics — a thin, typed wrapper that fans the SAME
 * events out to two sinks:
 *   - Vercel Web Analytics custom events (`<Analytics/>` in the root layout),
 *   - PostHog product analytics for funnels / retention / breakdowns
 *     (bootstrapped in `src/components/PostHogProvider.tsx`).
 *
 * Rules:
 *  - Both sinks are NO-OPs until enabled (Vercel: prod with Web Analytics on;
 *    PostHog: once NEXT_PUBLIC_POSTHOG_KEY is set), so calling these is always
 *    safe and never blocks gameplay.
 *  - Event property values MUST be scalars (string | number | boolean | null);
 *    Vercel rejects nested objects, so payloads are pre-flattened here (PostHog
 *    accepts the same shape).
 *  - UI/store layer only. NEVER import this from `src/engine` — the engine must
 *    stay pure/deterministic (AGENTS.md hard rule).
 *  - All values are aggregate and non-PII, consistent with the privacy policy.
 *
 * Inspect the data in PostHog (Trends / Funnels, filterable by the properties
 * below) or Vercel → Analytics → Events: run_started / tournament_started /
 * run_completed / run_abandoned.
 */
import { track } from "@vercel/analytics";
import posthog from "posthog-js";

/** The full custom-event catalogue. Add a new event by adding a key here. */
export interface GameEvents {
  /** A run was created (classic / quick / daily), with its chosen settings. */
  run_started: {
    mode: string;
    difficulty: string;
    hiddenOverall: boolean;
    /** Region lock, or "worldwide" for the default pool (v1.2.0). */
    region?: string;
  };
  /** The draft was confirmed and the tournament bracket began. */
  tournament_started: {
    mode: string;
    difficulty: string;
  };
  /** A run reached its results screen — the key outcome/win-rate event. */
  run_completed: {
    mode: string;
    difficulty: string;
    placement: string;
    won: boolean;
    hiddenOverall: boolean;
    teamOverall: number;
    swissWins: number;
    swissLosses: number;
    xpGained: number;
  };
  /** A run was left before its results screen — the drop-off signal that turns
   *  the funnel's implicit gap into an explicit, attributable event.
   *  `phase` = where they were (draft / review / tournament); `reason` =
   *  "quit" (left to the menu) or "restart" (restarted into a fresh run). */
  run_abandoned: {
    mode: string;
    difficulty: string;
    phase: string;
    reason: string;
    hiddenOverall: boolean;
    region?: string;
  };
  /** One per special card on the FINAL roster when the tournament starts — the
   *  special-card usage signal (which specials players actually take in). Fired
   *  once per special, so a Trends "Total count" broken down by `title`/`rarity`
   *  ranks the most-used cards. */
  special_used: {
    specialId: string;
    title: string;
    rarity: string;
    mode: string;
    difficulty: string;
  };
  /** A challenge's single Bo7 was played (v1.4) — `cleared` = the puzzle solved. */
  challenge_played: {
    challengeId: string;
    difficulty: string;
    cleared: boolean;
  };
}

export function trackEvent<K extends keyof GameEvents>(
  name: K,
  props: GameEvents[K],
): void {
  const payload = props as Record<string, string | number | boolean | null>;
  // Two independent sinks; each guarded so analytics never breaks the game.
  try {
    track(name, payload);
  } catch {
    // Vercel Web Analytics — no-op in dev / when disabled.
  }
  try {
    if (posthog.__loaded) posthog.capture(name, payload);
  } catch {
    // PostHog — no-op until NEXT_PUBLIC_POSTHOG_KEY is configured.
  }
}
