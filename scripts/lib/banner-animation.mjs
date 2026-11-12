/** Extract a filter-free motion layer without losing the painted children of
 * animated groups, or geometry driven by an animated gradient in <defs>. */
const ANIM = new Set(["animate", "animateTransform", "animateMotion", "set"]);
const refsOf = attrs => [...attrs.matchAll(/url\(#([\w:-]+)\)|(?:^|\s)(?:xlink:)?href="#([\w:-]+)"/g)].map(x => x[1] ?? x[2]);
const idOf = attrs => /\sid="([^"]+)"/.exec(attrs)?.[1] ?? null;
const hasAnim = n => ANIM.has(n.tag) || n.children.some(hasAnim);

function parseSvg(src) {
  const root = {tag:"#root",attrs:"",children:[],parent:null};
  let cur = root;
  const re = /<\/([\w:-]+)\s*>|<([\w:-]+)((?:\s+[^>]*?)?)(\/?)>|([^<]+)/g;
  for (const m of src.matchAll(re)) {
    if (m[1]) cur = cur.parent ?? root;
    else if (m[2]) {
      const node = {tag:m[2],attrs:m[3] ?? "",children:[],parent:cur};
      cur.children.push(node);
      if (!m[4]) cur = node;
    } else if (m[5]?.trim()) cur.children.push({tag:"#text",text:m[5],children:[],parent:cur});
  }
  return root.children.find(c => c.tag === "svg");
}
function serialize(n, stripFilters = true) {
  if (n.tag === "#text") return n.text;
  const attrs = stripFilters ? n.attrs.replace(/\sfilter="[^"]*"/g, "").replace(/filter:\s*url\([^)]*\);?/g, "") : n.attrs;
  const inner = n.children.map(c => serialize(c, stripFilters)).join("");
  return inner ? `<${n.tag}${attrs}>${inner}</${n.tag}>` : `<${n.tag}${attrs}/>`;
}

export function animationOverlay(svgText) {
  const svg = parseSvg(svgText);
  if (!svg || !hasAnim(svg)) return null;
  const defs = svg.children.find(c => c.tag === "defs");
  const byId = new Map((defs?.children ?? []).map(d => [idOf(d.attrs),d]).filter(([id]) => id));
  const animatedRef = (n, visited = new Set()) => refsOf(n.attrs).some(id => {
    const def = byId.get(id);
    if (!def || def.tag === "filter" || visited.has(id)) return false;
    visited.add(id);
    return hasAnim(def) || animatedRef(def, visited);
  });
  const keep = n => {
    // An animation belongs to its parent. Keep that parent's complete painted
    // subtree, not just the <animateTransform> and an empty group.
    if (ANIM.has(n.tag) || n.children.some(c => ANIM.has(c.tag)) || animatedRef(n)) return n;
    const children = n.children.map(keep).filter(Boolean);
    return children.length ? {...n,children} : null;
  };
  const body = svg.children.filter(c => c !== defs).map(keep).filter(Boolean);
  if (!body.length) return null;
  const need = new Set();
  const visit = n => {
    if (n.tag === "#text") return;
    for (const id of refsOf(n.attrs)) {
      const def = byId.get(id);
      if (!need.has(id) && def && def.tag !== "filter") {need.add(id); visit(def);}
    }
    n.children.forEach(visit);
  };
  body.forEach(visit);
  const open = /<svg[^>]*>/.exec(svgText)[0].replace(/\swidth="[^"]*"|\sheight="[^"]*"|\srole="[^"]*"|\saria-label="[^"]*"/g, "");
  return `${open}<defs>${[...need].map(id => serialize(byId.get(id))).join("")}</defs>${body.map(n => serialize(n)).join("")}</svg>`;
}

/** Static background for the live layer. The complete still image remains the
 * reduced-effects fallback; moving shapes must not be painted twice. Filters
 * here are safe: build-images rasterises this file before production serves it. */
export function staticMotionBase(svgText) {
  const svg = parseSvg(svgText);
  if (!svg) return null;
  const defs = svg.children.find(c => c.tag === "defs");
  const byId = new Map((defs?.children ?? []).map(d => [idOf(d.attrs), d]).filter(([id]) => id));
  const animatedRef = (n, visited = new Set()) => refsOf(n.attrs).some(id => {
    const def = byId.get(id);
    if (!def || def.tag === "filter" || visited.has(id)) return false;
    visited.add(id);
    return hasAnim(def) || animatedRef(def, visited);
  });
  const still = n => {
    if (ANIM.has(n.tag) || n.children.some(c => ANIM.has(c.tag)) || animatedRef(n)) return null;
    const children = n.children.map(still).filter(Boolean);
    return n.children.length && !children.length ? null : {...n,children};
  };
  const stripAnim = n => ({...n, children:n.children.filter(c=>!ANIM.has(c.tag)).map(stripAnim)});
  const body = svg.children.filter(c=>c!==defs).map(still).filter(Boolean);
  const open = /<svg[^>]*>/.exec(svgText)[0];
  return `${open}${defs ? serialize(stripAnim(defs),false) : ""}${body.map(n=>serialize(n,false)).join("")}</svg>`;
}

/** A representative, transparent still of the moving art. Production animates
 * this raster as a composited plane; live SMIL re-rasterised the SVG per frame.
 * Sparkles that start at opacity zero use their visible pose in this texture. */
export function splitOrbit(overlay, orbitOnly) {
  const svg = parseSvg(overlay);
  const keep = n => {
    if (n.children.some(c => c.tag === "animateTransform" && /attributeName="transform"/.test(c.attrs) && /type="rotate"/.test(c.attrs))) return orbitOnly ? n : null;
    const children = n.children.map(keep).filter(Boolean);
    return orbitOnly && !children.length ? null : {...n, children};
  };
  return serialize({...svg, children:svg.children.flatMap(n => n.tag === "defs" ? [n] : [keep(n)].filter(Boolean))});
}

/** Separate original moving geometry into a few independently composited
 * planes. Each painted subtree belongs to exactly one plane: no ghost copies
 * of flames/rings, and no live filters or per-frame SVG rasterisation. */
export function partitionMotion(overlay, art) {
  const svg = parseSvg(overlay);
  const buckets = new Map();
  let drift = 0;
  const assign = n => {
    const animations = n.children.filter(c => ANIM.has(c.tag));
    if (animations.length) {
      const transform = animations.find(c => c.tag === "animateTransform" && /attributeName="transform"/.test(c.attrs));
      let role = "motion";
      if (transform && /type="rotate"/.test(transform.attrs)) {
        role = /to="-360/.test(transform.attrs) ? "counter" : "orbit";
      } else if (transform && /type="translate"/.test(transform.attrs)) {
        role = art === "heatwave" ? (drift++ % 2 ? "drift" : "motion")
          : ["slipstream", "wildfire"].includes(art) ? (drift++ % 2 ? "drift2" : "drift")
          : art === "cosmic-ascension" ? "motion" : "drift";
      }
      buckets.set(n, role);
    } else n.children.forEach(assign);
  };
  svg.children.filter(n => n.tag !== "defs").forEach(assign);
  const select = (n, role) => {
    if (buckets.has(n)) return buckets.get(n) === role ? n : null;
    if (!n.children.length) return role === "motion" ? n : null;
    const children = n.children.map(c => select(c, role)).filter(Boolean);
    return children.length ? {...n, children} : null;
  };
  return Object.fromEntries(["motion", ...new Set(buckets.values())].filter((r,i,a) => a.indexOf(r) === i).flatMap(role => {
    const body = svg.children.filter(n => n.tag !== "defs").map(n => select(n, role)).filter(Boolean);
    return body.length ? [[role, serialize({...svg, children:[...svg.children.filter(n => n.tag === "defs"), ...body]})]] : [];
  }));
}

export function motionRasterSource(overlay, dedupeEllipses = false) {
  const svg = parseSvg(overlay);
  if (!svg) return null;
  const seen = new Set();
  const freeze = n => {
    const opacity = n.children.find(c => c.tag === "animate" && /attributeName="opacity"/.test(c.attrs));
    let attrs = n.attrs;
    if (opacity) {
      const text = /values="([^"]+)"/.exec(opacity.attrs)?.[1] ?? [/from="([^"]+)"/.exec(opacity.attrs)?.[1], /to="([^"]+)"/.exec(opacity.attrs)?.[1]].filter(Boolean).join(";");
      const values = text.split(";").map(Number).filter(Number.isFinite);
      if (values.length) {
        const value = Math.max(...values);
        attrs = /\sopacity="[^"]*"/.test(attrs) ? attrs.replace(/\sopacity="[^"]*"/, ` opacity="${value}"`) : `${attrs} opacity="${value}"`;
      }
    }
    if (dedupeEllipses && n.tag === "ellipse") {
      if (seen.has(attrs)) return null;
      seen.add(attrs);
    }
    return {...n, attrs, children:n.children.filter(c=>!ANIM.has(c.tag)).map(freeze).filter(Boolean)};
  };
  const still = freeze(svg);
  const box = /viewBox="([^"]+)"/.exec(still.attrs)?.[1].split(/\s+/).map(Number);
  if (box) still.attrs += ` width="${box[2]}" height="${box[3]}"`;
  return serialize(still);
}

// --- rc.51: the FRAME pipeline ------------------------------------------------
// Splitting a banner into "still base + moving planes" changes how it looks: the
// planes lose their filters, blend modes, masks and place in the paint order
// (Cosmic Ascension), and tilting a whole plane bends art that the design only
// sways INSIDE a mask (the stepped flames of Wildfire). Here the design file's
// own animation is evaluated at a few moments and each moment is baked into a
// complete, static SVG with every filter intact; build-images rasterises them
// and the UI cross-fades the frames (opacity only). Only shapes that TRAVEL
// (a translate animation: embers, dust, rain, confetti) stay separate planes,
// moved with a CSS transform along the vector the design gives them.

const attrOf = (attrs, name) => new RegExp(`\\s${name}="([^"]*)"`).exec(attrs)?.[1];
const withAttr = (attrs, name, value) => {
  const re = new RegExp(`\\s${name}="[^"]*"`);
  return re.test(attrs) ? attrs.replace(re, ` ${name}="${value}"`) : `${attrs} ${name}="${value}"`;
};
const seconds = s => (s == null ? 0 : parseFloat(s) * (/ms$/.test(s) ? 0.001 : 1)) || 0;
const keyframesOf = anim => attrOf(anim.attrs, "values")?.split(";").map(s => s.trim()).filter(Boolean)
  ?? [attrOf(anim.attrs, "from"), attrOf(anim.attrs, "to")].filter(v => v != null);
const numbersOf = s => s.split(/[\s,]+/).map(Number);
const isTravel = c => c.tag === "animateTransform" && attrOf(c.attrs, "attributeName") === "transform" && attrOf(c.attrs, "type") === "translate";
const isMover = n => n.children.some(isTravel);

/** The value of one SMIL animation at time `t` (seconds): linear between its
 *  keyframes (`values`, or `from`/`to`), honouring `begin`, `dur`, `keyTimes`. */
export function smilValueAt(anim, t) {
  const raw = keyframesOf(anim);
  if (!raw.length) return null;
  if (raw.length === 1) return raw[0];
  const dur = seconds(attrOf(anim.attrs, "dur")) || 1;
  const local = t - seconds(attrOf(anim.attrs, "begin"));
  const p = (((local % dur) + dur) % dur) / dur;
  const kt = attrOf(anim.attrs, "keyTimes")?.split(";").map(Number) ?? raw.map((_, i) => i / (raw.length - 1));
  let i = 0;
  while (i < raw.length - 2 && p >= kt[i + 1]) i++;
  const f = kt[i + 1] > kt[i] ? Math.min(1, Math.max(0, (p - kt[i]) / (kt[i + 1] - kt[i]))) : 0;
  const a = numbersOf(raw[i]), b = numbersOf(raw[i + 1]);
  if (a.length !== b.length || [...a, ...b].some(Number.isNaN)) return f < 0.5 ? raw[i] : raw[i + 1];
  return a.map((v, k) => +(v + (b[k] - v) * f).toFixed(4)).join(" ");
}

/** The design at time `t` as a static SVG: every animation baked into the
 *  attribute it drives (filters, masks and blend modes untouched), the
 *  travelling shapes left out (they are separate planes). */
export function frameAt(svgText, t) {
  const svg = parseSvg(svgText);
  if (!svg) return null;
  const bake = n => {
    if (n.tag === "#text") return n;
    if (isMover(n)) return null;
    let attrs = n.attrs;
    for (const a of n.children) {
      if (!ANIM.has(a.tag)) continue;
      const name = attrOf(a.attrs, "attributeName");
      const value = smilValueAt(a, t);
      if (!name || value == null) continue;
      attrs = withAttr(attrs, name, a.tag === "animateTransform" ? `${attrOf(a.attrs, "type")}(${value})` : value);
    }
    return {...n, attrs, children: n.children.filter(c => !ANIM.has(c.tag)).map(bake).filter(Boolean)};
  };
  return serialize(bake(svg), false);
}

/** Up to `count` moments whose baked frames differ the most from each other
 *  (greedy, the first is always t = 0). [] when nothing but travel animates. */
export function frameTimes(svgText, count = 3, horizon = 24, step = 0.1) {
  const svg = parseSvg(svgText);
  const anims = [];
  const walk = n => {
    if (n.tag === "#text" || isMover(n)) return;
    for (const c of n.children) {
      if (ANIM.has(c.tag)) anims.push(c);
      else walk(c);
    }
  };
  if (svg) walk(svg);
  const grid = Array.from({length: Math.round(horizon / step) + 1}, (_, i) => +(i * step).toFixed(3));
  const tracks = anims.map(a => grid.map(t => {
    const v = smilValueAt(a, t);
    const n = v == null ? NaN : numbersOf(String(v)).reduce((s, x) => s + x, 0);
    return Number.isFinite(n) ? n : 0;
  })).map(track => {
    const lo = Math.min(...track), hi = Math.max(...track);
    return hi - lo > 1e-9 ? track.map(v => (v - lo) / (hi - lo)) : null;
  }).filter(Boolean);
  if (!tracks.length) return [];
  const dist = (i, j) => tracks.reduce((s, tr) => s + Math.abs(tr[i] - tr[j]), 0) / tracks.length;
  const picked = [0];
  while (picked.length < count) {
    let best = -1, bestScore = 0;
    for (let i = 1; i < grid.length; i++) {
      const score = Math.min(...picked.map(j => dist(i, j)));
      if (score > bestScore + 1e-9) { bestScore = score; best = i; }
    }
    if (best < 0) break;
    picked.push(best);
  }
  return picked.map(i => grid[i]);
}

/** The travelling shapes as (at most two) transparent planes, each with the
 *  vector it travels: `{svg, from, to, dur, sway}` in art units / seconds.
 *  `sway`: the design moves out and back (no fade); otherwise it loops. Slow
 *  and fast shapes land on different planes, so the planes move apart. */
export function moverLayers(svgText) {
  const svg = parseSvg(svgText);
  if (!svg) return [];
  const defs = svg.children.find(c => c.tag === "defs");
  const movers = [];
  const collect = n => { if (n.tag === "#text") return; if (isMover(n)) movers.push(n); else n.children.forEach(collect); };
  svg.children.filter(c => c !== defs).forEach(collect);
  if (!movers.length) return [];
  const far = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
  const vectorOf = n => {
    const a = n.children.find(isTravel);
    const pts = keyframesOf(a).map(numbersOf).map(([x, y]) => [x || 0, y || 0]);
    const first = pts[0] ?? [0, 0], last = pts.at(-1) ?? first;
    const sway = pts.length > 2 && far(first, last) < 0.5;
    const to = sway ? pts.reduce((best, p) => (far(first, p) > far(first, best) ? p : best), first) : last;
    return {from: first, to, sway, dur: seconds(attrOf(a.attrs, "dur")) || 4, length: far(first, to)};
  };
  const info = new Map(movers.map(n => [n, vectorOf(n)]));
  // Shapes flying in different directions (shards) are grouped by direction, so a
  // plane's mean vector is not their cancelling sum; a single stream (embers,
  // dust) is split slow / fast instead.
  const angle = n => { const v = info.get(n); return Math.atan2(v.to[1] - v.from[1], v.to[0] - v.from[0]); };
  const byAngle = [...movers].filter(n => info.get(n).length > 0.5).sort((a, b) => angle(a) - angle(b));
  let gapAt = 0, gap = 0;
  byAngle.forEach((n, i) => {
    const next = byAngle[(i + 1) % byAngle.length];
    const d = i + 1 < byAngle.length ? angle(next) - angle(n) : angle(next) + 2 * Math.PI - angle(n);
    if (d > gap) { gap = d; gapAt = i + 1; }
  });
  const spread = byAngle.length > 1 ? 2 * Math.PI - gap : 0;
  const order = spread > Math.PI / 6
    ? [...byAngle.slice(gapAt), ...byAngle.slice(0, gapAt), ...movers.filter(n => info.get(n).length <= 0.5)]
    : [...movers].sort((a, b) => info.get(a).length - info.get(b).length || info.get(a).dur - info.get(b).dur);
  const half = Math.ceil(order.length / 2);
  const planes = movers.length >= 4 ? [order.slice(0, half), order.slice(half)] : [order];
  // A travelling shape is drawn at its most visible pose; nothing inside it animates.
  const pose = n => {
    if (n.tag === "#text") return n;
    let attrs = n.attrs;
    const fade = n.children.find(c => c.tag === "animate" && attrOf(c.attrs, "attributeName") === "opacity");
    if (fade) {
      const values = keyframesOf(fade).map(Number).filter(Number.isFinite);
      if (values.length) attrs = withAttr(attrs, "opacity", Math.max(...values));
    }
    return {...n, attrs, children: n.children.filter(c => !ANIM.has(c.tag)).map(pose)};
  };
  const strip = d => ({...d, children: d.children.filter(c => !ANIM.has(c.tag)).map(strip)});
  const mean = (list, f) => +(list.reduce((s, n) => s + f(info.get(n)), 0) / list.length).toFixed(2);
  return planes.map(plane => {
    const members = new Set(plane);
    const select = n => {
      if (members.has(n)) return pose(n);
      if (n.tag === "#text" || ANIM.has(n.tag) || isMover(n) || !n.children.length) return null;
      const children = n.children.map(select).filter(Boolean);
      return children.length ? {...n, children} : null;
    };
    const body = svg.children.filter(c => c !== defs).map(select).filter(Boolean);
    return {
      svg: serialize({...svg, children: [...(defs ? [strip(defs)] : []), ...body]}, false),
      from: [mean(plane, v => v.from[0]), mean(plane, v => v.from[1])],
      to: [mean(plane, v => v.to[0]), mean(plane, v => v.to[1])],
      dur: mean(plane, v => v.dur),
      sway: plane.every(n => info.get(n).sway),
    };
  });
}
