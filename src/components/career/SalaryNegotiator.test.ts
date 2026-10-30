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
    expect(html).toContain(N.zone(formatMoney(talk.zone.floorWeekly), formatMoney(talk.zone.topWeekly)));
    expect(html).toContain(N.shareAsk(9));
    expect(html).not.toContain(N.takeCounter);
  });

  it("under his floor: his counter and the button that takes it, readable before any confirm", () => {
    const at = render();
    const { talk, html } = render({ weekly: at.talk.zone.floorWeekly - 10 });
    expect(talk.accepted).toBe(false);
    expect(html).toContain(N.counter(formatMoney(talk.counter!.weekly), talk.counter!.sharePct));
    expect(html).toContain(N.takeCounter);
  });

  it("each stepper carries its own label; a share point is quoted in weekly money", () => {
    const { talk, html } = render();
    for (const label of [N.wageDown, N.wageUp, N.shareDown, N.shareUp]) expect(html).toContain(`aria-label="${label}"`);
    expect(new Set([N.wageDown, N.wageUp, N.shareDown, N.shareUp]).size).toBe(4);
    expect(html).toContain(N.trade(formatMoney(talk.zone.pointWeekly)));
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
