
-- Add empregare_setor_id to departments
ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS empregare_setor_id INTEGER UNIQUE;

-- Company mapping table
CREATE TABLE public.empregare_company_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empregare_filial_id INTEGER UNIQUE NOT NULL,
  empregare_unidade_id INTEGER NOT NULL,
  empregare_titulo VARCHAR(200),
  company_id UUID REFERENCES public.companies(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.empregare_company_map ENABLE ROW LEVEL SECURITY;

-- Empregare vagas
CREATE TABLE public.empregare_vagas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empregare_id INTEGER UNIQUE NOT NULL,
  company_id UUID REFERENCES public.companies(id),
  department_id UUID REFERENCES public.departments(id),
  titulo VARCHAR(500),
  descricao TEXT,
  requisitos TEXT,
  situacao VARCHAR(50),
  tipo_recrutamento VARCHAR(50),
  trabalho_remoto VARCHAR(50),
  salario_min DECIMAL,
  salario_max DECIMAL,
  salario_combinar BOOLEAN DEFAULT false,
  total_vagas INTEGER DEFAULT 1,
  cidade VARCHAR(200),
  estado VARCHAR(5),
  horario VARCHAR(200),
  meta_encerramento DATE,
  requisicao_id INTEGER,
  beneficios JSONB DEFAULT '[]',
  etapas JSONB DEFAULT '[]',
  responsaveis JSONB DEFAULT '[]',
  data_cadastro TIMESTAMPTZ,
  data_sync TIMESTAMPTZ DEFAULT now(),
  raw_json JSONB
);

ALTER TABLE public.empregare_vagas ENABLE ROW LEVEL SECURITY;

-- Empregare candidatos
CREATE TABLE public.empregare_candidatos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empregare_pessoa_id INTEGER NOT NULL,
  empregare_vaga_id INTEGER REFERENCES public.empregare_vagas(empregare_id),
  company_id UUID REFERENCES public.companies(id),
  nome VARCHAR(300),
  email VARCHAR(200),
  telefone VARCHAR(50),
  cidade VARCHAR(200),
  estado VARCHAR(5),
  etapa_atual VARCHAR(100),
  status VARCHAR(50) DEFAULT 'ativo',
  data_contratacao DATE,
  curriculo_url VARCHAR(500),
  curriculo_json JSONB,
  marcadores JSONB DEFAULT '[]',
  data_sync TIMESTAMPTZ DEFAULT now(),
  UNIQUE(empregare_pessoa_id, empregare_vaga_id)
);

ALTER TABLE public.empregare_candidatos ENABLE ROW LEVEL SECURITY;

-- Kanban cards for local tracking
CREATE TABLE public.empregare_kanban_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empregare_vaga_id INTEGER NOT NULL,
  empregare_pessoa_id INTEGER,
  company_id UUID REFERENCES public.companies(id),
  nome VARCHAR(300) NOT NULL,
  email VARCHAR(200),
  telefone VARCHAR(50),
  etapa_atual VARCHAR(100) NOT NULL,
  etapa_ordem INTEGER DEFAULT 0,
  observacao TEXT,
  origem VARCHAR(20) DEFAULT 'manual',
  data_entrada_etapa TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.empregare_kanban_cards ENABLE ROW LEVEL SECURITY;

-- Enable realtime for empregare_vagas
ALTER PUBLICATION supabase_realtime ADD TABLE public.empregare_vagas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.empregare_kanban_cards;
