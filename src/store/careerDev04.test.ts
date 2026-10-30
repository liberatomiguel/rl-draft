/**
 * Road to Worlds — DEV-04 (rc.33) through the flows: the career wizard's
 * founders read the band HQ shows once the career exists.
 *
 * rc.33 review: the wizard drew its own band, max(overall, potential − 5) to
 * potential + 5 — ten points wide and centred on the true potential, so its
 * midpoint gave the truth away and its top read up to five points over it
 * (DEV-04: bands at most 5–6 points wide, never much higher than the truth).
 * It now reads `careerFlow.founderPotentialBandFor`, the engine band
 * (`squadPotentialBand`) at the founders' report level, on day 1.
 */

import { describe, expect, it } from "vitest";
import { CAREER_SCOUT } from "@/config/balance";
import { potBandOfSquad } from "@/components/career/careerUi";
import type { Region } from "@/engine/types";
import { createCareerSave, founderPotentialBandFor, starterOffersForRegion, type CreateCareerInput } from "./careerFlow";

const INPUT: CreateCareerInput = {
  identity: {
    orgName: "Band Test",
    abbrev: "BND",
    managerName: "Bot",
    country: "BR",
    region: "SAM",
    crestId: "shield",
    colors: { primary: "#f97316", secondary: "#fde68a" },
    buffType: "consistency",
  },
  difficulty: "normal",
  rosterKey: "balanced",
};

describe("DEV-04 — the wizard's founders show HQ's band", () => {
  it("each founder's band in the wizard equals his band on HQ after createCareerSave on the same seed", () => {
    let founders = 0;
    let oldBroke = 0;
    for (const seed of [61_001, 61_002]) {
      for (const region of ["SAM", "EU"] as Region[]) {
        const offers = starterOffersForRegion(region, seed);
        for (const offer of offers) {
          const save = createCareerSave(
            { ...INPUT, identity: { ...INPUT.identity, region }, rosterKey: offer.key },
            seed,
          );
          for (const p of offer.players) {
            const squad = save.squad.find((x) => x.id === p.id)!;
            expect(squad, `${seed} ${region} ${offer.key} ${p.id}`).toBeDefined();
            const band = founderPotentialBandFor(p, seed);
            expect(band).toEqual(potBandOfSquad(save, squad));
            // DEV-04: narrow, never much over the truth, and it holds the truth (unless his age caps it).
            expect(band.max - band.min).toBeLessThanOrEqual(CAREER_SCOUT.honestWidthByLevel[0]);
            expect(band.max).toBeLessThanOrEqual(Math.round(p.potential) + CAREER_SCOUT.bandMaxAbove);
            expect(band.min).toBeLessThanOrEqual(Math.round(p.potential));
            founders += 1;
            // The reproduction: the wizard's old band, ±5 around the truth.
            const old = { min: Math.max(Math.round(p.overall), p.potential - 5), max: Math.min(99, p.potential + 5) };
            if (old.max - old.min > 6 || old.max > Math.round(p.potential) + CAREER_SCOUT.bandMaxAbove) oldBroke += 1;
          }
        }
      }
    }
    expect(founders).toBe(2 * 2 * 9);
    expect(oldBroke).toBeGreaterThan(founders / 2);
  });
});
