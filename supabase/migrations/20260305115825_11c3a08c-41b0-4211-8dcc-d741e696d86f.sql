
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS salario_base DECIMAL;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS cbo VARCHAR(20);
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS dependentes_ir INTEGER DEFAULT 0;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS dependentes_sf INTEGER DEFAULT 0;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS sindicato_codigo VARCHAR(20);
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS data_demissao DATE;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS empregare_pessoa_id INTEGER;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS cadastro_completo BOOLEAN DEFAULT false;
