"use client";

import { useRef, useState } from "react";
import { LOGIN_STREAK } from "@/config/balance";
import { COSMETICS } from "@/data/cosmetics";
import { useCopy } from "@/content/copy";
import { loginXpBreakdown } from "@/engine/missions";
import { loginCalendarFocus } from "@/lib/loginCalendar";
import { cx } from "@/lib/util";
import { selectHeld, useOverlayHolds, useSettled } from "@/store/overlayHoldStore";
import { useProfileStore } from "@/store/profileStore";
import { useRewardToasts, type LoginModalData } from "@/store/rewardToastStore";
import { BadgeEmblem, BadgeGem, BannerSurface, BannerSwatch, TitleTag, useCosmeticCopy } from "@/components/cosmetics/CosmeticViews";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

const rewardsFor = (day: number) => COSMETICS.filter(c => c.source.type === "login-streak" && c.source.days === day);

export function LoginStreakModal() {
  const data = useRewardToasts(s => s.loginModal);
  const dismiss = useRewardToasts(s => s.dismissLogin);
  const held = useOverlayHolds(selectHeld);
  const owned = useProfileStore(s => s.cosmetics.owned);
  const ready = useSettled(!!data && !held);
  if (!data || !ready) return null;
  return <LoginStreakCalendar data={data} owned={owned} onClose={dismiss} />;
}

/** Presentation only: opening or selecting a day never grants a reward. */
export function LoginStreakCalendar({ data, owned, onClose }: { data: LoginModalData; owned: Record<string, string>; onClose: () => void }) {
  const { MISSIONS_UI: M } = useCopy();
  const copy = useCosmeticCopy();
  const { today, nextRewardDay, complete, artDays } = loginCalendarFocus(data.streak);
  const [selected, setSelected] = useState(today);
  const detailRef = useRef<HTMLElement>(null);
  const days = Array.from({ length: LOGIN_STREAK.cycleDays }, (_, i) => i + 1);
  const selectedXp = loginXpBreakdown(selected);
  const todayXp = loginXpBreakdown(data.streak);
  const rewards = rewardsFor(selected);

  return <Modal open wide title={M.loginModalTitle} onClose={onClose} actions={<Button variant="primary" size="lg" onClick={onClose} full>{M.loginContinue}</Button>}>
    <div className="flex items-center justify-between gap-4 rounded-xl border border-orange/35 bg-bg px-4 py-3">
      <div className="min-w-0">
        <p className="kicker !text-[10px]">{M.loginCredited}</p>
        <p className="display mt-1 text-4xl font-bold leading-none text-orange-bright">+{data.xp}<span className="ml-1.5 text-lg">XP</span></p>
        <p className="mt-2 text-xs leading-relaxed text-sub">{M.loginXpBreakdown(todayXp.base, todayXp.bonus)}</p>
      </div>
      <div className="shrink-0 border-l border-line-strong pl-4 text-right">
        <p className="display text-3xl font-bold leading-none text-ink">{data.streak}</p>
        <p className="mt-1 max-w-20 text-xs leading-snug text-sub">{M.loginStreakLabel(data.streak)}</p>
      </div>
    </div>
    <p className="mt-3 text-xs leading-relaxed text-sub">{complete ? M.loginCalendarComplete : nextRewardDay ? `${M.loginNextReward(nextRewardDay)} · ${M.loginNextRewardIn(nextRewardDay - today)}` : M.loginHint}</p>

    <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
    <div className="min-w-0">
    <div className="mb-2 flex flex-wrap items-baseline justify-between gap-1">
      <p className="kicker !text-[10px]">{M.loginCalendarKicker}</p>
      <p className="text-[11px] text-sub">{M.loginSelectDay}</p>
    </div>
    <ol className="grid grid-cols-5 gap-1 sm:grid-cols-6">
      {days.map(day => {
        const current = data.streak <= LOGIN_STREAK.cycleDays && day === today;
        const past = complete || day < today;
        const items = rewardsFor(day);
        const total = loginXpBreakdown(day).total;
        return <li key={day}>
          <button type="button" aria-pressed={selected === day} aria-current={current ? "date" : undefined}
            onClick={() => { setSelected(day); if (window.matchMedia("(max-width:639px)").matches) detailRef.current?.scrollIntoView({block:"nearest"}); }}
            className={cx("flex min-h-14 w-full cursor-pointer flex-col items-center justify-between gap-0.5 rounded-lg border px-0.5 py-1 transition-colors",
              selected === day ? "border-orange bg-orange/10" : current ? "border-orange/50 bg-orange/[0.05]" : past ? "border-good/25 bg-good/[0.04]" : "border-line bg-bg/60 hover:border-line-strong") }>
            <span className="sr-only">{M.loginDay(day)} · </span>
            <span aria-hidden className={cx("display text-[11px] font-bold leading-none", current ? "text-orange-bright" : "text-sub")}>{day}{past && !current ? " ✓" : ""}</span>
            <span className="flex h-5 items-center justify-center gap-1" aria-hidden>
              {items.length ? items.slice(0,1).map(c => c.kind === "badge"
                ? (artDays.has(day) || day === selected ? <BadgeEmblem key={c.id} badge={c} size={20} fx={false} /> : <BadgeGem key={c.id} badge={c} size={18} />)
                : c.kind === "banner" ? <BannerSwatch key={c.id} banner={c} className="h-3.5 w-6 rounded" />
                : <span key={c.id} className="display rounded border border-line-strong px-1 text-[9px] font-bold text-ink">Aa</span>)
                : <span className="display text-sm font-bold text-sub">XP</span>}
              {items.length > 1 ? <span className="text-[9px] font-semibold text-sub">+{items.length-1}</span> : null}
            </span>
            <span className={cx("display whitespace-nowrap text-[11px] font-bold leading-none", current ? "text-orange-bright" : "text-ink")}>+{total}<span className="text-[8px]"> XP</span></span>
            {items.length ? <span className="sr-only"> · {items.map(c => copy.name(c.id)).join(", ")}</span> : null}
          </button>
        </li>;
      })}
    </ol>
    </div>

    <section ref={detailRef} className="order-first min-w-0 self-start rounded-xl border border-line-strong bg-bg p-3 sm:order-last" aria-label={M.loginDay(selected)} aria-live="polite">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="display text-base font-bold text-ink">{M.loginDay(selected)}</p>
        <p className="display text-lg font-bold text-orange-bright">+{selectedXp.total} XP</p>
      </div>
      <p className="mt-1 text-xs text-sub">{M.loginXpBreakdown(selectedXp.base, selectedXp.bonus)}</p>
      {rewards.length ? <div className="mt-3 space-y-3">{rewards.map(reward => <div key={reward.id} className={cx("flex gap-3", reward.kind === "title" ? "flex-col items-start gap-1" : "items-center")}>
        {reward.kind === "banner" ? <BannerSurface banner={reward} displayPx={144} motion={false} className="cos-banner-thumb h-12 w-24 shrink-0 rounded-lg"><span /></BannerSurface> : reward.kind === "badge" ? <span className="flex h-12 w-12 shrink-0 items-center justify-center"><BadgeEmblem badge={reward} size={44} fx={false} /></span> : <span className="flex min-h-10 min-w-12 items-center"><TitleTag title={reward} size="sm" /></span>}
        <div className="min-w-0">{reward.kind !== "title" ? <p className="text-sm font-semibold leading-snug text-ink">{copy.name(reward.id)}</p> : null}<p className="mt-0.5 text-[11px] text-sub">{copy.kind(reward.kind)} · {copy.tier(reward.tier)}</p>{owned[reward.id] && owned[reward.id] !== "preview" ? <p className="mt-1 text-[11px] text-good">✓ {M.loginOwned}</p> : null}</div>
      </div>)}</div> : <p className="mt-2 text-xs text-sub">{M.loginXpOnly}</p>}
    </section>
    </div>
    <p className="mt-3 text-xs leading-relaxed text-sub">{M.loginHint} {M.loginUtcHint}</p>
  </Modal>;
}
