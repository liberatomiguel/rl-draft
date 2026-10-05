"use client";

/**
 * Road to Worlds — playoff bracket (v0.2 rebuild).
 *
 * Two layouts over the same cells:
 *  - "wide"   (16-team officials): UPPER / LOWER rows of horizontal columns,
 *    scrolling inside the panel — the classic TournamentScreen shape.
 *  - "column" (8-team unofficials): rounds stacked vertically, sized for the
 *    side rail — the whole knockout visible with zero scrolling.
 *
 * Spoiler rules: a simulated series shows its PAIRING immediately but hides
 * the score until its key lands in `revealed`; un-simulated rounds show the
 * engine's next pairings only once everything simulated has been revealed.
 * The user's path is orange-edged; revealed user results tint good/bad.
 */

import { useCopy } from "@/content/copy";
import { useCareerCopy } from "@/content/careerCopy";
import type { CareerSave } from "@/engine/career/types";
import type { PlayoffRoundName, SeriesResult, TournamentState } from "@/engine/types";
import { nextPlayoffPairings, roundOrderFor } from "@/engine/playoffs";
import { cx } from "@/lib/util";
import { OrgMark } from "@/components/career/OrgMark";
import { Panel } from "@/components/ui/Panel";

const UPPER_COLUMNS: PlayoffRoundName[] = [
  "ub_quarterfinal",
  "ub_semifinal",
  "ub_final",
  "grand_final",
];
const LOWER_COLUMNS: PlayoffRoundName[] = [
  "lb_round1",
  "lb_round2",
  "lb_semifinal",
  "lb_final",
  "third_place",
];
const SINGLE_COLUMNS: PlayoffRoundName[] = ["quarterfinal", "semifinal", "final"];

const SLOTS: Record<PlayoffRoundName, number> = {
  ub_quarterfinal: 4,
  lb_round1: 2,
  ub_semifinal: 2,
  lb_round2: 2,
  ub_final: 1,
  lb_semifinal: 1,
  lb_final: 1,
  third_place: 1,
  grand_final: 1,
  quarterfinal: 4,
  semifinal: 2,
  final: 1,
};

export function CareerBracket({
  save,
  t,
  revealed,
  liveKey,
  showUpcoming,
  layout,
  onInspect,
}: {
  save: CareerSave;
  t: TournamentState;
  revealed: Set<string>;
  /** Key of the user series currently animating (orange edge). */
  liveKey: string | null;
  /** True once every simulated round is revealed — safe to name next pairings. */
  showUpcoming: boolean;
  layout: "wide" | "column";
  onInspect?: (key: string) => void;
}) {
  const copy = useCopy();
  const C = useCareerCopy();
  const T = copy.TOURNAMENT_UI;
  const p = t.playoffs;
  if (!p) return null;

  const roundIndexByName = new Map(p.rounds.map((r, i) => [r.name, i]));
  const nextRoundName = roundOrderFor(p.format)[p.rounds.length] ?? null;
  const upcomingPairs =
    !p.finished && showUpcoming && nextRoundName ? nextPlayoffPairings(p) : null;
  const seedOf = (id: string): number | null => {
    const i = p.seeds.indexOf(id);
    return i === -1 ? null : i + 1;
  };

  const renderCells = (name: PlayoffRoundName) => {
    const ri = roundIndexByName.get(name);
    const series = ri !== undefined ? p.rounds[ri].series : null;
    return Array.from({ length: SLOTS[name] }).map((_, si) => {
      const s = series?.[si] ?? null;
      const key = ri !== undefined ? `po:${ri}:${si}` : null;
      const isRevealed = Boolean(key && revealed.has(key));
      const isLive = Boolean(key && key === liveKey);
      const pair = !s && name === nextRoundName && upcomingPairs ? upcomingPairs[si] : null;
      return (
        <BracketCell
          key={si}
          save={save}
          t={t}
          series={s}
          revealed={isRevealed}
          live={isLive}
          pair={pair ?? undefined}
          seedOf={name === "ub_quarterfinal" || name === "quarterfinal" ? seedOf : undefined}
          tbdLabel={T.tbd}
          onClick={isRevealed && key && onInspect ? () => onInspect(key) : undefined}
        />
      );
    });
  };

  const wideColumn = (name: PlayoffRoundName) => (
    <div key={name} className="flex min-w-[150px] flex-1 flex-col justify-around gap-2">
      <p className="kicker text-center !text-[9px]">{T.roundNames[name] ?? name}</p>
      {renderCells(name)}
    </div>
  );

  const stackedSection = (name: PlayoffRoundName) => (
    <div key={name}>
      <p className="kicker mb-1.5 !text-[9px]">{T.roundNames[name] ?? name}</p>
      <div className="space-y-1.5">{renderCells(name)}</div>
    </div>
  );

  const isSingle = p.format === "single";

  return (
    <Panel className="p-4">
      <h3 className="display mb-3 text-sm font-bold uppercase tracking-[0.16em] text-ink">
        {C.event.bracket}
      </h3>

      {layout === "column" ? (
        <div className="space-y-4">
          {(isSingle ? SINGLE_COLUMNS : [...UPPER_COLUMNS, ...LOWER_COLUMNS]).map(stackedSection)}
        </div>
      ) : isSingle ? (
        <div className="overflow-x-auto pb-1">
          <div className="flex min-w-[500px] gap-3">{SINGLE_COLUMNS.map(wideColumn)}</div>
        </div>
      ) : (
        <div className="space-y-5 overflow-x-auto pb-1">
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-cyan">
              {C.event.upperBracket}
            </p>
            <div className="flex min-w-[640px] gap-3">{UPPER_COLUMNS.map(wideColumn)}</div>
          </div>
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-orange-bright">
              {C.event.lowerBracket}
            </p>
            <div className="flex min-w-[640px] gap-3">{LOWER_COLUMNS.map(wideColumn)}</div>
          </div>
        </div>
      )}
    </Panel>
  );
}

function BracketCell({
  save,
  t,
  series,
  revealed,
  live,
  pair,
  seedOf,
  tbdLabel,
  onClick,
}: {
  save: CareerSave;
  t: TournamentState;
  series: SeriesResult | null;
  revealed: boolean;
  live: boolean;
  pair?: [string, string];
  /** Seed lookup — shown on the opening round only. */
  seedOf?: (id: string) => number | null;
  tbdLabel: string;
  onClick?: () => void;
}) {
  const userIn = series
    ? series.teamAId === "user" || series.teamBId === "user"
    : pair
      ? pair.includes("user")
      : false;
  const userWon = series?.winnerTeamId === "user";

  const outline =
    revealed && userIn
      ? userWon
        ? "border-good/70 shadow-[0_0_14px_rgba(52,211,153,0.15)]"
        : "border-bad/70 shadow-[0_0_14px_rgba(248,113,113,0.15)]"
      : live
        ? "border-orange"
        : userIn
          ? "border-orange/50"
          : "border-line";

  const row = (teamId: string | null, score: number | null, won: boolean | null) => {
    const team = teamId ? t.teams[teamId] : null;
    const seed = teamId && seedOf ? seedOf(teamId) : null;
    return (
      <p className={cx("flex items-center gap-1.5 py-0.5 text-xs", won === false && "opacity-45")}>
        {teamId ? (
          <OrgMark save={save} orgRef={teamId} size="xs" className="shrink-0" />
        ) : (
          <span className="h-4 w-4 shrink-0 rounded bg-white/5" aria-hidden />
        )}
        <span
          className={cx(
            "min-w-0 flex-1 truncate",
            teamId === "user" ? "font-bold text-orange-bright" : team ? "text-ink" : "italic text-faint",
          )}
        >
          {team?.name ?? tbdLabel}
        </span>
        {seed !== null ? (
          <span className="display shrink-0 text-[9px] font-bold text-faint">#{seed}</span>
        ) : null}
        {score !== null ? (
          <span className={cx("display shrink-0 font-bold", won ? "text-good" : "text-sub")}>
            {score}
          </span>
        ) : null}
      </p>
    );
  };

  const body = series ? (
    <>
      {row(
        series.teamAId,
        revealed ? series.score[0] : null,
        revealed ? series.winnerTeamId === series.teamAId : null,
      )}
      {row(
        series.teamBId,
        revealed ? series.score[1] : null,
        revealed ? series.winnerTeamId === series.teamBId : null,
      )}
    </>
  ) : pair ? (
    <>
      {row(pair[0], null, null)}
      {row(pair[1], null, null)}
    </>
  ) : (
    <>
      {row(null, null, null)}
      {row(null, null, null)}
    </>
  );

  const className = cx(
    "w-full rounded-lg border bg-white/[0.03] px-2.5 py-1.5 text-left transition-colors",
    outline,
    onClick && "cursor-pointer hover:bg-white/[0.06]",
    live && "bg-orange/8",
  );

  return onClick ? (
    <button type="button" onClick={onClick} className={cx(className, "pop-in")}>
      {body}
    </button>
  ) : (
    <div className={className}>{body}</div>
  );
}
