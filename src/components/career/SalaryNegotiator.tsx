"use client";

/**
 * Road to Worlds v0.3 — the wage-talk widget (sign + renew flows).
 *
 * A bounded counter-offer stepper under the asking wage: the accept odds
 * shown are the TRUE probability (economy.negotiationAcceptChance — the
 * hidden reserve is uniform, the readout is its CDF). Rejections harden the
 * ask (telegraphed here); after maxRejects only the full ask signs this
 * window. No hidden dice beyond the one reserve draw, fixed per window.
 */

import { CAREER_ECONOMY, CAREER_NEGOTIATION } from "@/config/balance";
import { negotiationAcceptChance, quantize } from "@/engine/career/economy";
import { useCareerCopy } from "@/content/careerCopy";
import { formatMoney } from "@/lib/format";
import { cx } from "@/lib/util";

export function negotiationStep(ask: number): number {
  const q = CAREER_ECONOMY.roundQuantum;
  return Math.max(q, Math.round((ask * 0.02) / q) * q);
}

export function SalaryNegotiator({
  ask,
  offered,
  onChange,
  rejects,
  disabled,
}: {
  /** The full asking wage per split (the ceiling). */
  ask: number;
  /** The current proposed wage (== ask when not countering). */
  offered: number;
  onChange: (next: number) => void;
  /** Rejected counters this window (hardens the odds). */
  rejects: number;
  disabled?: boolean;
}) {
  const N = useCareerCopy().market.negotiation;

  const floor = quantize(ask * CAREER_NEGOTIATION.minOfferFactor);
  const step = negotiationStep(ask);
  const locked = rejects >= CAREER_NEGOTIATION.maxRejects;
  const chance = negotiationAcceptChance(offered, ask, rejects);
  const pct = Math.round(chance * 100);
  const band =
    offered >= ask ? N.safe : pct >= 66 ? N.likely : pct > 0 ? N.risky : N.lowball;
  const bandTone =
    offered >= ask
      ? "text-emerald-400"
      : pct >= 66
        ? "text-cyan"
        : pct > 0
          ? "text-amber-400"
          : "text-red-400";

  const setClamped = (next: number) => onChange(Math.min(ask, Math.max(floor, quantize(next))));

  return (
    <div className="rounded-lg border border-line bg-white/3 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="kicker text-[10px]">{N.title}</p>
        <button
          type="button"
          className="text-[11px] font-semibold text-cyan hover:underline disabled:opacity-40"
          onClick={() => onChange(ask)}
          disabled={disabled || offered >= ask}
        >
          {N.fullAsk}
        </button>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          aria-label="-"
          className="h-9 w-9 shrink-0 rounded-lg border border-line text-lg font-bold text-sub hover:bg-white/6 disabled:opacity-40"
          onClick={() => setClamped(offered - step)}
          disabled={disabled || locked || offered - step < floor}
        >
          −
        </button>
        <div className="min-w-0 flex-1 text-center">
          <p className="text-lg font-bold tabular-nums">{formatMoney(offered)}</p>
          <p className="text-[10px] text-faint">{N.yourOffer}</p>
        </div>
        <button
          type="button"
          aria-label="+"
          className="h-9 w-9 shrink-0 rounded-lg border border-line text-lg font-bold text-sub hover:bg-white/6 disabled:opacity-40"
          onClick={() => setClamped(offered + step)}
          disabled={disabled || locked || offered >= ask}
        >
          +
        </button>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px]">
        <span className={cx("font-bold", bandTone)}>
          {band}
          {offered < ask ? ` · ${N.chance(pct)}` : ""}
        </span>
        {offered < ask ? (
          <span className="font-semibold text-emerald-400">
            {N.savings(formatMoney(ask - offered))}
          </span>
        ) : null}
      </div>

      {rejects > 0 ? (
        <p className="mt-2 text-[11px] font-semibold text-amber-400">{N.hardened(rejects)}</p>
      ) : null}
    </div>
  );
}
