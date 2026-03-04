
-- Drop all existing policies on vacancies
DROP POLICY IF EXISTS "RH e DP gerenciam vagas" ON public.vacancies;
DROP POLICY IF EXISTS "Super admin full access vacancies" ON public.vacancies;
DROP POLICY IF EXISTS "Financeiro le vagas" ON public.vacancies;

-- Drop all existing policies on candidates
DROP POLICY IF EXISTS "RH e DP gerenciam candidatos" ON public.candidates;
DROP POLICY IF EXISTS "Super admin full access candidates" ON public.candidates;
DROP POLICY IF EXISTS "Financeiro le candidatos" ON public.candidates;

-- Open access for all authenticated users
CREATE POLICY "Authenticated full access vacancies"
ON public.vacancies FOR ALL TO authenticated
USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated full access candidates"
ON public.candidates FOR ALL TO authenticated
USING (true) WITH CHECK (true);
