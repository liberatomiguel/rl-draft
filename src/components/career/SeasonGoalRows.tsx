"use client";

/**
 * rc.36 (ROADMAP UX-02, R87): the board's season goal as rows — the target
 * (prominent) and the stretch (secondary), each with its icon, its words,
 * a progress meter, the chances left, the deadline and its status. HQ's goal
 * card and the season review both draw it from `seasonGoalsViewOf` (the goal
 * is fixed at the season's start; results only fill the meter).
 */

import { CAREER_SEASON_GOAL } from "@/config/balance";
import type { CareerCopy } from "@/content/careerCopy";
import type { SeasonGoalLabel, SeasonGoalRowView, SeasonGoalsView } from "@/engine/career/seasonGoals";
import { cx } from "@/lib/util";
import { goalTotalOf } from "@/engine/career/board";
import { dateOfDay } from "@/components/career/careerUi";
import { formatDateTiny } from "@/components/career/dateText";
import { Badge } from "@/components/ui/Badge";

/**
 * The words of a goal: the season's own, rc.35's split model, or a legacy key.
 * rc.6 (R172) `totals`: an established org's board reads its goals with the
 * season's total, as the plan card does ("Win 2 of the 3 Majors").
 */
export function seasonGoalText(label: SeasonGoalLabel, C: CareerCopy, totals = false): string {
  if (label.scope === "season" && totals) {
    return C.goals.seasonTotal(label.kind, label.count, label.place, goalTotalOf(label.kind)) || C.goals.season(label.kind, label.count, label.place);
  }
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

// rc9 HQ (#245): the status is a Badge (a real state: met, missed, out of reach). "Open" is the
// normal state of a goal in progress, so it gets no tag at all.
const STATUS_TONE: Record<Status, "good" | "bad" | null> = {
  done: "good",
  met: "good",
  open: null,
  out: "bad",
  missed: "bad",
};

/** The meter: one pip per count (up to nine), else a bar. One tone: the ink fills, the line is the rest. */
function Meter({ done, target, hit }: { done: number; target: number; hit: boolean }) {
  const fill = hit ? "bg-good" : "bg-ink/80";
  if (target <= 9) {
    return (
      <span className="flex items-center gap-1" aria-hidden>
        {Array.from({ length: target }, (_, i) => (
          <span key={i} className={cx("h-1.5 w-4 rounded-sm sm:w-5", i < done ? fill : "bg-white/10")} />
        ))}
      </span>
    );
  }
  return (
    <span className="block h-1.5 w-24 overflow-hidden rounded-full bg-white/10" aria-hidden>
      <span className={cx("block h-full rounded-full", fill)} style={{ width: `${Math.min(100, (100 * done) / target)}%` }} />
    </span>
  );
}

function GoalRow({
  row,
  C,
  seasonIndex,
  primary,
  showStatus = true,
  totals = false,
  showReward = true,
}: {
  row: SeasonGoalRowView;
  C: CareerCopy;
  seasonIndex: number;
  primary: boolean;
  showStatus?: boolean;
  totals?: boolean;
  showReward?: boolean;
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
  const tone = status && showStatus ? STATUS_TONE[status] : null;
  // rc9 HQ (#245): three text steps. The label line is faint (role, then what it pays), the goal is the
  // row's name (Demi, mixed case, ink for the target and sub for the stretch), the count and the
  // deadline are secondary. The family icon names the competition, so it stays, in the label's grey.
  return (
    <div className="flex gap-3">
      <span className={cx("mt-0.5 flex shrink-0 items-center justify-center text-faint", primary ? "h-6 w-6" : "h-5 w-5")}>
        <GoalIcon family={family} className={primary ? "h-5 w-5" : "h-4 w-4"} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-faint">
            <span className="kicker">{C.goals.role[row.role]}</span>
            {showReward ? <span className="ml-2">{C.goals.reward(CAREER_SEASON_GOAL.reward[row.role])}</span> : null}
          </span>
          {tone && status ? <Badge tone={tone} className="shrink-0">{C.goals.status[status]}</Badge> : null}
        </div>
        <p className={cx("display mt-1 font-bold leading-snug", primary ? "text-[15px] text-ink" : "text-sm text-sub")}>
          {seasonGoalText(row.label, C, totals)}
        </p>
        {p ? (
          <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <Meter done={p.done} target={p.target} hit={p.hit} />
            <span className="text-xs text-sub">
              <span className="display font-semibold tabular-nums text-ink">{p.done}/{p.target}</span>
              {left ? <span className="text-faint"> · {left}</span> : null}
            </span>
          </div>
        ) : null}
        {deadline && row.met === null && primary ? (
          <p className="mt-1.5 text-xs leading-snug text-faint">
            {deadline}
            {deadlineDate ? <> · {deadlineDate}</> : null}
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
  totals = false,
}: {
  view: SeasonGoalsView;
  C: CareerCopy;
  seasonIndex: number;
  showWhy?: boolean;
  showStatus?: boolean;
  /** rc.6 (R172): read the goals with the season's totals (an established org's board). */
  totals?: boolean;
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
    <div className="space-y-4">
      <GoalRow row={view.target} C={C} seasonIndex={seasonIndex} primary showStatus={showStatus} totals={totals} />
      <div className="border-t border-line pt-4">
        <GoalRow
          row={view.stretch}
          C={C}
          seasonIndex={seasonIndex}
          primary={false}
          showStatus={showStatus}
          totals={totals}
          // rc9 HQ: an org's board words both rewards alike; the line is said once, on the target.
          showReward={
            C.goals.reward(CAREER_SEASON_GOAL.reward.stretch) !== C.goals.reward(CAREER_SEASON_GOAL.reward.target)
          }
        />
      </div>
      {showWhy ? (
        // rc9 HQ: what the board read, as one secondary line (no chip per reason), then what a miss costs.
        <div className="space-y-1 border-t border-line pt-3">
          {chips.length > 0 ? <p className="text-xs leading-snug text-sub">{chips.join(" · ")}</p> : null}
          <p className="text-xs leading-snug text-faint">
            <span className={view.repRisk > 0 ? "text-bad" : "text-sub"}>
              {view.repRisk > 0 ? C.goals.missCost(view.repRisk) : C.goals.noCost}
            </span>
            {b ? <> · {C.goals.fixedNote}</> : null}
          </p>
        </div>
      ) : null}
    </div>
  );
}
