-- Create enum for KYC status
CREATE TYPE kyc_status AS ENUM ('pending', 'approved', 'rejected');

-- Create enum for deal status
CREATE TYPE deal_status AS ENUM ('pending', 'approved', 'rejected', 'accepted', 'in_progress', 'completed', 'cancelled');

-- Create enum for order status
CREATE TYPE order_status AS ENUM ('placed', 'otp_pending', 'otp_verified', 'shipped', 'delivered', 'confirmed');

-- Create enum for payment status
CREATE TYPE payment_status AS ENUM ('pending', 'locked', 'released', 'refunded');

-- Create enum for user preference
CREATE TYPE user_preference AS ENUM ('create_deals', 'accept_deals', 'both');

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  preferred_role user_preference DEFAULT 'both',
  is_admin BOOLEAN DEFAULT false,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- KYC table
CREATE TABLE public.kycs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  pan_number TEXT NOT NULL,
  document_url TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  ifsc_code TEXT NOT NULL,
  status kyc_status DEFAULT 'pending',
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.kycs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own KYC" ON public.kycs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own KYC" ON public.kycs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own pending KYC" ON public.kycs
  FOR UPDATE USING (auth.uid() = user_id AND status = 'pending');

-- Admin numbers pool
CREATE TABLE public.admin_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT true,
  last_assigned_at TIMESTAMPTZ,
  assignment_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.admin_numbers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active admin numbers" ON public.admin_numbers
  FOR SELECT USING (is_active = true);

-- Deals table
CREATE TABLE public.deals (
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
  status deal_status DEFAULT 'pending',
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view approved deals" ON public.deals
  FOR SELECT USING (status IN ('approved', 'accepted', 'in_progress', 'completed') OR merchant_id = auth.uid() OR customer_id = auth.uid());

CREATE POLICY "Users can create deals" ON public.deals
  FOR INSERT WITH CHECK (auth.uid() = merchant_id);

CREATE POLICY "Users can update their own deals" ON public.deals
  FOR UPDATE USING (auth.uid() = merchant_id OR auth.uid() = customer_id);

-- Orders table
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES public.deals(id) ON DELETE CASCADE NOT NULL,
  customer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  order_screenshot_url TEXT,
  tracking_id TEXT,
  delivery_otp TEXT,
  otp_verified BOOLEAN DEFAULT false,
  status order_status DEFAULT 'placed',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their orders" ON public.orders
  FOR SELECT USING (
    customer_id = auth.uid() OR 
    EXISTS (SELECT 1 FROM public.deals WHERE deals.id = orders.deal_id AND deals.merchant_id = auth.uid())
  );

CREATE POLICY "Users can create orders" ON public.orders
  FOR INSERT WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "Users can update their orders" ON public.orders
  FOR UPDATE USING (customer_id = auth.uid());

-- Delivery confirmations
CREATE TABLE public.delivery_confirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  merchant_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  confirmation_photo_url TEXT NOT NULL,
  notes TEXT,
  confirmed_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.delivery_confirmations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their confirmations" ON public.delivery_confirmations
  FOR SELECT USING (
    merchant_id = auth.uid() OR 
    EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_id AND orders.customer_id = auth.uid())
  );

CREATE POLICY "Merchants can insert confirmations" ON public.delivery_confirmations
  FOR INSERT WITH CHECK (auth.uid() = merchant_id);

-- Wallets table
CREATE TABLE public.wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  balance DECIMAL(10,2) DEFAULT 0,
  locked_amount DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their wallet" ON public.wallets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their wallet" ON public.wallets
  FOR UPDATE USING (auth.uid() = user_id);

-- Payments/Transactions table
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES public.deals(id),
  from_user_id UUID REFERENCES public.profiles(id),
  to_user_id UUID REFERENCES public.profiles(id),
  amount DECIMAL(10,2) NOT NULL,
  payment_type TEXT NOT NULL,
  status payment_status DEFAULT 'pending',
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their payments" ON public.payments
  FOR SELECT USING (from_user_id = auth.uid() OR to_user_id = auth.uid());

-- Notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info',
  is_read BOOLEAN DEFAULT false,
  link TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, preferred_role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', 'User'),
    NEW.email,
    COALESCE((NEW.raw_user_meta_data ->> 'preferred_role')::user_preference, 'both')
  );
  
  INSERT INTO public.wallets (user_id, balance, locked_amount)
  VALUES (NEW.id, 0, 0);
  
  RETURN NEW;
END;
$$;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add update triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_kycs_updated_at BEFORE UPDATE ON public.kycs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_deals_updated_at BEFORE UPDATE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_wallets_updated_at BEFORE UPDATE ON public.wallets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert sample admin numbers
INSERT INTO public.admin_numbers (phone_number, is_active) VALUES
  ('+91 98765 43210', true),
  ('+91 98765 43211', true),
  ('+91 98765 43212', true),
  ('+91 98765 43213', true),
  ('+91 98765 43214', true);