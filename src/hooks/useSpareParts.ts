import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { SparePart } from '@/types';

function dbToSparePart(row: any): SparePart {
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    productId: row.product_id,
    productName: row.product_name,
    cost: Number(row.cost),
    price: Number(row.price),
    stock: Number(row.stock),
    minStock: Number(row.min_stock),
    warehouse: row.warehouse,
    active: row.active,
    image: row.image || '',
    images: Array.isArray(row.images) ? row.images : [],
  };
}

export function useSpareParts() {
  return useQuery({
    queryKey: ['spare_parts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('spare_parts')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(dbToSparePart);
    },
  });
}

export function useAddSparePart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (sp: Omit<SparePart, 'id'>) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('spare_parts').insert({
        sku: sp.sku,
        name: sp.name,
        product_id: sp.productId,
        product_name: sp.productName,
        cost: sp.cost,
        price: sp.price,
        stock: sp.stock,
        min_stock: sp.minStock,
        warehouse: sp.warehouse,
        active: sp.active,
        image: sp.image || null,
        images: (sp.images ?? []) as any,
        user_id: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['spare_parts'] });
      toast.success('Refacción creada');
    },
    onError: (e: any) => toast.error('Error: ' + e.message),
  });
}

export function useUpdateSparePart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...sp }: Partial<SparePart> & { id: string }) => {
      const updates: Record<string, any> = { updated_at: new Date().toISOString() };
      if (sp.sku !== undefined) updates.sku = sp.sku;
      if (sp.name !== undefined) updates.name = sp.name;
      if (sp.productId !== undefined) updates.product_id = sp.productId;
      if (sp.productName !== undefined) updates.product_name = sp.productName;
      if (sp.cost !== undefined) updates.cost = sp.cost;
      if (sp.price !== undefined) updates.price = sp.price;
      if (sp.stock !== undefined) updates.stock = sp.stock;
      if (sp.minStock !== undefined) updates.min_stock = sp.minStock;
      if (sp.warehouse !== undefined) updates.warehouse = sp.warehouse;
      if (sp.active !== undefined) updates.active = sp.active;
      if (sp.image !== undefined) updates.image = sp.image || null;
      const { error } = await supabase.from('spare_parts').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['spare_parts'] });
      toast.success('Refacción actualizada');
    },
    onError: (e: any) => toast.error('Error: ' + e.message),
  });
}

export function useDeleteSparePart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('spare_parts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['spare_parts'] });
      toast.success('Refacción eliminada');
    },
    onError: (e: any) => toast.error('Error: ' + e.message),
  });
}
