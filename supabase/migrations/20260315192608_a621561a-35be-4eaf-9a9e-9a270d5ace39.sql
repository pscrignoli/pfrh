
-- Fix 1: user_profiles role escalation
-- Drop the existing UPDATE policy that allows users to change their own role_id
DROP POLICY IF EXISTS "update_user_profiles" ON public.user_profiles;

-- Allow admins to update any user profile (including role_id)
CREATE POLICY "admins_update_user_profiles" ON public.user_profiles
FOR UPDATE TO authenticated
USING (get_user_role_name(auth.uid()) IN ('super_admin', 'admin'))
WITH CHECK (get_user_role_name(auth.uid()) IN ('super_admin', 'admin'));

-- Allow users to update ONLY their own row, but block role_id changes
-- By checking that role_id stays unchanged (or was already null and stays null)
CREATE POLICY "self_update_user_profiles" ON public.user_profiles
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid()
  AND (role_id IS NOT DISTINCT FROM (SELECT up.role_id FROM public.user_profiles up WHERE up.user_id = auth.uid()))
);

-- Fix 2: health_records unrestricted read
-- Drop the existing overly permissive SELECT policy
DROP POLICY IF EXISTS "Authenticated read health_records" ON public.health_records;

-- Only HR/admin roles can read health records (contains CPF, health data)
CREATE POLICY "Role-restricted read health_records" ON public.health_records
FOR SELECT TO authenticated
USING (
  get_user_role_name(auth.uid()) IN ('super_admin', 'admin', 'rh')
);
