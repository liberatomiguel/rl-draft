/**
 * Road to Worlds rc.36 (SUN-01..03, R88) — the weekend: Saturday → HQ →
 * Sunday (store-layer flows over careerFlow; no React).
 *
 * SUN-01 — once the user's Saturday is done (the qualifier won → Sunday's
 * regional; a Major / Worlds paused after its Swiss → Championship Sunday)
 * the user is back in HQ on Saturday evening. That evening is a stop of the
 * decision queue ("sunday", careerDecisions): +1 day, the batched Advance,
 * the autoplay and a reload all hold there until Sunday is STARTED from HQ —
 * `startSundayFlow`, which records the optional coach briefing (keep the plan
 * / recover / prepare for the opponent; engine/career/sunday.ts) and moves
 * the clock exactly one day. The dates are the calendar's (Saturday's
 * evening and Sunday are the days they always were): Sunday trains nobody
 * and pays nobody, nothing replays, no prize is paid twice. The stop is
 * derived from the save (a paused Major, or `weekend` set by Saturday's
 * qualifier), so it survives a reload and is answered once.
 *
 * SUN-03 — an event the user is out of: Saturday evening after a lost
 * qualifier, HQ offers Sunday's regional without them (watch / results /
 * skip; non-holding); a Major / Worlds Swiss exit picks watch / results /
 * skip as it starts Sunday; an event resolved without the user is kept
 * compact (`followEvent`, careerFlow.resolveAiEvent) for /career/follow.
 */

import { CAREER_SUNDAY } from "@/config/balance";
import {
  playoffsDayFor,
  qualifierDayFor,
  qualifierDefsForWeek,
  regionalForQualifier,
  weekOfDay,
} from "@/engine/career/calendar";
import { isSundayBriefingChoice } from "@/engine/career/sunday";
import type { CareerEventDef, CareerSave, FollowEventState, SundayBriefingChoice } from "@/engine/career/types";
import {
  advanceDayFlow,
  finishEvent,
  isEventPaused,
  startChampionshipSundayFlow,
  type FlowResult,
} from "./careerFlow";
import { pendingDecisionsOf } from "./careerDecisions";

// ---------------------------------------------------------------------------
// SUN-01 — the Sunday ahead
// ---------------------------------------------------------------------------

export interface SundayAhead {
  /** "regional": Saturday's qualifier won; "championship": a Major / Worlds paused after its Swiss. */
  kind: "regional" | "championship";
  /** The Sunday event. */
  def: CareerEventDef;
  /** The user plays Sunday (false: out in the Swiss — the playoffs go on without them). */
  playing: boolean;
  /** The day Sunday falls on (tomorrow). */
  sundayDay: number;
  /** The briefing already recorded for this Sunday (null = not started yet: the stop holds). */
  briefing: SundayBriefingChoice | null;
}

/**
 * The user's Sunday ahead, on the Saturday evening before it — null on any
 * other day, for a direct seed (no Saturday played) and with
 * CAREER_SUNDAY.saturdayStop off. Derived from persisted fields only.
 */
export function sundayAheadOf(save: CareerSave): SundayAhead | null {
  if (!CAREER_SUNDAY.saturdayStop || save.phase !== "running") return null;
  const recorded = (id: string): SundayBriefingChoice | null =>
    save.weekend?.eventId === id && isSundayBriefingChoice(save.weekend.briefing) ? save.weekend.briefing : null;
  if (isEventPaused(save)) {
    const ev = save.activeEvent!;
    return {
      kind: "championship",
      def: ev.def,
      playing: ev.tournament.playoffs?.seeds.includes("user") ?? false,
      sundayDay: playoffsDayFor(ev.def),
      briefing: recorded(ev.def.id),
    };
  }
  if (save.activeEvent) return null;
  const pending = save.pendingEventDef;
  if (pending?.tier === "regional" && pending.day === save.clock.day + 1 && save.weekend?.eventId === pending.id) {
    return { kind: "regional", def: pending, playing: true, sundayDay: pending.day, briefing: recorded(pending.id) };
  }
  return null;
}

/** True while the Saturday-evening stop holds the clock (Sunday not started). */
export function sundayStopHolds(save: CareerSave): boolean {
  const ahead = sundayAheadOf(save);
  return ahead !== null && ahead.briefing === null;
}

/**
 * The answer without the clock move: records the briefing (the default when
 * none is given; a spectator's is always the default — they play no
 * series) and so lifts the stop. `startSundayFlow` is this plus the day.
 */
export function recordSundayBriefingFlow(input: CareerSave, choice?: SundayBriefingChoice | null): FlowResult {
  const ahead = sundayAheadOf(input);
  if (!ahead) return { save: input, error: "none" };
  const briefing = ahead.playing && choice ? choice : CAREER_SUNDAY.defaultBriefing;
  return { save: { ...structuredClone(input), weekend: { eventId: ahead.def.id, briefing } } };
}

/** How a spectator's Sunday goes on (a Major / Worlds Swiss exit). */
export type SpectatorMode = "watch" | "results" | "skip";

/**
 * SUN-01: start Sunday from HQ — the briefing is recorded and the clock
 * moves exactly one day (Saturday → Sunday). Refused while another decision
 * holds (it is answered first) and outside the stop. A spectator's `mode`:
 * "watch" opens Championship Sunday as usual (its card, then the playback);
 * "results" sims the playoffs (the digest follows); "skip" also banks the
 * result at once (HQ next) — the same result either way.
 */
export function startSundayFlow(
  input: CareerSave,
  choice?: SundayBriefingChoice | null,
  mode: SpectatorMode = "watch",
): FlowResult {
  const ahead = sundayAheadOf(input);
  if (!ahead) return { save: input, error: "none" };
  if (pendingDecisionsOf(input).some((d) => d.holds && d.kind !== "sunday")) {
    return { save: input, error: "decisionPending" };
  }
  const recorded = recordSundayBriefingFlow(input, choice).save;
  let save = advanceDayFlow(recorded);
  if (save.clock.day !== input.clock.day + 1) return { save: input, error: "blocked" };
  if (ahead.kind === "championship" && !ahead.playing && save.activeEvent) {
    if (mode === "watch") {
      save.activeEvent.watched = true;
    } else {
      save = startChampionshipSundayFlow(save, false);
      if (mode === "skip" && save.activeEvent?.tournament.stage === "finished") save = finishEvent(save);
    }
  }
  return { save };
}

// ---------------------------------------------------------------------------
// SUN-03 — an event the user is out of
// ---------------------------------------------------------------------------

export interface SundayWithoutYou {
  /** The user's regional, tomorrow, without them. */
  def: CareerEventDef;
  /** The teams through Saturday's qualifier (they join the direct eight on Sunday). */
  qualifiedIds: string[];
}

/**
 * Saturday evening after a lost qualifier: Sunday's regional goes on without
 * the user — HQ offers it (watch / results / skip) until answered. Null on
 * any other day and once answered (`weekend.follow`).
 */
export function sundayWithoutYouOf(save: CareerSave): SundayWithoutYou | null {
  if (save.phase !== "running" || save.activeEvent || save.pendingEventDef) return null;
  const { seasonIndex, day } = save.clock;
  const week = weekOfDay(day);
  if (day !== qualifierDayFor(week)) return null;
  const q = qualifierDefsForWeek(seasonIndex, week).find((x) => x.region === save.identity.region);
  if (!q || !save.eventResults.some((r) => r.eventId === q.id && r.userPlacement === "swiss_exit")) return null;
  const regional = regionalForQualifier(q);
  if (!regional || regional.day !== day + 1 || save.eventResults.some((r) => r.eventId === regional.id)) return null;
  if (save.weekend?.eventId === regional.id && save.weekend.follow) return null;
  const qr = save.competition.qualifiedRefs?.[regional.region!];
  return { def: regional, qualifiedIds: qr && qr.eventId === regional.id ? qr.refs : [] };
}

/**
 * SUN-03: the eliminated Saturday's answer. "skip" only records it (the card
 * goes; Sunday resolves when the clock passes, as always); "watch" /
 * "results" also move to Sunday, where the regional resolves and opens in
 * /career/follow that way. Refused while a decision holds the clock.
 */
export function followSundayFlow(input: CareerSave, choice: SpectatorMode): FlowResult {
  const out = sundayWithoutYouOf(input);
  if (!out) return { save: input, error: "none" };
  const save = structuredClone(input);
  save.weekend = { eventId: out.def.id, briefing: null, follow: choice };
  if (choice === "skip") return { save };
  const next = advanceDayFlow(save);
  if (next.clock.day !== input.clock.day + 1) return { save: input, error: "blocked" };
  return { save: next };
}

/**
 * The followed event HQ still offers: resolved within
 * CAREER_SUNDAY.followCardDays days, this season, not opened nor hidden.
 */
export function followCardOf(save: CareerSave): FollowEventState | null {
  const f = save.followEvent;
  if (!f || f.dismissed || f.view !== null || save.phase !== "running") return null;
  if (f.def.seasonIndex !== save.clock.seasonIndex) return null;
  const resolved = playoffsDayFor(f.def);
  const age = save.clock.day - resolved;
  return age >= 0 && age < CAREER_SUNDAY.followCardDays ? f : null;
}

/** Opens the followed event in /career/follow (watch, or straight to the results). */
export function openFollowFlow(input: CareerSave, view: "watch" | "results"): FlowResult {
  if (!input.followEvent) return { save: input, error: "none" };
  const save = structuredClone(input);
  save.followEvent!.view = view;
  return { save };
}

/** Hides the followed event from HQ (it stays readable in /career/follow until replaced). */
export function dismissFollowFlow(input: CareerSave): FlowResult {
  if (!input.followEvent || input.followEvent.dismissed) return { save: input };
  const save = structuredClone(input);
  save.followEvent!.dismissed = true;
  return { save };
}
