"use client";

/**
 * R135 (ECO-06): the trade sheet. From a contracted player's offer sheet the
 * user proposes one of his own players for him (an AI org of the same
 * region), optionally adding cash. `tradePlanFor` is the one source of every
 * gate, the wage and the outlook; the org answers after a few days.
 */

import { useId, useState } from "react";
import { CAREER_ECONOMY, CAREER_TRANSFER } from "@/config/balance";
import { useCareerCopy } from "@/content/careerCopy";
import { quantize } from "@/engine/career/economy";
import type { CareerSave } from "@/engine/career/types";
import { formatMoney } from "@/lib/format";
import { cx } from "@/lib/util";
import { listingPlanFor, nameOfRef, tradePlanFor } from "@/store/careerFlow";
import { useCareerStore } from "@/store/careerStore";
import { prizeShareLabelOf, wageLabel } from "@/components/career/careerUi";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

export interface TradeTarget {
  id: string;
  name: string;
  overall: number;
  orgRef: string;
}

export function TradeSheet({
  save,
  open,
  target,
  onClose,
  onSent,
}: {
  save: CareerSave;
  open: boolean;
  target: TradeTarget | null;
  onClose: () => void;
  /** Called after a proposal was sent (the caller closes its own sheet and shows My Deals). */
  onSent: () => void;
}) {
  const C = useCareerCopy();
  const T = C.market.trade;
  const proposeTrade = useCareerStore((s) => s.proposeTrade);
  const lastError = useCareerStore((s) => s.lastError);
  const clearError = useCareerStore((s) => s.clearError);
  const [giveId, setGiveId] = useState<string | null>(null);
  const [len, setLen] = useState<1 | 2 | 3>(2);
  const [cash, setCash] = useState(0);
  const cashId = useId();
  const errorText = (key: string): string => (C.market.errors as Record<string, string>)[key] ?? C.market.errors.unknown;

  if (!target) return null;

  const plans = save.squad.map((p) => ({ p, res: tradePlanFor(save, p.id, target.id, { lengthSeasons: len, cash }) }));
  const firstOk = plans.find((x) => "plan" in x.res)?.p.id ?? null;
  const activeId = giveId ?? firstOk;
  const current = plans.find((x) => x.p.id === activeId) ?? null;
  const plan = current && "plan" in current.res ? current.res.plan : null;
  const planError = current && "error" in current.res ? current.res.error : null;
  const finalSeason = plan?.signing.finalSeason ?? false;
  const effLen: 1 | 2 | 3 = finalSeason ? 1 : len;
  const quantum = CAREER_ECONOMY.roundQuantum;
  const cashMax = plan ? Math.max(0, quantize(plan.fee)) : 0;
  const cashStep = Math.max(quantum, quantize(cashMax * CAREER_TRANSFER.listing.askStep));
  const cashShown = Math.min(cash, cashMax);
  const [minDays, maxDays] = CAREER_TRANSFER.trade.answerDays;
  const shortPct = Math.round(CAREER_TRANSFER.listing.shortTenureShare * 100);
  const shortTenure = activeId ? Boolean(listingPlanFor(save, activeId)?.shortTenure) : false;
  const talk = plan?.signing.talk ?? null;

  const close = () => {
    clearError();
    setGiveId(null);
    onClose();
  };

  const send = () => {
    if (!activeId) return;
    clearError();
    proposeTrade(activeId, target.id, { lengthSeasons: effLen, cash: cashShown });
    if (useCareerStore.getState().lastError) return;
    setGiveId(null);
    setCash(0);
    onSent();
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title={T.sheetTitle(target.name)}
      wide
      actions={
        <>
          <Button variant="ghost" onClick={close}>
            {C.common.cancel}
          </Button>
          <Button variant="primary" disabled={!plan} onClick={send}>
            {T.send}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {lastError && lastError !== "negotiationCounter" ? (
          <p role="alert" className="rounded-md border border-bad/40 bg-bad/10 px-2.5 py-1.5 text-xs font-semibold text-bad">
            {errorText(lastError)}
          </p>
        ) : null}

        <div className="rounded-lg border border-line-strong bg-white/[0.03] p-3">
          <p className="kicker mb-1 text-[10px]">{T.target}</p>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="display text-lg font-bold text-ink">{target.name}</span>
            <span className="text-xs text-sub">
              {C.common.ovr} <strong className="text-ink">{Math.round(target.overall)}</strong> · {nameOfRef(save, target.orgRef)}
            </span>
          </div>
        </div>

        <div>
          <p className="kicker mb-1 text-[10px]">{T.pickGive}</p>
          <div className="space-y-1.5">
            {plans.map(({ p, res }) => {
              const err = "error" in res ? res.error : null;
              const selected = p.id === activeId;
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={Boolean(err)}
                  aria-pressed={selected}
                  onClick={() => setGiveId(p.id)}
                  className={cx(
                    "flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                    selected ? "border-blue/50 bg-blue/10" : "border-line bg-white/[0.02] enabled:hover:border-line-strong",
                  )}
                >
                  <span className="min-w-0">
                    <span className="display block truncate font-bold text-ink">{p.name}</span>
                    {err ? <span className="block text-[11px] text-orange-bright">{errorText(err)}</span> : null}
                  </span>
                  <span className="shrink-0 text-xs text-sub">
                    {C.common.ovr} <strong className="text-ink">{Math.round(p.overall)}</strong>
                  </span>
                </button>
              );
            })}
          </div>
          {planError && !plan ? <p className="mt-1.5 text-xs font-semibold text-bad">{errorText(planError)}</p> : null}
          {shortTenure ? <p className="mt-1.5 text-xs font-semibold text-orange-bright">{C.market.transferList.shortTenure(shortPct)}</p> : null}
        </div>

        <div>
          <p className="kicker mb-1 text-[10px]">{T.length}</p>
          <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${finalSeason ? 1 : 3}, minmax(0, 1fr))` }}>
            {(finalSeason ? ([1] as const) : ([1, 2, 3] as const)).map((l) => (
              <button
                key={l}
                type="button"
                aria-pressed={effLen === l}
                onClick={() => setLen(l)}
                className={cx(
                  "min-h-11 rounded-lg border px-1.5 py-1 text-center text-xs font-bold transition-colors",
                  effLen === l ? "border-white/25 bg-white/[0.06] text-sub" : "border-line text-ink hover:border-line-strong",
                )}
              >
                {C.market.seasons(l)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor={cashId} className="kicker mb-1 block text-[10px]">
            {T.cashLabel}
          </label>
          <input
            id={cashId}
            type="range"
            min={0}
            max={cashMax}
            step={cashStep}
            value={cashShown}
            disabled={!plan}
            onChange={(e) => setCash(Number(e.target.value))}
            className="h-11 w-full cursor-pointer accent-orange"
          />
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="display text-lg font-bold text-orange-bright">{cashShown > 0 ? formatMoney(cashShown) : T.noCash}</span>
            <span className="text-[11px] text-faint">{T.cashHint}</span>
          </div>
        </div>

        {plan && talk ? (
          <div className="rounded-lg border border-line bg-white/[0.02] p-3 text-sm">
            <p className="kicker mb-2 text-[10px]">{T.summary}</p>
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sub">{T.wage}</span>
                <span className="display font-bold text-ink">{wageLabel(C, talk.offered.wagePerSplit)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sub">{T.share}</span>
                <span className="display font-bold text-ink">{prizeShareLabelOf(C, { prizeSharePct: talk.offered.sharePct })}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sub">{T.cash}</span>
                <span className="display font-bold text-ink">{plan.cash > 0 ? formatMoney(plan.cash) : T.noCash}</span>
              </div>
            </div>
            <p
              className={cx(
                "mt-3 text-xs font-semibold",
                plan.outlook === "likely" ? "text-good" : plan.outlook === "close" ? "text-orange-bright" : "text-bad",
              )}
            >
              {T.outlook[plan.outlook]}
            </p>
          </div>
        ) : null}

        <p className="text-xs leading-relaxed text-sub">{T.rules(minDays, maxDays)}</p>
      </div>
    </Modal>
  );
}
