import { describe, expect, it } from "vitest";
import lineupsJson from "@/data/lineups.json";
import { PAGES_EN, PAGES_PT, REGION_PAGES } from "@/content/pages";
import type { PageSlug } from "@/content/pageRoutes";
import { DB_LINEUPS, DB_PLAYERS, DB_REGIONS, DB_SEASONS, DB_TEAMS, dbPlayer, dbSeason, dbTeam, regionFacts } from "./database";

/**
 * The public RLCS database (v2.0, WEB-01). Dataset-agnostic: it checks the
 * shape and the rules (what stays private, URL safety, cross-links), never a
 * particular team or player.
 */
type Raw = { id: string; national?: boolean; rareSpawn?: boolean };
const raw = lineupsJson as Raw[];

describe("public database", () => {
  it("keeps national teams and the rare spawn out (they are collectibles)", () => {
    const hidden = new Set(raw.filter((l) => l.national || l.rareSpawn).map((l) => l.id));
    expect(hidden.size).toBeGreaterThan(0);
    for (const l of DB_LINEUPS) expect(hidden.has(l.id), l.id).toBe(false);
    // Everything else is shown.
    expect(DB_LINEUPS.length).toBe(raw.length - hidden.size);
  });

  it("every URL segment is safe and unique within its kind", () => {
    const safe = /^[a-z0-9][a-z0-9-]*$/;
    for (const [kind, ids] of [
      ["season", DB_SEASONS.map((s) => s.slug)],
      ["team", DB_TEAMS.map((t) => t.id)],
      ["player", DB_PLAYERS.map((p) => p.id)],
    ] as const) {
      expect(new Set(ids).size, kind).toBe(ids.length);
      for (const id of ids) expect(safe.test(id), `${kind} ${id}`).toBe(true);
    }
    // /rlcs/teams and /rlcs/players are static routes beside /rlcs/[season].
    expect(DB_SEASONS.some((s) => s.slug === "teams" || s.slug === "players")).toBe(false);
  });

  it("every link a page renders resolves to a page", () => {
    for (const l of DB_LINEUPS) {
      expect(dbSeason(l.season.slug), l.id).toBeDefined();
      expect(dbTeam(l.team.id), l.id).toBeDefined();
      for (const p of l.players) expect(dbPlayer(p.id), `${l.id} ${p.id}`).toBeDefined();
      expect(l.players.length).toBeGreaterThan(0);
      expect(l.average).toBeGreaterThan(0);
    }
    for (const p of DB_PLAYERS) {
      expect(p.entries.length, p.id).toBeGreaterThan(0);
      expect(p.peak).toBe(Math.max(...p.entries.map((e) => e.overall)));
    }
    for (const t of DB_TEAMS) expect(DB_REGIONS, t.id).toContain(t.region);
  });

  it("seasons run oldest first and every roster belongs to one", () => {
    const orders = DB_SEASONS.map((s) => s.order);
    expect([...orders].sort((a, b) => a - b)).toEqual(orders);
    expect(DB_SEASONS.reduce((n, s) => n + s.lineups.length, 0)).toBe(DB_LINEUPS.length);
  });
});

describe("regional pages", () => {
  it("every regional page's numbers come from the database", () => {
    for (const [slug, region] of Object.entries(REGION_PAGES) as [PageSlug, string][]) {
      const facts = regionFacts(region);
      expect(Number(facts.lineups), region).toBeGreaterThan(0);
      expect(facts.topOrgs.length, region).toBeGreaterThan(0);
      for (const pages of [PAGES_EN, PAGES_PT]) {
        const text = JSON.stringify(pages[slug]);
        expect(text, `${slug} tokens`).not.toMatch(/\{[\w.]+\}/);
        expect(text, `${slug} lineup count`).toContain(facts.lineups);
      }
    }
  });
});
