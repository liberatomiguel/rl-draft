/**
 * v2.2 Pro (PRO-SPEC §4.1 targets, R150): a bot plays twelve seasons on the
 * pure modules (lifecycleBot.ts: real regional weeks from the calendar, three
 * games a series, ten seeds per profile) and the bands of the spec become
 * tests, loose enough for seed noise. The final check comes later on the real
 * flow (slice 7 battery).
 *
 *   high talent, managed   peak 96-99   (median band 95-99.5)
 *   average, managed       peak 90-93   (median band 90-94.5)
 *   average, careless      peak 82-86   (median band 81.5-87): on a team, plays its series and
 *                          scrims, spends his own blocks on content with no rest
 *   Grand Champion         50-80 weeks (age ~15)
 *   managed average at 16  78-84        (the level at which an org signs him)
 *   peak age               not before 20
 */

import { describe, expect, it } from "vitest";
import { median, playBotCareer, type BotOptions } from "./lifecycleBot";

const SEEDS = Array.from({ length: 10 }, (_, i) => 1000 + i * 37);
const runs = (opt: BotOptions) => SEEDS.map((s) => playBotCareer(s, opt));

describe("Pro lifecycle bot (spec 4.1 targets)", () => {
  const high = runs({ talent: 1.2, behaviour: "managed", coach: 85 });
  const avg = runs({ talent: 1.0, behaviour: "managed", coach: 85 });
  const avgNoCoach = runs({ talent: 1.0, behaviour: "managed" });
  const careless = runs({ talent: 1.0, behaviour: "careless", coach: 85 });
  const med = (rs: typeof high, k: "peak" | "at16" | "weeksToGc" | "peakAge") => median(rs.map((r) => r[k]));

  it("high talent, well managed, peaks at 96-99", () => {
    expect(med(high, "peak")).toBeGreaterThanOrEqual(95);
    expect(med(high, "peak")).toBeLessThanOrEqual(99.5);
    for (const r of high) expect(r.peak).toBeLessThanOrEqual(99);
  });

  it("average talent, well managed, peaks at 90-93 and the same career run carelessly peaks at 82-86", () => {
    expect(med(avg, "peak")).toBeGreaterThanOrEqual(90);
    expect(med(avg, "peak")).toBeLessThanOrEqual(94.5);
    expect(med(careless, "peak")).toBeGreaterThanOrEqual(81.5);
    expect(med(careless, "peak")).toBeLessThanOrEqual(87);
    expect(med(high, "peak")).toBeGreaterThan(med(avg, "peak") + 2);
    expect(med(avg, "peak")).toBeGreaterThan(med(careless, "peak") + 4);
  });

  it("a sensible Pro reaches Grand Champion in 50-80 weeks, and a managed average Pro is 78-84 at 16", () => {
    expect(med(avg, "weeksToGc")).toBeGreaterThanOrEqual(50);
    expect(med(avg, "weeksToGc")).toBeLessThanOrEqual(80);
    expect(Math.max(...avg.map((r) => r.weeksToGc))).toBeLessThanOrEqual(95);
    expect(med(avg, "at16")).toBeGreaterThanOrEqual(78);
    expect(med(avg, "at16")).toBeLessThanOrEqual(84);
  });

  it("nobody peaks before 20", () => {
    for (const r of [...high, ...avg, ...careless]) expect(r.peakAge).toBeGreaterThanOrEqual(20);
  });

  it("the org's coach matters, but less than how the Pro plays: 85 vs none moves the peak under 1.5", () => {
    const d = med(avg, "peak") - med(avgNoCoach, "peak");
    expect(d).toBeGreaterThanOrEqual(0);
    expect(d).toBeLessThan(1.5);
  });

  it("is deterministic", () => {
    expect(playBotCareer(7, { talent: 1, behaviour: "managed", coach: 85 })).toEqual(playBotCareer(7, { talent: 1, behaviour: "managed", coach: 85 }));
  });
}, 120_000);
