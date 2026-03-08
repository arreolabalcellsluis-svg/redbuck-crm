
-- Enums for products
CREATE TYPE public.product_category AS ENUM ('elevadores','balanceadoras','desmontadoras','alineadoras','hidraulico','lubricacion','aire','otros');
CREATE TYPE public.product_currency AS ENUM ('MXN','USD');

-- Enums for customers
CREATE TYPE public.customer_type AS ENUM ('taller_mecanico','llantera','suspension_frenos','agencia','flotilla','transportista','vulcanizadora','particular','distribuidor');
CREATE TYPE public.lead_source AS ENUM ('facebook','whatsapp','llamada','recomendacion','sitio_web','visita_sucursal','expos','campaña','organico','otro');
CREATE TYPE public.customer_priority AS ENUM ('alta','media','baja');

-- Enums for quotations
CREATE TYPE public.quotation_status AS ENUM ('borrador','enviada','vista','seguimiento','aceptada','rechazada','vencida');

-- Enums for orders
CREATE TYPE public.order_status AS ENUM ('nuevo','por_confirmar','confirmado','confirmado_anticipo','apartado','entrega_programada','en_bodega','surtido_parcial','surtido_total','en_reparto','en_entrega','entregado','cancelado');
CREATE TYPE public.order_type AS ENUM ('directo','anticipo','apartado','entrega_futura');

-- ============ PRODUCTS ============
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text NOT NULL,
  name text NOT NULL,
  category product_category NOT NULL DEFAULT 'otros',
  brand text NOT NULL DEFAULT '',
  model text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  image text,
  list_price numeric NOT NULL DEFAULT 0,
  min_price numeric NOT NULL DEFAULT 0,
  cost numeric NOT NULL DEFAULT 0,
  currency product_currency NOT NULL DEFAULT 'MXN',
  delivery_days integer NOT NULL DEFAULT 0,
  supplier text NOT NULL DEFAULT '',
  warranty text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  stock jsonb NOT NULL DEFAULT '{}'::jsonb,
  in_transit integer NOT NULL DEFAULT 0,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============ CUSTOMERS ============
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  trade_name text,
  rfc text,
  type customer_type NOT NULL DEFAULT 'taller_mecanico',
  phone text NOT NULL DEFAULT '',
  whatsapp text,
  email text,
  city text NOT NULL DEFAULT '',
  state text NOT NULL DEFAULT '',
  vendor_id text,
  source lead_source NOT NULL DEFAULT 'otro',
  priority customer_priority NOT NULL DEFAULT 'media',
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============ QUOTATIONS ============
CREATE TABLE public.quotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folio text NOT NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name text NOT NULL,
  customer_phone text,
  customer_whatsapp text,
  vendor_id text,
  vendor_name text NOT NULL DEFAULT '',
  vendor_phone text,
  vendor_email text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  subtotal numeric NOT NULL DEFAULT 0,
  tax numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  status quotation_status NOT NULL DEFAULT 'borrador',
  valid_until date NOT NULL DEFAULT (CURRENT_DATE + interval '15 days'),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============ ORDERS ============
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folio text NOT NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name text NOT NULL,
  vendor_name text NOT NULL DEFAULT '',
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  total numeric NOT NULL DEFAULT 0,
  advance numeric NOT NULL DEFAULT 0,
  balance numeric NOT NULL DEFAULT 0,
  status order_status NOT NULL DEFAULT 'nuevo',
  order_type order_type NOT NULL DEFAULT 'directo',
  warehouse text NOT NULL DEFAULT '',
  promise_date date,
  quotation_folio text,
  scheduled_delivery_date date,
  delivery_notes text,
  reserve_deadline date,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- ============ RLS POLICIES ============

-- PRODUCTS: directors full access, gerencia/admin/compras/almacen can view, vendedores can view active
CREATE POLICY "Directors manage products" ON public.products FOR ALL USING (has_role(auth.uid(), 'director')) WITH CHECK (has_role(auth.uid(), 'director'));
CREATE POLICY "Compras manage products" ON public.products FOR ALL USING (has_role(auth.uid(), 'compras')) WITH CHECK (has_role(auth.uid(), 'compras'));
CREATE POLICY "Almacen manage products" ON public.products FOR ALL USING (has_role(auth.uid(), 'almacen')) WITH CHECK (has_role(auth.uid(), 'almacen'));
CREATE POLICY "Gerencia view products" ON public.products FOR SELECT USING (has_role(auth.uid(), 'gerencia_comercial'));
CREATE POLICY "Admin view products" ON public.products FOR SELECT USING (has_role(auth.uid(), 'administracion'));
CREATE POLICY "Vendedores view products" ON public.products FOR SELECT USING (has_role(auth.uid(), 'vendedor'));
CREATE POLICY "Tecnicos view products" ON public.products FOR SELECT USING (has_role(auth.uid(), 'tecnico'));

-- CUSTOMERS: directors/gerencia full, vendedores manage own, others view
CREATE POLICY "Directors manage customers" ON public.customers FOR ALL USING (has_role(auth.uid(), 'director')) WITH CHECK (has_role(auth.uid(), 'director'));
CREATE POLICY "Gerencia manage customers" ON public.customers FOR ALL USING (has_role(auth.uid(), 'gerencia_comercial')) WITH CHECK (has_role(auth.uid(), 'gerencia_comercial'));
CREATE POLICY "Vendedores manage customers" ON public.customers FOR ALL USING (has_role(auth.uid(), 'vendedor')) WITH CHECK (has_role(auth.uid(), 'vendedor'));
CREATE POLICY "Admin view customers" ON public.customers FOR SELECT USING (has_role(auth.uid(), 'administracion'));
CREATE POLICY "Compras view customers" ON public.customers FOR SELECT USING (has_role(auth.uid(), 'compras'));

-- QUOTATIONS: directors/gerencia full, vendedores manage own
CREATE POLICY "Directors manage quotations" ON public.quotations FOR ALL USING (has_role(auth.uid(), 'director')) WITH CHECK (has_role(auth.uid(), 'director'));
CREATE POLICY "Gerencia manage quotations" ON public.quotations FOR ALL USING (has_role(auth.uid(), 'gerencia_comercial')) WITH CHECK (has_role(auth.uid(), 'gerencia_comercial'));
CREATE POLICY "Vendedores manage quotations" ON public.quotations FOR ALL USING (has_role(auth.uid(), 'vendedor')) WITH CHECK (has_role(auth.uid(), 'vendedor'));
CREATE POLICY "Admin view quotations" ON public.quotations FOR SELECT USING (has_role(auth.uid(), 'administracion'));

-- ORDERS: directors/gerencia/admin full, vendedores view, almacen manage
CREATE POLICY "Directors manage orders" ON public.orders FOR ALL USING (has_role(auth.uid(), 'director')) WITH CHECK (has_role(auth.uid(), 'director'));
CREATE POLICY "Gerencia manage orders" ON public.orders FOR ALL USING (has_role(auth.uid(), 'gerencia_comercial')) WITH CHECK (has_role(auth.uid(), 'gerencia_comercial'));
CREATE POLICY "Admin manage orders" ON public.orders FOR ALL USING (has_role(auth.uid(), 'administracion')) WITH CHECK (has_role(auth.uid(), 'administracion'));
CREATE POLICY "Almacen manage orders" ON public.orders FOR ALL USING (has_role(auth.uid(), 'almacen')) WITH CHECK (has_role(auth.uid(), 'almacen'));
CREATE POLICY "Vendedores view orders" ON public.orders FOR SELECT USING (has_role(auth.uid(), 'vendedor'));
CREATE POLICY "Compras view orders" ON public.orders FOR SELECT USING (has_role(auth.uid(), 'compras'));
