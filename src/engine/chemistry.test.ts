import { describe, expect, it } from "vitest";
import { computeChemistry, type ChemPlayerInput } from "./chemistry";

const player = (
  name: string,
  lineupId: string,
  orgId: string,
  country: string,
  region?: string,
): ChemPlayerInput => ({ name, lineupId, orgId, country, region });

describe("chemistry (§22, v1.3.2 — 3 country = Great, +1 org = Perfect)", () => {
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

  it("a shared-org pair and a same-country pair each score 3", () => {
    const country = computeChemistry({
      players: [
        player("A", "L1", "O1", "BR"),
        player("B", "L2", "O2", "BR"),
        player("C", "L3", "O3", "US"),
      ],
    });
    expect(country.raw).toBe(3); // one same-country pair

    const org = computeChemistry({
      players: [
        player("A", "L1", "O1", "FR"),
        player("B", "L2", "O1", "SE"), // shared org, different country
        player("C", "L3", "O3", "US"),
      ],
    });
    expect(org.raw).toBe(3); // one shared-org pair
  });

  it("3 same-country players reach Great (but not Perfect)", () => {
    const result = computeChemistry({
      players: [
        player("A", "L1", "O1", "BR"),
        player("B", "L2", "O2", "BR"),
        player("C", "L3", "O3", "BR"),
      ],
    });
    expect(result.tier).toBe("Great");
    expect(result.percent).toBeLessThan(100);
  });

  it("3 same-country + ONE org connection reaches Perfect", () => {
    const result = computeChemistry({
      players: [
        player("A", "L1", "O1", "BR"),
        player("B", "L2", "O2", "BR"),
        player("C", "L3", "O3", "BR"),
      ],
      orgId: "O1", // drafting A's org adds org-loyalty → completes the bar
      orgName: "Org",
    });
    expect(result.tier).toBe("Perfect");
  });

  it("3 same-country + same-country STAFF still falls short of Perfect (needs org)", () => {
    const result = computeChemistry({
      players: [
        player("A", "L1", "O1", "BR"),
        player("B", "L2", "O2", "BR"),
        player("C", "L3", "O3", "BR"),
      ],
      coach: { name: "Coach", lineupId: "LX", orgId: "OX", country: "BR" },
      sub: { name: "Sub", lineupId: "LY", orgId: "OY", country: "BR" },
    });
    expect(result.tier).toBe("Great");
    expect(result.percent).toBeLessThan(100);
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
    expect(countryItems[0].points).toBe(9); // 3 pairs × 3, summed
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
    expect(result.tier).toBe("Good"); // lifted out of Poor by region links
  });

  it("ex-teammates (shared career lineup) link even with different drafted cards", () => {
    // A and B drafted different cards/orgs/countries, but both were once on L9.
    const result = computeChemistry({
      players: [
        { name: "A", lineupId: "L1", orgId: "O1", country: "BR", careerLineupIds: ["L1", "L9"] },
        { name: "B", lineupId: "L2", orgId: "O2", country: "AR", careerLineupIds: ["L2", "L9"] },
        { name: "C", lineupId: "L3", orgId: "O3", country: "US" },
      ],
    });
    expect(result.raw).toBe(3); // careerLineupPair
    expect(result.items.some((i) => i.label.startsWith("Ex-teammates"))).toBe(true);
  });

  it("shared career org is a weak link, below country and ex-teammates", () => {
    const result = computeChemistry({
      players: [
        { name: "A", lineupId: "L1", orgId: "O1", country: "FR", careerOrgIds: ["O1", "OZ"] },
        { name: "B", lineupId: "L2", orgId: "O2", country: "US", careerOrgIds: ["O2", "OZ"] },
        { name: "C", lineupId: "L3", orgId: "O3", country: "BR" },
      ],
    });
    expect(result.raw).toBe(2); // careerOrgPair (no country/region link between A & B)
    expect(result.items.some((i) => i.label.startsWith("Shared org history"))).toBe(true);
  });

  it("career links never inflate a same-country stack past Great", () => {
    // 3 Brazilians who also crossed paths in careers: country wins per pair (3),
    // career links do NOT stack on top — still Great, not Perfect.
    const result = computeChemistry({
      players: [
        { name: "A", lineupId: "L1", orgId: "O1", country: "BR", careerLineupIds: ["L1", "LZ"], careerOrgIds: ["O1", "OZ"] },
        { name: "B", lineupId: "L2", orgId: "O2", country: "BR", careerLineupIds: ["L2", "LZ"], careerOrgIds: ["O2", "OZ"] },
        { name: "C", lineupId: "L3", orgId: "O3", country: "BR", careerLineupIds: ["L3", "LZ"], careerOrgIds: ["O3", "OZ"] },
      ],
    });
    // Each pair shares career lineup LZ (3) which ties/oudranks country (3) → 3×3=9.
    expect(result.tier).toBe("Great");
    expect(result.percent).toBeLessThan(100);
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
