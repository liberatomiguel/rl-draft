"use client";

import { useState } from "react";
import type { CareerCopy } from "@/content/careerCopy";
import type { CareerSave } from "@/engine/career/types";
import { honorsTableOf } from "@/engine/career/honors";
import { Panel } from "@/components/ui/Panel";
import { AppLink } from "@/components/ui/AppLink";
import { Badge } from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/Button";
import { EventTierIcon } from "./event/EventTierIcon";
import { OrgMark } from "./OrgMark";
import { cx } from "@/lib/util";

/** A filter chip: the shared button, its selected state a blue hairline and tint. */
function filterClass(selected: boolean): string {
  return cx(
    buttonClass("secondary", "sm"),
    "min-w-0 flex-1",
    selected ? "!border-blue-bright/60 !bg-blue/15 !text-blue-bright" : "!text-sub hover:!text-ink",
  );
}

/**
 * Shared title race: short HQ card or the full standings list. A real table:
 * the titles column decides the order, so it is the largest thing in a row;
 * the player's own row is a fill.
 */
export function CareerHonorsTable({ save, C, compact = false }: { save: CareerSave; C: CareerCopy; compact?: boolean }) {
  const [mode, setMode] = useState<"orgs" | "players">("orgs");
  const [tier, setTier] = useState<"major" | "worlds">("worlds");
  const field = tier === "major" ? "majors" : "worlds";
  const rows = honorsTableOf(save, mode)
    .filter(r => compact || r[field] > 0 || (mode === "orgs" && r.id === "user"))
    .sort((a, b) => b[field] - a[field] || a.name.localeCompare(b.name));
  const leaders = compact ? rows.filter(r => r.id !== "user").slice(0, 6) : rows;
  const ownTitles = tier === "major" ? save.stats.titlesMajor : save.stats.titlesWorlds;

  return (
    <Panel id={compact ? undefined : "history"} className="scroll-mt-40 p-4 sm:p-5">
      <h3 className="display text-lg uppercase leading-none text-ink">{C.club.honorsTitle}</h3>
      {!compact ? <p className="mt-1.5 max-w-prose text-sm leading-snug text-sub">{C.club.honorsHint}</p> : null}

      <div className={cx("mb-4 mt-4 grid gap-3", !compact && "sm:max-w-xl sm:grid-cols-2")}>
        <fieldset className="min-w-0">
          <legend className="mb-1.5 text-xs text-sub">{C.club.honorsEntityFilter}</legend>
          <div role="group" aria-label={C.club.honorsEntityFilter} className="flex gap-1.5">
            {(["orgs", "players"] as const).map(k => (
              <button key={k} type="button" aria-pressed={mode === k} onClick={() => setMode(k)} className={filterClass(mode === k)}>
                {k === "orgs" ? C.club.honorsOrgs : C.club.honorsPlayers}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className="min-w-0">
          <legend className="mb-1.5 text-xs text-sub">{C.club.honorsEventFilter}</legend>
          <div role="group" aria-label={C.club.honorsEventFilter} className="flex gap-1.5">
            {(["major", "worlds"] as const).map(k => (
              <button key={k} type="button" aria-pressed={tier === k} onClick={() => setTier(k)} className={filterClass(tier === k)}>
                <EventTierIcon tier={k} className="h-4 w-4 shrink-0" />
                {k === "major" ? C.race.majorToggle : C.race.worldsToggle}
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      {leaders.length > 0 ? (
        <div className={cx(!compact && "max-h-[32rem] overflow-y-auto")}>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-line-strong">
                <th scope="col" className="kicker w-10 px-2 pb-2 text-left !text-[11px]">#</th>
                <th scope="col" className="kicker px-2 pb-2 text-left !text-[11px]">{mode === "orgs" ? C.club.honorsOrgs : C.club.honorsPlayers}</th>
                <th scope="col" className="kicker px-2 pb-2 text-right !text-[11px]">{C.club.honorsTitles}</th>
              </tr>
            </thead>
            <tbody>
              {leaders.map(r => {
                const isUser = r.id === "user";
                return (
                  <tr key={r.id} className={cx("border-b border-line last:border-0", isUser && "bg-white/[0.07]")}>
                    <td className="display px-2 py-2.5 text-sm font-semibold text-faint">{r[field] > 0 ? rows.indexOf(r) + 1 : "–"}</td>
                    <th scope="row" className="px-2 py-2.5 text-left font-normal">
                      <span className="flex min-w-0 items-center gap-2">
                        {mode === "orgs" ? <OrgMark save={save} orgRef={r.id} size="xs" /> : null}
                        <span className={cx("min-w-0 truncate", isUser ? "font-semibold text-ink" : "text-ink")}>{r.name}</span>
                        {isUser ? <Badge tone="orange" className="shrink-0">{C.standings.userChip}</Badge> : null}
                      </span>
                    </th>
                    <td className="display px-2 py-2.5 text-right text-xl font-bold leading-none text-ink">{r[field]}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="py-4 text-sm text-sub">{C.club.honorsEmpty}</p>
      )}

      {compact ? (
        <>
          <div className="mt-2 flex items-center gap-2 border-t border-line-strong bg-white/[0.07] px-2 py-2.5 text-sm">
            <OrgMark save={save} orgRef="user" size="xs" />
            <span className="min-w-0 flex-1 truncate font-semibold text-ink">{save.identity.orgName}</span>
            <Badge tone="orange" className="shrink-0">{C.standings.userChip}</Badge>
            <span className="display ml-2 text-xl font-bold leading-none text-ink">{ownTitles}</span>
          </div>
          <AppLink href="/career/standings#history" className="mt-3 block text-right text-xs font-semibold text-blue-bright hover:text-ink">
            {C.club.honorsAll} →
          </AppLink>
        </>
      ) : !save.honorsComplete ? (
        <p className="mt-3 text-xs text-faint">{C.club.honorsLegacy}</p>
      ) : null}
    </Panel>
  );
}
