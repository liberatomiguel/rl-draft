"use client";

/**
 * rc9 duel-ui: the match. Both teams' cards are in the link, so the series is
 * `playDuel(rules, challenger, opponent)` and the same for both friends.
 *
 *  1. FACE-OFF: the two sides face to face, mark and name large, the team
 *     overall as the figure (in a hidden duel this is the reveal), the rosters
 *     as the game's cards. Play the series, or skip to the result.
 *  2. LIVE: every game on the clock in the career's live view
 *     (`components/match/LiveGameView`), one after the other with no stop, the
 *     series pips over it; pause, speed, skip the game, skip the series.
 *  3. END: the winner, the scoreline as the figure, a chip per game, the
 *     series MVP; New match (same rules, new boards, the asker drafts first),
 *     the link to send back, and Watch again.
 *
 * The viewer's side is orange, the other blue. Nothing is stored.
 */

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { DUEL_MATCH, MATCH_LIVE } from "@/config/balance";
import { useCopy } from "@/content/copy";
import { duelCodePath, duelRematch, type DuelReply } from "@/engine/duelLink";
import { playDuel, type DuelSeries } from "@/engine/duelMatch";
import { isStaleDuel, type DuelSideKey } from "@/engine/duelRules";
import { duelGameRows, duelScoreline, duelSideLabel, duelWinner, duelWinnerLine } from "@/engine/duelViews";
import { sfx } from "@/lib/sfx";
import { cx } from "@/lib/util";
import { trackDuel } from "@/store/duelStore";
import { useRunStore } from "@/store/runStore";
import { LiveGameView, type LiveLabels } from "@/components/match/LiveGameView";
import type { LiveLine, LiveSide } from "@/components/match/liveModel";
import { ShareSheet } from "@/components/share/ShareSheet";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Panel, SectionTitle } from "@/components/ui/Panel";
import { DuelMark, DuelRoster, RulesStrip, SeriesPips, SideName, type DuelTone } from "./DuelParts";
import { duelTeamView, type DuelTeamView } from "./duelTeam";
import { duelUrlOf } from "./duelNav";

type Stage = "faceoff" | "live" | "end";
type Copy = ReturnType<typeof useCopy>["DUEL_MATCH_UI"];

const strip = (l: LiveLine): LiveLine => ({ goals: l.goals, assists: l.assists, shots: l.shots, saves: l.saves, demos: l.demos, score: l.score });

export function DuelMatch({ reply, viewer }: { reply: DuelReply; viewer: DuelSideKey }) {
  const { DUEL_MATCH_UI: D } = useCopy();
  const router = useRouter();
  const startDuelMatch = useRunStore((s) => s.startDuelMatch);
  const mode = reply.rules.mode;
  const series = useMemo(() => playDuel(reply.rules, reply.challenger.team, reply.opponent.team), [reply]);
  const views = useMemo(
    () => ({ a: duelTeamView(reply.challenger.team, mode), b: duelTeamView(reply.opponent.team, mode) }),
    [reply, mode],
  );
  const names: Record<LiveSide, string> = { a: duelSideLabel(reply, "challenger", D), b: duelSideLabel(reply, "opponent", D) };
  const own: LiveSide = viewer === "challenger" ? "a" : "b";
  const tone = (s: LiveSide): DuelTone => (s === own ? "orange" : "blue");

  const [stage, setStage] = useState<Stage>("faceoff");
  const [idx, setIdx] = useState(0);
  const [speed, setSpeed] = useState<number>(1);
  const [paused, setPaused] = useState(false);
  const [skipIdx, setSkipIdx] = useState<number | null>(null);
  const [sheet, setSheet] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const tracked = useRef(false);

  // Focus follows the stage, so a keyboard player lands on the new step (not on first load).
  const firstStage = useRef(true);
  useEffect(() => {
    if (firstStage.current) {
      firstStage.current = false;
      return;
    }
    if (stage === "live") stageRef.current?.focus({ preventScroll: true });
  }, [stage]);

  useEffect(() => {
    if (stage !== "end" || tracked.current) return;
    tracked.current = true;
    trackDuel("finished", reply.rules, { games: series.games.length, winner: duelWinner(series), viewer });
  }, [stage, reply.rules, series, viewer]);

  const go = (next: Stage) => {
    setStage(next);
    setIdx(0);
    setSkipIdx(null);
    setPaused(false);
    window.scrollTo({ top: 0, left: 0 });
  };

  const rematch = () => {
    sfx.start();
    const r = duelRematch(reply, viewer);
    trackDuel("rematch", r.rules, { viewer });
    if (startDuelMatch({ rules: r.rules, role: "challenger", name: r.challengerName })) router.push("/play");
  };

  const url = useMemo(() => duelUrlOf(duelCodePath(reply)), [reply]);
  const challengerName = reply.challenger.name || D.aFriend;

  return (
    <div className="mx-auto max-w-5xl pb-8 rise-in">
      <SectionTitle
        title={D.bestOf(DUEL_MATCH.bestOf)}
        right={reply.rules.showOverall ? null : <Badge tone="neutral">{D.revealed}</Badge>}
        className="mb-4 sm:mb-6"
      />
      <div ref={stageRef} tabIndex={-1} className="outline-none">
        {stage === "faceoff" ? (
          <FaceOff D={D} views={views} names={names} series={series} tone={tone} onPlay={() => go("live")} onSkip={() => go("end")} />
        ) : stage === "live" ? (
          <LiveSeries
            D={D}
            series={series}
            views={views}
            names={names}
            tone={tone}
            idx={idx}
            speed={speed}
            paused={paused}
            skip={skipIdx === idx}
            onSpeed={setSpeed}
            onPause={() => setPaused((p) => !p)}
            onSkipGame={() => setSkipIdx(idx)}
            onSkipSeries={() => setStage("end")}
            onEnd={() => {
              if (idx + 1 < series.games.length) {
                setIdx(idx + 1);
                setSkipIdx(null);
              } else setStage("end");
            }}
          />
        ) : (
          <SeriesEnd
            D={D}
            reply={reply}
            series={series}
            views={views}
            names={names}
            tone={tone}
            viewer={viewer}
            challengerName={challengerName}
            onRematch={rematch}
            onShare={() => setSheet(true)}
            onWatch={() => go("live")}
          />
        )}
      </div>
      <RulesStrip rules={reply.rules} className="mt-6" />
      {/* An older link: the series may not be the one the friend saw. */}
      {isStaleDuel(reply.rules) ? <p className="mt-4 text-sm text-sub">{D.staleVersion}</p> : null}
      <p className="mt-4 text-xs text-faint">{D.exhibition}</p>

      <ShareSheet
        open={sheet}
        onClose={() => setSheet(false)}
        title={viewer === "opponent" ? D.sendResult(challengerName) : D.shareResult}
        surface="duel"
        gameMode="draft"
        text={D.resultText}
        url={url}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// 1. Face-off
// ---------------------------------------------------------------------------

function FaceOff({
  D,
  views,
  names,
  series,
  tone,
  onPlay,
  onSkip,
}: {
  D: Copy;
  views: Record<LiveSide, DuelTeamView>;
  names: Record<LiveSide, string>;
  series: DuelSeries;
  tone: (s: LiveSide) => DuelTone;
  onPlay: () => void;
  onSkip: () => void;
}) {
  const side = (s: LiveSide) => (
    <div className="min-w-0">
      <div className={cx("flex items-center justify-between gap-3", s === "b" && "lg:flex-row-reverse")}>
        <div className={cx("flex min-w-0 items-center gap-3", s === "b" && "lg:flex-row-reverse lg:text-right")}>
          <DuelMark view={views[s]} name={names[s]} />
          <SideName name={names[s]} tone={tone(s)} />
        </div>
        <div className={cx("shrink-0", s === "a" ? "text-right lg:text-right" : "text-right lg:text-left")}>
          <p className="display text-5xl font-bold leading-none tabular-nums text-ink">{series.sides[s].overall}</p>
          <p className="kicker mt-1.5 text-faint">{D.teamOverall}</p>
        </div>
      </div>
      <DuelRoster view={views[s]} showOverall className="mt-5" />
    </div>
  );
  return (
    <Panel strong className="p-4 sm:p-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:gap-8">
        {side("a")}
        <div className="flex items-center gap-3 lg:flex-col lg:justify-center" aria-hidden>
          <span className="h-px flex-1 bg-line lg:h-auto lg:w-px lg:flex-1" />
          <span className="display text-sm font-semibold uppercase tracking-[0.08em] text-faint">{D.vs}</span>
          <span className="h-px flex-1 bg-line lg:h-auto lg:w-px lg:flex-1" />
        </div>
        {side("b")}
      </div>
      <div className="action-dock mt-6 flex flex-wrap items-center gap-3 sm:border-t sm:border-line sm:pt-5">
        <Button variant="primary" size="lg" className="max-sm:flex-1 sm:min-w-56" onClick={onPlay}>
          {D.playSeries}
        </Button>
        <Button variant="ghost" size="lg" className="max-sm:flex-1" onClick={onSkip}>
          {D.skipToResult}
        </Button>
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// 2. Live
// ---------------------------------------------------------------------------

function LiveSeries({
  D,
  series,
  views,
  names,
  tone,
  idx,
  speed,
  paused,
  skip,
  onSpeed,
  onPause,
  onSkipGame,
  onSkipSeries,
  onEnd,
}: {
  D: Copy;
  series: DuelSeries;
  views: Record<LiveSide, DuelTeamView>;
  names: Record<LiveSide, string>;
  tone: (s: LiveSide) => DuelTone;
  idx: number;
  speed: number;
  paused: boolean;
  skip: boolean;
  onSpeed: (s: number) => void;
  onPause: () => void;
  onSkipGame: () => void;
  onSkipSeries: () => void;
  onEnd: () => void;
}) {
  const game = series.games[idx];
  const before = idx > 0 ? series.games[idx - 1].after : ([0, 0] as [number, number]);
  const labels: LiveLabels = {
    game: D.gameOf(idx + 1, DUEL_MATCH.bestOf),
    overtime: D.overtime,
    final: D.final,
    strip: D.strip,
    goals: D.colGoals,
    assists: D.colAssists,
    shots: D.colShots,
    saves: D.colSaves,
    score: D.colScore,
    player: D.colPlayer,
    clock: D.clock,
    goalLine: D.goalLine,
    noGoalsYet: D.noGoalsYet,
  };
  const finals = useMemo(() => ({ a: game.box.players.a.map(strip), b: game.box.players.b.map(strip) }), [game]);
  return (
    <Panel strong className="p-4 sm:p-5">
      {/* The series so far: both names, the pips, the score of the games already played. */}
      <div className="mb-4 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 border-b border-line pb-4">
        <p className="display truncate text-[15px] font-semibold text-ink">{names.a}</p>
        <SeriesPips a={before[0]} b={before[1]} toneA={tone("a")} toneB={tone("b")} label={D.seriesScore(before[0], before[1])} />
        <p className="display truncate text-right text-[15px] font-semibold text-ink">{names.b}</p>
      </div>
      <LiveGameView
        key={idx}
        timeline={game.timeline}
        sides={{
          a: { name: names.a, players: series.sides.a.playerNames, tone: tone("a"), own: tone("a") === "orange", mark: <DuelMark view={views.a} name={names.a} size="md" /> },
          b: { name: names.b, players: series.sides.b.playerNames, tone: tone("b"), own: tone("b") === "orange", mark: <DuelMark view={views.b} name={names.b} size="md" /> },
        }}
        finals={finals}
        labels={labels}
        context={<span className="tabular-nums">{D.seriesScore(before[0], before[1])}</span>}
        speed={speed}
        paused={paused}
        skip={skip}
        onEnd={onEnd}
      />
      <div className="action-dock mt-6 flex flex-wrap items-center gap-2 sm:border-t sm:border-line sm:pt-4">
        <Button variant="secondary" size="sm" onClick={onPause} aria-pressed={paused}>
          {paused ? D.resumePlay : D.pause}
        </Button>
        {/* Phone: one button that steps through the speeds. */}
        <button
          type="button"
          aria-label={`${D.speed} ${speed}×`}
          onClick={() => {
            const all = MATCH_LIVE.speeds as readonly number[];
            onSpeed(all[(all.indexOf(speed) + 1) % all.length]);
          }}
          className="display min-h-11 min-w-11 rounded-[7px] border border-line px-3 text-xs font-semibold tabular-nums text-ink sm:hidden"
        >
          {speed}×
        </button>
        <div className="hidden overflow-hidden rounded-[7px] border border-line sm:flex" role="group" aria-label={D.speed}>
          {MATCH_LIVE.speeds.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={speed === s}
              onClick={() => onSpeed(s)}
              className={cx(
                "display min-h-11 min-w-11 px-3 text-xs font-semibold tabular-nums transition-colors sm:min-h-9",
                speed === s ? "bg-white/[0.08] text-ink" : "text-sub hover:text-ink",
              )}
            >
              {s}×
            </button>
          ))}
        </div>
        <span className="ml-auto flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" onClick={onSkipGame}>
            {D.skipGame}
          </Button>
          <Button variant="ghost" size="sm" onClick={onSkipSeries}>
            {D.skipSeries}
          </Button>
        </span>
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// 3. End
// ---------------------------------------------------------------------------

function SeriesEnd({
  D,
  reply,
  series,
  views,
  names,
  tone,
  viewer,
  challengerName,
  onRematch,
  onShare,
  onWatch,
}: {
  D: Copy;
  reply: DuelReply;
  series: DuelSeries;
  views: Record<LiveSide, DuelTeamView>;
  names: Record<LiveSide, string>;
  tone: (s: LiveSide) => DuelTone;
  viewer: DuelSideKey;
  challengerName: string;
  onRematch: () => void;
  onShare: () => void;
  onWatch: () => void;
}) {
  const score = duelScoreline(series);
  const rows = duelGameRows(series, D);
  const mvp = series.box.mvp;
  const mvpName = mvp ? series.sides[mvp.side].playerNames[mvp.playerIdx] : null;
  const toneText = (s: LiveSide) => (tone(s) === "orange" ? "text-orange-bright" : "text-blue-bright");
  const toneLine = (s: LiveSide) => (tone(s) === "orange" ? "border-orange/60" : "border-blue/60");
  // The end's one action takes the focus (Enter starts the next match).
  const actionsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    actionsRef.current?.querySelector("button")?.focus({ preventScroll: true });
  }, []);

  const side = (s: LiveSide) => (
    <div className={cx("flex min-w-0 flex-col items-center gap-2 text-center", series.winner !== s && "opacity-70")}>
      <DuelMark view={views[s]} name={names[s]} />
      <SideName name={names[s]} tone={tone(s)} className="flex flex-col items-center" />
    </div>
  );

  return (
    <Panel strong className="p-4 sm:p-6">
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 sm:gap-6">
        {side("a")}
        <div className="text-center">
          <p className="display text-6xl font-bold leading-none tabular-nums text-ink sm:text-7xl">
            <span className={series.winner === "a" ? toneText("a") : undefined}>{score.a}</span>
            <span className="text-faint">-</span>
            <span className={series.winner === "b" ? toneText("b") : undefined}>{score.b}</span>
          </p>
          <p className="kicker mt-2 text-faint">{D.final}</p>
        </div>
        {side("b")}
      </div>
      <p className="display mt-6 text-center text-xl font-semibold leading-tight text-ink sm:text-2xl">{duelWinnerLine(reply, series, D)}</p>

      {/* A chip per game, in the winner's colour. */}
      <div className="mt-6">
        <p className="kicker mb-2 text-faint">{D.gamesTitle}</p>
        <ul className="flex flex-wrap gap-2">
          {rows.map((r) => (
            <li key={r.index} className={cx("flex min-h-11 items-center gap-2 rounded-[7px] border bg-surface px-3 text-sm", toneLine(r.winner))}>
              <span className="kicker text-faint">{r.label}</span>
              <span className={cx("display font-bold tabular-nums", toneText(r.winner))}>{r.scoreText}</span>
              {r.tag ? <span className="kicker text-sub">{r.tag}</span> : null}
            </li>
          ))}
        </ul>
      </div>

      {mvp && mvpName ? (
        <div className="mt-6 flex items-baseline justify-between gap-3 border-t border-line pt-4">
          <span className="kicker text-faint">{D.seriesMvp}</span>
          <span className="min-w-0 text-right">
            <span className="display text-[17px] font-semibold text-ink">{mvpName}</span>
            <span className="ml-2 text-sm text-sub">{names[mvp.side]}</span>
          </span>
        </div>
      ) : null}

      <div className="mt-6 flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:flex-wrap sm:items-center">
        <div ref={actionsRef} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
          <Button variant="primary" size="lg" className="max-sm:w-full sm:min-w-52" onClick={onRematch}>
            {D.newMatch}
          </Button>
          <span className="text-xs text-faint max-sm:text-center">{D.newMatchLine}</span>
        </div>
        <div className="flex flex-wrap gap-2 sm:ml-auto">
          <Button variant="secondary" className="max-sm:flex-1" onClick={onShare}>
            {viewer === "opponent" ? D.sendResult(challengerName) : D.shareResult}
          </Button>
          <Button variant="ghost" className="max-sm:flex-1" onClick={onWatch}>
            {D.watchAgain}
          </Button>
        </div>
      </div>
    </Panel>
  );
}
