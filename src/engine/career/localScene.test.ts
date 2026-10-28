import { describe, expect, it } from "vitest";
import { CAREER_UNOFFICIAL } from "@/config/balance";
import { coaches, players, subs } from "@/data";
import {
  LOCAL_PLAYER_NAME_BANK,
  PLAYER_NAME_BANK,
  PLAYER_NAME_BANK_SWAPS,
  STAND_IN_NAMES,
  STARTER_NAME_BANK,
  playerNameBankFor,
} from "@/data/career/names";
import type { Region } from "../types";
import { localPlayerNames, localSceneRefs, localTeamName } from "./localScene";

const REGIONS: Region[] = ["NA", "EU", "SAM", "MENA", "OCE", "APAC", "SSA"];

/** Case-insensitive, accent- and punctuation-folded ("Cheese." = "cheese"). */
const key = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

/** Every real name in the dataset: player nicknames, coaches, subs. */
const REAL = new Set([...players.map((p) => p.nickname), ...coaches.map((c) => c.name), ...subs.map((s) => s.name)].map(key));

describe("local amateur scene names (rc.28)", () => {
  it("every side of a region-season pool has its own name and its own three players", () => {
    const failures: string[] = [];
    for (let careerSeed = 1; careerSeed <= 300; careerSeed++) {
      for (const region of REGIONS) {
        for (let seasonIndex = 0; seasonIndex < 4; seasonIndex++) {
          const refs = localSceneRefs(region, seasonIndex);
          const teams = refs.map((ref) => localTeamName(ref, careerSeed));
          const players = refs.flatMap((ref) => localPlayerNames(ref, careerSeed));
          if (new Set(teams).size !== refs.length) failures.push(`${careerSeed} ${region} ${seasonIndex}: teams ${teams}`);
          if (new Set(players).size !== players.length) failures.push(`${careerSeed} ${region} ${seasonIndex}: players`);
        }
      }
    }
    expect(CAREER_UNOFFICIAL.localScenePool).toBe(8);
    expect(failures.slice(0, 5)).toEqual([]);
  });

  it("names are deterministic per career and differ across careers", () => {
    const ref = localSceneRefs("SAM", 0)[3];
    expect(localTeamName(ref, 77)).toBe(localTeamName(ref, 77));
    expect(localPlayerNames(ref, 77)).toEqual(localPlayerNames(ref, 77));
    const rosters = new Set(Array.from({ length: 20 }, (_, i) => localPlayerNames(ref, i + 1).join(",")));
    expect(rosters.size).toBeGreaterThan(10);
  });
});

describe("career name banks never overlap (rc.29 CAR-01)", () => {
  it("the local scene has its own regional bank: ≥ 32 gamertags, no numeric tags, every pick from it", () => {
    for (const region of REGIONS) {
      const bank = LOCAL_PLAYER_NAME_BANK[region];
      expect(bank.length, region).toBeGreaterThanOrEqual(32);
      expect(new Set(bank.map(key)).size, `${region} has a duplicate`).toBe(bank.length);
      for (const name of bank) expect(name, region).not.toMatch(/\d/);
      // Enough names for a whole pool of distinct players.
      expect(bank.length).toBeGreaterThanOrEqual(CAREER_UNOFFICIAL.localScenePool * 3);
      const picked = localSceneRefs(region, 0).flatMap((ref) => localPlayerNames(ref, 4242));
      for (const name of picked) expect(bank, region).toContain(name);
    }
  });

  it("local, starter, filler/rookie and stand-in names are pairwise disjoint across every region (case-insensitive)", () => {
    const owner = new Map<string, string>();
    const clashes: string[] = [];
    const claim = (name: string, where: string) => {
      const k = key(name);
      const prev = owner.get(k);
      if (prev && prev !== where) clashes.push(`${name}: ${prev} / ${where}`);
      else owner.set(k, where);
    };
    for (const region of REGIONS) {
      for (const name of LOCAL_PLAYER_NAME_BANK[region]) claim(name, `local:${region}`);
      for (const name of STARTER_NAME_BANK[region]) claim(name, `starter:${region}`);
      for (const name of PLAYER_NAME_BANK[region]) claim(name, `player:${region}`);
      for (const name of playerNameBankFor(region, 2)) claim(name, `player:${region}`);
      claim(STAND_IN_NAMES[region], `standIn:${region}`);
    }
    expect(clashes).toEqual([]);
  });

  it("no local or starter gamertag — and no filler name of a new world — is a real name from the dataset", () => {
    expect(REAL.size).toBeGreaterThan(500);
    const real: string[] = [];
    for (const region of REGIONS) {
      for (const name of [
        ...LOCAL_PLAYER_NAME_BANK[region],
        ...STARTER_NAME_BANK[region],
        ...playerNameBankFor(region, 2),
        STAND_IN_NAMES[region],
      ]) {
        if (REAL.has(key(name))) real.push(`${region}:${name}`);
      }
    }
    expect(real).toEqual([]);
  });

  it("the real-nickname swaps apply only to worlds created from rc.29 on (older careers keep every name)", () => {
    for (const region of REGIONS) {
      // Version 1 (absent): the original bank, untouched.
      expect(playerNameBankFor(region, undefined)).toBe(PLAYER_NAME_BANK[region]);
      const v2 = playerNameBankFor(region, 2);
      expect(v2).toHaveLength(PLAYER_NAME_BANK[region].length);
      const swaps = PLAYER_NAME_BANK_SWAPS[region] ?? {};
      PLAYER_NAME_BANK[region].forEach((name, i) => expect(v2[i]).toBe(swaps[name] ?? name));
    }
    // The five the check found ("Sultan" = the real "! Sultan."): a MENA
    // filler "Fahad" met the real Fahad in a regional.
    const swapped = Object.values(PLAYER_NAME_BANK_SWAPS).flatMap((m) => Object.keys(m ?? {}));
    expect(swapped.sort()).toEqual(["Fahad", "Idris", "Skyline", "Sultan", "Zayd"]);
    for (const name of swapped) expect(REAL.has(key(name))).toBe(true);
  });

  it("the founding roster bank covers the wizard's nine distinct names per region", () => {
    for (const region of REGIONS) {
      expect(STARTER_NAME_BANK[region].length, region).toBeGreaterThanOrEqual(9);
      expect(new Set(STARTER_NAME_BANK[region].map(key)).size).toBe(STARTER_NAME_BANK[region].length);
    }
  });
});
