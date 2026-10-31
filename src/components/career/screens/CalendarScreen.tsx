"use client";

/**
 * Road to Worlds — Calendar (v0.2 day clock, FIFA-style month view).
 *
 * Top → bottom: date header + window banner · "Next for you" stops strip ·
 * one navigable month in a 7-col grid (Mon-Sun) with day markers and a tap-to-open
 * day-detail panel · unofficial invite · season overview pips · advance
 * footer. MY schedule only by default; a toggle reveals other regions'
 * regional Sundays as neutral dots + a list in the day detail.
 * v2.0 (R40): the weekend reads per day — Saturday Qualifier / Swiss stage,
 * Sunday Regional / Championship Sunday; a spectated Major is a muted cell;
 * qualifier results read Qualified / Eliminated (never a champion).
 */

import { AppLink } from "@/components/ui/AppLink";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useCareerCopy } from "@/content/careerCopy";
import { officialEventDefsForWeek, playoffsDayFor } from "@/engine/career/calendar";
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
  daysUntilWindowCloses,
  isEventPaused,
  isUserEventDef,
  nameOfRef,
  upcomingStops,
  useCareerSave,
  useRevealHeldEventId,
  visibleContinueKind,
  weekOfDay,
  type AgendaDay,
  type DayKind,
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
import { TrophyIcon } from "@/components/ui/icons";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Panel, SectionTitle } from "@/components/ui/Panel";

/** Matchday cell fill, tinted by tier (orange = action; Worlds goes gold). */
const MATCHDAY_FILL: Record<EventTier, string> = {
  worlds: "border-amber-400/70 bg-amber-400/20",
  major: "border-orange/80 bg-orange/25",
  regional: "border-orange/60 bg-orange/15",
  qualifier: "border-blue/60 bg-blue/15",
  t2: "border-orange/45 bg-orange/10",
  t3: "border-orange/45 bg-orange/10",
};

interface MonthGroup {
  key: string;
  y: number;
  m: number;
  days: AgendaDay[];
}

/**
 * rc.29 (CAR-09): scroll the opened day detail into view ABOVE the sticky
 * advance bar. The bar's height plus its bottom offset (the mobile nav's
 * clearance included) becomes the detail's bottom scroll-margin; "nearest"
 * moves the page only as far as needed (the top margin clears the headers).
 */
function revealAboveBar(detail: HTMLElement | null, bar: HTMLElement | null, reduced: boolean): void {
  if (!detail) return;
  const clearance = bar
    ? bar.getBoundingClientRect().height + (Number.parseFloat(getComputedStyle(bar).bottom) || 0) + 8
    : 96;
  detail.style.scrollMarginBottom = `${Math.round(clearance)}px`;
  detail.scrollIntoView({ block: "nearest", behavior: reduced ? "auto" : "smooth" });
}

export function CalendarScreen() {
  const mounted = useMounted();
  const save = useCareerSave();
  const C = useCareerCopy();
  const D = C.dates;
  const router = useRouter();

  const advanceDay = useCareerStore((s) => s.advanceDay);
  const advanceToNextStop = useCareerStore((s) => s.advanceToNextStop);
  const continueEventToNextDay = useCareerStore((s) => s.continueEventToNextDay);
  const acceptUnofficial = useCareerStore((s) => s.acceptUnofficial);
  const passUnofficial = useCareerStore((s) => s.passUnofficial);
  const cancelScrim = useCareerStore((s) => s.cancelScrim);
  const openFollow = useCareerStore((s) => s.openFollow);
  const revealHeld = useRevealHeldEventId(save);

  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [showWorld, setShowWorld] = useState(false);
  const [viewedMonth, setViewedMonth] = useState<string | null>(null);
  const detailRef = useRef<HTMLDivElement | null>(null);
  const footerRef = useRef<HTMLDivElement | null>(null);
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

  /** Other regions' regionals per matchday (R40: their Sunday, `def.day`) — the "world" layer. */
  const worldByDay = useMemo(() => {
    const map = new Map<number, CareerEventDef[]>();
    if (!save) return map;
    for (const d of days) {
      const others = officialEventDefsForWeek(save.clock.seasonIndex, weekOfDay(d.day)).filter(
        (def) => def.tier === "regional" && def.region !== save.identity.region && def.day === d.day,
      );
      if (others.length > 0) map.set(d.day, others);
    }
    return map;
  }, [days, save]);

  const resultByEvent = useMemo(() => {
    if (!save) return new Map<string, CompactEventResult>();
    return new Map(
      save.eventResults
        .filter((r) => r.seasonIndex === save.clock.seasonIndex)
        .map((r) => [r.eventId, r]),
    );
  }, [save]);

  const stops = useMemo(() => (save ? upcomingStops(save, 4) : []), [save]);

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
    if (selectedDay !== null) revealAboveBar(detailRef.current, footerRef.current, reducedMotion);
  }, [selectedDay, reducedMotion]);

  if (!mounted || !save) {
    return (
      <div className="mx-auto max-w-3xl px-3 py-5 sm:px-4">
        <div className="h-[60vh] animate-pulse rounded-2xl bg-white/5" aria-busy />
      </div>
    );
  }

  const clk = clockLabel(save);
  const windowDaysLeft = daysUntilWindowCloses(save);
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
  const sundayStop = visibleContinueKind(save, revealHeld) === "sunday";
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
  const nextStopLabel = nextStop
    ? nextStop.event
      ? nextStop.event.name
      : nextStop.kind === "window"
        ? C.calendar.window
        : nextStop.kind === "payday"
          ? C.calendar.payday
          : C.calendar.seasonEnd
    : C.calendar.seasonEnd;

  // rc.29 (CAR-09): the opened detail scrolls itself into view (revealAboveBar);
  // re-selecting the open day scrolls back to it.
  const selectDay = (day: number) => {
    if (day === selectedDay) revealAboveBar(detailRef.current, footerRef.current, reducedMotion);
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

  // --- day detail panel (rendered under the month that owns the day) -------
  const renderDayDetail = (day: AgendaDay) => {
    const event = day.event;
    const result = event ? resultByEvent.get(event.id) : undefined;
    const points = event ? maxPointsOf(event.tier) : null;
    // R40: which day of the weekend this is (Swiss stage / Championship Sunday).
    const role = event ? weekendRoleOf(event, day.day) : null;
    const twoDayRole = role === "swissDay" || role === "championshipSunday" ? role : null;
    const worldDefs = showWorld ? (worldByDay.get(day.day) ?? []) : [];
    const kindBadges = day.kinds.filter((k) => k !== "matchday" && k !== "idle");

    return (
      <div ref={detailRef} className="scroll-mt-28">
        <Panel className="rise-in mt-2 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="kicker mb-1 text-[11px]">
                {formatDateShort(D, day.date)}
                {day.isToday ? ` · ${C.calendar.today}` : ""}
              </p>
              {event ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      aria-hidden
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-line bg-white/[0.04]"
                    >
                      <EventTierIcon tier={event.tier} className={cx("h-4 w-4", TIER_ICON_TONE[event.tier])} />
                    </span>
                    <span className="display text-base font-bold text-ink">{event.name}</span>
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
                  <p className="mt-1 text-xs text-sub">{formatLineOf(C, event)}</p>
                </>
              ) : kindBadges.length > 0 ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  {kindBadges.map((k) => {
                    const label = kindLabel(k);
                    if (!label) return null;
                    return (
                      <Badge
                        key={k}
                        tone={k === "windowOpen" ? "blue" : "neutral"}
                      >
                        {label}
                      </Badge>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-faint">{C.calendar.openWeek}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setSelectedDay(null)}
              aria-label={C.common.close}
              className="shrink-0 rounded-md px-2 py-1 text-sub transition-colors hover:bg-white/10 hover:text-ink"
            >
              ✕
            </button>
          </div>

          {event ? (
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs">
              <span>
                <span className="text-faint">{C.calendar.prizePool} </span>
                <span className="font-semibold text-ink">
                  {formatMoney(prizePoolOf(event, save.difficulty), { compact: true })}
                </span>
              </span>
              {points !== null ? (
                <span>
                  <span className="text-faint">{C.calendar.points} </span>
                  <span className="font-semibold text-ink">{points}</span>
                </span>
              ) : null}
              {result?.userPlacement ? (
                <Badge tone="blue">{placementLabelOf(placementLabels, event.tier, result.userPlacement)}</Badge>
              ) : save.pendingEventDef?.id === event.id ? (
                <Badge tone="orange">{C.calendar.registered}</Badge>
              ) : !isUserEventDef(save, event) ? (
                <span className="text-faint">{C.calendar.notQualified}</span>
              ) : null}
            </div>
          ) : null}

          {/* rc.36 (CAL-01): a finished event names its champion, with the crest. */}
          {event && result && hasChampion(result) ? (
            <div className="mt-2.5 flex items-center gap-2 text-xs">
              <TrophyIcon className="h-3.5 w-3.5 shrink-0 text-amber-300" />
              <span className="text-faint">{C.common.placement.champion}</span>
              <OrgMark save={save} orgRef={result.championRef} size="xs" className="shrink-0" />
              <span className="min-w-0 truncate font-semibold text-ink">{nameOfRef(save, result.championRef)}</span>
            </div>
          ) : null}

          {/* rc.36 (SUN-03): the event the user is out of that resolved this day — follow it. */}
          {followed && followed.day === day.day ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-blue/30 bg-blue/[0.06] px-3 py-2">
              <span className="flex min-w-0 items-center gap-2 text-xs">
                <EventTierIcon tier={followed.def.tier} className="h-3.5 w-3.5 shrink-0 text-blue-bright" />
                <span className="min-w-0 truncate font-semibold text-ink">{followed.def.name}</span>
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

          {/* v0.3 — booked scrim on this day (future: cancellable) */}
          {(() => {
            const booked = save.scheduledScrims.filter((s) => s.day === day.day);
            if (booked.length === 0) return null;
            return (
              <div className="mt-3 border-t border-line pt-2.5">
                {booked.map((s) => (
                  <div key={s.oppRef} className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-sub">
                      {C.scrim.title} · {C.scrim.vs(nameOfRef(save, s.oppRef))}
                    </span>
                    {day.day > save.clock.day ? (
                      <Button size="sm" variant="ghost" onClick={() => cancelScrim(s.day)}>
                        {C.scrim.cancel}
                      </Button>
                    ) : null}
                  </div>
                ))}
              </div>
            );
          })()}

          {/* v0.3 — scrim results played on this day */}
          {(() => {
            const played = save.scrimLog.filter(
              (e) => e.seasonIndex === save.clock.seasonIndex && e.day === day.day,
            );
            if (played.length === 0) return null;
            return (
              <div className="mt-3 border-t border-line pt-2.5 space-y-1.5">
                {played.map((e) => (
                  <div key={e.id} className="flex flex-wrap items-center gap-2 text-xs">
                    <Badge tone={e.won ? "good" : "neutral"}>
                      {e.won
                        ? C.scrim.won(e.oppName, e.scoreA, e.scoreB)
                        : C.scrim.lost(e.oppName, e.scoreA, e.scoreB)}
                    </Badge>
                    <span className="text-faint">{C.scrim.gameLine(e.games.join(" · "))}</span>
                  </div>
                ))}
              </div>
            );
          })()}

          {worldDefs.length > 0 ? (
            <div className="mt-3 border-t border-line pt-2.5">
              <p className="kicker mb-1.5 text-[10px]">{C.calendar.worldEvents}</p>
              <ul className="space-y-1">
                {worldDefs.map((def) => {
                  const res = resultByEvent.get(def.id);
                  return (
                    <li
                      key={def.id}
                      className="flex flex-wrap items-center gap-2 text-xs text-sub"
                    >
                      {def.region ? (
                        <Badge className={cx("!px-1.5 !text-[9px]", REGION_BADGE[def.region])}>
                          {def.region}
                        </Badge>
                      ) : null}
                      <span>{def.name}</span>
                      {res && hasChampion(res) ? (
                        <span className="text-faint">
                          · {C.common.placement.champion}: {nameOfRef(save, res.championRef)}
                        </span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </Panel>
      </div>
    );
  };

  const splits = [1, 2, 3] as const;

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-3 py-5 sm:px-4">
      {/* 1 — header: date chip + season/split badges ------------------------ */}
      <div className="rise-in">
        <SectionTitle
          kicker={C.meta.title}
          title={C.calendar.title}
          right={
            <Badge tone="orange">
              {C.calendar.today} · {formatDateShort(D, clk.date)}
            </Badge>
          }
        />
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Badge>{clk.season}</Badge>
          {clk.split ? <Badge tone="blue">{C.calendar.split(clk.split)}</Badge> : null}
        </div>
      </div>

      {windowDaysLeft !== null ? (
        <Panel glow="blue" className="rise-in flex flex-wrap items-center gap-2.5 px-4 py-3">
          <Badge tone="blue">{C.calendar.windowOpen}</Badge>
          <span className="text-sm text-sub">{C.calendar.windowCloses(windowDaysLeft)}</span>
        </Panel>
      ) : null}

      {/* 2 — next for you (plan-ahead strip) -------------------------------- */}
      <section className="rise-in">
        <p className="kicker mb-2 text-[11px]">{C.calendar.nextForYou}</p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {stops.map((stop, i) => {
            const title = stop.event
              ? stop.event.name
              : stop.kind === "window"
                ? C.calendar.window
                : stop.kind === "payday"
                  ? C.calendar.payday
                  : C.calendar.seasonEnd;
            return (
              <button
                key={`${stop.kind}-${stop.day}`}
                type="button"
                onClick={() => selectDay(stop.day)}
                className={cx(
                  "min-w-[10.5rem] shrink-0 rounded-xl border px-3 py-2.5 text-left transition-colors",
                  i === 0
                    ? "border-orange/50 bg-orange/[0.06] hover:bg-orange/10"
                    : "border-line bg-white/[0.02] hover:border-line-strong",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-1.5">
                    {stop.event ? (
                      <EventTierIcon tier={stop.event.tier} className={cx("h-3.5 w-3.5 shrink-0", TIER_ICON_TONE[stop.event.tier])} />
                    ) : null}
                    <span className="display truncate text-xs font-bold text-ink">{title}</span>
                  </span>
                  {stop.event ? (
                    <TierChip tier={stop.event.tier} className="!px-1.5 !text-[9px]" />
                  ) : stop.kind === "window" ? (
                    <Badge tone="blue" className="!px-1.5 !text-[9px]">
                      {C.calendar.windowOpen}
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-1 text-[11px] text-sub">
                  {formatDateTiny(D, stop.date)}
                  <span className="text-faint"> · {formatDaysAway(D, stop.daysAway)}</span>
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {/* 3 — month calendar grid -------------------------------------------- */}
      <section>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="kicker text-[11px]">{C.calendar.monthView}</p>
          <button
            type="button"
            onClick={() => setShowWorld((v) => !v)}
            aria-pressed={showWorld}
            className={cx(
              "rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider transition-colors",
              showWorld
                ? "border-blue/50 bg-blue/10 text-blue-bright"
                : "border-line text-faint hover:text-sub",
            )}
          >
            {showWorld ? C.calendar.hideWorld : C.calendar.showWorld}
          </button>
        </div>

        {/* legend — rc.36 (CAL-01): the tier icons, the whole window in blue, no payroll marker
            (payroll stays in Finances) */}
        <div
          className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-faint"
          aria-label={C.calendar.legend}
        >
          <span className="inline-flex items-center gap-1">
            <span className="flex h-3.5 w-3.5 items-center justify-center rounded border border-orange/70 bg-orange/25">
              <EventTierIcon tier="regional" className="h-2.5 w-2.5 text-orange-bright" />
            </span>
            {C.calendar.matchday}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-3.5 w-5 rounded border border-blue/45 bg-blue/25" />
            {C.calendar.window}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-1 w-1 rounded-full bg-white/30" />
            {C.calendar.trainingDay}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full ring-2 ring-orange" />
            {C.calendar.today}
          </span>
          {showWorld ? (
            <span className="inline-flex items-center gap-1">
              <span className="h-1 w-1 rounded-full bg-white/45" />
              {C.calendar.worldEvents}
            </span>
          ) : null}
        </div>

        <div className="mt-3 space-y-5">
          {months.filter((g) => g.key === visibleMonth?.key).map((g) => {
            return (
              <div
                key={g.key}
                id={`cal-month-${g.key}`}
                className="scroll-mt-24"
              >
                <div className="mb-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => changeMonth(visibleMonthIndex - 1)} disabled={visibleMonthIndex === 0} aria-label={C.calendar.previousMonth} className="flex h-9 w-9 items-center justify-center rounded-lg border border-line text-sub transition-colors hover:border-line-strong hover:text-ink disabled:cursor-default disabled:opacity-25">‹</button>
                    <h2 className="display min-w-36 text-center text-sm font-bold uppercase tracking-wide text-ink" aria-live="polite">
                      {D.months[g.m - 1]} <span className="font-semibold text-faint">{g.y}</span>
                    </h2>
                    <button type="button" onClick={() => changeMonth(visibleMonthIndex + 1)} disabled={visibleMonthIndex === months.length - 1} aria-label={C.calendar.nextMonth} className="flex h-9 w-9 items-center justify-center rounded-lg border border-line text-sub transition-colors hover:border-line-strong hover:text-ink disabled:cursor-default disabled:opacity-25">›</button>
                  </div>
                  {/* rc.36 (CAL-01): the window(s) running through this month, end date named. */}
                  {windowRanges
                    .filter((r) => r.start <= g.days[g.days.length - 1].day && r.end >= g.days[0].day)
                    .map((r) => (
                      <span
                        key={r.start}
                        className="inline-flex items-center gap-1.5 rounded-full border border-blue/40 bg-blue/15 px-2 py-0.5 text-[10px] font-semibold text-blue-bright"
                      >
                        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-blue-bright" />
                        {C.calendar.windowUntil(formatDateTiny(D, dateOfDay(save.clock.seasonIndex, r.end)))}
                      </span>
                    ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {D.weekdays.map((w) => (
                    <div
                      key={w}
                      className="pb-0.5 text-center text-[9px] font-semibold uppercase tracking-wider text-faint"
                    >
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
                    const worldCount = showWorld ? (worldByDay.get(d.day)?.length ?? 0) : 0;
                    return (
                      <button
                        key={d.day}
                        type="button"
                        onClick={() => setSelectedDay(isSelected ? null : d.day)}
                        aria-pressed={isSelected}
                        aria-label={
                          formatDateShort(D, d.date) +
                          (cellLabel ? ` — ${cellLabel}` : "") +
                          (d.windowOpen ? ` · ${C.calendar.window}` : "")
                        }
                        title={cellLabel}
                        className={cx(
                          "relative flex min-h-11 flex-col items-center rounded-lg border pb-1 pt-1.5 text-[11px] leading-none transition-colors",
                          d.windowOpen
                            ? "border-blue/50 bg-blue/15 hover:bg-blue/20"
                            : ev
                            ? spectating
                              ? cx("border-line/60 hover:bg-white/[0.06]", d.windowOpen ? "bg-[#0d1a33]" : "bg-white/[0.03]")
                              : MATCHDAY_FILL[ev.tier]
                            : d.windowOpen
                              ? "border-blue/40 bg-blue/20 hover:bg-blue/25"
                              : "border-line/50 bg-white/[0.015] hover:bg-white/[0.05]",
                          d.isPast && !d.isToday && "opacity-40",
                          d.isToday && "ring-2 ring-orange",
                          isSelected && "border-white/60",
                        )}
                      >
                        <span className={cx(ev ? "font-bold text-ink" : d.windowOpen ? "font-semibold text-blue-bright" : "font-semibold text-sub")}>
                          {d.date.d}
                        </span>
                        <span className="mt-auto flex h-3 items-center gap-0.5 pt-0.5">
                          {ev ? (
                            <EventTierIcon
                              tier={ev.tier}
                              className={cx("h-3 w-3", spectating ? "text-white/40" : TIER_ICON_TONE[ev.tier])}
                            />
                          ) : followed && followed.day === d.day ? (
                            // rc.36 (SUN-03): an event the user is out of — muted, tap to follow it.
                            <EventTierIcon tier={followed.def.tier} className="h-3 w-3 text-white/40" />
                          ) : d.kinds.includes("scrim") ? (
                            // v0.3: a booked scrim reads as a ringed training dot.
                            <span
                              className="h-1.5 w-1.5 rounded-full bg-cyan/80 ring-1 ring-cyan/40"
                              title={C.calendar.scrimDay}
                            />
                          ) : d.kinds.includes("training") ? (
                            <span className="h-1 w-1 rounded-full bg-white/25" />
                          ) : null}
                          {worldCount > 0 ? (
                            <span
                              className="h-1 w-1 rounded-full bg-white/45"
                              title={C.calendar.worldEvents}
                            />
                          ) : null}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {sel && sel.date.m === g.m && sel.date.y === g.y ? renderDayDetail(sel) : null}
              </div>
            );
          })}
        </div>
      </section>

      {/* 4 — unofficial invite ------------------------------------------------ */}
      {save.unofficialOffer && !save.pendingEventDef ? (
        <Panel glow="blue" className="rise-in p-4">
          <p className="kicker mb-1 text-[11px]">{C.calendar.offerTitle}</p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="display text-base font-bold text-ink">
              {save.unofficialOffer.name}
            </span>
            <TierChip tier={save.unofficialOffer.tier} />
            <span className="text-xs text-faint">
              {formatDateShort(
                D,
                dateOfDay(save.clock.seasonIndex, save.unofficialOffer.day),
              )}{" "}
              · {formatDaysAway(D, Math.max(0, save.unofficialOffer.day - save.clock.day))}
            </span>
          </div>
          <p className="mt-1 text-xs text-sub">{C.calendar.skipHint}</p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={() => acceptUnofficial()}>
              {C.calendar.enter}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => passUnofficial()}>
              {C.calendar.skip}
            </Button>
          </div>
        </Panel>
      ) : null}

      {/* 5 — season overview strip -------------------------------------------- */}
      <Panel className="p-4">
        <p className="kicker mb-3 text-[11px]">{C.calendar.seasonOverview}</p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {splits.map((sp) => (
            <div key={sp} className="flex items-center gap-1.5">
              <span
                className={cx(
                  "text-[10px] font-semibold",
                  clk.split === sp ? "text-orange-bright" : "text-faint",
                )}
              >
                {C.calendar.split(sp)}
              </span>
              {[1, 2, 3].map((ord) => {
                const id = `${save.clock.seasonIndex}:${sp}:reg${ord}:${save.identity.region}`;
                return (
                  <span
                    key={ord}
                    title={C.calendar.regional(ord)}
                    className={cx(
                      "h-2.5 w-2.5 rounded-full",
                      resultByEvent.has(id) ? "bg-blue" : "bg-white/12",
                    )}
                  />
                );
              })}
              <span
                title={C.calendar.major}
                className={cx(
                  "h-2.5 w-2.5 rotate-45",
                  resultByEvent.has(`${save.clock.seasonIndex}:${sp}:major`)
                    ? "bg-orange"
                    : "bg-white/12",
                )}
              />
            </div>
          ))}
          <Badge
            tone={resultByEvent.has(`${save.clock.seasonIndex}:worlds`) ? "gold" : "neutral"}
          >
            ★ {C.calendar.worlds}
          </Badge>
        </div>
      </Panel>

      {/* 6 — footer actions ----------------------------------------------------- */}
      {/* rc.29 (CAR-09): below md the app's fixed bottom nav (~53 px) covered
          half of this bar — it now sits above it. */}
      <div ref={footerRef} className="sticky bottom-[4.25rem] z-10 md:bottom-3">
        <Panel strong className="flex flex-wrap items-center justify-end gap-2 p-3">
          {sundayStop ? (
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
            <AppLink
              href="/career/event"
              className={cx(
                "display inline-flex h-10 items-center justify-center gap-2 rounded-lg px-5 text-sm font-bold uppercase tracking-[0.12em]",
                "bg-gradient-to-b from-orange-bright to-orange text-[#1a0d02]",
                "shadow-[0_0_24px_rgba(249,115,22,0.3)] transition-all hover:brightness-110",
              )}
            >
              {C.calendar.advanceToStop(eventDue.name)}
            </AppLink>
          ) : (
            <>
              <Button
                variant="ghost"
                onClick={() => advanceDay()}
                disabled={save.phase !== "running"}
              >
                {C.calendar.advanceDay}
              </Button>
              <Button
                variant="primary"
                onClick={() => advanceToNextStop()}
                disabled={save.phase !== "running"}
              >
                {C.calendar.advanceToStop(nextStopLabel)}
              </Button>
            </>
          )}
        </Panel>
      </div>
    </div>
  );
}
