"use client";

/**
 * Tournament screen: Swiss stage with live standings, then a single-elim
 * Bo7 bracket. The user's series plays out as a game-by-game ticker
 * (skippable); AI series resolve instantly in the background.
 */

import { useEffect, useMemo, useState } from "react";
import { TOURNAMENT } from "@/config/balance";
import { NARRATION, TOURNAMENT_UI as T } from "@/content/copy";
import { nextPlayoffPairings } from "@/engine/playoffs";
import { displayTeamOverall } from "@/engine/rating";
import { userHasPendingSeries } from "@/engine/tournament";
import type {
  PlayoffRoundName,
  RunState,
  SeriesResult,
  TournamentState,
  TournamentTeam,
} from "@/engine/types";
import { cx } from "@/lib/util";
import { useRunStore } from "@/store/runStore";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Panel, SectionTitle } from "@/components/ui/Panel";
import { RunStepper } from "./RunStepper";

const ROUND_LABEL: Record<PlayoffRoundName, string> = {
  quarterfinal: T.quarterfinal,
  semifinal: T.semifinal,
  final: T.final,
};

interface UserSeriesRef {
  series: SeriesResult;
  label: string;
}

function allUserSeries(t: TournamentState): UserSeriesRef[] {
  const out: UserSeriesRef[] = [];
  for (const round of t.swiss.rounds) {
    for (const s of round.series) {
      if (s.teamAId === "user" || s.teamBId === "user") {
        out.push({ series: s, label: `${T.swiss} · ${T.round(round.round)}` });
      }
    }
  }
  for (const round of t.playoffs?.rounds ?? []) {
    for (const s of round.series) {
      if (s.teamAId === "user" || s.teamBId === "user") {
        out.push({ series: s, label: ROUND_LABEL[round.name] });
      }
    }
  }
  return out;
}

function ratingLabel(team: TournamentTeam, showOverall: boolean): string {
  return showOverall ? String(displayTeamOverall(team.rating)) : "??";
}

export function TournamentScreen({ run }: { run: RunState }) {
  const playRound = useRunStore((s) => s.playRound);
  const finishRun = useRunStore((s) => s.finishRun);
  const [revealCount, setRevealCount] = useState<number | null>(null);

  const t = run.tournament;
  const userSeries = useMemo(() => (t ? allUserSeries(t) : []), [t]);
  const lastUserSeries = userSeries.at(-1) ?? null;

  // Ticker: reveal one game at a time.
  useEffect(() => {
    if (revealCount === null || !lastUserSeries) return;
    if (revealCount >= lastUserSeries.series.games.length) return;
    const id = setTimeout(() => setRevealCount(revealCount + 1), 750);
    return () => clearTimeout(id);
  }, [revealCount, lastUserSeries]);

  if (!t) return null;

  const handlePlay = () => {
    const before = userSeries.length;
    playRound();
    const after = useRunStore.getState().run?.tournament;
    if (after && allUserSeries(after).length > before) {
      setRevealCount(0);
    }
  };

  const revealing =
    revealCount !== null &&
    lastUserSeries !== null &&
    revealCount <= lastUserSeries.series.games.length;

  const record = t.swiss.records.find((r) => r.teamId === "user");

  return (
    <div className="rise-in">
      <RunStepper run={run} />

      <SectionTitle
        kicker={t.stage === "swiss" ? T.swiss : T.playoffs}
        title={T.title}
        right={
          record ? (
            <Badge tone="blue" className="!text-sm">
              {T.record(record.wins, record.losses)}
            </Badge>
          ) : null
        }
        className="mb-6"
      />

      {revealing && lastUserSeries ? (
        <SeriesTicker
          run={run}
          t={t}
          entry={lastUserSeries}
          revealCount={revealCount}
          onSkip={() => setRevealCount(lastUserSeries.series.games.length)}
          onContinue={() => setRevealCount(null)}
        />
      ) : (
        <MainView run={run} t={t} onPlay={handlePlay} onFinish={finishRun} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main view (between series)
// ---------------------------------------------------------------------------

function MainView({
  run,
  t,
  onPlay,
  onFinish,
}: {
  run: RunState;
  t: TournamentState;
  onPlay: () => void;
  onFinish: () => void;
}) {
  const hasPending = userHasPendingSeries(t);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        {t.stage === "finished" ? (
          <FinishedPanel run={run} t={t} onFinish={onFinish} />
        ) : hasPending ? (
          <NextMatchPanel run={run} t={t} onPlay={onPlay} />
        ) : (
          <Panel strong className="p-6 text-center">
            <p className="kicker mb-2">{T.swiss}</p>
            <p className="display text-xl font-bold uppercase tracking-wide text-ink">
              {T.lockedTitle}
            </p>
            <p className="mt-2 text-sm text-sub">{T.lockedBody}</p>
            <Button variant="primary" className="mt-5 min-w-48" onClick={onPlay}>
              {T.continue}
            </Button>
          </Panel>
        )}

        {t.playoffs ? <PlayoffBracket run={run} t={t} /> : null}
        {t.swiss.rounds.length > 0 ? <LastRoundResults t={t} /> : null}
      </div>

      <SwissStandings run={run} t={t} />
    </div>
  );
}

function NextMatchPanel({
  run,
  t,
  onPlay,
}: {
  run: RunState;
  t: TournamentState;
  onPlay: () => void;
}) {
  let opponentId: string | null = null;
  let roundLabel = "";
  let bestOf: number = TOURNAMENT.swiss.bestOf;

  if (t.stage === "swiss") {
    const pairing = t.swiss.nextPairings?.find(([a, b]) => a === "user" || b === "user");
    if (pairing) opponentId = pairing[0] === "user" ? pairing[1] : pairing[0];
    roundLabel = `${T.swiss} · ${T.round(t.swiss.rounds.length + 1)}`;
  } else if (t.playoffs) {
    const pairing = nextPlayoffPairings(t.playoffs).find(([a, b]) => a === "user" || b === "user");
    if (pairing) opponentId = pairing[0] === "user" ? pairing[1] : pairing[0];
    const name = (["quarterfinal", "semifinal", "final"] as const)[t.playoffs.rounds.length];
    roundLabel = ROUND_LABEL[name];
    bestOf = TOURNAMENT.playoffs.bestOf;
  }

  if (!opponentId) return null;
  const user = t.teams["user"];
  const opp = t.teams[opponentId];

  return (
    <Panel strong glow="orange" className="p-6">
      <p className="kicker mb-4">
        {T.yourMatch} — {roundLabel} · {T.bestOf(bestOf)}
      </p>
      <div className="mb-6 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <TeamSide team={user} run={run} align="left" />
        <span className="display text-2xl font-bold text-faint">VS</span>
        <TeamSide team={opp} run={run} align="right" />
      </div>
      <Button variant="primary" size="lg" full onClick={onPlay}>
        {T.playSeries}
      </Button>
    </Panel>
  );
}

function TeamSide({
  team,
  run,
  align,
}: {
  team: TournamentTeam;
  run: RunState;
  align: "left" | "right";
}) {
  return (
    <div className={cx("min-w-0", align === "right" && "text-right")}>
      <p className="display truncate text-lg font-bold uppercase tracking-wide text-ink md:text-xl">
        {team.name}
      </p>
      <p className="mt-1 text-xs text-sub">
        <span className="display text-base font-bold text-cyan">
          {ratingLabel(team, run.showOverall)}
        </span>{" "}
        OVR · {team.region}
        {team.specialIds.length > 0 ? <span className="ml-1 text-orange-bright">★</span> : null}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Series ticker
// ---------------------------------------------------------------------------

function SeriesTicker({
  run,
  t,
  entry,
  revealCount,
  onSkip,
  onContinue,
}: {
  run: RunState;
  t: TournamentState;
  entry: UserSeriesRef;
  revealCount: number;
  onSkip: () => void;
  onContinue: () => void;
}) {
  const { series, label } = entry;
  const oppId = series.teamAId === "user" ? series.teamBId : series.teamAId;
  const opp = t.teams[oppId];
  const done = revealCount >= series.games.length;
  const userWon = series.winnerTeamId === "user";
  const bestOf = label.startsWith(T.swiss)
    ? TOURNAMENT.swiss.bestOf
    : TOURNAMENT.playoffs.bestOf;

  let userWins = 0;
  let oppWins = 0;
  const visible = series.games.slice(0, revealCount);
  for (const g of visible) {
    if (g.winnerTeamId === "user") userWins += 1;
    else oppWins += 1;
  }

  const narration = useMemo(() => {
    if (!done) return null;
    const margin = Math.abs(series.score[0] - series.score[1]);
    const userDiff = series.teamAId === "user" ? series.ratingDiff : -series.ratingDiff;
    const idx = series.games.length;
    const pick = (arr: readonly string[]) => arr[idx % arr.length];
    const lines: string[] = [];
    if (userWon && userDiff <= -3) lines.push(pick(NARRATION.upsetWin));
    else if (userWon && margin === 1) lines.push(pick(NARRATION.seriesWinClose));
    else if (userWon) lines.push(pick(NARRATION.seriesWin));
    else if (!userWon && userDiff >= 3) lines.push(pick(NARRATION.upsetLoss));
    else if (margin === 1) lines.push(pick(NARRATION.seriesLossClose));
    else lines.push(pick(NARRATION.seriesLoss));
    if (series.games.some((g) => g.deciding && g.notes.includes("special_clutch"))) {
      lines.push(NARRATION.specialNote);
    } else if (series.games.some((g) => g.overtime && g.deciding)) {
      lines.push(NARRATION.overtimeNote);
    }
    return lines;
  }, [done, series, userWon]);

  return (
    <Panel strong className="mx-auto max-w-2xl p-6">
      <p className="kicker mb-1">{label} · {T.bestOf(bestOf)}</p>
      <div className="mb-5 flex items-center justify-between gap-4">
        <p className="display min-w-0 flex-1 truncate text-xl font-bold uppercase tracking-wide text-ink">
          Your Team
        </p>
        <p className="display shrink-0 text-3xl font-bold">
          <span className={cx(done && userWon ? "text-orange-bright" : "text-ink")}>{userWins}</span>
          <span className="mx-2 text-faint">–</span>
          <span className={cx(done && !userWon ? "text-orange-bright" : "text-ink")}>{oppWins}</span>
        </p>
        <p className="display min-w-0 flex-1 truncate text-right text-xl font-bold uppercase tracking-wide text-ink">
          {opp.name}
        </p>
      </div>

      <ol className="space-y-2" aria-live="polite">
        {visible.map((game) => {
          const won = game.winnerTeamId === "user";
          const score = won ? game.score : [game.score[1], game.score[0]];
          return (
            <li
              key={game.index}
              className={cx(
                "rise-in flex items-center justify-between rounded-lg border px-4 py-2.5",
                won ? "border-good/30 bg-good/5" : "border-bad/30 bg-bad/5",
              )}
            >
              <span className="text-xs uppercase tracking-wider text-sub">
                {T.game(game.index)}
                {game.overtime ? (
                  <span className="ml-2 font-bold text-orange-bright">{T.overtime}</span>
                ) : null}
                {game.deciding ? (
                  <span className="ml-2 font-bold text-cyan">Match point</span>
                ) : null}
              </span>
              <span className={cx("display text-base font-bold", won ? "text-good" : "text-bad")}>
                {won ? "W" : "L"} {score[0]}–{score[1]}
              </span>
            </li>
          );
        })}
      </ol>

      {done && narration ? (
        <div className="pop-in mt-5 rounded-lg border border-line bg-white/4 p-4">
          <p
            className={cx(
              "display mb-1 text-lg font-bold uppercase tracking-wide",
              userWon ? "text-good" : "text-bad",
            )}
          >
            {userWon ? "Series win" : "Series loss"} {series.teamAId === "user" ? series.score[0] : series.score[1]}–
            {series.teamAId === "user" ? series.score[1] : series.score[0]}
          </p>
          {narration.map((line, i) => (
            <p key={i} className="text-sm leading-relaxed text-sub">
              {line}
            </p>
          ))}
        </div>
      ) : null}

      <div className="mt-6 flex justify-end gap-3">
        {!done ? (
          <Button variant="ghost" onClick={onSkip}>
            {T.skipAnimation}
          </Button>
        ) : (
          <Button variant="primary" onClick={onContinue}>
            {T.continue}
          </Button>
        )}
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Standings, results, bracket, finish
// ---------------------------------------------------------------------------

function SwissStandings({ run, t }: { run: RunState; t: TournamentState }) {
  const sorted = [...t.swiss.records].sort(
    (a, b) =>
      b.wins - a.wins ||
      a.losses - b.losses ||
      b.gameDiff - a.gameDiff ||
      t.teams[b.teamId].rating.total - t.teams[a.teamId].rating.total,
  );

  return (
    <aside aria-label={T.standings}>
      <Panel className="p-4">
        <h3 className="display mb-3 text-sm font-bold uppercase tracking-[0.16em] text-ink">
          {T.standings} — {T.swiss}
        </h3>
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-faint">
              <th className="pb-2 font-semibold">Team</th>
              <th className="pb-2 text-center font-semibold">W–L</th>
              <th className="pb-2 text-center font-semibold">GD</th>
              <th className="pb-2 text-right font-semibold">OVR</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const team = t.teams[r.teamId];
              const isUser = r.teamId === "user";
              return (
                <tr
                  key={r.teamId}
                  className={cx(
                    "border-t border-line",
                    isUser && "bg-orange/8",
                    r.status === "eliminated" && "opacity-45",
                  )}
                >
                  <td className={cx("max-w-0 truncate py-1.5 pr-2", isUser ? "font-bold text-orange-bright" : "text-ink")}>
                    {team.name}
                    {r.status === "advanced" ? (
                      <span className="ml-1.5 text-[9px] font-bold uppercase text-good">✓</span>
                    ) : null}
                  </td>
                  <td className="display whitespace-nowrap py-1.5 text-center font-bold">
                    {r.wins}–{r.losses}
                  </td>
                  <td className={cx("py-1.5 text-center", r.gameDiff > 0 ? "text-good" : r.gameDiff < 0 ? "text-bad" : "text-sub")}>
                    {r.gameDiff > 0 ? `+${r.gameDiff}` : r.gameDiff}
                  </td>
                  <td className="display py-1.5 text-right font-bold text-cyan">
                    {ratingLabel(team, run.showOverall)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Panel>
    </aside>
  );
}

function LastRoundResults({ t }: { t: TournamentState }) {
  const lastRound = t.swiss.rounds.at(-1);
  if (!lastRound) return null;
  return (
    <Panel className="p-4">
      <h3 className="display mb-3 text-sm font-bold uppercase tracking-[0.16em] text-ink">
        {T.otherMatches} — {T.round(lastRound.round)}
      </h3>
      <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {lastRound.series.map((s, i) => (
          <li key={i} className="flex items-center justify-between gap-2 rounded-md bg-white/3 px-3 py-1.5 text-xs">
            <span className={cx("min-w-0 flex-1 truncate", s.winnerTeamId === s.teamAId ? "font-semibold text-ink" : "text-sub")}>
              {t.teams[s.teamAId].name}
            </span>
            <span className="display shrink-0 font-bold text-sub">
              {s.score[0]}–{s.score[1]}
            </span>
            <span className={cx("min-w-0 flex-1 truncate text-right", s.winnerTeamId === s.teamBId ? "font-semibold text-ink" : "text-sub")}>
              {t.teams[s.teamBId].name}
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function PlayoffBracket({ run, t }: { run: RunState; t: TournamentState }) {
  const p = t.playoffs;
  if (!p) return null;

  const columns: { name: PlayoffRoundName; slots: number }[] = [
    { name: "quarterfinal", slots: 4 },
    { name: "semifinal", slots: 2 },
    { name: "final", slots: 1 },
  ];

  const seriesFor = (name: PlayoffRoundName) =>
    p.rounds.find((r) => r.name === name)?.series ?? null;

  const upcoming =
    !p.finished && p.rounds.length < 3
      ? { name: (["quarterfinal", "semifinal", "final"] as const)[p.rounds.length], pairs: nextPlayoffPairings(p) }
      : null;

  return (
    <Panel className="overflow-x-auto p-4">
      <h3 className="display mb-4 text-sm font-bold uppercase tracking-[0.16em] text-ink">
        {T.bracket} · {T.bestOf(TOURNAMENT.playoffs.bestOf)}
      </h3>
      <div className="grid min-w-[560px] grid-cols-3 gap-3">
        {columns.map((col) => {
          const played = seriesFor(col.name);
          const isUpcoming = upcoming?.name === col.name;
          return (
            <div key={col.name} className="flex flex-col justify-around gap-3">
              <p className="kicker text-center !text-[10px]">{ROUND_LABEL[col.name]}</p>
              {Array.from({ length: col.slots }).map((_, i) => {
                const s = played?.[i];
                const pair = isUpcoming ? upcoming.pairs[i] : null;
                return (
                  <div key={i} className="rounded-lg border border-line bg-white/3 p-2.5">
                    {s ? (
                      <>
                        <BracketRow run={run} t={t} teamId={s.teamAId} score={s.score[0]} winner={s.winnerTeamId === s.teamAId} />
                        <BracketRow run={run} t={t} teamId={s.teamBId} score={s.score[1]} winner={s.winnerTeamId === s.teamBId} />
                      </>
                    ) : pair ? (
                      <>
                        <BracketRow run={run} t={t} teamId={pair[0]} />
                        <BracketRow run={run} t={t} teamId={pair[1]} />
                      </>
                    ) : (
                      <>
                        <p className="py-0.5 text-xs italic text-faint">TBD</p>
                        <p className="py-0.5 text-xs italic text-faint">TBD</p>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function BracketRow({
  run,
  t,
  teamId,
  score,
  winner,
}: {
  run: RunState;
  t: TournamentState;
  teamId: string;
  score?: number;
  winner?: boolean;
}) {
  const team = t.teams[teamId];
  const isUser = teamId === "user";
  return (
    <p className={cx("flex items-center justify-between gap-2 py-0.5 text-xs", winner === false && "opacity-50")}>
      <span className={cx("min-w-0 truncate", isUser ? "font-bold text-orange-bright" : "text-ink")}>
        {team?.name ?? "TBD"}
      </span>
      {score !== undefined ? (
        <span className={cx("display shrink-0 font-bold", winner ? "text-good" : "text-sub")}>{score}</span>
      ) : (
        <span className="display shrink-0 text-[10px] text-faint">
          {team ? ratingLabel(team, run.showOverall) : ""}
        </span>
      )}
    </p>
  );
}

function FinishedPanel({
  run,
  t,
  onFinish,
}: {
  run: RunState;
  t: TournamentState;
  onFinish: () => void;
}) {
  const championId = t.playoffs?.championTeamId;
  const champion = championId ? t.teams[championId] : null;
  const userChampion = championId === "user";

  return (
    <Panel strong glow={userChampion ? "orange" : "blue"} className="p-6 text-center">
      {userChampion ? (
        <>
          <p className="kicker mb-2">{T.title}</p>
          <p className="display text-4xl font-bold uppercase tracking-wide text-orange-bright">
            Champions
          </p>
          <p className="mt-2 text-sm text-sub">Your roster takes the title.</p>
        </>
      ) : (
        <>
          <p className="kicker mb-2">{run.tournament?.userEliminated ? T.eliminatedTitle : T.title}</p>
          {champion ? (
            <p className="display text-2xl font-bold uppercase tracking-wide text-ink">
              {champion.name} <span className="text-sub">wins the title</span>
            </p>
          ) : null}
          <p className="mt-2 text-sm text-sub">{T.eliminatedBody}</p>
        </>
      )}
      <Button variant="primary" size="lg" className="mt-6 min-w-56" onClick={onFinish}>
        {T.toResults}
      </Button>
    </Panel>
  );
}
