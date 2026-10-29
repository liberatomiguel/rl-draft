/**
 * rc.32 (DRAFT-11, #148): the URL decides the language of a page's static
 * HTML. These lock the decision itself and tie the PT list to the PT route
 * files, so a new page under src/app/pt cannot ship English chrome.
 * (`scripts/postexport.mjs` checks the exported HTML itself.)
 */

import { readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { PAGE_ROUTES } from "@/content/pageRoutes";
import { HTML_LANG, PT_PATHS, localeOfPath } from "./locale";

/** Route paths of every page.tsx under a directory of src/app. */
function pageRoutes(appDir: string, sub: string): string[] {
  const root = join(appDir, sub);
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (name === "page.tsx") {
        const rel = relative(appDir, dir).split(sep).join("/");
        out.push(`/${rel}`);
      }
    }
  };
  walk(root);
  return out.sort();
}

describe("localeOfPath", () => {
  it("answers PT for the PT landing page and every PT content page", () => {
    expect(localeOfPath("/pt")).toBe("pt");
    for (const { pt } of Object.values(PAGE_ROUTES)) expect(localeOfPath(pt)).toBe("pt");
  });

  it("answers EN for the EN twins, the game routes and the home", () => {
    for (const { en } of Object.values(PAGE_ROUTES)) expect(localeOfPath(en)).toBe("en");
    for (const p of ["/", "/play", "/collection", "/how-to-play", "/career", "/career/new", "/_not-found"]) {
      expect(localeOfPath(p)).toBe("en");
    }
  });

  it("ignores one trailing slash", () => {
    expect(localeOfPath("/pt/")).toBe("pt");
    expect(localeOfPath("/pt/faq/")).toBe("pt");
    expect(localeOfPath("/faq/")).toBe("en");
  });

  it("answers EN for unknown /pt URLs (the English 404 page is served there) and look-alikes", () => {
    expect(localeOfPath("/pt/nao-existe")).toBe("en");
    expect(localeOfPath("/ptx")).toBe("en");
    expect(localeOfPath("/about/pt")).toBe("en");
  });

  it("answers EN without a pathname (outside the router)", () => {
    expect(localeOfPath(null)).toBe("en");
    expect(localeOfPath(undefined)).toBe("en");
    expect(localeOfPath("")).toBe("en");
  });
});

describe("PT pages", () => {
  const APP = join(process.cwd(), "src", "app");

  it("every page under src/app/pt is a PT path, and every PT path has a page", () => {
    expect(pageRoutes(APP, "pt")).toEqual([...PT_PATHS].sort());
  });

  it("uses the hreflang tag of the sitemap and the content pages for <html lang>", () => {
    expect(HTML_LANG).toEqual({ en: "en", pt: "pt-BR" });
  });
});
