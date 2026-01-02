-- Update handle_new_user function to remove is_admin reference
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
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