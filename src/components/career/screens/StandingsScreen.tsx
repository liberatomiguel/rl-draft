"use client";

/**
 * Road to Worlds — Standings: the two race tables, per region (RTW-01, R49).
 *  - MAJOR table: this split's regional points, cut at the region's Major slots;
 *  - WORLDS table: the season's regional + Major points, cut at its Worlds slots.
 * Both read careerUi.raceTableOf — the order and the cut the Major / Worlds
 * selection uses — and so does the HQ toggle (hub/RaceBlock). Local amateur
 * sides score like any team since R49 and are marked as such.
 *
 * Design §11: the dashed cut-line is THE measuring stick — always visible,
 * always labeled. Blue = structure (tabs, cut-lines); the user row is a
 * fill. v0.2: shared OrgMark, FORM chips (last placements this season),
 * expandable user row, crest-led hero. The points column is the deciding
 * one and is set largest (DESIGN.md).
 */

import { useId, useMemo, useState } from "react";
import { isLocalRef } from "@/engine/career/localScene";
import type { CareerSave } from "@/engine/career/types";
import type { Placement } from "@/engine/types";
import type { Region } from "@/engine/types";
import { useCareerCopy } from "@/content/careerCopy";
import { cx } from "@/lib/util";
import { useMounted } from "@/store/useMounted";
import { Badge } from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/Button";
import { Panel, SectionTitle } from "@/components/ui/Panel";
import { REGION_BADGE } from "@/components/regionStyle";
import { CareerHonorsTable } from "../CareerHonorsTable";
import { OrgMark } from "@/components/career/OrgMark";
import { OrgSheet } from "@/components/career/OrgSheet";
import { TeamStars } from "@/components/career/TeamStars";
import { defaultRaceKind } from "@/components/career/hub/RaceBlock";
import {
  CAREER_SLOTS,
  nameOfRef,
  raceLineOf,
  raceTableOf,
  useCareerSave,
  userStars,
  type RaceKind,
  type RaceLine,
  type RaceRow,
  type RaceTable,
} from "@/components/career/careerUi";

const REGIONS = Object.keys(CAREER_SLOTS.major) as Region[];

/**
 * Last placements per org-ref this season (chronological, newest last).
 * v2.0 (R40): points events only — a qualifier is Swiss only (its "top8"
 * means qualified, not a bracket finish), so it never reads as form.
 */
function formMap(save: CareerSave, keep: number): Map<string, Placement[]> {
  const map = new Map<string, Placement[]>();
  const events = save.eventResults
    .filter((ev) => ev.tier !== "qualifier" && ev.seasonIndex === save.clock.seasonIndex)
    .sort((a, b) => a.week - b.week);
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
  champion: { label: "1", cls: "bg-amber-400/15 text-amber-300" },
  runner_up: { label: "2", cls: "bg-good/15 text-good" },
  third: { label: "3", cls: "bg-good/10 text-good" },
  fourth: { label: "4", cls: "bg-blue/15 text-blue-bright" },
  top4: { label: "4", cls: "bg-blue/15 text-blue-bright" },
  top6: { label: "6", cls: "bg-white/[0.07] text-sub" },
  top8: { label: "8", cls: "bg-white/[0.07] text-sub" },
  swiss_exit: { label: "9+", cls: "bg-bad/15 text-bad" },
};

function FormChips({
  placements,
  labels,
}: {
  placements: Placement[] | undefined;
  labels: Record<string, string>;
}) {
  if (!placements || placements.length === 0) {
    return <span className="text-xs text-faint">–</span>;
  }
  return (
    <span className="inline-flex items-center gap-1">
      {placements.map((p, i) => (
        <span
          key={i}
          title={labels[p] ?? p}
          className={cx(
            "display inline-flex h-5 min-w-5 items-center justify-center rounded-sm px-1 text-[11px] font-semibold leading-none",
            FORM_CHIP[p].cls,
          )}
        >
          {FORM_CHIP[p].label}
        </span>
      ))}
    </span>
  );
}

/** The org's stars, or the Local chip for an amateur side (it has no star rating). */
function RowMarks({ row, stars, localTag }: { row: RaceRow; stars: number; localTag: string }) {
  if (row.side === "local") {
    return <Badge className="shrink-0">{localTag}</Badge>;
  }
  return <TeamStars stars={stars} size="xs" className="shrink-0" />;
}

/** A figure of the user's race: the value first, its label quiet under it. */
function RaceFigure({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={cx("flex min-w-0 flex-col-reverse justify-end", className)}>
      <dt className="mt-1.5 text-xs leading-snug text-sub">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The table (shared by both tabs; the view-model owns order, cut and marks)
// ---------------------------------------------------------------------------

function StandingsTable({
  save,
  table,
  cutLabel,
  userStarCount,
  form,
  onOpenOrg,
}: {
  save: CareerSave;
  table: RaceTable;
  cutLabel: string;
  userStarCount: number;
  form: Map<string, Placement[]>;
  onOpenOrg: (ref: string) => void;
}) {
  const copy = useCareerCopy();
  const [expandedRef, setExpandedRef] = useState<string | null>(null);
  const placementLabels = copy.common.placement as Record<string, string>;
  const { rows, cut, region } = table;

  const trs: React.ReactNode[] = [];
  for (const row of rows) {
    const isUser = row.side === "user";
    const expanded = expandedRef === row.ref;
    const stars = isUser ? userStarCount : (save.world.orgs[row.ref]?.stars ?? 0);
    // User row keeps its expand-in-place detail; every other row opens its sheet.
    const activate = isUser ? () => setExpandedRef(expanded ? null : row.ref) : () => onOpenOrg(row.ref);
    trs.push(
      <tr
        key={row.ref}
        tabIndex={0}
        aria-expanded={isUser ? expanded : undefined}
        title={isUser ? undefined : copy.orgSheet.viewTeam}
        onClick={activate}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            activate();
          }
        }}
        className={cx(
          "cursor-pointer border-b border-line transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-bright",
          // The player's own row is a fill (DESIGN.md: a state is a fill or a hairline, never a glow or an edge bar).
          isUser ? "bg-white/[0.07] hover:bg-white/[0.1]" : "hover:bg-white/[0.04]",
          expanded && "!border-b-0",
        )}
      >
        <td className="w-10 px-2 py-2.5 text-center">
          <span
            className={cx(
              "display text-base font-bold leading-none",
              row.qualified ? "text-good" : isUser ? "text-ink" : row.inCut ? "text-sub" : "text-faint",
            )}
          >
            {table.started ? row.rank : "–"}
          </span>
        </td>
        <td className="px-2 py-2.5">
          <span className="flex min-w-0 flex-wrap items-center gap-1.5 sm:flex-nowrap sm:gap-2.5">
            <OrgMark save={save} orgRef={row.ref} />
            <span
              className={cx(
                "min-w-0 basis-[calc(100%-3rem)] break-words text-sm sm:basis-auto sm:truncate",
                isUser ? "font-semibold text-ink" : row.inCut ? "text-ink" : "text-sub",
              )}
            >
              {row.name}
            </span>
            <RowMarks row={row} stars={stars} localTag={copy.race.localTag} />
            {isUser ? (
              <Badge tone="orange" className="shrink-0">
                {copy.standings.userChip}
              </Badge>
            ) : null}
            {row.qualified ? (
              <Badge tone="good" className="hidden shrink-0 sm:inline-flex">
                {copy.race.qualifiedTag}
              </Badge>
            ) : null}
          </span>
        </td>
        <td className="hidden px-2 py-2.5 text-right sm:table-cell">
          <FormChips placements={form.get(row.ref)} labels={placementLabels} />
        </td>
        {/* The deciding column: the points, set larger than anything else in the row. */}
        <td className="whitespace-nowrap px-3 py-2.5 text-right">
          <span className="display text-xl font-bold leading-none text-ink">{row.points}</span>
          <span className="ml-1 text-xs text-faint">{copy.standings.ptsShort}</span>
        </td>
      </tr>,
    );
    if (expanded) {
      const splitPts = save.competition.splitPoints[region]?.[row.ref] ?? 0;
      const seasonPts = save.competition.seasonPoints[region]?.[row.ref] ?? 0;
      trs.push(
        <tr key={`x:${row.ref}`} className="border-b border-line bg-white/[0.07]">
          <td colSpan={4} className="px-3 pb-3 pt-0">
            <dl className="rise-in flex flex-wrap items-start gap-x-8 gap-y-3 border-t border-line pt-3">
              <RaceFigure label={copy.race.majorTab}>
                <span className="display text-xl font-bold leading-none text-ink">{splitPts}</span>
                <span className="ml-1 text-xs text-faint">{copy.standings.ptsShort}</span>
              </RaceFigure>
              <RaceFigure label={copy.race.worldsTab}>
                <span className="display text-xl font-bold leading-none text-ink">{seasonPts}</span>
                <span className="ml-1 text-xs text-faint">{copy.standings.ptsShort}</span>
              </RaceFigure>
              <RaceFigure label={copy.club.stars}>
                <TeamStars stars={userStarCount} size="sm" />
              </RaceFigure>
              <RaceFigure label={copy.hub.form} className="sm:hidden">
                <FormChips placements={form.get(row.ref)} labels={placementLabels} />
              </RaceFigure>
            </dl>
          </td>
        </tr>,
      );
    }
    if (row.rank === cut && rows.length > cut) {
      trs.push(
        <tr key={`cut:${row.ref}`}>
          <td colSpan={4} className="border-b-2 border-dashed border-blue/60 px-3 pb-1 pt-1">
            <span className="kicker block text-right text-blue-bright">{cutLabel}</span>
          </td>
        </tr>,
      );
    }
  }

  return (
    <div className="min-w-0">
      <table className="mobile-list-table w-full border-collapse">
        <thead>
          <tr className="border-b border-line-strong">
            <th className="kicker w-10 px-2 pb-2 text-center">#</th>
            <th aria-label={copy.standings.title} className="px-2 pb-2" />
            <th className="kicker hidden px-2 pb-2 text-right sm:table-cell">{copy.hub.form}</th>
            <th className="kicker px-3 pb-2 text-right">{copy.standings.ptsShort}</th>
          </tr>
        </thead>
        <tbody>{trs}</tbody>
      </table>
    </div>
  );
}

/** An announced Major / Worlds field: a list of the teams in columns, any non-user row opens its sheet. */
function FieldList({
  save,
  refs,
  title,
  userStarCount,
  onOpenOrg,
}: {
  save: CareerSave;
  refs: string[];
  title: string;
  userStarCount: number;
  onOpenOrg: (ref: string) => void;
}) {
  const copy = useCareerCopy();
  const rowClass = "flex min-h-11 w-full min-w-0 items-center gap-2.5 px-2 py-2 text-left";
  return (
    <section className="mt-8">
      <h3 className="card-title">{title}</h3>
      <ul className="mt-3 grid grid-cols-1 gap-x-6 border-t border-line sm:grid-cols-2 lg:grid-cols-3">
        {refs.map((ref) => {
          const isUser = ref === "user";
          const inner = (
            <>
              <OrgMark save={save} orgRef={ref} />
              <span className={cx("min-w-0 flex-1 truncate text-sm", isUser ? "font-semibold text-ink" : "text-ink")}>
                {nameOfRef(save, ref)}
              </span>
              {isUser ? (
                <Badge tone="orange" className="shrink-0">
                  {copy.standings.userChip}
                </Badge>
              ) : null}
              {isLocalRef(ref) ? (
                <Badge className="shrink-0">{copy.race.localTag}</Badge>
              ) : (
                <TeamStars
                  stars={isUser ? userStarCount : (save.world.orgs[ref]?.stars ?? 0)}
                  size="xs"
                  className="shrink-0"
                />
              )}
            </>
          );
          return (
            <li key={ref} className="border-b border-line">
              {isUser ? (
                <div className={cx(rowClass, "bg-white/[0.07]")}>{inner}</div>
              ) : (
                <button
                  type="button"
                  title={copy.orgSheet.viewTeam}
                  onClick={() => onOpenOrg(ref)}
                  className={cx(rowClass, "transition-colors hover:bg-white/[0.04]")}
                >
                  {inner}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

/** RTW-01 (R49): the hero's line tone — neutral before any points and when level with the last seat. */
const LINE_TONE: Record<RaceLine, string> = {
  unscored: "text-sub",
  clinched: "text-good",
  out: "text-bad",
  inside: "text-good",
  level: "text-sub",
  behind: "text-bad",
};

/** A filter or tab chip: the shared button, its selected state a coloured hairline and tint. */
function chipClass(selected: boolean, on = "!border-blue-bright/60 !bg-blue/15 !text-blue-bright"): string {
  return cx(buttonClass("secondary", "sm"), selected ? on : "!text-sub hover:!text-ink");
}

export function StandingsScreen() {
  // Job: where the club stands in the points race against the cut line. The one decision: which race to read (this split's Major, or the season's Worlds).
  const copy = useCareerCopy();
  const mounted = useMounted();
  const save = useCareerSave();
  const [tab, setTab] = useState<RaceKind | null>(null);
  const [pickedRegion, setPickedRegion] = useState<Region | null>(null);
  // One sheet for the whole screen — any AI org row/card opens it.
  const [sheetRef, setSheetRef] = useState<string | null>(null);
  const tabIds = useId();

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
          <div className="h-96 animate-pulse rounded-xl bg-white/5" />
        </div>
      </div>
    );
  }
  if (!save) return null;

  const home = save.identity.region;
  const region = pickedRegion ?? home;
  const kind: RaceKind = tab ?? defaultRaceKind(save);
  const homeTable = raceTableOf(save, home, kind);
  const table = region === home ? homeTable : raceTableOf(save, region, kind);
  const isMajor = kind === "major";
  const cutLabel = isMajor ? copy.standings.majorLine : copy.standings.worldsLine;
  const scope = isMajor ? copy.race.majorScope(table.split, table.cut) : copy.race.worldsScope(table.cut);
  const fixtures = isMajor
    ? copy.race.fixturesMajor(table.fixturesLeft.regionals)
    : copy.race.fixturesWorlds(table.fixturesLeft.regionals, table.fixturesLeft.majors);
  const user = homeTable.userRow;
  const line = raceLineOf(homeTable);
  const field = isMajor ? save.competition.majorFieldRefs : save.competition.worldsFieldRefs;
  const hasLocals = table.rows.some((r) => r.side === "local");

  const lineText = (l: RaceLine | null, gap: number): string =>
    l === "clinched"
      ? copy.race.status.clinched
      : l === "out"
        ? copy.race.status.out
        : l === "inside"
          ? copy.hub.pointsSafe
          : l === "level"
            ? copy.hub.pointsLevel
            : l === "behind"
              ? copy.hub.pointsGap(gap)
              : copy.hub.pointsNone;

  return (
    <div className="rise-in mx-auto max-w-6xl px-3 py-6 sm:px-4">
      <SectionTitle title={copy.standings.title} className="mb-5" />

      <div className="mb-3 flex flex-wrap items-center gap-x-6 gap-y-2">
        {/* Tabs: the two race tables */}
        <div data-tour="standings-tabs" className="flex flex-wrap gap-1.5" role="tablist" aria-label={copy.standings.title}>
          {(
            [
              ["major", copy.race.majorTab],
              ["worlds", copy.race.worldsTab],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              id={`${tabIds}-tab-${key}`}
              type="button"
              role="tab"
              aria-selected={kind === key}
              aria-controls={`${tabIds}-panel`}
              onClick={() => setTab(key)}
              className={chipClass(kind === key)}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Region selector */}
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={copy.standings.regionLabel}>
          {REGIONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setPickedRegion(r)}
              aria-pressed={region === r}
              className={chipClass(region === r, REGION_BADGE[r])}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div id={`${tabIds}-panel`} role="tabpanel" aria-labelledby={`${tabIds}-tab-${kind}`}>
        <p className="mb-4 text-sm text-sub">{scope}</p>

        {/* The user's own race (home region) in the selected table: the focal
            point of the screen, three figures on one board. */}
        {user ? (
          <Panel strong className="mb-4 p-4 sm:p-5">
            <div className="grid items-center gap-x-8 gap-y-4 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
              <div className="flex min-w-0 items-center gap-3">
                <OrgMark save={save} orgRef="user" size="lg" />
                <div className="min-w-0">
                  <h3 className="display truncate text-xl uppercase leading-none text-ink">
                    {save.identity.orgName}
                  </h3>
                  <TeamStars stars={userStarCount} size="sm" className="mt-1.5" />
                </div>
              </div>
              <dl className="grid min-w-0 grid-cols-2 items-start gap-x-6 gap-y-4 border-t border-line pt-4 sm:grid-cols-3 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
                <RaceFigure label={isMajor ? copy.race.majorTab : copy.race.worldsTab}>
                  <span className="display block whitespace-nowrap text-3xl font-extrabold leading-none text-ink">
                    {homeTable.started ? copy.hub.pointsRank(user.rank, user.points) : "–"}
                  </span>
                </RaceFigure>
                <RaceFigure label={cutLabel}>
                  <span className={cx("display block text-xl font-bold leading-tight", LINE_TONE[line ?? "unscored"])}>
                    {lineText(line, homeTable.userGap)}
                  </span>
                </RaceFigure>
                <RaceFigure label={copy.race.fixturesLabel}>
                  <span className="block text-sm leading-snug text-ink">
                    {isMajor
                      ? copy.race.fixturesMajor(homeTable.fixturesLeft.regionals)
                      : copy.race.fixturesWorlds(homeTable.fixturesLeft.regionals, homeTable.fixturesLeft.majors)}
                  </span>
                  {homeTable.maxPointsLeft > 0 ? (
                    <span className="mt-0.5 block text-xs text-sub">
                      {copy.standings.maxAvailable(homeTable.maxPointsLeft)}
                    </span>
                  ) : null}
                </RaceFigure>
              </dl>
            </div>
          </Panel>
        ) : null}

        <Panel data-tour="standings-table" className="p-2 sm:p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
            <Badge className={REGION_BADGE[region]}>{region}</Badge>
            <span className="text-xs text-sub">{fixtures}</span>
          </div>
          <StandingsTable
            // A new table (tab or region) closes the user row's detail.
            key={`${kind}:${region}`}
            save={save}
            table={table}
            cutLabel={cutLabel}
            userStarCount={userStarCount}
            form={form}
            onOpenOrg={setSheetRef}
          />
          {hasLocals ? <p className="mt-3 px-1 text-xs text-faint">{copy.race.localLegend}</p> : null}
        </Panel>

        {/* The field this table decides — announced on the Major week's / Worlds window's Monday */}
        {field ? (
          <FieldList
            save={save}
            refs={field}
            title={isMajor ? copy.race.majorField : copy.standings.worldsField}
            userStarCount={userStarCount}
            onOpenOrg={setSheetRef}
          />
        ) : (
          <p className="mt-4 text-sm text-sub">
            <span className="font-semibold text-ink">{isMajor ? copy.race.majorField : copy.standings.worldsField}.</span>{" "}
            {isMajor ? copy.race.majorFieldPending : copy.standings.fieldRevealPending}
          </p>
        )}
      </div>

      <div className="mt-8">
        <CareerHonorsTable save={save} C={copy} />
      </div>

      <OrgSheet save={save} orgRef={sheetRef} onClose={() => setSheetRef(null)} />
    </div>
  );
}
