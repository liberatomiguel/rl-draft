"use client";

import { useState } from "react";
import type { CareerCopy } from "@/content/careerCopy";
import type { CareerSave } from "@/engine/career/types";
import { honorsTableOf } from "@/engine/career/honors";
import { Panel } from "@/components/ui/Panel";
import { OrgMark } from "./OrgMark";
import { cx } from "@/lib/util";

export function CareerHonorsTable({ save, C }: { save: CareerSave; C: CareerCopy }) {
  const [mode, setMode] = useState<"orgs" | "players">("orgs");
  const rows = honorsTableOf(save, mode);
  return <Panel className="mb-4 p-4 sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="display text-xl font-bold text-ink">{C.club.honorsTitle}</h2><div className="flex gap-2">{(["orgs", "players"] as const).map(k => <button key={k} type="button" aria-pressed={mode === k} onClick={() => setMode(k)} className={cx("min-h-11 rounded-lg border px-3 text-xs", mode === k ? "border-blue bg-blue/15 text-ink" : "border-line text-sub")}>{k === "orgs" ? C.club.honorsOrgs : C.club.honorsPlayers}</button>)}</div></div>
    <p className="mb-3 mt-1 text-xs text-sub">{C.club.honorsHint}</p>
    <div className="max-h-96 overflow-y-auto"><table className="w-full text-sm"><thead className="sticky top-0 bg-raised"><tr className="border-b border-line"><th className="py-2 text-left text-xs text-sub" scope="col">{mode === "orgs" ? C.club.honorsOrgs : C.club.honorsPlayers}</th><th className="px-2 text-right text-xs text-sub" scope="col">{C.common.tier.major}</th><th className="px-2 text-right text-xs text-sub" scope="col">{C.common.tier.worlds}</th></tr></thead><tbody>{rows.map(r => <tr key={r.id} className={cx("border-b border-line/50", r.id === "user" && "bg-orange/10")}><th scope="row" className="py-2 text-left font-medium"><span className="flex items-center gap-2">{mode === "orgs" ? <OrgMark save={save} orgRef={r.id} size="xs" /> : null}{r.name}</span></th><td className="px-2 text-right font-mono text-blue-bright">{r.majors}</td><td className="px-2 text-right font-mono font-bold text-orange-bright">{r.worlds}</td></tr>)}</tbody></table></div>
    {!save.honorsComplete ? <p className="mt-2 text-[11px] text-faint">{C.club.honorsLegacy}</p> : null}
  </Panel>;
}
