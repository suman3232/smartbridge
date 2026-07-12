-- ============================================================================
-- SmartDeal Bridge — COMPLETE DATABASE SETUP (idempotent, safe to re-run)
-- ----------------------------------------------------------------------------
-- HOW TO USE:
--   1. Open Supabase Dashboard -> your project -> SQL Editor -> New query
--   2. Paste this ENTIRE file and click "Run"
--   3. Then run supabase/scripts/grant-admin.sql (edit the email first) to make
--      yourself an admin.
--
-- This script creates every enum, table, RLS policy, function, trigger, storage
-- bucket and seed row the app needs. It uses IF NOT EXISTS / CREATE OR REPLACE /
-- DROP POLICY IF EXISTS everywhere, so running it on a fresh OR an existing
-- database is safe. The final NOTIFY reloads the PostgREST schema cache so the
-- new functions are immediately callable from the app.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums (guarded — CREATE TYPE has no IF NOT EXISTS)
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.kyc_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.deal_status AS ENUM ('pending', 'approved', 'rejected', 'accepted', 'in_progress', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.order_status AS ENUM ('placed', 'otp_pending', 'otp_verified', 'shipped', 'delivered', 'confirmed');
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_status AS ENUM ('pending', 'locked', 'released', 'refunded');
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.user_preference AS ENUM ('create_deals', 'accept_deals', 'both');
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin');
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  preferred_role public.user_preference DEFAULT 'both',
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
-- Guarantee the core columns exist even on an older profiles table. CREATE TABLE
-- IF NOT EXISTS above is a no-op if the table already exists, so any column added
-- after the table was first created must be ensured explicitly here. Without this,
-- functions like list_admins (LANGUAGE sql, validated at creation) fail with
-- "column p.email does not exist" on databases created before these columns.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferred_role public.user_preference DEFAULT 'both';
-- Backfill email from auth for rows created before the email column existed.
UPDATE public.profiles p SET email = u.email
  FROM auth.users u WHERE u.id = p.id AND (p.email IS NULL OR p.email = '');
-- Refer & Earn: each user gets a unique referral code (backfilled near the end).
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code TEXT;
DO $$ BEGIN
  CREATE UNIQUE INDEX profiles_referral_code_key ON public.profiles (referral_code);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, role)
);

CREATE TABLE IF NOT EXISTS public.kycs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  pan_number TEXT NOT NULL,
  document_url TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  ifsc_code TEXT NOT NULL,
  status public.kyc_status DEFAULT 'pending',
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT true,
  last_assigned_at TIMESTAMPTZ,
  assignment_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  customer_id UUID REFERENCES public.profiles(id),
  product_name TEXT NOT NULL,
  product_link TEXT NOT NULL,
  original_price DECIMAL(10,2) NOT NULL,
  card_offer_price DECIMAL(10,2) NOT NULL,
  expected_buy_price DECIMAL(10,2) NOT NULL,
  advance_amount DECIMAL(10,2) NOT NULL,
  remaining_amount DECIMAL(10,2) NOT NULL,
  commission_amount DECIMAL(10,2) NOT NULL,
  required_card TEXT NOT NULL,
  delivery_address TEXT,
  admin_contact_number TEXT,
  -- 30-minute reservation window (set on accept, cleared on order/expiry/release).
  -- reserved_until is the server-side source of truth for the countdown.
  reserved_at TIMESTAMPTZ,
  reserved_until TIMESTAMPTZ,
  status public.deal_status DEFAULT 'pending',
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE public.deals ADD CONSTRAINT prevent_self_acceptance
    CHECK (customer_id IS NULL OR customer_id != merchant_id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES public.deals(id) ON DELETE CASCADE NOT NULL,
  customer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  order_screenshot_url TEXT,
  tracking_id TEXT,
  delivery_otp TEXT,
  otp_verified BOOLEAN DEFAULT false,
  status public.order_status DEFAULT 'placed',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE public.orders ADD CONSTRAINT orders_deal_id_key UNIQUE (deal_id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

-- Financial integrity constraints (defense-in-depth beyond client validation).
-- NOT VALID: enforced on all new/updated rows without failing on any pre-existing
-- rows that predate the constraint (safe to add to a populated table).
DO $$ BEGIN
  ALTER TABLE public.deals ADD CONSTRAINT deals_amounts_nonneg CHECK (
    original_price >= 0 AND card_offer_price >= 0 AND expected_buy_price >= 0
    AND advance_amount >= 0 AND remaining_amount >= 0 AND commission_amount >= 0
    AND expected_buy_price >= card_offer_price
  ) NOT VALID;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.delivery_confirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  merchant_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  confirmation_photo_url TEXT NOT NULL,
  notes TEXT,
  confirmed_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  balance DECIMAL(10,2) DEFAULT 0,
  locked_amount DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
DO $$ BEGIN
  ALTER TABLE public.wallets ADD CONSTRAINT wallets_nonneg
    CHECK (balance >= 0 AND locked_amount >= 0) NOT VALID;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES public.deals(id),
  from_user_id UUID REFERENCES public.profiles(id),
  to_user_id UUID REFERENCES public.profiles(id),
  amount DECIMAL(10,2) NOT NULL,
  payment_type TEXT NOT NULL,
  status public.payment_status DEFAULT 'pending',
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info',
  is_read BOOLEAN DEFAULT false,
  link TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'rejected')),
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.otp_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  otp_code TEXT NOT NULL,
  submitted_by UUID NOT NULL REFERENCES public.profiles(id),
  verified_by UUID REFERENCES public.profiles(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
  submitted_at TIMESTAMPTZ DEFAULT now(),
  verified_at TIMESTAMPTZ,
  notes TEXT
);

-- Refer & Earn: admin-configurable rewards + rules (single-row singleton).
CREATE TABLE IF NOT EXISTS public.referral_config (
  id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id),
  referrer_reward DECIMAL(10,2) NOT NULL DEFAULT 50 CHECK (referrer_reward >= 0),
  welcome_bonus DECIMAL(10,2) NOT NULL DEFAULT 25 CHECK (welcome_bonus >= 0),
  min_qualifying_amount DECIMAL(10,2) NOT NULL DEFAULT 500 CHECK (min_qualifying_amount >= 0),
  max_rewards_per_referrer INTEGER,            -- NULL = unlimited
  enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO public.referral_config (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

-- App-wide settings the admin can edit from the dashboard (single-row singleton).
-- support_whatsapp is the public support contact shown on deal cards. It starts
-- NULL so no fake number is ever shown until an admin saves a real one.
CREATE TABLE IF NOT EXISTS public.app_settings (
  id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id),
  support_whatsapp TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO public.app_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Deal reservation + cardholder reliability system
-- ---------------------------------------------------------------------------
-- Admin-tunable rules for the 30-minute reservation hold (single-row singleton).
CREATE TABLE IF NOT EXISTS public.reservation_config (
  id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id),
  enabled BOOLEAN NOT NULL DEFAULT true,                 -- master switch for strikes/cooldowns
  hold_seconds INT NOT NULL DEFAULT 1800 CHECK (hold_seconds >= 60),          -- 30 min to submit proof
  release_grace_seconds INT NOT NULL DEFAULT 300 CHECK (release_grace_seconds >= 0), -- 5 min penalty-free
  max_accepts_per_deal INT NOT NULL DEFAULT 3 CHECK (max_accepts_per_deal >= 1),     -- anti re-accept/cycling
  strike_window_days INT NOT NULL DEFAULT 30 CHECK (strike_window_days >= 1),
  cooldown2_seconds INT NOT NULL DEFAULT 3600 CHECK (cooldown2_seconds >= 0),        -- 1h after 2nd expiry
  cooldown3_seconds INT NOT NULL DEFAULT 86400 CHECK (cooldown3_seconds >= 0),       -- 24h after 3rd
  cooldown_abuse_seconds INT NOT NULL DEFAULT 604800 CHECK (cooldown_abuse_seconds >= 0), -- 7d for 4th+
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO public.reservation_config (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

-- Immutable audit trail of every reservation lifecycle event.
CREATE TABLE IF NOT EXISTS public.reservation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('reserved','fulfilled','released','expired','admin_reopened')),
  within_grace BOOLEAN,
  reserved_at TIMESTAMPTZ,
  reserved_until TIMESTAMPTZ,
  detail TEXT,
  -- Set by admin_reset_cardholder: the event stays in the audit trail but no
  -- longer counts toward strike escalation.
  voided BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reservation_events_user_idx ON public.reservation_events (user_id, event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS reservation_events_deal_idx ON public.reservation_events (deal_id, created_at DESC);

-- Per-cardholder reliability state (strikes, cooldowns, releases). Written only
-- by the reservation RPCs / admin overrides.
CREATE TABLE IF NOT EXISTS public.cardholder_reliability (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  total_expiries INT NOT NULL DEFAULT 0,
  total_releases INT NOT NULL DEFAULT 0,
  strikes_30d INT NOT NULL DEFAULT 0,            -- expiries within the strike window (denormalized)
  acceptance_blocked_until TIMESTAMPTZ,          -- cooldown end; NULL = can accept now
  last_expiry_at TIMESTAMPTZ,
  under_review BOOLEAN NOT NULL DEFAULT false,   -- flagged for repeated abuse
  admin_note TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One referral per referred user, ever. Reward fires only on qualification.
CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referred_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  code_used TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'rewarded', 'reversed', 'voided')),
  qualifying_deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,
  referrer_reward_amount DECIMAL(10,2),
  referred_reward_amount DECIMAL(10,2),
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  qualified_at TIMESTAMPTZ,
  reversed_at TIMESTAMPTZ,
  CONSTRAINT referrals_no_self CHECK (referrer_id <> referred_id)
);
CREATE INDEX IF NOT EXISTS referrals_referrer_idx ON public.referrals (referrer_id);
CREATE INDEX IF NOT EXISTS referrals_status_idx ON public.referrals (status);

-- ---------------------------------------------------------------------------
-- Schema reconciliation for pre-existing databases
-- ---------------------------------------------------------------------------
-- CREATE TABLE IF NOT EXISTS above is a no-op when the table already exists, so a
-- table created by an older version of this schema keeps its old column set. The
-- indexes, RLS policies, and functions below reference the CURRENT columns, and a
-- LANGUAGE sql function is validated at creation time — so a single missing column
-- (e.g. "column p.email does not exist") aborts the whole script. Ensure every
-- column exists here, nullable, with its default where defined. Each statement is
-- a no-op when the column is already present and is safe on populated tables (no
-- NOT NULL / CHECK added here, so existing rows never violate anything).
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.kycs ADD COLUMN IF NOT EXISTS status public.kyc_status DEFAULT 'pending';
ALTER TABLE public.kycs ADD COLUMN IF NOT EXISTS admin_notes TEXT;
ALTER TABLE public.kycs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.kycs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.admin_numbers ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.admin_numbers ADD COLUMN IF NOT EXISTS last_assigned_at TIMESTAMPTZ;
ALTER TABLE public.admin_numbers ADD COLUMN IF NOT EXISTS assignment_count INTEGER DEFAULT 0;
ALTER TABLE public.admin_numbers ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS customer_id UUID;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS expected_buy_price DECIMAL(10,2);
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS advance_amount DECIMAL(10,2);
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS remaining_amount DECIMAL(10,2);
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS commission_amount DECIMAL(10,2);
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS delivery_address TEXT;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS admin_contact_number TEXT;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS reserved_at TIMESTAMPTZ;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS reserved_until TIMESTAMPTZ;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS status public.deal_status DEFAULT 'pending';
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS admin_notes TEXT;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_screenshot_url TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tracking_id TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_otp TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS otp_verified BOOLEAN DEFAULT false;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS status public.order_status DEFAULT 'placed';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.delivery_confirmations ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.delivery_confirmations ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS balance DECIMAL(10,2) DEFAULT 0;
ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS locked_amount DECIMAL(10,2) DEFAULT 0;
ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS deal_id UUID;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS from_user_id UUID;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS to_user_id UUID;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS status public.payment_status DEFAULT 'pending';
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'info';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS link TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.withdrawal_requests ADD COLUMN IF NOT EXISTS admin_notes TEXT;
ALTER TABLE public.withdrawal_requests ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.withdrawal_requests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.otp_records ADD COLUMN IF NOT EXISTS verified_by UUID;
ALTER TABLE public.otp_records ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE public.otp_records ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.otp_records ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE public.otp_records ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS code_used TEXT;
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS qualifying_deal_id UUID;
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS referrer_reward_amount DECIMAL(10,2);
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS referred_reward_amount DECIMAL(10,2);
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS admin_notes TEXT;
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS qualified_at TIMESTAMPTZ;
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS reversed_at TIMESTAMPTZ;

-- ---------------------------------------------------------------------------
-- Indexes on hot FK / filter columns
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS deals_merchant_idx ON public.deals (merchant_id);
CREATE INDEX IF NOT EXISTS deals_customer_idx ON public.deals (customer_id);
CREATE INDEX IF NOT EXISTS deals_open_idx ON public.deals (created_at DESC) WHERE status = 'approved' AND customer_id IS NULL;
-- Supports the expire_stale_reservations sweep (status='accepted' AND reserved_until < now()).
CREATE INDEX IF NOT EXISTS deals_reserved_sweep_idx ON public.deals (reserved_until) WHERE status = 'accepted';
CREATE INDEX IF NOT EXISTS notifications_user_idx ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS payments_from_idx ON public.payments (from_user_id);
CREATE INDEX IF NOT EXISTS payments_to_idx ON public.payments (to_user_id);
CREATE INDEX IF NOT EXISTS withdrawal_requests_user_idx ON public.withdrawal_requests (user_id);
CREATE INDEX IF NOT EXISTS orders_customer_idx ON public.orders (customer_id);
CREATE INDEX IF NOT EXISTS kycs_user_idx ON public.kycs (user_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Enable Row Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kycs                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_numbers         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_confirmations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawal_requests   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otp_records           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_config       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservation_config     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservation_events     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cardholder_reliability ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Core security-definer helpers (needed by policies below)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin');
$$;
-- NOTE: EXECUTE on is_admin/has_role is intentionally left at the default (PUBLIC).
-- These are called inside RLS policies, and PostgreSQL evaluates policy functions
-- as the QUERYING role — revoking EXECUTE would make policy checks fail with
-- "permission denied for function is_admin" on nearly every query. The residual
-- "is this uuid an admin?" enumeration is only a boolean and is accepted.

-- Email-verification gate. Email/password users are verified once they confirm
-- via OTP (email_confirmed_at set); Google/OAuth users are verified automatically.
-- Used by RLS + sensitive RPCs so gating is enforced server-side, not just in UI.
CREATE OR REPLACE FUNCTION public.is_verified()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid() AND email_confirmed_at IS NOT NULL
  );
$$;

-- Unique short referral code generator (loops until unused).
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE code TEXT;
BEGIN
  LOOP
    code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE referral_code = code);
  END LOOP;
  RETURN code;
END;
$$;

-- ---------------------------------------------------------------------------
-- RLS Policies
-- ---------------------------------------------------------------------------
-- profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (public.is_admin(auth.uid()));

-- user_roles
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
CREATE POLICY "Users can view their own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
CREATE POLICY "Admins can view all roles" ON public.user_roles
  FOR SELECT USING (public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
CREATE POLICY "Admins can manage all roles" ON public.user_roles
  FOR ALL USING (public.is_admin(auth.uid()));

-- kycs
DROP POLICY IF EXISTS "Users can view their own KYC" ON public.kycs;
CREATE POLICY "Users can view their own KYC" ON public.kycs
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert their own KYC" ON public.kycs;
CREATE POLICY "Users can insert their own KYC" ON public.kycs
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND public.is_verified()
    AND NOT EXISTS (
      SELECT 1 FROM public.kycs k
      WHERE k.user_id = auth.uid() AND k.status IN ('pending', 'approved')
    )
  );
DROP POLICY IF EXISTS "Users can update their own pending KYC" ON public.kycs;
CREATE POLICY "Users can update their own pending KYC" ON public.kycs
  FOR UPDATE USING (auth.uid() = user_id AND status = 'pending');
DROP POLICY IF EXISTS "Admins can view all KYC" ON public.kycs;
CREATE POLICY "Admins can view all KYC" ON public.kycs
  FOR SELECT USING (public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can update KYC" ON public.kycs;
CREATE POLICY "Admins can update KYC" ON public.kycs
  FOR UPDATE USING (public.is_admin(auth.uid()));

-- admin_numbers (the specific number a participant needs is copied onto their deal;
-- the full pool is not exposed to anonymous visitors)
DROP POLICY IF EXISTS "Anyone can view active admin numbers" ON public.admin_numbers;
DROP POLICY IF EXISTS "Authenticated can view active admin numbers" ON public.admin_numbers;
CREATE POLICY "Authenticated can view active admin numbers" ON public.admin_numbers
  FOR SELECT TO authenticated USING (is_active = true);

-- deals
-- SECURITY: base-table SELECT is limited to the deal's own participants (+admins).
-- RLS is row-level, not column-level, so a status-only policy would return EVERY
-- column (incl. delivery_address PII) to anyone. Public browsing/detail goes
-- through list_open_deals / get_deal_for_viewer (SECURITY DEFINER) which mask the
-- delivery address and admin_notes for non-participants.
DROP POLICY IF EXISTS "Users can view approved deals" ON public.deals;
DROP POLICY IF EXISTS "Participants can view their deals" ON public.deals;
CREATE POLICY "Participants can view their deals" ON public.deals
  FOR SELECT USING (merchant_id = auth.uid() OR customer_id = auth.uid());
DROP POLICY IF EXISTS "Admins can view all deals" ON public.deals;
CREATE POLICY "Admins can view all deals" ON public.deals
  FOR SELECT USING (public.is_admin(auth.uid()));
-- SECURITY: a user may only create their OWN deal, only in 'pending' status, and
-- only once their email is verified (blocks self-approval + unverified posting).
DROP POLICY IF EXISTS "Users can create deals" ON public.deals;
CREATE POLICY "Users can create deals" ON public.deals
  FOR INSERT WITH CHECK (auth.uid() = merchant_id AND status = 'pending' AND public.is_verified());
-- SECURITY: no direct client UPDATE on deals. ALL status transitions go through
-- SECURITY DEFINER RPCs (approve_deal, reject_deal, accept_deal, place_deal_order,
-- complete_deal, cancel_deal). This blocks self-approval / status tampering.
DROP POLICY IF EXISTS "Users can update their own deals" ON public.deals;
DROP POLICY IF EXISTS "Users can update deals they are involved in" ON public.deals;

-- orders
DROP POLICY IF EXISTS "Users can view their orders" ON public.orders;
CREATE POLICY "Users can view their orders" ON public.orders
  FOR SELECT USING (
    customer_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.deals WHERE deals.id = orders.deal_id AND deals.merchant_id = auth.uid())
    OR public.is_admin(auth.uid())
  );
-- SECURITY: orders are created/updated only via place_deal_order (SECURITY
-- DEFINER), which enforces "deal must be accepted" and one-order-per-deal.
DROP POLICY IF EXISTS "Users can create orders" ON public.orders;
DROP POLICY IF EXISTS "Users can update their orders" ON public.orders;

-- delivery_confirmations
DROP POLICY IF EXISTS "Users can view their confirmations" ON public.delivery_confirmations;
CREATE POLICY "Users can view their confirmations" ON public.delivery_confirmations
  FOR SELECT USING (
    merchant_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_id AND orders.customer_id = auth.uid())
  );
DROP POLICY IF EXISTS "Merchants can insert confirmations" ON public.delivery_confirmations;
CREATE POLICY "Merchants can insert confirmations" ON public.delivery_confirmations
  FOR INSERT WITH CHECK (auth.uid() = merchant_id);

-- wallets
-- SECURITY: users can only READ their wallet. Balance/locked_amount are mutated
-- exclusively by SECURITY DEFINER RPCs (complete_deal, request_withdrawal,
-- complete_withdrawal, reject_withdrawal) and the signup trigger. Direct client
-- writes are removed so a user cannot set their own balance.
DROP POLICY IF EXISTS "Users can view their wallet" ON public.wallets;
CREATE POLICY "Users can view their wallet" ON public.wallets
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "Users can update their wallet" ON public.wallets;
DROP POLICY IF EXISTS "Users can insert wallet" ON public.wallets;

-- payments
DROP POLICY IF EXISTS "Users can view their payments" ON public.payments;
CREATE POLICY "Users can view their payments" ON public.payments
  FOR SELECT USING (from_user_id = auth.uid() OR to_user_id = auth.uid() OR public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can manage payments" ON public.payments;
CREATE POLICY "Admins can manage payments" ON public.payments
  FOR ALL USING (public.is_admin(auth.uid()));
-- SECURITY: no client INSERT. The payments ledger is written only by SECURITY
-- DEFINER RPCs, so users cannot fabricate reimbursement/commission rows.
DROP POLICY IF EXISTS "Users can insert payments" ON public.payments;

-- notifications
DROP POLICY IF EXISTS "Users can view their notifications" ON public.notifications;
CREATE POLICY "Users can view their notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their notifications" ON public.notifications;
CREATE POLICY "Users can update their notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);
-- SECURITY: notifications are inserted only by SECURITY DEFINER RPCs. The old
-- "WITH CHECK (true)" allowed any user to write notifications to anyone (spam).
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;

-- withdrawal_requests
DROP POLICY IF EXISTS "Users can view own withdrawals" ON public.withdrawal_requests;
CREATE POLICY "Users can view own withdrawals" ON public.withdrawal_requests
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
-- SECURITY: no client INSERT. Withdrawals are created only via request_withdrawal
-- (SECURITY DEFINER), which enforces approved-KYC, sufficient balance, one-pending
-- limit, and the balance->locked_amount move. A direct insert would bypass all of it.
DROP POLICY IF EXISTS "Users can request withdrawals" ON public.withdrawal_requests;
DROP POLICY IF EXISTS "Admins can update withdrawals" ON public.withdrawal_requests;
CREATE POLICY "Admins can update withdrawals" ON public.withdrawal_requests
  FOR UPDATE USING (public.is_admin(auth.uid()));
-- One pending withdrawal per user, enforced at the DB level. Guarded so a
-- pre-existing duplicate (from before this constraint) doesn't abort the script.
DO $$ BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS withdrawal_requests_one_pending_per_user
    ON public.withdrawal_requests (user_id) WHERE status = 'pending';
EXCEPTION WHEN unique_violation THEN
  RAISE NOTICE 'Skipped withdrawal_requests_one_pending_per_user: resolve duplicate pending rows, then re-run.';
END $$;

-- otp_records
DROP POLICY IF EXISTS "Users can view OTPs for their orders" ON public.otp_records;
CREATE POLICY "Users can view OTPs for their orders" ON public.otp_records
  FOR SELECT USING (
    submitted_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.orders o JOIN public.deals d ON o.deal_id = d.id
      WHERE o.id = otp_records.order_id AND d.merchant_id = auth.uid()
    )
    OR public.is_admin(auth.uid())
  );
DROP POLICY IF EXISTS "Customers can submit OTPs" ON public.otp_records;
CREATE POLICY "Customers can submit OTPs" ON public.otp_records
  FOR INSERT WITH CHECK (auth.uid() = submitted_by);
DROP POLICY IF EXISTS "Admins can update OTP status" ON public.otp_records;
CREATE POLICY "Admins can update OTP status" ON public.otp_records
  FOR UPDATE USING (public.is_admin(auth.uid()));

-- referral_config: reward amounts/rules are readable by any signed-in user (shown
-- on the Refer & Earn page); writes happen only via the admin RPC.
DROP POLICY IF EXISTS "Anyone signed in can read referral config" ON public.referral_config;
CREATE POLICY "Anyone signed in can read referral config" ON public.referral_config
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins manage referral config" ON public.referral_config;
CREATE POLICY "Admins manage referral config" ON public.referral_config
  FOR ALL USING (public.is_admin(auth.uid()));

-- referrals: a referrer sees the referrals they made; admins see all. All writes
-- go through SECURITY DEFINER RPCs (apply_referral_code / qualification / admin).
DROP POLICY IF EXISTS "Referrer or admin can view referrals" ON public.referrals;
CREATE POLICY "Referrer or admin can view referrals" ON public.referrals
  FOR SELECT USING (referrer_id = auth.uid() OR public.is_admin(auth.uid()));

-- app_settings: the support contact is shown publicly (deal cards, incl. logged-out
-- browsing), so anyone can read it. Writes happen only via admin_update_support_number.
DROP POLICY IF EXISTS "Anyone can read app settings" ON public.app_settings;
CREATE POLICY "Anyone can read app settings" ON public.app_settings
  FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins manage app settings" ON public.app_settings;
CREATE POLICY "Admins manage app settings" ON public.app_settings
  FOR ALL USING (public.is_admin(auth.uid()));

-- reservation_config: readable by any signed-in user (frontend shows the window);
-- writes only via admin_update_reservation_config.
DROP POLICY IF EXISTS "Anyone signed in can read reservation config" ON public.reservation_config;
CREATE POLICY "Anyone signed in can read reservation config" ON public.reservation_config
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins manage reservation config" ON public.reservation_config;
CREATE POLICY "Admins manage reservation config" ON public.reservation_config
  FOR ALL USING (public.is_admin(auth.uid()));

-- reservation_events: a user sees their own events; admins see all. No client
-- writes — rows are inserted only by SECURITY DEFINER reservation RPCs.
DROP POLICY IF EXISTS "Own or admin reservation events" ON public.reservation_events;
CREATE POLICY "Own or admin reservation events" ON public.reservation_events
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

-- cardholder_reliability: a user sees their own row; admins see all. No client writes.
DROP POLICY IF EXISTS "Own or admin reliability" ON public.cardholder_reliability;
CREATE POLICY "Own or admin reliability" ON public.cardholder_reliability
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- Utility + signup trigger functions
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone, preferred_role, referral_code)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', 'User'),
    NEW.email,
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data ->> 'phone', '')), ''),
    COALESCE((NEW.raw_user_meta_data ->> 'preferred_role')::public.user_preference, 'both'),
    public.generate_referral_code()
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.wallets (user_id, balance, locked_amount)
  VALUES (NEW.id, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Admin number round-robin
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_next_admin_number()
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  selected_number TEXT;
  selected_id UUID;
BEGIN
  -- FOR UPDATE SKIP LOCKED so concurrent approvals each lock a distinct row.
  SELECT id, phone_number INTO selected_id, selected_number
  FROM public.admin_numbers
  WHERE is_active = true
  ORDER BY assignment_count ASC NULLS FIRST, last_assigned_at ASC NULLS FIRST
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF selected_id IS NULL THEN
    RAISE EXCEPTION 'No active admin numbers available';
  END IF;

  UPDATE public.admin_numbers
  SET assignment_count = COALESCE(assignment_count, 0) + 1, last_assigned_at = now()
  WHERE id = selected_id;

  RETURN selected_number;
END;
$$;
-- SECURITY: only approve_deal (SECURITY DEFINER, runs as owner) should rotate the
-- pool; direct client calls would skew the round-robin counters.
REVOKE EXECUTE ON FUNCTION public.get_next_admin_number() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Deal lifecycle: approve / reject / accept / place order / complete
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_deal(deal_id UUID)
RETURNS public.deals LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  admin_number TEXT;
  updated_deal public.deals;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can approve deals';
  END IF;

  admin_number := public.get_next_admin_number();

  UPDATE public.deals
  SET status = 'approved', admin_contact_number = admin_number, updated_at = now()
  WHERE id = deal_id AND status = 'pending'
  RETURNING * INTO updated_deal;

  IF updated_deal IS NULL THEN
    RAISE EXCEPTION 'Deal not found or not in pending status';
  END IF;

  INSERT INTO public.notifications (user_id, title, message, type, link)
  VALUES (updated_deal.merchant_id, 'Deal Approved!',
    'Your deal for "' || updated_deal.product_name || '" has been approved and is now live.',
    'success', '/deals/' || deal_id);

  RETURN updated_deal;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_deal(deal_id UUID, rejection_notes TEXT DEFAULT NULL)
RETURNS public.deals LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  updated_deal public.deals;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can reject deals';
  END IF;

  UPDATE public.deals
  SET status = 'rejected', admin_notes = rejection_notes, updated_at = now()
  WHERE id = deal_id AND status = 'pending'
  RETURNING * INTO updated_deal;

  IF updated_deal IS NULL THEN
    RAISE EXCEPTION 'Deal not found or not in pending status';
  END IF;

  INSERT INTO public.notifications (user_id, title, message, type, link)
  VALUES (updated_deal.merchant_id, 'Deal Rejected',
    'Your deal for "' || updated_deal.product_name || '" was not approved. ' || COALESCE(rejection_notes, ''),
    'error', '/deals/' || deal_id);

  RETURN updated_deal;
END;
$$;

-- NOTE: p_delivery_address is accepted for backward-compatibility but IGNORED.
-- The card holder must never be able to overwrite the shopper's stored address;
-- CreateDeal already makes delivery_address required.
CREATE OR REPLACE FUNCTION public.accept_deal(p_deal_id UUID, p_delivery_address TEXT DEFAULT NULL)
RETURNS public.deals LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  updated_deal public.deals;
  existing_address TEXT;
  deal_merchant UUID;
  cfg public.reservation_config;
  blocked_until TIMESTAMPTZ;
  accept_count INT;
  hold INT;
BEGIN
  IF NOT public.is_verified() THEN
    RAISE EXCEPTION 'Please verify your email before accepting deals';
  END IF;

  SELECT * INTO cfg FROM public.reservation_config WHERE id = true;
  hold := COALESCE(cfg.hold_seconds, 1800);

  -- Serialize THIS user's accepts (transaction-scoped advisory lock) so two
  -- parallel calls from the same account cannot slip past the checks below.
  PERFORM pg_advisory_xact_lock(hashtext('accept_deal:' || auth.uid()::text));

  IF COALESCE(cfg.enabled, true) THEN
    -- Acceptance cooldown (escalating penalty for missed reservations).
    SELECT acceptance_blocked_until INTO blocked_until FROM public.cardholder_reliability WHERE user_id = auth.uid();
    IF blocked_until IS NOT NULL AND blocked_until > now() THEN
      RAISE EXCEPTION 'You are on a % acceptance cooldown after missed reservations. Try again after %.',
        (SELECT CASE WHEN blocked_until - now() > interval '1 hour'
                     THEN CEIL(EXTRACT(EPOCH FROM (blocked_until - now())) / 3600) || 'h'
                     ELSE CEIL(EXTRACT(EPOCH FROM (blocked_until - now())) / 60) || 'm' END),
        to_char(blocked_until, 'DD Mon HH24:MI');
    END IF;

    -- One active reservation at a time: a holder must finish or release the deal
    -- they are on before locking up another one (blocks multi-deal squatting).
    IF EXISTS (
      SELECT 1 FROM public.deals a
      WHERE a.customer_id = auth.uid() AND a.status = 'accepted'
        AND a.reserved_until IS NOT NULL AND a.reserved_until > now() AND a.id != p_deal_id
    ) THEN
      RAISE EXCEPTION 'Finish or release your current reservation before accepting another deal';
    END IF;

    -- Anti-abuse: cap how many times ONE user may reserve the SAME deal, so a user
    -- cannot cycle accept/release to keep a deal blocked from everyone else.
    SELECT COUNT(*) INTO accept_count FROM public.reservation_events
    WHERE deal_id = p_deal_id AND user_id = auth.uid() AND event_type = 'reserved';
    IF accept_count >= COALESCE(cfg.max_accepts_per_deal, 3) THEN
      RAISE EXCEPTION 'You have reserved this deal the maximum number of times. Please let another card holder take it.';
    END IF;
  END IF;

  SELECT delivery_address, merchant_id INTO existing_address, deal_merchant
  FROM public.deals WHERE id = p_deal_id;
  IF existing_address IS NULL OR TRIM(existing_address) = '' THEN
    RAISE EXCEPTION 'Delivery address is required on the deal before acceptance';
  END IF;
  -- Reject own-deal accepts BEFORE the expiry below: otherwise a merchant hitting
  -- accept on their own deal (carrying someone else's lapsed hold) would trip the
  -- claim guard and roll the just-persisted expiry back.
  IF deal_merchant = auth.uid() THEN
    RAISE EXCEPTION 'You cannot accept your own deal';
  END IF;

  -- Expire a prior holder's lapsed reservation ONLY now that every guard above
  -- has passed: any earlier RAISE would roll the expiry (strike, audit event,
  -- notifications) back in this same transaction. The FOR UPDATE inside
  -- expire_reservation also row-locks the deal for the rest of this transaction,
  -- so the claim below cannot lose a race after we expired the old hold — a
  -- losing concurrent accepter blocks on the lock and its own expiry is a no-op.
  PERFORM public.expire_reservation(p_deal_id);

  -- Atomic claim + reservation window. The WHERE clause guarantees exactly one
  -- winner under concurrent acceptance (second caller sees customer_id already set).
  UPDATE public.deals
  SET status = 'accepted', customer_id = auth.uid(),
      reserved_at = now(), reserved_until = now() + make_interval(secs => hold), updated_at = now()
  WHERE id = p_deal_id AND status = 'approved' AND customer_id IS NULL AND merchant_id != auth.uid()
  RETURNING * INTO updated_deal;

  IF updated_deal IS NULL THEN
    RAISE EXCEPTION 'Deal not found, not approved, already reserved by someone, or you cannot accept your own deal';
  END IF;

  INSERT INTO public.reservation_events (deal_id, user_id, event_type, reserved_at, reserved_until)
  VALUES (p_deal_id, auth.uid(), 'reserved', updated_deal.reserved_at, updated_deal.reserved_until);

  INSERT INTO public.notifications (user_id, title, message, type, link)
  VALUES (updated_deal.merchant_id, 'Deal Reserved',
    'A card holder reserved your deal for "' || updated_deal.product_name || '" and has ' || (hold / 60) || ' minutes to place the order.', 'info', '/deals/' || p_deal_id);

  INSERT INTO public.notifications (user_id, title, message, type, link)
  VALUES (updated_deal.customer_id, 'Deal Reserved',
    'Reserved for you. Place the order using your card and submit proof before the timer runs out, or release it if you can''t.',
    'info', '/deals/' || p_deal_id);

  RETURN updated_deal;
END;
$$;

CREATE OR REPLACE FUNCTION public.place_deal_order(
  p_deal_id UUID, p_tracking_id TEXT DEFAULT NULL, p_order_screenshot_url TEXT DEFAULT NULL)
RETURNS public.orders LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  deal_record public.deals;
  new_order public.orders;
BEGIN
  IF NOT public.is_verified() THEN
    RAISE EXCEPTION 'Please verify your email before placing an order';
  END IF;

  -- Valid initial proof is required: at least a tracking id or an order screenshot.
  -- This rejects empty "fake" submissions made only to stop the timer.
  IF NULLIF(TRIM(COALESCE(p_tracking_id, '')), '') IS NULL
     AND NULLIF(TRIM(COALESCE(p_order_screenshot_url, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Add a tracking ID or an order screenshot as proof before submitting';
  END IF;

  SELECT * INTO deal_record FROM public.deals WHERE id = p_deal_id FOR UPDATE;
  IF deal_record IS NULL THEN RAISE EXCEPTION 'Deal not found'; END IF;
  IF deal_record.customer_id != auth.uid() THEN
    RAISE EXCEPTION 'Only the card holder who reserved this deal can place the order';
  END IF;
  -- Server-side timer: a lapsed window rejects the proof. The expiry itself is
  -- deliberately NOT performed here — this RAISE would roll it back in the same
  -- transaction. It is persisted by the sweeps (browse feed, new accepts, and
  -- the client's countdown/error handlers calling expire_stale_reservations).
  IF deal_record.status = 'accepted' AND deal_record.reserved_until IS NOT NULL
     AND deal_record.reserved_until < now() THEN
    RAISE EXCEPTION 'Your reservation window has expired. The deal is reopening for other card holders.';
  END IF;
  IF deal_record.status != 'accepted' THEN
    RAISE EXCEPTION 'Your reservation is no longer active. The deal must be reserved before placing an order.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.orders WHERE deal_id = p_deal_id) THEN
    RAISE EXCEPTION 'Order already placed for this deal';
  END IF;

  INSERT INTO public.orders (deal_id, customer_id, tracking_id, order_screenshot_url, status)
  VALUES (p_deal_id, auth.uid(), NULLIF(TRIM(p_tracking_id), ''), NULLIF(TRIM(p_order_screenshot_url), ''), 'placed')
  RETURNING * INTO new_order;

  -- Advance the lifecycle and stop the reservation countdown.
  UPDATE public.deals SET status = 'in_progress', reserved_at = NULL, reserved_until = NULL, updated_at = now()
  WHERE id = p_deal_id;

  INSERT INTO public.reservation_events (deal_id, user_id, event_type, reserved_at, reserved_until, detail)
  VALUES (p_deal_id, auth.uid(), 'fulfilled', deal_record.reserved_at, deal_record.reserved_until, 'Order proof submitted within the window');

  INSERT INTO public.notifications (user_id, title, message, type, link)
  VALUES (deal_record.merchant_id, 'Order Placed',
    'The card holder placed the order for "' || deal_record.product_name || '".', 'info', '/deals/' || p_deal_id);

  RETURN new_order;
END;
$$;

-- Refer & Earn qualification: called from complete_deal for each participant.
-- Rewards fire ONLY here (admin-verified completion), exactly once, when the
-- referred user's referral is still pending, the deal meets the minimum value,
-- referrals are enabled, and the referrer is under the per-referrer cap.
CREATE OR REPLACE FUNCTION public.maybe_qualify_referral(p_user_id UUID, p_deal_id UUID, p_deal_value DECIMAL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cfg public.referral_config; ref public.referrals; rewarded_count INTEGER;
BEGIN
  IF p_user_id IS NULL THEN RETURN; END IF;

  SELECT * INTO cfg FROM public.referral_config WHERE id = true;
  IF cfg IS NULL OR NOT cfg.enabled THEN RETURN; END IF;

  -- Lock the pending referral for this referred user (race-safe).
  SELECT * INTO ref FROM public.referrals
  WHERE referred_id = p_user_id AND status = 'pending' FOR UPDATE;
  IF ref IS NULL THEN RETURN; END IF;

  -- Minimum qualifying transaction value.
  IF COALESCE(p_deal_value, 0) < cfg.min_qualifying_amount THEN RETURN; END IF;

  -- Per-referrer reward cap (anti-farming). Void the referral if exceeded.
  IF cfg.max_rewards_per_referrer IS NOT NULL THEN
    SELECT COUNT(*) INTO rewarded_count FROM public.referrals
    WHERE referrer_id = ref.referrer_id AND status = 'rewarded';
    IF rewarded_count >= cfg.max_rewards_per_referrer THEN
      UPDATE public.referrals
      SET status = 'voided', admin_notes = 'Referrer reward cap reached', reversed_at = now()
      WHERE id = ref.id AND status = 'pending';
      RETURN;
    END IF;
  END IF;

  -- Atomic pending -> rewarded (only one winner).
  UPDATE public.referrals
  SET status = 'rewarded', qualifying_deal_id = p_deal_id,
      referrer_reward_amount = cfg.referrer_reward, referred_reward_amount = cfg.welcome_bonus, qualified_at = now()
  WHERE id = ref.id AND status = 'pending'
  RETURNING * INTO ref;
  IF ref IS NULL THEN RETURN; END IF;

  -- Credit + ledger + notify the REFERRER (only if a reward is configured).
  IF cfg.referrer_reward > 0 THEN
    INSERT INTO public.wallets (user_id, balance, locked_amount) VALUES (ref.referrer_id, cfg.referrer_reward, 0)
    ON CONFLICT (user_id) DO UPDATE SET balance = public.wallets.balance + EXCLUDED.balance, updated_at = now();
    INSERT INTO public.payments (from_user_id, to_user_id, amount, payment_type, status, description)
    VALUES (NULL, ref.referrer_id, cfg.referrer_reward, 'referral_reward', 'released', 'Referral reward — your referral completed their first deal');
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (ref.referrer_id, 'Referral reward earned',
      '₹' || cfg.referrer_reward || ' credited — your referral completed their first deal.', 'success', '/refer');
  END IF;

  -- Credit + ledger + notify the REFERRED user's welcome bonus.
  IF cfg.welcome_bonus > 0 THEN
    INSERT INTO public.wallets (user_id, balance, locked_amount) VALUES (ref.referred_id, cfg.welcome_bonus, 0)
    ON CONFLICT (user_id) DO UPDATE SET balance = public.wallets.balance + EXCLUDED.balance, updated_at = now();
    INSERT INTO public.payments (from_user_id, to_user_id, amount, payment_type, status, description)
    VALUES (NULL, ref.referred_id, cfg.welcome_bonus, 'welcome_bonus', 'released', 'Welcome bonus for joining via referral');
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (ref.referred_id, 'Welcome bonus credited',
      '₹' || cfg.welcome_bonus || ' welcome bonus added to your wallet.', 'success', '/wallet');
  END IF;
END;
$$;

-- SECURITY: maybe_qualify_referral must only run inside complete_deal. If clients
-- could call it directly they could pass an arbitrary p_deal_value and trigger
-- their own referral reward without completing a real deal.
REVOKE EXECUTE ON FUNCTION public.maybe_qualify_referral(UUID, UUID, DECIMAL) FROM PUBLIC, anon, authenticated;

-- Admin-mediated completion: credit reimbursement + commission to the card
-- holder's wallet and record both ledger legs (shopper outflow + card holder inflow).
CREATE OR REPLACE FUNCTION public.complete_deal(p_deal_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  deal_record public.deals;
  payout_amount DECIMAL(10,2);
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can complete deals';
  END IF;

  -- Atomic transition: only ONE concurrent caller can flip in_progress->completed,
  -- so the wallet is credited exactly once (no double-payout on double-click / two admins).
  UPDATE public.deals SET status = 'completed', updated_at = now()
  WHERE id = p_deal_id AND status = 'in_progress'
  RETURNING * INTO deal_record;

  IF deal_record IS NULL THEN
    RAISE EXCEPTION 'Deal not found or not in progress';
  END IF;

  payout_amount := deal_record.card_offer_price + deal_record.commission_amount;

  INSERT INTO public.wallets (user_id, balance, locked_amount)
  VALUES (deal_record.customer_id, payout_amount, 0)
  ON CONFLICT (user_id) DO UPDATE
  SET balance = public.wallets.balance + EXCLUDED.balance, updated_at = now();

  INSERT INTO public.payments (from_user_id, to_user_id, deal_id, amount, payment_type, status, description)
  VALUES (deal_record.merchant_id, deal_record.customer_id, p_deal_id, deal_record.card_offer_price,
    'reimbursement', 'released', 'Reimbursement for order placed on ' || deal_record.product_name);

  INSERT INTO public.payments (from_user_id, to_user_id, deal_id, amount, payment_type, status, description)
  VALUES (deal_record.merchant_id, deal_record.customer_id, p_deal_id, deal_record.commission_amount,
    'commission', 'released', 'Commission for deal "' || deal_record.product_name || '"');

  INSERT INTO public.notifications (user_id, title, message, type, link)
  VALUES (deal_record.customer_id, 'Payment Credited',
    '₹' || payout_amount || ' (reimbursement + commission) credited to your wallet for "' || deal_record.product_name || '".',
    'success', '/wallet');

  INSERT INTO public.notifications (user_id, title, message, type, link)
  VALUES (deal_record.merchant_id, 'Deal Completed',
    'Your deal "' || deal_record.product_name || '" is complete.', 'success', '/deals/' || p_deal_id);

  -- Refer & Earn: a referred user qualifies on their first completed deal in
  -- EITHER role, so evaluate both the card holder and the shopper. Each user has
  -- at most one pending referral (UNIQUE referred_id), so no double reward.
  PERFORM public.maybe_qualify_referral(deal_record.customer_id, p_deal_id, deal_record.expected_buy_price);
  PERFORM public.maybe_qualify_referral(deal_record.merchant_id, p_deal_id, deal_record.expected_buy_price);
END;
$$;

-- Merchant cancels their own deal while it is still pending or approved (i.e.
-- before a card holder accepts it). Admins may also cancel.
CREATE OR REPLACE FUNCTION public.cancel_deal(p_deal_id UUID)
RETURNS public.deals LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE updated_deal public.deals; deal_record public.deals;
BEGIN
  SELECT * INTO deal_record FROM public.deals WHERE id = p_deal_id;
  IF deal_record IS NULL THEN RAISE EXCEPTION 'Deal not found'; END IF;
  IF deal_record.merchant_id != auth.uid() AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only the shopper who posted this deal (or an admin) can cancel it';
  END IF;
  IF deal_record.status NOT IN ('pending', 'approved') THEN
    RAISE EXCEPTION 'Only a pending or approved deal that has not been accepted can be cancelled';
  END IF;

  -- Status-guarded UPDATE closes the TOCTOU window: if an accept_deal lands between
  -- the read above and here, the guard fails instead of clobbering the reservation.
  UPDATE public.deals SET status = 'cancelled', updated_at = now()
  WHERE id = p_deal_id AND status IN ('pending', 'approved')
  RETURNING * INTO updated_deal;

  IF updated_deal IS NULL THEN
    RAISE EXCEPTION 'This deal can no longer be cancelled (it may have just been reserved).';
  END IF;

  RETURN updated_deal;
END;
$$;

-- ---------------------------------------------------------------------------
-- Reservation expiry / voluntary release
-- ---------------------------------------------------------------------------
-- Shared escalation. A "strike" = an expired reservation OR a voluntary release
-- AFTER the grace window (the caller logs the event first, then calls this).
-- 1st strike in the window: warning; 2nd: 1h cooldown; 3rd: 24h; 4th+: 7d + review.
-- Internal only — EXECUTE is revoked from clients below; SECURITY DEFINER callers
-- (expire_reservation / release_deal) still run it as the function owner.
CREATE OR REPLACE FUNCTION public.apply_reliability_strike(p_user_id UUID, p_deal_id UUID, p_product_name TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  cfg public.reservation_config;
  n_strikes INT;
  cd_seconds INT;
  new_block TIMESTAMPTZ;
BEGIN
  SELECT * INTO cfg FROM public.reservation_config WHERE id = true;
  IF NOT COALESCE(cfg.enabled, true) THEN RETURN; END IF;

  SELECT COUNT(*) INTO n_strikes FROM public.reservation_events
  WHERE user_id = p_user_id
    AND (event_type = 'expired' OR (event_type = 'released' AND within_grace = false))
    AND NOT voided  -- admin-forgiven strikes restart escalation from the warning tier
    AND created_at > now() - make_interval(days => COALESCE(cfg.strike_window_days, 30));

  cd_seconds := CASE
    WHEN n_strikes <= 1 THEN 0                                       -- 1st: warning only
    WHEN n_strikes = 2 THEN COALESCE(cfg.cooldown2_seconds, 3600)    -- 2nd: 1h
    WHEN n_strikes = 3 THEN COALESCE(cfg.cooldown3_seconds, 86400)   -- 3rd: 24h
    ELSE COALESCE(cfg.cooldown_abuse_seconds, 604800)                -- 4th+: 7d + admin review
  END;
  new_block := CASE WHEN cd_seconds > 0 THEN now() + make_interval(secs => cd_seconds) ELSE NULL END;

  INSERT INTO public.cardholder_reliability (user_id, strikes_30d, acceptance_blocked_until, under_review, updated_at)
  VALUES (p_user_id, n_strikes, new_block, (n_strikes >= 4), now())
  ON CONFLICT (user_id) DO UPDATE SET
    strikes_30d = EXCLUDED.strikes_30d,
    -- extend the cooldown, never shorten an existing one (GREATEST ignores NULLs)
    acceptance_blocked_until = GREATEST(public.cardholder_reliability.acceptance_blocked_until, EXCLUDED.acceptance_blocked_until),
    under_review = public.cardholder_reliability.under_review OR EXCLUDED.under_review,
    updated_at = now();

  INSERT INTO public.notifications (user_id, title, message, type, link)
  VALUES (p_user_id, 'Reservation missed',
    CASE WHEN cd_seconds > 0
      THEN 'You missed the window for "' || p_product_name || '". Accepting new deals is paused until ' || to_char(new_block, 'DD Mon HH24:MI') || '.'
      ELSE 'You missed the window for "' || p_product_name || '". This is a warning — repeated misses pause your ability to accept deals.'
    END,
    'error', '/deals/' || p_deal_id);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.apply_reliability_strike(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;

-- Expire ONE deal's reservation if the 30-minute window lapsed with no order.
-- Atomic + idempotent: only a stale 'accepted' deal with no order is reopened,
-- and the strike is applied exactly once. Safe to call from anyone (it only ever
-- acts on genuinely-expired reservations). Returns true if it expired one.
CREATE OR REPLACE FUNCTION public.expire_reservation(p_deal_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  d public.deals;
  cfg public.reservation_config;
BEGIN
  SELECT * INTO cfg FROM public.reservation_config WHERE id = true;

  -- Lock the row, then re-check under the lock (avoids two callers double-striking).
  SELECT * INTO d FROM public.deals WHERE id = p_deal_id FOR UPDATE;
  IF d IS NULL OR d.status != 'accepted' OR d.reserved_until IS NULL OR d.reserved_until >= now() THEN
    RETURN false;
  END IF;
  IF EXISTS (SELECT 1 FROM public.orders WHERE deal_id = p_deal_id) THEN
    RETURN false; -- order already placed; nothing to expire
  END IF;

  UPDATE public.deals
  SET status = 'approved', customer_id = NULL, reserved_at = NULL, reserved_until = NULL, updated_at = now()
  WHERE id = p_deal_id;

  INSERT INTO public.reservation_events (deal_id, user_id, event_type, reserved_at, reserved_until, detail)
  VALUES (p_deal_id, d.customer_id, 'expired', d.reserved_at, d.reserved_until, 'Reservation expired without order proof');

  -- Notify the shopper the deal reopened regardless of the punitive switch.
  INSERT INTO public.notifications (user_id, title, message, type, link)
  VALUES (d.merchant_id, 'Deal reopened',
    'The reservation on "' || d.product_name || '" expired; your deal is open again.', 'info', '/deals/' || p_deal_id);

  -- Track lifetime expiries; strikes/cooldowns/notification are applied by the
  -- shared helper (it counts the 'expired' event logged above).
  INSERT INTO public.cardholder_reliability (user_id, total_expiries, last_expiry_at, updated_at)
  VALUES (d.customer_id, 1, now(), now())
  ON CONFLICT (user_id) DO UPDATE SET
    total_expiries = public.cardholder_reliability.total_expiries + 1,
    last_expiry_at = now(), updated_at = now();

  PERFORM public.apply_reliability_strike(d.customer_id, p_deal_id, d.product_name);

  RETURN true;
END;
$$;

-- Sweep all lapsed reservations. Called lazily from list_open_deals, accept_deal,
-- place_deal_order and the client's countdown-zero handler, so expiry needs no
-- background job. Optional belt-and-suspenders (requires the pg_cron extension):
--   SELECT cron.schedule('expire-stale-reservations', '* * * * *',
--     $CRON$SELECT public.expire_stale_reservations()$CRON$);
CREATE OR REPLACE FUNCTION public.expire_stale_reservations()
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD; n INT := 0;
BEGIN
  FOR r IN
    SELECT id FROM public.deals
    WHERE status = 'accepted' AND reserved_until IS NOT NULL AND reserved_until < now()
  LOOP
    IF public.expire_reservation(r.id) THEN n := n + 1; END IF;
  END LOOP;
  RETURN n;
END;
$$;

-- Voluntary release by the current holder (no strike). Within the grace window it
-- is explicitly penalty-free; each acceptance still counts toward the per-deal cap
-- so a user cannot cycle accept/release to keep a deal blocked.
CREATE OR REPLACE FUNCTION public.release_deal(p_deal_id UUID)
RETURNS public.deals LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  d public.deals;
  released public.deals;
  cfg public.reservation_config;
  grace_ok BOOLEAN;
BEGIN
  SELECT * INTO cfg FROM public.reservation_config WHERE id = true;
  SELECT * INTO d FROM public.deals WHERE id = p_deal_id FOR UPDATE;
  IF d IS NULL THEN RAISE EXCEPTION 'Deal not found'; END IF;
  IF d.customer_id != auth.uid() THEN
    RAISE EXCEPTION 'Only the card holder holding this reservation can release it';
  END IF;
  IF d.status != 'accepted' THEN
    RAISE EXCEPTION 'This deal is not currently reserved by you';
  END IF;
  IF EXISTS (SELECT 1 FROM public.orders WHERE deal_id = p_deal_id) THEN
    RAISE EXCEPTION 'You already placed the order for this deal; it cannot be released';
  END IF;

  -- Legacy holds (accepted before the reservation system existed; reserved_at is
  -- NULL) never had a timer, so releasing them is always penalty-free.
  grace_ok := d.reserved_at IS NULL
    OR now() <= d.reserved_at + make_interval(secs => COALESCE(cfg.release_grace_seconds, 300));

  UPDATE public.deals
  SET status = 'approved', customer_id = NULL, reserved_at = NULL, reserved_until = NULL, updated_at = now()
  WHERE id = p_deal_id AND status = 'accepted' AND customer_id = auth.uid()
  RETURNING * INTO released;
  IF released IS NULL THEN
    RAISE EXCEPTION 'Could not release the deal — it may have just expired or changed.';
  END IF;

  INSERT INTO public.reservation_events (deal_id, user_id, event_type, within_grace, reserved_at, reserved_until, detail)
  VALUES (p_deal_id, auth.uid(), 'released', grace_ok, d.reserved_at, d.reserved_until,
    CASE WHEN grace_ok THEN 'Voluntary release within grace window (penalty-free)'
         ELSE 'Voluntary release after grace window (counts as a missed reservation)' END);

  INSERT INTO public.cardholder_reliability (user_id, total_releases, updated_at)
  VALUES (auth.uid(), 1, now())
  ON CONFLICT (user_id) DO UPDATE SET
    total_releases = public.cardholder_reliability.total_releases + 1, updated_at = now();

  -- Releasing after the grace window counts toward strikes (otherwise a user
  -- could hold deals for the full window and release at no cost). Within the
  -- grace window it is entirely penalty-free.
  IF NOT grace_ok THEN
    PERFORM public.apply_reliability_strike(auth.uid(), p_deal_id, d.product_name);
  END IF;

  INSERT INTO public.notifications (user_id, title, message, type, link)
  VALUES (d.merchant_id, 'Deal reopened',
    'The card holder released "' || d.product_name || '"; your deal is open again.', 'info', '/deals/' || p_deal_id);

  RETURN released;
END;
$$;

-- The caller's live reservation + cooldown state (for browse banners / gating).
CREATE OR REPLACE FUNCTION public.get_my_reservation_status()
RETURNS TABLE (
  active_deal_id UUID, active_product_name TEXT, active_reserved_until TIMESTAMPTZ,
  blocked_until TIMESTAMPTZ, strikes_30d INT, under_review BOOLEAN, server_now TIMESTAMPTZ
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  RETURN QUERY
  SELECT d.id, d.product_name, d.reserved_until,
         rel.acceptance_blocked_until, COALESCE(rel.strikes_30d, 0), COALESCE(rel.under_review, false), now()
  FROM (SELECT 1) one
  LEFT JOIN public.deals d
    ON d.customer_id = auth.uid() AND d.status = 'accepted' AND d.reserved_until > now()
  LEFT JOIN public.cardholder_reliability rel ON rel.user_id = auth.uid()
  LIMIT 1;
END;
$$;

-- ---------------------------------------------------------------------------
-- Browse / detail helpers (privacy: hide delivery address from non-participants)
-- ---------------------------------------------------------------------------
-- DROP first: CREATE OR REPLACE cannot change a function's RETURNS TABLE shape.
DROP FUNCTION IF EXISTS public.list_open_deals();
CREATE OR REPLACE FUNCTION public.list_open_deals()
RETURNS TABLE (
  id UUID, merchant_id UUID, product_name TEXT, product_link TEXT,
  original_price DECIMAL(10,2), card_offer_price DECIMAL(10,2), expected_buy_price DECIMAL(10,2),
  commission_amount DECIMAL(10,2), required_card TEXT, admin_contact_number TEXT, status TEXT,
  customer_id UUID, advance_amount DECIMAL(10,2), remaining_amount DECIMAL(10,2),
  created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ,
  is_reserved BOOLEAN, reserved_until TIMESTAMPTZ, server_now TIMESTAMPTZ
) LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Reopen any reservations that lapsed so the browse feed is always current.
  PERFORM public.expire_stale_reservations();
  RETURN QUERY
  SELECT d.id, d.merchant_id, d.product_name, d.product_link, d.original_price, d.card_offer_price,
    d.expected_buy_price, d.commission_amount, d.required_card, d.admin_contact_number, d.status::TEXT,
    NULL::UUID,  -- never expose WHO holds a reservation in the public feed
    d.advance_amount, d.remaining_amount, d.created_at, d.updated_at,
    (d.status = 'accepted'),
    CASE WHEN d.status = 'accepted' THEN d.reserved_until ELSE NULL END,
    now()
  FROM public.deals d
  WHERE (d.status = 'approved' AND d.customer_id IS NULL)
     OR (d.status = 'accepted' AND d.reserved_until IS NOT NULL AND d.reserved_until > now())
  ORDER BY (d.status = 'approved' AND d.customer_id IS NULL) DESC, d.created_at DESC;
END;
$$;

DROP FUNCTION IF EXISTS public.get_deal_accept_preview(uuid);
CREATE OR REPLACE FUNCTION public.get_deal_accept_preview(p_deal_id UUID)
RETURNS TABLE (
  id UUID, product_name TEXT, required_card TEXT,
  card_offer_price DECIMAL(10,2), commission_amount DECIMAL(10,2), delivery_address TEXT
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to accept deals'; END IF;
  -- The delivery address is deliberately NOT returned here. It is only revealed
  -- after the deal is accepted (see get_deal_for_viewer), to protect the
  -- shopper's privacy. The WHERE clause still requires a valid address so that
  -- only genuinely acceptable deals can be previewed and accepted.
  RETURN QUERY
  SELECT d.id, d.product_name, d.required_card, d.card_offer_price, d.commission_amount, NULL::TEXT
  FROM public.deals d
  WHERE d.id = p_deal_id AND d.status = 'approved' AND d.customer_id IS NULL
    AND d.merchant_id != auth.uid()
    AND d.delivery_address IS NOT NULL AND TRIM(d.delivery_address) != '';
END;
$$;

DROP FUNCTION IF EXISTS public.get_deal_for_viewer(uuid);
CREATE OR REPLACE FUNCTION public.get_deal_for_viewer(p_deal_id UUID)
RETURNS TABLE (
  id UUID, merchant_id UUID, customer_id UUID, product_name TEXT, product_link TEXT,
  original_price DECIMAL(10,2), card_offer_price DECIMAL(10,2), expected_buy_price DECIMAL(10,2),
  advance_amount DECIMAL(10,2), remaining_amount DECIMAL(10,2), commission_amount DECIMAL(10,2),
  required_card TEXT, delivery_address TEXT, admin_contact_number TEXT, status TEXT,
  admin_notes TEXT, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ,
  reserved_at TIMESTAMPTZ, reserved_until TIMESTAMPTZ, server_now TIMESTAMPTZ
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to view deal details'; END IF;
  RETURN QUERY
  SELECT d.id, d.merchant_id, d.customer_id, d.product_name, d.product_link, d.original_price,
    d.card_offer_price, d.expected_buy_price, d.advance_amount, d.remaining_amount, d.commission_amount,
    d.required_card,
    CASE WHEN public.is_admin(auth.uid()) OR d.merchant_id = auth.uid() OR d.customer_id = auth.uid()
      THEN d.delivery_address ELSE NULL END,
    d.admin_contact_number, d.status::TEXT,
    CASE WHEN public.is_admin(auth.uid()) OR d.merchant_id = auth.uid() THEN d.admin_notes ELSE NULL END,
    d.created_at, d.updated_at,
    d.reserved_at, d.reserved_until, now()
  FROM public.deals d
  WHERE d.id = p_deal_id AND (
    public.is_admin(auth.uid()) OR d.merchant_id = auth.uid() OR d.customer_id = auth.uid()
    OR (d.status = 'approved' AND d.customer_id IS NULL)
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- KYC review
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_kyc(p_kyc_id UUID, p_notes TEXT DEFAULT NULL)
RETURNS public.kycs LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE updated_kyc public.kycs;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Only admins can approve KYC'; END IF;
  UPDATE public.kycs SET status = 'approved', admin_notes = p_notes, updated_at = now()
  WHERE id = p_kyc_id AND status = 'pending' RETURNING * INTO updated_kyc;
  IF updated_kyc IS NULL THEN RAISE EXCEPTION 'KYC not found or not pending'; END IF;
  INSERT INTO public.notifications (user_id, title, message, type, link)
  VALUES (updated_kyc.user_id, 'KYC Approved',
    'Your identity is verified. You can now request withdrawals from your wallet.', 'success', '/wallet');
  RETURN updated_kyc;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_kyc(p_kyc_id UUID, p_notes TEXT DEFAULT NULL)
RETURNS public.kycs LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE updated_kyc public.kycs;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Only admins can reject KYC'; END IF;
  UPDATE public.kycs SET status = 'rejected',
    admin_notes = COALESCE(p_notes, 'Please resubmit with correct details.'), updated_at = now()
  WHERE id = p_kyc_id AND status = 'pending' RETURNING * INTO updated_kyc;
  IF updated_kyc IS NULL THEN RAISE EXCEPTION 'KYC not found or not pending'; END IF;
  INSERT INTO public.notifications (user_id, title, message, type, link)
  VALUES (updated_kyc.user_id, 'KYC Rejected',
    COALESCE(p_notes, 'Please resubmit your KYC with correct bank details.'), 'error', '/kyc');
  RETURN updated_kyc;
END;
$$;

-- Admin-facing KYC list with applicant name/email (respects admin check)
DROP FUNCTION IF EXISTS public.list_kycs_for_admin();
CREATE OR REPLACE FUNCTION public.list_kycs_for_admin()
RETURNS TABLE (
  id UUID, user_id UUID, full_name TEXT, email TEXT, pan_number TEXT, document_url TEXT,
  bank_name TEXT, account_number TEXT, ifsc_code TEXT, status TEXT, admin_notes TEXT, created_at TIMESTAMPTZ
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Only admins can list KYC submissions'; END IF;
  RETURN QUERY
  -- Latest submission per user only (avoids showing stale rejected rows).
  SELECT DISTINCT ON (k.user_id)
    k.id, k.user_id, p.full_name, p.email, k.pan_number, k.document_url, k.bank_name,
    k.account_number, k.ifsc_code, k.status::TEXT, k.admin_notes, k.created_at
  FROM public.kycs k JOIN public.profiles p ON p.id = k.user_id
  ORDER BY k.user_id, k.created_at DESC;
END;
$$;

-- ---------------------------------------------------------------------------
-- Withdrawals (request / complete / reject)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.request_withdrawal(p_amount DECIMAL)
RETURNS public.withdrawal_requests LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  user_wallet public.wallets;
  approved_kyc public.kycs;
  new_request public.withdrawal_requests;
BEGIN
  IF NOT public.is_verified() THEN RAISE EXCEPTION 'Please verify your email before requesting a withdrawal'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Withdrawal amount must be greater than zero'; END IF;

  SELECT * INTO approved_kyc FROM public.kycs WHERE user_id = auth.uid() AND status = 'approved' LIMIT 1;
  IF approved_kyc IS NULL THEN RAISE EXCEPTION 'Approved KYC is required before withdrawal'; END IF;

  -- Row-lock the wallet so two concurrent requests cannot both pass the balance
  -- check and double-debit (TOCTOU). The wallets_nonneg CHECK is the final backstop.
  SELECT * INTO user_wallet FROM public.wallets WHERE user_id = auth.uid() FOR UPDATE;
  IF user_wallet IS NULL OR user_wallet.balance < p_amount THEN RAISE EXCEPTION 'Insufficient wallet balance'; END IF;

  IF EXISTS (SELECT 1 FROM public.withdrawal_requests WHERE user_id = auth.uid() AND status = 'pending') THEN
    RAISE EXCEPTION 'You already have a pending withdrawal request';
  END IF;

  UPDATE public.wallets
  SET balance = balance - p_amount, locked_amount = locked_amount + p_amount, updated_at = now()
  WHERE user_id = auth.uid();

  INSERT INTO public.withdrawal_requests (user_id, amount, status)
  VALUES (auth.uid(), p_amount, 'pending') RETURNING * INTO new_request;

  INSERT INTO public.notifications (user_id, title, message, type, link)
  VALUES (auth.uid(), 'Withdrawal requested',
    '₹' || p_amount || ' withdrawal is pending admin transfer to your bank account.', 'info', '/wallet');

  RETURN new_request;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_withdrawal(p_request_id UUID)
RETURNS public.withdrawal_requests LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE req public.withdrawal_requests;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Only admins can complete withdrawals'; END IF;
  SELECT * INTO req FROM public.withdrawal_requests WHERE id = p_request_id;
  IF req IS NULL OR req.status != 'pending' THEN RAISE EXCEPTION 'Withdrawal request not found or not pending'; END IF;

  UPDATE public.withdrawal_requests SET status = 'completed', updated_at = now()
  WHERE id = p_request_id RETURNING * INTO req;

  UPDATE public.wallets SET locked_amount = GREATEST(locked_amount - req.amount, 0), updated_at = now()
  WHERE user_id = req.user_id;

  INSERT INTO public.payments (from_user_id, to_user_id, amount, payment_type, status, description)
  VALUES (req.user_id, req.user_id, req.amount, 'withdrawal', 'released', 'Withdrawal transferred to bank account');

  INSERT INTO public.notifications (user_id, title, message, type, link)
  VALUES (req.user_id, 'Withdrawal completed',
    '₹' || req.amount || ' has been transferred to your bank account.', 'success', '/wallet');

  RETURN req;
END;
$$;

-- Reject a withdrawal and return the locked funds to the user's balance
CREATE OR REPLACE FUNCTION public.reject_withdrawal(p_request_id UUID, p_notes TEXT DEFAULT NULL)
RETURNS public.withdrawal_requests LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE req public.withdrawal_requests;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Only admins can reject withdrawals'; END IF;
  SELECT * INTO req FROM public.withdrawal_requests WHERE id = p_request_id;
  IF req IS NULL OR req.status != 'pending' THEN RAISE EXCEPTION 'Withdrawal request not found or not pending'; END IF;

  UPDATE public.withdrawal_requests
  SET status = 'rejected', admin_notes = COALESCE(p_notes, 'Withdrawal rejected by admin.'), updated_at = now()
  WHERE id = p_request_id RETURNING * INTO req;

  UPDATE public.wallets
  SET balance = balance + req.amount, locked_amount = GREATEST(locked_amount - req.amount, 0), updated_at = now()
  WHERE user_id = req.user_id;

  INSERT INTO public.notifications (user_id, title, message, type, link)
  VALUES (req.user_id, 'Withdrawal rejected',
    COALESCE(p_notes, 'Your withdrawal request was rejected.') || ' ₹' || req.amount || ' returned to your wallet balance.',
    'error', '/wallet');

  RETURN req;
END;
$$;

-- ---------------------------------------------------------------------------
-- Admin role management
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.grant_admin_role(p_email TEXT)
RETURNS public.user_roles LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  target_user_id UUID;
  new_role public.user_roles;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Only admins can grant the admin role'; END IF;
  IF p_email IS NULL OR TRIM(p_email) = '' THEN RAISE EXCEPTION 'Email is required'; END IF;

  SELECT p.id INTO target_user_id FROM public.profiles p
  WHERE LOWER(p.email) = LOWER(TRIM(p_email)) LIMIT 1;
  IF target_user_id IS NULL THEN RAISE EXCEPTION 'No user found with email %', TRIM(p_email); END IF;
  IF public.is_admin(target_user_id) THEN RAISE EXCEPTION 'User is already an admin'; END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (target_user_id, 'admin') RETURNING * INTO new_role;

  INSERT INTO public.notifications (user_id, title, message, type, link)
  VALUES (target_user_id, 'Admin access granted',
    'You now have admin access. Sign out and sign in again to use the Admin Panel.', 'success', '/admin');

  RETURN new_role;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_admin_role(p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE admin_count INTEGER;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Only admins can revoke the admin role'; END IF;
  IF p_user_id = auth.uid() THEN RAISE EXCEPTION 'You cannot remove your own admin role'; END IF;
  IF NOT public.is_admin(p_user_id) THEN RAISE EXCEPTION 'User is not an admin'; END IF;

  SELECT COUNT(*) INTO admin_count FROM public.user_roles WHERE role = 'admin';
  IF admin_count <= 1 THEN RAISE EXCEPTION 'Cannot remove the last admin'; END IF;

  DELETE FROM public.user_roles WHERE user_id = p_user_id AND role = 'admin';

  INSERT INTO public.notifications (user_id, title, message, type, link)
  VALUES (p_user_id, 'Admin access removed', 'Your admin access has been revoked.', 'info', '/dashboard');
END;
$$;

DROP FUNCTION IF EXISTS public.list_admins();
CREATE OR REPLACE FUNCTION public.list_admins()
RETURNS TABLE (user_id UUID, email TEXT, full_name TEXT, granted_at TIMESTAMPTZ)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT ur.user_id, p.email, p.full_name, ur.created_at
  FROM public.user_roles ur JOIN public.profiles p ON p.id = ur.user_id
  WHERE ur.role = 'admin' AND public.is_admin(auth.uid())
  ORDER BY ur.created_at ASC;
$$;

-- ---------------------------------------------------------------------------
-- Triggers (drop + recreate so re-running is safe)
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_kycs_updated_at ON public.kycs;
CREATE TRIGGER update_kycs_updated_at BEFORE UPDATE ON public.kycs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_deals_updated_at ON public.deals;
CREATE TRIGGER update_deals_updated_at BEFORE UPDATE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_orders_updated_at ON public.orders;
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_wallets_updated_at ON public.wallets;
CREATE TRIGGER update_wallets_updated_at BEFORE UPDATE ON public.wallets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_withdrawal_requests_updated_at ON public.withdrawal_requests;
CREATE TRIGGER update_withdrawal_requests_updated_at BEFORE UPDATE ON public.withdrawal_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===========================================================================
-- PRODUCT PRICE TRACKER  (paste an Amazon/Flipkart/etc. link, track price over
-- time, get buy recommendations, set target price + alerts)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.tracked_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'other',   -- amazon | flipkart | myntra | ajio | other
  external_id TEXT,                          -- ASIN / product id when known
  product_name TEXT NOT NULL,
  image_url TEXT,
  currency TEXT NOT NULL DEFAULT 'INR',
  current_price DECIMAL(12,2),
  original_price DECIMAL(12,2),
  availability TEXT,
  seller TEXT,
  target_price DECIMAL(12,2),
  notify_enabled BOOLEAN NOT NULL DEFAULT true,
  last_alerted_price DECIMAL(12,2),
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DO $$ BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS tracked_products_user_url_key ON public.tracked_products (user_id, url);
EXCEPTION WHEN unique_violation THEN
  RAISE NOTICE 'Skipped tracked_products_user_url_key: resolve duplicate (user_id, url) rows, then re-run.';
END $$;

CREATE TABLE IF NOT EXISTS public.product_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.tracked_products(id) ON DELETE CASCADE,
  price DECIMAL(12,2) NOT NULL,
  original_price DECIMAL(12,2),
  availability TEXT,
  source TEXT NOT NULL DEFAULT 'manual',     -- manual | auto
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS product_price_history_product_idx ON public.product_price_history (product_id, checked_at DESC);

ALTER TABLE public.tracked_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_price_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own tracked products" ON public.tracked_products;
CREATE POLICY "Users manage own tracked products" ON public.tracked_products
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users read own price history" ON public.product_price_history;
CREATE POLICY "Users read own price history" ON public.product_price_history
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.tracked_products p WHERE p.id = product_id AND p.user_id = auth.uid())
  );
-- History is written only via SECURITY DEFINER RPCs (log_product_price / edge fn).

DROP TRIGGER IF EXISTS update_tracked_products_updated_at ON public.tracked_products;
CREATE TRIGGER update_tracked_products_updated_at BEFORE UPDATE ON public.tracked_products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add a product to the tracker and record its first price point.
CREATE OR REPLACE FUNCTION public.add_tracked_product(
  p_url TEXT, p_platform TEXT, p_product_name TEXT, p_image_url TEXT DEFAULT NULL,
  p_current_price DECIMAL DEFAULT NULL, p_original_price DECIMAL DEFAULT NULL,
  p_currency TEXT DEFAULT 'INR', p_external_id TEXT DEFAULT NULL,
  p_availability TEXT DEFAULT NULL, p_seller TEXT DEFAULT NULL, p_target_price DECIMAL DEFAULT NULL,
  p_source TEXT DEFAULT 'manual'
) RETURNS public.tracked_products LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE prod public.tracked_products;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to track products'; END IF;
  IF p_url IS NULL OR TRIM(p_url) = '' THEN RAISE EXCEPTION 'Product URL is required'; END IF;
  IF p_product_name IS NULL OR TRIM(p_product_name) = '' THEN RAISE EXCEPTION 'Product name is required'; END IF;

  INSERT INTO public.tracked_products
    (user_id, url, platform, external_id, product_name, image_url, currency,
     current_price, original_price, availability, seller, target_price, last_checked_at)
  VALUES
    (auth.uid(), TRIM(p_url), COALESCE(NULLIF(TRIM(p_platform), ''), 'other'), p_external_id,
     TRIM(p_product_name), p_image_url, COALESCE(NULLIF(TRIM(p_currency), ''), 'INR'),
     p_current_price, p_original_price, p_availability, p_seller, p_target_price,
     CASE WHEN p_current_price IS NULL THEN NULL ELSE now() END)
  ON CONFLICT (user_id, url) DO UPDATE
    SET product_name = EXCLUDED.product_name, image_url = COALESCE(EXCLUDED.image_url, public.tracked_products.image_url),
        updated_at = now()
  RETURNING * INTO prod;

  IF p_current_price IS NOT NULL THEN
    INSERT INTO public.product_price_history (product_id, price, original_price, availability, source)
    VALUES (prod.id, p_current_price, p_original_price, p_availability, COALESCE(p_source, 'manual'));
  END IF;

  RETURN prod;
END;
$$;

-- Record a new price point for a product the caller owns (manual re-check).
CREATE OR REPLACE FUNCTION public.log_product_price(
  p_product_id UUID, p_price DECIMAL, p_original_price DECIMAL DEFAULT NULL,
  p_availability TEXT DEFAULT NULL, p_source TEXT DEFAULT 'manual'
) RETURNS public.tracked_products LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE prod public.tracked_products;
BEGIN
  SELECT * INTO prod FROM public.tracked_products WHERE id = p_product_id;
  IF prod IS NULL THEN RAISE EXCEPTION 'Product not found'; END IF;
  IF prod.user_id != auth.uid() THEN RAISE EXCEPTION 'You can only update your own tracked products'; END IF;
  IF p_price IS NULL OR p_price <= 0 THEN RAISE EXCEPTION 'Price must be greater than zero'; END IF;

  INSERT INTO public.product_price_history (product_id, price, original_price, availability, source)
  VALUES (p_product_id, p_price, p_original_price, p_availability, COALESCE(p_source, 'manual'));

  UPDATE public.tracked_products
  SET current_price = p_price,
      original_price = COALESCE(p_original_price, original_price),
      availability = COALESCE(p_availability, availability),
      last_checked_at = now(), updated_at = now()
  WHERE id = p_product_id RETURNING * INTO prod;

  -- Target-price alert (no duplicate alerts at the same price)
  IF prod.notify_enabled AND prod.target_price IS NOT NULL AND p_price <= prod.target_price
     AND (prod.last_alerted_price IS NULL OR prod.last_alerted_price <> p_price) THEN
    UPDATE public.tracked_products SET last_alerted_price = p_price WHERE id = p_product_id;
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (prod.user_id, 'Price drop alert',
      prod.product_name || ' is now ' || prod.currency || ' ' || p_price ||
      ' (target ' || prod.currency || ' ' || prod.target_price || ').', 'success', '/tracker');
  END IF;

  RETURN prod;
END;
$$;

-- Stats + data-driven buy recommendation from real recorded history.
DROP FUNCTION IF EXISTS public.get_product_stats(uuid);
CREATE OR REPLACE FUNCTION public.get_product_stats(p_product_id UUID)
RETURNS TABLE (
  points INTEGER, current_price DECIMAL(12,2), lowest DECIMAL(12,2), highest DECIMAL(12,2),
  average DECIMAL(12,2), first_price DECIMAL(12,2), previous_price DECIMAL(12,2),
  recommendation TEXT, pct_from_low NUMERIC, recent_change NUMERIC
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  owner UUID; n INTEGER; cur DECIMAL; lo DECIMAL; hi DECIMAL; avg_p DECIMAL; first_p DECIMAL; prev_p DECIMAL; rec TEXT;
BEGIN
  SELECT user_id INTO owner FROM public.tracked_products WHERE id = p_product_id;
  IF owner IS NULL OR owner != auth.uid() THEN RAISE EXCEPTION 'Product not found'; END IF;

  SELECT COUNT(*), MIN(price), MAX(price), ROUND(AVG(price), 2) INTO n, lo, hi, avg_p
  FROM public.product_price_history WHERE product_id = p_product_id;

  SELECT price INTO cur FROM public.product_price_history WHERE product_id = p_product_id ORDER BY checked_at DESC LIMIT 1;
  SELECT price INTO first_p FROM public.product_price_history WHERE product_id = p_product_id ORDER BY checked_at ASC LIMIT 1;
  SELECT price INTO prev_p FROM public.product_price_history WHERE product_id = p_product_id ORDER BY checked_at DESC OFFSET 1 LIMIT 1;

  IF COALESCE(n, 0) < 2 THEN rec := 'building';
  ELSIF cur <= lo * 1.02 THEN rec := 'excellent';
  ELSIF cur <= avg_p * 0.98 THEN rec := 'good';
  ELSIF cur >= avg_p * 1.05 THEN rec := 'wait';
  ELSE rec := 'fair';
  END IF;

  RETURN QUERY SELECT
    COALESCE(n, 0), cur, lo, hi, avg_p, first_p, prev_p, rec,
    CASE WHEN hi > lo THEN ROUND(((cur - lo) / NULLIF(hi - lo, 0) * 100)::numeric, 0) ELSE 0 END,
    CASE WHEN prev_p IS NOT NULL AND prev_p > 0 THEN ROUND(((cur - prev_p) / prev_p * 100)::numeric, 1) ELSE 0 END;
END;
$$;

-- ===========================================================================
-- REFER & EARN — user + admin RPCs
-- ===========================================================================

-- Apply a referral code to the CURRENT user (called after email verification /
-- Google login). Idempotent + anti-abuse. Returns a JSON result so the UI can
-- message gracefully instead of treating "already referred" as a hard error.
CREATE OR REPLACE FUNCTION public.apply_referral_code(p_code TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me UUID := auth.uid(); ref_user UUID; my_completed INTEGER;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
  IF NOT public.is_verified() THEN
    RETURN jsonb_build_object('applied', false, 'reason', 'not_verified');
  END IF;
  IF p_code IS NULL OR TRIM(p_code) = '' THEN
    RETURN jsonb_build_object('applied', false, 'reason', 'empty');
  END IF;

  -- Only one referral per referred user, ever.
  IF EXISTS (SELECT 1 FROM public.referrals WHERE referred_id = me) THEN
    RETURN jsonb_build_object('applied', false, 'reason', 'already_referred');
  END IF;

  -- Attribution must happen while the account is still new (no completed deals).
  SELECT COUNT(*) INTO my_completed FROM public.deals
  WHERE (merchant_id = me OR customer_id = me) AND status = 'completed';
  IF my_completed > 0 THEN
    RETURN jsonb_build_object('applied', false, 'reason', 'not_new');
  END IF;

  SELECT id INTO ref_user FROM public.profiles
  WHERE referral_code = upper(TRIM(p_code)) LIMIT 1;
  IF ref_user IS NULL THEN RETURN jsonb_build_object('applied', false, 'reason', 'invalid_code'); END IF;
  IF ref_user = me THEN RETURN jsonb_build_object('applied', false, 'reason', 'self_referral'); END IF;

  INSERT INTO public.referrals (referrer_id, referred_id, code_used, status)
  VALUES (ref_user, me, upper(TRIM(p_code)), 'pending')
  ON CONFLICT (referred_id) DO NOTHING;

  INSERT INTO public.notifications (user_id, title, message, type, link)
  VALUES (ref_user, 'New referral joined',
    'Someone joined using your referral link. You earn a reward when they complete their first deal.', 'info', '/refer');

  RETURN jsonb_build_object('applied', true);
END;
$$;

-- Ensure the current user has a referral code (lazy backstop) and return summary.
CREATE OR REPLACE FUNCTION public.get_my_referral_summary()
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE me UUID := auth.uid(); my_code TEXT; cfg public.referral_config;
  total INTEGER; pending INTEGER; rewarded INTEGER; earnings DECIMAL(10,2);
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
  SELECT referral_code INTO my_code FROM public.profiles WHERE id = me;
  SELECT * INTO cfg FROM public.referral_config WHERE id = true;

  SELECT COUNT(*),
         COUNT(*) FILTER (WHERE status = 'pending'),
         COUNT(*) FILTER (WHERE status = 'rewarded'),
         COALESCE(SUM(referrer_reward_amount) FILTER (WHERE status = 'rewarded'), 0)
  INTO total, pending, rewarded, earnings
  FROM public.referrals WHERE referrer_id = me;

  RETURN jsonb_build_object(
    'code', my_code,
    'total', total, 'pending', pending, 'rewarded', rewarded, 'earnings', earnings,
    'enabled', COALESCE(cfg.enabled, false),
    'referrer_reward', cfg.referrer_reward, 'welcome_bonus', cfg.welcome_bonus,
    'min_qualifying_amount', cfg.min_qualifying_amount
  );
END;
$$;

-- Referral history for the current referrer (referred user's masked name + status).
DROP FUNCTION IF EXISTS public.list_my_referrals();
CREATE OR REPLACE FUNCTION public.list_my_referrals()
RETURNS TABLE (
  id UUID, referred_name TEXT, status TEXT, reward_amount DECIMAL(10,2),
  created_at TIMESTAMPTZ, qualified_at TIMESTAMPTZ
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
  RETURN QUERY
  SELECT r.id, split_part(p.full_name, ' ', 1) AS referred_name, r.status,
         r.referrer_reward_amount, r.created_at, r.qualified_at
  FROM public.referrals r JOIN public.profiles p ON p.id = r.referred_id
  WHERE r.referrer_id = auth.uid()
  ORDER BY r.created_at DESC;
END;
$$;

-- Admin: update reward config.
CREATE OR REPLACE FUNCTION public.admin_update_referral_config(
  p_referrer_reward DECIMAL, p_welcome_bonus DECIMAL, p_min_qualifying_amount DECIMAL,
  p_max_rewards_per_referrer INTEGER, p_enabled BOOLEAN
) RETURNS public.referral_config LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cfg public.referral_config;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Only admins can update referral config'; END IF;
  IF p_referrer_reward < 0 OR p_welcome_bonus < 0 OR p_min_qualifying_amount < 0 THEN
    RAISE EXCEPTION 'Amounts cannot be negative';
  END IF;
  UPDATE public.referral_config
  SET referrer_reward = p_referrer_reward, welcome_bonus = p_welcome_bonus,
      min_qualifying_amount = p_min_qualifying_amount,
      max_rewards_per_referrer = p_max_rewards_per_referrer,
      enabled = COALESCE(p_enabled, true), updated_at = now()
  WHERE id = true RETURNING * INTO cfg;
  RETURN cfg;
END;
$$;

-- Admin: set the public support WhatsApp number shown on deal cards.
CREATE OR REPLACE FUNCTION public.admin_update_support_number(p_number TEXT)
RETURNS public.app_settings LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE row public.app_settings;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Only admins can update settings'; END IF;
  UPDATE public.app_settings
  SET support_whatsapp = NULLIF(TRIM(COALESCE(p_number, '')), ''), updated_at = now()
  WHERE id = true RETURNING * INTO row;
  RETURN row;
END;
$$;

-- ---------------------------------------------------------------------------
-- Admin: reservation visibility, overrides, and config
-- ---------------------------------------------------------------------------
-- Reservation history (reserved / fulfilled / released / expired / blocked / admin_reopened).
DROP FUNCTION IF EXISTS public.admin_list_reservation_events(int);
CREATE OR REPLACE FUNCTION public.admin_list_reservation_events(p_limit INT DEFAULT 200)
RETURNS TABLE (
  id UUID, deal_id UUID, product_name TEXT, user_id UUID, user_name TEXT, user_email TEXT,
  event_type TEXT, within_grace BOOLEAN, reserved_at TIMESTAMPTZ, reserved_until TIMESTAMPTZ,
  detail TEXT, voided BOOLEAN, created_at TIMESTAMPTZ
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Only admins can view reservation history'; END IF;
  RETURN QUERY
  SELECT e.id, e.deal_id, d.product_name, e.user_id, p.full_name, p.email,
         e.event_type, e.within_grace, e.reserved_at, e.reserved_until, e.detail, e.voided, e.created_at
  FROM public.reservation_events e
  LEFT JOIN public.deals d ON d.id = e.deal_id
  LEFT JOIN public.profiles p ON p.id = e.user_id
  ORDER BY e.created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 200), 1000));
END;
$$;

-- Per-cardholder reliability (strikes, cooldowns, releases, review flags).
DROP FUNCTION IF EXISTS public.admin_list_cardholder_reliability();
CREATE OR REPLACE FUNCTION public.admin_list_cardholder_reliability()
RETURNS TABLE (
  user_id UUID, full_name TEXT, email TEXT, phone TEXT,
  total_expiries INT, total_releases INT, strikes_30d INT,
  acceptance_blocked_until TIMESTAMPTZ, last_expiry_at TIMESTAMPTZ, under_review BOOLEAN,
  admin_note TEXT, server_now TIMESTAMPTZ
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Only admins can view reliability'; END IF;
  RETURN QUERY
  SELECT r.user_id, p.full_name, p.email, p.phone,
         r.total_expiries, r.total_releases, r.strikes_30d,
         r.acceptance_blocked_until, r.last_expiry_at, r.under_review, r.admin_note, now()
  FROM public.cardholder_reliability r
  LEFT JOIN public.profiles p ON p.id = r.user_id
  ORDER BY (r.acceptance_blocked_until IS NOT NULL AND r.acceptance_blocked_until > now()) DESC,
           r.under_review DESC, r.strikes_30d DESC, r.updated_at DESC;
END;
$$;

-- Admin override: lift a cardholder's cooldown / clear strikes / review flag.
CREATE OR REPLACE FUNCTION public.admin_reset_cardholder(p_user_id UUID, p_note TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Only admins can reset reliability'; END IF;
  INSERT INTO public.cardholder_reliability (user_id, acceptance_blocked_until, strikes_30d, under_review, admin_note, updated_at)
  VALUES (p_user_id, NULL, 0, false, NULLIF(TRIM(COALESCE(p_note, '')), ''), now())
  ON CONFLICT (user_id) DO UPDATE SET
    acceptance_blocked_until = NULL, strikes_30d = 0, under_review = false,
    admin_note = NULLIF(TRIM(COALESCE(p_note, '')), ''), updated_at = now();

  -- Forgive past strikes so the NEXT miss escalates from the warning tier again
  -- (apply_reliability_strike recounts events — without this, one new miss would
  -- instantly re-impose the old tier). Audit rows are kept, only marked voided.
  UPDATE public.reservation_events
  SET voided = true, detail = COALESCE(detail || ' ', '') || '[forgiven by admin]'
  WHERE user_id = p_user_id AND voided = false
    AND (event_type = 'expired' OR (event_type = 'released' AND within_grace = false));
  INSERT INTO public.notifications (user_id, title, message, type, link)
  VALUES (p_user_id, 'Cooldown lifted', 'An admin cleared your acceptance cooldown. You can accept deals again.', 'success', '/deals');
END;
$$;

-- Admin override: force-reopen a reservation (e.g. disputed) WITHOUT a strike.
CREATE OR REPLACE FUNCTION public.admin_reopen_reservation(p_deal_id UUID)
RETURNS public.deals LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d public.deals; reopened public.deals;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Only admins can reopen reservations'; END IF;
  SELECT * INTO d FROM public.deals WHERE id = p_deal_id FOR UPDATE;
  IF d IS NULL THEN RAISE EXCEPTION 'Deal not found'; END IF;
  IF d.status != 'accepted' THEN RAISE EXCEPTION 'Only a reserved (accepted, no order) deal can be reopened'; END IF;
  IF EXISTS (SELECT 1 FROM public.orders WHERE deal_id = p_deal_id) THEN
    RAISE EXCEPTION 'An order was already placed; use the normal lifecycle instead';
  END IF;

  UPDATE public.deals
  SET status = 'approved', customer_id = NULL, reserved_at = NULL, reserved_until = NULL, updated_at = now()
  WHERE id = p_deal_id AND status = 'accepted'
  RETURNING * INTO reopened;

  INSERT INTO public.reservation_events (deal_id, user_id, event_type, reserved_at, reserved_until, detail)
  VALUES (p_deal_id, d.customer_id, 'admin_reopened', d.reserved_at, d.reserved_until, 'Admin reopened the reservation (no strike)');

  INSERT INTO public.notifications (user_id, title, message, type, link)
  VALUES (d.customer_id, 'Reservation reopened by admin',
    'An admin released your reservation on "' || d.product_name || '". No strike was recorded.', 'info', '/deals/' || p_deal_id);

  RETURN reopened;
END;
$$;

-- Admin: tune the reservation rules.
CREATE OR REPLACE FUNCTION public.admin_update_reservation_config(
  p_enabled BOOLEAN, p_hold_seconds INT, p_release_grace_seconds INT, p_max_accepts_per_deal INT,
  p_strike_window_days INT, p_cooldown2_seconds INT, p_cooldown3_seconds INT, p_cooldown_abuse_seconds INT)
RETURNS public.reservation_config LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cfg public.reservation_config;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Only admins can update reservation config'; END IF;
  UPDATE public.reservation_config SET
    enabled = COALESCE(p_enabled, enabled),
    hold_seconds = GREATEST(60, COALESCE(p_hold_seconds, hold_seconds)),
    release_grace_seconds = GREATEST(0, COALESCE(p_release_grace_seconds, release_grace_seconds)),
    max_accepts_per_deal = GREATEST(1, COALESCE(p_max_accepts_per_deal, max_accepts_per_deal)),
    strike_window_days = GREATEST(1, COALESCE(p_strike_window_days, strike_window_days)),
    cooldown2_seconds = GREATEST(0, COALESCE(p_cooldown2_seconds, cooldown2_seconds)),
    cooldown3_seconds = GREATEST(0, COALESCE(p_cooldown3_seconds, cooldown3_seconds)),
    cooldown_abuse_seconds = GREATEST(0, COALESCE(p_cooldown_abuse_seconds, cooldown_abuse_seconds)),
    updated_at = now()
  WHERE id = true RETURNING * INTO cfg;
  RETURN cfg;
END;
$$;

-- Admin: list all referrals with both parties' details for investigation.
DROP FUNCTION IF EXISTS public.admin_list_referrals(text);
CREATE OR REPLACE FUNCTION public.admin_list_referrals(p_status TEXT DEFAULT NULL)
RETURNS TABLE (
  id UUID, referrer_name TEXT, referrer_email TEXT, referred_name TEXT, referred_email TEXT,
  code_used TEXT, status TEXT, referrer_reward_amount DECIMAL(10,2), referred_reward_amount DECIMAL(10,2),
  qualifying_deal_id UUID, admin_notes TEXT, created_at TIMESTAMPTZ, qualified_at TIMESTAMPTZ
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Only admins can list referrals'; END IF;
  RETURN QUERY
  SELECT r.id, rp.full_name, rp.email, dp.full_name, dp.email, r.code_used, r.status,
         r.referrer_reward_amount, r.referred_reward_amount, r.qualifying_deal_id, r.admin_notes,
         r.created_at, r.qualified_at
  FROM public.referrals r
  JOIN public.profiles rp ON rp.id = r.referrer_id
  JOIN public.profiles dp ON dp.id = r.referred_id
  WHERE p_status IS NULL OR r.status = p_status
  ORDER BY r.created_at DESC;
END;
$$;

-- Admin: void a pending referral, or reverse (claw back) a rewarded one.
CREATE OR REPLACE FUNCTION public.admin_void_referral(p_id UUID, p_notes TEXT DEFAULT NULL)
RETURNS public.referrals LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ref public.referrals;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Only admins can void referrals'; END IF;
  SELECT * INTO ref FROM public.referrals WHERE id = p_id FOR UPDATE;
  IF ref IS NULL THEN RAISE EXCEPTION 'Referral not found'; END IF;

  IF ref.status = 'rewarded' THEN
    -- Claw back credited rewards (best effort — clamp at zero via wallets CHECK path).
    IF COALESCE(ref.referrer_reward_amount, 0) > 0 THEN
      UPDATE public.wallets SET balance = GREATEST(balance - ref.referrer_reward_amount, 0), updated_at = now()
      WHERE user_id = ref.referrer_id;
      INSERT INTO public.payments (from_user_id, to_user_id, amount, payment_type, status, description)
      VALUES (ref.referrer_id, NULL, ref.referrer_reward_amount, 'referral_reversal', 'refunded', 'Referral reward reversed by admin');
    END IF;
    IF COALESCE(ref.referred_reward_amount, 0) > 0 THEN
      UPDATE public.wallets SET balance = GREATEST(balance - ref.referred_reward_amount, 0), updated_at = now()
      WHERE user_id = ref.referred_id;
      INSERT INTO public.payments (from_user_id, to_user_id, amount, payment_type, status, description)
      VALUES (ref.referred_id, NULL, ref.referred_reward_amount, 'referral_reversal', 'refunded', 'Welcome bonus reversed by admin');
    END IF;
    UPDATE public.referrals SET status = 'reversed', admin_notes = p_notes, reversed_at = now()
    WHERE id = p_id RETURNING * INTO ref;
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (ref.referrer_id, 'Referral reversed', COALESCE(p_notes, 'A referral reward was reversed by admin.'), 'error', '/refer');
  ELSE
    UPDATE public.referrals SET status = 'voided', admin_notes = p_notes, reversed_at = now()
    WHERE id = p_id RETURNING * INTO ref;
  END IF;

  RETURN ref;
END;
$$;

-- ---------------------------------------------------------------------------
-- Storage buckets for KYC documents and order screenshots
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('kyc-documents', 'kyc-documents', false, 5242880,
        ARRAY['image/png','image/jpeg','image/webp','application/pdf'])
ON CONFLICT (id) DO UPDATE
  SET public = false, file_size_limit = 5242880,
      allowed_mime_types = ARRAY['image/png','image/jpeg','image/webp','application/pdf'];

-- Order screenshots are PRIVATE (they contain names/addresses/order details).
-- Served via short-lived signed URLs to authenticated users only.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('order-screenshots', 'order-screenshots', false, 5242880,
        ARRAY['image/png','image/jpeg','image/webp'])
ON CONFLICT (id) DO UPDATE
  SET public = false, file_size_limit = 5242880,
      allowed_mime_types = ARRAY['image/png','image/jpeg','image/webp'];

-- KYC docs: private. Each user manages files under a folder named after their uid.
DROP POLICY IF EXISTS "Users manage own kyc docs" ON storage.objects;
CREATE POLICY "Users manage own kyc docs" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'kyc-documents' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'kyc-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Admins read kyc docs" ON storage.objects;
CREATE POLICY "Admins read kyc docs" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'kyc-documents' AND public.is_admin(auth.uid()));

-- Order screenshots: private. Authenticated users read via signed URLs (paths are
-- unguessable and links are short-lived); uploads restricted to the user's folder.
DROP POLICY IF EXISTS "Public read order screenshots" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated read order screenshots" ON storage.objects;
CREATE POLICY "Authenticated read order screenshots" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'order-screenshots');

DROP POLICY IF EXISTS "Users upload own order screenshots" ON storage.objects;
CREATE POLICY "Users upload own order screenshots" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'order-screenshots' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users update own order screenshots" ON storage.objects;
CREATE POLICY "Users update own order screenshots" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'order-screenshots' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------------
-- Seed: support/admin contact numbers (REPLACE these with your real numbers)
-- ---------------------------------------------------------------------------
INSERT INTO public.admin_numbers (phone_number, is_active) VALUES
  ('+91 98765 43210', true),
  ('+91 98765 43211', true),
  ('+91 98765 43212', true),
  ('+91 98765 43213', true),
  ('+91 98765 43214', true)
ON CONFLICT (phone_number) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Backfill referral codes for any existing users created before this feature.
-- Sequential so each generated code is unique (visible within the transaction).
-- ---------------------------------------------------------------------------
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.profiles WHERE referral_code IS NULL LOOP
    UPDATE public.profiles SET referral_code = public.generate_referral_code() WHERE id = r.id;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Reload PostgREST schema cache so new functions are callable immediately
-- ---------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';

-- Done. Next: run supabase/scripts/grant-admin.sql (edit the email) to make
-- your account an admin, then sign out / sign in in the app.
