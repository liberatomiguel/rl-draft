"use client";

/**
 * rc.36 (ROADMAP UX-02, R87): HQ's season-goal card — the board's target and
 * stretch for this season with their meters, the chances left, the deadline
 * and what the board read to set them. The goal was fixed at the season's
 * start (engine/career/seasonGoals.ts); this card only reads it.
 */

import { BoardLink } from "@/components/career/board/BoardScreen";
import { useMemo } from "react";
import type { CareerCopy } from "@/content/careerCopy";
import type { CareerSave } from "@/engine/career/types";
import { seasonGoalsViewOf } from "@/engine/career/seasonGoals";
import { RAIL_HEAD, RAIL_TITLE } from "@/components/career/hub/hubShared";
import { seasonLabelFor } from "@/components/career/careerUi";
import { SeasonGoalRows } from "@/components/career/SeasonGoalRows";
import { establishedOf } from "@/engine/career/established";
import { pendingMandateOf, pendingPackageOf } from "@/store/boardFlow";
import { MandateHqRows, MandatePendingLine } from "@/components/career/board/MandateParts";

export function SeasonGoalBlock({ save, C }: { save: CareerSave; C: CareerCopy }) {
  const view = useMemo(() => seasonGoalsViewOf(save), [save]);
  const established = establishedOf(save);
  if (!view) return null;
  // rc.6 (R172): while the season plan is pending, the season goal is the plan's: no other goal shows.
  // rc9 HQ (#241): a founded club's owners too. rc.8 showed the community-cup goal here while the
  // decision block offered three plans with other goals, two answers to one question on one screen.
  if (pendingPackageOf(save)) {
    return (
      <div>
        <div className={RAIL_HEAD}>
          <h3 className={RAIL_TITLE}>{C.hub.seasonGoal}</h3>
          <span className="text-xs text-faint">{seasonLabelFor(save.clock.seasonIndex)}</span>
        </div>
        {pendingMandateOf(save) ? <MandatePendingLine C={C} /> : <p className="text-sm leading-snug text-sub">{C.board.planPending}</p>}
      </div>
    );
  }
  return (
    <div>
      <div className={RAIL_HEAD}>
        <h3 className={RAIL_TITLE}>{C.hub.seasonGoal}</h3>
        <span className="text-xs text-faint">{seasonLabelFor(save.clock.seasonIndex)}</span>
      </div>
      <SeasonGoalRows view={view} C={C} seasonIndex={save.clock.seasonIndex} showWhy={false} showStatus={false} totals={established} />
      {/* v2.2 MANDATE: the money and squad goals under the classification rows. */}
      <MandateHqRows save={save} C={C} />
      <BoardLink save={save} C={C} />
    </div>
  );
}
