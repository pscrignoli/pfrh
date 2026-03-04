
-- Drop ALL existing restrictive policies
DROP POLICY IF EXISTS "allow_all_candidates" ON public.candidates;
DROP POLICY IF EXISTS "allow_all_vacancies" ON public.vacancies;
DROP POLICY IF EXISTS "allow_all_departments" ON public.departments;
DROP POLICY IF EXISTS "allow_all_employees" ON public.employees;
DROP POLICY IF EXISTS "allow_all_employee_positions" ON public.employee_positions;
DROP POLICY IF EXISTS "allow_all_payroll" ON public.payroll_monthly_records;
DROP POLICY IF EXISTS "allow_all_time_records" ON public.time_records;
DROP POLICY IF EXISTS "allow_all_positions" ON public.positions;
DROP POLICY IF EXISTS "allow_all_integration_logs" ON public.integration_logs;
DROP POLICY IF EXISTS "allow_all_document_embeddings" ON public.document_embeddings;
DROP POLICY IF EXISTS "allow_all_system_settings" ON public.system_settings;
DROP POLICY IF EXISTS "allow_all_user_roles" ON public.user_roles;

-- Disable RLS on all tables
ALTER TABLE public.candidates DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.vacancies DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_positions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_monthly_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.positions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_embeddings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles DISABLE ROW LEVEL SECURITY;
