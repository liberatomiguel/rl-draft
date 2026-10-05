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
import { CountryChip } from "@/components/ui/Badge";
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
  phase?: "growing" | "prime" | "declining";
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
        {/* Header line */}
        <div className="flex flex-wrap items-center gap-2 text-xs text-sub">
          {data.country ? <CountryChip code={data.country} /> : null}
          {data.age !== undefined ? <span>{C.player.age(data.age)}</span> : null}
          {data.archetype ? (
            <span
              className="rounded bg-white/6 px-2 py-0.5 font-semibold text-sub"
              title={C.player.archetypeHint[data.archetype]}
            >
              {C.player.archetype[data.archetype]}
            </span>
          ) : null}
          {data.phase ? (
            <span className="rounded bg-blue/10 px-2 py-0.5 font-semibold text-cyan">
              {C.player.phase[data.phase]}
            </span>
          ) : null}
          <span className="ml-auto display text-2xl font-bold text-ink">
            {Math.round(data.overall)}
            <span className="ml-1 kicker text-[10px] text-faint">{C.common.ovr}</span>
          </span>
        </div>

        {/* Potential band track */}
        <div>
          <div className="mb-1 flex items-center justify-between text-[11px]">
            <span className="kicker">{C.player.potential}</span>
            <span className="font-semibold text-cyan">
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
              className="absolute -bottom-0.5 -top-0.5 w-1 rounded-full bg-orange shadow-[0_0_8px_rgba(249,115,22,0.7)]"
              style={{ left: `clamp(1px, calc(${ovrPos}% - 2px), calc(100% - 5px))` }}
            />
          </div>
          <div className="mt-1 flex items-center justify-between text-[10px] text-faint">
            <span>60</span>
            <span>{data.band.max}</span>
          </div>
        </div>

        {/* Attributes */}
        <div>
          <p className="kicker mb-2 text-[11px]">{C.player.attributes}</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {STAT_ORDER.map((k) => (
              <StatBar key={k} label={t.STAT_LABELS[k]} value={Math.round(data.stats[k])} />
            ))}
          </div>
        </div>

        {/* Development / contract */}
        {data.wage !== undefined ? (
          <div className="grid grid-cols-2 gap-3 rounded-lg border border-line bg-white/[0.02] p-3 text-sm sm:grid-cols-3">
            <div>
              <p className="kicker text-[10px]">{C.squad.wage}</p>
              <p className="font-semibold text-ink">{C.squad.perSplit(formatMoney(data.wage))}</p>
            </div>
            {data.contractLabel ? (
              <div>
                <p className="kicker text-[10px]">{C.player.contract}</p>
                <p className="font-semibold text-ink">{data.contractLabel}</p>
              </div>
            ) : null}
            {data.focusLabel ? (
              <div>
                <p className="kicker text-[10px]">{C.player.trainingFocusLabel}</p>
                <p className="font-semibold text-ink">{data.focusLabel}</p>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
