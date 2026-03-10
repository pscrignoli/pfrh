
CREATE TABLE public.health_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id),
  nome VARCHAR(200) NOT NULL,
  tipo VARCHAR(50) NOT NULL,
  fornecedor VARCHAR(200),
  numero_apolice VARCHAR(100),
  cnpj_fornecedor VARCHAR(18),
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.validate_health_plan_tipo()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.tipo NOT IN ('medico','odontologico','medico_odonto') THEN
    RAISE EXCEPTION 'Invalid tipo: %', NEW.tipo;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_health_plan_tipo
  BEFORE INSERT OR UPDATE ON public.health_plans
  FOR EACH ROW EXECUTE FUNCTION public.validate_health_plan_tipo();

CREATE TABLE public.health_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  health_plan_id UUID REFERENCES public.health_plans(id),
  company_id UUID REFERENCES public.companies(id),
  employee_id UUID REFERENCES public.employees(id),
  competencia DATE NOT NULL,
  nome_beneficiario VARCHAR(300) NOT NULL,
  cpf_beneficiario VARCHAR(14),
  data_nascimento DATE,
  idade INTEGER,
  sexo VARCHAR(10),
  parentesco VARCHAR(50),
  titular_nome VARCHAR(300),
  titular_cpf VARCHAR(14),
  codigo_plano VARCHAR(50),
  descricao_plano VARCHAR(200),
  carteirinha VARCHAR(50),
  data_inicio DATE,
  mensalidade DECIMAL(10,2) DEFAULT 0,
  parte_empresa DECIMAL(10,2) DEFAULT 0,
  parte_colaborador DECIMAL(10,2) DEFAULT 0,
  coparticipacao DECIMAL(10,2) DEFAULT 0,
  taxa_cartao DECIMAL(10,2) DEFAULT 0,
  taxa_inscricao DECIMAL(10,2) DEFAULT 0,
  lancamento_manual DECIMAL(10,2) DEFAULT 0,
  outros DECIMAL(10,2) DEFAULT 0,
  valor_total DECIMAL(10,2) DEFAULT 0,
  tipo_cobertura VARCHAR(20) DEFAULT 'medico',
  fonte VARCHAR(20) DEFAULT 'unimed',
  data_importacao TIMESTAMPTZ DEFAULT now(),
  UNIQUE(health_plan_id, cpf_beneficiario, competencia, tipo_cobertura)
);

CREATE OR REPLACE FUNCTION public.validate_health_record_tipos()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.tipo_cobertura NOT IN ('medico','odontologico') THEN
    RAISE EXCEPTION 'Invalid tipo_cobertura: %', NEW.tipo_cobertura;
  END IF;
  IF NEW.fonte NOT IN ('unimed','bradesco','manual') THEN
    RAISE EXCEPTION 'Invalid fonte: %', NEW.fonte;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_health_record_tipos
  BEFORE INSERT OR UPDATE ON public.health_records
  FOR EACH ROW EXECUTE FUNCTION public.validate_health_record_tipos();

CREATE INDEX idx_health_records_comp ON public.health_records(competencia);
CREATE INDEX idx_health_records_employee ON public.health_records(employee_id);
CREATE INDEX idx_health_records_plan ON public.health_records(health_plan_id);

CREATE TABLE public.health_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  health_plan_id UUID REFERENCES public.health_plans(id),
  company_id UUID REFERENCES public.companies(id),
  competencia DATE NOT NULL,
  total_titulares INTEGER DEFAULT 0,
  total_dependentes INTEGER DEFAULT 0,
  total_vidas INTEGER DEFAULT 0,
  valor_fatura DECIMAL(12,2) DEFAULT 0,
  valor_iof DECIMAL(10,2) DEFAULT 0,
  valor_cobrado DECIMAL(12,2) DEFAULT 0,
  total_parte_empresa DECIMAL(12,2) DEFAULT 0,
  total_parte_colaborador DECIMAL(12,2) DEFAULT 0,
  total_coparticipacao DECIMAL(12,2) DEFAULT 0,
  fonte VARCHAR(20),
  arquivo_nome VARCHAR(300),
  data_importacao TIMESTAMPTZ DEFAULT now(),
  UNIQUE(health_plan_id, competencia)
);

ALTER TABLE public.health_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read health_plans" ON public.health_plans FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert health_plans" ON public.health_plans FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update health_plans" ON public.health_plans FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated read health_records" ON public.health_records FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert health_records" ON public.health_records FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update health_records" ON public.health_records FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete health_records" ON public.health_records FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated read health_invoices" ON public.health_invoices FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert health_invoices" ON public.health_invoices FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update health_invoices" ON public.health_invoices FOR UPDATE TO authenticated USING (true);

INSERT INTO public.health_plans (company_id, nome, tipo, fornecedor, numero_apolice, cnpj_fornecedor)
VALUES
  ((SELECT id FROM public.companies WHERE name='P&F'), 'Unimed SJR Preto', 'medico', 'Unimed', '1643', null),
  ((SELECT id FROM public.companies WHERE name='P&F'), 'Bradesco Saude', 'medico_odonto', 'Bradesco', '3000859766', '92.693.118/0001-60');
