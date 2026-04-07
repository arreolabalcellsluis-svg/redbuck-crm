import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface DBAccountReceivable {
  id: string;
  order_id: string;
  customer_id: string | null;
  customer_name: string;
  order_folio: string;
  total: number;
  paid: number;
  balance: number;
  due_date: string;
  days_overdue: number;
  status: string;
  user_id: string | null;
  created_at: string;
  updated_at: string;
}

export function useAccountsReceivable() {
  return useQuery({
    queryKey: ['accounts_receivable'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts_receivable')
        .select('*')
        .order('due_date', { ascending: true });
      if (error) throw error;
      return (data ?? []) as DBAccountReceivable[];
    },
  });
}

export function useAddAccountReceivable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ar: Omit<DBAccountReceivable, 'id' | 'created_at' | 'updated_at' | 'user_id'>) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('accounts_receivable').insert({
        order_id: ar.order_id,
        customer_id: ar.customer_id,
        customer_name: ar.customer_name,
        order_folio: ar.order_folio,
        total: ar.total,
        paid: ar.paid,
        balance: ar.balance,
        due_date: ar.due_date,
        days_overdue: ar.days_overdue,
        status: ar.status,
        user_id: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounts_receivable'] });
    },
    onError: (e: any) => toast.error('Error al crear cuenta por cobrar: ' + e.message),
  });
}

export function useUpdateAccountReceivable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...fields }: Partial<DBAccountReceivable> & { id: string }) => {
      const updates: Record<string, any> = { updated_at: new Date().toISOString() };
      Object.entries(fields).forEach(([k, v]) => { if (v !== undefined) updates[k] = v; });
      const { error } = await supabase.from('accounts_receivable').update(updates as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounts_receivable'] });
    },
    onError: (e: any) => toast.error('Error al actualizar: ' + e.message),
  });
}
