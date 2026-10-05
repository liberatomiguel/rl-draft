"use client";

/**
 * Road to Worlds — the EVENT screen (v0.2 full rebuild). The point of the
 * mode: watching your games, seeing the goals and the tables move.
 *
 * Three states:
 *  1. LOBBY   — matchday presentation: stakes, the full field, enter CTAs.
 *  2. PLAYBACK — the centerpiece. The engine simulates rounds whole
 *     (playEventRound); this screen REVEALS them on a broadcast clock:
 *     your series goal by goal in the Match Center, AI series popping into
 *     a ticker, standings stepping at round gaps, the bracket filling in.
 *     Reveal bookkeeping = eventPlayback's AnimSlice + revealedKeysFor —
 *     nothing on screen ever spoils a result that hasn't animated.
 *  3. DIGEST  — the ceremony: placement hero, counted-up rewards, final
 *     standings. Instant-mode (watched=false) jumps STRAIGHT here.
 *
 * Pacing: CAREER_PLAYBACK anchors (÷ the speed toggle). Reduced motion:
 * no timers at all — everything simulated renders instantly, a Continue
 * button drives the rounds.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CAREER_PLAYBACK, CAREER_UNOFFICIAL, TOURNAMENT } from "@/config/balance";
import { useCopy } from "@/content/copy";
import { useCareerCopy } from "@/content/careerCopy";
import { repGainFor, prizeFor, pointsFor } from "@/engine/career/economy";
import { placementOf } from "@/engine/career/careerResults";
import type {
  ActiveEventState,
  CareerEventDef,
  CareerSave,
} from "@/engine/career/types";
import type { Placement } from "@/engine/types";
import { formatMoney } from "@/lib/format";
import { sfx } from "@/lib/sfx";
import { cx } from "@/lib/util";
import { selectActiveSave, useCareerStore } from "@/store/careerStore";
import { ANIM_TOURNAMENT_SPEED, useSettings } from "@/store/settingsStore";
import { useMounted } from "@/store/useMounted";
import { REGION_BADGE } from "@/components/regionStyle";
import {
  dateOfDay,
  splitOfWeek,
  useCareerSave,
  userStars,
  userTeamPreview,
  weekOfDay,
} from "@/components/career/careerUi";
import { formatDateShort, formatDaysAway } from "@/components/career/dateText";
import {
  ErrorBanner,
  TierChip,
  maxPointsOf,
  prizePoolOf,
} from "@/components/career/hub/hubShared";
import { OrgMark } from "@/components/career/OrgMark";
import { OrgSheet } from "@/components/career/OrgSheet";
import { TeamStars } from "@/components/career/TeamStars";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Panel, SectionTitle } from "@/components/ui/Panel";
import { CareerAiTicker, type TickerItem } from "@/components/career/event/CareerAiTicker";
import { CareerBracket } from "@/components/career/event/CareerBracket";
import { CareerMatchCenter } from "@/components/career/event/CareerMatchCenter";
import { CareerSwissStandings } from "@/components/career/event/CareerSwissStandings";
import {
  placementRankOf,
  revealedKeysFor,
  revealedSwissRounds,
  roundsOf,
  seriesKey,
  swissRecordsFrom,
  userGoalCounts,
  userSeriesStatus,
  type AnimSlice,
  type RoundRef,
  type UserSeriesStatus,
} from "@/components/career/event/eventPlayback";

// ---------------------------------------------------------------------------
// Router component — decides lobby / playback / digest
// ---------------------------------------------------------------------------

export function EventScreen() {
  const mounted = useMounted();
  const save = useCareerSave();
  const C = useCareerCopy();
  const router = useRouter();
  const simEvent = useCareerStore((s) => s.simEvent);

  // Instant-mode safety net: the lobby fires enterEvent(false)+simEvent()
  // together, but if a persisted save ever lands here mid-way (crash between
  // the two writes), finish the sim — an unwatched event NEVER shows playback.
  const needsInstantFinish = Boolean(
    save?.activeEvent &&
      !save.activeEvent.watched &&
      save.activeEvent.tournament.stage !== "finished",
  );
  useEffect(() => {
    if (needsInstantFinish) simEvent();
  }, [needsInstantFinish, simEvent]);

  if (!mounted || !save) return <div className="min-h-[60vh]" aria-busy />;

  const ev = save.activeEvent;
  if (ev) {
    if (!ev.watched) {
      if (ev.tournament.stage !== "finished") return <div className="min-h-[60vh]" aria-busy />;
      return <EventDigest save={save} ev={ev} />;
    }
    return <EventPlayback save={save} ev={ev} />;
  }

  const def = save.pendingEventDef;
  if (def) return <EventLobby save={save} def={def} />;

  // No event on the horizon — friendly hand-off to the calendar.
  return (
    <div className="mx-auto max-w-2xl px-3 py-10 sm:px-4">
      <Panel className="rise-in p-8 text-center">
        <p className="kicker">{C.calendar.nextForYou}</p>
        <p className="mt-2 text-sm text-sub">{C.hub.emptyStateBody}</p>
        <Button
          variant="primary"
          className="mt-5"
          onClick={() => router.push("/career/calendar")}
        >
          {C.nav.calendar}
        </Button>
      </Panel>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 1 — LOBBY
// ---------------------------------------------------------------------------

/** Field preview mirroring worldSim.fieldForEvent's selection (display only). */
function lobbyFieldRefs(save: CareerSave, def: CareerEventDef, userRating: number): string[] {
  if (def.tier === "major") return save.competition.majorFieldRefs ?? [];
  if (def.tier === "worlds") return save.competition.worldsFieldRefs ?? [];
  const region = def.region ?? save.identity.region;
  const orgs = Object.values(save.world.orgs).filter((o) => o.region === region);
  if (def.tier === "regional") {
    const pts = save.competition.splitPoints[region] ?? {};
    const ranked = [...orgs].sort(
      (a, b) =>
        (pts[b.ref] ?? 0) - (pts[a.ref] ?? 0) ||
        b.prestige - a.prestige ||
        (b.rating ?? 0) - (a.rating ?? 0) ||
        a.ref.localeCompare(b.ref),
    );
    return ["user", ...ranked.slice(0, TOURNAMENT.swiss.teams - 1).map((o) => o.ref)];
  }
  if (def.tier === "t3") {
    const ranked = [...orgs].sort(
      (a, b) =>
        Math.abs((a.rating ?? 70) - userRating) - Math.abs((b.rating ?? 70) - userRating) ||
        a.ref.localeCompare(b.ref),
    );
    return ["user", ...ranked.slice(0, TOURNAMENT.quick.teams - 1).map((o) => o.ref)];
  }
  const pts = save.competition.seasonPoints[region] ?? {};
  const ranked = [...orgs].sort(
    (a, b) =>
      (pts[b.ref] ?? 0) - (pts[a.ref] ?? 0) ||
      b.prestige - a.prestige ||
      (b.rating ?? 0) - (a.rating ?? 0) ||
      a.ref.localeCompare(b.ref),
  );
  return ["user", ...ranked.slice(0, TOURNAMENT.quick.teams - 1).map((o) => o.ref)];
}

function EventLobby({ save, def }: { save: CareerSave; def: CareerEventDef }) {
  const C = useCareerCopy();
  const D = C.dates;
  const router = useRouter();
  const enterEvent = useCareerStore((s) => s.enterEvent);
  const simEvent = useCareerStore((s) => s.simEvent);
  const passUnofficial = useCareerStore((s) => s.passUnofficial);
  // One sheet for the lobby — any AI org in the field opens it.
  const [sheetRef, setSheetRef] = useState<string | null>(null);

  const preview = useMemo(() => userTeamPreview(save), [save]);
  const userRating = Math.round(preview.rating.total);
  const myStars = userStars(save);

  const daysAway = def.day - save.clock.day;
  const isToday = daysAway === 0;
  const isUnofficial = def.tier === "t3" || def.tier === "t2";

  const field = useMemo(
    () =>
      lobbyFieldRefs(save, def, preview.rating.total).map((ref) => {
        if (ref === "user") {
          return { ref, name: save.identity.orgName, stars: myStars, rating: userRating };
        }
        const org = save.world.orgs[ref];
        return {
          ref,
          name: org?.name ?? ref,
          stars: org?.stars ?? 0,
          rating: org?.rating !== undefined ? Math.round(org.rating) : null,
        };
      }),
    [save, def, preview, myStars, userRating],
  );

  const rated = field.filter((f) => f.rating !== null) as { rating: number }[];
  const avgOvr =
    rated.length > 0
      ? Math.round(rated.reduce((s, f) => s + f.rating, 0) / rated.length)
      : null;
  const points = maxPointsOf(def.tier);

  const unavailable =
    save.pendingUnavailability?.eventId === def.id
      ? save.squad.find((p) => p.id === save.pendingUnavailability?.playerId)
      : null;

  return (
    <div className="mx-auto max-w-4xl space-y-4 px-3 py-5 sm:px-4">
      <ErrorBanner />

      <SectionTitle
        kicker={C.event.lobbyTitle}
        title={def.name}
        right={<TierChip tier={def.tier} />}
      />

      <div className="rise-in flex flex-wrap items-center gap-2">
        <Badge tone="orange" className={cx(isToday && "animate-pulse")}>
          {isToday ? C.hub.matchdayIn(0) : formatDaysAway(D, daysAway)}
        </Badge>
        <Badge>{formatDateShort(D, dateOfDay(save.clock.seasonIndex, def.day))}</Badge>
        {def.region ? <Badge className={REGION_BADGE[def.region]}>{def.region}</Badge> : null}
      </div>

      {/* stakes */}
      <Panel className="rise-in p-4" style={{ animationDelay: "40ms" }}>
        <p className="kicker mb-2.5 text-[10px]">{C.calendar.stakes}</p>
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg border border-line bg-white/[0.03] p-2.5">
            <p className="kicker text-[9px]">{C.calendar.prizePool}</p>
            <p className="display text-lg font-bold text-orange-bright">
              {formatMoney(prizePoolOf(def.tier), { compact: true })}
            </p>
          </div>
          <div className="rounded-lg border border-line bg-white/[0.03] p-2.5">
            <p className="kicker text-[9px]">{C.common.seasonPoints}</p>
            <p className="display text-lg font-bold text-ink">
              {points !== null ? `${points} ${C.standings.ptsShort}` : "—"}
            </p>
          </div>
          <div className="rounded-lg border border-line bg-white/[0.03] p-2.5">
            <p className="kicker text-[9px]">{C.event.avgOvr}</p>
            <p className="display text-lg font-bold text-cyan">{avgOvr ?? "—"}</p>
          </div>
        </div>
        <p className="mt-2 text-xs text-faint">
          {def.format === "swiss" ? C.event.formatSwiss : C.event.formatSingle}
        </p>
      </Panel>

      {unavailable ? (
        <div className="rise-in rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-2.5 text-sm text-amber-300">
          {C.event.unavailableNotice(unavailable.name)}
        </div>
      ) : null}

      {/* the field */}
      {field.length > 0 ? (
        <Panel className="rise-in p-4" style={{ animationDelay: "80ms" }}>
          <p className="kicker mb-2.5 text-[10px]">{C.event.fieldTitle}</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {field.map((f) => {
              const isUser = f.ref === "user";
              const content = (
                <>
                  <OrgMark save={save} orgRef={f.ref} size="sm" className="shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p
                      className={cx(
                        "truncate text-xs",
                        isUser ? "font-bold text-orange-bright" : "font-semibold text-ink",
                      )}
                    >
                      {f.name}
                    </p>
                    <TeamStars stars={f.stars} size="xs" className="mt-0.5" />
                  </div>
                  <span
                    className={cx(
                      "display shrink-0 text-sm font-bold",
                      isUser ? "text-orange-bright" : "text-cyan",
                    )}
                    title={C.common.ovr}
                  >
                    {f.rating ?? "—"}
                  </span>
                </>
              );
              // Your own row stays inert — the sheet is for scouting the others.
              if (isUser) {
                return (
                  <div
                    key={f.ref}
                    className="flex min-h-11 items-center gap-2 rounded-lg border border-orange/60 bg-orange/10 p-2"
                  >
                    {content}
                  </div>
                );
              }
              return (
                <button
                  key={f.ref}
                  type="button"
                  title={C.orgSheet.viewTeam}
                  onClick={() => setSheetRef(f.ref)}
                  className="flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-lg border border-line bg-white/[0.03] p-2 text-left transition-colors hover:bg-white/6 focus-visible:bg-white/6 focus-visible:outline-none"
                >
                  {content}
                </button>
              );
            })}
          </div>
        </Panel>
      ) : null}

      {/* CTAs — matchday only; earlier days are a read-only preview */}
      {isToday ? (
        <div className="rise-in space-y-2" style={{ animationDelay: "120ms" }}>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary" size="lg" onClick={() => enterEvent(true)}>
              {C.event.watch}
            </Button>
            <Button
              variant="secondary"
              size="lg"
              onClick={() => {
                enterEvent(false);
                simEvent();
              }}
            >
              {C.event.instant}
            </Button>
            {isUnofficial ? (
              <Button
                variant="ghost"
                onClick={() => {
                  passUnofficial();
                  router.push("/career");
                }}
              >
                {C.calendar.skip}
              </Button>
            ) : null}
          </div>
          {isUnofficial ? <p className="text-xs text-faint">{C.calendar.skipHint}</p> : null}
        </div>
      ) : null}

      <OrgSheet save={save} orgRef={sheetRef} onClose={() => setSheetRef(null)} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2 — PLAYBACK
// ---------------------------------------------------------------------------

function EventPlayback({ save, ev }: { save: CareerSave; ev: ActiveEventState }) {
  const copy = useCopy();
  const C = useCareerCopy();
  const T = copy.TOURNAMENT_UI;
  const playEventRound = useCareerStore((s) => s.playEventRound);
  const simEvent = useCareerStore((s) => s.simEvent);
  const reduced = useSettings((s) => s.reducedMotion);

  const def = ev.def;
  const t = ev.tournament;
  const rounds = useMemo(() => roundsOf(t), [t]);

  // Reveal state. On mount, everything ALREADY simulated counts as revealed —
  // a fresh enterEvent has zero rounds (auto-starts); a mid-event refresh
  // resumes without replaying what was seen.
  const [revealedRounds, setRevealedRounds] = useState(() => roundsOf(ev.tournament).length);
  const [anim, setAnim] = useState<AnimSlice | null>(null);
  const [live, setLive] = useState({ game: 0, goal: 0 });
  const [running, setRunning] = useState(true);
  const [speed, setSpeed] = useState<1 | 2 | 4>(
    () => ANIM_TOURNAMENT_SPEED[useSettings.getState().animSpeed],
  );
  const [inspectKey, setInspectKey] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** User series whose result cue (sfx) already fired — once each. */
  const cuedRef = useRef<Set<string>>(new Set());

  // The playback clock — ONE effect, paced by what is being revealed.
  useEffect(() => {
    if (reduced || !running) return;
    const P = CAREER_PLAYBACK;
    const tick = (ms: number, fn: () => void) => {
      timerRef.current = setTimeout(fn, ms / speed);
    };

    if (anim && anim.round < rounds.length) {
      const round = rounds[anim.round];
      const userIdx = round.userSeriesIndex;
      const userSeries = userIdx !== null ? round.series[userIdx] : null;

      if (userSeries && !anim.banner) {
        // Phase 1 — the user's series, goal by goal.
        const game = userSeries.games[live.game];
        if (game) {
          const goals = game.score[0] + game.score[1];
          if (live.goal < goals) {
            tick(P.userGoalMs, () => setLive((l) => ({ ...l, goal: l.goal + 1 })));
          } else {
            tick(P.userGameGapMs, () => setLive((l) => ({ game: l.game + 1, goal: 0 })));
          }
        } else {
          // Every game shown — land the banner (with its one-shot cue).
          tick(0, () => {
            const key = seriesKey(round, userIdx!);
            if (!cuedRef.current.has(key)) {
              cuedRef.current.add(key);
              if (userSeries.winnerTeamId === "user") sfx.matchWin();
              else sfx.matchLose();
            }
            setAnim((a) => (a ? { ...a, banner: true } : a));
          });
        }
      } else {
        // Phase 2 — AI series pop into the ticker/bracket.
        const aiCount = round.series.length - (userIdx !== null ? 1 : 0);
        if (anim.ai < aiCount) {
          const base = round.stage === "swiss" ? P.aiSwissMs : P.aiPlayoffMs;
          const linger = userSeries && anim.ai === 0 ? P.userSeriesLingerMs : 0;
          tick(base + linger, () => setAnim((a) => (a ? { ...a, ai: a.ai + 1 } : a)));
        } else {
          const linger = userSeries && aiCount === 0 ? P.userSeriesLingerMs : 300;
          tick(linger, () => {
            setRevealedRounds((r) => r + 1);
            setAnim(null);
            setLive({ game: 0, goal: 0 });
          });
        }
      }
    } else if (revealedRounds < rounds.length) {
      // A simulated round awaits its reveal — breathe, then animate it.
      tick(P.roundGapMs, () => {
        const next = rounds[revealedRounds];
        setAnim({ round: revealedRounds, ai: 0, banner: next.userSeriesIndex === null });
        setLive({ game: 0, goal: 0 });
      });
    } else if (t.stage !== "finished") {
      // Reveal queue drained — ask the engine for the next round(s).
      tick(P.advanceMs, () => playEventRound());
    } else {
      // Everything revealed and the tournament is done — park the clock.
      tick(0, () => setRunning(false));
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [reduced, running, anim, live, revealedRounds, rounds, t, speed, playEventRound]);

  // Reduced motion / derived reveal state (never blank, never a timer).
  const effRevealed = reduced ? rounds.length : revealedRounds;
  const effAnim = reduced ? null : anim;

  const digestReady =
    t.stage === "finished" && effRevealed >= rounds.length && !effAnim;

  // --- derived, spoiler-safe views ----------------------------------------
  const revealedKeys = revealedKeysFor(rounds, Math.min(effRevealed, rounds.length), effAnim);
  const throughRound = revealedSwissRounds(t, revealedKeys);
  // Standings move ONLY at round gaps: records over fully revealed rounds.
  // Cheap enough (≤ 40 series) to derive per render — the compiler memoizes.
  const standingsRecords = swissRecordsFrom(t, revealedKeysFor(rounds, throughRound, null));
  const userRecord = swissRecordsFrom(t, revealedKeys).get("user") ?? {
    wins: 0,
    losses: 0,
    gameDiff: 0,
  };
  const allSimRevealed = effRevealed >= rounds.length && !effAnim;

  const hasSwiss = def.format === "swiss";
  const swissFullyRevealed = throughRound >= t.swiss.rounds.length;
  const showBracket = Boolean(t.playoffs) && (!hasSwiss || (t.swiss.finished && swissFullyRevealed));

  const labelOf = (round: RoundRef): string =>
    round.stage === "swiss"
      ? C.event.roundLabel(round.roundNo)
      : (T.roundNames[round.name ?? ""] ?? C.event.playoffs);

  // Ticker — every revealed AI series, newest first.
  const tickerItems: TickerItem[] = [];
  rounds.forEach((round, ri) => {
    const aiIdx = round.series
      .map((_, si) => si)
      .filter((si) => si !== round.userSeriesIndex);
    const take =
      ri < effRevealed ? aiIdx.length : effAnim && effAnim.round === ri ? effAnim.ai : 0;
    for (const si of aiIdx.slice(0, take)) {
      tickerItems.push({ key: seriesKey(round, si), label: labelOf(round), series: round.series[si] });
    }
  });
  tickerItems.reverse();

  // --- Match Center selection: inspected > live user > last revealed user --
  const findByKey = (key: string): { round: RoundRef; si: number } | null => {
    for (const round of rounds) {
      for (let si = 0; si < round.series.length; si++) {
        if (seriesKey(round, si) === key) return { round, si };
      }
    }
    return null;
  };

  const animRound = effAnim && effAnim.round < rounds.length ? rounds[effAnim.round] : null;
  const liveUser =
    animRound && animRound.userSeriesIndex !== null
      ? { round: animRound, si: animRound.userSeriesIndex }
      : null;
  let lastUser: { round: RoundRef; si: number } | null = null;
  for (let ri = 0; ri < Math.min(effRevealed, rounds.length); ri++) {
    const round = rounds[ri];
    if (round.userSeriesIndex !== null) lastUser = { round, si: round.userSeriesIndex };
  }
  const inspected = inspectKey ? findByKey(inspectKey) : null;
  const center = inspected ?? liveUser ?? lastUser;
  const centerIsLiveUser = !inspected && center === liveUser;
  const centerMidReveal = centerIsLiveUser && effAnim !== null && !effAnim.banner;

  /** Swiss verdicts need the record AFTER the series; playoffs just the round. */
  const statusFor = (round: RoundRef, si: number): UserSeriesStatus => {
    const series = round.series[si];
    let wins = 0;
    let losses = 0;
    if (round.stage === "swiss") {
      const keys = new Set<string>();
      for (const r of rounds) {
        if (r.stage !== "swiss") continue;
        if (r.stageIndex < round.stageIndex) {
          r.series.forEach((_, i) => keys.add(seriesKey(r, i)));
        } else if (r.stageIndex === round.stageIndex && r.userSeriesIndex !== null) {
          keys.add(seriesKey(r, r.userSeriesIndex));
        }
      }
      const rec = swissRecordsFrom(t, keys).get("user");
      wins = rec?.wins ?? 0;
      losses = rec?.losses ?? 0;
    }
    return userSeriesStatus(round, series, {
      swissWinsAfter: wins,
      swissLossesAfter: losses,
      winsToAdvance: TOURNAMENT.swiss.winsToAdvance,
      lossesToEliminate: TOURNAMENT.swiss.lossesToEliminate,
      playoffFormat: t.playoffs?.format ?? null,
    });
  };

  const centerStatus =
    center && !centerMidReveal && (center.round.series[center.si].teamAId === "user" || center.round.series[center.si].teamBId === "user")
      ? statusFor(center.round, center.si)
      : null;

  // Live key for the bracket's orange edge.
  const liveBracketKey =
    liveUser && liveUser.round.stage === "playoffs" && effAnim && !effAnim.banner
      ? seriesKey(liveUser.round, liveUser.si)
      : null;

  // Next known opponent (swiss) — only once nothing on screen can be spoiled.
  const nextPair =
    hasSwiss && t.stage === "swiss" && allSimRevealed
      ? (t.swiss.nextPairings?.find(([a, b]) => a === "user" || b === "user") ?? null)
      : null;
  const nextUpRef = nextPair ? (nextPair[0] === "user" ? nextPair[1] : nextPair[0]) : null;

  // --- controls -------------------------------------------------------------
  const canSkipSeries = Boolean(
    effAnim && animRound && animRound.userSeriesIndex !== null && !effAnim.banner,
  );
  const skipSeries = () => {
    if (!anim) return;
    const round = rounds[anim.round];
    const ui = round?.userSeriesIndex;
    if (ui === null || ui === undefined) return;
    cuedRef.current.add(seriesKey(round, ui));
    setLive({ game: round.series[ui].games.length, goal: 0 });
    setAnim((a) => (a ? { ...a, banner: true } : a));
  };
  const simToEnd = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    simEvent();
    const fresh = selectActiveSave(useCareerStore.getState())?.activeEvent?.tournament;
    setRevealedRounds(fresh ? roundsOf(fresh).length : rounds.length);
    setAnim(null);
    setLive({ game: 0, goal: 0 });
    setRunning(false);
  };

  if (digestReady) return <EventDigest save={save} ev={ev} />;

  return (
    <div className="mx-auto max-w-6xl px-3 py-5 sm:px-4">
      <SectionTitle
        kicker={def.name}
        title={t.stage === "swiss" ? C.event.swissStage : C.event.playoffs}
        right={
          hasSwiss ? (
            <Badge tone="blue" className="!text-sm">
              {T.record(userRecord.wins, userRecord.losses)}
            </Badge>
          ) : (
            <TierChip tier={def.tier} />
          )
        }
        className="mb-4"
      />

      {/* controls — every one of them works */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {reduced ? (
          <>
            <Button
              variant="primary"
              onClick={playEventRound}
              disabled={t.stage === "finished"}
            >
              {C.hub.continue}
            </Button>
            <Button variant="ghost" size="sm" onClick={simToEnd}>
              {C.event.simToEnd}
            </Button>
          </>
        ) : (
          <>
            {running ? (
              <Button variant="secondary" onClick={() => setRunning(false)}>
                <PauseGlyph /> {T.pause}
              </Button>
            ) : (
              <Button variant="primary" onClick={() => setRunning(true)}>
                <PlayGlyph /> {revealedRounds === 0 && !anim ? T.start : T.resume}
              </Button>
            )}
            <div className="flex overflow-hidden rounded-lg border border-line" role="group" aria-label={C.event.speed}>
              {CAREER_PLAYBACK.speeds.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSpeed(s)}
                  aria-pressed={speed === s}
                  className={cx(
                    "display px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors",
                    speed === s ? "bg-blue/20 text-blue-bright" : "text-sub hover:text-ink",
                  )}
                >
                  {T.speed(s)}
                </button>
              ))}
            </div>
            {canSkipSeries ? (
              <Button variant="ghost" size="sm" onClick={skipSeries}>
                {C.event.skipSeries}
              </Button>
            ) : null}
            <Button variant="ghost" size="sm" onClick={simToEnd}>
              {C.event.simToEnd}
            </Button>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* main column — the cinema */}
        <div className="min-w-0 space-y-4 lg:col-span-2">
          {center ? (
            <CareerMatchCenter
              save={save}
              t={t}
              round={center.round}
              series={center.round.series[center.si]}
              progress={centerMidReveal ? live : null}
              status={centerStatus}
              onClose={inspected ? () => setInspectKey(null) : undefined}
            />
          ) : (
            <Panel strong className="flex min-h-[180px] flex-col items-center justify-center gap-2 p-6 text-center">
              <p className="kicker">{C.event.matchCenter}</p>
              {nextUpRef ? (
                <span className="flex items-center gap-2 text-sm text-sub">
                  {C.event.yourMatch} —
                  <OrgMark save={save} orgRef={nextUpRef} size="xs" />
                  <span className="display font-bold uppercase text-ink">
                    {t.teams[nextUpRef]?.name ?? ""}
                  </span>
                </span>
              ) : (
                <p className="text-sm text-faint">{C.event.nextUp}…</p>
              )}
            </Panel>
          )}

          {showBracket && hasSwiss ? (
            <CareerBracket
              save={save}
              t={t}
              revealed={revealedKeys}
              liveKey={liveBracketKey}
              showUpcoming={allSimRevealed}
              layout="wide"
              onInspect={setInspectKey}
            />
          ) : null}

          <CareerAiTicker save={save} t={t} items={tickerItems.slice(0, 10)} onInspect={setInspectKey} />
        </div>

        {/* side rail — the tables */}
        <div className="space-y-4">
          {hasSwiss ? (
            <CareerSwissStandings
              save={save}
              t={t}
              records={standingsRecords}
              throughRound={throughRound}
              nextUpRef={nextUpRef}
            />
          ) : (
            <CareerBracket
              save={save}
              t={t}
              revealed={revealedKeys}
              liveKey={liveBracketKey}
              showUpcoming={allSimRevealed}
              layout="column"
              onInspect={setInspectKey}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 3 — DIGEST (the ceremony)
// ---------------------------------------------------------------------------

/** Preview of finishEvent's rep award (display only — mirrors applyEventRep). */
function repPreviewFor(save: CareerSave, def: CareerEventDef, placement: Placement): number {
  const gain = (kind: Parameters<typeof repGainFor>[0]): number =>
    Math.max(0, Math.min(100 - save.reputation, repGainFor(kind, save.reputation)));
  const top4 = ["runner_up", "third", "fourth", "top4"].includes(placement);
  switch (def.tier) {
    case "t3": {
      if (placement !== "champion") return 0;
      const key = `t3rep:${save.clock.seasonIndex}:${splitOfWeek(weekOfDay(save.clock.day)) ?? 0}`;
      const used = Number(save.flags[key] ?? 0);
      return used >= CAREER_UNOFFICIAL.t3RepCapPerSplit ? 0 : gain("t3Win");
    }
    case "t2":
      return placement === "champion" ? gain("t2Win") : 0;
    case "regional":
      if (placement === "champion") return gain("regionalWin");
      if (top4) return gain("regionalTop4");
      return placement !== "swiss_exit" ? gain("regionalTop8") : 0;
    case "major":
      if (placement === "champion") return gain("majorWin");
      return top4 ? gain("majorTop4") : 0;
    case "worlds":
      return placement === "champion" || top4 ? gain("worldsTop4") : 0;
  }
}

function EventDigest({ save, ev }: { save: CareerSave; ev: ActiveEventState }) {
  const C = useCareerCopy();
  const router = useRouter();
  const completeEvent = useCareerStore((s) => s.completeEvent);
  const reduced = useSettings((s) => s.reducedMotion);

  const def = ev.def;
  const t = ev.tournament;
  const placement = placementOf(t, "user");
  const isChamp = placement === "champion";
  const prize = prizeFor(def.tier, placement, def.format, save.difficulty, def.seasonIndex);
  const points = pointsFor(def.tier, placement);
  const rep = repPreviewFor(save, def, placement);
  const championName = t.playoffs?.championTeamId
    ? (t.teams[t.playoffs.championTeamId]?.name ?? "")
    : "";

  // Your top scorer across the whole event.
  const goalCounts = userGoalCounts(t);
  let topScorer: { name: string; goals: number } | null = null;
  for (let i = 0; i < goalCounts.length; i++) {
    const name = t.teams.user?.playerNames[i];
    if (name && goalCounts[i] > 0 && goalCounts[i] > (topScorer?.goals ?? 0)) {
      topScorer = { name, goals: goalCounts[i] };
    }
  }

  // Final standings (every team, champion first, user pinned visible).
  const finalRows = Object.keys(t.teams)
    .map((id) => ({ id, placement: placementOf(t, id) }))
    .sort(
      (a, b) =>
        placementRankOf(a.placement) - placementRankOf(b.placement) ||
        Number(b.id === "user") - Number(a.id === "user") ||
        (t.teams[a.id]?.name ?? "").localeCompare(t.teams[b.id]?.name ?? ""),
    );
  const showPoints = maxPointsOf(def.tier) !== null;

  const confirm = () => {
    const wasWorlds = def.tier === "worlds";
    completeEvent();
    const next = selectActiveSave(useCareerStore.getState());
    router.push(wasWorlds || next?.phase !== "running" ? "/career/season" : "/career");
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-3 py-6 sm:px-4">
      {/* placement hero */}
      <Panel
        strong
        glow={isChamp ? "orange" : "blue"}
        className="rise-in relative overflow-hidden p-6 text-center sm:p-8"
      >
        {isChamp ? (
          <div className="celebrate-rays pointer-events-none absolute inset-0 opacity-40" aria-hidden />
        ) : null}
        <div className="relative">
          <div className="flex items-center justify-center gap-2">
            <p className="kicker !text-[11px]">{def.name}</p>
            <TierChip tier={def.tier} />
          </div>
          <p
            className={cx(
              "display mt-3 text-4xl font-bold uppercase tracking-wide sm:text-5xl",
              isChamp ? "champion-title text-orange-bright" : "text-ink",
            )}
          >
            {C.common.placement[placement]}
          </p>
          <p className={cx("mt-2 text-sm", isChamp ? "font-semibold text-amber-300" : "text-sub")}>
            {C.event.champion(isChamp ? save.identity.orgName : championName)}
          </p>

          {/* rewards — counted up */}
          <div className="mx-auto mt-6 grid max-w-md grid-cols-3 gap-2">
            <div className="rounded-lg border border-line bg-white/[0.04] p-3">
              <p className="kicker text-[9px]">{C.event.digestPrize}</p>
              <p className="display text-xl font-bold text-good sm:text-2xl">
                <CountUp value={prize} reduced={reduced} format={(n) => formatMoney(n, { compact: true })} />
              </p>
            </div>
            <div className="rounded-lg border border-line bg-white/[0.04] p-3">
              <p className="kicker text-[9px]">{C.event.digestPoints}</p>
              <p className="display text-xl font-bold text-cyan sm:text-2xl">
                {points > 0 ? (
                  <>
                    +<CountUp value={points} reduced={reduced} />
                  </>
                ) : (
                  "—"
                )}
              </p>
            </div>
            <div className="rounded-lg border border-line bg-white/[0.04] p-3">
              <p className="kicker text-[9px]">{C.event.digestRep}</p>
              <p className="display text-xl font-bold text-orange-bright sm:text-2xl">
                {rep > 0 ? (
                  <>
                    +<CountUp value={rep} reduced={reduced} />
                  </>
                ) : (
                  "—"
                )}
              </p>
            </div>
          </div>

          {topScorer ? (
            <p className="mt-4 text-xs text-sub">
              <span className="kicker mr-1.5 !text-[9px]">{C.event.digestTopScorer}</span>
              <span className="font-semibold text-ink">
                {C.event.scorerLine(topScorer.name, topScorer.goals)}
              </span>
            </p>
          ) : null}

          <Button variant="primary" size="lg" className="mt-6 w-full sm:w-auto" onClick={confirm}>
            {def.tier === "worlds" ? C.event.continueToReview : C.event.continueToHq}
          </Button>
        </div>
      </Panel>

      {/* full final standings */}
      <Panel className="rise-in p-4" style={{ animationDelay: "80ms" }}>
        <p className="kicker mb-2.5 text-[10px]">{C.event.resultsDigest}</p>
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-faint">
              <th className="pb-2 font-semibold" scope="col">
                {C.event.digestPlacement}
              </th>
              <th className="pb-2 font-semibold" scope="col">
                {C.calendar.field}
              </th>
              {showPoints ? (
                <th className="pb-2 text-right font-semibold" scope="col">
                  {C.standings.ptsShort}
                </th>
              ) : null}
              <th className="pb-2 text-right font-semibold" scope="col">
                {C.common.prize}
              </th>
            </tr>
          </thead>
          <tbody>
            {finalRows.map((row) => {
              const isUser = row.id === "user";
              const rowPrize = prizeFor(def.tier, row.placement, def.format, save.difficulty, def.seasonIndex);
              const rowPoints = pointsFor(def.tier, row.placement);
              return (
                <tr
                  key={row.id}
                  className={cx(
                    "border-t border-line",
                    isUser && "border-l-2 border-l-orange bg-orange/8",
                    row.placement === "champion" && "bg-amber-400/5",
                  )}
                >
                  <td className="whitespace-nowrap py-1.5 pr-2 text-sub">
                    {C.common.placement[row.placement]}
                  </td>
                  <td className="max-w-0 truncate py-1.5 pr-2">
                    <span className="flex items-center gap-1.5">
                      <OrgMark save={save} orgRef={row.id} size="xs" />
                      <span
                        className={cx(
                          "min-w-0 truncate",
                          isUser ? "font-bold text-orange-bright" : "text-ink",
                        )}
                      >
                        {t.teams[row.id]?.name ?? row.id}
                      </span>
                    </span>
                  </td>
                  {showPoints ? (
                    <td className="display py-1.5 text-right font-bold text-cyan">
                      {rowPoints > 0 ? rowPoints : "—"}
                    </td>
                  ) : null}
                  <td className="display py-1.5 text-right font-bold text-ink">
                    {rowPrize > 0 ? formatMoney(rowPrize, { compact: true }) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bits
// ---------------------------------------------------------------------------

/** Eased count-up that respects the manual reduced-motion setting. */
function CountUp({
  value,
  reduced,
  duration = 900,
  format = String,
}: {
  value: number;
  reduced: boolean;
  duration?: number;
  format?: (n: number) => string;
}) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (reduced) return;
    let frame: number;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(value * eased));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration, reduced]);
  return <>{format(reduced ? value : shown)}</>;
}

function PlayGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
      <path d="M8 5.5v13l11-6.5Z" />
    </svg>
  );
}

function PauseGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
      <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" />
    </svg>
  );
}
