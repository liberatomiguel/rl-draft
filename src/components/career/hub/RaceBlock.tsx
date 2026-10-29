"use client";

/**
 * Road to Worlds hub — THE RACE BLOCK (RTW-01, R49; ROADMAP UX-01d): a compact
 * Major / Worlds toggle over the user's region — position and points, the
 * cut, the top of the table and the user's row, the fixtures left. It reads
 * the Standings screen's own view-model (careerUi.raceTableOf: the order and
 * the cut the Major / Worlds selection uses), so the two always agree.
 */

import { useMemo, useState } from "react";
import type { CareerCopy } from "@/content/careerCopy";
import type { CareerSave } from "@/engine/career/types";
import { cx } from "@/lib/util";
import { raceTableOf, weekAt, weekOfDay, type RaceKind, type RaceTable } from "@/components/career/careerUi";
import { OrgMark } from "@/components/career/OrgMark";
import { REGION_BADGE } from "@/components/regionStyle";
import { AppLink } from "@/components/ui/AppLink";
import { Badge } from "@/components/ui/Badge";
import { Panel } from "@/components/ui/Panel";

/**
 * The Major race through the preseason and every split week (its Major
 * included); the Worlds race in the windows between splits and on the road
 * to Worlds (W31–32).
 */
export function defaultRaceKind(save: CareerSave): RaceKind {
  const kind = weekAt(weekOfDay(save.clock.day)).kind;
  return kind === "window" || kind === "worldsWindow" || kind === "worlds" ? "worlds" : "major";
}

/** Row indices the compact list shows: the top two, both sides of the cut, the user. */
function compactIndices(table: RaceTable): number[] {
  const user = table.rows.findIndex((r) => r.side === "user");
  return [...new Set([0, 1, table.cut - 1, table.cut, user])]
    .filter((i) => i >= 0 && i < table.rows.length)
    .sort((a, b) => a - b);
}

export function RaceBlock({ save, C }: { save: CareerSave; C: CareerCopy }) {
  const region = save.identity.region;
  const tables = useMemo(
    () => ({ major: raceTableOf(save, region, "major"), worlds: raceTableOf(save, region, "worlds") }),
    [save, region],
  );
  const [picked, setPicked] = useState<RaceKind | null>(null);
  const kind = picked ?? defaultRaceKind(save);
  const table = tables[kind];
  const user = table.userRow;
  const idx = compactIndices(table);
  const lineLabel = kind === "major" ? C.standings.majorLine : C.standings.worldsLine;
  const fixtures =
    kind === "major"
      ? C.race.fixturesMajor(table.fixturesLeft.regionals)
      : C.race.fixturesWorlds(table.fixturesLeft.regionals, table.fixturesLeft.majors);

  return (
    <Panel className="rise-in p-4" style={{ animationDelay: "90ms" }}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="kicker text-[10px]">{C.hub.pointsRace}</p>
        <Badge className={REGION_BADGE[region]}>{region}</Badge>
      </div>

      <div
        role="tablist"
        aria-label={C.race.toggleLabel}
        className="mb-3 grid grid-cols-2 gap-1 rounded-lg border border-line bg-black/20 p-1"
      >
        {(["major", "worlds"] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={kind === k}
            onClick={() => setPicked(k)}
            className={cx(
              "display min-h-11 rounded-md border text-[11px] font-semibold uppercase tracking-[0.1em] transition-colors",
              kind === k
                ? "border-blue/50 bg-blue/15 text-blue-bright"
                : "border-transparent text-sub hover:text-ink",
            )}
          >
            {k === "major" ? C.race.majorToggle : C.race.worldsToggle}
          </button>
        ))}
      </div>

      {user ? (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="display text-xl font-bold text-ink">{C.hub.pointsRank(user.rank, user.points)}</p>
          {table.userStatus === "clinched" ? (
            <Badge tone="good">{C.race.status.clinched}</Badge>
          ) : table.userStatus === "out" ? (
            <Badge tone="bad">{C.race.status.out}</Badge>
          ) : user.inCut ? (
            <Badge tone="good">{C.hub.pointsSafe}</Badge>
          ) : (
            <span className="text-xs font-semibold text-bad">{C.hub.pointsGap(table.userGap)}</span>
          )}
        </div>
      ) : null}

      <ul className="mt-3 space-y-1">
        {idx.map((i, k) => {
          const r = table.rows[i];
          const prev = k > 0 ? table.rows[idx[k - 1]] : null;
          return (
            <li key={r.ref}>
              {prev && prev.rank <= table.cut && r.rank > table.cut ? (
                <div className="my-1.5 flex items-center gap-2" aria-hidden>
                  <span className="flex-1 border-t border-dashed border-blue/60" />
                  <span className="kicker text-[9px] text-blue-bright">{lineLabel}</span>
                  <span className="flex-1 border-t border-dashed border-blue/60" />
                </div>
              ) : prev && r.rank > prev.rank + 1 ? (
                <p className="text-center text-[10px] leading-3 text-faint" aria-hidden>
                  ···
                </p>
              ) : null}
              <div
                className={cx(
                  "flex items-center gap-2 rounded-md px-1.5 py-1",
                  r.side === "user" && "border border-orange/40 bg-orange/10",
                )}
              >
                <span className="display w-5 shrink-0 text-right text-xs font-bold text-faint">{r.rank}</span>
                <OrgMark save={save} orgRef={r.ref} size="xs" />
                <span
                  className={cx(
                    "min-w-0 flex-1 truncate text-xs",
                    r.side === "user" ? "font-bold text-ink" : "text-sub",
                  )}
                >
                  {r.name}
                </span>
                {r.side === "local" ? (
                  <Badge className="shrink-0 !px-1 !py-0 !text-[9px]">{C.race.localTag}</Badge>
                ) : null}
                <span className="display shrink-0 text-xs font-bold text-ink">{r.points}</span>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-faint">{fixtures}</p>
        <AppLink href="/career/standings" className="text-xs font-semibold text-blue-bright hover:underline">
          {C.race.open} →
        </AppLink>
      </div>
    </Panel>
  );
}
