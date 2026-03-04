
-- Create work_model enum
CREATE TYPE public.work_model AS ENUM ('presencial', 'hibrido', 'remoto');

-- Create vacancy_status enum
CREATE TYPE public.vacancy_status AS ENUM ('aberta', 'pausada', 'fechada');

-- Create candidate_stage enum
CREATE TYPE public.candidate_stage AS ENUM ('novos', 'triagem', 'entrevista_rh', 'entrevista_gestor', 'aprovado');

-- Create vacancies table
CREATE TABLE public.vacancies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title VARCHAR NOT NULL,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  work_model work_model NOT NULL DEFAULT 'presencial',
  status vacancy_status NOT NULL DEFAULT 'aberta',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create candidates table
CREATE TABLE public.candidates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vacancy_id UUID NOT NULL REFERENCES public.vacancies(id) ON DELETE CASCADE,
  name VARCHAR NOT NULL,
  email VARCHAR,
  phone VARCHAR,
  stage candidate_stage NOT NULL DEFAULT 'novos',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.vacancies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;

-- Vacancies RLS
CREATE POLICY "RH e DP gerenciam vagas"
ON public.vacancies FOR ALL
USING (has_role(auth.uid(), 'admin_rh'::app_role) OR has_role(auth.uid(), 'assistente_dp'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin_rh'::app_role) OR has_role(auth.uid(), 'assistente_dp'::app_role));

CREATE POLICY "Super admin full access vacancies"
ON public.vacancies FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Financeiro le vagas"
ON public.vacancies FOR SELECT
USING (has_role(auth.uid(), 'gestor_financeiro'::app_role));

-- Candidates RLS
CREATE POLICY "RH e DP gerenciam candidatos"
ON public.candidates FOR ALL
USING (has_role(auth.uid(), 'admin_rh'::app_role) OR has_role(auth.uid(), 'assistente_dp'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin_rh'::app_role) OR has_role(auth.uid(), 'assistente_dp'::app_role));

CREATE POLICY "Super admin full access candidates"
ON public.candidates FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Financeiro le candidatos"
ON public.candidates FOR SELECT
USING (has_role(auth.uid(), 'gestor_financeiro'::app_role));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.vacancies;
ALTER PUBLICATION supabase_realtime ADD TABLE public.candidates;
