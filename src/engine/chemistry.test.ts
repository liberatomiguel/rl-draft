import { describe, expect, it } from "vitest";
import { computeChemistry, type ChemPlayerInput } from "./chemistry";

const player = (
  name: string,
  lineupId: string,
  orgId: string,
  country: string,
): ChemPlayerInput => ({ name, lineupId, orgId, country });

const ORDER = ["Poor", "Okay", "Good", "Great", "Perfect"];
const atLeast = (tier: string, floor: string) =>
  expect(ORDER.indexOf(tier)).toBeGreaterThanOrEqual(ORDER.indexOf(floor));

describe("chemistry (§22, v1.2.0 rework — generous + reachable)", () => {
  it("full same-lineup roster with matching staff and org is Perfect", () => {
    const result = computeChemistry({
      players: [
        player("A", "L1", "O1", "FR"),
        player("B", "L1", "O1", "FR"),
        player("C", "L1", "O1", "FR"),
      ],
      coach: { name: "Coach", lineupId: "L1", orgId: "O1" },
      sub: { name: "Sub", lineupId: "L1", orgId: "O1" },
      orgId: "O1",
      orgName: "Org",
    });
    expect(result.percent).toBe(100);
    expect(result.tier).toBe("Perfect");
  });

  it("counts only the strongest link per pair (lineup beats country/org)", () => {
    const result = computeChemistry({
      players: [
        player("A", "L1", "O1", "FR"),
        player("B", "L1", "O1", "FR"), // same lineup AND country AND org → only the lineup link
        player("C", "L9", "O9", "US"),
      ],
    });
    expect(result.raw).toBe(4); // one same-lineup pair
  });

  it("scores same-country (3) and same-org (2) pairs", () => {
    const country = computeChemistry({
      players: [
        player("A", "L1", "O1", "BR"),
        player("B", "L2", "O2", "BR"),
        player("C", "L3", "O3", "US"),
      ],
    });
    expect(country.raw).toBe(3);

    const org = computeChemistry({
      players: [
        player("A", "L1", "O1", "FR"),
        player("B", "L2", "O1", "SE"),
        player("C", "L3", "O3", "US"),
      ],
    });
    expect(org.raw).toBe(2);
  });

  it("a 3-player country stack reaches Perfect — the achievable strategic payoff", () => {
    const result = computeChemistry({
      players: [
        player("A", "L1", "O1", "BR"),
        player("B", "L2", "O2", "BR"),
        player("C", "L3", "O3", "BR"),
      ],
    });
    // v1.2.1: 9 raw = 75% now clears the Perfect floor (72), so MAX chemistry is
    // reachable by a committed-but-buildable roster.
    atLeast(result.tier, "Perfect");
  });

  it("two linked players plus an org tie reach Good", () => {
    const result = computeChemistry({
      players: [
        player("A", "L1", "O1", "BR"),
        player("B", "L2", "O2", "BR"),
        player("C", "L3", "O3", "US"),
      ],
      orgId: "O1",
      orgName: "Org",
    });
    atLeast(result.tier, "Good");
  });

  it("an all-star mix with no links is Poor", () => {
    const result = computeChemistry({
      players: [
        player("A", "L1", "O1", "FR"),
        player("B", "L2", "O2", "US"),
        player("C", "L3", "O3", "BR"),
      ],
    });
    expect(result.raw).toBe(0);
    expect(result.tier).toBe("Poor");
  });
});
