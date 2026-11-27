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
import { AppLink } from "@/components/ui/AppLink";
import { establishedOf } from "@/engine/career/established";
import { pendingPackageOf } from "@/store/boardFlow";

export function SeasonGoalBlock({ save, C }: { save: CareerSave; C: CareerCopy }) {
  const view = useMemo(() => seasonGoalsViewOf(save), [save]);
  const established = establishedOf(save);
  if (!view) return null;
  // rc.6 (R172): while an established org's season plan is pending, the season goal is the plan's: no other goal shows.
  if (established && pendingPackageOf(save)) {
    return (
      <div>
        <div className={RAIL_HEAD}>
          <h3 className={RAIL_TITLE}>{C.hub.seasonGoal}</h3>
          <span className="text-[11px] font-semibold text-faint">{seasonLabelFor(save.clock.seasonIndex)}</span>
        </div>
        <p className="text-sm leading-snug text-sub">{C.board.planPending}</p>
        <AppLink href="/career/board" className="mt-1.5 inline-flex min-h-11 items-center text-sm font-semibold text-blue-bright hover:underline">
          {C.board.planOpen}
        </AppLink>
      </div>
    );
  }
  return (
    <div>
      <div className={RAIL_HEAD}>
        <h3 className={RAIL_TITLE}>{C.hub.seasonGoal}</h3>
        <span className="text-[11px] font-semibold text-faint">{seasonLabelFor(save.clock.seasonIndex)}</span>
      </div>
      <SeasonGoalRows view={view} C={C} seasonIndex={save.clock.seasonIndex} showWhy={false} showStatus={false} totals={established} />
      <BoardLink save={save} C={C} />
    </div>
  );
}
