"use client";

/**
 * rc9 HQ (DESIGN-DECISIONS #241): the season plan as HQ's decision. Miguel on
 * rc.8 named the goals screen as careless: three boxes of four bold figures
 * each, every label printed three times. Here it is one choice: three cards
 * side by side (stacked on a phone), each marked by its reach, its bonus the one
 * large figure, the board's proposal preselected and tagged, the picked card in
 * the orange hairline, one filled action under them.
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

function money(n: number): string {
  return n > 0 ? formatMoney(n, { compact: true }) : "–";
}

/** How far each plan reaches: one, two or three bars (the plan's mark, read before its words). */
const REACH: Record<string, number> = { cautious: 1, expected: 2, ambitious: 3 };

/**
 * rc9 HQ (#241, amended after Miguel's "simplificamos demais"): each plan is a card the
 * player picks, not a text row. The card's mark is its reach (bars), its one large figure
 * the bonus if the goal is met; the budget and the confidence swing sit under a hairline.
 * The board's proposal wears its tag on the card's top edge; the picked card is the orange hairline.
 */
function PlanCard({ o, active, proposed, onPick, C }: { o: BoardPackage; active: boolean; proposed: string | null; onPick: () => void; C: CareerCopy }) {
  const K = C.board.packages;
  const band = chanceBandOf(o.objective.chance ?? 0);
  const reach = REACH[o.id] ?? 2;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onPick}
      className={cx(
        "card-texture relative flex h-full w-full flex-col rounded-xl border bg-white/[0.02] p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-bright",
        active ? "border-orange bg-white/[0.04]" : "border-line-strong hover:border-ink/40",
      )}
    >
      <span className="flex items-start justify-between gap-2">
        <span className="flex items-center gap-2.5">
          {/* The radio's own mark: a ring, filled when picked. */}
          <span aria-hidden className={cx("flex h-4 w-4 shrink-0 items-center justify-center rounded-full border", active ? "border-orange" : "border-line-strong")}>
            {active ? <span className="h-2 w-2 rounded-full bg-orange" /> : null}
          </span>
          <span className="display text-lg font-bold leading-none text-ink">{K.name[o.id]}</span>
        </span>
        <span aria-hidden className="flex items-end gap-0.5 pt-0.5">
          {[1, 2, 3].map((i) => (
            <span key={i} className={cx("w-1.5 rounded-sm", i <= reach ? (active ? "bg-orange" : "bg-ink/70") : "bg-white/10")} style={{ height: 4 + i * 4 }} />
          ))}
        </span>
      </span>
      {proposed ? (
        <span className="mt-2.5">
          <Badge tone="orange">{proposed}</Badge>
        </span>
      ) : null}
      <span className="mt-3 block text-sm leading-snug text-ink">{goalText(C, o.objective)}</span>
      <span className="mt-1 block text-xs text-faint">{K.band(band)}</span>

      {/* The plan's figure: what the goal pays. */}
      <span className="mt-auto block pt-5">
        <span className={cx("display block text-3xl font-bold tabular-nums leading-none", o.bonus > 0 ? "text-good" : "text-faint")}>{money(o.bonus)}</span>
        <span className="mt-1.5 block text-xs text-faint">{K.bonusLabel}</span>
      </span>
      <span className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-3">
        <span>
          <span className="display block text-[15px] font-bold tabular-nums text-ink">{money(o.grant)}</span>
          <span className="mt-0.5 block text-xs text-faint">{K.budgetLabel}</span>
        </span>
        <span>
          <span className="display block text-[15px] font-bold tabular-nums">
            <span className="text-good">+{o.hit}</span>
            <span className="text-faint"> / </span>
            <span className="text-bad">−{Math.abs(o.miss)}</span>
          </span>
          <span className="mt-0.5 block text-xs text-faint">{K.confidenceLabel}</span>
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {offers.map((o) => (
            <PlanCard
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
