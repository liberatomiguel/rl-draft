"use client";

/**
 * rc.36 (ROADMAP UX-02, R87): the board's season goal as rows — the target
 * (prominent) and the stretch (secondary), each with its icon, its words,
 * a progress meter, the chances left, the deadline and its status. HQ's goal
 * card and the season review both draw it from `seasonGoalsViewOf` (the goal
 * is fixed at the season's start; results only fill the meter).
 */

import type { CareerCopy } from "@/content/careerCopy";
import type { SeasonGoalLabel, SeasonGoalRowView, SeasonGoalsView } from "@/engine/career/seasonGoals";
import { cx } from "@/lib/util";
import { dateOfDay } from "@/components/career/careerUi";
import { formatDateTiny } from "@/components/career/dateText";

/** The words of a goal: the season's own, rc.35's split model, or a legacy key. */
export function seasonGoalText(label: SeasonGoalLabel, C: CareerCopy): string {
  if (label.scope === "season") return C.goals.season(label.kind, label.count, label.place);
  if (label.scope === "split") return C.goals.model(label.kind, label.count, label.place);
  const suffix = label.key.split(".").pop() ?? label.key;
  const v = (C.goals as Record<string, unknown>)[suffix];
  return typeof v === "string" ? v : label.key;
}

type Family = "cup" | "regional" | "major" | "worlds";

function familyOf(label: SeasonGoalLabel): Family {
  if (label.scope === "legacy") {
    if (/worlds/i.test(label.key)) return "worlds";
    if (/major/i.test(label.key)) return "major";
    return "regional";
  }
  if (label.kind === "cupFinal" || label.kind === "cupWin") return "cup";
  if (label.kind === "majorQualify" || label.kind === "majorFinish") return "major";
  if (label.kind === "worldsQualify" || label.kind === "worldsFinish") return "worlds";
  return "regional";
}

const FAMILY_TONE: Record<Family, string> = {
  cup: "bg-cyan/12 text-cyan",
  regional: "bg-blue/15 text-blue-bright",
  major: "bg-orange/15 text-orange-bright",
  worlds: "bg-amber-400/15 text-amber-300",
};

/** One glyph per goal family — 24×24 currentColor, round caps (the house style). */
function GoalIcon({ family, className }: { family: Family; className?: string }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true,
  };
  switch (family) {
    case "cup": // a small cup on a stand
      return (
        <svg {...common}>
          <path d="M8 4h8v4.5a4 4 0 0 1-8 0V4Z" />
          <path d="M12 12.5V16M9 19.5h6M10 16h4" />
        </svg>
      );
    case "regional": // a pennant
      return (
        <svg {...common}>
          <path d="M6 21V4" />
          <path d="M6 5h11l-2.5 3.5L17 12H6" />
        </svg>
      );
    case "major": // a globe
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
          <path d="M4 12h16M12 4c2.6 2.4 2.6 13.6 0 16M12 4c-2.6 2.4-2.6 13.6 0 16" />
        </svg>
      );
    case "worlds": // a crown
      return (
        <svg {...common}>
          <path d="M4 18h16M5 18 4 7l5 4 3-6 3 6 5-4-1 11" />
        </svg>
      );
  }
}

type Status = "done" | "open" | "out" | "met" | "missed";

function statusOf(row: SeasonGoalRowView): Status | null {
  if (row.met !== null) return row.met ? "met" : "missed";
  if (!row.progress) return null;
  if (row.progress.hit) return "done";
  return row.progress.out ? "out" : "open";
}

const STATUS_TONE: Record<Status, string> = {
  done: "border-good/40 bg-good/10 text-good",
  met: "border-good/40 bg-good/10 text-good",
  open: "border-blue/40 bg-blue/10 text-blue-bright",
  out: "border-bad/40 bg-bad/10 text-bad",
  missed: "border-bad/40 bg-bad/10 text-bad",
};

/** The meter: one pip per count (up to nine), else a bar. */
function Meter({ done, target, tone }: { done: number; target: number; tone: string }) {
  if (target <= 9) {
    return (
      <span className="flex items-center gap-1" aria-hidden>
        {Array.from({ length: target }, (_, i) => (
          <span
            key={i}
            className={cx("h-2 w-4 rounded-sm sm:w-5", i < done ? tone : "bg-white/10")}
          />
        ))}
      </span>
    );
  }
  return (
    <span className="block h-2 w-24 overflow-hidden rounded-full bg-white/10" aria-hidden>
      <span className={cx("block h-full rounded-full", tone)} style={{ width: `${Math.min(100, (100 * done) / target)}%` }} />
    </span>
  );
}

const METER_TONE: Record<Family, string> = {
  cup: "bg-cyan",
  regional: "bg-blue-bright",
  major: "bg-orange-bright",
  worlds: "bg-amber-300",
};

function GoalRow({
  row,
  C,
  seasonIndex,
  primary,
  showStatus = true,
}: {
  row: SeasonGoalRowView;
  C: CareerCopy;
  seasonIndex: number;
  primary: boolean;
  showStatus?: boolean;
}) {
  const family = familyOf(row.label);
  const status = statusOf(row);
  const p = row.progress;
  const kind = row.label.scope === "legacy" ? "" : row.label.kind;
  const left =
    p && !p.hit && !p.out && row.met === null
      ? row.label.scope === "split"
        ? C.goals.splitLeft(p.left)
        : C.goals.left(p.left, kind)
      : null;
  const deadline = row.deadline ? C.goals.deadline[row.deadline.event]?.(row.deadline.week) : null;
  const deadlineDate = row.deadline
    ? formatDateTiny(C.dates, dateOfDay(seasonIndex, row.deadline.on.day))
    : null;
  return (
    <div className={cx("flex gap-3", !primary && "opacity-90")}>
      <span
        className={cx(
          "flex shrink-0 items-center justify-center rounded-lg",
          primary ? "h-10 w-10" : "h-8 w-8",
          FAMILY_TONE[family],
        )}
      >
        <GoalIcon family={family} className={primary ? "h-5 w-5" : "h-4 w-4"} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="kicker !text-[9px]">{C.goals.role[row.role]}</span>
          {status && showStatus ? (
            <span
              className={cx(
                "display shrink-0 rounded border px-1.5 py-px text-[9px] font-bold uppercase tracking-[0.12em]",
                STATUS_TONE[status],
              )}
            >
              {C.goals.status[status]}
            </span>
          ) : null}
        </div>
        <p
          className={cx(
            "display font-bold uppercase tracking-wide",
            primary ? "text-base leading-tight text-ink" : "text-sm leading-tight text-sub",
          )}
        >
          {seasonGoalText(row.label, C)}
        </p>
        {p ? (
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            <Meter done={p.done} target={p.target} tone={METER_TONE[family]} />
            <span className="text-[11px] font-semibold text-sub">
              {p.done}/{p.target}
              {left ? <span className="font-normal text-faint"> · {left}</span> : null}
            </span>
          </div>
        ) : null}
        {deadline && row.met === null && primary ? (
          <p className="mt-1 flex items-start gap-1 text-[10px] leading-snug text-faint">
            <svg viewBox="0 0 24 24" className="mt-px h-3 w-3 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
              <circle cx="12" cy="13" r="7" />
              <path d="M12 9.5V13l2.5 1.5M10 3h4" strokeLinecap="round" />
            </svg>
            <span className="min-w-0">
              {deadline}
              {deadlineDate ? <span className="text-faint/80"> · {deadlineDate}</span> : null}
            </span>
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** The target and the stretch, then the "why" chips and what a miss costs. */
export function SeasonGoalRows({
  view,
  C,
  seasonIndex,
  showWhy = true,
  showStatus = true,
}: {
  view: SeasonGoalsView;
  C: CareerCopy;
  seasonIndex: number;
  showWhy?: boolean;
  showStatus?: boolean;
}) {
  const b = view.basis;
  const chips: string[] = [];
  if (b) {
    chips.push(C.goals.why.rank(b.rank, b.teams));
    chips.push(C.goals.why.stage[b.stage] ?? b.stage);
    if (b.money) chips.push(C.goals.why.money[b.money]);
    if (b.last) chips.push(C.goals.why.last[b.last]);
  }
  return (
    <div className="space-y-3">
      <GoalRow row={view.target} C={C} seasonIndex={seasonIndex} primary showStatus={showStatus} />
      <div className="border-t border-line/60 pt-3">
        <GoalRow row={view.stretch} C={C} seasonIndex={seasonIndex} primary={false} showStatus={showStatus} />
      </div>
      {showWhy ? (
        <div className="space-y-1.5 border-t border-line/60 pt-2.5">
          {chips.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {chips.map((c) => (
                <span key={c} className="rounded border border-line bg-white/[0.03] px-1.5 py-0.5 text-[10px] text-sub">
                  {c}
                </span>
              ))}
            </div>
          ) : null}
          <p className="text-[10px] leading-snug text-faint">
            <span className={cx("font-semibold", view.repRisk > 0 ? "text-bad/90" : "text-sub")}>
              {view.repRisk > 0 ? C.goals.missCost(view.repRisk) : C.goals.noCost}
            </span>
            {b ? <> · {C.goals.fixedNote}</> : null}
          </p>
        </div>
      ) : null}
    </div>
  );
}
