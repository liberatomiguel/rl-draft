"use client";
import { useEffect, useRef } from "react";
import { LOGIN_STREAK } from "@/config/balance";
import { COSMETICS } from "@/data/cosmetics";
import { useCopy } from "@/content/copy";
import { loginXpBreakdown } from "@/engine/missions";
import { cx } from "@/lib/util";
import { selectHeld, useOverlayHolds, useSettled } from "@/store/overlayHoldStore";
import { useProfileStore } from "@/store/profileStore";
import { useRewardToasts, type LoginModalData } from "@/store/rewardToastStore";
import { BadgeEmblem, BannerSurface, TitleTag, useCosmeticCopy } from "@/components/cosmetics/CosmeticViews";
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
  const currentRef = useRef<HTMLLIElement>(null);
  useEffect(() => { currentRef.current?.scrollIntoView({block:"nearest"}); }, [data.streak]);
  return <Modal open wide className="!max-w-3xl" title={M.loginModalTitle} onClose={onClose} actions={<Button variant="primary" size="lg" onClick={onClose} full>{M.loginContinue}</Button>} summary={<>
    <div className="mb-3 flex items-end justify-between gap-3">
      <div><p className="text-xs text-sub">{M.loginCredited}</p><p className="display text-3xl font-bold text-orange-bright">+{data.xp} XP</p></div>
      <p className="text-right text-xs font-semibold text-ink">{M.loginProgress(collected, LOGIN_STREAK.cycleDays)}</p>
    </div>
    <div className="mb-3 h-1 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-label={M.loginCalendarKicker} aria-valuemin={0} aria-valuemax={LOGIN_STREAK.cycleDays} aria-valuenow={collected}><div className="h-full bg-orange" style={{width:`${collected / LOGIN_STREAK.cycleDays * 100}%`}} /></div>
    </>}>
    <ol className="grid grid-cols-3 gap-1 sm:grid-cols-6" aria-label={M.loginCalendarKicker}>
      {Array.from({length:LOGIN_STREAK.cycleDays},(_,i)=>i+1).map(day=>{
        const done = day <= collected;
        const current = day === data.streak;
        const rewards = COSMETICS.filter(c=>c.source.type === "login-streak" && c.source.days === day);
        return <li key={day} ref={day === collected ? currentRef : undefined} aria-current={current ? "date" : undefined} className={cx("flex min-h-16 min-w-0 flex-col rounded-lg border p-2", day === LOGIN_STREAK.cycleDays && "col-span-3 sm:col-span-6", current ? "border-orange bg-orange/10" : done ? "border-good/35 bg-good/[0.04]" : rewards.length ? "border-amber-200/25 bg-white/[0.04]" : "border-line bg-bg/40")}>
          <div className="mb-1 flex items-center justify-between gap-1 text-xs leading-none"><span className="font-semibold text-ink">{day}</span>{done ? <span className="text-good" aria-label={M.loginCollected}>✓</span> : <span className="sr-only">{M.loginUpcoming}</span>}</div>
          {rewards.length ? <div className="mb-2 min-w-0"><div className="my-2 flex min-h-9 flex-wrap items-center gap-2">{rewards.map(c=><span key={c.id} className="min-w-0 max-w-full" title={`${copy.kind(c.kind)} · ${copy.name(c.id)}`}>
            {c.kind === "badge" ? <BadgeEmblem badge={c} size={day === LOGIN_STREAK.cycleDays ? 48 : 36} fx={false} /> : c.kind === "banner" ? <BannerSurface banner={c} motion={false} displayPx={160} className={day === LOGIN_STREAK.cycleDays ? "cos-banner-thumb h-12 w-36 max-w-full rounded" : "cos-banner-thumb h-9 w-16 max-w-full rounded"}><span /></BannerSurface> : <span className="block max-w-full overflow-hidden"><TitleTag title={c} size={day === LOGIN_STREAK.cycleDays ? "sm" : "xs"} /></span>}
          </span>)}</div>{rewards.some(c=>c.kind!=="title") ? <p className="text-[10px] font-semibold leading-tight text-ink">{[...new Set(rewards.filter(c=>c.kind!=="title").map(c=>copy.name(c.id)))].join(" · ")}</p> : null}</div> : null}
          <p className={cx("mt-auto pt-1 text-[10px] leading-none", rewards.length ? "font-bold text-orange-bright" : "text-sub")}>+{loginXpBreakdown(day).total} XP</p>
        </li>;
      })}
    </ol>
    <p className="mt-4 text-xs leading-relaxed text-sub">{data.streak > LOGIN_STREAK.cycleDays ? M.loginCalendarComplete : M.loginHint} {M.loginUtcHint}</p>
  </Modal>;
}
