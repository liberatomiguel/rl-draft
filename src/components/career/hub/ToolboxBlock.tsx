"use client";

/** HQ progression: three compact item rows, purchases and next unlock below.
 * Item details and the full ladder open only on request. Unlocks use the
 * existing career notification/inbox, without an automatic purchase sheet. */

import { useMemo, useState } from "react";
import type { CareerCopy } from "@/content/careerCopy";
import { toolboxNewKey, type ToolboxItemId } from "@/engine/career/careerNew";
import { ladderOf, type LadderRungId } from "@/engine/career/ladder";
import type { CareerSave } from "@/engine/career/types";
import { formatMoney } from "@/lib/format";
import { cx } from "@/lib/util";
import { useCareerStore } from "@/store/careerStore";
import { toolboxAfterOf, toolboxOf, toolboxRefusalOf, gearBlockerOf, type ToolboxItem } from "@/store/careerHq";
import { dateOfDay } from "@/components/career/careerUi";
import { formatDateShort } from "@/components/career/dateText";
import { LadderGrid, RungIcon } from "@/components/career/ladder/LadderParts";
import { AppLink } from "@/components/ui/AppLink";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Panel } from "@/components/ui/Panel";
import { ProgressBar } from "@/components/ui/ProgressBar";

export function toolboxNameOf(C: CareerCopy, id: ToolboxItemId): string {
  if (id === "bootcamp1") return C.finances.bootcampT1;
  if (id === "bootcamp2") return C.finances.bootcampT2;
  if (id === "psych") return C.finances.psychologist;
  return C.finances.gear[id];
}

const rungOfItem = (id: ToolboxItemId): LadderRungId => (id === "psych" ? "psychologist" : id);

/**
 * rc.36: rungs on HQ's track (layout, not tuning): the last one reached, the
 * next and the one after. rc.35's five gave each name ~50 px at 360 px and
 * PT's long words ("Patrocinadores", "performance") ran into the next; at
 * three every EN and PT name fits its column on two lines. The whole ladder
 * is "See more".
 */
const HQ_LADDER_WINDOW = 3;

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
  const [ladderOpen, setLadderOpen] = useState(false);
  const L = C.ladder;

  const items = useMemo(() => toolboxOf(save), [save]);
  const rungs = useMemo(() => ladderOf(save), [save]);
  const ended = save.phase === "ended";

  const sheet = sheetId ? (items.find((i) => i.id === sheetId) ?? null) : null;
  const refusal = useMemo(() => (sheet ? toolboxRefusalOf(save, sheet.id) : null), [save, sheet]);
  const after = sheet ? toolboxAfterOf(save, sheet) : null;

  const reached = rungs.reduce((latest, rung, index) => rung.status !== "locked" ? index : latest, -1);
  const windowStart = Math.max(0, Math.min(Math.max(0, reached - 1), rungs.length - HQ_LADDER_WINDOW));
  const visibleRungs = rungs.slice(windowStart, windowStart + HQ_LADDER_WINDOW);
  const active = items.filter((i) => i.status === "active");
  const next = rungs.find((r) => r.status === "locked") ?? null;
  const rep = Math.round(save.reputation);

  const openSheet = (id: ToolboxItemId) => {
    // UX-06: opening the item clears its "New" tag (and its unlock is announced).
    markCareerSeen([toolboxNewKey(id)]);
    markCareerAnnounced([toolboxNewKey(id)]);
    setSheetId(id);
  };

  const close = () => {
    setSheetId(null);
  };

  const purchase = (sheet: ToolboxItem) => {
    markCareerSeen([toolboxNewKey(sheet.id)]);
    markCareerAnnounced([toolboxNewKey(sheet.id)]);
    if (sheet.kind === "gear") buyGear(sheet.id as Parameters<typeof buyGear>[0]);
    else if (sheet.kind === "bootcamp") runBootcamp();
    else setPsychologist(true);
    setSheetId(null);
  };

  const buy = () => { if (sheet) purchase(sheet); };

  const noteOf = (item: ToolboxItem): string | null => {
    if (item.status === "used") return C.toolbox.used;
    if (item.status === "queued") {
      const blocker = gearBlockerOf(save, item.id);
      return blocker ? C.toolbox.after(toolboxNameOf(C, blocker)) : null;
    }
    return null;
  };

  return (
    <Panel id="career-progression" className="rise-in scroll-mt-24 p-4" style={{ animationDelay: "150ms" }}>
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <p className="kicker text-[10px]">{L.title}</p>
        <span className="rounded-full border border-orange/35 bg-orange/10 px-2.5 py-0.5 text-[10px] font-semibold text-orange-bright">
          {L.rep(rep)}
        </span>
      </div>

      <ul className="space-y-2">
        {visibleRungs.map((rung) => {
          const item = items.find((i) => rungOfItem(i.id) === rung.id);
          const canBuy = item?.status === "buyable" && !toolboxRefusalOf(save, item.id) && !ended;
          const note = item ? noteOf(item) : null;
          return (
            <li key={rung.id} className={cx("flex min-h-16 items-center gap-3 rounded-lg border px-3 py-2.5", rung.status === "locked" ? "border-orange/10 bg-orange/[0.015]" : "border-orange/25 bg-orange/[0.035]")}>
              <RungIcon id={rung.id} className={cx("h-5 w-5 shrink-0", rung.status === "locked" ? "text-orange/45" : "text-orange-bright")} />
              <div className="min-w-0 flex-1">
                {item && rung.status !== "locked" ? (
                  <button type="button" onClick={() => openSheet(item.id)} className="text-left text-xs font-semibold text-ink hover:underline">{toolboxNameOf(C, item.id)}</button>
                ) : <p className="text-xs font-semibold text-sub">{L.rung[rung.id]}</p>}
                <p className="mt-0.5 text-[10px] text-faint">{rung.status === "locked" ? L.rep(rung.gate) : item ? note ?? priceOf(C, item) : L.rep(rung.gate)}</p>
              </div>
              {item && rung.status !== "locked" ? <Button size="sm" variant={canBuy ? "primary" : "ghost"} className={canBuy ? "shadow-none" : undefined} disabled={!canBuy} onClick={() => purchase(item)}>{item.kind === "psychologist" ? C.toolbox.hire : C.toolbox.buy}</Button> : null}
            </li>
          );
        })}
      </ul>
      {active.length > 0 ? <p className="mt-2 text-[10px] text-faint">{active.map((i) => toolboxNameOf(C, i.id) + " · " + durationOf(C, i)).join(" / ")}</p> : null}
      {next ? (
        <div className="mt-3 border-t border-line pt-3">
          <div className="flex justify-between gap-2 text-[10px] text-faint"><span>{L.next}</span><span>{L.progress(rep, next.gate)}</span></div>
          <p className="mt-1.5 flex items-center gap-2 text-xs font-semibold text-sub"><RungIcon id={next.id} className="h-4 w-4 shrink-0 text-orange-bright" />{L.rung[next.id]}</p>
          <ProgressBar value={save.reputation / next.gate} tone="orange" className="mt-2 h-1" label={L.next} />
        </div>
      ) : <p className="mt-3 text-xs text-sub">{L.top}</p>}

      {/* rc.36: one footer row — the whole ladder (modal) and the way to Finances. */}
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setLadderOpen(true)}
          aria-haspopup="dialog"
          className="inline-flex min-h-11 items-center text-xs font-semibold text-blue-bright hover:underline"
        >
          {L.seeMore}
        </button>
        <AppLink href="/career/finances" className="inline-flex min-h-11 items-center text-xs font-semibold text-blue-bright hover:underline">
          {L.finances} →
        </AppLink>
      </div>

      <Modal
        open={ladderOpen}
        title={L.title}
        onClose={() => setLadderOpen(false)}
        wide
        actions={
          <Button variant="secondary" className="min-h-11" onClick={() => setLadderOpen(false)}>
            {C.toolbox.close}
          </Button>
        }
      >
        <LadderGrid rungs={rungs} C={C} />
      </Modal>

      {/* rc.35: one visual modal — the item, its icon, benefits, price; Buy and Close. */}
      <Modal
        open={Boolean(sheet)}
        title={sheet ? toolboxNameOf(C, sheet.id) : ""}
        onClose={close}
        actions={
          <>
            <Button variant="primary" className="min-h-11 shadow-none" disabled={Boolean(refusal) || ended} onClick={buy}>
              {sheet?.kind === "psychologist" ? C.toolbox.hire : C.toolbox.buy}
            </Button>
            <Button variant="ghost" className="min-h-11" onClick={close}>
              {C.toolbox.close}
            </Button>
          </>
        }
      >
        {sheet ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-orange/35 bg-orange/10 text-orange-bright">
                <RungIcon id={rungOfItem(sheet.id)} className="h-6 w-6" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="mt-1 display text-2xl font-bold leading-none text-ink">{priceOf(C, sheet)}</p>
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
              <ul className="space-y-1.5 rounded-lg border border-line bg-white/[0.025] p-3">
                {benefitsOf(C, sheet).map((b) => (
                  <li key={b} className="text-xs font-medium text-orange-bright">
                    {b}
                  </li>
                ))}
                {sheet.kind === "gear" && sheet.weekly > 0 ? (
                  <li className="text-xs text-faint">
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
