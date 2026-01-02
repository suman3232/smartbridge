-- Create otp_records table for OTP verification flow
CREATE TABLE IF NOT EXISTS public.otp_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  otp_code TEXT NOT NULL,
  submitted_by UUID NOT NULL REFERENCES public.profiles(id),
  verified_by UUID REFERENCES public.profiles(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  verified_at TIMESTAMP WITH TIME ZONE,
  notes TEXT
);

-- Enable RLS
ALTER TABLE public.otp_records ENABLE ROW LEVEL SECURITY;

-- RLS policies for otp_records
CREATE POLICY "Users can view OTPs for their orders"
ON public.otp_records FOR SELECT
USING (
  submitted_by = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.orders o
    JOIN public.deals d ON o.deal_id = d.id
    WHERE o.id = otp_records.order_id AND d.merchant_id = auth.uid()
  ) OR
  public.is_admin(auth.uid())
);

CREATE POLICY "Customers can submit OTPs"
ON public.otp_records FOR INSERT
WITH CHECK (auth.uid() = submitted_by);

CREATE POLICY "Admins can update OTP status"
ON public.otp_records FOR UPDATE
USING (public.is_admin(auth.uid()));

-- Create round-robin function for admin number assignment
CREATE OR REPLACE FUNCTION public.get_next_admin_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  selected_number TEXT;
  selected_id UUID;
BEGIN
  -- Select the admin number with lowest assignment count that is active
  -- In case of tie, pick the one least recently assigned
  SELECT id, phone_number INTO selected_id, selected_number
  FROM public.admin_numbers
  WHERE is_active = true
  ORDER BY assignment_count ASC NULLS FIRST, last_assigned_at ASC NULLS FIRST
  LIMIT 1;
  
  IF selected_id IS NULL THEN
    RAISE EXCEPTION 'No active admin numbers available';
  END IF;
  
  -- Update the assignment count and timestamp
  UPDATE public.admin_numbers
  SET assignment_count = COALESCE(assignment_count, 0) + 1,
      last_assigned_at = now()
  WHERE id = selected_id;
  
  RETURN selected_number;
END;
$$;

-- Create function to approve deal with admin number assignment
CREATE OR REPLACE FUNCTION public.approve_deal(deal_id UUID)
RETURNS public.deals
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_number TEXT;
  updated_deal public.deals;
BEGIN
  -- Check if user is admin
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can approve deals';
  END IF;
  
  -- Get next admin number using round-robin
  admin_number := public.get_next_admin_number();
  
  -- Update the deal with approved status and assigned admin number
  UPDATE public.deals
  SET status = 'approved',
      admin_contact_number = admin_number,
      updated_at = now()
  WHERE id = deal_id AND status = 'pending'
  RETURNING * INTO updated_deal;
  
  IF updated_deal IS NULL THEN
    RAISE EXCEPTION 'Deal not found or not in pending status';
  END IF;
  
  -- Create notification for merchant
  INSERT INTO public.notifications (user_id, title, message, type, link)
  VALUES (
    updated_deal.merchant_id,
    'Deal Approved!',
    'Your deal for "' || updated_deal.product_name || '" has been approved and is now live.',
    'success',
    '/deals/' || deal_id
  );
  
  RETURN updated_deal;
END;
$$;

-- Create function to reject a deal
CREATE OR REPLACE FUNCTION public.reject_deal(deal_id UUID, rejection_notes TEXT DEFAULT NULL)
RETURNS public.deals
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_deal public.deals;
BEGIN
  -- Check if user is admin
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can reject deals';
  END IF;
  
  UPDATE public.deals
  SET status = 'rejected',
      admin_notes = rejection_notes,
      updated_at = now()
  WHERE id = deal_id AND status = 'pending'
  RETURNING * INTO updated_deal;
  
  IF updated_deal IS NULL THEN
    RAISE EXCEPTION 'Deal not found or not in pending status';
  END IF;
  
  -- Create notification for merchant
  INSERT INTO public.notifications (user_id, title, message, type, link)
  VALUES (
    updated_deal.merchant_id,
    'Deal Rejected',
    'Your deal for "' || updated_deal.product_name || '" was not approved. ' || COALESCE(rejection_notes, ''),
    'error',
    '/deals/' || deal_id
  );
  
  RETURN updated_deal;
END;
$$;

-- Create function for customer to accept a deal
CREATE OR REPLACE FUNCTION public.accept_deal(p_deal_id UUID, p_delivery_address TEXT)
RETURNS public.deals
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_deal public.deals;
BEGIN
  -- Update the deal with customer info
  UPDATE public.deals
  SET status = 'accepted',
      customer_id = auth.uid(),
      delivery_address = p_delivery_address,
      updated_at = now()
  WHERE id = p_deal_id AND status = 'approved' AND customer_id IS NULL
  RETURNING * INTO updated_deal;
  
  IF updated_deal IS NULL THEN
    RAISE EXCEPTION 'Deal not found, not approved, or already accepted';
  END IF;
  
  -- Create notification for merchant
  INSERT INTO public.notifications (user_id, title, message, type, link)
  VALUES (
    updated_deal.merchant_id,
    'Deal Accepted!',
    'A customer has accepted your deal for "' || updated_deal.product_name || '".',
    'info',
    '/deals/' || p_deal_id
  );
  
  RETURN updated_deal;
END;
$$;

-- Create function to process escrow release on delivery confirmation
CREATE OR REPLACE FUNCTION public.complete_deal_escrow(p_deal_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deal_record public.deals;
  customer_wallet_id UUID;
  merchant_wallet_id UUID;
BEGIN
  -- Check if user is admin
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can complete deals';
  END IF;
  
  -- Get the deal
  SELECT * INTO deal_record FROM public.deals WHERE id = p_deal_id;
  
  IF deal_record IS NULL OR deal_record.status != 'in_progress' THEN
    RAISE EXCEPTION 'Deal not found or not in progress';
  END IF;
  
  -- Get wallet IDs
  SELECT id INTO customer_wallet_id FROM public.wallets WHERE user_id = deal_record.customer_id;
  SELECT id INTO merchant_wallet_id FROM public.wallets WHERE user_id = deal_record.merchant_id;
  
  -- Update deal status to completed
  UPDATE public.deals SET status = 'completed', updated_at = now() WHERE id = p_deal_id;
  
  -- Release locked funds from merchant wallet
  UPDATE public.wallets 
  SET locked_amount = locked_amount - (deal_record.advance_amount + deal_record.remaining_amount),
      updated_at = now()
  WHERE user_id = deal_record.merchant_id;
  
  -- Credit commission to customer
  UPDATE public.wallets
  SET balance = balance + deal_record.commission_amount,
      updated_at = now()
  WHERE user_id = deal_record.customer_id;
  
  -- Record payment for commission
  INSERT INTO public.payments (from_user_id, to_user_id, deal_id, amount, payment_type, status, description)
  VALUES (deal_record.merchant_id, deal_record.customer_id, p_deal_id, deal_record.commission_amount, 'commission', 'released', 'Commission for deal completion');
  
  -- Notify customer
  INSERT INTO public.notifications (user_id, title, message, type, link)
  VALUES (
    deal_record.customer_id,
    'Payment Released!',
    'You have received ₹' || deal_record.commission_amount || ' commission for deal "' || deal_record.product_name || '".',
    'success',
    '/wallet'
  );
  
  -- Notify merchant
  INSERT INTO public.notifications (user_id, title, message, type, link)
  VALUES (
    deal_record.merchant_id,
    'Deal Completed',
    'Deal "' || deal_record.product_name || '" has been completed successfully.',
    'success',
    '/deals/' || p_deal_id
  );
END;
$$;

-- Allow admins to insert notifications
CREATE POLICY "System can insert notifications"
ON public.notifications FOR INSERT
WITH CHECK (true);

-- Allow admins to manage payments
CREATE POLICY "Admins can manage payments"
ON public.payments FOR ALL
USING (public.is_admin(auth.uid()));

-- Allow merchants to insert payments (for escrow deposits)
CREATE POLICY "Users can insert payments"
ON public.payments FOR INSERT
WITH CHECK (auth.uid() = from_user_id);

-- Allow users to insert wallet records during escrow
CREATE POLICY "Users can insert wallet"
ON public.wallets FOR INSERT
WITH CHECK (auth.uid() = user_id);