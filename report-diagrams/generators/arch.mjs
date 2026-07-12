// Diagram 2 — General System Architecture (portrait)
import { C, T, TBlock, rect, flow, header, doc, textWidth } from "./lib.mjs";
import { render } from "./render.mjs";

const W = 1240, H = 1470;
let s = "";

s += header(W / 2, {
  eyebrow: "OfferBridge · System Architecture",
  title: "General Architecture",
  subtitle: "React single-page application on a Supabase backend, with external integrations",
});

// helper: titled card
function card(x, y, w, h, title, sub, { accent = C.primary, soft = C.primarySoft, titleSize = 16, subSize = 13.2, center = false, subLines = null } = {}) {
  let g = rect(x, y, w, h, { fill: C.white, stroke: C.border, sw: 1.4, rx: 10 });
  g += `<path d="M${x} ${y}  h${w} v${4} h-${w} Z" fill="none"/>`;
  g += `<line x1="${x + 12}" y1="${y + 34}" x2="${x + w - 12}" y2="${y + 34}" stroke="${soft}" stroke-width="1.6"/>`;
  g += `<rect x="${x}" y="${y}" width="5" height="${h}" rx="2.5" fill="${accent}"/>`;
  g += T(center ? x + w / 2 : x + 18, y + 24, title, { size: titleSize, weight: 700, fill: C.ink, anchor: center ? "middle" : "start" });
  if (sub) {
    const lines = subLines || (Array.isArray(sub) ? sub : null);
    if (lines) {
      lines.forEach((ln, i) => { g += T(center ? x + w / 2 : x + 18, y + 56 + i * 21, ln, { size: subSize, fill: C.body, anchor: center ? "middle" : "start" }); });
    } else {
      g += TBlock(x + 18, y + 56, sub, { size: subSize, fill: C.body, maxW: w - 34, lh: 21 }).svg;
    }
  }
  return g;
}

// section container
function zone(x, y, w, h, title, caption, { soft = "#FBFCFE", stroke = C.border } = {}) {
  let g = rect(x, y, w, h, { fill: soft, stroke, sw: 1.5, rx: 14 });
  g += T(x + 22, y + 32, title, { size: 18.5, weight: 700, fill: C.ink });
  if (caption) g += T(x + w - 22, y + 32, caption, { size: 13, fill: C.muted, anchor: "end" });
  return g;
}

// ---------- Users band ----------
const actors = [
  ["Visitor", "browses deals & support"],
  ["Shopper", "posts card-offer deals"],
  ["Card Holder", "fulfils deals, earns"],
  ["Admin", "operates the platform"],
];
const chipW = 186, chipH = 60, chipGap = 20;
const chipsX = 76;
const chipsY = 170;
actors.forEach((a, i) => {
  const x = chipsX + i * (chipW + chipGap);
  s += rect(x, chipsY, chipW, chipH, { fill: C.primarySoft, stroke: C.primaryBorder, sw: 1.4, rx: 12 });
  s += T(x + chipW / 2, chipsY + 26, a[0], { size: 16.5, weight: 700, fill: C.primaryDark, anchor: "middle" });
  s += T(x + chipW / 2, chipsY + 46, a[1], { size: 12.3, fill: C.muted, anchor: "middle" });
});
s += T(chipsX + (chipW * 4 + chipGap * 3) / 2, chipsY + chipH + 26, "Web browser  ·  Installed PWA (home-screen app with auto-updating service worker)", { size: 13, fill: C.muted, anchor: "middle" });

// WhatsApp support box (top-right, opened from the client via wa.me deep link)
s += rect(1010, chipsY, 178, chipH, { fill: C.greenSoft, stroke: C.greenBorder, sw: 1.4, rx: 12 });
s += T(1099, chipsY + 26, "WhatsApp", { size: 15.5, weight: 700, fill: C.green, anchor: "middle" });
s += T(1099, chipsY + 46, "support chat", { size: 12.3, fill: C.muted, anchor: "middle" });
s += flow([[1099, 304], [1099, chipsY + chipH]], { color: C.green, sw: 1.5, dash: "5 4", head: "end", label: "wa.me support link", labelAt: 0.5, labelSize: 11.5 });

// arrow users -> client
s += flow([[490, chipsY + chipH + 40], [490, 304]], { color: C.line, sw: 2 });

// ---------- Client layer ----------
const clY = 304, clH = 330;
s += zone(56, clY, 1128, clH, "Client Application", "React 18 · TypeScript · Vite · single-page app");
s += card(80, clY + 48, 1080, 74, "Pages & Routing — React Router v6",
  "15 routes: Landing · Auth · Dashboard · Browse Deals · Deal Detail · Create Deal · Admin Panel · Wallet · KYC · Profile · Price Tracker · Refer & Earn · Notifications · Support · 404",
  { subSize: 12.8 });
const rbY = clY + 136, rbH = 104, rbW = 344;
s += card(80, rbY, rbW, rbH, "State & Data", null, {});
s += TBlock(98, rbY + 56, "TanStack Query cache · AuthContext session & role state · zod validation", { size: 12.8, fill: C.body, maxW: rbW - 34, lh: 21 }).svg;
s += card(448, rbY, rbW, rbH, "UI System", null, {});
s += TBlock(466, rbY + 56, "Tailwind CSS · shadcn/ui (Radix) · framer-motion & GSAP · Recharts price charts", { size: 12.8, fill: C.body, maxW: rbW - 34, lh: 21 }).svg;
s += card(816, rbY, rbW, rbH, "PWA Shell", null, {});
s += TBlock(834, rbY + 56, "vite-plugin-pwa service worker · offline app shell · install prompt · auto-update", { size: 12.8, fill: C.body, maxW: rbW - 34, lh: 21 }).svg;
// SDK bar
s += rect(80, clY + 254, 1080, 46, { fill: C.primarySoft, stroke: C.primaryBorder, sw: 1.4, rx: 10 });
s += T(W / 2, clY + 283, "supabase-js SDK  —  Auth  ·  PostgREST data & RPC  ·  Storage  ·  Edge Functions", { size: 14.5, weight: 600, fill: C.primaryDark, anchor: "middle" });

// arrow client -> supabase
s += flow([[W / 2, clY + clH], [W / 2, 690]], { color: C.line, sw: 2, label: "HTTPS · JWT-authenticated REST / RPC", labelSize: 12.8 });

// ---------- Supabase platform ----------
const spY = 690, spH = 560;
s += zone(56, spY, 1128, spH, "Supabase Platform", "managed backend-as-a-service");
const svY = spY + 48, svH = 158, svW = 253, svGap = 22.6;
const services = [
  ["Auth", ["Email + password sign-up", "with email-OTP verification;", "Google OAuth 2.0; JWT", "sessions & refresh"]],
  ["PostgREST API", ["Auto REST on tables under", "row-level security; RPC", "endpoints for all state", "transitions"]],
  ["Storage", ["Private buckets:", "kyc-documents and", "order-screenshots; served", "via short-lived signed URLs"]],
  ["Edge Functions", ["price-check (Deno):", "server-side product-page", "fetch & JSON-LD / OpenGraph", "parsing; cron endpoint"]],
];
services.forEach((sv, i) => {
  const x = 80 + i * (svW + svGap);
  s += card(x, svY, svW, svH, sv[0], null, {});
  sv[1].forEach((ln, j) => { s += T(x + 18, svY + 56 + j * 21, ln, { size: 12.6, fill: C.body }); });
  // arrow to postgres
  s += flow([[x + svW / 2, svY + svH], [x + svW / 2, svY + svH + 36]], { color: C.lineSoft, sw: 1.7 });
});

// PostgreSQL box
const pgY = svY + svH + 36, pgH = 286;
s += rect(80, pgY, 1080, pgH, { fill: C.white, stroke: C.primaryBorder, sw: 1.6, rx: 12 });
s += `<rect x="80" y="${pgY}" width="1080" height="40" rx="12" fill="${C.primarySoft}"/>`;
s += `<rect x="80" y="${pgY + 28}" width="1080" height="12" fill="${C.primarySoft}"/>`;
s += T(100, pgY + 27, "PostgreSQL Database", { size: 17, weight: 700, fill: C.primaryDark });
s += T(1140, pgY + 27, "single source of truth", { size: 12.6, fill: C.muted, anchor: "end" });
const feats = [
  ["Relational Schema", "20 tables · 6 enums · foreign-key & CHECK constraints"],
  ["Row-Level Security", "per-role read/write policies enforced on every table"],
  ["RPC State Machine", "40+ SECURITY DEFINER functions guard all transitions"],
  ["Triggers", "signup provisioning (profile + wallet) · updated_at stamps"],
  ["Scheduling", "pg_cron + pg_net call the price-check function every 6 h"],
  ["Audit & Reliability", "reservation_events trail · strikes & cooldown state"],
];
const fW = 340, fH = 92, fGapX = 24, fGapY = 20;
feats.forEach((f, i) => {
  const col = i % 3, row = Math.floor(i / 3);
  const x = 98 + col * (fW + fGapX), y = pgY + 58 + row * (fH + fGapY);
  s += rect(x, y, fW, fH, { fill: C.card, stroke: "#E2E8F0", sw: 1.3, rx: 10 });
  s += T(x + 16, y + 28, f[0], { size: 14.5, weight: 700, fill: C.ink });
  s += TBlock(x + 16, y + 52, f[1], { size: 12.6, fill: C.body, maxW: fW - 30, lh: 20 }).svg;
});

// pg_cron dashed arrow: postgres -> edge functions (short vertical in the gap)
s += flow([[1140, pgY], [1140, svY + svH]], { color: C.faint, sw: 1.5, dash: "5 4", label: "cron · 6 h", labelAt: 0.5, labelSize: 11.5 });

// ---------- External services ----------
const exY = 1310, exH = 104, exW = 344;
const externals = [
  ["Google OAuth 2.0", "identity provider for one-tap Google sign-in", C.primary, C.primarySoft, C.primaryBorder],
  ["Email Delivery", "verification-OTP and account emails sent by Supabase Auth", C.amber, C.amberSoft, C.amberBorder],
  ["E-commerce Product Pages", "Amazon · Flipkart · Myntra · AJIO · Meesho — fetched server-side (optional ScraperAPI relay)", C.green, C.greenSoft, C.greenBorder],
];
externals.forEach((e, i) => {
  const x = 56 + i * (exW + 48);
  s += rect(x, exY, exW, exH, { fill: e[3], stroke: e[4], sw: 1.4, rx: 12 });
  s += T(x + 18, exY + 30, e[0], { size: 15.5, weight: 700, fill: e[2] });
  s += TBlock(x + 18, exY + 56, e[1], { size: 12.6, fill: C.body, maxW: exW - 34, lh: 20 }).svg;
});
// arrows platform -> externals
s += flow([[228, spY + spH], [228, exY]], { color: C.line, sw: 1.8, head: "both", label: "OAuth handshake", labelSize: 12.3 });
s += flow([[620, spY + spH], [620, exY]], { color: C.line, sw: 1.8, label: "OTP & account emails", labelSize: 12.3 });
s += flow([[1012, spY + spH], [1012, exY]], { color: C.line, sw: 1.8, head: "both", label: "HTTPS price fetch", labelSize: 12.3 });

await render("02-system-architecture", doc(W, H, s), 3200);
