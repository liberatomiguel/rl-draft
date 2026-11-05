import { describe, expect, it } from "vitest";
import audit from "../../data-sources/rlcs-2027-audit.json";
import {
  challenges, coachById, draftableLineups, isObtainable, lineupById, lineupPoolForRegion,
  lineups, orgById, playerById, playerCardById, seasonById, subById,
} from "@/data";
import { createChallengeDraft } from "@/engine/challenges";
import { drawNextOffer } from "@/engine/draft";
import { createRng } from "@/lib/rng";
import type { Region } from "@/engine/types";

describe("RLCS 2027 — approved expansion and identity contract", () => {
  it("adds the new edition without renumbering the previous season", () => {
    expect(seasonById.get("rlcs-2027")).toMatchObject({ label: "RLCS 2027", year: "2027", order: 16 });
    expect(seasonById.get("rlcs-2026")?.order).toBe(15);
  });

  it("contains the 46 reviewed trios, with exactly 24 worldwide and 22 regional-only", () => {
    const added = lineups.filter((l) => l.seasonId === audit.seasonId);
    expect(added.map((l) => l.id).sort()).toEqual(audit.lineups.map((l) => l.id).sort());
    expect(added).toHaveLength(46);
    expect(added.filter((l) => !l.samOnly)).toHaveLength(24);
    expect(added.filter((l) => l.samOnly)).toHaveLength(22);
    const starters = added.flatMap((l) => l.playerCardIds.map((id) => playerCardById.get(id)!.playerId));
    expect(new Set(starters).size).toBe(138);
  });

  for (const expected of audit.lineups) {
    it(`${expected.name}: resolves the reviewed people, roles, ratings and competitive region`, () => {
      const l = lineupById.get(expected.id)!;
      expect(l).toMatchObject({ seasonId: audit.seasonId, orgId: expected.orgId, region: expected.region });
      expect(Boolean(l.samOnly)).toBe(expected.regionalOnly);
      expect(orgById.has(l.orgId)).toBe(true);
      expect(l.playerCardIds.map((id) => {
        const c = playerCardById.get(id)!;
        expect(c.lineupId).toBe(l.id);
        expect(c.orgId).toBe(l.orgId);
        expect(c.seasonId).toBe(audit.seasonId);
        expect(playerById.has(c.playerId)).toBe(true);
        return { personId: c.playerId, overall: c.overall };
      })).toEqual(expected.players.map(({ personId, overall }) => ({ personId, overall })));
      if (expected.coach) {
        expect(coachById.get(l.coachId!)).toMatchObject({ personId: expected.coach.personId, overall: expected.coach.overall, lineupId: l.id });
      } else {
        expect(l.coachId).toBeUndefined();
      }
      if (expected.sub) {
        expect(subById.get(l.subId!)).toMatchObject({ personId: expected.sub.personId, overall: expected.sub.overall, lineupId: l.id });
      } else {
        expect(l.subId).toBeUndefined();
      }
      expect(draftableLineups.some((x) => x.id === l.id)).toBe(!expected.regionalOnly);
      expect(lineupPoolForRegion(expected.region as Region)).toContain(l.id);
    });
  }

  it("keeps the 27 calibrated challenge pools historical across repeated draws", () => {
    for (const challenge of challenges) {
      expect(challenge.constraint?.maxSeasonId).toBe("rlcs-2026");
      const rng = createRng(challenge.seed);
      let draft = createChallengeDraft(challenge, rng);
      for (let i = 0; i < 50; i++) {
        const lineup = lineupById.get(draft.offer!.lineupId)!;
        expect(seasonById.get(lineup.seasonId)!.order).toBeLessThanOrEqual(seasonById.get("rlcs-2026")!.order);
        draft = drawNextOffer(draft, rng);
      }
    }
  });

  it("keeps rebranded players on their historical game ids", () => {
    for (const [personId, oldLineup, newLineup] of [
      ["jstn", "fut-esports-na-2026", "fut-esports-na-2027"],
      ["ghaazi0", "r8-esports-2026", "twisted-minds-2027"],
      ["suco", "godfidence-2025", "pcs-stride-2027"],
      ["wisty", "bs-competition-2026", "pcs-stride-2027"],
    ]) {
      expect(playerCardById.get(`${personId}-${oldLineup}`)?.playerId).toBe(personId);
      expect(playerCardById.get(`${personId}-${newLineup}`)?.playerId).toBe(personId);
    }
    for (const duplicate of ["justin", "ghaazi", "sucoo", "wistyy", "sqlar", "sxlarr"]) {
      expect(playerById.has(duplicate)).toBe(false);
    }
  });

  it("reuses org ids across names and regions, without splitting FaZe's history", () => {
    expect(lineupById.get("faze-clan-2027")).toMatchObject({ orgId: "faze-clan", region: "SAM" });
    expect(lineups.some((l) => l.orgId === "faze-clan" && l.region === "NA")).toBe(true);
    expect(lineupById.get("ninjas-in-pyjamas-2027")?.orgId).toBe("ninjas-in-pyjamas");
    expect(lineups.some((l) => l.orgId === "ninjas-in-pyjamas" && l.region === "SAM")).toBe(true);
    expect(lineupById.get("gentle-mates-alpine-2027")?.orgId).toBe("gentle-mates-alpine");
    expect(lineupById.get("nrg-esports-2027")?.orgId).toBe("nrg-esports");
    expect(orgById.has("gentle-mates")).toBe(false);
    expect(orgById.has("nrg")).toBe(false);
  });

  it("puts team 1 in NA only and keeps dormant APAC rosters out of the worldwide pool", () => {
    const one = lineupById.get("1-2027")!;
    expect(one).toMatchObject({ region: "NA", samOnly: true });
    expect(one.playerCardIds.map((id) => playerCardById.get(id)!.playerId)).toEqual(["justuszzz", "matter", "royales"]);
    expect(playerById.get("royales")?.country).toBe("BR");
    expect(isObtainable(one)).toBe(true);
    for (const id of ["ballerrinas-2027", "nimmt55-2027"]) {
      expect(isObtainable(lineupById.get(id)!)).toBe(false);
    }
    expect(isObtainable(lineupById.get("wolves-esports-2027")!)).toBe(true);
  });

  it("keeps player-to-coach transitions on the same person and in the coach slot", () => {
    expect(coachById.get(lineupById.get("gen-g-mobil1-racing-2027")!.coachId!)?.personId).toBe("apparentlyjack");
    expect(coachById.get(lineupById.get("wildcard-2027")!.coachId!)?.personId).toBe("jknaps");
    expect(lineupById.get("gen-g-mobil1-racing-2027")!.playerCardIds.some((id) => playerCardById.get(id)!.playerId === "apparentlyjack")).toBe(false);
  });
});
