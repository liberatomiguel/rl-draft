/**
 * Cutover rehearsal (ONDA3 step 3), opt-in: a REAL career save keeps going.
 *
 *   CAREER_SAVE=<localStorage dump> [CAREER_SAVE_SEASONS=5] npx vitest run src/store/careerRealSave.probe.test.ts
 *
 * The dump is the browser's localStorage as JSON (it holds
 * `rocket-draft:career:v1`), kept outside the repo. Every used slot is loaded
 * through the career store exactly as a page load does (persist migrate +
 * the load-time repair), then the arc bot plays it forward. rc.47–rc.49 had a
 * universal soft lock in season 3, so the bar is: no slot stops before the
 * requested number of seasons, nothing throws, and the save's identity
 * (org, region, seed, founding squad) is what the player left.
 */

import { existsSync, readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { CareerSave } from "@/engine/career/types";
import { playArcCareer } from "./careerArcBot";

const FILE = process.env.CAREER_SAVE;
const SEASONS = Number(process.env.CAREER_SAVE_SEASONS ?? 5);
const KEY = "rocket-draft:career:v1";

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length(): number {
    return this.data.size;
  }
  clear(): void {
    this.data.clear();
  }
  getItem(key: string): string | null {
    return this.data.has(key) ? this.data.get(key)! : null;
  }
  key(index: number): string | null {
    return [...this.data.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
  setItem(key: string, value: string): void {
    this.data.set(key, String(value));
  }
}

const storage = new MemoryStorage();
let raw: { version: number; state: { slots: (CareerSave | null)[] } };
let loaded: (CareerSave | null)[] = [];

describe.skipIf(!FILE)("a real career save (CAREER_SAVE)", () => {
  beforeAll(async () => {
    if (!FILE || !existsSync(FILE)) throw new Error(`CAREER_SAVE not found: ${FILE}`);
    const dump = JSON.parse(readFileSync(FILE, "utf8").replace(/^﻿/, "")) as Record<string, string>;
    if (!dump[KEY]) throw new Error(`the dump has no ${KEY}`);
    raw = JSON.parse(dump[KEY]);
    for (const [k, v] of Object.entries(dump)) storage.setItem(k, v);
    await import("@/lib/analytics");
    vi.stubGlobal("window", { localStorage: storage });
    try {
      const { useCareerStore } = await import("./careerStore");
      await (useCareerStore as unknown as { persist: { rehydrate: () => Promise<void> | void } }).persist.rehydrate();
      loaded = useCareerStore.getState().slots;
    } finally {
      vi.unstubAllGlobals();
    }
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it("loads through the store with its identity intact", () => {
    const before = raw.state.slots;
    expect(loaded.length).toBe(before.length);
    before.forEach((slot, i) => {
      const after = loaded[i];
      if (!slot) return expect(after).toBeNull();
      expect(after).not.toBeNull();
      expect(after!.careerSeed).toBe(slot.careerSeed);
      expect(after!.identity).toEqual(slot.identity);
      expect(after!.difficulty).toBe(slot.difficulty);
      expect(after!.clock.seasonIndex).toBe(slot.clock.seasonIndex);
      expect(after!.clock.day).toBe(slot.clock.day);
      expect(after!.squad.map((p) => p.id).sort()).toEqual(slot.squad.map((p) => p.id).sort());
      expect(after!.finances.balance).toBe(slot.finances.balance);
      expect(after!.history.length).toBe(slot.history.length);
    });
  });

  it(`plays on for ${SEASONS} seasons without stopping`, () => {
    const lines: string[] = [];
    for (const [i, slot] of loaded.entries()) {
      if (!slot) continue;
      const from = `S${slot.clock.seasonIndex} d${slot.clock.day}`;
      const career = playArcCareer({
        region: slot.identity.region,
        difficulty: slot.difficulty,
        policy: "autopilot",
        seed: slot.careerSeed,
        seasons: SEASONS,
        budgetMs: 600_000,
        startFrom: structuredClone(slot),
      });
      const last = career.seasons[career.seasons.length - 1];
      lines.push(
        `slot ${i}: ${slot.identity.region} ${slot.difficulty}, created on ${slot.createdAtAppVersion}, from ${from} -> ` +
          `${career.seasons.length} seasons played, last S${last?.seasonIndex ?? "-"}, ended=${career.ended ?? "no"}, softlock=${career.softlock ?? "none"}`,
      );
      expect(career.softlock, lines[lines.length - 1]).toBeNull();
      // A career may END (sacked / bankrupt) and that is a result, not a lock.
      if (!career.ended) expect(career.seasons.length).toBe(SEASONS);
    }
    console.log(lines.join("\n"));
    expect(lines.length).toBeGreaterThan(0);
  }, 900_000);
});
