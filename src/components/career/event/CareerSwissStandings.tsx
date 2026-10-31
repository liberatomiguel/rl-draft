"use client";

/**
 * Road to Worlds — live Swiss standings (spoiler-safe, v0.2 rebuild).
 *
 * Renders ONLY revealed results (records come pre-derived from eventPlayback's
 * swissRecordsFrom over fully revealed rounds), stepping at round gaps — the
 * tbody is keyed by `throughRound` so every step re-enters with rise-in.
 * Advanced rows read good, eliminated rows fade, your row is orange-edged.
 */

import { TOURNAMENT } from "@/config/balance";
import { useCopy } from "@/content/copy";
import { useCareerCopy } from "@/content/careerCopy";
import type { CareerSave } from "@/engine/career/types";
import { cx } from "@/lib/util";
import { OrgMark } from "@/components/career/OrgMark";
import { Panel } from "@/components/ui/Panel";
import type { DerivedRecord } from "./eventPlayback";

export function CareerSwissStandings({
  save,
  t,
  records,
  throughRound,
  nextUpRef,
  title,
}: {
  save: CareerSave;
  t: { teams: Record<string, { name: string; rating: { total: number } }> };
  /** Records derived from fully revealed rounds only (never spoils). */
  records: Map<string, DerivedRecord>;
  throughRound: number;
  /** Known next opponent (only once every simulated round is revealed). */
  nextUpRef?: string | null;
  title?: string;
}) {
  const C = useCareerCopy();
  const T = useCopy().TOURNAMENT_UI;

  const sorted = Object.keys(t.teams).sort((a, b) => {
    const ra = records.get(a) ?? { wins: 0, losses: 0, gameDiff: 0 };
    const rb = records.get(b) ?? { wins: 0, losses: 0, gameDiff: 0 };
    return (
      rb.wins - ra.wins ||
      ra.losses - rb.losses ||
      rb.gameDiff - ra.gameDiff ||
      (t.teams[b]?.rating.total ?? 0) - (t.teams[a]?.rating.total ?? 0) ||
      a.localeCompare(b)
    );
  });

  return (
    <Panel className="p-4">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h3 className="display text-sm font-bold uppercase tracking-[0.16em] text-ink">
          {title ?? C.event.standings}
        </h3>
        {throughRound > 0 ? (
          <span className="shrink-0 text-[10px] uppercase tracking-wider text-faint">
            {C.event.throughRound(throughRound)}
          </span>
        ) : null}
      </div>

      {/* rc.29 (CAR-05): a fixed layout — the auto one handed the spare width to
          W-L / GD and cut team names to a few letters on the 1280 px rail. */}
      <table className="w-full table-fixed text-left text-xs">
        <thead>
          <tr className="text-[10px] uppercase tracking-wider text-faint">
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
          {sorted.map((teamId) => {
            const team = t.teams[teamId];
            const r = records.get(teamId) ?? { wins: 0, losses: 0, gameDiff: 0 };
            const isUser = teamId === "user";
            const through = r.wins >= TOURNAMENT.swiss.winsToAdvance;
            const out = r.losses >= TOURNAMENT.swiss.lossesToEliminate;
            return (
              <tr
                key={teamId}
                className={cx(
                  "border-t border-line",
                  isUser && "border-l-2 border-l-orange bg-orange/8",
                  out && "opacity-45",
                )}
              >
                <td className="py-1.5 pr-2">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <OrgMark save={save} orgRef={teamId} size="xs" className="shrink-0" />
                    <span
                      title={team?.name ?? teamId}
                      className={cx(
                        "min-w-0 truncate",
                        isUser ? "font-bold text-orange-bright" : "text-ink",
                      )}
                    >
                      {team?.name ?? teamId}
                    </span>
                    {/* rc.29 (CAR-05): short tags (PT "Classificado" cut the name at 1280 px). */}
                    {through ? (
                      <span className="display shrink-0 rounded bg-good/15 px-1 text-[8px] font-bold uppercase tracking-wider text-good">
                        {C.event.advancedTag}
                      </span>
                    ) : out ? (
                      <span className="display shrink-0 rounded bg-bad/15 px-1 text-[8px] font-bold uppercase tracking-wider text-bad">
                        {C.event.eliminatedTag}
                      </span>
                    ) : null}
                  </span>
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

      {nextUpRef ? (
        <div className="pop-in mt-3 flex items-center gap-2 rounded-lg border border-blue/35 bg-blue/5 px-2.5 py-2">
          <span className="kicker shrink-0 !text-[9px] text-blue-bright">{C.event.nextUp}</span>
          <OrgMark save={save} orgRef={nextUpRef} size="xs" />
          <span className="display min-w-0 truncate text-xs font-bold uppercase text-ink">
            {t.teams[nextUpRef]?.name ?? nextUpRef}
          </span>
        </div>
      ) : null}
    </Panel>
  );
}
