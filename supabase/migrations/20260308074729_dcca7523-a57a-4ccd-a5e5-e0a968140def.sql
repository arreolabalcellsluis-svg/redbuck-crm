
-- Sales goals table for monthly vendor targets
CREATE TABLE public.sales_goals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id text NOT NULL,
  vendor_name text NOT NULL DEFAULT '',
  month integer NOT NULL CHECK (month >= 1 AND month <= 12),
  year integer NOT NULL,
  goal_sales numeric NOT NULL DEFAULT 0,
  goal_quotations integer NOT NULL DEFAULT 0,
  goal_orders integer NOT NULL DEFAULT 0,
  goal_new_customers integer NOT NULL DEFAULT 0,
  goal_followups integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (vendor_id, month, year)
);

-- Enable RLS
ALTER TABLE public.sales_goals ENABLE ROW LEVEL SECURITY;

-- Director full access
CREATE POLICY "Directors manage sales_goals"
  ON public.sales_goals FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'director'))
  WITH CHECK (public.has_role(auth.uid(), 'director'));

-- Gerencia full access
CREATE POLICY "Gerencia manage sales_goals"
  ON public.sales_goals FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'gerencia_comercial'))
  WITH CHECK (public.has_role(auth.uid(), 'gerencia_comercial'));

-- Administracion full access
CREATE POLICY "Admin manage sales_goals"
  ON public.sales_goals FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'administracion'))
  WITH CHECK (public.has_role(auth.uid(), 'administracion'));

-- Vendedores can read all goals (to see ranking)
CREATE POLICY "Vendedores view sales_goals"
  ON public.sales_goals FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'vendedor'));
