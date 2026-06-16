-- Run in Supabase Dashboard → SQL Editor (service role — bypasses RLS)
-- Replace email if needed, then sign out + sign in again in the app.

-- 1) Check account exists
SELECT p.id, p.email, p.full_name, ur.role AS admin_role
FROM public.profiles p
LEFT JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role = 'admin'
WHERE LOWER(p.email) = LOWER('sumanpatra3232@gmail.com');

-- 2) Grant admin (safe to re-run)
INSERT INTO public.user_roles (user_id, role)
SELECT p.id, 'admin'::app_role
FROM public.profiles p
WHERE LOWER(p.email) = LOWER('sumanpatra3232@gmail.com')
ON CONFLICT (user_id, role) DO NOTHING;

-- 3) Verify
SELECT p.email, ur.role, ur.created_at
FROM public.user_roles ur
JOIN public.profiles p ON p.id = ur.user_id
WHERE ur.role = 'admin';
