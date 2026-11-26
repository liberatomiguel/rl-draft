/**
 * v2.1.0-rc.2/rc.3: every Etapa 1 flag (Matchday styles, decisions and box
 * score, Mundo vivo) and, since v2.2, the Pro career are ON in the staging build only. The staging Worker
 * builds with NEXT_PUBLIC_NOINDEX=1; production, the playtest Worker, dev and
 * tests must keep them all OFF.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

const FLAGS = ["matchdayStyles", "worldLife", "matchdayDecisions", "matchdayBoxScore", "proCareer", "realOrgStart", "board", "endlessVariety"] as const;
const PROBE_VARS = [
  "NEXT_PUBLIC_MATCHDAY_STYLES",
  "NEXT_PUBLIC_WORLD_LIFE",
  "NEXT_PUBLIC_MATCHDAY_DECISIONS",
  "NEXT_PUBLIC_MATCHDAY_BOXSCORE",
  "NEXT_PUBLIC_PRO_CAREER",
  "NEXT_PUBLIC_REAL_ORG_START",
  "NEXT_PUBLIC_BOARD",
  "NEXT_PUBLIC_ENDLESS_VARIETY",
];

type Build = { nodeEnv: string; noindex?: string; playtest?: string };

async function featuresFor(build: Build) {
  vi.resetModules();
  vi.stubEnv("NODE_ENV", build.nodeEnv);
  vi.stubEnv("NEXT_PUBLIC_NOINDEX", build.noindex ?? "");
  vi.stubEnv("NEXT_PUBLIC_PLAYTEST", build.playtest ?? "");
  for (const v of PROBE_VARS) vi.stubEnv(v, "");
  const { FEATURES, STAGING_BUILD } = await import("./balance");
  return { staging: STAGING_BUILD, ...Object.fromEntries(FLAGS.map((f) => [f, FEATURES[f]])) };
}

const all = (on: boolean) => ({ staging: on, ...Object.fromEntries(FLAGS.map((f) => [f, on])) });

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("Etapa 1 flags: staging only", () => {
  it("are OFF in a production build", async () => {
    expect(await featuresFor({ nodeEnv: "production" })).toEqual(all(false));
  });

  it("are OFF in the playtest build (it also sets NOINDEX)", async () => {
    expect(await featuresFor({ nodeEnv: "production", noindex: "1", playtest: "1" })).toEqual(all(false));
  });

  it("are OFF in dev and tests, even with NOINDEX", async () => {
    expect(await featuresFor({ nodeEnv: "development", noindex: "1" })).toEqual(all(false));
    expect(await featuresFor({ nodeEnv: "test" })).toEqual(all(false));
  });

  it("are ON in the staging build (NEXT_PUBLIC_NOINDEX=1)", async () => {
    expect(await featuresFor({ nodeEnv: "production", noindex: "1" })).toEqual(all(true));
  });

  it("match analytics' own idea of staging", async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_NOINDEX", "1");
    vi.stubEnv("NEXT_PUBLIC_PLAYTEST", "");
    const { analyticsEnvironment } = await import("@/lib/analytics");
    const { STAGING_BUILD } = await import("./balance");
    expect(analyticsEnvironment()).toBe("staging");
    expect(STAGING_BUILD).toBe(true);
  });
});
