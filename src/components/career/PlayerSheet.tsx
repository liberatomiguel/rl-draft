"use client";

/**
 * Road to Worlds — the player detail sheet (Modal, portal-on-body).
 *
 * Full read of a squad player OR a market target: attributes (six StatBars),
 * the potential band track (current OVR inside a shaded range), development /
 * scouting, and contract actions passed in by the host screen.
 */

import { useCopy } from "@/content/copy";
import { useCareerCopy } from "@/content/careerCopy";
import { Modal } from "@/components/ui/Modal";
import { StatBar } from "@/components/ui/ProgressBar";
import { Badge, CountryChip } from "@/components/ui/Badge";
import { weeklyWage } from "@/engine/career/economy";
import { formatMoney } from "@/lib/format";
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

/** One contract figure: the value first, its quiet label under it. */
function SheetFigure({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col-reverse">
      <dt className="mt-1 text-xs text-sub">{label}</dt>
      <dd className="display text-base font-bold leading-tight text-ink">{value}</dd>
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

  return (
    <Modal open={Boolean(data)} onClose={onClose} title={data.name} wide actions={actions}>
      <div className="space-y-5">
        {/* Who he is on one quiet line (flag, age, role, phase); the overall
            is the sheet's figure, large, with its label under it. */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5 text-sm text-sub">
            {data.country ? <CountryChip code={data.country} /> : null}
            {data.age !== undefined ? <span>{C.player.age(data.age)}</span> : null}
            {data.archetype ? (
              <span title={C.player.archetypeHint[data.archetype]}>
                {data.age !== undefined ? "· " : ""}
                {C.player.archetype[data.archetype]}
              </span>
            ) : null}
            {data.phase ? (
              <span title={data.phase === "unknown" ? C.player.phaseUnknownHint : undefined}>
                <Badge tone={data.phase === "unknown" ? "neutral" : "blue"}>{C.player.phase[data.phase]}</Badge>
              </span>
            ) : null}
          </div>
          <div className="shrink-0 text-right leading-none">
            <p className="display text-4xl font-bold text-ink">{Math.round(data.overall)}</p>
            <p className="mt-1 text-xs text-sub">{C.common.ovr}</p>
          </div>
        </div>

        {/* Potential band track */}
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="kicker">{C.player.potential}</span>
            <span className="display text-sm font-semibold text-blue-bright">
              {data.band.min === data.band.max
                ? C.player.potExact(data.band.max)
                : C.player.potBand(data.band.min, data.band.max)}
            </span>
          </div>
          {/* Marker lives OUTSIDE the clipped track and clamps a step short of
              both edges, so it stays readable even when OVR ≈ band.max. */}
          <div className="relative h-2.5 w-full">
            <div className="absolute inset-0 overflow-hidden rounded-full bg-white/8">
              <div
                className="absolute inset-y-0 rounded-full bg-blue/25"
                style={{ left: `${bandStart}%`, width: `${Math.max(1.5, bandWidth)}%` }}
              />
            </div>
            <div
              aria-hidden
              className="absolute -bottom-0.5 -top-0.5 w-1 rounded-full bg-orange"
              style={{ left: `clamp(1px, calc(${ovrPos}% - 2px), calc(100% - 5px))` }}
            />
          </div>
          <div className="display mt-1 flex items-center justify-between text-[11px] font-medium text-faint">
            <span>60</span>
            <span>{data.band.max}</span>
          </div>
        </div>

        {/* Attributes */}
        <div>
          <p className="kicker mb-2">{C.player.attributes}</p>
          <div className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
            {STAT_ORDER.map((k) => (
              <StatBar key={k} label={t.STAT_LABELS[k]} value={Math.round(data.stats[k])} />
            ))}
          </div>
        </div>

        {/* The contract as one strip of figures under a hairline: the value,
            its quiet label under it (no box inside the sheet). */}
        {data.wage !== undefined ? (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line pt-4 sm:grid-cols-4">
            <SheetFigure label={C.squad.wage} value={C.squad.perWeek(formatMoney(weeklyWage(data.wage)))} />
            {data.contractLabel ? <SheetFigure label={C.player.contract} value={data.contractLabel} /> : null}
            {data.shareLabel ? <SheetFigure label={C.player.prizeShare} value={data.shareLabel} /> : null}
            {data.focusLabel ? <SheetFigure label={C.player.trainingFocusLabel} value={data.focusLabel} /> : null}
          </dl>
        ) : null}
      </div>
    </Modal>
  );
}
