
-- Create departments table
CREATE TABLE public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar NOT NULL,
  code varchar,
  status varchar NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read
CREATE POLICY "Authenticated users can read departments"
ON public.departments FOR SELECT
TO authenticated
USING (true);

-- admin_rh can manage
CREATE POLICY "Admin RH manages departments"
ON public.departments FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin_rh'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin_rh'::app_role));

-- super_admin can manage
CREATE POLICY "Super admin manages departments"
ON public.departments FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));
