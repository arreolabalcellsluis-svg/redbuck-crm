
-- 1. Warehouses table
CREATE TABLE public.warehouses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  location text NOT NULL DEFAULT '',
  has_exhibition boolean NOT NULL DEFAULT false,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Directors manage warehouses" ON public.warehouses FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'director')) WITH CHECK (has_role(auth.uid(), 'director'));
CREATE POLICY "Admin manage warehouses" ON public.warehouses FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'administracion')) WITH CHECK (has_role(auth.uid(), 'administracion'));
CREATE POLICY "Others view warehouses" ON public.warehouses FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'gerencia_comercial') OR
    has_role(auth.uid(), 'compras') OR
    has_role(auth.uid(), 'vendedor') OR
    has_role(auth.uid(), 'almacen') OR
    has_role(auth.uid(), 'tecnico')
  );

-- 2. Team members (employee profiles, NOT auth users)
CREATE TABLE public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL DEFAULT '',
  phone text DEFAULT '',
  whatsapp text DEFAULT '',
  role text NOT NULL DEFAULT 'vendedor',
  active boolean NOT NULL DEFAULT true,
  series_prefix text,
  series_start integer,
  series_current integer,
  commission_rate numeric,
  address text DEFAULT '',
  emergency_contact_name text DEFAULT '',
  emergency_contact_phone text DEFAULT '',
  photo_url text DEFAULT '',
  contract_url text DEFAULT '',
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Directors manage team_members" ON public.team_members FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'director')) WITH CHECK (has_role(auth.uid(), 'director'));
CREATE POLICY "Admin manage team_members" ON public.team_members FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'administracion')) WITH CHECK (has_role(auth.uid(), 'administracion'));
CREATE POLICY "Others view team_members" ON public.team_members FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'gerencia_comercial') OR
    has_role(auth.uid(), 'compras') OR
    has_role(auth.uid(), 'vendedor') OR
    has_role(auth.uid(), 'almacen') OR
    has_role(auth.uid(), 'tecnico')
  );

-- 3. App settings (key-value store for company info, templates, permissions, etc.)
CREATE TABLE public.app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text NOT NULL UNIQUE,
  setting_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Directors manage app_settings" ON public.app_settings FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'director')) WITH CHECK (has_role(auth.uid(), 'director'));
CREATE POLICY "Admin manage app_settings" ON public.app_settings FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'administracion')) WITH CHECK (has_role(auth.uid(), 'administracion'));
CREATE POLICY "Others view app_settings" ON public.app_settings FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'gerencia_comercial') OR
    has_role(auth.uid(), 'compras') OR
    has_role(auth.uid(), 'vendedor') OR
    has_role(auth.uid(), 'almacen') OR
    has_role(auth.uid(), 'tecnico')
  );
