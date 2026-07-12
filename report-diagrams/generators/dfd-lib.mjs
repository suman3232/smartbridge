// Gane & Sarson DFD symbols
import { C, T, rect } from "./lib.mjs";

// External entity: square-ish box with soft shadow
export function entityBox(cx, cy, name, { w = 200, h = 78, sub = "" } = {}) {
  const x = cx - w / 2, y = cy - h / 2;
  let g = `<rect x="${x + 4}" y="${y + 5}" width="${w}" height="${h}" rx="6" fill="#0F172A" opacity="0.07"/>`;
  g += rect(x, y, w, h, { fill: C.slateSoft, stroke: "#94A3B8", sw: 1.6, rx: 6 });
  const lines = Array.isArray(name) ? name : [name];
  const lh = 21;
  const y0 = cy - ((lines.length - 1) * lh) / 2 + 6 - (sub ? 8 : 0);
  lines.forEach((ln, i) => { g += T(cx, y0 + i * lh, ln, { size: 16, weight: 700, fill: C.ink, anchor: "middle" }); });
  if (sub) g += T(cx, y0 + lines.length * lh, sub, { size: 11.8, fill: C.muted, anchor: "middle" });
  return g;
}

// Process: rounded rect with number band
export function processBox(cx, cy, num, name, { w = 250, h = 110, sub = "", accent = C.primary, soft = C.primarySoft } = {}) {
  const x = cx - w / 2, y = cy - h / 2;
  let g = `<rect x="${x + 4}" y="${y + 5}" width="${w}" height="${h}" rx="14" fill="#0F172A" opacity="0.07"/>`;
  g += rect(x, y, w, h, { fill: C.white, stroke: accent, sw: 1.8, rx: 14 });
  g += `<path d="M${x} ${y + 14} a14 14 0 0 1 14 -14 h${w - 28} a14 14 0 0 1 14 14 v${18} h-${w} Z" fill="${soft}"/>`;
  g += T(x + 14, y + 22, num, { size: 15, weight: 700, fill: accent });
  const lines = Array.isArray(name) ? name : [name];
  const subs = sub ? (Array.isArray(sub) ? sub : [sub]) : [];
  const lh = 22;
  const cyText = y + 32 + (h - 32) / 2;
  const y0 = cyText - ((lines.length - 1) * lh) / 2 + 6 - subs.length * 8;
  lines.forEach((ln, i) => { g += T(cx, y0 + i * lh, ln, { size: 16, weight: 700, fill: C.ink, anchor: "middle" }); });
  subs.forEach((sl, i) => { g += T(cx, y0 + lines.length * lh + i * 17, sl, { size: 12.2, fill: C.muted, anchor: "middle" }); });
  return g;
}

// Data store: open-ended rectangle with ID cell
export function storeBox(x, cy, id, name, { w = 240, h = 46, sub = "" } = {}) {
  const y = cy - h / 2;
  let g = "";
  g += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${C.cyanSoft}" opacity="0.55"/>`;
  g += `<line x1="${x}" y1="${y}" x2="${x + w}" y2="${y}" stroke="${C.cyan}" stroke-width="1.8"/>`;
  g += `<line x1="${x}" y1="${y + h}" x2="${x + w}" y2="${y + h}" stroke="${C.cyan}" stroke-width="1.8"/>`;
  g += `<line x1="${x + 44}" y1="${y}" x2="${x + 44}" y2="${y + h}" stroke="${C.cyan}" stroke-width="1.4"/>`;
  g += `<line x1="${x}" y1="${y}" x2="${x}" y2="${y + h}" stroke="${C.cyan}" stroke-width="1.8"/>`;
  g += T(x + 22, cy + 5.5, id, { size: 14, weight: 700, fill: C.cyan, anchor: "middle" });
  g += T(x + 56, cy + (sub ? 0.5 : 5.5), name, { size: 14.6, weight: 600, fill: C.ink });
  if (sub) g += T(x + 56, cy + 17, sub, { size: 11.3, fill: C.muted });
  return g;
}
