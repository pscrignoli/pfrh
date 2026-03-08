
-- Function to check if salary should be hidden for a given employee cargo
CREATE OR REPLACE FUNCTION public.is_salary_protected(_cargo text, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    CASE 
      WHEN (lower(_cargo) LIKE '%diretor%' OR lower(_cargo) LIKE '%ceo%' OR lower(_cargo) LIKE '%presidente%')
        AND NOT COALESCE(
          (SELECT rp.can_view FROM role_permissions rp
           JOIN user_profiles up ON up.role_id = rp.role_id
           WHERE up.user_id = _user_id AND rp.module = 'salario_diretoria'),
          false
        )
      THEN true
      ELSE false
    END
$$;
