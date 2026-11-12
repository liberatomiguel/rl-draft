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
      <AnnouncementShell label={C.launch.breaking} onClose={close} tone="news">
        {/* The desk's masthead, as on the news toast: brand left, date right. */}
        <div className="flex items-center justify-between gap-3 border-b border-blue/20 bg-blue/[0.06] px-5 py-3">
          <BrandMark brand={partner} name={brandName} />
          <span className="text-[10px] uppercase tracking-[0.14em] text-faint">
            {formatDateTiny(C.dates, dateOfDay(news.seasonIndex, news.day ?? firstDayOfWeek(news.week)))}
          </span>
        </div>
        <div className="relative px-5 pb-5 pt-5 sm:px-7 sm:pb-6">
          <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-[radial-gradient(ellipse_at_top,rgba(59,130,246,0.18),transparent_70%)]" />
          <div className="relative flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-orange px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#1a0d02]">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[#1a0d02]" />
              {C.launch.breaking}
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-blue-bright">{C.news.feed.subject[news.type]}</span>
          </div>
          {crests.length ? (
            <div className="relative mt-5 flex items-center justify-center gap-6 rounded-xl bg-black/15 py-5">
              {crests.map((ref) => (
                <OrgMark key={ref} save={save} orgRef={ref} size="lg" />
              ))}
            </div>
          ) : null}
          <h2 className="relative mt-6 display text-2xl font-bold leading-tight tracking-tight text-ink sm:text-3xl">{content.title}</h2>
          {content.body ? <p className="relative mt-4 border-t border-line pt-4 text-sm leading-relaxed text-sub">{content.body}</p> : null}
          <div className="relative mt-6 flex justify-end">
            <Button onClick={close}>{C.common.close}</Button>
          </div>
        </div>
      </AnnouncementShell>
    );
  }
  if (!notice.rung) return null;
  const rung = notice.rung;
  return (
    <AnnouncementShell label={C.launch.unlocked} onClose={close} tone="unlock">
      <div className="relative px-6 pb-6 pt-2 sm:px-8 sm:pb-8">
        <div className="mb-6 flex items-center gap-3 border-b border-line pb-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-blue/30 bg-blue/10 text-blue-bright"><RungIcon id={rung.id} className="h-6 w-6" /></span>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-blue-bright">{C.launch.unlocked}</p>
        </div>
        <h2 className="display text-2xl font-bold leading-tight text-ink sm:text-3xl">{C.ladder.rung[rung.id]}</h2>
        <p className="mt-3 text-sm leading-relaxed text-sub">{C.ladder.hint[rung.id]}</p>
        <div className="mt-7 flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={close}>{C.common.close}</Button>
          <Button variant="secondary" onClick={() => { close(); router.push(notice.href); }}>{C.launch.open} →</Button>
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
function AnnouncementShell({ label, onClose, tone, children }: { label: string; onClose: () => void; tone: "news" | "unlock"; children: React.ReactNode }) {
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
          tone === "news" ? "max-w-lg border-blue/35" : "max-w-md border-line-strong",
        )}
      >
        <div className="flex shrink-0 justify-end px-2 pt-2">
          <button type="button" aria-label={C.common.close} onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-lg text-xl text-sub hover:bg-white/5 hover:text-ink">×</button>
        </div>
        <div className="min-h-0 overflow-y-auto overscroll-contain">{children}</div>
      </div>
    </div>,
    host,
  );
}
