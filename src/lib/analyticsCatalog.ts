/**
 * The 2.0 analytics catalogue (docs/ANALYTICS-EVENTS-2.0.md) — the ONE list of
 * events the game may send, as data: every event's properties with their type,
 * whether the property is required, the event's game mode and its budget
 * priority. The TypeScript payload types (`GameEvents`) are derived from it, and
 * `catalogProblems` checks a payload against it at runtime (tests fail on an
 * event outside the catalogue, a missing required property, a wrong type or a
 * property the catalogue does not list).
 *
 * PostHog bills per EVENT, not per property: prefer few events with many
 * properties. Nothing per pick, per reroll, per day advanced.
 *
 * Property kinds: "string" | "number" | "boolean" are REQUIRED and non-null;
 * the same with a trailing "?" may be absent or null. Scalars only, no PII and
 * no free text (ids, enums, counts).
 */

export type PropKind = "string" | "number" | "boolean" | "string?" | "number?" | "boolean?";

/**
 * Budget priority (`analyticsBudget.ts`). "critical" events are never sampled
 * or capped (rare, and each one matters: funnels, summaries, decisions, health).
 * "standard" events are the volume: they are thinned first when the daily
 * player count passes a budget level.
 */
export type EventPriority = "critical" | "standard";

/** "shared" = both modes; the payload's own `gameMode` decides. "app" = neither (sessions, accounts, health). */
export type EventMode = "draft" | "career" | "app" | "shared";

export interface EventSpec {
  mode: EventMode;
  priority: EventPriority;
  props: Readonly<Record<string, PropKind>>;
}

function spec<const P extends Record<string, PropKind>>(mode: EventMode, priority: EventPriority, props: P) {
  return { mode, priority, props };
}

/** Career tabs counted between two career events (`tab_<key>` on `career_event_completed`). */
export const CAREER_TABS = [
  "hq",
  "club",
  "squad",
  "market",
  "training",
  "finances",
  "calendar",
  "standings",
  "news",
  "season",
] as const;
export type CareerTab = (typeof CAREER_TABS)[number];

/** Steps of the entry funnel, each sent once per device, ever (`onboarding_step.step`). */
export const ONBOARDING_STEPS = [
  "draft_started",
  "draft_confirmed",
  "run_completed",
  "challenge_played",
  "quiz_played",
  "career_created",
  "career_first_event",
] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

const CAREER_ID = { careerId: "string", actionId: "string" } as const;

export const EVENT_CATALOG = {
  // -------------------------------------------------------------------------
  // Draft, challenges, quiz, collection (`gameMode: "draft"`)
  // -------------------------------------------------------------------------

  /** A run reached its results screen — ONE event carries the whole run. */
  run_completed: spec("draft", "standard", {
    runId: "string",
    mode: "string",
    difficulty: "string",
    /** Region lock, "worldwide", "daily", or a challenge's constraint region. */
    region: "string",
    placement: "string",
    won: "boolean",
    hiddenOverall: "boolean",
    teamOverall: "number",
    swissWins: "number",
    swissLosses: "number",
    playoffWins: "number",
    gameWins: "number",
    goalsFor: "number",
    goalsAgainst: "number",
    /** The stage that ended the run (null for the champion or when the reveal is off). */
    eliminatedStage: "string?",
    xpGained: "number",
    chemistryTier: "string",
    chemistryPercent: "number",
    /** Wall clock from run creation (a resumed run counts its pause too). */
    durationSec: "number?",
    /** The daily's template id, null outside dailies. */
    dailyTemplate: "string?",
    /** Restarts before this run in the same sitting (the old run_abandoned "restart"). */
    resets: "number",
    rerollsLeft: "number",
    /** The drafted cards in slot order, `slot:refId` joined by "|". */
    picks: "string",
    /** The special cards fielded, ids joined by "|" ("" = none). */
    specials: "string",
    specialsCount: "number",
    /** Fielded specials not owned before this run. */
    specialsNew: "number",
    achievementsNew: "number",
    /** Season Rating: the signed delta of this run and the rating after it. */
    ratingDelta: "number",
    ratingAfter: "number",
    rankId: "string",
    rankUp: "boolean",
  }),
  /** A run was left for good before its results screen (a restart is a counter, not an event). */
  run_abandoned: spec("draft", "standard", {
    runId: "string",
    mode: "string",
    difficulty: "string",
    region: "string",
    hiddenOverall: "boolean",
    phase: "string",
    reason: "string",
    resets: "number",
    picksMade: "number",
    durationSec: "number?",
  }),
  /** A challenge attempt was evaluated (its Bo7, gauntlet or Draft Lab objective). */
  challenge_played: spec("draft", "standard", {
    challengeId: "string",
    difficulty: "string",
    kind: "string",
    cleared: "boolean",
    /** Stars earned by this attempt (0–3) and how many of them were new. */
    stars: "number",
    starsNew: "number",
    firstClear: "boolean",
    resets: "number",
    rerollsUsed: "number",
    teamOverall: "number",
    chemistryPercent: "number",
    picks: "string",
    specials: "string",
    xpGained: "number",
  }),
  /** The daily quiz ended (solved or out of guesses). Clues shown = attempts − 1. */
  quiz_played: spec("draft", "standard", {
    solved: "boolean",
    attempts: "number",
    maxAttempts: "number",
    score: "number",
    xp: "number",
    streak: "number",
  }),
  /** A special card entered the collection — once per card, ever. */
  special_discovered: spec("draft", "standard", {
    specialId: "string",
    rarity: "string",
    national: "boolean",
    /** The run mode it was found in (classic / quick / daily / challenge). */
    mode: "string",
  }),
  /** Albums: a national team was first seen, or its album was completed. */
  collection_milestone: spec("draft", "critical", {
    kind: "string",
    id: "string",
    albumsCompleted: "number?",
  }),

  // -------------------------------------------------------------------------
  // Progression (`gameMode: "draft"`: the profile is the Draft's)
  // -------------------------------------------------------------------------

  mission_completed: spec("draft", "standard", {
    id: "string",
    period: "string",
    tier: "string?",
    xp: "number",
    /** True for the "all missions of the period" bonus (id = `all:<period>`). */
    bonus: "boolean",
  }),
  achievement_unlocked: spec("draft", "standard", {
    id: "string",
  }),
  rank_up: spec("draft", "critical", {
    rankId: "string",
    rankIndex: "number",
    xp: "number",
  }),
  /** Something new became available: a cosmetic, a mode. `count` > 1 = a batch (id "batch"). */
  unlock_granted: spec("draft", "standard", {
    kind: "string",
    id: "string",
    count: "number",
  }),

  // -------------------------------------------------------------------------
  // Entry funnel (`gameMode: "app"`)
  // -------------------------------------------------------------------------

  /** A session began: the first activity of a page load, or after 30 idle minutes. Carries the player's snapshot. */
  session_started: spec("app", "critical", {
    /** Sessions and distinct active days on this device since the 2.0 analytics (1-based). */
    sessionNumber: "number",
    dayNumber: "number",
    daysSinceFirst: "number",
    daysSinceLast: "number?",
    /** The profile already had progress when this device was first counted (a pre-2.0 player). */
    existingPlayer: "boolean?",
    entryPath: "string",
    signedIn: "boolean?",
    loginStreak: "number?",
    xp: "number?",
    rankId: "string?",
    rating: "number?",
    runsCompleted: "number?",
    specialsOwned: "number?",
    achievements: "number?",
    challengesCleared: "number?",
    quizPlayed: "number?",
    careerMarks: "number?",
    /** Equipped cosmetics (ids; "" = none chosen). */
    equippedTitle: "string?",
    equippedBanner: "string?",
    equippedBadge: "string?",
    /** A run was waiting to be resumed (its phase). */
    openRunPhase: "string?",
  }),
  /** A first, once per device ever (`ONBOARDING_STEPS`). */
  onboarding_step: spec("app", "critical", {
    step: "string",
    sessionNumber: "number",
    dayNumber: "number",
    secondsSinceFirstSeen: "number",
  }),

  // -------------------------------------------------------------------------
  // Road to Worlds (`gameMode: "career"`). `careerId` is the random id stored
  // in the save; `actionId` = careerId:seasonIndex:day:kind:ref.
  // -------------------------------------------------------------------------

  career_created: spec("career", "critical", {
    ...CAREER_ID,
    region: "string",
    difficulty: "string",
    rosterKey: "string",
    startOverall: "number",
    startBalance: "number",
    slot: "number?",
  }),
  /**
   * ONE per tournament the user played. A regional weekend is one event: the
   * Saturday qualifier is reported with the Sunday regional (`qualifierPlacement`),
   * or alone (tier "qualifier") when the team did not qualify.
   */
  career_event_completed: spec("career", "standard", {
    ...CAREER_ID,
    seasonIndex: "number",
    week: "number",
    tier: "string",
    /** The event's region; "international" for Majors and Worlds. */
    eventRegion: "string",
    placement: "string",
    qualified: "boolean?",
    qualifierPlacement: "string?",
    watched: "boolean",
    /** Regional weeks: seeded into the direct 8. */
    seedingDirect: "boolean?",
    /** The Sunday coach briefing (keep / recover / prepare), when one was given. */
    briefing: "string?",
    squadOverall: "number",
    balance: "number",
    // Visits to each career tab on this device since the previous career event.
    tab_hq: "number?",
    tab_club: "number?",
    tab_squad: "number?",
    tab_market: "number?",
    tab_training: "number?",
    tab_finances: "number?",
    tab_calendar: "number?",
    tab_standings: "number?",
    tab_news: "number?",
    tab_season: "number?",
    // Day advances since the previous career event: how many, the slowest, how many were slow.
    advanceCount: "number?",
    advanceMaxMs: "number?",
    advanceSlowCount: "number?",
  }),
  /** The Monday that closes a split (weeks 11 / 21 / 31). Money is for the split. */
  career_split_summary: spec("career", "critical", {
    ...CAREER_ID,
    seasonIndex: "number",
    split: "number",
    balance: "number",
    /** The wage bill per split at the boundary (squad + coach). */
    payrollPerSplit: "number",
    incomePrize: "number",
    incomeSponsor: "number",
    incomeFanbase: "number",
    incomeTransfers: "number",
    spendWages: "number",
    spendTransfers: "number",
    spendOther: "number",
    debtBacker: "number",
    debtBank: "number",
    /** The user's place on the split's Major table (null = no row). */
    splitRank: "number?",
    /** False when the ledger ring buffer had already dropped lines of this split. */
    ledgerComplete: "boolean",
    squadOverall: "number",
    squadSize: "number",
    coachOverall: "number?",
    sponsorTier: "number?",
    trainingMode: "string?",
    staffCount: "number",
    rep: "number",
  }),
  /** The season review was written (Worlds resolved) — the season in one event. */
  career_season_completed: spec("career", "critical", {
    ...CAREER_ID,
    seasonIndex: "number",
    region: "string",
    difficulty: "string",
    regionRank: "number",
    seasonPoints: "number",
    majorsQualified: "number",
    worldsPlacement: "string?",
    grade: "string",
    earnings: "number",
    balance: "number",
    rep: "number",
    titlesSeason: "number",
    titlesTotal: "number",
    titlesWorlds: "number",
    squadOverall: "number",
    squadSize: "number",
    squadAvgAge: "number",
    payrollPerSplit: "number",
    coachOverall: "number?",
    sponsorTier: "number?",
    sponsorProfile: "string?",
    trainingMode: "string?",
    staffCount: "number",
    debtBacker: "number",
    debtBank: "number",
  }),
  career_transfer: spec("career", "critical", {
    ...CAREER_ID,
    seasonIndex: "number",
    /** sign / sell / release / renew. */
    kind: "string",
    overall: "number",
    age: "number",
    /** Midpoint of the band the screens show (never the hidden potential). */
    potentialBandMid: "number",
    /** Sign: the transfer fee · sell: the bid · release: the severance · renew: 0. */
    fee: "number",
    salaryPerSplit: "number",
    role: "string",
    /** The player had a contract-expiry warning this season. */
    warned: "boolean",
  }),
  /** coach_hired / coach_fired / coach_renewed / sponsor_signed / staff_on / staff_off. */
  career_staff: spec("career", "critical", {
    ...CAREER_ID,
    seasonIndex: "number",
    kind: "string",
    overall: "number?",
    salaryPerSplit: "number?",
    tier: "number?",
    basePerSplit: "number?",
    objectiveKind: "string?",
    profile: "string?",
    /** assistant / analyst / physio / brand / psychologist. */
    staffId: "string?",
  }),
  /** first_title / first_major / first_worlds / worlds_title / backer / bank_loan. */
  career_milestone: spec("career", "critical", {
    ...CAREER_ID,
    seasonIndex: "number",
    kind: "string",
    /** Debt outstanding after a rescue or a bank loan. */
    amount: "number?",
  }),
  /** The career closed: worlds_won / timeline_complete / insolvency / retired. */
  career_ended: spec("career", "critical", {
    ...CAREER_ID,
    seasonIndex: "number",
    reason: "string",
    legacyGrade: "string?",
    titles: "number",
    titlesWorlds: "number",
    balance: "number",
    rep: "number",
  }),

  // -------------------------------------------------------------------------
  // Accounts and sync (`gameMode: "app"`)
  // -------------------------------------------------------------------------

  account_signed_in: spec("app", "critical", {
    hadLocalProgress: "boolean",
  }),
  /** A cloud sync aborted (stage: read / push). Once per session and stage. */
  account_sync_failed: spec("app", "critical", {
    actionId: "string",
    stage: "string",
  }),

  // -------------------------------------------------------------------------
  // Health (`quality_*`)
  // -------------------------------------------------------------------------

  /** A persisted store failed to save or load ("write" = a non-quota write error). */
  quality_save_error: spec("shared", "critical", {
    gameMode: "string",
    actionId: "string",
    store: "string",
    kind: "string",
  }),
  /** A save was upgraded to a newer shape (persist version or career saveVersion). */
  quality_migration: spec("shared", "critical", {
    gameMode: "string",
    actionId: "string",
    store: "string",
    fromVersion: "number",
    toVersion: "number",
  }),
  /** A grant was refused because it had already been given. */
  quality_duplicate_reward: spec("shared", "critical", {
    gameMode: "string",
    actionId: "string",
    kind: "string",
    id: "string",
  }),
  /** A screen error (boundary / window / promise). At most 3 per session; message without quoted text. */
  quality_error: spec("app", "critical", {
    actionId: "string",
    source: "string",
    name: "string",
    route: "string",
    message: "string",
  }),
  /** A career day advance (or advance-to-next-stop) took too long. Once per session and kind. */
  quality_slow_advance: spec("career", "critical", {
    actionId: "string",
    kind: "string",
    ms: "number",
  }),
  /** The budget guard started dropping this device's events today (kind: cap / breaker). */
  quality_event_cap: spec("app", "critical", {
    kind: "string",
    level: "number",
  }),
} as const satisfies Record<string, EventSpec>;

// ---------------------------------------------------------------------------
// Types derived from the catalogue
// ---------------------------------------------------------------------------

type ValueOf<K> = K extends "string"
  ? string
  : K extends "number"
    ? number
    : K extends "boolean"
      ? boolean
      : K extends "string?"
        ? string | null
        : K extends "number?"
          ? number | null
          : K extends "boolean?"
            ? boolean | null
            : never;

type RequiredKeys<P> = { [K in keyof P]: P[K] extends `${string}?` ? never : K }[keyof P];
type OptionalKeys<P> = { [K in keyof P]: P[K] extends `${string}?` ? K : never }[keyof P];

type PropsOf<P> = { -readonly [K in RequiredKeys<P>]: ValueOf<P[K]> } & { -readonly [K in OptionalKeys<P>]?: ValueOf<P[K]> };

/** Every event's payload type, by name. */
export type GameEvents = { [N in keyof typeof EVENT_CATALOG]: PropsOf<(typeof EVENT_CATALOG)[N]["props"]> };
export type GameEventName = keyof GameEvents;

/** One event, ready to send (the stores build lists of these). */
export type TrackedEvent = { [K in GameEventName]: { name: K; props: GameEvents[K] } }[GameEventName];

export function isCatalogEvent(name: string): name is GameEventName {
  return Object.prototype.hasOwnProperty.call(EVENT_CATALOG, name);
}

/**
 * What is wrong with this payload, as readable lines (empty = it matches the
 * catalogue): an unknown event, a missing or null required property, a wrong
 * type, or a property the catalogue does not list.
 */
export function catalogProblems(name: string, props: Readonly<Record<string, unknown>>): string[] {
  if (!isCatalogEvent(name)) return [`"${name}" is not in the analytics catalogue`];
  const shape: Readonly<Record<string, PropKind>> = EVENT_CATALOG[name].props;
  const problems: string[] = [];
  for (const [key, kind] of Object.entries(shape)) {
    const optional = kind.endsWith("?");
    const type = optional ? kind.slice(0, -1) : kind;
    const value = props[key];
    if (value === undefined || value === null) {
      if (!optional) problems.push(`${name}.${key} is required (${type})`);
      continue;
    }
    if (typeof value !== type) problems.push(`${name}.${key} must be a ${type}, got ${typeof value}`);
    else if (type === "number" && !Number.isFinite(value)) problems.push(`${name}.${key} must be a finite number`);
  }
  for (const key of Object.keys(props)) {
    if (!(key in shape) && props[key] !== undefined) problems.push(`${name}.${key} is not in the catalogue`);
  }
  return problems;
}
