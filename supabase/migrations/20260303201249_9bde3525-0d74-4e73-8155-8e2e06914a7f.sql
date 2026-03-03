-- Create storage bucket for HR documents
INSERT INTO storage.buckets (id, name, public) VALUES ('hr_documents', 'hr_documents', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for hr_documents
CREATE POLICY "Admin uploads HR documents"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'hr_documents' AND public.has_role(auth.uid(), 'admin_rh'::public.app_role));

CREATE POLICY "Admin deletes HR documents"
ON storage.objects FOR DELETE
USING (bucket_id = 'hr_documents' AND public.has_role(auth.uid(), 'admin_rh'::public.app_role));

CREATE POLICY "Authorized users read HR documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'hr_documents' AND public.has_any_role(auth.uid()));

-- System settings table
CREATE TABLE public.system_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value TEXT,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manages settings"
ON public.system_settings FOR ALL
USING (public.has_role(auth.uid(), 'admin_rh'::public.app_role));

CREATE POLICY "Authorized users read settings"
ON public.system_settings FOR SELECT
USING (public.has_any_role(auth.uid()));
