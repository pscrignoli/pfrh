
-- ===== candidates =====
DROP POLICY IF EXISTS "Authenticated can delete candidates" ON public.candidates;
DROP POLICY IF EXISTS "Authenticated can insert candidates" ON public.candidates;
DROP POLICY IF EXISTS "Authenticated can read candidates" ON public.candidates;
DROP POLICY IF EXISTS "Authenticated can update candidates" ON public.candidates;

CREATE POLICY "Authenticated can read candidates" ON public.candidates
FOR SELECT TO authenticated USING (true);

CREATE POLICY "RH can insert candidates" ON public.candidates
FOR INSERT TO authenticated
WITH CHECK (get_user_role_name(auth.uid()) IN ('super_admin','admin','rh'));

CREATE POLICY "RH can update candidates" ON public.candidates
FOR UPDATE TO authenticated
USING (get_user_role_name(auth.uid()) IN ('super_admin','admin','rh'));

CREATE POLICY "RH can delete candidates" ON public.candidates
FOR DELETE TO authenticated
USING (get_user_role_name(auth.uid()) IN ('super_admin','admin','rh'));

-- ===== candidate_field_values =====
DROP POLICY IF EXISTS "Authenticated can insert candidate_field_values" ON public.candidate_field_values;
DROP POLICY IF EXISTS "Authenticated can read candidate_field_values" ON public.candidate_field_values;
DROP POLICY IF EXISTS "Authenticated can update candidate_field_values" ON public.candidate_field_values;

CREATE POLICY "Authenticated can read candidate_field_values" ON public.candidate_field_values
FOR SELECT TO authenticated USING (true);

CREATE POLICY "RH can insert candidate_field_values" ON public.candidate_field_values
FOR INSERT TO authenticated
WITH CHECK (get_user_role_name(auth.uid()) IN ('super_admin','admin','rh'));

CREATE POLICY "RH can update candidate_field_values" ON public.candidate_field_values
FOR UPDATE TO authenticated
USING (get_user_role_name(auth.uid()) IN ('super_admin','admin','rh'));

-- ===== vacancies =====
DROP POLICY IF EXISTS "Authenticated can delete vacancies" ON public.vacancies;
DROP POLICY IF EXISTS "Authenticated can insert vacancies" ON public.vacancies;
DROP POLICY IF EXISTS "Authenticated can read vacancies" ON public.vacancies;
DROP POLICY IF EXISTS "Authenticated can update vacancies" ON public.vacancies;

CREATE POLICY "Authenticated can read vacancies" ON public.vacancies
FOR SELECT TO authenticated USING (true);

CREATE POLICY "RH can insert vacancies" ON public.vacancies
FOR INSERT TO authenticated
WITH CHECK (get_user_role_name(auth.uid()) IN ('super_admin','admin','rh'));

CREATE POLICY "RH can update vacancies" ON public.vacancies
FOR UPDATE TO authenticated
USING (get_user_role_name(auth.uid()) IN ('super_admin','admin','rh'));

CREATE POLICY "RH can delete vacancies" ON public.vacancies
FOR DELETE TO authenticated
USING (get_user_role_name(auth.uid()) IN ('super_admin','admin','rh'));

-- ===== vacancy_fields =====
DROP POLICY IF EXISTS "Authenticated can delete vacancy_fields" ON public.vacancy_fields;
DROP POLICY IF EXISTS "Authenticated can insert vacancy_fields" ON public.vacancy_fields;
DROP POLICY IF EXISTS "Authenticated can read vacancy_fields" ON public.vacancy_fields;
DROP POLICY IF EXISTS "Authenticated can update vacancy_fields" ON public.vacancy_fields;

CREATE POLICY "Authenticated can read vacancy_fields" ON public.vacancy_fields
FOR SELECT TO authenticated USING (true);

CREATE POLICY "RH can insert vacancy_fields" ON public.vacancy_fields
FOR INSERT TO authenticated
WITH CHECK (get_user_role_name(auth.uid()) IN ('super_admin','admin','rh'));

CREATE POLICY "RH can update vacancy_fields" ON public.vacancy_fields
FOR UPDATE TO authenticated
USING (get_user_role_name(auth.uid()) IN ('super_admin','admin','rh'));

CREATE POLICY "RH can delete vacancy_fields" ON public.vacancy_fields
FOR DELETE TO authenticated
USING (get_user_role_name(auth.uid()) IN ('super_admin','admin','rh'));
