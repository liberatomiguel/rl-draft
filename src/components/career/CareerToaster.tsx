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
import { useActiveCareerCopy } from "@/components/career/orgCopy";
import { CAREER_NEWS } from "@/config/balance";
import { cx } from "@/lib/util";
import { useMounted } from "@/store/useMounted";
import { useCareerStore, type CareerToast } from "@/store/careerStore";
import { resolveMail, resolveNews, resolveToastTitle } from "./news/newsText";
import { BrandMark, NewsTypeIcon } from "./news/NewsFeed";
import { rocketStreetNews, newsActionOf, newsCrestsOf } from "./news/newsView";
import { useCareerSave } from "./careerUi";
import { useSettings } from "@/store/settingsStore";
import { CloseIcon, TrophyIcon } from "@/components/ui/icons";
import { OrgMark } from "./OrgMark";
import { dateOfDay, firstDayOfWeek } from "@/engine/career/calendar";
import { formatDateTiny } from "./dateText";

const TOAST_MS = 5200;

export function CareerToaster() {
  const mounted = useMounted();
  const C = useActiveCareerCopy();
  const dismiss = useCareerStore(s => s.dismissToast);
  const toasts = useCareerStore((s) => s.toasts);
  if (!mounted || toasts.length === 0) return null;
  return createPortal(
    <div
      className="toast-stack pointer-events-none fixed top-[calc(4rem+env(safe-area-inset-top))] right-2 z-[80] flex max-h-[30dvh] w-[min(22rem,calc(100vw-1.5rem))] flex-col gap-2 overflow-y-auto p-1 sm:top-16 sm:max-h-[calc(100dvh-9rem)]"
      aria-live="polite"
    >
      {toasts.slice(0, 3).map((toast) => (
        // rc9 DS (#216): the close control sits inside the toast's own top row. A news
        // flash keeps its blue masthead across the full width, the X on the band; the
        // card reserves the X's room in its own first row, not in the outer padding.
        <div key={toast.id} className="relative hidden shrink-0 first:block sm:block">
          <Toast toast={toast} />
          <button
            type="button"
            onClick={() => dismiss(toast.id)}
            aria-label={C.common.close}
            className={cx(
              "pointer-events-auto absolute right-1 top-0 flex h-11 w-11 items-center justify-center rounded-lg transition-colors",
              toast.source === "news" ? "text-white/80 hover:text-white" : "text-faint hover:text-ink",
            )}
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>,
    document.body,
  );
}

function Toast({ toast }: { toast: CareerToast }) {
  const C = useActiveCareerCopy();
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
    const partner = news && rocketStreetNews(news) ? "rocketStreet" : CAREER_NEWS.brand;
    const brand = partner === "rocketStreet" ? { name: C.launch.rocketStreet } : C.news.brand[CAREER_NEWS.brand];
    const crests = news && save ? newsCrestsOf(news, save, content && "orgRefs" in content ? content.orgRefs as string[] : undefined) : [];
    return (
      <button type="button" data-career-notice="news" onClick={open}
        // A news flash is a small front page, not a notification: the desk's masthead in blue,
        // the headline in the display face, the crests of who it is about.
        className="pop-in pointer-events-auto w-full shrink-0 overflow-hidden rounded-xl border border-blue-bright/55 bg-surface-strong text-left shadow-xl">
        {/* The masthead spans the whole card; its right end holds the date and leaves the X its 44px. */}
        <span className="flex min-h-11 items-center justify-between gap-3 bg-blue py-2 pl-4 pr-12 text-white">
          <span className="flex min-w-0 items-center gap-2.5">
            <BrandMark brand={partner} name={brand.name} small />
            <span className="display truncate text-xs font-semibold uppercase">{news ? C.news.feed.subject[news.type] : C.hub.news}</span>
          </span>
          <span className="shrink-0 text-xs tabular-nums text-white/80">{news ? formatDateTiny(C.dates, dateOfDay(news.seasonIndex, news.day ?? firstDayOfWeek(news.week))) : null}</span>
        </span>
        <span className="flex items-center gap-4 px-4 pb-4 pt-3">
          <span className="min-w-0 flex-1">
            {/* rc9 DS: a headline in mixed case, Demi, so the masthead stays the one caps line. */}
            {/* rc9 DS: `line-clamp` sets its own display; a `block` beside it undid the clamp. */}
            <span className="display line-clamp-3 text-[17px] font-bold leading-[1.2] text-ink">{title}</span>
            {content?.body ? <span className="mt-1.5 line-clamp-2 text-xs text-sub">{content.body}</span> : null}
          </span>
          {save && crests.length ? <span className="flex shrink-0 -space-x-2">{crests.map(ref => <OrgMark key={ref} save={save} orgRef={ref} size="md" />)}</span> : null}
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
        // rc9 DS (#216): a letter, not an alert. One hairline in the source's colour, no ring
        // on top of a border; the source as a quiet caps label with the sender in mixed case;
        // the subject in the display face (mixed case, Demi); the body in the text face.
        "pop-in pointer-events-auto flex w-full shrink-0 items-start gap-3 rounded-xl border bg-surface-strong py-3.5 pl-4 pr-12 text-left shadow-xl",
        toast.source === "achievement" ? "border-amber-300/50" : toast.source === "mail" ? "border-orange/45" : "border-blue-bright/40",
      )}
    >
      <span className={cx("mt-0.5 shrink-0", toast.source === "achievement" ? "text-amber-300" : toast.source === "mail" ? "text-orange-bright" : "text-blue-bright")}>
        {toast.source === "achievement" ? <TrophyIcon className="h-5 w-5" /> : news ? <NewsTypeIcon type={news.type} className="h-5 w-5" /> : <MailIcon className="h-5 w-5" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-baseline gap-1.5">
          <span className="kicker shrink-0">{kicker}</span>
          {from ? <span className="truncate text-xs text-sub">{from}</span> : null}
        </span>
        <span className="display mt-1.5 line-clamp-2 text-[15px] font-bold leading-[1.25] text-ink">{title}</span>
        {content?.body ? <span className="mt-1 line-clamp-2 text-xs text-sub">{content.body}</span> : null}
      </span>
    </button>
  );
}

function MailIcon({ className }: { className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 6 9 7 9-7" /></svg>;
}
