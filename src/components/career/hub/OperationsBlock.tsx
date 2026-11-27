"use client";

/**
 * v2.2 rc.6 (ORGMODE UI-C): HQ's Operations section for an established org,
 * in place of the founded club's progression ladder (ToolboxBlock).
 *
 * The org has nothing to unlock, so the section shows what is running (one
 * row per department) and the next sensible purchase: the first installation
 * the org lacks, its price and whether the board signs it now. Buying it is
 * the same store action the ladder used; everything else opens Finances.
 */

import type { CareerCopy } from "@/content/careerCopy";
import { gateRepOf, operationsOf } from "@/engine/career/established";
import type { GearItemId } from "@/engine/career/economy";
import type { CareerSave } from "@/engine/career/types";
import { formatMoney } from "@/lib/format";
import { cx } from "@/lib/util";
import { useCareerStore } from "@/store/careerStore";
import { backerLineOf, gearRefusalOf } from "@/store/careerFlow";
import { dateOfDay } from "@/components/career/careerUi";
import { formatDateTiny } from "@/components/career/dateText";
import { campsShown, nextPurchaseOf, opsNameOf, opsRungOf, runningCostOf } from "@/components/career/finances/operationsView";
import { RAIL_HEAD, RAIL_TITLE } from "@/components/career/hub/hubShared";
import { RungIcon } from "@/components/career/ladder/LadderParts";
import { AppLink } from "@/components/ui/AppLink";
import { Button } from "@/components/ui/Button";

const money = (n: number) => formatMoney(n, { compact: true });

/** The next purchase and what stands in its way, in one line (also HQ's phone row). */
export function nextPurchaseLineOf(save: CareerSave, C: CareerCopy): { id: GearItemId | null; name: string | null; line: string; tone: "good" | "sub" | "warn"; canBuy: boolean } {
  const O = C.orgmode.ops;
  const ops = operationsOf(save, { floor: backerLineOf(save).floor });
  const next = ops ? nextPurchaseOf(ops) : null;
  if (!ops || !next) return { id: null, name: null, line: O.allOwned, tone: "sub", canBuy: false };
  const name = opsNameOf(C, next.id);
  const refusal = save.phase === "ended" ? "blocked" : gearRefusalOf(save, next.id as GearItemId);
  const line =
    next.state === "needsApproval" && next.confidence !== null ? O.needs(next.confidence, Math.round(save.board?.confidence ?? 0))
    : next.state === "frozen" ? O.frozen
    : next.state === "cantAfford" || refusal === "funds" ? O.cantAfford
    : refusal ? C.toolbox.refusal.other
    : O.signs;
  const tone = !refusal && next.state === "available" ? "good" : next.state === "needsApproval" || next.state === "frozen" ? "warn" : "sub";
  return { id: next.id as GearItemId, name, line, tone, canBuy: !refusal && next.state === "available" };
}

export function OperationsBlock({ save, C }: { save: CareerSave; C: CareerCopy }) {
  const buyGear = useCareerStore((s) => s.buyGear);
  const ops = operationsOf(save, { floor: backerLineOf(save).floor });
  if (!ops) return null;
  const O = C.orgmode.ops;
  const owned = ops.facilities.filter((i) => i.state === "owned");
  const retained = ops.staff.filter((i) => i.state === "retained");
  const camp = campsShown(ops, gateRepOf(save))[0];
  const until = save.finances.bootcampUntil;
  const next = nextPurchaseOf(ops);
  const np = nextPurchaseLineOf(save, C);

  const running: { key: string; label: string; value: string; tone?: string }[] = [
    { key: "facilities", label: O.dept.facilities, value: O.facilitiesOwned(owned.length, ops.facilities.length) },
    { key: "staff", label: O.dept.staff, value: retained.length ? retained.map((i) => opsNameOf(C, i.id)).join(", ") : O.staffNone },
    {
      key: "camps",
      label: O.dept.camps,
      value: !camp ? O.campReady : camp.note === "active" ? O.campActive(until ? formatDateTiny(C.dates, dateOfDay(until.seasonIndex, until.day)) : "") : camp.note === "used" ? O.campUsed : O.campReady,
      tone: camp?.note === "active" ? "text-good" : undefined,
    },
  ];

  return (
    <div id="career-progression" className="scroll-mt-24">
      <div className={RAIL_HEAD}>
        <h3 className={RAIL_TITLE}>{O.title}</h3>
        <span className="text-xs font-semibold text-sub">{O.perWeek(money(runningCostOf(ops)))}</span>
      </div>

      <dl className="border-t border-line">
        {running.map((r) => (
          <div key={r.key} className="flex min-h-11 items-baseline justify-between gap-3 border-b border-line py-2">
            <dt className="shrink-0 text-xs text-sub">{r.label}</dt>
            <dd className={cx("min-w-0 truncate text-right text-xs font-semibold", r.tone ?? "text-ink")}>{r.value}</dd>
          </div>
        ))}
      </dl>

      {next ? (
        <div className="mt-3 flex items-center gap-3">
          <RungIcon id={opsRungOf(next.id)} className="h-5 w-5 shrink-0 text-sub" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-faint">{O.next}</p>
            <p className="truncate text-sm font-semibold text-ink">
              {np.name} <span className="tabular-nums text-sub">· {money(next.price)}</span>
            </p>
            <p className={cx("mt-0.5 text-[11px] leading-snug", np.tone === "good" ? "text-good" : np.tone === "warn" ? "text-orange-bright" : "text-sub")}>{np.line}</p>
          </div>
          {np.canBuy && np.id ? (
            <Button size="sm" variant="secondary" onClick={() => buyGear(np.id as GearItemId)}>{O.buy}</Button>
          ) : null}
        </div>
      ) : (
        <p className="mt-3 text-xs text-sub">{O.allOwned}</p>
      )}

      <div className="mt-1.5 flex items-center justify-end gap-2">
        <AppLink href="/career/finances#career-operations" className="inline-flex min-h-11 items-center text-xs font-semibold text-blue-bright hover:underline">
          {O.open}
        </AppLink>
      </div>
    </div>
  );
}
