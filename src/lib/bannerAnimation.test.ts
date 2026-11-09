import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { animationOverlay, staticMotionBase, motionRasterSource, splitOrbit, partitionMotion } from "../../scripts/lib/banner-animation.mjs";
import animated from "@/generated/banner-anim.json";
import parts from "@/generated/banner-motion.json";

describe("banner motion extraction",()=>{
  it("resolves reusable flame/orbit geometry through href and transitive paint references",()=>{
    const out=animationOverlay('<svg><defs><linearGradient id="paint"><stop offset="0"/></linearGradient><path id="flame" fill="url(#paint)" d="M0 0L4 8"/></defs><g><use href="#flame"/><animateTransform attributeName="transform" type="skewX" values="0;2"/></g></svg>')!;
    expect(out).toContain('id="flame"');
    expect(out).toContain('id="paint"');
    expect(out).toContain('d="M0 0L4 8"');
  });
  it("ships every moving shape once, with all referenced geometry and no live SVG animation",()=>{
    const count=(svg:string)=>(svg.replace(/<defs>[\s\S]*?<\/defs>/g,"").match(/<(?:path|circle|ellipse|rect|use|polyline|polygon)\b/g)??[]).length;
    for(const art of ["slipstream","wildfire","singularity","heatwave","cosmic-ascension"] as const) {
      const source=readFileSync(`public/banners/${art}.anim.svg`,"utf8");
      const layers=["motion",...parts[art]].map(role=>readFileSync(`public/banners/${art}.${role}.svg`,"utf8"));
      expect(layers.reduce((n,s)=>n+count(s),0),art).toBe(count(source));
      for(const layer of layers) {
        expect(layer,art).not.toMatch(/<animate|<filter|<fe[A-Z]|\sfilter=/);
        const ids=new Set([...layer.matchAll(/\sid="([^"]+)"/g)].map(m=>m[1]));
        for(const ref of layer.matchAll(/url\(#([^)]+)\)|href="#([^"]+)"/g)) expect(ids.has(ref[1]??ref[2]),`${art}: ${ref[1]??ref[2]}`).toBe(true);
      }
    }
  });
  it("partitions original art without duplicating geometry, keeping opposite orbits independent",()=>{
    const source='<svg viewBox="0 0 1240 200"><defs/><g><path id="core"/><animate attributeName="opacity" values=".5;1"/></g><g><path id="ring"/><animateTransform attributeName="transform" type="rotate" to="360 766 74"/></g><g><path id="counter"/><animateTransform attributeName="transform" type="rotate" to="-360 766 74"/></g><g><circle id="dust"/><animateTransform attributeName="transform" type="translate" to="0 -20"/></g></svg>';
    const layers=partitionMotion(source,"cosmic-ascension");
    expect(Object.keys(layers).sort()).toEqual(["counter","motion","orbit"]);
    for(const [role,id] of [["motion","core"],["orbit","ring"],["counter","counter"],["motion","dust"]]) {
      expect(layers[role]).toContain(`id="${id}"`);
      expect(Object.values(layers).join("").split(`id="${id}"`).length-1).toBe(1);
      expect(motionRasterSource(layers[role])).not.toMatch(/<animate|<filter/);
    }
  });
  it("keeps one Overdrive ring train when two SMIL phases freeze to identical poses",()=>{
    const out=motionRasterSource('<svg viewBox="0 0 1240 200"><g><ellipse cx="770" rx="3"/><ellipse cx="770" rx="3"/></g></svg>',true)!;
    expect((out.match(/<ellipse/g)??[]).length).toBe(1);
    const shipped=readFileSync('public/banners/overdrive.motion.svg','utf8');
    const rings=shipped.match(/<ellipse[^>]*>/g)??[];
    expect(rings.length).toBe(10);
    expect(new Set(rings).size).toBe(rings.length);
  });
  it("rotates only orbital groups, preserving the stationary nebula and sparkles",()=>{
    const source='<svg><defs/><g><path id="nebula"/><g><circle id="orbit"/><animateTransform attributeName="transform" type="rotate" to="360"/></g></g></svg>';
    expect(splitOrbit(source,true)).toContain('id="orbit"');
    expect(splitOrbit(source,true)).not.toContain('id="nebula"');
    expect(splitOrbit(source,false)).toContain('id="nebula"');
    expect(splitOrbit(source,false)).not.toContain('id="orbit"');
  });
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
