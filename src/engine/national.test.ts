import { describe, expect, it } from "vitest";
import { DRAFT, SPECIALS } from "@/config/balance";
import {
  coachById,
  coachSpecialsByPersonId,
  draftableLineups,
  isRegionOnly,
  lineupById,
  lineupPoolForRegion,
  lineups,
  nationalSpecialByCardId,
  nationalSpecialIdsByLineupId,
  playerById,
  playerCardById,
  specialCardById,
  specialsByPlayerId,
  subById,
  worldNationalLineups,
} from "@/data";
import { createRng } from "@/lib/rng";
import { resolveSpecial } from "./cards";
import { challengePool } from "./challenges";
import { anchorOverall, deriveBirthYear } from "./career/development";
import { createDraft, drawNextOffer, nationalUnlocks } from "./draft";
import { generateOpponents } from "./opponents";
import { buildUserTeam } from "./teams";
import type { DraftState, Roster } from "./types";

const nationals = lineups.filter((l) => l.national);

describe("national teams — data (v2.0)", () => {
  it("the FIFAe national rosters are in the dataset", () => {
    expect(nationals.length).toBeGreaterThanOrEqual(30);
    for (const l of nationals) expect(l.orgId.startsWith("national-"), l.id).toBe(true);
  });

  it("every card of a national lineup has exactly one derived national special", () => {
    for (const l of nationals) {
      const bases = [...l.playerCardIds, l.coachId, l.subId].filter((x): x is string => Boolean(x));
      const ids = nationalSpecialIdsByLineupId.get(l.id)!;
      expect(ids, l.id).toHaveLength(bases.length);
      for (const base of bases) {
        const sp = nationalSpecialByCardId.get(base)!;
        expect(sp.id).toBe(`nt-${base}`);
        expect(sp.rarity).toBe("national");
        expect(sp.cardType).toBe("national");
        expect(specialCardById.get(sp.id)).toBe(sp);
        const baseOverall =
          playerCardById.get(base)?.overall ?? coachById.get(base)?.overall ?? subById.get(base)?.overall;
        expect(sp.overall).toBe(Math.min(99, baseOverall! + SPECIALS.national.overallDelta));
        expect(sp.effect.type).toBe("team_attribute_boost");
        expect(sp.effect.value).toBe(SPECIALS.national.teamBoost);
        expect(sp.kind === "coach").toBe(base === l.coachId);
      }
    }
  });

  it("national cards never join a person's roll pool (no leak into normal draws or AI upgrades)", () => {
    for (const pool of [...specialsByPlayerId.values(), ...coachSpecialsByPersonId.values()]) {
      expect(pool.some((sp) => sp.rarity === "national")).toBe(false);
    }
  });

  it("every national special resolves to a display card (players, coaches and subs)", () => {
    for (const ids of nationalSpecialIdsByLineupId.values()) {
      for (const id of ids) {
        const card = resolveSpecial(specialCardById.get(id)!);
        expect(card.special?.id).toBe(id);
        expect(card.orgId?.startsWith("national-")).toBe(true);
      }
    }
  });
});

describe("national teams — never in the normal pools (v2.0)", () => {
  it("not in the general draft pool, nor any challenge pool", () => {
    expect(draftableLineups.some((l) => l.national)).toBe(false);
    for (const region of ["SAM", "EU", "NA"] as const) {
      expect(challengePool({ region })!.some((id) => lineupById.get(id)?.national)).toBe(false);
    }
    expect(challengePool({ country: "FR" })!.some((id) => lineupById.get(id)?.national)).toBe(false);
  });

  it("never an AI opponent, worldwide or regional", () => {
    for (let s = 0; s < 40; s++) {
      const world = generateOpponents("legacy", createRng(100 + s), 15);
      expect(world.some((t) => lineupById.get(t.lineupId ?? "")?.national)).toBe(false);
      const eu = generateOpponents("legacy", createRng(200 + s), 15, lineupPoolForRegion("EU"));
      expect(eu.some((t) => lineupById.get(t.lineupId ?? "")?.national)).toBe(false);
    }
  });

  it("a draft that did not opt in (daily / challenge) never shows one", () => {
    const rng = createRng(4242);
    let draft = createDraft("normal", { poolLineupIds: lineupPoolForRegion("SAM") });
    for (let i = 0; i < 600; i++) {
      draft = drawNextOffer(draft, rng);
      expect(lineupById.get(draft.offer!.lineupId)!.national).toBeFalsy();
    }
  });
});

describe("national teams — the draw (v2.0)", () => {
  const N = 6000;
  function firstOffers(make: () => DraftState): { national: number; lineupIds: string[] } {
    let national = 0;
    const lineupIds: string[] = [];
    for (let s = 0; s < N; s++) {
      const offer = drawNextOffer(make(), createRng(90_000 + s)).offer!;
      if (lineupById.get(offer.lineupId)?.national) {
        national++;
        lineupIds.push(offer.lineupId);
      }
    }
    return { national, lineupIds };
  }

  it("worldwide: rare but findable, at ≈ DRAFT.nationalTeamChance per offer", () => {
    const { national, lineupIds } = firstOffers(() =>
      createDraft("normal", { nationalTeams: { discovered: [] } }),
    );
    const rate = national / N;
    expect(rate).toBeGreaterThan(DRAFT.nationalTeamChance * 0.6);
    expect(rate).toBeLessThan(DRAFT.nationalTeamChance * 1.4);
    // only the national teams that are not region-only
    for (const id of lineupIds) expect(isRegionOnly(lineupById.get(id)!)).toBe(false);
    expect(worldNationalLineups.length).toBeGreaterThan(10);
  });

  it("a Region-only run draws only its own region's national teams", () => {
    const { lineupIds } = firstOffers(() =>
      createDraft("normal", { poolLineupIds: lineupPoolForRegion("EU"), nationalTeams: { discovered: [] } }),
    );
    expect(lineupIds.length).toBeGreaterThan(0);
    for (const id of lineupIds) expect(lineupById.get(id)!.region).toBe("EU");
  });

  it("every card of a national offer shows as its national special, and seeing it unlocks all", () => {
    let checked = 0;
    for (let s = 0; s < N && checked < 25; s++) {
      const draft = drawNextOffer(createDraft("normal", { nationalTeams: { discovered: [] } }), createRng(50_000 + s));
      const lineup = lineupById.get(draft.offer!.lineupId)!;
      if (!lineup.national) {
        expect(nationalUnlocks(draft.offer)).toEqual([]);
        continue;
      }
      checked++;
      for (const card of draft.offer!.cards) {
        if (card.kind === "org" || card.availability === "vacant") continue;
        expect(card.specialId, card.refId).toBe(nationalSpecialByCardId.get(card.refId)!.id);
      }
      expect(nationalUnlocks(draft.offer)).toEqual(nationalSpecialIdsByLineupId.get(lineup.id));
    }
    expect(checked).toBeGreaterThan(5);
  });

  it("undiscovered national teams are favoured, so the album can be completed", () => {
    const all = worldNationalLineups.map((l) => l.id);
    const missing = all[0];
    const discovered = all.slice(1);
    const { lineupIds } = firstOffers(() => createDraft("normal", { nationalTeams: { discovered } }));
    const share = lineupIds.filter((id) => id === missing).length / lineupIds.length;
    const uniform = 1 / all.length;
    const expected = DRAFT.nationalUndiscoveredWeight / (DRAFT.nationalUndiscoveredWeight + all.length - 1);
    expect(share).toBeGreaterThan(uniform * 1.5);
    expect(share).toBeGreaterThan(expected * 0.5);
  });

  it("a drafted national card lifts every team attribute", () => {
    const l = nationals.find((x) => !isRegionOnly(x))!;
    const cardId = l.playerCardIds[0];
    const others = draftableLineups[0].playerCardIds;
    const base: Roster = {
      player1: { slot: "player1", kind: "player", refId: cardId, fromLineupId: l.id },
      player2: { slot: "player2", kind: "player", refId: others[1], fromLineupId: draftableLineups[0].id },
      player3: { slot: "player3", kind: "player", refId: others[2], fromLineupId: draftableLineups[0].id },
    };
    const special: Roster = {
      ...base,
      player1: { ...base.player1!, specialId: nationalSpecialByCardId.get(cardId)!.id },
    };
    const plain = buildUserTeam(base, "normal", { mode: "quick" });
    const boosted = buildUserTeam(special, "normal", { mode: "quick" });
    for (const k of Object.keys(plain.stats) as (keyof typeof plain.stats)[]) {
      expect(boosted.stats[k]).toBeGreaterThanOrEqual(plain.stats[k]);
    }
    expect(boosted.rating.total).toBeGreaterThanOrEqual(plain.rating.total);
  });
});

describe("career — real ages and club history (v2.0)", () => {
  it("a player with a real birth date gets that birth year in every career", () => {
    const withBirthday = [...playerById.values()].filter((p) => p.birthday);
    expect(withBirthday.length).toBeGreaterThan(300);
    for (const p of withBirthday.slice(0, 50)) {
      const year = Number(p.birthday!.slice(0, 4));
      expect(deriveBirthYear(p.id, 1)).toBe(year);
      expect(deriveBirthYear(p.id, 987654)).toBe(year);
    }
  });

  it("national-team cards never become a player's career anchor", () => {
    for (const l of nationals) {
      for (const cardId of l.playerCardIds) {
        const card = playerCardById.get(cardId)!;
        const order = 99;
        const anchor = anchorOverall(card.playerId, order);
        const clubCards = [...playerCardById.values()].filter(
          (c) => c.playerId === card.playerId && !lineupById.get(c.lineupId)?.national,
        );
        if (clubCards.length === 0) expect(anchor).toBeNull();
      }
    }
  });
});
