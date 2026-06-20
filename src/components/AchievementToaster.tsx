"use client";

/**
 * Global achievement toaster (v1.4). Renders the achievement-toast queue from
 * anywhere in the app (mounted once in AppShell), portaled to <body> so it sits
 * above everything and isn't trapped by an animated ancestor. Each toast
 * auto-dismisses; tap to dismiss early. This is what makes achievements pop the
 * MOMENT they're earned — mid-draft, mid-match — not only on the results screen.
 */

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { achievementById } from "@/data";
import { useCopy } from "@/content/copy";
import { cx } from "@/lib/util";
import { sfx } from "@/lib/sfx";
import { useMounted } from "@/store/useMounted";
import { useAchievementToasts } from "@/store/achievementToastStore";
import { achievementStyle } from "@/components/achievementStyle";
import { AchievementIcon } from "@/components/AchievementIcon";

export function AchievementToaster() {
  const mounted = useMounted();
  const queue = useAchievementToasts((s) => s.queue);
  if (!mounted || queue.length === 0) return null;
  return createPortal(
    <div
      className="pointer-events-none fixed right-3 top-16 z-[80] flex w-[min(20rem,calc(100vw-1.5rem))] flex-col gap-2"
      aria-live="polite"
    >
      {queue.slice(0, 4).map((id) => (
        <Toast key={id} id={id} />
      ))}
    </div>,
    document.body,
  );
}

function Toast({ id }: { id: string }) {
  const { ACH_UI } = useCopy();
  const dismiss = useAchievementToasts((s) => s.dismiss);
  const def = achievementById.get(id);

  useEffect(() => {
    sfx.unlock();
    const t = setTimeout(() => dismiss(id), 4800);
    return () => clearTimeout(t);
  }, [id, dismiss]);

  if (!def) return null;
  const style = achievementStyle(def);
  return (
    <button
      type="button"
      onClick={() => dismiss(id)}
      className={cx(
        "panel-strong pop-in pointer-events-auto flex w-full items-start gap-3 p-3 text-left",
        style.ring,
        style.glow,
        style.legend && "ach-legend",
      )}
    >
      <span className={cx("flex h-9 w-9 shrink-0 items-center justify-center rounded-md", style.chip)}>
        <AchievementIcon group={def.group} className="h-4.5 w-4.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cx("block text-[9px] font-bold uppercase tracking-[0.18em]", style.text)}>
          {ACH_UI.unlocked}
        </span>
        <span className="display block truncate text-sm font-bold uppercase tracking-wide text-ink">
          {def.title}
        </span>
        <span className="block text-[11px] text-faint">+{def.xp} XP</span>
      </span>
    </button>
  );
}
