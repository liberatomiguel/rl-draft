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

export function SeasonGoalBlock({ save, C }: { save: CareerSave; C: CareerCopy }) {
  const view = useMemo(() => seasonGoalsViewOf(save), [save]);
  if (!view) return null;
  return (
    <div>
      <div className={RAIL_HEAD}>
        <h3 className={RAIL_TITLE}>{C.hub.seasonGoal}</h3>
        <span className="text-[11px] font-semibold text-faint">{seasonLabelFor(save.clock.seasonIndex)}</span>
      </div>
      <SeasonGoalRows view={view} C={C} seasonIndex={save.clock.seasonIndex} showWhy={false} showStatus={false} />
      <BoardLink save={save} C={C} />
    </div>
  );
}
