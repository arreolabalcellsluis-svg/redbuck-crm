import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import type { SalesGoal } from '@/lib/vendorKPIsEngine';

function mapRow(row: any): SalesGoal {
  return {
    id: row.id,
    vendor_id: row.vendor_id,
    vendor_name: row.vendor_name,
    month: row.month,
    year: row.year,
    goal_sales: Number(row.goal_sales),
    goal_quotations: Number(row.goal_quotations),
    goal_orders: Number(row.goal_orders),
    goal_new_customers: Number(row.goal_new_customers),
    goal_followups: Number(row.goal_followups),
  };
}

export function useSalesGoals(month?: number, year?: number) {
  return useQuery({
    queryKey: ['sales_goals', month, year],
    queryFn: async () => {
      let q = supabase.from('sales_goals').select('*');
      if (month) q = q.eq('month', month);
      if (year) q = q.eq('year', year);
      const { data, error } = await q.order('vendor_name');
      if (error) throw error;
      return (data ?? []).map(mapRow);
    },
  });
}

export function useUpsertSalesGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (goal: Omit<SalesGoal, 'id'> & { id?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const payload = {
        vendor_id: goal.vendor_id,
        vendor_name: goal.vendor_name,
        month: goal.month,
        year: goal.year,
        goal_sales: goal.goal_sales,
        goal_quotations: goal.goal_quotations,
        goal_orders: goal.goal_orders,
        goal_new_customers: goal.goal_new_customers,
        goal_followups: goal.goal_followups,
        user_id: user?.id ?? null,
        updated_at: new Date().toISOString(),
      };

      if (goal.id) {
        const { error } = await supabase.from('sales_goals').update(payload).eq('id', goal.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('sales_goals').insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sales_goals'] });
      toast({ title: 'Meta guardada' });
    },
    onError: (e: any) => toast({ title: 'Error al guardar meta', description: e.message, variant: 'destructive' }),
  });
}

export function useDeleteSalesGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('sales_goals').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sales_goals'] });
      toast({ title: 'Meta eliminada' });
    },
    onError: (e: any) => toast({ title: 'Error al eliminar', description: e.message, variant: 'destructive' }),
  });
}
