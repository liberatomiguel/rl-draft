/**
 * Challenge → collection regression (#100, v1.4.3).
 *
 * Bug: specials drafted onto a CHALLENGE team never reached the collection — the
 * challenge flow only persisted the challenge's REWARD special (`completeChallenge`),
 * unlike a normal run which collects every drafted special (`compileResults` →
 * `applyRunResults`). This drives the REAL `runStore.playChallenge` with an injected
 * challenge state and asserts the fielded special lands in `unlockedSpecials`.
 */

import { describe, expect, it, beforeEach } from "vitest";
import { challenges, coachById, playerCardById, specialCardById, subById } from "@/data";
import { createRng, type Rng } from "@/lib/rng";
import { finalOverall } from "@/engine/cards";
import { buildChallengeOpponent, createChallengeDraft } from "@/engine/challenges";
import { applyPick, applyReroll, neededKinds, slotsForKind } from "@/engine/draft";
import { buildUserTeam } from "@/engine/teams";
import type { Challenge, DraftOfferCard, Roster, RunState } from "@/engine/types";
import { useProfileStore } from "./profileStore";
import { useRunStore } from "./runStore";

function cardScore(c: DraftOfferCard): number {
  if (c.kind === "player") return finalOverall(playerCardById.get(c.refId)!);
  if (c.kind === "coach") return coachById.get(c.refId)?.overall ?? 0;
  if (c.kind === "sub") return subById.get(c.refId)?.overall ?? 0;
  return 50;
}

/** A competent fixed-seed draft (mirrors challenges.test.ts) — assembles a legal roster. */
function autoDraft(ch: Challenge, rng: Rng): Roster | null {
  let draft = createChallengeDraft(ch, rng);
  let guard = 0;
  while (!draft.complete && guard++ < 120) {
    const offer = draft.offer;
    if (!offer) break;
    const need = neededKinds(draft.roster, draft.mode);
    const pickable = offer.cards
      .filter((c) => c.availability === "available" && need.includes(c.kind))
      .filter((c) => slotsForKind(c.kind).some((s) => !draft.roster[s]))
      .sort((a, b) => (a.kind === "player" ? 1 : 0) - (b.kind === "player" ? 1 : 0) || cardScore(b) - cardScore(a));
    const best = pickable.find((c) => c.kind === "player") ?? pickable[pickable.length - 1] ?? null;
    if (!best) {
      if (draft.rerollsLeft > 0) {
        draft = applyReroll(draft, rng);
        continue;
      }
      const any = offer.cards.find(
        (c) => c.availability === "available" && slotsForKind(c.kind).some((s) => !draft.roster[s]),
      );
      if (!any) return null;
      draft = applyPick(draft, any, slotsForKind(any.kind).find((s) => !draft.roster[s])!, rng);
      continue;
    }
    draft = applyPick(draft, best, slotsForKind(best.kind).find((s) => !draft.roster[s])!, rng);
  }
  return draft.complete ? draft.roster : null;
}

describe("runStore.playChallenge — drafted specials reach the collection (#100)", () => {
  beforeEach(() => {
    useProfileStore.getState().resetAll();
    useRunStore.setState({ run: null });
  });

  it("collects a special fielded on the challenge team, win or lose", () => {
    // Any challenge whose fixed-seed draft assembles a legal roster.
    const ch = challenges.find((c) => autoDraft(c, createRng(c.seed)));
    expect(ch, "expected at least one assemblable challenge").toBeTruthy();
    const roster = autoDraft(ch!, createRng(ch!.seed))!;

    // Inject a real player special onto player1 — a roll a real challenge draft can
    // produce (SSL-rank special chance). The team must end up fielding it.
    const specialId = "sp-kronovi-the-mountain";
    expect(specialCardById.has(specialId)).toBe(true);
    roster.player1 = { ...roster.player1!, specialId };

    const user = buildUserTeam(roster, ch!.sim.difficulty, { mode: "challenge" });
    expect(user.specialIds).toContain(specialId); // sanity: it's on the fielded team
    const opponent = buildChallengeOpponent(ch!);

    const rng = createRng(ch!.seed);
    const run: RunState = {
      runId: "test-challenge",
      mode: "challenge",
      challengeId: ch!.id,
      seed: ch!.seed,
      rngState: rng.state,
      difficulty: ch!.sim.difficulty,
      showOverall: true,
      phase: "challenge",
      startedAt: new Date().toISOString(),
      draft: createChallengeDraft(ch!, createRng(ch!.seed)), // shape-fill; playChallenge ignores it
      tournament: null,
      challenge: { user, opponent, series: null, cleared: false },
      results: null,
    };
    useRunStore.setState({ run });

    expect(useProfileStore.getState().unlockedSpecials[specialId]).toBeUndefined();
    useRunStore.getState().playChallenge();
    // Fixed before #100, this stayed undefined — the drafted special was dropped.
    expect(useProfileStore.getState().unlockedSpecials[specialId]).toBeDefined();
  });

  it("collectSpecials is idempotent and preserves earlier unlocks", () => {
    const profile = useProfileStore.getState();
    profile.collectSpecials(["sp-kronovi-the-mountain"]);
    const firstAt = useProfileStore.getState().unlockedSpecials["sp-kronovi-the-mountain"];
    profile.collectSpecials(["sp-kronovi-the-mountain", "sp-kuxir97-pinch-god"]);
    const after = useProfileStore.getState().unlockedSpecials;
    expect(after["sp-kronovi-the-mountain"]).toBe(firstAt); // unchanged timestamp
    expect(after["sp-kuxir97-pinch-god"]).toBeDefined(); // new one added
  });
});
