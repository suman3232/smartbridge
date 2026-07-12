// Diagram 6 — Level-1 DFD (landscape)
import { C, T, rect, flow, header, doc } from "./lib.mjs";
import { entityBox, processBox, storeBox } from "./dfd-lib.mjs";
import { render } from "./render.mjs";

const W = 2140, H = 1330;
let s = "";

s += header(W / 2, {
  eyebrow: "OfferBridge · Data Flow Diagram",
  title: "Level-1 DFD — Major Processes and Data Stores",
  subtitle: "Decomposition of the OfferBridge platform into its six core processes",
});

const PY = 640, PH = 170, PW = 240;   // process row
const procs = [
  { cx: 460,  n: "2.0", name: ["Deal Lifecycle", "Management"], sub: ["create · review · reserve ·", "order proof · expire · complete"] },
  { cx: 760,  n: "6.0", name: ["Notification", "Delivery"], sub: ["in-app alerts for every", "lifecycle event"] },
  { cx: 1060, n: "3.0", name: ["Settlement &", "Wallet"], sub: ["payout credit · ledger ·", "KYC gate · withdrawals"] },
  { cx: 1360, n: "4.0", name: ["Referral", "Program"], sub: ["attribution · qualification", "· rewards"] },
  { cx: 1660, n: "5.0", name: ["Price", "Tracker"], sub: ["track products · history ·", "buy advice · alerts"] },
  { cx: 1960, n: "1.0", name: ["Authentication", "& Profiles"], sub: ["email-OTP · Google OAuth ·", "signup provisioning"] },
];
for (const p of procs) s += processBox(p.cx, PY, p.n, p.name, { w: PW, h: PH, sub: p.sub });

// ---- data stores (top row, aligned above owner process) ----
const SY = 330;
s += storeBox(340,  SY, "D2", "Deals", { sub: "deals" });
s += storeBox(650,  SY, "D9", "Notifications", { sub: "notifications" });
s += storeBox(940,  SY, "D5", "Wallets & Ledger", { sub: "wallets · payments" });
s += storeBox(1240, SY, "D7", "Referrals", { sub: "referrals · referral_config" });
s += storeBox(1540, SY, "D8", "Tracked Products", { sub: "tracked_products · price_history" });
s += storeBox(1840, SY, "D1", "Profiles & Roles", { sub: "profiles · user_roles" });
// store access verticals (read/write)
for (const cx of [460, 760, 1060, 1360, 1660, 1960]) {
  s += flow([[cx, PY - PH / 2], [cx, SY + 23]], { color: "#7C8BA1", sw: 1.6, head: "both" });
}

// ---- bottom stores ----
s += storeBox(340, 890, "D3", "Orders & Proofs", { sub: "orders · order-screenshots" });
s += storeBox(340, 985, "D4", "Reservation Audit", { sub: "reservation_events · cardholder_reliability" });
s += flow([[460, PY + PH / 2], [460, 890 - 23]], { color: "#7C8BA1", sw: 1.6, head: "both" });
s += flow([[580, PY + 60], [605, PY + 60], [605, 985], [582, 985]], { color: "#7C8BA1", sw: 1.6, head: "end" });

s += storeBox(940, 890, "D6", "KYC Records", { sub: "kycs · kyc-documents" });
s += storeBox(940, 985, "D10", "Withdrawal Requests", { sub: "withdrawal_requests" });
s += flow([[1060, PY + PH / 2], [1060, 890 - 23]], { color: "#7C8BA1", sw: 1.6, head: "both" });
s += flow([[1180, PY + 60], [1205, PY + 60], [1205, 985], [1182, 985]], { color: "#7C8BA1", sw: 1.6, head: "both" });

// ---- external entities ----
s += entityBox(115, 450, "Shopper", { w: 190, h: 72 });
s += entityBox(115, 760, "Card Holder", { w: 190, h: 72 });
s += entityBox(115, 1090, "Admin", { w: 190, h: 72 });
s += entityBox(1660, 1090, ["E-commerce", "Platforms"], { w: 200, h: 78 });
s += entityBox(1900, 920, "Google OAuth", { w: 190, h: 66 });
s += entityBox(1900, 1046, "Email Service", { w: 190, h: 66 });

const g = "#64748B";

// ---- user <-> 2.0 ----
s += flow([[210, 450], [380, 450], [380, 555]], { color: g, sw: 1.6, head: "both", label: "deal request · cancellation /\nstatus & approvals", labelAt: 0.30, labelSize: 12.2, labelDy: 0 });
s += flow([[210, 760], [400, 760], [400, 725]], { color: g, sw: 1.6, head: "both", label: "accept / release · order proof /\nopen deals · countdown", labelAt: 0.32, labelSize: 12.2, labelDy: -2 });

// ---- card holder -> 3.0 (KYC + withdrawal) ----
s += flow([[160, 796], [160, 830], [900, 830], [900, 705], [940, 705]],
  { color: g, sw: 1.6, label: "KYC documents · withdrawal request", labelAt: 0.55, labelSize: 12.3, hops: [300, 460, 605] });

// ---- shopper -> 5.0 (tracker input), top route ----
s += flow([[135, 414], [135, 196], [1500, 196], [1500, 600], [1540, 600]],
  { color: g, sw: 1.6, label: "product URL · target price · manual re-check", labelAt: 0.45, labelSize: 12.3 });

// ---- admin <-> 2.0 and 3.0 ----
s += flow([[115, 1054], [115, 780], [420, 780], [420, 725]],
  { color: g, sw: 1.6, head: "both", label: "review & completion\nverdicts / pending deals", labelAt: 0.42, labelSize: 12.3, labelDy: 26 });
s += flow([[210, 1080], [920, 1080], [920, 715], [940, 715]],
  { color: g, sw: 1.6, head: "both", label: "KYC verdicts · withdrawal settlement / queues", labelAt: 0.42, labelSize: 12.3, hops: [300] });

// ---- auth: users <-> 1.0 (top route) ----
s += flow([[115, 414], [115, 230], [2100, 230], [2100, 600], [2080, 600]],
  { color: g, sw: 1.6, head: "both", label: "sign-up / sign-in · OTP verification · session  (both user roles)", labelAt: 0.45, labelSize: 12.3 });

// ---- notifications delivered to users (top-left route) ----
s += flow([[640, 580], [615, 580], [615, 262], [95, 262], [95, 414]],
  { color: g, sw: 1.6, label: "in-app notifications (all users)", labelAt: 0.55, labelSize: 12.3 });

// ---- 1.0 <-> Google / Email ----
s += flow([[1930, PY + PH / 2], [1930, 887]], { color: g, sw: 1.6, head: "both", label: "OAuth\nhandshake", labelAt: 0.5, labelSize: 11.8 });
s += flow([[2080, 690], [2110, 690], [2110, 1046], [1995, 1046]], { color: g, sw: 1.6, label: "OTP & account\nemails", labelAt: 0.88, labelSize: 11.8, labelDy: -26 });

// ---- 5.0 <-> e-commerce ----
s += flow([[1690, PY + PH / 2], [1690, 1051]], { color: g, sw: 1.6, label: "page fetch", labelAt: 0.35, labelSize: 11.8, labelDx: 4 });
s += flow([[1630, 1051], [1630, PY + PH / 2]], { color: g, sw: 1.6, label: "price &\nstock data", labelAt: 0.62, labelSize: 11.8, labelDx: -4 });

// ---- inter-process flows ----
// 2.0 -> 3.0 payout (under 6.0)
s += flow([[580, 690], [610, 690], [610, 760], [970, 760], [970, PY + PH / 2]],
  { color: C.primary, sw: 1.8, label: "payout instruction on completion", labelAt: 0.55, labelSize: 12.3, labelFill: C.primaryDark });
// 2.0 -> 4.0 qualification (deep bottom route)
s += flow([[340, 700], [300, 700], [300, 1150], [1310, 1150], [1310, PY + PH / 2]],
  { color: C.primary, sw: 1.8, label: "first completed deal (referral qualification)", labelAt: 0.55, labelSize: 12.3, labelFill: C.primaryDark });
// 1.0 -> 4.0 referral attribution
s += flow([[1840, 690], [1810, 690], [1810, 760], [1440, 760], [1440, PY + PH / 2]],
  { color: C.primary, sw: 1.8, label: "referral attribution (invite code)", labelAt: 0.5, labelSize: 12.3, labelFill: C.primaryDark, hops: [1690, 1630, 1500] });
// 4.0 -> D5 reward credit
s += flow([[1310, 555], [1310, 410], [1120, 410], [1120, SY + 23]],
  { color: C.primary, sw: 1.8, label: "reward & welcome-bonus\ncredit + ledger entry", labelAt: 0.35, labelSize: 12.3, labelFill: C.primaryDark });
// notification request stubs + bus
s += flow([[580, 590], [640, 590]], { color: "#94A3B8", sw: 1.6 });
s += flow([[940, 590], [880, 590]], { color: "#94A3B8", sw: 1.6 });
s += flow([[1720, 555], [1720, 490]], { color: "#94A3B8", sw: 1.6, head: "none" });
s += flow([[1720, 490], [830, 490], [830, 555]],
  { color: "#94A3B8", sw: 1.6, label: "notification requests (deal events · payouts · rewards · price alerts)", labelAt: 0.42, labelSize: 12.3, hops: [1500, 1360, 1310, 1060] });
s += flow([[1440, 555], [1440, 490]], { color: "#94A3B8", sw: 1.6, head: "none" });

// ---- legend ----
const ly = 1285;
let lx = 620;
s += rect(lx, ly - 20, 50, 28, { fill: C.slateSoft, stroke: "#94A3B8", sw: 1.3, rx: 5 });
s += T(lx + 62, ly, "External entity", { size: 13, fill: C.muted });
lx += 220;
s += rect(lx, ly - 20, 50, 28, { fill: C.white, stroke: C.primary, sw: 1.5, rx: 9 });
s += T(lx + 62, ly, "Process", { size: 13, fill: C.muted });
lx += 170;
s += `<line x1="${lx}" y1="${ly - 20}" x2="${lx + 50}" y2="${ly - 20}" stroke="${C.cyan}" stroke-width="1.6"/><line x1="${lx}" y1="${ly + 6}" x2="${lx + 50}" y2="${ly + 6}" stroke="${C.cyan}" stroke-width="1.6"/>`;
s += T(lx + 62, ly, "Data store", { size: 13, fill: C.muted });
lx += 190;
s += flow([[lx, ly - 7], [lx + 50, ly - 7]], { color: g, sw: 1.6 });
s += T(lx + 62, ly, "Data flow", { size: 13, fill: C.muted });

await render("06-dfd-level-1", doc(W, H, s), 3600);
