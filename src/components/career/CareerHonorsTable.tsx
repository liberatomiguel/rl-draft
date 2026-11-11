"use client";

import { useState } from "react";
import type { CareerCopy } from "@/content/careerCopy";
import type { CareerSave } from "@/engine/career/types";
import { honorsTableOf } from "@/engine/career/honors";
import { Panel } from "@/components/ui/Panel";
import { AppLink } from "@/components/ui/AppLink";
import { Badge } from "@/components/ui/Badge";
import { TrophyIcon } from "@/components/ui/icons";
import { EventTierIcon } from "./event/EventTierIcon";
import { OrgMark } from "./OrgMark";
import { cx } from "@/lib/util";

/** Shared title race: short HQ card or the full standings list. */
export function CareerHonorsTable({ save, C, compact = false }: { save: CareerSave; C: CareerCopy; compact?: boolean }) {
  const [mode, setMode] = useState<"orgs" | "players">("orgs");
  const [tier, setTier] = useState<"major" | "worlds">("worlds");
  const field = tier === "major" ? "majors" : "worlds";
  const rows = honorsTableOf(save, mode)
    .filter(r => compact || r[field] > 0 || (mode === "orgs" && r.id === "user"))
    .sort((a, b) => b[field] - a[field] || a.name.localeCompare(b.name));
  const leaders = compact ? rows.filter(r => r.id !== "user").slice(0, 6) : rows;
  const ownTitles = tier === "major" ? save.stats.titlesMajor : save.stats.titlesWorlds;
  const filterClass = (selected: boolean) => cx(
    "display min-h-11 min-w-0 flex-1 rounded-md border px-2 text-[10px] font-semibold uppercase tracking-[0.1em] transition-colors focus-visible:outline-2 focus-visible:outline-blue-bright",
    selected ? "border-blue/70 bg-blue/25 text-ink shadow-sm" : "border-transparent text-sub hover:text-ink",
  );

  return (
    <Panel id={compact ? undefined : "history"} className="scroll-mt-40 p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="kicker text-[11px]">{C.club.honorsTitle}</h2>
        <TrophyIcon className="h-4 w-4 shrink-0 text-faint" />
      </div>
      <div className={cx("mb-3 grid gap-2", !compact && "sm:max-w-lg sm:grid-cols-2")}>
        <fieldset className="min-w-0"><legend className="mb-1 text-[10px] text-faint">{C.club.honorsEntityFilter}</legend><div role="group" aria-label={C.club.honorsEntityFilter} className="flex gap-1 rounded-lg border border-line bg-black/20 p-1">
          {(["orgs", "players"] as const).map(k => <button key={k} type="button" aria-pressed={mode === k} onClick={() => setMode(k)} className={filterClass(mode === k)}>{k === "orgs" ? C.club.honorsOrgs : C.club.honorsPlayers}</button>)}
        </div>
        </fieldset><fieldset className="min-w-0"><legend className="mb-1 text-[10px] text-faint">{C.club.honorsEventFilter}</legend><div role="group" aria-label={C.club.honorsEventFilter} className="flex gap-1 rounded-lg border border-line bg-black/20 p-1">
          {(["major", "worlds"] as const).map(k => <button key={k} type="button" aria-pressed={tier === k} onClick={() => setTier(k)} className={filterClass(tier === k)}><span className="inline-flex items-center justify-center gap-1.5"><EventTierIcon tier={k} className="h-3.5 w-3.5 shrink-0" />{k === "major" ? C.race.majorToggle : C.race.worldsToggle}</span></button>)}
        </div>
        </fieldset>
      </div>
      {!compact ? <p className="mb-3 text-xs text-sub">{C.club.honorsHint}</p> : null}
      {leaders.length > 0 ? (
        <div className={cx(!compact && "max-h-[32rem] overflow-y-auto")}>
          <table className="w-full text-xs">
            <thead><tr className="border-b border-line text-faint"><th scope="col" className="w-8 pb-2 text-left font-normal">#</th><th scope="col" className="pb-2 text-left font-normal">{mode === "orgs" ? C.club.honorsOrgs : C.club.honorsPlayers}</th><th scope="col" className="pb-2 text-right font-normal">{C.club.honorsTitles}</th></tr></thead>
            <tbody>{leaders.map(r => (
              <tr key={r.id} className={cx("border-b border-line/60 last:border-0", r.id === "user" && "bg-orange/[0.06]")}>
                <td className="py-2.5 font-mono text-[10px] text-faint">{r[field] > 0 ? rows.indexOf(r) + 1 : "—"}</td>
                <th scope="row" className="py-2.5 text-left font-medium text-sub"><span className="flex items-center gap-2">{mode === "orgs" ? <OrgMark save={save} orgRef={r.id} size="xs" /> : null}<span className={r.id === "user" ? "font-semibold text-ink" : undefined}>{r.name}</span>{r.id === "user" ? <Badge tone="orange" className="!px-1.5 !text-[9px]">{C.standings.userChip}</Badge> : null}</span></th>
                <td className="py-2.5 text-right font-mono font-semibold text-ink">{r[field]}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      ) : <p className="py-4 text-center text-xs text-faint">{C.club.honorsEmpty}</p>}
      {compact ? <>
        <div className="mt-2 flex items-center gap-2 border-t border-line pt-3 text-xs">
          <OrgMark save={save} orgRef="user" size="xs" />
          <span className="min-w-0 flex-1 truncate font-semibold text-ink">{save.identity.orgName}</span>
          <Badge tone="orange" className="!px-1.5 !text-[9px]">{C.standings.userChip}</Badge>
          <span className="ml-2 font-mono font-semibold text-ink">{ownTitles}</span>
        </div>
        <AppLink href="/career/standings#history" className="mt-3 block text-right text-xs font-semibold text-blue-bright hover:text-ink">{C.club.honorsAll} →</AppLink>
      </> : !save.honorsComplete ? <p className="mt-3 text-[11px] text-faint">{C.club.honorsLegacy}</p> : null}
    </Panel>
  );
}
