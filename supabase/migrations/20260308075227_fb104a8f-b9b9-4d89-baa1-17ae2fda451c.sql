
-- Add new goal columns to sales_goals
ALTER TABLE public.sales_goals
  ADD COLUMN IF NOT EXISTS goal_collections numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS goal_min_margin numeric NOT NULL DEFAULT 0;

-- Commission configuration table
CREATE TABLE public.commission_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  config_key text NOT NULL UNIQUE,
  config_value jsonb NOT NULL DEFAULT '{}',
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.commission_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Directors manage commission_config"
  ON public.commission_config FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'director'))
  WITH CHECK (public.has_role(auth.uid(), 'director'));

CREATE POLICY "Gerencia manage commission_config"
  ON public.commission_config FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'gerencia_comercial'))
  WITH CHECK (public.has_role(auth.uid(), 'gerencia_comercial'));

CREATE POLICY "Admin manage commission_config"
  ON public.commission_config FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'administracion'))
  WITH CHECK (public.has_role(auth.uid(), 'administracion'));

CREATE POLICY "Vendedores view commission_config"
  ON public.commission_config FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'vendedor'));

-- Insert default commission config
INSERT INTO public.commission_config (config_key, config_value) VALUES
  ('base_rate', '{"rate": 5}'::jsonb),
  ('margin_bonuses', '[{"min_margin": 20, "bonus": 1}, {"min_margin": 25, "bonus": 2}, {"min_margin": 30, "bonus": 3}]'::jsonb),
  ('goal_bonuses', '[{"min_pct": 100, "bonus": 3}, {"min_pct": 120, "bonus": 5}]'::jsonb),
  ('new_customer_bonus', '{"amount": 500}'::jsonb),
  ('collection_bonus', '{"rate": 1}'::jsonb),
  ('score_weights', '{"sales": 30, "close_rate": 15, "margin": 15, "new_customers": 10, "collections": 15, "quotations": 10, "followups": 5}'::jsonb),
  ('score_levels', '[{"min": 80, "label": "Excelente", "color": "green"}, {"min": 60, "label": "Muy bueno", "color": "blue"}, {"min": 40, "label": "Bueno", "color": "amber"}, {"min": 20, "label": "Regular", "color": "orange"}, {"min": 0, "label": "Bajo", "color": "red"}]'::jsonb)
ON CONFLICT (config_key) DO NOTHING;
