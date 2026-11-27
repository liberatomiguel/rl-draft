/**
 * v2.3 FEED: the shapes of the fan feed. Posts are derived data, never stored;
 * the one stored thing is `FanFeedSave`, the additive optional field on the save.
 */

export type FanTone = "humble" | "confident" | "provocative";

export type FeedKind =
  | "seriesWon"
  | "seriesLost"
  | "upsetWin"
  | "upsetLoss"
  | "winStreak"
  | "loseStreak"
  | "signing"
  | "sale"
  | "titleWon"
  | "finalLost"
  | "managerPost"
  | "managerReply"
  | "receipt";

/** A value a post's text can name. Every slot is a plain string the copy drops in. */
export type FeedSlot =
  | "opponent"
  | "score"
  | "event"
  | "org"
  | "streak"
  | "player"
  | "fee"
  | "from"
  | "to"
  | "titles"
  | "week";

export type FeedSlots = Partial<Record<FeedSlot, string>>;

/** A claim the copy may make only when the save's data supports it. */
export type FeedClaim = "dynasty" | "bestInRegion" | "firstMajor";

export interface FeedPost {
  /** Stable: the event the post answers (the same save always yields the same ids). */
  id: string;
  kind: FeedKind;
  /** The copy key ("seriesWon.3"; "managerPost.7" for the manager's own, one per tone x result). */
  variant: string;
  slots: FeedSlots;
  author: { type: "fan"; handle: string } | { type: "manager" };
  likes: number;
  seasonIndex: number;
  week: number;
}

/** One of the user's series, kept when the event finished (a ring in `FanFeedSave.series`). */
export interface FeedSeries {
  /** Monotonic, per save. */
  n: number;
  seasonIndex: number;
  week: number;
  eventId: string;
  event: string;
  opponentRef: string;
  opponentName: string;
  /** Games won by the user / by the opponent. */
  us: number;
  them: number;
  won: boolean;
  /** The lower-rated side won (engine `SeriesResult.upset`). */
  upset: boolean;
}

/** The manager's post: tone, opponent, week (R196), and how it was settled. */
export interface FeedManagerPost {
  /** The series it answers (`FeedSeries.n`). */
  seriesN: number;
  tone: FanTone;
  opponentRef: string;
  opponentName: string;
  seasonIndex: number;
  week: number;
  /**
   * v2.3 FIX: the series the post reacted to, kept so its text is written
   * about a result that already happened. Absent on a post made before this
   * field existed: it reads as a win (the series ring is looked up first).
   */
  result?: { won: boolean; us: number; them: number; event: string };
  /** Settled by a later series against that opponent (a provocative post only). */
  settled?:
    | { kind: "receipt"; seriesN: number; seasonIndex: number; week: number; event: string; us: number; them: number }
    | { kind: "backedUp"; seriesN: number };
}

/** The save's one additive optional field. Absent = the feed never ran for this save. */
export interface FanFeedSave {
  v: 1;
  /** Next `FeedSeries.n`. */
  seq: number;
  series: FeedSeries[];
  posts: FeedManagerPost[];
  /** The last series the manager answered (posted or skipped). */
  answered: number;
  /** A number with no effect on anything (R198). */
  followers: number;
}
