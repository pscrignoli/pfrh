
-- 1. Create companies table
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  cnpj VARCHAR(18) UNIQUE,
  razao_social VARCHAR(300),
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Validation trigger instead of CHECK constraint
CREATE OR REPLACE FUNCTION public.validate_company_status()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status NOT IN ('active', 'inactive') THEN
    RAISE EXCEPTION 'Invalid status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_company_status
  BEFORE INSERT OR UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.validate_company_status();

ALTER TABLE public.companies DISABLE ROW LEVEL SECURITY;

-- Seed companies
INSERT INTO public.companies (name) VALUES ('P&F'), ('Biocollagen');

-- 2. Add company_id FK to tables
ALTER TABLE public.employees ADD COLUMN company_id UUID REFERENCES public.companies(id);
CREATE INDEX idx_employees_company ON public.employees(company_id);

ALTER TABLE public.departments ADD COLUMN company_id UUID REFERENCES public.companies(id);
CREATE INDEX idx_departments_company ON public.departments(company_id);

ALTER TABLE public.positions ADD COLUMN company_id UUID REFERENCES public.companies(id);
CREATE INDEX idx_positions_company ON public.positions(company_id);

ALTER TABLE public.vacancies ADD COLUMN company_id UUID REFERENCES public.companies(id);
CREATE INDEX idx_vacancies_company ON public.vacancies(company_id);

ALTER TABLE public.payroll_monthly_records ADD COLUMN company_id UUID REFERENCES public.companies(id);
CREATE INDEX idx_payroll_monthly_records_company ON public.payroll_monthly_records(company_id);

ALTER TABLE public.integration_logs ADD COLUMN company_id UUID REFERENCES public.companies(id);
CREATE INDEX idx_integration_logs_company ON public.integration_logs(company_id);

-- 3. Migrate existing data
UPDATE public.employees SET company_id = c.id FROM public.companies c
  WHERE LOWER(employees.empresa) LIKE '%' || LOWER(c.name) || '%';

UPDATE public.payroll_monthly_records SET company_id = c.id FROM public.companies c
  WHERE LOWER(payroll_monthly_records.empresa) LIKE '%' || LOWER(c.name) || '%';

-- 4. Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.companies;
