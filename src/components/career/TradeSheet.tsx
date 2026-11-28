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
import { OfferFact } from "@/components/career/market/MarketRows";

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
  const giveId_ = useId();
  const lenId = useId();
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
      <div className="space-y-6">
        {lastError && lastError !== "negotiationCounter" ? (
          <p role="alert" className="text-[13px] font-semibold text-bad">
            {errorText(lastError)}
          </p>
        ) : null}

        {/* Who arrives: his name, where he plays now, his overall as the figure. */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="kicker">{T.target}</p>
            <p className="display mt-1 truncate text-lg font-semibold text-ink">{target.name}</p>
            <p className="text-xs text-faint">{nameOfRef(save, target.orgRef)}</p>
          </div>
          <p className="shrink-0 text-right">
            <span className="display block text-2xl font-bold leading-none tabular-nums text-ink">{Math.round(target.overall)}</span>
            <span className="kicker mt-1 block">{C.common.ovr}</span>
          </p>
        </div>

        <div>
          <p className="kicker mb-2" id={giveId_}>
            {T.pickGive}
          </p>
          <ul className="space-y-1.5" role="radiogroup" aria-labelledby={giveId_}>
            {plans.map(({ p, res }) => {
              const err = "error" in res ? res.error : null;
              const selected = p.id === activeId;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={Boolean(err)}
                    onClick={() => setGiveId(p.id)}
                    className={cx(
                      "flex min-h-11 w-full items-center justify-between gap-4 rounded-lg border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue/60 disabled:cursor-not-allowed disabled:opacity-60",
                      selected ? "border-orange bg-orange/[0.06]" : "border-line enabled:hover:border-line-strong",
                    )}
                  >
                    <span className="min-w-0">
                      <span className="display block truncate text-[15px] font-semibold text-ink">{p.name}</span>
                      {err ? <span className="mt-0.5 block text-xs text-faint">{errorText(err)}</span> : null}
                    </span>
                    <span className="display shrink-0 text-lg font-bold tabular-nums text-ink">{Math.round(p.overall)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {planError && !plan ? <p className="mt-2 text-[13px] text-bad">{errorText(planError)}</p> : null}
          {shortTenure ? <p className="mt-2 text-[13px] text-sub">{C.market.transferList.shortTenure(shortPct)}</p> : null}
        </div>

        <div>
          <p className="kicker mb-2" id={lenId}>
            {T.length}
          </p>
          <div className="grid gap-2" role="radiogroup" aria-labelledby={lenId} style={{ gridTemplateColumns: `repeat(${finalSeason ? 1 : 3}, minmax(0, 1fr))` }}>
            {(finalSeason ? ([1] as const) : ([1, 2, 3] as const)).map((l) => (
              <button
                key={l}
                type="button"
                role="radio"
                aria-checked={effLen === l}
                onClick={() => setLen(l)}
                className={cx(
                  "display min-h-11 rounded-lg border px-2 py-1 text-center text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue/60",
                  effLen === l ? "border-orange bg-orange/[0.06] text-ink" : "border-line text-ink hover:border-line-strong",
                )}
              >
                {C.market.seasons(l)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor={cashId} className="kicker block">
            {T.cashLabel}
          </label>
          <p className="display mt-1 text-3xl font-bold leading-none tabular-nums text-ink">{cashShown > 0 ? formatMoney(cashShown) : T.noCash}</p>
          <input
            id={cashId}
            type="range"
            min={0}
            max={cashMax}
            step={cashStep}
            value={cashShown}
            disabled={!plan}
            onChange={(e) => setCash(Number(e.target.value))}
            className="mt-2 h-11 w-full cursor-pointer accent-orange disabled:cursor-not-allowed"
          />
          <p className="text-[13px] text-faint">{T.cashHint}</p>
        </div>

        {plan && talk ? (
          <div>
            <p className="kicker mb-2">{T.summary}</p>
            <dl className="border-t border-line">
              <OfferFact label={T.wage} value={wageLabel(C, talk.offered.wagePerSplit)} />
              <OfferFact label={T.share} value={prizeShareLabelOf(C, { prizeSharePct: talk.offered.sharePct })} />
              <OfferFact label={T.cash} value={plan.cash > 0 ? formatMoney(plan.cash) : T.noCash} />
            </dl>
            <p
              className={cx(
                "mt-3 text-[13px] font-semibold",
                plan.outlook === "likely" ? "text-good" : plan.outlook === "close" ? "text-sub" : "text-bad",
              )}
            >
              {T.outlook[plan.outlook]}
            </p>
          </div>
        ) : null}

        <p className="text-[13px] text-faint">{T.rules(minDays, maxDays)}</p>
      </div>
    </Modal>
  );
}
