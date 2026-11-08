import { beforeEach, describe, expect, it } from "vitest";
import { challenges } from "@/data";
import solutionsJson from "@/engine/__fixtures__/challenge-solutions.json";
import type { ChallengeAction } from "@/engine/testing/challengeReplay";
import { useProfileStore } from "./profileStore";
import { useRunStore } from "./runStore";

const solutions = solutionsJson as Record<string, { seed: number; actions: ChallengeAction[] }>;
function play(id: string) {
  useRunStore.getState().startChallenge(id);
  solutions[id].actions.forEach((action, i) => {
    const store = useRunStore.getState();
    if (action.kind === "reroll") store.reroll();
    else if (action.kind === "freeReroll") store.freeReroll();
    else {
      const card = store.run!.draft.offer!.cards.find(c => c.refId === action.refId && c.specialId === action.specialId)!;
      expect(card, id).toBeTruthy();
      store.pickCard(card, action.slot);
    }
    // Persist/reload halfway through: no special cards or RNG cursor vanish.
    if (i === 2) useRunStore.setState({ run: JSON.parse(JSON.stringify(useRunStore.getState().run)) });
  });
  expect(useRunStore.getState().run!.phase).toBe("review");
  useRunStore.getState().startTournament();
  useRunStore.getState().playChallenge();
}
describe("CH-02: solutions through the real store, reload and rewards", () => {
  beforeEach(() => { useProfileStore.getState().resetAll(); useRunStore.setState({ run: null }); });
  for (const ch of challenges) it(`${ch.id}: 3 stars persist; replay/reload never repay them`, () => {
    // Reach the authored gates first, without pre-awarding the target's stars.
    const others = challenges.filter(c => c.id !== ch.id);
    useProfileStore.setState({ xp: 60_000,
      challengesCompleted: Object.fromEntries(others.map(c => [c.id, "2026-11-01"])),
      challengeStars: Object.fromEntries(others.map(c => [c.id, 7])),
    });
    play(ch.id);
    const first = useRunStore.getState().run!.challenge!;
    expect(first).toMatchObject({ evaluated: true, cleared: true, starsEarned: 7, starsNew: 7 });
    const { xp, challengesCompleted, challengeStars } = useProfileStore.getState();
    expect(challengeStars[ch.id]).toBe(7);
    expect(challengesCompleted[ch.id]).toBeTruthy();
    useRunStore.setState({ run: JSON.parse(JSON.stringify(useRunStore.getState().run)) });
    useRunStore.getState().playChallenge();
    expect(useProfileStore.getState().xp).toBe(xp);
    play(ch.id);
    expect(useRunStore.getState().run!.challenge).toMatchObject({ cleared: true, starsEarned: 7, starsNew: 0 });
    expect(useRunStore.getState().run!.challenge!.series).toEqual(first.series);
    expect(useProfileStore.getState().xp).toBe(xp);
    expect(useProfileStore.getState().challengesCompleted).toEqual(challengesCompleted);
  });
});
