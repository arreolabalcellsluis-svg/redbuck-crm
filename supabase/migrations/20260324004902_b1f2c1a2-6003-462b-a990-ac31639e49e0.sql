
CREATE TABLE public.area_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area text NOT NULL,
  month integer NOT NULL,
  year integer NOT NULL,
  user_name text NOT NULL DEFAULT '',
  kpi_config jsonb NOT NULL DEFAULT '[]'::jsonb,
  bonus_base numeric NOT NULL DEFAULT 0,
  bonus_overperformance_rate numeric NOT NULL DEFAULT 0,
  manual_kpi_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(area, month, year)
);

ALTER TABLE public.area_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Directors manage area_goals" ON public.area_goals
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'director'::app_role))
  WITH CHECK (has_role(auth.uid(), 'director'::app_role));

CREATE POLICY "Admin manage area_goals" ON public.area_goals
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'administracion'::app_role))
  WITH CHECK (has_role(auth.uid(), 'administracion'::app_role));

CREATE POLICY "Gerencia manage area_goals" ON public.area_goals
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'gerencia_comercial'::app_role))
  WITH CHECK (has_role(auth.uid(), 'gerencia_comercial'::app_role));

CREATE POLICY "Vendedores view area_goals" ON public.area_goals
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'vendedor'::app_role));
