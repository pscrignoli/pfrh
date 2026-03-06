
-- Add INSERT and UPDATE policies for empregare_candidatos
CREATE POLICY "Authenticated users can insert empregare_candidatos"
ON public.empregare_candidatos
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update empregare_candidatos"
ON public.empregare_candidatos
FOR UPDATE
TO authenticated
USING (true);

-- Add unique constraint on (empregare_pessoa_id, empregare_vaga_id)
ALTER TABLE public.empregare_candidatos
ADD CONSTRAINT empregare_candidatos_pessoa_vaga_unique
UNIQUE (empregare_pessoa_id, empregare_vaga_id);
