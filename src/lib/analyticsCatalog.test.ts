/**
 * The 2.0 analytics catalogue is the contract: this fails when the code emits
 * an event that is not in it, when a payload misses a required property, and
 * when the catalogue itself drifts from its rules (scalars, no personal data,
 * the volume design: nothing per pick, per run start or per day advanced).
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CAREER_TABS, catalogProblems, EVENT_CATALOG, isCatalogEvent, ONBOARDING_STEPS } from "./analyticsCatalog";

const srcDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Every non-test source file under src/. */
function sources(): { file: string; text: string }[] {
  const out: { file: string; text: string }[] = [];
  for (const rel of readdirSync(srcDir, { recursive: true }) as string[]) {
    if (!/\.(ts|tsx)$/.test(rel) || /\.test\.tsx?$/.test(rel)) continue;
    out.push({ file: rel.replace(/\\/g, "/"), text: readFileSync(join(srcDir, rel), "utf8") });
  }
  return out;
}

/** Event names the 2.0 design removed: they must never come back as events. */
const REMOVED = [
  "run_started",
  "tournament_started",
  "special_used",
  "ux_tutorial",
  "ux_unlock_seen",
  "ux_contract_warning",
  "ux_sunday_briefing",
  "career_scout_report",
  "career_training_plan",
];

describe("the catalogue", () => {
  it("lists the 2.0 events, and none of the ones the budget design removed", () => {
    expect(Object.keys(EVENT_CATALOG).sort()).toEqual(
      [
        "account_signed_in",
        "account_sync_failed",
        "achievement_unlocked",
        "career_created",
        "career_ended",
        "career_event_completed",
        "career_milestone",
        "career_season_completed",
        "career_split_summary",
        "career_staff",
        "career_transfer",
        "challenge_played",
        "collection_milestone",
        "mission_completed",
        "onboarding_step",
        "quality_duplicate_reward",
        "quality_error",
        "quality_event_cap",
        "quality_migration",
        "quality_save_error",
        "quality_slow_advance",
        "quiz_played",
        "rank_up",
        "run_abandoned",
        "run_completed",
        "session_started",
        "special_discovered",
        "unlock_granted",
      ].sort(),
    );
    for (const name of REMOVED) expect(isCatalogEvent(name), name).toBe(false);
  });

  it("every property is a scalar kind, and none can hold personal data or free text", () => {
    const kinds = new Set(["string", "number", "boolean", "string?", "number?", "boolean?"]);
    const personal = /name|email|mail|user(name)?$|manager|org(name)?$|abbrev|title$|text|country|nickname|ip$/i;
    const allowed = new Set(["equippedTitle", "equippedBanner", "equippedBadge", "name"]); // cosmetic ids; `name` = the error class of quality_error
    for (const [event, spec] of Object.entries(EVENT_CATALOG)) {
      expect(Object.keys(spec.props).length, event).toBeGreaterThan(0);
      for (const [prop, kind] of Object.entries(spec.props)) {
        expect(kinds.has(kind), `${event}.${prop}`).toBe(true);
        if (!allowed.has(prop)) expect(personal.test(prop), `${event}.${prop} looks personal`).toBe(false);
      }
    }
    expect(Object.keys(EVENT_CATALOG.quality_error.props)).toContain("name");
  });

  it("career events carry careerId and actionId; the tab counters match the tab list", () => {
    for (const [event, spec] of Object.entries(EVENT_CATALOG)) {
      if (!event.startsWith("career_")) continue;
      expect(spec.mode, event).toBe("career");
      expect(spec.props, event).toMatchObject({ careerId: "string", actionId: "string" });
    }
    const tabProps = Object.keys(EVENT_CATALOG.career_event_completed.props).filter((p) => p.startsWith("tab_"));
    expect(tabProps.sort()).toEqual(CAREER_TABS.map((t) => `tab_${t}`).sort());
    expect(new Set(ONBOARDING_STEPS).size).toBe(ONBOARDING_STEPS.length);
  });

  it("the volume events are standard, and everything rare is critical (never sampled)", () => {
    const standard = Object.entries(EVENT_CATALOG)
      .filter(([, spec]) => spec.priority === "standard")
      .map(([name]) => name)
      .sort();
    expect(standard).toEqual(
      [
        "achievement_unlocked",
        "career_event_completed",
        "challenge_played",
        "mission_completed",
        "quiz_played",
        "run_abandoned",
        "run_completed",
        "special_discovered",
        "unlock_granted",
      ].sort(),
    );
  });
});

describe("catalogProblems", () => {
  const card = { specialId: "s", rarity: "epic", national: false, mode: "classic" };

  it("accepts a payload that matches, with optional properties absent or null", () => {
    expect(catalogProblems("special_discovered", card)).toEqual([]);
    expect(catalogProblems("collection_milestone", { kind: "national_team_found", id: "nt-br" })).toEqual([]);
    expect(catalogProblems("collection_milestone", { kind: "album_completed", id: "nt-br", albumsCompleted: null })).toEqual([]);
  });

  it("names an unknown event, a missing or null required property, a wrong type, a non-finite number and an unlisted property", () => {
    expect(catalogProblems("special_used", card)).toEqual(['"special_used" is not in the analytics catalogue']);
    expect(catalogProblems("special_discovered", { ...card, mode: undefined })).toEqual(["special_discovered.mode is required (string)"]);
    expect(catalogProblems("special_discovered", { ...card, mode: null })).toEqual(["special_discovered.mode is required (string)"]);
    expect(catalogProblems("special_discovered", { ...card, national: 1 })).toEqual(["special_discovered.national must be a boolean, got number"]);
    expect(catalogProblems("rank_up", { rankId: "gold", rankIndex: Number.NaN, xp: 1 })).toEqual(["rank_up.rankIndex must be a finite number"]);
    expect(catalogProblems("special_discovered", { ...card, title: "x" })).toEqual(["special_discovered.title is not in the catalogue"]);
  });
});

describe("the code only emits catalogue events", () => {
  const files = sources();

  it('every trackEvent("…") and every built event name is in the catalogue', () => {
    const found = new Map<string, string[]>();
    const note = (name: string, file: string) => found.set(name, [...(found.get(name) ?? []), file]);
    for (const { file, text } of files) {
      for (const [, name] of text.matchAll(/\btrackEvent\(\s*["'`]([^"'`]+)["'`]/g)) note(name, file);
      // Events built as `{ name: "…", props: … }` (careerAnalytics, profileAnalytics).
      for (const [, name] of text.matchAll(/\bname:\s*["']([a-z]+_[a-z_]+)["'](?:\s+as\s+const)?\s*,\s*props\b/g)) note(name, file);
    }
    expect(found.size).toBeGreaterThan(15);
    for (const [name, where] of found) expect(isCatalogEvent(name), `${name} (${where.join(", ")})`).toBe(true);
  });

  it("every catalogue event is emitted somewhere (no dead entries)", () => {
    const all = files.filter(({ file }) => file !== "lib/analyticsCatalog.ts").map(({ text }) => text).join("\n");
    for (const name of Object.keys(EVENT_CATALOG)) {
      expect(new RegExp(`["'\`]${name}["'\`]`).test(all), name).toBe(true);
    }
  });

  it("no removed event name is still sent", () => {
    for (const { file, text } of files) {
      if (file === "lib/analyticsCatalog.ts") continue;
      for (const name of REMOVED) {
        expect(new RegExp(`trackEvent\\(\\s*["']${name}["']|name:\\s*["']${name}["']`).test(text), `${name} in ${file}`).toBe(false);
      }
    }
  });

  it("analytics is fired from the stores and the analytics layer only — never from the engine", () => {
    for (const { file, text } of files) {
      if (!file.startsWith("engine/")) continue;
      expect(/from\s+["']@\/lib\/analytics["']/.test(text), file).toBe(false);
    }
  });
});
