"use client";

/**
 * Road to Worlds — the player detail sheet (Modal, portal-on-body).
 *
 * Full read of a squad player OR a market target. rc9 TRAIN-MARKET: it reads
 * as the back of the player's card. The overall is the one figure; who he is
 * sits on one quiet line; the potential is a band with the overall marked in
 * it; the six attributes are rows under hairlines (name in the sub step, the
 * value in ink); the contract is rows too. No box inside the sheet. The host
 * screen passes the actions.
 */

import { useCopy } from "@/content/copy";
import { useCareerCopy } from "@/content/careerCopy";
import { Modal } from "@/components/ui/Modal";
import { Badge, CountryChip } from "@/components/ui/Badge";
import { OfferFact } from "@/components/career/market/MarketRows";
import { weeklyWage } from "@/engine/career/economy";
import { formatMoney } from "@/lib/format";
import { cx } from "@/lib/util";
import type { ArchetypeId, PotentialBand } from "@/engine/career/types";
import type { Stats } from "@/engine/types";

export interface PlayerSheetData {
  name: string;
  overall: number;
  age?: number;
  archetype?: ArchetypeId;
  country?: string;
  region?: string;
  band: PotentialBand;
  stats: Stats;
  /** Squad-only. */
  wage?: number;
  contractLabel?: string;
  /** rc.33 (ECO-10): the contract's prize share, as a label (squad-only). */
  shareLabel?: string;
  /** DEV-04 (rc.33): his phase — "unknown" until a report reveals it (squad and market). */
  phase?: "growing" | "prime" | "declining" | "unknown";
  focusLabel?: string;
}

const STAT_ORDER: (keyof Stats)[] = [
  "offense",
  "defense",
  "mechanics",
  "consistency",
  "experience",
  "clutch",
];

/** One attribute: the name in the sub step, a flat bar, the value in ink. */
function AttributeRow({ label, value }: { label: string; value: number }) {
  const share = Math.max(0, Math.min(1, (value - 60) / 39));
  return (
    <div className="grid grid-cols-[6.5rem_minmax(0,1fr)_2rem] items-center gap-x-3 border-b border-line py-2.5 text-[13px]">
      <dt className="truncate text-sub">{label}</dt>
      <dd className="contents">
        <span
          role="progressbar"
          aria-label={label}
          aria-valuemin={60}
          aria-valuemax={99}
          aria-valuenow={value}
          className="h-1.5 overflow-hidden rounded-full bg-white/10"
        >
          <span className={cx("block h-full rounded-full", value >= 90 ? "bg-ink/85" : "bg-blue-bright/70")} style={{ width: `${Math.round(share * 100)}%` }} />
        </span>
        <span className="display text-right text-[15px] font-semibold tabular-nums text-ink">{value}</span>
      </dd>
    </div>
  );
}

export function PlayerSheet({
  data,
  onClose,
  actions,
}: {
  data: PlayerSheetData | null;
  onClose: () => void;
  actions?: React.ReactNode;
}) {
  const t = useCopy();
  const C = useCareerCopy();
  if (!data) return null;

  const bandSpan = Math.max(1, data.band.max - 60);
  const ovrPos = Math.max(0, Math.min(100, ((data.overall - 60) / bandSpan) * 100));
  const bandStart = ((Math.max(60, data.band.min) - 60) / bandSpan) * 100;
  const bandWidth = ((data.band.max - Math.max(60, data.band.min)) / bandSpan) * 100;
  const potential = data.band.min === data.band.max ? C.player.potExact(data.band.max) : C.player.potBand(data.band.min, data.band.max);

  return (
    <Modal open={Boolean(data)} onClose={onClose} title={data.name} wide actions={actions}>
      <div className="space-y-6 pr-1.5">
        {/* Who he is on one quiet line (flag, age, role), his phase as the one tag;
            the overall is the sheet's figure, large, with its label under it. */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-sub">
              {data.country ? <CountryChip code={data.country} /> : null}
              {data.age !== undefined ? <span>{C.player.age(data.age)}</span> : null}
              {data.archetype ? (
                <span title={C.player.archetypeHint[data.archetype]}>
                  {data.age !== undefined ? "· " : ""}
                  {C.player.archetype[data.archetype]}
                </span>
              ) : null}
            </div>
            {data.phase ? (
              <span title={data.phase === "unknown" ? C.player.phaseUnknownHint : undefined} className="inline-block">
                <Badge tone={data.phase === "unknown" ? "neutral" : "blue"}>{C.player.phase[data.phase]}</Badge>
              </span>
            ) : null}
          </div>
          <div className="shrink-0 text-right">
            <p className="display text-4xl font-bold leading-none tabular-nums text-ink">{Math.round(data.overall)}</p>
            <p className="kicker mt-1">{C.common.ovr}</p>
          </div>
        </div>

        {/* Potential: the band, with his overall marked in it. */}
        <section>
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <h4 className="kicker">{C.player.potential}</h4>
            <span className="display text-[15px] font-semibold tabular-nums text-ink">{potential}</span>
          </div>
          {/* The marker lives outside the clipped track and clamps a step short of
              both edges, so it stays readable even when the overall is near the band's top. */}
          <div className="relative h-2 w-full">
            <div className="absolute inset-0 overflow-hidden rounded-full bg-white/10">
              <div
                className="absolute inset-y-0 rounded-full bg-blue-bright/45"
                style={{ left: `${bandStart}%`, width: `${Math.max(1.5, bandWidth)}%` }}
              />
            </div>
            <div
              aria-hidden
              className="absolute -bottom-1 -top-1 w-0.5 rounded-full bg-ink"
              style={{ left: `clamp(0px, calc(${ovrPos}% - 1px), calc(100% - 2px))` }}
            />
          </div>
          <div className="display mt-1.5 flex items-center justify-between text-[11px] font-medium tabular-nums text-faint">
            <span>60</span>
            <span>{data.band.max}</span>
          </div>
        </section>

        {/* Attributes: six rows, two columns from `sm`. */}
        <section>
          <h4 className="kicker mb-1">{C.player.attributes}</h4>
          <dl className="grid grid-cols-1 gap-x-8 border-t border-line sm:grid-cols-2">
            {STAT_ORDER.map((k) => (
              <AttributeRow key={k} label={t.STAT_LABELS[k]} value={Math.round(data.stats[k])} />
            ))}
          </dl>
        </section>

        {/* The contract: rows, the label in the faint step (squad players only). */}
        {data.wage !== undefined ? (
          <dl className="border-t border-line">
            <OfferFact label={C.squad.wage} value={C.squad.perWeek(formatMoney(weeklyWage(data.wage)))} />
            {data.contractLabel ? <OfferFact label={C.player.contract} value={data.contractLabel} /> : null}
            {data.shareLabel ? <OfferFact label={C.player.prizeShare} value={data.shareLabel} /> : null}
            {data.focusLabel ? <OfferFact label={C.player.trainingFocusLabel} value={data.focusLabel} /> : null}
          </dl>
        ) : null}
      </div>
    </Modal>
  );
}
