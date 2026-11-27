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
 * Budget priority (`analyticsBudget.ts`).
 *  - "essential" (v2.1.0-dev.4): never sampled or capped AND outside the
 *    circuit breaker — the career's spine (one per tournament, split, season,
 *    milestone, end), refused actions, soft-lock signs, accounts and health.
 *    They have their own, much higher daily ceiling against a loop. At the top
 *    budget levels the per-tournament event is sampled by CAREER (whole careers
 *    in or out, `CAREER_SAMPLED_EVENTS`), never by event.
 *  - "critical": never sampled or capped (funnels, sessions, rare decisions),
 *    but stopped by the breaker like everything that is not essential.
 *  - "standard": the volume, thinned first when the daily player count passes a
 *    budget level.
 */
export type EventPriority = "essential" | "critical" | "standard";

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

/**
 * The career events that the top budget levels sample by career (a level's
 * `careerRate`): the per-tournament line and the frequent decisions. The split,
 * season, milestone and end events are never sampled, so every career keeps
 * its season line however many players there are.
 */
export const CAREER_SAMPLED_EVENTS: readonly string[] = ["career_event_completed", "career_transfer", "career_staff"];

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
    // rc9 LEGACY: the player's series (engine/runSeriesFacts.ts). "Shown" = the
    // overall the screens print; "strength" = what the rival actually played at.
    seriesWon: "number",
    seriesLost: "number",
    /** Average shown overall of every rival met. */
    oppOverallAvg: "number",
    /** Series lost to a rival shown at least 5 / 8 / 10 below the player. */
    lostToLowerBy5: "number",
    lostToLowerBy8: "number",
    lostToLowerBy10: "number",
    /** Largest shown gap among the lost series (null = none lost). */
    worstLossGap: "number?",
    /** The series that ended the run (all null for the champion). */
    endOppOverall: "number?",
    endOppStrength: "number?",
    endGap: "number?",
    endScore: "string?",
    endRound: "string?",
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
  /**
   * v2.1: a finished Daily's "best draft of the day" panel (engine/dailyOptimal).
   * `action` = shown (the analysis finished on the results screen, once per
   * Daily) | shared (the result line was shared or copied). `gap` = rating
   * points to the best draft; `percentile` is against SIMULATED reference
   * drafts (`percentileSource` = simulated until a real board exists);
   * `computeMs` = how long the analysis took on the device.
   */
  daily_insight: spec("draft", "standard", {
    action: "string",
    dailyNumber: "number",
    dailyTemplate: "string",
    percentile: "number",
    percentileSource: "string",
    gap: "number",
    matched: "boolean",
    teamOverall: "number",
    bestOverall: "number",
    computeMs: "number?",
  }),
  /**
   * Friend duel (v2.1, `engine/duel.ts`), one event name for the whole loop:
   * `action` = opened (a valid link landed on /duel), invalid (a broken or
   * edited link fell back to a normal draft; `reason`), completed (a duel run
   * reached its results; `beat` / `lost` = earlier runs in the link it beat or
   * lost to) or shared (the link went out; `method` native | copy).
   * `entries` = runs already in the link. Never the seed or the link itself.
   */
  friend_duel: spec("draft", "standard", {
    action: "string",
    entries: "number",
    mode: "string?",
    difficulty: "string?",
    region: "string?",
    placement: "string?",
    beat: "number?",
    lost: "number?",
    resets: "number?",
    method: "string?",
    reason: "string?",
    /** The link was made on another BALANCE_VERSION (the offers may differ). */
    staleVersion: "boolean?",
  }),
  /**
   * Share kit (v2.2, `components/share/ShareSheet`): something left the game
   * through a share sheet. `surface` = run | daily | duel | career | invite;
   * `channel` = native | whatsapp | x | reddit | telegram | copyImage |
   * copyText | download; `format` = post | story (absent for a link-only
   * share). One event per action the player took, never per sheet opened. The
   * visit it brings back carries utm_medium=share and utm_campaign=<surface>.
   */
  content_shared: spec("shared", "critical", {
    surface: "string",
    channel: "string",
    format: "string?",
    gameMode: "string",
  }),
  /**
   * Share kit (v2.2, `lib/referral.ts`): a browser that arrived through a
   * share link with a player's code played for the first time and its claim
   * settled. `result` = counted | refused (own code, daily cap, already
   * counted, unknown code); `via` = draft | career (= `gameMode`). Never the
   * code or the device id.
   */
  referral_claimed: spec("shared", "critical", {
    result: "string",
    via: "string",
    gameMode: "string",
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
    /** v2.1.0-dev.4: the last career screen this device saw before this session (tab key or sub-route). */
    lastCareerTab: "string?",
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

  career_created: spec("career", "essential", {
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
  career_event_completed: spec("career", "essential", {
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
    // v2.1.0-dev.4 (Etapa 1, M7): the user's series in this tournament (a regional
    // weekend includes Saturday's qualifier). An upset is a series won as the
    // underdog / lost as the favourite by ANALYTICS_UPSET_GAP+ average player
    // overall. Null when the tournament state was not seen (an older save).
    seriesWon: "number?",
    seriesLost: "number?",
    upsetWins: "number?",
    upsetLosses: "number?",
    /** Mean average-player-overall of the opponents the user met, one decimal. */
    oppOverallAvg: "number?",
    /** Reserved for Matchday fatia 3: series watched live, decisions taken. Null until then. */
    liveSeries: "number?",
    decisions: "number?",
  }),
  /** The Monday that closes a split (weeks 11 / 21 / 31). Money is for the split. */
  career_split_summary: spec("career", "essential", {
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
  career_season_completed: spec("career", "essential", {
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
    /** v2.1.0-dev.4 (Mundo vivo): real dataset orgs in the final top 8 of the user's region (local sides, entrants and the user excluded). */
    realOrgsTop8: "number?",
    /** v2.1.0-dev.4: the season's competition format. Reserved: null until Mundo vivo ships formats. */
    formatId: "string?",
  }),
  career_transfer: spec("career", "critical", {
    ...CAREER_ID,
    seasonIndex: "number",
    /** sign / sell / release / renew / trade (v2.1.0-dev.4: a player-for-player trade, both legs). */
    kind: "string",
    /** kind "trade": "out" = the user's player who left, "in" = the one who arrived. */
    tradeSide: "string?",
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
  career_milestone: spec("career", "essential", {
    ...CAREER_ID,
    seasonIndex: "number",
    kind: "string",
    /** Debt outstanding after a rescue or a bank loan. */
    amount: "number?",
  }),
  /** The career closed: worlds_won / timeline_complete / insolvency / retired. */
  career_ended: spec("career", "essential", {
    ...CAREER_ID,
    seasonIndex: "number",
    reason: "string",
    legacyGrade: "string?",
    titles: "number",
    titlesWorlds: "number",
    balance: "number",
    rep: "number",
  }),
  /**
   * v2.1.0-dev.4 (soft lock): the career refused an action the player asked for
   * (`reason` = the store's error key: blocked / actionFailed / funds / …;
   * `screen` = the career screen it came from). Once per session and reason.
   */
  career_action_refused: spec("career", "essential", {
    ...CAREER_ID,
    reason: "string",
    screen: "string",
  }),

  // -------------------------------------------------------------------------
  // Player research (2.0.31; `gameMode` = where the card opened)
  // -------------------------------------------------------------------------

  /**
   * The research-form invitation (`lib/researchInvite.ts`): `action` shown /
   * opened (the link clicked) / dismissed. At most a few per device per
   * campaign, so critical (never sampled). `surface` = draft | career.
   */
  research_invite: spec("shared", "critical", {
    gameMode: "string",
    action: "string",
    surface: "string",
    campaign: "string",
    activeDays: "number",
    runsCompleted: "number",
    careerSeasons: "number",
  }),

  // -------------------------------------------------------------------------
  // Accounts and sync (`gameMode: "app"`)
  // -------------------------------------------------------------------------

  account_signed_in: spec("app", "essential", {
    hadLocalProgress: "boolean",
  }),
  /** A cloud sync aborted (stage: read / push). Once per session, stage and
   *  reason. v2.0.25: `reason` names the failure (lib/syncErrors) and `code` is
   *  the short database / PostgREST code when there is one. */
  account_sync_failed: spec("app", "essential", {
    actionId: "string",
    stage: "string",
    reason: "string",
    code: "string?",
  }),

  /** v2.0.26: a career cloud step failed (stage: list / read / push / delete /
   *  load). Once per session, stage and reason. */
  career_cloud_failed: spec("app", "essential", {
    actionId: "string",
    stage: "string",
    reason: "string",
    code: "string?",
  }),
  /** v2.0.26: the player answered the notice about two copies of a career
   *  (kind: diverged / different-career / cloud-deleted; choice: local / cloud). */
  career_cloud_conflict: spec("app", "essential", {
    kind: "string",
    choice: "string",
  }),

  // -------------------------------------------------------------------------
  // Health (`quality_*`)
  // -------------------------------------------------------------------------

  /** A persisted store failed to save or load ("write" = a non-quota write error). */
  quality_save_error: spec("shared", "essential", {
    gameMode: "string",
    actionId: "string",
    store: "string",
    kind: "string",
  }),
  /** A save was upgraded to a newer shape (persist version or career saveVersion). */
  quality_migration: spec("shared", "essential", {
    gameMode: "string",
    actionId: "string",
    store: "string",
    fromVersion: "number",
    toVersion: "number",
  }),
  /** A grant was refused because it had already been given. */
  quality_duplicate_reward: spec("shared", "essential", {
    gameMode: "string",
    actionId: "string",
    kind: "string",
    id: "string",
  }),
  /** A screen error (boundary / window / promise). At most 3 per session; message without quoted text. */
  quality_error: spec("app", "essential", {
    actionId: "string",
    source: "string",
    name: "string",
    route: "string",
    message: "string",
  }),
  /** A career day advance (or advance-to-next-stop) took too long. Once per session and kind. */
  quality_slow_advance: spec("career", "essential", {
    actionId: "string",
    kind: "string",
    ms: "number",
  }),
  /** The budget guard started dropping this device's events today (kind: cap / breaker). */
  quality_event_cap: spec("app", "essential", {
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
