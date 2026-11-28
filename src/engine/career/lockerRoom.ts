/**
 * Road to Worlds — the locker room (v2.3 LOCKER, wave 1; HISTORIAS-SPEC L1–L5,
 * decisions R190–R194; rc9 LOCKER R211–R219). Pure and deterministic: no
 * React, no store, no clock.
 *
 * L1 every player under contract at the user's club has a morale 0–100, read
 *    as five moods; a player (or a save) without an entry reads as neutral.
 *    AI clubs have none. rc9 (R215): the mood a screen shows holds until the
 *    morale is CAREER_LOCKER.moodHysteresis past the next bound.
 * L2 what moves it: playing time (a run of events on the bench), results (a
 *    title, a deep run, a long losing run), the market (put on the list; a
 *    refused bid opens a talk), promises kept or broken. rc9: each Monday the
 *    morale moves part of the way to a target (R211) set by the team's results
 *    against expectation (R212), his own form from the box score (R213) and
 *    his training load (R214). Every change is logged with its reason, and a
 *    change of the shown mood becomes a note (a mail).
 * L3 talks (two or three canned answers; unanswered, the neutral one after
 *    CAREER_LOCKER.talkDays) and promises (`minutes`: starts X of the next Y
 *    events; `stay`: not sold or listed before the window closes), settled by
 *    the game; the manager's word (kept against broken) scales how much a new
 *    promise calms. rc9 (R216): the players ask for things themselves (a
 *    lighter load, more load, a 1v1 / 2v2 cup, a start in the regional), one
 *    new talk per CAREER_LOCKER.asks.gapWeeks at most; an answer's training,
 *    entry or lineup change is returned as an `effect` for the store.
 * L4 low morale for several weeks files a transfer request (a talk: sell,
 *    promise, refuse); morale scales development gain by a small factor both
 *    ways (never a decline, never a stored overall). rc9 (R217): the shown
 *    mood moves the user team's rating in an official event by a bounded,
 *    temporary amount (`lockerMatchBonusOf`).
 * L5 `lockerIssuesOf` and `seedInheritedLockerRoom` for the takeover mode.
 *
 * The store (`store/lockerRoomFlow.ts`) derives the facts of a write from the
 * save before and after it and turns the notes into mail.
 */

import { CAREER_LOCKER as L } from "@/config/balance.lockerRoom";
import { FEATURES } from "@/config/balance";
import type { Rng } from "@/lib/rng";
import type { Placement } from "../types";
import { windowCloseDayFor } from "./calendar";
import type { LoadKind, SeriesFact } from "./lockerRoomFacts";
import { surpriseOf } from "./lockerRoomFacts";
import { derivedFloat, streams } from "./seeds";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export type MoodId = "angry" | "unhappy" | "neutral" | "content" | "delighted";

export type MoraleReason =
  | "bench"
  | "played"
  | "backInSide"
  | "title"
  | "deepRun"
  | "losingRun"
  | "listed"
  | "promiseMade"
  | "promiseKept"
  | "promiseBroken"
  | "teammateBroken"
  | "blunt"
  | "refused"
  | "agreedSale"
  | "settling"
  | "inherited"
  | "mediaFatigue" // v2.3 MEDIA
  // rc9 LOCKER
  | "goodResults"
  | "poorResults"
  | "goodForm"
  | "poorForm"
  | "heavyLoad"
  | "rested"
  | "heard"
  | "passedOver"
  | "madeWay"
  | "sideEvent";

export interface LockerDate {
  seasonIndex: number;
  day: number;
}

export interface LockerPlayerState {
  morale: number;
  /** Events the club played in a row without him in the lineup. */
  benchRun: number;
  /** Weekly ticks in a row under CAREER_LOCKER.requestBelow. */
  lowWeeks: number;
  /** No new transfer request before this absolute week. */
  requestCooldownUntil?: number;
  /** He asked to leave and the manager agreed: listing him costs nothing. */
  agreedSale?: true;
  /** The last change and its reason (wave 2's mood chip reads it). */
  last?: { reason: MoraleReason; delta: number; on: LockerDate };
  /** rc9 (R213): his form memory, box-score rating points against the lineup's mean. */
  form?: number;
  /** rc9 (R214): his training load count (heavy weeks, minus recovery). */
  load?: number;
  /** rc9 (R215): the mood a screen shows (held by the hysteresis). Absent = the mood of his morale. */
  mood?: MoodId;
  /** rc9 (R216): the absolute week he last asked for something. */
  askedWeek?: number;
}

export type PromiseKind = "minutes" | "stay";

export interface LockerPromise {
  id: string;
  playerId: string;
  kind: PromiseKind;
  made: LockerDate;
  /** stay: the window's last day · minutes: the day it lapses if too few events were played. */
  deadline: LockerDate;
  /** minutes: starts `need` of the next `of` events. */
  need?: number;
  of?: number;
  started?: number;
  seen?: number;
  /** L5: left by the previous manager. */
  inherited?: true;
}

export type TalkTopic = "bench" | "bid" | "request" | "load" | "more" | "side" | "start"; // rc9: load, more, side, start
export type TalkAnswer =
  | "promiseMinutes"
  | "promiseStay"
  | "earnIt"
  | "focus"
  | "blunt"
  | "sell"
  | "refuse"
  // rc9 LOCKER
  | "lighten"
  | "keepLoad"
  | "pushHim"
  | "holdBack"
  | "enterHim"
  | "passCup"
  | "startHim"
  | "notYet";

export interface LockerTalk {
  id: string;
  playerId: string;
  topic: TalkTopic;
  answers: TalkAnswer[];
  /** The answer an unanswered talk resolves with. */
  neutral: TalkAnswer;
  opened: LockerDate;
  deadline: LockerDate;
  /** Which of the copy's wordings (seeded). */
  variant: number;
  /** Set once answered; `auto` when it resolved itself. */
  answer?: TalkAnswer;
  auto?: true;
  /** rc9: what the talk is about (the cup's event id and size, the regional and the starter who would make way). */
  params?: Record<string, string | number>;
}

export interface LockerLogEntry {
  playerId: string;
  reason: MoraleReason;
  delta: number;
  morale: number;
  on: LockerDate;
}

/** The one additive field on the career save (`CareerSave.lockerRoom`). */
export interface LockerRoomState {
  v: 1;
  players: Record<string, LockerPlayerState>;
  promises: LockerPromise[];
  /** Open talks, then the most recent answered ones (the inbox shows the answer). */
  talks: LockerTalk[];
  word: { kept: number; broken: number };
  /** Poor events in a row (CAREER_LOCKER.poorPlacements). */
  losingRun: number;
  /** Id counter for promises and talks. */
  seq: number;
  log: LockerLogEntry[];
  /** rc9 (R212): the team's results memory (series won above expectation, decayed). */
  results?: number;
  /** rc9 (R216): the absolute week of the last new talk. */
  lastAskWeek?: number;
  /** rc9: recently settled events (`season:eventId`), so a write seen twice never counts one twice. */
  doneEvents?: string[];
  /** rc9 (R216): a reserve starts one event in a starter's place; the store swaps them back after it. */
  swap?: { eventId: string; inId: string; outId: string; day: LockerDate };
}

/** What a step reports for the inbox. */
export type LockerNote =
  | { kind: "mood"; reason: MoraleReason; changes: { playerId: string; mood: MoodId }[] }
  | { kind: "talk"; talkId: string; playerId: string; topic: TalkTopic; variant: number; params?: Record<string, string | number> }
  | { kind: "talkAuto"; talkId: string; playerId: string; topic: TalkTopic; answer: TalkAnswer }
  | { kind: "promiseKept" | "promiseBroken"; playerId: string; promise: PromiseKind; inherited: boolean }
  /** rc9: the event a reserve started is over: the store puts the starter back. */
  | { kind: "swapBack"; inId: string; outId: string };

export interface LockerSquadMember {
  id: string;
  overall: number;
}

/** The facts of one store write, derived from the save before and after it. */
export interface LockerStepInput {
  clock: LockerDate;
  careerSeed: number;
  /** The contracted squad after the write. */
  squad: LockerSquadMember[];
  /** Squad players gone in this write; `sold` = sold or traded away. */
  departed?: { id: string; sold: boolean }[];
  /** Put on the transfer list in this write. */
  listed?: string[];
  /** An AI bid for him refused in this write. */
  bidsRefused?: string[];
  /**
   * Events the club finished in this write, oldest first, with the lineup that played them.
   * rc9: `key` dedupes; `series` (R212) and `favourite` come from the tournament;
   * `side` = a 1v1 / 2v2 cup (its lineup are the participants).
   */
  events?: {
    eventId: string;
    tier: string;
    placement?: Placement;
    lineup: string[];
    key?: string;
    series?: SeriesFact[];
    favourite?: boolean;
    side?: boolean;
  }[];
  /** Weekly ticks crossed (Mondays). */
  weeks?: number;
  /** rc9 (R213): box-score games and rating sum each player added in this write. */
  box?: Record<string, { games: number; ratingSum: number }>;
  /** rc9 (R214): each player's training load in the week that ended (read with `weeks`). */
  loads?: Record<string, LoadKind>;
  /** rc9 (R216): the starters now. */
  starters?: string[];
  /** rc9 (R216): a 1v1 / 2v2 cup surfaced in this write. */
  sideOffer?: { eventId: string; teamSize: number; day: number };
  /** rc9 (R216): an official event became the club's next one in this write. */
  nextOfficial?: { eventId: string; tier: string; day: number };
}

/** rc9 (R216): what an answer asks the store to do. */
export type LockerEffect =
  | "list"
  | { kind: "load"; playerId: string; workload: "light" | "heavy" }
  | { kind: "enterSide"; playerId: string; eventId: string }
  | { kind: "startSub"; inId: string; outId: string; eventId: string };

export interface LockerStepResult {
  state: LockerRoomState;
  notes: LockerNote[];
}

export function emptyLockerRoom(): LockerRoomState {
  return { v: 1, players: {}, promises: [], talks: [], word: { kept: 0, broken: 0 }, losingRun: 0, seq: 0, log: [] };
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** L1: a player's morale; no state or no entry = neutral. */
export function moraleOf(state: LockerRoomState | null | undefined, playerId: string): number {
  return state?.players[playerId]?.morale ?? L.neutral;
}

export function moodOf(morale: number): MoodId {
  let mood: MoodId = L.moods[0].id;
  for (const m of L.moods) if (morale >= m.from) mood = m.id;
  return mood;
}

const MOOD_ORDER: readonly MoodId[] = L.moods.map((m) => m.id as MoodId);

/**
 * rc9 (R215): the mood shown after a change of morale. It leaves `held` only
 * when the morale is `moodHysteresis` past the bound it crosses (a jump of
 * two moods lands where the morale says).
 */
export function heldMoodOf(held: MoodId | undefined, morale: number): MoodId {
  const raw = moodOf(morale);
  if (!held || held === raw) return raw;
  const hi = MOOD_ORDER.indexOf(raw);
  const was = MOOD_ORDER.indexOf(held);
  if (Math.abs(hi - was) > 1) return raw;
  const h = L.moodHysteresis;
  if (hi > was) return morale >= L.moods[hi].from + h ? raw : held;
  return morale < L.moods[was].from - h ? raw : held;
}

/** rc9 (R215): the mood a screen shows for a player (no entry = neutral). */
export function shownMoodOf(state: LockerRoomState | null | undefined, playerId: string): MoodId {
  const p = state?.players[playerId];
  if (!p) return moodOf(L.neutral);
  return p.mood ?? moodOf(p.morale);
}

/** L3: (kept + 1) / (kept + broken + 2) — a new manager sits at 0.5. */
export function credibilityOf(word: { kept: number; broken: number }): number {
  return (word.kept + 1) / (word.kept + word.broken + 2);
}

/** L3: how much a new promise calms, × CAREER_LOCKER.promise.calm. 1 for a new manager. */
export function wordMultiplierOf(word: { kept: number; broken: number }): number {
  const f = L.word.floor;
  return clamp((credibilityOf(word) - f) / (0.5 - f), 0, L.word.maxMult);
}

/** L4: the development factor of a morale (trainingMin at 0, 1 at neutral, trainingMax at 100). */
export function trainingFactorFor(morale: number): number {
  const m = clamp(morale, L.min, L.max);
  if (m >= L.neutral) return 1 + ((m - L.neutral) / (L.max - L.neutral)) * (L.trainingMax - 1);
  return 1 - ((L.neutral - m) / (L.neutral - L.min)) * (1 - L.trainingMin);
}

/**
 * L4: the per-player factors `development.growthCtxOf` passes to a tick, or
 * nothing (flag off, no state, everyone neutral) — so a tick without them is
 * the old tick, bit for bit.
 */
export function moraleTrainingCtxOf(state: LockerRoomState | null | undefined): { moraleFactors?: Record<string, number> } {
  if (!FEATURES.lockerRoom || !state) return {};
  const out: Record<string, number> = {};
  let any = false;
  for (const [id, p] of Object.entries(state.players)) {
    if (p.morale === L.neutral) continue;
    out[id] = trainingFactorFor(p.morale);
    any = true;
  }
  return any ? { moraleFactors: out } : {};
}

/**
 * L4 (wave 1): the per-50-morale match tunable `matchEffect`, which ships at 0.
 * rc9: superseded by the mood table (`moodMatchEffectOf`, `lockerMatchBonusOf`);
 * kept for the names that call it.
 */
export function matchMoraleEffectOf(morale: number): number {
  if (L.matchEffect === 0) return 0;
  return ((clamp(morale, L.min, L.max) - L.neutral) / 50) * L.matchEffect;
}

/** rc9 (R217): the rating points one fielded player's shown mood carries (0 with the effect off). */
export function moodMatchEffectOf(mood: MoodId): number {
  if (!L.match.enabled) return 0;
  return L.match.byMood[mood] ?? 0;
}

/**
 * rc9 (R217): the user team's match bonus for an official three-player event:
 * the mean of the fielded players' mood effects, clamped to teamMin..teamMax,
 * the negative side × firstSeasonNegScale in the save's first season, the
 * positive side × dynastyPosScale for a recent Worlds champion. 0 with
 * the flag off, no state or the effect off. Rounded to 0.01. Temporary: it
 * rides the team's flat rating channel for that event only.
 */
export function lockerMatchBonusOf(
  state: LockerRoomState | null | undefined,
  fieldedIds: readonly string[],
  ctx: { firstSeason: boolean; dynasty?: boolean },
): number {
  if (!FEATURES.lockerRoom || !state || !L.match.enabled || fieldedIds.length === 0) return 0;
  const sum = fieldedIds.reduce((n, id) => n + moodMatchEffectOf(shownMoodOf(state, id)), 0);
  let bonus = clamp(sum / fieldedIds.length, L.match.teamMin, L.match.teamMax);
  if (bonus < 0 && ctx.firstSeason) bonus *= L.match.firstSeasonNegScale;
  if (bonus > 0 && ctx.dynasty) bonus *= L.match.dynastyPosScale;
  return Math.round(bonus * 100) / 100 || 0;
}

export function openTalksOf(state: LockerRoomState | null | undefined): LockerTalk[] {
  return (state?.talks ?? []).filter((t) => t.answer === undefined);
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

const DAYS_PER_SEASON = 32 * 7;
const absDay = (d: LockerDate): number => d.seasonIndex * DAYS_PER_SEASON + d.day;
const fromAbsDay = (n: number): LockerDate => ({ seasonIndex: Math.floor((n - 1) / DAYS_PER_SEASON), day: ((n - 1) % DAYS_PER_SEASON) + 1 });
const absWeek = (d: LockerDate): number => Math.floor(absDay(d) / 7);

/** The last day of the transfer window open now, or of the next one. */
export function stayDeadlineFrom(clock: LockerDate): LockerDate {
  for (const idx of [0, 1, 2, 3] as const) {
    const close = windowCloseDayFor(idx);
    if (close >= clock.day) return { seasonIndex: clock.seasonIndex, day: close };
  }
  return { seasonIndex: clock.seasonIndex + 1, day: windowCloseDayFor(0) };
}

// ---------------------------------------------------------------------------
// The working step
// ---------------------------------------------------------------------------

const TALKS: Record<TalkTopic, { answers: TalkAnswer[]; neutral: TalkAnswer }> = {
  bench: { answers: ["promiseMinutes", "earnIt", "blunt"], neutral: "earnIt" },
  bid: { answers: ["promiseStay", "promiseMinutes", "focus"], neutral: "focus" },
  request: { answers: ["sell", "promiseMinutes", "refuse"], neutral: "refuse" },
  // rc9 LOCKER (R216): the yes first, the neutral (no change to the plan) last.
  load: { answers: ["lighten", "keepLoad"], neutral: "keepLoad" },
  more: { answers: ["pushHim", "holdBack"], neutral: "holdBack" },
  side: { answers: ["enterHim", "passCup"], neutral: "passCup" },
  start: { answers: ["startHim", "notYet"], neutral: "notYet" },
};

class Step {
  readonly notes: LockerNote[] = [];
  private readonly before = new Map<string, MoodId>();
  private readonly lastReason = new Map<string, MoraleReason>();
  readonly st: LockerRoomState;
  readonly clock: LockerDate;
  readonly careerSeed: number;

  constructor(st: LockerRoomState, clock: LockerDate, careerSeed: number) {
    this.st = st;
    this.clock = clock;
    this.careerSeed = careerSeed;
  }

  entry(id: string): LockerPlayerState {
    let p = this.st.players[id];
    if (!p) {
      p = { morale: L.neutral, benchRun: 0, lowWeeks: 0 };
      this.st.players[id] = p;
    }
    if (!this.before.has(id)) this.before.set(id, p.mood ?? moodOf(p.morale));
    return p;
  }

  /** Move a morale (clamped to `floor`..max when a floor is given) and log the reason. */
  move(id: string, delta: number, reason: MoraleReason, floor: number = L.min): void {
    const p = this.entry(id);
    const lo = Math.min(p.morale, floor);
    const next = clamp(Math.round(p.morale + delta), Math.max(L.min, lo), L.max);
    const applied = next - p.morale;
    if (applied === 0) return;
    p.morale = next;
    p.last = { reason, delta: applied, on: { ...this.clock } };
    this.lastReason.set(id, reason);
    this.st.log.unshift({ playerId: id, reason, delta: applied, morale: next, on: { ...this.clock } });
    if (this.st.log.length > L.logCap) this.st.log.length = L.logCap;
  }

  nextId(prefix: string): string {
    this.st.seq += 1;
    return `${prefix}:${this.st.seq}`;
  }

  hasOpenTalk(id: string): boolean {
    return this.st.talks.some((t) => t.playerId === id && t.answer === undefined);
  }

  openPromise(id: string, kind: PromiseKind): LockerPromise | undefined {
    return this.st.promises.find((p) => p.playerId === id && p.kind === kind);
  }

  /** rc9 (R216): may this player open a new talk now (the squad's gap, his cooldown, nothing open)? */
  canAsk(id: string): boolean {
    if (this.hasOpenTalk(id)) return false;
    const week = absWeek(this.clock);
    if (this.st.lastAskWeek !== undefined && week - this.st.lastAskWeek < L.asks.gapWeeks) return false;
    const p = this.st.players[id];
    if (p?.askedWeek !== undefined && week - p.askedWeek < L.asks.playerCooldownWeeks) return false;
    return true;
  }

  /** A seeded roll for an ask (per topic, player and week). */
  roll(topic: string, id: string): number {
    return derivedFloat(this.careerSeed, streams.gen("lockerAsk", `${topic}:${id}:${absWeek(this.clock)}`));
  }

  openTalk(playerId: string, topic: TalkTopic, opts: { deadline?: LockerDate; params?: Record<string, string | number> } = {}): void {
    if (this.hasOpenTalk(playerId)) return;
    const { answers, neutral } = TALKS[topic];
    const id = this.nextId("talk");
    const variant = Math.floor(derivedFloat(this.careerSeed, streams.gen("lockerTalk", `${id}:${playerId}`)) * 3);
    this.st.talks.unshift({
      id,
      playerId,
      topic,
      answers: [...answers],
      neutral,
      opened: { ...this.clock },
      deadline: opts.deadline ?? fromAbsDay(absDay(this.clock) + L.talkDays),
      variant,
      ...(opts.params ? { params: opts.params } : {}),
    });
    // rc9 (R216): every talk but a refused bid's counts against the squad's gap.
    if (topic !== "bid") {
      const week = absWeek(this.clock);
      this.st.lastAskWeek = week;
      this.entry(playerId).askedWeek = week;
    }
    this.notes.push({ kind: "talk", talkId: id, playerId, topic, variant, ...(opts.params ? { params: opts.params } : {}) });
  }

  settle(promise: LockerPromise, kept: boolean, squad: readonly LockerSquadMember[]): void {
    this.st.promises = this.st.promises.filter((p) => p.id !== promise.id);
    if (kept) {
      this.st.word.kept += 1;
      if (squad.some((m) => m.id === promise.playerId)) this.move(promise.playerId, L.promise.kept, "promiseKept");
    } else {
      this.st.word.broken += 1;
      if (squad.some((m) => m.id === promise.playerId)) this.move(promise.playerId, -L.promise.broken, "promiseBroken");
      for (const m of squad) if (m.id !== promise.playerId) this.move(m.id, -L.promise.brokenSquad, "teammateBroken");
    }
    this.notes.push({ kind: kept ? "promiseKept" : "promiseBroken", playerId: promise.playerId, promise: promise.kind, inherited: Boolean(promise.inherited) });
  }

  /** Shown-mood changes (R215), grouped by the reason that moved each player last. */
  finish(): LockerStepResult {
    const byReason = new Map<MoraleReason, { playerId: string; mood: MoodId }[]>();
    for (const [id, was] of this.before) {
      const p = this.st.players[id];
      if (!p) continue;
      // The shown mood is stored only while it differs from the mood of the morale (absent = that mood).
      const now = heldMoodOf(was, p.morale);
      if (now === moodOf(p.morale)) delete p.mood;
      else p.mood = now;
      const reason = this.lastReason.get(id);
      if (now === was || !reason) continue;
      const list = byReason.get(reason) ?? [];
      list.push({ playerId: id, mood: now });
      byReason.set(reason, list);
    }
    const moods: LockerNote[] = [...byReason].map(([reason, changes]) => ({ kind: "mood", reason, changes }));
    // Answered talks beyond the newest few are pruned (open ones always stay).
    const open = this.st.talks.filter((t) => t.answer === undefined);
    const closed = this.st.talks.filter((t) => t.answer !== undefined).slice(0, 12);
    this.st.talks = [...open, ...closed];
    return { state: this.st, notes: [...this.notes, ...moods] };
  }
}

// ---------------------------------------------------------------------------
// L2–L4: one write's facts
// ---------------------------------------------------------------------------

const DEEP_RUN: readonly string[] = ["runner_up", "third", "fourth", "top4"];

/**
 * Apply one store write's facts to the locker room: departures, listings,
 * refused bids, box-score form, events played, weekly ticks, the players' own
 * requests, then whatever fell due (a promise's deadline, an unanswered
 * talk). Pure: the input state is cloned.
 */
export function lockerStep(input: LockerRoomState, facts: LockerStepInput): LockerStepResult {
  const step = new Step(structuredClone(input), facts.clock, facts.careerSeed);
  const st = step.st;
  const squad = facts.squad;
  const inSquad = new Set(squad.map((m) => m.id));

  // Departures: a sale breaks every promise to him; any other exit drops them quietly.
  for (const d of facts.departed ?? []) {
    for (const p of st.promises.filter((x) => x.playerId === d.id)) {
      if (d.sold) step.settle(p, false, squad);
      else st.promises = st.promises.filter((x) => x.id !== p.id);
    }
    st.talks = st.talks.filter((t) => t.playerId !== d.id);
    delete st.players[d.id];
    if (st.swap && (st.swap.inId === d.id || st.swap.outId === d.id)) delete st.swap;
  }

  // The market: listed (unless he asked to go), a stay promise broken.
  for (const id of facts.listed ?? []) {
    if (!inSquad.has(id)) continue;
    const stay = step.openPromise(id, "stay");
    if (stay) step.settle(stay, false, squad);
    if (st.players[id]?.agreedSale) continue;
    step.move(id, -L.listedDrop, "listed");
  }
  for (const id of facts.bidsRefused ?? []) {
    if (inSquad.has(id) && !step.openPromise(id, "stay")) step.openTalk(id, "bid");
  }

  // rc9 (R213): form from the box score — his mean rating in this write's games against the lineup's.
  const box = Object.entries(facts.box ?? {}).filter(([id, b]) => inSquad.has(id) && b.games > 0);
  if (box.length > 1) {
    const avgs = box.map(([id, b]) => [id, b.ratingSum / b.games] as const);
    const mean = avgs.reduce((n, [, a]) => n + a, 0) / avgs.length;
    for (const [id, a] of avgs) {
      const p = step.entry(id);
      p.form = round2((p.form ?? 0) * L.form.decay + (a - mean) * (1 - L.form.decay));
    }
  }

  // Events played.
  for (const ev of facts.events ?? []) {
    if (ev.key) {
      if (st.doneEvents?.includes(ev.key)) continue;
      st.doneEvents = [ev.key, ...(st.doneEvents ?? [])].slice(0, L.doneEventsCap);
    }
    if (ev.side) {
      // rc9 (R216): a 1v1 / 2v2 cup — only its participants, and never the club's results.
      for (const id of ev.lineup) {
        if (!inSquad.has(id)) continue;
        step.move(id, L.sideEvent.played + (ev.placement === "champion" ? L.sideEvent.champion : 0), "sideEvent");
      }
      continue;
    }
    const lineup = new Set(ev.lineup.filter((id) => inSquad.has(id)));
    const fielded = squad.filter((m) => lineup.has(m.id));
    const weakest = fielded.length ? Math.min(...fielded.map((m) => m.overall)) : Infinity;
    for (const m of squad) {
      const p = step.entry(m.id);
      const minutes = step.openPromise(m.id, "minutes");
      if (minutes) {
        minutes.seen = (minutes.seen ?? 0) + 1;
        if (lineup.has(m.id)) minutes.started = (minutes.started ?? 0) + 1;
      }
      if (lineup.has(m.id)) {
        step.move(m.id, p.benchRun >= L.benchRunTalk ? L.backInSide : L.played, p.benchRun >= L.benchRunTalk ? "backInSide" : "played");
        p.benchRun = 0;
      } else {
        p.benchRun += 1;
        const expects = m.overall >= weakest;
        step.move(m.id, -L.benchDrop, "bench", expects ? L.min : L.benchFloorReserve);
        // A reserve who does not expect to start does not ask for the talk. rc9: from the Nth bench on, inside the gap.
        if (p.benchRun >= L.benchRunTalk && !minutes && expects && step.canAsk(m.id)) step.openTalk(m.id, "bench");
      }
      if (minutes) {
        const need = minutes.need ?? L.promise.minutesNeed;
        const of = minutes.of ?? L.promise.minutesOf;
        const started = minutes.started ?? 0;
        const benched = (minutes.seen ?? 0) - started;
        if (started >= need) step.settle(minutes, true, squad);
        else if (benched > of - need) step.settle(minutes, false, squad);
      }
    }
    const placement = ev.placement;
    if (placement === "champion" && L.titleTiers.includes(ev.tier)) {
      // rc9 (R212): a title the favourite was expected to win lifts less.
      const lift = ev.favourite ? Math.round(L.titleLift * L.favouriteTitleShare) : L.titleLift;
      for (const m of squad) step.move(m.id, lift, "title");
    } else if (placement && DEEP_RUN.includes(placement) && L.deepRunTiers.includes(ev.tier) && !ev.favourite) {
      // rc9 (R212): a deep run is news only for a side that was not the favourite.
      for (const m of squad) step.move(m.id, L.deepRunLift, "deepRun");
    }
    const poor = !placement || L.poorPlacements.includes(placement);
    st.losingRun = poor ? st.losingRun + 1 : 0;
    if (poor && st.losingRun >= L.losingRunFrom) for (const m of squad) step.move(m.id, -L.losingRunDrop, "losingRun");
    // rc9 (R212): the results memory, from the series against what the ratings expected.
    // A favourite beating the ratings counts × favouriteUpShare: the top side of a field wins more than p says.
    if (ev.series && ev.series.length > 0) {
      const surprise = surpriseOf(ev.series);
      const counted = surprise > 0 && ev.favourite ? surprise * L.results.favouriteUpShare : surprise;
      st.results = round2((st.results ?? 0) * L.results.decay + counted);
    }
    // rc9 (R216): the reserve who started this event goes back to the bench.
    if (st.swap && st.swap.eventId === ev.eventId) {
      step.notes.push({ kind: "swapBack", inId: st.swap.inId, outId: st.swap.outId });
      delete st.swap;
    }
  }

  // Weekly ticks: the pull toward the target (R211), then the transfer request.
  const weeks = Math.min(facts.weeks ?? 0, L.maxWeeksPerCall);
  const nowWeek = absWeek(facts.clock);
  for (let w = 0; w < weeks; w++) {
    if (st.results !== undefined) st.results = round2(st.results * L.results.weeklyDecay);
    for (const m of squad) {
      const p = step.entry(m.id);
      const kind = facts.loads?.[m.id] ?? "normal";
      weeklyLoad(p, kind);
      if (p.form !== undefined) p.form = round2(p.form * L.form.weeklyDecay);
      const sulking = p.benchRun >= L.benchRunTalk && p.morale < L.neutral;
      const { target, up, down } = targetOf(st, p, kind);
      const gap = target - p.morale;
      if (Math.abs(gap) >= L.pull.minGap && !(sulking && gap > 0)) {
        const delta = Math.sign(gap) * Math.max(1, Math.round(Math.abs(gap) * L.pull.share));
        step.move(m.id, delta, gap > 0 ? up : down);
      }
      p.lowWeeks = p.morale < L.requestBelow ? p.lowWeeks + 1 : 0;
      const cooled = (p.requestCooldownUntil ?? -Infinity) <= nowWeek;
      if (p.lowWeeks >= L.requestWeeks && cooled && !p.agreedSale && step.canAsk(m.id)) {
        step.openTalk(m.id, "request");
        p.lowWeeks = 0;
      }
    }
  }
  if (weeks > 0) weeklyAsks(step, facts);

  // rc9 (R216): asks about what is coming — a 1v1 / 2v2 cup, a start in the regional.
  if (facts.sideOffer) sideAsk(step, facts, facts.sideOffer);
  if (facts.nextOfficial && L.asks.startTiers.includes(facts.nextOfficial.tier)) startAsk(step, facts, facts.nextOfficial);

  settleDue(step, squad);
  return step.finish();
}

/** R214: a week of training load. */
function weeklyLoad(p: LockerPlayerState, kind: LoadKind): void {
  const load = p.load ?? 0;
  const next = kind === "heavy" ? load + 1 : kind === "normal" ? load - 1 : load - L.load.lightRecovery;
  if (next > 0) p.load = next;
  else delete p.load;
}

/**
 * R211: the morale a player is pulled toward this week, with the reason for a
 * move up and for a move down (the biggest part pointing that way).
 */
function targetOf(st: LockerRoomState, p: LockerPlayerState, kind: LoadKind): { target: number; up: MoraleReason; down: MoraleReason } {
  const resShare = p.benchRun > 0 ? L.results.benchShare : 1;
  const parts: [MoraleReason, MoraleReason, number][] = [
    ["goodResults", "poorResults", clamp((st.results ?? 0) * L.results.perUnit * resShare, -L.results.cap, L.results.cap)],
    ["goodForm", "poorForm", clamp((p.form ?? 0) * L.form.perPoint, -L.form.cap, L.form.cap)],
    ["rested", "heavyLoad", -Math.min(L.load.cap, Math.max(0, (p.load ?? 0) - L.load.toleranceWeeks) * L.load.perWeek)],
    ["rested", "heavyLoad", kind === "light" || kind === "rest" ? L.load.restLift : 0],
  ];
  let up: MoraleReason = "settling";
  let down: MoraleReason = "settling";
  let best = 0;
  let worst = 0;
  let sum = 0;
  for (const [u, d, v] of parts) {
    sum += v;
    // A part names the move only when it is big enough to be the cause (else the move is time settling him).
    if (v > best && v >= L.pull.reasonFrom) [best, up] = [v, u];
    if (v < worst && v <= -L.pull.reasonFrom) [worst, down] = [v, d];
  }
  return { target: Math.round(L.neutral + sum), up, down };
}

/** R216: the weekly asks — a lighter load for a tired player, more load for one who feels good. */
function weeklyAsks(step: Step, facts: LockerStepInput): void {
  const squad = [...facts.squad].sort((a, b) => a.id.localeCompare(b.id));
  for (const m of squad) {
    const p = step.st.players[m.id];
    if (!p || !step.canAsk(m.id)) continue;
    if ((p.load ?? 0) >= L.asks.loadAt && facts.loads?.[m.id] === "heavy") {
      step.openTalk(m.id, "load");
      return;
    }
  }
  for (const m of squad) {
    const p = step.st.players[m.id];
    const kind = facts.loads?.[m.id] ?? "normal";
    if (!p || !step.canAsk(m.id) || p.morale < L.asks.moreFrom || (p.form ?? 0) < 0 || (p.load ?? 0) > 0) continue;
    if (kind !== "normal" && kind !== "light") continue;
    if (step.roll("more", m.id) < L.asks.moreChance) {
      step.openTalk(m.id, "more");
      return;
    }
  }
}

/** R216: a 1v1 / 2v2 cup surfaced — a squad player asks to play it (the one who has played least). */
function sideAsk(step: Step, facts: LockerStepInput, offer: NonNullable<LockerStepInput["sideOffer"]>): void {
  const starters = new Set(facts.starters ?? []);
  const pool = facts.squad
    .filter((m) => step.canAsk(m.id))
    .sort((a, b) => Number(starters.has(a.id)) - Number(starters.has(b.id)) || (step.st.players[b.id]?.benchRun ?? 0) - (step.st.players[a.id]?.benchRun ?? 0) || a.id.localeCompare(b.id));
  const who = pool[0];
  if (!who || step.roll("side", `${who.id}:${offer.eventId}`) >= L.asks.sideChance) return;
  step.openTalk(who.id, "side", {
    deadline: { seasonIndex: facts.clock.seasonIndex, day: Math.max(facts.clock.day, offer.day - 1) },
    params: { eventId: offer.eventId, size: offer.teamSize },
  });
}

/** R216: the regional is next — a reserve who has sat out asks to start it in the weakest starter's place. */
function startAsk(step: Step, facts: LockerStepInput, next: NonNullable<LockerStepInput["nextOfficial"]>): void {
  const starters = (facts.starters ?? []).map((id) => facts.squad.find((m) => m.id === id)).filter((m): m is LockerSquadMember => Boolean(m));
  if (starters.length < 3 || step.st.swap) return;
  const weakest = starters.slice().sort((a, b) => a.overall - b.overall || a.id.localeCompare(b.id))[0];
  const pool = facts.squad
    .filter((m) => !starters.some((s) => s.id === m.id))
    .filter((m) => (step.st.players[m.id]?.benchRun ?? 0) >= L.asks.startBenchRun && m.overall >= weakest.overall - L.asks.startGap)
    .filter((m) => step.canAsk(m.id) && !step.openPromise(m.id, "minutes"))
    .sort((a, b) => b.overall - a.overall || a.id.localeCompare(b.id));
  const who = pool[0];
  if (!who || step.roll("start", `${who.id}:${next.eventId}`) >= L.asks.startChance) return;
  step.openTalk(who.id, "start", {
    deadline: { seasonIndex: facts.clock.seasonIndex, day: Math.max(facts.clock.day, next.day) },
    params: { eventId: next.eventId, outId: weakest.id, day: next.day },
  });
}

/** Deadlines: a stay promise past its window is kept; a minutes promise past its lapse day lapses; a talk past its day answers itself. */
function settleDue(step: Step, squad: readonly LockerSquadMember[]): void {
  const st = step.st;
  const today = absDay(step.clock);
  // rc9: a one-event swap whose event never came (skipped, or the season moved on) is dropped.
  if (st.swap && today > absDay(st.swap.day) + 7) delete st.swap;
  for (const p of [...st.promises]) {
    if (today <= absDay(p.deadline)) continue;
    if (p.kind === "stay") step.settle(p, true, squad);
    else st.promises = st.promises.filter((x) => x.id !== p.id); // too few events to judge: it lapses, no word either way
  }
  for (const t of st.talks.filter((x) => x.answer === undefined && today >= absDay(x.deadline))) {
    applyAnswer(step, t, t.neutral, squad);
    t.auto = true;
    step.notes.push({ kind: "talkAuto", talkId: t.id, playerId: t.playerId, topic: t.topic, answer: t.neutral });
  }
}

function applyAnswer(step: Step, talk: LockerTalk, answer: TalkAnswer, squad: readonly LockerSquadMember[]): LockerEffect | null {
  const st = step.st;
  talk.answer = answer;
  const id = talk.playerId;
  if (!squad.some((m) => m.id === id)) return null;
  const p = step.entry(id);
  const calm = Math.round(L.promise.calm * wordMultiplierOf(st.word));
  const cooldown = () => {
    p.requestCooldownUntil = absWeek(step.clock) + L.requestCooldownWeeks;
    p.lowWeeks = 0;
  };
  let effect: LockerEffect | null = null;
  switch (answer) {
    case "promiseMinutes":
      if (!step.openPromise(id, "minutes")) {
        st.promises.push({
          id: step.nextId("promise"),
          playerId: id,
          kind: "minutes",
          made: { ...step.clock },
          deadline: fromAbsDay(absDay(step.clock) + L.promise.minutesMaxDays),
          need: L.promise.minutesNeed,
          of: L.promise.minutesOf,
          started: 0,
          seen: 0,
        });
      }
      p.benchRun = 0;
      step.move(id, calm, "promiseMade");
      if (talk.topic === "request") cooldown();
      break;
    case "promiseStay":
      if (!step.openPromise(id, "stay")) {
        st.promises.push({ id: step.nextId("promise"), playerId: id, kind: "stay", made: { ...step.clock }, deadline: stayDeadlineFrom(step.clock) });
      }
      step.move(id, calm, "promiseMade");
      break;
    case "blunt":
      step.move(id, -L.bluntDrop, "blunt");
      break;
    case "refuse":
      step.move(id, -L.refuseDrop, "refused");
      cooldown();
      break;
    case "sell":
      p.agreedSale = true;
      step.move(id, L.agreedSaleLift, "agreedSale");
      cooldown();
      effect = "list";
      break;
    // rc9 LOCKER (R216): the players' requests. The training, entry or lineup change is the store's.
    case "lighten":
      step.move(id, L.answers.heard, "heard");
      effect = { kind: "load", playerId: id, workload: "light" };
      break;
    case "pushHim":
      step.move(id, L.answers.heard, "heard");
      effect = { kind: "load", playerId: id, workload: "heavy" };
      break;
    case "keepLoad":
      step.move(id, -L.answers.passedOver, "passedOver");
      break;
    case "holdBack":
      step.move(id, -L.answers.heldBack, "passedOver");
      break;
    case "enterHim":
      step.move(id, L.answers.heard, "heard");
      effect = { kind: "enterSide", playerId: id, eventId: String(talk.params?.eventId ?? "") };
      break;
    case "passCup":
      step.move(id, -L.answers.passedOver, "passedOver");
      break;
    case "startHim": {
      const outId = String(talk.params?.outId ?? "");
      const eventId = String(talk.params?.eventId ?? "");
      step.move(id, L.answers.started, "heard");
      if (outId && squad.some((m) => m.id === outId)) {
        step.move(outId, -L.answers.madeWay, "madeWay");
        const day = Number(talk.params?.day);
        st.swap = { eventId, inId: id, outId, day: { seasonIndex: step.clock.seasonIndex, day: Number.isFinite(day) ? day : step.clock.day } };
        effect = { kind: "startSub", inId: id, outId, eventId };
      }
      break;
    }
    case "notYet":
      step.move(id, -L.answers.passedOver, "passedOver", L.benchFloorReserve);
      break;
    default:
      // earnIt / focus: the neutral answers change nothing.
      break;
  }
  return effect;
}

/**
 * L3: the manager answers a talk. `effect` asks the store for what the answer
 * changes outside the locker room: "list" puts him on the transfer list (an
 * agreed sale); rc9: a load tweak, a cup entry, a one-event lineup change.
 * Refused (`error`) for an unknown or already answered talk, or an answer the
 * talk does not offer.
 */
export function answerLockerTalk(
  input: LockerRoomState,
  talkId: string,
  answer: TalkAnswer,
  ctx: { clock: LockerDate; careerSeed: number; squad: LockerSquadMember[] },
): LockerStepResult & { effect: LockerEffect | null; error?: "unknown" | "answered" | "badAnswer" } {
  const found = input.talks.find((t) => t.id === talkId);
  if (!found) return { state: input, notes: [], effect: null, error: "unknown" };
  if (found.answer !== undefined) return { state: input, notes: [], effect: null, error: "answered" };
  if (!found.answers.includes(answer)) return { state: input, notes: [], effect: null, error: "badAnswer" };
  const step = new Step(structuredClone(input), ctx.clock, ctx.careerSeed);
  const talk = step.st.talks.find((t) => t.id === talkId)!;
  const effect = applyAnswer(step, talk, answer, ctx.squad);
  return { ...step.finish(), effect };
}

/**
 * v2.3 MEDIA (M4): move one player's morale by `delta` for a reason the mood
 * mail and his `last` change show (a media day repeated inside the fatigue
 * window). Pure; the input state is cloned. A change of mood becomes a note.
 */
export function nudgeMorale(
  input: LockerRoomState,
  ctx: { clock: LockerDate; careerSeed: number },
  playerId: string,
  delta: number,
  reason: MoraleReason,
): LockerStepResult {
  const step = new Step(structuredClone(input), ctx.clock, ctx.careerSeed);
  step.move(playerId, delta, reason);
  return step.finish();
}
// ---------------------------------------------------------------------------
// L5: hooks for the takeover mode (exported, not wired)
// ---------------------------------------------------------------------------

export interface LockerIssues {
  unhappy: { playerId: string; morale: number; mood: MoodId }[];
  promises: LockerPromise[];
  talks: LockerTalk[];
}

/** L5: the unhappy players (angry / unhappy, worst first), the open promises and talks of a save. */
export function lockerIssuesOf(save: { squad: { id: string }[]; lockerRoom?: LockerRoomState | null }): LockerIssues {
  const st = save.lockerRoom;
  if (!st) return { unhappy: [], promises: [], talks: [] };
  const ids = new Set(save.squad.map((p) => p.id));
  const unhappy = save.squad
    .map((p) => ({ playerId: p.id, morale: moraleOf(st, p.id), mood: moodOf(moraleOf(st, p.id)) }))
    .filter((x) => x.mood === "angry" || x.mood === "unhappy")
    .sort((a, b) => a.morale - b.morale || a.playerId.localeCompare(b.playerId));
  return {
    unhappy,
    promises: st.promises.filter((p) => ids.has(p.playerId)),
    talks: openTalksOf(st).filter((t) => ids.has(t.playerId)),
  };
}

/**
 * L5: the locker room a new manager inherits — one unhappy player and, with
 * two or more players, a minutes promise the previous manager left to
 * another. Returns the new state; the save is not touched.
 */
export function seedInheritedLockerRoom(
  save: { squad: { id: string }[]; clock: LockerDate; lockerRoom?: LockerRoomState | null },
  rng: Rng,
): LockerRoomState {
  const st = structuredClone(save.lockerRoom ?? emptyLockerRoom());
  const ids = save.squad.map((p) => p.id).sort();
  if (ids.length === 0) return st;
  const unhappyId = rng.pick(ids);
  const morale = rng.int(L.moods[1].from + 2, L.moods[2].from - 6);
  const prev = st.players[unhappyId];
  st.players[unhappyId] = {
    morale,
    benchRun: prev?.benchRun ?? 0,
    lowWeeks: 0,
    last: { reason: "inherited", delta: morale - (prev?.morale ?? L.neutral), on: { ...save.clock } },
  };
  st.log.unshift({ playerId: unhappyId, reason: "inherited", delta: morale - (prev?.morale ?? L.neutral), morale, on: { ...save.clock } });
  if (st.log.length > L.logCap) st.log.length = L.logCap;
  const others = ids.filter((id) => id !== unhappyId && !st.promises.some((p) => p.playerId === id));
  if (others.length > 0) {
    const promised = rng.pick(others);
    st.seq += 1;
    st.promises.push({
      id: `promise:${st.seq}`,
      playerId: promised,
      kind: "minutes",
      made: { ...save.clock },
      deadline: fromAbsDay(absDay(save.clock) + L.promise.minutesMaxDays),
      need: L.promise.minutesNeed,
      of: L.promise.minutesOf,
      started: 0,
      seen: 0,
      inherited: true,
    });
  }
  return st;
}

// ---------------------------------------------------------------------------
// v2.3 UI (wave 2): read-only views for the screens. Pure; no rule or number
// changes (R201–R204).
// ---------------------------------------------------------------------------

/** Days from `from` to `to` (negative once passed). */
export function lockerDaysBetween(from: LockerDate, to: LockerDate): number {
  return absDay(to) - absDay(from);
}

export interface PromiseProgress {
  kind: PromiseKind;
  /** minutes: starts so far, starts needed, events of the promise, events still to play. */
  started: number;
  need: number;
  of: number;
  eventsLeft: number;
  /** minutes: one more event on the bench breaks it. Never true for `stay`. */
  atRisk: boolean;
  deadline: LockerDate;
  inherited: boolean;
}

/** U1/U2: where an open promise stands ("1 of 3 starts, 2 events left"). */
export function promiseProgressOf(p: LockerPromise): PromiseProgress {
  const need = p.need ?? L.promise.minutesNeed;
  const of = p.of ?? L.promise.minutesOf;
  const started = p.started ?? 0;
  const seen = p.seen ?? 0;
  const benched = seen - started;
  return {
    kind: p.kind,
    started,
    need,
    of,
    eventsLeft: Math.max(0, of - seen),
    atRisk: p.kind === "minutes" && benched >= of - need,
    deadline: p.deadline,
    inherited: Boolean(p.inherited),
  };
}

/** U1: the latest changes to one player's morale, newest first. */
export function playerLockerLogOf(state: LockerRoomState | null | undefined, playerId: string, limit = 4): LockerLogEntry[] {
  return (state?.log ?? []).filter((e) => e.playerId === playerId).slice(0, limit);
}

/** U2: the squad's mood — the mood of its average morale (no state = neutral). */
export function squadMoodOf(state: LockerRoomState | null | undefined, squadIds: readonly string[]): MoodId {
  if (squadIds.length === 0) return moodOf(L.neutral);
  const sum = squadIds.reduce((s, id) => s + moraleOf(state, id), 0);
  return moodOf(Math.round(sum / squadIds.length));
}

/** U2: the manager's word as the room reads it. */
export type WordStanding = "fresh" | "trusted" | "damaged";
export function wordStandingOf(word: { kept: number; broken: number }): WordStanding {
  if (word.kept === 0 && word.broken === 0) return "fresh";
  return credibilityOf(word) >= 0.5 ? "trusted" : "damaged";
}

/**
 * U2 (HQ): what needs the manager now — the talks waiting (a transfer
 * request is one) and the minutes promises one bench away from breaking.
 */
export function lockerAttentionOf(save: { squad: { id: string }[]; lockerRoom?: LockerRoomState | null }): { talks: LockerTalk[]; atRisk: LockerPromise[] } {
  const issues = lockerIssuesOf(save);
  return { talks: issues.talks, atRisk: issues.promises.filter((p) => promiseProgressOf(p).atRisk) };
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}
