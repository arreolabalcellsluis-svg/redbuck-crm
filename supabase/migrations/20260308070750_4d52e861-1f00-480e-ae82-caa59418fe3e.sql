
-- Enum for payable status
CREATE TYPE public.payable_status AS ENUM ('pendiente','por_vencer','vencida','pago_parcial','liquidada','cancelada');

-- Enum for payment method
CREATE TYPE public.payment_method AS ENUM ('transferencia','cheque','efectivo','tarjeta','compensacion','otro');

-- Accounts Payable table
CREATE TABLE public.accounts_payable (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_name text NOT NULL,
  invoice_number text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  invoice_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date NOT NULL DEFAULT (CURRENT_DATE + interval '30 days'),
  total numeric NOT NULL DEFAULT 0,
  paid numeric NOT NULL DEFAULT 0,
  balance numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'MXN',
  status payable_status NOT NULL DEFAULT 'pendiente',
  payment_method payment_method,
  import_order_id text,
  purchase_order_id text,
  notes text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.accounts_payable ENABLE ROW LEVEL SECURITY;

-- RLS: directors and admin full access, compras full, gerencia view
CREATE POLICY "Directors manage payables" ON public.accounts_payable FOR ALL USING (has_role(auth.uid(), 'director')) WITH CHECK (has_role(auth.uid(), 'director'));
CREATE POLICY "Admin manage payables" ON public.accounts_payable FOR ALL USING (has_role(auth.uid(), 'administracion')) WITH CHECK (has_role(auth.uid(), 'administracion'));
CREATE POLICY "Compras manage payables" ON public.accounts_payable FOR ALL USING (has_role(auth.uid(), 'compras')) WITH CHECK (has_role(auth.uid(), 'compras'));
CREATE POLICY "Gerencia view payables" ON public.accounts_payable FOR SELECT USING (has_role(auth.uid(), 'gerencia_comercial'));
