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
import { CAREER_NEWS } from "@/config/balance";
import { cx } from "@/lib/util";
import { useMounted } from "@/store/useMounted";
import { useCareerStore, type CareerToast } from "@/store/careerStore";
import { resolveMail, resolveNews, resolveToastTitle } from "./news/newsText";
import { NewsTypeIcon } from "./news/NewsFeed";
import { newsActionOf, newsCrestsOf } from "./news/newsView";
import { useCareerSave } from "./careerUi";
import { useSettings } from "@/store/settingsStore";
import { TrophyIcon } from "@/components/ui/icons";
import { OrgMark } from "./OrgMark";
import { dateOfDay, firstDayOfWeek } from "@/engine/career/calendar";
import { formatDateTiny } from "./dateText";

const TOAST_MS = 5200;

export function CareerToaster() {
  const mounted = useMounted();
  const toasts = useCareerStore((s) => s.toasts);
  if (!mounted || toasts.length === 0) return null;
  return createPortal(
    <div
      className="pointer-events-none fixed right-3 top-16 z-[80] flex max-h-[calc(100dvh-9rem)] w-[min(22rem,calc(100vw-1.5rem))] flex-col gap-2 overflow-y-auto"
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
  const from = mail?.fromKey ? (C.mail.from as Record<string, string>)[mail.fromKey] : null;
  const open = () => {
    dismiss(toast.id);
    router.push(`/career${href.replace(/^\/career/, "")}`);
  };

  if (toast.source === "news") {
    const brand = C.news.brand[CAREER_NEWS.brand];
    const crests = news && save ? newsCrestsOf(news, save) : [];
    return (
      <button type="button" data-career-notice="news" onClick={open}
        className="pop-in pointer-events-auto w-full shrink-0 overflow-hidden rounded-lg border border-slate-400/30 bg-[#111a29] text-left shadow-xl">
        <span className="flex items-center justify-between gap-2 border-b border-slate-400/25 bg-white/[0.035] px-3.5 py-2">
          <span className="font-serif text-base font-bold uppercase tracking-[0.12em] text-slate-100">{brand.kicker}</span>
          <span className="text-[9px] uppercase tracking-wider text-slate-400">{news ? formatDateTiny(C.dates, dateOfDay(news.seasonIndex, news.day ?? firstDayOfWeek(news.week))) : C.hub.news}</span>
        </span>
        <span className="block border-l-2 border-blue/70 px-3.5 py-3">
          <span className="flex items-start gap-3">
            <span className="min-w-0 flex-1">
              <span className="mb-1 block text-[9px] font-semibold uppercase tracking-[0.16em] text-blue-bright">{news ? C.news.feed.subject[news.type] : C.hub.news}</span>
              <span className="block font-serif text-[17px] font-bold leading-snug text-ink line-clamp-3">{title}</span>
            </span>
            {save && crests.length ? <span className="flex shrink-0 -space-x-2">{crests.map(ref => <OrgMark key={ref} save={save} orgRef={ref} size="sm" />)}</span> : <NewsTypeIcon type={news?.type ?? "flavor"} className="h-6 w-6 shrink-0 text-slate-400" />}
          </span>
          {content?.body ? <span className="mt-2 block line-clamp-2 text-xs leading-relaxed text-slate-400">{content.body}</span> : null}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      data-career-notice={toast.source}
      onClick={open}
      className={cx(
        "pop-in pointer-events-auto flex w-full shrink-0 items-start gap-3 rounded-xl border border-line bg-[#111827] p-3.5 text-left shadow-xl",
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
          {kicker}{from ? ` · ${from}` : ""}
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
