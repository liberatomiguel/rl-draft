"use client";
import type { CareerSave, CareerEventDef } from "@/engine/career/types";
import type { CareerCopy } from "@/content/careerCopy";
import { communityParticipantsFor } from "@/engine/career/community";
import { useCareerStore } from "@/store/careerStore";
import { cx } from "@/lib/util";

export function CommunityLineup({ save, def, C }: { save: CareerSave; def: CareerEventDef; C: CareerCopy }) {
  const choose = useCareerStore(s => s.setCommunityParticipants);
  if (!def.teamSize) return null;
  const ids = communityParticipantsFor(save, def);
  return <fieldset className="mt-4"><legend className="kicker mb-2 text-[10px]">{C.event.communityLineup(def.teamSize)}</legend>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{save.squad.map(p => {
      const selected = ids.includes(p.id);
      return <button key={p.id} type="button" aria-pressed={selected} onClick={() => {
        if (selected) return;
        choose([...ids.slice(1), p.id]);
      }} className={cx("min-h-24 rounded-xl border p-3 text-left transition-colors", selected ? "border-orange bg-orange/10" : "border-line bg-white/5 hover:border-orange/50")}>
        <span className="display block text-2xl font-bold text-ink">{Math.round(p.overall)}</span>
        <span className="block truncate text-sm font-semibold text-ink">{p.name}</span>
        <span className="text-xs text-sub">{selected ? C.event.communitySeat(ids.indexOf(p.id) + 1) + " ✓" : C.common.ovr}</span>
      </button>;
    })}</div>
  </fieldset>;
}
