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
 * always labeled. Blue = structure (tabs, tables, cut-lines); the user row
 * carries the org's own colors. v0.2: shared OrgMark, FORM chips (last
 * placements this season), expandable user row, crest-led hero.
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
import { Panel, SectionTitle } from "@/components/ui/Panel";
import { REGION_BADGE } from "@/components/regionStyle";
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

/** The org's stars, or the Local chip for an amateur side (it has no star rating). */
function RowMarks({ row, stars, localTag }: { row: RaceRow; stars: number; localTag: string }) {
  if (row.side === "local") {
    return <Badge className="shrink-0 !px-1.5 !text-[9px]">{localTag}</Badge>;
  }
  return <TeamStars stars={stars} size="xs" className="shrink-0" />;
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
          "cursor-pointer border-b border-line transition-colors focus-visible:outline-none focus-visible:bg-white/6",
          isUser ? "bg-white/4 hover:bg-white/6" : "hover:bg-white/3",
          expanded && "!border-b-0 bg-white/5",
        )}
      >
        <td
          className="w-10 px-2 py-2 text-center"
          style={{ borderLeft: `3px solid ${isUser ? save.identity.colors.primary : "transparent"}` }}
        >
          <span
            className={cx(
              "display text-sm font-bold",
              row.qualified ? "text-good" : isUser ? "text-ink" : row.inCut ? "text-sub" : "text-faint",
            )}
          >
            {table.started ? row.rank : "–"}
          </span>
        </td>
        <td className="px-2 py-2">
          <span className="flex min-w-0 items-center gap-2.5">
            <OrgMark save={save} orgRef={row.ref} />
            <span className={cx("truncate text-sm", isUser ? "font-semibold text-ink" : "text-sub")}>
              {row.name}
            </span>
            <RowMarks row={row} stars={stars} localTag={copy.race.localTag} />
            {isUser ? (
              <Badge tone="orange" className="shrink-0 !px-1.5 !text-[9px]">
                {copy.standings.userChip}
              </Badge>
            ) : null}
            {row.qualified ? (
              <Badge tone="good" className="hidden shrink-0 !px-1.5 !text-[9px] sm:inline-flex">
                {copy.race.qualifiedTag}
              </Badge>
            ) : null}
          </span>
        </td>
        <td className="hidden px-2 py-2 text-right sm:table-cell">
          <FormChips placements={form.get(row.ref)} labels={placementLabels} />
        </td>
        <td className="px-3 py-2 text-right">
          <span className={cx("display text-sm font-bold", isUser ? "text-orange-bright" : "text-ink")}>
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
                <span className="kicker block !text-[9px]">{copy.race.majorTab}</span>
                <span className="display text-sm font-bold text-ink">
                  {splitPts}
                  <span className="ml-1 text-[10px] font-normal text-faint">{copy.standings.ptsShort}</span>
                </span>
              </span>
              <span className="min-w-0">
                <span className="kicker block !text-[9px]">{copy.race.worldsTab}</span>
                <span className="display text-sm font-bold text-ink">
                  {seasonPts}
                  <span className="ml-1 text-[10px] font-normal text-faint">{copy.standings.ptsShort}</span>
                </span>
              </span>
              <span className="min-w-0">
                <span className="kicker block !text-[9px]">{copy.club.stars}</span>
                <TeamStars stars={userStarCount} size="sm" />
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
      <table className="w-full min-w-[20rem] border-collapse">
        <thead>
          <tr className="border-b border-line-strong">
            <th className="kicker w-10 px-2 pb-2 text-center !text-[9px]">#</th>
            <th aria-label={copy.standings.title} className="px-2 pb-2" />
            <th className="kicker hidden px-2 pb-2 text-right !text-[9px] sm:table-cell">{copy.hub.form}</th>
            <th className="kicker px-3 pb-2 text-right !text-[9px]">{copy.standings.ptsShort}</th>
          </tr>
        </thead>
        <tbody>{trs}</tbody>
      </table>
    </div>
  );
}

/** An announced Major / Worlds field: one card per team, any non-user card opens its sheet. */
function FieldGrid({
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
  return (
    <div className="rise-in mt-6" style={{ animationDelay: "180ms" }}>
      <p className="kicker mb-3">{title}</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {refs.map((ref, i) => {
          const isUser = ref === "user";
          const isLocal = isLocalRef(ref);
          return (
            <Panel
              key={ref}
              role={isUser ? undefined : "button"}
              tabIndex={isUser ? undefined : 0}
              title={isUser ? undefined : copy.orgSheet.viewTeam}
              onClick={isUser ? undefined : () => onOpenOrg(ref)}
              onKeyDown={
                isUser
                  ? undefined
                  : (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onOpenOrg(ref);
                      }
                    }
              }
              className={cx(
                "rise-in flex flex-col items-center gap-1.5 p-3 text-center",
                isUser
                  ? "panel-glow-orange border-orange/40"
                  : "cursor-pointer transition-colors hover:bg-white/4 focus-visible:bg-white/6 focus-visible:outline-none",
              )}
              style={{ animationDelay: `${200 + i * 30}ms` }}
            >
              <OrgMark save={save} orgRef={ref} size="md" />
              <span className={cx("w-full truncate text-xs", isUser ? "font-semibold text-ink" : "text-sub")}>
                {nameOfRef(save, ref)}
              </span>
              {isLocal ? (
                <Badge className="!px-1.5 !text-[9px]">{copy.race.localTag}</Badge>
              ) : (
                <TeamStars stars={isUser ? userStarCount : (save.world.orgs[ref]?.stars ?? 0)} size="xs" />
              )}
            </Panel>
          );
        })}
      </div>
    </div>
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

export function StandingsScreen() {
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
          <div className="h-96 animate-pulse rounded-2xl bg-white/5" />
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

  const chipBase =
    "display inline-flex min-h-11 items-center rounded-md border px-3 text-[11px] font-semibold uppercase tracking-[0.1em] transition-colors";
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
      <SectionTitle kicker={copy.meta.title} title={copy.standings.title} className="mb-5" />

      <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2">
      {/* Region selector */}
      <div className="flex flex-wrap gap-1.5" aria-label={copy.standings.regionLabel}>
        {REGIONS.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setPickedRegion(r)}
            aria-pressed={region === r}
            className={cx(
              chipBase,
              region === r ? REGION_BADGE[r] : "border-line-strong bg-white/5 text-sub hover:text-ink",
            )}
          >
            {r}
          </button>
        ))}
      </div>

      {/* Tabs — the two race tables (blue = structure) */}
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label={copy.standings.title}>
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
            className={cx(
              chipBase,
              kind === key
                ? "border-blue/50 bg-blue/15 text-blue-bright"
                : "border-line-strong bg-white/5 text-sub hover:text-ink",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      </div>
      <div id={`${tabIds}-panel`} role="tabpanel" aria-labelledby={`${tabIds}-tab-${kind}`}>
      <p className="mb-4 text-xs text-sub">{scope}</p>

      {/* Hero: the user's own race (home region) in the selected table */}
      {user ? (
        <Panel
          strong
          glow="blue"
          className="rise-in relative mb-4 overflow-hidden p-4"
          style={{ animationDelay: "60ms" }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -left-12 -top-12 h-44 w-44 rounded-full opacity-15 blur-2xl"
            style={{ background: `radial-gradient(circle, ${save.identity.colors.primary}, transparent 70%)` }}
          />
          <div className="relative grid items-center gap-4 lg:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
            <div className="flex min-w-0 items-center gap-3">
              <OrgMark save={save} orgRef="user" size="lg" />
              <div className="min-w-0">
                <p className="display truncate text-base font-bold uppercase tracking-wide text-ink">
                  {save.identity.orgName}
                </p>
                <TeamStars stars={userStarCount} size="sm" />
              </div>
            </div>
            <div className="grid min-w-0 grid-cols-2 items-start gap-x-4 gap-y-3 sm:grid-cols-3">
              <div>
                <p className="kicker mb-1">{isMajor ? copy.race.majorTab : copy.race.worldsTab}</p>
                <p className="display whitespace-nowrap text-xl font-bold text-ink">
                  {homeTable.started ? copy.hub.pointsRank(user.rank, user.points) : "–"}
                </p>
              </div>
              <div>
                <p className="kicker mb-1">{cutLabel}</p>
                <p className={cx("display text-lg font-bold leading-snug", LINE_TONE[line ?? "unscored"])}>
                  {lineText(line, homeTable.userGap)}
                </p>
              </div>
              <div>
                <p className="kicker mb-1">{copy.race.fixturesLabel}</p>
                <p className="display text-sm font-semibold leading-snug text-ink">
                  {isMajor
                    ? copy.race.fixturesMajor(homeTable.fixturesLeft.regionals)
                    : copy.race.fixturesWorlds(homeTable.fixturesLeft.regionals, homeTable.fixturesLeft.majors)}
                </p>
                {homeTable.maxPointsLeft > 0 ? (
                  <p className="mt-0.5 text-xs text-sub">{copy.standings.maxAvailable(homeTable.maxPointsLeft)}</p>
                ) : null}
              </div>
            </div>
          </div>
        </Panel>
      ) : null}


      <Panel className="rise-in p-2 sm:p-4" style={{ animationDelay: "120ms" }}>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1">
          <Badge className={REGION_BADGE[region]}>{region}</Badge>
          <span className="text-[11px] text-faint">{fixtures}</span>
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
        {hasLocals ? <p className="mt-3 px-1 text-[11px] text-faint">{copy.race.localLegend}</p> : null}
      </Panel>

      {/* The field this table decides — announced on the Major week's / Worlds window's Monday */}
      {field ? (
        <FieldGrid
          save={save}
          refs={field}
          title={isMajor ? copy.race.majorField : copy.standings.worldsField}
          userStarCount={userStarCount}
          onOpenOrg={setSheetRef}
        />
      ) : (
        <p className="mt-4 text-center text-xs text-faint">
          {isMajor ? copy.race.majorFieldPending : copy.standings.fieldRevealPending}
        </p>
      )}
      </div>

      <OrgSheet save={save} orgRef={sheetRef} onClose={() => setSheetRef(null)} />
    </div>
  );
}
