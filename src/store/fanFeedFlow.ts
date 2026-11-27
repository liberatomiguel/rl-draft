/**
 * v2.3 FEED (FEATURES.fanFeed): the store side of the fan feed. The rules and
 * the posts live in engine/career/fanFeed.ts (derived, never stored); this
 * file writes the one additive optional field `save.fanFeed`:
 *
 * - `recordFeedSeries` (one hook in careerFlow.finishEvent) logs the user's
 *   series when an event finishes, settles the manager's provocative posts
 *   (the receipt) and moves the followers. It only reads the tournament.
 * - `postToFeedFlow` is the one action: the manager's tone (or a skip) after
 *   his latest series. Stores tone, opponent and week (R196).
 *
 * Off: every function returns without touching the save.
 */
import { CAREER_FEED, FEATURES } from "@/config/balance";
import { weekOfDay } from "@/engine/career/calendar";
import { feedSeriesOf, followersMove } from "@/engine/career/fanFeed";
import type { FanFeedSave, FanTone, FeedSeries } from "@/engine/career/fanFeedTypes";
import type { CareerEventDef, CareerSave } from "@/engine/career/types";
import type { TournamentState } from "@/engine/types";

const F = CAREER_FEED.followers;

function freshFeed(save: CareerSave): FanFeedSave {
  return { v: 1, seq: 1, series: [], posts: [], answered: 0, followers: F.start + Math.round(Math.max(0, save.reputation) * F.perReputation) };
}

/** The followers number, or null when the feed never ran for this save (or the flag is off). */
export function followersOf(save: CareerSave): number | null {
  return FEATURES.fanFeed && save.fanFeed ? save.fanFeed.followers : null;
}

/**
 * The series the manager may still answer: his latest one, unanswered. Null
 * when the flag is off, there is none, or he already posted or skipped.
 */
export function pendingFeedPostOf(save: CareerSave): FeedSeries | null {
  if (!FEATURES.fanFeed || !save.fanFeed) return null;
  const last = save.fanFeed.series[save.fanFeed.series.length - 1];
  return last && last.n > save.fanFeed.answered ? last : null;
}

/**
 * Called by finishEvent on its working copy, next to the lifetime stats.
 * Logs the user's series, settles posts and moves the followers. Reads the
 * tournament, changes nothing about how results are recorded.
 */
export function recordFeedSeries(save: CareerSave, t: TournamentState, def: CareerEventDef): void {
  if (!FEATURES.fanFeed) return;
  const facts = feedSeriesOf(t, def, { seasonIndex: def.seasonIndex, week: def.week });
  if (facts.length === 0 && t.playoffs?.championTeamId !== "user") return;
  const feed = (save.fanFeed ??= freshFeed(save));
  for (const fact of facts) {
    const s: FeedSeries = { n: feed.seq, ...fact };
    feed.seq += 1;
    feed.series.push(s);
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
}

/**
 * The one action: the manager posts after his latest series in a tone, or
 * skips. Returns a new save with only `fanFeed` replaced; the same save when
 * the flag is off, there is nothing to answer, or the tone is not one of the three.
 */
export function postToFeedFlow(input: CareerSave, tone: FanTone | "skip"): CareerSave {
  const series = pendingFeedPostOf(input);
  const feed = input.fanFeed;
  if (!series || !feed) return input;
  if (tone === "skip") return { ...input, fanFeed: { ...feed, answered: series.n } };
  if (!(tone in F.tone)) return input;
  const posts = [
    ...feed.posts,
    {
      seriesN: series.n,
      tone,
      opponentRef: series.opponentRef,
      opponentName: series.opponentName,
      seasonIndex: input.clock.seasonIndex,
      week: weekOfDay(input.clock.day),
    },
  ].slice(-CAREER_FEED.postsKept);
  return { ...input, fanFeed: { ...feed, posts, answered: series.n, followers: followersMove(feed.followers, F.tone[tone]) } };
}
