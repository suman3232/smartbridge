-- Yaper-aligned deal flow: shopper provides address, card holder places order, admin completes payout

CREATE OR REPLACE FUNCTION public.accept_deal(p_deal_id UUID, p_delivery_address TEXT DEFAULT NULL)
RETURNS public.deals
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_deal public.deals;
  resolved_address TEXT;
BEGIN
  SELECT COALESCE(NULLIF(TRIM(p_delivery_address), ''), delivery_address)
  INTO resolved_address
  FROM public.deals
  WHERE id = p_deal_id;

  IF resolved_address IS NULL OR TRIM(resolved_address) = '' THEN
    RAISE EXCEPTION 'Delivery address is required on the deal before acceptance';
  END IF;

  UPDATE public.deals
  SET status = 'accepted',
      customer_id = auth.uid(),
      delivery_address = resolved_address,
      updated_at = now()
  WHERE id = p_deal_id
    AND status = 'approved'
    AND customer_id IS NULL
    AND merchant_id != auth.uid()
  RETURNING * INTO updated_deal;

  IF updated_deal IS NULL THEN
    RAISE EXCEPTION 'Deal not found, not approved, already accepted, or you cannot accept your own deal';
  END IF;

  INSERT INTO public.notifications (user_id, title, message, type, link)
  VALUES (
    updated_deal.merchant_id,
    'Deal Accepted',
    'A card holder accepted your deal for "' || updated_deal.product_name || '".',
    'info',
    '/deals/' || p_deal_id
  );

  INSERT INTO public.notifications (user_id, title, message, type, link)
  VALUES (
    updated_deal.customer_id,
    'Deal Accepted',
    'Place the order on the e-commerce site using your card. Ship to the shopper address shown in the deal.',
    'info',
    '/deals/' || p_deal_id
  );

  RETURN updated_deal;
END;
$$;

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

  UPDATE public.wallets
  SET balance = balance + payout_amount, updated_at = now()
  WHERE user_id = deal_record.customer_id;

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
