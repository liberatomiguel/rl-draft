"use client";

/**
 * Road to Worlds hub — PROGRESSION & TOOLBOX (rc.35, Miguel's rc.34
 * feedback: one card, visual, not running text). Merges rc.34's "next
 * unlock" card and the toolbox (UX-01f / UX-06a; HQ-CONTRACT H6, decisions
 * 5-A and 7-A):
 *  - the progression ladder as a compact icon track (engine/career/ladder),
 *    the next rung with its reputation bar, "See more" opens the whole ladder;
 *  - what is running (the bootcamp and its end date) as icon chips;
 *  - the items ready to buy as icon tiles (price, "New" tag).
 * A tile or the once-per-novelty unlock announcement opens ONE visual modal:
 * the item, its icon, benefits and price, and two buttons — Buy and Close
 * (no second step). Buy calls the same flows Finances does; a refusal says
 * why (store/careerHq.toolboxRefusalOf) and disables Buy.
 */

import { useMemo, useState } from "react";
import type { CareerCopy } from "@/content/careerCopy";
import { careerNewSummary, toolboxNewKey, toolboxUnannouncedOf, type ToolboxItemId } from "@/engine/career/careerNew";
import { ladderOf, type LadderRungId } from "@/engine/career/ladder";
import type { CareerSave } from "@/engine/career/types";
import { formatMoney } from "@/lib/format";
import { cx } from "@/lib/util";
import { useCareerStore } from "@/store/careerStore";
import { toolboxAfterOf, toolboxOf, toolboxRefusalOf, gearBlockerOf, type ToolboxItem } from "@/store/careerHq";
import { dateOfDay } from "@/components/career/careerUi";
import { formatDateShort } from "@/components/career/dateText";
import { LadderStrip, RungIcon } from "@/components/career/ladder/LadderParts";
import { AppLink } from "@/components/ui/AppLink";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { NewTag } from "@/components/ui/NewDot";
import { Panel } from "@/components/ui/Panel";
import { ProgressBar } from "@/components/ui/ProgressBar";

export function toolboxNameOf(C: CareerCopy, id: ToolboxItemId): string {
  if (id === "bootcamp1") return C.finances.bootcampT1;
  if (id === "bootcamp2") return C.finances.bootcampT2;
  if (id === "psych") return C.finances.psychologist;
  return C.finances.gear[id];
}

const rungOfItem = (id: ToolboxItemId): LadderRungId => (id === "psych" ? "psychologist" : id);

function benefitsOf(C: CareerCopy, item: ToolboxItem): string[] {
  const parts: string[] = [];
  if (item.trainingPct) parts.push(C.toolbox.training(item.trainingPct));
  if (item.buffLevels) parts.push(C.toolbox.buff(item.buffLevels));
  if (item.ratingEdge) parts.push(C.toolbox.rating(item.ratingEdge.toFixed(1)));
  if (item.chemistry) parts.push(C.toolbox.chemistry);
  if (item.stats) parts.push(C.toolbox.stats);
  return parts;
}

function durationOf(C: CareerCopy, item: ToolboxItem): string {
  const d = item.duration;
  if (d.kind === "permanent") return C.toolbox.permanent;
  if (d.kind === "weekly") return C.toolbox.weekly(formatMoney(item.weekly, { compact: true }));
  if (d.kind === "nextEvent") return C.toolbox.nextEvent;
  return C.toolbox.until(formatDateShort(C.dates, dateOfDay(d.seasonIndex, d.day)));
}

function priceOf(C: CareerCopy, item: ToolboxItem): string {
  if (item.kind === "psychologist") return C.squad.perWeek(formatMoney(item.weekly, { compact: true }));
  if (item.free) return C.common.free;
  return formatMoney(item.price, { compact: true });
}

function refusalText(C: CareerCopy, key: string): string {
  const r = C.toolbox.refusal;
  return key in r ? r[key as keyof typeof r] : r.other;
}

export function ToolboxBlock({ save, C }: { save: CareerSave; C: CareerCopy }) {
  const buyGear = useCareerStore((s) => s.buyGear);
  const runBootcamp = useCareerStore((s) => s.runBootcamp);
  const setPsychologist = useCareerStore((s) => s.setPsychologist);
  const markCareerSeen = useCareerStore((s) => s.markCareerSeen);
  const markCareerAnnounced = useCareerStore((s) => s.markCareerAnnounced);
  const [sheetId, setSheetId] = useState<ToolboxItemId | null>(null);
  const L = C.ladder;

  const items = useMemo(() => toolboxOf(save), [save]);
  const rungs = useMemo(() => ladderOf(save), [save]);
  const summary = useMemo(() => careerNewSummary(save), [save]);
  const unannounced = useMemo(() => toolboxUnannouncedOf(save, summary), [save, summary]);
  const ended = save.phase === "ended";

  // UX-06a: the first novelty not yet announced — never over the first-visit explainer.
  const announce = !ended && save.flags["seenHub"] && !sheetId ? (unannounced[0] ?? null) : null;
  const modalId = sheetId ?? announce;
  const sheet = modalId ? (items.find((i) => i.id === modalId) ?? null) : null;
  const refusal = useMemo(() => (sheet ? toolboxRefusalOf(save, sheet.id) : null), [save, sheet]);
  const after = sheet ? toolboxAfterOf(save, sheet) : null;

  const active = items.filter((i) => i.status === "active");
  const toBuy = items.filter((i) => i.status === "buyable" || i.status === "used" || i.status === "queued");
  const next = rungs.find((r) => r.status === "locked") ?? null;
  const rep = Math.round(save.reputation);

  const openSheet = (id: ToolboxItemId) => {
    // UX-06: opening the item clears its "New" tag (and its unlock is announced).
    markCareerSeen([toolboxNewKey(id)]);
    markCareerAnnounced([toolboxNewKey(id)]);
    setSheetId(id);
  };

  const close = () => {
    // Closing the announcement marks it announced; the "New" tag stays until the item is opened.
    if (!sheetId && announce) markCareerAnnounced([toolboxNewKey(announce)]);
    setSheetId(null);
  };

  const buy = () => {
    if (!sheet) return;
    markCareerSeen([toolboxNewKey(sheet.id)]);
    markCareerAnnounced([toolboxNewKey(sheet.id)]);
    if (sheet.kind === "gear") buyGear(sheet.id as Parameters<typeof buyGear>[0]);
    else if (sheet.kind === "bootcamp") runBootcamp();
    else setPsychologist(true);
    setSheetId(null);
  };

  const noteOf = (item: ToolboxItem): string | null => {
    if (item.status === "used") return C.toolbox.used;
    if (item.status === "queued") {
      const blocker = gearBlockerOf(save, item.id);
      return blocker ? C.toolbox.after(toolboxNameOf(C, blocker)) : null;
    }
    return null;
  };

  return (
    <Panel className="rise-in p-4" style={{ animationDelay: "150ms" }}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="kicker text-[10px]">{L.title}</p>
        <span className="rounded-full border border-orange/40 bg-orange/10 px-2 py-0.5 text-[10px] font-bold text-orange-bright">
          {L.rep(rep)}
        </span>
      </div>

      <LadderStrip rungs={rungs} C={C} />

      {/* The next rung: icon, name, what it opens, the reputation bar. */}
      {next ? (
        <div className="mt-1 flex items-center gap-3 rounded-xl border border-orange/40 bg-orange/[0.05] p-3 shadow-[0_0_20px_-10px_rgba(249,115,22,0.6)]">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange/15 text-orange-bright">
            <RungIcon id={next.id} className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="kicker !text-[9px] text-orange-bright">{L.next}</p>
            <p className="truncate text-sm font-bold text-ink">{L.rung[next.id]}</p>
            <ProgressBar value={save.reputation / next.gate} tone="orange" className="mt-1.5" label={L.next} />
          </div>
          <span className="shrink-0 text-[10px] font-semibold text-faint">{L.progress(rep, next.gate)}</span>
        </div>
      ) : (
        <p className="mt-1 text-center text-xs font-semibold text-orange-bright">{L.top}</p>
      )}

      {active.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {active.map((i) => (
            <span key={i.id} className="inline-flex items-center gap-1.5 rounded-full border border-good/40 bg-good/10 px-2.5 py-1 text-[11px] font-semibold text-good">
              <RungIcon id={rungOfItem(i.id)} className="h-3.5 w-3.5" />
              {toolboxNameOf(C, i.id)} · {durationOf(C, i)}
            </span>
          ))}
        </div>
      ) : null}

      {toBuy.length > 0 ? (
        <>
          <p className="kicker mb-1.5 mt-3 !text-[9px]">{L.toBuy}</p>
          <ul className="grid grid-cols-2 gap-2">
            {toBuy.map((i) => {
              const note = noteOf(i);
              const isNew = summary.keys.has(toolboxNewKey(i.id));
              return (
                <li key={i.id}>
                  <button
                    type="button"
                    onClick={() => openSheet(i.id)}
                    disabled={ended}
                    className={cx(
                      "relative flex min-h-11 w-full flex-col items-center gap-1 rounded-xl border p-2.5 text-center transition-colors disabled:opacity-50",
                      i.status === "buyable"
                        ? "border-orange/50 bg-orange/[0.06] hover:bg-orange/10"
                        : "border-line bg-white/[0.02] hover:border-line-strong",
                    )}
                  >
                    {isNew ? (
                      <span className="absolute right-1.5 top-1.5">
                        <NewTag>{C.toolbox.newTag}</NewTag>
                      </span>
                    ) : null}
                    <span className={cx("flex h-9 w-9 items-center justify-center rounded-lg", i.status === "buyable" ? "bg-orange/15 text-orange-bright" : "bg-white/5 text-faint")}>
                      <RungIcon id={rungOfItem(i.id)} className="h-5 w-5" />
                    </span>
                    <span className="line-clamp-2 text-xs font-semibold leading-tight text-ink">{toolboxNameOf(C, i.id)}</span>
                    <span className="text-xs font-bold text-orange-bright">{priceOf(C, i)}</span>
                    {note ? <span className="text-[10px] text-faint">{note}</span> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      ) : null}

      <AppLink href="/career/finances" className="mt-2 flex min-h-11 items-center justify-end text-xs font-semibold text-blue-bright hover:underline">
        {L.finances} →
      </AppLink>

      {/* rc.35: one visual modal — the item, its icon, benefits, price; Buy and Close. */}
      <Modal
        open={Boolean(sheet)}
        title={sheet ? toolboxNameOf(C, sheet.id) : ""}
        onClose={close}
        actions={
          <>
            <Button variant="ghost" className="min-h-11" onClick={close}>
              {C.toolbox.close}
            </Button>
            <Button variant="primary" className="min-h-11" disabled={Boolean(refusal)} onClick={buy}>
              {sheet?.kind === "psychologist" ? C.toolbox.hire : C.toolbox.buy}
            </Button>
          </>
        }
      >
        {sheet ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border-2 border-orange/50 bg-gradient-to-br from-orange/25 to-orange/5 text-orange-bright shadow-[0_0_28px_-8px_rgba(249,115,22,0.7)]">
                <RungIcon id={rungOfItem(sheet.id)} className="h-9 w-9" />
              </span>
              <div className="min-w-0 flex-1">
                {!sheetId ? <p className="kicker !text-[9px] text-orange-bright">{C.toolbox.unlockKicker}</p> : null}
                <p className="display text-2xl font-bold leading-none text-ink">{priceOf(C, sheet)}</p>
                {sheet.kind === "gear" && sheet.price < sheet.listPrice ? (
                  <p className="mt-1 text-[11px] text-faint">
                    <s>{formatMoney(sheet.listPrice, { compact: true })}</s> · {C.toolbox.discount(Math.round((1 - sheet.price / sheet.listPrice) * 100))}
                  </p>
                ) : null}
                <p className="mt-1 text-[11px] text-sub">{durationOf(C, sheet)}</p>
              </div>
            </div>

            <div>
              <p className="kicker mb-1.5 !text-[9px]">{C.toolbox.benefits}</p>
              <ul className="flex flex-wrap gap-1.5">
                {benefitsOf(C, sheet).map((b) => (
                  <li key={b} className="rounded-full border border-good/40 bg-good/10 px-2.5 py-1 text-xs font-semibold text-good">
                    {b}
                  </li>
                ))}
                {sheet.kind === "gear" && sheet.weekly > 0 ? (
                  <li className="rounded-full border border-line px-2.5 py-1 text-xs text-faint">
                    {C.toolbox.upkeep(formatMoney(sheet.weekly, { compact: true }))}
                  </li>
                ) : null}
              </ul>
            </div>

            {after ? (
              <p className={cx("text-[11px]", after.balance < 0 ? "text-bad" : "text-faint")}>
                {C.toolbox.afterLine(
                  formatMoney(after.balance, { compact: true }),
                  after.runway === null ? C.finances.runwayOk : C.finances.runway(after.runway),
                )}
              </p>
            ) : null}
            {refusal ? (
              <p role="alert" className="rounded-lg border border-bad/40 bg-bad/10 px-3 py-2 text-xs text-bad">
                {refusalText(C, refusal)}
              </p>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </Panel>
  );
}
