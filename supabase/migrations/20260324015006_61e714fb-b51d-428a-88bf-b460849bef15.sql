
ALTER TABLE public.import_orders
  ADD COLUMN IF NOT EXISTS flete_local_china numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS flete_internacional_maritimo numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS igi numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dta numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prevalidacion numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gastos_locales_naviera numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS maniobras_puerto numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS seguro numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS honorarios_despacho_aduanal numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS comercializadora numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS flete_terrestre_gdl numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS peso_total_kg numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS volumen_total_cbm numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS numero_contenedores integer NOT NULL DEFAULT 1;
