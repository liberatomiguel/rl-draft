"use client";

/** Achievement grid shared by /achievements and the profile page. */

import { achievements as achievementDefs } from "@/data";
import { cx, formatDate } from "@/lib/util";
import { Panel } from "@/components/ui/Panel";

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
        return (
          <Panel key={def.id} className={cx("flex items-start gap-3 p-3.5", !date && "opacity-45")}>
            <span
              className={cx(
                "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
                date ? "bg-orange/15 text-orange-bright" : "bg-white/5 text-faint",
              )}
            >
              <TrophyIcon />
            </span>
            <span className="min-w-0">
              <span className="display block truncate text-sm font-bold uppercase tracking-wide text-ink">
                {def.title}
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

function TrophyIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M8 4h8v5a4 4 0 0 1-8 0Z" strokeLinejoin="round" />
      <path d="M8 5H5a3 3 0 0 0 3 4M16 5h3a3 3 0 0 1-3 4M12 13v4m-3 3h6m-5-3h4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
