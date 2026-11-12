import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { COSMETICS, cosmeticById } from "@/data/cosmetics";
import { TIER_ACCENT, TIER_RING, TitleTag } from "./CosmeticViews";

describe("manual title art is independent of Exclusive rarity", () => {
  it("retains the previous Epic stroke/effects and original brand colours", () => {
    const originals = [
      ["grant-title-early-supporter", "#ff9ec0", "#ffd1e1", "#ff4d8d"],
      ["grant-title-supporter", "#e8356d", "#ff7aa2", "#e8356d"],
      ["grant-title-contributor", "#19d290", "#7ef0c0", "#00d1d1"],
      ["grant-title-pro", "#aef7ff", "#e0fbff", "#43afff"],
    ];
    for (const [id, first, second, glow] of originals) {
      const title = cosmeticById.get(id)!;
      expect(title.tier).toBe("exclusive");
      const html = renderToStaticMarkup(React.createElement(TitleTag, { title }));
      expect(html).toContain("cos-title-epic");
      expect(html).not.toContain("cos-title-exclusive");
      expect(html).toContain(`--cos-c1:${first}`);
      expect(html).toContain(`--cos-c2:${second}`);
      expect(html).toContain(`--cos-glow:${glow}`);
      expect(html).toContain('data-motion="full"');
    }
  });

  // rc.51: the Staff title is gone (the badge stays); Creator takes a reserved fuchsia.
  it("uses the reserved fuchsia for Creator with the same stroke/effects", () => {
    expect(cosmeticById.has("grant-title-50-50-staff")).toBe(false);
    const title = cosmeticById.get("grant-title-creator")!;
    expect(title.kind === "title" && title.style.colors).toEqual(["#e23cff", "#f6b3ff"]);
    const html = renderToStaticMarkup(React.createElement(TitleTag, { title }));
    expect(html).toContain("cos-title-epic");
    expect(html).toContain("--cos-glow:#b312e6");
    expect(html).not.toContain("cos-title-soft");
  });

  // rc.52: the epics earned by playing are drawn a step quieter than the gold
  // epics, the Grand Champion red and the manual grants.
  it("draws the five play-earned epic titles with the soft treatment, and only those", () => {
    const softIds = ["login-title-daily-driver", "rank-title-rocketeer", "career-title-day-one", "challenge-title-globetrotter", "challenge-title-titanbreaker"];
    for (const c of COSMETICS) {
      if (c.kind !== "title") continue;
      const html = renderToStaticMarkup(React.createElement(TitleTag, { title: c }));
      expect(html.includes("cos-title-soft"), c.id).toBe(softIds.includes(c.id));
      if (softIds.includes(c.id)) expect(c.tier).toBe("epic");
    }
  });

  it("distinguishes the rarity colour from Epic without recolouring the title", () => {
    expect(TIER_ACCENT.exclusive).toBe("#22d3ee");
    expect(TIER_ACCENT.exclusive).not.toBe(TIER_ACCENT.epic);
    expect(TIER_RING.exclusive).toBe("border-cyan-300/60");
  });
});
