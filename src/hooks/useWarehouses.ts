import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Warehouse } from '@/types';

function dbToWarehouse(row: any): Warehouse {
  return {
    id: row.id,
    name: row.name,
    location: row.location,
    hasExhibition: row.has_exhibition,
  };
}

export function useWarehouses() {
  return useQuery({
    queryKey: ['warehouses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('warehouses')
        .select('*')
        .order('name', { ascending: true });
      if (error) throw error;
      return (data ?? []).map(dbToWarehouse);
    },
  });
}

export function useAddWarehouse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (w: Omit<Warehouse, 'id'>) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('warehouses').insert({
        name: w.name,
        location: w.location,
        has_exhibition: w.hasExhibition,
        user_id: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['warehouses'] });
      toast.success('Bodega creada');
    },
    onError: (e: any) => toast.error('Error: ' + e.message),
  });
}

export function useUpdateWarehouse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...w }: Partial<Warehouse> & { id: string }) => {
      const updates: Record<string, any> = { updated_at: new Date().toISOString() };
      if (w.name !== undefined) updates.name = w.name;
      if (w.location !== undefined) updates.location = w.location;
      if (w.hasExhibition !== undefined) updates.has_exhibition = w.hasExhibition;
      const { error } = await supabase.from('warehouses').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['warehouses'] });
      toast.success('Bodega actualizada');
    },
    onError: (e: any) => toast.error('Error: ' + e.message),
  });
}

export function useDeleteWarehouse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('warehouses').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['warehouses'] });
      toast.success('Bodega eliminada');
    },
    onError: (e: any) => toast.error('Error: ' + e.message),
  });
}
