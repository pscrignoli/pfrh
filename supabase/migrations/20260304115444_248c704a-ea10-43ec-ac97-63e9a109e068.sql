
-- Table: vacancy_fields
CREATE TABLE public.vacancy_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vacancy_id uuid NOT NULL REFERENCES public.vacancies(id) ON DELETE CASCADE,
  label varchar NOT NULL,
  field_type varchar NOT NULL DEFAULT 'text',
  options jsonb DEFAULT '[]'::jsonb,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.vacancy_fields DISABLE ROW LEVEL SECURITY;

-- Table: candidate_field_values
CREATE TABLE public.candidate_field_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  field_id uuid NOT NULL REFERENCES public.vacancy_fields(id) ON DELETE CASCADE,
  value text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(candidate_id, field_id)
);
ALTER TABLE public.candidate_field_values DISABLE ROW LEVEL SECURITY;

-- RPC: save_vacancy_fields (atomic replace)
CREATE OR REPLACE FUNCTION public.save_vacancy_fields(_vacancy_id uuid, _fields jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.vacancy_fields WHERE vacancy_id = _vacancy_id;
  INSERT INTO public.vacancy_fields (vacancy_id, label, field_type, options, sort_order)
  SELECT
    _vacancy_id,
    f->>'label',
    COALESCE(f->>'field_type', 'text'),
    COALESCE((f->'options')::jsonb, '[]'::jsonb),
    (f->>'sort_order')::int
  FROM jsonb_array_elements(_fields) AS f;
END;
$$;

-- RPC: upsert_candidate_field_values
CREATE OR REPLACE FUNCTION public.upsert_candidate_field_values(_candidate_id uuid, _values jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.candidate_field_values (candidate_id, field_id, value, updated_at)
  SELECT
    _candidate_id,
    (v->>'field_id')::uuid,
    v->>'value',
    now()
  FROM jsonb_array_elements(_values) AS v
  ON CONFLICT (candidate_id, field_id)
  DO UPDATE SET value = EXCLUDED.value, updated_at = now();
END;
$$;

-- RPC: update_candidate_info (to avoid CORS on PATCH)
CREATE OR REPLACE FUNCTION public.update_candidate_info(_candidate_id uuid, _name varchar, _email varchar, _phone varchar, _stage candidate_stage)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.candidates
  SET name = _name, email = _email, phone = _phone, stage = _stage
  WHERE id = _candidate_id;
END;
$$;
