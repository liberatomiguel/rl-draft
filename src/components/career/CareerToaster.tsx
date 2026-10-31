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
import { useCareerCopy } from "@/content/careerCopy";
import { cx } from "@/lib/util";
import { useMounted } from "@/store/useMounted";
import { useCareerStore, type CareerToast } from "@/store/careerStore";
import { resolveMail, resolveNews, resolveToastTitle } from "./news/newsText";
import { NewsTypeIcon } from "./news/NewsFeed";
import { newsActionOf } from "./news/newsView";
import { useCareerSave } from "./careerUi";
import { useSettings } from "@/store/settingsStore";
import { TrophyIcon } from "@/components/ui/icons";

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
  const C = useCareerCopy();
  const router = useRouter();
  const dismiss = useCareerStore((s) => s.dismissToast);

  useEffect(() => {
    const timer = setTimeout(() => dismiss(toast.id), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast.id, dismiss]);

  const save = useCareerSave();
  const lang = useSettings((s) => s.lang);
  const mail = toast.source === "mail" ? save?.mail.find((m) => m.id === toast.id) : undefined;
  const news = toast.source === "news" ? save?.news.find((n) => n.id === toast.id) : undefined;
  const content = news ? resolveNews(news, C, lang) : mail ? resolveMail(mail, C) : null;
  const title = content?.title ?? resolveToastTitle(toast, C, lang);
  const href = toast.linkTo ?? (news ? newsActionOf(news)?.href : undefined) ?? (toast.source === "news" ? "/career#career-news" : "/career/news");
  const kicker =
    toast.source === "achievement" ? C.achievements.unlocked : toast.source === "mail" ? C.mail.title : C.hub.news;

  return (
    <button
      type="button"
      onClick={() => {
        dismiss(toast.id);
        router.push(`/career${href.replace(/^\/career/, "")}`);
      }}
      className={cx(
        "panel-strong pop-in pointer-events-auto flex w-full items-start gap-3 rounded-xl p-3.5 text-left shadow-xl",
        toast.source === "achievement"
          ? "ring-1 ring-amber-300/60"
          : toast.source === "mail"
            ? "ring-1 ring-orange/40"
            : "ring-1 ring-blue/30",
      )}
    >
      <span className={cx("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", toast.source === "achievement" ? "bg-amber-300/10 text-amber-300" : toast.source === "mail" ? "bg-orange/10 text-orange-bright" : "bg-blue/10 text-blue-bright")}>
        {toast.source === "achievement" ? <TrophyIcon className="h-5 w-5" /> : news ? <NewsTypeIcon type={news.type} className="h-5 w-5" /> : <MailIcon className="h-5 w-5" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[9px] font-bold uppercase tracking-[0.18em] text-faint">
          {kicker}
        </span>
        <span className="mt-1 block line-clamp-2 text-sm font-semibold leading-snug text-ink">{title}</span>
        {content?.body ? <span className="mt-1 block line-clamp-2 text-xs leading-relaxed text-sub">{content.body}</span> : null}
        <span className="mt-2 block text-[10px] font-semibold text-blue-bright">{toast.source === "mail" ? C.mail.title : toast.source === "achievement" ? C.achievements.unlocked : C.hub.news} →</span>
      </span>
    </button>
  );
}

function MailIcon({ className }: { className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 6 9 7 9-7" /></svg>;
}
