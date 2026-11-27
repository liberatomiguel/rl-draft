/**
 * v2.3 FEED (F1-F4): the fan feed. `fanFeedFor(save)` derives the recent posts
 * from what the save already records and never stores them: the user's series
 * (the feed's own log, `save.fanFeed.series`), his titles and lost finals
 * (`eventResults`, the honours ledger), his signings and sales (`transferLog`),
 * and the manager's posts. A fact an older save lacks drops its post (R195).
 *
 * Pure and seeded: the same save gives the same feed. A post is data (kind,
 * copy key, slots, author handle, likes); `fanFeedText.ts` makes text of it
 * with the copy. The rules the copy may not break (a claim needs its data, no
 * variant repeats inside the window) live here and in `fanFeedVariants.ts`.
 */
import { CAREER_FEED } from "@/config/balance";
import { createRng } from "@/lib/rng";
import type { TournamentState } from "../types";
import { handleFrom } from "./fanHandles";
import { FEED_VARIANTS, type SeriesResult, type VariantDef } from "./fanFeedVariants";
import type { FanTone, FeedClaim, FeedKind, FeedManagerPost, FeedPost, FeedSeries, FeedSlots } from "./fanFeedTypes";
import { deriveSeed, streams } from "./seeds";
import type { CareerEventDef, CareerSave } from "./types";
import { weekOfDay } from "./calendar";

// ---------------------------------------------------------------------------
// What a series leaves behind (the hook in finishEvent calls this)
// ---------------------------------------------------------------------------

/** The user's series of a finished tournament in play order, without `n`. Events with a side-format roster (1v1, 2v2) are skipped. */
export function feedSeriesOf(
  t: TournamentState,
  def: Pick<CareerEventDef, "id" | "name" | "teamSize">,
  when: { seasonIndex: number; week: number },
): Omit<FeedSeries, "n">[] {
  if (def.teamSize) return [];
  const rounds = [...t.swiss.rounds.map((r) => r.series), ...(t.playoffs?.rounds ?? []).map((r) => r.series)];
  const out: Omit<FeedSeries, "n">[] = [];
  for (const round of rounds) {
    for (const s of round) {
      const userIsA = s.teamAId === "user";
      if (!userIsA && s.teamBId !== "user") continue;
      const opponentRef = userIsA ? s.teamBId : s.teamAId;
      const us = userIsA ? s.score[0] : s.score[1];
      const them = userIsA ? s.score[1] : s.score[0];
      out.push({
        seasonIndex: when.seasonIndex,
        week: when.week,
        eventId: def.id,
        event: def.name,
        opponentRef,
        opponentName: t.teams[opponentRef]?.name ?? opponentRef,
        us,
        them,
        won: s.winnerTeamId === "user",
        upset: s.upset,
      });
    }
  }
  return out;
}

/** A relative move of the followers number, at least `minStep` either way, never below 0. */
export function followersMove(current: number, pct: number): number {
  if (pct === 0) return current;
  const step = Math.round(current * pct);
  const min = CAREER_FEED.followers.minStep;
  const delta = pct > 0 ? Math.max(min, step) : Math.min(-min, step);
  return Math.max(0, current + delta);
}

// ---------------------------------------------------------------------------
// The user's titles (the ledger), and the claims it supports
// ---------------------------------------------------------------------------

interface LedgerTitle {
  seasonIndex: number;
  week: number;
  tier: string;
  eventId: string;
  name: string | null;
}

const timeOf = (seasonIndex: number, week: number): number => seasonIndex * 1000 + week;

/** Every title of the user the save can name: this season's results, and the honours ledger for Major and Worlds. */
function userTitlesOf(save: CareerSave): LedgerTitle[] {
  const titles = new Map<string, LedgerTitle>();
  for (const h of save.honors ?? []) {
    if (h.orgRef !== "user") continue;
    titles.set(`${h.eventId}|${h.seasonIndex}`, { seasonIndex: h.seasonIndex, week: 99, tier: h.tier, eventId: h.eventId, name: null });
  }
  for (const r of save.eventResults) {
    if (r.tier === "qualifier" || r.userPlacement !== "champion") continue;
    titles.set(`${r.eventId}|${r.seasonIndex}`, { seasonIndex: r.seasonIndex, week: r.week, tier: r.tier, eventId: r.eventId, name: r.name });
  }
  return [...titles.values()].sort((a, b) => timeOf(a.seasonIndex, a.week) - timeOf(b.seasonIndex, b.week));
}

/** What the claims read, at the moment of a post. */
export interface FeedCtx {
  /** Major and Worlds titles in the ledger up to (and including) that moment. */
  ledger: number;
  /** The latest regional on record by then was won by the user. */
  regionalChampion: boolean;
}

export function claimHolds(claim: FeedClaim, ctx: FeedCtx, slots: FeedSlots): boolean {
  switch (claim) {
    case "dynasty":
      return ctx.ledger >= CAREER_FEED.claims.dynastyTitles;
    case "firstMajor":
      return slots.titles === "1";
    case "bestInRegion":
      return ctx.regionalChampion;
  }
}

function ctxAt(save: CareerSave, ledger: LedgerTitle[], seasonIndex: number, week: number): FeedCtx {
  const at = timeOf(seasonIndex, week);
  const big = ledger.filter((t) => (t.tier === "major" || t.tier === "worlds") && timeOf(t.seasonIndex, t.week) <= at).length;
  let last: { t: number; won: boolean } | null = null;
  for (const r of save.eventResults) {
    if (r.tier !== "regional" || r.userPlacement === undefined) continue;
    const t = timeOf(r.seasonIndex, r.week);
    if (t <= at && (!last || t >= last.t)) last = { t, won: r.userPlacement === "champion" };
  }
  return { ledger: big, regionalChampion: last?.won ?? false };
}

// ---------------------------------------------------------------------------
// Candidates: the events a post answers
// ---------------------------------------------------------------------------

interface Candidate {
  id: string;
  kind: FeedKind;
  seasonIndex: number;
  week: number;
  /** Order inside one week: a series, then what it caused, then the rest. */
  rank: number;
  slots: FeedSlots;
  ctx: FeedCtx;
  tone?: FanTone;
  /** A manager's post or reply: the result of the series it came after (v2.3 FIX). */
  result?: SeriesResult;
}

/** "$1.2M" / "$350k". */
export function feedMoney(n: number): string {
  if (n >= 1_000_000) return `$${(Math.round(n / 100_000) / 10).toString()}M`;
  return `$${Math.max(1, Math.round(n / 1000))}k`;
}

/** The series score, winner first ("3-1"), whichever side the user was. */
export const scoreOf = (us: number, them: number): string => `${Math.max(us, them)}-${Math.min(us, them)}`;

const isMilestone = (n: number): boolean => (CAREER_FEED.streakMilestones as readonly number[]).includes(n);

function candidatesOf(save: CareerSave): Candidate[] {
  const out: Candidate[] = [];
  const org = save.identity.orgName;
  const ledger = userTitlesOf(save);
  const feed = save.fanFeed;
  const orgName = (ref: string | null): string | undefined => (ref ? save.world?.orgs?.[ref]?.name : undefined);

  // Series, with the streak they extend.
  let run = 0;
  for (const s of feed?.series ?? []) {
    run = s.won ? (run > 0 ? run + 1 : 1) : run < 0 ? run - 1 : -1;
    const length = Math.abs(run);
    const kind: FeedKind = s.won
      ? isMilestone(length) && run > 0 ? "winStreak" : s.upset ? "upsetWin" : "seriesWon"
      : isMilestone(length) && run < 0 ? "loseStreak" : s.upset ? "upsetLoss" : "seriesLost";
    const slots: FeedSlots = { opponent: s.opponentName, score: scoreOf(s.us, s.them), event: s.event, org };
    if (kind === "winStreak" || kind === "loseStreak") slots.streak = String(length);
    out.push({ id: `series:${s.n}`, kind, seasonIndex: s.seasonIndex, week: s.week, rank: 0, slots, ctx: ctxAt(save, ledger, s.seasonIndex, s.week) });
  }

  // Titles and lost finals.
  let count = 0;
  for (const t of ledger) {
    const big = t.tier === "major" || t.tier === "worlds";
    if (big) count += 1;
    if (!t.name) continue; // an older season's title: in the ledger, but its event name is not on the save
    const slots: FeedSlots = { event: t.name, org };
    if (big) slots.titles = String(count);
    out.push({ id: `title:${t.eventId}:${t.seasonIndex}`, kind: "titleWon", seasonIndex: t.seasonIndex, week: t.week, rank: 2, slots, ctx: ctxAt(save, ledger, t.seasonIndex, t.week) });
  }
  for (const r of save.eventResults) {
    if (r.tier === "qualifier" || r.userPlacement !== "runner_up") continue;
    const champion = r.rows.find((row) => row.ref === r.championRef)?.name;
    if (!champion) continue;
    out.push({
      id: `final:${r.eventId}:${r.seasonIndex}`,
      kind: "finalLost",
      seasonIndex: r.seasonIndex,
      week: r.week,
      rank: 2,
      slots: { event: r.name, org, opponent: champion },
      ctx: ctxAt(save, ledger, r.seasonIndex, r.week),
    });
  }

  // Signings and sales (the transfer wire).
  for (const e of save.transferLog ?? []) {
    if (e.kind !== "userIn" && e.kind !== "userOut") continue;
    const week = weekOfDay(e.day);
    const slots: FeedSlots = { player: e.playerName, org };
    if (e.fee > 0) slots.fee = feedMoney(e.fee);
    const other = orgName(e.kind === "userIn" ? e.fromRef : e.toRef);
    if (other) slots[e.kind === "userIn" ? "from" : "to"] = other;
    out.push({ id: `tx:${e.id}`, kind: e.kind === "userIn" ? "signing" : "sale", seasonIndex: e.seasonIndex, week, rank: 3, slots, ctx: ctxAt(save, ledger, e.seasonIndex, week) });
  }

  // The manager's posts, the fans' answer, and the receipt.
  for (const p of feed?.posts ?? []) {
    const { result, slots: seriesSlots } = postFactsOf(p, feed?.series ?? []);
    const slots: FeedSlots = { ...seriesSlots, opponent: p.opponentName, org, week: String(p.week) };
    const ctx = ctxAt(save, ledger, p.seasonIndex, p.week);
    out.push({ id: `post:${p.seriesN}`, kind: "managerPost", seasonIndex: p.seasonIndex, week: p.week, rank: 4, slots, ctx, tone: p.tone, result });
    out.push({ id: `reply:${p.seriesN}`, kind: "managerReply", seasonIndex: p.seasonIndex, week: p.week, rank: 5, slots, ctx, tone: p.tone, result });
    if (p.settled?.kind === "receipt") {
      const r = p.settled;
      out.push({
        id: `receipt:${p.seriesN}`,
        kind: "receipt",
        seasonIndex: r.seasonIndex,
        week: r.week,
        rank: 1,
        slots: { opponent: p.opponentName, score: scoreOf(r.us, r.them), event: r.event, org },
        ctx: ctxAt(save, ledger, r.seasonIndex, r.week),
      });
    }
  }

  // Ties keep the order they were pushed in (a series' own order inside its event).
  return out
    .map((c, i) => ({ c, i }))
    .sort((a, b) => timeOf(a.c.seasonIndex, a.c.week) - timeOf(b.c.seasonIndex, b.c.week) || a.c.rank - b.c.rank || a.i - b.i)
    .map((x) => x.c);
}

// ---------------------------------------------------------------------------
// Variants and the window
// ---------------------------------------------------------------------------

/**
 * v2.3 FIX: what a manager's post reacted to. The stored result first, then
 * the series ring; a post that has neither (made before the field existed and
 * already out of the ring) reads as a win with no score or event to name.
 */
function postFactsOf(p: FeedManagerPost, series: readonly FeedSeries[]): { result: SeriesResult; slots: FeedSlots } {
  const r = p.result ?? series.find((s) => s.n === p.seriesN);
  if (!r) return { result: "won", slots: {} };
  return { result: r.won ? "won" : "lost", slots: { score: scoreOf(r.us, r.them), event: r.event } };
}

/** The variants a candidate may use: its slots all present, its claim supported, its tone, its result. */
export function eligibleVariants(
  kind: FeedKind,
  slots: FeedSlots,
  ctx: FeedCtx,
  tone?: FanTone,
  result: SeriesResult = "won",
): VariantDef[] {
  return FEED_VARIANTS[kind].filter(
    (v) =>
      v.needs.every((s) => slots[s] !== undefined) &&
      (!v.claim || claimHolds(v.claim, ctx, slots)) &&
      (!v.tone || v.tone === tone) &&
      (!v.result || v.result === result),
  );
}

/** The number of recent posts of a kind a variant may not repeat in, given how many variants are eligible. */
export const windowFor = (eligible: number): number => Math.max(0, Math.min(CAREER_FEED.window, eligible - 1));

const authorSeed = (save: CareerSave, id: string, part: string): number => deriveSeed(save.careerSeed, streams.gen("fanFeed", `${id}:${part}`));

/** The manager's own post: one variant of tone x result, picked by the series so the preview and the feed agree. */
function managerPostVariant(careerSeed: number, seriesN: number, slots: FeedSlots, tone: FanTone, result: SeriesResult): string | null {
  const eligible = eligibleVariants("managerPost", slots, { ledger: 0, regionalChampion: false }, tone, result);
  if (eligible.length === 0) return null;
  return createRng(deriveSeed(careerSeed, streams.gen("fanFeed", `post:${seriesN}:v`))).pick(eligible).key;
}

/**
 * v2.3 UI (U5) + FIX: the manager's post as it would read, before it is sent:
 * the same copy key and slots the feed gives it once posted, written about the
 * series just played (its result, score and event). Pure.
 */
export function managerPostDraftOf(
  save: Pick<CareerSave, "identity" | "careerSeed">,
  series: Pick<FeedSeries, "n" | "opponentName" | "us" | "them" | "won" | "event">,
  tone: FanTone,
): Pick<FeedPost, "variant" | "slots"> {
  const slots: FeedSlots = { opponent: series.opponentName, org: save.identity.orgName, score: scoreOf(series.us, series.them), event: series.event };
  return { variant: managerPostVariant(save.careerSeed, series.n, slots, tone, series.won ? "won" : "lost") ?? "", slots };
}

/**
 * The feed, newest first. `limit` caps what is returned (default CAREER_FEED.limit);
 * the whole history is walked either way so a post never changes with the cap.
 * Nothing here reads the clock, and nothing is stored.
 */
export function fanFeedFor(save: CareerSave, opts: { limit?: number } = {}): FeedPost[] {
  const followers = save.fanFeed?.followers ?? CAREER_FEED.followers.start;
  const reach = Math.min(CAREER_FEED.reachMax, Math.max(1, followers / CAREER_FEED.reachUnit));
  const recentVariants = new Map<FeedKind, string[]>();
  const recentHandles: string[] = [];
  const posts: FeedPost[] = [];

  for (const c of candidatesOf(save)) {
    let variant: string;
    if (c.kind === "managerPost") {
      if (!c.tone) continue;
      const key = managerPostVariant(save.careerSeed, Number(c.id.slice("post:".length)), c.slots, c.tone, c.result ?? "won");
      if (!key) continue;
      variant = key;
    } else {
      const eligible = eligibleVariants(c.kind, c.slots, c.ctx, c.tone, c.result);
      if (eligible.length === 0) continue;
      const history = recentVariants.get(c.kind) ?? [];
      const recent = history.slice(history.length - windowFor(eligible.length));
      const pool = eligible.filter((v) => !recent.includes(v.key));
      variant = createRng(authorSeed(save, c.id, "v")).pick(pool.length > 0 ? pool : eligible).key;
      recentVariants.set(c.kind, [...history, variant].slice(-CAREER_FEED.window));
    }

    let author: FeedPost["author"] = { type: "manager" };
    if (c.kind !== "managerPost") {
      const rng = createRng(authorSeed(save, c.id, "h"));
      let handle = handleFrom(rng);
      for (let i = 0; i < 8 && recentHandles.includes(handle); i++) handle = handleFrom(rng);
      recentHandles.push(handle);
      if (recentHandles.length > 6) recentHandles.shift();
      author = { type: "fan", handle };
    }

    const [lo, hi] = CAREER_FEED.likes[c.kind];
    const likes = Math.round(createRng(authorSeed(save, c.id, "l")).int(lo, hi) * reach);
    posts.push({ id: c.id, kind: c.kind, variant, slots: c.slots, author, likes, seasonIndex: c.seasonIndex, week: c.week });
  }

  const limit = opts.limit ?? CAREER_FEED.limit;
  return posts.reverse().slice(0, limit);
}
