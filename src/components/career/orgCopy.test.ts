import { describe, expect, it } from "vitest";
import { CAREER_EN } from "@/content/copy.career.en";
import { CAREER_PT } from "@/content/copy.career.pt";
import { mergeWords, orgCopyFor } from "./orgCopy";

/** Every leaf path of a tree, with its value. */
function leaves(t: unknown, prefix = ""): [string, unknown][] {
  if (typeof t !== "object" || t === null || Array.isArray(t)) return [[prefix, t]];
  return Object.entries(t).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k));
}

function at(t: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), t);
}

describe("orgCopy (ORGMODE UI-C)", () => {
  for (const [lang, C] of [["en", CAREER_EN], ["pt", CAREER_PT]] as const) {
    it(`${lang}: every established-org word replaces a string of the same kind at the same path`, () => {
      for (const [path, v] of leaves(C.orgmode.words)) {
        const base = at(C, path);
        expect(base, path).toBeDefined();
        expect(typeof v, path).toBe(typeof base);
      }
    });

    it(`${lang}: no established-org word speaks of reputation`, () => {
      for (const [path, v] of leaves(C.orgmode.words)) {
        const text = typeof v === "function" ? String((v as (...a: unknown[]) => unknown)(3, 5)) : String(v);
        expect(text.toLowerCase(), path).not.toMatch(/reputation|reputação/);
      }
    });
  }

  it("a founded club reads the copy itself; an established org reads the words", () => {
    expect(orgCopyFor(CAREER_EN, false)).toBe(CAREER_EN);
    const E = orgCopyFor(CAREER_EN, true);
    expect(E.common.rep).toBe("Standing");
    // rc9 org (R222): the standing is a word at an established org, never a figure.
    expect(E.goals.reward(1)).toBe("Lifts the org's standing at the review");
    expect(E.common.ovr).toBe(CAREER_EN.common.ovr);
    expect(orgCopyFor(CAREER_EN, true)).toBe(E);
  });

  it("merges only paths that exist", () => {
    expect(mergeWords({ a: { b: 1, c: 2 } }, { a: { b: 3, z: 9 } })).toEqual({ a: { b: 3, c: 2 } });
  });
});
