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
    <div className="flex flex-col gap-3"><h2 className="display text-lg font-bold text-ink">{C.club.honorsTitle}</h2><div className="flex gap-2">{(["orgs", "players"] as const).map(k => <button key={k} type="button" aria-pressed={mode === k} onClick={() => setMode(k)} className={cx("min-h-11 rounded-lg border px-3 text-xs", mode === k ? "border-blue bg-blue/15 text-ink" : "border-line text-sub")}>{k === "orgs" ? C.club.honorsOrgs : C.club.honorsPlayers}</button>)}</div></div>
    <p className="mb-3 mt-1 text-xs text-sub">{C.club.honorsHint}</p>
    <div className="max-h-72 overflow-y-auto rounded-lg border border-line bg-black/20 px-2"><table className="w-full text-sm"><thead className="sticky top-0 bg-raised"><tr className="border-b border-line"><th className="py-2 text-left text-xs text-sub" scope="col">{mode === "orgs" ? C.club.honorsOrgs : C.club.honorsPlayers}</th><th className="px-2 text-right text-xs text-sub" scope="col">{C.common.tier.major}</th><th className="px-2 text-right text-xs text-sub" scope="col">{C.common.tier.worlds}</th></tr></thead><tbody>{rows.map((r,index) => <tr key={r.id} className={cx("border-b border-line/50", r.id === "user" && "bg-orange/10")}><th scope="row" className="py-2 text-left font-medium"><span className="flex items-center gap-2"><span className="w-5 shrink-0 font-mono text-[10px] text-faint">{index + 1}</span>{mode === "orgs" ? <OrgMark save={save} orgRef={r.id} size="xs" /> : null}{r.name}</span></th><td className="px-2 text-right font-mono text-blue-bright">{r.majors}</td><td className="px-2 text-right font-mono text-lg font-bold text-orange-bright"><span className="inline-flex min-w-8 justify-center rounded-md bg-orange/10 px-2 py-1">{r.worlds}</span></td></tr>)}</tbody></table></div>
    {!save.honorsComplete ? <p className="mt-2 text-[11px] text-faint">{C.club.honorsLegacy}</p> : null}
  </Panel>;
}
