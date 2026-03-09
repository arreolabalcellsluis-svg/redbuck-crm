
-- Bank accounts table
CREATE TABLE public.bank_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
  nombre TEXT NOT NULL,
  banco TEXT NOT NULL DEFAULT '',
  numero_cuenta TEXT NOT NULL DEFAULT '',
  clabe TEXT DEFAULT '',
  moneda TEXT NOT NULL DEFAULT 'MXN',
  saldo NUMERIC NOT NULL DEFAULT 0,
  activa BOOLEAN NOT NULL DEFAULT true,
  notas TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Directors manage bank_accounts" ON public.bank_accounts FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'director')) WITH CHECK (has_role(auth.uid(), 'director'));
CREATE POLICY "Admin manage bank_accounts" ON public.bank_accounts FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'administracion')) WITH CHECK (has_role(auth.uid(), 'administracion'));
CREATE POLICY "Gerencia view bank_accounts" ON public.bank_accounts FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'gerencia_comercial'));

-- Equity entries table (capital contable)
CREATE TABLE public.equity_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
  tipo TEXT NOT NULL DEFAULT 'aportacion_socios',
  concepto TEXT NOT NULL DEFAULT '',
  monto NUMERIC NOT NULL DEFAULT 0,
  fecha_inicio DATE DEFAULT CURRENT_DATE,
  fecha_fin DATE DEFAULT NULL,
  notas TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.equity_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Directors manage equity_entries" ON public.equity_entries FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'director')) WITH CHECK (has_role(auth.uid(), 'director'));
CREATE POLICY "Admin manage equity_entries" ON public.equity_entries FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'administracion')) WITH CHECK (has_role(auth.uid(), 'administracion'));
CREATE POLICY "Gerencia view equity_entries" ON public.equity_entries FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'gerencia_comercial'));
