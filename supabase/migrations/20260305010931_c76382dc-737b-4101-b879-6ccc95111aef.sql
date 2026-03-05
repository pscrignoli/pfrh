
-- Allow authenticated users to read empregare tables
CREATE POLICY "Authenticated users can read empregare_vagas"
  ON public.empregare_vagas FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read empregare_candidatos"
  ON public.empregare_candidatos FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read empregare_company_map"
  ON public.empregare_company_map FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read empregare_kanban_cards"
  ON public.empregare_kanban_cards FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert empregare_kanban_cards"
  ON public.empregare_kanban_cards FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update empregare_kanban_cards"
  ON public.empregare_kanban_cards FOR UPDATE
  TO authenticated
  USING (true);
