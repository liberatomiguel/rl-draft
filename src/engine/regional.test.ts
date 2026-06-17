import { describe, expect, it } from "vitest";
import {
  draftableLineups,
  lineupById,
  lineupPoolForRegion,
  lineups,
  playerCardById,
  specialCardById,
} from "@/data";
import { createRng } from "@/lib/rng";
import { createDraft, drawNextOffer } from "@/engine/draft";
import { generateOpponents } from "@/engine/opponents";
import { buildUserTeam } from "@/engine/teams";
import type { Roster } from "@/engine/types";

describe("regional draft & sam-only separation (v1.2.0)", () => {
  it("the draftable pool excludes every sam-only lineup", () => {
    expect(draftableLineups.every((l) => !l.samOnly)).toBe(true);
    expect(draftableLineups.length + lineups.filter((l) => l.samOnly).length).toBe(
      lineups.length,
    );
    // the SAM regional import exists in the dataset
    expect(lineups.some((l) => l.samOnly)).toBe(true);
  });

  it("the SAM regional pool mixes Worlds finalists and sam-only Top-8 teams, all SAM", () => {
    const pool = lineupPoolForRegion("SAM").map((id) => lineupById.get(id)!);
    expect(pool.length).toBeGreaterThan(8);
    expect(pool.every((l) => l.region === "SAM")).toBe(true);
    expect(pool.some((l) => l.samOnly)).toBe(true); // regional-only teams
    expect(pool.some((l) => !l.samOnly)).toBe(true); // Worlds finalists
  });

  it("a worldwide draft never offers a sam-only lineup", () => {
    const rng = createRng(12345);
    let draft = createDraft("normal");
    for (let i = 0; i < 400; i++) {
      draft = drawNextOffer(draft, rng);
      expect(lineupById.get(draft.offer!.lineupId)!.samOnly).toBeFalsy();
    }
  });

  it("the Wings easter egg is force-injected rarely, with the Creator card guaranteed", () => {
    const sam = lineupPoolForRegion("SAM");
    const wings = "wings-e-sports-s2";
    expect(sam).toContain(wings);
    const N = 3000;
    let appearances = 0;
    let creatorGuaranteed = 0;
    for (let s = 0; s < N; s++) {
      const rng = createRng(7000 + s);
      const offer = drawNextOffer(createDraft("normal", { poolLineupIds: sam }), rng).offer!;
      if (offer.lineupId !== wings) continue;
      appearances++;
      const lib = offer.cards.find(
        (c) => c.kind === "player" && playerCardById.get(c.refId)?.playerId === "liberatorl",
      );
      if (lib?.specialId === "sp-liberatorl-rocket-draft-creator") creatorGuaranteed++;
    }
    expect(appearances).toBeGreaterThan(0); // findable
    expect(appearances).toBeLessThan(N * 0.04); // rare (≈1% per offer)
    expect(creatorGuaranteed).toBe(appearances); // always the Creator card when it shows
  });

  it("the Wings easter egg is never an AI opponent", () => {
    const sam = lineupPoolForRegion("SAM");
    let seen = 0;
    for (let s = 0; s < 60; s++) {
      const rng = createRng(5000 + s);
      const teams = generateOpponents("normal", rng, 15, sam);
      if (teams.some((t) => t.lineupId === "wings-e-sports-s2")) seen++;
    }
    expect(seen).toBe(0);
  });

  it("the Creator special carries a team-wide boost and raises team stats", () => {
    const sp = specialCardById.get("sp-liberatorl-rocket-draft-creator")!;
    expect(sp.effect.type).toBe("team_attribute_boost");
    expect(sp.effect.attributes?.length).toBe(6);

    const cards = [...playerCardById.values()];
    const o1 = cards.find((c) => c.playerId !== "liberatorl")!;
    const o2 = cards.find((c) => c.playerId !== "liberatorl" && c.playerId !== o1.playerId)!;
    const base: Roster = {
      player1: { slot: "player1", kind: "player", refId: "liberatorl-wings-e-sports-s2", fromLineupId: "wings-e-sports-s2" },
      player2: { slot: "player2", kind: "player", refId: o1.id, fromLineupId: o1.lineupId },
      player3: { slot: "player3", kind: "player", refId: o2.id, fromLineupId: o2.lineupId },
    };
    const withCreator: Roster = {
      ...base,
      player1: { ...base.player1!, specialId: sp.id },
    };
    const sum = (s: Record<string, number>) => Object.values(s).reduce((a, b) => a + b, 0);
    const plain = buildUserTeam(base, "normal", { mode: "quick" });
    const boosted = buildUserTeam(withCreator, "normal", { mode: "quick" });
    expect(sum(boosted.stats)).toBeGreaterThan(sum(plain.stats));
  });
});
