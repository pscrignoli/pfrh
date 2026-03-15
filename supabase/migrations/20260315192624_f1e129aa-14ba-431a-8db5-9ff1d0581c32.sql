
-- Create a security definer function to get user's current role_id safely
CREATE OR REPLACE FUNCTION public.get_user_role_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role_id FROM public.user_profiles WHERE user_id = _user_id
$$;

-- Replace the self-update policy to use the function instead of subquery
DROP POLICY IF EXISTS "self_update_user_profiles" ON public.user_profiles;

CREATE POLICY "self_update_user_profiles" ON public.user_profiles
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid()
  AND (role_id IS NOT DISTINCT FROM get_user_role_id(auth.uid()))
);
