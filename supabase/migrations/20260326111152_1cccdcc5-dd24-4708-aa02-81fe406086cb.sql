
UPDATE empregare_vagas
SET total_vagas = COALESCE(
  (SELECT SUM((c->>'nVaga')::int)
   FROM jsonb_array_elements(
     (raw_json#>>'{}')::jsonb->'vagaCidade'
   ) c
   WHERE (c->>'nVaga')::int > 0
  ),
  total_vagas
)
WHERE raw_json IS NOT NULL;
