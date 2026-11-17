"use client";

/**
 * R134 (ECO-06): the listing sheet. Pick a squad player (when opened without
 * one), set the asking fee inside the bounds `listingPlanFor` gives, list him.
 * The same sheet re-prices a player already on the list.
 */

import { useId, useState } from "react";
import { CAREER_TRANSFER } from "@/config/balance";
import { useCareerCopy } from "@/content/careerCopy";
import { formatMoney } from "@/lib/format";
import { cx } from "@/lib/util";
import { listingPlanFor } from "@/store/careerFlow";
import { useCareerStore } from "@/store/careerStore";
import type { CareerSave } from "@/engine/career/types";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

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

  // --- squad picker -------------------------------------------------------
  if (!player || !plan) {
    return (
      <Modal open={open} onClose={close} title={L.pickTitle} actions={<Button variant="ghost" onClick={close}>{C.common.cancel}</Button>}>
        <p className="mb-3 text-xs text-sub">{L.pickHint}</p>
        <div className="space-y-2">
          {save.squad.map((p) => {
            const pl = listingPlanFor(save, p.id);
            const err = pl?.error ?? null;
            return (
              <button
                key={p.id}
                type="button"
                disabled={Boolean(err)}
                onClick={() => setPicked(p.id)}
                className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border border-line bg-white/[0.02] px-3 py-2 text-left transition-colors enabled:hover:border-line-strong disabled:cursor-not-allowed disabled:opacity-60"
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
      <div className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="display text-lg font-bold text-ink">{player.name}</span>
          <span className="text-xs text-sub">
            {C.common.ovr} <strong className="text-ink">{Math.round(player.overall)}</strong>
          </span>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-line bg-white/[0.03] px-3 py-2 text-sm">
          <span className="text-sub">{L.value}</span>
          <span className="display font-bold text-ink">{formatMoney(plan.value)}</span>
        </div>
        {plan.shortTenure ? <p className="text-xs font-semibold text-orange-bright">{L.shortTenure(shortPct)}</p> : null}
        <div>
          <label htmlFor={rangeId} className="kicker mb-1 block text-[10px]">
            {L.askLabel}
          </label>
          <input
            id={rangeId}
            type="range"
            min={plan.min}
            max={plan.max}
            step={step}
            value={ask}
            onChange={(e) => setAskByPlayer((m) => ({ ...m, [player.id]: Number(e.target.value) }))}
            className="h-11 w-full cursor-pointer accent-orange"
          />
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="display text-xl font-bold text-orange-bright">{formatMoney(ask)}</span>
            <span className="text-xs text-sub">{L.askPct(pct)}</span>
          </div>
        </div>
        <p className="text-xs leading-relaxed text-sub">{L.guidance(minDays, maxDays)}</p>
        {plan.error ? (
          <p className={cx("rounded-md border border-bad/40 bg-bad/10 px-2.5 py-1.5 text-xs font-semibold text-bad")}>
            {errorText(plan.error)}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
