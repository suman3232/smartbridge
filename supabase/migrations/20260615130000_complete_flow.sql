-- Complete OfferBridge flow: admin visibility, privacy, KYC review, withdrawals

-- Admins can view all deals (pending tab, full oversight)
DROP POLICY IF EXISTS "Admins can view all deals" ON public.deals;
CREATE POLICY "Admins can view all deals" ON public.deals
  FOR SELECT USING (public.is_admin(auth.uid()));

-- Admins can manage KYC
DROP POLICY IF EXISTS "Admins can view all KYC" ON public.kycs;
CREATE POLICY "Admins can view all KYC" ON public.kycs
  FOR SELECT USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can update KYC" ON public.kycs;
CREATE POLICY "Admins can update KYC" ON public.kycs
  FOR UPDATE USING (public.is_admin(auth.uid()));

-- Allow resubmit after rejection
DROP POLICY IF EXISTS "Users can insert their own KYC" ON public.kycs;
CREATE POLICY "Users can insert their own KYC" ON public.kycs
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND NOT EXISTS (
      SELECT 1 FROM public.kycs k
      WHERE k.user_id = auth.uid()
        AND k.status IN ('pending', 'approved')
    )
  );

-- One order per deal
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_deal_id_key;
ALTER TABLE public.orders ADD CONSTRAINT orders_deal_id_key UNIQUE (deal_id);

-- Withdrawal requests (payout to bank after KYC)
CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'rejected')),
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own withdrawals" ON public.withdrawal_requests
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

CREATE POLICY "Users can request withdrawals" ON public.withdrawal_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can update withdrawals" ON public.withdrawal_requests
  FOR UPDATE USING (public.is_admin(auth.uid()));

CREATE TRIGGER update_withdrawal_requests_updated_at
  BEFORE UPDATE ON public.withdrawal_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Browse open deals without exposing shopper delivery address
CREATE OR REPLACE FUNCTION public.list_open_deals()
RETURNS TABLE (
  id UUID,
  merchant_id UUID,
  product_name TEXT,
  product_link TEXT,
  original_price DECIMAL(10,2),
  card_offer_price DECIMAL(10,2),
  expected_buy_price DECIMAL(10,2),
  commission_amount DECIMAL(10,2),
  required_card TEXT,
  admin_contact_number TEXT,
  status TEXT,
  customer_id UUID,
  advance_amount DECIMAL(10,2),
  remaining_amount DECIMAL(10,2),
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    d.id,
    d.merchant_id,
    d.product_name,
    d.product_link,
    d.original_price,
    d.card_offer_price,
    d.expected_buy_price,
    d.commission_amount,
    d.required_card,
    d.admin_contact_number,
    d.status,
    d.customer_id,
    d.advance_amount,
    d.remaining_amount,
    d.created_at,
    d.updated_at
  FROM public.deals d
  WHERE d.status = 'approved'
    AND d.customer_id IS NULL
  ORDER BY d.created_at DESC;
$$;

-- Address preview only when card holder is about to accept
CREATE OR REPLACE FUNCTION public.get_deal_accept_preview(p_deal_id UUID)
RETURNS TABLE (
  id UUID,
  product_name TEXT,
  required_card TEXT,
  card_offer_price DECIMAL(10,2),
  commission_amount DECIMAL(10,2),
  delivery_address TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to accept deals';
  END IF;

  RETURN QUERY
  SELECT
    d.id,
    d.product_name,
    d.required_card,
    d.card_offer_price,
    d.commission_amount,
    d.delivery_address
  FROM public.deals d
  WHERE d.id = p_deal_id
    AND d.status = 'approved'
    AND d.customer_id IS NULL
    AND d.merchant_id != auth.uid()
    AND d.delivery_address IS NOT NULL
    AND TRIM(d.delivery_address) != '';
END;
$$;

-- Prevent duplicate order placement
CREATE OR REPLACE FUNCTION public.place_deal_order(
  p_deal_id UUID,
  p_tracking_id TEXT DEFAULT NULL,
  p_order_screenshot_url TEXT DEFAULT NULL
)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deal_record public.deals;
  new_order public.orders;
BEGIN
  SELECT * INTO deal_record FROM public.deals WHERE id = p_deal_id;

  IF deal_record IS NULL THEN
    RAISE EXCEPTION 'Deal not found';
  END IF;

  IF deal_record.customer_id != auth.uid() THEN
    RAISE EXCEPTION 'Only the card holder who accepted this deal can place the order';
  END IF;

  IF deal_record.status != 'accepted' THEN
    RAISE EXCEPTION 'Deal must be accepted before placing an order';
  END IF;

  IF EXISTS (SELECT 1 FROM public.orders WHERE deal_id = p_deal_id) THEN
    RAISE EXCEPTION 'Order already placed for this deal';
  END IF;

  INSERT INTO public.orders (deal_id, customer_id, tracking_id, order_screenshot_url, status)
  VALUES (p_deal_id, auth.uid(), NULLIF(TRIM(p_tracking_id), ''), NULLIF(TRIM(p_order_screenshot_url), ''), 'placed')
  RETURNING * INTO new_order;

  UPDATE public.deals
  SET status = 'in_progress', updated_at = now()
  WHERE id = p_deal_id;

  INSERT INTO public.notifications (user_id, title, message, type, link)
  VALUES (
    deal_record.merchant_id,
    'Order Placed',
    'The card holder placed the order for "' || deal_record.product_name || '".',
    'info',
    '/deals/' || p_deal_id
  );

  RETURN new_order;
END;
$$;

-- Ensure wallet exists when completing deal
CREATE OR REPLACE FUNCTION public.complete_deal(p_deal_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deal_record public.deals;
  payout_amount DECIMAL(10,2);
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can complete deals';
  END IF;

  SELECT * INTO deal_record FROM public.deals WHERE id = p_deal_id;

  IF deal_record IS NULL OR deal_record.status != 'in_progress' THEN
    RAISE EXCEPTION 'Deal not found or not in progress';
  END IF;

  payout_amount := deal_record.card_offer_price + deal_record.commission_amount;

  UPDATE public.deals
  SET status = 'completed', updated_at = now()
  WHERE id = p_deal_id;

  INSERT INTO public.wallets (user_id, balance, locked_amount)
  VALUES (deal_record.customer_id, payout_amount, 0)
  ON CONFLICT (user_id) DO UPDATE
  SET balance = public.wallets.balance + EXCLUDED.balance,
      updated_at = now();

  INSERT INTO public.payments (from_user_id, to_user_id, deal_id, amount, payment_type, status, description)
  VALUES (
    deal_record.merchant_id,
    deal_record.customer_id,
    p_deal_id,
    deal_record.card_offer_price,
    'reimbursement',
    'released',
    'Reimbursement for order placed on ' || deal_record.product_name
  );

  INSERT INTO public.payments (from_user_id, to_user_id, deal_id, amount, payment_type, status, description)
  VALUES (
    deal_record.merchant_id,
    deal_record.customer_id,
    p_deal_id,
    deal_record.commission_amount,
    'commission',
    'released',
    'Commission for deal "' || deal_record.product_name || '"'
  );

  INSERT INTO public.notifications (user_id, title, message, type, link)
  VALUES (
    deal_record.customer_id,
    'Payment Credited',
    '₹' || payout_amount || ' (reimbursement + commission) credited to your wallet for "' || deal_record.product_name || '".',
    'success',
    '/wallet'
  );

  INSERT INTO public.notifications (user_id, title, message, type, link)
  VALUES (
    deal_record.merchant_id,
    'Deal Completed',
    'Your deal "' || deal_record.product_name || '" is complete.',
    'success',
    '/deals/' || p_deal_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_kyc(p_kyc_id UUID, p_notes TEXT DEFAULT NULL)
RETURNS public.kycs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_kyc public.kycs;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can approve KYC';
  END IF;

  UPDATE public.kycs
  SET status = 'approved',
      admin_notes = p_notes,
      updated_at = now()
  WHERE id = p_kyc_id AND status = 'pending'
  RETURNING * INTO updated_kyc;

  IF updated_kyc IS NULL THEN
    RAISE EXCEPTION 'KYC not found or not pending';
  END IF;

  INSERT INTO public.notifications (user_id, title, message, type, link)
  VALUES (
    updated_kyc.user_id,
    'KYC Approved',
    'Your identity is verified. You can now request withdrawals from your wallet.',
    'success',
    '/wallet'
  );

  RETURN updated_kyc;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_kyc(p_kyc_id UUID, p_notes TEXT DEFAULT NULL)
RETURNS public.kycs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_kyc public.kycs;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can reject KYC';
  END IF;

  UPDATE public.kycs
  SET status = 'rejected',
      admin_notes = COALESCE(p_notes, 'Please resubmit with correct details.'),
      updated_at = now()
  WHERE id = p_kyc_id AND status = 'pending'
  RETURNING * INTO updated_kyc;

  IF updated_kyc IS NULL THEN
    RAISE EXCEPTION 'KYC not found or not pending';
  END IF;

  INSERT INTO public.notifications (user_id, title, message, type, link)
  VALUES (
    updated_kyc.user_id,
    'KYC Rejected',
    COALESCE(p_notes, 'Please resubmit your KYC with correct bank details.'),
    'destructive',
    '/kyc'
  );

  RETURN updated_kyc;
END;
$$;

CREATE OR REPLACE FUNCTION public.request_withdrawal(p_amount DECIMAL)
RETURNS public.withdrawal_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_wallet public.wallets;
  approved_kyc public.kycs;
  new_request public.withdrawal_requests;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Withdrawal amount must be greater than zero';
  END IF;

  SELECT * INTO approved_kyc
  FROM public.kycs
  WHERE user_id = auth.uid() AND status = 'approved'
  LIMIT 1;

  IF approved_kyc IS NULL THEN
    RAISE EXCEPTION 'Approved KYC is required before withdrawal';
  END IF;

  SELECT * INTO user_wallet FROM public.wallets WHERE user_id = auth.uid();

  IF user_wallet IS NULL OR user_wallet.balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient wallet balance';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.withdrawal_requests
    WHERE user_id = auth.uid() AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'You already have a pending withdrawal request';
  END IF;

  UPDATE public.wallets
  SET balance = balance - p_amount,
      locked_amount = locked_amount + p_amount,
      updated_at = now()
  WHERE user_id = auth.uid();

  INSERT INTO public.withdrawal_requests (user_id, amount, status)
  VALUES (auth.uid(), p_amount, 'pending')
  RETURNING * INTO new_request;

  INSERT INTO public.notifications (user_id, title, message, type, link)
  VALUES (
    auth.uid(),
    'Withdrawal requested',
    '₹' || p_amount || ' withdrawal is pending admin transfer to your bank account.',
    'info',
    '/wallet'
  );

  RETURN new_request;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_withdrawal(p_request_id UUID)
RETURNS public.withdrawal_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req public.withdrawal_requests;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can complete withdrawals';
  END IF;

  SELECT * INTO req FROM public.withdrawal_requests WHERE id = p_request_id;

  IF req IS NULL OR req.status != 'pending' THEN
    RAISE EXCEPTION 'Withdrawal request not found or not pending';
  END IF;

  UPDATE public.withdrawal_requests
  SET status = 'completed', updated_at = now()
  WHERE id = p_request_id
  RETURNING * INTO req;

  UPDATE public.wallets
  SET locked_amount = GREATEST(locked_amount - req.amount, 0),
      updated_at = now()
  WHERE user_id = req.user_id;

  INSERT INTO public.payments (from_user_id, to_user_id, amount, payment_type, status, description)
  VALUES (
    req.user_id,
    req.user_id,
    req.amount,
    'withdrawal',
    'released',
    'Withdrawal transferred to bank account'
  );

  INSERT INTO public.notifications (user_id, title, message, type, link)
  VALUES (
    req.user_id,
    'Withdrawal completed',
    '₹' || req.amount || ' has been transferred to your bank account.',
    'success',
    '/wallet'
  );

  RETURN req;
END;
$$;
