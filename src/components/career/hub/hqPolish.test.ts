/**
 * rc.36 (ROADMAP POL-02, Miguel's rc.35 playtest; R84): HQ's squad, finance
 * and progression blocks, rendered. The starters stay Draft cards while the
 * reserve and the coach are thin rows again (rc.33's shape); the finance
 * block prints only the balance, the weekly out, the chart, and the
 * next-payroll and runway lines (no debt, even with a loan); the progression
 * card shows the latest reached rung and its neighbors, shares one footer
 * row between "See more" and Finances, and keeps a three-rung track.
 */

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CAREER_CALENDAR } from "@/config/balance";
import { CAREER_EN } from "@/content/copy.career.en";
import { CAREER_PT } from "@/content/copy.career.pt";
import { baseRarityOf } from "@/engine/cards";
import { firstDayOfWeek } from "@/engine/career/calendar";
import { coachEffectsFor } from "@/engine/career/development";
import type { CareerSave, CoachState } from "@/engine/career/types";
import { createCareerSave, takeBankLoanFlow, type CreateCareerInput } from "@/store/careerFlow";
import { hqFinanceOf } from "@/store/careerHq";
import { userTeamPreview } from "@/components/career/careerUi";
import { FinanceBlock } from "./FinanceBlock";
import { SquadBlock } from "./SquadBlock";
import { ToolboxBlock } from "./ToolboxBlock";

const INPUT: CreateCareerInput = {
  identity: {
    orgName: "Polish Org",
    abbrev: "POL",
    managerName: "Bot",
    country: "BR",
    region: "SAM",
    crestId: "shield:wolf",
    colors: { primary: "#1d4ed8", secondary: "#fde68a" },
    buffType: "consistency",
  },
  difficulty: "normal",
  style: "balanced",
  rosterKey: "balanced",
};

function fresh(seed = 36_202): CareerSave {
  const save = createCareerSave(INPUT, seed);
  for (let s = 0; s < 2; s++) for (let w = 1; w <= CAREER_CALENDAR.weeksPerSeason; w++) save.flags[`insertRolled:${s}:${w}`] = true;
  save.sponsorOffers = null;
  return save;
}

const COACH: CoachState = {
  id: "coach:polish",
  name: "Coach Polish",
  overall: 78,
  bonusType: "offense",
  bonusLevel: "B",
  salaryPerSplit: 2_000,
  source: "generated",
};

/** A save with a reserve (contract in its final stretch) and a coach. */
function withBench(): CareerSave {
  const save = fresh();
  save.clock = { seasonIndex: 0, day: firstDayOfWeek(26) };
  save.squad.push({ ...structuredClone(save.squad[0]), id: "fic:SAM:bench", name: "Benchwarmer", overall: 81.2, role: "sub", contractEndSeason: 0 });
  save.coach = COACH;
  return save;
}

const squadHtml = (save: CareerSave) =>
  renderToStaticMarkup(createElement(SquadBlock, { save, C: CAREER_EN, team: userTeamPreview(save), chemTiers: {} }));

describe("rc.36 POL-02 — HQ squad: the reserve and the coach thin again", () => {
  it("the starters stay Draft cards; the reserve is a thin row with his rarity frame, role and contract", () => {
    const save = withBench();
    const html = squadHtml(save);
    // Three cards only (the starters): the reserve is no longer a card.
    expect(html.split("card-frame flex min-h-60").length - 1).toBe(3);
    // His OVR in the Draft's rarity frame (decision 3-A), his name, role and contract clock.
    expect(baseRarityOf(81)).toBe("gold");
    expect(html).toContain("card-frame flex h-10 w-10 shrink-0 items-center justify-center !rounded-lg card-gold");
    expect(html).toContain("Benchwarmer");
    expect(html).toContain(CAREER_EN.hub.cardReserve);
    expect(html).toContain(CAREER_EN.hub.cardEndsIn(7));
  });

  it("the coach is a thin row: name, OVR and his training edge, linking to Training", () => {
    const html = squadHtml(withBench());
    expect(html).toContain("Coach Polish");
    expect(html).toContain(CAREER_EN.hub.coachTrainingPct(coachEffectsFor(COACH).trainingPct));
    expect(html).toContain('href="/career/training"');
  });

  it("an empty reserve or coach seat is a dashed row with the way to fill it", () => {
    const save = fresh();
    save.coach = null;
    const html = squadHtml(save);
    expect(save.squad.filter((p) => !save.starterIds.includes(p.id))).toHaveLength(0);
    expect(html).toContain(CAREER_EN.hub.squadNoSub);
    expect(html).toContain(CAREER_EN.hub.cardSignHint);
    expect(html).toContain(CAREER_EN.hub.squadNoCoach);
    expect(html).toContain('href="/career/market#coaches"');
  });
});

describe("rc.36 POL-02 — HQ finances: the balance, the weekly out, the chart, the payroll and runway lines", () => {
  it("prints those figures and no debt, even while a bank loan is owed", () => {
    const loaned = takeBankLoanFlow(fresh(), 3_000);
    expect(loaned.error).toBeUndefined();
    const save = loaned.save;
    expect(save.finances.bankLoan).toBeTruthy();
    const f = hqFinanceOf(save);
    const html = renderToStaticMarkup(createElement(FinanceBlock, { save, C: CAREER_EN }));
    expect(html).toContain(CAREER_EN.hub.financesTitle);
    expect(html).toContain(CAREER_EN.hub.financePayroll);
    expect(html).toContain(CAREER_EN.hub.financeRunway);
    expect(html).toContain(f.runway === null ? CAREER_EN.hub.financeRunwayOk : CAREER_EN.hub.financeRunwayWeeks(f.runway));
    expect(html).toContain(CAREER_EN.finances.chartOpen);
    // No debt tile and no loan badge: the emergency / bank loan keeps its own HQ card.
    expect(html).not.toContain(CAREER_EN.finances.bankTitle);
    expect(html).not.toContain(CAREER_EN.finances.backer);
    expect(html).not.toMatch(/>Debt</);
  });

  it("the runway line's words exist in EN and PT", () => {
    for (const C of [CAREER_EN, CAREER_PT]) {
      expect(C.hub.financeRunwayWeeks(1)).toMatch(/1/);
      expect(C.hub.financeRunwayWeeks(9)).toMatch(/9/);
      expect(C.hub.financeRunwayOk.length).toBeGreaterThan(0);
      expect(C.toolbox.unlockNote.length).toBeGreaterThan(0);
    }
  });
});

describe("rc.36 POL-02 — the progression card: three item rows and next unlock below", () => {
  it("shows neighbors of the latest unlock, including when earlier gear is still unbought", () => {
    const save = fresh();
    save.reputation = 22; // peripherals, monitors and PCs open
    const html = renderToStaticMarkup(createElement(ToolboxBlock, { save, C: CAREER_EN }));
    for (const name of [CAREER_EN.finances.gear.monitors, CAREER_EN.finances.gear.pcs, CAREER_EN.ladder.rung.exProCoach]) expect(html).toContain(name);
    expect(html).not.toContain(`>${CAREER_EN.finances.gear.peripherals}</button>`);
    expect(html.match(/<li class="flex min-h-16/g)).toHaveLength(3);
    expect(html).not.toContain("grid grid-cols-2 gap-2");
    expect(html).toContain(CAREER_EN.ladder.seeMore);
    expect(html).toContain('href="/career/finances"');
    expect(html).toContain(CAREER_EN.toolbox.buy);
    expect(html.indexOf(CAREER_EN.ladder.next)).toBeGreaterThan(html.indexOf(CAREER_EN.finances.gear.pcs));
  });
  it("keeps the final three rungs visible at the top of the ladder", () => {
    const save = fresh();
    save.reputation = 100;
    const html = renderToStaticMarkup(createElement(ToolboxBlock, { save, C: CAREER_EN }));
    for (const name of [CAREER_EN.ladder.rung.sponsors3, CAREER_EN.finances.gear.perfCenter, CAREER_EN.ladder.rung.sponsors4]) expect(html).toContain(name);
    expect(html).not.toContain(`>${CAREER_EN.finances.gear.peripherals}</button>`);
    expect(html.match(/<li class="flex min-h-16/g)).toHaveLength(3);
    expect(html).toContain(CAREER_EN.ladder.top);
  });
});
