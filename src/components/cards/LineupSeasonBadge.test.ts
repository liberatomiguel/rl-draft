import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LineupSeasonBadge } from "./LineupSeasonBadge";

describe("draft season tag", () => {
  const render = (seasonLabel: string, year?: string) => renderToStaticMarkup(createElement(LineupSeasonBadge, { seasonLabel, year, newLabel: "NEW" }));
  it("identifies 2027 once without the removed kicker", () => {
    const html = render("RLCS 2027", "2027");
    expect(html.match(/2027/g)).toHaveLength(1);
    expect(html).not.toContain("Lineup season");
    expect(html).toContain("NEW");
    expect(render("RLCS 2026", "2026")).not.toContain("NEW");
  });
  it("keeps editions from the same year distinct", () => {
    const first = render("RLCS Season 1", "2016");
    const second = render("RLCS Season 2", "2016");
    expect(first).toContain("2016");
    expect(second).toContain("2016");
    expect(first).not.toBe(second);
  });
  it("retains multi-year edition names without repeating years", () => {
    expect(render("RLCS 2022-23", "2022-23").match(/2022-23/g)).toHaveLength(1);
  });
});
