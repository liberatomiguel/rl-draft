/**
 * rc.33 (ECO-10 + ECO-11) — the contract talk renders the engine's answer,
 * to static markup (node, no DOM): the zone, the two levers and the result
 * before any confirm — he signs, or his counter with the button that takes
 * it. Every number is the answer's (`contract.negotiationAnswerFor`).
 */

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CAREER_PRIZE_SHARE, CAREER_PRIZES } from "@/config/balance";
import type { CareerCopy } from "@/content/careerCopy";
import { CAREER_EN } from "@/content/copy.career.en";
import { CAREER_PT } from "@/content/copy.career.pt";
import { negotiationAnswerFor } from "@/engine/career/contract";
import { formatMoney } from "@/lib/format";
import { prizeShareLabelOf } from "./careerUi";
import { SalaryNegotiator } from "./SalaryNegotiator";

const N = CAREER_EN.market.negotiation;
const render = (offer?: { weekly?: number; sharePct?: number }) => {
  const talk = negotiationAnswerFor({ ask: { wagePerSplit: 12_000, sharePct: 9 }, flex: 0.95, offer, minWagePerSplit: 250 });
  return { talk, html: renderToStaticMarkup(createElement(SalaryNegotiator, { talk, onChange: () => {} })) };
};

describe("SalaryNegotiator — renders the talk's one answer", () => {
  it("at his ask: he signs, the zone and his share ask are shown, no counter", () => {
    const { talk, html } = render();
    expect(talk.accepted).toBe(true);
    expect(html).toContain(N.signs(formatMoney(talk.terms.weekly), 9));
    expect(html).toContain(N.zoneLegend);
    expect(html).toContain(N.oddsSure);
    expect(html).toContain(N.shareAsk(9));
    expect(html).not.toContain(N.takeCounter);
  });

  it("under his floor: his counter and the button that takes it, readable before any confirm", () => {
    const at = render();
    const { talk, html } = render({ weekly: at.talk.zone.floorWeekly - 10 });
    expect(talk.accepted).toBe(false);
    expect(talk.odds).toBeGreaterThan(0.9);
    expect(html).toContain(`${Math.round(talk.odds * 100)}%`);
    expect(html).toContain(N.refuses(formatMoney(talk.counter!.weekly)));
    expect(html).toContain(N.takeCounter);
  });

  it("each lever carries its own labels and a slider; the odds meter is labelled", () => {
    const { html } = render();
    const labels = [N.wageDown, N.wageUp, N.shareDown, N.shareUp, N.bonusDown, N.bonusUp];
    for (const label of labels) expect(html).toContain(`aria-label="${label}"`);
    expect(new Set(labels).size).toBe(6);
    expect(html.match(/type="range"/g)?.length).toBe(3);
    expect(html).toContain(`role="meter" aria-label="${N.odds}"`);
  });

  it("with the prize share switched off, the share lever is hidden", () => {
    const share = CAREER_PRIZES.playerShare as unknown as { enabled: boolean };
    const was = share.enabled;
    share.enabled = false;
    try {
      const { talk, html } = render({ sharePct: 12 });
      expect(talk.zone.shareLever).toBe(false);
      expect(html).not.toContain(N.shareAsk(9));
      expect(html).not.toContain(`aria-label="${N.shareUp}"`);
      expect(html).toContain(`aria-label="${N.wageDown}"`);
    } finally {
      share.enabled = was;
    }
  });

  it("a bigger share lowers the wage he signs for — the saving is shown", () => {
    const { talk, html } = render({ sharePct: 12 });
    expect(talk.accepted).toBe(true);
    expect(talk.savingWeekly).toBeGreaterThan(0);
    expect(html).toContain(N.saves(formatMoney(talk.savingWeekly)));
    expect(html).toContain("12%");
  });
});

describe("rc.34 front I — a closed way says why; no share lever for a player who asks none", () => {
  const sheet = (ask: { wagePerSplit: number; sharePct: number }, flex: number, offer?: { weekly?: number; sharePct?: number }) => {
    const talk = negotiationAnswerFor({ ask, flex, offer, minWagePerSplit: 250 });
    return { talk, html: renderToStaticMarkup(createElement(SalaryNegotiator, { talk, onChange: () => {} })) };
  };

  it("a $100-a-week ask never collapses: the wage '−' is open, the zone has width", () => {
    const { talk, html } = sheet({ wagePerSplit: 1_100, sharePct: 0 }, 1);
    expect(talk.zone.floorWeekly).toBeLessThan(talk.zone.topWeekly);
    expect(html).toMatch(new RegExp(`aria-label="${N.wageDown}"(?![^>]*disabled="")[^>]*>`));
  });

  it("rc.35: a player who asks no share still has the share lever (offering one buys wage); the deal reads without a share", () => {
    const { talk, html } = sheet({ wagePerSplit: 5_600, sharePct: 0 }, 0.97);
    expect(talk.zone.shareLever).toBe(true);
    expect(talk.zone.shareMin).toBe(0);
    expect(talk.zone.shareMax).toBeGreaterThan(0);
    expect(html).toContain(`aria-label="${N.shareUp}"`);
    expect(html).toContain(N.shareAskNone);
    expect(html).toContain(N.signsNoShare(formatMoney(talk.terms.weekly)));
    for (const C of [CAREER_EN, CAREER_PT]) {
      expect(prizeShareLabelOf(C as unknown as CareerCopy, { prizeSharePct: 0 })).toBe(C.player.prizeShareNone);
    }
  });

  it("at the league minimum the wage '−' is closed", () => {
    const { talk } = sheet({ wagePerSplit: 250, sharePct: 7 }, 0.95);
    expect(talk.limits.wageDown).toBe("minimum");
  });

  it("EN and PT name every reason", () => {
    for (const C of [CAREER_EN, CAREER_PT]) {
      const why = C.market.negotiation.why;
      for (const k of Object.keys(CAREER_EN.market.negotiation.why) as (keyof typeof why)[]) expect(why[k], k).toBeTruthy();
    }
  });
});

describe("the contract's share label (rc.33 review)", () => {
  it("an older deal names the seats the old team share is split over (CAREER_PRIZE_SHARE.legacySeats), EN and PT", () => {
    const seats = CAREER_PRIZE_SHARE as unknown as { legacySeats: number };
    const was = seats.legacySeats;
    seats.legacySeats = 4;
    try {
      const en = prizeShareLabelOf(CAREER_EN as unknown as CareerCopy, {});
      const pt = prizeShareLabelOf(CAREER_PT, {});
      expect(en).toContain("split 4 ways");
      expect(pt).toContain("divididos por 4");
      expect(en).not.toContain("a third");
      expect(pt).not.toContain("um terço");
    } finally {
      seats.legacySeats = was;
    }
    expect(prizeShareLabelOf(CAREER_PT, { prizeSharePct: 7 })).toBe(CAREER_PT.player.prizeSharePct(7));
  });
});
