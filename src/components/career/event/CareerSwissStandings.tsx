"use client";

/**
 * Road to Worlds — live Swiss standings (spoiler-safe, v0.2 rebuild).
 *
 * Renders ONLY revealed results (records come pre-derived from eventPlayback's
 * swissRecordsFrom over fully revealed rounds), stepping at round gaps — the
 * tbody is keyed by `throughRound` so every step re-enters with rise-in.
 * Advanced rows read good, eliminated rows fade, your row is orange-edged.
 *
 * v2.2 event formats: with a group stage (`stage.kind`) the same table is
 * drawn once per group. Double-elimination groups tag at 2 wins / 2 losses;
 * a group of four tags only when its last round is on screen (by the table).
 */

import { useCopy } from "@/content/copy";
import { useCareerCopy } from "@/content/careerCopy";
import type { CareerSave } from "@/engine/career/types";
import { groupTable, stageRuleOf } from "@/engine/eventLayouts";
import type { SwissState, TournamentTeam } from "@/engine/types";
import { cx } from "@/lib/util";
import { OrgMark } from "@/components/career/OrgMark";
import { EventTeamButton } from "./EventRosters";
import { Panel } from "@/components/ui/Panel";
import type { DerivedRecord } from "./eventPlayback";

type Teams = Record<string, { name: string; rating: { total: number } }>;
type StageView = Pick<SwissState, "kind" | "groups" | "records" | "rounds" | "finished">;

const EMPTY = { wins: 0, losses: 0, gameDiff: 0 };

export function CareerSwissStandings({
  save,
  t,
  records,
  throughRound,
  nextUpRef,
  title,
  stage,
}: {
  save: CareerSave;
  t: { teams: Teams };
  /** Records derived from fully revealed rounds only (never spoils). */
  records: Map<string, DerivedRecord>;
  throughRound: number;
  /** Known next opponent (only once every simulated round is revealed). */
  nextUpRef?: string | null;
  title?: string;
  /** v2.2 event formats: the event's stage, when it is a group stage. */
  stage?: StageView;
}) {
  const C = useCareerCopy();
  const T = useCopy().TOURNAMENT_UI;

  const byRecord = (ids: string[]) =>
    [...ids].sort((a, b) => {
      const ra = records.get(a) ?? EMPTY;
      const rb = records.get(b) ?? EMPTY;
      return (
        rb.wins - ra.wins ||
        ra.losses - rb.losses ||
        rb.gameDiff - ra.gameDiff ||
        (t.teams[b]?.rating.total ?? 0) - (t.teams[a]?.rating.total ?? 0) ||
        a.localeCompare(b)
      );
    });

  const rule = stage ? stageRuleOf(stage) : stageRuleOf({});
  // A group of four is decided by its table: tags only once the whole stage is on screen.
  const final = Boolean(stage?.finished && throughRound >= stage.rounds.length);
  const tagOf = (id: string): "through" | "out" | null => {
    if (rule === "table") {
      if (!final) return null;
      const status = stage!.records.find((r) => r.teamId === id)?.status;
      return status === "advanced" ? "through" : status === "eliminated" ? "out" : null;
    }
    const r = records.get(id) ?? EMPTY;
    if (r.wins >= rule.wins) return "through";
    if (r.losses >= rule.losses) return "out";
    return null;
  };

  const groups = stage?.kind && stage.groups ? stage.groups : null;
  const tables = groups
    ? groups.map((g, i) => ({
        label: C.event.formats.group(String.fromCharCode(65 + i)),
        ids: final ? groupTable(stage!, g, t.teams as unknown as Record<string, TournamentTeam>) : byRecord(g),
      }))
    : [{ label: null as string | null, ids: byRecord(Object.keys(t.teams)) }];

  return (
    <Panel className="p-4 sm:p-5">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h3 className="display text-sm font-bold uppercase tracking-[0.16em] text-ink">
          {title ?? (groups ? C.event.formats.groupStandings : C.event.standings)}
        </h3>
        {throughRound > 0 ? (
          <span className="shrink-0 text-[11px] uppercase tracking-wider text-faint">
            {C.event.throughRound(throughRound)}
          </span>
        ) : null}
      </div>

      <div className={cx(groups && "space-y-4")}>
        {tables.map((table) => (
          <div key={table.label ?? "all"}>
            {table.label ? <p className="kicker mb-1">{table.label}</p> : null}
            {/* rc.29 (CAR-05): a fixed layout — the auto one handed the spare width to
                W-L / GD and cut team names to a few letters on the 1280 px rail. */}
            <table className="w-full table-fixed text-left text-xs">
              {/* the widths live here: a group's header row is visually hidden */}
              <colgroup>
                <col />
                <col className="w-12" />
                <col className="w-10" />
              </colgroup>
              <thead className={cx(table.label && "sr-only")}>
                <tr className="text-[11px] uppercase tracking-wider text-faint">
                  <th className="pb-2 font-semibold" scope="col">
                    {T.team}
                  </th>
                  <th className="w-12 pb-2 text-center font-semibold" scope="col">
                    {C.event.record}
                  </th>
                  <th className="w-10 pb-2 text-right font-semibold" scope="col">
                    {C.event.gameDiff}
                  </th>
                </tr>
              </thead>
              {/* keyed by round → the body re-enters when the standings step */}
              <tbody key={throughRound} className="rise-in">
                {table.ids.map((teamId) => {
                  const team = t.teams[teamId];
                  const r = records.get(teamId) ?? EMPTY;
                  const isUser = teamId === "user";
                  const tag = tagOf(teamId);
                  return (
                    <tr
                      key={teamId}
                      className={cx(
                        "border-t border-line",
                        isUser && "border-l-2 border-l-orange bg-orange/8",
                        tag === "out" && "opacity-45",
                      )}
                    >
                      <td className="py-1.5 pr-2">
                        <EventTeamButton teamId={teamId} name={team?.name ?? teamId} className="flex min-w-0 items-center gap-1.5">
                          <OrgMark save={save} orgRef={teamId} size="xs" className="shrink-0" />
                          <span
                            title={team?.name ?? teamId}
                            className={cx("min-w-0 truncate", isUser ? "font-bold text-orange-bright" : "text-ink")}
                          >
                            {team?.name ?? teamId}
                          </span>
                          {/* rc.29 (CAR-05): short tags (PT "Classificado" cut the name at 1280 px). */}
                          {tag === "through" ? (
                            <span className="display shrink-0 rounded bg-good/15 px-1 text-[10px] font-bold uppercase tracking-wider text-good">
                              {C.event.advancedTag}
                            </span>
                          ) : tag === "out" ? (
                            <span className="display shrink-0 rounded bg-bad/15 px-1 text-[10px] font-bold uppercase tracking-wider text-bad">
                              {C.event.eliminatedTag}
                            </span>
                          ) : null}
                        </EventTeamButton>
                      </td>
                      <td className="display whitespace-nowrap py-1.5 text-center font-bold text-ink">
                        {r.wins}–{r.losses}
                      </td>
                      <td
                        className={cx(
                          "display py-1.5 text-right font-bold",
                          r.gameDiff > 0 ? "text-good" : r.gameDiff < 0 ? "text-bad" : "text-sub",
                        )}
                      >
                        {r.gameDiff > 0 ? `+${r.gameDiff}` : r.gameDiff}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      {nextUpRef ? (
        <div className="pop-in mt-3 flex items-center gap-2 rounded-lg border border-blue/35 bg-blue/5 px-2.5 py-2">
          <span className="kicker shrink-0 text-blue-bright">{C.event.nextUp}</span>
          <EventTeamButton teamId={nextUpRef} name={t.teams[nextUpRef]?.name ?? nextUpRef}>
          <OrgMark save={save} orgRef={nextUpRef} size="xs" />
          <span className="display min-w-0 truncate text-xs font-bold uppercase text-ink">
            {t.teams[nextUpRef]?.name ?? nextUpRef}
          </span>
          </EventTeamButton>
        </div>
      ) : null}
    </Panel>
  );
}
