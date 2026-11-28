"use client";

/**
 * Road to Worlds — Calendar (v0.2 day clock, FIFA-style month view).
 *
 * rc9 HQ (#243). What the player decides here: how far to move the clock.
 * What he must see first: the next stop that needs him (its name, its date,
 * how far away) with the action that moves there. So the screen opens on that
 * one board, then the month he is in, then the stops after it as rows, the
 * invite when there is one and the season's progress.
 * v2.0 (R40): the weekend reads per day — Saturday Qualifier / Swiss stage,
 * Sunday Regional / Championship Sunday; a spectated Major is a muted cell;
 * qualifier results read Qualified / Eliminated (never a champion).
 */

import { AppLink } from "@/components/ui/AppLink";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useCareerCopy, type CareerCopy } from "@/content/careerCopy";
import { playoffsDayFor } from "@/engine/career/calendar";
import { hasChampion } from "@/engine/career/careerResults";
import type {
  CareerEventDef,
  CompactEventResult,
  EventTier,
} from "@/engine/career/types";
import { formatMoney } from "@/lib/format";
import { useOsReducedMotion } from "@/lib/useOsReducedMotion";
import { cx } from "@/lib/util";
import { useCareerStore } from "@/store/careerStore";
import { useMounted } from "@/store/useMounted";
import { REGION_BADGE } from "@/components/regionStyle";
import {
  DAYS_PER_SEASON,
  agendaDays,
  clockLabel,
  dateOfDay,
  isEventPaused,
  isUserEventDef,
  nameOfRef,
  upcomingStops,
  useCareerSave,
  useRevealHeldEventId,
  visibleContinueKind,
  type AgendaDay,
  type DayKind,
  type UpcomingStop,
} from "@/components/career/careerUi";
import {
  formatDateShort,
  formatDateTiny,
  formatDaysAway,
} from "@/components/career/dateText";
import { TierChip, maxPointsOf, prizePoolOf } from "@/components/career/hub/hubShared";
import { formatLineOf, roleTitleOf } from "@/components/career/event/WeekendPlan";
import { placementLabelOf, weekendRoleOf } from "@/components/career/event/weekendView";
import { EventTierIcon, TIER_ICON_TONE } from "@/components/career/event/EventTierIcon";
import { OrgMark } from "@/components/career/OrgMark";
import { CloseIcon, TrophyIcon } from "@/components/ui/icons";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonClass } from "@/components/ui/Button";
import { Panel, SectionTitle } from "@/components/ui/Panel";

/**
 * rc9 HQ (#243): an event day is marked by a hairline in its tier's tone and its
 * tier icon, not a tinted fill (a month of orange boxes was the loudest thing on
 * the screen). Worlds keeps its gold: it is the reward.
 */
const MATCHDAY_EDGE: Record<EventTier, string> = {
  worlds: "border-amber-400/70",
  major: "border-orange/80",
  regional: "border-orange/55",
  qualifier: "border-blue/60",
  t2: "border-line-strong",
  t3: "border-line-strong",
};

interface MonthGroup {
  key: string;
  y: number;
  m: number;
  days: AgendaDay[];
}

/** The detail is in normal flow below its month; only clear the fixed mobile nav. */
function revealDay(detail: HTMLElement | null, reduced: boolean): void {
  if (!detail) return;
  detail.style.scrollMarginBottom = "96px";
  detail.scrollIntoView({ block: "nearest", behavior: reduced ? "auto" : "smooth" });
}

/** A stop's name: the event's, or the calendar's word for it. */
function stopTitleOf(C: CareerCopy, stop: UpcomingStop | null): string {
  if (!stop) return C.calendar.seasonEnd;
  if (stop.event) return stop.event.name;
  if (stop.kind === "window") return C.calendar.window;
  if (stop.kind === "payday") return C.calendar.payday;
  return C.calendar.seasonEnd;
}

export function CalendarScreen() {
  const mounted = useMounted();
  const save = useCareerSave();
  const C = useCareerCopy();
  const D = C.dates;
  const router = useRouter();

  const advanceDay = useCareerStore((s) => s.advanceDay);
  const scrimPlaying = useCareerStore((s) => Boolean(s.scrimPlayback));
  const advanceToNextStop = useCareerStore((s) => s.advanceToNextStop);
  const continueEventToNextDay = useCareerStore((s) => s.continueEventToNextDay);
  const acceptUnofficial = useCareerStore((s) => s.acceptUnofficial);
  const passUnofficial = useCareerStore((s) => s.passUnofficial);
  const cancelScrim = useCareerStore((s) => s.cancelScrim);
  const openFollow = useCareerStore((s) => s.openFollow);
  const revealHeld = useRevealHeldEventId(save);

  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [viewedMonth, setViewedMonth] = useState<string | null>(null);
  const detailRef = useRef<HTMLDivElement | null>(null);
  const reducedMotion = useOsReducedMotion();

  // --- derived season data (all guarded for the pre-mount pass) ------------
  const days = useMemo(
    () => (save ? agendaDays(save, 1, DAYS_PER_SEASON) : []),
    [save],
  );

  const months = useMemo(() => {
    const out: MonthGroup[] = [];
    for (const d of days) {
      const last = out[out.length - 1];
      if (!last || last.m !== d.date.m || last.y !== d.date.y) {
        out.push({ key: `${d.date.y}-${d.date.m}`, y: d.date.y, m: d.date.m, days: [d] });
      } else {
        last.days.push(d);
      }
    }
    return out;
  }, [days]);

  const resultByEvent = useMemo(() => {
    if (!save) return new Map<string, CompactEventResult>();
    return new Map(
      save.eventResults
        .filter((r) => r.seasonIndex === save.clock.seasonIndex)
        .map((r) => [r.eventId, r]),
    );
  }, [save]);

  const stops = useMemo(() => (save ? upcomingStops(save, 5) : []), [save]);

  /** rc.36 (CAL-01): the season's transfer windows as day ranges (the month headers name their end). */
  const windowRanges = useMemo(() => {
    const out: { start: number; end: number }[] = [];
    for (const d of days) {
      if (!d.windowOpen) continue;
      const last = out[out.length - 1];
      if (last && last.end === d.day - 1) last.end = d.day;
      else out.push({ start: d.day, end: d.day });
    }
    return out;
  }, [days]);

  // rc.29 (CAR-09): an opened day detail scrolls into view above the sticky
  // advance bar (it used to open under it, out of sight).
  useEffect(() => {
    if (selectedDay !== null) revealDay(detailRef.current, reducedMotion);
  }, [selectedDay, reducedMotion]);

  if (!mounted || !save) {
    // Loading: the shapes of the next-stop board, the month and the rail.
    return (
      <div className="mx-auto max-w-6xl px-3 py-4 sm:px-4" aria-busy>
        <div className="mb-5 h-9 w-48 animate-pulse rounded-lg bg-white/5" />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]">
          <div className="space-y-4">
            <div className="h-44 animate-pulse rounded-xl bg-white/5" />
            <div className="h-96 animate-pulse rounded-xl bg-white/5" />
          </div>
          <div className="h-64 animate-pulse rounded-xl bg-white/5" />
        </div>
      </div>
    );
  }

  const clk = clockLabel(save);
  const currentMonthKey = `${clk.date.y}-${clk.date.m}`;
  const requestedMonth = viewedMonth ?? currentMonthKey;
  const requestedMonthIndex = months.findIndex((g) => g.key === requestedMonth);
  const visibleMonthIndex = Math.max(0, requestedMonthIndex >= 0 ? requestedMonthIndex : months.findIndex((g) => g.key === currentMonthKey));
  const visibleMonth = months[visibleMonthIndex];
  const changeMonth = (index: number) => {
    const month = months[index];
    if (!month) return;
    setViewedMonth(month.key);
    setSelectedDay(null);
  };
  const sel = selectedDay !== null ? (days[selectedDay - 1] ?? null) : null;

  // R40: a Major / Worlds paused after its Saturday Swiss continues to Sunday —
  // rc.29 (CAR-02): once its playback has revealed Saturday (else back to it).
  const paused =
    isEventPaused(save) && !(revealHeld !== null && revealHeld === save.activeEvent?.def.id);
  // rc.36 (SUN-01): Saturday evening before the user's Sunday — it is started in HQ (the briefing).
  const continueState = visibleContinueKind(save, revealHeld);
  const sundayStop = continueState === "sunday";
  // rc.36 (SUN-03): the event the user is out of, on the day it resolved (this season).
  const followed =
    save.followEvent && save.followEvent.def.seasonIndex === save.clock.seasonIndex
      ? { def: save.followEvent.def, day: playoffsDayFor(save.followEvent.def) }
      : null;
  const placementLabels = { placement: C.common.placement, qualifierOutcome: C.common.qualifierOutcome };
  const eventDue: CareerEventDef | null =
    save.activeEvent?.def ??
    (save.pendingEventDef && save.clock.day === save.pendingEventDef.day
      ? save.pendingEventDef
      : null);

  const nextStop = stops[0] ?? null;
  const nextStopLabel = stopTitleOf(C, nextStop);
  const laterStops = stops.slice(1);

  // rc.29 (CAR-09): the opened detail scrolls itself into view (revealAboveBar);
  // re-selecting the open day scrolls back to it.
  const selectDay = (day: number) => {
    const target = days[day - 1];
    if (target) setViewedMonth(`${target.date.y}-${target.date.m}`);
    if (day === selectedDay) revealDay(detailRef.current, reducedMotion);
    else setSelectedDay(day);
  };

  const kindLabel = (k: DayKind): string | null => {
    switch (k) {
      case "matchday":
        return C.calendar.matchday;
      case "windowOpen":
        return C.calendar.windowOpen;
      case "training":
        return C.calendar.trainingDay;
      case "scrim":
        return C.calendar.scrimDay;
      case "rest":
        return C.calendar.restDay;
      default:
        return null;
    }
  };

  // --- the one action: what moves the clock from here -----------------------
  const actionDisabled = save.phase !== "running" || scrimPlaying;
  const actions =
    continueState === "decision" ? (
      <Button variant="primary" onClick={() => router.push("/career")}>
        {C.hub.nowDecision}
      </Button>
    ) : continueState === "seasonReview" || continueState === "ended" ? (
      <Button variant="primary" onClick={() => router.push("/career/season")}>
        {continueState === "ended" ? C.ceremonies.legacyTitle : C.ceremonies.seasonReview}
      </Button>
    ) : sundayStop ? (
      <Button variant="primary" onClick={() => router.push("/career")}>
        {C.calendar.sundayAhead}
      </Button>
    ) : paused ? (
      <Button
        variant="primary"
        onClick={() => {
          continueEventToNextDay();
          router.push("/career/event");
        }}
      >
        {C.calendar.advanceToStop(C.event.championshipSunday)}
      </Button>
    ) : eventDue ? (
      <AppLink href="/career/event" className={buttonClass("primary")}>
        {C.calendar.advanceToStop(eventDue.name)}
      </AppLink>
    ) : (
      <>
        <Button variant="primary" onClick={() => advanceToNextStop()} disabled={actionDisabled}>
          {C.calendar.advanceToStop(nextStopLabel)}
        </Button>
        <Button variant="ghost" onClick={() => advanceDay()} disabled={actionDisabled}>
          {C.calendar.advanceDay}
        </Button>
      </>
    );

  // --- day detail (rendered under the month that owns the day) -------------
  const renderDayDetail = (day: AgendaDay) => {
    const event = day.event;
    const result = event ? resultByEvent.get(event.id) : undefined;
    const points = event ? maxPointsOf(event.tier) : null;
    // R40: which day of the weekend this is (Swiss stage / Championship Sunday).
    const role = event ? weekendRoleOf(event, day.day) : null;
    const twoDayRole = role === "swissDay" || role === "championshipSunday" ? role : null;
    const kindBadges = day.kinds.filter((k) => k !== "matchday" && k !== "idle");
    const booked = save.scheduledScrims.filter((s) => s.day === day.day);
    const played = save.scrimLog.filter(
      (e) => e.seasonIndex === save.clock.seasonIndex && e.day === day.day,
    );

    return (
      <div ref={detailRef} className="scroll-mt-28">
        <div className="rise-in mt-4 border-t border-line-strong pt-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-faint">
                {formatDateShort(D, day.date)}
                {day.isToday ? ` · ${C.calendar.today}` : ""}
              </p>
              {event ? (
                <>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <EventTierIcon tier={event.tier} className={cx("h-4 w-4 shrink-0", TIER_ICON_TONE[event.tier])} />
                    <span className="display text-lg font-bold leading-tight text-ink">{event.name}</span>
                    <TierChip tier={event.tier} />
                    {twoDayRole ? (
                      <Badge tone={twoDayRole === "championshipSunday" ? "gold" : "orange"}>
                        {roleTitleOf(C, twoDayRole, event)}
                      </Badge>
                    ) : null}
                    {event.region ? (
                      <Badge className={REGION_BADGE[event.region]}>{event.region}</Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-sub">{formatLineOf(C, event)}</p>
                </>
              ) : kindBadges.length > 0 ? (
                <p className="display mt-1 text-lg font-bold leading-tight text-ink">
                  {kindBadges.map((k) => kindLabel(k)).filter(Boolean).join(" · ")}
                </p>
              ) : (
                <p className="mt-1 text-sm text-sub">{C.calendar.openWeek}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setSelectedDay(null)}
              aria-label={C.common.close}
              className="-mr-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-sub transition-colors hover:bg-white/10 hover:text-ink"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>

          {event ? (
            // The stakes as figures: the value in Demi, its label quiet beside it.
            <dl className="mt-3 flex flex-wrap items-baseline gap-x-6 gap-y-2">
              <div className="flex items-baseline gap-1.5">
                <dd className="display text-[15px] font-bold tabular-nums text-ink">
                  {formatMoney(prizePoolOf(event, save.difficulty), { compact: true })}
                </dd>
                <dt className="text-xs text-faint">{C.calendar.prizePool}</dt>
              </div>
              {points !== null ? (
                <div className="flex items-baseline gap-1.5">
                  <dd className="display text-[15px] font-bold tabular-nums text-ink">{points}</dd>
                  <dt className="text-xs text-faint">{C.calendar.points}</dt>
                </div>
              ) : null}
              {result?.userPlacement ? (
                <Badge tone="blue">{placementLabelOf(placementLabels, event.tier, result.userPlacement)}</Badge>
              ) : save.pendingEventDef?.id === event.id ? (
                <Badge tone="orange">{C.calendar.registered}</Badge>
              ) : !isUserEventDef(save, event) ? (
                <span className="text-xs text-faint">{C.calendar.notQualified}</span>
              ) : null}
            </dl>
          ) : null}

          {/* rc.36 (CAL-01): a finished event names its champion, with the crest. */}
          {event && result && hasChampion(result) ? (
            <div className="mt-3 flex items-center gap-2 text-sm">
              <TrophyIcon className="h-4 w-4 shrink-0 text-amber-300" />
              <span className="text-faint">{C.common.placement.champion}</span>
              <OrgMark save={save} orgRef={result.championRef} size="xs" className="shrink-0" />
              <span className="display min-w-0 truncate font-bold text-ink">{nameOfRef(save, result.championRef)}</span>
            </div>
          ) : null}

          {/* rc.36 (SUN-03): the event the user is out of that resolved this day — follow it. */}
          {followed && followed.day === day.day ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
              <span className="flex min-w-0 items-center gap-2 text-sm">
                <EventTierIcon tier={followed.def.tier} className="h-4 w-4 shrink-0 text-sub" />
                <span className="min-w-0 truncate text-ink">{followed.def.name}</span>
              </span>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  openFollow("results");
                  router.push("/career/follow");
                }}
              >
                {C.calendar.follow}
              </Button>
            </div>
          ) : null}

          {/* v0.3 — a booked scrim on this day (cancellable before it is played) */}
          {booked.length > 0 ? (
            <ul className="mt-3 border-t border-line">
              {booked.map((s) => (
                <li key={s.oppRef} className="flex min-h-11 items-center justify-between gap-2 border-b border-line py-1.5 last:border-b-0">
                  <span className="text-sm text-ink">
                    {C.scrim.title} <span className="text-sub">· {C.scrim.vs(nameOfRef(save, s.oppRef))}</span>
                  </span>
                  {day.day > save.clock.day ? (
                    <Button size="sm" variant="ghost" onClick={() => cancelScrim(s.day)}>
                      {C.scrim.cancel}
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}

          {/* v0.3 — scrim results played on this day */}
          {played.length > 0 ? (
            <ul className="mt-3 border-t border-line">
              {played.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line py-2 last:border-b-0">
                  <span className={cx("text-sm", e.won ? "text-good" : "text-sub")}>
                    {e.won ? C.scrim.won(e.oppName, e.scoreA, e.scoreB) : C.scrim.lost(e.oppName, e.scoreA, e.scoreB)}
                  </span>
                  <span className="text-xs text-faint">{C.scrim.gameLine(e.games.join(" · "))}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    );
  };

  const splits = [1, 2, 3] as const;

  return (
    <div className="mx-auto max-w-6xl px-3 py-4 sm:px-4">
      <SectionTitle
        title={C.calendar.title}
        className="mb-5"
        right={
          <span className="text-sm text-sub">
            {clk.season}
            {clk.split ? ` · ${C.calendar.split(clk.split)}` : ""}
          </span>
        }
      />

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)] lg:gap-6">
        <div className="min-w-0 space-y-4">
          {/* 1 — THE NEXT STOP: the screen's focal point and its one filled action. */}
          <Panel strong data-tour="calendar-next" className="p-4 sm:p-6">
            <p className="kicker">{C.calendar.nextForYou}</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
              {nextStop?.event ? (
                <EventTierIcon tier={nextStop.event.tier} className={cx("h-6 w-6 shrink-0", TIER_ICON_TONE[nextStop.event.tier])} />
              ) : null}
              <h2 className="display text-2xl font-bold leading-none text-ink sm:text-3xl">{nextStopLabel}</h2>
              {nextStop?.event ? <TierChip tier={nextStop.event.tier} /> : null}
            </div>
            {nextStop ? (
              <p className="mt-2 text-sm text-sub">
                {formatDateShort(D, nextStop.date)}
                <span className="text-faint"> · {formatDaysAway(D, nextStop.daysAway)}</span>
              </p>
            ) : null}
            <div className="mt-5 flex flex-wrap items-center gap-2 [&>*]:max-w-full [&>*]:whitespace-normal">{actions}</div>
          </Panel>

          {/* 2 — THE MONTH: the grid, the day it opens, the key. */}
          <Panel data-tour="calendar-month" className="min-w-0 p-3 sm:p-5">
            {months.filter((g) => g.key === visibleMonth?.key).map((g) => (
              <div key={g.key} id={`cal-month-${g.key}`} className="scroll-mt-24">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => changeMonth(visibleMonthIndex - 1)}
                      disabled={visibleMonthIndex === 0}
                      aria-label={C.calendar.previousMonth}
                      className="flex h-11 w-11 items-center justify-center rounded-lg border border-line text-sub transition-colors hover:border-line-strong hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <span aria-hidden className="text-lg leading-none">‹</span>
                    </button>
                    <h3 className="card-title min-w-36 text-center" aria-live="polite">
                      {D.months[g.m - 1]} <span className="text-faint">{g.y}</span>
                    </h3>
                    <button
                      type="button"
                      onClick={() => changeMonth(visibleMonthIndex + 1)}
                      disabled={visibleMonthIndex === months.length - 1}
                      aria-label={C.calendar.nextMonth}
                      className="flex h-11 w-11 items-center justify-center rounded-lg border border-line text-sub transition-colors hover:border-line-strong hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <span aria-hidden className="text-lg leading-none">›</span>
                    </button>
                  </div>
                  {/* rc.36 (CAL-01): the window(s) running through this month, end date named. */}
                  {windowRanges
                    .filter((r) => r.start <= g.days[g.days.length - 1].day && r.end >= g.days[0].day)
                    .map((r) => (
                      <span key={r.start} className="text-xs text-blue-bright">
                        {C.calendar.windowUntil(formatDateTiny(D, dateOfDay(save.clock.seasonIndex, r.end)))}
                      </span>
                    ))}
                </div>
                <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
                  {D.weekdays.map((w) => (
                    <div key={w} className="kicker pb-1 text-center">
                      {w}
                    </div>
                  ))}
                  {Array.from({ length: g.days[0].dow - 1 }).map((_, i) => (
                    <div key={`pad-${i}`} aria-hidden />
                  ))}
                  {g.days.map((d) => {
                    const ev = d.event;
                    // R40: a spectated Major / Worlds stays visible, but muted.
                    const spectating = d.participation === "spectating";
                    const cellRole = ev ? weekendRoleOf(ev, d.day) : null;
                    const cellLabel = ev
                      ? cellRole === "swissDay" || cellRole === "championshipSunday"
                        ? `${ev.name} · ${roleTitleOf(C, cellRole, ev)}`
                        : ev.name
                      : undefined;
                    const isSelected = selectedDay === d.day;
                    return (
                      <button
                        key={d.day}
                        type="button"
                        onClick={() => setSelectedDay(isSelected ? null : d.day)}
                        aria-pressed={isSelected}
                        aria-label={
                          formatDateShort(D, d.date) +
                          (d.isToday ? ` · ${C.calendar.today}` : "") +
                          (cellLabel ? `: ${cellLabel}` : "") +
                          (spectating ? ` · ${C.calendar.notQualified}` : "") +
                          (d.windowOpen ? ` · ${C.calendar.window}` : "")
                        }
                        title={spectating ? `${cellLabel} · ${C.calendar.notQualified}` : cellLabel}
                        className={cx(
                          "relative flex min-h-12 flex-col items-center rounded-md border pb-1.5 pt-1.5 text-xs leading-none transition-colors hover:bg-white/[0.06] sm:min-h-14",
                          // rc.49: an event day wears its tier (a spectated Major / Worlds too), even inside a transfer window.
                          ev ? cx(MATCHDAY_EDGE[ev.tier], "bg-white/[0.03]") : d.windowOpen ? "border-blue/30 bg-blue/[0.06]" : "border-line/60",
                          spectating && "opacity-60",
                          d.isPast && !d.isToday && "opacity-40",
                          d.isToday && "!border-orange",
                          isSelected && "!border-ink/70 bg-white/[0.06]",
                        )}
                      >
                        <span
                          className={cx(
                            "display tabular-nums",
                            d.isToday || ev ? "font-bold text-ink" : d.windowOpen ? "font-semibold text-blue-bright" : "font-semibold text-sub",
                          )}
                        >
                          {d.date.d}
                        </span>
                        <span className="mt-auto flex h-3.5 items-center gap-0.5 pt-1">
                          {ev ? (
                            <EventTierIcon tier={ev.tier} className={cx("h-3.5 w-3.5", TIER_ICON_TONE[ev.tier])} />
                          ) : followed && followed.day === d.day ? (
                            // rc.36 (SUN-03): an event the user is out of — muted, tap to follow it.
                            <EventTierIcon tier={followed.def.tier} className="h-3.5 w-3.5 text-white/40" />
                          ) : d.kinds.includes("scrim") ? (
                            // v0.3: a booked scrim is the blue dot.
                            <span className="h-1.5 w-1.5 rounded-full bg-blue-bright" />
                          ) : d.kinds.includes("training") ? (
                            <span className="h-1 w-1 rounded-full bg-white/25" />
                          ) : null}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {sel && sel.date.m === g.m && sel.date.y === g.y ? renderDayDetail(sel) : null}
              </div>
            ))}

            {/* The key: what each mark in the grid means (rc.36, CAL-01: no payroll marker). */}
            <div
              className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-3 text-xs text-faint"
              aria-label={C.calendar.legend}
            >
              <span className="inline-flex items-center gap-1.5">
                <span className="flex h-4 w-4 items-center justify-center rounded border border-orange/60">
                  <EventTierIcon tier="regional" className="h-2.5 w-2.5 text-orange-bright" />
                </span>
                {C.calendar.matchday}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-4 w-5 rounded border border-blue/30 bg-blue/[0.12]" />
                {C.calendar.window}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-bright" />
                {C.calendar.scrimDay}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1 w-1 rounded-full bg-white/30" />
                {C.calendar.trainingDay}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-4 w-4 rounded border border-orange" />
                {C.calendar.today}
              </span>
            </div>
          </Panel>
        </div>

        <aside className="min-w-0 space-y-4">
          {/* 3 — the stops after the next one: rows in one board, each opens its day. */}
          {laterStops.length > 0 ? (
            <Panel className="p-4 sm:p-5">
              <div className="card-head">
                <h3 className="card-title">{C.calendar.later}</h3>
              </div>
              <ul className="-my-1">
                {laterStops.map((stop) => (
                  <li key={`${stop.kind}-${stop.day}`} className="border-b border-line last:border-b-0">
                    <button
                      type="button"
                      onClick={() => selectDay(stop.day)}
                      className="flex min-h-14 w-full min-w-0 items-center gap-3 py-2 text-left transition-colors hover:bg-white/[0.03] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-bright"
                    >
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                        {stop.event ? (
                          <EventTierIcon tier={stop.event.tier} className={cx("h-4 w-4", TIER_ICON_TONE[stop.event.tier])} />
                        ) : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="display block truncate text-[15px] font-bold leading-tight text-ink">{stopTitleOf(C, stop)}</span>
                        <span className="mt-0.5 block text-xs text-faint">{formatDateTiny(D, stop.date)}</span>
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-sub">{formatDaysAway(D, stop.daysAway)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}

          {/* 4 — unofficial invite: one object he acts on (enter or pass). */}
          {save.unofficialOffer && !save.pendingEventDef ? (
            <Panel className="p-4 sm:p-5">
              <div className="card-head">
                <h3 className="card-title">{C.calendar.offerTitle}</h3>
                <TierChip tier={save.unofficialOffer.tier} />
              </div>
              <p className="display text-lg font-bold leading-tight text-ink">{save.unofficialOffer.name}</p>
              <p className="mt-1 text-sm text-sub">
                {formatDateShort(D, dateOfDay(save.clock.seasonIndex, save.unofficialOffer.day))}
                <span className="text-faint"> · {formatDaysAway(D, Math.max(0, save.unofficialOffer.day - save.clock.day))}</span>
              </p>
              <p className="mt-2 text-xs text-faint">{C.calendar.skipHint}</p>
              <div className="mt-4 flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => acceptUnofficial()}>
                  {C.calendar.enter}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => passUnofficial()}>
                  {C.calendar.skip}
                </Button>
              </div>
            </Panel>
          ) : null}

          {/* 5 — the season so far: a row per split, a mark per regional and its Major. */}
          <Panel className="p-4 sm:p-5">
            <div className="card-head">
              <h3 className="card-title">{C.launch.calendarOverview}</h3>
            </div>
            <ul>
              {splits.map((sp) => (
                <li key={sp} className="flex min-h-10 items-center justify-between gap-3 border-b border-line py-2">
                  <span className={cx("text-sm", clk.split === sp ? "display font-bold text-ink" : "text-sub")}>
                    {C.calendar.split(sp)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    {[1, 2, 3].map((ord) => {
                      const done = resultByEvent.has(`${save.clock.seasonIndex}:${sp}:reg${ord}:${save.identity.region}`);
                      return (
                        <span
                          key={ord}
                          role="img"
                          aria-label={`${C.calendar.regional(ord)}${done ? ` · ${C.calendar.done}` : ""}`}
                          className={cx("h-2.5 w-2.5 rounded-full", done ? "bg-ink" : "border border-line-strong")}
                        />
                      );
                    })}
                    <span
                      role="img"
                      aria-label={`${C.calendar.major}${resultByEvent.has(`${save.clock.seasonIndex}:${sp}:major`) ? ` · ${C.calendar.done}` : ""}`}
                      className={cx(
                        "ml-1 h-2.5 w-2.5 rotate-45",
                        resultByEvent.has(`${save.clock.seasonIndex}:${sp}:major`) ? "bg-orange" : "border border-line-strong",
                      )}
                    />
                  </span>
                </li>
              ))}
              <li className="flex min-h-10 items-center justify-between gap-3 pt-2">
                <span className="text-sm text-sub">{C.calendar.worlds}</span>
                <TrophyIcon
                  className={cx("h-4 w-4", resultByEvent.has(`${save.clock.seasonIndex}:worlds`) ? "text-amber-300" : "text-faint")}
                />
              </li>
            </ul>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
