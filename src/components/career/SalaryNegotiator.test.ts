/**
 * rc.33 (ECO-10 + ECO-11) — the contract talk renders the engine's answer,
 * to static markup (node, no DOM). rc.36 (front S2): three groups (your
 * offer, his position, send) and his answer only once the offer is sent —
 * before it the markup is the same whether he would sign or refuse. Every
 * number is the answer's (`contract.negotiationAnswerFor`).
 */

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CAREER_PRIZE_SHARE, CAREER_PRIZES } from "@/config/balance";
import type { CareerCopy } from "@/content/careerCopy";
import { CAREER_EN } from "@/content/copy.career.en";
import { CAREER_PT } from "@/content/copy.career.pt";
import { negotiationAnswerFor, type NegotiationAnswer } from "@/engine/career/contract";
import { formatMoney, formatMoneyDelta } from "@/lib/format";
import { prizeShareLabelOf } from "./careerUi";
import { SalaryNegotiator } from "./SalaryNegotiator";

const N = CAREER_EN.market.negotiation;
type Offer = { weekly?: number; sharePct?: number; bonus?: number };
const sheetOf = (talk: NegotiationAnswer, extra: Partial<Parameters<typeof SalaryNegotiator>[0]> = {}) =>
  renderToStaticMarkup(createElement(SalaryNegotiator, { talk, onChange: () => {}, onSend: () => "signed" as const, ...extra }));
const render = (offer?: Offer, more: { roll?: number; refusals?: number; lengthSeasons?: number; bonus?: number } = {}) => {
  const talk = negotiationAnswerFor({
    ask: { wagePerSplit: 12_000, sharePct: 9, bonus: more.bonus },
    flex: 0.95,
    offer,
    minWagePerSplit: 250,
    roll: more.roll,
    refusals: more.refusals,
    lengthSeasons: more.lengthSeasons,
  });
  return { talk, html: sheetOf(talk) };
};

describe("SalaryNegotiator — rc.36: your offer, his position, send (his answer only once sent)", () => {
  it("at his ask: the three groups, his asking terms, the gauge's marks and a sure chance; no answer before the send", () => {
    const { talk, html } = render();
    expect(talk.accepted).toBe(true);
    for (const text of [N.groupOffer, N.groupPosition, N.send, N.sendHint, N.oddsSure, N.worthTitle, N.shareAsk(9)]) expect(html).toContain(text);
    expect(html).toContain(N.sureFrom(formatMoney(talk.zone.needWorth)));
    expect(html).toContain(N.askMark(formatMoney(talk.zone.askWorth)));
    expect(html).toContain(N.asks(formatMoney(talk.ask.weekly), 9, null));
    // His answer is never on the sheet before an offer is sent.
    expect(html).not.toContain(N.meetPrice);
    expect(html).not.toContain(N.refused(formatMoney(talk.offer.weekly)));
  });

  it("under his floor the sheet shows his chance — the same markup whether he would sign or refuse", () => {
    const at = render();
    const offer = { weekly: at.talk.zone.floorWeekly - 3 * at.talk.zone.stepWeekly };
    const yes = render(offer, { roll: 0 });
    const no = render(offer, { roll: 0.999_999 });
    expect(yes.talk.accepted).toBe(true);
    expect(no.talk.accepted).toBe(false);
    expect(yes.talk.odds).toBeGreaterThan(0);
    expect(yes.talk.odds).toBeLessThan(1);
    expect(yes.html).toContain(`${Math.round(yes.talk.odds * 100)}%`);
    expect(yes.html).toBe(no.html);
  });

  it("each lever carries its own labels and a slider; the chance is a labelled meter; the length is a lever too", () => {
    const { talk } = render(undefined, { bonus: 4_000 });
    const html = sheetOf(talk, { length: { value: 2, options: [1, 2, 3], onChange: () => {} } });
    const labels = [N.wageDown, N.wageUp, N.shareDown, N.shareUp, N.bonusDown, N.bonusUp];
    for (const label of labels) expect(html).toContain(`aria-label="${label}"`);
    expect(new Set(labels).size).toBe(6);
    expect(html.match(/type="range"/g)?.length).toBe(3);
    expect(html).toContain(`role="meter" aria-label="${N.odds}"`);
    expect(html).toContain(N.length);
    expect(html.match(/aria-pressed="true"/g)?.length).toBe(1);
    for (const l of [1, 2, 3] as const) expect(html).toContain(CAREER_EN.market.seasons(l));
  });

  it("what moves his answer: the share, the bonus, the length and his refusals, each with its worth to him", () => {
    const base = render(undefined, { bonus: 4_000, lengthSeasons: 3, refusals: 2 });
    const { talk, html } = render({ weekly: base.talk.zone.floorWeekly - 50, sharePct: 11, bonus: 6_000 }, { bonus: 4_000, lengthSeasons: 3, refusals: 2 });
    expect(talk.effects.share).toBeGreaterThan(0);
    expect(talk.effects.bonus).toBeGreaterThan(0);
    expect(talk.effects.length).toBeGreaterThan(0);
    expect(talk.effects.refusals).toBeLessThan(0);
    expect(html).toContain(N.effectsTitle);
    expect(html).toContain(N.effectShare(2));
    expect(html).toContain(N.effectBonus(formatMoneyDelta(2_000, { compact: true })));
    expect(html).toContain(N.effectLength(3));
    expect(html).toContain(N.effectRefusals(2));
    for (const amount of [talk.effects.share, talk.effects.bonus, talk.effects.length, talk.effects.refusals]) {
      expect(html).toContain(N.effectWeekly(formatMoneyDelta(amount)));
    }
    // At his asking terms nothing is listed.
    expect(render().html).not.toContain(N.effectsTitle);
  });

  it("a closed way names its reason; a blocked offer cannot be sent and says why", () => {
    const { talk, html } = render();
    expect(talk.limits.wageUp).toBe("ask");
    expect(html).toContain(`▲ ${N.why.ask}`);
    const blocked = sheetOf(talk, { blocked: "Not enough money for this deal." });
    expect(blocked).toContain("Not enough money for this deal.");
    expect(blocked).toMatch(/<button[^>]*disabled=""[^>]*>Send offer<\/button>/);
    expect(sheetOf(talk, { onSend: undefined })).not.toContain(N.send);
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
});

describe("rc.34 front I — a closed way says why; no share lever for a player who asks none", () => {
  const sheet = (ask: { wagePerSplit: number; sharePct: number }, flex: number, offer?: { weekly?: number; sharePct?: number }) => {
    const talk = negotiationAnswerFor({ ask, flex, offer, minWagePerSplit: 250 });
    return { talk, html: sheetOf(talk) };
  };

  it("a $100-a-week ask never collapses: the wage '−' is open, the zone has width", () => {
    const { talk, html } = sheet({ wagePerSplit: 1_100, sharePct: 0 }, 1);
    expect(talk.zone.floorWeekly).toBeLessThan(talk.zone.topWeekly);
    expect(html).toMatch(new RegExp(`aria-label="${N.wageDown}"(?![^>]*disabled="")[^>]*>`));
  });

  it("rc.35: a player who asks no share still has the share lever (offering one adds worth); the deal reads without a share", () => {
    const { talk, html } = sheet({ wagePerSplit: 5_600, sharePct: 0 }, 0.97);
    expect(talk.zone.shareLever).toBe(true);
    expect(talk.zone.shareMin).toBe(0);
    expect(talk.zone.shareMax).toBeGreaterThan(0);
    expect(html).toContain(`aria-label="${N.shareUp}"`);
    expect(html).toContain(N.shareAskNone);
    for (const C of [CAREER_EN, CAREER_PT]) {
      expect(prizeShareLabelOf(C as unknown as CareerCopy, { prizeSharePct: 0 })).toBe(C.player.prizeShareNone);
    }
  });

  it("at the league minimum the wage '−' is closed and says so", () => {
    const { talk, html } = sheet({ wagePerSplit: 250, sharePct: 7 }, 0.95);
    expect(talk.limits.wageDown).toBe("minimum");
    expect(html).toContain(`▼ ${N.why.minimum}`);
  });

  it("EN and PT name every reason and every new line of the talk", () => {
    for (const C of [CAREER_EN, CAREER_PT]) {
      const why = C.market.negotiation.why;
      for (const k of Object.keys(CAREER_EN.market.negotiation.why) as (keyof typeof why)[]) expect(why[k], k).toBeTruthy();
      const T = C.market.negotiation;
      expect(T.effectShare(-1)).toContain("1");
      expect(T.asks("$900", 0, null)).not.toContain("%");
      expect(T.refused("$900")).toContain("$900");
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
