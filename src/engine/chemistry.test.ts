import { describe, expect, it } from "vitest";
import { computeChemistry, type ChemPlayerInput } from "./chemistry";

const player = (
  name: string,
  lineupId: string,
  orgId: string,
  country: string,
  region?: string,
): ChemPlayerInput => ({ name, lineupId, orgId, country, region });

describe("chemistry (§22, v1.4 ADDITIVE — connection + heritage stack)", () => {
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

  it("connection and heritage STACK per pair (additive, v1.4)", () => {
    // A & B share an org (current) AND a country → both axes count: 2.5 + 2.5 = 5.
    const result = computeChemistry({
      players: [
        player("A", "L1", "O1", "BR"),
        player("B", "L2", "O1", "BR"), // same org + same country as A
        player("C", "L3", "O9", "US"),
      ],
    });
    expect(result.raw).toBe(5); // connOrg 2.5 + herCountry 2.5
    expect(result.items.some((i) => i.label.startsWith("Shared org"))).toBe(true);
    expect(result.items.some((i) => i.label.startsWith("Same country"))).toBe(true);
  });

  it("a lone same-country pair and a lone shared-org pair each score 2.5", () => {
    const country = computeChemistry({
      players: [
        player("A", "L1", "O1", "BR"),
        player("B", "L2", "O2", "BR"),
        player("C", "L3", "O3", "US"),
      ],
    });
    expect(country.raw).toBe(2.5); // one same-country pair (heritage only)

    const org = computeChemistry({
      players: [
        player("A", "L1", "O1", "FR"),
        player("B", "L2", "O1", "SE"), // shared org, different country
        player("C", "L3", "O3", "US"),
      ],
    });
    expect(org.raw).toBe(2.5); // one shared-org pair (connection only)
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

  it("3 same-country + shared org history reaches Perfect (v1.4: org now stacks)", () => {
    // The v1.4 fix: players who also crossed paths at an org get that bond ON TOP of
    // country — country (7.5) + shared-org (7.5) = full bar.
    const result = computeChemistry({
      players: [
        { name: "A", lineupId: "L1", orgId: "O1", country: "BR", careerOrgIds: ["O1", "OZ"] },
        { name: "B", lineupId: "L2", orgId: "O2", country: "BR", careerOrgIds: ["O2", "OZ"] },
        { name: "C", lineupId: "L3", orgId: "O3", country: "BR", careerOrgIds: ["O3", "OZ"] },
      ],
    });
    expect(result.tier).toBe("Perfect");
    expect(result.items.some((i) => i.label.startsWith("Same country"))).toBe(true);
    expect(result.items.some((i) => i.label.startsWith("Shared org"))).toBe(true);
  });

  it("3 same-country + same-country STAFF still falls short of Perfect (needs a real connection)", () => {
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
    expect(countryItems[0].points).toBe(7.5); // 3 pairs × 2.5, summed
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
    expect(result.raw).toBe(3); // connTeammates (no heritage link between A & B)
    expect(result.items.some((i) => i.label.startsWith("Ex-teammates"))).toBe(true);
  });

  it("shared career org connects two players of different countries", () => {
    const result = computeChemistry({
      players: [
        { name: "A", lineupId: "L1", orgId: "O1", country: "FR", careerOrgIds: ["O1", "OZ"] },
        { name: "B", lineupId: "L2", orgId: "O2", country: "US", careerOrgIds: ["O2", "OZ"] },
        { name: "C", lineupId: "L3", orgId: "O3", country: "BR" },
      ],
    });
    expect(result.raw).toBe(2.5); // connOrg (no heritage link between A & B)
    expect(result.items.some((i) => i.label.startsWith("Shared org"))).toBe(true);
  });

  it("within an axis only the STRONGEST form counts (no double-count of one relationship)", () => {
    // A & B were teammates (L9) AND share a career org (OZ) — same underlying history,
    // so the connection axis counts ex-teammates (3) only, NOT 3 + 2.5.
    const result = computeChemistry({
      players: [
        { name: "A", lineupId: "L1", orgId: "O1", country: "US", careerLineupIds: ["L1", "L9"], careerOrgIds: ["O1", "OZ"] },
        { name: "B", lineupId: "L2", orgId: "O2", country: "BR", careerLineupIds: ["L2", "L9"], careerOrgIds: ["O2", "OZ"] },
        { name: "C", lineupId: "L3", orgId: "O3", country: "FR" },
      ],
    });
    expect(result.raw).toBe(3); // ex-teammates only (different countries → no heritage)
    expect(result.items.some((i) => i.label.startsWith("Ex-teammates"))).toBe(true);
    expect(result.items.some((i) => i.label.startsWith("Shared org"))).toBe(false);
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
