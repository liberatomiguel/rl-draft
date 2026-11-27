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

  /** Bookkeeping caps. */
  logCap: 40,
  /** A batched advance crossing more weeks than this runs only this many weekly ticks. */
  maxWeeksPerCall: 12,
} as const;
