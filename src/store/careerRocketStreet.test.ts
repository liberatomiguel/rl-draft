/**
 * Season 1 (R133) — Rocket Street reaches a South American career from its
 * first season: the championship is on the calendar on the season's partner
 * weeks (it used to wait for the invitational gate, a new org's third
 * season) and the desk files news through the year. One real season through
 * the flow functions; the long measure is `careerRocketStreet.probe.test.ts`.
 */
import { describe, expect, it } from "vitest";
import { CAREER_UNOFFICIAL } from "@/config/balance";
import { ROCKET_STREET_EVENT_NAME } from "@/data/career/names";
import { rocketStreetCupWeeksFor, weekOfDay } from "@/engine/career/calendar";
import { ROCKET_STREET_KEYS, rocketStreetSigns } from "@/engine/career/rocketStreet";
import type { NewsItem } from "@/engine/career/types";
import { playArcCareer } from "./careerArcBot";

describe("Rocket Street in a SAM career's first season", () => {
  it(
    "offers and plays the championship on its weeks and files the desk's stories",
    () => {
      const offeredWeeks = new Set<number>();
      const played: string[] = [];
      const news = new Map<string, NewsItem>();
      let maxRep = 0;
      const career = playArcCareer({
        region: "SAM",
        difficulty: "normal",
        policy: "autopilot",
        seed: 9100,
        seasons: 1,
        budgetMs: 600_000,
        onDay: (save) => {
          maxRep = Math.max(maxRep, save.reputation);
          if (save.unofficialOffer?.name === ROCKET_STREET_EVENT_NAME) offeredWeeks.add(weekOfDay(save.clock.day));
          for (const n of save.news) if (rocketStreetSigns(n)) news.set(n.id, n);
        },
        onEvent: (save) => {
          const def = save.activeEvent?.def;
          if (def?.name === ROCKET_STREET_EVENT_NAME) played.push(`${def.tier}:${def.week}:${def.teamSize ?? 3}`);
        },
      });
      expect(career.softlock).toBeNull();
      // The whole first season is played below the invitational gate — the case that never saw the event.
      expect(maxRep).toBeLessThan(CAREER_UNOFFICIAL.t2RepGate);
      const weeks = [...rocketStreetCupWeeksFor(0)].sort((a, b) => a - b);
      expect([...offeredWeeks].sort((a, b) => a - b)).toEqual(weeks);
      expect(played).toEqual(weeks.map((w) => `t3:${w}:3`));

      const keys = [...news.values()].map((n) => n.titleKey);
      const count = (key: string) => keys.filter((k) => k === key).length;
      expect(count("rsCupPreview")).toBe(weeks.length);
      expect(count("rsCupRecap")).toBe(weeks.length);
      expect(count("rsBerths")).toBe(3); // the three Majors (Season X has no Worlds)
      expect(count("rsRegionalRecap")).toBeGreaterThan(0);
      expect(count("rsWindowWrap")).toBeGreaterThan(0);
      // Regular, never the whole feed: the desk's own stories this season.
      const desk = keys.filter((k) => ROCKET_STREET_KEYS.has(k)).length;
      expect(desk).toBeGreaterThanOrEqual(8);
      expect(desk).toBeLessThanOrEqual(24);
      // Every story carries the region and a line the copy has.
      for (const n of news.values()) if (ROCKET_STREET_KEYS.has(n.titleKey)) {
        expect(n.params?.region).toBe("SAM");
        expect([0, 1, 2]).toContain(n.params?.v);
      }
    },
    600_000,
  );
});
