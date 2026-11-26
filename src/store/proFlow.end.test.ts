/**
 * v2.2 Pro spine round 2 (PROSPINE): the end of a career. The season's
 * rollover runs the player's own (aging, the end by age), retiring by choice
 * leaves the team, and the card's payload round-trips with what he holds.
 */
import { describe, expect, it } from "vitest";
import { CAREER_PRO_AGING } from "@/config/balance";
import { decodeCard } from "@/engine/career/pro/card";
import { proRosterCount } from "@/engine/career/pro/offers";
import type { ProSave } from "@/engine/career/pro/types";
import { newProBotSave } from "./proBot";
import { advanceProToNextStopFlow, canRetireProNow, hostOf, proCardHrefOf, proCardOf, proStopOf, retireProFlow } from "./proFlow";

function toSeasonEnd(save: ProSave): ProSave {
  let s = save;
  for (let i = 0; i < 400 && proStopOf(s)?.kind !== "seasonEnd"; i++) s = advanceProToNextStopFlow(s);
  return s;
}

describe("PROSPINE the end", () => {
  it("the forced age ends the career at the rollover, with a season line and a card", () => {
    let save = newProBotSave("EU", "normal", 812, 14);
    // An old Pro: he turns the forced age with the next season.
    save = { ...save, player: { ...save.player, birthYear: save.player.birthYear - (CAREER_PRO_AGING.retireForcedAge - 15) } };
    save = toSeasonEnd(save);
    expect(proStopOf(save)?.kind).toBe("seasonEnd");
    save = advanceProToNextStopFlow(save);
    expect(save.stage).toBe("retired");
    expect(save.bridge?.to).toBe("legend");
    expect(save.history.length).toBe(1);
    expect(save.history[0].role).toBeDefined();
    expect(proRosterCount(save.world)).toBe(0);
    expect(hostOf(save)!.squad.map((p) => p.id)).toEqual(["pro:self"]);
    // The gala ran at the season's end: every honour is his and named by kind and scope.
    for (const h of save.honors as { kind: string; scope: string; place: string }[]) expect(["winner", "nominee"]).toContain(h.place);
    expect(proCardOf(save).awards.every((k) => /^(mvp|breakout|teamOfSeason|mostDecisive)\.(region|world)\.\d{4}$/.test(k))).toBe(true);
    const payload = proCardHrefOf(save).split("#")[1];
    expect(decodeCard(payload)).toEqual(proCardOf(save));
    // A retired save does not move (the hub shows the card instead of Advance).
    expect(advanceProToNextStopFlow(save).clock).toEqual(save.clock);
  }, 300_000);

  it("retiring by choice is open from the choice age, leaves the side and keeps what he earned", () => {
    let save = newProBotSave("NA", "normal", 813, 14);
    expect(canRetireProNow(save)).toBe(false);
    expect(retireProFlow(save)).toBe(save);
    save = { ...save, player: { ...save.player, birthYear: save.player.birthYear - (CAREER_PRO_AGING.choiceMinAge - 14), money: 1234 } };
    expect(canRetireProNow(save)).toBe(true);
    const out = retireProFlow(save);
    expect(out.stage).toBe("retired");
    expect(out.player.money).toBe(1234);
    expect(out.history.length).toBe(save.history.length + 1);
  });
});
