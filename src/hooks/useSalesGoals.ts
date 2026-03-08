import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import type { SalesGoal, CommissionConfig, ScoreWeights, ScoreLevel } from '@/lib/vendorKPIsEngine';
import { DEFAULT_COMMISSION_CONFIG, DEFAULT_SCORE_WEIGHTS, DEFAULT_SCORE_LEVELS } from '@/lib/vendorKPIsEngine';

function mapGoalRow(row: any): SalesGoal {
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
    goal_collections: Number(row.goal_collections ?? 0),
    goal_min_margin: Number(row.goal_min_margin ?? 0),
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
      return (data ?? []).map(mapGoalRow);
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
        goal_collections: goal.goal_collections,
        goal_min_margin: goal.goal_min_margin,
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

// ─── Commission Config Hook ────────────────────────────────────
export function useCommissionConfig() {
  return useQuery({
    queryKey: ['commission_config'],
    queryFn: async () => {
      const { data, error } = await supabase.from('commission_config').select('*');
      if (error) throw error;
      const map = new Map((data ?? []).map((r: any) => [r.config_key, r.config_value]));

      const config: CommissionConfig = {
        baseRate: (map.get('base_rate') as any)?.rate ?? DEFAULT_COMMISSION_CONFIG.baseRate,
        marginBonuses: (map.get('margin_bonuses') as any) ?? DEFAULT_COMMISSION_CONFIG.marginBonuses,
        goalBonuses: (map.get('goal_bonuses') as any) ?? DEFAULT_COMMISSION_CONFIG.goalBonuses,
        newCustomerBonus: (map.get('new_customer_bonus') as any)?.amount ?? DEFAULT_COMMISSION_CONFIG.newCustomerBonus,
        collectionBonusRate: (map.get('collection_bonus') as any)?.rate ?? DEFAULT_COMMISSION_CONFIG.collectionBonusRate,
      };
      const weights: ScoreWeights = (map.get('score_weights') as any) ?? DEFAULT_SCORE_WEIGHTS;
      const levels: ScoreLevel[] = (map.get('score_levels') as any) ?? DEFAULT_SCORE_LEVELS;

      return { config, weights, levels };
    },
  });
}

export function useUpdateCommissionConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: any }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('commission_config')
        .update({ config_value: value, updated_at: new Date().toISOString(), user_id: user?.id ?? null })
        .eq('config_key', key);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['commission_config'] });
      toast({ title: 'Configuración actualizada' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });
}
