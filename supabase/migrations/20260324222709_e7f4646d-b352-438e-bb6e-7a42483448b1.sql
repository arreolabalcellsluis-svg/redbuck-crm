
-- Create inventory_movements table for tracking all inventory changes
CREATE TABLE public.inventory_movements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  warehouse_id TEXT NOT NULL DEFAULT '',
  quantity INTEGER NOT NULL DEFAULT 0,
  unit_cost NUMERIC NOT NULL DEFAULT 0,
  total_cost NUMERIC NOT NULL DEFAULT 0,
  movement_type TEXT NOT NULL DEFAULT 'import_in',
  reference_type TEXT NOT NULL DEFAULT '',
  reference_id TEXT NOT NULL DEFAULT '',
  notes TEXT DEFAULT '',
  user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

-- RLS policies matching the project pattern
CREATE POLICY "Admin manage inventory_movements" ON public.inventory_movements
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'administracion'::app_role))
  WITH CHECK (has_role(auth.uid(), 'administracion'::app_role));

CREATE POLICY "Directors manage inventory_movements" ON public.inventory_movements
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'director'::app_role))
  WITH CHECK (has_role(auth.uid(), 'director'::app_role));

CREATE POLICY "Compras manage inventory_movements" ON public.inventory_movements
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'compras'::app_role))
  WITH CHECK (has_role(auth.uid(), 'compras'::app_role));

CREATE POLICY "Almacen manage inventory_movements" ON public.inventory_movements
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'almacen'::app_role))
  WITH CHECK (has_role(auth.uid(), 'almacen'::app_role));

CREATE POLICY "Gerencia view inventory_movements" ON public.inventory_movements
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'gerencia_comercial'::app_role));

CREATE POLICY "Vendedores view inventory_movements" ON public.inventory_movements
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'vendedor'::app_role));

-- Create index for fast lookups
CREATE INDEX idx_inventory_movements_product ON public.inventory_movements(product_id);
CREATE INDEX idx_inventory_movements_reference ON public.inventory_movements(reference_type, reference_id);
