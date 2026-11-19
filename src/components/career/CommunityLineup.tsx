"use client";
import type { CareerSave, CareerEventDef } from "@/engine/career/types";
import type { CareerCopy } from "@/content/careerCopy";
import { communityParticipantsFor } from "@/engine/career/community";
import { useCareerStore } from "@/store/careerStore";
import { cx } from "@/lib/util";
import { CheckIcon } from "@/components/ui/icons";

export function CommunityLineup({ save, def, C }: { save: CareerSave; def: CareerEventDef; C: CareerCopy }) {
  const choose = useCareerStore(s => s.setCommunityParticipants);
  if (!def.teamSize) return null;
  const ids = communityParticipantsFor(save, def);
  // Each player is one tile (a single object): the overall as the figure, the
  // name, then his seat. A picked player is marked by the orange hairline only.
  return <fieldset className="mt-4"><legend className="kicker mb-2">{C.event.communityLineup(def.teamSize)}</legend>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{save.squad.map(p => {
      const selected = ids.includes(p.id);
      return <button key={p.id} type="button" aria-pressed={selected} onClick={() => {
        if (selected) return;
        choose([...ids.slice(1), p.id]);
      }} className={cx("min-h-24 rounded-xl border bg-surface p-3 text-left transition-colors", selected ? "border-orange" : "border-line hover:border-line-strong")}>
        <span className="display block text-3xl font-bold leading-none text-ink">{Math.round(p.overall)}</span>
        <span className="mt-1.5 block truncate text-sm font-semibold text-ink">{p.name}</span>
        <span className={cx("mt-0.5 flex items-center gap-1 text-xs", selected ? "text-orange-bright" : "text-sub")}>
          {selected ? <CheckIcon className="h-4 w-4 shrink-0" /> : null}
          {selected ? C.event.communitySeat(ids.indexOf(p.id) + 1) : C.common.ovr}
        </span>
      </button>;
    })}</div>
  </fieldset>;
}
