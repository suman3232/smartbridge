// Shared SVG diagram helpers — OfferBridge report diagrams
// Design system: white bg, Segoe UI, indigo primary, restrained functional accents.

export const FONT = "Segoe UI, Arial, sans-serif";

export const C = {
  ink: "#0F172A",        // titles
  body: "#334155",       // body text
  muted: "#64748B",      // secondary
  faint: "#94A3B8",
  line: "#475569",       // connectors
  lineSoft: "#94A3B8",
  border: "#CBD5E1",
  card: "#F8FAFC",
  white: "#FFFFFF",
  primary: "#4F46E5",    // indigo-600
  primaryDark: "#3730A3",
  primarySoft: "#EEF2FF",
  primaryBorder: "#C7D2FE",
  green: "#059669",
  greenSoft: "#ECFDF5",
  greenBorder: "#A7F3D0",
  amber: "#B45309",
  amberSoft: "#FFFBEB",
  amberBorder: "#FDE68A",
  rose: "#BE123C",
  roseSoft: "#FFF1F2",
  roseBorder: "#FECDD3",
  cyan: "#0E7490",
  cyanSoft: "#ECFEFF",
  cyanBorder: "#A5F3FC",
  slateSoft: "#F1F5F9",
};

export const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Approximate Segoe UI width factors (per char, relative to font-size)
const WIDE = /[mwMW@₹]/, NARROW = /[iltfjIr.,:;'()\[\]|!· ]/;
export function textWidth(s, size, weight = 400) {
  let w = 0;
  for (const ch of String(s)) {
    let f = 0.54;
    if (WIDE.test(ch)) f = 0.86;
    else if (NARROW.test(ch)) f = 0.30;
    else if (/[A-Z0-9]/.test(ch)) f = 0.64;
    w += f;
  }
  const wf = weight >= 600 ? 1.06 : 1.0;
  return w * size * wf;
}

// Greedy word-wrap by estimated width
export function wrap(s, size, maxW, weight = 400) {
  const words = String(s).split(/\s+/);
  const lines = [];
  let cur = "";
  for (const w of words) {
    const t = cur ? cur + " " + w : w;
    if (textWidth(t, size, weight) <= maxW || !cur) cur = t;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines;
}

export function T(x, y, s, { size = 15, weight = 400, fill = C.body, anchor = "start", style = "", spacing = null, font = FONT } = {}) {
  const extra = [
    style ? `font-style="${style}"` : "",
    spacing ? `letter-spacing="${spacing}"` : "",
  ].filter(Boolean).join(" ");
  return `<text x="${x}" y="${y}" font-family="${font}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" ${extra}>${esc(s)}</text>`;
}

// Multi-line text block; returns {svg, height}
export function TBlock(x, y, s, { size = 15, weight = 400, fill = C.body, anchor = "start", maxW = 400, lh = null } = {}) {
  const lines = Array.isArray(s) ? s : wrap(s, size, maxW, weight);
  const LH = lh || Math.round(size * 1.38);
  const svg = lines.map((ln, i) => T(x, y + i * LH, ln, { size, weight, fill, anchor })).join("");
  return { svg, height: (lines.length - 1) * LH, lines: lines.length };
}

export function rect(x, y, w, h, { fill = C.white, stroke = C.border, sw = 1.5, rx = 10, dash = "", opacity = 1 } = {}) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" ${dash ? `stroke-dasharray="${dash}"` : ""} ${opacity < 1 ? `opacity="${opacity}"` : ""}/>`;
}

export function circle(cx, cy, r, { fill = C.white, stroke = C.border, sw = 1.5 } = {}) {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
}

// Orthogonal / straight connector with optional arrowhead + label pill.
// pts: [[x,y],...]  opts: {color, sw, dash, head:'end'|'both'|'none', label, labelAt (0..1 along polyline), labelDy, labelSize, labelFill, headSize}
export function flow(pts, o = {}) {
  const {
    color = C.line, sw = 1.7, dash = "", head = "end",
    label = "", labelAt = 0.5, labelDx = 0, labelDy = 0, labelSize = 13,
    labelFill = C.muted, headSize = 7.5, labelBg = C.white, labelWeight = 500, round = 8,
    hops = [],   // x-coords on horizontal segments where the line arcs over a crossing line
  } = o;
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    if (y0 === y1 && hops.length) {
      const dir = Math.sign(x1 - x0);
      const inSeg = hops.filter(h => h > Math.min(x0, x1) + 10 && h < Math.max(x0, x1) - 10)
        .sort((a, b) => dir * (a - b));
      for (const h of inSeg) {
        d += ` L${h - dir * 8} ${y0} A8 8 0 0 ${dir > 0 ? 1 : 0} ${h + dir * 8} ${y0}`;
      }
    }
    d += ` L${x1} ${y1}`;
  }
  let svg = `<path d="${d}" fill="none" stroke="${color}" stroke-width="${sw}" ${dash ? `stroke-dasharray="${dash}"` : ""} stroke-linejoin="round"/>`;
  const headAt = (a, b) => {
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    const s = headSize;
    const x = b[0], y = b[1];
    const p1 = [x - s * Math.cos(ang - 0.44), y - s * Math.sin(ang - 0.44)];
    const p2 = [x - s * Math.cos(ang + 0.44), y - s * Math.sin(ang + 0.44)];
    return `<path d="M${p1[0].toFixed(1)} ${p1[1].toFixed(1)} L${x} ${y} L${p2[0].toFixed(1)} ${p2[1].toFixed(1)} Z" fill="${color}"/>`;
  };
  if (head === "end" || head === "both") svg += headAt(pts[pts.length - 2], pts[pts.length - 1]);
  if (head === "both" || head === "start") svg += headAt(pts[1], pts[0]);
  if (label) {
    // place label at fraction along total length
    const segs = [];
    let total = 0;
    for (let i = 1; i < pts.length; i++) {
      const L = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      segs.push(L); total += L;
    }
    let target = total * labelAt, x = pts[0][0], y = pts[0][1];
    for (let i = 1; i < pts.length; i++) {
      if (target <= segs[i - 1]) {
        const f = segs[i - 1] === 0 ? 0 : target / segs[i - 1];
        x = pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f;
        y = pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f;
        break;
      }
      target -= segs[i - 1];
      x = pts[i][0]; y = pts[i][1];
    }
    x += labelDx; y += labelDy;
    const lines = String(label).split("\n");
    const wMax = Math.max(...lines.map(l => textWidth(l, labelSize, labelWeight)));
    const lh = labelSize * 1.25;
    const bh = lines.length * lh + 6;
    if (labelBg) svg += `<rect x="${x - wMax / 2 - 7}" y="${y - bh / 2 - 1}" width="${wMax + 14}" height="${bh + 2}" rx="6" fill="${labelBg}" opacity="0.94"/>`;
    lines.forEach((ln, i) => {
      svg += T(x, y - bh / 2 + lh * (i + 1) - 2, ln, { size: labelSize, weight: labelWeight, fill: labelFill, anchor: "middle" });
    });
  }
  return svg;
}

// Diagram header (eyebrow + title + subtitle), returns svg
export function header(cx, { eyebrow, title, subtitle, y = 56, align = "middle" } = {}) {
  let svg = "";
  let yy = y;
  if (eyebrow) {
    svg += T(cx, yy, eyebrow.toUpperCase(), { size: 14.5, weight: 700, fill: C.primary, anchor: align, spacing: "3.5" });
    yy += 36;
  }
  svg += T(cx, yy, title, { size: 33, weight: 700, fill: C.ink, anchor: align });
  if (subtitle) {
    yy += 30;
    svg += T(cx, yy, subtitle, { size: 15.5, weight: 400, fill: C.muted, anchor: align });
  }
  return svg;
}

export function doc(w, h, body, { bg = C.white } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<rect width="${w}" height="${h}" fill="${bg}"/>
${body}
</svg>`;
}

// ---- ER helpers -----------------------------------------------------------
// Entity table box. cols: [{name, type, pk, fk, uk}]
export function entity(x, y, w, title, cols, { accent = C.primary, soft = C.primarySoft, compact = false, note = "" } = {}) {
  const rowH = 26, headH = 40;
  const h = headH + cols.length * rowH + (note ? 30 : 8);
  let svg = `<g>`;
  svg += `<rect x="${x + 3}" y="${y + 4}" width="${w}" height="${h}" rx="10" fill="#0F172A" opacity="0.05"/>`;
  svg += rect(x, y, w, h, { fill: C.white, stroke: C.border, sw: 1.4, rx: 10 });
  // header band
  svg += `<path d="M${x} ${y + 10} a10 10 0 0 1 10 -10 h${w - 20} a10 10 0 0 1 10 10 v${headH - 10} h-${w} Z" fill="${soft}"/>`;
  svg += `<line x1="${x}" y1="${y + headH}" x2="${x + w}" y2="${y + headH}" stroke="${accent}" stroke-width="2"/>`;
  svg += T(x + 14, y + 27, title, { size: 18, weight: 700, fill: C.ink });
  cols.forEach((c, i) => {
    const yy = y + headH + (i + 1) * rowH - 8;
    let badge = "", bx = x + 12;
    if (c.pk) { badge = "PK"; }
    else if (c.fk) { badge = "FK"; }
    else if (c.uk) { badge = "UK"; }
    if (badge) {
      const bc = badge === "PK" ? C.amber : badge === "FK" ? C.primary : C.cyan;
      svg += `<rect x="${bx}" y="${yy - 13}" width="26" height="17" rx="4" fill="${bc}" opacity="0.14"/>`;
      svg += T(bx + 13, yy, badge, { size: 11, weight: 700, fill: bc, anchor: "middle" });
    }
    svg += T(x + 46, yy + 1, c.name, { size: 14.5, weight: c.pk ? 600 : 400, fill: c.pk ? C.ink : C.body });
    if (c.type) svg += T(x + w - 12, yy + 1, c.type, { size: 12.5, weight: 400, fill: C.faint, anchor: "end" });
    if (i < cols.length - 1) svg += `<line x1="${x + 10}" y1="${y + headH + (i + 1) * rowH + 4}" x2="${x + w - 10}" y2="${y + headH + (i + 1) * rowH + 4}" stroke="#EDF2F7" stroke-width="1"/>`;
  });
  if (note) svg += T(x + 12, y + h - 10, note, { size: 12, weight: 400, fill: C.faint, style: "italic" });
  svg += `</g>`;
  return { svg, h, rowY: (i) => y + headH + (i + 1) * rowH - 13 };
}

// Crow's foot glyph at endpoint (x,y), pointing INTO the box along dir: 'L'(line comes from left→box at right side? )
// dir = direction the line travels INTO the endpoint: 'E' means line arrives moving east (endpoint on left edge of a box).
// kind: 'one' (||), 'many' (crow), 'zeroOne' (o|), 'oneMany' (|crow), 'zeroMany' (o crow)
export function foot(x, y, dir, kind, color = C.line) {
  const s = 9;          // glyph size
  const g = [];
  const vec = { E: [1, 0], W: [-1, 0], S: [0, 1], N: [0, -1] }[dir];
  const [dx, dy] = vec;         // direction of travel into endpoint
  const px = -dy, py = dx;      // perpendicular
  const L = (a, b, c, d) => g.push(`<line x1="${a}" y1="${b}" x2="${c}" y2="${d}" stroke="${color}" stroke-width="1.7"/>`);
  const back = (k) => [x - dx * k, y - dy * k];
  if (kind.includes("many")) {
    const [bx, by] = back(s + 2);
    L(bx, by, x + px * s * 0.78, y + py * s * 0.78);
    L(bx, by, x - px * s * 0.78, y - py * s * 0.78);
    L(bx, by, x, y);
  }
  if (kind === "one" || kind === "oneMany") {
    const k = kind === "one" ? 8 : s + 7;
    const [bx, by] = back(k);
    L(bx + px * 7, by + py * 7, bx - px * 7, by - py * 7);
    if (kind === "one") {
      const [cx2, cy2] = back(14);
      L(cx2 + px * 7, cy2 + py * 7, cx2 - px * 7, cy2 - py * 7);
    }
  }
  if (kind.startsWith("zero")) {
    const [bx, by] = back(kind === "zeroOne" ? 16 : s + 9);
    g.push(`<circle cx="${bx}" cy="${by}" r="5" fill="${C.white}" stroke="${color}" stroke-width="1.6"/>`);
    if (kind === "zeroOne") {
      const [cx2, cy2] = back(7);
      L(cx2 + px * 7, cy2 + py * 7, cx2 - px * 7, cy2 - py * 7);
    }
  }
  return g.join("");
}

// ER relationship: polyline + feet at both ends + optional label
export function rel(pts, kindStart, kindEnd, { color = "#8B96A9", sw = 1.6, label = "", labelAt = 0.5, labelDy = -10, labelDx = 0, dash = "", hops = [] } = {}) {
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    if (y0 === y1 && hops.length) {
      const dir = Math.sign(x1 - x0);
      const inSeg = hops.filter(h => h > Math.min(x0, x1) + 10 && h < Math.max(x0, x1) - 10)
        .sort((a, b) => dir * (a - b));
      for (const h of inSeg) d += ` L${h - dir * 8} ${y0} A8 8 0 0 ${dir > 0 ? 1 : 0} ${h + dir * 8} ${y0}`;
    }
    d += ` L${x1} ${y1}`;
  }
  let svg = `<path d="${d}" fill="none" stroke="${color}" stroke-width="${sw}" ${dash ? `stroke-dasharray="${dash}"` : ""} stroke-linejoin="round"/>`;
  // direction into start = from pts[1] to pts[0]
  const dirOf = (a, b) => Math.abs(b[0] - a[0]) >= Math.abs(b[1] - a[1]) ? (b[0] > a[0] ? "E" : "W") : (b[1] > a[1] ? "S" : "N");
  svg += foot(pts[0][0], pts[0][1], dirOf(pts[1], pts[0]), kindStart, color);
  const n = pts.length;
  svg += foot(pts[n - 1][0], pts[n - 1][1], dirOf(pts[n - 2], pts[n - 1]), kindEnd, color);
  if (label) {
    svg += flow(pts, { color: "none", sw: 0, head: "none", label, labelAt, labelDy, labelDx, labelSize: 12.5, labelFill: C.muted });
  }
  return svg;
}
