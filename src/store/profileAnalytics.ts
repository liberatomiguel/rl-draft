/**
 * Progression analytics (2.0 catalogue) — the profile events that are READ OFF
 * a profile write instead of being fired by each action: XP is granted in half a
 * dozen places (runs, quiz, missions, login, challenges, the career), and a rank
 * or a cosmetic follows from the total, whoever granted it. Pure: the profile
 * store sends the list this returns from its own subscription, and stays silent
 * for a hydrate, a cloud merge and the staff preview.
 *
 * Also the profile's side of `session_started` (the player's snapshot) and of
 * the entry funnel (what a pre-2.0 profile had already done).
 */

import { rankForXp } from "@/engine/progression";
import type { PlayerHistory, SessionProps, TrackedEvent } from "@/lib/analytics";
import type { OnboardingStep } from "@/lib/analyticsCatalog";

/** The slice of the profile these readers need (structural: no store import). */
export interface ProfileAnalyticsView {
  xp: number;
  mmr: number;
  lifetime?: { xp: number };
  runsCompleted: number;
  achievements: Record<string, string>;
  unlockedSpecials: Record<string, string>;
  challengesCompleted: Record<string, string>;
  challengeStars?: Record<string, number>;
  careerMarks?: readonly string[];
  legacyUnlocked?: boolean;
  quiz?: { played: number };
  login?: { streak: number };
  cosmetics?: {
    owned?: Record<string, unknown>;
    equipped?: { title?: string | null; banner?: string | null; badges?: readonly string[] | null };
  };
}

/** From this many new cosmetics in ONE write, a single batch event (a catalog change, not a reward). */
export const UNLOCK_BATCH_FROM = 4;

/** Most `achievement_unlocked` events one write may send (a write never earns more in play). */
export const ACHIEVEMENTS_PER_WRITE = 8;

/** rc.51: the marks also hold Classic run marks (`run-` prefix); only the Road to
 *  Worlds ones (`car-`) say that a career exists. */
const careerOnly = (marks: readonly string[] | undefined): string[] => (marks ?? []).filter((id) => id.startsWith("car-"));

function newKeys(before: Record<string, unknown> | undefined, after: Record<string, unknown> | undefined): string[] {
  if (!after || after === before) return [];
  const known = before ?? {};
  return Object.keys(after).filter((key) => !(key in known));
}

/** The progression events one profile write produced. */
export function profileProgressEvents(prev: ProfileAnalyticsView, next: ProfileAnalyticsView): TrackedEvent[] {
  if (prev === next) return [];
  const out: TrackedEvent[] = [];

  if (next.xp > prev.xp) {
    const rank = rankForXp(next.xp);
    if (rank.index > rankForXp(prev.xp).index) {
      out.push({ name: "rank_up", props: { rankId: rank.id, rankIndex: rank.index, xp: next.xp } });
    }
  }

  for (const id of newKeys(prev.achievements, next.achievements).slice(0, ACHIEVEMENTS_PER_WRITE)) {
    out.push({ name: "achievement_unlocked", props: { id } });
  }

  const cosmetics = newKeys(prev.cosmetics?.owned, next.cosmetics?.owned);
  if (cosmetics.length >= UNLOCK_BATCH_FROM) {
    out.push({ name: "unlock_granted", props: { kind: "cosmetic_batch", id: "batch", count: cosmetics.length } });
  } else {
    for (const id of cosmetics) out.push({ name: "unlock_granted", props: { kind: "cosmetic", id, count: 1 } });
  }

  if (!prev.legacyUnlocked && next.legacyUnlocked) {
    out.push({ name: "unlock_granted", props: { kind: "mode", id: "legacy", count: 1 } });
  }
  return out;
}

/** The profile's part of `session_started`: where the player stands, as counts and ids. */
export function profileSessionProps(p: ProfileAnalyticsView): SessionProps {
  const equipped = p.cosmetics?.equipped;
  return {
    loginStreak: p.login?.streak ?? 0,
    xp: p.xp,
    rankId: rankForXp(p.xp).id,
    rating: p.mmr,
    runsCompleted: p.runsCompleted,
    specialsOwned: Object.keys(p.unlockedSpecials).length,
    achievements: Object.keys(p.achievements).length,
    challengesCleared: Object.keys(p.challengesCompleted).length,
    quizPlayed: p.quiz?.played ?? 0,
    careerMarks: careerOnly(p.careerMarks).length,
    equippedTitle: equipped?.title ?? "",
    equippedBanner: equipped?.banner ?? "",
    equippedBadge: equipped?.badges?.[0] ?? "",
  };
}

/** What this profile had already done before the device was first counted (so the entry funnel skips it). */
export function profileHistory(p: ProfileAnalyticsView): PlayerHistory {
  const doneSteps: OnboardingStep[] = [];
  if (p.runsCompleted > 0) doneSteps.push("draft_started", "draft_confirmed", "run_completed");
  if (Object.keys(p.challengesCompleted).length > 0 || Object.keys(p.challengeStars ?? {}).length > 0) {
    doneSteps.push("challenge_played");
  }
  if ((p.quiz?.played ?? 0) > 0) doneSteps.push("quiz_played");
  if (careerOnly(p.careerMarks).length > 0) doneSteps.push("career_created", "career_first_event");
  const existing =
    p.runsCompleted > 0 ||
    p.xp > 0 ||
    (p.lifetime?.xp ?? 0) > 0 ||
    Object.keys(p.unlockedSpecials).length > 0 ||
    doneSteps.length > 0;
  return { existing, doneSteps };
}
