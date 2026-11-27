/**
 * rc.6 (UI-A, Miguel 27/11: "ao escolher uma org, o logo não aparece nas
 * cartas do elenco, aparece um logo aleatório"). Root cause: a takeover keeps
 * a procedural crest in `identity.crestId` (old readers need one), and the
 * squad cards, the Club page, the top bar and the Saves list drew that crest
 * directly. The player's own mark now has one door, `UserOrgMark`; this test
 * pins its rule and fails when a screen draws the crest by hand again.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { orgs } from "@/data";
import { UserOrgMark, userMarkOf } from "./OrgMark";

const base = { crestId: "shield:wolf", colors: { primary: "#1f3a5f", secondary: "#c9a227" }, abbrev: "TST" };

describe("the player's own org mark", () => {
  const real = orgs.find((o) => !o.id.includes(":"))!;

  it("a founded club wears its crest", () => {
    expect(userMarkOf(base)).toEqual({ kind: "crest" });
    const html = renderToStaticMarkup(createElement(UserOrgMark, { identity: base, size: "sm" }));
    expect(html).toContain("<svg");
    expect(html).not.toContain("<img");
  });

  it("an established org wears its real logo, never the procedural crest", () => {
    const identity = { ...base, realOrgRef: real.id };
    expect(userMarkOf(identity)).toEqual({ kind: "logo", orgId: real.id });
    const html = renderToStaticMarkup(createElement(UserOrgMark, { identity, seasonIndex: 0, size: "sm" }));
    expect(html).not.toContain("<svg");
    expect(html).toContain(real.name.replace(/&/g, "&amp;"));
  });
});

/** Every file allowed to draw a crest from raw crest fields (the builder and the dispatcher). */
const ALLOWED = new Set([
  "components/career/OrgMark.tsx",
  "components/career/UserCrest.tsx",
  "components/career/screens/WizardScreen.tsx",
  "components/career/wizard/CrestStep.tsx",
  "components/career/wizard/FoundingSplash.tsx",
]);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (path.endsWith(".tsx")) out.push(path);
  }
  return out;
}

describe("call sites of the player's own mark", () => {
  it("no screen draws the saved crest directly (UserOrgMark or OrgMark orgRef=\"user\" instead)", () => {
    const root = join(process.cwd(), "src");
    const offenders: string[] = [];
    for (const file of walk(join(root, "components")).concat(walk(join(root, "app")))) {
      const rel = relative(root, file).split(sep).join("/");
      if (ALLOWED.has(rel)) continue;
      const src = readFileSync(file, "utf8");
      if (/identity\.crestId|meta\.crestId|<UserCrest\b/.test(src)) offenders.push(rel);
    }
    expect(offenders).toEqual([]);
  });
});
