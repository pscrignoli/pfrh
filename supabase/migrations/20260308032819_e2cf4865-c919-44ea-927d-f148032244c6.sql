
-- Role definitions table
CREATE TABLE role_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) UNIQUE NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Role permissions matrix
CREATE TABLE role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID REFERENCES role_definitions(id) ON DELETE CASCADE NOT NULL,
  module VARCHAR(100) NOT NULL,
  can_view BOOLEAN DEFAULT false,
  can_edit BOOLEAN DEFAULT false,
  UNIQUE(role_id, module)
);

-- User profiles
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  full_name VARCHAR(300),
  role_id UUID REFERENCES role_definitions(id),
  company_id UUID REFERENCES companies(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE role_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Helper functions (SECURITY DEFINER to bypass RLS)
CREATE OR REPLACE FUNCTION get_user_role_name(_user_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rd.name FROM role_definitions rd
  JOIN user_profiles up ON up.role_id = rd.id
  WHERE up.user_id = _user_id
$$;

CREATE OR REPLACE FUNCTION user_can_view_module(_user_id UUID, _module TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT rp.can_view FROM role_permissions rp
     JOIN user_profiles up ON up.role_id = rp.role_id
     WHERE up.user_id = _user_id AND rp.module = _module),
    false
  )
$$;

CREATE OR REPLACE FUNCTION user_can_edit_module(_user_id UUID, _module TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT rp.can_edit FROM role_permissions rp
     JOIN user_profiles up ON up.role_id = rp.role_id
     WHERE up.user_id = _user_id AND rp.module = _module),
    false
  )
$$;

-- RLS Policies: role_definitions (readable by all authenticated)
CREATE POLICY "read_role_definitions" ON role_definitions FOR SELECT TO authenticated USING (true);

-- RLS Policies: role_permissions (readable by all, writable by admins)
CREATE POLICY "read_role_permissions" ON role_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_insert_role_permissions" ON role_permissions FOR INSERT TO authenticated
  WITH CHECK (get_user_role_name(auth.uid()) IN ('super_admin', 'admin'));
CREATE POLICY "admin_update_role_permissions" ON role_permissions FOR UPDATE TO authenticated
  USING (get_user_role_name(auth.uid()) IN ('super_admin', 'admin'));
CREATE POLICY "admin_delete_role_permissions" ON role_permissions FOR DELETE TO authenticated
  USING (get_user_role_name(auth.uid()) IN ('super_admin', 'admin'));

-- RLS Policies: user_profiles
CREATE POLICY "read_user_profiles" ON user_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_user_profiles" ON user_profiles FOR INSERT TO authenticated
  WITH CHECK (
    get_user_role_name(auth.uid()) IN ('super_admin', 'admin')
    OR (user_id = auth.uid() AND role_id IS NULL)
  );
CREATE POLICY "update_user_profiles" ON user_profiles FOR UPDATE TO authenticated
  USING (
    get_user_role_name(auth.uid()) IN ('super_admin', 'admin')
    OR user_id = auth.uid()
  );

-- Seed role definitions
INSERT INTO role_definitions (name, display_name, description, is_system) VALUES
  ('super_admin', 'Super Admin', 'Acesso total. Pode criar Admins e SuperAdmins.', true),
  ('admin', 'Admin', 'Acesso total. Pode criar users e admins (não SuperAdmins).', true),
  ('rh', 'RH', 'Acesso operacional completo.', true),
  ('diretoria', 'Diretoria', 'Visualiza tudo, não edita.', true),
  ('financeiro', 'Financeiro', 'Acesso restrito a módulos financeiros.', true);

-- Seed permission matrix (75 rows = 5 roles x 15 modules)
DO $$
DECLARE
  r_sa UUID;
  r_admin UUID;
  r_rh UUID;
  r_dir UUID;
  r_fin UUID;
BEGIN
  SELECT id INTO r_sa FROM role_definitions WHERE name = 'super_admin';
  SELECT id INTO r_admin FROM role_definitions WHERE name = 'admin';
  SELECT id INTO r_rh FROM role_definitions WHERE name = 'rh';
  SELECT id INTO r_dir FROM role_definitions WHERE name = 'diretoria';
  SELECT id INTO r_fin FROM role_definitions WHERE name = 'financeiro';

  -- super_admin: all V+E
  INSERT INTO role_permissions (role_id, module, can_view, can_edit) VALUES
    (r_sa, 'dashboard', true, true), (r_sa, 'colaboradores', true, true),
    (r_sa, 'colaboradores.formacao', true, true), (r_sa, 'folha', true, true),
    (r_sa, 'folha.custo', true, true), (r_sa, 'controladoria', true, true),
    (r_sa, 'ferias', true, true), (r_sa, 'recrutamento', true, true),
    (r_sa, 'recrutamento.ia', true, true), (r_sa, 'simulador', true, true),
    (r_sa, 'aniversariantes', true, true), (r_sa, 'configuracoes', true, true),
    (r_sa, 'configuracoes.integracoes', true, true), (r_sa, 'configuracoes.acessos', true, true),
    (r_sa, 'configuracoes.usuarios', true, true);

  -- admin: all V+E
  INSERT INTO role_permissions (role_id, module, can_view, can_edit) VALUES
    (r_admin, 'dashboard', true, true), (r_admin, 'colaboradores', true, true),
    (r_admin, 'colaboradores.formacao', true, true), (r_admin, 'folha', true, true),
    (r_admin, 'folha.custo', true, true), (r_admin, 'controladoria', true, true),
    (r_admin, 'ferias', true, true), (r_admin, 'recrutamento', true, true),
    (r_admin, 'recrutamento.ia', true, true), (r_admin, 'simulador', true, true),
    (r_admin, 'aniversariantes', true, true), (r_admin, 'configuracoes', true, true),
    (r_admin, 'configuracoes.integracoes', true, true), (r_admin, 'configuracoes.acessos', true, true),
    (r_admin, 'configuracoes.usuarios', true, true);

  -- rh: operational access, config view-only, no access to acessos/usuarios
  INSERT INTO role_permissions (role_id, module, can_view, can_edit) VALUES
    (r_rh, 'dashboard', true, true), (r_rh, 'colaboradores', true, true),
    (r_rh, 'colaboradores.formacao', true, true), (r_rh, 'folha', true, true),
    (r_rh, 'folha.custo', true, true), (r_rh, 'controladoria', true, true),
    (r_rh, 'ferias', true, true), (r_rh, 'recrutamento', true, true),
    (r_rh, 'recrutamento.ia', true, true), (r_rh, 'simulador', true, true),
    (r_rh, 'aniversariantes', true, true), (r_rh, 'configuracoes', true, false),
    (r_rh, 'configuracoes.integracoes', true, false), (r_rh, 'configuracoes.acessos', false, false),
    (r_rh, 'configuracoes.usuarios', false, false);

  -- diretoria: view-only on operational, no config access
  INSERT INTO role_permissions (role_id, module, can_view, can_edit) VALUES
    (r_dir, 'dashboard', true, false), (r_dir, 'colaboradores', true, false),
    (r_dir, 'colaboradores.formacao', true, false), (r_dir, 'folha', true, false),
    (r_dir, 'folha.custo', true, false), (r_dir, 'controladoria', true, false),
    (r_dir, 'ferias', true, false), (r_dir, 'recrutamento', true, false),
    (r_dir, 'recrutamento.ia', true, false), (r_dir, 'simulador', true, false),
    (r_dir, 'aniversariantes', true, false), (r_dir, 'configuracoes', false, false),
    (r_dir, 'configuracoes.integracoes', false, false), (r_dir, 'configuracoes.acessos', false, false),
    (r_dir, 'configuracoes.usuarios', false, false);

  -- financeiro: restricted view-only
  INSERT INTO role_permissions (role_id, module, can_view, can_edit) VALUES
    (r_fin, 'dashboard', true, false), (r_fin, 'colaboradores', false, false),
    (r_fin, 'colaboradores.formacao', false, false), (r_fin, 'folha', false, false),
    (r_fin, 'folha.custo', true, false), (r_fin, 'controladoria', true, false),
    (r_fin, 'ferias', false, false), (r_fin, 'recrutamento', false, false),
    (r_fin, 'recrutamento.ia', false, false), (r_fin, 'simulador', false, false),
    (r_fin, 'aniversariantes', true, false), (r_fin, 'configuracoes', false, false),
    (r_fin, 'configuracoes.integracoes', false, false), (r_fin, 'configuracoes.acessos', false, false),
    (r_fin, 'configuracoes.usuarios', false, false);

  -- Migrate existing user_roles to user_profiles
  INSERT INTO user_profiles (user_id, role_id)
  SELECT ur.user_id, rd.id
  FROM user_roles ur
  JOIN role_definitions rd ON rd.name =
    CASE ur.role::text
      WHEN 'super_admin' THEN 'super_admin'
      WHEN 'admin_rh' THEN 'admin'
      WHEN 'gestor_financeiro' THEN 'financeiro'
      WHEN 'assistente_dp' THEN 'rh'
    END
  ON CONFLICT (user_id) DO NOTHING;
END $$;
