
-- Drop restrictive policies and recreate as permissive
DROP POLICY IF EXISTS "RH e DP gerenciam vagas" ON public.vacancies;
DROP POLICY IF EXISTS "Super admin full access vacancies" ON public.vacancies;
DROP POLICY IF EXISTS "Financeiro le vagas" ON public.vacancies;
DROP POLICY IF EXISTS "RH e DP gerenciam candidatos" ON public.candidates;
DROP POLICY IF EXISTS "Super admin full access candidates" ON public.candidates;
DROP POLICY IF EXISTS "Financeiro le candidatos" ON public.candidates;

-- Recreate as PERMISSIVE
CREATE POLICY "RH e DP gerenciam vagas"
ON public.vacancies FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin_rh'::app_role) OR has_role(auth.uid(), 'assistente_dp'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin_rh'::app_role) OR has_role(auth.uid(), 'assistente_dp'::app_role));

CREATE POLICY "Super admin full access vacancies"
ON public.vacancies FOR ALL TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Financeiro le vagas"
ON public.vacancies FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'gestor_financeiro'::app_role));

CREATE POLICY "RH e DP gerenciam candidatos"
ON public.candidates FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin_rh'::app_role) OR has_role(auth.uid(), 'assistente_dp'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin_rh'::app_role) OR has_role(auth.uid(), 'assistente_dp'::app_role));

CREATE POLICY "Super admin full access candidates"
ON public.candidates FOR ALL TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Financeiro le candidatos"
ON public.candidates FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'gestor_financeiro'::app_role));
