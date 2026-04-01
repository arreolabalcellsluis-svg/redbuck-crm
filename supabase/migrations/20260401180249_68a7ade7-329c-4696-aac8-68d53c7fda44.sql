
ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS direccion_banco text DEFAULT '',
  ADD COLUMN IF NOT EXISTS swift_code text DEFAULT '',
  ADD COLUMN IF NOT EXISTS nombre_beneficiario text DEFAULT '',
  ADD COLUMN IF NOT EXISTS direccion_beneficiario text DEFAULT '',
  ADD COLUMN IF NOT EXISTS telefono_beneficiario text DEFAULT '';
