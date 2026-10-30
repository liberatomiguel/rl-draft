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
 * rc.36 (POL-02, Miguel on rc.35): less white space, one hierarchy — the
 * next unlock is the card's lead, the items to buy are compact icon rows
 * (no orphan tiles), "See more" and "Finances" share one footer row and the
 * whole ladder opens in a modal (the card never grows). The unlock
 * announcement only informs: Close, no Buy; a row tapped on purpose keeps
 * Buy (Gate 3a decision 7-A, buying in HQ).
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
import { LadderGrid, LadderStrip, RungIcon } from "@/components/career/ladder/LadderParts";
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
  const summary = useMemo(() => careerNewSummary(save), [save]);
  const unannounced = useMemo(() => toolboxUnannouncedOf(save, summary), [save, summary]);
  const ended = save.phase === "ended";

  // UX-06a: the first novelty not yet announced — never over the first-visit explainer (or the ladder).
  const announce = !ended && save.flags["seenHub"] && !sheetId && !ladderOpen ? (unannounced[0] ?? null) : null;
  const modalId = sheetId ?? announce;
  // rc.36: the announcement informs (Close only); Buy is for a row the manager opened.
  const announcing = !sheetId && Boolean(announce);
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
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <p className="kicker text-[10px]">{L.title}</p>
        <span className="rounded-full border border-orange/40 bg-orange/10 px-2 py-0.5 text-[10px] font-bold text-orange-bright">
          {L.rep(rep)}
        </span>
      </div>

      {/* rc.36: the card's lead — the next rung: icon, name, the reputation bar and how far. */}
      {next ? (
        <div className="flex items-center gap-3 rounded-xl border border-orange/40 bg-orange/[0.05] px-3 py-2.5 shadow-[0_0_20px_-10px_rgba(249,115,22,0.6)]">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange/15 text-orange-bright">
            <RungIcon id={next.id} className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex items-baseline justify-between gap-2">
              <span className="kicker truncate !text-[9px] text-orange-bright">{L.next}</span>
              <span className="shrink-0 text-[10px] font-semibold text-faint">{L.progress(rep, next.gate)}</span>
            </p>
            <p className="truncate text-sm font-bold text-ink">{L.rung[next.id]}</p>
            <ProgressBar value={save.reputation / next.gate} tone="orange" className="mt-1.5 h-1.5" label={L.next} />
          </div>
        </div>
      ) : (
        <p className="rounded-xl border border-orange/40 bg-orange/[0.05] px-3 py-2.5 text-center text-xs font-semibold text-orange-bright">{L.top}</p>
      )}

      {/* The road around it (the whole ladder: "See more"). */}
      <div className="mt-3">
        <LadderStrip rungs={rungs} C={C} size={HQ_LADDER_WINDOW} />
      </div>

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

      {/* rc.36: the items to buy as compact icon rows — name, "New", why it waits, the price. */}
      {toBuy.length > 0 ? (
        <>
          <p className="kicker mb-1.5 mt-3 !text-[9px]">{L.toBuy}</p>
          <ul className="space-y-1.5">
            {toBuy.map((i) => {
              const note = noteOf(i);
              const isNew = summary.keys.has(toolboxNewKey(i.id));
              const buyable = i.status === "buyable";
              return (
                <li key={i.id}>
                  <button
                    type="button"
                    onClick={() => openSheet(i.id)}
                    disabled={ended}
                    className="flex min-h-12 w-full items-center gap-2.5 rounded-lg border border-line bg-white/[0.02] px-2.5 py-1.5 text-left transition-colors hover:border-line-strong disabled:opacity-50"
                  >
                    <span
                      className={cx(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
                        buyable ? "bg-orange/15 text-orange-bright" : "bg-white/5 text-faint",
                      )}
                    >
                      <RungIcon id={rungOfItem(i.id)} className="h-[18px] w-[18px]" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate text-xs font-semibold text-ink">{toolboxNameOf(C, i.id)}</span>
                        {isNew ? <NewTag className="shrink-0">{C.toolbox.newTag}</NewTag> : null}
                      </span>
                      {note ? <span className="block truncate text-[10px] text-faint">{note}</span> : null}
                    </span>
                    <span className={cx("shrink-0 text-xs font-bold", buyable ? "text-orange-bright" : "text-faint")}>{priceOf(C, i)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      ) : null}

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
          announcing ? (
            // rc.36 (Miguel on rc.35): the unlock announcement only informs — Close, no Buy.
            <Button variant="secondary" className="min-h-11" onClick={close}>
              {C.toolbox.close}
            </Button>
          ) : (
            <>
              <Button variant="ghost" className="min-h-11" onClick={close}>
                {C.toolbox.close}
              </Button>
              <Button variant="primary" className="min-h-11" disabled={Boolean(refusal)} onClick={buy}>
                {sheet?.kind === "psychologist" ? C.toolbox.hire : C.toolbox.buy}
              </Button>
            </>
          )
        }
      >
        {sheet ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border-2 border-orange/50 bg-gradient-to-br from-orange/25 to-orange/5 text-orange-bright shadow-[0_0_28px_-8px_rgba(249,115,22,0.7)]">
                <RungIcon id={rungOfItem(sheet.id)} className="h-9 w-9" />
              </span>
              <div className="min-w-0 flex-1">
                {announcing ? <p className="kicker !text-[9px] text-orange-bright">{C.toolbox.unlockKicker}</p> : null}
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

            {announcing ? (
              // Unlocked is not bought (UX-06a): where it waits.
              <p className="text-[11px] text-sub">{C.toolbox.unlockNote}</p>
            ) : after ? (
              <p className={cx("text-[11px]", after.balance < 0 ? "text-bad" : "text-faint")}>
                {C.toolbox.afterLine(
                  formatMoney(after.balance, { compact: true }),
                  after.runway === null ? C.finances.runwayOk : C.finances.runway(after.runway),
                )}
              </p>
            ) : null}
            {refusal && !announcing ? (
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
