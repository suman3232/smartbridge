-- Create app_role enum (admin only for now)
CREATE TYPE public.app_role AS ENUM ('admin');

-- Create user_roles table for admin role management
CREATE TABLE public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check if user has a role
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create security definer function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'admin'
  )
$$;

-- RLS policy: Users can view their own roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

-- RLS policy: Only admins can manage roles
CREATE POLICY "Admins can manage all roles"
ON public.user_roles
FOR ALL
USING (public.is_admin(auth.uid()));

-- Drop the existing admin policy on profiles (depends on is_admin column)
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- Remove is_admin column from profiles (use user_roles table instead)
ALTER TABLE public.profiles DROP COLUMN IF EXISTS is_admin;

-- Create new admin policy using is_admin function
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (public.is_admin(auth.uid()));

-- Update deals RLS: Prevent users from accepting their own deals
DROP POLICY IF EXISTS "Users can update their own deals" ON public.deals;

CREATE POLICY "Users can update deals they are involved in"
ON public.deals
FOR UPDATE
USING (
  (auth.uid() = merchant_id) OR 
  (auth.uid() = customer_id AND auth.uid() != merchant_id)
);

-- Add check constraint to prevent self-acceptance (customer_id != merchant_id)
ALTER TABLE public.deals 
ADD CONSTRAINT prevent_self_acceptance 
CHECK (customer_id IS NULL OR customer_id != merchant_id);