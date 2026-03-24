import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface DBProduct {
  id: string;
  sku: string;
  name: string;
  category: string;
  brand: string;
  model: string;
  description: string;
  image: string | null;
  images: string[];
  list_price: number;
  min_price: number;
  cost: number;
  currency: 'MXN' | 'USD';
  delivery_days: number;
  supplier: string;
  warranty: string;
  active: boolean;
  stock: Record<string, number>;
  in_transit: number;
  capacity: string;
  price_client: number;
  price_distributor: number;
  commission_distributor: number;
  commission_admin: number;
  created_at: string;
  updated_at: string;
}

function mapRow(row: any): DBProduct {
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    category: row.category,
    brand: row.brand,
    model: row.model,
    description: row.description,
    image: row.image,
    images: Array.isArray(row.images) ? row.images : [],
    list_price: Number(row.list_price),
    min_price: Number(row.min_price),
    cost: Number(row.cost),
    currency: row.currency,
    delivery_days: row.delivery_days,
    supplier: row.supplier,
    warranty: row.warranty,
    active: row.active,
    stock: typeof row.stock === 'object' ? row.stock : {},
    in_transit: row.in_transit,
    capacity: row.capacity || '',
    price_client: Number(row.price_client || 0),
    price_distributor: Number(row.price_distributor || 0),
    commission_distributor: Number(row.commission_distributor || 0),
    commission_admin: Number(row.commission_admin || 0),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function useProducts() {
  return useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name');
      if (error) throw error;
      return (data ?? []).map(mapRow);
    },
  });
}

export function useAddProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (product: Omit<DBProduct, 'id' | 'created_at' | 'updated_at'>) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('products').insert({
        sku: product.sku,
        name: product.name,
        category: product.category as any,
        brand: product.brand,
        model: product.model,
        description: product.description,
        image: product.image,
        images: (product.images ?? []) as any,
        list_price: product.list_price,
        min_price: product.min_price,
        cost: product.cost,
        currency: product.currency as any,
        delivery_days: product.delivery_days,
        supplier: product.supplier,
        warranty: product.warranty,
        active: product.active,
        stock: product.stock as any,
        in_transit: product.in_transit,
        capacity: product.capacity || '',
        price_client: product.price_client || 0,
        price_distributor: product.price_distributor || 0,
        commission_distributor: product.commission_distributor || 0,
        commission_admin: product.commission_admin || 0,
        user_id: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      toast({ title: 'Producto registrado' });
    },
    onError: (e: any) => toast({ title: 'Error al guardar producto', description: e.message, variant: 'destructive' }),
  });
}

export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...product }: Partial<DBProduct> & { id: string }) => {
      const updates: Record<string, any> = { updated_at: new Date().toISOString() };
      if (product.sku !== undefined) updates.sku = product.sku;
      if (product.name !== undefined) updates.name = product.name;
      if (product.category !== undefined) updates.category = product.category;
      if (product.brand !== undefined) updates.brand = product.brand;
      if (product.model !== undefined) updates.model = product.model;
      if (product.cost !== undefined) updates.cost = product.cost;
      if (product.list_price !== undefined) updates.list_price = product.list_price;
      if (product.min_price !== undefined) updates.min_price = product.min_price;
      if (product.stock !== undefined) updates.stock = product.stock;
      if (product.in_transit !== undefined) updates.in_transit = product.in_transit;
      if (product.active !== undefined) updates.active = product.active;
      if (product.image !== undefined) updates.image = product.image;
      if (product.images !== undefined) updates.images = product.images;
      if (product.description !== undefined) updates.description = product.description;
      if (product.supplier !== undefined) updates.supplier = product.supplier;
      if (product.warranty !== undefined) updates.warranty = product.warranty;
      if (product.delivery_days !== undefined) updates.delivery_days = product.delivery_days;
      if (product.currency !== undefined) updates.currency = product.currency;

      const { error } = await supabase.from('products').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      toast({ title: 'Producto actualizado' });
    },
    onError: (e: any) => toast({ title: 'Error al actualizar', description: e.message, variant: 'destructive' }),
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      toast({ title: 'Producto eliminado' });
    },
    onError: (e: any) => toast({ title: 'Error al eliminar', description: e.message, variant: 'destructive' }),
  });
}
