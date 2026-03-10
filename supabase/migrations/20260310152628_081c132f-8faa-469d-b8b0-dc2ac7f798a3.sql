
-- Add 'saude' module permissions for all existing roles (same as 'folha')
INSERT INTO public.role_permissions (role_id, module, can_view, can_edit)
SELECT rd.id, 'saude', 
  CASE WHEN rd.name IN ('super_admin', 'admin', 'rh', 'financeiro', 'diretoria') THEN true ELSE false END,
  CASE WHEN rd.name IN ('super_admin', 'admin', 'rh') THEN true ELSE false END
FROM public.role_definitions rd
WHERE NOT EXISTS (
  SELECT 1 FROM public.role_permissions rp WHERE rp.role_id = rd.id AND rp.module = 'saude'
);
