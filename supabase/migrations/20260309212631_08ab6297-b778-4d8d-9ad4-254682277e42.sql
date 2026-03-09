
-- Create order_payments table
CREATE TABLE public.order_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC NOT NULL DEFAULT 0,
  method TEXT NOT NULL DEFAULT 'transferencia',
  reference TEXT NOT NULL DEFAULT '',
  comment TEXT NOT NULL DEFAULT '',
  registered_by TEXT NOT NULL DEFAULT '',
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create accounts_receivable table
CREATE TABLE public.accounts_receivable (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id),
  customer_name TEXT NOT NULL DEFAULT '',
  order_folio TEXT NOT NULL DEFAULT '',
  total NUMERIC NOT NULL DEFAULT 0,
  paid NUMERIC NOT NULL DEFAULT 0,
  balance NUMERIC NOT NULL DEFAULT 0,
  due_date DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '30 days'),
  days_overdue INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'al_corriente',
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.order_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts_receivable ENABLE ROW LEVEL SECURITY;

-- RLS for order_payments
CREATE POLICY "Directors manage order_payments" ON public.order_payments FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'director')) WITH CHECK (public.has_role(auth.uid(), 'director'));
CREATE POLICY "Admin manage order_payments" ON public.order_payments FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'administracion')) WITH CHECK (public.has_role(auth.uid(), 'administracion'));
CREATE POLICY "Gerencia manage order_payments" ON public.order_payments FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'gerencia_comercial')) WITH CHECK (public.has_role(auth.uid(), 'gerencia_comercial'));
CREATE POLICY "Vendedores view order_payments" ON public.order_payments FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'vendedor'));
CREATE POLICY "Almacen view order_payments" ON public.order_payments FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'almacen'));

-- RLS for accounts_receivable
CREATE POLICY "Directors manage accounts_receivable" ON public.accounts_receivable FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'director')) WITH CHECK (public.has_role(auth.uid(), 'director'));
CREATE POLICY "Admin manage accounts_receivable" ON public.accounts_receivable FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'administracion')) WITH CHECK (public.has_role(auth.uid(), 'administracion'));
CREATE POLICY "Gerencia manage accounts_receivable" ON public.accounts_receivable FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'gerencia_comercial')) WITH CHECK (public.has_role(auth.uid(), 'gerencia_comercial'));
CREATE POLICY "Vendedores view accounts_receivable" ON public.accounts_receivable FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'vendedor'));
CREATE POLICY "Compras view accounts_receivable" ON public.accounts_receivable FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'compras'));
