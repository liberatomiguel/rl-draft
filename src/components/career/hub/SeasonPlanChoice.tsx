"use client";

/**
 * rc9 HQ (DESIGN-DECISIONS #241): the season plan as HQ's decision. Miguel on
 * rc.8 named the goals screen as careless: three boxes of four bold figures
 * each, every label printed three times. Here it is one choice: three rows of
 * one table, the column heads said once (budget now, bonus if met, the
 * confidence it moves), the board's proposal preselected and tagged, the picked
 * row in the orange hairline, one filled action. On a phone each row keeps its
 * figures on one line with quiet labels.
 *
 * Reads the same flow as the Board page's BoardPackageChoice (pendingPackageOf,
 * chooseBoardPackage); only HQ's presentation lives here.
 */

import { useState } from "react";
import type { CareerCopy } from "@/content/careerCopy";
import { chanceBandOf } from "@/engine/career/board";
import type { BoardPackage, PackageId } from "@/engine/career/boardTypes";
import type { CareerSave } from "@/engine/career/types";
import { formatMoney } from "@/lib/format";
import { cx } from "@/lib/util";
import { useCareerStore } from "@/store/careerStore";
import { pendingPackageOf } from "@/store/boardFlow";
import { BoardBrief, goalText } from "@/components/career/board/BoardParts";
import { DECISION_TITLE } from "@/components/career/hub/hubShared";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

/** The three figure columns from `sm`: the plan takes the rest. */
const COLS = "sm:grid sm:grid-cols-[minmax(0,1fr)_5rem_7rem_7rem] sm:items-center sm:gap-x-4";

function money(n: number): string {
  return n > 0 ? formatMoney(n, { compact: true }) : "–";
}

function PlanRow({ o, active, proposed, onPick, C }: { o: BoardPackage; active: boolean; proposed: string | null; onPick: () => void; C: CareerCopy }) {
  const K = C.board.packages;
  const band = chanceBandOf(o.objective.chance ?? 0);
  const value = active ? "text-ink" : "text-sub";
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onPick}
      className={cx(
        COLS,
        "block w-full rounded-lg border px-3 py-3 text-left transition-colors sm:py-3.5",
        active ? "border-orange/60 bg-white/[0.03]" : "border-transparent hover:border-line-strong",
      )}
    >
      <span className="flex min-w-0 gap-3">
        {/* The radio's own mark: a ring, filled when picked (the state is also the row's hairline). */}
        <span aria-hidden className={cx("mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border", active ? "border-orange" : "border-line-strong")}>
          {active ? <span className="h-2 w-2 rounded-full bg-orange" /> : null}
        </span>
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className={cx("display text-[15px] font-bold leading-tight", value)}>{K.name[o.id]}</span>
            {proposed ? <Badge tone="neutral">{proposed}</Badge> : null}
          </span>
          <span className={cx("mt-1 block text-sm leading-snug", active ? "text-ink" : "text-sub")}>{goalText(C, o.objective)}</span>
          <span className="block text-xs text-faint">{K.band(band)}</span>
        </span>
      </span>
      {/* Phone: the three figures on one line, each with its quiet label; from `sm` they are the columns. */}
      <span className="mt-2 flex flex-wrap gap-x-4 gap-y-1 pl-7 sm:contents">
        <span className="sm:text-right">
          <span className={cx("display text-[15px] font-bold tabular-nums", value)}>{money(o.grant)}</span>
          <span className="ml-1 text-xs text-faint sm:hidden">{K.budgetLabel}</span>
        </span>
        <span className="sm:text-right">
          <span className={cx("display text-[15px] font-bold tabular-nums", value)}>{money(o.bonus)}</span>
          <span className="ml-1 text-xs text-faint sm:hidden">{K.bonusLabel}</span>
        </span>
        <span className="sm:text-right">
          <span className="display text-[15px] font-bold tabular-nums text-good">+{o.hit}</span>
          <span className="text-faint"> / </span>
          <span className="display text-[15px] font-bold tabular-nums text-bad">−{Math.abs(o.miss)}</span>
          <span className="ml-1 text-xs text-faint sm:hidden">{K.confidenceLabel}</span>
        </span>
      </span>
    </button>
  );
}

export function SeasonPlanChoice({ save, C }: { save: CareerSave; C: CareerCopy }) {
  const offers = pendingPackageOf(save);
  const choose = useCareerStore((s) => s.chooseBoardPackage);
  const [pick, setPick] = useState<PackageId>("expected");
  if (!offers) return null;
  const K = C.board.packages;
  const own = save.board?.kind === "owners";
  const chosen = offers.some((o) => o.id === pick) ? pick : offers[0].id;
  return (
    <div>
      <h2 className={DECISION_TITLE}>{K.title}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-snug text-sub">{own ? K.ownersBody : K.body}</p>
      <BoardBrief save={save} C={C} className="mt-4" />
      <div role="radiogroup" aria-label={K.title} className="mt-5">
        <div aria-hidden className={cx(COLS, "hidden px-3 pb-2")}>
          <span />
          <span className="kicker text-right">{K.budgetLabel}</span>
          <span className="kicker text-right">{K.bonusLabel}</span>
          <span className="kicker text-right">{K.confidenceLabel}</span>
        </div>
        <div className="space-y-1 border-t border-line pt-1">
          {offers.map((o) => (
            <PlanRow
              key={o.id}
              o={o}
              C={C}
              active={chosen === o.id}
              proposed={o.id === "expected" ? (own ? K.ownersRecommended : K.recommended) : null}
              onPick={() => setPick(o.id)}
            />
          ))}
        </div>
      </div>
      {/* Phone: the action stays on the bottom edge while the three plans scroll by (sticky inside its board). */}
      <div className="mt-5 max-sm:sticky max-sm:bottom-[calc(57px+env(safe-area-inset-bottom))] max-sm:z-20 max-sm:-mx-4 max-sm:-mb-4 max-sm:border-t max-sm:border-line max-sm:bg-surface-strong max-sm:px-4 max-sm:py-2.5">
        <Button variant="primary" size="lg" className="max-sm:w-full" onClick={() => choose(chosen)}>
          {K.acceptPlan(K.name[chosen])}
        </Button>
      </div>
    </div>
  );
}
