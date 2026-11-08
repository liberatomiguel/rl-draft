import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { animationOverlay, staticMotionBase, motionRasterSource } from "../../scripts/lib/banner-animation.mjs";
import animated from "@/generated/banner-anim.json";

describe("banner motion extraction",()=>{
  it("bakes a visible static motion texture, never shipping live SMIL to a moving image",()=>{
    const svg=motionRasterSource('<svg viewBox="0 0 1240 200"><g opacity="0"><path d="M0 0L10 10"/><animate attributeName="opacity" values="0;0.7;1;0"/><animateTransform attributeName="transform" type="rotate" to="360"/></g></svg>')!;
    expect(svg).not.toMatch(/<animate|<filter/);
    expect(svg).toContain('opacity="1"');
    expect(svg).toContain('width="1240" height="200"');
    expect(svg).toContain('d="M0 0L10 10"');
  });
  it("removes moving shapes from the live background, retaining still art and its build-time filters",()=>{
    const out=staticMotionBase('<svg><defs><filter id="blur"><feGaussianBlur stdDeviation="3"/></filter></defs><g id="moving"><circle r="4"/><animateTransform attributeName="transform" type="translate" to="10 0"/></g><path id="background" filter="url(#blur)" d="M0 0L20 10"/></svg>')!;
    expect(out).toContain('id="background"');
    expect(out).toContain('filter="url(#blur)"');
    expect(out).not.toMatch(/id="moving"|<animate|<circle/);
  });
  it("retains the painted geometry inside an animated parent and strips filters",()=>{
    const out=animationOverlay('<svg viewBox="0 0 100 20"><defs><filter id="heavy"><feGaussianBlur stdDeviation="5"/></filter></defs><g filter="url(#heavy)"><g><path d="M0 0L10 10"/><circle r="2"/></g><animateTransform attributeName="transform" type="translate" values="0 0;5 0"/></g><rect id="still" width="100" height="20"/></svg>')!;
    expect(out).toContain('<path d="M0 0L10 10"/>');
    expect(out).toContain('<circle r="2"/>');
    expect(out).toContain("animateTransform");
    expect(out).not.toMatch(/filter|feGaussianBlur|id="still"/);
  });
  it("keeps artwork whose animation lives in its paint server, including transitive defs",()=>{
    const out=animationOverlay('<svg><defs><linearGradient id="g"><stop offset="0"/><animateTransform attributeName="gradientTransform" type="rotate" to="360"/></linearGradient><clipPath id="clip"><rect width="20" height="20"/></clipPath></defs><g clip-path="url(#clip)"><path fill="url(#g)" d="M0 0L20 20"/></g></svg>')!;
    expect(out).toContain('<stop offset="0"/>');
    expect(out).toContain('id="clip"');
    expect(out).toContain('d="M0 0L20 20"');
  });
  it("every shipped overlay contains painted shapes, valid defs and no heavy filters",()=>{
    for(const art of animated) {
      const svg=readFileSync(`public/banners/${art}.anim.svg`,"utf8");
      expect(svg,art).toMatch(/<(path|circle|ellipse|rect|polyline|polygon)\b/);
      expect(svg,art).toMatch(/<animate/);
      expect(svg,art).not.toMatch(/<filter|<fe[A-Z]|\sfilter=/);
      const ids=new Set([...svg.matchAll(/\sid="([^"]+)"/g)].map(m=>m[1]));
      for(const ref of svg.matchAll(/url\(#([^)]+)\)/g)) expect(ids.has(ref[1]),`${art}: ${ref[1]}`).toBe(true);
      const motion=readFileSync(`public/banners/${art}.motion.svg`,"utf8");
      expect(motion,art).not.toMatch(/<animate|<filter|<fe[A-Z]|\sfilter=/);
    }
    const legendary=readFileSync("public/banners/cosmic-ascension.anim.svg","utf8");
    expect((legendary.match(/<(path|circle|ellipse)\b/g)??[]).length).toBeGreaterThan(50);
  });
});
