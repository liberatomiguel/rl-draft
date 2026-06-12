"use client";

/**
 * Achievement grid shared by /achievements and the profile page.
 * v0.5: every achievement has a unique icon AND a stable hue inside its
 * category family (see achievementStyle.ts), earned cards get a light 3D
 * tilt, and legend-tier achievements wear an animated prismatic border —
 * the trophy case should feel like a trophy case.
 */

import { achievements as achievementDefs } from "@/data";
import { cx, formatDate } from "@/lib/util";
import { Panel } from "@/components/ui/Panel";
import { TiltCard } from "@/components/ui/TiltCard";
import { AchievementIcon } from "@/components/AchievementIcon";
import { achievementStyle } from "@/components/achievementStyle";

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
        const style = achievementStyle(def);
        const card = (
          <Panel
            className={cx(
              "flex h-full items-start gap-3 p-3.5",
              date
                ? cx(style.ring, style.glow, style.legend && "ach-legend")
                : "opacity-45",
            )}
          >
            <span
              className={cx(
                "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md",
                date ? style.chip : "bg-white/5 text-faint",
                date && style.legend && "ach-legend-chip",
              )}
            >
              <AchievementIcon id={def.id} className="h-4.5 w-4.5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between gap-2">
                <span className="display block truncate text-sm font-bold uppercase tracking-wide text-ink">
                  {def.title}
                </span>
                <span
                  className={cx(
                    "shrink-0 text-[9px] font-bold uppercase tracking-[0.14em]",
                    date ? style.text : "text-faint",
                  )}
                >
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

        // Earned achievements respond to the cursor; locked ones stay flat.
        return date ? (
          <TiltCard key={def.id} intensity="light">
            {card}
          </TiltCard>
        ) : (
          <div key={def.id}>{card}</div>
        );
      })}
    </div>
  );
}
