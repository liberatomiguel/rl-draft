"use client";

/**
 * R135 (ECO-06): the listing sheet. Pick a squad player (when opened without
 * one), set the asking fee inside the bounds `listingPlanFor` gives, list him.
 * The same sheet re-prices a player already on the list.
 */

import { useId, useState } from "react";
import { CAREER_TRANSFER } from "@/config/balance";
import { useCareerCopy } from "@/content/careerCopy";
import { formatMoney } from "@/lib/format";
import { listingPlanFor } from "@/store/careerFlow";
import { useCareerStore } from "@/store/careerStore";
import type { CareerSave } from "@/engine/career/types";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { OfferFact } from "@/components/career/market/MarketRows";

export function ListPlayerSheet({
  save,
  open,
  playerId,
  onClose,
}: {
  save: CareerSave;
  open: boolean;
  /** The player to list or re-price; null = show the squad picker. */
  playerId: string | null;
  onClose: () => void;
}) {
  const C = useCareerCopy();
  const L = C.market.transferList;
  const listPlayer = useCareerStore((s) => s.listPlayer);
  const [picked, setPicked] = useState<string | null>(null);
  const [askByPlayer, setAskByPlayer] = useState<Record<string, number>>({});
  const rangeId = useId();

  const activeId = playerId ?? picked;
  const player = activeId ? (save.squad.find((p) => p.id === activeId) ?? null) : null;
  const plan = player ? listingPlanFor(save, player.id) : null;
  const errorText = (key: string): string => (C.market.errors as Record<string, string>)[key] ?? C.market.errors.unknown;

  const close = () => {
    setPicked(null);
    onClose();
  };

  // --- squad picker: one row per player, the reason he cannot be listed under his name ---
  if (!player || !plan) {
    return (
      <Modal open={open} onClose={close} title={L.pickTitle} actions={<Button variant="ghost" onClick={close}>{C.common.cancel}</Button>}>
        <ul className="border-t border-line">
          {save.squad.map((p) => {
            const pl = listingPlanFor(save, p.id);
            const err = pl?.error ?? null;
            return (
              <li key={p.id} className="border-b border-line">
                <button
                  type="button"
                  disabled={Boolean(err)}
                  onClick={() => setPicked(p.id)}
                  className="flex min-h-11 w-full items-center justify-between gap-4 py-3 text-left transition-colors enabled:hover:bg-white/[0.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue/60 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="min-w-0">
                    <span className="display block truncate text-[15px] font-semibold text-ink">{p.name}</span>
                    {err ? <span className="mt-0.5 block text-xs text-faint">{errorText(err)}</span> : null}
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="display block text-xl font-bold leading-none tabular-nums text-ink">{Math.round(p.overall)}</span>
                    <span className="kicker mt-1 block">{C.common.ovr}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </Modal>
    );
  }

  // --- the ask ------------------------------------------------------------
  const step = Math.max(1, Math.round(plan.value * CAREER_TRANSFER.listing.askStep));
  const fallback = plan.current?.ask ?? plan.value;
  const raw = askByPlayer[player.id] ?? fallback;
  const ask = Math.min(plan.max, Math.max(plan.min, raw));
  const pct = plan.value > 0 ? Math.round((ask / plan.value) * 100) : 100;
  const [minDays, maxDays] = CAREER_TRANSFER.listing.answerDays;
  const shortPct = Math.round(CAREER_TRANSFER.listing.shortTenureShare * 100);

  return (
    <Modal
      open={open}
      onClose={close}
      title={plan.current ? L.repriceTitle : L.sheetTitle}
      actions={
        <>
          <Button variant="ghost" onClick={close}>
            {C.common.cancel}
          </Button>
          <Button
            variant="primary"
            disabled={Boolean(plan.error)}
            onClick={() => {
              listPlayer(player.id, ask);
              close();
            }}
          >
            {plan.current ? L.confirmReprice : L.confirm}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <p className="display min-w-0 truncate text-lg font-semibold text-ink">{player.name}</p>
          <p className="shrink-0 text-right">
            <span className="display block text-2xl font-bold leading-none tabular-nums text-ink">{Math.round(player.overall)}</span>
            <span className="kicker mt-1 block">{C.common.ovr}</span>
          </p>
        </div>
        <dl className="border-t border-line">
          <OfferFact label={L.value} value={formatMoney(plan.value)} />
        </dl>
        <div>
          <label htmlFor={rangeId} className="kicker block">
            {L.askLabel}
          </label>
          <p className="display mt-1 text-3xl font-bold leading-none tabular-nums text-ink">{formatMoney(ask)}</p>
          <p className="mt-1 text-[13px] tabular-nums text-sub">{L.askPct(pct)}</p>
          <input
            id={rangeId}
            type="range"
            min={plan.min}
            max={plan.max}
            step={step}
            value={ask}
            onChange={(e) => setAskByPlayer((m) => ({ ...m, [player.id]: Number(e.target.value) }))}
            className="mt-2 h-11 w-full cursor-pointer accent-orange"
          />
        </div>
        {plan.shortTenure ? <p className="text-[13px] text-sub">{L.shortTenure(shortPct)}</p> : null}
        <p className="text-[13px] text-faint">{L.guidance(minDays, maxDays)}</p>
        {plan.error ? (
          <p role="alert" className="text-[13px] font-semibold text-bad">
            {errorText(plan.error)}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
