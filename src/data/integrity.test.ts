/**
 * Dataset integrity — THE data gate. Since v1.5 the runtime module (`./index`)
 * serves typed casts of the JSON with no zod, so schema validation + referential
 * integrity run ONLY here, via `validateDataset()` (`./validate`). This suite
 * also proves the casts are exactly what the zod parse produces and that zod /
 * the validator never leak back into app code.
 * Run alone with: npm run validate:data
 */

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import * as runtime from "./index";
import {
  achievements,
  challenges,
  coaches,
  datasetSummary,
  lineupById,
  lineups,
  orgs,
  playerCardById,
  playerCards,
  players,
  specialCards,
  subs,
} from "./index";
import {
  DATASET_FILES,
  validateDataset,
  type ParsedDataset,
  type RawDataset,
} from "./validate";

const FILES = Object.keys(DATASET_FILES) as (keyof RawDataset)[];

let parsedCache: ParsedDataset | undefined;
/** The zod-parsed + integrity-checked dataset (throws the `[data] …` error if invalid). */
function parsed(): ParsedDataset {
  parsedCache ??= validateDataset();
  return parsedCache;
}

/** A copy of the real dataset with one file replaced — for the negative tests. */
function withFile<K extends keyof RawDataset>(
  key: K,
  edit: (records: Record<string, unknown>[]) => void,
): RawDataset {
  const records = structuredClone(DATASET_FILES[key]) as Record<string, unknown>[];
  edit(records);
  return { ...DATASET_FILES, [key]: records };
}

describe("dataset validation (build-time gate)", () => {
  it("every file passes its zod schema, ids are unique and every cross-reference resolves", () => {
    expect(() => parsed()).not.toThrow();
  });

  it("validation is pure — it never mutates the raw JSON", () => {
    const before = JSON.stringify(DATASET_FILES);
    validateDataset();
    expect(JSON.stringify(DATASET_FILES)).toBe(before);
  });

  it("the runtime exports are the raw JSON, unchanged (no load-time transform)", () => {
    for (const key of FILES) {
      // specialCards is the one exception: index.ts strips the undeclared
      // `secret` key zod used to strip (covered by the deep-equal test below).
      if (key === "specialCards") continue;
      expect(runtime[key], key).toBe(DATASET_FILES[key]);
    }
  });

  it("the runtime data deep-equals what the zod parse produces (same values, same keys)", () => {
    // toStrictEqual also fails on a key present on one side only (even when
    // undefined), so a NEW undeclared JSON key — which zod would strip — fails
    // here: declare it in schemas.ts + engine/types.ts, or strip it in index.ts.
    // (Object key ORDER is not compared: zod emits schema order, the JSON has its
    // own; nothing in src/ iterates a record's keys.)
    const p = parsed();
    for (const key of FILES) {
      expect(runtime[key], key).toStrictEqual(p[key]);
    }
  });

  it("the lookup maps hold every record, keyed by id, in file order", () => {
    const p = parsed();
    const maps = {
      players: runtime.playerById,
      seasons: runtime.seasonById,
      playerCards: runtime.playerCardById,
      orgs: runtime.orgById,
      coaches: runtime.coachById,
      subs: runtime.subById,
      lineups: runtime.lineupById,
      specialCards: runtime.specialCardById,
      achievements: runtime.achievementById,
      challenges: runtime.challengeById,
    } satisfies Record<keyof RawDataset, Map<string, { id: string }>>;
    for (const key of FILES) {
      const map = maps[key] as Map<string, { id: string }>;
      const records = p[key] as { id: string }[];
      expect([...map.keys()], key).toStrictEqual(records.map((r) => r.id));
      expect([...map.values()], key).toStrictEqual(records);
    }
  });

  it("rejects a schema violation with the file name", () => {
    const raw = withFile("players", (rs) => {
      rs[0].region = "XX";
    });
    expect(() => validateDataset(raw)).toThrow(/^\[data\] Invalid players\.json/);
  });

  it("rejects an undeclared key on a strict schema (challenges)", () => {
    const raw = withFile("challenges", (rs) => {
      rs[0].typoField = true;
    });
    expect(() => validateDataset(raw)).toThrow(/^\[data\] Invalid challenges\.json/);
  });

  it("rejects a duplicate id", () => {
    const raw = withFile("orgs", (rs) => {
      rs.push(structuredClone(rs[0]));
    });
    expect(() => validateDataset(raw)).toThrow(/^\[data\] Duplicate id ".+" in orgs\.json$/);
  });

  it("rejects a broken cross-file reference", () => {
    const raw = withFile("lineups", (rs) => {
      rs[0].orgId = "no-such-org";
    });
    expect(() => validateDataset(raw)).toThrow(/^\[data\] lineups: ".+" → unknown orgId "no-such-org"$/);
  });

  it("rejects a challenge gated on an unknown rank", () => {
    const raw = withFile("challenges", (rs) => {
      rs[0].rankRequired = "no-such-rank";
    });
    expect(() => validateDataset(raw)).toThrow(/unknown rankRequired "no-such-rank"/);
  });

  it("zod and the validator never reach app code (client bundle stays zod-free)", () => {
    const srcDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
    const validatorOnly = new Set(
      ["data/schemas", "data/validate"].map((p) => resolve(srcDir, p)),
    );
    const offenders: string[] = [];
    for (const rel of readdirSync(srcDir, { recursive: true }) as string[]) {
      if (!/\.(ts|tsx|mts)$/.test(rel) || /\.test\.tsx?$/.test(rel)) continue;
      const file = join(srcDir, rel);
      if (validatorOnly.has(file.replace(/\.(ts|tsx|mts)$/, ""))) continue;
      const text = readFileSync(file, "utf8");
      const specifiers = text.matchAll(
        /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|\brequire\s*\(\s*)["']([^"']+)["']/g,
      );
      for (const [, spec] of specifiers) {
        const target = spec.startsWith("@/")
          ? resolve(srcDir, spec.slice(2))
          : spec.startsWith(".")
            ? resolve(dirname(file), spec)
            : null;
        const leaks =
          spec === "zod" ||
          spec.startsWith("zod/") ||
          (target !== null && validatorOnly.has(target.replace(/\.(ts|tsx|mts)$/, "")));
        if (leaks) offenders.push(`${relative(srcDir, file)} → ${spec}`);
      }
    }
    expect(offenders).toStrictEqual([]);
  });
});

describe("dataset", () => {
  it("loads and validates every JSON file", () => {
    expect(datasetSummary).toEqual({
      players: players.length,
      playerCards: playerCards.length,
      lineups: lineups.length,
      orgs: orgs.length,
      coaches: coaches.length,
      subs: subs.length,
      specialCards: specialCards.length,
      achievements: achievements.length,
      challenges: challenges.length,
    });
  });

  it("meets the base-document minimum dataset size (§36)", () => {
    expect(lineups.length).toBeGreaterThanOrEqual(15);
    expect(playerCards.length).toBeGreaterThanOrEqual(45);
    expect(orgs.length).toBeGreaterThanOrEqual(10);
    expect(coaches.length).toBeGreaterThanOrEqual(8);
    expect(specialCards.length).toBeGreaterThanOrEqual(5);
  });

  it("every lineup has exactly its 3 player cards pointing back at it", () => {
    for (const lineup of lineups) {
      expect(lineup.playerCardIds).toHaveLength(3);
      for (const id of lineup.playerCardIds) {
        expect(playerCardById.get(id)?.lineupId).toBe(lineup.id);
      }
    }
  });

  it("special cards map to real base cards inside real lineups", () => {
    for (const sp of specialCards) {
      if (sp.kind === "coach") {
        const base = coaches.find((c) => c.id === sp.baseCardId);
        expect(base, sp.id).toBeDefined();
        expect(lineupById.get(base!.lineupId)).toBeDefined();
      } else {
        const base = playerCardById.get(sp.baseCardId);
        expect(base, sp.id).toBeDefined();
        expect(lineupById.get(base!.lineupId)).toBeDefined();
      }
    }
  });

  it("players can have multiple cards across seasons (core rule §9)", () => {
    const byPlayer = new Map<string, number>();
    for (const card of playerCards) {
      byPlayer.set(card.playerId, (byPlayer.get(card.playerId) ?? 0) + 1);
    }
    const multiCard = [...byPlayer.values()].filter((n) => n >= 2);
    expect(multiCard.length).toBeGreaterThanOrEqual(8);
  });

  // -------------------------------------------------------------------------
  // Identity unification contract (v0.5/v0.5.1). Spelling variants of the
  // same person/org MUST share one id; same-name strangers MUST NOT.
  // -------------------------------------------------------------------------

  it("zen (EU) and ZeN (OCE) are different people", () => {
    const zenEu = players.find((p) => p.id === "zen");
    const zenOce = players.find((p) => p.id === "zen-oce");
    expect(zenEu?.region).toBe("EU");
    expect(zenOce?.region).toBe("OCE");
  });

  it("org era spellings are unified — alias sources never become orgs", () => {
    const ids = new Set(orgs.map((o) => o.id));
    // Aliased era spellings (see ORG_ALIAS in scripts/build-dataset.mjs):
    for (const stale of [
      "renault-vitality",
      "team-dignitas",
      "chiefs-esc",
      "mockit-esports",
      "mock-it-esports-eu",
      "quiktrip-pioneers-gaming",
    ]) {
      expect(ids.has(stale), `"${stale}" should be an alias, not an org`).toBe(false);
    }
    // Their canonical identities exist:
    for (const canonical of ["team-vitality", "dignitas", "chiefs-esports-club", "mock-it-esports"]) {
      expect(ids.has(canonical), canonical).toBe(true);
    }
  });

  it("same-name orgs from different regions stay separate", () => {
    const ids = new Set(orgs.map((o) => o.id));
    for (const split of ["pioneers-oce", "pioneers-ssa", "fut-esports-na", "fut-esports-ssa"]) {
      expect(ids.has(split), split).toBe(true);
    }
    expect(ids.has("pioneers")).toBe(false);
    expect(ids.has("fut-esports")).toBe(false);
  });
});
