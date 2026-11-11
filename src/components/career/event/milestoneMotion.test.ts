import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
const motion = vi.hoisted(() => ({ reduced: false }));
vi.mock("@/lib/useOsReducedMotion", () => ({ useOsReducedMotion: () => motion.reduced }));
import { MilestoneMoment } from "./MilestoneMoment";

describe("career milestones respect motion preferences", () => {
  it("gives each milestone a static, readable reduced-motion state", () => {
    motion.reduced = true;
    for (const kind of ["major", "worlds", "sunday"] as const) {
      const html = renderToStaticMarkup(createElement(MilestoneMoment, {kind,title:"Title"}));
      expect(html).toContain('data-motion="still"');
      expect(html).toContain('role="status"');
      expect(html).toContain("Title");
      expect(html).toContain("prefers-reduced-motion: reduce");
    }
  });
  it("animates only opacity and transform in its keyframes", () => {
    motion.reduced = false;
    const html = renderToStaticMarkup(createElement(MilestoneMoment, {kind:"major",title:"Title"}));
    expect(html).toContain('data-motion="animate"');
    const keyframes = html.split("@keyframes").slice(1).join("@keyframes").split("@media")[0];
    const properties = [...keyframes.matchAll(/([a-z-]+):/g)].map(m=>m[1]);
    expect(properties.length).toBeGreaterThan(0);
    expect(new Set(properties)).toEqual(new Set(["opacity", "transform"]));
  });
});
