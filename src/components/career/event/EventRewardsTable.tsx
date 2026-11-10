import type { CareerCopy } from "@/content/careerCopy";
import type { CareerEventDef, CareerSave } from "@/engine/career/types";
import type { Placement } from "@/engine/types";
import { prizeScheduleFor, pointsFor } from "@/engine/career/economy";
import { formatMoney } from "@/lib/format";

/** The exact payout table used by settlement, including difficulty and season growth. */
export function EventRewardsTable({ save, def, C, compact = false }: { save: CareerSave; def: CareerEventDef; C: CareerCopy; compact?: boolean }) {
  const schedule = prizeScheduleFor(def.tier, def.format, save.difficulty, def.seasonIndex);
  const hasPoints = def.tier === "regional" || def.tier === "major";
  return <div className={compact ? "mt-3" : "panel p-4"}>
    <p className="kicker mb-2 text-[10px]">{C.event.rewardsTable}</p>
    <table className="w-full text-xs">
      <thead><tr className="border-b border-line text-sub"><th scope="col" className="pb-2 text-left">{C.event.placementLabel}</th><th scope="col" className="pb-2 text-right">{C.common.prize}</th>{hasPoints ? <th scope="col" className="pb-2 text-right">{C.standings.ptsShort}</th> : null}</tr></thead>
      <tbody>{Object.entries(schedule).map(([placement, prize]) => <tr key={placement} className="border-b border-line/50 last:border-0"><th scope="row" className="py-1.5 text-left font-normal text-sub">{C.common.placement[placement as Placement]}</th><td className="py-1.5 text-right font-mono font-semibold text-orange-bright">{formatMoney(prize)}</td>{hasPoints ? <td className="py-1.5 text-right font-mono text-blue-bright">{pointsFor(def.tier, placement as Placement)}</td> : null}</tr>)}</tbody>
    </table>
  </div>;
}
