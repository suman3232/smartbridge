// Diagram 5 — Level-0 DFD (Context Diagram), portrait
import { C, T, rect, flow, header, doc } from "./lib.mjs";
import { entityBox, processBox } from "./dfd-lib.mjs";
import { render } from "./render.mjs";

const W = 1240, H = 1370;
let s = "";

s += header(W / 2, {
  eyebrow: "OfferBridge · Data Flow Diagram",
  title: "Level-0 DFD — Context Diagram",
  subtitle: "OfferBridge as a single process exchanging data with its external entities",
});

// ---- external entities ----
s += entityBox(250, 400, "Shopper", { sub: "posts card-offer deals" });
s += entityBox(990, 400, "Card Holder", { sub: "fulfils deals with cards" });
s += entityBox(250, 1030, "Admin", { sub: "reviews & settles" });
s += entityBox(990, 1030, ["E-commerce", "Platforms"], { sub: "" });
s += entityBox(620, 255, ["Google OAuth", "Provider"], {});
s += entityBox(620, 1175, "Email Service", { sub: "delivers OTP mails" });

// ---- central process ----
s += processBox(620, 715, "0", ["OfferBridge", "Platform"], {
  w: 380, h: 180, sub: ["deal marketplace · wallet & KYC ·", "referrals · price tracker"],
});

// ---- flows: draw every line first, then every label (so no line crosses a pill)
const g = "#64748B";
const flows = [
  [[[310, 442], [450, 626]], "Deal request · delivery\naddress · cancellation", 0.74],
  [[[485, 626], [345, 442]], "Approval status · reservation\n& order updates", 0.74],
  [[[930, 442], [790, 626]], "Accept / release · order proof\n· KYC · withdrawal request", 0.74],
  [[[755, 626], [895, 442]], "Open deals · countdown ·\npayout credit · alerts", 0.74],
  [[[310, 988], [450, 804]], "Review verdicts · payouts\n· rule configuration", 0.74],
  [[[485, 804], [345, 988]], "Pending queues · reliability\n& audit reports", 0.74],
  [[[790, 804], [930, 988]], "Product page request\n(HTTPS fetch)", 0.74],
  [[[895, 988], [755, 804]], "Price & availability data", 0.74],
  [[[660, 625], [660, 299]], "OAuth authorization\nrequest", 0.70],
  [[[580, 299], [580, 625]], "Identity token\n· profile", 0.70],
  [[[620, 805], [620, 1136]], "Verification-OTP &\naccount emails", 0.5],
];
for (const [pts] of flows) s += flow(pts, { color: g, sw: 1.7 });
for (const [pts, label, labelAt] of flows) s += flow(pts, { color: "none", sw: 0, head: "none", label, labelAt });

// ---- legend -------------------------------------------------------------
const ly = 1300;
let lx = 240;
s += rect(lx, ly - 20, 54, 30, { fill: C.slateSoft, stroke: "#94A3B8", sw: 1.4, rx: 5 });
s += T(lx + 66, ly, "External entity", { size: 13.5, fill: C.muted });
lx += 250;
s += rect(lx, ly - 20, 54, 30, { fill: C.white, stroke: C.primary, sw: 1.6, rx: 10 });
s += T(lx + 66, ly, "Process", { size: 13.5, fill: C.muted });
lx += 190;
s += flow([[lx, ly - 6], [lx + 52, ly - 6]], { color: g, sw: 1.7 });
s += T(lx + 64, ly, "Data flow", { size: 13.5, fill: C.muted });

await render("05-dfd-level-0-context", doc(W, H, s), 3200);
