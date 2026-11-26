/**
 * PROSPINE: a Pro plays in his own region end to end. Two Pros on the same
 * seed, one NA and one EU: each side, host seat, offer and org is his own
 * region's, and the two careers sign for different orgs.
 */
import { describe, expect, it } from "vitest";
import type { Region } from "@/engine/types";
import { newProBotSave, proBotDecide } from "./proBot";
import { advanceProToNextStopFlow, hostOf } from "./proFlow";

function toFirstOrg(region: Region) {
  let save = newProBotSave(region, "easy", 4080, 14);
  const seen = { offerRegions: new Set<string>(), sideRefs: new Set<string>() };
  for (let i = 0; i < 2500 && save.stage !== "org"; i++) {
    for (const o of save.offers) {
      if (o.kind === "org") seen.offerRegions.add(save.world.orgs[o.ref]?.region ?? region);
      if (o.kind === "amateur") seen.sideRefs.add(o.ref);
    }
    save = advanceProToNextStopFlow(proBotDecide(save));
  }
  return { save, seen };
}

describe("PROSPINE: the Pro's region", () => {
  it("same seed, NA and EU: each in his own scene, different orgs", () => {
    const na = toFirstOrg("NA");
    const eu = toFirstOrg("EU");
    for (const [run, region] of [[na, "NA"], [eu, "EU"]] as const) {
      expect(run.save.stage).toBe("org");
      expect(hostOf(run.save)!.identity.region).toBe(region);
      expect(run.save.orgShell?.org.region).toBe(region);
      for (const r of run.seen.offerRegions) expect(r).toBe(region);
      for (const ref of run.seen.sideRefs) expect(ref.startsWith(`local:${region}:`)).toBe(true);
    }
    expect(na.save.contract!.orgRef).not.toBe(eu.save.contract!.orgRef);
  }, 900_000);
});
