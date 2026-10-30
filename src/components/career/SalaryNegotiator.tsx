"use client";

/**
 * Road to Worlds rc.33 (ECO-10 + ECO-11) — the contract talk (sign + renew).
 *
 * Renders the engine's ONE answer (`contract.negotiationAnswerFor`, through
 * `careerFlow.signingTalkFor` / `renewalTalkFor`): two levers — the weekly
 * wage and the prize share —, the zone where he signs at the share offered,
 * and the result before any confirm (he signs, or his counter, which taking
 * always signs). Every number comes from the answer.
 *
 * rc.34 (front I, Miguel 31/10: "sometimes you just can't move anything"):
 * each press is the engine's (`contract.talkPressFor`) — a wage press moves
 * the wage one step, a share press moves the share one point AND the wage
 * one point's money the other way, so every press moves the wage shown and a
 * share press never turns a yes into a counter; a closed way names its
 * reason under its button (`answer.limits`); the share lever hides for a
 * player who asks no share, or while the share is switched off
 * (`zone.shareLever`).
 */

import { useId, type ReactNode } from "react";
import { talkPressFor, type ContractOffer, type NegotiationAnswer, type TalkLever } from "@/engine/career/contract";
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
  const ids = useId();
  const { zone, offer, ask, limits } = talk;
  const atAsk = offer.sharePct === ask.sharePct && offer.weekly >= zone.topWeekly;
  const press = (lever: TalkLever, dir: 1 | -1) => talkPressFor(talk, lever, dir);
  const wageDown = press("wage", -1);
  const wageUp = press("wage", 1);
  const shareDown = press("share", -1);
  const shareUp = press("share", 1);

  // The zone track: from a little under the lower of (offer, floor) to his ask at this share.
  const lo = Math.max(0, Math.min(offer.weekly, zone.floorWeekly) - 2 * zone.stepWeekly);
  const hi = Math.max(lo + 1, zone.topWeekly);
  const pos = (w: number) => Math.max(0, Math.min(100, ((w - lo) / (hi - lo)) * 100));
  const money = (w: number) => formatMoney(w);

  // Why a way is closed — named under the button it closes.
  const wageDownWhy = limits.wageDown === "minimum" ? N.why.minimum : limits.wageDown === "floor" ? N.why.floor : null;
  const wageUpWhy = limits.wageUp ? N.why.ask : null;
  const shareDownWhy = limits.shareDown === "none" ? N.why.noShare : limits.shareDown ? N.why.shareLeast : null;
  const shareUpWhy = limits.shareUp === "minimum" ? N.why.shareMinimum : limits.shareUp ? N.why.shareMost : null;

  const stepper = (
    lever: TalkLever,
    label: { down: string; up: string },
    value: ReactNode,
    down: ContractOffer | null,
    up: ContractOffer | null,
    why: { down: string | null; up: string | null },
  ) => (
    <>
      <div className="mt-1 flex items-center gap-2">
        <button
          type="button"
          aria-label={label.down}
          aria-describedby={why.down ? `${ids}-${lever}-down` : undefined}
          className={STEP_BTN}
          onClick={() => down && onChange(down)}
          disabled={disabled || !down}
        >
          −
        </button>
        <p className="min-w-0 flex-1 text-center text-lg font-bold tabular-nums">{value}</p>
        <button
          type="button"
          aria-label={label.up}
          aria-describedby={why.up ? `${ids}-${lever}-up` : undefined}
          className={STEP_BTN}
          onClick={() => up && onChange(up)}
          disabled={disabled || !up}
        >
          +
        </button>
      </div>
      {/* Always laid out (one line), so a reason appearing never shifts the sheet. */}
      <div className="mt-0.5 flex min-h-4 justify-between gap-2 text-[10px] font-semibold leading-4 text-faint">
        <span id={`${ids}-${lever}-down`}>{why.down}</span>
        <span id={`${ids}-${lever}-up`} className="text-right">
          {why.up}
        </span>
      </div>
    </>
  );

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
      {stepper(
        "wage",
        { down: N.wageDown, up: N.wageUp },
        <>
          {money(offer.weekly)}
          <span className="ml-1 text-[10px] font-semibold text-faint">{N.perWeek}</span>
        </>,
        wageDown,
        wageUp,
        { down: wageDownWhy, up: wageUpWhy },
      )}

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

      {/* Lever 2 — the prize share (ECO-10); hidden when he asks none or the share is switched off (zone.shareLever) */}
      {zone.shareLever ? (
        <>
          <div className="mt-3 flex items-baseline justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-faint">{N.share}</p>
            <p className="text-[10px] text-faint">{N.shareAsk(ask.sharePct)}</p>
          </div>
          {stepper(
            "share",
            { down: N.shareDown, up: N.shareUp },
            `${offer.sharePct}%`,
            shareDown,
            shareUp,
            { down: shareDownWhy, up: shareUpWhy },
          )}
          <p className="mt-1 text-[10px] text-faint">
            {N.shareHint} {N.trade(money(zone.pointWeekly))}
          </p>
        </>
      ) : null}

      {/* The answer — readable before any confirm */}
      <div className="mt-3 border-t border-line pt-2 text-[11px]">
        {talk.accepted ? (
          <>
            <p className="font-bold text-emerald-400">
              ✓{" "}
              {talk.terms.sharePct > 0
                ? N.signs(money(talk.terms.weekly), talk.terms.sharePct)
                : N.signsNoShare(money(talk.terms.weekly))}
            </p>
            {talk.savingWeekly !== 0 ? (
              <p className={cx("mt-0.5 font-semibold", talk.savingWeekly > 0 ? "text-emerald-400" : "text-amber-400")}>
                {talk.savingWeekly > 0 ? N.saves(money(talk.savingWeekly)) : N.costs(money(-talk.savingWeekly))}
              </p>
            ) : null}
          </>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-bold text-amber-400">
              ↺{" "}
              {talk.terms.sharePct > 0
                ? N.counter(money(talk.terms.weekly), talk.terms.sharePct)
                : N.counterNoShare(money(talk.terms.weekly))}
            </p>
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
