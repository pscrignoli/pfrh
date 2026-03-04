
CREATE OR REPLACE FUNCTION public.delete_vacancy_cascade(_vacancy_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  -- Delete field values for candidates of this vacancy
  DELETE FROM public.candidate_field_values
  WHERE candidate_id IN (SELECT id FROM public.candidates WHERE vacancy_id = _vacancy_id);

  -- Delete candidates
  DELETE FROM public.candidates WHERE vacancy_id = _vacancy_id;

  -- Delete vacancy fields
  DELETE FROM public.vacancy_fields WHERE vacancy_id = _vacancy_id;

  -- Delete the vacancy
  DELETE FROM public.vacancies WHERE id = _vacancy_id;
END;
$$;
