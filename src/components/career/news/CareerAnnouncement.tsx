"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import type { CareerSave, NewsItem } from "@/engine/career/types";
import { ladderOf } from "@/engine/career/ladder";
import { toolboxUnannouncedOf, toolboxNewKey } from "@/engine/career/careerNew";
import { useCareerCopy } from "@/content/careerCopy";
import { selectActiveSave, useCareerStore } from "@/store/careerStore";
import { moneyNoticeOf } from "@/store/careerFlow";
import { pendingDecisionsOf } from "@/store/careerDecisions";
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
  const C = useCareerCopy();
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
  const blocked = !save || (!save.flags["seenHub"] || Boolean(save.activeEvent || scrimPlaying)) || held || Boolean(moneyNoticeOf(save)) || pendingDecisionsOf(save).some(d => d.kind === "sponsor" && !d.parked) || Boolean(reports && trainingReportOf(save));
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
            <p className="display flex items-center gap-2 text-sm font-bold uppercase tracking-[0.16em] text-orange-bright">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-orange-bright shadow-[0_0_10px_rgba(249,115,22,0.35)]" />
              {C.launch.breaking}
            </p>
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-faint">{C.news.feed.subject[news.type]}</span>
          </div>
          {crests.length ? (
            <div className="mt-4 flex items-center justify-center gap-6 py-2">
              {crests.map((ref) => (
                <OrgMark key={ref} save={save} orgRef={ref} size="lg" loading="eager" className="!h-[5.5rem] !w-[5.5rem]" />
              ))}
            </div>
          ) : null}
          <div className="mt-4 border-l-[3px] border-blue pl-4">
            <h2 className="display text-2xl font-bold leading-tight tracking-tight text-ink sm:text-3xl">{content.title}</h2>
            {content.body ? <p className="mt-3 text-sm leading-relaxed text-sub">{content.body}</p> : null}
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
    <AnnouncementShell label={C.launch.unlocked} onClose={close} tone="unlock" masthead={<p className="text-[10px] font-bold uppercase tracking-[0.18em] text-orange-bright">{C.launch.unlocked}</p>}>
      <div className="relative overflow-hidden px-5 pb-5 pt-3 sm:px-6 sm:pb-6">
        <div className="relative flex items-center gap-5 rounded-xl border border-orange/20 bg-gradient-to-br from-orange/[0.08] to-transparent p-4 sm:p-5">
          <div className="min-w-0 flex-1">
            <h2 className="display text-3xl font-bold leading-none tracking-tight text-ink">{C.ladder.rung[rung.id]}</h2>
            <p className="mt-2 text-sm leading-relaxed text-sub">{C.ladder.hint[rung.id]}</p>
          </div>
          <span className="relative flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center rounded-2xl border border-orange/30 bg-orange/10 text-orange-bright shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
            <RungIcon id={rung.id} className="h-9 w-9" />
            <span aria-hidden className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-panel-strong bg-orange text-[#1a0d02]">
              <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="m3.5 8 3 3 6-6" /></svg>
            </span>
          </span>
        </div>
        <div className="relative mt-4 flex items-center justify-between gap-3">
          <Button variant="primary" className="!shadow-none" onClick={() => { close(); router.push(notice.href); }}>{C.launch.open} →</Button>
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
  const C = useCareerCopy();
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
          tone === "news" ? "max-w-lg border-blue/25" : "max-w-md border-orange/30 bg-[linear-gradient(135deg,rgba(249,115,22,0.07),transparent_55%)]",
        )}
      >
        <div className={cx("flex shrink-0 items-center gap-3 pl-5 pr-2 sm:pl-6", tone === "news" ? "border-b border-blue/15 bg-blue/5 py-2" : "pt-2")}>
          {masthead}
          <span className="ml-auto text-[10px] uppercase tracking-[0.12em] text-faint">{date}</span>
          <button type="button" aria-label={C.common.close} onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-lg text-xl text-sub hover:bg-white/5 hover:text-ink">×</button>
        </div>
        <div className="min-h-0 overflow-y-auto overscroll-contain">{children}</div>
      </div>
    </div>,
    host,
  );
}
