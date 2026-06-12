"use client";

/**
 * Achievement grid shared by /achievements and the profile page.
 * Each category has its own icon + color family so the wall reads as a
 * varied trophy case, not a uniform list:
 *   milestone → blue flag · skill → orange bolt
 *   collection → gold cards · legend → prismatic crown
 */

import { achievements as achievementDefs } from "@/data";
import type { AchievementDef } from "@/engine/types";
import { cx, formatDate } from "@/lib/util";
import { Panel } from "@/components/ui/Panel";
import { AchievementIcon } from "@/components/AchievementIcon";

const CATEGORY_STYLE: Record<
  AchievementDef["category"],
  { chip: string; ring: string; label: string }
> = {
  milestone: {
    chip: "bg-blue/15 text-blue-bright",
    ring: "!border-blue/35",
    label: "Milestone",
  },
  skill: {
    chip: "bg-orange/15 text-orange-bright",
    ring: "!border-orange/35",
    label: "Skill",
  },
  collection: {
    chip: "bg-amber-400/15 text-amber-300",
    ring: "!border-amber-400/35",
    label: "Collection",
  },
  legend: {
    chip: "bg-gradient-to-br from-fuchsia-500/25 to-orange/25 text-fuchsia-200",
    ring: "!border-fuchsia-400/40",
    label: "Legend",
  },
};

export function AchievementsGrid({
  earned,
}: {
  /** achievementId → ISO date earned. */
  earned: Record<string, string>;
}) {
  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
      {achievementDefs.map((def) => {
        const date = earned[def.id];
        const style = CATEGORY_STYLE[def.category];
        return (
          <Panel
            key={def.id}
            className={cx(
              "flex items-start gap-3 p-3.5",
              date ? style.ring : "opacity-45",
            )}
          >
            <span
              className={cx(
                "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
                date ? style.chip : "bg-white/5 text-faint",
              )}
            >
              <AchievementIcon id={def.id} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between gap-2">
                <span className="display block truncate text-sm font-bold uppercase tracking-wide text-ink">
                  {def.title}
                </span>
                <span className={cx("shrink-0 text-[9px] font-bold uppercase tracking-[0.14em]", date ? "text-sub" : "text-faint")}>
                  {style.label}
                </span>
              </span>
              <span className="block text-xs leading-snug text-sub">{def.description}</span>
              <span className="mt-0.5 block text-[10px] text-faint">
                {date ? formatDate(date) : `+${def.xp} XP`}
              </span>
            </span>
          </Panel>
        );
      })}
    </div>
  );
}

