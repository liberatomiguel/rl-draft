"use client";

/**
 * Achievement grid shared by /achievements and the profile page.
 * v0.5: every achievement has a unique icon AND a stable hue inside its
 * category family (see achievementStyle.ts), earned cards get a light 3D
 * tilt, and legend-tier achievements wear an animated prismatic border —
 * the trophy case should feel like a trophy case.
 *
 * rc.36 (UX-05, DESIGN-DECISIONS #155): Road to Worlds' achievements join the
 * list, behind a mode filter (All · Draft · Road to Worlds; career mode's
 * flag gates them). One source per id: the defs are the career catalog's
 * (`data/career/achievements.ts`, a light module — the shared path stays off
 * `@/data`), their words the core copy's `ACH_UI.careerItems`, and "earned"
 * is the profile's `careerMarks` (permanent, cross-save, kept by a Season reset).
 */

import { useState, type ReactNode } from "react";
import type { AchievementDef } from "@/engine/types";
import { achievements as achievementDefs } from "@/data/catalog";
import { CAREER_ACHIEVEMENTS } from "@/data/career/achievements";
import { FEATURES } from "@/config/balance";
import { useCopy } from "@/content/copy";
import { cx, formatDate } from "@/lib/util";
import { Panel } from "@/components/ui/Panel";
import { TiltCard } from "@/components/ui/TiltCard";
import { AchievementIcon } from "@/components/AchievementIcon";
import { achievementStyle } from "@/components/achievementStyle";

const GROUP_ORDER: AchievementDef["group"][] = [
  "milestone",
  "mode",
  "performance",
  "chemistry",
  "roster",
  "collection",
  "progression",
];

export type AchievementMode = "all" | "draft" | "career";
const MODES: AchievementMode[] = ["all", "draft", "career"];

/** Earned / total for the badge beside a list: the draft set, plus Road to Worlds when the mode ships. */
export function achievementTotals(earned: Record<string, string>, careerMarks: readonly string[] | undefined) {
  const draftEarned = achievementDefs.filter((d) => earned[d.id]).length;
  if (!FEATURES.careerMode) return { earned: draftEarned, total: achievementDefs.length };
  const marks = new Set(careerMarks ?? []);
  return {
    earned: draftEarned + CAREER_ACHIEVEMENTS.filter((d) => marks.has(d.id)).length,
    total: achievementDefs.length + CAREER_ACHIEVEMENTS.length,
  };
}

function SectionHead({ title, done, total, icon }: { title: string; done: number; total: number; icon?: ReactNode }) {
  return (
    <div className="mb-2.5 flex items-baseline justify-between gap-2 border-b border-line/60 pb-1.5">
      <h3 className="display flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.16em] text-sub">
        {icon}
        {title}
      </h3>
      <span className="text-[11px] font-semibold text-faint">
        {done}/{total}
      </span>
    </div>
  );
}

export function AchievementsGrid({
  earned,
  careerMarks,
}: {
  /** achievementId → ISO date earned. */
  earned: Record<string, string>;
  /** rc.36 (UX-05): the profile's Road to Worlds marks (ids). */
  careerMarks?: readonly string[];
}) {
  const { ACH_UI } = useCopy();
  const [mode, setMode] = useState<AchievementMode>("all");
  const showCareer = FEATURES.careerMode;
  const marks = new Set(careerMarks ?? []);
  const active: AchievementMode = showCareer ? mode : "draft";

  // Group the defs, preserving the file order within each group.
  const byGroup = GROUP_ORDER.map((g) => ({
    group: g,
    defs: achievementDefs.filter((d) => d.group === g),
    earnedCount: achievementDefs.filter((d) => d.group === g && earned[d.id]).length,
  })).filter((g) => g.defs.length > 0);

  const draftEarned = achievementDefs.filter((d) => earned[d.id]).length;
  const careerEarned = CAREER_ACHIEVEMENTS.filter((d) => marks.has(d.id)).length;
  const counts: Record<AchievementMode, [number, number]> = {
    all: [draftEarned + careerEarned, achievementDefs.length + CAREER_ACHIEVEMENTS.length],
    draft: [draftEarned, achievementDefs.length],
    career: [careerEarned, CAREER_ACHIEVEMENTS.length],
  };

  return (
    <div className="space-y-7">
      {showCareer ? (
        <div role="group" aria-label={ACH_UI.modesLabel} className="flex flex-wrap gap-2">
          {MODES.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-pressed={active === m}
              className={cx(
                "display inline-flex min-h-9 items-center gap-1.5 rounded-md border px-2.5 text-[10px] font-semibold uppercase tracking-[0.1em] transition-colors",
                active === m
                  ? "border-blue/50 bg-blue/15 text-blue-bright"
                  : "border-line-strong bg-white/5 text-sub hover:text-ink",
              )}
            >
              {m === "career" ? <AchievementIcon group="career" className="h-3.5 w-3.5" /> : null}
              {ACH_UI.modes[m] ?? m}
              <span className="font-mono text-[10px] normal-case tracking-normal text-faint">
                {counts[m][0]}/{counts[m][1]}
              </span>
            </button>
          ))}
        </div>
      ) : null}

      {active !== "career"
        ? byGroup.map(({ group, defs, earnedCount }) => (
            <section key={group}>
              <SectionHead title={ACH_UI.groups[group] ?? group} done={earnedCount} total={defs.length} />
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {defs.map((def) => {
                  const date = earned[def.id];
                  const style = achievementStyle(def);
                  // Secret achievements stay masked ("???") until they're earned.
                  const hidden = Boolean(def.secret) && !date;
                  return (
                    <AchievementCard
                      key={def.id}
                      earned={Boolean(date)}
                      style={style}
                      icon={
                        hidden ? (
                          <span className="display text-base font-bold text-faint">?</span>
                        ) : (
                          <AchievementIcon group={def.group} className="h-4.5 w-4.5" />
                        )
                      }
                      title={hidden ? ACH_UI.secretTitle : def.title}
                      tier={style.label}
                      body={hidden ? ACH_UI.secretHint : def.description}
                      foot={date ? formatDate(date) : `+${def.xp} XP`}
                    />
                  );
                })}
              </div>
            </section>
          ))
        : null}

      {showCareer && active !== "draft" ? (
        <section>
          <SectionHead
            title={ACH_UI.careerGroup}
            done={careerEarned}
            total={CAREER_ACHIEVEMENTS.length}
            icon={<AchievementIcon group="career" className="h-3.5 w-3.5 text-orange-bright" />}
          />
          <p className="-mt-1 mb-2.5 text-[11px] text-faint">{ACH_UI.careerHint}</p>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {CAREER_ACHIEVEMENTS.map((def) => {
              const has = marks.has(def.id);
              const style = achievementStyle({ id: def.id, category: def.tier });
              const item = ACH_UI.careerItems[def.id] ?? { name: def.id, desc: "" };
              return (
                <AchievementCard
                  key={def.id}
                  earned={has}
                  style={style}
                  icon={<AchievementIcon group="career" className="h-4.5 w-4.5" />}
                  title={item.name}
                  tier={ACH_UI.careerTier[def.tier] ?? def.tier}
                  body={item.desc}
                  foot={has ? `✓ ${ACH_UI.careerEarned}` : `+${def.xp} XP`}
                />
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}

/** One trophy card (draft or Road to Worlds) — the same visual for both. */
function AchievementCard({
  earned,
  style,
  icon,
  title,
  tier,
  body,
  foot,
}: {
  earned: boolean;
  style: ReturnType<typeof achievementStyle>;
  icon: ReactNode;
  title: string;
  tier: string;
  body: string;
  foot: string;
}) {
  const card = (
    <Panel
      className={cx(
        "flex h-full items-start gap-3 p-3.5",
        earned ? cx(style.ring, style.glow, style.legend && "ach-legend") : "opacity-45",
      )}
    >
      <span
        className={cx(
          "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md",
          earned ? style.chip : "bg-white/5 text-faint",
          earned && style.legend && "ach-legend-chip",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="display block truncate text-sm font-bold uppercase tracking-wide text-ink">{title}</span>
          <span
            className={cx(
              "shrink-0 text-[9px] font-bold uppercase tracking-[0.14em]",
              earned ? style.text : "text-faint",
            )}
          >
            {tier}
          </span>
        </span>
        <span className="block text-xs leading-snug text-sub">{body}</span>
        <span className="mt-0.5 block text-[10px] text-faint">{foot}</span>
      </span>
    </Panel>
  );
  // Earned achievements respond to the cursor; locked ones stay flat.
  return earned ? <TiltCard intensity="light">{card}</TiltCard> : <div>{card}</div>;
}
