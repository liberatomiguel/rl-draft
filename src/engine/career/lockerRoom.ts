/**
 * Road to Worlds — the locker room (v2.3 LOCKER, wave 1; HISTORIAS-SPEC L1–L5,
 * decisions R190–R194). Pure and deterministic: no React, no store, no clock.
 *
 * L1 every player under contract at the user's club has a morale 0–100, read
 *    as five moods; a player (or a save) without an entry reads as neutral.
 *    AI clubs have none.
 * L2 what moves it: playing time (a run of events on the bench), results (a
 *    title, a deep run, a long losing run), the market (put on the list; a
 *    refused bid opens a talk), promises kept or broken. Every change is
 *    logged with its reason, and a change of mood becomes a note (a mail).
 * L3 talks (two or three canned answers; unanswered, the neutral one after
 *    CAREER_LOCKER.talkDays) and promises (`minutes`: starts X of the next Y
 *    events; `stay`: not sold or listed before the window closes), settled by
 *    the game; the manager's word (kept against broken) scales how much a new
 *    promise calms.
 * L4 low morale for several weeks files a transfer request (a talk: sell,
 *    promise, refuse); morale scales development gain by a small factor both
 *    ways (never a decline, never a stored overall); a match effect exists
 *    and ships at zero.
 * L5 `lockerIssuesOf` and `seedInheritedLockerRoom` for the takeover mode
 *    (exported and tested, not wired).
 *
 * The store (`store/lockerRoomFlow.ts`) derives the facts of a write from the
 * save before and after it and turns the notes into mail.
 */

import { CAREER_LOCKER as L } from "@/config/balance.lockerRoom";
import { FEATURES } from "@/config/balance";
import type { Rng } from "@/lib/rng";
import type { Placement } from "../types";
import { windowCloseDayFor } from "./calendar";
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
  | "managerPost"; // rc9 STORIES: the manager's post to the fans (store/fanFeedFlow.moveSquadMorale)

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

export type TalkTopic = "bench" | "bid" | "request";
export type TalkAnswer = "promiseMinutes" | "promiseStay" | "earnIt" | "focus" | "blunt" | "sell" | "refuse";

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
}

/** What a step reports for the inbox. */
export type LockerNote =
  | { kind: "mood"; reason: MoraleReason; changes: { playerId: string; mood: MoodId }[] }
  | { kind: "talk"; talkId: string; playerId: string; topic: TalkTopic; variant: number }
  | { kind: "talkAuto"; talkId: string; playerId: string; topic: TalkTopic; answer: TalkAnswer }
  | { kind: "promiseKept" | "promiseBroken"; playerId: string; promise: PromiseKind; inherited: boolean };

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
  /** Events the club finished in this write, oldest first, with the lineup that played them. */
  events?: { eventId: string; tier: string; placement?: Placement; lineup: string[] }[];
  /** Weekly ticks crossed (Mondays). */
  weeks?: number;
}

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

/** L4: the match-performance effect (rating points). CAREER_LOCKER.matchEffect ships at 0: not wired. */
export function matchMoraleEffectOf(morale: number): number {
  if (L.matchEffect === 0) return 0;
  return ((clamp(morale, L.min, L.max) - L.neutral) / 50) * L.matchEffect;
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
    if (!this.before.has(id)) this.before.set(id, moodOf(p.morale));
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

  openTalk(playerId: string, topic: TalkTopic): void {
    if (this.hasOpenTalk(playerId)) return;
    const answers: TalkAnswer[] =
      topic === "bench" ? ["promiseMinutes", "earnIt", "blunt"] : topic === "bid" ? ["promiseStay", "promiseMinutes", "focus"] : ["sell", "promiseMinutes", "refuse"];
    const neutral: TalkAnswer = topic === "bench" ? "earnIt" : topic === "bid" ? "focus" : "refuse";
    const id = this.nextId("talk");
    const variant = Math.floor(derivedFloat(this.careerSeed, streams.gen("lockerTalk", `${id}:${playerId}`)) * 3);
    this.st.talks.unshift({
      id,
      playerId,
      topic,
      answers,
      neutral,
      opened: { ...this.clock },
      deadline: fromAbsDay(absDay(this.clock) + L.talkDays),
      variant,
    });
    this.notes.push({ kind: "talk", talkId: id, playerId, topic, variant });
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

  /** Mood changes, grouped by the reason that moved each player last. */
  finish(): LockerStepResult {
    const byReason = new Map<MoraleReason, { playerId: string; mood: MoodId }[]>();
    for (const [id, was] of this.before) {
      const p = this.st.players[id];
      if (!p) continue;
      const now = moodOf(p.morale);
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
 * refused bids, events played, weekly ticks, then whatever fell due (a
 * promise's deadline, an unanswered talk). Pure: the input state is cloned.
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

  // Events played.
  for (const ev of facts.events ?? []) {
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
        // A reserve who does not expect to start does not ask for the talk.
        if (p.benchRun === L.benchRunTalk && !minutes && expects) step.openTalk(m.id, "bench");
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
      for (const m of squad) step.move(m.id, L.titleLift, "title");
    } else if (placement && DEEP_RUN.includes(placement) && L.deepRunTiers.includes(ev.tier)) {
      for (const m of squad) step.move(m.id, L.deepRunLift, "deepRun");
    }
    const poor = !placement || L.poorPlacements.includes(placement);
    st.losingRun = poor ? st.losingRun + 1 : 0;
    if (poor && st.losingRun >= L.losingRunFrom) for (const m of squad) step.move(m.id, -L.losingRunDrop, "losingRun");
  }

  // Weekly ticks: the drift toward neutral, then the transfer request.
  const weeks = Math.min(facts.weeks ?? 0, L.maxWeeksPerCall);
  const nowWeek = absWeek(facts.clock);
  for (let w = 0; w < weeks; w++) {
    for (const m of squad) {
      const p = step.entry(m.id);
      const sulking = p.benchRun >= L.benchRunTalk && p.morale < L.neutral;
      if (!sulking && p.morale !== L.neutral) {
        const toward = p.morale < L.neutral ? Math.min(L.weeklyDrift, L.neutral - p.morale) : -Math.min(L.weeklyDrift, p.morale - L.neutral);
        step.move(m.id, toward, "settling");
      }
      p.lowWeeks = p.morale < L.requestBelow ? p.lowWeeks + 1 : 0;
      const cooled = (p.requestCooldownUntil ?? -Infinity) <= nowWeek;
      if (p.lowWeeks >= L.requestWeeks && cooled && !p.agreedSale && !step.hasOpenTalk(m.id)) {
        step.openTalk(m.id, "request");
        p.lowWeeks = 0;
      }
    }
  }

  settleDue(step, squad);
  return step.finish();
}

/** Deadlines: a stay promise past its window is kept; a minutes promise past its lapse day lapses; a talk past its day answers itself. */
function settleDue(step: Step, squad: readonly LockerSquadMember[]): void {
  const st = step.st;
  const today = absDay(step.clock);
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

function applyAnswer(step: Step, talk: LockerTalk, answer: TalkAnswer, squad: readonly LockerSquadMember[]): "list" | null {
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
  let effect: "list" | null = null;
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
    default:
      // earnIt / focus: the neutral answers change nothing.
      break;
  }
  return effect;
}

/**
 * L3: the manager answers a talk. `effect: "list"` asks the store to put him
 * on the transfer list (an agreed sale). Refused (`error`) for an unknown or
 * already answered talk, or an answer the talk does not offer.
 */
export function answerLockerTalk(
  input: LockerRoomState,
  talkId: string,
  answer: TalkAnswer,
  ctx: { clock: LockerDate; careerSeed: number; squad: LockerSquadMember[] },
): LockerStepResult & { effect: "list" | null; error?: "unknown" | "answered" | "badAnswer" } {
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
