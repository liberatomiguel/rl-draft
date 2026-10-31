/**
 * rc.36 (UX-04, R88) — the crest catalogue and the wizard's contrast guard:
 * every id saved before rc.36 parses and composes exactly as it did, the
 * procedural filler pool is frozen (filler orgs keep their crests), every
 * shape / symbol / pattern / layout renders, the curated kits never warn,
 * and a poor pick warns with a fix that clears the floor (never a block).
 */

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CAREER_CREST } from "@/config/balance";
import {
  ALL_CREST_IDS,
  ALL_PATTERN_IDS,
  ALL_SYMBOL_IDS,
  composeCrestId,
  CREST_IDS,
  CREST_KITS,
  CREST_PALETTE,
  CREST_WIZARD_PALETTE,
  WIZARD_CREST_IDS,
  WIZARD_SYMBOL_IDS,
  LAYOUT_IDS,
  parseCrestId,
  PATTERN_IDS,
  SYMBOL_IDS,
  UserCrest,
} from "./UserCrest";
import { proceduralCrestFor } from "./OrgMark";
import { contrastRatio, crestContrastOf, CREST_CARD_BG } from "./wizard/crestContrast";

const colors = { primary: "#1f3a5f", secondary: "#c9a227" };
const svg = (crestId: string, abbrev = "TST", size: "sm" | "lg" | "xl" = "xl") =>
  renderToStaticMarkup(createElement(UserCrest, { crestId, colors, abbrev, size }));

describe("crest ids (rc.36, UX-04)", () => {
  it("every pre-rc.36 id parses and composes exactly as before", () => {
    for (const id of ["shield", "badge:wolf", "hex:lion:stripes", "circle::ring", "banner"]) {
      const cfg = parseCrestId(id);
      expect(cfg.layout).toBeUndefined();
      expect(composeCrestId(cfg)).toBe(id);
    }
    expect(parseCrestId("nonsense:?:?")).toEqual({ shape: "shield", symbol: undefined, pattern: undefined, layout: undefined });
  });

  it("the new parts round-trip; the default layout is never written; unknown parts fall back", () => {
    expect(composeCrestId(parseCrestId("heater:car:hoops:band"))).toBe("heater:car:hoops:band");
    expect(composeCrestId(parseCrestId("squircle::border:stacked"))).toBe("squircle::border:stacked");
    expect(composeCrestId({ shape: "octagon", symbol: "ball", layout: "emblem" })).toBe("octagon:ball");
    expect(parseCrestId("arch:gem::sideways").layout).toBeUndefined();
    expect(parseCrestId("arch:gem::emblem")).toMatchObject({ shape: "arch", symbol: "gem" });
  });

  it("the procedural filler pool is frozen — every filler org keeps its crest", () => {
    expect(CREST_IDS).toHaveLength(14);
    expect(SYMBOL_IDS).toHaveLength(18);
    expect(PATTERN_IDS).toHaveLength(7);
    expect([CREST_IDS[0], CREST_IDS[13], SYMBOL_IDS[17], PATTERN_IDS[6]]).toEqual(["shield", "wave", "arrow", "ring"]);
    // The pool never draws an rc.36 id.
    for (let i = 0; i < 200; i++) {
      const { shape, symbol, pattern, layout } = parseCrestId(proceduralCrestFor(`fill:test-${i}`).crestId);
      expect((CREST_IDS as readonly string[]).includes(shape)).toBe(true);
      expect(symbol === undefined || (SYMBOL_IDS as readonly string[]).includes(symbol)).toBe(true);
      expect(pattern === undefined || (PATTERN_IDS as readonly string[]).includes(pattern)).toBe(true);
      expect(layout).toBeUndefined();
    }
  });

  it("curates new club options without changing retired ids or procedural colours", () => {
    expect(WIZARD_CREST_IDS.slice(0, 7)).toEqual(CREST_IDS.slice(0, 7));
    expect(WIZARD_CREST_IDS).toContain("pentagon");
    expect(WIZARD_CREST_IDS).not.toContain("wave");
    expect(WIZARD_SYMBOL_IDS).not.toContain("car");
    for (const id of ["wave:car:hoops", "notch:peak:border", "arch:wheel", "triangular:bull:yoke", "circle:jaguar:club-ring"]) {
      expect(composeCrestId(parseCrestId(id))).toBe(id);
      expect(svg(id)).not.toContain('d=""');
    }
    // Palette indexing belongs to the procedural generator, not the picker.
    expect(CREST_PALETTE).toHaveLength(22);
    expect(CREST_PALETTE[0]).toEqual({ id: "navy", hex: "#1f3a5f" });
    expect(CREST_WIZARD_PALETTE.find((c) => c.id === "black")?.hex).toBe("#000000");
    expect(new Set(CREST_WIZARD_PALETTE.map((c) => c.hex)).size).toBe(CREST_WIZARD_PALETTE.length);
    expect(CREST_WIZARD_PALETTE.filter((c) => c.id === "white")).toHaveLength(1);
    expect(CREST_WIZARD_PALETTE.some((c) => c.id === "ivory" || c.id === "cream")).toBe(false);
    // Every colour family is adjacent to its light tone, including across responsive rows.
    for (let i = 4; i < CREST_WIZARD_PALETTE.length; i += 2) {
      expect(CREST_WIZARD_PALETTE[i + 1].id).toMatch(/-light$/);
    }
  });

  it("tricolour fields retain the neutral third colour without adding save fields", () => {
    const out = svg("triangular::tricolor");
    expect(out).toContain('fill="#f5f7fa"');
    expect(out).toContain('fill="#c9a227"');
    expect(parseCrestId("triangular::tricolor")).toMatchObject({ shape: "triangular", pattern: "tricolor" });
  });

  it("every shape, symbol, pattern and layout renders", () => {
    for (const shape of ALL_CREST_IDS) {
      for (const layout of LAYOUT_IDS) {
        const out = svg(composeCrestId({ shape, symbol: "car", pattern: "border", layout }));
        expect(out).toContain("<path");
        expect(out).not.toContain('d=""');
      }
    }
    for (const symbol of ALL_SYMBOL_IDS) expect(svg(composeCrestId({ shape: "heater", symbol }))).toContain("<path");
    for (const pattern of ALL_PATTERN_IDS) expect(svg(composeCrestId({ shape: "notch", pattern }))).not.toContain('d=""');
    // The letters: stacked / band show them at a readable size only; the band itself always shows.
    expect(svg("shield:wolf::stacked")).toContain(">TST<");
    expect(svg("shield:wolf::stacked", "TST", "sm")).not.toContain(">TST<");
    expect(svg("shield:::band")).toContain(">TST<");
    expect(svg("shield:::band", "TST", "sm")).toContain("<rect");
  });
});

describe("the contrast guard (rc.36, UX-04)", () => {
  const { pairMin, cardMin } = CAREER_CREST.contrast;

  it("the WCAG ratio: symmetric, 1 for a colour on itself, 21 for black on white", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 5);
    expect(contrastRatio("#1f3a5f", "#1f3a5f")).toBe(1);
  });

  it("presets never warn: every curated kit clears both floors", () => {
    for (const k of CREST_KITS) {
      const g = crestContrastOf({ primary: k.primary, secondary: k.secondary });
      expect(g.pairOk, k.id).toBe(true);
      expect(g.cardOk, k.id).toBe(true);
    }
  });

  it("a same-family pair warns and suggests an accent that clears the floor; the pick is never changed", () => {
    const pick = { primary: "#f2efe3", secondary: "#e8dfc8" }; // ivory on cream
    const g = crestContrastOf(pick);
    expect(g.pairOk).toBe(false);
    expect(g.fixAccent).not.toBeNull();
    expect(contrastRatio(pick.primary, g.fixAccent!.hex)).toBeGreaterThanOrEqual(pairMin);
    expect(pick).toEqual({ primary: "#f2efe3", secondary: "#e8dfc8" });
  });

  it("a near-black base warns on the card, with a base that clears it and keeps the accent readable, or the swap", () => {
    const pick = { primary: "#111111", secondary: "#c9a227" };
    const g = crestContrastOf(pick);
    expect(g.cardOk).toBe(false);
    expect(g.fixPrimary).not.toBeNull();
    expect(contrastRatio(g.fixPrimary!.hex, CREST_CARD_BG)).toBeGreaterThanOrEqual(cardMin);
    expect(contrastRatio(g.fixPrimary!.hex, pick.secondary)).toBeGreaterThanOrEqual(pairMin);
    expect(g.swapFixes).toBe(true);
  });
});
