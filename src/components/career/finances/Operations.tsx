"use client";

/**
 * v2.2 rc.6 (ORGMODE UI-C): an established org's Operations on Finances, in
 * place of the founded club's gear ladder.
 *
 * Nothing here is locked by reputation (spec E2): every installation, staff
 * role and the camp is on the shelf, and the row says what decides it: owned
 * or retained, the board's sign-off with the confidence it needs, a freeze,
 * the money. Three departments in one board, each a list of rows: the name
 * and its state, what it does, the notes (upkeep, the board, what releasing
 * saves) and, on the right, the price over the action. The actions are the
 * store's (buyGear, setStaff, setPsychologist, runBootcamp), the ones the
 * ladder used.
 */

import { useState, type ReactNode } from "react";
import type { CareerCopy } from "@/content/careerCopy";
import { gateRepOf, operationsOf, type OperationItem } from "@/engine/career/established";
import type { GearItemId } from "@/engine/career/economy";
import type { CareerSave, StaffId } from "@/engine/career/types";
import { formatMoney } from "@/lib/format";
import { cx } from "@/lib/util";
import { useCareerStore } from "@/store/careerStore";
import { backerLineOf, bootcampRefusalOf, gearRefusalOf } from "@/store/careerFlow";
import { sponsorFreeBootcampsOf } from "@/engine/career/sponsorDeals";
import { dateOfDay } from "@/components/career/careerUi";
import { formatDateTiny } from "@/components/career/dateText";
import { boardRefusalText } from "@/components/career/hub/hubShared";
import { RungIcon } from "@/components/career/ladder/LadderParts";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { AppLink } from "@/components/ui/AppLink";
import { campsShown, nextPurchaseOf, OPS_DEPTS, opsEffectOf, opsNameOf, opsRungOf, runningCostOf, type OpsDept } from "./operationsView";

const money = (n: number) => formatMoney(n, { compact: true });

function refusalText(C: CareerCopy, key: string): string {
  const r = C.toolbox.refusal;
  return boardRefusalText(C, key) ?? (key === "funds" ? C.orgmode.ops.cantAfford : key in r ? r[key as keyof typeof r] : r.other);
}

function OpsRow({ item, name, state, effect, notes, price, priceTone = "ink", action, quiet }: {
  item: OperationItem;
  name: string;
  state: ReactNode;
  effect: string;
  notes?: ReactNode;
  price?: string | null;
  priceTone?: "ink" | "good" | "quiet";
  action?: ReactNode;
  quiet?: boolean;
}) {
  return (
    <li className="flex flex-col gap-3 border-b border-line py-4 last:border-b-0 sm:flex-row sm:items-start sm:justify-between sm:gap-5">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <RungIcon id={opsRungOf(item.id)} className={cx("h-5 w-5 shrink-0", quiet ? "text-faint" : "text-sub")} />
        <div className="min-w-0 flex-1">
          <h4 className={cx("display flex flex-wrap items-center gap-x-2 gap-y-1 text-base font-bold uppercase leading-tight", quiet ? "text-sub" : "text-ink")}>
            {name}
            {state}
          </h4>
          <p className="mt-1 text-sm leading-snug text-sub">{effect}</p>
          {notes}
        </div>
      </div>
      {price || action ? (
        <div className="flex shrink-0 items-center justify-between gap-3 pl-8 sm:min-w-28 sm:flex-col sm:items-end sm:justify-start sm:gap-2 sm:pl-0">
          {price ? (
            <span className={cx("display text-xl font-bold leading-none tabular-nums", priceTone === "good" ? "text-good" : priceTone === "quiet" ? "text-faint" : "text-ink")}>{price}</span>
          ) : <span />}
          {action}
        </div>
      ) : null}
    </li>
  );
}

const Note = ({ children, tone = "text-faint" }: { children: ReactNode; tone?: string }) => <p className={cx("mt-1 text-xs", tone)}>{children}</p>;

export function OperationsBoard({ save, C, primaryAllowed, className }: { save: CareerSave; C: CareerCopy; primaryAllowed: boolean; className?: string }) {
  const buyGear = useCareerStore((s) => s.buyGear);
  const setStaff = useCareerStore((s) => s.setStaff);
  const setPsychologist = useCareerStore((s) => s.setPsychologist);
  const runBootcamp = useCareerStore((s) => s.runBootcamp);
  const [release, setRelease] = useState<OperationItem | null>(null);

  const ops = operationsOf(save, { floor: backerLineOf(save).floor });
  if (!ops) return null;
  const O = C.orgmode.ops;
  const ended = save.phase === "ended";
  const fin = save.finances;
  const confidence = save.board?.confidence ?? 0;
  const next = nextPurchaseOf(ops);
  const freeLeft = Math.max(0, sponsorFreeBootcampsOf(save.sponsor) - fin.freeBootcampsUsedThisSeason);

  const setRetainer = (id: OperationItem["id"], on: boolean) => {
    if (id === "psychologist") setPsychologist(on);
    else setStaff(id as StaffId, on);
  };

  const facilityRow = (item: OperationItem) => {
    const name = opsNameOf(C, item.id);
    const owned = item.state === "owned";
    const refusal = owned || ended ? null : gearRefusalOf(save, item.id as GearItemId);
    const canBuy = item.state === "available" && !refusal && !ended;
    const primary = primaryAllowed && canBuy && next?.id === item.id;
    const tag =
      owned ? <Badge>{O.state.owned}</Badge>
      : item.state === "needsApproval" ? <Badge tone="orange">{O.state.needsApproval}</Badge>
      : item.state === "frozen" ? <Badge tone="orange">{O.state.frozen}</Badge>
      : item.state === "cantAfford" ? <Badge tone="bad">{O.state.cantAfford}</Badge>
      : null;
    return (
      <OpsRow
        key={item.id}
        item={item}
        name={name}
        state={tag}
        effect={opsEffectOf(C, item.id)}
        quiet={item.state === "needsApproval" || item.state === "frozen"}
        notes={
          <>
            {item.upkeep > 0 ? <Note>{O.upkeep(money(item.upkeep))}</Note> : null}
            {item.state === "needsApproval" && item.confidence !== null ? <Note tone="text-sub">{O.needs(item.confidence, Math.round(confidence))}</Note> : null}
            {item.state === "frozen" ? <Note tone="text-orange-bright">{O.frozen}</Note> : null}
            {item.state === "cantAfford" ? <Note tone="text-sub">{O.cantAfford}</Note> : null}
            {item.state === "available" && item.confidence !== null && !refusal ? <Note tone="text-good">{O.signs}</Note> : null}
            {item.state === "available" && refusal ? <Note tone="text-sub">{refusalText(C, refusal)}</Note> : null}
          </>
        }
        price={owned ? null : money(item.price)}
        priceTone={canBuy ? "ink" : "quiet"}
        action={
          owned || item.state === "needsApproval" || item.state === "frozen" ? null : (
            <Button variant={primary ? "primary" : "secondary"} size="sm" disabled={!canBuy} onClick={() => buyGear(item.id as GearItemId)}>
              {O.buy}
            </Button>
          )
        }
      />
    );
  };

  const staffRow = (item: OperationItem) => {
    const on = item.state === "retained";
    return (
      <OpsRow
        key={item.id}
        item={item}
        name={opsNameOf(C, item.id)}
        state={on ? <Badge tone="good">{O.state.retained}</Badge> : null}
        effect={opsEffectOf(C, item.id)}
        notes={on ? <Note tone="text-sub">{O.saves(money(item.price))}</Note> : null}
        price={O.perWeek(money(item.upkeep))}
        priceTone={on ? "ink" : "ink"}
        action={
          ended ? null : on ? (
            <Button variant="ghost" size="sm" onClick={() => setRelease(item)}>{O.release}</Button>
          ) : (
            <Button variant="secondary" size="sm" onClick={() => setRetainer(item.id, true)}>{O.hire}</Button>
          )
        }
      />
    );
  };

  const campRow = (item: OperationItem) => {
    const refusal = ended ? "blocked" : bootcampRefusalOf(save);
    const free = freeLeft > 0;
    const until = fin.bootcampUntil;
    return (
      <OpsRow
        key={item.id}
        item={item}
        name={opsNameOf(C, item.id)}
        state={item.note === "active" ? <Badge tone="good">{O.campActive(until ? formatDateTiny(C.dates, dateOfDay(until.seasonIndex, until.day)) : "")}</Badge> : item.note === "used" ? <Badge>{O.campUsed}</Badge> : item.state === "cantAfford" && !free ? <Badge tone="bad">{O.state.cantAfford}</Badge> : null}
        effect={opsEffectOf(C, item.id)}
        notes={
          <>
            {free ? <Note tone="text-sub">{C.finances.freeBootcampLeft(freeLeft)}</Note> : null}
            {refusal && refusal !== "used" && !(item.note === "active") ? <Note tone="text-sub">{refusalText(C, refusal)}</Note> : null}
          </>
        }
        price={free ? C.common.free : money(item.price)}
        priceTone={free ? "good" : refusal ? "quiet" : "ink"}
        action={ended ? null : <Button variant="secondary" size="sm" disabled={Boolean(refusal)} onClick={runBootcamp}>{O.run}</Button>}
      />
    );
  };

  const rows: Record<OpsDept, OperationItem[]> = { facilities: ops.facilities, staff: ops.staff, camps: campsShown(ops, gateRepOf(save)) };
  const render: Record<OpsDept, (i: OperationItem) => ReactNode> = { facilities: facilityRow, staff: staffRow, camps: campRow };

  return (
    <section id="career-operations" data-tour="finances-progress" aria-labelledby="career-operations-title" className={cx("panel min-w-0 scroll-mt-20 p-4 sm:p-5", className)}>
      <div className="card-head">
        <div className="min-w-0">
          <h3 id="career-operations-title" className="card-title">{O.title}</h3>
          <p className="mt-1 max-w-prose text-sm normal-case leading-snug tracking-normal text-sub">{O.body}</p>
        </div>
        <p className="shrink-0 text-right">
          <span className="display block text-2xl font-bold leading-none tabular-nums text-ink">{money(runningCostOf(ops))}</span>
          <span className="mt-1 block text-xs text-sub">{O.running}</span>
        </p>
      </div>

      {OPS_DEPTS.map((dept) => (
        <div key={dept} className="mt-5 first-of-type:mt-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-b border-line-strong pb-2">
            <h4 className="display text-sm font-bold uppercase tracking-[0.04em] text-ink">{O.dept[dept]}</h4>
            <p className="text-xs text-sub">{O.deptNote[dept]}</p>
          </div>
          <ol>{rows[dept].map((i) => render[dept](i))}</ol>
        </div>
      ))}

      <Modal
        open={Boolean(release)}
        title={release ? O.releaseTitle(opsNameOf(C, release.id)) : ""}
        onClose={() => setRelease(null)}
        actions={
          <>
            <Button variant="ghost" className="min-h-11" onClick={() => setRelease(null)}>{O.keep}</Button>
            <Button
              variant="secondary"
              className="min-h-11"
              onClick={() => {
                if (release) setRetainer(release.id, false);
                setRelease(null);
              }}
            >
              {O.releaseConfirm}
            </Button>
          </>
        }
      >
        {release ? <p className="text-sm leading-snug text-sub">{O.releaseBody(money(release.price), money(release.upkeep))}</p> : null}
      </Modal>
    </section>
  );
}

/**
 * The Club page's Operations: one row per department (what is in place, as a
 * figure and a line), each opening Finances at the Operations board.
 */
export function OperationsSummary({ save, C, className }: { save: CareerSave; C: CareerCopy; className?: string }) {
  const ops = operationsOf(save, { floor: backerLineOf(save).floor });
  if (!ops) return null;
  const O = C.orgmode.ops;
  const K = C.orgmode.club;
  const owned = ops.facilities.filter((i) => i.state === "owned");
  const retained = ops.staff.filter((i) => i.state === "retained");
  const camp = campsShown(ops, gateRepOf(save))[0];
  const until = save.finances.bootcampUntil;
  const rows: { key: OpsDept; figure: string; line: string; tone?: string }[] = [
    {
      key: "facilities",
      figure: `${owned.length} / ${ops.facilities.length}`,
      line: owned.length ? owned.map((i) => opsNameOf(C, i.id)).join(", ") : O.facilitiesOwned(0, ops.facilities.length),
    },
    { key: "staff", figure: String(retained.length), line: retained.length ? retained.map((i) => opsNameOf(C, i.id)).join(", ") : O.staffNone },
    {
      key: "camps",
      figure: camp ? (camp.note === "active" ? "1" : "0") : "0",
      line: !camp ? O.campReady : camp.note === "active" ? O.campActive(until ? formatDateTiny(C.dates, dateOfDay(until.seasonIndex, until.day)) : "") : camp.note === "used" ? O.campUsed : O.campReady,
      tone: camp?.note === "active" ? "text-good" : undefined,
    },
  ];
  return (
    <section aria-labelledby="club-ops-title" className={cx("panel min-w-0 overflow-hidden", className)}>
      <div className="border-b border-line px-4 py-3 sm:px-5">
        <h3 id="club-ops-title" className="card-title">{K.opsTitle}</h3>
        <p className="mt-1.5 text-sm leading-snug text-sub">{K.opsBody}</p>
      </div>
      <ul>
        {rows.map((r) => (
          <li key={r.key} className="border-b border-line last:border-b-0">
            <AppLink href="/career/finances#career-operations" className="flex min-h-14 items-center gap-3 px-4 py-2.5 transition-colors hover:bg-white/[0.03] sm:px-5">
              <span className="min-w-0 flex-1">
                <span className="display block text-sm font-bold uppercase leading-tight text-ink">{O.dept[r.key]}</span>
                <span className={cx("mt-0.5 block truncate text-xs", r.tone ?? "text-sub")}>{r.line}</span>
              </span>
              <span className="display shrink-0 text-2xl font-bold leading-none tabular-nums text-ink">{r.key === "camps" ? null : r.figure}</span>
              <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-faint" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </AppLink>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-2 sm:px-5">
        <span className="text-xs text-sub">{O.running} · {O.perWeek(money(runningCostOf(ops)))}</span>
        <AppLink href="/career/finances#career-operations" className="inline-flex min-h-11 items-center text-sm font-semibold text-blue-bright hover:underline">
          {K.opsOpen}
        </AppLink>
      </div>
    </section>
  );
}
