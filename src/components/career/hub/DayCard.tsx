"use client";

/**
 * Road to Worlds hub — THE DAY CARD (v2.0 hub rebuild, R26).
 *
 * The clock made tangible: today's date, the season progress, a seven-day
 * strip with a marker that GLIDES to the next chip on every advance (and the
 * whole strip slides in when a new week starts), and the two ways to move
 * time — one day at a time (primary) or skip to the next stop. When the clock
 * is blocked (matchday, season stop) the primary action becomes that stop.
 */

import { useRouter } from "next/navigation";
import type { CareerCopy } from "@/content/careerCopy";
import type { CareerSave } from "@/engine/career/types";
import { cx } from "@/lib/util";
import { useCareerStore } from "@/store/careerStore";
import {
  agendaDays,
  clockLabel,
  continueKind,
  DAYS_PER_SEASON,
  dayOfWeekOf,
  upcomingStops,
  type AgendaDay,
} from "@/components/career/careerUi";
import { formatDateShort, formatDaysAway } from "@/components/career/dateText";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";

const PlayGlyph = () => (
  <svg viewBox="0 0 12 12" className="h-3 w-3 fill-current" aria-hidden>
    <path d="M2.5 1.5v9l8-4.5z" />
  </svg>
);
const PauseGlyph = () => (
  <svg viewBox="0 0 12 12" className="h-3 w-3 fill-current" aria-hidden>
    <path d="M2.5 1.5h2.6v9H2.5zM6.9 1.5h2.6v9H6.9z" />
  </svg>
);

function DayChip({ d, C }: { d: AgendaDay; C: CareerCopy }) {
  const D = C.dates;
  const matchday = d.kinds.includes("matchday");
  const windowOpens = d.kinds.includes("windowOpen");
  const payday = d.kinds.includes("payday");
  const scrim = d.kinds.includes("scrim");
  const rest = d.kinds.includes("rest");
  const training = d.kinds.includes("training");

  const label = d.event
    ? d.event.name
    : windowOpens
      ? C.calendar.window
      : payday
        ? C.calendar.payday
        : scrim
          ? C.calendar.scrimDay
          : rest
            ? C.calendar.restDay
            : training
              ? C.calendar.trainingDay
              : "";

  return (
    <div
      title={label || undefined}
      className={cx(
        "relative z-10 flex min-h-[4.5rem] flex-col items-center gap-0.5 rounded-lg border px-0.5 py-1.5",
        matchday ? "border-orange/50 bg-orange/10" : "border-line bg-white/[0.03]",
        d.isToday && "day-tick",
        d.isPast && "opacity-40",
      )}
    >
      <span className="kicker text-[8px] leading-none sm:text-[9px]">{D.weekdays[d.dow - 1]}</span>
      <span
        className={cx(
          "display text-base font-bold leading-none",
          matchday ? "text-orange-bright" : d.isToday ? "text-ink" : "text-sub",
        )}
      >
        {d.date.d}
      </span>
      <span className="flex h-1.5 items-center gap-0.5" aria-hidden>
        {matchday ? <span className="h-1.5 w-1.5 rounded-full bg-orange" /> : null}
        {windowOpens ? <span className="h-1.5 w-1.5 rounded-full bg-blue" /> : null}
        {payday ? <span className="h-1.5 w-1.5 rounded-full bg-amber-300" /> : null}
        {scrim ? <span className="h-1.5 w-1.5 rounded-full bg-cyan" /> : null}
        {rest && !matchday ? <span className="h-px w-2 bg-white/20" /> : null}
      </span>
      <span
        className={cx(
          "hidden w-full truncate text-center text-[9px] leading-tight sm:block",
          matchday ? "font-semibold text-orange-bright" : "text-faint",
        )}
      >
        {label}
      </span>
    </div>
  );
}

export function DayCard({ save, C }: { save: CareerSave; C: CareerCopy }) {
  const D = C.dates;
  const router = useRouter();
  const advanceDay = useCareerStore((s) => s.advanceDay);
  const advanceToNextStop = useCareerStore((s) => s.advanceToNextStop);
  const autoAdvance = useCareerStore((s) => s.autoAdvance);
  const setAutoAdvance = useCareerStore((s) => s.setAutoAdvance);

  const clock = clockLabel(save);
  const today = save.clock.day;
  const monday = today - (dayOfWeekOf(today) - 1);
  const weekDays = agendaDays(save, monday, 7);
  const todayIdx = Math.max(0, weekDays.findIndex((d) => d.isToday));

  const kind = continueKind(save);
  const running = save.phase === "running";
  const nextStop = upcomingStops(save, 1)[0] ?? null;
  const stopLabel = nextStop
    ? nextStop.kind === "event" && nextStop.event
      ? nextStop.event.name
      : nextStop.kind === "window"
        ? C.calendar.window
        : nextStop.kind === "payday"
          ? C.calendar.payday
          : C.calendar.seasonEnd
    : C.calendar.seasonEnd;

  const eventName = save.pendingEventDef?.name ?? save.activeEvent?.def.name ?? "";
  const blockedPrimary =
    kind === "event"
      ? { label: C.hub.continueTo(eventName), go: () => router.push("/career/event") }
      : kind === "seasonReview"
        ? { label: C.ceremonies.seasonReview, go: () => router.push("/career/season") }
        : kind === "ended"
          ? { label: C.ceremonies.legacyTitle, go: () => router.push("/career/season") }
          : null;

  return (
    <Panel strong glow="orange" className="rise-in overflow-hidden p-4 sm:p-5">
      {/* header: date + season progress */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="kicker text-[10px]">
            {C.hub.today}
            {clock.split ? <span className="text-faint"> · {C.calendar.split(clock.split)} · {C.hub.week(clock.week)}</span> : null}
          </p>
          <h2 key={today} className="display rise-in text-2xl font-bold uppercase tracking-wide text-ink sm:text-3xl">
            {formatDateShort(D, clock.date)}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {clock.windowOpen ? <Badge tone="blue">{C.calendar.windowOpen}</Badge> : null}
          {clock.kind === "open" && running ? <Badge tone="good">{C.hub.trainingWeek}</Badge> : null}
          <span className="text-[11px] text-faint">{C.hub.dayOf(today, DAYS_PER_SEASON)}</span>
        </div>
      </div>
      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/10" aria-hidden>
        <div
          className="h-full rounded-full bg-orange/70 transition-[width] duration-500"
          style={{ width: `${Math.min(100, (today / DAYS_PER_SEASON) * 100)}%` }}
        />
      </div>

      {/* the week strip — remounts (and slides in) when the week turns */}
      <div key={monday} className="week-slide relative mt-4">
        <div
          className="day-marker pointer-events-none absolute inset-y-0 z-0 rounded-lg ring-2 ring-orange"
          style={{ left: `calc(${todayIdx} * (100% + 0.375rem) / 7)`, width: "calc((100% - 6 * 0.375rem) / 7)" }}
          aria-hidden
        />
        <div className="grid grid-cols-7 gap-1.5">
          {weekDays.map((d) => (
            // Today's chip remounts when the clock lands on it, so `day-tick`
            // plays on every advance without any render-time bookkeeping.
            <DayChip key={d.isToday ? `${d.day}:today` : d.day} d={d} C={C} />
          ))}
        </div>
      </div>

      {/* controls */}
      <div className="mt-4 flex flex-wrap items-center gap-2.5">
        {blockedPrimary ? (
          <Button variant="primary" size="lg" className="w-full sm:w-auto" onClick={blockedPrimary.go}>
            {blockedPrimary.label}
          </Button>
        ) : (
          <>
            <Button
              variant="primary"
              size="lg"
              className="w-full sm:w-auto"
              onClick={advanceDay}
              disabled={!running || autoAdvance}
            >
              {C.hub.advanceDay} <span aria-hidden>→</span>
            </Button>
            <Button
              variant="secondary"
              size="md"
              className="min-h-11"
              onClick={advanceToNextStop}
              disabled={!running || autoAdvance}
            >
              {C.hub.continueTo(stopLabel)}
            </Button>
            <Button
              variant="ghost"
              size="md"
              className="min-h-11"
              onClick={() => setAutoAdvance(!autoAdvance)}
              aria-pressed={autoAdvance}
              title={autoAdvance ? C.hub.pause : C.hub.play}
              disabled={!running}
            >
              <span className="flex items-center gap-1.5">
                {autoAdvance ? <PauseGlyph /> : <PlayGlyph />}
                {autoAdvance ? C.hub.pause : C.hub.play}
              </span>
            </Button>
          </>
        )}
      </div>
      {!blockedPrimary && nextStop ? (
        <p className="mt-2 text-xs text-sub">
          {autoAdvance
            ? C.hub.autoplayOn
            : C.hub.nextStop(stopLabel, `${formatDateShort(D, nextStop.date)} · ${formatDaysAway(D, nextStop.daysAway)}`)}
        </p>
      ) : null}
    </Panel>
  );
}
