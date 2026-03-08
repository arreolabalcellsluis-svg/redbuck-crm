
-- Asset category enum
CREATE TYPE public.asset_category AS ENUM ('vehiculos', 'maquinaria', 'computadoras', 'software', 'mobiliario', 'equipo_oficina', 'otros');

-- Asset type enum (depreciation vs amortization)
CREATE TYPE public.asset_type AS ENUM ('depreciacion', 'amortizacion');

-- Asset status enum
CREATE TYPE public.asset_status AS ENUM ('activo', 'dado_de_baja');

-- Assets table
CREATE TABLE public.assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  categoria public.asset_category NOT NULL DEFAULT 'otros',
  tipo public.asset_type NOT NULL DEFAULT 'depreciacion',
  descripcion TEXT NOT NULL DEFAULT '',
  fecha_compra DATE NOT NULL DEFAULT CURRENT_DATE,
  costo_adquisicion NUMERIC NOT NULL DEFAULT 0,
  vida_util_meses INTEGER NOT NULL DEFAULT 60,
  valor_rescate NUMERIC NOT NULL DEFAULT 0,
  estatus public.asset_status NOT NULL DEFAULT 'activo',
  notas TEXT,
  user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

-- Directors can manage all assets
CREATE POLICY "Directors can manage all assets"
  ON public.assets FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'director'))
  WITH CHECK (public.has_role(auth.uid(), 'director'));

-- Administracion can manage all assets
CREATE POLICY "Administracion can manage all assets"
  ON public.assets FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'administracion'))
  WITH CHECK (public.has_role(auth.uid(), 'administracion'));

-- Gerencia comercial can view assets
CREATE POLICY "Gerencia comercial can view assets"
  ON public.assets FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'gerencia_comercial'));

-- Compras can view assets
CREATE POLICY "Compras can view assets"
  ON public.assets FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'compras'));
