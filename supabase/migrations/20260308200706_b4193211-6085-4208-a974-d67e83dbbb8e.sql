
-- Payment status enum for invoices
CREATE TYPE public.payment_status AS ENUM ('pendiente', 'parcial', 'pagada');

-- Payments table
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE RESTRICT,
  customer_id uuid REFERENCES public.customers(id),
  amount numeric NOT NULL CHECK (amount > 0),
  previous_balance numeric NOT NULL DEFAULT 0,
  remaining_balance numeric NOT NULL DEFAULT 0,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  payment_form text NOT NULL DEFAULT '99',
  currency text NOT NULL DEFAULT 'MXN',
  exchange_rate numeric NOT NULL DEFAULT 1,
  operation_reference text DEFAULT '',
  bank text DEFAULT '',
  notes text DEFAULT '',
  complement_status text NOT NULL DEFAULT 'pendiente',
  complement_uuid text DEFAULT '',
  complement_xml_path text DEFAULT '',
  complement_pdf_path text DEFAULT '',
  created_by text DEFAULT '',
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add payment_status column to invoices
ALTER TABLE public.invoices ADD COLUMN payment_status text NOT NULL DEFAULT 'pendiente';

-- Enable RLS
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- RLS policies for payments
CREATE POLICY "Directors manage payments" ON public.payments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'director')) WITH CHECK (public.has_role(auth.uid(), 'director'));

CREATE POLICY "Admin manage payments" ON public.payments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'administracion')) WITH CHECK (public.has_role(auth.uid(), 'administracion'));

CREATE POLICY "Gerencia manage payments" ON public.payments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'gerencia_comercial')) WITH CHECK (public.has_role(auth.uid(), 'gerencia_comercial'));

CREATE POLICY "Vendedores view payments" ON public.payments FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'vendedor'));
