"use client";
import { LOGIN_STREAK } from "@/config/balance";
import { COSMETICS } from "@/data/cosmetics";
import { useCopy } from "@/content/copy";
import { loginXpBreakdown } from "@/engine/missions";
import { cx } from "@/lib/util";
import { selectHeld, useOverlayHolds, useSettled } from "@/store/overlayHoldStore";
import { useProfileStore } from "@/store/profileStore";
import { useRewardToasts, type LoginModalData } from "@/store/rewardToastStore";
import { BadgeEmblem, BannerSurface, useCosmeticCopy } from "@/components/cosmetics/CosmeticViews";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

export function LoginStreakModal() {
  const data = useRewardToasts(s => s.loginModal);
  const dismiss = useRewardToasts(s => s.dismissLogin);
  const held = useOverlayHolds(selectHeld);
  const owned = useProfileStore(s => s.cosmetics.owned);
  const ready = useSettled(!!data && !held);
  return data && ready ? <LoginStreakCalendar data={data} owned={owned} onClose={dismiss} /> : null;
}

/** Only this streak's elapsed days are collected; previous ownership is irrelevant. */
export function LoginStreakCalendar({ data, onClose }: { data: LoginModalData; owned: Record<string, string>; onClose: () => void }) {
  const { MISSIONS_UI: M } = useCopy();
  const copy = useCosmeticCopy();
  const collected = Math.min(data.streak, LOGIN_STREAK.cycleDays);
  return <Modal open wide className="!max-w-3xl" title={M.loginModalTitle} onClose={onClose} actions={<Button variant="primary" size="lg" onClick={onClose} full>{M.loginContinue}</Button>}>
    <div className="mb-3 flex items-end justify-between gap-3">
      <div><p className="text-xs text-sub">{M.loginCredited}</p><p className="display text-3xl font-bold text-orange-bright">+{data.xp} XP</p></div>
      <p className="text-right text-xs font-semibold text-ink">{M.loginProgress(collected, LOGIN_STREAK.cycleDays)}</p>
    </div>
    <div className="mb-3 h-1 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-label={M.loginCalendarKicker} aria-valuemin={0} aria-valuemax={LOGIN_STREAK.cycleDays} aria-valuenow={collected}><div className="h-full bg-orange" style={{width:`${collected / LOGIN_STREAK.cycleDays * 100}%`}} /></div>
    <ol className="grid grid-cols-3 gap-1 sm:grid-cols-6" aria-label={M.loginCalendarKicker}>
      {Array.from({length:LOGIN_STREAK.cycleDays},(_,i)=>i+1).map(day=>{
        const done = day <= collected;
        const current = day === data.streak;
        const rewards = COSMETICS.filter(c=>c.source.type === "login-streak" && c.source.days === day);
        return <li key={day} aria-current={current ? "date" : undefined} className={cx("flex min-h-16 flex-col rounded-lg border p-1.5", current ? "border-orange bg-orange/10" : done ? "border-good/35 bg-good/[0.04]" : "border-line bg-bg/40")}>
          <div className="mb-1 flex items-center justify-between gap-1 text-xs leading-none"><span className="font-semibold text-ink">{day}</span>{done ? <span className="text-good" aria-label={M.loginCollected}>✓</span> : <span className="sr-only">{M.loginUpcoming}</span>}</div>
          {rewards.length ? <div className="mb-1"><div className="mb-1 flex flex-wrap items-center gap-1">{rewards.map(c=><span key={c.id} title={`${copy.kind(c.kind)} · ${copy.name(c.id)}`}>
            {c.kind === "badge" ? <BadgeEmblem badge={c} size={20} fx={false} /> : c.kind === "banner" ? <BannerSurface banner={c} motion={false} displayPx={80} className="cos-banner-thumb h-5 w-8 rounded"><span /></BannerSurface> : <span className="text-xs font-bold text-ink" aria-label={copy.kind(c.kind)}>Aa</span>}
          </span>)}</div><p className="text-[10px] font-semibold leading-tight text-ink">{[...new Set(rewards.map(c=>copy.name(c.id)))].join(" · ")}</p></div> : null}
          <p className={cx("mt-auto pt-1 text-[10px] leading-none", rewards.length ? "font-bold text-orange-bright" : "text-sub")}>+{loginXpBreakdown(day).total} XP</p>
        </li>;
      })}
    </ol>
    <p className="mt-4 text-xs leading-relaxed text-sub">{data.streak > LOGIN_STREAK.cycleDays ? M.loginCalendarComplete : M.loginHint} {M.loginUtcHint}</p>
  </Modal>;
}
