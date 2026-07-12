// Diagram 4 — ER Diagram (landscape, crow's foot)
import { C, T, rect, header, doc, entity, rel, flow } from "./lib.mjs";
import { render } from "./render.mjs";

const W = 2080, H = 1460;
let s = "";

s += header(W / 2, {
  eyebrow: "OfferBridge · Database Design",
  title: "Entity-Relationship Diagram",
  subtitle: "PostgreSQL schema (Supabase) — crow's-foot notation, primary/foreign/unique keys per table",
});

const IND = { accent: C.primary, soft: C.primarySoft };
const GRN = { accent: C.green, soft: C.greenSoft };
const AMB = { accent: C.amber, soft: C.amberSoft };
const CYN = { accent: C.cyan, soft: C.cyanSoft };

const rels = [];
let e;

// ---------------- col 1 (x 70, w 260) ----------------
e = entity(70, 180, 260, "auth.users", [
  { name: "id", type: "uuid", pk: true },
  { name: "email", type: "text" },
  { name: "encrypted_password", type: "text" },
  { name: "email_confirmed_at", type: "timestamptz" },
  { name: "raw_user_meta_data", type: "jsonb" },
], { ...IND, note: "managed by Supabase Auth" }); s += e.svg;

e = entity(70, 452, 260, "user_roles", [
  { name: "id", type: "uuid", pk: true },
  { name: "user_id", type: "uuid", fk: true },
  { name: "role", type: "app_role" },
  { name: "created_at", type: "timestamptz" },
], { ...IND, note: "UNIQUE (user_id, role)" }); s += e.svg;

e = entity(70, 650, 260, "kycs", [
  { name: "id", type: "uuid", pk: true },
  { name: "user_id", type: "uuid", fk: true },
  { name: "pan_number", type: "text" },
  { name: "document_url", type: "text" },
  { name: "bank_name", type: "text" },
  { name: "account_number", type: "text" },
  { name: "ifsc_code", type: "text" },
  { name: "status", type: "kyc_status" },
], AMB); s += e.svg;

e = entity(70, 975, 260, "withdrawal_requests", [
  { name: "id", type: "uuid", pk: true },
  { name: "user_id", type: "uuid", fk: true },
  { name: "amount", type: "decimal(10,2)" },
  { name: "status", type: "text" },
  { name: "admin_notes", type: "text" },
], GRN); s += e.svg;

// ---------------- col 2 (x 400, w 270) ----------------
e = entity(400, 400, 270, "profiles", [
  { name: "id", type: "uuid", pk: true, fk: true },
  { name: "full_name", type: "text" },
  { name: "email", type: "text" },
  { name: "phone", type: "text" },
  { name: "preferred_role", type: "user_pref" },
  { name: "referral_code", type: "text", uk: true },
  { name: "avatar_url", type: "text" },
  { name: "created_at", type: "timestamptz" },
], IND); s += e.svg;

e = entity(400, 740, 270, "wallets", [
  { name: "id", type: "uuid", pk: true },
  { name: "user_id", type: "uuid", fk: true, uk: true },
  { name: "balance", type: "decimal(10,2)" },
  { name: "locked_amount", type: "decimal(10,2)" },
], GRN); s += e.svg;

e = entity(400, 970, 270, "notifications", [
  { name: "id", type: "uuid", pk: true },
  { name: "user_id", type: "uuid", fk: true },
  { name: "title", type: "text" },
  { name: "message", type: "text" },
  { name: "type", type: "text" },
  { name: "is_read", type: "boolean" },
  { name: "link", type: "text" },
], IND); s += e.svg;

// ---------------- col 3 (x 740, w 280) ----------------
e = entity(740, 240, 280, "deals", [
  { name: "id", type: "uuid", pk: true },
  { name: "merchant_id", type: "uuid", fk: true },
  { name: "customer_id", type: "uuid", fk: true },
  { name: "product_name", type: "text" },
  { name: "product_link", type: "text" },
  { name: "original_price", type: "decimal" },
  { name: "card_offer_price", type: "decimal" },
  { name: "expected_buy_price", type: "decimal" },
  { name: "advance_amount", type: "decimal" },
  { name: "remaining_amount", type: "decimal" },
  { name: "commission_amount", type: "decimal" },
  { name: "required_card", type: "text" },
  { name: "delivery_address", type: "text" },
  { name: "admin_contact_number", type: "text" },
  { name: "reserved_until", type: "timestamptz" },
  { name: "status", type: "deal_status" },
], IND); s += e.svg;

e = entity(740, 780, 280, "reservation_events", [
  { name: "id", type: "uuid", pk: true },
  { name: "deal_id", type: "uuid", fk: true },
  { name: "user_id", type: "uuid", fk: true },
  { name: "event_type", type: "text" },
  { name: "within_grace", type: "boolean" },
  { name: "reserved_until", type: "timestamptz" },
  { name: "created_at", type: "timestamptz" },
], IND); s += e.svg;

e = entity(740, 1070, 280, "cardholder_reliability", [
  { name: "user_id", type: "uuid", pk: true, fk: true },
  { name: "total_expiries", type: "int" },
  { name: "total_releases", type: "int" },
  { name: "strikes_30d", type: "int" },
  { name: "acceptance_blocked_until", type: "tstz" },
  { name: "under_review", type: "boolean" },
], IND); s += e.svg;

// ---------------- col 4 (x 1090, w 270) ----------------
e = entity(1090, 240, 270, "orders", [
  { name: "id", type: "uuid", pk: true },
  { name: "deal_id", type: "uuid", fk: true, uk: true },
  { name: "customer_id", type: "uuid", fk: true },
  { name: "tracking_id", type: "text" },
  { name: "order_screenshot_url", type: "text" },
  { name: "delivery_otp", type: "text" },
  { name: "otp_verified", type: "boolean" },
  { name: "status", type: "order_status" },
], IND); s += e.svg;

e = entity(1090, 560, 270, "otp_records", [
  { name: "id", type: "uuid", pk: true },
  { name: "order_id", type: "uuid", fk: true },
  { name: "otp_code", type: "text" },
  { name: "submitted_by", type: "uuid", fk: true },
  { name: "verified_by", type: "uuid", fk: true },
  { name: "status", type: "text" },
], IND); s += e.svg;

e = entity(1090, 820, 270, "delivery_confirmations", [
  { name: "id", type: "uuid", pk: true },
  { name: "order_id", type: "uuid", fk: true },
  { name: "merchant_id", type: "uuid", fk: true },
  { name: "confirmation_photo_url", type: "text" },
  { name: "notes", type: "text" },
], IND); s += e.svg;

e = entity(1090, 1070, 270, "admin_numbers", [
  { name: "id", type: "uuid", pk: true },
  { name: "phone_number", type: "text", uk: true },
  { name: "is_active", type: "boolean" },
  { name: "assignment_count", type: "int" },
  { name: "last_assigned_at", type: "timestamptz" },
], { ...AMB, note: "copied by value into deals" }); s += e.svg;

// ---------------- col 5 (x 1430, w 270) ----------------
e = entity(1430, 240, 270, "payments", [
  { name: "id", type: "uuid", pk: true },
  { name: "deal_id", type: "uuid", fk: true },
  { name: "from_user_id", type: "uuid", fk: true },
  { name: "to_user_id", type: "uuid", fk: true },
  { name: "amount", type: "decimal(10,2)" },
  { name: "payment_type", type: "text" },
  { name: "status", type: "payment_status" },
  { name: "description", type: "text" },
], GRN); s += e.svg;

e = entity(1430, 560, 270, "referrals", [
  { name: "id", type: "uuid", pk: true },
  { name: "referrer_id", type: "uuid", fk: true },
  { name: "referred_id", type: "uuid", fk: true, uk: true },
  { name: "code_used", type: "text" },
  { name: "status", type: "text" },
  { name: "qualifying_deal_id", type: "uuid", fk: true },
  { name: "referrer_reward_amount", type: "dec" },
  { name: "referred_reward_amount", type: "dec" },
], IND); s += e.svg;

e = entity(1430, 880, 270, "tracked_products", [
  { name: "id", type: "uuid", pk: true },
  { name: "user_id", type: "uuid", fk: true },
  { name: "url", type: "text" },
  { name: "platform", type: "text" },
  { name: "product_name", type: "text" },
  { name: "current_price", type: "decimal" },
  { name: "target_price", type: "decimal" },
  { name: "notify_enabled", type: "boolean" },
  { name: "last_checked_at", type: "timestamptz" },
], { ...CYN, note: "UNIQUE (user_id, url)" }); s += e.svg;

// ---------------- col 6 (x 1770, w 250) ----------------
e = entity(1770, 880, 250, "product_price_history", [
  { name: "id", type: "uuid", pk: true },
  { name: "product_id", type: "uuid", fk: true },
  { name: "price", type: "decimal(12,2)" },
  { name: "original_price", type: "decimal" },
  { name: "availability", type: "text" },
  { name: "source", type: "text" },
  { name: "checked_at", type: "timestamptz" },
], CYN); s += e.svg;

e = entity(1770, 240, 250, "referral_config", [
  { name: "referrer_reward", type: "decimal" },
  { name: "welcome_bonus", type: "decimal" },
  { name: "min_qualifying_amount", type: "dec" },
  { name: "max_rewards_per_referrer", type: "int" },
  { name: "enabled", type: "boolean" },
], { ...AMB, note: "singleton — admin-managed" }); s += e.svg;

e = entity(1770, 500, 250, "reservation_config", [
  { name: "hold_seconds", type: "int" },
  { name: "release_grace_seconds", type: "int" },
  { name: "max_accepts_per_deal", type: "int" },
  { name: "strike_window_days", type: "int" },
  { name: "cooldown tiers (2·3·abuse)", type: "int" },
], { ...AMB, note: "singleton — admin-managed" }); s += e.svg;

e = entity(1770, 730, 250, "app_settings", [
  { name: "support_whatsapp", type: "text" },
  { name: "updated_at", type: "timestamptz" },
], { ...AMB, note: "singleton — admin-managed" }); s += e.svg;

// ================= relationships =================
const RC = "#93A0B4";
// col1 -> profiles
s += rel([[330, 270], [365, 270], [365, 430], [400, 430]], "one", "one", { label: "1 : 1", labelAt: 0.85, labelDy: -12 });
s += rel([[330, 500], [400, 470]], "many", "one");
s += rel([[330, 700], [358, 700], [358, 560], [400, 560]], "many", "one");
s += rel([[330, 1020], [372, 1020], [372, 600], [400, 600]], "many", "one");
// wallets (1:1) below profiles
s += rel([[520, 656], [520, 740]], "one", "one", { label: "1 : 1", labelDx: 26, labelDy: 0 });
// notifications switchback
s += rel([[400, 640], [386, 640], [386, 1020], [400, 1020]], "one", "many");
// profiles -> deals (merchant / customer)
s += rel([[670, 450], [740, 450]], "one", "many", { label: "merchant", labelAt: 0.5, labelDy: -11 });
s += rel([[670, 490], [740, 490]], "zeroOne", "many", { label: "customer", labelAt: 0.5, labelDy: 13 });
// profiles(top) -> orders.customer  (top lane y=205)
s += rel([[560, 400], [560, 205], [1160, 205], [1160, 240]], "one", "many", { label: "customer", labelAt: 0.45, labelDy: -11 });
// profiles(top) -> otp_records (lane y=220, vertical x=1055)
s += rel([[590, 400], [590, 220], [1055, 220], [1055, 650], [1090, 650]], "one", "many", { label: "submitted_by / verified_by (2 FKs)", labelAt: 0.38, labelDy: 13 });
// payments -> profiles (lane y=190, vertical x=1426, hop at 1414)
s += rel([[1430, 300], [1426, 300], [1426, 190], [500, 190], [500, 400]], "many", "one", { label: "from / to — payer & payee (2 FKs)", labelAt: 0.55, labelDy: -11, hops: [1414] });
// referrals -> profiles (lane y=175, vertical x=1414)
s += rel([[1430, 620], [1414, 620], [1414, 175], [470, 175], [470, 400]], "many", "one", { label: "referrer / referred (2 FKs)", labelAt: 0.55, labelDy: -11 });
// deals -> orders (1 : 0..1) with hop over otp vertical x=1055
s += rel([[1020, 470], [1090, 470]], "one", "zeroOne", { hops: [1055] });
// deals -> payments (via gap y=528 under orders)
s += rel([[1020, 528], [1460, 528], [1460, 496]], "zeroOne", "many", { hops: [1055, 1390, 1414], label: "deal", labelAt: 0.14, labelDy: 13 });
// orders -> otp_records (vertical col4)
s += rel([[1225, 496], [1225, 560]], "one", "many");
// orders -> delivery_confirmations (right gutter x=1390)
s += rel([[1360, 400], [1390, 400], [1390, 850], [1360, 850]], "one", "many");
// deals -> reservation_events (vertical col3)
s += rel([[860, 704], [860, 780]], "zeroOne", "many");
// reservation_events -> profiles (gutter x=715)
s += rel([[740, 850], [715, 850], [715, 560], [670, 560]], "many", "one");
// cardholder_reliability -> profiles (gutter x=700), 1:0..1
s += rel([[740, 1100], [700, 1100], [700, 590], [670, 590]], "zeroOne", "one", { label: "1 : 0..1", labelAt: 0.55, labelDx: -8, labelDy: 0 });
// tracked_products -> profiles (bottom lane y=1300, vertical x=690)
s += rel([[1430, 1140], [1395, 1140], [1395, 1300], [690, 1300], [690, 618], [670, 618]], "many", "one", { label: "tracked by", labelAt: 0.42, labelDy: -11 });
// delivery_confirmations -> profiles (bottom lane y=1315, vertical x=680)
s += rel([[1090, 900], [1035, 900], [1035, 1315], [680, 1315], [680, 640], [670, 640]], "many", "one", { label: "merchant", labelAt: 0.5, labelDy: 13 });
// referrals.qualifying_deal_id -> deals (lane y=760)
s += rel([[1430, 720], [1402, 720], [1402, 760], [980, 760], [980, 704]], "many", "zeroOne", { label: "qualifying deal", labelAt: 0.55, labelDy: 13, hops: [1390] });
// tracked -> history
s += rel([[1700, 950], [1770, 950]], "one", "many");

// ================= legend =================
const ly = 1385;
let lx = 120;
s += T(lx, ly - 34, "LEGEND", { size: 12, weight: 700, fill: C.primary, spacing: "2" });
// crow's foot samples
function legendRel(x, kindEnd, txt) {
  let g = rel([[x, ly - 6], [x + 64, ly - 6]], "one", kindEnd);
  g += T(x + 78, ly, txt, { size: 13, fill: C.muted });
  return g;
}
s += legendRel(lx, "one", "one-to-one");
s += legendRel(lx + 240, "many", "one-to-many");
s += legendRel(lx + 500, "zeroMany", "one-to-zero-or-many");
s += legendRel(lx + 830, "zeroOne", "one-to-zero-or-one");
// badges
let bx = lx + 1140;
for (const [b, c, t] of [["PK", C.amber, "primary key"], ["FK", C.primary, "foreign key"], ["UK", C.cyan, "unique"]]) {
  s += `<rect x="${bx}" y="${ly - 20}" width="30" height="20" rx="4" fill="${c}" opacity="0.14"/>`;
  s += T(bx + 15, ly - 5, b, { size: 12, weight: 700, fill: c, anchor: "middle" });
  s += T(bx + 40, ly - 5, t, { size: 13, fill: C.muted });
  bx += 170;
}

await render("04-er-diagram", doc(W, H, s), 3800);
