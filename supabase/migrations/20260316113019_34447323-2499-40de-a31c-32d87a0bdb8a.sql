CREATE OR REPLACE FUNCTION public.validate_health_record_tipos()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.tipo_cobertura NOT IN ('medico','odontologico') THEN
    RAISE EXCEPTION 'Invalid tipo_cobertura: %', NEW.tipo_cobertura;
  END IF;
  IF NEW.fonte NOT IN ('unimed','bradesco','bradesco_dental','manual') THEN
    RAISE EXCEPTION 'Invalid fonte: %', NEW.fonte;
  END IF;
  RETURN NEW;
END;
$function$