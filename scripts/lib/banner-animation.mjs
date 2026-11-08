/** Extract a filter-free motion layer without losing the painted children of
 * animated groups, or geometry driven by an animated gradient in <defs>. */
const ANIM = new Set(["animate", "animateTransform", "animateMotion", "set"]);
const refsOf = attrs => [...attrs.matchAll(/url\(#([\w:-]+)\)/g)].map(x => x[1]);
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
export function motionRasterSource(overlay) {
  const svg = parseSvg(overlay);
  if (!svg) return null;
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
    return {...n, attrs, children:n.children.filter(c=>!ANIM.has(c.tag)).map(freeze)};
  };
  const still = freeze(svg);
  const box = /viewBox="([^"]+)"/.exec(still.attrs)?.[1].split(/\s+/).map(Number);
  if (box) still.attrs += ` width="${box[2]}" height="${box[3]}"`;
  return serialize(still);
}
