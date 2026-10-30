"use client";

/**
 * Road to Worlds hub — THE TOOLBOX (rc.34, ROADMAP UX-01f / UX-06a;
 * HQ-CONTRACT H6, decisions 5-A and 7-A). What is running (the bootcamp and
 * its end date — 5-A: it lasts the split), what is owned, and the next buys,
 * each with its price (the sponsor discount or free run), effect and
 * duration. A buy opens a confirm sheet on HQ (7-A: price, effect, duration,
 * the balance and runway after) that calls the same flows Finances does
 * (buyGear / runBootcamp / setPsychologist); a refusal says why (the flow's
 * own answer, store/careerHq.toolboxRefusalOf). The full ladder stays in
 * Finances.
 *
 * UX-06a: an item unlocked to buy (≠ bought) carries the "New" tag until its
 * sheet is opened, and HQ announces each novelty ONCE in a centred modal
 * (`toolboxUnannouncedOf`; "Later" keeps the tag, "See it" opens the sheet).
 */

import { useMemo, useState } from "react";
import type { CareerCopy } from "@/content/careerCopy";
import { careerNewSummary, toolboxNewKey, toolboxUnannouncedOf, type ToolboxItemId } from "@/engine/career/careerNew";
import type { CareerSave } from "@/engine/career/types";
import { formatMoney } from "@/lib/format";
import { cx } from "@/lib/util";
import { useCareerStore } from "@/store/careerStore";
import { toolboxAfterOf, toolboxOf, toolboxRefusalOf, gearBlockerOf, type ToolboxItem } from "@/store/careerHq";
import { dateOfDay } from "@/components/career/careerUi";
import { formatDateShort } from "@/components/career/dateText";
import { AppLink } from "@/components/ui/AppLink";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { NewTag } from "@/components/ui/NewDot";
import { Panel } from "@/components/ui/Panel";

export function toolboxNameOf(C: CareerCopy, id: ToolboxItemId): string {
  if (id === "bootcamp1") return C.finances.bootcampT1;
  if (id === "bootcamp2") return C.finances.bootcampT2;
  if (id === "psych") return C.finances.psychologist;
  return C.finances.gear[id];
}

function effectOf(C: CareerCopy, item: ToolboxItem): string {
  const parts: string[] = [];
  if (item.trainingPct) parts.push(C.toolbox.training(item.trainingPct));
  if (item.buffLevels) parts.push(C.toolbox.buff(item.buffLevels));
  if (item.ratingEdge) parts.push(C.toolbox.rating(item.ratingEdge.toFixed(1)));
  if (item.chemistry) parts.push(C.toolbox.chemistry);
  if (item.stats) parts.push(C.toolbox.stats);
  return parts.join(" · ");
}

function durationOf(C: CareerCopy, item: ToolboxItem): string {
  const d = item.duration;
  if (d.kind === "permanent") return C.toolbox.permanent;
  if (d.kind === "weekly") return C.toolbox.weekly(formatMoney(item.weekly, { compact: true }));
  if (d.kind === "nextEvent") return C.toolbox.nextEvent;
  return C.toolbox.until(formatDateShort(C.dates, dateOfDay(d.seasonIndex, d.day)));
}

function priceOf(C: CareerCopy, item: ToolboxItem): string {
  if (item.kind === "psychologist") return C.toolbox.weekly(formatMoney(item.weekly, { compact: true }));
  if (item.free) return C.toolbox.free;
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

  const items = useMemo(() => toolboxOf(save), [save]);
  const summary = useMemo(() => careerNewSummary(save), [save]);
  const unannounced = useMemo(() => toolboxUnannouncedOf(save, summary), [save, summary]);
  const sheet = sheetId ? (items.find((i) => i.id === sheetId) ?? null) : null;
  const refusal = useMemo(() => (sheet ? toolboxRefusalOf(save, sheet.id) : null), [save, sheet]);
  const after = sheet ? toolboxAfterOf(save, sheet) : null;

  const active = items.filter((i) => i.status === "active");
  const owned = items.filter((i) => i.status === "owned");
  const toBuy = items.filter((i) => i.status === "buyable" || i.status === "used" || i.status === "queued");
  const nextLocked = items.filter((i) => i.status === "locked").sort((a, b) => a.repGate - b.repGate)[0] ?? null;
  const ended = save.phase === "ended";

  const openSheet = (id: ToolboxItemId) => {
    // UX-06: opening the item clears its "New" tag (and its unlock is announced).
    markCareerSeen([toolboxNewKey(id)]);
    markCareerAnnounced([toolboxNewKey(id)]);
    setSheetId(id);
  };

  const confirm = () => {
    if (!sheet) return;
    if (sheet.kind === "gear") buyGear(sheet.id as Parameters<typeof buyGear>[0]);
    else if (sheet.kind === "bootcamp") runBootcamp();
    else setPsychologist(true);
    setSheetId(null);
  };

  const statusLine = (item: ToolboxItem): string | null => {
    if (item.status === "used") return C.toolbox.used;
    if (item.status === "queued") {
      const blocker = gearBlockerOf(save, item.id);
      return blocker ? C.toolbox.after(toolboxNameOf(C, blocker)) : null;
    }
    return null;
  };

  // UX-06a: the first novelty not yet announced — never over the first-visit explainer.
  const announce = !ended && save.flags["seenHub"] && !sheet ? (unannounced[0] ?? null) : null;

  return (
    <Panel className="rise-in p-4" style={{ animationDelay: "150ms" }}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="kicker text-[10px]">{C.toolbox.title}</p>
        <AppLink href="/career/finances" className="inline-flex min-h-11 items-center text-[11px] font-semibold text-blue-bright hover:underline">
          {C.toolbox.open} →
        </AppLink>
      </div>

      {active.length > 0 ? (
        <div className="mb-2">
          <p className="kicker mb-1 !text-[9px] text-orange-bright">{C.toolbox.active}</p>
          {active.map((i) => (
            <p key={i.id} className="text-xs text-ink">
              <span className="font-semibold">{toolboxNameOf(C, i.id)}</span> · {effectOf(C, i)} · {durationOf(C, i)}
            </p>
          ))}
        </div>
      ) : null}

      {owned.length > 0 ? (
        <div className="mb-2">
          <p className="kicker mb-1 !text-[9px]">{C.toolbox.owned}</p>
          <p className="text-xs text-sub">
            {owned.map((i) => `${toolboxNameOf(C, i.id)} (${effectOf(C, i)})`).join(" · ")}
          </p>
        </div>
      ) : null}

      <p className="kicker mb-1 !text-[9px]">{C.toolbox.next}</p>
      {toBuy.length === 0 && !nextLocked ? <p className="text-xs text-faint">{C.toolbox.none}</p> : null}
      <ul className="space-y-1.5">
        {toBuy.map((i) => {
          const note = statusLine(i);
          return (
            <li key={i.id}>
              <button
                type="button"
                onClick={() => openSheet(i.id)}
                disabled={ended}
                className={cx(
                  "flex min-h-11 w-full flex-col rounded-lg border px-3 py-2 text-left transition-colors disabled:opacity-50",
                  i.status === "buyable" ? "border-blue/40 bg-blue/[0.06] hover:bg-blue/10" : "border-line bg-white/[0.02] hover:border-line-strong",
                )}
              >
                <span className="flex w-full items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{toolboxNameOf(C, i.id)}</span>
                  {summary.keys.has(toolboxNewKey(i.id)) ? <NewTag>{C.toolbox.newTag}</NewTag> : null}
                  <span className="shrink-0 text-xs font-semibold text-orange-bright">{priceOf(C, i)}</span>
                </span>
                <span className="text-[11px] text-sub">
                  {effectOf(C, i)} · {durationOf(C, i)}
                  {i.kind === "gear" && i.weekly > 0 ? ` · ${C.toolbox.upkeep(formatMoney(i.weekly, { compact: true }))}` : ""}
                </span>
                {note ? <span className="text-[10px] text-faint">{note}</span> : null}
              </button>
            </li>
          );
        })}
        {nextLocked ? (
          <li className="flex min-h-11 items-center gap-2 rounded-lg border border-dashed border-line px-3 py-2 text-xs text-faint">
            <span className="min-w-0 flex-1 truncate">{toolboxNameOf(C, nextLocked.id)}</span>
            <span className="shrink-0">{C.toolbox.lockedRep(nextLocked.repGate)}</span>
          </li>
        ) : null}
      </ul>

      {/* 7-A: the confirm sheet — price, effect, duration, the balance and runway after. */}
      <Modal
        open={Boolean(sheet)}
        title={sheet ? toolboxNameOf(C, sheet.id) : ""}
        onClose={() => setSheetId(null)}
        actions={
          <>
            <Button variant="ghost" className="min-h-11" onClick={() => setSheetId(null)}>
              {C.common.cancel}
            </Button>
            <Button variant="primary" className="min-h-11" disabled={Boolean(refusal)} onClick={confirm}>
              {sheet?.kind === "psychologist" ? C.toolbox.hire : C.toolbox.buy}
            </Button>
          </>
        }
      >
        {sheet ? (
          <dl className="space-y-2 text-sm">
            <div className="flex gap-3">
              <dt className="kicker w-20 shrink-0 !text-[10px]">{C.toolbox.priceLabel}</dt>
              <dd className="text-ink">
                {priceOf(C, sheet)}
                {sheet.kind === "gear" && sheet.price < sheet.listPrice ? (
                  <span className="ml-2 text-xs text-faint">
                    <s>{formatMoney(sheet.listPrice, { compact: true })}</s> ·{" "}
                    {C.toolbox.discount(Math.round((1 - sheet.price / sheet.listPrice) * 100))}
                  </span>
                ) : null}
              </dd>
            </div>
            <div className="flex gap-3">
              <dt className="kicker w-20 shrink-0 !text-[10px]">{C.toolbox.effectLabel}</dt>
              <dd className="text-ink">
                {effectOf(C, sheet)}
                {sheet.kind === "gear" && sheet.weekly > 0 ? (
                  <span className="block text-xs text-faint">{C.toolbox.upkeep(formatMoney(sheet.weekly, { compact: true }))}</span>
                ) : null}
              </dd>
            </div>
            <div className="flex gap-3">
              <dt className="kicker w-20 shrink-0 !text-[10px]">{C.toolbox.durationLabel}</dt>
              <dd className="text-ink">{durationOf(C, sheet)}</dd>
            </div>
            {after ? (
              <div className="flex gap-3">
                <dt className="kicker w-20 shrink-0 !text-[10px]">{C.toolbox.afterLabel}</dt>
                <dd className={cx(after.balance < 0 ? "text-bad" : "text-ink")}>
                  {C.toolbox.afterLine(
                    formatMoney(after.balance, { compact: true }),
                    after.runway === null ? C.finances.runwayOk : C.finances.runway(after.runway),
                  )}
                </dd>
              </div>
            ) : null}
            {refusal ? (
              <p role="alert" className="rounded-lg border border-bad/40 bg-bad/10 px-3 py-2 text-xs text-bad">
                {refusalText(C, refusal)}
              </p>
            ) : null}
          </dl>
        ) : null}
      </Modal>

      {/* UX-06a: once per novelty — unlocked to buy is not bought. */}
      <Modal
        open={Boolean(announce)}
        title={C.toolbox.unlockTitle}
        onClose={() => announce && markCareerAnnounced([toolboxNewKey(announce)])}
        actions={
          <>
            <Button variant="primary" className="min-h-11" onClick={() => announce && openSheet(announce)}>
              {C.toolbox.unlockSee}
            </Button>
            <Button variant="ghost" className="min-h-11" onClick={() => announce && markCareerAnnounced([toolboxNewKey(announce)])}>
              {C.toolbox.unlockLater}
            </Button>
          </>
        }
      >
        {announce ? <p className="text-sm text-ink">{C.toolbox.unlockBody(toolboxNameOf(C, announce))}</p> : null}
      </Modal>
    </Panel>
  );
}
