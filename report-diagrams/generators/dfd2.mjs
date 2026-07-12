// Diagram 7 — Level-2 DFD: Deal Lifecycle (expands process 2.0), landscape
import { C, T, rect, flow, header, doc } from "./lib.mjs";
import { entityBox, processBox, storeBox } from "./dfd-lib.mjs";
import { render } from "./render.mjs";

const W = 2220, H = 1420;
let s = "";

s += header(W / 2, {
  eyebrow: "OfferBridge · Data Flow Diagram",
  title: "Level-2 DFD — Deal Lifecycle (Process 2.0 Expanded)",
  subtitle: "From deal creation to admin-verified completion, wallet payout and referral qualification",
});

const R1 = 500, R2 = 900, PW = 250, PH = 150;

// ---- row 1: pipeline ----
s += processBox(420,  R1, "2.1", ["Create Deal", "Request"], { w: PW, h: PH, sub: ["shopper posts product, prices,", "commission & address"] });
s += processBox(760,  R1, "2.2", ["Review &", "Approve Deal"], { w: PW, h: PH, sub: ["admin verdict · assigns", "support contact number"] });
s += processBox(1100, R1, "2.3", ["Reserve", "Deal"], { w: PW, h: PH, sub: ["atomic claim ·", "30-minute hold"] });
s += processBox(1440, R1, "2.4", ["Submit Order", "Proof"], { w: PW, h: PH, sub: ["tracking ID / screenshot", "before timer ends"] });
s += processBox(1780, R1, "2.6", ["Complete Deal", "& Credit Payout"], { w: PW, h: PH, sub: ["admin-verified · exactly-", "once wallet credit"] });

// ---- row 2 ----
s += processBox(1000, R2, "2.5", ["Release & Expiry", "Handling"], { w: 260, h: PH, sub: ["voluntary release (grace) ·", "server-side expiry sweep"] });
s += T(1000, R2 + PH / 2 + 24, "triggered on countdown expiry or voluntary release", { size: 11.8, fill: C.faint, anchor: "middle", style: "italic" });
s += processBox(1800, R2, "2.7", ["Referral", "Qualification"], { w: 260, h: PH, sub: ["first completed deal ·", "min-value & cap rules"] });

// ---- central deals store ----
s += storeBox(320, 720, "D2", "Deals", { w: 820, sub: "status: pending → approved → accepted → in_progress → completed   ·   cancelled / rejected" });

// verticals into deals bar
const sc = "#7C8BA1";
s += flow([[420, R1 + PH / 2], [420, 697]], { color: sc, sw: 1.6, label: "new deal\n(pending)", labelAt: 0.5, labelSize: 11.8 });
s += flow([[760, R1 + PH / 2], [760, 697]], { color: sc, sw: 1.6, head: "both", label: "approved + support\nno. / rejected", labelAt: 0.5, labelSize: 11.8 });
s += flow([[1100, R1 + PH / 2], [1100, 697]], { color: sc, sw: 1.6, head: "both", label: "open deals ·\nclaim + hold", labelAt: 0.5, labelSize: 11.8 });
s += flow([[1340, R1 + PH / 2], [1340, 640], [1320, 640], [1320, 697]], { color: sc, sw: 1.6, label: "status → in progress\n· stop countdown", labelAt: 0.28, labelSize: 11.8, labelDx: -115 });
s += flow([[1720, R1 + PH / 2], [1720, 620], [1300, 620], [1300, 697]], { color: sc, sw: 1.6, label: "status → completed (single winner)", labelAt: 0.5, labelSize: 11.8, hops: [1340, 1380, 1530], labelDy: -14 });
s += flow([[1000, R2 - PH / 2], [1000, 743]], { color: sc, sw: 1.6, label: "reopen deal\n(→ approved)", labelAt: 0.5, labelSize: 11.8 });

// ---- entities ----
s += entityBox(140, R1, "Shopper", { w: 190, h: 72 });
s += entityBox(140, R2, "Card Holder", { w: 190, h: 72 });
function adminEntity(cx, cy) {
  let g = entityBox(cx, cy, "Admin", { w: 180, h: 66 });
  g += `<line x1="${cx - 90 + 8}" y1="${cy + 33}" x2="${cx - 90 + 22}" y2="${cy + 19}" stroke="#94A3B8" stroke-width="1.6"/>`;
  return g;
}
s += adminEntity(640, 250);
s += T(640, 250 + 55, "duplicated entity", { size: 10.8, fill: C.faint, anchor: "middle", style: "italic" });
s += adminEntity(1680, 250);
s += T(1680, 250 + 55, "duplicated entity", { size: 10.8, fill: C.faint, anchor: "middle", style: "italic" });

const g = "#64748B";
// shopper -> 2.1
s += flow([[235, 500], [295, 500]], { color: g, sw: 1.6, label: "deal details · address / cancel", labelAt: 0.5, labelSize: 12, labelDy: -34 });
// admin1 -> 2.2 ; admin2 -> 2.6
s += flow([[660, 283], [730, 425]], { color: g, sw: 1.6, label: "approve / reject\n+ notes", labelAt: 0.5, labelSize: 11.8, labelDx: -62 });
s += flow([[1700, 283], [1760, 425]], { color: g, sw: 1.6, label: "verify proof &\nmark complete", labelAt: 0.5, labelSize: 11.8, labelDx: -66 });

// admin numbers store (top)
s += storeBox(800, 250, "D11", "Support Contact Pool", { w: 280, sub: "admin_numbers (round-robin)" });
s += flow([[850, 425], [850, 273]], { color: sc, sw: 1.6, label: "next support\nnumber", labelAt: 0.5, labelSize: 11.8, labelDx: 58 });

// card holder -> 2.3 / 2.4 (forked flow) and <-> 2.5
s += flow([[140, 864], [140, 660], [1360, 660], [1360, R1 + PH / 2]],
  { color: g, sw: 1.6, label: "accept deal · order proof\n(tracking ID / screenshot)", labelAt: 0.45, labelSize: 12.2, hops: [420, 760, 1180, 1300, 1320] });
s += flow([[1000, 660], [1000, R1 + PH / 2]], { color: g, sw: 1.6 });
s += flow([[235, 900], [870, 900]], { color: g, sw: 1.6, head: "both", label: "release request / cooldown & strike notices", labelAt: 0.42, labelSize: 12.2 });

// ---- bottom stores ----
const SB = 1120;
s += storeBox(560, SB, "D4", "Reservation Audit", { w: 360, sub: "reservation_events · cardholder_reliability" });
s += storeBox(1240, SB, "D3", "Orders", { w: 230, sub: "orders" });
s += storeBox(1510, SB, "F1", "Proof Files", { w: 230, sub: "order-screenshots bucket" });
s += storeBox(1780, SB, "D7", "Referrals", { w: 260, sub: "referrals · referral_config" });

// 2.5 <-> D4
s += flow([[880, R2 + PH / 2], [880, SB - 23]], { color: sc, sw: 1.6, head: "both", label: "strike · escalating cooldown\n(1 h / 24 h / 7 d) · release event", labelAt: 0.5, labelSize: 11.8, labelDx: -105 });
// 2.3 <-> D4 (eligibility read + reserved event)
s += flow([[1180, R1 + PH / 2], [1180, 1050], [960, 1050], [960, SB], [922, SB]],
  { color: sc, sw: 1.6, head: "both", label: "cooldown & per-deal cap check\n· 'reserved' event", labelAt: 0.30, labelSize: 11.8, labelDx: 105 });
// 2.4 -> D3 and F1
s += flow([[1380, R1 + PH / 2], [1380, SB - 23]], { color: sc, sw: 1.6, label: "order row\n(placed)", labelAt: 0.72, labelSize: 11.8 });
s += flow([[1530, R1 + PH / 2], [1530, SB - 23]], { color: sc, sw: 1.6, label: "screenshot\nfile", labelAt: 0.72, labelSize: 11.8 });

// 2.6 -> 2.7
s += flow([[1840, R1 + PH / 2], [1840, R2 - PH / 2]], { color: C.primary, sw: 1.8, label: "completed deal ·\nparticipants · value", labelAt: 0.5, labelSize: 11.8, labelDx: 92 });

// D5 wallets & ledger (right)
s += storeBox(1990, 900, "D5", "Wallets & Ledger", { w: 210, sub: "wallets · payments" });
s += flow([[1905, 540], [2085, 540], [2085, 877]], { color: C.primary, sw: 1.8, label: "payout credit: card-offer price\n+ commission · two ledger legs", labelAt: 0.5, labelSize: 11.8, labelDy: -6 });
s += flow([[1930, 900], [1990, 900]], { color: C.primary, sw: 1.8, label: "referrer reward ·\nwelcome bonus", labelAt: 0.5, labelSize: 11.8, labelDy: -48 });

// 2.7 <-> D7
s += flow([[1850, R2 + PH / 2], [1850, SB - 23]], { color: sc, sw: 1.6, head: "both", label: "pending referral →\nrewarded / voided", labelAt: 0.55, labelSize: 11.8, labelDx: 96 });

// ---- note + legend ----
s += T(320, 1300, "Note: every sub-process also writes user alerts to the Notifications store (D9) — shown in the Level-1 diagram.", { size: 13, fill: C.muted, style: "italic" });

const ly = 1360;
let lx = 320;
s += rect(lx, ly - 20, 50, 28, { fill: C.slateSoft, stroke: "#94A3B8", sw: 1.3, rx: 5 });
s += T(lx + 62, ly, "External entity", { size: 13, fill: C.muted });
lx += 230;
s += rect(lx, ly - 20, 50, 28, { fill: C.white, stroke: C.primary, sw: 1.5, rx: 9 });
s += T(lx + 62, ly, "Process (2.x)", { size: 13, fill: C.muted });
lx += 210;
s += `<line x1="${lx}" y1="${ly - 20}" x2="${lx + 50}" y2="${ly - 20}" stroke="${C.cyan}" stroke-width="1.6"/><line x1="${lx}" y1="${ly + 6}" x2="${lx + 50}" y2="${ly + 6}" stroke="${C.cyan}" stroke-width="1.6"/>`;
s += T(lx + 62, ly, "Data store", { size: 13, fill: C.muted });
lx += 200;
s += flow([[lx, ly - 7], [lx + 50, ly - 7]], { color: g, sw: 1.6 });
s += T(lx + 62, ly, "Data flow", { size: 13, fill: C.muted });
lx += 180;
s += flow([[lx, ly - 7], [lx + 50, ly - 7]], { color: C.primary, sw: 1.8 });
s += T(lx + 62, ly, "Financial flow", { size: 13, fill: C.muted });

await render("07-dfd-level-2-deal-lifecycle", doc(W, H, s), 3600);
