-- Deal detail with masked delivery address for non-participants (privacy by design)

CREATE OR REPLACE FUNCTION public.get_deal_for_viewer(p_deal_id UUID)
RETURNS TABLE (
  id UUID,
  merchant_id UUID,
  customer_id UUID,
  product_name TEXT,
  product_link TEXT,
  original_price DECIMAL(10,2),
  card_offer_price DECIMAL(10,2),
  expected_buy_price DECIMAL(10,2),
  advance_amount DECIMAL(10,2),
  remaining_amount DECIMAL(10,2),
  commission_amount DECIMAL(10,2),
  required_card TEXT,
  delivery_address TEXT,
  admin_contact_number TEXT,
  status TEXT,
  admin_notes TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to view deal details';
  END IF;

  RETURN QUERY
  SELECT
    d.id,
    d.merchant_id,
    d.customer_id,
    d.product_name,
    d.product_link,
    d.original_price,
    d.card_offer_price,
    d.expected_buy_price,
    d.advance_amount,
    d.remaining_amount,
    d.commission_amount,
    d.required_card,
    CASE
      WHEN public.is_admin(auth.uid())
        OR d.merchant_id = auth.uid()
        OR d.customer_id = auth.uid()
      THEN d.delivery_address
      ELSE NULL
    END,
    d.admin_contact_number,
    d.status::TEXT,
    CASE
      WHEN public.is_admin(auth.uid()) THEN d.admin_notes
      ELSE NULL
    END,
    d.created_at,
    d.updated_at
  FROM public.deals d
  WHERE d.id = p_deal_id
    AND (
      public.is_admin(auth.uid())
      OR d.merchant_id = auth.uid()
      OR d.customer_id = auth.uid()
      OR (d.status = 'approved' AND d.customer_id IS NULL)
    );
END;
$$;
