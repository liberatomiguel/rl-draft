"use client";

/**
 * Road to Worlds rc.33 (ECO-10 + ECO-11) — the contract talk (sign + renew).
 *
 * Renders the engine's ONE answer (`contract.negotiationAnswerFor`, through
 * `careerFlow.signingTalkFor` / `renewalTalkFor`): two levers — the weekly
 * wage and the prize share —, the zone where he signs at the share offered,
 * and the result before any confirm (he signs, or his counter, which taking
 * always signs). Every number comes from the answer; a press of either
 * stepper is whole weekly quanta, so it always moves the wage shown. The
 * share lever hides while the prize share is switched off (`zone.shareLever`).
 */

import type { ContractOffer, NegotiationAnswer } from "@/engine/career/contract";
import { useCareerCopy } from "@/content/careerCopy";
import { formatMoney } from "@/lib/format";
import { cx } from "@/lib/util";

const STEP_BTN =
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-line text-lg font-bold text-sub hover:bg-white/6 disabled:opacity-40";

export function SalaryNegotiator({
  talk,
  onChange,
  disabled,
}: {
  /** The engine's answer to the current offer (`signingTalkFor` / `renewalTalkFor`). */
  talk: NegotiationAnswer;
  /** The next offer (an empty offer = his ask). */
  onChange: (next: ContractOffer) => void;
  disabled?: boolean;
}) {
  const N = useCareerCopy().market.negotiation;
  const { zone, offer, ask } = talk;
  const atAsk = offer.sharePct === ask.sharePct && offer.weekly >= zone.topWeekly;

  const setWage = (weekly: number) => onChange({ weekly, sharePct: offer.sharePct });
  const setShare = (sharePct: number) => onChange({ weekly: offer.weekly, sharePct });
  const wageDown = Math.max(zone.floorWeekly, offer.weekly - zone.stepWeekly);
  const wageUp = Math.min(zone.topWeekly, offer.weekly + zone.stepWeekly);

  // The zone track: from a little under the lower of (offer, floor) to his ask at this share.
  const lo = Math.max(0, Math.min(offer.weekly, zone.floorWeekly) - 2 * zone.stepWeekly);
  const hi = Math.max(lo + 1, zone.topWeekly);
  const pos = (w: number) => Math.max(0, Math.min(100, ((w - lo) / (hi - lo)) * 100));
  const money = (w: number) => formatMoney(w);

  return (
    <div className="rounded-lg border border-line bg-white/3 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="kicker text-[10px]">{N.title}</p>
        <button
          type="button"
          className="min-h-11 px-1 text-[11px] font-semibold text-cyan hover:underline disabled:opacity-40"
          onClick={() => onChange({})}
          disabled={disabled || atAsk}
        >
          {N.fullAsk}
        </button>
      </div>

      {/* Lever 1 — the weekly wage */}
      <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-faint">{N.wage}</p>
      <div className="mt-1 flex items-center gap-2">
        <button
          type="button"
          aria-label={N.wageDown}
          className={STEP_BTN}
          onClick={() => setWage(wageDown)}
          disabled={disabled || offer.weekly <= zone.floorWeekly}
        >
          −
        </button>
        <p className="min-w-0 flex-1 text-center text-lg font-bold tabular-nums">
          {money(offer.weekly)}
          <span className="ml-1 text-[10px] font-semibold text-faint">{N.perWeek}</span>
        </p>
        <button
          type="button"
          aria-label={N.wageUp}
          className={STEP_BTN}
          onClick={() => setWage(wageUp)}
          disabled={disabled || offer.weekly >= zone.topWeekly}
        >
          +
        </button>
      </div>

      {/* The zone at this share: where he signs (floor → his ask), the offer marked */}
      {zone.topWeekly > zone.floorWeekly ? (
        <div className="relative mt-2 h-2.5 w-full" aria-hidden>
          <div className="absolute inset-0 overflow-hidden rounded-full bg-white/8">
            <div
              className="absolute inset-y-0 right-0 rounded-full bg-emerald-400/30"
              style={{ left: `${pos(zone.floorWeekly)}%` }}
            />
          </div>
          <div
            className={cx(
              "absolute -bottom-0.5 -top-0.5 w-1 rounded-full",
              talk.accepted ? "bg-emerald-300" : "bg-amber-400",
            )}
            style={{ left: `clamp(1px, calc(${pos(offer.weekly)}% - 2px), calc(100% - 5px))` }}
          />
        </div>
      ) : null}
      <p className="mt-1 text-[10px] text-faint">
        {zone.topWeekly > zone.floorWeekly
          ? N.zone(money(zone.floorWeekly), money(zone.topWeekly))
          : N.zoneFixed(money(zone.topWeekly))}
      </p>

      {/* Lever 2 — the prize share (ECO-10); hidden while the share is switched off (zone.shareLever) */}
      {zone.shareLever ? (
        <>
          <div className="mt-3 flex items-baseline justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-faint">{N.share}</p>
            <p className="text-[10px] text-faint">{N.shareAsk(ask.sharePct)}</p>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <button
              type="button"
              aria-label={N.shareDown}
              className={STEP_BTN}
              onClick={() => setShare(offer.sharePct - 1)}
              disabled={disabled || offer.sharePct <= zone.shareMin}
            >
              −
            </button>
            <p className="min-w-0 flex-1 text-center text-lg font-bold tabular-nums">{offer.sharePct}%</p>
            <button
              type="button"
              aria-label={N.shareUp}
              className={STEP_BTN}
              onClick={() => setShare(offer.sharePct + 1)}
              disabled={disabled || offer.sharePct >= zone.shareMax}
            >
              +
            </button>
          </div>
          <p className="mt-1 text-[10px] text-faint">
            {N.shareHint} {N.trade(money(zone.pointWeekly))}
          </p>
        </>
      ) : null}

      {/* The answer — readable before any confirm */}
      <div className="mt-3 border-t border-line pt-2 text-[11px]">
        {talk.accepted ? (
          <>
            <p className="font-bold text-emerald-400">✓ {N.signs(money(talk.terms.weekly), talk.terms.sharePct)}</p>
            {talk.savingWeekly !== 0 ? (
              <p className={cx("mt-0.5 font-semibold", talk.savingWeekly > 0 ? "text-emerald-400" : "text-amber-400")}>
                {talk.savingWeekly > 0 ? N.saves(money(talk.savingWeekly)) : N.costs(money(-talk.savingWeekly))}
              </p>
            ) : null}
          </>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-bold text-amber-400">↺ {N.counter(money(talk.terms.weekly), talk.terms.sharePct)}</p>
            <button
              type="button"
              className="min-h-11 rounded-lg border border-amber-400/50 px-3 text-[11px] font-semibold text-amber-300 hover:bg-amber-400/10 disabled:opacity-40"
              onClick={() => onChange({ weekly: talk.terms.weekly, sharePct: talk.terms.sharePct })}
              disabled={disabled}
            >
              {N.takeCounter}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
