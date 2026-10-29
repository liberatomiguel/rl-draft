/**
 * rc.32 (WEB-02, #149): the production URL helpers that cut a run's requests —
 * every flag as a cell of one sprite, and a loaded wide logo serving the
 * smaller sizes of the same org. assets.ts picks dev or production paths when
 * it loads, so each production case imports a fresh copy under
 * NODE_ENV=production.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import manifest from "@/generated/asset-manifest.json";

type Assets = typeof import("./assets");

async function load(env: "production" | "test"): Promise<Assets> {
  vi.resetModules();
  vi.stubEnv("NODE_ENV", env);
  return import("./assets");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

const sprite = manifest.flagSprite;
const someOrg = Object.keys(manifest.orgs).find((k) => !k.includes("@"))!;
const eraOrg = Object.keys(manifest.orgs).find((k) => k.includes("@"));

describe("flag sprite", () => {
  it("is in the committed manifest and fits CountryChip's 18 × 12 CSS px flag box", () => {
    expect(sprite).toBeDefined();
    expect(sprite.hash).toMatch(/^[0-9a-f]{10}$/);
    expect(sprite.cell[0] / sprite.density).toBe(18);
    expect(sprite.cell[1] / sprite.density).toBe(12);
  });

  it("places every flag in its own cell, in manifest order (production)", async () => {
    const { flagSprite } = await load("production");
    const pitch = (sprite.cell[0] + 2 * sprite.gutter) / sprite.density;
    manifest.flags.forEach((cc, i) => {
      const cell = flagSprite(cc.toUpperCase());
      expect(cell).toEqual({
        src: `/img/flags/flags.${sprite.hash}.png`,
        left: i * pitch + sprite.gutter / sprite.density,
        top: sprite.gutter / sprite.density,
        width: manifest.flags.length * pitch,
        height: (sprite.cell[1] + 2 * sprite.gutter) / sprite.density,
      });
    });
  });

  it("has no cell for a region code or an unknown country (the text chip, no request)", async () => {
    const { flagSprite, flagSrc } = await load("production");
    for (const code of ["NA", "EU", "OCE", "SAM", "MENA", "XX"]) {
      expect(flagSprite(code)).toBeNull();
      expect(flagSrc(code)).toBeNull();
    }
  });

  it("is off in dev: the raw PNGs show", async () => {
    const { flagSprite, flagSrc } = await load("test");
    expect(flagSprite("br")).toBeNull();
    expect(flagSrc("BR")).toBe("/flags/br.png");
  });
});

describe("org logos reuse a wider variant that has loaded", () => {
  const [small, large] = manifest.widths.orgs;

  it("serves a small logo from the loaded large file of the same org only", async () => {
    const { orgLogoSrc, noteOrgLogoLoaded } = await load("production");
    const hash = manifest.orgs[someOrg as keyof typeof manifest.orgs];
    expect(orgLogoSrc(someOrg, 24)).toBe(`/img/orgs/${someOrg}.${hash}.${small}.webp`);
    noteOrgLogoLoaded(orgLogoSrc(someOrg, 72)!);
    expect(orgLogoSrc(someOrg, 24)).toBe(`/img/orgs/${someOrg}.${hash}.${large}.webp`);
    expect(orgLogoSrc(someOrg, 16)).toBe(`/img/orgs/${someOrg}.${hash}.${large}.webp`);
    const other = Object.keys(manifest.orgs).find((k) => k !== someOrg && !k.includes("@"))!;
    expect(orgLogoSrc(other, 24)).toContain(`.${small}.webp`);
  });

  it("never serves a large logo from a small file", async () => {
    const { orgLogoSrc, noteOrgLogoLoaded } = await load("production");
    noteOrgLogoLoaded(orgLogoSrc(someOrg, 24)!);
    expect(orgLogoSrc(someOrg, 72)).toContain(`.${large}.webp`);
    expect(orgLogoSrc(someOrg, 24)).toContain(`.${small}.webp`);
  });

  it("reads era keys back from their encoded URL and ignores other URLs", async () => {
    const { orgLogoSrc, noteOrgLogoLoaded } = await load("production");
    noteOrgLogoLoaded("/img/badges/x.0123456789.96.webp");
    noteOrgLogoLoaded("not a url");
    expect(orgLogoSrc(someOrg, 24)).toContain(`.${small}.webp`);
    if (eraOrg) {
      const big = orgLogoSrc(eraOrg, 88)!;
      expect(big).toContain("%40");
      noteOrgLogoLoaded(big);
      expect(orgLogoSrc(eraOrg, 16)).toBe(big);
    }
  });
});
