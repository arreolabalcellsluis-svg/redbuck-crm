
-- Create expense categories enum
CREATE TYPE public.expense_category AS ENUM (
  'personal', 'administracion', 'ventas', 'logistica', 
  'importaciones', 'financieros', 'servicio_tecnico', 
  'legales_contables', 'otros'
);

-- Create expense type enum
CREATE TYPE public.expense_type AS ENUM ('fijo', 'variable');

-- Create expense area enum  
CREATE TYPE public.expense_area AS ENUM (
  'ventas', 'administracion', 'logistica', 'operaciones', 
  'direccion', 'servicio_tecnico', 'importaciones'
);

-- Create operating_expenses table
CREATE TABLE public.operating_expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  categoria expense_category NOT NULL,
  subcategoria TEXT NOT NULL,
  descripcion TEXT NOT NULL,
  monto NUMERIC(12,2) NOT NULL DEFAULT 0,
  tipo expense_type NOT NULL DEFAULT 'variable',
  area expense_area NOT NULL DEFAULT 'administracion',
  notas TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.operating_expenses ENABLE ROW LEVEL SECURITY;

-- RLS policies: directors and administracion can manage all expenses
CREATE POLICY "Directors can manage all expenses"
  ON public.operating_expenses FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'director'))
  WITH CHECK (public.has_role(auth.uid(), 'director'));

CREATE POLICY "Administracion can manage all expenses"
  ON public.operating_expenses FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'administracion'))
  WITH CHECK (public.has_role(auth.uid(), 'administracion'));

CREATE POLICY "Gerencia comercial can view expenses"
  ON public.operating_expenses FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'gerencia_comercial'));

CREATE POLICY "Compras can view expenses"
  ON public.operating_expenses FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'compras'));
