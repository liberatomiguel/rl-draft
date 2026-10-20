"use client";

/**
 * Missions UI (v2.0, re-laid out rc.2 / rc.4). `compact` = the home widget:
 * a Daily / Weekly switch over that period's three missions, one line each,
 * and the "All missions" button. Full = the /missions page at full width:
 * daily on the left, WEEKLY on the right in the bigger card (the bigger
 * prizes), and the login streak as one discreet line on top (the modal on app
 * open is where the streak gets its moment).
 * Rolls the periods on mount so a new day's set appears without a run.
 */

import { useEffect, useState } from "react";
import { MISSIONS } from "@/config/balance";
import { useCopy } from "@/content/copy";
import { missionById, type MissionPeriod, type MissionSlotState } from "@/engine/missions";
import { cx } from "@/lib/util";
import { useMounted } from "@/store/useMounted";
import { useProfileStore } from "@/store/profileStore";
import { AppLink } from "@/components/ui/AppLink";
import { Badge } from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { ProgressBar } from "@/components/ui/ProgressBar";

const TIER_TONE: Record<string, "neutral" | "blue" | "orange"> = { easy: "neutral", mid: "blue", hard: "orange" };

function hoursToMidnightUtc(): number {
  const now = new Date();
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return Math.max(0, Math.ceil((next - now.getTime()) / 3_600_000));
}

function daysToNextMondayUtc(): number {
  const now = new Date();
  const day = now.getUTCDay() || 7; // Mon=1 … Sun=7
  return 8 - day;
}

export function useRollMissions(): void {
  const roll = useProfileStore((s) => s.rollMissions);
  useEffect(() => roll(), [roll]);
}

const doneCount = (slot: MissionSlotState | null): number => (slot ? slot.ids.filter((id) => slot.completedAt[id]).length : 0);

export function MissionsPanel({ compact }: { compact?: boolean }) {
  const { MISSIONS_UI: M } = useCopy();
  const mounted = useMounted();
  const missions = useProfileStore((s) => s.missions);
  const login = useProfileStore((s) => s.login);
  const [period, setPeriod] = useState<MissionPeriod>("daily");
  useRollMissions();
  if (!mounted) return <div className={cx("animate-pulse rounded-2xl bg-white/5", compact ? "h-full min-h-40" : "h-96")} aria-busy />;

  if (compact) {
    const slot = missions[period];
    const done = doneCount(slot);
    const resets = period === "daily" ? M.resetsIn(hoursToMidnightUtc()) : M.resetsInDays(daysToNextMondayUtc());
    return (
      <Panel className="relative flex h-full flex-col p-4 transition-colors hover:!border-line-strong sm:p-5">
        {/* rc.6: the whole card opens /missions; the period switch sits above it. */}
        <AppLink href="/missions" aria-label={M.viewAll} className="absolute inset-0 z-[1] rounded-[inherit] outline-none focus-visible:ring-2 focus-visible:ring-orange/70" />
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="display flex items-center gap-2 text-base font-bold uppercase tracking-wide text-ink">
            {M.title}
            <Badge tone={slot && done === slot.ids.length ? "good" : "blue"}>{slot ? `${done}/${slot.ids.length}` : "—"}</Badge>
          </h3>
          <div role="tablist" aria-label={M.periodSwitch} className="relative z-10 inline-flex shrink-0 rounded-lg border border-line bg-white/[0.03] p-0.5">
            {(["daily", "weekly"] as const).map((p) => (
              <button
                key={p}
                type="button"
                role="tab"
                aria-selected={period === p}
                onClick={() => setPeriod(p)}
                className={cx(
                  "display rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] transition-colors",
                  period === p ? "bg-blue/15 text-blue-bright" : "text-faint hover:text-sub",
                )}
              >
                {p === "daily" ? M.tabDaily : M.tabWeekly}
              </button>
            ))}
          </div>
        </div>
        {slot ? <MissionList slot={slot} period={period} dense /> : null}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-3">
          <span className="text-[11px] text-faint">{resets}</span>
          <span aria-hidden className={cx(buttonClass("secondary", "sm"), "pointer-events-none w-fit")}>
            {M.viewAll}
          </span>
        </div>
      </Panel>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-white/[0.03] px-4 py-2.5 text-xs">
        <span className="text-sub">
          {M.loginTitle} · <span className="display font-bold text-orange-bright">{M.loginDays(login.streak)}</span>
          <span className="text-faint"> · {M.loginBest(login.best)}</span>
        </span>
        <span className="text-faint">{M.loginStripHint}</span>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <PeriodPanel slot={missions.daily} period="daily" />
        </div>
        <div className="lg:col-span-3">
          <PeriodPanel slot={missions.weekly} period="weekly" featured />
        </div>
      </div>
    </div>
  );
}

function PeriodPanel({ slot, period, featured }: { slot: MissionSlotState | null; period: MissionPeriod; featured?: boolean }) {
  const { MISSIONS_UI: M } = useCopy();
  if (!slot) return null;
  const done = doneCount(slot);
  const all = done === slot.ids.length && slot.ids.length > 0;
  const resets = period === "daily" ? M.resetsIn(hoursToMidnightUtc()) : M.resetsInDays(daysToNextMondayUtc());
  return (
    <Panel strong={featured} glow={featured ? "orange" : undefined} className={cx("h-full", featured ? "p-5 sm:p-6" : "p-4 sm:p-5")}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className={cx("display font-bold uppercase tracking-wide text-ink", featured ? "text-xl sm:text-2xl" : "text-base")}>
            {period === "daily" ? M.daily : M.weekly}
          </h3>
          <p className="text-[11px] text-faint">{resets}</p>
        </div>
        <Badge tone={all ? "good" : featured ? "orange" : "blue"}>{all ? M.allDone : `${done}/${slot.ids.length}`}</Badge>
      </div>
      <MissionList slot={slot} period={period} />
      <p className={cx("mt-3 text-xs", slot.bonusAt ? "text-good" : "text-faint")}>
        {slot.bonusAt ? M.bonusEarned(MISSIONS[period].allBonus) : M.bonus(MISSIONS[period].allBonus)}
      </p>
    </Panel>
  );
}

function MissionList({ slot, period, dense }: { slot: MissionSlotState; period: MissionPeriod; dense?: boolean }) {
  const { MISSIONS_UI: M } = useCopy();
  return (
    <ul className={cx("space-y-2", dense && "space-y-1.5")}>
      {slot.ids.map((id) => {
        const def = missionById.get(id);
        if (!def) return null;
        const item = M.items[id] ?? { title: id, desc: "" };
        const progress = Math.min(def.target, slot.progress[id] ?? 0);
        const done = !!slot.completedAt[id];
        return (
          <li key={id} className={cx("rounded-lg border border-line/60 px-3 py-2", done && "border-good/40 bg-good/5")}>
            <div className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2">
                <Badge tone={done ? "good" : TIER_TONE[def.tier]} className="shrink-0">
                  {done ? "✓" : M.tier[def.tier]}
                </Badge>
                <span className={cx("truncate text-sm font-semibold", done ? "text-sub line-through" : "text-ink")}>{item.title}</span>
              </span>
              <span className="display shrink-0 text-xs font-bold text-orange-bright">{M.xp(MISSIONS[period].xp[def.tier])}</span>
            </div>
            {!dense ? <p className="mt-0.5 text-[11px] text-faint">{item.desc}</p> : null}
            <div className="mt-1.5 flex items-center gap-2">
              <ProgressBar value={progress / def.target} tone={done ? "good" : "blue"} className="h-1.5 flex-1" />
              <span className="text-[10px] font-semibold text-faint">{M.progress(progress, def.target)}</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
