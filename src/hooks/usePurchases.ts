import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface DBPurchase {
  id: string;
  folio: string;
  supplier: string;
  products: string;
  total: number;
  status: string;
  date: string;
  items: any[];
  notes: string | null;
  created_at: string;
  updated_at: string;
}

function mapRow(row: any): DBPurchase {
  return {
    id: row.id,
    folio: row.folio,
    supplier: row.supplier,
    products: row.products,
    total: Number(row.total),
    status: row.status,
    date: row.date,
    items: Array.isArray(row.items) ? row.items : [],
    notes: row.notes,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function usePurchases() {
  return useQuery({
    queryKey: ['purchases'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchases')
        .select('*')
        .order('date', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(mapRow);
    },
  });
}

export function useAddPurchase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: Omit<DBPurchase, 'id' | 'created_at' | 'updated_at'>) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('purchases').insert({
        folio: p.folio,
        supplier: p.supplier,
        products: p.products,
        total: p.total,
        status: p.status,
        date: p.date,
        items: p.items as any,
        notes: p.notes,
        user_id: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchases'] });
      toast({ title: 'Orden de compra creada' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });
}

export function useUpdatePurchase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...fields }: Partial<DBPurchase> & { id: string }) => {
      const updates: Record<string, any> = { updated_at: new Date().toISOString() };
      Object.entries(fields).forEach(([k, v]) => {
        if (v !== undefined && k !== 'created_at') updates[k] = v;
      });
      const { error } = await supabase.from('purchases').update(updates as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchases'] });
      toast({ title: 'Orden actualizada' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });
}
