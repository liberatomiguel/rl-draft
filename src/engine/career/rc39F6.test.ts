/**
 * rc.37 F6 (the package that ships after rc.38.3): regression tests of the
 * rules it adds. R102 chemistry by time and official matches together.
 */
import { describe, expect, it } from "vitest";
import { CAREER_CHEMISTRY } from "@/config/balance";
import type { SquadPlayer } from "./types";
import { careerChemistry } from "./worldSim";

const player = (id: string, splitsTogether: number, region = "EU", country?: string) =>
  ({ id, name: id, region, country, splitsTogether }) as unknown as SquadPlayer;
const trio = (tenure: number, regions: string[], countries: (string | undefined)[] = []) =>
  careerChemistry([0, 1, 2].map((i) => player(`p${i}`, tenure, regions[i], countries[i]))).percent;

describe("R102 — chemistry grows with time together up to 100 %; heritage is only the base", () => {
  const C = CAREER_CHEMISTRY;
  const fastTenure = C.connMaxPerPair / C.connPerSplitTogether;
  const MIXED = ["EU", "NA", "SAM"];
  const SAME = ["EU", "EU", "EU"];

  it("the fast phase is rc.38's: a trio from three regions is at 67 % after two splits, a same-region trio at 92 %", () => {
    expect(trio(0, MIXED)).toBe(0);
    expect(trio(0, SAME)).toBe(25);
    expect(trio(fastTenure, MIXED)).toBe(67);
    expect(trio(fastTenure, SAME)).toBe(92);
  });

  it("past it every trio keeps climbing to 100 %, the one without heritage the slowest", () => {
    const fullMixed = fastTenure + (C.maxRawPerPair - C.connMaxPerPair) / C.bondPerSplitTogether;
    const fullSame = fastTenure + (C.maxRawPerPair - C.connMaxPerPair - C.herRegion) / C.bondPerSplitTogether;
    expect(fullSame).toBeLessThan(fullMixed);
    expect(trio(fullMixed, MIXED)).toBe(100);
    expect(trio(fullSame, SAME)).toBe(100);
    expect(trio(fullSame, MIXED)).toBeLessThan(100);
    let prev = 0;
    for (let t = 0; t <= fullMixed + 2; t += 0.5) {
      const now = trio(t, MIXED);
      expect(now).toBeGreaterThanOrEqual(prev);
      expect(now).toBeLessThanOrEqual(100);
      prev = now;
    }
    expect(prev).toBe(100);
  });

  it("heritage never counts past a full pair, and a newcomer inherits the fast phase only", () => {
    // Two compatriots long together + a newcomer from elsewhere: his pairs start at rc.38's ceiling.
    const veterans = [player("a", 20, "EU", "FR"), player("b", 20, "EU", "FR")];
    const chem = careerChemistry([...veterans, player("c", 0, "NA")]);
    expect(chem.raw).toBeCloseTo(C.maxRawPerPair + 2 * C.connMaxPerPair, 9);
    // ...and from there he bonds like anyone else.
    const later = careerChemistry([...veterans, player("c", 4, "NA")]);
    expect(later.raw).toBeCloseTo(C.maxRawPerPair + 2 * (C.connMaxPerPair + (4 - fastTenure) * C.bondPerSplitTogether), 9);
  });

  it("swapping a starter of a long-standing core now costs chemistry (rc.38: none once the core was old)", () => {
    const core = [player("a", 20, "EU"), player("b", 20, "NA"), player("c", 20, "SAM")];
    const swapped = [core[0], core[1], player("d", 0, "OCE")];
    expect(careerChemistry(core).percent).toBe(100);
    // One new face: 100 % → 78 % (his two pairs at the fast-phase ceiling), then back up with time.
    expect(careerChemistry(swapped).percent).toBe(78);
  });
});

describe("R104 — reputation in proportion to the org", () => {
  it("under 50 the official results pay their base, as in rc.38", async () => {
    const { CAREER_REP } = await import("@/config/balance");
    const { repGainFor } = await import("./economy");
    for (const rep of [5, 24, 25, 49]) {
      for (const kind of ["qualifierAdvance", "regionalTop8", "regionalTop4", "regionalWin", "majorQualify", "majorWin", "worldsQualify"] as const) {
        expect(repGainFor(kind, rep), `${kind} at ${rep}`).toBe(CAREER_REP.gains[kind]);
      }
    }
    // A local cup: full for a newcomer, half (rounded up) one tier up, nothing for a contender.
    expect(repGainFor("t3Final", 10)).toBe(CAREER_REP.gains.t3Final);
    expect(repGainFor("t3Final", 30)).toBe(Math.ceil(CAREER_REP.gains.t3Final / 2));
    expect(repGainFor("t3Final", 55)).toBe(0);
  });

  it("a contender (50–74) still earns from getting through, and is paid whole for titles, Majors and the Worlds", async () => {
    const { CAREER_REP } = await import("@/config/balance");
    const { repGainFor, repTierFor } = await import("./economy");
    const G = CAREER_REP.gains;
    expect(repTierFor(49)).toBe(1);
    expect(repTierFor(50)).toBe(2);
    expect(repTierFor(75)).toBe(3);
    for (const rep of [50, 60, 74]) {
      // One level below: half, rounded up (rc.38 paid the same +1 from 60).
      expect(repGainFor("qualifierAdvance", rep)).toBe(Math.ceil(G.qualifierAdvance / 2));
      expect(repGainFor("regionalTop8", rep)).toBe(Math.ceil(G.regionalTop8 / 2));
      expect(repGainFor("regionalTop4", rep)).toBe(Math.ceil(G.regionalTop4 / 2));
      // rc.38 halved these from 60: a contender now earns them whole.
      expect(repGainFor("regionalWin", rep)).toBe(G.regionalWin);
      expect(repGainFor("majorQualify", rep)).toBe(G.majorQualify);
      expect(repGainFor("majorWin", rep)).toBe(G.majorWin);
      expect(repGainFor("worldsQualify", rep)).toBe(G.worldsQualify);
      expect(repGainFor("worldsTop4", rep)).toBe(G.worldsTop4);
    }
  });

  it("an elite org (75+) needs titles, Majors and the Worlds — and a title never pays zero", async () => {
    const { CAREER_REP } = await import("@/config/balance");
    const { repGainFor } = await import("./economy");
    const G = CAREER_REP.gains;
    expect(repGainFor("qualifierAdvance", 80)).toBe(0);
    expect(repGainFor("regionalTop8", 80)).toBe(0);
    expect(repGainFor("regionalTop4", 80)).toBe(0);
    expect(repGainFor("majorQualify", 80)).toBe(Math.ceil(G.majorQualify / 2));
    expect(repGainFor("regionalWin", 80)).toBe(Math.ceil(G.regionalWin / 2));
    expect(repGainFor("majorTop4", 95)).toBe(G.majorTop4);
    for (const rep of [0, 30, 55, 80, 99]) {
      for (const title of CAREER_REP.proportional.titles) {
        expect(repGainFor(title as keyof typeof G, rep), `${title} at ${rep}`).toBeGreaterThanOrEqual(1);
      }
    }
  });
});
