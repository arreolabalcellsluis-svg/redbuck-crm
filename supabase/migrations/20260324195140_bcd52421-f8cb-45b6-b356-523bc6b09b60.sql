
CREATE TABLE public.commercial_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  doc_type text NOT NULL DEFAULT 'nota_venta',
  folio text NOT NULL,
  subtotal numeric NOT NULL DEFAULT 0,
  tax numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  customer_name text NOT NULL DEFAULT '',
  customer_contact text NOT NULL DEFAULT '',
  notes text DEFAULT '',
  conditions text DEFAULT '',
  legal_text text DEFAULT '',
  vendor_name text NOT NULL DEFAULT '',
  vendor_phone text DEFAULT '',
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(doc_type, folio)
);

ALTER TABLE public.commercial_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage commercial_documents" ON public.commercial_documents FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'administracion'::app_role))
  WITH CHECK (has_role(auth.uid(), 'administracion'::app_role));

CREATE POLICY "Directors manage commercial_documents" ON public.commercial_documents FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'director'::app_role))
  WITH CHECK (has_role(auth.uid(), 'director'::app_role));

CREATE POLICY "Gerencia manage commercial_documents" ON public.commercial_documents FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'gerencia_comercial'::app_role))
  WITH CHECK (has_role(auth.uid(), 'gerencia_comercial'::app_role));

CREATE POLICY "Vendedores manage commercial_documents" ON public.commercial_documents FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'vendedor'::app_role))
  WITH CHECK (has_role(auth.uid(), 'vendedor'::app_role));
