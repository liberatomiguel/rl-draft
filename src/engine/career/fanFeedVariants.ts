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
 * - `tone`: the manager's reply variants answer one tone.
 *
 * Keys are `${kind}.${n}`; the copy has exactly these keys, EN and PT.
 */
import type { FanTone, FeedClaim, FeedKind, FeedSlot } from "./fanFeedTypes";

export interface VariantDef {
  key: string;
  needs: readonly FeedSlot[];
  claim?: FeedClaim;
  tone?: FanTone;
}

type Row = { needs: readonly FeedSlot[]; claim?: FeedClaim; tone?: FanTone };

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

export const FEED_VARIANTS: Record<Exclude<FeedKind, "managerPost">, readonly VariantDef[]> = {
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
  managerReply: defs("managerReply", [
    { needs: [OPP, ORG], tone: "humble" },
    { needs: [OPP, "week"], tone: "humble" },
    { needs: [OPP, ORG], tone: "humble" },
    { needs: [OPP, ORG], tone: "confident" },
    { needs: [OPP, ORG, "week"], tone: "confident" },
    { needs: [OPP, ORG], tone: "confident" },
    { needs: [OPP, ORG], tone: "provocative" },
    { needs: [OPP, ORG, "week"], tone: "provocative" },
    { needs: [OPP, ORG], tone: "provocative" },
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

/** The manager's own post: one text per tone (his words, not a fan's), keys "managerPost.<tone>". */
export const MANAGER_POST_KEYS: Record<FanTone, string> = {
  humble: "managerPost.humble",
  confident: "managerPost.confident",
  provocative: "managerPost.provocative",
};
