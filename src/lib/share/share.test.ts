import { describe, expect, it } from "vitest";
import { EN } from "@/content/copy.en";
import { PT } from "@/content/copy.pt";
import { channelHref } from "./shareActions";
import { shareLinkOf } from "./links";
import { noSeriesLost, roadGrid } from "./runShare";

describe("share links", () => {
  it("go to the production site, tagged as a share of the surface", () => {
    const url = new URL(shareLinkOf("https://rocketdraft.app", "/pt", "daily"));
    expect(url.origin).toBe("https://rocketdraft.app");
    expect(url.pathname).toBe("/pt");
    expect(url.searchParams.get("utm_medium")).toBe("share");
    expect(url.searchParams.get("utm_campaign")).toBe("daily");
  });

  it("each channel carries the text and the link, encoded", () => {
    const text = "Champion: 3-1 & 90 OVR";
    const url = "https://rocketdraft.app/?utm_source=share";
    const wa = channelHref("whatsapp", text, url, "t");
    expect(wa.startsWith("https://wa.me/?text=")).toBe(true);
    expect(decodeURIComponent(wa.split("text=")[1])).toBe(`${text} ${url}`);
    const x = new URL(channelHref("x", text, url, "t"));
    expect(x.searchParams.get("text")).toBe(text);
    expect(x.searchParams.get("url")).toBe(url);
    const reddit = new URL(channelHref("reddit", text, url, "My title"));
    expect(reddit.searchParams.get("title")).toBe("My title");
    expect(new URL(channelHref("telegram", text, url, "t")).searchParams.get("url")).toBe(url);
  });
});

describe("the road through the bracket", () => {
  const road = [
    { label: "Swiss", series: [true, false, true, true] },
    { label: "Playoffs", series: [true, true, true] },
  ];

  it("reads as squares, stage by stage", () => {
    expect(roadGrid(road)).toBe("🟩🟥🟩🟩 🟩🟩🟩");
    expect(roadGrid([])).toBe("");
  });

  it("is undefeated only when every series was won", () => {
    expect(noSeriesLost(road)).toBe(false);
    expect(noSeriesLost([{ label: "Playoffs", series: [true, true] }])).toBe(true);
    expect(noSeriesLost([])).toBe(false);
  });
});

describe("share copy", () => {
  it("has the same keys in both languages", () => {
    expect(Object.keys(PT.SHARE_UI).sort()).toEqual(Object.keys(EN.SHARE_UI).sort());
  });

  it("the Daily post keeps its grid on its own line, and drops the line without one", () => {
    expect(EN.SHARE_UI.textDaily(312, "Champion", "🟩🟩")).toBe(
      "Rocket Draft Daily #312: Champion\n🟩🟩\nSame draft for everyone today. Your turn:",
    );
    expect(EN.SHARE_UI.textDaily(312, "Top 8", "")).not.toContain("\n\n");
  });

  it("no em dash in any share line (DESIGN.md)", () => {
    for (const C of [EN.SHARE_UI, PT.SHARE_UI]) {
      for (const v of Object.values(C)) {
        const s = typeof v === "function" ? (v as (...a: unknown[]) => string)(1, "x", "y") : String(v);
        expect(s).not.toContain("—");
      }
    }
  });
});
