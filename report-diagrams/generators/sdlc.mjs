// Diagram 1 — SDLC Waterfall Model (portrait)
import { C, T, TBlock, rect, flow, header, doc } from "./lib.mjs";
import { render } from "./render.mjs";

const W = 1240, H = 1590;
let s = "";

s += header(W / 2, {
  eyebrow: "OfferBridge · Software Development Life Cycle",
  title: "Waterfall Model",
  subtitle: "Sequential development phases as applied to the OfferBridge platform",
});

const phases = [
  {
    n: "01", name: "Requirements Analysis", accent: C.primary, soft: C.primarySoft, brd: C.primaryBorder,
    pts: [
      "Two-sided marketplace: shoppers post deals, card holders fulfil them",
      "Admin-mediated trust model: approval, verification and payouts",
      "Wallet, commission, KYC, withdrawal rules; referrals and price tracker",
    ],
  },
  {
    n: "02", name: "System Design", accent: C.primary, soft: C.primarySoft, brd: C.primaryBorder,
    pts: [
      "React SPA + Supabase backend-as-a-service architecture",
      "PostgreSQL schema: 20 tables, 6 enums, row-level security policies",
      "Deal lifecycle modelled as an RPC-driven state machine; ER and DFD models",
    ],
  },
  {
    n: "03", name: "Implementation", accent: C.primary, soft: C.primarySoft, brd: C.primaryBorder,
    pts: [
      "React 18 + TypeScript + Vite frontend with Tailwind CSS and shadcn/ui",
      "40+ SECURITY DEFINER SQL functions exposed as PostgREST RPCs",
      "Email-OTP + Google OAuth sign-in, PWA shell, storage, edge function",
    ],
  },
  {
    n: "04", name: "Testing", accent: C.primary, soft: C.primarySoft, brd: C.primaryBorder,
    pts: [
      "Automated end-to-end deal lifecycle script covering every role",
      "Row-level security and privilege checks for each actor",
      "Concurrency tests: atomic reservation, single-winner completion",
    ],
  },
  {
    n: "05", name: "Deployment", accent: C.primary, soft: C.primarySoft, brd: C.primaryBorder,
    pts: [
      "Vite production build served as a static, installable PWA",
      "Idempotent setup.sql provisions the entire database in one run",
      "Edge function deploy with pg_cron schedule (price checks every 6 h)",
    ],
  },
  {
    n: "06", name: "Maintenance", accent: C.primary, soft: C.primarySoft, brd: C.primaryBorder,
    pts: [
      "Admin panels for rules, reliability, referrals and overrides",
      "Re-runnable schema reconciliation keeps old databases current",
      "Reservation event audit trail supports monitoring and tuning",
    ],
  },
];

const cardW = 560, cardH = 158;
const x0 = 56, y0 = 190;
const dx = (W - x0 * 2 - cardW) / 5;   // horizontal step
const dy = 214;

phases.forEach((p, i) => {
  const x = x0 + dx * i, y = y0 + dy * i;
  // card
  s += `<rect x="${x + 4}" y="${y + 5}" width="${cardW}" height="${cardH}" rx="14" fill="#0F172A" opacity="0.06"/>`;
  s += rect(x, y, cardW, cardH, { fill: C.white, stroke: C.border, sw: 1.4, rx: 14 });
  s += `<path d="M${x} ${y + 14} a14 14 0 0 1 14 -14 h${cardW - 28} a14 14 0 0 1 14 14 v${30} h-${cardW} Z" fill="${p.soft}"/>`;
  // number chip
  s += `<rect x="${x + 14}" y="${y + 10}" width="46" height="26" rx="8" fill="${p.accent}"/>`;
  s += T(x + 37, y + 29, p.n, { size: 15, weight: 700, fill: "#fff", anchor: "middle" });
  s += T(x + 74, y + 30, p.name, { size: 20, weight: 700, fill: C.ink });
  // bullets
  let yy = y + 68;
  for (const b of p.pts) {
    s += `<circle cx="${x + 26}" cy="${yy - 5}" r="3" fill="${p.accent}"/>`;
    const blk = TBlock(x + 40, yy, b, { size: 14, fill: C.body, maxW: cardW - 58 });
    s += blk.svg;
    yy += blk.height + 27;
  }
  // connectors
  if (i < 5) {
    const ax = x0 + dx * (i + 1) + 92;             // inside next card's left region, under current card
    s += flow([[ax, y + cardH], [ax, y + dy]], { color: C.primary, sw: 2.2, headSize: 8.5 });
    // dashed feedback arrow
    const fx = ax + 30;
    s += flow([[fx, y + dy], [fx, y + cardH]], { color: C.faint, sw: 1.5, dash: "5 5", headSize: 7 });
  }
});

// feedback legend (centered)
const ly = y0 + dy * 5 + cardH + 56;
const lx = W / 2 - 430;
s += `<line x1="${lx}" y1="${ly - 5}" x2="${lx + 36}" y2="${ly - 5}" stroke="${C.primary}" stroke-width="2.2"/>`;
s += T(lx + 46, ly, "Phase hand-off (deliverables flow forward)", { size: 13.5, fill: C.muted });
s += `<line x1="${lx + 420}" y1="${ly - 5}" x2="${lx + 456}" y2="${ly - 5}" stroke="${C.faint}" stroke-width="1.6" stroke-dasharray="5 5"/>`;
s += T(lx + 466, ly, "Feedback to the previous phase (rework and refinement)", { size: 13.5, fill: C.muted });

await render("01-sdlc-waterfall-model", doc(W, H, s), 3200);
