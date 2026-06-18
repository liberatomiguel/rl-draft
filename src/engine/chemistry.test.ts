import { describe, expect, it } from "vitest";
import { computeChemistry, type ChemPlayerInput } from "./chemistry";

const player = (
  name: string,
  lineupId: string,
  orgId: string,
  country: string,
  region?: string,
): ChemPlayerInput => ({ name, lineupId, orgId, country, region });

const ORDER = ["Poor", "Okay", "Good", "Great", "Perfect"];
const idx = (tier: string) => ORDER.indexOf(tier);

describe("chemistry (§22, v1.3.1 — Perfect needs real org overlap)", () => {
  it("a real lineup with matching staff and org is Perfect (full bar)", () => {
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

  it("counts only the strongest link per pair (lineup beats org/country)", () => {
    const result = computeChemistry({
      players: [
        player("A", "L1", "O1", "FR"),
        player("B", "L1", "O1", "FR"), // same lineup AND org AND country → only the lineup link
        player("C", "L9", "O9", "US"),
      ],
    });
    expect(result.raw).toBe(4); // one same-lineup pair
  });

  it("shared org (3) now outranks same country (2)", () => {
    const country = computeChemistry({
      players: [
        player("A", "L1", "O1", "BR"),
        player("B", "L2", "O2", "BR"),
        player("C", "L3", "O3", "US"),
      ],
    });
    expect(country.raw).toBe(2); // one same-country pair

    const org = computeChemistry({
      players: [
        player("A", "L1", "O1", "FR"),
        player("B", "L2", "O1", "SE"), // shared org, different country
        player("C", "L3", "O3", "US"),
      ],
    });
    expect(org.raw).toBe(3); // one shared-org pair
  });

  it("a 3-player country stack reaches Good but NOT Perfect", () => {
    const result = computeChemistry({
      players: [
        player("A", "L1", "O1", "BR"),
        player("B", "L2", "O2", "BR"),
        player("C", "L3", "O3", "BR"),
      ],
    });
    expect(idx(result.tier)).toBeGreaterThanOrEqual(idx("Good"));
    expect(result.tier).not.toBe("Perfect");
  });

  it("country + national staff still cannot reach Perfect (no org overlap)", () => {
    const result = computeChemistry({
      players: [
        player("A", "L1", "O1", "BR"),
        player("B", "L2", "O2", "BR"),
        player("C", "L3", "O3", "BR"),
      ],
      coach: { name: "Coach", lineupId: "LX", orgId: "OX", country: "BR" },
      sub: { name: "Sub", lineupId: "LY", orgId: "OY", country: "BR" },
    });
    expect(result.tier).not.toBe("Perfect");
    expect(result.percent).toBeLessThan(100);
  });

  it("org overlap + loyalty climbs toward Perfect", () => {
    const result = computeChemistry({
      players: [
        player("A", "L1", "O1", "BR"),
        player("B", "L2", "O1", "BR"), // shared org O1
        player("C", "L3", "O1", "BR"), // shared org O1
      ],
      orgId: "O1", // all three are org-loyal
      orgName: "Org",
    });
    // 3 shared-org pairs (9) + 3 org-loyalty (4.5) = 13.5 / 15 = 90% → Great
    expect(idx(result.tier)).toBeGreaterThanOrEqual(idx("Great"));
  });

  it("merges a same-country group into a single breakdown line", () => {
    const result = computeChemistry({
      players: [
        player("A", "L1", "O1", "BR"),
        player("B", "L2", "O2", "BR"),
        player("C", "L3", "O3", "BR"),
      ],
    });
    const countryItems = result.items.filter((i) => i.label.startsWith("Same country"));
    expect(countryItems).toHaveLength(1); // one line, not three
    expect(countryItems[0].points).toBe(6); // 3 pairs × 2, summed
    expect(countryItems[0].label).toContain("A · B · C");
  });

  it("same-region is the floor for a mixed-nationality regional roster", () => {
    const result = computeChemistry({
      players: [
        player("A", "L1", "O1", "BR", "SAM"),
        player("B", "L2", "O2", "AR", "SAM"),
        player("C", "L3", "O3", "CL", "SAM"),
      ],
    });
    expect(result.tier).toBe("Okay"); // lifted out of Poor, but modest
  });

  it("an all-star mix with no links is Poor", () => {
    const result = computeChemistry({
      players: [
        player("A", "L1", "O1", "FR", "EU"),
        player("B", "L2", "O2", "US", "NA"),
        player("C", "L3", "O3", "BR", "SAM"),
      ],
    });
    expect(result.raw).toBe(0);
    expect(result.tier).toBe("Poor");
  });
});
