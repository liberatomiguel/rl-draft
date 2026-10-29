/**
 * rc.32 (DRAFT-11, #148): what the static export renders for a page — the
 * server render, before the client has mounted — follows the page's URL: a PT
 * URL gets `<html lang="pt-BR">` and the PT dictionary for every `useCopy()`
 * below the root (the header, the footer, the nav); any other URL gets EN,
 * whatever language the player saved (that applies after mount).
 */

import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EN } from "@/content/copy.en";
import { PT } from "@/content/copy.pt";
import { useCopy, useUiLocale } from "@/content/copy";
import { useSettings } from "@/store/settingsStore";
import { LocaleRoot } from "./LocaleRoot";

/** LocaleRoot, typed so `children` can be createElement's third argument. */
const Root = LocaleRoot as (props: { className: string; children?: ReactNode }) => ReactNode;

const nav = vi.hoisted(() => ({ pathname: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname }));

/** A stand-in for the chrome: prints what useCopy / useUiLocale answer. */
function Chrome() {
  const t = useCopy();
  return createElement("nav", { "data-locale": useUiLocale() }, t.NAV.play, "|", t.NAV.collection);
}

function exportPage(pathname: string): string {
  nav.pathname = pathname;
  return renderToStaticMarkup(
    createElement(Root, { className: "fonts" }, createElement("body", null, createElement(Chrome))),
  );
}

afterEach(() => {
  useSettings.getState().set("lang", "en");
});

describe("LocaleRoot (the static HTML of a page)", () => {
  it("renders a PT page with lang=pt-BR and the PT chrome", () => {
    for (const path of ["/pt", "/pt/faq", "/pt/cartas-especiais"]) {
      const html = exportPage(path);
      expect(html).toContain('<html lang="pt-BR" class="fonts">');
      expect(html).toContain(`data-locale="pt"`);
      expect(html).toContain(`${PT.NAV.play}|${PT.NAV.collection}`);
    }
  });

  it("renders every other page exactly as before: lang=en and the EN chrome", () => {
    for (const path of ["/", "/play", "/faq", "/career", "/pt/nao-existe"]) {
      const html = exportPage(path);
      expect(html).toContain('<html lang="en" class="fonts">');
      expect(html).toContain(`${EN.NAV.play}|${EN.NAV.collection}`);
    }
  });

  it("ignores the saved language before mount (it applies after hydration)", () => {
    useSettings.getState().set("lang", "pt");
    expect(exportPage("/faq")).toContain('<html lang="en" class="fonts">');
    useSettings.getState().set("lang", "en");
    expect(exportPage("/pt/sobre")).toContain('<html lang="pt-BR" class="fonts">');
  });

  it("keeps the PT and EN chrome distinct (the dictionaries differ where it shows)", () => {
    expect(PT.NAV.play).not.toBe(EN.NAV.play);
  });
});
