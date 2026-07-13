import { supabase } from "@/integrations/supabase/client";

export { supabase };

export type Profile = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  preferred_role: 'create_deals' | 'accept_deals' | 'both';
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

export type UserRole = {
  id: string;
  user_id: string;
  role: 'admin';
  created_at: string;
};

export type KYC = {
  id: string;
  user_id: string;
  pan_number: string;
  document_url: string;
  bank_name: string;
  account_number: string;
  ifsc_code: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Deal = {
  id: string;
  merchant_id: string;
  customer_id: string | null;
  product_name: string;
  product_link: string;
  original_price: number;
  card_offer_price: number;       // price after card offer (what the cardholder spends)
  expected_buy_price: number;     // legacy buyer-total; new-model deals mirror card_offer_price
  advance_amount: number;
  remaining_amount: number;
  commission_amount: number;      // Cardholder Reward (kept under the legacy column name)
  offer_details: string | null;   // optional buyer note about the card offer
  actual_purchase_price: number | null;  // admin-verified actual spend (set at proof approval)
  price_revision_status: 'none' | 'pending_buyer' | 'accepted' | 'declined';
  required_card: string;
  delivery_address: string | null;
  admin_contact_number: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';
  admin_notes: string | null;
  reserved_at: string | null;
  reserved_until: string | null;
  // Fulfilment lifecycle
  estimated_delivery_date: string | null;
  payment_due_date: string | null;
  payment_status: PaymentStatus;
  payment_reference: string | null;
  payment_proof_url: string | null;
  payment_method: 'razorpay' | 'manual' | null;
  order_proof_status: 'pending' | 'verified' | 'rejected' | 'correction';
  order_proof_reason: string | null;
  buyer_confirmed_at: string | null;
  settled_at: string | null;
  dispute_status: 'open' | 'resolved' | 'rejected' | null;
  has_delivery_code?: boolean;
  created_at: string;
  updated_at: string;
};

// Columns a client may read directly from `deals`. The private delivery/payment
// columns AND service_fee are column-level REVOKEd (buyer phone privacy; the
// platform fee is never readable by the cardholder) — reading them via
// `select('*')` errors. Participants get those fields only through the masking
// SECURITY DEFINER RPCs (get_deal_for_viewer / get_order_delivery_details),
// which return service_fee/buyer_payable to the buyer + admin only.
export const DEAL_SAFE_COLUMNS =
  "id, merchant_id, customer_id, product_name, product_link, original_price, card_offer_price, " +
  "expected_buy_price, advance_amount, remaining_amount, commission_amount, offer_details, " +
  "actual_purchase_price, price_revision_status, required_card, " +
  "admin_contact_number, reserved_at, reserved_until, estimated_delivery_date, payment_due_date, " +
  "payment_status, payment_method, order_proof_status, order_proof_verified_at, order_proof_reason, " +
  "payment_submitted_at, payment_verified_at, buyer_confirmed_at, settled_at, " +
  "dispute_status, status, admin_notes, created_at, updated_at";

/** Service-fee policy (platform_fee_config singleton — readable by any signed-in user). */
export type FeePolicy = {
  fee_percent: number;
  fee_min: number;
  fee_max: number;
};

/** Client-side MIRROR of the fee formula for live display ONLY — the backend
 * trigger recomputes the authoritative fee on insert and ignores client values. */
export function computeServiceFee(reward: number, policy: FeePolicy): number {
  if (!Number.isFinite(reward) || reward < 0) reward = 0;
  return Math.round(Math.min(Math.max((reward * policy.fee_percent) / 100, policy.fee_min), policy.fee_max));
}

export type PaymentStatus =
  | 'not_due' | 'due_soon' | 'due' | 'overdue'
  | 'submitted' | 'verified' | 'refunded' | 'disputed';

export type OrderRow = {
  id: string;
  deal_id: string;
  customer_id: string;
  order_screenshot_url: string | null;
  tracking_id: string | null;
  marketplace_order_id: string | null;
  platform: string | null;
  amount_paid: number | null;
  courier: string | null;
  tracking_url: string | null;
  shipped_screenshot_url: string | null;
  delivery_code_type: 'none' | 'otp' | 'pin' | 'openbox' | null;
  status: string;
  created_at: string;
  updated_at: string | null;
};

export type OrderEvent = {
  id: string;
  deal_id: string | null;
  actor_id: string | null;
  event_type: string;
  detail: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type Wallet = {
  id: string;
  user_id: string;
  balance: number;
  locked_amount: number;
  created_at: string;
  updated_at: string;
};

export type Notification = {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  link: string | null;
  created_at: string;
};

// list_open_deals returns is_reserved/reserved_until/server_now but not
// reserved_at (and never the address/notes).
export type OpenDeal = Omit<Deal, "delivery_address" | "admin_notes" | "reserved_at"> & {
  is_reserved: boolean;
  reserved_until: string | null;
  server_now: string;
};

/** get_deal_for_viewer row: Deal + server-computed money fields. service_fee and
 * buyer_payable are role-masked (NULL for the cardholder); cardholder_payout is
 * what the cardholder receives at settlement (actual verified spend + reward). */
export type ViewerDeal = Deal & {
  server_now?: string;
  service_fee: number | null;
  buyer_payable: number | null;
  cardholder_payout: number | null;
};

/** Caller's live reservation + cooldown state (get_my_reservation_status). */
export type MyReservationStatus = {
  active_deal_id: string | null;
  active_product_name: string | null;
  active_reserved_until: string | null;
  blocked_until: string | null;
  strikes_30d: number;
  under_review: boolean;
  server_now: string;
};

export type WithdrawalRequest = {
  id: string;
  user_id: string;
  amount: number;
  status: "pending" | "completed" | "rejected";
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
};
