"use client";

import { useState } from "react";
import type { CareerCopy } from "@/content/careerCopy";
import type { CareerSave } from "@/engine/career/types";
import { honorsTableOf } from "@/engine/career/honors";
import { Panel } from "@/components/ui/Panel";
import { AppLink } from "@/components/ui/AppLink";
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
 * the player's own row is set in Demi between two stronger hairlines.
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
      <div className="card-head"><h3 className="card-title">{C.club.honorsTitle}</h3></div>
      {!compact ? <p className="max-w-prose text-sm leading-snug text-sub">{C.club.honorsHint}</p> : null}

      {/* rc9 HQ: the two filters are their own labels (the words on the buttons); the group names stay for a screen reader. */}
      <div className={cx("mb-4 mt-4 grid gap-2", !compact && "sm:max-w-xl sm:grid-cols-2 sm:gap-3")}>
        <fieldset className="min-w-0">
          <legend className="sr-only">{C.club.honorsEntityFilter}</legend>
          <div role="group" aria-label={C.club.honorsEntityFilter} className="flex gap-1.5">
            {(["orgs", "players"] as const).map(k => (
              <button key={k} type="button" aria-pressed={mode === k} onClick={() => setMode(k)} className={filterClass(mode === k)}>
                {k === "orgs" ? C.club.honorsOrgs : C.club.honorsPlayers}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className="min-w-0">
          <legend className="sr-only">{C.club.honorsEventFilter}</legend>
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
                <th scope="col" className="kicker w-10 px-2 pb-2 text-left">#</th>
                <th scope="col" className="kicker px-2 pb-2 text-left">{mode === "orgs" ? C.club.honorsOrgs : C.club.honorsPlayers}</th>
                <th scope="col" className="kicker px-2 pb-2 text-right">{C.club.honorsTitles}</th>
              </tr>
            </thead>
            <tbody>
              {leaders.map(r => {
                const isUser = r.id === "user";
                return (
                  // The user's row: his name in Demi and a stronger hairline above and below, no fill or tag.
                  <tr key={r.id} className={cx("border-b last:border-b-0", isUser ? "border-y border-line-strong" : "border-line")}>
                    <td className="display px-2 py-2.5 text-sm font-semibold tabular-nums text-faint">{r[field] > 0 ? rows.indexOf(r) + 1 : "–"}</td>
                    <th scope="row" className="px-2 py-2.5 text-left font-normal">
                      <span className="flex min-w-0 items-center gap-2">
                        {mode === "orgs" ? <OrgMark save={save} orgRef={r.id} size="xs" /> : null}
                        <span className={cx("min-w-0 truncate", isUser ? "display font-bold text-ink" : "text-sub")}>{r.name}</span>
                      </span>
                    </th>
                    <td className={cx("display px-2 py-2.5 text-right text-xl font-bold tabular-nums leading-none", isUser || r[field] > 0 ? "text-ink" : "text-faint")}>{r[field]}</td>
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
          <div className="mt-1 flex items-center gap-2 border-y border-line-strong px-2 py-2.5 text-sm">
            <OrgMark save={save} orgRef="user" size="xs" />
            <span className="display min-w-0 flex-1 truncate font-bold text-ink">{save.identity.orgName}</span>
            <span className="display ml-2 text-xl font-bold tabular-nums leading-none text-ink">{ownTitles}</span>
          </div>
          <AppLink href="/career/standings#history" className="mt-3 block text-right text-xs font-semibold text-blue-bright underline-offset-4 hover:underline">
            {C.club.honorsAll}
          </AppLink>
        </>
      ) : !save.honorsComplete ? (
        <p className="mt-3 text-xs text-faint">{C.club.honorsLegacy}</p>
      ) : null}
    </Panel>
  );
}
