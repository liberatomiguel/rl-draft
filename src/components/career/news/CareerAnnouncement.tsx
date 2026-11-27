"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import type { CareerSave, NewsItem } from "@/engine/career/types";
import { ladderOf } from "@/engine/career/ladder";
import { toolboxUnannouncedOf, toolboxNewKey } from "@/engine/career/careerNew";
import { useActiveCareerCopy } from "@/components/career/orgCopy";
import { selectActiveSave, useCareerStore } from "@/store/careerStore";
import { moneyNoticeOf } from "@/store/careerFlow";
import { pendingDecisionsOf } from "@/store/careerDecisions";
import { pendingMandateOf } from "@/store/boardFlow";
import { trainingReportOf } from "@/store/careerTraining";
import { useSettings } from "@/store/settingsStore";
import { selectHeld, useOverlayHolds, useSettled } from "@/store/overlayHoldStore";
import { useDialogFocus, usePageScrollLock } from "@/components/ui/dialog";
import { useMounted } from "@/store/useMounted";
import { CAREER_NEWS } from "@/config/balance";
import { cx } from "@/lib/util";
import { dateOfDay, firstDayOfWeek } from "@/engine/career/calendar";
import { formatDateTiny } from "../dateText";
import { OrgMark } from "../OrgMark";
import { Button } from "@/components/ui/Button";
import { RungIcon } from "../ladder/LadderParts";
import { resolveNews } from "./newsText";
import { BrandMark } from "./NewsFeed";
import { rocketStreetNews, newsActionOf, newsCrestsOf } from "./newsView";

const INITIALIZED = "ui:progression-announcements";
export function reachedAnnouncementKeys(save: CareerSave): string[] {
  return ladderOf(save).filter(r => r.status !== "locked").map(r => `unlock:${r.id}`);
}

/** Optional headline is supplied by C1; older news records remain valid. */
export function careerAnnouncementOf(save: CareerSave) {
  const known = new Set(save.newAnnounced ?? []);
  const news = save.news.find(n => (n as NewsItem & { headline?: boolean }).headline === true && !known.has(`headline:${n.id}`));
  if (news) return { key: `headline:${news.id}`, news, rung: null, href: newsActionOf(news)?.href ?? "/career#career-news" };
  if (!known.has(INITIALIZED) || save.phase === "ended") return null;
  const rung = ladderOf(save).find(r => r.status !== "locked" && !known.has(`unlock:${r.id}`));
  if (rung) return { key: `unlock:${rung.id}`, news: null, rung, href: rung.kind === "coach" ? "/career/market#coaches" : "/career/finances" };
  const item = toolboxUnannouncedOf(save)[0];
  if (!item) return null;
  const id = item === "psych" ? "psychologist" : item;
  const toolRung = ladderOf(save).find(r => r.id === id);
  return toolRung ? { key: toolboxNewKey(item), news: null, rung: toolRung, href: "/career/finances" } : null;
}

export function CareerAnnouncement() {
  const save = useCareerStore(selectActiveSave);
  const mark = useCareerStore(s => s.markCareerAnnounced);
  const setAutoAdvance = useCareerStore(s => s.setAutoAdvance);
  const C = useActiveCareerCopy();
  const lang = useSettings(s => s.lang);
  const reports = useSettings(s => s.careerTrainingReports);
  const scrimPlaying = useCareerStore(s => Boolean(s.scrimPlayback));
  const held = useOverlayHolds(selectHeld);
  const router = useRouter();
  // Existing careers start with their earned gates acknowledged. Future gates announce normally.
  useEffect(() => {
    if (save && !save.newAnnounced?.includes(INITIALIZED)) mark([INITIALIZED, ...reachedAnnouncementKeys(save)]);
  }, [save, mark]);
  const notice = save ? careerAnnouncementOf(save) : null;
  const blocked = !save || (!save.flags["seenHub"] || Boolean(save.activeEvent || scrimPlaying)) || held || Boolean(moneyNoticeOf(save)) || pendingDecisionsOf(save).some(d => d.kind === "sponsor" && !d.parked) || Boolean(reports && trainingReportOf(save)) || Boolean(pendingMandateOf(save));
  const ready = useSettled(Boolean(notice) && !blocked);
  useEffect(() => { if (ready) setAutoAdvance(false); }, [ready, setAutoAdvance]);
  if (!ready || !notice || !save) return null;
  const content = notice.news ? resolveNews(notice.news, C, lang) : null;
  const close = () => {
    const keys = [notice.key];
    if (notice.rung) {
      const id = notice.rung.id === "psychologist" ? "psych" : notice.rung.id;
      keys.push(`tb:${id}`, `unlock:${notice.rung.id}`);
    }
    mark(keys);
  };
  // rc.49: closing only closes. A headline has no second action; an unlock keeps one quiet way to its screen.
  if (notice.news && content) {
    const news = notice.news;
    const partner = rocketStreetNews(news) ? "rocketStreet" : CAREER_NEWS.brand;
    const brandName = partner === "rocketStreet" ? C.launch.rocketStreet : C.news.brand[CAREER_NEWS.brand].name;
    const crests = newsCrestsOf(news, save, "orgRefs" in content ? (content.orgRefs as string[]) : undefined);
    return (
      <AnnouncementShell label={C.launch.breaking} onClose={close} tone="news" masthead={<BrandMark brand={partner} name={brandName} />} date={formatDateTiny(C.dates, dateOfDay(news.seasonIndex, news.day ?? firstDayOfWeek(news.week)))}>
        <div className="px-5 pb-5 pt-4 sm:px-6 sm:pb-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* "Breaking" is set like a lower-third tag: dark on paper. */}
            <p className="display rounded-sm bg-paper px-2 py-1 text-sm font-bold uppercase leading-none tracking-[0.05em] text-paper-ink">
              {C.launch.breaking}
            </p>
            <span className="kicker">{C.news.feed.subject[news.type]}</span>
          </div>
          {crests.length ? (
            <div className="mt-4 flex items-center justify-center gap-6 py-2">
              {crests.map((ref) => (
                <OrgMark key={ref} save={save} orgRef={ref} size="lg" loading="eager" className="!h-[5.5rem] !w-[5.5rem]" />
              ))}
            </div>
          ) : null}
          <div className="mt-4">
            <h2 className="display text-3xl font-bold leading-[1.1] text-ink sm:text-[2.25rem]">{content.title}</h2>
            {content.body ? <p className="mt-3 text-[15px] leading-[1.55] text-sub">{content.body}</p> : null}
          </div>
          <div className="mt-5 flex justify-end">
            <Button onClick={close}>{C.common.close}</Button>
          </div>
        </div>
      </AnnouncementShell>
    );
  }
  if (!notice.rung) return null;
  const rung = notice.rung;
  return (
    <AnnouncementShell label={C.launch.unlocked} onClose={close} tone="unlock" masthead={<p className="kicker !text-orange-bright">{C.launch.unlocked}</p>}>
      <div className="px-5 pb-5 pt-3 sm:px-6 sm:pb-6">
        <div className="flex items-center gap-5 py-3">
          <RungIcon id={rung.id} className="h-9 w-9 shrink-0 text-orange-bright" />
          <div className="min-w-0 flex-1">
            <h2 className="display text-2xl font-bold leading-[1.1] text-ink">{C.ladder.rung[rung.id]}</h2>
            <p className="mt-1.5 text-sm leading-snug text-sub">{C.ladder.hint[rung.id]}</p>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <Button variant="primary" onClick={() => { close(); router.push(notice.href); }}>{C.launch.open}</Button>
          <Button variant="ghost" onClick={close}>{C.common.close}</Button>
        </div>
      </div>
    </AnnouncementShell>
  );
}

/**
 * rc.49: the announcement's own dialog (Miguel: the stock modal looked poor).
 * A bare card on the shared backdrop: no title bar, the content carries the
 * identity. Same portal, scroll lock and focus contract as ui/Modal; the
 * backdrop keeps Modal's exact classes so the lite-fx fallbacks still match.
 */
function AnnouncementShell({ label, onClose, tone, masthead, date, children }: { label: string; onClose: () => void; tone: "news" | "unlock"; masthead: React.ReactNode; date?: string; children: React.ReactNode }) {
  const C = useActiveCareerCopy();
  const host = useMounted() ? document.body : null;
  const panelRef = useRef<HTMLDivElement>(null);
  usePageScrollLock(host !== null);
  useDialogFocus(panelRef, host !== null, { onEscape: onClose });
  if (!host) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={label}>
      <button aria-label={C.common.close} tabIndex={-1} className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={panelRef}
        tabIndex={-1}
        style={{ outline: "none" }}
        className={cx(
          "pop-in relative z-10 flex max-h-[calc(100dvh-2rem)] min-w-0 w-full flex-col overflow-hidden rounded-2xl border bg-panel-strong shadow-2xl",
          tone === "news" ? "max-w-xl border-blue-bright/55" : "max-w-md border-line-strong",
        )}
      >
        <div className={cx("flex shrink-0 items-center gap-3 pl-5 pr-2 sm:pl-6", tone === "news" ? "bg-blue py-1.5 text-white" : "pt-2")}>
          {masthead}
          <span className={cx("ml-auto text-xs", tone === "news" ? "text-white/80" : "text-faint")}>{date}</span>
          <button type="button" aria-label={C.common.close} onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-lg text-xl text-sub hover:bg-white/5 hover:text-ink">×</button>
        </div>
        <div className="min-h-0 overflow-y-auto overscroll-contain">{children}</div>
      </div>
    </div>,
    host,
  );
}
