
CREATE TABLE public.rescisao_simulacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.companies(id),
  data_simulacao timestamptz NOT NULL DEFAULT now(),
  tipo_rescisao varchar NOT NULL,
  data_demissao date NOT NULL,
  valores_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  simulado_por uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rescisao_simulacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read rescisao_simulacoes"
  ON public.rescisao_simulacoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert rescisao_simulacoes"
  ON public.rescisao_simulacoes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can delete rescisao_simulacoes"
  ON public.rescisao_simulacoes FOR DELETE TO authenticated USING (true);
