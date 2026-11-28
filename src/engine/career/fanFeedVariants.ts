/**
 * v2.3 FEED (F3): the variants of every fan post. The text lives in
 * `copy.career.feed.*` under `feed.text[key]`, with `{slot}` placeholders; this
 * table says which slots a variant NEEDS (its placeholders, at least two) and
 * the condition it needs on the save's data:
 *
 * - `needs`: a variant is eligible only when every slot is present, so a fact
 *   an older save lacks simply drops the variants that name it.
 * - `claim`: "dynasty", "best in the region" and "first Major" are claims; a
 *   variant carrying one is eligible only when `claimHolds` says the save's
 *   data supports it (R197). A test scans the copy so a claim word can never
 *   sit in a variant without its tag.
 * - `tone`: the manager's post and reply variants answer one tone.
 * - `result`: the manager's post and reply variants are written about a series
 *   already played, so each one is for a "won" or a "lost" series (v2.3 FIX).
 *
 * Keys are `${kind}.${n}`; the copy has exactly these keys, EN and PT.
 */
import type { FanTone, FeedClaim, FeedKind, FeedSlot, PostMoment } from "./fanFeedTypes";

export interface VariantDef {
  key: string;
  needs: readonly FeedSlot[];
  claim?: FeedClaim;
  tone?: FanTone;
  result?: SeriesResult;
  /** rc9 STORIES: a manager's post written for one moment (a title, an exit...). Absent = any series. */
  moment?: PostMoment;
}

export type SeriesResult = "won" | "lost";

type Row = { needs: readonly FeedSlot[]; claim?: FeedClaim; tone?: FanTone; result?: SeriesResult; moment?: PostMoment };

/** rc9 STORIES (R255): the result each moment answers. */
export const MOMENT_RESULT: Record<PostMoment, SeriesResult> = {
  title: "won",
  finalLost: "lost",
  exit: "lost",
  missedQualification: "lost",
  upsetWin: "won",
  upsetLoss: "lost",
  streak: "won",
};

/** rc9 STORIES (R255): the slots of each moment's variants, per tone (one row = one variant). */
const MOMENT_SLOTS: Record<PostMoment, readonly (readonly FeedSlot[])[]> = {
  title: [["event", "opponent", "score"], ["event", "opponent"]],
  finalLost: [["event", "opponent"], ["event", "opponent", "score"]],
  exit: [["event", "opponent"], ["event", "opponent", "score"], ["opponent", "event"]],
  missedQualification: [["event", "opponent"], ["event", "opponent", "org"]],
  upsetWin: [["opponent", "score"], ["opponent", "event"]],
  upsetLoss: [["opponent", "score"], ["opponent", "event"]],
  streak: [["streak", "opponent", "event"], ["streak", "opponent", "score"]],
};

const MOMENTS = Object.keys(MOMENT_SLOTS) as PostMoment[];
const TONES: FanTone[] = ["humble", "confident", "provocative"];

/** Every moment x tone x its slot rows, in a fixed order (the keys follow the generic twelve). */
const momentRows = (): Row[] =>
  MOMENTS.flatMap((moment) =>
    TONES.flatMap((tone) => MOMENT_SLOTS[moment].map((needs) => ({ needs, tone, result: MOMENT_RESULT[moment], moment }))),
  );

const defs = (kind: string, rows: Row[]): VariantDef[] => rows.map((r, i) => ({ key: `${kind}.${i + 1}`, ...r }));

const ONE = ["opponent", "score", "event", "org"] as const satisfies readonly FeedSlot[];
const [OPP, SCORE, EVENT, ORG] = ONE;

/** The six everyday pairings of a series result (all slots exist for every series on record). */
const seriesRows = (): Row[] => [
  { needs: [OPP, SCORE] },
  { needs: [OPP, EVENT] },
  { needs: [SCORE, ORG] },
  { needs: [OPP, ORG] },
  { needs: [SCORE, EVENT] },
  { needs: [OPP, SCORE, EVENT] },
];

const streakRows = (): Row[] => [
  { needs: ["streak", ORG] },
  { needs: ["streak", OPP] },
  { needs: ["streak", EVENT] },
  { needs: ["streak", SCORE] },
  { needs: ["streak", ORG, EVENT] },
  { needs: ["streak", OPP, SCORE] },
];

export const FEED_VARIANTS: Record<FeedKind, readonly VariantDef[]> = {
  seriesWon: defs("seriesWon", [...seriesRows(), { needs: [OPP, ORG], claim: "bestInRegion" }]),
  seriesLost: defs("seriesLost", seriesRows()),
  upsetWin: defs("upsetWin", seriesRows()),
  upsetLoss: defs("upsetLoss", seriesRows()),
  winStreak: defs("winStreak", [
    ...streakRows(),
    { needs: ["streak", ORG], claim: "bestInRegion" },
    { needs: ["streak", ORG], claim: "dynasty" },
  ]),
  loseStreak: defs("loseStreak", streakRows()),
  signing: defs("signing", [
    { needs: ["player", ORG] },
    { needs: ["player", ORG] },
    { needs: ["player", ORG] },
    { needs: ["player", ORG] },
    { needs: ["player", ORG] },
    { needs: ["player", ORG] },
    { needs: ["player", "fee", ORG] },
    { needs: ["player", "from", ORG] },
  ]),
  sale: defs("sale", [
    { needs: ["player", ORG] },
    { needs: ["player", ORG] },
    { needs: ["player", ORG] },
    { needs: ["player", ORG] },
    { needs: ["player", ORG] },
    { needs: ["player", ORG] },
    { needs: ["player", "to", ORG] },
    { needs: ["player", "fee", ORG] },
  ]),
  titleWon: defs("titleWon", [
    { needs: [EVENT, ORG] },
    { needs: [EVENT, ORG] },
    { needs: [EVENT, ORG] },
    { needs: [EVENT, ORG] },
    { needs: [EVENT, ORG] },
    { needs: [EVENT, ORG] },
    { needs: [EVENT, "titles"], claim: "dynasty" },
    { needs: [EVENT, ORG, "titles"], claim: "firstMajor" },
    { needs: [EVENT, "titles"] },
  ]),
  finalLost: defs("finalLost", [
    { needs: [EVENT, OPP] },
    { needs: [EVENT, ORG] },
    { needs: [OPP, ORG] },
    { needs: [EVENT, OPP] },
    { needs: [EVENT, ORG] },
    { needs: [OPP, EVENT, ORG] },
  ]),
  // Tone x result, two each (v2.3 FIX): after a series, never before one.
  managerPost: defs("managerPost", [
    { needs: [OPP, SCORE], tone: "humble", result: "won" },
    { needs: [OPP, EVENT], tone: "humble", result: "won" },
    { needs: [OPP, SCORE], tone: "humble", result: "lost" },
    { needs: [OPP, EVENT], tone: "humble", result: "lost" },
    { needs: [OPP, SCORE, ORG], tone: "confident", result: "won" },
    { needs: [OPP, EVENT], tone: "confident", result: "won" },
    { needs: [OPP, SCORE, ORG], tone: "confident", result: "lost" },
    { needs: [OPP, EVENT], tone: "confident", result: "lost" },
    { needs: [OPP, SCORE], tone: "provocative", result: "won" },
    { needs: [OPP, EVENT], tone: "provocative", result: "won" },
    { needs: [OPP, SCORE], tone: "provocative", result: "lost" },
    { needs: [OPP, EVENT], tone: "provocative", result: "lost" },
    // rc9 STORIES (R255): managerPost.13 to .57, one per moment x tone x slot row.
    ...momentRows(),
    // rc9 STORIES (R255): .58 to .69, two more for any series per tone x result, so a
    // season's six posts never repeat one (a moment's own two, then these four).
    { needs: [OPP, EVENT], tone: "humble", result: "won" },
    { needs: [OPP, SCORE], tone: "humble", result: "won" },
    { needs: [OPP, EVENT], tone: "humble", result: "lost" },
    { needs: [OPP, SCORE], tone: "humble", result: "lost" },
    { needs: [OPP, EVENT], tone: "confident", result: "won" },
    { needs: [OPP, SCORE], tone: "confident", result: "won" },
    { needs: [OPP, EVENT], tone: "confident", result: "lost" },
    { needs: [OPP, SCORE], tone: "confident", result: "lost" },
    { needs: [OPP, EVENT], tone: "provocative", result: "won" },
    { needs: [OPP, SCORE], tone: "provocative", result: "won" },
    { needs: [OPP, EVENT], tone: "provocative", result: "lost" },
    { needs: [OPP, SCORE], tone: "provocative", result: "lost" },
  ]),
  managerReply: defs("managerReply", [
    { needs: [OPP, ORG], tone: "humble", result: "won" },
    { needs: [OPP, SCORE], tone: "humble", result: "won" },
    { needs: [OPP, ORG], tone: "humble", result: "lost" },
    { needs: [OPP, SCORE], tone: "humble", result: "lost" },
    { needs: [OPP, ORG], tone: "confident", result: "won" },
    { needs: [OPP, SCORE], tone: "confident", result: "won" },
    { needs: [OPP, ORG], tone: "confident", result: "lost" },
    { needs: [OPP, SCORE], tone: "confident", result: "lost" },
    { needs: [OPP, ORG], tone: "provocative", result: "won" },
    { needs: [OPP, SCORE], tone: "provocative", result: "won" },
    { needs: [OPP, ORG], tone: "provocative", result: "lost" },
    { needs: [OPP, ORG, "week"], tone: "provocative", result: "lost" },
    // rc9 STORIES (R257): a third reply per tone x result, so a post gets two different ones.
    { needs: [OPP, EVENT], tone: "humble", result: "won" },
    { needs: [OPP, EVENT], tone: "humble", result: "lost" },
    { needs: [OPP, EVENT], tone: "confident", result: "won" },
    { needs: [OPP, EVENT], tone: "confident", result: "lost" },
    { needs: [OPP, EVENT], tone: "provocative", result: "won" },
    { needs: [OPP, EVENT], tone: "provocative", result: "lost" },
  ]),
  receipt: defs("receipt", [
    { needs: [OPP, ORG] },
    { needs: [OPP, SCORE] },
    { needs: [OPP, EVENT] },
    { needs: [SCORE, ORG] },
    { needs: [OPP, SCORE, EVENT] },
    { needs: [ORG, OPP, EVENT] },
  ]),
};
