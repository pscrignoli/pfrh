
CREATE TABLE public.ferias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.companies(id),
  periodo_aquisitivo_inicio date NOT NULL,
  periodo_aquisitivo_fim date NOT NULL,
  data_inicio date,
  data_fim date,
  dias_gozo integer NOT NULL DEFAULT 30,
  dias_abono integer NOT NULL DEFAULT 0,
  abono_pecuniario boolean NOT NULL DEFAULT false,
  adiantamento_13 boolean NOT NULL DEFAULT false,
  status varchar NOT NULL DEFAULT 'pendente',
  valor_bruto numeric DEFAULT 0,
  valor_inss numeric DEFAULT 0,
  valor_irrf numeric DEFAULT 0,
  valor_liquido numeric DEFAULT 0,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ferias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read ferias"
  ON public.ferias FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert ferias"
  ON public.ferias FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update ferias"
  ON public.ferias FOR UPDATE TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete ferias"
  ON public.ferias FOR DELETE TO authenticated
  USING (true);
