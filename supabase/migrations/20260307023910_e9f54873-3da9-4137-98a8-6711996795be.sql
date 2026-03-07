
CREATE TABLE public.vaga_descricoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  titulo_cargo VARCHAR(500) NOT NULL,
  departamento VARCHAR(200),
  nivel_hierarquico VARCHAR(50),
  descricao_html TEXT NOT NULL,
  requisitos_html TEXT,
  descricao_ia_original TEXT,
  beneficios JSONB DEFAULT '[]'::jsonb,
  faixa_salarial_min DECIMAL,
  faixa_salarial_max DECIMAL,
  nivel_ingles VARCHAR(50),
  modalidade VARCHAR(50),
  normas_regulatorias JSONB DEFAULT '[]'::jsonb,
  empregare_vaga_id INTEGER,
  fonte VARCHAR(20) DEFAULT 'manual',
  aprovada BOOLEAN DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_vaga_desc_cargo ON vaga_descricoes(titulo_cargo);
CREATE INDEX idx_vaga_desc_depto ON vaga_descricoes(departamento);
CREATE INDEX idx_vaga_desc_company ON vaga_descricoes(company_id);

ALTER TABLE vaga_descricoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read vaga_descricoes"
  ON vaga_descricoes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert vaga_descricoes"
  ON vaga_descricoes FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update vaga_descricoes"
  ON vaga_descricoes FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete vaga_descricoes"
  ON vaga_descricoes FOR DELETE TO authenticated USING (true);

-- Populate from existing Empregare vagas
INSERT INTO vaga_descricoes (titulo_cargo, departamento, descricao_html, requisitos_html, empregare_vaga_id, fonte, company_id, aprovada)
SELECT ev.titulo, d.name, ev.descricao, ev.requisitos, ev.empregare_id, 'empregare', ev.company_id, true
FROM empregare_vagas ev
LEFT JOIN departments d ON d.id = ev.department_id
WHERE ev.descricao IS NOT NULL AND ev.descricao != '';
