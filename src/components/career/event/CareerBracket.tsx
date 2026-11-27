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
 * Spoiler rules: a simulated series shows its PAIRING once every EARLIER round
 * is fully revealed (v2.0: a later round's pairings give away who dropped out of
 * the round still animating) and hides the score until its key lands in
 * `revealed`; un-simulated rounds show the engine's next pairings only once
 * everything simulated has been revealed.
 * The user's path is orange-edged; revealed user results tint good/bad.
 */

import { useCopy } from "@/content/copy";
import { useCareerCopy } from "@/content/careerCopy";
import type { CareerSave } from "@/engine/career/types";
import type { PlayoffRoundName, PlayoffState, SeriesResult } from "@/engine/types";
import { nextPlayoffPairings, roundOrderFor } from "@/engine/playoffs";
import { cx } from "@/lib/util";
import { OrgMark } from "@/components/career/OrgMark";
import { EventTeamButton } from "./EventRosters";
import { Panel } from "@/components/ui/Panel";

/** Only presentation fields are required; compact spectator records never re-simulate. */
export type BracketSeries = Pick<SeriesResult, "teamAId" | "teamBId" | "score" | "winnerTeamId">;
export interface BracketTournament {
  teams: Record<string, { name: string }>;
  playoffs: PlayoffState | (Pick<PlayoffState, "format" | "seeds" | "championTeamId"> & {
    finished: true;
    rounds: { name: PlayoffRoundName; series: BracketSeries[] }[];
  }) | null;
}

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
  // v2.2 event formats (career-only brackets)
  upper_round: 2,
  lower_round1: 4,
  lower_round2: 2,
  ko_round1: 4,
  ub_round1: 8,
  lb_round3: 2,
  lb_round4: 2,
};

/**
 * v2.2 event formats: each career-only bracket's rows of columns (upper /
 * lower, or one knockout row). The hybrids' quarterfinal sits with the lower
 * bracket (upper losers drop into it), their semifinal and final with the upper.
 */
type BracketRow = { side: "upper" | "lower" | null; columns: PlayoffRoundName[] };
const LAYOUT_ROWS: Partial<Record<PlayoffState["format"], BracketRow[]>> = {
  single8: [{ side: null, columns: ["quarterfinal", "semifinal", "grand_final"] }],
  single12: [{ side: null, columns: ["ko_round1", "quarterfinal", "semifinal", "grand_final"] }],
  hybrid8: [
    { side: "upper", columns: ["upper_round", "semifinal", "grand_final"] },
    { side: "lower", columns: ["lower_round1", "quarterfinal"] },
  ],
  hybrid12: [
    { side: "upper", columns: ["upper_round", "semifinal", "grand_final"] },
    { side: "lower", columns: ["lower_round1", "lower_round2", "quarterfinal"] },
  ],
  double16: [
    { side: "upper", columns: ["ub_round1", "ub_quarterfinal", "ub_semifinal", "ub_final", "grand_final"] },
    { side: "lower", columns: ["lb_round1", "lb_round2", "lb_round3", "lb_round4", "lb_semifinal", "lb_final"] },
  ],
};

/** Cells a round shows: the classic table, but the hybrids' quarterfinal (and the 8-team one's lower round 1) has two series. */
function slotsOf(format: PlayoffState["format"], name: PlayoffRoundName): number {
  if (format === "hybrid8" && name === "lower_round1") return 2;
  if ((format === "hybrid8" || format === "hybrid12") && name === "quarterfinal") return 2;
  if (format === "double16") {
    if (name === "ub_quarterfinal" || name === "lb_round1" || name === "lb_round2") return 4;
  }
  return SLOTS[name];
}

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
  t: BracketTournament;
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
  // v2.0 spoiler guard: rounds beyond the first not-fully-revealed one stay TBD.
  let revealedRounds = 0;
  for (let ri = 0; ri < p.rounds.length; ri++) {
    if (p.rounds[ri].series.every((_, si) => revealed.has(`po:${ri}:${si}`))) revealedRounds += 1;
    else break;
  }

  const renderCells = (name: PlayoffRoundName) => {
    const ri = roundIndexByName.get(name);
    const spoiler = ri !== undefined && ri > revealedRounds;
    const series = ri !== undefined && !spoiler ? p.rounds[ri].series : null;
    return Array.from({ length: slotsOf(p.format, name) }).map((_, si) => {
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
          seedOf={!layoutRows && (name === "ub_quarterfinal" || name === "quarterfinal") ? seedOf : undefined}
          tbdLabel={T.tbd}
          onClick={isRevealed && key && onInspect ? () => onInspect(key) : undefined}
        />
      );
    });
  };

  const wideColumn = (name: PlayoffRoundName) => (
    <div key={name} className="flex min-w-0 flex-1 flex-col justify-around gap-2 sm:min-w-[150px]">
      <p className="kicker text-center">{T.roundNames[name] ?? name}</p>
      {renderCells(name)}
    </div>
  );

  const stackedSection = (name: PlayoffRoundName) => (
    <div key={name}>
      <p className="kicker mb-1.5">{T.roundNames[name] ?? name}</p>
      <div className="space-y-1.5">{renderCells(name)}</div>
    </div>
  );

  const isSingle = p.format === "single";
  // v2.2 event formats: a career-only bracket draws its own rows (no seed numbers: its seeds are slots).
  const layoutRows = LAYOUT_ROWS[p.format] ?? null;
  const sideLabel = (side: BracketRow["side"]) =>
    side === "upper" ? (
      <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.06em] text-cyan">{C.event.upperBracket}</p>
    ) : side === "lower" ? (
      <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.06em] text-orange-bright">{C.event.lowerBracket}</p>
    ) : null;

  return (
    <Panel className="p-4 sm:p-5">
      <h3 className="display mb-3 text-sm font-bold uppercase tracking-[0.16em] text-ink">
        {C.event.bracket}
      </h3>

      {layoutRows ? (
        layout === "column" ? (
          <div className="space-y-4">{layoutRows.flatMap((r) => r.columns).map(stackedSection)}</div>
        ) : (
          <div className="space-y-5 pb-1 sm:overflow-x-auto">
            {layoutRows.map((r) => (
              <div key={r.side ?? "ko"}>
                {sideLabel(r.side)}
                <div
                  className={cx(
                    "mobile-bracket flex gap-3",
                    r.columns.length <= 3 ? "sm:min-w-[500px]" : r.columns.length <= 5 ? "sm:min-w-[640px]" : "sm:min-w-[860px]",
                  )}
                >
                  {r.columns.map(wideColumn)}
                </div>
              </div>
            ))}
          </div>
        )
      ) : layout === "column" ? (
        <div className="space-y-4">
          {(isSingle ? SINGLE_COLUMNS : [...UPPER_COLUMNS, ...LOWER_COLUMNS]).map(stackedSection)}
        </div>
      ) : isSingle ? (
        <div className="pb-1 sm:overflow-x-auto">
          <div className="mobile-bracket flex gap-3 sm:min-w-[500px]">{SINGLE_COLUMNS.map(wideColumn)}</div>
        </div>
      ) : (
        <div className="space-y-5 pb-1 sm:overflow-x-auto">
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.06em] text-cyan">
              {C.event.upperBracket}
            </p>
            <div className="mobile-bracket flex gap-3 sm:min-w-[640px]">{UPPER_COLUMNS.map(wideColumn)}</div>
          </div>
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.06em] text-orange-bright">
              {C.event.lowerBracket}
            </p>
            <div className="mobile-bracket flex gap-3 sm:min-w-[640px]">{LOWER_COLUMNS.map(wideColumn)}</div>
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
  t: BracketTournament;
  series: BracketSeries | null;
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
        ? "border-good/70"
        : "border-bad/70"
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
        {teamId ? <EventTeamButton teamId={teamId} name={team?.name ?? teamId} className="flex-1">
          <OrgMark save={save} orgRef={teamId} size="xs" className="shrink-0" />
          <span className={cx("min-w-0 flex-1 truncate", teamId === "user" ? "font-bold text-orange-bright" : "text-ink")}>{team?.name ?? tbdLabel}</span>
        </EventTeamButton> : <>
          <span className="h-4 w-4 shrink-0 rounded bg-white/5" aria-hidden />
        <span
          className={cx(
            "min-w-0 flex-1 truncate",
            teamId === "user" ? "font-bold text-orange-bright" : team ? "text-ink" : "italic text-faint",
          )}
        >
          {team?.name ?? tbdLabel}
        </span>
        </>}
        {seed !== null ? (
          <span className="display shrink-0 text-[10px] font-bold text-faint">#{seed}</span>
        ) : null}
        {score !== null ? (
          <button type="button" disabled={!onClick} onClick={onClick} className={cx("display shrink-0 rounded px-1 font-bold hover:bg-white/10", won ? "text-good" : "text-sub")}>
            {score}
          </button>
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
    live && "bg-orange/8",
  );

  return <div className={cx(className, onClick && "pop-in")}>{body}</div>;
}
