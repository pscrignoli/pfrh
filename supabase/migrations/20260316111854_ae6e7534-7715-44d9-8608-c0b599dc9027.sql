-- 1. Fix candidates SELECT: restrict to rh/admin/super_admin roles
DROP POLICY IF EXISTS "Authenticated can read candidates" ON public.candidates;
CREATE POLICY "Role-restricted read candidates" ON public.candidates
  FOR SELECT TO authenticated
  USING (get_user_role_name(auth.uid()) = ANY (ARRAY['super_admin','admin','rh']));

-- 2. Fix time_records SELECT: restrict to rh/admin/super_admin roles  
DROP POLICY IF EXISTS "Authenticated can read time_records" ON public.time_records;
CREATE POLICY "Role-restricted read time_records" ON public.time_records
  FOR SELECT TO authenticated
  USING (get_user_role_name(auth.uid()) = ANY (ARRAY['super_admin','admin','rh']));

-- 3. Fix integration_logs INSERT: restrict to admin roles only
DROP POLICY IF EXISTS "Service can insert integration_logs" ON public.integration_logs;
CREATE POLICY "Admins can insert integration_logs" ON public.integration_logs
  FOR INSERT TO authenticated
  WITH CHECK (get_user_role_name(auth.uid()) = ANY (ARRAY['super_admin','admin']));