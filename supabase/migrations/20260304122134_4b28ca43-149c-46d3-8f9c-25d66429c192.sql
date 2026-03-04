CREATE OR REPLACE FUNCTION public.update_vacancy_info(
  _vacancy_id uuid,
  _title character varying,
  _department_id uuid,
  _work_model work_model,
  _status vacancy_status,
  _opened_at date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.vacancies
  SET title = _title,
      department_id = _department_id,
      work_model = _work_model,
      status = _status,
      opened_at = _opened_at
  WHERE id = _vacancy_id;
END;
$$;