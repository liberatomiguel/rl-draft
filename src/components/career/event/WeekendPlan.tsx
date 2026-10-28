"use client";

/**
 * Road to Worlds v2.0 (R40) — THE WEEKEND strip: Saturday → Sunday, what
 * each day is and where the clock stands (done ✓ · today · tomorrow).
 *   regional week   Qualifier (Swiss only, top 8 through) → the Regional
 *   Major / Worlds  Swiss stage → Championship Sunday (the playoffs)
 * Shown in the event lobby and on the Saturday Swiss-complete panel; the
 * label helpers below are shared with the HQ week strip and the calendar.
 */

import { CAREER_QUALIFIER, TOURNAMENT } from "@/config/balance";
import type { CareerCopy } from "@/content/careerCopy";
import { useCareerCopy } from "@/content/careerCopy";
import { isTwoDayEvent, regionalForQualifier } from "@/engine/career/calendar";
import type { CareerEventDef, CareerSave } from "@/engine/career/types";
import { cx } from "@/lib/util";
import { dateOfDay } from "@/components/career/careerUi";
import { formatDateShort, formatDaysAway } from "@/components/career/dateText";
import { Panel } from "@/components/ui/Panel";
import { weekendPlanOf, type WeekendPlanDay, type WeekendRole } from "./weekendView";

// ---------------------------------------------------------------------------
// Shared labels
// ---------------------------------------------------------------------------

/** The headline of a weekend day: "Qualifier", the regional's name, "Swiss stage", "Championship Sunday". */
export function roleTitleOf(C: CareerCopy, role: WeekendRole, def: CareerEventDef): string {
  switch (role) {
    case "qualifier":
      return C.common.tier.qualifier;
    case "swissDay":
      return C.event.swissStage;
    case "championshipSunday":
      return C.event.championshipSunday;
    default:
      return def.name;
  }
}

/** One line on what the day is (counts come from balance, never the copy). */
export function roleSubOf(C: CareerCopy, role: WeekendRole): string | null {
  switch (role) {
    case "qualifier":
      return C.event.roleQualifierSub(TOURNAMENT.swiss.teams, CAREER_QUALIFIER.advanceSlots);
    case "regional":
      return C.event.roleRegionalSub(CAREER_QUALIFIER.directSlots, CAREER_QUALIFIER.advanceSlots);
    case "swissDay":
      return C.event.roleSwissSub(TOURNAMENT.swiss.teams, TOURNAMENT.swiss.winsToAdvance);
    case "championshipSunday":
      return C.event.roleSundaySub(TOURNAMENT.playoffs.teams);
    default:
      return null;
  }
}

/** The event's format line (lobby, HQ card): a qualifier names the regional it feeds. */
export function formatLineOf(C: CareerCopy, def: CareerEventDef): string {
  if (def.format === "single") return C.event.formatSingle;
  if (def.format === "swissOnly") {
    return C.event.formatQualifier(
      TOURNAMENT.swiss.teams,
      CAREER_QUALIFIER.advanceSlots,
      TOURNAMENT.swiss.winsToAdvance,
      regionalForQualifier(def)?.name ?? C.common.tier.regional,
    );
  }
  if (isTwoDayEvent(def)) return C.event.formatTwoDay(TOURNAMENT.swiss.teams, TOURNAMENT.playoffs.teams);
  return C.event.formatSwiss;
}

// ---------------------------------------------------------------------------
// The strip
// ---------------------------------------------------------------------------

export interface WeekendNote {
  text: string;
  tone: "good" | "blue" | "bad" | "orange";
}

const NOTE_TONE: Record<WeekendNote["tone"], string> = {
  good: "text-good",
  blue: "text-blue-bright",
  bad: "text-bad",
  orange: "text-orange-bright",
};

/**
 * "Continue to Championship Sunday", short on phones ("Continue to Sunday")
 * so the full-width button never wraps.
 */
export function ContinueToSundayLabel() {
  const C = useCareerCopy();
  return (
    <>
      <span className="sm:hidden">{C.event.continueToSundayShort}</span>
      <span className="hidden sm:inline">{C.event.continueToSunday}</span>
    </>
  );
}

export function WeekendPlan({
  save,
  def,
  notes,
  doneRoles,
  bare = false,
  className,
  style,
}: {
  save: CareerSave;
  def: CareerEventDef;
  /** Optional per-role footnote (e.g. "You qualified", "Seed #3"). */
  notes?: Partial<Record<WeekendRole, WeekendNote>>;
  /** Days already complete even though the clock is still on them (the paused Saturday). */
  doneRoles?: WeekendRole[];
  /** Render without its own Panel (inside a hero card). */
  bare?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const C = useCareerCopy();
  const plan = weekendPlanOf(def, save.clock.day);
  if (plan.length === 0) return null;

  const body = (
    <>
      <p className={cx("kicker mb-2.5 text-[10px]", bare && "text-center")}>{C.event.weekendTitle}</p>
      <ol className="relative grid grid-cols-2 gap-2.5">
        {plan.map((d, i) => (
          <WeekendDayCell
            key={d.day}
            save={save}
            C={C}
            d={doneRoles?.includes(d.role) ? { ...d, state: "done" } : d}
            note={notes?.[d.role] ?? null}
            arrow={i === 0}
          />
        ))}
      </ol>
    </>
  );

  if (bare) {
    return (
      <div className={className} style={style}>
        {body}
      </div>
    );
  }
  return (
    <Panel className={cx("rise-in p-4", className)} style={style}>
      {body}
    </Panel>
  );
}

function WeekendDayCell({
  save,
  C,
  d,
  note,
  arrow,
}: {
  save: CareerSave;
  C: CareerCopy;
  d: WeekendPlanDay;
  note: WeekendNote | null;
  arrow: boolean;
}) {
  const D = C.dates;
  const sub = roleSubOf(C, d.role);
  const date = formatDateShort(D, dateOfDay(save.clock.seasonIndex, d.day));
  return (
    <li
      aria-current={d.state === "today" ? "date" : undefined}
      className={cx(
        "relative min-w-0 rounded-xl border p-2.5 text-left sm:p-3",
        d.state === "today"
          ? "border-orange/60 bg-orange/10 shadow-[0_0_18px_rgba(249,115,22,0.14)]"
          : d.state === "done"
            ? "border-line bg-white/[0.02]"
            : "border-line bg-white/[0.04]",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-1.5 gap-y-1">
        <span className={cx("kicker !text-[9px]", d.state === "today" && "text-orange-bright")}>
          {date}
        </span>
        <span
          className={cx(
            "display shrink-0 rounded px-1.5 py-px text-[9px] font-bold uppercase tracking-wider",
            d.state === "today"
              ? "bg-orange/20 text-orange-bright"
              : d.state === "done"
                ? "bg-good/15 text-good"
                : "bg-white/8 text-sub",
          )}
        >
          {d.state === "today"
            ? C.calendar.today
            : d.state === "done"
              ? `✓ ${C.calendar.done}`
              : formatDaysAway(D, d.day - save.clock.day)}
        </span>
      </div>
      <p
        className={cx(
          "display mt-1.5 text-sm font-bold uppercase leading-tight tracking-wide [overflow-wrap:anywhere] sm:text-base",
          d.state === "done" ? "text-sub" : "text-ink",
        )}
      >
        {roleTitleOf(C, d.role, d.def)}
      </p>
      {sub ? <p className="mt-0.5 text-[11px] leading-snug text-sub">{sub}</p> : null}
      {note ? <p className={cx("mt-1 text-[11px] font-semibold", NOTE_TONE[note.tone])}>{note.text}</p> : null}
      {arrow ? (
        <span
          aria-hidden
          className="absolute -right-[0.95rem] top-1/2 z-10 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-[color:var(--bg)] text-faint"
        >
          <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 fill-current">
            <path d="M4 2.5 8 6l-4 3.5z" />
          </svg>
        </span>
      ) : null}
    </li>
  );
}
