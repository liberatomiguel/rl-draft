import { describe, expect, it } from "vitest";
import { computeChemistry, type ChemPlayerInput } from "./chemistry";

const player = (
  name: string,
  lineupId: string,
  orgId: string,
  country: string,
): ChemPlayerInput => ({ name, lineupId, orgId, country });

describe("chemistry (§22)", () => {
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
    expect(result.raw).toBe(16);
    expect(result.percent).toBe(100);
    expect(result.tier).toBe("Perfect");
  });

  it("counts only the strongest link per pair (lineup beats country/org)", () => {
    const result = computeChemistry({
      players: [
        player("A", "L1", "O1", "FR"),
        player("B", "L1", "O1", "FR"), // same lineup AND country AND org → only +3
        player("C", "L9", "O9", "US"),
      ],
    });
    expect(result.raw).toBe(3);
  });

  it("scores same-country and same-org pairs at ++ and +", () => {
    const country = computeChemistry({
      players: [
        player("A", "L1", "O1", "BR"),
        player("B", "L2", "O2", "BR"),
        player("C", "L3", "O3", "US"),
      ],
    });
    expect(country.raw).toBe(2);

    const org = computeChemistry({
      players: [
        player("A", "L1", "O1", "FR"),
        player("B", "L2", "O1", "SE"),
        player("C", "L3", "O3", "US"),
      ],
    });
    expect(org.raw).toBe(1);
  });

  it("adds org history links per connected player", () => {
    const result = computeChemistry({
      players: [
        player("A", "L1", "O1", "FR"),
        player("B", "L2", "O1", "SE"),
        player("C", "L3", "O3", "US"),
      ],
      orgId: "O1",
      orgName: "Org One",
    });
    // A+B same org (+1) plus two org-history links (+2)
    expect(result.raw).toBe(3);
    expect(result.items.some((i) => i.label.includes("org history"))).toBe(true);
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
