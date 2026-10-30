/**
 * Game-event analytics (OBS-01) — the typed catalogue of
 * `docs/ANALYTICS-EVENTS-2.0.md`, sent to PostHog product analytics for
 * funnels / retention / breakdowns (bootstrapped in
 * `src/components/PostHogProvider.tsx`). DESIGN-DECISIONS #145.
 *
 * PRODUCTION ONLY — a hard guard, not only a missing key (Miguel, 29/10: no
 * analytics on staging or playtest for now). `analyticsAllowed()` needs BOTH
 * the production build (`analyticsEnvironment()`: NODE_ENV production, no
 * NEXT_PUBLIC_PLAYTEST, no NEXT_PUBLIC_NOINDEX) AND the production host
 * (`rocketdraft.app`). Anywhere else — staging.rocketdraft.app,
 * playtest.rocketdraft.app, a local preview, dev, tests — `trackEvent` drops
 * the event, nothing is queued, `connectAnalytics` refuses the SDK and the
 * provider never downloads it, even when a PostHog key was set by mistake.
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
 *  - Calling these is always safe and never blocks or breaks gameplay.
 *  - Property values are scalars (string | number | boolean | null); the
 *    payload is flattened here and anything else is dropped.
 *  - No PII and no free text: never a manager / org name or abbreviation, an
 *    e-mail, a username or a raw save. Ids are random and anonymous.
 *  - Fired from the STORE, once, at the action that wrote the state (the same
 *    moment the save is written). NEVER from `src/engine` (pure, AGENTS.md
 *    hard rule) and never from a render.
 *  - Every event carries the common properties (`CommonProps`).
 *  - An event with an `actionId` is sent at most once per session (a ring of
 *    recent ids): the career events and the UX / quality events carry one.
 */

import { BALANCE_VERSION } from "@/config/balance";
import { SITE } from "@/config/site";

// ---------------------------------------------------------------------------
// Environment and the production-only guard
// ---------------------------------------------------------------------------

export type AnalyticsEnvironment = "production" | "staging" | "playtest" | "dev";

/**
 * The build's environment. Next inlines these at build time: `next build`
 * runs with NODE_ENV=production; the staging Worker builds with
 * NEXT_PUBLIC_NOINDEX=1 and the playtest Worker with NEXT_PUBLIC_PLAYTEST=1
 * (docs/DEPLOY-CLOUDFLARE.md §5). Dev and tests read as "dev".
 */
export function analyticsEnvironment(): AnalyticsEnvironment {
  if (process.env.NODE_ENV !== "production") return "dev";
  if (process.env.NEXT_PUBLIC_PLAYTEST === "1") return "playtest";
  if (process.env.NEXT_PUBLIC_NOINDEX === "1") return "staging";
  return "production";
}

/** The only host that may send events (the apex; `www` redirects to it). */
export const ANALYTICS_HOST = SITE.domain;

/** True only in a production build running on rocketdraft.app. */
export function analyticsAllowed(): boolean {
  try {
    if (analyticsEnvironment() !== "production") return false;
    if (typeof window === "undefined") return false;
    return window.location?.hostname === ANALYTICS_HOST;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Common properties
// ---------------------------------------------------------------------------

/** Bumped when an event's shape changes (keeps old and new payloads apart). */
export const ANALYTICS_SCHEMA_VERSION = 1;

export type AnalyticsLocale = "en" | "pt";
export type GameMode = "draft" | "career";

/** Sent with every event. */
export interface CommonProps {
  /** `SITE.version`, kept equal to package.json's by `analytics.test.ts`. */
  release: string;
  /** `BALANCE_VERSION` (balance.ts, hand-bumped by every tuning commit). */
  balanceVersion: number;
  schemaVersion: number;
  environment: AnalyticsEnvironment;
  locale: AnalyticsLocale;
  gameMode: GameMode;
}

let localeSource: () => string = () => "en";

/** The settings store registers the UI language here (no store import, so
 *  this module stays importable before `window` exists in tests). */
export function setAnalyticsLocaleSource(read: () => string): void {
  localeSource = read;
}

function currentLocale(): AnalyticsLocale {
  try {
    return localeSource() === "pt" ? "pt" : "en";
  } catch {
    return "en";
  }
}

// ---------------------------------------------------------------------------
// The catalogue (docs/ANALYTICS-EVENTS-2.0.md — built, provisional until
// Miguel approves). Add an event by adding a key to one of the groups.
// ---------------------------------------------------------------------------

/** The Draft game (`gameMode: "draft"`). */
export interface DraftEvents {
  /** A run was created (classic / quick / daily / challenge). */
  run_started: {
    runId: string;
    mode: string;
    difficulty: string;
    hiddenOverall: boolean;
    /** Region lock, "worldwide", "daily", or a challenge's constraint region. */
    region: string;
  };
  /** The draft was confirmed and the tournament (or the challenge Bo7) began. */
  tournament_started: {
    runId: string;
    mode: string;
    difficulty: string;
    region: string;
  };
  /** A run reached its results screen — the key outcome/win-rate event. */
  run_completed: {
    runId: string;
    mode: string;
    difficulty: string;
    region: string;
    placement: string;
    won: boolean;
    hiddenOverall: boolean;
    teamOverall: number;
    swissWins: number;
    swissLosses: number;
    xpGained: number;
    chemistryTier: string;
    chemistryPercent: number;
    /** Wall clock from run creation (a resumed run counts its pause too). */
    durationSec: number | null;
    /** The daily's template id (`DailyInfo.templateId`), null outside dailies. */
    dailyTemplate: string | null;
  };
  /** A run was left before its results screen. `reason`: quit / restart. */
  run_abandoned: {
    runId: string;
    mode: string;
    difficulty: string;
    phase: string;
    reason: string;
    hiddenOverall: boolean;
    region: string;
  };
  /** One per special card on the final roster when the tournament starts. */
  special_used: {
    specialId: string;
    title: string;
    rarity: string;
    mode: string;
    difficulty: string;
    /** Not owned before this run started (COL-02a). */
    isNew: boolean;
  };
  /** A challenge's Bo7 (or gauntlet) was played. `stars`: earned this play, 0–3. */
  challenge_played: {
    challengeId: string;
    difficulty: string;
    cleared: boolean;
    stars: number;
  };
  /** A special card entered the collection — once per card, ever. */
  special_discovered: {
    specialId: string;
    rarity: string;
    national: boolean;
    /** The run mode it was found in (classic / quick / daily / challenge). */
    mode: string;
  };
}

export type CareerMilestoneKind =
  | "first_title"
  | "first_major"
  | "first_worlds"
  | "worlds_title"
  | "backer"
  | "bank_loan"
  | "insolvency";

/**
 * Road to Worlds (`gameMode: "career"`). `careerId` is the random id stored in
 * the save at creation; `actionId` = careerId:seasonIndex:day:kind:ref.
 */
export interface CareerEvents {
  career_created: {
    careerId: string;
    actionId: string;
    region: string;
    difficulty: string;
    rosterKey: string;
  };
  /** A result the user played was banked (any tier, watched or simulated). */
  career_event_completed: {
    careerId: string;
    actionId: string;
    seasonIndex: number;
    tier: string;
    /** The event's region; "international" for Majors and Worlds. */
    eventRegion: string;
    placement: string;
    /** Qualifier only: through to Sunday's regional. Null for other tiers. */
    qualified: boolean | null;
    watched: boolean;
    /** Regional weeks (qualifier / regional): seeded into the direct 8. */
    seedingDirect: boolean | null;
  };
  career_milestone: {
    careerId: string;
    actionId: string;
    seasonIndex: number;
    kind: CareerMilestoneKind;
  };
  /** The Monday that closes a split (weeks 11 / 21 / 31). Money is for the split. */
  career_split_summary: {
    careerId: string;
    actionId: string;
    seasonIndex: number;
    split: number;
    balance: number;
    /** The wage bill per split at the boundary (squad + coach). */
    payrollPerSplit: number;
    incomePrize: number;
    incomeSponsor: number;
    incomeFanbase: number;
    incomeTransfers: number;
    debtBacker: number;
    debtBank: number;
    /** The user's place on the split's Major table (null = no row). */
    splitRank: number | null;
    /** False when the ledger ring buffer had already dropped lines of this split. */
    ledgerComplete: boolean;
  };
  /** The season review was written (Worlds resolved). */
  career_season_completed: {
    careerId: string;
    actionId: string;
    seasonIndex: number;
    regionRank: number;
    seasonPoints: number;
    majorsQualified: number;
    worldsPlacement: string | null;
    grade: string;
    balance: number;
    rep: number;
  };
  career_transfer: {
    careerId: string;
    actionId: string;
    seasonIndex: number;
    kind: "sign" | "sell" | "release" | "renew";
    overall: number;
    age: number;
    /** Midpoint of the band the screens show (never the hidden potential). */
    potentialBandMid: number;
    /** Sign: the transfer fee · sell: the bid · release: the severance · renew: 0. */
    fee: number;
    salaryPerSplit: number;
    role: string;
  };
  career_staff: {
    careerId: string;
    actionId: string;
    seasonIndex: number;
    kind: "coach_hired" | "coach_fired" | "sponsor_signed";
    /** Coach. */
    overall?: number;
    salaryPerSplit?: number;
    /** Sponsor. */
    tier?: number;
    basePerSplit?: number;
    objectiveKind?: string;
    /** rc.34 (ECO-04): the deal's profile (steady / balanced / bold); absent for a deal from before rc.34. */
    profile?: string;
  };
  career_scout_report: {
    careerId: string;
    actionId: string;
    seasonIndex: number;
    level: number;
    age: number;
    /** Bucketed headroom of the band the report shows ("0", "1-2", "3-5", "6-9", "10+"). */
    headroomBand: string;
  };
  /** RESERVED — DEV-03 (training as a period package) is not built yet. */
  career_training_plan: {
    careerId: string;
    actionId: string;
    seasonIndex: number;
    objective: string;
    focus: string;
    scrimLevel: string;
    delegated: boolean;
    gainSummary: number;
  };
}

/** Persisted stores, for the quality events. */
export type PersistedStoreId = "settings" | "profile" | "run" | "career";

/** UX and quality — both modes; each carries its own `gameMode`. */
export interface SharedEvents {
  /** An unlock was looked at: a cosmetic in the locker, a toolbox unlock mail. */
  ux_unlock_seen: {
    gameMode: GameMode;
    actionId: string;
    /** "challenge" is reserved: challenges have no seen marker yet. */
    kind: "toolbox" | "cosmetic" | "challenge";
    id: string;
  };
  /** A contract-expiry warning was read, or the expiring contract was settled. */
  ux_contract_warning: {
    gameMode: "career";
    careerId: string;
    actionId: string;
    outcome: "seen" | "renewed" | "released" | "let_go";
  };
  /** rc.36 (SUN-01): Sunday started from HQ, with the coach briefing it was started with (keep = none picked). */
  ux_sunday_briefing: {
    gameMode: "career";
    careerId: string;
    actionId: string;
    choice: "keep" | "recover" | "prepare";
  };
  /** A tutorial / explainer closed for good (single-step explainers count as completed). */
  ux_tutorial: {
    gameMode: GameMode;
    actionId: string;
    id: string;
    step: number;
    outcome: "completed" | "skipped";
  };
  /** A persisted store failed to save or load ("write" = a non-quota write error). */
  quality_save_error: {
    gameMode: GameMode;
    /** save_error:store:kind — one report per store and kind per session. */
    actionId: string;
    store: PersistedStoreId;
    kind: "quota" | "parse" | "migrate" | "write";
  };
  /** A save was upgraded to a newer shape (persist version or career saveVersion). */
  quality_migration: {
    gameMode: GameMode;
    actionId: string;
    store: PersistedStoreId;
    fromVersion: number;
    toVersion: number;
  };
  /** A grant was refused because it had already been given. */
  quality_duplicate_reward: {
    gameMode: GameMode;
    actionId: string;
    kind: string;
    id: string;
  };
}

/** The full custom-event catalogue. */
export type GameEvents = DraftEvents & CareerEvents & SharedEvents;
export type GameEventName = keyof GameEvents;

/** One event, ready to send (the career store builds lists of these). */
export type TrackedEvent = { [K in GameEventName]: { name: K; props: GameEvents[K] } }[GameEventName];

type Scalar = string | number | boolean | null;
type Props = Record<string, Scalar>;

// ---------------------------------------------------------------------------
// Sink, queue and the session ring
// ---------------------------------------------------------------------------

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

/** Recent `actionId`s already sent this session (dedupe ring). Not a gameplay value. */
export const ANALYTICS_RECENT_IDS_LIMIT = 256;

/** Longest string sent as a property (ids and labels only; no free text). */
const MAX_STRING = 120;

let sink: AnalyticsSink | null = null;
/** Flipped when the SDK fails to load. */
let disabled = false;
let queue: Queued[] = [];
let recentIds: string[] = [];

function keyConfigured(): boolean {
  return !!process.env.NEXT_PUBLIC_POSTHOG_KEY;
}

function canQueue(): boolean {
  return !sink && !disabled && keyConfigured() && analyticsAllowed();
}

function enqueue(item: Queued): void {
  if (queue.length >= ANALYTICS_QUEUE_LIMIT) return;
  queue.push(item);
}

function toScalar(value: unknown): Scalar | undefined {
  if (value === null) return null;
  switch (typeof value) {
    case "string":
      return value.length > MAX_STRING ? value.slice(0, MAX_STRING) : value;
    case "number":
      return Number.isFinite(value) ? value : null;
    case "boolean":
      return value;
    default:
      return undefined; // undefined, objects, arrays, functions: never sent
  }
}

function gameModeOf(name: string, props: Record<string, unknown>): GameMode {
  if (name.startsWith("career_")) return "career";
  return props.gameMode === "career" ? "career" : "draft";
}

/** The event's scalars plus the common properties (common props win). */
export function analyticsPayload<K extends GameEventName>(name: K, props: GameEvents[K]): Props {
  const source = props as unknown as Record<string, unknown>;
  const out: Props = {};
  for (const [key, value] of Object.entries(source)) {
    const scalar = toScalar(value);
    if (scalar !== undefined) out[key] = scalar;
  }
  const common: CommonProps = {
    release: SITE.version,
    balanceVersion: BALANCE_VERSION,
    schemaVersion: ANALYTICS_SCHEMA_VERSION,
    environment: analyticsEnvironment(),
    locale: currentLocale(),
    gameMode: gameModeOf(name, source),
  };
  return { ...out, ...common };
}

/** True when this actionId already went out this session (and records it otherwise). */
function alreadySent(actionId: Scalar | undefined): boolean {
  if (typeof actionId !== "string" || actionId === "") return false;
  if (recentIds.includes(actionId)) return true;
  recentIds.push(actionId);
  if (recentIds.length > ANALYTICS_RECENT_IDS_LIMIT) recentIds = recentIds.slice(-ANALYTICS_RECENT_IDS_LIMIT);
  return false;
}

export function trackEvent<K extends GameEventName>(name: K, props: GameEvents[K]): void {
  // Guarded so analytics never breaks the game.
  try {
    if (!analyticsAllowed()) return; // production build on rocketdraft.app only
    if (!sink && !canQueue()) return;
    const payload = analyticsPayload(name, props);
    if (alreadySent(payload.actionId)) return;
    if (sink) {
      sink.capture(name, payload);
      return;
    }
    const { href, pathname } = window.location;
    enqueue({ kind: "event", name, props: payload, at: new Date(), url: href, pathname });
  } catch {
    // analytics must never throw into gameplay
  }
}

/** Send a batch built by a store (the career write's events), in order. */
export function trackEvents(events: readonly TrackedEvent[]): void {
  for (const e of events) trackEvent(e.name, e.props as never);
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
 * Refused outside production on rocketdraft.app (the hard guard).
 */
export function connectAnalytics(client: AnalyticsSink): void {
  if (sink || !analyticsAllowed()) return;
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

/** A random anonymous id (careerId). Never derived from anything the player typed. */
export function anonymousId(prefix: string): string {
  const bytes = new Uint8Array(8);
  try {
    globalThis.crypto.getRandomValues(bytes);
  } catch {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return prefix + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** TEST SUPPORT: forget the sink, the queue and the session ring. Never called by the app. */
export function resetAnalyticsForTests(): void {
  sink = null;
  disabled = false;
  queue = [];
  recentIds = [];
}
