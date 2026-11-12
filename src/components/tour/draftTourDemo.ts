/**
 * The fixed draft the first-run tour is shown on (rc.54, Miguel).
 *
 * The tour used to open over the player's real first offer, after its reel had
 * landed. Now it runs first, over this static board, and the real draw (the
 * reel of the run's own first offer) only starts once it is done or skipped.
 *
 * `draftTourDemo(run)` returns a VIEW for the draft screen to render: one
 * hand-picked lineup on offer, an empty team, round 1. It keeps the run's own
 * mode, difficulty and reroll count, so the board has the shape the player is
 * about to play (three slots in Quick, six otherwise).
 *
 * It is pure and it is never saved: no RNG (the engine's `drawNextOffer` is
 * not involved, the cards are the lineup's base cards, no special is rolled),
 * no store, no mutation of the run it is given. The real run, its seed and its
 * RNG cursor are exactly what they were before the tour.
 */

import { coachById, draftableLineups, lineupById, subById } from "@/data";
import { VACANT_COACH, VACANT_SUB } from "@/engine/draft";
import type { DraftOffer, DraftOfferCard, Lineup, RunState } from "@/engine/types";

/** Never a real run id (those come from `uid("run")`). */
export const DRAFT_TOUR_RUN_ID = "tour-demo";

/** The hand-picked lineup: world champions with a coach and a sub, so all six cards show. */
const DEMO_LINEUP_ID = "team-vitality-2223";

/** The demo lineup, or (if a data rebuild ever drops it) the first draftable one with a full bench. */
export function draftTourLineup(): Lineup {
  const picked = lineupById.get(DEMO_LINEUP_ID);
  if (picked && !picked.national && !picked.rareSpawn) return picked;
  return draftableLineups.find((l) => l.coachId && l.subId && !l.rareSpawn) ?? draftableLineups[0];
}

function demoOffer(lineup: Lineup, quick: boolean): DraftOffer {
  const cards: DraftOfferCard[] = lineup.playerCardIds.map((refId) => ({ kind: "player", refId, availability: "available" }));
  if (!quick) {
    const coach = lineup.coachId ? coachById.get(lineup.coachId) : undefined;
    const sub = lineup.subId ? subById.get(lineup.subId) : undefined;
    cards.push(
      coach ? { kind: "coach", refId: coach.id, availability: "available" } : { kind: "coach", refId: VACANT_COACH, availability: "vacant" },
      sub ? { kind: "sub", refId: sub.id, availability: "available" } : { kind: "sub", refId: VACANT_SUB, availability: "vacant" },
      { kind: "org", refId: lineup.orgId, availability: "available" },
    );
  }
  return { lineupId: lineup.id, cards, hasPickableCard: true };
}

/** The static board the tour explains. A new object: `run` is read, never written. */
export function draftTourDemo(run: RunState): RunState {
  const lineup = draftTourLineup();
  return {
    ...run,
    runId: DRAFT_TOUR_RUN_ID,
    // No NEW tags on the demo cards (and no look at the player's collection).
    offerNew: { round: 1, ids: [] },
    draft: {
      ...run.draft,
      round: 1,
      shownLineupIds: [lineup.id],
      takenPersonIds: [],
      roster: {},
      complete: false,
      offer: demoOffer(lineup, run.mode === "quick"),
    },
  };
}
