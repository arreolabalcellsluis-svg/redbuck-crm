import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useAppSettings() {
  return useQuery({
    queryKey: ['app_settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('*');
      if (error) throw error;
      const map: Record<string, any> = {};
      (data ?? []).forEach((row: any) => {
        map[row.setting_key] = row.setting_value;
      });
      return map;
    },
  });
}

export function useSaveSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: any }) => {
      const { data: { user } } = await supabase.auth.getUser();
      // Upsert by setting_key
      const { error } = await supabase.from('app_settings').upsert(
        {
          setting_key: key,
          setting_value: value,
          user_id: user?.id ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'setting_key' }
      );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['app_settings'] });
    },
    onError: (e: any) => toast.error('Error: ' + e.message),
  });
}
