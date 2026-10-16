"use client";

/**
 * Reward toaster (v2.0): renders `useRewardToasts` — mission completions, the
 * all-three bonus, login streak XP, quiz solves. Portaled to <body>, stacked
 * just under the achievement toaster so both can show at once.
 */

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useCopy } from "@/content/copy";
import { cx } from "@/lib/util";
import { sfx } from "@/lib/sfx";
import { useMounted } from "@/store/useMounted";
import { useRewardToasts, type RewardToast } from "@/store/rewardToastStore";

export function RewardToaster() {
  const mounted = useMounted();
  const queue = useRewardToasts((s) => s.queue);
  if (!mounted || queue.length === 0) return null;
  return createPortal(
    <div
      className="pointer-events-none fixed right-3 top-[4.5rem] z-[79] flex w-[min(20rem,calc(100vw-1.5rem))] flex-col gap-2"
      aria-live="polite"
    >
      {queue.slice(0, 3).map((t) => (
        <Toast key={t.id} toast={t} />
      ))}
    </div>,
    document.body,
  );
}

const TONE: Record<RewardToast["kind"], string> = {
  mission: "!border-good/50 shadow-[0_0_18px_rgba(52,211,153,0.18)]",
  missionBonus: "!border-amber-400/60 shadow-[0_0_22px_rgba(251,191,36,0.22)]",
  login: "!border-orange/50 shadow-[0_0_18px_rgba(249,115,22,0.2)]",
  quiz: "!border-violet-400/50 shadow-[0_0_18px_rgba(167,139,250,0.2)]",
};

function Toast({ toast }: { toast: RewardToast }) {
  const { MISSIONS_UI: M, QUIZ_UI: Q } = useCopy();
  const dismiss = useRewardToasts((s) => s.dismiss);
  useEffect(() => {
    sfx.pick();
    const t = setTimeout(() => dismiss(toast.id), 4200);
    return () => clearTimeout(t);
  }, [toast.id, dismiss]);

  const { kicker, title } = (() => {
    switch (toast.kind) {
      case "mission":
        return { kicker: M.toastCompleted, title: M.items[toast.missionId]?.title ?? toast.missionId };
      case "missionBonus":
        return { kicker: M.toastBonus, title: toast.period === "daily" ? M.daily : M.weekly };
      case "login":
        return {
          kicker: M.loginTitle,
          title: toast.milestone ? M.loginMilestone(toast.milestone) : M.loginDays(toast.streak),
        };
      case "quiz":
        return { kicker: Q.title, title: Q.solvedToast(toast.attempt) };
    }
  })();

  return (
    <button
      type="button"
      onClick={() => dismiss(toast.id)}
      className={cx("panel-strong pop-in pointer-events-auto flex w-full items-center gap-3 p-3 text-left", TONE[toast.kind])}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[9px] font-bold uppercase tracking-[0.18em] text-sub">{kicker}</span>
        <span className="display block truncate text-sm font-bold uppercase tracking-wide text-ink">{title}</span>
      </span>
      {toast.xp ? <span className="display shrink-0 text-sm font-bold text-orange-bright">+{toast.xp} XP</span> : null}
    </button>
  );
}
