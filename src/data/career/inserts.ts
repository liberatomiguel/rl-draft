/**
 * Road to Worlds — WEEKLY INSERTS (v2.0, R33): small mid-week decisions that
 * break the "skip to the next tournament" rhythm without adding management
 * depth. Hand-maintained catalog; strings live in the career copy
 * (`inserts.items[id]`). Effects are applied by `resolveInsertFlow`.
 */

export type InsertKind = "random" | "sponsor" | "training";

export interface InsertEffects {
  /** Signed balance change ($). */
  money?: number;
  /** Signed reputation change. */
  rep?: number;
  /** Chemistry credit added to every squad player (splitsTogether units). */
  chemistry?: number;
  /** Bonus (or lost) training-week equivalents for the squad. */
  trainingWeeks?: number;
}

export interface InsertOption {
  key: "a" | "b";
  effects: InsertEffects;
}

export interface InsertDef {
  id: string;
  kind: InsertKind;
  weight: number;
  requires?: { sponsor?: boolean; coach?: boolean; minRep?: number; minBalance?: number };
  options: [InsertOption, InsertOption];
}

export const CAREER_INSERTS_CATALOG: readonly InsertDef[] = [
  { id: "ins-showmatch", kind: "random", weight: 3, options: [
    { key: "a", effects: { money: 1_500, chemistry: 0.05, trainingWeeks: -0.3 } },
    { key: "b", effects: {} },
  ] },
  { id: "ins-charity-cup", kind: "random", weight: 2, options: [
    { key: "a", effects: { rep: 2, money: -500 } },
    { key: "b", effects: {} },
  ] },
  { id: "ins-pc-dies", kind: "random", weight: 2, options: [
    { key: "a", effects: { money: -800 } },
    { key: "b", effects: { trainingWeeks: -0.4 } },
  ] },
  { id: "ins-fan-meetup", kind: "random", weight: 2, requires: { minRep: 15 }, options: [
    { key: "a", effects: { rep: 1, money: -300 } },
    { key: "b", effects: {} },
  ] },
  { id: "ins-media-day", kind: "random", weight: 2, requires: { minRep: 25 }, options: [
    { key: "a", effects: { rep: 1, trainingWeeks: -0.3 } },
    { key: "b", effects: {} },
  ] },
  { id: "ins-sponsor-content", kind: "sponsor", weight: 3, requires: { sponsor: true }, options: [
    { key: "a", effects: { money: 1_200, trainingWeeks: -0.4 } },
    { key: "b", effects: {} },
  ] },
  { id: "ins-sponsor-jersey", kind: "sponsor", weight: 2, requires: { sponsor: true }, options: [
    // rc.34 (ECO-05, S7): every other-income item takes a day from the
    // agenda — the shoot now costs a session like the showmatch and the content day.
    { key: "a", effects: { money: 900, rep: 1, trainingWeeks: -0.2 } },
    { key: "b", effects: {} },
  ] },
  { id: "ins-rest-request", kind: "training", weight: 3, options: [
    { key: "a", effects: { trainingWeeks: -0.3, chemistry: 0.05 } },
    { key: "b", effects: { trainingWeeks: 0.2 } },
  ] },
  { id: "ins-lan-bootcamp", kind: "training", weight: 2, requires: { minBalance: 2_000 }, options: [
    { key: "a", effects: { money: -1_500, trainingWeeks: 0.6, chemistry: 0.1 } },
    { key: "b", effects: {} },
  ] },
  { id: "ins-coach-clinic", kind: "training", weight: 2, requires: { coach: true }, options: [
    { key: "a", effects: { money: -400, trainingWeeks: 0.5 } },
    { key: "b", effects: {} },
  ] },
];

export const insertById = new Map(CAREER_INSERTS_CATALOG.map((i) => [i.id, i]));
