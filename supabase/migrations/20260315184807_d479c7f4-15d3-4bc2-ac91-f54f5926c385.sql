
-- =============================================
-- Tighten overly permissive write policies
-- Replace USING(true) / WITH CHECK(true) on write operations with role-based checks
-- =============================================

-- 1. FERIAS: restrict writes to rh/admin/super_admin
DROP POLICY IF EXISTS "Authenticated users can insert ferias" ON public.ferias;
DROP POLICY IF EXISTS "Authenticated users can update ferias" ON public.ferias;
DROP POLICY IF EXISTS "Authenticated users can delete ferias" ON public.ferias;

CREATE POLICY "RH can insert ferias" ON public.ferias FOR INSERT TO authenticated
WITH CHECK (get_user_role_name(auth.uid()) IN ('super_admin', 'admin', 'rh'));

CREATE POLICY "RH can update ferias" ON public.ferias FOR UPDATE TO authenticated
USING (get_user_role_name(auth.uid()) IN ('super_admin', 'admin', 'rh'));

CREATE POLICY "RH can delete ferias" ON public.ferias FOR DELETE TO authenticated
USING (get_user_role_name(auth.uid()) IN ('super_admin', 'admin', 'rh'));

-- 2. HEALTH_RECORDS: restrict writes to rh/admin/super_admin
DROP POLICY IF EXISTS "Authenticated insert health_records" ON public.health_records;
DROP POLICY IF EXISTS "Authenticated update health_records" ON public.health_records;
DROP POLICY IF EXISTS "Authenticated delete health_records" ON public.health_records;

CREATE POLICY "RH can insert health_records" ON public.health_records FOR INSERT TO authenticated
WITH CHECK (get_user_role_name(auth.uid()) IN ('super_admin', 'admin', 'rh'));

CREATE POLICY "RH can update health_records" ON public.health_records FOR UPDATE TO authenticated
USING (get_user_role_name(auth.uid()) IN ('super_admin', 'admin', 'rh'));

CREATE POLICY "RH can delete health_records" ON public.health_records FOR DELETE TO authenticated
USING (get_user_role_name(auth.uid()) IN ('super_admin', 'admin', 'rh'));

-- 3. HEALTH_INVOICES: restrict writes
DROP POLICY IF EXISTS "Authenticated insert health_invoices" ON public.health_invoices;
DROP POLICY IF EXISTS "Authenticated update health_invoices" ON public.health_invoices;

CREATE POLICY "RH can insert health_invoices" ON public.health_invoices FOR INSERT TO authenticated
WITH CHECK (get_user_role_name(auth.uid()) IN ('super_admin', 'admin', 'rh'));

CREATE POLICY "RH can update health_invoices" ON public.health_invoices FOR UPDATE TO authenticated
USING (get_user_role_name(auth.uid()) IN ('super_admin', 'admin', 'rh'));

-- 4. HEALTH_PLANS: restrict writes
DROP POLICY IF EXISTS "Authenticated insert health_plans" ON public.health_plans;
DROP POLICY IF EXISTS "Authenticated update health_plans" ON public.health_plans;

CREATE POLICY "RH can insert health_plans" ON public.health_plans FOR INSERT TO authenticated
WITH CHECK (get_user_role_name(auth.uid()) IN ('super_admin', 'admin', 'rh'));

CREATE POLICY "RH can update health_plans" ON public.health_plans FOR UPDATE TO authenticated
USING (get_user_role_name(auth.uid()) IN ('super_admin', 'admin', 'rh'));

-- 5. EMPREGARE_CANDIDATOS: restrict writes to rh/admin
DROP POLICY IF EXISTS "Authenticated users can insert empregare_candidatos" ON public.empregare_candidatos;
DROP POLICY IF EXISTS "Authenticated users can update empregare_candidatos" ON public.empregare_candidatos;

CREATE POLICY "RH can insert empregare_candidatos" ON public.empregare_candidatos FOR INSERT TO authenticated
WITH CHECK (get_user_role_name(auth.uid()) IN ('super_admin', 'admin', 'rh'));

CREATE POLICY "RH can update empregare_candidatos" ON public.empregare_candidatos FOR UPDATE TO authenticated
USING (get_user_role_name(auth.uid()) IN ('super_admin', 'admin', 'rh'));

-- 6. EMPREGARE_KANBAN_CARDS: restrict writes to rh/admin
DROP POLICY IF EXISTS "Authenticated users can insert empregare_kanban_cards" ON public.empregare_kanban_cards;
DROP POLICY IF EXISTS "Authenticated users can update empregare_kanban_cards" ON public.empregare_kanban_cards;

CREATE POLICY "RH can insert empregare_kanban_cards" ON public.empregare_kanban_cards FOR INSERT TO authenticated
WITH CHECK (get_user_role_name(auth.uid()) IN ('super_admin', 'admin', 'rh'));

CREATE POLICY "RH can update empregare_kanban_cards" ON public.empregare_kanban_cards FOR UPDATE TO authenticated
USING (get_user_role_name(auth.uid()) IN ('super_admin', 'admin', 'rh'));

-- 7. VAGA_DESCRICOES: restrict writes to rh/admin
DROP POLICY IF EXISTS "Authenticated users can insert vaga_descricoes" ON public.vaga_descricoes;
DROP POLICY IF EXISTS "Authenticated users can update vaga_descricoes" ON public.vaga_descricoes;
DROP POLICY IF EXISTS "Authenticated users can delete vaga_descricoes" ON public.vaga_descricoes;

CREATE POLICY "RH can insert vaga_descricoes" ON public.vaga_descricoes FOR INSERT TO authenticated
WITH CHECK (get_user_role_name(auth.uid()) IN ('super_admin', 'admin', 'rh'));

CREATE POLICY "RH can update vaga_descricoes" ON public.vaga_descricoes FOR UPDATE TO authenticated
USING (get_user_role_name(auth.uid()) IN ('super_admin', 'admin', 'rh'));

CREATE POLICY "RH can delete vaga_descricoes" ON public.vaga_descricoes FOR DELETE TO authenticated
USING (get_user_role_name(auth.uid()) IN ('super_admin', 'admin', 'rh'));

-- 8. RESCISAO_SIMULACOES: restrict writes to rh/admin
DROP POLICY IF EXISTS "Authenticated users can insert rescisao_simulacoes" ON public.rescisao_simulacoes;
DROP POLICY IF EXISTS "Authenticated users can delete rescisao_simulacoes" ON public.rescisao_simulacoes;

CREATE POLICY "RH can insert rescisao_simulacoes" ON public.rescisao_simulacoes FOR INSERT TO authenticated
WITH CHECK (get_user_role_name(auth.uid()) IN ('super_admin', 'admin', 'rh'));

CREATE POLICY "RH can delete rescisao_simulacoes" ON public.rescisao_simulacoes FOR DELETE TO authenticated
USING (get_user_role_name(auth.uid()) IN ('super_admin', 'admin', 'rh'));
