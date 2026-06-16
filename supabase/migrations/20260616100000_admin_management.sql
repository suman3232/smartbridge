-- Admin role management: grant/revoke by existing admins (bootstrap first admin via SQL Editor)

CREATE OR REPLACE FUNCTION public.grant_admin_role(p_email TEXT)
RETURNS public.user_roles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_user_id UUID;
  new_role public.user_roles;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can grant the admin role';
  END IF;

  IF p_email IS NULL OR TRIM(p_email) = '' THEN
    RAISE EXCEPTION 'Email is required';
  END IF;

  SELECT p.id INTO target_user_id
  FROM public.profiles p
  WHERE LOWER(p.email) = LOWER(TRIM(p_email))
  LIMIT 1;

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'No user found with email %', TRIM(p_email);
  END IF;

  IF public.is_admin(target_user_id) THEN
    RAISE EXCEPTION 'User is already an admin';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (target_user_id, 'admin')
  RETURNING * INTO new_role;

  INSERT INTO public.notifications (user_id, title, message, type, link)
  VALUES (
    target_user_id,
    'Admin access granted',
    'You now have admin access. Sign out and sign in again to use the Admin Panel.',
    'success',
    '/admin'
  );

  RETURN new_role;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_admin_role(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_count INTEGER;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can revoke the admin role';
  END IF;

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot remove your own admin role';
  END IF;

  IF NOT public.is_admin(p_user_id) THEN
    RAISE EXCEPTION 'User is not an admin';
  END IF;

  SELECT COUNT(*) INTO admin_count
  FROM public.user_roles
  WHERE role = 'admin';

  IF admin_count <= 1 THEN
    RAISE EXCEPTION 'Cannot remove the last admin';
  END IF;

  DELETE FROM public.user_roles
  WHERE user_id = p_user_id AND role = 'admin';

  INSERT INTO public.notifications (user_id, title, message, type, link)
  VALUES (
    p_user_id,
    'Admin access removed',
    'Your admin access has been revoked.',
    'info',
    '/dashboard'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.list_admins()
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  full_name TEXT,
  granted_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ur.user_id,
    p.email,
    p.full_name,
    ur.created_at
  FROM public.user_roles ur
  JOIN public.profiles p ON p.id = ur.user_id
  WHERE ur.role = 'admin'
    AND public.is_admin(auth.uid())
  ORDER BY ur.created_at ASC;
$$;

-- Admins can read all role rows (for admin list UI)
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
USING (public.is_admin(auth.uid()));
