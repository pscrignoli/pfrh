
-- 1. Enable RLS on user_roles (CRITICAL: prevents privilege escalation)
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- user_roles: only admins can manage roles
CREATE POLICY "Admins can read user_roles"
ON public.user_roles FOR SELECT TO authenticated
USING (get_user_role_name(auth.uid()) IN ('super_admin', 'admin'));

CREATE POLICY "Admins can insert user_roles"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (get_user_role_name(auth.uid()) IN ('super_admin', 'admin'));

CREATE POLICY "Admins can delete user_roles"
ON public.user_roles FOR DELETE TO authenticated
USING (get_user_role_name(auth.uid()) IN ('super_admin', 'admin'));

-- 2. Enable RLS on tables without it
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read employees"
ON public.employees FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert employees"
ON public.employees FOR INSERT TO authenticated
WITH CHECK (get_user_role_name(auth.uid()) IN ('super_admin', 'admin', 'rh'));
CREATE POLICY "Admins can update employees"
ON public.employees FOR UPDATE TO authenticated
USING (get_user_role_name(auth.uid()) IN ('super_admin', 'admin', 'rh'));
CREATE POLICY "Admins can delete employees"
ON public.employees FOR DELETE TO authenticated
USING (get_user_role_name(auth.uid()) IN ('super_admin', 'admin'));

-- 3. payroll_monthly_records
ALTER TABLE public.payroll_monthly_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read payroll"
ON public.payroll_monthly_records FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert payroll"
ON public.payroll_monthly_records FOR INSERT TO authenticated
WITH CHECK (get_user_role_name(auth.uid()) IN ('super_admin', 'admin', 'rh'));
CREATE POLICY "Admins can update payroll"
ON public.payroll_monthly_records FOR UPDATE TO authenticated
USING (get_user_role_name(auth.uid()) IN ('super_admin', 'admin', 'rh'));
CREATE POLICY "Admins can delete payroll"
ON public.payroll_monthly_records FOR DELETE TO authenticated
USING (get_user_role_name(auth.uid()) IN ('super_admin', 'admin'));

-- 4. candidates
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read candidates"
ON public.candidates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert candidates"
ON public.candidates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update candidates"
ON public.candidates FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete candidates"
ON public.candidates FOR DELETE TO authenticated USING (true);

-- 5. candidate_field_values
ALTER TABLE public.candidate_field_values ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read candidate_field_values"
ON public.candidate_field_values FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert candidate_field_values"
ON public.candidate_field_values FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update candidate_field_values"
ON public.candidate_field_values FOR UPDATE TO authenticated USING (true);

-- 6. companies
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read companies"
ON public.companies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage companies"
ON public.companies FOR ALL TO authenticated
USING (get_user_role_name(auth.uid()) IN ('super_admin', 'admin'));

-- 7. departments
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read departments"
ON public.departments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage departments"
ON public.departments FOR ALL TO authenticated
USING (get_user_role_name(auth.uid()) IN ('super_admin', 'admin', 'rh'));

-- 8. positions
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read positions"
ON public.positions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage positions"
ON public.positions FOR ALL TO authenticated
USING (get_user_role_name(auth.uid()) IN ('super_admin', 'admin', 'rh'));

-- 9. employee_positions
ALTER TABLE public.employee_positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read employee_positions"
ON public.employee_positions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage employee_positions"
ON public.employee_positions FOR ALL TO authenticated
USING (get_user_role_name(auth.uid()) IN ('super_admin', 'admin', 'rh'));

-- 10. time_records
ALTER TABLE public.time_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read time_records"
ON public.time_records FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage time_records"
ON public.time_records FOR ALL TO authenticated
USING (get_user_role_name(auth.uid()) IN ('super_admin', 'admin', 'rh'));

-- 11. integration_logs
ALTER TABLE public.integration_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read integration_logs"
ON public.integration_logs FOR SELECT TO authenticated
USING (get_user_role_name(auth.uid()) IN ('super_admin', 'admin'));
CREATE POLICY "Service can insert integration_logs"
ON public.integration_logs FOR INSERT TO authenticated WITH CHECK (true);

-- 12. system_settings
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read system_settings"
ON public.system_settings FOR SELECT TO authenticated
USING (get_user_role_name(auth.uid()) IN ('super_admin', 'admin'));
CREATE POLICY "Admins can manage system_settings"
ON public.system_settings FOR ALL TO authenticated
USING (get_user_role_name(auth.uid()) IN ('super_admin', 'admin'));

-- 13. document_embeddings
ALTER TABLE public.document_embeddings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read document_embeddings"
ON public.document_embeddings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage document_embeddings"
ON public.document_embeddings FOR ALL TO authenticated
USING (get_user_role_name(auth.uid()) IN ('super_admin', 'admin'));

-- 14. vacancies
ALTER TABLE public.vacancies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read vacancies"
ON public.vacancies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert vacancies"
ON public.vacancies FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update vacancies"
ON public.vacancies FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete vacancies"
ON public.vacancies FOR DELETE TO authenticated USING (true);

-- 15. vacancy_fields
ALTER TABLE public.vacancy_fields ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read vacancy_fields"
ON public.vacancy_fields FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert vacancy_fields"
ON public.vacancy_fields FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update vacancy_fields"
ON public.vacancy_fields FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete vacancy_fields"
ON public.vacancy_fields FOR DELETE TO authenticated USING (true);
