DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'departments',
    'employees',
    'employee_positions',
    'payroll_monthly_records',
    'time_records',
    'positions',
    'integration_logs',
    'document_embeddings',
    'system_settings',
    'user_roles',
    'vacancies',
    'candidates'
  ])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated full access %s" ON public.%I;',
      CASE
        WHEN t = 'payroll_monthly_records' THEN 'payroll'
        WHEN t = 'time_records' THEN 'time_records'
        WHEN t = 'employee_positions' THEN 'employee_positions'
        ELSE t
      END,
      t
    );

    EXECUTE format('DROP POLICY IF EXISTS "Public full access %s" ON public.%I;',
      CASE
        WHEN t = 'payroll_monthly_records' THEN 'payroll'
        WHEN t = 'time_records' THEN 'time_records'
        WHEN t = 'employee_positions' THEN 'employee_positions'
        ELSE t
      END,
      t
    );
  END LOOP;

  CREATE POLICY "Public full access departments" ON public.departments FOR ALL TO public USING (true) WITH CHECK (true);
  CREATE POLICY "Public full access employees" ON public.employees FOR ALL TO public USING (true) WITH CHECK (true);
  CREATE POLICY "Public full access employee_positions" ON public.employee_positions FOR ALL TO public USING (true) WITH CHECK (true);
  CREATE POLICY "Public full access payroll" ON public.payroll_monthly_records FOR ALL TO public USING (true) WITH CHECK (true);
  CREATE POLICY "Public full access time_records" ON public.time_records FOR ALL TO public USING (true) WITH CHECK (true);
  CREATE POLICY "Public full access positions" ON public.positions FOR ALL TO public USING (true) WITH CHECK (true);
  CREATE POLICY "Public full access integration_logs" ON public.integration_logs FOR ALL TO public USING (true) WITH CHECK (true);
  CREATE POLICY "Public full access document_embeddings" ON public.document_embeddings FOR ALL TO public USING (true) WITH CHECK (true);
  CREATE POLICY "Public full access system_settings" ON public.system_settings FOR ALL TO public USING (true) WITH CHECK (true);
  CREATE POLICY "Public full access user_roles" ON public.user_roles FOR ALL TO public USING (true) WITH CHECK (true);
  CREATE POLICY "Public full access vacancies" ON public.vacancies FOR ALL TO public USING (true) WITH CHECK (true);
  CREATE POLICY "Public full access candidates" ON public.candidates FOR ALL TO public USING (true) WITH CHECK (true);
END $$;