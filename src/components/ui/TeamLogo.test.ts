import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { orgs } from "@/data";
import audit from "../../../data-sources/org-logo-audit.json";
import { TeamLogo } from "./TeamLogo";
vi.mock("@/lib/assets", () => ({
  noteOrgLogoLoaded: () => {},
  orgLogoSrc: (key: string) => existsSync(join(process.cwd(), "public/orgs", key + ".png")) ? "/test/" + key + ".png" : null,
}));
const render = (orgId: string, seasonId?: string) => renderToStaticMarkup(createElement(TeamLogo, { orgId, seasonId }));
describe("organization art — historical identity and neutral fallback", () => {
  it("keeps Complexity's original, blue star and 2025 marks on their own seasons", () => {
    expect(render("complexity-gaming", "rlcs-s5")).toContain('/test/complexity-gaming@2018.png');
    expect(render("complexity-gaming", "rlcs-s7")).toContain('/test/complexity-gaming@2019.png');
    expect(render("complexity-gaming", "rlcs-2024")).toContain('/test/complexity-gaming@2019.png');
    expect(render("complexity-gaming", "rlcs-2025")).toContain('/test/complexity-gaming.png');
  });
  it("resolves every declared historical logo to a local file", () => {
    for (const org of orgs) for (const era of org.logoEras ?? []) {
      expect(existsSync(join(process.cwd(), "public/orgs", org.id + "@" + era.key + ".png")), org.id + "@" + era.key).toBe(true);
    }
  });
  it("uses a shared Octane for a team without a real logo", () => {
    for (const entry of audit.missingOrganizationReview.filter(e => e.status === "neutral-fallback")) {
      expect(existsSync(join(process.cwd(), "public/orgs", entry.orgId + ".png")), entry.orgId).toBe(false);
      expect(render(entry.orgId, "rlcs-2027")).toContain("/test/_octane-fallback.png");
    }
    const html = render("1", "rlcs-2027");
    expect(html).toContain('/test/_octane-fallback.png');
    expect(html).toContain('alt="1"');
    expect(html).not.toContain('dignitas');
  });
  it("keeps the real logo ahead of the fallback", () => {
    expect(render("5head", "rlcs-2027")).toContain('/test/5head.png');
    expect(render("5head", "rlcs-2027")).not.toContain('_octane-fallback');
  });
  it("preserves distinct Dignitas and Vitality editions across their rebrands", () => {
    expect(render("dignitas", "rlcs-s5")).toContain('dignitas@2003.png');
    expect(render("dignitas", "rlcs-s6")).toContain('dignitas@2018.png');
    expect(render("dignitas", "rlcs-2025")).toContain('dignitas@2025.png');
    expect(render("team-vitality", "rlcs-2025")).toContain('team-vitality@2023.png');
    expect(render("team-vitality", "rlcs-2027")).toContain('/test/team-vitality.png');
  });
});
