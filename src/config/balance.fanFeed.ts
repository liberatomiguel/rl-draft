/**
 * v2.3 FEED (FEATURES.fanFeed): the fan feed's tunables. Re-exported from
 * balance.ts. This file must not import balance.ts (it is re-exported there).
 * Followers are a number with no effect on money, morale or anything else in
 * this wave (R198).
 */

export const CAREER_FEED = {
  /** No variant of a kind is reused inside the last N posts of that kind (F3). */
  window: 5,
  /** Posts `fanFeedFor` returns by default, newest first. */
  limit: 30,
  /** The user's series the feed remembers (a ring), and the manager's posts it keeps. */
  seriesKept: 40,
  postsKept: 12,
  /** A streak of series results becomes a streak post at exactly these lengths. */
  streakMilestones: [3, 5, 8, 12],
  /** Claims the copy may make only when the save's own data supports them. */
  claims: {
    /** "Dynasty": Major and Worlds titles in the ledger, this one included. */
    dynastyTitles: 3,
  },
  /** Followers: relative moves, never below 0. Cosmetic in this wave. */
  followers: {
    start: 400,
    perReputation: 6,
    /** Per series result. */
    win: 0.03,
    loss: -0.02,
    upsetWin: 0.02,
    upsetLoss: -0.01,
    /** A title won (the event's playoffs champion). */
    title: 0.1,
    /** rc9 STORIES: the manager's post moves them by `effects` below (tone x result). */
    /** A provocative post answered by a loss to that opponent / by a win. */
    receipt: -0.08,
    backedUp: 0.06,
    /** Every move is at least this many followers. */
    minStep: 1,
  },
  /** A provocative post can be settled by a series against its opponent this many seasons later. */
  receiptWindowSeasons: 1,
  /** Base likes by kind ([min, max]) before the reach scale. */
  likes: {
    seriesWon: [6, 30],
    seriesLost: [4, 22],
    upsetWin: [20, 90],
    upsetLoss: [12, 60],
    winStreak: [25, 110],
    loseStreak: [10, 50],
    signing: [14, 70],
    sale: [10, 55],
    titleWon: [120, 480],
    finalLost: [60, 220],
    managerPost: [15, 80],
    managerReply: [8, 40],
    receipt: [60, 260],
  },
  /** Reach: likes scale with followers / `reachUnit`, from 1 up to `reachMax`. */
  reachUnit: 400,
  reachMax: 12,

  // rc9 STORIES (R253): when the manager is offered a post. Only after a
  // moment worth a statement, never after every series.
  offer: {
    /** A title won at these tiers. */
    titleTiers: ["regional", "major", "worlds"],
    /** A final lost at these tiers. */
    finalTiers: ["regional", "major", "worlds"],
    /** Out of these events before the final (a Major or Worlds exit). */
    exitTiers: ["major", "worlds"],
    /** A qualifier lost by a club seeded this high or higher in its field (the favourite missing the regional). */
    qualifierFavouriteRank: 4,
    /** An upset (either way) at these tiers, with at least this rating gap between the sides. */
    upsetTiers: ["qualifier", "regional", "major", "worlds"],
    upsetMinGap: 3,
    /** A run of series wins reaching exactly one of these lengths. */
    streakMilestones: [6, 10, 15],
    /** Days between two offers (a title skips the gap), and offers per season at most. */
    minGapDays: 21,
    perSeason: 6,
    /** Unanswered, the offer lapses quietly this many days after it surfaced. */
    expireDays: 4,
    /** Offer days kept for the gap and the cap. */
    logKept: 12,
  },

  // rc9 STORIES (R256): what a post does, by tone and by the result it answers.
  // `followers` is a relative move; `morale` moves every squad player's morale
  // (FEATURES.lockerRoom); `board` moves the board's confidence (a save with a
  // board). Small on purpose: a title is +6 morale and +6 to +15 confidence.
  effects: {
    humble: {
      won: { followers: 0.01, morale: 1, board: 0 },
      lost: { followers: 0.01, morale: 2, board: 1 },
    },
    confident: {
      won: { followers: 0.02, morale: 2, board: 0 },
      lost: { followers: 0.02, morale: 1, board: 0 },
    },
    provocative: {
      won: { followers: 0.04, morale: 1, board: -1 },
      lost: { followers: 0.03, morale: -2, board: -2 },
    },
  },
} as const;
