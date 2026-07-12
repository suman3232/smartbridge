// Diagram 3 — Use Case Diagram (portrait, UML)
import { C, T, rect, flow, header, doc, textWidth } from "./lib.mjs";
import { render } from "./render.mjs";

const W = 1240, H = 1790;
let s = "";

s += header(W / 2, {
  eyebrow: "OfferBridge · UML",
  title: "Use Case Diagram",
  subtitle: "Actors and implemented system functionality",
});

// ---- helpers ---------------------------------------------------------------
function actor(cx, cy, name, sub = "") {
  let g = "";
  const c = C.ink;
  g += `<circle cx="${cx}" cy="${cy - 34}" r="12" fill="${C.primarySoft}" stroke="${c}" stroke-width="2"/>`;
  g += `<line x1="${cx}" y1="${cy - 22}" x2="${cx}" y2="${cy + 8}" stroke="${c}" stroke-width="2"/>`;
  g += `<line x1="${cx - 16}" y1="${cy - 12}" x2="${cx + 16}" y2="${cy - 12}" stroke="${c}" stroke-width="2"/>`;
  g += `<line x1="${cx}" y1="${cy + 8}" x2="${cx - 13}" y2="${cy + 28}" stroke="${c}" stroke-width="2"/>`;
  g += `<line x1="${cx}" y1="${cy + 8}" x2="${cx + 13}" y2="${cy + 28}" stroke="${c}" stroke-width="2"/>`;
  g += T(cx, cy + 50, name, { size: 15.5, weight: 700, fill: C.ink, anchor: "middle" });
  if (sub) g += T(cx, cy + 68, sub, { size: 11.8, fill: C.muted, anchor: "middle" });
  return g;
}

const OW = 252, OH = 56;
function usecase(cx, cy, label, { note = "", accent = C.border } = {}) {
  let g = `<ellipse cx="${cx}" cy="${cy}" rx="${OW / 2}" ry="${OH / 2}" fill="${C.white}" stroke="${accent}" stroke-width="1.6"/>`;
  const lines = Array.isArray(label) ? label : [label];
  const lh = 18;
  const y0 = cy - ((lines.length - 1) * lh) / 2 + 5;
  lines.forEach((ln, i) => { g += T(cx, y0 + i * lh, ln, { size: 14.2, weight: 600, fill: C.body, anchor: "middle" }); });
  if (note) g += T(cx, cy + OH / 2 + 16, note, { size: 11, fill: C.faint, anchor: "middle", style: "italic" });
  return g;
}

function groupLabel(x, y, txt) {
  return T(x, y, txt.toUpperCase(), { size: 11.5, weight: 700, fill: C.primary, spacing: "2" });
}

// association line actor->oval edge
function link(ax, ay, cx, cy, { dash = "", color = "#8B96A9" } = {}) {
  // stop at ellipse boundary
  const dx = cx - ax, dy = cy - ay;
  const len = Math.hypot(dx / (OW / 2), dy / (OH / 2));
  const f = 1 - 1 / len;
  const ex = ax + dx * f, ey = ay + dy * f;
  return `<line x1="${ax}" y1="${ay}" x2="${ex.toFixed(1)}" y2="${ey.toFixed(1)}" stroke="${color}" stroke-width="1.5" ${dash ? `stroke-dasharray="${dash}"` : ""}/>`;
}

// ---- system boundary --------------------------------------------------------
const BX = 300, BW = 710, BY = 168, BH = 1522;   // x 300..1010, y 168..1690
s += rect(BX, BY, BW, BH, { fill: "#FDFDFE", stroke: C.border, sw: 1.6, rx: 16 });
s += T(BX + BW - 26, BY + 34, "OfferBridge Platform", { size: 19, weight: 700, fill: C.ink, anchor: "end" });
s += `<line x1="${BX + 24}" y1="${BY + 50}" x2="${BX + BW - 24}" y2="${BY + 50}" stroke="#E2E8F0" stroke-width="1.4"/>`;

const AX = 445, BXc = 845; // oval column centers

// ---- Column A ovals ---------------------------------------------------------
// Public (visitor)
s += groupLabel(AX - OW / 2, 236 - 44, "Public — no sign-in needed");
s += usecase(AX, 236, "Browse open deals");
s += usecase(AX, 306, ["Contact support", "(WhatsApp)"]);
s += usecase(AX, 386, "Register account");

// Shopper
s += groupLabel(AX - OW / 2, 496 - 42, "Shopper");
s += usecase(AX, 496, "Create deal request");
s += usecase(AX, 566, "Cancel own deal");

// Card holder
s += groupLabel(AX - OW / 2, 1102 - 42, "Card holder");
s += usecase(AX, 1102, ["Reserve (accept)", "a deal"]);
s += usecase(AX, 1172, "Release reservation");
s += usecase(AX, 1242, ["Submit order proof", "(tracking / screenshot)"]);

// ---- Column B ovals ---------------------------------------------------------
s += usecase(BXc, 306, "Verify email (OTP)");

s += groupLabel(BXc - OW / 2, 566 - 42, "Any signed-in user");
const shared = [
  "Sign in (email / Google)",
  "Manage profile",
  "Submit KYC documents",
  ["View wallet &", "transaction ledger"],
  "Request withdrawal",
  "View notifications",
  "Refer & earn rewards",
  ["Track product prices", "& set price alerts"],
];
shared.forEach((u, i) => { s += usecase(BXc, 566 + i * 70, u); });

s += groupLabel(BXc - OW / 2, 1196 - 42, "Administration");
const adminUC = [
  ["Approve / reject", "deal requests"],
  "Review KYC submissions",
  ["Complete deals &", "credit payouts"],
  ["Process withdrawal", "requests"],
  ["Configure rules (reservation ·", "referral · support)"],
  ["Manage admins &", "cardholder reliability"],
];
adminUC.forEach((u, i) => { s += usecase(BXc, 1196 + i * 70, u); });

s += usecase(BXc, 1640, ["Auto re-check prices &", "send drop alerts (6 h)"]);

// ---- actors ------------------------------------------------------------------
const LAX = 150;
s += actor(LAX, 300, "Visitor", "guest");
s += actor(LAX, 540, "Shopper", "posts deals");
s += actor(LAX, 820, "Registered User", "verified account");
s += actor(LAX, 1180, "Card Holder", "fulfils deals");
const RAX = 1116;
s += actor(RAX, 1370, "Admin", "operations");
// scheduler as «system» box actor
s += rect(RAX - 74, 1608, 148, 64, { fill: C.slateSoft, stroke: C.border, sw: 1.4, rx: 10 });
s += T(RAX, 1632, "«system»", { size: 11.5, fill: C.muted, anchor: "middle", style: "italic" });
s += T(RAX, 1652, "pg_cron Scheduler", { size: 13.8, weight: 700, fill: C.ink, anchor: "middle" });

// ---- generalization (Shopper / Card Holder --|> Registered User) -------------
function genArrow(x, y1, y2) {
  // vertical line with hollow triangle at (x, y2) pointing toward general actor
  const dir = Math.sign(y2 - y1);
  const ty = y2 - dir * 16;
  let g = `<line x1="${x}" y1="${y1}" x2="${x}" y2="${ty - dir * 2}" stroke="#8B96A9" stroke-width="1.6"/>`;
  g += `<path d="M${x} ${y2} L${x - 9} ${ty} L${x + 9} ${ty} Z" fill="${C.white}" stroke="#8B96A9" stroke-width="1.6"/>`;
  return g;
}
s += genArrow(LAX, 616, 762);   // shopper -> RU
s += genArrow(LAX, 1122, 910);  // card holder -> RU

// ---- associations -------------------------------------------------------------
const AEdge = AX - OW / 2;      // 319
// Visitor
s += link(LAX + 26, 292, AX, 236);
s += link(LAX + 26, 302, AX, 306);
s += link(LAX + 26, 312, AX, 386);
// Shopper
s += link(LAX + 26, 534, AX, 496);
s += link(LAX + 26, 544, AX, 566);
// Card holder
s += link(LAX + 26, 1168, AX, 1102);
s += link(LAX + 26, 1176, AX, 1172);
s += link(LAX + 26, 1186, AX, 1242);
// Registered user -> shared column B
shared.forEach((_, i) => { s += link(LAX + 28, 812 + (i - 3.5) * 6, BXc, 566 + i * 70); });
// Admin
adminUC.forEach((_, i) => { s += link(RAX - 26, 1362 + (i - 2.5) * 6, BXc, 1196 + i * 70); });
// Scheduler
s += link(RAX - 76, 1640, BXc, 1640);

// ---- include -------------------------------------------------------------------
s += flow([[AX + OW / 2, 386], [660, 386], [660, 306], [BXc - OW / 2 - 6, 306]],
  { color: "#8B96A9", sw: 1.5, dash: "6 5", label: "«include»", labelAt: 0.82, labelSize: 12.5, headSize: 8, labelDy: -16 });

await render("03-use-case-diagram", doc(W, H, s), 3200);
