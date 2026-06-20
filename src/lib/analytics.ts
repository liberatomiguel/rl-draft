/**
 * Custom game-event analytics — a thin, typed wrapper that sends each event to
 * PostHog product analytics for funnels / retention / breakdowns (bootstrapped
 * in `src/components/PostHogProvider.tsx`).
 *
 * History: this used to ALSO fan every event into Vercel Web Analytics, but that
 * sink was redundant with PostHog and its per-event beacons (plus the
 * `<Analytics/>`/`<SpeedInsights/>` pageview beacons) were the dominant driver of
 * Vercel "edge requests" — which blew past the Hobby 1M/mo cap at launch. Dropped
 * in v1.4 (PostHog keeps all the same data). See docs/ANALYTICS.md.
 *
 * Rules:
 *  - PostHog is a NO-OP until enabled (once NEXT_PUBLIC_POSTHOG_KEY is set), so
 *    calling these is always safe and never blocks gameplay.
 *  - Event property values MUST be scalars (string | number | boolean | null);
 *    payloads are pre-flattened here.
 *  - UI/store layer only. NEVER import this from `src/engine` — the engine must
 *    stay pure/deterministic (AGENTS.md hard rule).
 *  - All values are aggregate and non-PII, consistent with the privacy policy.
 *
 * Inspect the data in PostHog (Trends / Funnels, filterable by the properties
 * below): run_started / tournament_started / run_completed / run_abandoned.
 */
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
  // Single sink, guarded so analytics never breaks the game.
  try {
    if (posthog.__loaded) posthog.capture(name, payload);
  } catch {
    // PostHog — no-op until NEXT_PUBLIC_POSTHOG_KEY is configured.
  }
}
