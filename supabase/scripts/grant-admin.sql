-- ============================================================================
-- Bootstrap the FIRST admin. Run this in Supabase Dashboard -> SQL Editor.
-- The SQL Editor runs as the service role and bypasses RLS, so this works even
-- though grant_admin_role() (used inside the app) requires you to already be an
-- admin.
--
-- STEP 1: Sign up / log in once in the app with the email below so the account
--         exists in public.profiles.
-- STEP 2: Replace the email, run this whole script.
-- STEP 3: Sign out and sign back in inside the app -> the Admin Panel appears.
-- ============================================================================

-- 1) Confirm the account exists (should return one row)
SELECT p.id, p.email, p.full_name,
       (ur.role IS NOT NULL) AS already_admin
FROM public.profiles p
LEFT JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role = 'admin'
WHERE LOWER(p.email) = LOWER('you@example.com');   -- <-- EDIT THIS EMAIL

-- 2) Grant admin (safe to re-run)
INSERT INTO public.user_roles (user_id, role)
SELECT p.id, 'admin'::public.app_role
FROM public.profiles p
WHERE LOWER(p.email) = LOWER('you@example.com')     -- <-- EDIT THIS EMAIL
ON CONFLICT (user_id, role) DO NOTHING;

-- 3) Verify — should list your email
SELECT p.email, ur.role, ur.created_at
FROM public.user_roles ur
JOIN public.profiles p ON p.id = ur.user_id
WHERE ur.role = 'admin';
