import type { CareerCopy } from "@/content/careerCopy";
import type { CareerEventDef, CareerSave } from "@/engine/career/types";
import type { Placement } from "@/engine/types";
import { prizeScheduleFor, pointsFor } from "@/engine/career/economy";
import { formatMoney } from "@/lib/format";
import { CoinsIcon, StarIcon, TrophyIcon } from "@/components/ui/icons";
import { cx } from "@/lib/util";

const PLACEMENT_MARK: Record<Placement, string> = { champion: "1", runner_up: "2", third: "3", fourth: "4", top4: "3–4", top6: "5–6", top8: "5–8", swiss_exit: "9+" };

/** The exact payout table used by settlement, including difficulty and season growth. */
export function EventRewardsTable({ save, def, C, compact = false }: { save: CareerSave; def: CareerEventDef; C: CareerCopy; compact?: boolean }) {
  const schedule = prizeScheduleFor(def.tier, def.format, save.difficulty, def.seasonIndex);
  const hasPoints = def.tier === "regional" || def.tier === "major";
  return <div className={compact ? "mt-4" : "panel flex flex-1 flex-col p-4"}>
    <div className="mb-3 flex items-center gap-2"><TrophyIcon className="h-4 w-4 text-orange-bright" /><p className="kicker text-[10px]">{C.event.rewardsTable}</p></div>
    <table className="w-full text-xs">
      <thead><tr className="border-b border-line text-sub"><th scope="col" className="pb-2 text-left font-normal">{C.event.placementLabel}</th><th scope="col" className="pb-2 text-right font-normal"><span className="inline-flex items-center gap-1"><CoinsIcon className="h-3.5 w-3.5" />{C.common.prize}</span></th>{hasPoints ? <th scope="col" className="pb-2 pl-2 text-right font-normal"><span className="inline-flex items-center gap-1"><StarIcon className="h-3.5 w-3.5" />{C.standings.ptsShort}</span></th> : null}</tr></thead>
      <tbody>{Object.entries(schedule).map(([placement, prize]) => <tr key={placement} className={cx("border-b border-line/50 last:border-0", placement === "champion" && "bg-orange/[0.04]")}><th scope="row" className="py-2.5 text-left font-medium text-ink"><span className="flex items-center gap-2"><span className={cx("display flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-[10px] font-bold", placement === "champion" ? "border-orange/30 bg-orange/10 text-orange-bright" : "border-line bg-white/[0.03] text-sub")}>{placement === "champion" ? <TrophyIcon className="h-4 w-4" /> : PLACEMENT_MARK[placement as Placement]}</span>{C.common.placement[placement as Placement]}</span></th><td className={cx("py-2.5 text-right font-mono font-semibold", placement === "champion" ? "text-orange-bright" : "text-ink")}>{formatMoney(prize)}</td>{hasPoints ? <td className="py-2.5 pl-2 text-right font-mono text-blue-bright">{pointsFor(def.tier, placement as Placement)}</td> : null}</tr>)}</tbody>
    </table>
  </div>;
}
