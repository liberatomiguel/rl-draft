"use client";

/**
 * Achievement grid shared by /achievements and the profile page.
 * v0.5: every achievement has a unique icon AND a stable hue inside its
 * category family (see achievementStyle.ts).
 * Broadcast pass (DESIGN.md): the feats are a LIST in groups, one hairline
 * row each, not a wall of boxes. Earned and locked differ by more than
 * dimming (chip, title colour, a check with the date against the XP on
 * offer). The one board left is an earned Legend feat: it keeps its animated
 * prismatic border and its tilt, because that one is a trophy.
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
import { CheckIcon } from "@/components/ui/icons";
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

/** The feats of one group: rows on a shared hairline grid (no gap between rows). */
const LIST = "grid grid-cols-1 gap-x-8 sm:grid-cols-2 lg:grid-cols-3";

function SectionHead({ title, done, total, icon }: { title: string; done: number; total: number; icon?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-line-strong pb-2">
      <h3 className="display flex items-center gap-2 text-lg uppercase leading-none text-ink">
        {icon}
        {title}
      </h3>
      <span className="display text-sm font-semibold text-sub">
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
    <div className="space-y-9">
      {showCareer ? (
        <div role="group" aria-label={ACH_UI.modesLabel} className="flex flex-wrap gap-2">
          {MODES.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-pressed={active === m}
              className={cx(
                "display inline-flex min-h-9 items-center gap-1.5 rounded-md border px-3 text-xs font-semibold uppercase tracking-[0.04em] transition-colors",
                active === m
                  ? "border-orange/60 bg-white/[0.04] text-ink"
                  : "border-line text-sub hover:border-line-strong hover:text-ink",
              )}
            >
              {ACH_UI.modes[m] ?? m}
              <span className="text-faint">
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
              <div className={LIST}>
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
                          <AchievementIcon group={def.group} className="h-5 w-5" />
                        )
                      }
                      title={hidden ? ACH_UI.secretTitle : (ACH_UI.items[def.id]?.name ?? def.title)}
                      tier={ACH_UI.careerTier[def.category] ?? style.label}
                      body={hidden ? ACH_UI.secretHint : (ACH_UI.items[def.id]?.desc ?? def.description)}
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
          />
          <p className="mt-2 text-sm leading-snug text-sub">{ACH_UI.careerHint}</p>
          <div className={LIST}>
            {CAREER_ACHIEVEMENTS.map((def) => {
              const has = marks.has(def.id);
              const style = achievementStyle({ id: def.id, category: def.tier });
              const item = ACH_UI.careerItems[def.id] ?? { name: def.id, desc: "" };
              return (
                <AchievementCard
                  key={def.id}
                  earned={has}
                  style={style}
                  icon={<AchievementIcon group="career" id={def.id} className="h-5 w-5" />}
                  title={item.name}
                  tier={ACH_UI.careerTier[def.tier] ?? def.tier}
                  body={item.desc}
                  foot={has ? ACH_UI.careerEarned : `+${def.xp} XP`}
                />
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}

/**
 * One feat (draft or Road to Worlds), the same visual for both: a row on a
 * hairline. Earned and locked differ in three ways that do not depend on
 * dimming: the chip (filled in the feat's colour against an empty dashed
 * outline), the title (ink against grey) and the foot (a check with the date
 * against the XP it pays). An earned Legend feat is the exception: it keeps
 * its board, its prismatic border and its tilt.
 */
export function AchievementCard({
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
  const row = (
    <>
      <span
        className={cx(
          "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md",
          earned ? style.chip : "border border-dashed border-line-strong text-faint",
          earned && style.legend && "ach-legend-chip",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className={cx("display block truncate text-base font-bold uppercase leading-tight", earned ? "text-ink" : "text-sub")}>{title}</span>
          {/* Rarity is a real category: a plain caps word in the feat's colour. */}
          <span
            className={cx(
              "display shrink-0 text-[11px] font-semibold uppercase tracking-[0.05em]",
              earned ? style.text : "text-faint",
            )}
          >
            {tier}
          </span>
        </span>
        <span className="mt-0.5 block text-xs leading-snug text-sub">{body}</span>
        <span className={cx("mt-1 flex items-center gap-1 text-xs", earned ? "text-ink" : "text-faint")}>
          {earned ? <CheckIcon className="h-4 w-4 shrink-0 text-good" /> : null}
          {foot}
        </span>
      </span>
    </>
  );
  if (earned && style.legend) {
    return (
      <TiltCard intensity="light" className="my-2">
        <Panel className={cx("ach-legend flex h-full items-start gap-3 p-3.5", style.glow)}>{row}</Panel>
      </TiltCard>
    );
  }
  return <div className="flex h-full items-start gap-3 border-b border-line py-3">{row}</div>;
}
