"use client";

/**
 * Login streak modal (rc.2; rc.20: the 30-day calendar). Shown once when the
 * day's login is counted (app open). The whole cycle is on screen: the days
 * already banked, TODAY lit, the eight milestone days with the cosmetic they
 * unlock (badge / banner / title drawn small), the XP-only days with their
 * XP. A milestone whose item the player already owns (a new cycle after a
 * missed day) shows the item ticked and pays XP instead. Past day 30 the
 * calendar reads complete and every day pays the flat maximum.
 */

import { LOGIN_STREAK } from "@/config/balance";
import { COSMETICS, type CosmeticDef } from "@/data/cosmetics";
import { useCopy } from "@/content/copy";
import { loginDayXp } from "@/engine/missions";
import { cx } from "@/lib/util";
import { useProfileStore } from "@/store/profileStore";
import { useRewardToasts } from "@/store/rewardToastStore";
import { BadgeEmblem, BannerSurface, CosmeticPreview, TIER_ACCENT, useCosmeticCopy } from "@/components/cosmetics/CosmeticViews";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

const rewardsFor = (day: number): CosmeticDef[] => COSMETICS.filter((c) => c.source.type === "login-streak" && c.source.days === day);

export function LoginStreakModal() {
  const { MISSIONS_UI: M } = useCopy();
  const copy = useCosmeticCopy();
  const data = useRewardToasts((s) => s.loginModal);
  const dismiss = useRewardToasts((s) => s.dismissLogin);
  const owned = useProfileStore((s) => s.cosmetics.owned);
  if (!data) return null;

  const { streak, xp, milestone } = data;
  const cycle = LOGIN_STREAK.cycleDays;
  const complete = streak >= cycle;
  const today = Math.min(streak, cycle);
  const days = Array.from({ length: cycle }, (_, i) => i + 1);
  const todayIso = new Date().toISOString().slice(0, 10);
  /** Owned before today = earned in an earlier cycle (the day pays XP instead). */
  const ownedBefore = (id: string) => !!owned[id] && owned[id] !== "preview" && owned[id].slice(0, 10) < todayIso;
  const nextRewardDay = days.find((d) => d > today && LOGIN_STREAK.milestoneBonus[d] !== undefined) ?? null;
  const todayRewards = milestone ? rewardsFor(milestone) : [];

  return (
    <Modal open title={M.loginModalTitle} onClose={dismiss} actions={<Button variant="primary" onClick={dismiss}>{M.loginContinue}</Button>}>
      <div className="text-center">
        <p className="kicker">{M.loginTitle}</p>
        <p className="display text-5xl font-bold leading-none text-orange-bright">{M.loginDays(streak)}</p>
        <p className="mt-2 text-sm text-sub">{milestone ? M.loginMilestoneHit(milestone, xp) : M.loginToday(xp)}</p>
      </div>

      {/* Today's milestone rewards, in full. */}
      {todayRewards.length > 0 ? (
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {todayRewards.map((r) => (
            <div key={r.id} className={cx("panel flex items-center justify-between gap-2 p-2.5", ownedBefore(r.id) ? "opacity-80" : "!border-orange/40")}>
              <CosmeticPreview id={r.id} size="sm" />
              {ownedBefore(r.id) ? (
                <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-good" title={M.loginOwnedHint}>
                  ✓ {M.loginOwned}
                </span>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      <p className="kicker mt-5 !text-[10px]">{M.loginCalendarKicker}</p>
      <ol className="mt-2 grid grid-cols-6 gap-1">
        {days.map((d) => {
          const isToday = d === today;
          const past = d < today;
          const bonus = LOGIN_STREAK.milestoneBonus[d] ?? 0;
          const rewards = rewardsFor(d);
          const allOwned = rewards.length > 0 && rewards.every((r) => ownedBefore(r.id));
          const title = rewards.length ? rewards.map((r) => `${copy.name(r.id)} · ${copy.tier(r.tier)}`).join(" · ") : `${M.loginDay(d)} · +${loginDayXp(d) + bonus} XP`;
          return (
            <li
              key={d}
              title={allOwned ? `${title} · ${M.loginOwnedHint}` : title}
              className={cx(
                "relative flex min-h-[3.7rem] flex-col items-center justify-between rounded-lg border px-0.5 py-1 text-center",
                isToday
                  ? "border-orange/70 bg-orange/15 shadow-[0_0_18px_rgba(249,115,22,0.25)]"
                  : past
                    ? "border-good/35 bg-good/[0.08]"
                    : rewards.length
                      ? "border-line-strong bg-white/[0.04]"
                      : "border-line bg-white/[0.02]",
                !past && !isToday && "opacity-80",
              )}
            >
              <span className={cx("display text-[8px] font-bold leading-none tracking-wider", isToday ? "text-orange-bright" : past ? "text-good" : "text-faint")}>{d}</span>
              <span className="flex max-w-full flex-wrap items-center justify-center gap-0.5">
                {rewards.length ? (
                  rewards.map((r) => <MiniCosmetic key={r.id} def={r} dim={ownedBefore(r.id)} />)
                ) : (
                  <span className={cx("text-sm leading-none", past ? "text-good" : "text-faint/70")} aria-hidden>
                    {past ? "✓" : "·"}
                  </span>
                )}
              </span>
              <span className={cx("display text-[9px] font-bold leading-none", isToday ? "text-orange-bright" : past ? "text-good/90" : rewards.length ? "text-sub" : "text-faint")}>
                {allOwned ? `+${loginDayXp(d) + bonus}` : rewards.length ? "" : `+${loginDayXp(d) + bonus}`}
              </span>
              {allOwned ? (
                <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-good text-[8px] font-bold text-black" aria-label={M.loginOwned}>
                  ✓
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>

      <p className="mt-3 text-center text-[11px] text-faint">
        {complete ? M.loginCalendarComplete : nextRewardDay ? `${M.loginNextReward(nextRewardDay)} · ${M.loginNextRewardIn(nextRewardDay - today)}` : M.loginHint}
      </p>
      {!complete ? <p className="mt-1 text-center text-[11px] text-faint">{M.loginHint}</p> : null}
    </Modal>
  );
}

/** A cosmetic at calendar-cell size: a badge at 24 px, a banner as a swatch,
 *  a title as a small pill in its colours (the name is in the tooltip). */
function MiniCosmetic({ def, dim }: { def: CosmeticDef; dim?: boolean }) {
  if (def.kind === "badge") return <BadgeEmblem badge={def} size={22} fx={false} className={cx(dim && "opacity-60")} />;
  if (def.kind === "banner") {
    return (
      <BannerSurface banner={def} displayPx={400} className={cx("cos-banner-thumb rounded border border-line-strong", dim && "opacity-60")}>
        <span className="block h-3.5 w-6" />
      </BannerSurface>
    );
  }
  const c = def.style.colors;
  return (
    <span
      className={cx("block h-2.5 w-6 rounded-sm border", dim && "opacity-60")}
      style={{ background: `linear-gradient(90deg, ${c[0]}, ${c[c.length - 1]})`, borderColor: `${TIER_ACCENT[def.tier]}66` }}
      aria-hidden
    />
  );
}
