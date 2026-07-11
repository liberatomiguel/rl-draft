"use client";

/**
 * Road to Worlds v0.3 — the career popup layer (AchievementToaster pattern).
 *
 * Mounted once in the /career layout, portaled to <body>. The store mirrors
 * every fresh mail item + high-priority news line into a session toast queue
 * after each action — bids landing mid-window, contract warnings, scrim
 * results, unlocks, the window report — so the world talks to you while the
 * FIFA-style autoplay runs. Tap = deep link (when the mail carries one);
 * everything auto-dismisses.
 */

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useCopy } from "@/content/copy";
import { cx } from "@/lib/util";
import { useMounted } from "@/store/useMounted";
import { useCareerStore, type CareerToast } from "@/store/careerStore";
import { resolveToastTitle } from "./news/newsText";

const TOAST_MS = 5200;

export function CareerToaster() {
  const mounted = useMounted();
  const toasts = useCareerStore((s) => s.toasts);
  if (!mounted || toasts.length === 0) return null;
  return createPortal(
    <div
      className="pointer-events-none fixed right-3 top-16 z-[80] flex w-[min(20rem,calc(100vw-1.5rem))] flex-col gap-2"
      aria-live="polite"
    >
      {toasts.slice(0, 3).map((toast) => (
        <Toast key={toast.id} toast={toast} />
      ))}
    </div>,
    document.body,
  );
}

function Toast({ toast }: { toast: CareerToast }) {
  const t = useCopy();
  const C = t.CAREER;
  const router = useRouter();
  const dismiss = useCareerStore((s) => s.dismissToast);

  useEffect(() => {
    const timer = setTimeout(() => dismiss(toast.id), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast.id, dismiss]);

  const title = resolveToastTitle(toast, C);
  const kicker = toast.source === "mail" ? C.mail.title : C.hub.news;

  return (
    <button
      type="button"
      onClick={() => {
        dismiss(toast.id);
        if (toast.linkTo) router.push(`/career${toast.linkTo.replace(/^\/career/, "")}`);
      }}
      className={cx(
        "panel-strong pop-in pointer-events-auto flex w-full items-start gap-3 p-3 text-left",
        toast.source === "mail" ? "ring-1 ring-orange/40" : "ring-1 ring-blue/30",
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[9px] font-bold uppercase tracking-[0.18em] text-faint">
          {kicker}
        </span>
        <span className="block truncate text-sm font-semibold text-ink">{title}</span>
      </span>
    </button>
  );
}
