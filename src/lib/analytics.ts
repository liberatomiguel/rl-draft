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
 * Lazy SDK (static-export move): `posthog-js` is NOT imported here — it is
 * downloaded by the provider after window load + idle and handed over through
 * `connectAnalytics`. Until then events are QUEUED (bounded) with their original
 * timestamp and URL, and flushed in order once the SDK is ready, so a run started
 * in the first seconds of a visit still lands in the funnels. Pathname changes
 * seen before the SDK was ready are queued too (`notePageview`) and replayed as
 * `$pageview`s, so SPA navigations made before init are still counted.
 *
 * Rules:
 *  - PostHog is a NO-OP until enabled (once NEXT_PUBLIC_POSTHOG_KEY is set), so
 *    calling these is always safe and never blocks gameplay. Without a key
 *    nothing is queued.
 *  - Event property values MUST be scalars (string | number | boolean | null);
 *    payloads are pre-flattened here.
 *  - UI/store layer only. NEVER import this from `src/engine` — the engine must
 *    stay pure/deterministic (AGENTS.md hard rule).
 *  - All values are aggregate and non-PII, consistent with the privacy policy.
 *
 * Inspect the data in PostHog (Trends / Funnels, filterable by the properties
 * below): run_started / tournament_started / run_completed / run_abandoned.
 */

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

type Scalar = string | number | boolean | null;
type Props = Record<string, Scalar>;

/** The slice of the PostHog client this module uses (structural, so the SDK's
 *  types never pull its runtime into this file). */
export interface AnalyticsSink {
  capture(name: string, properties?: Record<string, unknown> | null, options?: { timestamp?: Date }): unknown;
}

/** Things captured before the SDK was ready, in the order they happened. */
type Queued =
  | { kind: "event"; name: string; props: Props; at: Date; url: string; pathname: string }
  | { kind: "pageview"; at: Date; url: string; pathname: string };

/** Hard cap on what waits for the SDK. A normal visit queues a handful of items
 *  in the few seconds before load + idle; the cap only bounds memory if the SDK
 *  never arrives. Once full, later items are dropped (earliest context kept). */
export const ANALYTICS_QUEUE_LIMIT = 50;

let sink: AnalyticsSink | null = null;
/** No key → never queue. Also flipped when the SDK fails to load. */
let disabled = !process.env.NEXT_PUBLIC_POSTHOG_KEY;
let queue: Queued[] = [];

function canQueue(): boolean {
  return !sink && !disabled && typeof window !== "undefined";
}

function enqueue(item: Queued): void {
  if (queue.length >= ANALYTICS_QUEUE_LIMIT) return;
  queue.push(item);
}

export function trackEvent<K extends keyof GameEvents>(
  name: K,
  props: GameEvents[K],
): void {
  const payload = props as Props;
  // Single sink, guarded so analytics never breaks the game.
  try {
    if (sink) {
      sink.capture(name, payload);
      return;
    }
    if (!canQueue()) return; // PostHog — no-op until NEXT_PUBLIC_POSTHOG_KEY is configured.
    const { href, pathname } = window.location;
    enqueue({ kind: "event", name, props: { ...payload }, at: new Date(), url: href, pathname });
  } catch {
    // analytics must never throw into gameplay
  }
}

/**
 * Record the page the player is on, if the SDK isn't ready yet (called by the
 * provider on every pathname change). Once the SDK is connected its own
 * `capture_pageview: "history_change"` takes over and this is a no-op.
 */
export function notePageview(): void {
  try {
    if (!canQueue()) return;
    const { href, pathname } = window.location;
    for (let i = queue.length - 1; i >= 0; i--) {
      const q = queue[i];
      if (q.kind !== "pageview") continue;
      if (q.pathname === pathname) return; // same page (re-render / strict-mode re-run)
      break;
    }
    enqueue({ kind: "pageview", at: new Date(), url: href, pathname });
  } catch {
    // ignore
  }
}

/**
 * Hand over the initialised SDK and flush the queue in order, each item with its
 * ORIGINAL timestamp (PostHog's `capture(..., { timestamp })`) and the URL it
 * happened on. The page the player is on NOW is skipped: the SDK fires its own
 * initial `$pageview` for it a tick after init, exactly as before the lazy load.
 */
export function connectAnalytics(client: AnalyticsSink): void {
  if (sink) return;
  const pending = queue;
  queue = [];
  sink = client;
  let lastPageview = -1;
  for (let i = pending.length - 1; i >= 0; i--) {
    if (pending[i].kind === "pageview") {
      lastPageview = i;
      break;
    }
  }
  const currentPath = typeof window !== "undefined" ? window.location.pathname : null;
  pending.forEach((q, i) => {
    try {
      if (q.kind === "pageview") {
        if (i === lastPageview && q.pathname === currentPath) return; // covered by the SDK's initial $pageview
        client.capture("$pageview", { $current_url: q.url, $pathname: q.pathname }, { timestamp: q.at });
      } else {
        client.capture(q.name, { ...q.props, $current_url: q.url, $pathname: q.pathname }, { timestamp: q.at });
      }
    } catch {
      // keep flushing the rest
    }
  });
}

/** The SDK could not be loaded/initialised: drop the queue and stop queueing. */
export function disableAnalytics(): void {
  disabled = true;
  queue = [];
}
