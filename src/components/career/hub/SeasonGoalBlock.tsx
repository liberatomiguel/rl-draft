"use client";

/**
 * rc.36 (ROADMAP UX-02, R87): HQ's season-goal card — the board's target and
 * stretch for this season with their meters, the chances left, the deadline
 * and what the board read to set them. The goal was fixed at the season's
 * start (engine/career/seasonGoals.ts); this card only reads it.
 */

import { useMemo } from "react";
import type { CareerCopy } from "@/content/careerCopy";
import type { CareerSave } from "@/engine/career/types";
import { seasonGoalsViewOf } from "@/engine/career/seasonGoals";
import { Panel } from "@/components/ui/Panel";
import { seasonLabelFor } from "@/components/career/careerUi";
import { SeasonGoalRows } from "@/components/career/SeasonGoalRows";

export function SeasonGoalBlock({ save, C }: { save: CareerSave; C: CareerCopy }) {
  const view = useMemo(() => seasonGoalsViewOf(save), [save]);
  if (!view) return null;
  return (
    <Panel className="rise-in p-4" style={{ animationDelay: "60ms" }}>
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <p className="kicker text-[10px]">{C.hub.seasonGoal}</p>
        <span className="text-[10px] font-semibold text-faint">{seasonLabelFor(save.clock.seasonIndex)}</span>
      </div>
      <SeasonGoalRows view={view} C={C} seasonIndex={save.clock.seasonIndex} />
    </Panel>
  );
}
