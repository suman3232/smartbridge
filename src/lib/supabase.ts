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
  card_offer_price: number;
  expected_buy_price: number;
  advance_amount: number;
  remaining_amount: number;
  commission_amount: number;
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
  buyer_confirmed_at: string | null;
  settled_at: string | null;
  dispute_status: 'open' | 'resolved' | 'rejected' | null;
  has_delivery_code?: boolean;
  created_at: string;
  updated_at: string;
};

// Columns a client may read directly from `deals`. The private delivery/payment
// columns are column-level REVOKEd (buyer phone privacy) — reading them via
// `select('*')` errors. Participants get those fields only through the masking
// SECURITY DEFINER RPCs (get_deal_for_viewer / get_order_delivery_details).
export const DEAL_SAFE_COLUMNS =
  "id, merchant_id, customer_id, product_name, product_link, original_price, card_offer_price, " +
  "expected_buy_price, advance_amount, remaining_amount, commission_amount, required_card, " +
  "admin_contact_number, reserved_at, reserved_until, estimated_delivery_date, payment_due_date, " +
  "payment_status, payment_submitted_at, payment_verified_at, buyer_confirmed_at, settled_at, " +
  "dispute_status, status, admin_notes, created_at, updated_at";

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
