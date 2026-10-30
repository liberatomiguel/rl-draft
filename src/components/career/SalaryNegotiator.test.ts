/**
 * rc.33 (ECO-10 + ECO-11) — the contract talk renders the engine's answer,
 * to static markup (node, no DOM): the zone, the two levers and the result
 * before any confirm — he signs, or his counter with the button that takes
 * it. Every number is the answer's (`contract.negotiationAnswerFor`).
 */

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CAREER_EN } from "@/content/copy.career.en";
import { negotiationAnswerFor } from "@/engine/career/contract";
import { formatMoney } from "@/lib/format";
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

  it("a bigger share lowers the wage he signs for — the saving is shown", () => {
    const { talk, html } = render({ sharePct: 12 });
    expect(talk.accepted).toBe(true);
    expect(talk.savingWeekly).toBeGreaterThan(0);
    expect(html).toContain(N.saves(formatMoney(talk.savingWeekly)));
    expect(html).toContain("12%");
  });
});
