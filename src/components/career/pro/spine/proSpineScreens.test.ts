/**
 * v2.2 Pro spine (PROSPINE): the screens render for the states a career
 * passes through (a server render, no browser): ranked, an amateur side with
 * a match report, offers on the table, a signed Pro. Catches a throw in a
 * render, which on the phone is a blank screen.
 */
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ProSave } from "@/engine/career/pro/types";
import { newProBotSave, proBotDecide } from "@/store/proBot";
import { advanceProToNextStopFlow, revealProReportFlow } from "@/store/proFlow";
import { ProInbox } from "./ProInbox";
import { ProOffers } from "./ProOffers";
import { ProReport } from "./ProReport";
import { ProTeam } from "./ProTeam";

function renderAll(save: ProSave): string {
  return [ProReport, ProTeam, ProOffers, ProInbox].map((C) => renderToString(createElement(C, { save }))).join("\n");
}

describe("PROSPINE screens", () => {
  it("render through a career's states without throwing", () => {
    let save = newProBotSave("SAM", "normal", 909, 14);
    expect(renderAll(save)).toContain("");
    let sawReport = false;
    let sawOffer = false;
    let sawOrg = false;
    for (let i = 0; i < 900 && !(sawReport && sawOffer && sawOrg); i++) {
      if (save.offers.some((o) => o.status === "open")) {
        sawOffer = true;
        expect(renderAll(save).length).toBeGreaterThan(0);
      }
      save = proBotDecide(save);
      save = advanceProToNextStopFlow(save);
      if (save.report) {
        sawReport = true;
        expect(renderAll(save).length).toBeGreaterThan(0);
        expect(renderAll(revealProReportFlow(save)).length).toBeGreaterThan(0);
      }
      if (save.stage === "org") {
        sawOrg = true;
        expect(renderAll(save)).toContain(save.contract!.orgName);
      }
    }
    expect(sawReport).toBe(true);
    expect(sawOffer).toBe(true);
  }, 600_000);
});
