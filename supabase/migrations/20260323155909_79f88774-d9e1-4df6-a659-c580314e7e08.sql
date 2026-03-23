ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS website text DEFAULT '',
  ADD COLUMN IF NOT EXISTS banco_destino text DEFAULT '',
  ADD COLUMN IF NOT EXISTS cuenta_destino text DEFAULT '',
  ADD COLUMN IF NOT EXISTS clabe_destino text DEFAULT '',
  ADD COLUMN IF NOT EXISTS divisa_banco text DEFAULT 'USD';