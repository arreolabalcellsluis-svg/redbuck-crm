
-- ============================================
-- CFDI 4.0 Invoicing Module - Phase 1 Tables
-- ============================================

-- Enum types for invoicing
CREATE TYPE public.invoice_status AS ENUM (
  'borrador', 'lista_timbrar', 'timbrada', 'cancelada', 'error_timbrado'
);

CREATE TYPE public.cfdi_type AS ENUM (
  'I', 'E', 'P', 'N', 'T'
);

CREATE TYPE public.cancellation_reason AS ENUM (
  '01', '02', '03', '04'
);

-- 1. fiscal_settings (issuer config, singleton per org)
CREATE TABLE public.fiscal_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issuer_rfc text NOT NULL DEFAULT '',
  issuer_name text NOT NULL DEFAULT '',
  issuer_trade_name text DEFAULT '',
  issuer_tax_regime text NOT NULL DEFAULT '',
  expedition_zip_code text NOT NULL DEFAULT '',
  default_series text DEFAULT 'A',
  pac_provider text NOT NULL DEFAULT 'facturama',
  pac_api_url text DEFAULT '',
  pac_username text DEFAULT '',
  pac_token_encrypted text DEFAULT '',
  csd_cer_path text DEFAULT '',
  csd_key_path text DEFAULT '',
  csd_password_encrypted text DEFAULT '',
  csd_status text DEFAULT 'sin_certificado',
  csd_expiration_date date,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fiscal_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Directors manage fiscal_settings" ON public.fiscal_settings FOR ALL
  USING (has_role(auth.uid(), 'director'::app_role))
  WITH CHECK (has_role(auth.uid(), 'director'::app_role));

CREATE POLICY "Admin manage fiscal_settings" ON public.fiscal_settings FOR ALL
  USING (has_role(auth.uid(), 'administracion'::app_role))
  WITH CHECK (has_role(auth.uid(), 'administracion'::app_role));

CREATE POLICY "Gerencia view fiscal_settings" ON public.fiscal_settings FOR SELECT
  USING (has_role(auth.uid(), 'gerencia_comercial'::app_role));

-- 2. customer_fiscal_data
CREATE TABLE public.customer_fiscal_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  rfc text NOT NULL DEFAULT '',
  legal_name text NOT NULL DEFAULT '',
  fiscal_zip_code text NOT NULL DEFAULT '',
  tax_regime text NOT NULL DEFAULT '',
  cfdi_use_default text NOT NULL DEFAULT 'G03',
  invoice_email text DEFAULT '',
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(customer_id)
);

ALTER TABLE public.customer_fiscal_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Directors manage customer_fiscal" ON public.customer_fiscal_data FOR ALL
  USING (has_role(auth.uid(), 'director'::app_role))
  WITH CHECK (has_role(auth.uid(), 'director'::app_role));

CREATE POLICY "Admin manage customer_fiscal" ON public.customer_fiscal_data FOR ALL
  USING (has_role(auth.uid(), 'administracion'::app_role))
  WITH CHECK (has_role(auth.uid(), 'administracion'::app_role));

CREATE POLICY "Gerencia manage customer_fiscal" ON public.customer_fiscal_data FOR ALL
  USING (has_role(auth.uid(), 'gerencia_comercial'::app_role))
  WITH CHECK (has_role(auth.uid(), 'gerencia_comercial'::app_role));

CREATE POLICY "Vendedores manage customer_fiscal" ON public.customer_fiscal_data FOR ALL
  USING (has_role(auth.uid(), 'vendedor'::app_role))
  WITH CHECK (has_role(auth.uid(), 'vendedor'::app_role));

-- 3. product_fiscal_data
CREATE TABLE public.product_fiscal_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  sat_product_key text NOT NULL DEFAULT '',
  sat_unit_key text NOT NULL DEFAULT '',
  commercial_unit text DEFAULT '',
  tax_object text NOT NULL DEFAULT '02',
  vat_rate numeric NOT NULL DEFAULT 16,
  fiscal_description text DEFAULT '',
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(product_id)
);

ALTER TABLE public.product_fiscal_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Directors manage product_fiscal" ON public.product_fiscal_data FOR ALL
  USING (has_role(auth.uid(), 'director'::app_role))
  WITH CHECK (has_role(auth.uid(), 'director'::app_role));

CREATE POLICY "Admin manage product_fiscal" ON public.product_fiscal_data FOR ALL
  USING (has_role(auth.uid(), 'administracion'::app_role))
  WITH CHECK (has_role(auth.uid(), 'administracion'::app_role));

CREATE POLICY "Compras manage product_fiscal" ON public.product_fiscal_data FOR ALL
  USING (has_role(auth.uid(), 'compras'::app_role))
  WITH CHECK (has_role(auth.uid(), 'compras'::app_role));

CREATE POLICY "Gerencia view product_fiscal" ON public.product_fiscal_data FOR SELECT
  USING (has_role(auth.uid(), 'gerencia_comercial'::app_role));

CREATE POLICY "Vendedores view product_fiscal" ON public.product_fiscal_data FOR SELECT
  USING (has_role(auth.uid(), 'vendedor'::app_role));

-- 4. invoices
CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES public.customers(id),
  order_id uuid REFERENCES public.orders(id),
  sales_person_id text DEFAULT '',
  series text NOT NULL DEFAULT 'A',
  folio text NOT NULL DEFAULT '',
  uuid text DEFAULT '',
  invoice_type cfdi_type NOT NULL DEFAULT 'I',
  payment_form text NOT NULL DEFAULT '99',
  payment_method text NOT NULL DEFAULT 'PUE',
  currency text NOT NULL DEFAULT 'MXN',
  exchange_rate numeric NOT NULL DEFAULT 1,
  subtotal numeric NOT NULL DEFAULT 0,
  tax_amount numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  status invoice_status NOT NULL DEFAULT 'borrador',
  pac_provider text DEFAULT 'facturama',
  pac_response jsonb DEFAULT '{}',
  xml_path text DEFAULT '',
  pdf_path text DEFAULT '',
  conditions text DEFAULT '',
  notes text DEFAULT '',
  export_code text DEFAULT '01',
  issued_at timestamptz,
  canceled_at timestamptz,
  created_by text DEFAULT '',
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Directors manage invoices" ON public.invoices FOR ALL
  USING (has_role(auth.uid(), 'director'::app_role))
  WITH CHECK (has_role(auth.uid(), 'director'::app_role));

CREATE POLICY "Admin manage invoices" ON public.invoices FOR ALL
  USING (has_role(auth.uid(), 'administracion'::app_role))
  WITH CHECK (has_role(auth.uid(), 'administracion'::app_role));

CREATE POLICY "Gerencia manage invoices" ON public.invoices FOR ALL
  USING (has_role(auth.uid(), 'gerencia_comercial'::app_role))
  WITH CHECK (has_role(auth.uid(), 'gerencia_comercial'::app_role));

CREATE POLICY "Vendedores view invoices" ON public.invoices FOR SELECT
  USING (has_role(auth.uid(), 'vendedor'::app_role));

-- 5. invoice_items
CREATE TABLE public.invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id),
  description text NOT NULL DEFAULT '',
  qty numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  discount numeric NOT NULL DEFAULT 0,
  subtotal numeric NOT NULL DEFAULT 0,
  tax_amount numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  sat_product_key text NOT NULL DEFAULT '',
  sat_unit_key text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Directors manage invoice_items" ON public.invoice_items FOR ALL
  USING (has_role(auth.uid(), 'director'::app_role))
  WITH CHECK (has_role(auth.uid(), 'director'::app_role));

CREATE POLICY "Admin manage invoice_items" ON public.invoice_items FOR ALL
  USING (has_role(auth.uid(), 'administracion'::app_role))
  WITH CHECK (has_role(auth.uid(), 'administracion'::app_role));

CREATE POLICY "Gerencia manage invoice_items" ON public.invoice_items FOR ALL
  USING (has_role(auth.uid(), 'gerencia_comercial'::app_role))
  WITH CHECK (has_role(auth.uid(), 'gerencia_comercial'::app_role));

CREATE POLICY "Vendedores view invoice_items" ON public.invoice_items FOR SELECT
  USING (has_role(auth.uid(), 'vendedor'::app_role));

-- 6. invoice_cancellations
CREATE TABLE public.invoice_cancellations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  cancellation_reason cancellation_reason NOT NULL DEFAULT '02',
  substitute_uuid text DEFAULT '',
  cancellation_ack_path text DEFAULT '',
  canceled_by text NOT NULL DEFAULT '',
  canceled_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.invoice_cancellations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Directors manage invoice_cancellations" ON public.invoice_cancellations FOR ALL
  USING (has_role(auth.uid(), 'director'::app_role))
  WITH CHECK (has_role(auth.uid(), 'director'::app_role));

CREATE POLICY "Admin manage invoice_cancellations" ON public.invoice_cancellations FOR ALL
  USING (has_role(auth.uid(), 'administracion'::app_role))
  WITH CHECK (has_role(auth.uid(), 'administracion'::app_role));

CREATE POLICY "Gerencia view invoice_cancellations" ON public.invoice_cancellations FOR SELECT
  USING (has_role(auth.uid(), 'gerencia_comercial'::app_role));

-- Storage bucket for CSD files and invoice XMLs/PDFs
INSERT INTO storage.buckets (id, name, public) VALUES ('invoicing', 'invoicing', false)
ON CONFLICT DO NOTHING;

-- Storage RLS: only director and admin can manage invoicing files
CREATE POLICY "Directors manage invoicing files" ON storage.objects FOR ALL
  USING (bucket_id = 'invoicing' AND has_role(auth.uid(), 'director'::app_role))
  WITH CHECK (bucket_id = 'invoicing' AND has_role(auth.uid(), 'director'::app_role));

CREATE POLICY "Admin manage invoicing files" ON storage.objects FOR ALL
  USING (bucket_id = 'invoicing' AND has_role(auth.uid(), 'administracion'::app_role))
  WITH CHECK (bucket_id = 'invoicing' AND has_role(auth.uid(), 'administracion'::app_role));

CREATE POLICY "Gerencia read invoicing files" ON storage.objects FOR SELECT
  USING (bucket_id = 'invoicing' AND has_role(auth.uid(), 'gerencia_comercial'::app_role));

CREATE POLICY "Vendedores read invoicing files" ON storage.objects FOR SELECT
  USING (bucket_id = 'invoicing' AND has_role(auth.uid(), 'vendedor'::app_role));
