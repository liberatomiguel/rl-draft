"use client";

/**
 * Login streak modal (rc.2): shown once when the day's login is counted (app
 * open). A seven-day strip around today — the days already banked, TODAY lit,
 * and what the next days pay — plus the milestone chips (3 / 7 / 14 / 30) with
 * their XP bonus and the cosmetic they unlock. Replaces the login toast.
 */

import { LOGIN_STREAK } from "@/config/balance";
import { COSMETICS } from "@/data/cosmetics";
import { useCopy } from "@/content/copy";
import { loginDayXp } from "@/engine/missions";
import { cx } from "@/lib/util";
import { useRewardToasts } from "@/store/rewardToastStore";
import { CosmeticIcon, useCosmeticCopy } from "@/components/cosmetics/CosmeticViews";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

export function LoginStreakModal() {
  const { MISSIONS_UI: M } = useCopy();
  const copy = useCosmeticCopy();
  const data = useRewardToasts((s) => s.loginModal);
  const dismiss = useRewardToasts((s) => s.dismissLogin);
  if (!data) return null;

  const { streak, xp, milestone } = data;
  const milestones = Object.keys(LOGIN_STREAK.milestoneBonus)
    .map(Number)
    .sort((a, b) => a - b);
  // Seven-day window: up to three banked days before today, today, then the next days.
  const first = Math.max(1, streak - 3);
  const days = Array.from({ length: 7 }, (_, i) => first + i);
  const rewardFor = (d: number) => COSMETICS.find((c) => c.source.type === "login-streak" && c.source.days === d) ?? null;

  return (
    <Modal open title={M.loginModalTitle} onClose={dismiss} actions={<Button variant="primary" onClick={dismiss}>{M.loginContinue}</Button>}>
      <div className="text-center">
        <p className="kicker">{M.loginTitle}</p>
        <p className="display text-5xl font-bold leading-none text-orange-bright">{M.loginDays(streak)}</p>
        <p className="mt-2 text-sm text-sub">{milestone ? M.loginMilestoneHit(milestone, xp) : M.loginToday(xp)}</p>
      </div>

      <ol className="mt-5 grid grid-cols-7 gap-1.5">
        {days.map((d) => {
          const isToday = d === streak;
          const past = d < streak;
          const bonus = LOGIN_STREAK.milestoneBonus[d] ?? 0;
          const reward = rewardFor(d);
          return (
            <li
              key={d}
              className={cx(
                "flex min-h-[4.6rem] flex-col items-center justify-between rounded-lg border px-1 py-1.5 text-center",
                isToday ? "border-orange/70 bg-orange/15 shadow-[0_0_18px_rgba(249,115,22,0.25)]" : past ? "border-good/40 bg-good/10" : "border-line bg-white/[0.03]",
              )}
            >
              <span className={cx("kicker !text-[8px]", isToday && "text-orange-bright")}>{M.loginDay(d)}</span>
              {reward ? (
                <span title={copy.name(reward.id)} className={cx(!past && !isToday && "opacity-70")}>
                  <CosmeticIcon def={reward} />
                </span>
              ) : (
                <span className={cx("text-base leading-none", past ? "text-good" : isToday ? "text-orange-bright" : "text-faint")} aria-hidden>
                  {past ? "✓" : "•"}
                </span>
              )}
              <span className={cx("display text-[10px] font-bold", isToday ? "text-orange-bright" : past ? "text-good" : "text-sub")}>
                +{loginDayXp(d) + bonus}
              </span>
            </li>
          );
        })}
      </ol>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5">
        {milestones.map((m) => (
          <span
            key={m}
            className={cx(
              "display inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
              streak >= m ? "border-orange/60 bg-orange/15 text-orange-bright" : "border-line text-faint",
            )}
          >
            {M.loginMilestone(m)} · +{LOGIN_STREAK.milestoneBonus[m]}
          </span>
        ))}
      </div>
      <p className="mt-3 text-center text-[11px] text-faint">{M.loginHint}</p>
    </Modal>
  );
}
