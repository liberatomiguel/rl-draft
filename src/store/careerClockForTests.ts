/**
 * Road to Worlds — TEST SUPPORT ONLY (rc.34): imported by test files, never
 * by the app (`careerDecisions.test.ts` checks it).
 *
 * rc.34's decision queue (UX-01a, `careerDecisions.ts`) holds the clock on
 * what rc.33's clock walked past: an accepted Community Cup's matchday
 * (walking past declined it), an incoming bid (it expired after its last
 * day) and the sponsor offers (they stood). A fresh invite holds nothing
 * (rc.34 review, Gate 3b): walked past its matchday, it is passed. Suites
 * written against rc.33's walk that test something else — the weekend, the
 * race, the money — answer those the way the walk did and then move through
 * the REAL `advanceDayFlow`: `walkPastForTests` before each step,
 * or `stepDayForTests` for both. The holds rc.33 already had (the insert, a
 * short squad's eve, an official matchday) are left alone. rc.36 (SUN-01):
 * the Saturday evening before the user's Sunday holds until Sunday is
 * started — the walk starts it with the default briefing (rc.35's clock
 * walked straight into Sunday; the next step is that day).
 */

import type { CareerSave } from "@/engine/career/types";
import { acknowledgeMoneyNoticeFlow, advanceDayFlow, declineBidFlow } from "./careerFlow";
import { declineSponsorOffersFlow, parkDecisionFlow, pendingDecisionsOf } from "./careerDecisions";
import { recordSundayBriefingFlow } from "./careerSunday";

export function walkPastForTests(input: CareerSave): CareerSave {
  let save = input;
  for (const d of pendingDecisionsOf(input)) {
    if (!d.holds) continue;
    if (d.kind === "event") {
      const def = save.pendingEventDef;
      if (!save.activeEvent && def && def.day === save.clock.day && (def.tier === "t2" || def.tier === "t3")) {
        save = { ...save, pendingEventDef: null, unofficialOffer: null };
      }
    } else if (d.kind === "bid") {
      save = d.canWait ? parkDecisionFlow(save, d.id).save : declineBidFlow(save, d.id);
    } else if (d.kind === "sponsor") {
      save = d.canWait ? parkDecisionFlow(save, d.id).save : declineSponsorOffersFlow(save).save;
    } else if (d.kind === "notice") {
      // rc.34 (front H): the money modal's "OK".
      save = acknowledgeMoneyNoticeFlow(save, d.id);
    } else if (d.kind === "sunday") {
      // rc.36 (SUN-01): Sunday started with the default briefing (the clock move is the next step).
      save = recordSundayBriefingFlow(save).save;
    }
  }
  return save;
}

/** One day through the real clock, rc.33's walk-past answers first. */
export function stepDayForTests(save: CareerSave): CareerSave {
  return advanceDayFlow(walkPastForTests(save));
}
