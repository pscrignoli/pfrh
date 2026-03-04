
CREATE OR REPLACE FUNCTION public.update_candidate_stage(_candidate_id uuid, _stage candidate_stage)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.candidates SET stage = _stage WHERE id = _candidate_id;
END;
$$;
