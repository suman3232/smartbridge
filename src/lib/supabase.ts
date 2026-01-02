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
  created_at: string;
  updated_at: string;
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
