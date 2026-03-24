import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import type { AreaGoalConfig, AreaKPIDefinition } from '@/lib/areaGoalsEngine';
import { getDefaultKPIs } from '@/lib/areaGoalsEngine';

function mapRow(row: any): AreaGoalConfig {
  return {
    id: row.id,
    area: row.area,
    month: row.month,
    year: row.year,
    userName: row.user_name ?? '',
    kpiConfig: Array.isArray(row.kpi_config) ? row.kpi_config : getDefaultKPIs(row.area),
    bonusBase: Number(row.bonus_base ?? 0),
    bonusOverperformanceRate: Number(row.bonus_overperformance_rate ?? 0),
    manualKpiValues: row.manual_kpi_values && typeof row.manual_kpi_values === 'object' ? row.manual_kpi_values : {},
  };
}

export function useAreaGoals(month?: number, year?: number) {
  return useQuery({
    queryKey: ['area_goals', month, year],
    queryFn: async () => {
      let q = supabase.from('area_goals' as any).select('*');
      if (month) q = q.eq('month', month);
      if (year) q = q.eq('year', year);
      const { data, error } = await q.order('area');
      if (error) throw error;
      return (data ?? []).map(mapRow);
    },
  });
}

export function useUpsertAreaGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (config: AreaGoalConfig) => {
      const { data: { user } } = await supabase.auth.getUser();
      const payload = {
        area: config.area,
        month: config.month,
        year: config.year,
        user_name: config.userName,
        kpi_config: config.kpiConfig as any,
        bonus_base: config.bonusBase,
        bonus_overperformance_rate: config.bonusOverperformanceRate,
        manual_kpi_values: config.manualKpiValues as any,
        user_id: user?.id ?? null,
        updated_at: new Date().toISOString(),
      };

      if (config.id) {
        const { error } = await supabase.from('area_goals' as any).update(payload).eq('id', config.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('area_goals' as any).upsert(payload as any, { onConflict: 'area,month,year' });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['area_goals'] });
      toast({ title: 'Configuración de área guardada' });
    },
    onError: (e: any) => toast({ title: 'Error al guardar', description: e.message, variant: 'destructive' }),
  });
}
