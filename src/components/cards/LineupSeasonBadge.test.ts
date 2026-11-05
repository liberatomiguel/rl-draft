import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { EN } from "@/content/copy.en";
import { PT } from "@/content/copy.pt";
import { LineupSeasonBadge } from "./LineupSeasonBadge";

const dict = vi.hoisted(() => ({ lang: "en" as "en" | "pt" }));
vi.mock("@/content/copy", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/content/copy")>();
  const { EN: en } = await import("@/content/copy.en");
  const { PT: pt } = await import("@/content/copy.pt");
  return { ...mod, useCopy: () => dict.lang === "pt" ? pt : en };
});

describe("draft offer — unambiguous season identity", () => {
  const render = (seasonLabel: string, year?: string) => renderToStaticMarkup(createElement(LineupSeasonBadge, { seasonLabel, year }));

  it("shows the complete 2027 edition without repeating its year", () => {
    dict.lang = "en";
    const html = render("RLCS 2027", "2027");
    expect(html).toContain(EN.DRAFT_UI.lineupSeason);
    expect(html).toContain("RLCS 2027");
    expect(html.match(/2027/g)).toHaveLength(1);
  });

  it("distinguishes two early seasons in the same calendar year", () => {
    dict.lang = "en";
    const first = render("RLCS Season 1", "2016");
    const second = render("RLCS Season 2", "2016");
    expect(first).toContain("RLCS Season 1");
    expect(second).toContain("RLCS Season 2");
    expect(first).toContain("2016");
    expect(second).toContain("2016");
    expect(first).not.toBe(second);
  });

  it("localizes the label and retains the complete edition in PT", () => {
    dict.lang = "pt";
    const html = render("RLCS 2022-23", "2022-23");
    expect(html).toContain(PT.DRAFT_UI.lineupSeason);
    expect(html).not.toContain(EN.DRAFT_UI.lineupSeason);
    expect(html.match(/2022-23/g)).toHaveLength(1);
  });
});
