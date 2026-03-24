ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS capacity text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS price_client numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_distributor numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_distributor numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_admin numeric NOT NULL DEFAULT 0;

UPDATE public.products SET price_client = list_price WHERE price_client = 0 AND list_price > 0;
UPDATE public.products SET price_distributor = min_price WHERE price_distributor = 0 AND min_price > 0;