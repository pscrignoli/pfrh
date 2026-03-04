
-- ========== DEPARTMENTS ==========
DROP POLICY IF EXISTS "Authenticated users can read departments" ON public.departments;
DROP POLICY IF EXISTS "Admin RH manages departments" ON public.departments;
DROP POLICY IF EXISTS "Super admin manages departments" ON public.departments;

CREATE POLICY "Authenticated full access departments"
ON public.departments FOR ALL TO authenticated
USING (true) WITH CHECK (true);

-- ========== EMPLOYEES ==========
DROP POLICY IF EXISTS "RH e DP gerenciam colaboradores" ON public.employees;
DROP POLICY IF EXISTS "Financeiro le colaboradores" ON public.employees;
DROP POLICY IF EXISTS "Super admin full access employees" ON public.employees;

CREATE POLICY "Authenticated full access employees"
ON public.employees FOR ALL TO authenticated
USING (true) WITH CHECK (true);

-- ========== EMPLOYEE_POSITIONS ==========
DROP POLICY IF EXISTS "RH e DP gerenciam posicoes" ON public.employee_positions;
DROP POLICY IF EXISTS "Financeiro le posicoes" ON public.employee_positions;
DROP POLICY IF EXISTS "Super admin full access employee_positions" ON public.employee_positions;

CREATE POLICY "Authenticated full access employee_positions"
ON public.employee_positions FOR ALL TO authenticated
USING (true) WITH CHECK (true);

-- ========== PAYROLL_MONTHLY_RECORDS ==========
DROP POLICY IF EXISTS "RH e Financeiro gerenciam folha" ON public.payroll_monthly_records;
DROP POLICY IF EXISTS "DP le folha" ON public.payroll_monthly_records;
DROP POLICY IF EXISTS "Super admin full access payroll" ON public.payroll_monthly_records;

CREATE POLICY "Authenticated full access payroll"
ON public.payroll_monthly_records FOR ALL TO authenticated
USING (true) WITH CHECK (true);

-- ========== TIME_RECORDS ==========
DROP POLICY IF EXISTS "RH e DP gerenciam ponto" ON public.time_records;
DROP POLICY IF EXISTS "Financeiro le ponto" ON public.time_records;
DROP POLICY IF EXISTS "Super admin full access time_records" ON public.time_records;

CREATE POLICY "Authenticated full access time_records"
ON public.time_records FOR ALL TO authenticated
USING (true) WITH CHECK (true);

-- ========== POSITIONS ==========
DROP POLICY IF EXISTS "RH gerencia cargos" ON public.positions;
DROP POLICY IF EXISTS "Usuarios autorizados leem cargos" ON public.positions;
DROP POLICY IF EXISTS "Super admin full access positions" ON public.positions;

CREATE POLICY "Authenticated full access positions"
ON public.positions FOR ALL TO authenticated
USING (true) WITH CHECK (true);

-- ========== INTEGRATION_LOGS ==========
DROP POLICY IF EXISTS "Admin gerencia logs" ON public.integration_logs;
DROP POLICY IF EXISTS "Financeiro le logs" ON public.integration_logs;
DROP POLICY IF EXISTS "Super admin full access integration_logs" ON public.integration_logs;

CREATE POLICY "Authenticated full access integration_logs"
ON public.integration_logs FOR ALL TO authenticated
USING (true) WITH CHECK (true);

-- ========== DOCUMENT_EMBEDDINGS ==========
DROP POLICY IF EXISTS "Admin gerencia embeddings" ON public.document_embeddings;
DROP POLICY IF EXISTS "Usuarios autorizados leem embeddings" ON public.document_embeddings;
DROP POLICY IF EXISTS "Super admin full access document_embeddings" ON public.document_embeddings;

CREATE POLICY "Authenticated full access document_embeddings"
ON public.document_embeddings FOR ALL TO authenticated
USING (true) WITH CHECK (true);

-- ========== SYSTEM_SETTINGS ==========
DROP POLICY IF EXISTS "Admin manages settings" ON public.system_settings;
DROP POLICY IF EXISTS "Authorized users read settings" ON public.system_settings;
DROP POLICY IF EXISTS "Super admin full access system_settings" ON public.system_settings;

CREATE POLICY "Authenticated full access system_settings"
ON public.system_settings FOR ALL TO authenticated
USING (true) WITH CHECK (true);

-- ========== USER_ROLES ==========
DROP POLICY IF EXISTS "Admins podem gerenciar roles" ON public.user_roles;
DROP POLICY IF EXISTS "Usuarios veem seus proprios roles" ON public.user_roles;
DROP POLICY IF EXISTS "Super admin full access user_roles" ON public.user_roles;

CREATE POLICY "Authenticated full access user_roles"
ON public.user_roles FOR ALL TO authenticated
USING (true) WITH CHECK (true);
