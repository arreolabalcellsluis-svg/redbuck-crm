
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS transportista text DEFAULT '',
ADD COLUMN IF NOT EXISTS guia_numero text DEFAULT '',
ADD COLUMN IF NOT EXISTS fecha_envio date DEFAULT NULL,
ADD COLUMN IF NOT EXISTS shipping_images jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS invoice_number_manual text DEFAULT '',
ADD COLUMN IF NOT EXISTS invoice_date_manual date DEFAULT NULL,
ADD COLUMN IF NOT EXISTS invoice_pdf_url text DEFAULT '',
ADD COLUMN IF NOT EXISTS edit_history jsonb DEFAULT '[]'::jsonb;
