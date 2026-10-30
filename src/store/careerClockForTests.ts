/**
 * Road to Worlds — TEST SUPPORT ONLY (rc.34): imported by test files, never
 * by the app (`careerDecisions.test.ts` checks it).
 *
 * rc.34's decision queue (UX-01a, `careerDecisions.ts`) holds the clock on
 * what rc.33's clock walked past: an accepted Community Cup's matchday
 * (walking past declined it), a fresh invite (it stood until Monday), an
 * incoming bid (it expired after its last day) and the sponsor offers (they
 * stood). Suites written against rc.33's walk that test something else — the
 * weekend, the race, the money — answer those the way the walk did and then
 * move through the REAL `advanceDayFlow`: `walkPastForTests` before each step,
 * or `stepDayForTests` for both. The holds rc.33 already had (the insert, a
 * short squad's eve, an official matchday) are left alone.
 */

import type { CareerSave } from "@/engine/career/types";
import { acknowledgeMoneyNoticeFlow, advanceDayFlow, declineBidFlow } from "./careerFlow";
import { declineSponsorOffersFlow, parkDecisionFlow, pendingDecisionsOf } from "./careerDecisions";

export function walkPastForTests(input: CareerSave): CareerSave {
  let save = input;
  for (const d of pendingDecisionsOf(input)) {
    if (!d.holds) continue;
    if (d.kind === "event") {
      const def = save.pendingEventDef;
      if (!save.activeEvent && def && def.day === save.clock.day && (def.tier === "t2" || def.tier === "t3")) {
        save = { ...save, pendingEventDef: null, unofficialOffer: null };
      }
    } else if (d.kind === "invite") {
      save = { ...save, unofficialOffer: null };
    } else if (d.kind === "bid") {
      save = d.canWait ? parkDecisionFlow(save, d.id).save : declineBidFlow(save, d.id);
    } else if (d.kind === "sponsor") {
      save = d.canWait ? parkDecisionFlow(save, d.id).save : declineSponsorOffersFlow(save).save;
    } else if (d.kind === "notice") {
      // rc.34 (front H): the money modal's "OK".
      save = acknowledgeMoneyNoticeFlow(save, d.id);
    }
  }
  return save;
}

/** One day through the real clock, rc.33's walk-past answers first. */
export function stepDayForTests(save: CareerSave): CareerSave {
  return advanceDayFlow(walkPastForTests(save));
}
