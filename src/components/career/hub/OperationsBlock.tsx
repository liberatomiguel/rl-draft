"use client";

/**
 * v2.2 rc.6 (ORGMODE UI-C): HQ's Operations section for an established org,
 * in place of the founded club's progression ladder (ToolboxBlock).
 * rc9 ORG-UI (#274): read from the org catalogue (`orgOperationsOf`): the two
 * facilities with their level, the departments staffed, and the next upgrade
 * (the cheapest facility level still to build), its price and whether the
 * board signs it now. Building it is the store's founded action the catalogue
 * maps onto; everything else opens Finances.
 */

import type { CareerCopy } from "@/content/careerCopy";
import type { GearItemId } from "@/engine/career/economy";
import { nextLevelGearOf, orgOperationsOf } from "@/engine/career/orgCatalogue";
import type { CareerSave } from "@/engine/career/types";
import { formatMoney } from "@/lib/format";
import { cx } from "@/lib/util";
import { useCareerStore } from "@/store/careerStore";
import { backerLineOf, gearRefusalOf } from "@/store/careerFlow";
import { nextUpgradeOf, orgItemNameOf, staffedNamesOf } from "@/components/career/finances/operationsView";
import { RAIL_HEAD, RAIL_TITLE } from "@/components/career/hub/hubShared";
import { AppLink } from "@/components/ui/AppLink";
import { Button } from "@/components/ui/Button";

const money = (n: number) => formatMoney(n, { compact: true });

/** The next upgrade and what stands in its way, in one line (also HQ's phone row). */
export function nextPurchaseLineOf(save: CareerSave, C: CareerCopy): { id: GearItemId | null; name: string | null; price: number | null; line: string; tone: "good" | "sub" | "warn"; canBuy: boolean } {
  const O = C.orgmode.ops;
  const ops = orgOperationsOf(save, { floor: backerLineOf(save).floor });
  const f = ops ? nextUpgradeOf(ops) : null;
  if (!ops || !f || !f.next) return { id: null, name: null, price: null, line: O.allOwned, tone: "sub", canBuy: false };
  const gear = nextLevelGearOf(save.finances.gear, f.id);
  const name = C.orgmode.org.levelName(orgItemNameOf(C, f.id), f.next.level);
  const refusal = save.phase === "ended" ? "blocked" : gear ? gearRefusalOf(save, gear) : "maxed";
  const next = f.next;
  const line =
    next.state === "needsApproval" && next.confidence !== null ? O.needs(next.confidence, Math.round(save.board?.confidence ?? 0))
    : next.state === "frozen" ? O.frozen
    : next.state === "cantAfford" || refusal === "funds" ? O.cantAfford
    : refusal ? C.toolbox.refusal.other
    : O.signs;
  const tone = !refusal && next.state === "available" ? "good" : next.state === "needsApproval" || next.state === "frozen" ? "warn" : "sub";
  return { id: gear, name, price: next.price, line, tone, canBuy: !refusal && next.state === "available" };
}

/** The structure's weekly cost (HQ's phone row). */
export function orgRunningWeeklyOf(save: CareerSave): number | null {
  return orgOperationsOf(save, { floor: backerLineOf(save).floor })?.runningWeekly ?? null;
}

export function OperationsBlock({ save, C }: { save: CareerSave; C: CareerCopy }) {
  const buyGear = useCareerStore((s) => s.buyGear);
  const ops = orgOperationsOf(save, { floor: backerLineOf(save).floor });
  if (!ops) return null;
  const O = C.orgmode.ops;
  const G = C.orgmode.org;
  const staffed = staffedNamesOf(C, ops);
  const np = nextPurchaseLineOf(save, C);

  const running: { key: string; label: string; value: string }[] = [
    ...ops.facilities.map((f) => ({ key: f.id, label: orgItemNameOf(C, f.id), value: f.level > 0 ? G.level(f.level, f.maxLevel) : G.notBuilt })),
    { key: "staff", label: O.dept.staff, value: staffed.length ? String(staffed.length) : O.staffNone },
  ];

  return (
    <div id="career-progression" className="scroll-mt-24">
      <div className={RAIL_HEAD}>
        <h3 className={RAIL_TITLE}>{O.title}</h3>
        <span className="text-xs text-sub">{O.perWeek(money(ops.runningWeekly))}</span>
      </div>

      <dl className="border-t border-line">
        {running.map((r) => (
          <div key={r.key} className="flex min-h-11 items-center justify-between gap-3 border-b border-line py-2">
            <dt className="min-w-0 truncate text-sm text-ink">{r.label}</dt>
            <dd className="shrink-0 text-right text-xs text-sub">{r.value}</dd>
          </div>
        ))}
      </dl>

      {np.name ? (
        <div className="mt-3 flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-faint">{O.next}</p>
            <p className="truncate text-sm font-semibold text-ink">
              {np.name} <span className="tabular-nums text-sub">· {money(np.price ?? 0)}</span>
            </p>
            <p className={cx("mt-0.5 text-xs leading-snug", np.tone === "good" ? "text-good" : np.tone === "warn" ? "text-orange-bright" : "text-sub")}>{np.line}</p>
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
