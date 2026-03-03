
-- =============================================
-- 1. ENUM E SISTEMA RBAC
-- =============================================
CREATE TYPE public.app_role AS ENUM ('admin_rh', 'gestor_financeiro', 'assistente_dp');
CREATE TYPE public.employee_status AS ENUM ('ativo', 'inativo', 'ferias', 'afastado', 'desligado');
CREATE TYPE public.contract_type AS ENUM ('clt', 'pj', 'estagio', 'temporario', 'aprendiz');
CREATE TYPE public.gender_type AS ENUM ('masculino', 'feminino', 'outro', 'nao_informado');
CREATE TYPE public.integration_status AS ENUM ('pending', 'success', 'error');

-- Tabela de papéis
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Função SECURITY DEFINER para checar papel sem recursão RLS
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Função auxiliar: checar qualquer papel
CREATE OR REPLACE FUNCTION public.has_any_role(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
  )
$$;

-- RLS para user_roles
CREATE POLICY "Admins podem gerenciar roles"
ON public.user_roles FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin_rh'));

CREATE POLICY "Usuarios veem seus proprios roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- =============================================
-- 2. TABELA DE COLABORADORES (employees)
-- =============================================
CREATE TABLE public.employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    
    -- Identificação corporativa
    matricula_esocial VARCHAR(20),
    matricula_interna VARCHAR(20),
    nome_completo VARCHAR(200) NOT NULL,
    status employee_status NOT NULL DEFAULT 'ativo',
    
    -- Datas
    data_admissao DATE NOT NULL,
    data_nascimento DATE,
    
    -- Empresa e estrutura
    empresa VARCHAR(150),
    departamento VARCHAR(150),
    cargo VARCHAR(150),
    
    -- Documentos
    numero_rg VARCHAR(20),
    numero_cpf VARCHAR(14) UNIQUE NOT NULL,
    ctps VARCHAR(30),
    numero_pis_nit VARCHAR(20),
    
    -- Dados pessoais
    genero gender_type DEFAULT 'nao_informado',
    telefone VARCHAR(20),
    telefone_emergencia VARCHAR(20),
    nome_contato_emergencia VARCHAR(200),
    grau_parentesco VARCHAR(50),
    
    -- Contrato e jornada
    tipo_contrato contract_type NOT NULL DEFAULT 'clt',
    jornada_semanal NUMERIC(4,1) DEFAULT 44.0,
    
    -- Comunicação
    email_holerite VARCHAR(200),
    
    -- Auditoria
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- Índices para employees
CREATE INDEX idx_employees_cpf ON public.employees(numero_cpf);
CREATE INDEX idx_employees_empresa ON public.employees(empresa);
CREATE INDEX idx_employees_departamento ON public.employees(departamento);
CREATE INDEX idx_employees_status ON public.employees(status);
CREATE INDEX idx_employees_matricula_interna ON public.employees(matricula_interna);

-- =============================================
-- 3. CARGOS E HISTÓRICO DE POSIÇÕES
-- =============================================
CREATE TABLE public.positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(150) NOT NULL,
    department VARCHAR(150),
    base_salary NUMERIC(12,2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.employee_positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE NOT NULL,
    position_id UUID REFERENCES public.positions(id) NOT NULL,
    salary NUMERIC(12,2) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    is_current BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.employee_positions ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_emp_positions_employee ON public.employee_positions(employee_id);
CREATE INDEX idx_emp_positions_current ON public.employee_positions(is_current) WHERE is_current = true;

-- =============================================
-- 4. REGISTROS DE PONTO (time_records)
-- =============================================
CREATE TABLE public.time_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE NOT NULL,
    external_id VARCHAR(100) UNIQUE,
    record_date DATE NOT NULL,
    clock_in TIMESTAMPTZ,
    clock_out TIMESTAMPTZ,
    break_start TIMESTAMPTZ,
    break_end TIMESTAMPTZ,
    total_hours NUMERIC(5,2),
    overtime_hours NUMERIC(5,2) DEFAULT 0,
    night_hours NUMERIC(5,2) DEFAULT 0,
    source VARCHAR(50) DEFAULT 'api',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.time_records ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_time_records_employee_date ON public.time_records(employee_id, record_date);
CREATE INDEX idx_time_records_date ON public.time_records(record_date);

-- =============================================
-- 5. FECHAMENTO DA FOLHA (payroll_monthly_records)
-- =============================================
CREATE TABLE public.payroll_monthly_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE NOT NULL,
    
    -- Identificação do período
    empresa VARCHAR(150),
    ano INTEGER NOT NULL,
    mes INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
    
    -- Dados do contrato na época
    tipo_contrato contract_type,
    contrato_empregado VARCHAR(50),
    relacao_funcionarios VARCHAR(200),
    admissao DATE,
    desligamento DATE,
    
    -- Centro de custo
    codigo_centro_custo VARCHAR(20),
    centro_custo VARCHAR(150),
    area VARCHAR(150),
    cargo VARCHAR(150),
    
    -- Salário
    salario_base NUMERIC(12,2) DEFAULT 0,
    salario NUMERIC(12,2) DEFAULT 0,
    diferenca_salario NUMERIC(12,2) DEFAULT 0,
    
    -- Horas e adicionais
    hora_50 NUMERIC(12,2) DEFAULT 0,
    hora_60 NUMERIC(12,2) DEFAULT 0,
    hora_80 NUMERIC(12,2) DEFAULT 0,
    hora_100 NUMERIC(12,2) DEFAULT 0,
    dsr_horas NUMERIC(12,2) DEFAULT 0,
    adicional_noturno NUMERIC(12,2) DEFAULT 0,
    bonus_gratificacao NUMERIC(12,2) DEFAULT 0,
    salario_familia NUMERIC(12,2) DEFAULT 0,
    insalubridade NUMERIC(12,2) DEFAULT 0,
    auxilio_alimentacao NUMERIC(12,2) DEFAULT 0,
    vale_transporte NUMERIC(12,2) DEFAULT 0,
    ajuda_de_custo NUMERIC(12,2) DEFAULT 0,
    
    -- Descontos e retenções
    soma NUMERIC(12,2) DEFAULT 0,
    desconto_vale_transporte NUMERIC(12,2) DEFAULT 0,
    falta NUMERIC(12,2) DEFAULT 0,
    fgts_8 NUMERIC(12,2) DEFAULT 0,
    inss_20 NUMERIC(12,2) DEFAULT 0,
    
    -- Provisões
    total_folha NUMERIC(12,2) DEFAULT 0,
    avos_ferias NUMERIC(6,2) DEFAULT 0,
    ferias NUMERIC(12,2) DEFAULT 0,
    terco_ferias NUMERIC(12,2) DEFAULT 0,
    fgts_ferias NUMERIC(12,2) DEFAULT 0,
    inss_ferias NUMERIC(12,2) DEFAULT 0,
    decimo_terceiro NUMERIC(12,2) DEFAULT 0,
    inss_13 NUMERIC(12,2) DEFAULT 0,
    fgts_13 NUMERIC(12,2) DEFAULT 0,
    he_total NUMERIC(12,2) DEFAULT 0,
    
    -- Benefícios
    convenio_medico NUMERIC(12,2) DEFAULT 0,
    plano_odontologico NUMERIC(12,2) DEFAULT 0,
    plano_odontologico_empresa NUMERIC(12,2) DEFAULT 0,
    vr_alimentacao NUMERIC(12,2) DEFAULT 0,
    vr_auto NUMERIC(12,2) DEFAULT 0,
    
    -- Consolidação Controladoria
    salario_gratificacao NUMERIC(12,2) DEFAULT 0,
    ferias_13 NUMERIC(12,2) DEFAULT 0,
    encargos NUMERIC(12,2) DEFAULT 0,
    beneficios NUMERIC(12,2) DEFAULT 0,
    total_geral NUMERIC(12,2) DEFAULT 0,
    
    -- Status e auditoria
    status VARCHAR(30) DEFAULT 'aberto',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE(employee_id, ano, mes)
);
ALTER TABLE public.payroll_monthly_records ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_payroll_employee ON public.payroll_monthly_records(employee_id);
CREATE INDEX idx_payroll_periodo ON public.payroll_monthly_records(ano, mes);
CREATE INDEX idx_payroll_empresa ON public.payroll_monthly_records(empresa);
CREATE INDEX idx_payroll_cc ON public.payroll_monthly_records(codigo_centro_custo);

-- =============================================
-- 6. LOGS DE INTEGRAÇÃO
-- =============================================
CREATE TABLE public.integration_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    direction VARCHAR(10) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    source VARCHAR(100) NOT NULL,
    endpoint VARCHAR(500),
    status integration_status NOT NULL DEFAULT 'pending',
    request_payload JSONB,
    response_payload JSONB,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.integration_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_integration_logs_status ON public.integration_logs(status);
CREATE INDEX idx_integration_logs_created ON public.integration_logs(created_at DESC);

-- =============================================
-- 7. EMBEDDINGS PARA IA (preparação pgvector)
-- =============================================
CREATE TABLE public.document_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    source_document VARCHAR(500),
    -- embedding VECTOR(1536), -- descomentar quando pgvector estiver habilitado
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.document_embeddings ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 8. TRIGGER DE UPDATED_AT
-- =============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_employees_updated_at
BEFORE UPDATE ON public.employees
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_payroll_updated_at
BEFORE UPDATE ON public.payroll_monthly_records
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- 9. POLÍTICAS RLS COMPLETAS
-- =============================================

-- EMPLOYEES: admin_rh e assistente_dp podem tudo; gestor_financeiro só lê
CREATE POLICY "RH e DP gerenciam colaboradores"
ON public.employees FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin_rh') OR public.has_role(auth.uid(), 'assistente_dp'));

CREATE POLICY "Financeiro le colaboradores"
ON public.employees FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'gestor_financeiro'));

-- POSITIONS: admin_rh gerencia; outros leem
CREATE POLICY "RH gerencia cargos"
ON public.positions FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin_rh'));

CREATE POLICY "Usuarios autorizados leem cargos"
ON public.positions FOR SELECT TO authenticated
USING (public.has_any_role(auth.uid()));

-- EMPLOYEE_POSITIONS: admin_rh e assistente_dp gerenciam; financeiro lê
CREATE POLICY "RH e DP gerenciam posicoes"
ON public.employee_positions FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin_rh') OR public.has_role(auth.uid(), 'assistente_dp'));

CREATE POLICY "Financeiro le posicoes"
ON public.employee_positions FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'gestor_financeiro'));

-- TIME_RECORDS: admin_rh e assistente_dp gerenciam; financeiro lê
CREATE POLICY "RH e DP gerenciam ponto"
ON public.time_records FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin_rh') OR public.has_role(auth.uid(), 'assistente_dp'));

CREATE POLICY "Financeiro le ponto"
ON public.time_records FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'gestor_financeiro'));

-- PAYROLL: admin_rh e gestor_financeiro gerenciam; assistente_dp lê
CREATE POLICY "RH e Financeiro gerenciam folha"
ON public.payroll_monthly_records FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin_rh') OR public.has_role(auth.uid(), 'gestor_financeiro'));

CREATE POLICY "DP le folha"
ON public.payroll_monthly_records FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'assistente_dp'));

-- INTEGRATION_LOGS: admin_rh gerencia tudo; financeiro lê
CREATE POLICY "Admin gerencia logs"
ON public.integration_logs FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin_rh'));

CREATE POLICY "Financeiro le logs"
ON public.integration_logs FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'gestor_financeiro'));

-- DOCUMENT_EMBEDDINGS: admin_rh gerencia
CREATE POLICY "Admin gerencia embeddings"
ON public.document_embeddings FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin_rh'));

CREATE POLICY "Usuarios autorizados leem embeddings"
ON public.document_embeddings FOR SELECT TO authenticated
USING (public.has_any_role(auth.uid()));

-- =============================================
-- 10. HABILITAR REALTIME
-- =============================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.time_records;
ALTER PUBLICATION supabase_realtime ADD TABLE public.payroll_monthly_records;
ALTER PUBLICATION supabase_realtime ADD TABLE public.integration_logs;
