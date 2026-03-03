-- Fix employees RLS: drop restrictive policies and recreate as permissive
DROP POLICY IF EXISTS "Financeiro le colaboradores" ON public.employees;
DROP POLICY IF EXISTS "RH e DP gerenciam colaboradores" ON public.employees;

CREATE POLICY "RH e DP gerenciam colaboradores"
ON public.employees FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin_rh'::app_role) OR has_role(auth.uid(), 'assistente_dp'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin_rh'::app_role) OR has_role(auth.uid(), 'assistente_dp'::app_role));

CREATE POLICY "Financeiro le colaboradores"
ON public.employees FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'gestor_financeiro'::app_role));

-- Fix employee_positions RLS
DROP POLICY IF EXISTS "RH e DP gerenciam posicoes" ON public.employee_positions;
DROP POLICY IF EXISTS "Financeiro le posicoes" ON public.employee_positions;

CREATE POLICY "RH e DP gerenciam posicoes"
ON public.employee_positions FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin_rh'::app_role) OR has_role(auth.uid(), 'assistente_dp'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin_rh'::app_role) OR has_role(auth.uid(), 'assistente_dp'::app_role));

CREATE POLICY "Financeiro le posicoes"
ON public.employee_positions FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'gestor_financeiro'::app_role));

-- Fix time_records RLS
DROP POLICY IF EXISTS "RH e DP gerenciam ponto" ON public.time_records;
DROP POLICY IF EXISTS "Financeiro le ponto" ON public.time_records;

CREATE POLICY "RH e DP gerenciam ponto"
ON public.time_records FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin_rh'::app_role) OR has_role(auth.uid(), 'assistente_dp'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin_rh'::app_role) OR has_role(auth.uid(), 'assistente_dp'::app_role));

CREATE POLICY "Financeiro le ponto"
ON public.time_records FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'gestor_financeiro'::app_role));

-- Fix payroll_monthly_records RLS
DROP POLICY IF EXISTS "RH e Financeiro gerenciam folha" ON public.payroll_monthly_records;
DROP POLICY IF EXISTS "DP le folha" ON public.payroll_monthly_records;

CREATE POLICY "RH e Financeiro gerenciam folha"
ON public.payroll_monthly_records FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin_rh'::app_role) OR has_role(auth.uid(), 'gestor_financeiro'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin_rh'::app_role) OR has_role(auth.uid(), 'gestor_financeiro'::app_role));

CREATE POLICY "DP le folha"
ON public.payroll_monthly_records FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'assistente_dp'::app_role));

-- Fix integration_logs RLS
DROP POLICY IF EXISTS "Admin gerencia logs" ON public.integration_logs;
DROP POLICY IF EXISTS "Financeiro le logs" ON public.integration_logs;

CREATE POLICY "Admin gerencia logs"
ON public.integration_logs FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin_rh'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin_rh'::app_role));

CREATE POLICY "Financeiro le logs"
ON public.integration_logs FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'gestor_financeiro'::app_role));

-- Fix document_embeddings RLS
DROP POLICY IF EXISTS "Admin gerencia embeddings" ON public.document_embeddings;
DROP POLICY IF EXISTS "Usuarios autorizados leem embeddings" ON public.document_embeddings;

CREATE POLICY "Admin gerencia embeddings"
ON public.document_embeddings FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin_rh'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin_rh'::app_role));

CREATE POLICY "Usuarios autorizados leem embeddings"
ON public.document_embeddings FOR SELECT
TO authenticated
USING (has_any_role(auth.uid()));

-- Fix positions RLS
DROP POLICY IF EXISTS "RH gerencia cargos" ON public.positions;
DROP POLICY IF EXISTS "Usuarios autorizados leem cargos" ON public.positions;

CREATE POLICY "RH gerencia cargos"
ON public.positions FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin_rh'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin_rh'::app_role));

CREATE POLICY "Usuarios autorizados leem cargos"
ON public.positions FOR SELECT
TO authenticated
USING (has_any_role(auth.uid()));

-- Fix system_settings RLS
DROP POLICY IF EXISTS "Admin manages settings" ON public.system_settings;
DROP POLICY IF EXISTS "Authorized users read settings" ON public.system_settings;

CREATE POLICY "Admin manages settings"
ON public.system_settings FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin_rh'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin_rh'::app_role));

CREATE POLICY "Authorized users read settings"
ON public.system_settings FOR SELECT
TO authenticated
USING (has_any_role(auth.uid()));

-- Fix user_roles RLS
DROP POLICY IF EXISTS "Admins podem gerenciar roles" ON public.user_roles;
DROP POLICY IF EXISTS "Usuarios veem seus proprios roles" ON public.user_roles;

CREATE POLICY "Admins podem gerenciar roles"
ON public.user_roles FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin_rh'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin_rh'::app_role));

CREATE POLICY "Usuarios veem seus proprios roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (user_id = auth.uid());