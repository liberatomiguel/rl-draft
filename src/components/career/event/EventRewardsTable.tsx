import type { CareerCopy } from "@/content/careerCopy";
import type { CareerEventDef, CareerSave } from "@/engine/career/types";
import type { Placement } from "@/engine/types";
import { prizeScheduleFor, pointsFor } from "@/engine/career/economy";
import { formatMoney } from "@/lib/format";
import { CoinsIcon, StarIcon, TrophyIcon } from "@/components/ui/icons";
import { cx } from "@/lib/util";

const PLACEMENT_MARK: Record<Placement, string> = { champion: "1", runner_up: "2", third: "3", fourth: "4", top4: "3–4", top6: "5–6", top8: "5–8", swiss_exit: "9+" };

const MEDAL: Partial<Record<Placement, { chip: string; bar: string; text: string }>> = {
  champion: { chip: "border-amber-300/50 bg-amber-300/15 text-amber-300", bar: "bg-amber-300/70", text: "text-amber-300" },
  runner_up: { chip: "border-slate-300/40 bg-slate-300/10 text-slate-200", bar: "bg-slate-300/60", text: "text-ink" },
  third: { chip: "border-orange/40 bg-orange/10 text-orange-bright", bar: "bg-orange/60", text: "text-ink" },
  top4: { chip: "border-orange/40 bg-orange/10 text-orange-bright", bar: "bg-orange/60", text: "text-ink" },
};
const PLAIN = { chip: "border-line bg-white/[0.03] text-sub", bar: "bg-blue/45", text: "text-ink" };

/**
 * The exact payout table used by settlement, including difficulty and season growth.
 * rc.49: drawn as a podium list — a medal chip, a bar on the champion's prize, the cash and the points.
 */
export function EventRewardsTable({ save, def, C, compact = false }: { save: CareerSave; def: CareerEventDef; C: CareerCopy; compact?: boolean }) {
  const schedule = prizeScheduleFor(def.tier, def.format, save.difficulty, def.seasonIndex);
  const hasPoints = def.tier === "regional" || def.tier === "major";
  const rows = Object.entries(schedule) as [Placement, number][];
  const top = Math.max(1, ...rows.map(([, prize]) => prize));
  return <div className={compact ? "mt-4" : "panel flex flex-1 flex-col p-4"}>
    <div className="mb-3 flex items-center justify-between gap-2">
      <span className="flex items-center gap-2"><TrophyIcon className="h-4 w-4 text-orange-bright" /><span className="kicker text-[10px]">{C.event.rewardsTable}</span></span>
      <span className="flex items-center gap-3 text-[10px] text-faint">
        <span className="inline-flex items-center gap-1"><CoinsIcon className="h-3.5 w-3.5" />{C.common.prize}</span>
        {hasPoints ? <span className="inline-flex items-center gap-1"><StarIcon className="h-3.5 w-3.5" />{C.standings.ptsShort}</span> : null}
      </span>
    </div>
    <ol className="space-y-1.5">
      {rows.map(([placement, prize]) => {
        const m = MEDAL[placement] ?? PLAIN;
        return <li key={placement} className={cx("relative overflow-hidden rounded-lg border px-2.5 py-2", placement === "champion" ? "border-amber-300/30 bg-amber-300/[0.05]" : "border-line bg-white/[0.02]")}>
          <span aria-hidden className={cx("absolute inset-y-0 left-0 opacity-[0.14]", m.bar)} style={{ width: `${Math.max(4, Math.round((prize / top) * 100))}%` }} />
          <span className="relative flex items-center gap-2.5 text-xs">
            <span className={cx("display flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-[10px] font-bold", m.chip)}>{placement === "champion" ? <TrophyIcon className="h-4 w-4" /> : PLACEMENT_MARK[placement]}</span>
            <span className="min-w-0 flex-1 truncate font-medium text-ink">{C.common.placement[placement]}</span>
            <span className={cx("font-mono font-semibold", m.text)}>{formatMoney(prize)}</span>
            {hasPoints ? <span className="w-10 shrink-0 rounded-md bg-blue/10 py-0.5 text-center font-mono text-[11px] font-semibold text-blue-bright">{pointsFor(def.tier, placement)}</span> : null}
          </span>
        </li>;
      })}
    </ol>
  </div>;
}
