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
 *
 * v2.0 (R40) — the weekend: the Saturday qualifier is Swiss ONLY (its
 * digest reads Qualified / Eliminated, never a champion or a bracket); a
 * Major / Worlds plays its Swiss on Saturday and PAUSES (SwissCompletePanel,
 * "Continue to Championship Sunday"), then Sunday opens with the
 * ChampionshipSunday title card before the playoffs playback. The day's
 * phase comes from the flow (eventDayPhaseOf) — never from local state.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { isLocalRef, localTeamName } from "@/engine/career/localScene";
import { useRouter } from "next/navigation";
import { CAREER_PLAYBACK, CAREER_QUALIFIER, TOURNAMENT } from "@/config/balance";
import { useCopy } from "@/content/copy";
import { useCareerCopy } from "@/content/careerCopy";
import { isTwoDayEvent, regionalForQualifier } from "@/engine/career/calendar";
import { nextPlayoffPairings } from "@/engine/playoffs";
import { prizeFor, pointsFor } from "@/engine/career/economy";
import { eventPlayerShareFor } from "@/store/careerFlow";
import { placementOf } from "@/engine/career/careerResults";
import { upcomingSwissPairings } from "@/engine/swiss";
import type {
  ActiveEventState,
  CareerEventDef,
  CareerSave,
} from "@/engine/career/types";
import { formatMoney } from "@/lib/format";
import { sfx } from "@/lib/sfx";
import { cx } from "@/lib/util";
import { ruledOutFor, squadIsShort } from "@/store/careerFlow";
import { selectActiveSave, useCareerStore } from "@/store/careerStore";
import { revealCursorKey, useCareerRevealStore } from "@/store/careerRevealStore";
import { useOverlayHold } from "@/store/overlayHoldStore";
import { ANIM_TOURNAMENT_SPEED, useSettings } from "@/store/settingsStore";
import { useOsReducedMotion } from "@/lib/useOsReducedMotion";
import { useMounted } from "@/store/useMounted";
import { REGION_BADGE } from "@/components/regionStyle";
import {
  dateOfDay,
  eventDayPhaseOf,
  eventTeamPreview,
  isEventPaused,
  isLegacySaturdayPlayoffs,
  localSideRatingOf,
  qualifierOutcomeOf,
  useCareerSave,
  userStars,
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
import {
  beatStepKey,
  createBeatSync,
  gamePlayback,
  startBeat,
  stopBeat,
} from "@/components/career/event/clockPlayback";
import { buildGameTimeline } from "@/engine/career/matchTimeline";
import { CareerSwissStandings } from "@/components/career/event/CareerSwissStandings";
import { ChampionshipSunday } from "@/components/career/event/ChampionshipSunday";
import { SeedList } from "@/components/career/event/SeedList";
import { SwissCompletePanel } from "@/components/career/event/SwissCompletePanel";
import { SwissVerdict } from "@/components/career/event/SwissVerdict";
import { lobbyFieldRefs } from "@/components/career/event/lobbyField";
import { WeekendPlan, formatLineOf, type WeekendNote } from "@/components/career/event/WeekendPlan";
import {
  advancedSeedsOf,
  eventRepPreview,
  eventRepPreviewKind,
  isSundaySpectator,
  openingOpponentOf,
  placementLabelOf,
  qualifiedIntoRegional,
  regionalEntryOf,
  regionalTomorrowOf,
  simStopsAtSwissEnd,
  sundayIntroDue,
  swissTableOrder,
  swissVerdictOf,
  userSeedOf,
  type WeekendRole,
} from "@/components/career/event/weekendView";
import {
  initialRevealedRounds,
  placementRankOf,
  resultsSeenOnMount,
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
  const startChampionshipSunday = useCareerStore((s) => s.startChampionshipSunday);

  // R40: the day's phase (lobby / swiss / paused / playoffs / finished) and
  // whether Sunday opens with its title card — both derived from the save.
  const phase = save ? eventDayPhaseOf(save) : "none";
  const sundayIntro = save ? sundayIntroDue(save) : false;

  // Instant-mode safety net: the lobby fires enterEvent(false)+simEvent()
  // together, but if a persisted save ever lands here mid-way (crash between
  // the two writes), finish the sim — an unwatched event NEVER shows playback.
  // R40: never while paused (Saturday's sim stops at the Swiss end; the
  // Swiss-complete panel waits for Sunday) nor while Championship Sunday's
  // card waits for the player's watch / instant choice. Keyed on the PHASE, so
  // it re-arms on Sunday.
  const needsInstantFinish = Boolean(
    save?.activeEvent &&
      !save.activeEvent.watched &&
      (phase === "swiss" || phase === "playoffs") &&
      !sundayIntro,
  );
  useEffect(() => {
    if (needsInstantFinish) simEvent();
  }, [needsInstantFinish, simEvent]);

  if (!mounted || !save) return <div className="min-h-[60vh]" aria-busy />;

  const ev = save.activeEvent;
  if (ev) {
    // R40: Championship Sunday opens with its title card (once per event).
    if (sundayIntro) {
      return <ChampionshipSunday save={save} ev={ev} onStart={startChampionshipSunday} />;
    }
    if (!ev.watched) {
      // R40: an instant Saturday stops at the Swiss end — the pause panel.
      if (phase === "paused") return <SwissCompletePanel save={save} ev={ev} />;
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

function EventLobby({ save, def }: { save: CareerSave; def: CareerEventDef }) {
  const C = useCareerCopy();
  const D = C.dates;
  const router = useRouter();
  const enterEvent = useCareerStore((s) => s.enterEvent);
  const simEvent = useCareerStore((s) => s.simEvent);
  const passUnofficial = useCareerStore((s) => s.passUnofficial);
  // One sheet for the lobby — any AI org in the field opens it.
  const [sheetRef, setSheetRef] = useState<string | null>(null);

  // rc.29 (CAR-06): the team this event fields (a ruled-out player included) —
  // the Community Cup field below is selected around it, like the engine's.
  const preview = useMemo(() => eventTeamPreview(save, def), [save, def]);
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
        if (!org && isLocalRef(ref)) {
          // R49: the rating the engine fields this side at in THIS event.
          return {
            ref,
            name: localTeamName(ref, save.careerSeed),
            stars: 0,
            rating: Math.round(localSideRatingOf(save, ref, { def, userRating: preview.rating.total })),
          };
        }
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

  // RTW-05 (rc.33): ruled out only while a reserve covers him.
  const unavailable = ruledOutFor(save, def);

  // R40: the weekend this lobby belongs to, and who came through Saturday.
  const isQualifier = def.tier === "qualifier";
  const throughSaturday = qualifiedIntoRegional(save, def);
  const entry = regionalEntryOf(save, def);
  const weekendNotes: Partial<Record<WeekendRole, WeekendNote>> | undefined =
    entry === "qualified"
      ? { qualifier: { text: C.event.entryQualified, tone: "good" } }
      : entry === "direct"
        ? { qualifier: { text: C.event.entryDirect, tone: "blue" } }
        : undefined;

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
              {formatMoney(prizePoolOf(def, save.difficulty), { compact: true })}
            </p>
          </div>
          {isQualifier ? (
            // R40: a qualifier pays no points — what is on the line is a seat on Sunday.
            <div className="rounded-lg border border-line bg-white/[0.03] p-2.5">
              <p className="kicker text-[9px]">{C.event.spots}</p>
              <p className="display text-lg font-bold text-ink">
                {C.event.spotsValue(CAREER_QUALIFIER.advanceSlots, TOURNAMENT.swiss.teams)}
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-line bg-white/[0.03] p-2.5">
              <p className="kicker text-[9px]">{C.common.seasonPoints}</p>
              <p className="display text-lg font-bold text-ink">
                {points !== null ? `${points} ${C.standings.ptsShort}` : "—"}
              </p>
            </div>
          )}
          <div className="rounded-lg border border-line bg-white/[0.03] p-2.5">
            <p className="kicker text-[9px]">{C.event.avgOvr}</p>
            <p className="display text-lg font-bold text-cyan">{avgOvr ?? "—"}</p>
          </div>
        </div>
        <p className="mt-2 text-xs text-faint">{formatLineOf(C, def)}</p>
      </Panel>

      {/* R40: the weekend — qualifier → regional, or Swiss stage → Championship Sunday */}
      <WeekendPlan save={save} def={def} notes={weekendNotes} style={{ animationDelay: "60ms" }} />

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
                  {throughSaturday.has(f.ref) ? (
                    <abbr
                      title={C.event.qualifiedTagHint}
                      className="display shrink-0 rounded bg-blue/15 px-1 text-[9px] font-bold uppercase tracking-wider text-blue-bright no-underline"
                    >
                      {C.event.qualifiedTag}
                    </abbr>
                  ) : null}
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

      {/* RTW-05 (rc.33): a short squad never starts an event — sign a third player first. */}
      {isToday && squadIsShort(save) ? (
        <div className="rise-in space-y-3 rounded-lg border border-bad/40 bg-bad/10 p-3" style={{ animationDelay: "120ms" }}>
          <p className="text-sm text-ink">{C.hub.squadShortBody(save.squad.length, def.name)}</p>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary" className="min-h-11" onClick={() => router.push("/career/market")}>
              {C.hub.squadShortMarket}
            </Button>
            <Button variant="secondary" className="min-h-11" onClick={() => router.push("/career/squad")}>
              {C.hub.squadShortSquad}
            </Button>
            {isUnofficial ? (
              <Button
                variant="ghost"
                className="min-h-11"
                onClick={() => {
                  passUnofficial();
                  router.push("/career");
                }}
              >
                {C.calendar.skip}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* CTAs — matchday only; earlier days are a read-only preview */}
      {isToday && !squadIsShort(save) ? (
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
  const reduced = useOsReducedMotion();

  const def = ev.def;
  const t = ev.tournament;
  const rounds = useMemo(() => roundsOf(t), [t]);
  // R40: a Major / Worlds Saturday holds at the Swiss end (nothing to ask the
  // engine for until Sunday); the qualifier and that Swiss decide more than
  // "the next round", so they carry their own verdict strip.
  const paused = isEventPaused(save);
  const twoDay = isTwoDayEvent(def);
  // Championship Sunday: the playoffs' day (Saturday's Swiss is yesterday's story).
  const championshipSunday = twoDay && save.clock.day !== def.day;
  // rc.30 (SEAM-2): a save from before rc.28 can hold a Major already INTO its
  // playoffs on Saturday (no pause back then) — it finishes today as a plain
  // playoffs day: bracket on, no Sunday title, nothing promised for tomorrow.
  const legacyPlayoffs = isLegacySaturdayPlayoffs(save);
  // R40 review: out in Saturday's Swiss, the user WATCHES Championship Sunday.
  const sundaySpectator = isSundaySpectator(save);
  const ownsSwissVerdict = def.tier === "qualifier" || twoDay;
  // The strip lives on the day the Swiss is played (Sunday is the playoffs')
  // — and stays up on Sunday for a spectator ("…go on without you").
  const swissVerdictContext: "qualifier" | "twoDay" | null =
    def.tier === "qualifier"
      ? "qualifier"
      : twoDay && !legacyPlayoffs && (save.clock.day === def.day || sundaySpectator)
        ? "twoDay"
        : null;

  // Reveal state. On mount, everything ALREADY simulated counts as revealed —
  // a fresh enterEvent has zero rounds (auto-starts) — unless this tab's
  // session cursor says otherwise. rc.29 (CAR-02): the cursor follows the
  // rounds fully revealed, so a reload or a trip to HQ mid-round replays that
  // round from its start (it used to count as seen: a reload during the
  // deciding Swiss round landed straight on the pause panel).
  const cursorKey = revealCursorKey(save.careerSeed, def.id);
  const setCursor = useCareerRevealStore((s) => s.setCursor);
  const [revealedRounds, setRevealedRounds] = useState(() =>
    initialRevealedRounds(
      useCareerRevealStore.getState().cursors[cursorKey],
      roundsOf(ev.tournament).length,
    ),
  );
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
  /** How far the live Match Center step has played: the timer keeps it, the clock reads it. */
  const beatSyncRef = useRef(createBeatSync());

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
        // Phase 1 — the user's series, beat by beat (GAME-04): each game's
        // timeline (goals on the 5:00 clock; in OT the end-of-regulation
        // beat, then the golden goal) waits out the clock segment the Match
        // Center plays — same plan, same numbers. `live.goal` counts BEATS.
        const game = userSeries.games[live.game];
        if (game) {
          const plan = gamePlayback(buildGameTimeline(userSeries, game, round.key));
          const tail = live.goal >= plan.steps.length;
          // A re-run mid-step (pause, speed change) RESUMES the step: it waits
          // only what is left, and the clock reads the same record, so the
          // two still land together.
          const sync = beatSyncRef.current;
          const wait = startBeat(
            sync,
            beatStepKey(round.key, live.game, live.goal),
            tail ? plan.tail.delayMs + P.userGameGapMs : plan.steps[live.goal].delayMs,
            speed,
            performance.now(),
          );
          timerRef.current = setTimeout(
            () => setLive((l) => (tail ? { game: l.game + 1, goal: 0 } : { ...l, goal: l.goal + 1 })),
            wait,
          );
          return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
            stopBeat(sync, performance.now());
          };
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
    } else if (t.stage !== "finished" && !paused) {
      // Reveal queue drained — ask the engine for the next round(s).
      tick(P.advanceMs, () => playEventRound());
    } else {
      // Everything revealed and the tournament is done — or (R40) the
      // Saturday Swiss is complete and the event waits for Championship
      // Sunday: never ask the engine for a round it will not play. Park.
      tick(0, () => setRunning(false));
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [reduced, running, anim, live, revealedRounds, rounds, t, speed, playEventRound, paused]);

  // Reduced motion / derived reveal state (never blank, never a timer).
  const effRevealed = reduced ? rounds.length : revealedRounds;
  const effAnim = reduced ? null : anim;

  // rc.29 (CAR-02): the session cursor = the rounds on screen (reduced motion
  // shows every simulated round at once, so its cursor never lags).
  useEffect(() => {
    setCursor(cursorKey, effRevealed);
  }, [cursorKey, effRevealed, setCursor]);

  // rc.29 (CAR-03): under reduced motion the click that plays the day's last
  // round shows THAT round first (the deciding series in the Match Center);
  // the digest / pause panel wait for an explicit "See results". Review R2:
  // the stop belongs to that click — a playback that mounts on results
  // already seen opens on them — and it is kept per day (Saturday's "See the
  // Swiss result" never answers for Sunday's final).
  const [resultsSeenDay, setResultsSeenDay] = useState<number | null>(() =>
    resultsSeenOnMount({
      atResults: t.stage === "finished" || paused,
      cursor: useCareerRevealStore.getState().cursors[cursorKey],
      simulated: rounds.length,
    })
      ? save.clock.day
      : null,
  );
  const resultsGated = reduced && resultsSeenDay !== save.clock.day;

  const digestReady =
    t.stage === "finished" && effRevealed >= rounds.length && !effAnim && !resultsGated;
  // R40: every Saturday round revealed and the event paused → the pause panel.
  const swissCompleteReady = paused && effRevealed >= rounds.length && !effAnim && !resultsGated;
  // rc.30 (review): a live event holds the quieter pop-ups (the login
  // calendar, the unlock pop-up) like a Draft tournament does — they used to
  // open over a playing round, which kept running underneath.
  useOverlayHold("live", !digestReady && !swissCompleteReady);

  // R40 review: the engine pauses as soon as it has SIMULATED the deciding
  // Swiss series — while this screen is still revealing Saturday, the top
  // bar keeps the event's own Continue (its "Championship Sunday" label would
  // spoil the verdict); the hold clears with the pause panel.
  const setRevealHold = useCareerRevealStore((s) => s.setHeldEventId);
  const holdsReveal = twoDay && !championshipSunday && !legacyPlayoffs && !swissCompleteReady;
  useEffect(() => {
    if (!holdsReveal) return;
    setRevealHold(def.id);
    return () => setRevealHold(null);
  }, [holdsReveal, def.id, setRevealHold]);

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

  const hasSwiss = def.format !== "single"; // "swiss" and the R40 "swissOnly" qualifier
  const swissFullyRevealed = throughRound >= t.swiss.rounds.length;
  // R40: a Major / Worlds Saturday never shows the bracket — its playoffs are
  // Sunday's (rc.29: the reduced-motion results stop shows Saturday's end here).
  const saturdayOfTwoDay = twoDay && !championshipSunday && !legacyPlayoffs;
  const showBracket =
    Boolean(t.playoffs) && !saturdayOfTwoDay && (!hasSwiss || (t.swiss.finished && swissFullyRevealed));

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
  // R40: on Championship Sunday, Saturday's Swiss series is yesterday's
  // story — the fallback looks at the playoffs only (the opener shows as
  // "Next up" until the first playoff series lands).
  for (let ri = 0; ri < Math.min(effRevealed, rounds.length); ri++) {
    const round = rounds[ri];
    if (championshipSunday && round.stage === "swiss") continue;
    if (round.userSeriesIndex !== null) lastUser = { round, si: round.userSeriesIndex };
  }
  const inspected = inspectKey ? findByKey(inspectKey) : null;
  // R40 review: a Championship Sunday spectator's center features the latest
  // playoff series already shown (never an empty "Next up" for a series that
  // will not come).
  const featuredKey = sundaySpectator
    ? tickerItems.find((item) => findByKey(item.key)?.round.stage === "playoffs")?.key
    : undefined;
  const featured = featuredKey ? findByKey(featuredKey) : null;
  const center = inspected ?? liveUser ?? lastUser ?? featured;
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

  const seriesStatus =
    center && !centerMidReveal && (center.round.series[center.si].teamAId === "user" || center.round.series[center.si].teamBId === "user")
      ? statusFor(center.round, center.si)
      : null;
  // R40: in the qualifier and a Major / Worlds Saturday the Swiss verdict is
  // the strip's (Qualified for Sunday / Through to Championship Sunday /
  // Eliminated in the Swiss) — the match center keeps the series story only.
  const centerStatus =
    ownsSwissVerdict && center?.round.stage === "swiss" ? null : seriesStatus;
  // Spoiler-safe: the REVEALED record (the decisive banner has landed).
  const swissVerdict = swissVerdictContext && hasSwiss ? swissVerdictOf(userRecord) : null;
  const regionalName =
    def.tier === "qualifier" ? (regionalForQualifier(def)?.name ?? C.common.tier.regional) : "";

  // Live key for the bracket's orange edge.
  const liveBracketKey =
    liveUser && liveUser.round.stage === "playoffs" && effAnim && !effAnim.banner
      ? seriesKey(liveUser.round, liveUser.si)
      : null;

  // Next known opponent (swiss) — only once nothing on screen can be spoiled.
  const nextPair =
    hasSwiss && t.stage === "swiss" && allSimRevealed
      ? (upcomingSwissPairings(t.swiss)?.find(([a, b]) => a === "user" || b === "user") ?? null)
      : null;
  const nextUpRef = nextPair ? (nextPair[0] === "user" ? nextPair[1] : nextPair[0]) : null;

  // R40: Championship Sunday — until its first playoff series shows, the
  // user's opener (fixed by the seeds, so it never spoils what the engine
  // played); then the next playoff opponent (the bracket names it too).
  const awaitingFirstPlayoff =
    championshipSunday &&
    !rounds.some((r, ri) => r.stage === "playoffs" && (ri < effRevealed || effAnim?.round === ri));
  const sundayPair =
    championshipSunday && allSimRevealed && t.stage === "playoffs" && t.playoffs && !t.userEliminated
      ? nextPlayoffPairings(t.playoffs).find(([a, b]) => a === "user" || b === "user")
      : undefined;
  const nextOpponentRef = awaitingFirstPlayoff
    ? openingOpponentOf(t.playoffs)
    : sundayPair
      ? sundayPair[0] === "user"
        ? sundayPair[1]
        : sundayPair[0]
      : nextUpRef;

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
    // Asked for the end: no "See results" stop under reduced motion.
    setResultsSeenDay(save.clock.day);
  };

  // R40: on a Major / Worlds Saturday the sim stops at the end of the Swiss
  // — keyed on the day (a stage-keyed label flipped mid-series, a spoiler).
  const simLabel =
    simStopsAtSwissEnd(def, save.clock.day) && !legacyPlayoffs ? C.event.simSwiss : C.event.simToEnd;
  // The stage ON SCREEN — the round being revealed, not the engine's stage
  // (it runs ahead: a qualifier is "finished" while its Swiss still plays
  // out, a regional's playoffs are seeded before its last Swiss round shows).
  let revealStage: "swiss" | "playoffs";
  if (t.swissOnly) revealStage = "swiss";
  else if (championshipSunday) revealStage = "playoffs";
  // rc.29 (CAR-03): Saturday paused at the Swiss end (the reduced-motion
  // results stop) is still the Swiss stage — the engine's seeded bracket is Sunday's.
  else if (saturdayOfTwoDay && paused) revealStage = "swiss";
  else if (animRound) revealStage = animRound.stage;
  else if (effRevealed >= rounds.length) revealStage = t.stage === "swiss" ? "swiss" : "playoffs";
  else revealStage = rounds[effRevealed - 1]?.stage ?? "swiss";

  // rc.29 (CAR-10): in the playoffs the header badge is the user's seed —
  // Saturday's Swiss record (unlabelled) read like a playoff score; without a
  // seed (out in the Swiss) it is labelled as the Swiss record.
  const playoffSeed = hasSwiss && revealStage === "playoffs" ? userSeedOf(t) : null;
  const recordText = T.record(userRecord.wins, userRecord.losses);
  const headerBadge =
    playoffSeed !== null
      ? C.event.yourSeed(playoffSeed)
      : revealStage === "playoffs"
        ? C.event.swissRecordBadge(recordText)
        : recordText;

  if (digestReady) return <EventDigest save={save} ev={ev} />;
  if (swissCompleteReady) return <SwissCompletePanel save={save} ev={ev} />;

  return (
    <div className="mx-auto max-w-6xl px-3 py-5 sm:px-4">
      <SectionTitle
        kicker={def.name}
        title={
          revealStage === "swiss"
            ? C.event.swissStage
            : championshipSunday
              ? C.event.championshipSunday
              : C.event.playoffs
        }
        right={
          hasSwiss ? (
            <Badge tone={playoffSeed !== null ? "orange" : "blue"} className="!text-sm">
              {headerBadge}
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
          t.stage === "finished" || paused ? (
            // rc.29 (CAR-03): the day is played and on screen — the results
            // (digest, or Saturday's pause panel) open on this click.
            <Button variant="primary" onClick={() => setResultsSeenDay(save.clock.day)}>
              {paused ? C.event.seeSwissResult : C.event.seeResults}
            </Button>
          ) : (
            <>
              <Button variant="primary" onClick={playEventRound}>
                {C.hub.continue}
              </Button>
              <Button variant="ghost" size="sm" onClick={simToEnd}>
                {simLabel}
              </Button>
            </>
          )
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
              {simLabel}
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
              progress={centerMidReveal ? { game: live.game, beat: live.goal } : null}
              clockSpeed={speed}
              clockPaused={!running}
              clockSync={beatSyncRef}
              status={centerStatus}
              onClose={inspected ? () => setInspectKey(null) : undefined}
            />
          ) : (
            <Panel strong className="flex min-h-[180px] flex-col items-center justify-center gap-2 p-6 text-center">
              <p className="kicker">{C.event.matchCenter}</p>
              {nextOpponentRef ? (
                <span className="flex items-center gap-2 text-sm text-sub">
                  {C.event.yourMatch} —
                  <OrgMark save={save} orgRef={nextOpponentRef} size="xs" />
                  <span className="display font-bold uppercase text-ink">
                    {t.teams[nextOpponentRef]?.name ?? ""}
                  </span>
                </span>
              ) : sundaySpectator ? (
                <p className="max-w-sm text-sm text-sub">{C.event.sundaySpectating}</p>
              ) : (
                <p className="text-sm text-faint">{C.event.nextUp}…</p>
              )}
            </Panel>
          )}

          {swissVerdictContext ? (
            <SwissVerdict
              verdict={swissVerdict}
              context={swissVerdictContext}
              regionalName={regionalName}
              seed={swissFullyRevealed ? userSeedOf(t) : null}
            />
          ) : null}

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
              nextUpRef={nextOpponentRef}
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

function EventDigest({ save, ev }: { save: CareerSave; ev: ActiveEventState }) {
  const C = useCareerCopy();
  const T = useCopy().TOURNAMENT_UI;
  const router = useRouter();
  const completeEvent = useCareerStore((s) => s.completeEvent);
  const advanceDay = useCareerStore((s) => s.advanceDay);
  const reduced = useOsReducedMotion();

  const def = ev.def;
  const t = ev.tournament;
  const placement = placementOf(t, "user");
  // R40: the qualifier is Swiss only — Qualified / Eliminated, never a champion.
  const outcome = qualifierOutcomeOf(def.tier, placement);
  const isQualifier = outcome !== null;
  const qualified = outcome === "qualified";
  const isChamp = placement === "champion";
  const prize = prizeFor(def.tier, placement, def.format, save.difficulty, def.seasonIndex);
  // The players' share finishEvent books out of a podium prize (rc.33 ECO-10: each played contract's own share).
  const playerShare = eventPlayerShareFor(save, ev, placement, prize);
  const points = pointsFor(def.tier, placement);
  // Display mirror of finishEvent's applyEventRep (pure, unit-tested).
  const repInput = {
    tier: def.tier,
    placement,
    reputation: save.reputation,
    flags: save.flags,
    seasonIndex: save.clock.seasonIndex,
    day: save.clock.day,
    tournament: t,
  };
  const rep = eventRepPreview(repInput);
  // rc.33 (RTW-02): the newcomer's path says why an exit paid reputation.
  const repKind = rep > 0 ? eventRepPreviewKind(repInput) : null;
  const underdogRep = repKind === "t3Semi" || repKind === "qualifierDeepRun";
  const championName = t.playoffs?.championTeamId
    ? (t.teams[t.playoffs.championTeamId]?.name ?? "")
    : "";
  const regionalName = isQualifier ? (regionalForQualifier(def)?.name ?? C.common.tier.regional) : "";
  // "On to Sunday" only when the regional really is tomorrow (a pre-R40
  // midweek qualifier still running at the update has days to go).
  const sundayNext = qualified && regionalTomorrowOf(def, save.clock.day) !== null;
  const userRecord = t.swiss.records.find((r) => r.teamId === "user") ?? { wins: 0, losses: 0 };
  const labels = { placement: C.common.placement, qualifierOutcome: C.common.qualifierOutcome };

  // Your top scorer across the whole event.
  const goalCounts = userGoalCounts(t);
  let topScorer: { name: string; goals: number } | null = null;
  for (let i = 0; i < goalCounts.length; i++) {
    const name = t.teams.user?.playerNames[i];
    if (name && goalCounts[i] > 0 && goalCounts[i] > (topScorer?.goals ?? 0)) {
      topScorer = { name, goals: goalCounts[i] };
    }
  }

  // Final standings (every team, user pinned visible): champion first — or,
  // for a Swiss-only qualifier, the final Swiss table (the qualified eight first).
  const finalRows = isQualifier
    ? swissTableOrder(t).map((id) => ({ id, placement: placementOf(t, id) }))
    : Object.keys(t.teams)
        .map((id) => ({ id, placement: placementOf(t, id) }))
        .sort(
          (a, b) =>
            placementRankOf(a.placement) - placementRankOf(b.placement) ||
            Number(b.id === "user") - Number(a.id === "user") ||
            (t.teams[a.id]?.name ?? "").localeCompare(t.teams[b.id]?.name ?? ""),
        );
  const recordOf = (id: string) => t.swiss.records.find((r) => r.teamId === id);
  const showPoints = maxPointsOf(def.tier) !== null;

  const confirm = () => {
    const wasWorlds = def.tier === "worlds";
    completeEvent();
    const next = selectActiveSave(useCareerStore.getState());
    router.push(wasWorlds || next?.phase !== "running" ? "/career/season" : "/career");
  };
  // R40: qualified on Saturday → straight to Sunday's regional lobby (one day).
  const onToSunday = () => {
    completeEvent();
    const after = selectActiveSave(useCareerStore.getState());
    if (
      after?.phase === "running" &&
      after.pendingEventDef?.tier === "regional" &&
      after.pendingEventDef.day === after.clock.day + 1
    ) {
      advanceDay();
    }
    const now = selectActiveSave(useCareerStore.getState());
    if (!now || eventDayPhaseOf(now) !== "lobby") router.push("/career");
  };

  const heroTitle = isQualifier
    ? qualified
      ? C.event.qualified
      : C.event.eliminatedTitle
    : C.common.placement[placement];

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-3 py-6 sm:px-4">
      {/* placement hero */}
      <Panel
        strong
        glow={isChamp || qualified ? "orange" : "blue"}
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
              isChamp ? "champion-title text-orange-bright" : qualified ? "text-good" : "text-ink",
            )}
          >
            {heroTitle}
          </p>
          {isQualifier ? (
            <p className={cx("mt-2 text-sm", qualified ? "font-semibold text-good" : "text-sub")}>
              {qualified ? C.event.qualifiedFor(regionalName) : C.event.regionalWithoutYou(regionalName)}
            </p>
          ) : (
            <p className={cx("mt-2 text-sm", isChamp ? "font-semibold text-amber-300" : "text-sub")}>
              {C.event.champion(isChamp ? save.identity.orgName : championName)}
            </p>
          )}

          {/* rewards — counted up (a qualifier pays no points: its record instead) */}
          <div className="mx-auto mt-6 grid max-w-md grid-cols-3 gap-2">
            <div className="rounded-lg border border-line bg-white/[0.04] p-3">
              <p className="kicker text-[9px]">{C.event.digestPrize}</p>
              <p className="display text-xl font-bold text-good sm:text-2xl">
                <CountUp value={prize} reduced={reduced} format={(n) => formatMoney(n, { compact: true })} />
              </p>
              {playerShare > 0 ? (
                <p className="mt-0.5 text-[10px] font-semibold text-sub">
                  {C.event.digestPlayerShare(formatMoney(playerShare, { compact: true }))}
                </p>
              ) : null}
            </div>
            {isQualifier ? (
              <div className="rounded-lg border border-line bg-white/[0.04] p-3">
                <p className="kicker text-[9px]">{C.event.swissRecord}</p>
                <p className="display text-xl font-bold text-cyan sm:text-2xl">
                  {T.record(userRecord.wins, userRecord.losses)}
                </p>
              </div>
            ) : (
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
            )}
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
              {underdogRep ? (
                <p className="mt-0.5 text-[10px] font-semibold text-sub">{C.event.digestRepUnderdog}</p>
              ) : null}
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

          {isQualifier && sundayNext ? (
            <div className="mt-6 flex flex-col items-center justify-center gap-2 sm:flex-row sm:gap-3">
              <Button variant="primary" size="lg" className="w-full sm:w-auto" onClick={onToSunday}>
                {C.event.onToSunday}
              </Button>
              <Button variant="ghost" className="w-full sm:w-auto" onClick={confirm}>
                {C.event.continueToHq}
              </Button>
            </div>
          ) : (
            <Button variant="primary" size="lg" className="mt-6 w-full sm:w-auto" onClick={confirm}>
              {def.tier === "worlds" ? C.event.continueToReview : C.event.continueToHq}
            </Button>
          )}
        </div>
      </Panel>

      {/* R40: the qualifier's eight, in seed order — they meet the direct eight on Sunday */}
      {isQualifier ? (
        <SeedList
          save={save}
          t={t}
          rows={advancedSeedsOf(t)}
          title={C.event.qualifiedEight}
          style={{ animationDelay: "60ms" }}
        />
      ) : null}

      {/* full final standings — rc.29 (CAR-04): a fixed layout where the TEAM
          column takes every pixel the numbers do not (it was starved to ~3
          characters at 390 px, and cut on desktop while PLACEMENT had room);
          below sm the placement drops under the team name. */}
      <Panel className="rise-in p-4" style={{ animationDelay: "80ms" }}>
        <p className="kicker mb-2.5 text-[10px]">{C.event.resultsDigest}</p>
        <table className="w-full table-fixed text-left text-xs">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-faint">
              <th className="hidden w-36 pb-2 font-semibold sm:table-cell" scope="col">
                {C.event.digestPlacement}
              </th>
              <th className="pb-2 font-semibold" scope="col">
                {T.team}
              </th>
              {isQualifier ? (
                <th className="w-14 pb-2 text-center font-semibold" scope="col">
                  {C.event.record}
                </th>
              ) : null}
              {showPoints ? (
                <th className="w-12 pb-2 text-right font-semibold" scope="col">
                  {C.standings.ptsShort}
                </th>
              ) : null}
              <th className="w-20 pb-2 text-right font-semibold" scope="col">
                {C.common.prize}
              </th>
            </tr>
          </thead>
          <tbody>
            {finalRows.map((row) => {
              const isUser = row.id === "user";
              const rowPrize = prizeFor(def.tier, row.placement, def.format, save.difficulty, def.seasonIndex);
              const rowPoints = pointsFor(def.tier, row.placement);
              const rec = isQualifier ? recordOf(row.id) : undefined;
              const rowQualified = isQualifier && row.placement !== "swiss_exit";
              const placementLabel = placementLabelOf(labels, def.tier, row.placement);
              const placementTone = rowQualified ? "font-semibold text-good" : "text-sub";
              const teamName = t.teams[row.id]?.name ?? row.id;
              return (
                <tr
                  key={row.id}
                  className={cx(
                    "border-t border-line",
                    isUser && "border-l-2 border-l-orange bg-orange/8",
                    row.placement === "champion" && "bg-amber-400/5",
                  )}
                >
                  <td
                    className={cx("hidden truncate py-1.5 pr-2 sm:table-cell", placementTone)}
                    title={placementLabel}
                  >
                    {placementLabel}
                  </td>
                  <td className="py-1.5 pr-2">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <OrgMark save={save} orgRef={row.id} size="xs" className="shrink-0" />
                      <span
                        title={teamName}
                        className={cx(
                          "min-w-0 truncate",
                          isUser ? "font-bold text-orange-bright" : "text-ink",
                        )}
                      >
                        {teamName}
                      </span>
                    </span>
                    <span className={cx("mt-0.5 block truncate text-[10px] leading-tight sm:hidden", placementTone)}>
                      {placementLabel}
                    </span>
                  </td>
                  {isQualifier ? (
                    <td className="display whitespace-nowrap py-1.5 text-center font-bold text-ink">
                      {rec ? T.record(rec.wins, rec.losses) : "—"}
                    </td>
                  ) : null}
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
