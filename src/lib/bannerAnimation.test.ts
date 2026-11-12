import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { animationOverlay, staticMotionBase, motionRasterSource, splitOrbit, partitionMotion, smilValueAt, frameAt, frameTimes, moverLayers } from "../../scripts/lib/banner-animation.mjs";
import animated from "@/generated/banner-anim.json";
import motionJson from "@/generated/banner-motion.json";

interface Motion { parts?: string[]; frames?: number; cycle?: number; layers?: { role: string; from: number[]; to: number[]; dur: number; sway: boolean }[] }
const motion = motionJson as Record<string, Motion>;
/** rc.23 plane split (a still base + moving planes) vs the rc.51 frame pipeline. */
const planeSplit = animated.filter(art => motion[art].parts);
const framed = animated.filter(art => motion[art].frames !== undefined);

describe("banner motion extraction",()=>{
  it("resolves reusable flame/orbit geometry through href and transitive paint references",()=>{
    const out=animationOverlay('<svg><defs><linearGradient id="paint"><stop offset="0"/></linearGradient><path id="flame" fill="url(#paint)" d="M0 0L4 8"/></defs><g><use href="#flame"/><animateTransform attributeName="transform" type="skewX" values="0;2"/></g></svg>')!;
    expect(out).toContain('id="flame"');
    expect(out).toContain('id="paint"');
    expect(out).toContain('d="M0 0L4 8"');
  });
  it("ships every moving shape once, with all referenced geometry and no live SVG animation",()=>{
    const count=(svg:string)=>(svg.replace(/<defs>[\s\S]*?<\/defs>/g,"").match(/<(?:path|circle|ellipse|rect|use|polyline|polygon)\b/g)??[]).length;
    for(const art of ["slipstream","singularity"] as const) {
      const source=readFileSync(`public/banners/${art}.anim.svg`,"utf8");
      const layers=["motion",...(motion[art].parts??[])].map(role=>readFileSync(`public/banners/${art}.${role}.svg`,"utf8"));
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
    expect(planeSplit.length).toBeGreaterThan(10);
    for(const art of planeSplit) {
      const svg=readFileSync(`public/banners/${art}.anim.svg`,"utf8");
      expect(svg,art).toMatch(/<(path|circle|ellipse|rect|polyline|polygon)\b/);
      expect(svg,art).toMatch(/<animate/);
      expect(svg,art).not.toMatch(/<filter|<fe[A-Z]|\sfilter=/);
      const ids=new Set([...svg.matchAll(/\sid="([^"]+)"/g)].map(m=>m[1]));
      for(const ref of svg.matchAll(/url\(#([^)]+)\)/g)) expect(ids.has(ref[1]),`${art}: ${ref[1]}`).toBe(true);
      const motion=readFileSync(`public/banners/${art}.motion.svg`,"utf8");
      expect(motion,art).not.toMatch(/<animate|<filter|<fe[A-Z]|\sfilter=/);
    }
  });
});

describe("banner frame pipeline (rc.51)",()=>{
  const anim=(attrs:string)=>({tag:"animate",attrs,children:[]});
  it("evaluates SMIL at a moment: values, from/to, begin offset and keyTimes",()=>{
    expect(smilValueAt(anim(' values="0;10;0" dur="4s"'),1)).toBe("5");
    expect(smilValueAt(anim(' values="0;10;0" dur="4s"'),5)).toBe("5");
    expect(smilValueAt(anim(' from="0 0" to="20 -40" dur="2s"'),0.5)).toBe("5 -10");
    expect(smilValueAt(anim(' values="0;10" dur="4s" begin="-1s"'),1)).toBe("5");
    expect(smilValueAt(anim(' values="0;1;1;0" keyTimes="0;0.2;0.7;1" dur="10s"'),1)).toBe("0.5");
    expect(smilValueAt(anim(' to="360 766 74" dur="140s"'),3)).toBe("360 766 74");
  });
  it("bakes every animation into its attribute and keeps filters, masks and blend modes",()=>{
    const src='<svg viewBox="0 0 1240 200"><defs><filter id="glow"><feGaussianBlur stdDeviation="3"/></filter><linearGradient id="g"><stop offset="0"/><animateTransform attributeName="gradientTransform" type="rotate" from="0 5 5" to="360 5 5" dur="4s"/></linearGradient></defs><g mask="url(#m)" style="mix-blend-mode:screen"><g filter="url(#glow)"><path d="M0 0L4 8"/><animateTransform attributeName="transform" type="skewX" values="0;2;0" dur="2s"/></g></g><circle r="2" opacity="0.4"><animate attributeName="opacity" values="1;0;1" dur="2s"/></circle><g id="ember"><circle r="1"/><animateTransform attributeName="transform" type="translate" values="-4 14;16 -24" dur="3s"/></g></svg>';
    const out=frameAt(src,0.5)!;
    expect(out).not.toMatch(/<animate/);
    expect(out).toContain('transform="skewX(1)"');
    expect(out).toContain('gradientTransform="rotate(45 5 5)"');
    expect(out).toContain('opacity="0.5"');
    expect(out).toContain('filter="url(#glow)"');
    expect(out).toContain('mix-blend-mode:screen');
    expect(out).toContain("feGaussianBlur");
    // The travelling shape is a separate plane, never part of a frame.
    expect(out).not.toContain('id="ember"');
  });
  it("picks moments that differ, and none when only travel animates",()=>{
    const pulse='<svg><g><path d="M0 0"/><animate attributeName="opacity" values="1;0;1" dur="4s"/></g></svg>';
    const times=frameTimes(pulse);
    expect(times[0]).toBe(0);
    expect(new Set(times).size).toBe(times.length);
    expect(times.length).toBeGreaterThan(1);
    expect(frameAt(pulse,times[1])).not.toBe(frameAt(pulse,times[0]));
    expect(frameTimes('<svg><g><animateTransform attributeName="transform" type="translate" values="0 0;5 5" dur="2s"/></g></svg>')).toEqual([]);
  });
  it("turns travelling shapes into planes with the vector of the design file",()=>{
    const ember=(i:number)=>`<circle id="e${i}" r="1" opacity="0"><animate attributeName="opacity" values="0;0.8;0" dur="3s"/><animateTransform attributeName="transform" type="translate" values="-4 14;16 -24" dur="${2+i}s"/></circle>`;
    const loop=moverLayers(`<svg viewBox="0 0 1240 200"><defs/><rect id="bg"/>${[0,1,2,3].map(ember).join("")}</svg>`);
    expect(loop.length).toBe(2);
    expect(loop[0]).toMatchObject({from:[-4,14],to:[16,-24],sway:false});
    expect(loop[0].dur).toBeLessThan(loop[1].dur);
    const all=loop.map(l=>l.svg).join("");
    for(const i of [0,1,2,3]) expect(all.split(`id="e${i}"`).length-1).toBe(1);
    expect(all).not.toMatch(/<animate|id="bg"/);
    expect(all).toContain('opacity="0.8"');
    const sway=moverLayers('<svg><defs/><path d="M0 0"><animateTransform attributeName="transform" type="translate" values="0 0;-56 0;0 0" dur="6s"/></path></svg>');
    expect(sway).toHaveLength(1);
    expect(sway[0]).toMatchObject({from:[0,0],to:[-56,0],sway:true,dur:6});
  });
  it("ships complete, still, self-contained frames and planes for every framed banner",()=>{
    expect(framed).toEqual(expect.arrayContaining(["wildfire","heatwave","cosmic-ascension","world-class"]));
    for(const art of framed) {
      const m=motion[art];
      const files=["base",...Array.from({length:m.frames??0},(_,i)=>`f${i+1}`),...(m.layers??[]).map(l=>l.role)];
      const svgs=files.map(role=>readFileSync(`public/banners/${art}.${role}.svg`,"utf8"));
      for(const svg of svgs) {
        expect(svg,art).not.toMatch(/<animate|<set\b/);
        const ids=new Set([...svg.matchAll(/\sid="([^"]+)"/g)].map(x=>x[1]));
        for(const ref of svg.matchAll(/url\(#([^)]+)\)|href="#([^"]+)"/g)) expect(ids.has(ref[1]??ref[2]),`${art}: ${ref[1]??ref[2]}`).toBe(true);
      }
      // Frames are different moments of the same picture.
      const frames=svgs.slice(0,(m.frames??0)+1);
      expect(new Set(frames).size,art).toBe(frames.length);
      expect((m.frames??0)+(m.layers??[]).length,art).toBeGreaterThan(0);
      for(const l of m.layers??[]) expect(l.dur,art).toBeGreaterThan(0);
    }
    // The three Miguel flagged: the flames sway inside their mask (never a tilted
    // plane), the heat haze changes per frame, and the legendary keeps its glow.
    expect(readFileSync("public/banners/wildfire.f1.svg","utf8")).toMatch(/transform="skewX\(/);
    expect(readFileSync("public/banners/heatwave.base.svg","utf8")).not.toBe(readFileSync("public/banners/heatwave.f1.svg","utf8"));
    const legendary=readFileSync("public/banners/cosmic-ascension.f1.svg","utf8");
    expect(legendary).toMatch(/<filter/);
    expect(legendary).toContain("mix-blend-mode:screen");
    expect(motion["cosmic-ascension"].layers?.length).toBe(2);
  });
});
