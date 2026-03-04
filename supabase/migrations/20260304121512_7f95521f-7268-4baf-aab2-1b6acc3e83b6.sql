ALTER TABLE public.vacancies ADD COLUMN opened_at date DEFAULT CURRENT_DATE;

-- Backfill existing rows with created_at date
UPDATE public.vacancies SET opened_at = (created_at AT TIME ZONE 'UTC')::date WHERE opened_at IS NULL;