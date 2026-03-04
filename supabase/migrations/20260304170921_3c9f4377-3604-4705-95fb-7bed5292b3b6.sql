
-- Add numero_funcional to employees for TXT import matching
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS numero_funcional character varying;

-- Make numero_cpf nullable (TXT imports don't have CPF, filled manually later)
ALTER TABLE public.employees ALTER COLUMN numero_cpf DROP NOT NULL;

-- Unique constraint: one numero_funcional per company
CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_numero_funcional_company 
ON public.employees (numero_funcional, company_id) 
WHERE numero_funcional IS NOT NULL;
