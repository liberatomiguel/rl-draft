"use client";

/**
 * Road to Worlds v2.1 Matchday slice 5: the user's series in custom mode.
 *
 * One board, three moments of the same series (store: pendingUserSeriesOf):
 *  - before game 1, the PLAN: the coach's plan already filled in (style,
 *    kickoffs, the player marked), the scouting line and the starters'
 *    traits. Every call is optional: "Play game 1" plays it as it stands;
 *  - between games, the BREAK: the last result, the momentum meters, one
 *    timeout, the adjustment (style, kickoffs) and one sub;
 *  - after the last game, the result and Continue (the round then plays).
 * "Leave it to the coach" plays the rest of the series out at any point.
 *
 * Pure skin over the store's series actions; every rule (one timeout, one
 * sub, the plan locked after game 1) lives in the flow and the engine.
 */

import { CAREER_MATCHDAY } from "@/config/balance";
import { useCareerCopy } from "@/content/careerCopy";
import { coachPlanFor, coachQualityOf, shownStyle } from "@/engine/career/matchday";
import { isSeriesOver } from "@/engine/match";
import { PLAY_STYLES, styleBeats } from "@/engine/career/styles";
import type { CareerSave } from "@/engine/career/types";
import type { KickoffPlan, PlayStyleId, SeriesPlan, TournamentTeam } from "@/engine/types";
import { cx } from "@/lib/util";
import { pendingUserSeriesOf, userSeriesTeamsOf } from "@/store/careerFlow";
import { useCareerStore } from "@/store/careerStore";
import { OrgMark } from "@/components/career/OrgMark";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { useEffect, useRef, useState } from "react";
import { useCareerSave } from "@/components/career/careerUi";

const KICKOFFS: readonly KickoffPlan[] = ["safe", "standard", "aggressive"];

export function SeriesDesk({
  save,
  label,
  onPlayGame,
  onContinue,
}: {
  save: CareerSave;
  /** The round's label ("Swiss stage · Round 3", "Upper final"). */
  label: string;
  /** Before each "Play game N" (the screen marks the round as played here). */
  onPlayGame: () => void;
  /** After the last game: play the round on. */
  onContinue: () => void;
}) {
  const C = useCareerCopy();
  const D = C.seriesDesk;
  const setPlan = useCareerStore((s) => s.setSeriesPlan);
  const playGame = useCareerStore((s) => s.playSeriesGame);
  const timeout = useCareerStore((s) => s.seriesTimeout);
  const adjust = useCareerStore((s) => s.seriesAdjust);
  const sub = useCareerStore((s) => s.seriesSub);
  const delegate = useCareerStore((s) => s.delegateSeries);
  // The board gets shorter after game 1 (no mark, no traits): keep its top on screen (phones).
  const boardRef = useRef<HTMLDivElement>(null);
  const gamesPlayed = pendingUserSeriesOf(save)?.state.games.length ?? 0;
  useEffect(() => {
    const el = boardRef.current;
    if (gamesPlayed > 0 && el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ block: "start" });
  }, [gamesPlayed]);

  const us = pendingUserSeriesOf(save);
  const teams = userSeriesTeamsOf(save);
  const md = us?.state.matchday;
  if (!us || !teams || !md) return null;

  const side = us.userSide;
  const me = side === "a" ? teams.teamA : teams.teamB;
  const opp = side === "a" ? teams.teamB : teams.teamA;
  const myPlan = side === "a" ? md.planA : md.planB;
  const oppPlan = side === "a" ? md.planB : md.planA;
  const state = us.state;
  const played = state.games.length;
  const over = isSeriesOver(state);
  const myWins = side === "a" ? state.winsA : state.winsB;
  const oppWins = side === "a" ? state.winsB : state.winsA;
  const oppStyle = shownStyle(opp, oppPlan);
  const quality = save.coach ? coachQualityOf(save.coach.overall) : null;
  const coachPlan: SeriesPlan | null = played === 0 ? coachPlanFor(me, opp, quality, us.seed, "user") : null;

  const play = () => {
    onPlayGame();
    playGame();
  };
  const leave = () => {
    onPlayGame();
    delegate();
  };
  const change = (next: { style?: PlayStyleId | null; kickoff?: KickoffPlan; mark?: number }) => {
    if (played === 0) {
      const { style, ...rest } = next;
      const plan: SeriesPlan = { ...myPlan, ...rest, ...(style ? { style } : {}) };
      if (next.style === null) delete plan.style;
      if ("mark" in next && next.mark === undefined) delete plan.mark;
      setPlan(plan);
    } else {
      adjust({ ...(next.style !== undefined ? { style: next.style } : {}), ...(next.kickoff ? { kickoff: next.kickoff } : {}) });
    }
  };

  const title = over ? D.overTitle : played === 0 ? D.planTitle : D.breakTitle(played);
  const sub_ = over ? null : played === 0 ? (save.coach ? D.planSub : D.planSubNoCoach) : D.breakSub;

  return (
    <div ref={boardRef} className="scroll-mt-28">
    <Panel strong className="p-4 sm:p-5" aria-live="polite">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="kicker">{label}</p>
        <span className="display text-sm font-bold text-sub">
          {D.you} {myWins}-{oppWins}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <OrgMark save={save} orgRef={opp.id} size="md" className="shrink-0" />
        <div className="min-w-0">
          <h2 className="display text-xl font-bold uppercase leading-tight text-ink sm:text-2xl">{title}</h2>
          <p className="truncate text-sm text-sub">{opp.name}</p>
        </div>
      </div>
      {sub_ ? <p className="mt-2 text-sm text-sub">{sub_}</p> : null}

      {played > 0 ? <LastGames save={save} /> : null}

      {over ? (
        <div className="mt-4">
          <p className={cx("display text-lg font-bold uppercase", myWins > oppWins ? "text-good" : "text-bad")}>
            {myWins > oppWins ? D.seriesWon : D.seriesLost} · {myWins}-{oppWins}
          </p>
          <Button variant="primary" className="mt-3 w-full sm:w-auto" onClick={onContinue}>
            {D.continue}
          </Button>
        </div>
      ) : (
        <>
          {played === 0 ? (
            <ScoutingLine opp={opp} oppStyle={oppStyle} oppPlan={oppPlan} />
          ) : (
            <Momentum mine={side === "a" ? md.momentumA : md.momentumB} theirs={side === "a" ? md.momentumB : md.momentumA} oppName={opp.name} />
          )}

          {/* Style */}
          {me.style ? (
            <Field label={D.style}>
              <Choice
                selected={myPlan.style === undefined}
                coach={coachPlan ? coachPlan.style === undefined : false}
                onClick={() => change({ style: null })}
              >
                {D.natural(D.styles[me.style.natural])}
              </Choice>
              {PLAY_STYLES.filter((s) => s !== me.style!.natural).map((s) => (
                <Choice
                  key={s}
                  selected={myPlan.style === s}
                  coach={coachPlan?.style === s}
                  onClick={() => change({ style: s })}
                  detail={`${D.fit(Math.round((me.style!.fit[s] ?? 0) * 100))} · ${D.beats(D.styles[styleBeats(s)])}`}
                >
                  {D.styles[s]}
                </Choice>
              ))}
            </Field>
          ) : null}

          {/* Kickoffs */}
          <Field label={D.kickoff} hint={D.kickoffHint[myPlan.kickoff]}>
            {KICKOFFS.map((k) => (
              <Choice key={k} selected={myPlan.kickoff === k} coach={coachPlan?.kickoff === k} onClick={() => change({ kickoff: k })}>
                {D.kickoffs[k]}
              </Choice>
            ))}
          </Field>

          {/* Mark (the plan only) */}
          {played === 0 ? (
            <Field label={D.mark} hint={D.markHint}>
              <Choice selected={myPlan.mark === undefined} coach={coachPlan ? coachPlan.mark === undefined : false} onClick={() => change({ mark: undefined })}>
                {D.markNobody}
              </Choice>
              {opp.playerNames.map((name, i) => (
                <Choice
                  key={name + i}
                  selected={myPlan.mark === i}
                  coach={coachPlan?.mark === i}
                  onClick={() => change({ mark: i })}
                  detail={opp.playmakerIndex === i ? D.playmaker : undefined}
                >
                  {name}
                </Choice>
              ))}
            </Field>
          ) : null}

          {played === 0 ? <Starters me={me} /> : <BreakCalls save={save} onTimeout={timeout} onSub={sub} />}

          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button variant="primary" className="w-full sm:w-auto" onClick={play}>
              {D.playGame(played + 1)}
            </Button>
            <Button variant="ghost" className="w-full sm:w-auto" onClick={leave}>
              {save.coach ? D.leaveToCoach : D.leaveToCaptain}
            </Button>
          </div>
        </>
      )}
    </Panel>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <fieldset className="mt-4">
      <legend className="kicker mb-1.5">{label}</legend>
      <div className="flex flex-wrap gap-1.5">{children}</div>
      {hint ? <p className="mt-1.5 text-xs text-faint">{hint}</p> : null}
    </fieldset>
  );
}

/** One option: a hairline that turns orange when chosen; "Coach" tags the coach's own call. */
function Choice({
  selected,
  coach,
  onClick,
  detail,
  children,
}: {
  selected: boolean;
  coach?: boolean;
  onClick: () => void;
  detail?: string;
  children: React.ReactNode;
}) {
  const C = useCareerCopy();
  const hasCoach = Boolean(useCareerSave()?.coach);
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cx(
        "flex min-h-11 min-w-0 max-w-full flex-col items-start justify-center rounded-md border px-3 py-1.5 text-left transition-colors sm:min-h-9",
        selected ? "border-orange text-ink" : "border-line-strong text-sub hover:border-blue/60 hover:text-ink",
      )}
    >
      <span className="flex items-center gap-1.5">
        <span className="display text-xs font-semibold uppercase tracking-wide">{children}</span>
        {coach ? <Badge className="!px-1 !py-0 !text-[9px]">{hasCoach ? C.seriesDesk.coachPick : C.seriesDesk.captainPick}</Badge> : null}
      </span>
      {detail ? <span className="text-[11px] text-faint">{detail}</span> : null}
    </button>
  );
}

function ScoutingLine({ opp, oppStyle, oppPlan }: { opp: TournamentTeam; oppStyle?: PlayStyleId; oppPlan: SeriesPlan }) {
  const D = useCareerCopy().seriesDesk;
  const pm = opp.playmakerIndex !== undefined ? opp.playerNames[opp.playmakerIndex] : undefined;
  if (!oppStyle && !pm) return null;
  return (
    <div className="mt-4 rounded-md border border-line px-3 py-2">
      <p className="kicker mb-0.5">{D.scouting}</p>
      <p className="text-sm text-ink">
        {oppStyle ? D.theyPlay(D.styles[oppStyle]) : null}
        {oppStyle && pm ? " · " : null}
        {pm ? D.theirPlaymaker(pm) : null}
      </p>
      {oppPlan.kickoff !== "standard" ? <p className="text-xs text-faint">{D.kickoff}: {D.kickoffs[oppPlan.kickoff]}</p> : null}
    </div>
  );
}

function Starters({ me }: { me: TournamentTeam }) {
  const D = useCareerCopy().seriesDesk;
  if (!me.traits?.some((t) => t.length > 0)) return null;
  return (
    <div className="mt-4">
      <p className="kicker mb-1.5">{D.starters}</p>
      <ul className="space-y-1">
        {me.playerNames.map((name, i) => (
          <li key={name + i} className="flex flex-wrap items-center gap-1.5 text-sm">
            <span className="min-w-0 font-semibold text-ink">{name}</span>
            {(me.traits?.[i] ?? []).map((t) => (
              <Badge key={t} className="!text-[10px]">
                {D.traits[t]}
              </Badge>
            ))}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The games played so far, the user's goals first. */
function LastGames({ save }: { save: CareerSave }) {
  const D = useCareerCopy().seriesDesk;
  const us = pendingUserSeriesOf(save)!;
  return (
    <ol className="mt-3 flex flex-wrap gap-1.5">
      {us.state.games.map((g) => {
        const won = g.winnerTeamId === "user";
        const [mine, theirs] = won ? g.score : [g.score[1], g.score[0]];
        return (
          <li
            key={g.index}
            className={cx(
              "display rounded-md border px-2 py-0.5 text-xs font-bold",
              won ? "border-good/50 text-good" : "border-bad/50 text-bad",
            )}
          >
            {won ? D.gameWon(g.index, mine, theirs) : D.gameLost(g.index, mine, theirs)}
            {g.overtime ? ` ${D.overtimeShort}` : ""}
          </li>
        );
      })}
    </ol>
  );
}

function Momentum({ mine, theirs, oppName }: { mine: number; theirs: number; oppName: string }) {
  const D = useCareerCopy().seriesDesk;
  return (
    <div className="mt-4">
      <p className="kicker mb-1.5">{D.momentum}</p>
      <MeterRow label={D.you} value={mine} />
      <MeterRow label={oppName} value={theirs} />
      <p className="mt-1 text-xs text-faint">{D.momentumHint}</p>
    </div>
  );
}

/** −max..+max from the centre: gain in green, a drop in red. */
function MeterRow({ label, value }: { label: string; value: number }) {
  const max = CAREER_MATCHDAY.momentumMax;
  const min = 0 - max;
  const share = Math.min(1, Math.abs(value) / max) * 50;
  return (
    <div className="mb-1 grid grid-cols-[minmax(0,7rem)_1fr] items-center gap-2 sm:grid-cols-[10rem_1fr]">
      <span className="truncate text-xs text-sub">{label}</span>
      <span
        className="relative h-2 rounded-sm border border-line bg-white/[0.03]"
        role="meter"
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={Math.round(value * 10) / 10}
      >
        <span className="absolute inset-y-0 left-1/2 w-px bg-line-strong" aria-hidden />
        <span
          className={cx("absolute inset-y-0", value >= 0 ? "left-1/2 bg-good" : "right-1/2 bg-bad")}
          style={{ width: `${share}%` }}
          aria-hidden
        />
      </span>
    </div>
  );
}

/** The break: one timeout, one sub. */
function BreakCalls({
  save,
  onTimeout,
  onSub,
}: {
  save: CareerSave;
  onTimeout: () => void;
  onSub: (outId: string, inId: string) => void;
}) {
  const D = useCareerCopy().seriesDesk;
  const us = pendingUserSeriesOf(save)!;
  const ev = save.activeEvent!;
  const md = us.state.matchday!;
  const spent = us.userSide === "a" ? md.timeoutA : md.timeoutB;
  const onCourt = ev.fieldedIds ?? save.starterIds;
  const bench = save.squad.filter((p) => !onCourt.includes(p.id));
  const nameOf = (id: string) => save.squad.find((p) => p.id === id)?.name ?? id;
  const [outId, setOutId] = useState<string>(onCourt[0] ?? "");
  const [inId, setInId] = useState<string>(bench[0]?.id ?? "");
  const canSub = !ev.def.teamSize;

  return (
    <div className="mt-4 grid gap-4 sm:grid-cols-2">
      <div>
        <p className="kicker mb-1.5">{D.timeoutLabel}</p>
        <Button variant="secondary" size="sm" disabled={spent} onClick={onTimeout}>
          {spent ? D.timeoutUsed : D.timeout}
        </Button>
        <p className="mt-1.5 text-xs text-faint">{D.timeoutHint}</p>
      </div>
      {canSub ? (
        <div>
          <p className="kicker mb-1.5">{D.sub}</p>
          {us.sub ? (
            <p className="text-sm text-ink">{D.subDone(nameOf(us.sub.inId), nameOf(us.sub.outId))}</p>
          ) : bench.length === 0 ? (
            <p className="text-sm text-faint">{D.subNone}</p>
          ) : (
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex min-w-0 flex-col text-xs text-faint">
                {D.subOut}
                <select
                  value={outId}
                  onChange={(e) => setOutId(e.target.value)}
                  className="mt-0.5 min-h-11 max-w-[9rem] rounded-md border border-line-strong bg-surface px-2 text-sm text-ink sm:min-h-9"
                >
                  {onCourt.map((id) => (
                    <option key={id} value={id}>
                      {nameOf(id)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex min-w-0 flex-col text-xs text-faint">
                {D.subIn}
                <select
                  value={inId}
                  onChange={(e) => setInId(e.target.value)}
                  className="mt-0.5 min-h-11 max-w-[9rem] rounded-md border border-line-strong bg-surface px-2 text-sm text-ink sm:min-h-9"
                >
                  {bench.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <Button variant="secondary" size="sm" disabled={!outId || !inId} onClick={() => onSub(outId, inId)}>
                {D.subConfirm}
              </Button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
