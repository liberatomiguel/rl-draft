/**
 * v2.3 FEED (FEATURES.fanFeed): the store side of the fan feed. The rules and
 * the posts live in engine/career/fanFeed.ts (derived, never stored); this
 * file writes the one additive optional field `save.fanFeed`:
 *
 * - `recordFeedSeries` (one hook in careerFlow.finishEvent) logs the user's
 *   series when an event finishes, settles the manager's provocative posts
 *   (the receipt), moves the followers and, rc9 STORIES (R253), writes the
 *   offer to post when the event left a moment worth a statement
 *   (engine/career/fanFeedMoments.ts), spaced by a gap and a season cap.
 * - `postToFeedFlow` is the one action: the manager's tone (or "not this
 *   time") for the standing offer. Stores tone, opponent and week (R196), the
 *   moment and the copy key; rc9 STORIES (R256) applies the tone's effects:
 *   the followers, the squad's morale (FEATURES.lockerRoom) and the board's
 *   confidence (a save with a board), all from CAREER_FEED.effects.
 * - `postEffectsOf` is the sheet's "what it does": the same action run on the
 *   save, read back as figures, so it never shows an effect the game does not apply.
 *
 * Off: every function returns without touching the save.
 */
import { CAREER_FEED, FEATURES } from "@/config/balance";
import { applyConfidence } from "@/engine/career/board";
import { weekOfDay } from "@/engine/career/calendar";
import { deliverMail } from "@/engine/career/communications";
import { feedSeriesOf, followersMove, managerPostForOffer } from "@/engine/career/fanFeed";
import { breakthroughStepOf, offerAllowed, offerLastDay, postMomentOf, runOf, userSeedRankOf, userSeriesGapsOf } from "@/engine/career/fanFeedMoments";
import type { FanFeedSave, FanTone, FeedOffer, FeedSeries } from "@/engine/career/fanFeedTypes";
import { placementOf } from "@/engine/career/careerResults";
import { emptyLockerRoom, moraleOf, nudgeMorale } from "@/engine/career/lockerRoom";
import type { CareerEventDef, CareerSave } from "@/engine/career/types";
import type { TournamentState } from "@/engine/types";

const F = CAREER_FEED.followers;
const TONES: readonly FanTone[] = ["humble", "confident", "provocative"];

function freshFeed(save: CareerSave, seriesNow: number): FanFeedSave {
  // A feed that starts on a career already under way (the flag turned on later) counts its steps as taken: no false "never before".
  // finishEvent counts this event's series into the stats before this hook runs.
  const played = save.stats.seriesWins + save.stats.seriesLosses > seriesNow;
  return { v: 1, seq: 1, series: [], posts: [], answered: 0, followers: F.start + Math.round(Math.max(0, save.reputation) * F.perReputation), offer: null, reached: played ? ["qualified", "playoffs"] : [] };
}

/** The followers number, or null when the feed never ran for this save (or the flag is off). */
export function followersOf(save: CareerSave): number | null {
  return FEATURES.fanFeed && save.fanFeed ? save.fanFeed.followers : null;
}

/**
 * rc9 STORIES (R254): the standing offer to post, or null: none written, already
 * answered, lapsed (CAREER_FEED.offer.expireDays after it surfaced, or the
 * season turned), or the flag is off.
 */
export function pendingFeedPostOf(save: CareerSave): FeedOffer | null {
  if (!FEATURES.fanFeed || !save.fanFeed?.offer) return null;
  if (save.phase !== "running" && save.phase !== "seasonReview") return null;
  const o = save.fanFeed.offer;
  if (o.seriesN <= save.fanFeed.answered) return null;
  if (o.seasonIndex !== save.clock.seasonIndex || save.clock.day > offerLastDay(o.day)) return null;
  return o;
}

/** rc9 STORIES: the offer surfaced today (the top bar shows it as the decision due, that day only). */
export function feedPostSurfacedToday(save: CareerSave): boolean {
  const o = pendingFeedPostOf(save);
  return Boolean(o && o.day === save.clock.day);
}

/**
 * Called by finishEvent on its working copy, next to the lifetime stats.
 * Logs the user's series, settles posts, moves the followers and writes the
 * offer when the event left a moment. Reads the tournament, changes nothing
 * about how results are recorded.
 */
export function recordFeedSeries(save: CareerSave, t: TournamentState, def: CareerEventDef): void {
  if (!FEATURES.fanFeed) return;
  const facts = feedSeriesOf(t, def, { seasonIndex: def.seasonIndex, week: def.week });
  if (facts.length === 0 && t.playoffs?.championTeamId !== "user") return;
  const feed = (save.fanFeed ??= freshFeed(save, facts.length));
  const runBefore = runOf(feed.series);
  const logged: FeedSeries[] = [];
  for (const fact of facts) {
    const s: FeedSeries = { n: feed.seq, ...fact };
    feed.seq += 1;
    feed.series.push(s);
    logged.push(s);
    feed.followers = followersMove(feed.followers, s.won ? F.win : F.loss);
    if (s.upset) feed.followers = followersMove(feed.followers, s.won ? F.upsetWin : F.upsetLoss);
    // The receipt: a provocative post, then a series against that opponent.
    for (const p of feed.posts) {
      if (p.tone !== "provocative" || p.settled || p.opponentRef !== s.opponentRef) continue;
      if (s.n <= p.seriesN || s.seasonIndex - p.seasonIndex > CAREER_FEED.receiptWindowSeasons) continue;
      if (s.won) {
        p.settled = { kind: "backedUp", seriesN: s.n };
        feed.followers = followersMove(feed.followers, F.backedUp);
      } else {
        p.settled = { kind: "receipt", seriesN: s.n, seasonIndex: s.seasonIndex, week: s.week, event: s.event, us: s.us, them: s.them };
        feed.followers = followersMove(feed.followers, F.receipt);
      }
    }
  }
  if (feed.series.length > CAREER_FEED.seriesKept) feed.series.splice(0, feed.series.length - CAREER_FEED.seriesKept);
  if (t.playoffs?.championTeamId === "user") feed.followers = followersMove(feed.followers, F.title);
  offerAfterEvent(save, feed, t, def, logged, runBefore);
}

/** rc9 STORIES (R253): the offer, when the event left a moment and the gap and the cap allow one. */
function offerAfterEvent(save: CareerSave, feed: FanFeedSave, t: TournamentState, def: CareerEventDef, logged: FeedSeries[], runBefore: number): void {
  if (logged.length === 0) return;
  const gaps = userSeriesGapsOf(t);
  const placement = placementOf(t, "user");
  const reached = feed.reached ?? ["qualified", "playoffs"];
  const step = breakthroughStepOf(def.tier, placement);
  if (step && !reached.includes(step)) feed.reached = [...reached, step];
  const found = postMomentOf({
    tier: def.tier,
    placement,
    reached,
    series: logged.map((s, i) => ({ n: s.n, won: s.won, upset: s.upset, gap: gaps[i] ?? 0 })),
    runBefore,
    seedRank: userSeedRankOf(t),
  });
  if (!found) return;
  const now = { seasonIndex: save.clock.seasonIndex, day: save.clock.day };
  const log = feed.offerLog ?? [];
  if (!offerAllowed(log, now, found.moment)) return;
  const s = logged.find((x) => x.n === found.seriesN)!;
  feed.offer = {
    seriesN: s.n,
    moment: found.moment,
    seasonIndex: now.seasonIndex,
    day: now.day,
    eventId: def.id,
    event: s.event,
    tier: def.tier,
    opponentRef: s.opponentRef,
    opponentName: s.opponentName,
    us: s.us,
    them: s.them,
    won: s.won,
    ...(found.streak !== undefined ? { streak: found.streak } : {}),
  };
  feed.offerLog = [...log, now].slice(-CAREER_FEED.offer.logKept);
}

/** The tone's effect row for the offer's result. */
const effectOf = (tone: FanTone, offer: FeedOffer): { followers: number; morale: number; board: number } =>
  CAREER_FEED.effects[tone][offer.won ? "won" : "lost"];

/**
 * The one action: the manager posts for the standing offer in a tone, or lets
 * it pass ("skip": no post, no effect). Returns a new save; the same save when
 * the flag is off, there is nothing to answer, or the tone is not one of the three.
 */
export function postToFeedFlow(input: CareerSave, tone: FanTone | "skip"): CareerSave {
  const offer = pendingFeedPostOf(input);
  const feed = input.fanFeed;
  if (!offer || !feed) return input;
  if (tone === "skip") return { ...input, fanFeed: { ...feed, answered: offer.seriesN } };
  if (!TONES.includes(tone)) return input;
  const draft = managerPostForOffer(input, offer, tone);
  const fx = effectOf(tone, offer);
  const posts = [
    ...feed.posts,
    {
      seriesN: offer.seriesN,
      tone,
      opponentRef: offer.opponentRef,
      opponentName: offer.opponentName,
      seasonIndex: input.clock.seasonIndex,
      week: weekOfDay(input.clock.day),
      // v2.3 FIX: the result it reacted to, so its text is about a series already played.
      result: { won: offer.won, us: offer.us, them: offer.them, event: offer.event },
      moment: offer.moment,
      ...(draft.variant ? { variant: draft.variant } : {}),
      ...(offer.streak !== undefined ? { streak: offer.streak } : {}),
    },
  ].slice(-CAREER_FEED.postsKept);
  const save: CareerSave = { ...input, fanFeed: { ...feed, posts, answered: offer.seriesN, followers: followersMove(feed.followers, fx.followers) } };
  // rc9 STORIES (R256): the squad hears the post. LOCKER merge point: one call, through nudgeMorale.
  if (FEATURES.lockerRoom && fx.morale !== 0 && save.squad.length > 0) moveSquadMorale(save, fx.morale);
  // rc9 STORIES (R256): the board reads it too (its confidence log names the post).
  if (FEATURES.board && save.board && fx.board !== 0) {
    const board = structuredClone(save.board);
    applyConfidence(board, fx.board, "managerPost", { seasonIndex: save.clock.seasonIndex, day: save.clock.day });
    save.board = board;
  }
  return save;
}

/** Every squad player's morale moves by `delta` for the manager's post; a change of mood becomes the locker's mood mail. */
function moveSquadMorale(save: CareerSave, delta: number): void {
  const clock = { seasonIndex: save.clock.seasonIndex, day: save.clock.day };
  let state = save.lockerRoom ?? emptyLockerRoom();
  const changes: string[] = [];
  for (const p of save.squad) {
    const res = nudgeMorale(state, { clock, careerSeed: save.careerSeed }, p.id, delta, "managerPost");
    state = res.state;
    for (const n of res.notes) if (n.kind === "mood") for (const c of n.changes) changes.push(`${p.name}~${c.mood}`);
  }
  save.lockerRoom = state;
  if (changes.length > 0) {
    // The input save is shared (a shallow copy): the mail gets its own items before the delivery writes.
    save.mail = save.mail.map((m) => ({ ...m }));
    deliverMail(save, {
      kind: "club",
      titleKey: "lockerMood",
      params: { event: `mood:managerPost:${save.seq + 1}`, reason: "managerPost", changes: changes.join("|"), count: changes.length },
      fromKey: "staff",
    });
  }
}

/** rc9 STORIES (R256): what a post in this tone does, as the game will apply it. */
export interface PostEffects {
  /** Followers gained (absolute) and the relative move. */
  followers: number;
  followersPct: number;
  /** The squad's morale move per player (0 when the locker room is off or nothing moved). */
  morale: number;
  /** The board's confidence move (0 without a board). */
  board: number;
  /** A provocative post: the followers a later loss to this opponent would cost (the receipt), as a relative move. */
  receiptPct: number | null;
  backedUpPct: number | null;
}

/**
 * The sheet's figures: the action run on this save and read back. The squad's
 * morale is the largest move any player gets (a player at the floor or the
 * ceiling moves less). Pure; null with no standing offer.
 */
export function postEffectsOf(save: CareerSave, tone: FanTone): PostEffects | null {
  const offer = pendingFeedPostOf(save);
  if (!offer || !save.fanFeed) return null;
  const after = postToFeedFlow(save, tone);
  if (after === save || !after.fanFeed) return null;
  const moves = save.squad.map((p) => moraleOf(after.lockerRoom, p.id) - moraleOf(save.lockerRoom, p.id));
  const morale = moves.reduce((m, d) => (Math.abs(d) > Math.abs(m) ? d : m), 0);
  const board = (after.board?.confidence ?? 0) - (save.board?.confidence ?? 0);
  return {
    followers: after.fanFeed.followers - save.fanFeed.followers,
    followersPct: effectOf(tone, offer).followers,
    morale,
    board,
    receiptPct: tone === "provocative" ? F.receipt : null,
    backedUpPct: tone === "provocative" ? F.backedUp : null,
  };
}

/**
 * rc9 STORIES (R254): every load, idempotent, no version bump. A save from
 * before rc.9 has no `offer`: its feed offered a post after every series (the
 * latest one, unanswered). That implicit offer is retired: the series is
 * marked answered and `offer` set to null, so nothing old surfaces as a
 * decision. Off, or without a feed: nothing is written.
 */
export function repairFanFeedOnLoad(save: CareerSave): void {
  if (!FEATURES.fanFeed || !save.fanFeed || save.fanFeed.offer !== undefined) return;
  const last = save.fanFeed.series[save.fanFeed.series.length - 1];
  if (last && last.n > save.fanFeed.answered) save.fanFeed.answered = last.n;
  save.fanFeed.offer = null;
  // Its steps are unknown to the feed: counted as taken, so no "never before" post is offered for them.
  save.fanFeed.reached ??= ["qualified", "playoffs"];
}
