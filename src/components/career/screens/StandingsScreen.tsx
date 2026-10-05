"use client";

/**
 * Road to Worlds — Standings: the split race (Major cut-line) and the
 * season-long Road to Worlds (Worlds cut-line), per region.
 *
 * Design §11: the dashed cut-line is THE measuring stick — always visible,
 * always labeled. Blue = structure (tabs, tables, cut-lines); the user row
 * carries the org's own colors.
 *
 * v0.2 UX pass: shared OrgMark dispatcher, day-clock remaining-events scan,
 * FORM chips (last placements this season), expandable rows with the org's
 * split/season points, crest-led hero.
 */

import { useMemo, useState } from "react";
import { CAREER_CALENDAR, CAREER_POINTS } from "@/config/balance";
// Sanctioned by the UI build brief: the remaining-events scan needs the pure
// schedule helper, which careerUi does not re-export.
import { officialEventDefsForWeek } from "@/engine/career/calendar";
import type { CareerSave } from "@/engine/career/types";
import type { Placement } from "@/engine/types";
import type { Region } from "@/engine/types";
import { useCareerCopy } from "@/content/careerCopy";
import { cx } from "@/lib/util";
import { useMounted } from "@/store/useMounted";
import { Badge } from "@/components/ui/Badge";
import { Panel, SectionTitle } from "@/components/ui/Panel";
import { REGION_BADGE } from "@/components/regionStyle";
import { OrgMark } from "@/components/career/OrgMark";
import { OrgSheet } from "@/components/career/OrgSheet";
import { TeamStars } from "@/components/career/TeamStars";
import {
  CAREER_SLOTS,
  eventDayFor,
  standingsRows,
  useCareerSave,
  userStars,
  weekOfDay,
  type StandingsRow,
} from "@/components/career/careerUi";

const REGIONS = Object.keys(CAREER_SLOTS.major) as Region[];

// ---------------------------------------------------------------------------
// Derived rows
// ---------------------------------------------------------------------------

/**
 * standingsRows + the region's remaining orgs at 0 points, so the table (and
 * its cut-line) reads complete from week 1 instead of growing as results land.
 */
function fullTable(save: CareerSave, region: Region, kind: "split" | "season"): StandingsRow[] {
  const base = standingsRows(save, region, kind);
  const seen = new Set(base.map((r) => r.ref));
  const fillers: StandingsRow[] = Object.values(save.world.orgs)
    .filter((o) => o.region === region && !seen.has(o.ref))
    .map((o) => ({ ref: o.ref, name: o.name, points: 0, isUser: false, stars: o.stars, rank: 0 }));
  const rows = [...base, ...fillers].sort(
    (a, b) => b.points - a.points || a.name.localeCompare(b.name),
  );
  return rows.map((r, i) => ({ ...r, rank: i + 1 }));
}

/**
 * Official events still ahead this season where the user can score points —
 * v0.2 day clock: an event only counts while its matchday is still ahead.
 */
function remainingOfficialEvents(save: CareerSave): { regionals: number; majors: number } {
  let regionals = 0;
  let majors = 0;
  for (let w = weekOfDay(save.clock.day); w <= CAREER_CALENDAR.weeksPerSeason; w++) {
    if (eventDayFor(w) <= save.clock.day) continue;
    for (const def of officialEventDefsForWeek(save.clock.seasonIndex, w)) {
      if (def.tier === "major") majors += 1;
      else if (def.tier === "regional" && def.region === save.identity.region) regionals += 1;
    }
  }
  return { regionals, majors };
}

/** Last placements per org-ref this season (chronological, newest last). */
function formMap(save: CareerSave, keep: number): Map<string, Placement[]> {
  const map = new Map<string, Placement[]>();
  const events = [...save.eventResults].sort((a, b) => a.week - b.week);
  for (const ev of events) {
    for (const row of ev.rows) {
      const arr = map.get(row.ref);
      if (arr) arr.push(row.placement);
      else map.set(row.ref, [row.placement]);
    }
  }
  for (const [ref, arr] of map) {
    if (arr.length > keep) map.set(ref, arr.slice(-keep));
  }
  return map;
}

// ---------------------------------------------------------------------------
// FORM chips — placement rendered as a tiny rank chip (numbers are
// language-neutral; the full placement label rides on the title/tooltip).
// ---------------------------------------------------------------------------

const FORM_CHIP: Record<Placement, { label: string; cls: string }> = {
  champion: { label: "1", cls: "border-amber-400/50 bg-amber-400/15 text-amber-300" },
  runner_up: { label: "2", cls: "border-good/40 bg-good/10 text-good" },
  third: { label: "3", cls: "border-good/30 bg-good/5 text-good" },
  fourth: { label: "4", cls: "border-blue/40 bg-blue/10 text-blue-bright" },
  top4: { label: "4", cls: "border-blue/40 bg-blue/10 text-blue-bright" },
  top6: { label: "6", cls: "border-line-strong bg-white/5 text-sub" },
  top8: { label: "8", cls: "border-line-strong bg-white/5 text-sub" },
  swiss_exit: { label: "9+", cls: "border-bad/30 bg-bad/10 text-bad/80" },
};

function FormChips({
  placements,
  labels,
}: {
  placements: Placement[] | undefined;
  labels: Record<string, string>;
}) {
  if (!placements || placements.length === 0) {
    return <span className="text-[10px] text-faint">—</span>;
  }
  return (
    <span className="inline-flex items-center gap-1">
      {placements.map((p, i) => (
        <span
          key={i}
          title={labels[p] ?? p}
          className={cx(
            "display inline-flex h-5 min-w-5 items-center justify-center rounded border px-0.5 text-[9px] font-bold",
            FORM_CHIP[p].cls,
          )}
        >
          {FORM_CHIP[p].label}
        </span>
      ))}
    </span>
  );
}

// ---------------------------------------------------------------------------
// The table (shared by both tabs; only the cut position/label changes)
// ---------------------------------------------------------------------------

function StandingsTable({
  save,
  region,
  rows,
  cut,
  cutLabel,
  userStarCount,
  form,
  onOpenOrg,
}: {
  save: CareerSave;
  region: Region;
  rows: StandingsRow[];
  cut: number;
  cutLabel: string;
  userStarCount: number;
  form: Map<string, Placement[]>;
  onOpenOrg: (ref: string) => void;
}) {
  const copy = useCareerCopy();
  const [expandedRef, setExpandedRef] = useState<string | null>(null);
  const placementLabels = copy.common.placement as Record<string, string>;

  const trs: React.ReactNode[] = [];
  for (const row of rows) {
    const expanded = expandedRef === row.ref;
    // User row keeps its expand-in-place detail; AI rows open the org sheet.
    const activate = row.isUser
      ? () => setExpandedRef(expanded ? null : row.ref)
      : () => onOpenOrg(row.ref);
    trs.push(
      <tr
        key={row.ref}
        tabIndex={0}
        aria-expanded={row.isUser ? expanded : undefined}
        title={row.isUser ? undefined : copy.orgSheet.viewTeam}
        onClick={activate}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            activate();
          }
        }}
        className={cx(
          "cursor-pointer border-b border-line transition-colors focus-visible:outline-none focus-visible:bg-white/6",
          row.isUser ? "bg-white/4 hover:bg-white/6" : "hover:bg-white/3",
          expanded && "!border-b-0 bg-white/5",
        )}
      >
        <td
          className="w-10 px-2 py-2 text-center"
          style={{
            borderLeft: `3px solid ${row.isUser ? save.identity.colors.primary : "transparent"}`,
          }}
        >
          <span
            className={cx(
              "display text-sm font-bold",
              row.isUser ? "text-ink" : row.rank <= cut ? "text-sub" : "text-faint",
            )}
          >
            {row.rank}
          </span>
        </td>
        <td className="px-2 py-2">
          <span className="flex min-w-0 items-center gap-2.5">
            <OrgMark save={save} orgRef={row.ref} />
            <span
              className={cx(
                "truncate text-sm",
                row.isUser ? "font-semibold text-ink" : "text-sub",
              )}
            >
              {row.name}
            </span>
            <TeamStars
              stars={row.isUser ? userStarCount : row.stars}
              size="xs"
              className="shrink-0"
            />
            {row.isUser ? (
              <Badge tone="orange" className="shrink-0 !px-1.5 !text-[9px]">
                {copy.standings.userChip}
              </Badge>
            ) : null}
          </span>
        </td>
        <td className="hidden px-2 py-2 text-right sm:table-cell">
          <FormChips placements={form.get(row.ref)} labels={placementLabels} />
        </td>
        <td className="px-3 py-2 text-right">
          <span className={cx("display text-sm font-bold", row.isUser ? "text-orange-bright" : "text-ink")}>
            {row.points}
          </span>
          <span className="ml-1 text-[10px] text-faint">{copy.standings.ptsShort}</span>
        </td>
      </tr>,
    );
    if (expanded) {
      const splitPts = save.competition.splitPoints[region]?.[row.ref] ?? 0;
      const seasonPts = save.competition.seasonPoints[region]?.[row.ref] ?? 0;
      trs.push(
        <tr key={`x:${row.ref}`} className="border-b border-line">
          <td colSpan={4} className="px-3 pb-3 pt-0">
            <div className="rise-in flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-line bg-black/20 px-3 py-2.5">
              <span className="min-w-0">
                <span className="kicker block !text-[9px]">{copy.standings.splitTab}</span>
                <span className="display text-sm font-bold text-ink">
                  {splitPts}
                  <span className="ml-1 text-[10px] font-normal text-faint">
                    {copy.standings.ptsShort}
                  </span>
                </span>
              </span>
              <span className="min-w-0">
                <span className="kicker block !text-[9px]">{copy.standings.seasonTab}</span>
                <span className="display text-sm font-bold text-ink">
                  {seasonPts}
                  <span className="ml-1 text-[10px] font-normal text-faint">
                    {copy.standings.ptsShort}
                  </span>
                </span>
              </span>
              <span className="min-w-0">
                <span className="kicker block !text-[9px]">{copy.club.stars}</span>
                <TeamStars stars={row.isUser ? userStarCount : row.stars} size="sm" />
              </span>
              <span className="min-w-0 sm:hidden">
                <span className="kicker block !text-[9px]">{copy.hub.form}</span>
                <FormChips placements={form.get(row.ref)} labels={placementLabels} />
              </span>
            </div>
          </td>
        </tr>,
      );
    }
    if (row.rank === cut && rows.length > cut) {
      trs.push(
        <tr key={`cut:${row.ref}`}>
          <td colSpan={4} className="border-b-2 border-dashed border-blue/60 px-3 pb-1 pt-0.5">
            <span className="kicker block text-right !text-[9px] !tracking-[0.2em] text-blue-bright">
              {cutLabel}
            </span>
          </td>
        </tr>,
      );
    }
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[22rem] border-collapse">
        <thead>
          <tr className="border-b border-line-strong">
            <th className="kicker w-10 px-2 pb-2 text-center !text-[9px]">#</th>
            <th aria-label={copy.standings.title} className="px-2 pb-2" />
            <th className="kicker hidden px-2 pb-2 text-right !text-[9px] sm:table-cell">
              {copy.hub.form}
            </th>
            <th className="kicker px-3 pb-2 text-right !text-[9px]">
              {copy.standings.ptsShort}
            </th>
          </tr>
        </thead>
        <tbody>{trs}</tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export function StandingsScreen() {
  const copy = useCareerCopy();
  const mounted = useMounted();
  const save = useCareerSave();
  const [tab, setTab] = useState<"split" | "season">("split");
  const [pickedRegion, setPickedRegion] = useState<Region | null>(null);
  // One sheet for the whole screen — any AI org row/card opens it.
  const [sheetRef, setSheetRef] = useState<string | null>(null);

  // Team assembly is not free — recompute only when the squad/world can have
  // actually moved, not on every save tick.
  const starterKey = save?.starterIds.join(",") ?? "";
  const userStarCount = useMemo(
    () => (save ? userStars(save) : 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [save?.world.version, starterKey, save?.reputation],
  );
  const form = useMemo(
    () => (save ? formMap(save, 3) : new Map<string, Placement[]>()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [save?.eventResults.length, save?.clock.seasonIndex],
  );

  if (!mounted) {
    return (
      <div className="mx-auto max-w-6xl px-3 py-6 sm:px-4">
        <div className="space-y-4" aria-busy>
          <div className="h-10 w-56 animate-pulse rounded-lg bg-white/5" />
          <div className="h-11 w-80 max-w-full animate-pulse rounded-lg bg-white/5" />
          <div className="h-96 animate-pulse rounded-2xl bg-white/5" />
        </div>
      </div>
    );
  }
  if (!save) return null;

  const region = pickedRegion ?? save.identity.region;
  const rows = fullTable(save, region, tab);
  const cut = tab === "split" ? CAREER_SLOTS.major[region] : CAREER_SLOTS.worlds[region];
  const cutLabel = tab === "split" ? copy.standings.majorLine : copy.standings.worldsLine;

  // Season-tab hero: the user's own Worlds race, always vs their home region.
  const homeRows = fullTable(save, save.identity.region, "season");
  const homeCut = CAREER_SLOTS.worlds[save.identity.region];
  const userRow = homeRows.find((r) => r.isUser);
  const seatHolder = homeRows[homeCut - 1];
  const safe = userRow ? userRow.rank <= homeCut : false;
  const gap = userRow && seatHolder ? Math.max(0, seatHolder.points - userRow.points) : 0;
  const { regionals, majors } = remainingOfficialEvents(save);
  const remaining = regionals + majors;
  const maxOnBoard =
    regionals * CAREER_POINTS.regional.champion +
    majors * CAREER_POINTS.regional.champion * CAREER_POINTS.majorMultiplier;

  const chipBase =
    "display inline-flex min-h-11 items-center rounded-md border px-3 text-[11px] font-semibold uppercase tracking-[0.1em] transition-colors";

  return (
    <div className="rise-in mx-auto max-w-6xl px-3 py-6 sm:px-4">
      <SectionTitle kicker={copy.meta.title} title={copy.standings.title} className="mb-5" />

      {/* Tabs — blue = structure */}
      <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label={copy.standings.title}>
        {(
          [
            ["split", copy.standings.splitTab],
            ["season", copy.standings.seasonTab],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={cx(
              chipBase,
              tab === key
                ? "border-blue/50 bg-blue/15 text-blue-bright"
                : "border-line-strong bg-white/5 text-sub hover:text-ink",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Season-tab hero: your race in three reads, led by your crest */}
      {tab === "season" ? (
        <Panel
          strong
          glow="blue"
          className="rise-in relative mb-4 overflow-hidden p-5"
          style={{ animationDelay: "60ms" }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -left-12 -top-12 h-44 w-44 rounded-full opacity-15 blur-2xl"
            style={{
              background: `radial-gradient(circle, ${save.identity.colors.primary}, transparent 70%)`,
            }}
          />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3 sm:w-56 sm:shrink-0">
              <OrgMark save={save} orgRef="user" size="lg" />
              <div className="min-w-0">
                <p className="display truncate text-base font-bold uppercase tracking-wide text-ink">
                  {save.identity.orgName}
                </p>
                <TeamStars stars={userStarCount} size="sm" />
              </div>
            </div>
            <div className="grid flex-1 gap-4 sm:grid-cols-3">
              <div>
                <p className="kicker mb-1">{copy.hub.pointsRace}</p>
                <p className="display text-2xl font-bold text-ink">
                  {copy.hub.pointsRank(userRow?.rank ?? homeRows.length, userRow?.points ?? 0)}
                </p>
              </div>
              <div>
                <p className="kicker mb-1">{copy.standings.worldsLine}</p>
                <p className={cx("display text-2xl font-bold", safe ? "text-good" : "text-bad")}>
                  {safe ? copy.hub.pointsSafe : copy.hub.pointsGap(gap)}
                </p>
              </div>
              <div>
                <p className="kicker mb-1">{copy.calendar.seasonOverview}</p>
                <p className="display text-2xl font-bold text-ink">
                  {copy.standings.remaining(remaining)}
                </p>
                <p className="mt-0.5 text-xs text-sub">{copy.standings.maxAvailable(maxOnBoard)}</p>
              </div>
            </div>
          </div>
        </Panel>
      ) : null}

      {/* Region selector */}
      <p className="kicker mb-2">{copy.standings.regionLabel}</p>
      <div className="mb-4 flex flex-wrap gap-2">
        {REGIONS.map((r) => (
          <button
            key={r}
            onClick={() => setPickedRegion(r)}
            aria-pressed={region === r}
            className={cx(
              chipBase,
              region === r
                ? REGION_BADGE[r]
                : "border-line-strong bg-white/5 text-sub hover:text-ink",
            )}
          >
            {r}
          </button>
        ))}
      </div>

      <Panel className="rise-in p-2 sm:p-4" style={{ animationDelay: "120ms" }}>
        <StandingsTable
          save={save}
          region={region}
          rows={rows}
          cut={cut}
          cutLabel={cutLabel}
          userStarCount={userStarCount}
          form={form}
          onOpenOrg={setSheetRef}
        />
      </Panel>

      {/* Worlds field — announced once every region resolves */}
      {tab === "season" ? (
        save.competition.worldsFieldRefs ? (
          <div className="rise-in mt-6" style={{ animationDelay: "180ms" }}>
            <p className="kicker mb-3">{copy.standings.worldsField}</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {save.competition.worldsFieldRefs.map((ref, i) => (
                <Panel
                  key={ref}
                  role={ref === "user" ? undefined : "button"}
                  tabIndex={ref === "user" ? undefined : 0}
                  title={ref === "user" ? undefined : copy.orgSheet.viewTeam}
                  onClick={ref === "user" ? undefined : () => setSheetRef(ref)}
                  onKeyDown={
                    ref === "user"
                      ? undefined
                      : (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSheetRef(ref);
                          }
                        }
                  }
                  className={cx(
                    "rise-in flex flex-col items-center gap-1.5 p-3 text-center",
                    ref === "user"
                      ? "panel-glow-orange border-orange/40"
                      : "cursor-pointer transition-colors hover:bg-white/4 focus-visible:bg-white/6 focus-visible:outline-none",
                  )}
                  style={{ animationDelay: `${200 + i * 30}ms` }}
                >
                  <OrgMark save={save} orgRef={ref} size="md" />
                  <span
                    className={cx(
                      "w-full truncate text-xs",
                      ref === "user" ? "font-semibold text-ink" : "text-sub",
                    )}
                  >
                    {ref === "user" ? save.identity.orgName : save.world.orgs[ref]?.name ?? ref}
                  </span>
                  <TeamStars
                    stars={ref === "user" ? userStarCount : save.world.orgs[ref]?.stars ?? 0}
                    size="xs"
                  />
                </Panel>
              ))}
            </div>
          </div>
        ) : (
          <p className="mt-4 text-center text-xs text-faint">{copy.standings.fieldRevealPending}</p>
        )
      ) : null}

      <OrgSheet save={save} orgRef={sheetRef} onClose={() => setSheetRef(null)} />
    </div>
  );
}
