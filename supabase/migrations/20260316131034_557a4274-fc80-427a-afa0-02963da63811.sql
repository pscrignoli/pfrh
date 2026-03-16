
-- 1. Clean existing duplicate health_records
DELETE FROM health_records a USING health_records b
WHERE a.id > b.id
  AND a.competencia = b.competencia
  AND COALESCE(a.company_id, '00000000-0000-0000-0000-000000000000') = COALESCE(b.company_id, '00000000-0000-0000-0000-000000000000')
  AND COALESCE(a.fonte, '') = COALESCE(b.fonte, '')
  AND a.nome_beneficiario = b.nome_beneficiario
  AND COALESCE(a.tipo_cobertura, '') = COALESCE(b.tipo_cobertura, '')
  AND COALESCE(a.cpf_beneficiario, '') = COALESCE(b.cpf_beneficiario, '');

-- 2. Clean existing duplicate health_invoices
DELETE FROM health_invoices a USING health_invoices b
WHERE a.id > b.id
  AND a.competencia = b.competencia
  AND COALESCE(a.company_id, '00000000-0000-0000-0000-000000000000') = COALESCE(b.company_id, '00000000-0000-0000-0000-000000000000')
  AND COALESCE(a.health_plan_id, '00000000-0000-0000-0000-000000000000') = COALESCE(b.health_plan_id, '00000000-0000-0000-0000-000000000000');

-- 3. Add unique constraint on health_records
ALTER TABLE health_records
  ADD CONSTRAINT health_records_unique_import
  UNIQUE (competencia, company_id, fonte, nome_beneficiario, tipo_cobertura, cpf_beneficiario);

-- 4. Add unique constraint on health_invoices
ALTER TABLE health_invoices
  ADD CONSTRAINT health_invoices_unique_import
  UNIQUE (competencia, company_id, health_plan_id);
