
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'departments','employees','employee_positions','payroll_monthly_records',
    'time_records','positions','integration_logs','document_embeddings',
    'system_settings','user_roles','vacancies','candidates'
  ])
  LOOP
    -- Drop all existing policies on each table
    FOR t IN
      SELECT format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename)
      FROM pg_policies pol
      WHERE pol.schemaname = 'public' AND pol.tablename = t
    LOOP
      EXECUTE t;
    END LOOP;
  END LOOP;
END $$;

-- Recreate as explicitly PERMISSIVE
CREATE POLICY "allow_all_departments" ON public.departments AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_employees" ON public.employees AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_employee_positions" ON public.employee_positions AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_payroll" ON public.payroll_monthly_records AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_time_records" ON public.time_records AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_positions" ON public.positions AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_integration_logs" ON public.integration_logs AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_document_embeddings" ON public.document_embeddings AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_system_settings" ON public.system_settings AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_user_roles" ON public.user_roles AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_vacancies" ON public.vacancies AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_candidates" ON public.candidates AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
