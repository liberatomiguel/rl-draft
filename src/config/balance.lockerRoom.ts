/**
 * v2.3 LOCKER (wave 1, HISTORIAS-SPEC L1–L5): the locker room's tunables —
 * player morale, its drivers, talks and promises, the manager's word and the
 * consequences. Re-exported from `balance.ts` with one line. Read only by
 * `engine/career/lockerRoom.ts` and `store/lockerRoomFlow.ts` (and the
 * training factor in `development.rawGain`). FEATURES.lockerRoom gates all of it.
 */

export const CAREER_LOCKER = {
  /** L1: morale is 0–100; a player without an entry reads as this (neutral). */
  neutral: 50,
  min: 0,
  max: 100,
  /**
   * L1: the five moods, by their lower bound (ascending). A morale reads as
   * the last mood whose bound it reaches.
   */
  moods: [
    { id: "angry", from: 0 },
    { id: "unhappy", from: 20 },
    { id: "neutral", from: 40 },
    { id: "content", from: 60 },
    { id: "delighted", from: 80 },
  ],

  /** L2 drift: each weekly tick moves morale this much toward neutral (never past it). */
  weeklyDrift: 1,

  /**
   * L2 playing time. One unit = one event the club played (the lineup is
   * frozen per event, R40): sitting it out costs `benchDrop`; after
   * `benchRunTalk` in a row he asks for a word (a talk) and keeps falling
   * until he plays. Playing one after such a run gives `backInSide`, any
   * other appearance `played`.
   */
  benchDrop: 3,
  benchRunTalk: 3,
  played: 1,
  backInSide: 4,
  /**
   * A player who does not expect to start (his overall below the weakest
   * fielded starter's) stops falling from the bench alone at this floor —
   * above `requestBelow`, so a reserve never files a transfer request from
   * the bench alone.
   */
  benchFloorReserve: 32,

  /** L2 results (the whole squad). */
  titleLift: 6,
  /** A deep run: a Major or the Worlds finished in the top four without the title. */
  deepRunLift: 3,
  deepRunTiers: ["major", "worlds"] as readonly string[],
  /** Title tiers: winning one of these lifts the squad (a Community Cup does not). */
  titleTiers: ["regional", "major", "worlds"] as readonly string[],
  /** A poor event: out in the Swiss (a qualifier missed, a Major left early). */
  poorPlacements: ["swiss_exit"] as readonly string[],
  /** From the `losingRunFrom`-th poor event in a row, each one lowers the squad by `losingRunDrop`. */
  losingRunFrom: 3,
  losingRunDrop: 2,

  /** L2 the market. */
  listedDrop: 10,

  /** L3 talks. An unanswered talk resolves itself with its neutral answer after this many days. */
  talkDays: 7,
  /** A "blunt" answer (no promise, no comfort). */
  bluntDrop: 5,
  /** A refused transfer request. */
  refuseDrop: 6,
  /** An agreed sale: he is relieved. */
  agreedSaleLift: 8,

  /** L3 promises. */
  promise: {
    /** "minutes": starts `need` of the next `of` events the club plays. */
    minutesNeed: 3,
    minutesOf: 4,
    /** A minutes promise not settled by then (the club played too few events) is judged on what was played. */
    minutesMaxDays: 70,
    /** Making a promise calms him by this × the word's multiplier. */
    calm: 10,
    kept: 8,
    broken: 20,
    /** A broken promise also costs every other contracted player this. */
    brokenSquad: 4,
  },

  /**
   * L3 the manager's word: credibility = (kept + 1) / (kept + broken + 2).
   * A promise calms × clamp((credibility − floor) / (0.5 − floor), 0, maxMult):
   * 1 for a new manager, 0 once broken promises clearly outweigh kept ones.
   */
  word: { floor: 0.3, maxMult: 1.25 },

  /** L4 the transfer request: morale under `requestBelow` for `requestWeeks` weekly ticks in a row. */
  requestBelow: 25,
  requestWeeks: 4,
  /** After a refusal (or a request answered), no new request for this many weekly ticks. */
  requestCooldownWeeks: 8,

  /**
   * L4 training: development gain × a factor from morale, linear from
   * `trainingMin` (morale 0) through 1 (neutral) to `trainingMax` (100).
   * Applied to the raw gain only (never to a decline): no morale effect
   * lowers a stored overall or potential.
   */
  trainingMin: 0.94,
  trainingMax: 1.06,

  /**
   * L4 the match-performance effect: rating points per 50 morale away from
   * neutral. Ships at ZERO — not switched on before a battery measures it.
   */
  matchEffect: 0,

  // rc9 LOCKER (R211–R219): morale that moves. Everything below is read only with FEATURES.lockerRoom on.
  /**
   * R211 the weekly pull: each Monday a player's morale moves `share` of the way
   * to his target (at least 1 point when the gap is `minGap` or more). The
   * target is neutral plus what the season is giving him: the team's results
   * against expectation, his own form, his training load. With no context the
   * target is neutral, so this replaces the flat `weeklyDrift`.
   */
  pull: { share: 0.3, minGap: 2, reasonFrom: 3 },
  /**
   * R212 results against expectation. Each user series counts won − p, with
   * p = 1 / (1 + e^(−ratingDiff / expectScale)) from the ratings at sim time;
   * an event's sum feeds the team's results memory (× `decay` per event, ×
   * `weeklyDecay` per week). The target moves `perUnit` per unit of memory, at
   * most `cap` either way; a player on a bench run takes `benchShare` of it.
   */
  results: {
    expectScale: 3,
    decay: 0.75,
    weeklyDecay: 0.95,
    perUnit: 20,
    cap: 30,
    benchShare: 0.5,
    /**
     * An event the user side entered as the field's top-rated team: its series
     * above expectation count × this (below expectation count in full).
     * Measured (rc9 probe, the strongest org of NA / EU / SAM from season 6):
     * those sides win 75–80 % of series against p = 65–68 %, so in full a
     * dynasty sat content or delighted all season on results alone.
     */
    favouriteUpShare: 0,
  },
  /**
   * R212 the difficulty's own edge, which the series' ratingDiff does not carry
   * (rating points added to the user side's edge before p is read). Measured on
   * the rc9 probe, season 1, NA / EU / SAM: Normal won 1 point of win rate above
   * p on average, Hard 3.1 below (every Hard squad read "below expectation" and
   * sagged). Easy and Very Hard are not measured and stay 0.
   */
  expectShift: { normal: 0, hard: -0.45 } as Record<string, number>,
  /**
   * R212 a title won as the top-rated side of its field is expected: it lifts
   * the squad by `titleLift × favouriteTitleShare` instead of the full lift
   * (0: a dynasty winning every cup stayed delighted all season otherwise).
   */
  favouriteTitleShare: 0,
  /**
   * R213 form, from the box score (FEATURES.matchdayBoxScore): his mean rating
   * over a write's games minus the lineup's mean, folded into a memory
   * (`decay` per write with games, `weeklyDecay` per week). The target moves
   * `perPoint` per rating point of memory, at most `cap` either way.
   */
  form: { decay: 0.5, weeklyDecay: 0.85, perPoint: 10, cap: 12 },
  /**
   * R214 training load (the running package's workload, his tweak first). A
   * heavy week adds one to his load count, a normal week takes one off, a
   * light week or rest takes `lightRecovery` off. Past `toleranceWeeks` each
   * week of load lowers the target by `perWeek` (at most `cap`); a light week
   * or rest lifts it by `restLift`.
   */
  load: { toleranceWeeks: 2, perWeek: 4, cap: 12, lightRecovery: 2, restLift: 3 },
  /**
   * R215 the mood a screen shows holds until morale is `moodHysteresis` past
   * the next bound (no weekly flapping at a bound).
   */
  moodHysteresis: 3,
  /** R218 the screens' trend: the log window it reads (days) and the net change that makes it rise or fall. */
  view: { recentDays: 21, trendMin: 3 },
  /**
   * R216 the players' own requests (talks). One new talk at most per
   * `gapWeeks` weeks for the whole squad (a refused bid is the manager's doing
   * and is exempt); a player asks again only after `playerCooldownWeeks`.
   */
  asks: {
    gapWeeks: 2,
    playerCooldownWeeks: 8,
    /** "Lighter load": his load count reaches this. */
    loadAt: 4,
    /** "I can take more": content or better, form not negative, no load count, on a light or normal week; weekly chance. */
    moreFrom: 64,
    moreChance: 0.2,
    /** A 1v1 / 2v2 Community Cup surfaced: a squad player asks to enter it (chance). */
    sideChance: 0.6,
    /** A reserve asks to start the regional: benched this many events in a row, overall within `startGap` of the weakest starter. */
    startTiers: ["regional"] as readonly string[],
    startBenchRun: 2,
    startGap: 6,
    startChance: 0.6,
  },
  /** R216 what an answer does to morale (the training, entry or lineup change is the store's). */
  answers: {
    /** He was heard: a lighter load, more load, a cup entry, a start. */
    heard: 4,
    /** A start for the regional is bigger news. */
    started: 6,
    /** The starter who makes way for him for one event. */
    madeWay: 3,
    /** His request turned down: load kept, cup passed, start refused. */
    passedOver: 3,
    /** "Hold back" on more load: he shrugs it off. */
    heldBack: 1,
  },
  /** R216 a 1v1 / 2v2 side event played: every participant, and a champion's extra. */
  sideEvent: { played: 2, champion: 4 },
  /**
   * R217 the match effect, by the shown mood: rating points per fielded
   * player, averaged over the lineup and clamped to `teamMin..teamMax`, added
   * to the user team's flat rating channel for an official three-player
   * event. Temporary: never written to a stored rating. In the save's first
   * season the negative side is × `firstSeasonNegScale`; a club with a Worlds
   * title inside CAREER_DYNASTY.windowSeasons gets the positive side ×
   * `dynastyPosScale` (a dynasty is never lifted by its own good mood).
   * Measured (LOCKER_PRICE): +0.17 team rating is about +3 title points for a
   * Worlds favourite, so the positive side is kept small on purpose; the
   * difference a mood makes is mostly a bad room costing a result.
   */
  match: {
    enabled: true,
    byMood: { angry: -1.5, unhappy: -0.5, neutral: 0, content: 0.1, delighted: 0.25 } as Record<string, number>,
    teamMin: -1,
    teamMax: 0.25,
    firstSeasonNegScale: 0.5,
    dynastyPosScale: 0,
  },
  /** Recently settled events (dedupe: a write seen twice never counts an event twice). */
  doneEventsCap: 8,
  // rc9 LOCKER end

  /** Bookkeeping caps. */
  logCap: 40,
  /** A batched advance crossing more weeks than this runs only this many weekly ticks. */
  maxWeeksPerCall: 12,
} as const;
