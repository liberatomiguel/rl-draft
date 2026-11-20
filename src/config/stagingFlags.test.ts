/**
 * v2.1.0-rc.2: Matchday styles (fatia 2) and Mundo vivo M1 are ON in the
 * staging build only. The staging Worker builds with NEXT_PUBLIC_NOINDEX=1;
 * production, the playtest Worker, dev and tests must keep both OFF.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

type Build = { nodeEnv: string; noindex?: string; playtest?: string };

async function featuresFor(build: Build) {
  vi.resetModules();
  vi.stubEnv("NODE_ENV", build.nodeEnv);
  vi.stubEnv("NEXT_PUBLIC_NOINDEX", build.noindex ?? "");
  vi.stubEnv("NEXT_PUBLIC_PLAYTEST", build.playtest ?? "");
  vi.stubEnv("NEXT_PUBLIC_MATCHDAY_STYLES", "");
  vi.stubEnv("NEXT_PUBLIC_WORLD_LIFE", "");
  const { FEATURES, STAGING_BUILD } = await import("./balance");
  return { matchdayStyles: FEATURES.matchdayStyles, worldLife: FEATURES.worldLife, staging: STAGING_BUILD };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("Etapa 1 flags: staging only", () => {
  it("are OFF in a production build", async () => {
    expect(await featuresFor({ nodeEnv: "production" })).toEqual({ matchdayStyles: false, worldLife: false, staging: false });
  });

  it("are OFF in the playtest build (it also sets NOINDEX)", async () => {
    expect(await featuresFor({ nodeEnv: "production", noindex: "1", playtest: "1" })).toEqual({
      matchdayStyles: false,
      worldLife: false,
      staging: false,
    });
  });

  it("are OFF in dev and tests, even with NOINDEX", async () => {
    expect(await featuresFor({ nodeEnv: "development", noindex: "1" })).toEqual({ matchdayStyles: false, worldLife: false, staging: false });
    expect(await featuresFor({ nodeEnv: "test" })).toEqual({ matchdayStyles: false, worldLife: false, staging: false });
  });

  it("are ON in the staging build (NEXT_PUBLIC_NOINDEX=1)", async () => {
    expect(await featuresFor({ nodeEnv: "production", noindex: "1" })).toEqual({ matchdayStyles: true, worldLife: true, staging: true });
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
