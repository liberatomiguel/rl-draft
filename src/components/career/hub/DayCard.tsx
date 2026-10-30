"use client";

/**
 * Road to Worlds hub — THE TIMELINE BLOCK (v2.0 hub rebuild R26, re-cut rc.2).
 *
 * The clock made tangible: today's date, the season progress, a seven-day
 * strip with a marker that GLIDES to the next chip on every advance (and the
 * whole strip slides in when a new week starts), and the three ways to move
 * time in a strict hierarchy:
 *   PRIMARY   Play / Pause — the clock runs by itself until something needs you.
 *   SECONDARY Skip to the next stop (event, window, payday, season end).
 *   TERTIARY  +1 day, quiet.
 * When a decision is due the whole block becomes that decision (rc.34,
 * UX-01a: `decision` — hub/DecisionBlock picks it from the one queue,
 * careerDecisions.pendingDecisionsOf; rc.2 did it for the weekly insert only):
 * the clock does not move until the player answers.
 * v2.0 (R40): the weekend reads at a glance — Saturday = Qualifier / Swiss
 * stage, Sunday = the Regional / Championship Sunday (a spectated Major is a
 * muted chip, not a matchday) — and a Major / Worlds paused after its
 * Saturday Swiss turns the primary control into "Continue to Championship
 * Sunday".
 */

import { useRouter } from "next/navigation";
import type { CareerCopy } from "@/content/careerCopy";
import type { CareerSave } from "@/engine/career/types";
import { cx } from "@/lib/util";
import { useCareerStore } from "@/store/careerStore";
import {
  agendaDays,
  clockLabel,
  DAYS_PER_SEASON,
  dayOfWeekOf,
  upcomingStops,
  useRevealHeldEventId,
  visibleContinueKind,
  type AgendaDay,
} from "@/components/career/careerUi";
import { formatDateShort, formatDaysAway } from "@/components/career/dateText";
import { ContinueToSundayLabel, roleTitleOf } from "@/components/career/event/WeekendPlan";
import { weekendRoleOf } from "@/components/career/event/weekendView";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";

const PlayGlyph = () => (
  <svg viewBox="0 0 12 12" className="h-3.5 w-3.5 fill-current" aria-hidden>
    <path d="M2.5 1.5v9l8-4.5z" />
  </svg>
);
const PauseGlyph = () => (
  <svg viewBox="0 0 12 12" className="h-3.5 w-3.5 fill-current" aria-hidden>
    <path d="M2.5 1.5h2.6v9H2.5zM6.9 1.5h2.6v9H6.9z" />
  </svg>
);

/** R40: a two-day event's chips read Swiss stage / Championship Sunday; others the event name. */
function eventChipLabel(C: CareerCopy, d: AgendaDay): string {
  if (!d.event) return "";
  const role = weekendRoleOf(d.event, d.day);
  return role === "swissDay" || role === "championshipSunday" ? roleTitleOf(C, role, d.event) : d.event.name;
}

/** R40: today's header badge — Qualifier / Swiss stage / Championship Sunday / Matchday. */
function dayBadgeOf(C: CareerCopy, d: AgendaDay): string | null {
  if (!d.event || d.participation === "spectating") return null;
  const role = weekendRoleOf(d.event, d.day);
  if (role === "qualifier") return C.common.tier.qualifier;
  if (role === "swissDay" || role === "championshipSunday") return roleTitleOf(C, role, d.event);
  return C.calendar.matchday;
}

function DayChip({ d, C }: { d: AgendaDay; C: CareerCopy }) {
  const D = C.dates;
  // R40: a spectated Major / Worlds is on the agenda but is not the user's matchday.
  const spectating = d.participation === "spectating";
  const matchday = d.kinds.includes("matchday") && !spectating;
  const windowOpens = d.kinds.includes("windowOpen");
  const payday = d.kinds.includes("payday");
  const scrim = d.kinds.includes("scrim");
  const rest = d.kinds.includes("rest");
  const training = d.kinds.includes("training");

  const label = d.event
    ? eventChipLabel(C, d)
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

  const title = d.event && label !== d.event.name ? `${d.event.name} · ${label}` : label;

  return (
    <div
      title={title || undefined}
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
        {spectating ? <span className="h-1.5 w-1.5 rounded-full ring-1 ring-white/35" /> : null}
        {windowOpens ? <span className="h-1.5 w-1.5 rounded-full bg-blue" /> : null}
        {payday ? <span className="h-1.5 w-1.5 rounded-full bg-amber-300" /> : null}
        {scrim ? <span className="h-1.5 w-1.5 rounded-full bg-cyan" /> : null}
        {rest && !matchday && !spectating ? <span className="h-px w-2 bg-white/20" /> : null}
      </span>
      <span
        className={cx(
          // R40: two lines, so "Championship Sunday" reads whole.
          "hidden w-full text-center text-[9px] leading-tight [overflow-wrap:anywhere] sm:line-clamp-2",
          matchday ? "font-semibold text-orange-bright" : "text-faint",
        )}
      >
        {label}
      </span>
    </div>
  );
}

export function DayCard({
  save,
  C,
  decision,
  footer,
}: {
  save: CareerSave;
  C: CareerCopy;
  /**
   * rc.34 (UX-01a): the decision the block shows instead of the clock, with its "1 of N".
   * rc.34 review (Gate 3b): `inline` — one that does not hold the clock (a fresh
   * invite) shows above the clock's controls instead of replacing them.
   */
  decision?: { body: React.ReactNode; count?: string; inline?: boolean } | null;
  /** rc.34: the line under the block — the other decisions, with their deadlines. */
  footer?: React.ReactNode;
}) {
  const D = C.dates;
  const router = useRouter();
  const advanceDay = useCareerStore((s) => s.advanceDay);
  const advanceToNextStop = useCareerStore((s) => s.advanceToNextStop);
  const continueEventToNextDay = useCareerStore((s) => s.continueEventToNextDay);
  const autoAdvance = useCareerStore((s) => s.autoAdvance);
  const setAutoAdvance = useCareerStore((s) => s.setAutoAdvance);
  const revealHeld = useRevealHeldEventId(save);

  const clock = clockLabel(save);
  const today = save.clock.day;
  const monday = today - (dayOfWeekOf(today) - 1);
  const weekDays = agendaDays(save, monday, 7);
  const todayIdx = Math.max(0, weekDays.findIndex((d) => d.isToday));

  // rc.29 (CAR-02): an unfinished Saturday reveal keeps the event's own Continue.
  const kind = visibleContinueKind(save, revealHeld);
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
  // R40: today's role on the weekend (the header badge) — the user's own events only.
  const todayRole =
    kind === "eventPaused"
      ? C.event.swissComplete
      : weekDays[todayIdx]
        ? dayBadgeOf(C, weekDays[todayIdx])
        : null;
  const blockedPrimary =
    kind === "eventPaused"
      ? {
          // R40: Saturday's Swiss is done — exactly one day on, then the Sunday card.
          label: <ContinueToSundayLabel />,
          go: () => {
            continueEventToNextDay();
            router.push("/career/event");
          },
        }
      : kind === "event"
        ? { label: C.hub.continueTo(eventName), go: () => router.push("/career/event") }
        : kind === "seasonReview"
          ? { label: C.ceremonies.seasonReview, go: () => router.push("/career/season") }
          : kind === "ended"
            ? { label: C.ceremonies.legacyTitle, go: () => router.push("/career/season") }
            : null;

  // An inline decision (a fresh invite) is not required: the clock's own card keeps its look.
  const inserting = Boolean(decision) && !decision?.inline;

  return (
    <Panel strong glow={inserting ? "blue" : "orange"} className={cx("rise-in overflow-hidden p-4 sm:p-5", inserting && "!border-cyan/40")}>
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
          {todayRole && !inserting ? <Badge tone="orange">{todayRole}</Badge> : null}
          {clock.windowOpen ? <Badge tone="blue">{C.calendar.windowOpen}</Badge> : null}
          {clock.kind === "open" && running && !inserting ? <Badge tone="good">{C.hub.trainingWeek}</Badge> : null}
          {inserting ? <Badge tone="blue">{C.hub.nowDecision}</Badge> : null}
          {decision?.count ? <span className="text-[11px] font-semibold text-cyan">{decision.count}</span> : null}
          <span className="text-[11px] text-faint">{C.hub.dayOf(today, DAYS_PER_SEASON)}</span>
        </div>
      </div>
      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/10" aria-hidden>
        <div
          className="h-full rounded-full bg-orange/70 transition-[width] duration-500"
          style={{ width: `${Math.min(100, (today / DAYS_PER_SEASON) * 100)}%` }}
        />
      </div>

      {decision ? <div className="mt-4">{decision.body}</div> : null}
      {decision && !decision.inline ? null : (
        <>
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

          {/* controls: primary (play/pause) · secondary (skip to stop) · tertiary (+1 day) */}
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
                  onClick={() => setAutoAdvance(!autoAdvance)}
                  aria-pressed={autoAdvance}
                  disabled={!running}
                >
                  <span className="flex items-center gap-2">
                    {autoAdvance ? <PauseGlyph /> : <PlayGlyph />}
                    {autoAdvance ? C.hub.pause : C.hub.play}
                  </span>
                </Button>
                <Button
                  variant="secondary"
                  size="md"
                  className="min-h-11"
                  onClick={advanceToNextStop}
                  disabled={!running || autoAdvance}
                >
                  {C.hub.skipTo(stopLabel)}
                </Button>
                <Button variant="ghost" size="sm" className="ml-auto text-faint" onClick={advanceDay} disabled={!running || autoAdvance}>
                  {C.hub.plusDay}
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
        </>
      )}
      {footer ? <div className="mt-4 border-t border-line/60 pt-3">{footer}</div> : null}
    </Panel>
  );
}
