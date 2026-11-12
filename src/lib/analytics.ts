/**
 * Game-event analytics — the 2.0 catalogue of `docs/ANALYTICS-EVENTS-2.0.md`
 * (`analyticsCatalog.ts`), sent to PostHog product analytics for funnels,
 * retention and balance (bootstrapped in `src/components/PostHogProvider.tsx`).
 * DESIGN-DECISIONS #145.
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
 * `connectAnalytics`. Until then events and pageviews are QUEUED (bounded) with
 * their original timestamp and URL, and flushed in order once the SDK is ready.
 *
 * Budget (2.0, `analyticsBudget.ts`): PostHog bills per event. Three things keep
 * the volume down without losing the picture:
 *  - the catalogue itself (one event per run, per tournament, per season);
 *  - `$pageview` once per route per session (sent from here, not by the SDK);
 *  - the guard: sampling and a per-device daily cap that only switch on above a
 *    configured number of players per day, plus an always-on circuit breaker.
 * Every event carries `sampleWeight` (how many real events it stands for) and
 * `sampleBucket` (the device's fixed 0–99 bucket).
 *
 * Device state: a small record in localStorage (`rd-analytics:v1`, production
 * host only) — the sample bucket, session and day counters, the once-per-device
 * funnel steps, today's budget counters, the reset counter of the open run and
 * the career tab counters. It is NOT a save: nothing the game reads, nothing
 * personal, safe to delete at any time.
 *
 * Rules:
 *  - Calling these is always safe and never blocks or breaks gameplay.
 *  - An event must be in the catalogue with its required properties: under
 *    Vitest a payload that is not THROWS (so the test fails); in a dev build it
 *    logs; in production an unknown event is dropped.
 *  - Property values are scalars (string | number | boolean | null); the
 *    payload is flattened here and anything else is dropped.
 *  - No PII and no free text: never a manager / org name or abbreviation, an
 *    e-mail, a username or a raw save. Ids are random and anonymous.
 *  - Fired from the STORE, once, at the action that wrote the state. NEVER from
 *    `src/engine` (pure, AGENTS.md hard rule) and never from a render.
 *  - An event with an `actionId` is sent at most once per session (a ring of
 *    recent ids).
 */

import { BALANCE_VERSION } from "@/config/balance";
import { SEASON } from "@/config/season";
import { SITE } from "@/config/site";
import {
  budgetLevelOf,
  decideBudget,
  defaultBudget,
  freshBudgetDay,
  parseBudgetConfig,
  type BudgetConfig,
  type BudgetDay,
} from "./analyticsBudget";
import {
  CAREER_TABS,
  catalogProblems,
  EVENT_CATALOG,
  isCatalogEvent,
  type GameEventName,
  type GameEvents,
  type OnboardingStep,
  type TrackedEvent,
} from "./analyticsCatalog";

export type { GameEventName, GameEvents, OnboardingStep, TrackedEvent } from "./analyticsCatalog";

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

/**
 * Bumped when the catalogue's shape changes. 2 = the 2.0 launch catalogue.
 * Pre-season production (v1.x) sent no common properties at all, so "schemaVersion
 * is set" (or `season`, or `release`) separates the 2.0 data from the old series.
 */
export const ANALYTICS_SCHEMA_VERSION = 2;

export type AnalyticsLocale = "en" | "pt";
/** "app" = neither mode: sessions, the entry funnel, accounts, screen errors, pageviews. */
export type GameMode = "draft" | "career" | "app";

/** Kinds of `career_milestone` (the catalogue types the property as a string). */
export type CareerMilestoneKind = "first_title" | "first_major" | "first_worlds" | "worlds_title" | "backer" | "bank_loan";

/** Persisted stores, for the quality events. */
export type PersistedStoreId = "settings" | "profile" | "run" | "career";

/** Sent with every event (and with `$pageview`). */
export interface CommonProps {
  /** `SITE.version`, kept equal to package.json's by `analytics.test.ts`. */
  release: string;
  /** `BALANCE_VERSION` (balance.ts, hand-bumped by every tuning commit). */
  balanceVersion: number;
  schemaVersion: number;
  /** The profile season in force (`SEASON.id`): 1 = Season 1, the 2.0 launch. */
  season: number;
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

function commonProps(gameMode: GameMode): CommonProps {
  return {
    release: SITE.version,
    balanceVersion: BALANCE_VERSION,
    schemaVersion: ANALYTICS_SCHEMA_VERSION,
    season: SEASON.id,
    environment: analyticsEnvironment(),
    locale: currentLocale(),
    gameMode,
  };
}

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
interface Queued {
  name: string;
  props: Props;
  at: Date;
  url: string;
  pathname: string;
}

/** Hard cap on what waits for the SDK. A normal visit queues a handful of items
 *  in the few seconds before load + idle; the cap only bounds memory if the SDK
 *  never arrives. Once full, later items are dropped (earliest context kept). */
export const ANALYTICS_QUEUE_LIMIT = 50;

/** Recent `actionId`s already sent this session (dedupe ring). Not a gameplay value. */
export const ANALYTICS_RECENT_IDS_LIMIT = 256;

/** A session ends after this long without an event or a page change (PostHog's own rule). */
export const ANALYTICS_SESSION_IDLE_MS = 30 * 60 * 1000;

/** Screen errors reported per page load, at most. */
export const ANALYTICS_ERRORS_PER_SESSION = 3;

/** A career advance slower than this is reported (`quality_slow_advance`) and counted as slow. */
export const ANALYTICS_SLOW_ADVANCE_MS = { day: 1500, stop: 5000 } as const;

/** Longest string sent as a property (ids, enums and id lists only; no free text). */
const MAX_STRING = 320;

let sink: AnalyticsSink | null = null;
/** Flipped when the SDK fails to load. */
let disabled = false;
let queue: Queued[] = [];
let recentIds: string[] = [];
let budget: BudgetConfig = defaultBudget();

function keyConfigured(): boolean {
  return !!process.env.NEXT_PUBLIC_POSTHOG_KEY;
}

function canQueue(): boolean {
  return !sink && !disabled && keyConfigured() && analyticsAllowed();
}

/** Allowed, and there is somewhere for an event to go (the SDK or its queue). */
function ready(): boolean {
  return analyticsAllowed() && (!!sink || canQueue());
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

function gameModeOf(name: GameEventName, props: Record<string, unknown>): GameMode {
  const mode = EVENT_CATALOG[name].mode;
  if (mode !== "shared") return mode;
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
  return { ...out, ...commonProps(gameModeOf(name, source)) };
}

/** True when this actionId already went out this session (and records it otherwise). */
function alreadySent(actionId: Scalar | undefined): boolean {
  if (typeof actionId !== "string" || actionId === "") return false;
  if (recentIds.includes(actionId)) return true;
  recentIds.push(actionId);
  if (recentIds.length > ANALYTICS_RECENT_IDS_LIMIT) recentIds = recentIds.slice(-ANALYTICS_RECENT_IDS_LIMIT);
  return false;
}

/**
 * The catalogue check. Under Vitest a payload outside the catalogue THROWS, so
 * any test that drives a store action with a bad event fails; a dev build logs
 * it; a production build skips the check (the types already enforce the shape).
 */
function checkCatalog(name: string, props: unknown): void {
  // `typeof process`: a browser bundle may have no `process` object at all.
  const underVitest = typeof process !== "undefined" && !!process.env?.VITEST;
  if (process.env.NODE_ENV === "production" && !underVitest) return;
  const problems = catalogProblems(name, (props ?? {}) as Record<string, unknown>);
  if (problems.length === 0) return;
  const message = `[analytics] ${problems.join("; ")}`;
  if (underVitest) throw new Error(message);
  console.error(message);
}

// ---------------------------------------------------------------------------
// Device state (localStorage on the production host; memory elsewhere)
// ---------------------------------------------------------------------------

const DEVICE_KEY = "rd-analytics:v1";

interface DeviceState {
  v: 1;
  /** Fixed 0–99 sample bucket (random, not derived from anything). */
  bucket: number;
  firstSeen: number;
  /** Distinct UTC days with a session. */
  days: number;
  lastDay: string;
  sessions: number;
  lastActive: number;
  /** The profile already had progress when this record was created; null = not decided yet. */
  existing: boolean | null;
  /** Entry-funnel steps already sent (or already true before 2.0). */
  steps: Record<string, true>;
  day: BudgetDay;
  /** Restarts of the open run (`run_completed.resets`). */
  resets: number;
  /** Career tab visits since the last career event. */
  tabs: Record<string, number>;
}

let device: DeviceState | null = null;

function utcDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function daysBetween(fromDay: string, toDay: string): number {
  const ms = Date.parse(`${toDay}T00:00:00Z`) - Date.parse(`${fromDay}T00:00:00Z`);
  return Number.isFinite(ms) ? Math.max(0, Math.round(ms / 86_400_000)) : 0;
}

function randomBucket(): number {
  try {
    const bytes = new Uint8Array(2);
    globalThis.crypto.getRandomValues(bytes);
    return ((bytes[0] << 8) | bytes[1]) % 100;
  } catch {
    return Math.floor(Math.random() * 100);
  }
}

/** Only the production host keeps the record; everywhere else it lives in memory. */
function deviceStorage(): Storage | null {
  try {
    return analyticsAllowed() ? (window.localStorage ?? null) : null;
  } catch {
    return null;
  }
}

function freshDevice(now: number): DeviceState {
  return {
    v: 1,
    bucket: randomBucket(),
    firstSeen: now,
    days: 0,
    lastDay: "",
    sessions: 0,
    lastActive: 0,
    existing: null,
    steps: {},
    day: freshBudgetDay(utcDay(now)),
    resets: 0,
    tabs: {},
  };
}

const num = (value: unknown, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : fallback;

function reviveDevice(raw: unknown, now: number): DeviceState | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (r.v !== 1) return null;
  const base = freshDevice(now);
  const day = (r.day ?? {}) as Record<string, unknown>;
  const counts = (source: unknown): Record<string, number> => {
    const out: Record<string, number> = {};
    if (source && typeof source === "object") {
      for (const [key, value] of Object.entries(source as Record<string, unknown>)) {
        if (typeof value === "number" && value > 0) out[key] = value;
      }
    }
    return out;
  };
  const steps: Record<string, true> = {};
  if (r.steps && typeof r.steps === "object") for (const key of Object.keys(r.steps)) steps[key] = true;
  return {
    v: 1,
    bucket: Math.min(99, Math.floor(num(r.bucket, base.bucket))),
    firstSeen: num(r.firstSeen, now),
    days: num(r.days, 0),
    lastDay: typeof r.lastDay === "string" ? r.lastDay : "",
    sessions: num(r.sessions, 0),
    lastActive: num(r.lastActive, 0),
    existing: typeof r.existing === "boolean" ? r.existing : null,
    steps,
    day: {
      key: typeof day.key === "string" ? day.key : base.day.key,
      sent: num(day.sent, 0),
      standard: num(day.standard, 0),
      ...(day.capNoted === true ? { capNoted: true } : {}),
      ...(day.breakerNoted === true ? { breakerNoted: true } : {}),
    },
    resets: num(r.resets, 0),
    tabs: counts(r.tabs),
  };
}

function getDevice(): DeviceState {
  if (device) return device;
  const now = Date.now();
  let loaded: DeviceState | null = null;
  try {
    const raw = deviceStorage()?.getItem(DEVICE_KEY);
    if (raw) loaded = reviveDevice(JSON.parse(raw), now);
  } catch {
    // unreadable: start over (it is not a save)
  }
  device = loaded ?? freshDevice(now);
  return device;
}

function saveDevice(): void {
  if (!device) return;
  try {
    deviceStorage()?.setItem(DEVICE_KEY, JSON.stringify(device));
  } catch {
    // quota / private mode: the record stays in memory for this page load
  }
}

function todayOf(d: DeviceState, now: number): BudgetDay {
  const key = utcDay(now);
  if (d.day.key !== key) d.day = freshBudgetDay(key);
  return d.day;
}

// ---------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------

function capture(name: string, props: Record<string, unknown>, at?: Date): void {
  try {
    if (at) sink?.capture(name, props, { timestamp: at });
    else sink?.capture(name, props);
  } catch {
    // a failing SDK must never reach gameplay
  }
}

/** The budget decision, then the SDK. `queued` = an item replayed from the pre-SDK queue. */
function dispatch(name: string, payload: Props, queued?: Queued): void {
  const d = getDevice();
  const day = todayOf(d, Date.now());
  const priority = isCatalogEvent(name) ? EVENT_CATALOG[name].priority : "standard";
  const decision = decideBudget(budget, name, priority, d.bucket, day);
  if (decision.note) {
    capture("quality_event_cap", {
      ...analyticsPayload("quality_event_cap", { kind: decision.note, level: budgetLevelOf(budget).index }),
      sampleWeight: 1,
      sampleBucket: d.bucket,
    });
  }
  if (!decision.send) return;
  const props: Record<string, unknown> = { ...payload, sampleWeight: decision.weight, sampleBucket: d.bucket };
  if (queued) {
    props.$current_url = queued.url;
    props.$pathname = queued.pathname;
    capture(name, props, queued.at);
  } else {
    capture(name, props);
  }
}

/** To the SDK when it is up, else to the bounded queue with its time and URL. */
function deliver(name: string, payload: Props, now: number): void {
  if (sink) {
    dispatch(name, payload);
    return;
  }
  if (queue.length >= ANALYTICS_QUEUE_LIMIT) return;
  const { href, pathname } = window.location;
  queue.push({ name, props: payload, at: new Date(now), url: href, pathname });
}

function emit<K extends GameEventName>(name: K, props: GameEvents[K], now: number): void {
  const payload = analyticsPayload(name, props);
  if (alreadySent(payload.actionId)) return;
  deliver(name, payload, now);
}

// ---------------------------------------------------------------------------
// Sessions and the entry funnel
// ---------------------------------------------------------------------------

/** Snapshot properties for `session_started`, provided by the stores that hold them. */
export type SessionProps = Partial<GameEvents["session_started"]>;

const sessionSources: (() => SessionProps)[] = [];

/** A store registers the part of the player's snapshot it owns (profile, account, open run). */
export function registerSessionProps(read: () => SessionProps): void {
  sessionSources.push(read);
}

/** What the profile says about a player this device has not counted yet. */
export interface PlayerHistory {
  /** The profile already holds progress (a pre-2.0 player, or a cloud profile). */
  existing: boolean;
  /** Funnel steps that are already true for this profile. */
  doneSteps: readonly OnboardingStep[];
}

let historySource: (() => PlayerHistory) | null = null;

export function setAnalyticsHistorySource(read: () => PlayerHistory): void {
  historySource = read;
}

/** Decide once whether this device's player predates the record (so funnels can exclude them). */
function resolveExisting(d: DeviceState): void {
  if (d.existing !== null || !historySource) return;
  try {
    const history = historySource();
    d.existing = history.existing;
    if (history.existing) for (const step of history.doneSteps) d.steps[step] = true;
  } catch {
    // decided on a later session
  }
}

/** Routes seen this session (`$pageview` goes out once per route per session). */
let seenPaths = new Set<string>();

function normalizePath(pathname: string): string {
  const path = pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  return path || "/";
}

function currentPath(): string {
  try {
    return normalizePath(window.location.pathname ?? "/");
  } catch {
    return "/";
  }
}

function snapshot(): SessionProps {
  const out: SessionProps = {};
  for (const read of sessionSources) {
    try {
      Object.assign(out, read());
    } catch {
      // a store that is not ready contributes nothing
    }
  }
  return out;
}

/** Starts a session when there is none or the last activity is over 30 minutes old. */
function touchSession(now: number): void {
  const d = getDevice();
  todayOf(d, now);
  const starts = d.sessions === 0 || now - d.lastActive > ANALYTICS_SESSION_IDLE_MS;
  d.lastActive = now;
  if (!starts) return;
  resolveExisting(d);
  const today = utcDay(now);
  const daysSinceLast = d.lastDay ? daysBetween(d.lastDay, today) : null;
  d.sessions += 1;
  if (d.lastDay !== today) {
    d.days += 1;
    d.lastDay = today;
  }
  seenPaths = new Set();
  emit(
    "session_started",
    {
      ...snapshot(),
      sessionNumber: d.sessions,
      dayNumber: d.days,
      daysSinceFirst: Math.floor(Math.max(0, now - d.firstSeen) / 86_400_000),
      daysSinceLast,
      existingPlayer: d.existing,
      entryPath: currentPath(),
    },
    now,
  );
}

export function trackEvent<K extends GameEventName>(name: K, props: GameEvents[K]): void {
  checkCatalog(name, props);
  // Guarded so analytics never breaks the game.
  try {
    if (!ready() || !isCatalogEvent(name)) return; // production build on rocketdraft.app only
    const now = Date.now();
    touchSession(now);
    emit(name, props, now);
    saveDevice();
  } catch {
    // analytics must never throw into gameplay
  }
}

/** Send a batch built by a store (the career write's events), in order. */
export function trackEvents(events: readonly TrackedEvent[]): void {
  for (const e of events) trackEvent(e.name, e.props as never);
}

/**
 * A first on this device (`onboarding_step`): sent once, ever. A player whose
 * profile already had the step done before 2.0 never sends it.
 */
export function trackOnboardingStep(step: OnboardingStep): void {
  try {
    if (!ready()) return;
    const now = Date.now();
    touchSession(now);
    const d = getDevice();
    resolveExisting(d);
    if (d.steps[step]) return;
    d.steps[step] = true;
    emit(
      "onboarding_step",
      {
        step,
        sessionNumber: d.sessions,
        dayNumber: d.days,
        secondsSinceFirstSeen: Math.round(Math.max(0, now - d.firstSeen) / 1000),
      },
      now,
    );
    saveDevice();
  } catch {
    // never into gameplay
  }
}

// ---------------------------------------------------------------------------
// Pageviews and career tabs
// ---------------------------------------------------------------------------

function careerTabOf(path: string): string | null {
  if (path === "/career") return "hq";
  if (!path.startsWith("/career/")) return null;
  const key = path.slice("/career/".length);
  return (CAREER_TABS as readonly string[]).includes(key) ? key : null;
}

/**
 * Called by the provider on every pathname change. Sends `$pageview` for the
 * FIRST visit to each route in a session (the SDK's own pageview capture is
 * off), and counts career tab visits — every visit, as counters that ride on
 * the next `career_event_completed`, never as events.
 */
export function notePageview(): void {
  try {
    if (typeof window === "undefined") return;
    const path = currentPath();
    const tab = careerTabOf(path);
    if (tab) {
      const d = getDevice();
      d.tabs[tab] = (d.tabs[tab] ?? 0) + 1;
    }
    if (!ready()) return;
    const now = Date.now();
    touchSession(now);
    if (!seenPaths.has(path)) {
      seenPaths.add(path);
      deliver("$pageview", { ...commonProps("app") }, now);
    }
    saveDevice();
  } catch {
    // ignore
  }
}

let advance = { count: 0, maxMs: 0, slow: 0 };

/** The career store reports how long a day advance ("day") or an advance-to-next-stop ("stop") took. */
export function noteCareerAdvance(kind: "day" | "stop", ms: number): void {
  try {
    if (!Number.isFinite(ms) || ms < 0) return;
    const rounded = Math.round(ms);
    advance.count += 1;
    advance.maxMs = Math.max(advance.maxMs, rounded);
    if (rounded < ANALYTICS_SLOW_ADVANCE_MS[kind]) return;
    advance.slow += 1;
    trackEvent("quality_slow_advance", { actionId: `slow_advance:${kind}`, kind, ms: rounded });
  } catch {
    // never into gameplay
  }
}

/** The tab and advance counters since the last career event, for `career_event_completed`; resets them. */
export function takeCareerActivity(): Partial<GameEvents["career_event_completed"]> {
  const out: Record<string, number> = {};
  try {
    const d = getDevice();
    for (const tab of CAREER_TABS) {
      const visits = d.tabs[tab];
      if (visits) out[`tab_${tab}`] = visits;
    }
    d.tabs = {};
    if (advance.count > 0) {
      out.advanceCount = advance.count;
      out.advanceMaxMs = advance.maxMs;
      out.advanceSlowCount = advance.slow;
    }
    advance = { count: 0, maxMs: 0, slow: 0 };
    saveDevice();
  } catch {
    // counters are best effort
  }
  return out as Partial<GameEvents["career_event_completed"]>;
}

// ---------------------------------------------------------------------------
// Draft: the reset counter of the open run
// ---------------------------------------------------------------------------

/** A run was restarted before its results (a reset): counted, not sent. */
export function noteRunReset(): void {
  try {
    getDevice().resets += 1;
    saveDevice();
  } catch {
    // best effort
  }
}

/** Resets since the last finished or abandoned run; clears the counter. */
export function takeRunResets(): number {
  try {
    const d = getDevice();
    const resets = d.resets;
    d.resets = 0;
    saveDevice();
    return resets;
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Screen errors
// ---------------------------------------------------------------------------

/** Signatures of the errors reported this page load (the same error counts once). */
let reportedErrors = new Set<string>();

/** No quoted text (a parse error quotes the data it choked on), no URLs, no long numbers. */
export function sanitizeErrorMessage(message: string): string {
  return message
    .replace(/https?:\/\/\S+/g, "<url>")
    .replace(/"[^"]*"|'[^']*'|`[^`]*`/g, "<text>")
    .replace(/\d{5,}/g, "<n>")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function shortHash(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) >>> 0;
  return h.toString(16);
}

/** `quality_error`: an error boundary, an uncaught error or an unhandled rejection. */
export function reportScreenError(source: "boundary" | "window" | "promise", error: unknown): void {
  try {
    if (reportedErrors.size >= ANALYTICS_ERRORS_PER_SESSION || !ready()) return;
    const e = (error ?? {}) as { name?: unknown; message?: unknown };
    const name = typeof e.name === "string" && e.name ? e.name.slice(0, 40) : "Error";
    const message = sanitizeErrorMessage(typeof e.message === "string" ? e.message : String(error ?? ""));
    const route = currentPath();
    const signature = `error:${name}:${shortHash(message)}:${route}`;
    if (reportedErrors.has(signature)) return;
    reportedErrors.add(signature);
    trackEvent("quality_error", {
      actionId: signature,
      source,
      name,
      route,
      message,
    });
  } catch {
    // an error reporter must not throw
  }
}

// ---------------------------------------------------------------------------
// The SDK hand-over and the budget file
// ---------------------------------------------------------------------------

/** Apply `/analytics-budget.json` (the provider fetches it before the SDK connects). */
export function setAnalyticsBudget(raw: unknown): void {
  budget = parseBudgetConfig(raw, defaultBudget());
}

/**
 * Hand over the initialised SDK and flush the queue in order, each item with
 * its ORIGINAL timestamp and the URL it happened on (the budget decision is
 * made now, with the budget file already applied). Refused outside production
 * on rocketdraft.app (the hard guard).
 */
export function connectAnalytics(client: AnalyticsSink): void {
  if (sink || !analyticsAllowed()) return;
  const pending = queue;
  queue = [];
  sink = client;
  for (const q of pending) {
    try {
      dispatch(q.name, q.props, q);
    } catch {
      // keep flushing the rest
    }
  }
  saveDevice();
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

/** TEST SUPPORT: forget the sink, the queue, the session ring, the device record and the budget. Never called by the app. */
export function resetAnalyticsForTests(): void {
  sink = null;
  disabled = false;
  queue = [];
  recentIds = [];
  device = null;
  seenPaths = new Set();
  advance = { count: 0, maxMs: 0, slow: 0 };
  reportedErrors = new Set();
  budget = defaultBudget();
}
