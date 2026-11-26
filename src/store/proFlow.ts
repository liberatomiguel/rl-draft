/**
 * v2.2 Pro spine (PROSPINE, slices 3-4, PRO-SPEC §7, §10): the Pro's time.
 *
 * R-PROSPINE-1 (the brief's sanctioned fallback): the world ticks through a
 * HIDDEN HOST, a manager CareerSave that shares the ProSave's world, clock
 * and competition (stored once, on the ProSave) and whose user-management
 * parts are made inert here: its money never runs out, every manager-only
 * decision is answered by `settleHost`, its squad always holds `pro:self`
 * (so the AI market, aging and world growth never touch him). The whole
 * calendar (cups, the Open Qualifier, regionals, Majors, Worlds, AI
 * transfers, Mundo vivo, the rollover) is therefore the manager's own code,
 * unchanged, and the manager career is byte-identical.
 *
 *  - Ranked and free agent: the host squad is the Pro alone (a short squad:
 *    every commit is skipped on its eve, the world plays on without him).
 *  - Amateur side: the host squad is the Pro + two local teammates; the side
 *    takes the "user" seat in cups and the Open Qualifier, and its series
 *    are played by the host (quick mode) and shown to the Pro afterwards.
 *  - Org: `pro:self` sits in a real org's playerIds / reserveIds; the org's
 *    events are AI events, and `proHooks.onAiEvent` hands their tournaments
 *    to the report, so he sees every series with his own box-score line.
 *
 * All functions are pure: ProSave in, ProSave out (a refused action returns
 * the same object), no throw for a reachable state.
 */

import { CAREER_PRO, CAREER_PRO_ORG, CAREER_PRO_TEAM } from "@/config/balance";
import { clamp } from "@/lib/util";
import { buildSeriesBoxScore } from "@/engine/career/boxScore";
import { dayOfWeekOf, isWindowStartWeek, weekOfDay, windowIndexOf, DAYS_PER_SEASON } from "@/engine/career/calendar";
import { ageOf, playerViewById as devView } from "@/engine/career/development";
import { derivedFloat } from "@/engine/career/seeds";
import { proOverall, round2 } from "@/engine/career/pro/attrs";
import { decideOrgLineup, proLineupScore, trustAfterSeries } from "@/engine/career/pro/lineup";
import {
  counterOutcomeOf,
  improvedOffer,
  orgOffersFor,
  placeProInOrg,
  proRosterCount,
  proSeatOf,
  removeProFromWorld,
  renewalOfferFor,
} from "@/engine/career/pro/offers";
import { applyBlock, applyMatchXp, closeWeek, coachPlanFor } from "@/engine/career/pro/spineBridge";
import type {
  ProHost,
  ProMatchReport,
  ProNewsItem,
  ProOffer,
  ProSeasonLine,
  ProSeriesLine,
  ProStop,
  ProWeekLog,
} from "@/engine/career/pro/spineTypes";
import { amateurInviteFor, amateurTeammates, proSquadPlayer, sideLevelOf } from "@/engine/career/pro/team";
import type { ProSave, ProWeekPlan } from "@/engine/career/pro/types";
import { PRO_SELF_ID, withProInWorld } from "@/engine/career/pro/world";
import type { CareerEventDef, CareerSave } from "@/engine/career/types";
import type { TournamentState, TournamentTeam } from "@/engine/types";
import { clockHoldOf, declineSponsorOffersFlow, reviewContractsFlow } from "./careerDecisions";
import {
  acknowledgeMoneyNoticeFlow,
  advanceDayFlow,
  canSkipShortSquadEvent,
  createCareerSave,
  declineBidFlow,
  declineUnofficial,
  finishEvent,
  isEventPaused,
  rolloverToNextSeason,
  simEventToEnd,
  skipShortSquadEventFlow,
  squadHoldFor,
  startEvent,
  syncSquadRoles,
} from "./careerFlow";
import { startSundayFlow } from "./careerSunday";
import { approveTrainingProposalFlow } from "./careerTraining";
import { proHooks } from "./proHooks";

// ---------------------------------------------------------------------------
// The host
// ---------------------------------------------------------------------------

/** The host as a full CareerSave (the world, clock and competition are the ProSave's). */
export function hostOf(save: ProSave): CareerSave | null {
  if (!save.host) return null;
  return { ...(save.host as ProHost), world: save.world, clock: save.clock, competition: save.competition } as CareerSave;
}

/** The host's own feed and mail are never shown (the Pro has his inbox): only the latest are kept, to keep the save small. */
const HOST_FEED_KEEP = 20;

function storeHost(save: ProSave, host: CareerSave): ProSave {
  const { world, clock, competition, ...rest } = host;
  const trimmed: ProHost = {
    ...rest,
    news: rest.news.length > HOST_FEED_KEEP ? rest.news.slice(0, HOST_FEED_KEEP) : rest.news,
    mail: rest.mail.length > HOST_FEED_KEEP ? rest.mail.slice(0, HOST_FEED_KEEP) : rest.mail,
  };
  return { ...save, world, clock, competition, host: trimmed };
}

function newHost(save: ProSave): CareerSave {
  const host = createCareerSave(
    {
      identity: {
        orgName: save.player.name,
        abbrev: save.player.name.slice(0, 3).toUpperCase(),
        managerName: save.player.name,
        country: save.player.country,
        region: save.player.region,
        crestId: "shield",
        colors: { primary: "#3b82f6", secondary: "#e2e8f0" },
        buffType: "consistency",
      },
      difficulty: save.difficulty,
      rosterKey: "balanced",
      trainingMode: "auto",
      prefs: { autoEnterUnofficials: false, autoTrain: true, matchdayMode: "quick", playbackDefault: "instant" },
    },
    save.careerSeed,
  );
  host.squad = [proSquadPlayer(save.player, host.clock.seasonIndex)];
  host.starterIds = [PRO_SELF_ID, "", ""];
  syncSquadRoles(host);
  host.foundingSquadIds = [];
  return host;
}

/**
 * The save with its host. A slice-1 save on its first day adopts the host's
 * world (the same seed builds the same world; the host has also run day 1's
 * arrival). A save whose clock already moved (a slice-2 week before the
 * spine) gets a host walked to its date.
 */
export function ensureProHost(save: ProSave): ProSave {
  if (save.host) return save;
  let host = newHost(save);
  let guard = 0;
  while ((host.clock.seasonIndex < save.clock.seasonIndex || host.clock.day < save.clock.day) && guard++ < DAYS_PER_SEASON * 2) {
    host = settleHost(host);
    const next = advanceDayFlow(host);
    if (next.clock.day === host.clock.day) break;
    host = next;
  }
  const out = storeHost({ ...save, seq: save.seq ?? 0 }, host);
  return syncPro({
    ...out,
    news: out.news ?? [],
    offers: out.offers ?? [],
    history: out.history ?? [],
    seasonStartOverall: out.seasonStartOverall ?? proOverall(out.player.attrs),
    seasonSeries: out.seasonSeries ?? { played: 0, won: 0, ratingSum: 0, teams: [] },
  });
}

/** The world's snapshot of the Pro and his entry on the host squad follow the player. */
function syncPro(save: ProSave): ProSave {
  const withWorld = withProInWorld(save);
  const host = hostOf(withWorld);
  if (!host) return withWorld;
  const me = proSquadPlayer(save.player, save.clock.seasonIndex);
  const others = host.squad.filter((p) => p.id !== PRO_SELF_ID);
  const squad = [{ ...me, role: host.squad.find((p) => p.id === PRO_SELF_ID)?.role ?? "starter" }, ...others];
  return storeHost(withWorld, { ...host, squad });
}

/** Answers every decision the hidden manager owes (none of them is the Pro's). Returns the host the clock can move from. */
function settleHost(input: CareerSave): CareerSave {
  let host = input;
  if (host.finances.balance < CAREER_PRO_TEAM.hostFloor) host = { ...host, finances: { ...host.finances, balance: CAREER_PRO_TEAM.hostFloor } };
  if (host.pendingInsert) host = { ...host, pendingInsert: null };
  for (let i = 0; i < 16; i++) {
    const hold = clockHoldOf(host);
    if (!hold) break;
    let next = host;
    switch (hold.kind) {
      case "event":
      case "sunday":
      case "seasonReview":
        return host; // the Pro's own (proStopOf / the advance)
      case "notice":
        next = acknowledgeMoneyNoticeFlow(host);
        break;
      case "contractReview":
        next = reviewContractsFlow(host).save;
        break;
      case "squadShort":
        next = dropShortCommit(host);
        break;
      case "insert":
        next = { ...host, pendingInsert: null };
        break;
      case "training":
        next = approveTrainingProposalFlow(host).save;
        break;
      case "bid":
        next = declineBidFlow(host, hold.id);
        break;
      case "sponsor":
        next = declineSponsorOffersFlow(host).save;
        break;
      default:
        break;
    }
    if (next === host) break;
    host = next;
  }
  return host;
}

/** A short host squad's commit: skipped (a regional week), passed (a cup), or dropped on its eve (a Major / Worlds berth: the seat is backfilled). */
function dropShortCommit(host: CareerSave): CareerSave {
  if (canSkipShortSquadEvent(host)) return skipShortSquadEventFlow(host).save;
  const def = squadHoldFor(host);
  if (!def) return host;
  if (def.tier === "t3" || def.tier === "t2") return declineUnofficial(host);
  return { ...host, pendingEventDef: null, pendingUnavailability: null };
}

// ---------------------------------------------------------------------------
// Reading the save
// ---------------------------------------------------------------------------

const seasonDayKey = (s: { clock: { seasonIndex: number; day: number } }) => `${s.clock.seasonIndex}:${s.clock.day}`;

/** What the Advance is stopped at (it is also what Advance does next). */
export function proStopOf(save: ProSave): ProStop | null {
  const host = hostOf(save);
  if (!host) return null;
  if (save.stage === "retired") return { kind: "retired" };
  if (host.phase === "seasonReview" || host.phase === "ended") return { kind: "seasonEnd" };
  if (host.activeEvent && !isEventPaused(host)) return { kind: "event", eventName: host.activeEvent.def.name };
  const def = host.pendingEventDef;
  if (def && def.day === host.clock.day && !host.activeEvent && save.stage === "amateur" && !squadHoldFor(host)) return { kind: "matchday", eventName: def.name };
  return null;
}

/** The Pro's next event on the calendar (the hub's "next"): the amateur side's commit, or his org's next official event. */
export function proNextEventOf(save: ProSave): { name: string; seasonIndex: number; day: number } | null {
  const host = hostOf(save);
  if (!host) return null;
  if (save.stage === "amateur") {
    const def = host.pendingEventDef ?? host.unofficialOffer;
    return def ? { name: def.name, seasonIndex: def.seasonIndex, day: def.day } : null;
  }
  return null;
}

export function proTeamNameOf(save: ProSave): string | null {
  if (save.stage === "amateur") return save.amateur?.name ?? null;
  if (save.stage === "org") return save.contract?.orgName ?? null;
  return null;
}

/** Open offers, newest first. */
export function openProOffersOf(save: ProSave): ProOffer[] {
  return save.offers.filter((o) => o.status === "open").reverse();
}

/** Does the Pro start for his org right now? (null without an org) */
export function proStartsOf(save: ProSave): boolean | null {
  if (save.stage !== "org") return null;
  return proSeatOf(save.world)?.seat === "starter";
}

// ---------------------------------------------------------------------------
// News
// ---------------------------------------------------------------------------

function nextSeq(save: ProSave): [ProSave, number] {
  const seq = (save.seq ?? 0) + 1;
  return [{ ...save, seq }, seq];
}

function pushNews(save: ProSave, key: string, params: Record<string, string | number> = {}): ProSave {
  const [s, seq] = nextSeq(save);
  const item: ProNewsItem = { id: `n${seq}`, seasonIndex: s.clock.seasonIndex, day: s.clock.day, key, params };
  return { ...s, news: [item, ...s.news].slice(0, CAREER_PRO_TEAM.newsCap) };
}

export function markProNewsReadFlow(save: ProSave): ProSave {
  if (!save.news.some((n) => !n.read)) return save;
  return { ...save, news: save.news.map((n) => (n.read ? n : { ...n, read: true })) };
}

// ---------------------------------------------------------------------------
// Match reports
// ---------------------------------------------------------------------------

function roundsOf(t: TournamentState): { key: string; series: TournamentState["swiss"]["rounds"][number]["series"]; playoffs: boolean; name?: string }[] {
  return [
    ...t.swiss.rounds.map((r, i) => ({ key: `sw:${i}`, series: r.series, playoffs: false })),
    ...(t.playoffs?.rounds ?? []).map((r, i) => ({ key: `po:${i}`, series: r.series, playoffs: true, name: r.name })),
  ];
}

function placementOf(t: TournamentState, teamId: string): ProMatchReport["placement"] {
  if (t.stage !== "finished") return undefined;
  if (t.playoffs?.championTeamId === teamId) return "champion";
  const po = (t.playoffs?.rounds ?? []).filter((r) => r.series.some((s) => s.teamAId === teamId || s.teamBId === teamId));
  if (po.length === 0) return "out";
  const last = po[po.length - 1];
  return last.name === "final" || last.name === "grand_final" ? "final" : "playoffs";
}

/** His team's series in `t` not yet in `known`, with his box-score line (null when he sat out). */
function seriesLinesOf(t: TournamentState, teamId: string, proName: string, proOvr: number, known: ReadonlySet<string>): ProSeriesLine[] {
  const T = CAREER_PRO_TEAM;
  const out: ProSeriesLine[] = [];
  for (const round of roundsOf(t)) {
    for (const s of round.series) {
      const side = s.teamAId === teamId ? "a" : s.teamBId === teamId ? "b" : null;
      if (!side || known.has(round.key)) continue;
      const us: TournamentTeam | undefined = t.teams[teamId];
      const them: TournamentTeam | undefined = t.teams[side === "a" ? s.teamBId : s.teamAId];
      const idx = us ? us.playerNames.indexOf(proName) : -1;
      const box = buildSeriesBoxScore(s, round.key, { a: t.teams[s.teamAId], b: t.teams[s.teamBId] });
      const edge = us ? clamp((proOvr - us.rating.avgPlayerOverall) * T.ratingEdgePerPoint, -T.ratingEdgeCap, T.ratingEdgeCap) : 0;
      const games = box.games.map((g) => {
        const line = idx >= 0 ? g.players[side][idx] : undefined;
        const final = side === "a" ? g.final : ([g.final[1], g.final[0]] as [number, number]);
        return {
          us: final[0],
          them: final[1],
          overtime: g.overtime,
          pro: line
            ? {
                goals: line.goals,
                assists: line.assists,
                saves: line.saves,
                shots: line.shots,
                rating: Math.round(clamp(line.rating + edge, 0, 10) * 10) / 10,
                mvp: g.mvp?.side === side && g.mvp.playerIdx === idx,
              }
            : null,
        };
      });
      const played = games.filter((g) => g.pro);
      const rating = played.length ? Math.round((played.reduce((a, g) => a + g.pro!.rating, 0) / played.length) * 10) / 10 : null;
      out.push({
        roundKey: round.key,
        opponent: them?.name ?? "?",
        won: s.winnerTeamId === teamId,
        score: side === "a" ? [s.score[0], s.score[1]] : [s.score[1], s.score[0]],
        games,
        rating,
      });
    }
  }
  return out;
}

/** Books new series: the report, match XP, the log, coach trust. */
function bookSeries(save: ProSave, def: CareerEventDef, t: TournamentState, teamId: string, teamName: string): ProSave {
  const prior = save.report && save.report.eventId === def.id ? save.report : null;
  const known = new Set(prior?.series.map((s) => s.roundKey) ?? []);
  const lines = seriesLinesOf(t, teamId, save.player.name, proOverall(save.player.attrs), known);
  if (lines.length === 0 && prior) return { ...save, report: { ...prior, placement: placementOf(t, teamId) ?? prior.placement } };
  let player = save.player;
  let growthLog = save.growthLog;
  let trust = save.coachTrust ?? CAREER_PRO_ORG.trustStart;
  const log = [...(save.matchLog ?? [])];
  const ss = { ...(save.seasonSeries ?? { played: 0, won: 0, ratingSum: 0, teams: [] }) };
  ss.teams = ss.teams.includes(teamName) ? ss.teams : [...ss.teams, teamName];
  for (const line of lines) {
    if (line.rating === null) continue;
    const opp = Object.values(t.teams).find((x) => x.name === line.opponent);
    const xp = applyMatchXp(player, {
      rating: line.rating,
      opponentStrength: opp?.rating.total ?? 70,
      tier: def.tier,
      seasonIndex: save.clock.seasonIndex,
      day: save.clock.day,
    });
    player = xp.player;
    growthLog = [...growthLog, ...xp.growth];
    log.push({ seasonIndex: save.clock.seasonIndex, day: save.clock.day, tier: def.tier, won: line.won, rating: line.rating });
    ss.played += 1;
    ss.won += line.won ? 1 : 0;
    ss.ratingSum += line.rating;
    if (save.stage === "org") trust = trustAfterSeries(trust, line.rating);
  }
  const series = [...(prior?.series ?? []), ...lines];
  const report: ProMatchReport = {
    id: `r:${def.id}`,
    eventId: def.id,
    eventName: def.name,
    tier: def.tier,
    seasonIndex: save.clock.seasonIndex,
    day: save.clock.day,
    teamName,
    benched: series.every((s) => s.rating === null),
    series,
    revealed: prior?.revealed ?? 0,
    placement: placementOf(t, teamId),
  };
  return syncPro({
    ...save,
    player,
    growthLog: growthLog.slice(-CAREER_PRO.growthLogCap),
    coachTrust: trust,
    matchLog: log.slice(-CAREER_PRO_TEAM.matchLogCap),
    seasonSeries: ss,
    report,
  });
}

/** The screen reveals one more game (the "next game" of the series view). */
export function revealProGameFlow(save: ProSave): ProSave {
  const r = save.report;
  if (!r) return save;
  const total = r.series.reduce((n, s) => n + s.games.length, 0);
  if (r.revealed >= total) return save;
  return { ...save, report: { ...r, revealed: r.revealed + 1 } };
}

/** Shows the whole report at once. */
export function revealProReportFlow(save: ProSave): ProSave {
  const r = save.report;
  if (!r) return save;
  const total = r.series.reduce((n, s) => n + s.games.length, 0);
  return r.revealed >= total ? save : { ...save, report: { ...r, revealed: total } };
}

export function dismissProReportFlow(save: ProSave): ProSave {
  return save.report ? { ...save, report: null } : save;
}

// ---------------------------------------------------------------------------
// The amateur matchday (the host's user seat)
// ---------------------------------------------------------------------------

/** Plays the amateur side's event of today as far as today goes (a two-day event pauses after Saturday). */
export function playProEventFlow(input: ProSave): ProSave {
  const save = ensureProHost(input);
  const stop = proStopOf(save);
  if (!stop || (stop.kind !== "matchday" && stop.kind !== "event")) return input;
  let host = hostOf(save)!;
  if (!host.activeEvent) {
    host = startEvent(host, false);
    if (!host.activeEvent) return input;
  }
  host = simEventToEnd(host);
  const ev = host.activeEvent;
  if (!ev) return input;
  let out = storeHost(save, host);
  out = bookSeries(out, ev.def, ev.tournament, "user", save.amateur?.name ?? host.identity.orgName);
  if (ev.tournament.stage === "finished") {
    out = storeHost(out, finishEvent(hostOf(out)!));
    if (out.report?.placement === "champion") out = pushNews(out, "sideTitle", { side: out.report.teamName, event: ev.def.name });
  }
  return out;
}

// ---------------------------------------------------------------------------
// The day
// ---------------------------------------------------------------------------

function coachOverallOf(save: ProSave): number | null {
  if (save.stage !== "org" || !save.contract) return null;
  return save.world.orgs[save.contract.orgRef]?.coachOverall ?? null;
}

/** The block of the week due on this day (Tue: 1st, Thu: 2nd, Fri: 3rd). */
function blockIndexFor(dow: number): number | null {
  return dow === 2 ? 0 : dow === 4 ? 1 : dow === 5 ? 2 : null;
}

const hasTeamOf = (save: ProSave) => save.stage === "amateur" || save.stage === "org";

/** The coach's plan for this week (rest before a LAN, the weak spots otherwise). */
export function proCoachPlanOf(save: ProSave): ProWeekPlan {
  const host = hostOf(save);
  const def = save.stage === "amateur" ? (host?.pendingEventDef ?? null) : null;
  const days = def && def.seasonIndex === save.clock.seasonIndex ? def.day - save.clock.day : undefined;
  return coachPlanFor(save.player, {
    seasonIndex: save.clock.seasonIndex,
    careerSeed: save.careerSeed,
    hasTeam: hasTeamOf(save),
    coachOverall: coachOverallOf(save),
    stage: save.stage,
    ...(days !== undefined && days >= 0 ? { daysToNextEvent: days, nextEventIsLan: def!.tier === "major" || def!.tier === "worlds" } : {}),
  });
}

export function weekPlanOf(save: ProSave): ProWeekPlan {
  return save.weekPlan && save.weekPlan.length === 3 ? save.weekPlan : proCoachPlanOf(save);
}

export function setProWeekPlanFlow(save: ProSave, plan: ProWeekPlan | null): ProSave {
  if (plan !== null && plan.length !== 3) return save;
  return { ...save, weekPlan: plan };
}

function emptyWeekLog(save: ProSave): ProWeekLog {
  return { seasonIndex: save.clock.seasonIndex, day: save.clock.day, growth: [], notes: [], energyTrace: [] };
}

function applyTodaysBlock(save: ProSave): ProSave {
  const idx = blockIndexFor(dayOfWeekOf(save.clock.day));
  if (idx === null) return save;
  const activity = weekPlanOf(save)[idx];
  const r = applyBlock(save.player, activity, {
    seasonIndex: save.clock.seasonIndex,
    day: save.clock.day,
    coachOverall: coachOverallOf(save),
    hasTeam: hasTeamOf(save),
    careerSeed: save.careerSeed,
  });
  const log = save.weekLog ?? emptyWeekLog(save);
  const notes = [...log.notes];
  for (const n of r.notes) if (!notes.some((x) => x.code === n.code && x.n === n.n && x.ref === n.ref)) notes.push(n);
  return {
    ...save,
    player: { ...r.player, lastPlan: weekPlanOf(save) },
    growthLog: [...save.growthLog, ...r.growth].slice(-CAREER_PRO.growthLogCap),
    weekLog: { ...log, growth: [...log.growth, ...r.growth], notes, energyTrace: [...log.energyTrace, Math.round(r.player.energy)] },
  };
}

/** Monday: the last week closes (the weekend's sleep, the burnout rules) and a new log opens. */
function closeTheWeek(save: ProSave): ProSave {
  const closed = closeWeek(save.player, { seasonIndex: save.clock.seasonIndex, day: save.clock.day, careerSeed: save.careerSeed });
  const log = save.weekLog;
  const last: ProWeekLog | null = log
    ? { ...log, notes: [...log.notes, ...closed.notes], energyTrace: [...log.energyTrace, Math.round(closed.player.energy)] }
    : null;
  return { ...save, player: closed.player, lastWeekLog: last ?? save.lastWeekLog ?? null, weekLog: emptyWeekLog(save) };
}

/** The last day of the window `week` belongs to. */
function windowEndDayOf(week: number): number {
  const idx = windowIndexOf(week);
  let w = week;
  while (w < 32 && windowIndexOf(w + 1) === idx) w += 1;
  return Math.min(DAYS_PER_SEASON, w * 7);
}

function expireOffers(save: ProSave): ProSave {
  const { seasonIndex, day } = save.clock;
  let changed = false;
  const offers = save.offers.map((o) => {
    if (o.status !== "open") return o;
    if (o.expiresSeason < seasonIndex || (o.expiresSeason === seasonIndex && o.expiresDay < day)) {
      changed = true;
      return { ...o, status: "expired" as const };
    }
    return o;
  });
  return changed ? { ...save, offers: offers.slice(-40) } : save;
}

function addOffers(save: ProSave, offers: ProOffer[], newsKey: string): ProSave {
  if (offers.length === 0) return save;
  let out: ProSave = { ...save, offers: [...save.offers, ...offers].slice(-40), seq: (save.seq ?? 0) + offers.length };
  for (const o of offers) out = pushNews(out, newsKey, { org: o.name, side: o.name, role: o.role });
  return out;
}

/** Monday's business: pay, the bench week, calls from sides and orgs, the renewal, the split's lineup. */
function mondayFor(save: ProSave): ProSave {
  let out = save;
  const week = weekOfDay(save.clock.day);
  const { seasonIndex } = save.clock;
  // Salary, weekly.
  if (out.contract) {
    out = { ...out, player: { ...out.player, money: out.player.money + Math.round(out.contract.salaryPerSplit / CAREER_PRO_ORG.weeksPerSplit) } };
  }
  // A week on the bench doing the work wins a little trust back.
  if (out.stage === "org" && proSeatOf(out.world)?.seat === "reserve") {
    out = { ...out, coachTrust: clamp((out.coachTrust ?? CAREER_PRO_ORG.trustStart) + CAREER_PRO_ORG.trustBenchWeek, 0, 100) };
  }
  // Amateur sides call.
  const host = hostOf(out);
  const mates = host?.squad.filter((p) => p.id !== PRO_SELF_ID) ?? [];
  const invite = amateurInviteFor(out, { week, currentLevel: out.stage === "amateur" ? sideLevelOf(mates, out.amateur?.level ?? 0) : null, seq: (out.seq ?? 0) + 1 });
  if (invite) out = addOffers(out, [invite], "amateurInvite");
  // Orgs call on a window's first Monday.
  const canMove =
    out.stage === "ranked" ||
    out.stage === "amateur" ||
    out.stage === "freeAgent" ||
    (out.stage === "org" &&
      !!out.contract &&
      (out.contract.transferRequested || (out.contract.endSeason === seasonIndex && !out.contract.renewed && windowIndexOf(week) === 3)));
  if (canMove && isWindowStartWeek(week) && windowIndexOf(week) !== null) {
    const offers = orgOffersFor(out, { week, windowEndDay: windowEndDayOf(week), seq: (out.seq ?? 0) + 1, currentOrg: out.contract?.orgRef ?? null });
    out = addOffers(out, offers, "orgOffer");
  }
  // The renewal talk in the deal's last season.
  if (out.stage === "org" && week === CAREER_PRO_ORG.renewalWeek && out.contract?.endSeason === seasonIndex && !out.contract.renewed) {
    const renewal = renewalOfferFor(out, { seq: (out.seq ?? 0) + 1, starts: proSeatOf(out.world)?.seat === "starter" });
    out = renewal ? addOffers(out, [renewal], "renewalOffer") : pushNews(out, "noRenewal", { org: out.contract.orgName });
  }
  // Last week's rotation start ends; the split's lineup (weeks 3 / 13 / 23); this week's rotation.
  out = endRotation(out);
  if (out.stage === "org" && (week === 3 || week === 13 || week === 23)) out = runLineup(out, true);
  out = rotateIn(out, week);
  return out;
}

/** The rotation start of last week ends: the starter he replaced takes his seat back. */
function endRotation(save: ProSave): ProSave {
  const outId = save.rotatedOut;
  if (!outId) return save;
  const cleared: ProSave = { ...save, rotatedOut: null };
  if (save.stage !== "org" || !save.contract) return cleared;
  const org = save.world.orgs[save.contract.orgRef];
  if (!org || !org.playerIds.includes(PRO_SELF_ID) || !org.reserveIds?.includes(outId)) return cleared;
  const playerIds = org.playerIds.map((id) => (id === PRO_SELF_ID ? outId : id)) as [string, string, string];
  const reserveIds = org.reserveIds.map((id) => (id === outId ? PRO_SELF_ID : id));
  return { ...cleared, world: { ...save.world, orgs: { ...save.world.orgs, [org.ref]: { ...org, playerIds, reserveIds } }, version: save.world.version + 1 } };
}

/** A benched Pro close to the lineup starts this week now and then (CAREER_PRO_ORG.rotationShare). */
function rotateIn(save: ProSave, week: number): ProSave {
  if (save.stage !== "org" || !save.contract || proSeatOf(save.world)?.seat !== "reserve") return save;
  const org = save.world.orgs[save.contract.orgRef];
  if (!org) return save;
  const view = { careerSeed: save.careerSeed, seasonIndex: save.clock.seasonIndex, world: save.world };
  const ovr = (id: string) => devView(id, view)?.overall ?? 0;
  let weakest = 0;
  org.playerIds.forEach((id, i) => {
    if (ovr(id) < ovr(org.playerIds[weakest])) weakest = i;
  });
  const score = proLineupScore(save.player, save.matchLog, save.coachTrust ?? CAREER_PRO_ORG.trustStart);
  if (score < ovr(org.playerIds[weakest]) - CAREER_PRO_ORG.rotationGap) return save;
  if (derivedFloat(save.careerSeed, `pro:rotation:${save.clock.seasonIndex}:${week}`) >= CAREER_PRO_ORG.rotationShare) return save;
  const outId = org.playerIds[weakest];
  const playerIds = [...org.playerIds] as [string, string, string];
  playerIds[weakest] = PRO_SELF_ID;
  const reserveIds = (org.reserveIds ?? []).map((id) => (id === PRO_SELF_ID ? outId : id));
  const world = { ...save.world, orgs: { ...save.world.orgs, [org.ref]: { ...org, playerIds, reserveIds } }, version: save.world.version + 1 };
  return pushNews({ ...save, world, rotatedOut: outId }, "rotationStart", { org: save.contract.orgName, player: devView(outId, view)?.name ?? "" });
}

function runLineup(save: ProSave, announce: boolean): ProSave {
  if (save.stage !== "org" || !save.contract) return save;
  const before = proSeatOf(save.world)?.seat;
  const score = proLineupScore(save.player, save.matchLog, save.coachTrust ?? CAREER_PRO_ORG.trustStart);
  const r = decideOrgLineup(save.world, save.contract.orgRef, score, { careerSeed: save.careerSeed, seasonIndex: save.clock.seasonIndex });
  let out = r.changed ? { ...save, world: r.world } : save;
  const after = r.starts ? "starter" : "reserve";
  if (announce && (r.changed || before !== after)) out = pushNews(out, r.starts ? "lineupStart" : "lineupBench", { org: save.contract.orgName });
  return out;
}

/** He is no longer where his contract says (an org left the scene, a world move): a free agent, with the news. */
function reconcileMembership(save: ProSave): ProSave {
  if (save.stage !== "org" || !save.contract) return save;
  const seat = proSeatOf(save.world);
  if (seat && seat.ref === save.contract.orgRef && proRosterCount(save.world) === 1) return save;
  const name = save.contract.orgName;
  const world = removeProFromWorld(save.world, { careerSeed: save.careerSeed, seasonIndex: save.clock.seasonIndex });
  return pushNews({ ...save, world, stage: "freeAgent", team: null, contract: null }, "orgGone", { org: name });
}

/** Everything that happens to the Pro on the day the host just arrived at. */
function afterArrival(save: ProSave, captured: { def: CareerEventDef; state: TournamentState }[]): ProSave {
  let out = expireOffers(save);
  if (dayOfWeekOf(out.clock.day) === 1) out = mondayFor(closeTheWeek(out));
  out = applyTodaysBlock(out);
  out = reconcileMembership(out);
  if (out.stage === "org" && out.contract) {
    for (const { def, state } of captured) out = bookSeries(out, def, state, out.contract!.orgRef, out.contract!.orgName);
  }
  return syncPro(out);
}

function withAiCapture<T>(orgRef: string | null, fn: () => T): { out: T; captured: { def: CareerEventDef; state: TournamentState }[] } {
  const captured: { def: CareerEventDef; state: TournamentState }[] = [];
  if (!orgRef) return { out: fn(), captured };
  const prev = proHooks.onAiEvent;
  proHooks.onAiEvent = (def, state) => {
    if (state.teams[orgRef]) captured.push({ def, state });
  };
  try {
    return { out: fn(), captured };
  } finally {
    proHooks.onAiEvent = prev;
  }
}

/**
 * One step of the Pro's time. Never a no-op on a live save: a matchday
 * plays, a season end rolls over, a Saturday pause moves to Sunday, any other
 * day arrives (its report and news follow).
 */
export function advanceProDayFlow(input: ProSave): ProSave {
  let save = ensureProHost(input);
  if (save.stage === "retired") return save;
  const stop = proStopOf(save);
  if (stop?.kind === "seasonEnd") return continueProSeasonFlow(save);
  if (stop?.kind === "matchday" || stop?.kind === "event") return playProEventFlow(save);
  if (save.report) save = { ...save, report: null };
  const host = settleHost(hostOf(save)!);
  const orgRef = save.stage === "org" ? (save.contract?.orgRef ?? null) : null;
  const { out: next, captured } = withAiCapture(orgRef, () => {
    const hold = clockHoldOf(host);
    if (hold?.kind === "sunday") return startSundayFlow(host).save;
    return advanceDayFlow(host);
  });
  if (next.clock.day === host.clock.day && next.clock.seasonIndex === host.clock.seasonIndex) {
    // The clock could not move: a hold the settle did not answer (kept for the soft-lock probe to name).
    return storeHost(save, next);
  }
  return afterArrival(storeHost(save, next), captured);
}

/** The batched Advance: days until something needs the Pro (a matchday, a report, an offer, the season's end). */
export function advanceProToNextStopFlow(input: ProSave): ProSave {
  let save = ensureProHost(input);
  const stop0 = proStopOf(save);
  if (stop0) return advanceProDayFlow(save);
  const offers0 = save.offers.length;
  for (let guard = 0; guard < DAYS_PER_SEASON + 7; guard++) {
    const before = seasonDayKey(save);
    save = advanceProDayFlow(save);
    if (seasonDayKey(save) === before) break;
    if (proStopOf(save) || save.report || save.offers.length !== offers0) break;
  }
  return save;
}

// ---------------------------------------------------------------------------
// The season's end
// ---------------------------------------------------------------------------

export function continueProSeasonFlow(input: ProSave): ProSave {
  let save = ensureProHost(input);
  let host = hostOf(save)!;
  if (host.phase !== "seasonReview" && host.phase !== "ended") return input;
  const seasonIndex = save.clock.seasonIndex;
  const ss = save.seasonSeries ?? { played: 0, won: 0, ratingSum: 0, teams: [] };
  const line: ProSeasonLine = {
    seasonIndex,
    age: ageOf(save.player.birthYear, seasonIndex),
    teams: ss.teams,
    overallStart: save.seasonStartOverall ?? proOverall(save.player.attrs),
    overallEnd: proOverall(save.player.attrs),
    series: ss.played,
    seriesWon: ss.won,
    avgRating: ss.played ? Math.round((ss.ratingSum / ss.played) * 10) / 10 : null,
  };
  save = { ...save, history: [...save.history, line], report: null };
  save = pushNews(save, "seasonDone", { season: seasonIndex + 1, series: ss.played, avg: line.avgRating === null ? "-" : line.avgRating.toFixed(1) });
  // A deal that ends with this season: renewed, or he walks into free agency.
  if (save.contract && save.contract.endSeason <= seasonIndex) {
    const name = save.contract.orgName;
    const world = removeProFromWorld(save.world, { careerSeed: save.careerSeed, seasonIndex });
    save = pushNews({ ...save, world, stage: "freeAgent", team: null, contract: null }, "contractEnded", { org: name });
  }
  host = hostOf(syncPro(save))!;
  if (host.phase === "ended") host = { ...host, phase: "seasonReview" };
  host = settleHost(reviewContractsFlow(host).save);
  const seatBefore = proSeatOf(save.world);
  host = rolloverToNextSeason(host);
  save = storeHost(save, host);
  // The rollover rebuilds the historical seasons' rosters from the dataset: a Pro under contract keeps his seat.
  if (save.stage === "org" && save.contract && !proSeatOf(save.world)) {
    if (save.world.orgs[save.contract.orgRef]) {
      const placed = placeProInOrg(save.world, save.contract.orgRef, seatBefore?.seat === "starter" ? "starter" : "rotation", {
        careerSeed: save.careerSeed,
        seasonIndex: save.clock.seasonIndex,
      });
      save = { ...save, world: placed.world };
    } else {
      const name = save.contract.orgName;
      save = pushNews({ ...save, stage: "freeAgent", team: null, contract: null }, "orgGone", { org: name });
    }
  }
  // The rollover's own aging never decides his attributes (slice 6 does): the host entry is rebuilt.
  if (!hostOf(save)!.squad.some((p) => p.id === PRO_SELF_ID)) {
    const h = hostOf(save)!;
    save = storeHost(save, { ...h, squad: [proSquadPlayer(save.player, save.clock.seasonIndex), ...h.squad] });
  }
  save = {
    ...save,
    seasonStartOverall: proOverall(save.player.attrs),
    seasonSeries: { played: 0, won: 0, ratingSum: 0, teams: proTeamNameOf(save) ? [proTeamNameOf(save)!] : [] },
  };
  return afterArrival(syncPro(save), []);
}

// ---------------------------------------------------------------------------
// Offers
// ---------------------------------------------------------------------------

export type ProOfferRefusal = "unknown" | "closed" | "matchday" | "orgGone" | "counterUsed" | "notOrg";

/** Why an offer cannot be answered now (null = it can). */
export function proOfferBlockOf(save: ProSave, id: string): ProOfferRefusal | null {
  const offer = save.offers.find((o) => o.id === id);
  if (!offer) return "unknown";
  if (offer.status !== "open") return "closed";
  const host = hostOf(save);
  if (host?.activeEvent || proStopOf(save)?.kind === "matchday") return "matchday";
  if (host?.pendingEventDef && host.pendingEventDef.day === host.clock.day) return "matchday";
  if ((offer.kind === "org" || offer.kind === "renewal") && !save.world.orgs[offer.ref]) return "orgGone";
  return null;
}

function setOffer(save: ProSave, id: string, patch: Partial<ProOffer>): ProSave {
  return { ...save, offers: save.offers.map((o) => (o.id === id ? { ...o, ...patch } : o)) };
}

/** The side he plays for, dissolved: the host squad back to him alone, its points gone. */
function leaveSide(save: ProSave): ProSave {
  if (save.stage !== "amateur") return save;
  const host = hostOf(save)!;
  const region = save.player.region;
  const strip = (table: Record<string, Record<string, number>> | undefined) => {
    if (!table?.[region]?.user) return table;
    const { user: _u, ...rest } = table[region];
    void _u;
    return { ...table, [region]: rest };
  };
  const competition = {
    ...host.competition,
    splitPoints: strip(host.competition.splitPoints as Record<string, Record<string, number>>) as typeof host.competition.splitPoints,
    seasonPoints: strip(host.competition.seasonPoints as Record<string, Record<string, number>>) as typeof host.competition.seasonPoints,
  };
  const squad = host.squad.filter((p) => p.id === PRO_SELF_ID);
  let h: CareerSave = {
    ...host,
    competition,
    squad,
    starterIds: [PRO_SELF_ID, "", ""],
    prefs: { ...host.prefs, autoEnterUnofficials: false },
    identity: { ...host.identity, orgName: save.player.name },
  };
  if (h.pendingEventDef && (h.pendingEventDef.tier === "t3" || h.pendingEventDef.tier === "t2")) h = { ...h, pendingEventDef: null };
  h = { ...h, unofficialOffer: null };
  syncSquadRoles(h);
  const name = save.amateur?.name ?? "";
  return pushNews(storeHost({ ...save, stage: "ranked", team: null, amateur: null }, h), "leftSide", { side: name });
}

function joinSide(save: ProSave, offer: ProOffer): ProSave {
  const left = leaveSide(save);
  const side = { ref: offer.ref, name: offer.name, level: offer.level };
  const host = hostOf(left)!;
  const mates = amateurTeammates(left, side);
  const h: CareerSave = {
    ...host,
    squad: [proSquadPlayer(left.player, left.clock.seasonIndex), ...mates],
    starterIds: [PRO_SELF_ID, mates[0].id, mates[1].id],
    prefs: { ...host.prefs, autoEnterUnofficials: true },
    identity: { ...host.identity, orgName: offer.name, abbrev: offer.name.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() || "AMS" },
  };
  syncSquadRoles(h);
  const out = storeHost({ ...left, stage: "amateur", team: { kind: "amateur", ref: offer.ref }, amateur: side }, h);
  return pushNews(out, "joinedSide", { side: offer.name });
}

function signFor(save: ProSave, offer: ProOffer): ProSave {
  let out = leaveSide(save);
  const ctx = { careerSeed: out.careerSeed, seasonIndex: out.clock.seasonIndex };
  const fromOrg = out.contract?.orgName ?? null;
  const placed = placeProInOrg(out.world, offer.ref, offer.role, ctx);
  if (proRosterCount(placed.world) !== 1) return save; // never two rosters (offers.test pins it)
  out = {
    ...out,
    world: placed.world,
    stage: "org",
    team: { kind: "org", ref: offer.ref },
    contract: {
      orgRef: offer.ref,
      orgName: offer.name,
      salaryPerSplit: offer.salaryPerSplit,
      // A deal signed after the preseason window runs through the next season(s): "1 season" is a full one.
      endSeason: out.clock.seasonIndex + offer.lengthSeasons - (weekOfDay(out.clock.day) <= 2 ? 1 : 0),
      role: offer.role,
      signedSeason: out.clock.seasonIndex,
      signedDay: out.clock.day,
    },
    coachTrust: CAREER_PRO_ORG.trustStart + (offer.role === "starter" ? CAREER_PRO_ORG.trustPromised : 0),
  };
  out = pushNews(out, fromOrg ? "transferred" : "signed", {
    org: offer.name,
    from: fromOrg ?? "",
    role: offer.role,
    seasons: offer.lengthSeasons,
    salary: offer.salaryPerSplit,
  });
  if (placed.displaced) out = pushNews(out, placed.displaced.to === "reserve" ? "displacedBench" : "displacedFree", { player: placed.displaced.name, org: offer.name });
  return out;
}

export function acceptProOfferFlow(input: ProSave, id: string): ProSave {
  const save = ensureProHost(input);
  if (proOfferBlockOf(save, id)) return input;
  const offer = save.offers.find((o) => o.id === id)!;
  let out: ProSave;
  if (offer.kind === "amateur") {
    if (save.stage === "org") return input;
    out = joinSide(save, offer);
  } else if (offer.kind === "renewal") {
    if (!save.contract || save.contract.orgRef !== offer.ref) return input;
    out = pushNews(
      { ...save, contract: { ...save.contract, endSeason: save.contract.endSeason + offer.lengthSeasons, salaryPerSplit: offer.salaryPerSplit, renewed: true, transferRequested: false } },
      "renewed",
      { org: offer.name, seasons: offer.lengthSeasons },
    );
  } else {
    out = signFor(save, offer);
    if (out === save) return input;
  }
  // The other open calls of the same kind lapse with the answer.
  const closes = (o: ProOffer) => o.status === "open" && o.id !== id && (offer.kind === "amateur" ? o.kind === "amateur" : o.kind !== "amateur");
  out = { ...out, offers: out.offers.map((o) => (o.id === id ? { ...o, status: "accepted" as const } : closes(o) ? { ...o, status: "declined" as const } : o)) };
  return syncPro(out);
}

export function declineProOfferFlow(input: ProSave, id: string): ProSave {
  const offer = input.offers.find((o) => o.id === id);
  if (!offer || offer.status !== "open") return input;
  return setOffer(input, id, { status: "declined" });
}

/** The one counter-offer: the org improves the deal or walks away (the risk was shown). */
export function counterProOfferFlow(input: ProSave, id: string): ProSave {
  const offer = input.offers.find((o) => o.id === id);
  if (!offer || offer.status !== "open" || offer.kind === "amateur" || offer.counter) return input;
  const outcome = counterOutcomeOf(input.careerSeed, offer);
  if (outcome === "walked") return pushNews(setOffer(input, id, { status: "withdrawn", counter: "walked" }), "counterWalked", { org: offer.name });
  const better = improvedOffer(offer);
  return pushNews(setOffer(input, id, better), "counterImproved", { org: offer.name, salary: better.salaryPerSplit });
}

/** A benched Pro asks to leave: costs trust, opens him to the next window's offers. */
export function requestProTransferFlow(input: ProSave): ProSave {
  if (input.stage !== "org" || !input.contract || input.contract.transferRequested) return input;
  if (proSeatOf(input.world)?.seat !== "reserve") return input;
  const out: ProSave = {
    ...input,
    contract: { ...input.contract, transferRequested: true },
    coachTrust: clamp((input.coachTrust ?? CAREER_PRO_ORG.trustStart) - CAREER_PRO_ORG.trustRequestCost, 0, 100),
  };
  return pushNews(out, "transferRequested", { org: input.contract.orgName });
}

export function canRequestProTransfer(save: ProSave): boolean {
  return save.stage === "org" && !!save.contract && !save.contract.transferRequested && proSeatOf(save.world)?.seat === "reserve";
}

/** The org's roster as the team screen lists it: starters then bench, with the Pro marked. */
export function proRosterOf(save: ProSave): { id: string; name: string; overall: number; starter: boolean; isPro: boolean }[] {
  const view = { careerSeed: save.careerSeed, seasonIndex: save.clock.seasonIndex, world: save.world };
  const me = (starter: boolean) => ({ id: PRO_SELF_ID, name: save.player.name, overall: proOverall(save.player.attrs), starter, isPro: true });
  if (save.stage === "amateur") {
    const host = hostOf(save);
    return (host?.squad ?? []).map((p) => (p.id === PRO_SELF_ID ? me(true) : { id: p.id, name: p.name, overall: round2(p.overall), starter: true, isPro: false }));
  }
  if (save.stage !== "org" || !save.contract) return [];
  const org = save.world.orgs[save.contract.orgRef];
  if (!org) return [];
  const row = (id: string, starter: boolean) => {
    if (id === PRO_SELF_ID) return me(starter);
    const v = devView(id, view);
    return { id, name: v?.name ?? id, overall: v?.overall ?? 0, starter, isPro: false };
  };
  return [...org.playerIds.map((id) => row(id, true)), ...(org.reserveIds ?? []).map((id) => row(id, false))];
}


// ---------------------------------------------------------------------------
// The week as the planner plays it
// ---------------------------------------------------------------------------

/**
 * "Play the week" (slice 2's planner): the plan is set and the real calendar
 * runs until the next Monday, or until something needs him first (a
 * matchday, the season's end). The blocks land on their own days and the
 * week closes on Monday. Returns what the week did for the planner.
 */
export function playProWeekFlow(input: ProSave, plan: ProWeekPlan): { save: ProSave; log: ProWeekLog | null } {
  let save = setProWeekPlanFlow(ensureProHost(input), plan);
  const startWeek = `${save.clock.seasonIndex}:${weekOfDay(save.clock.day)}`;
  for (let guard = 0; guard < 9; guard++) {
    const before = seasonDayKey(save);
    save = advanceProDayFlow(save);
    if (seasonDayKey(save) === before && !proStopOf(save)) break;
    const stop = proStopOf(save);
    if (stop) break;
    if (`${save.clock.seasonIndex}:${weekOfDay(save.clock.day)}` !== startWeek && dayOfWeekOf(save.clock.day) === 1) break;
  }
  const closedNow = save.lastWeekLog && save.weekLog && save.weekLog.day === save.clock.day;
  return { save, log: (closedNow ? save.lastWeekLog : save.weekLog) ?? null };
}
