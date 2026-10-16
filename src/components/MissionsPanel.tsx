"use client";

/**
 * Missions + login streak UI (v2.0). `compact` = the home widget (today's three
 * + the streak chip); full = the /missions page (daily, weekly, streak card).
 * Rolls the periods on mount so a new day's set appears without a run.
 */

import { useEffect } from "react";
import { LOGIN_STREAK, MISSIONS } from "@/config/balance";
import { useCopy } from "@/content/copy";
import { missionById, type MissionPeriod, type MissionSlotState } from "@/engine/missions";
import { cx } from "@/lib/util";
import { useMounted } from "@/store/useMounted";
import { useProfileStore } from "@/store/profileStore";
import { AppLink } from "@/components/ui/AppLink";
import { Badge } from "@/components/ui/Badge";
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

export function MissionsPanel({ compact }: { compact?: boolean }) {
  const { MISSIONS_UI: M } = useCopy();
  const mounted = useMounted();
  const missions = useProfileStore((s) => s.missions);
  const login = useProfileStore((s) => s.login);
  useRollMissions();
  if (!mounted) return <div className={cx("animate-pulse rounded-2xl bg-white/5", compact ? "h-40" : "h-96")} aria-busy />;

  if (compact) {
    const slot = missions.daily;
    const done = slot ? slot.ids.filter((id) => slot.completedAt[id]).length : 0;
    return (
      <Panel className="flex h-full flex-col p-5">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="display text-lg font-bold uppercase tracking-wide text-ink">{M.daily}</h3>
          <Badge tone={slot && done === slot.ids.length ? "good" : "blue"}>{slot ? `${done}/${slot.ids.length}` : "—"}</Badge>
        </div>
        {slot ? <MissionList slot={slot} period="daily" dense /> : null}
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-line/60 pt-3 text-xs">
          <span className="text-sub">
            {M.loginTitle} · <span className="display font-bold text-orange-bright">{M.loginDays(login.streak)}</span>
          </span>
          <AppLink href="/missions" className="font-semibold text-blue-bright underline-offset-4 hover:underline">
            {M.title} →
          </AppLink>
        </div>
      </Panel>
    );
  }

  return (
    <div className="space-y-4">
      <LoginStreakCard />
      <PeriodPanel slot={missions.daily} period="daily" />
      <PeriodPanel slot={missions.weekly} period="weekly" />
    </div>
  );
}

function PeriodPanel({ slot, period }: { slot: MissionSlotState | null; period: MissionPeriod }) {
  const { MISSIONS_UI: M } = useCopy();
  if (!slot) return null;
  const done = slot.ids.filter((id) => slot.completedAt[id]).length;
  const all = done === slot.ids.length && slot.ids.length > 0;
  const resets = period === "daily" ? M.resetsIn(hoursToMidnightUtc()) : M.resetsInDays(daysToNextMondayUtc());
  return (
    <Panel className="p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="display text-lg font-bold uppercase tracking-wide text-ink">{period === "daily" ? M.daily : M.weekly}</h3>
          <p className="text-[11px] text-faint">{resets}</p>
        </div>
        <Badge tone={all ? "good" : "blue"}>{all ? M.allDone : `${done}/${slot.ids.length}`}</Badge>
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

export function LoginStreakCard() {
  const { MISSIONS_UI: M } = useCopy();
  const login = useProfileStore((s) => s.login);
  const milestones = Object.keys(LOGIN_STREAK.milestoneBonus)
    .map(Number)
    .sort((a, b) => a - b);
  const next = milestones.find((m) => m > login.streak) ?? null;
  const prev = [...milestones].reverse().find((m) => m <= login.streak) ?? 0;
  const span = next ? next - prev : 1;
  return (
    <Panel strong glow="orange" className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="kicker">{M.loginTitle}</p>
          <p className="display text-3xl font-bold text-orange-bright">{M.loginDays(login.streak)}</p>
          <p className="text-xs text-faint">{M.loginBest(login.best)}</p>
        </div>
        <div className="flex gap-1.5">
          {milestones.map((m) => (
            <span
              key={m}
              className={cx(
                "display flex h-9 w-9 items-center justify-center rounded-full border text-xs font-bold",
                login.best >= m ? "border-orange/60 bg-orange/15 text-orange-bright" : "border-line text-faint",
              )}
              title={M.loginMilestone(m)}
            >
              {m}
            </span>
          ))}
        </div>
      </div>
      {next ? (
        <div className="mt-3">
          <ProgressBar value={(login.streak - prev) / span} tone="orange" className="h-1.5" />
          <p className="mt-1 text-[11px] text-faint">{M.loginNext(next)}</p>
        </div>
      ) : null}
    </Panel>
  );
}
