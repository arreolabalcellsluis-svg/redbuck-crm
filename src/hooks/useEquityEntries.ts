import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export type EquityType = 'aportacion_socios' | 'utilidad_ejercicio' | 'utilidades_acumuladas';

export interface EquityEntry {
  id: string;
  tipo: EquityType;
  concepto: string;
  monto: number;
  fecha_inicio: string;
  fecha_fin: string | null;
  notas: string;
}

const mapRow = (r: any): EquityEntry => ({
  id: r.id,
  tipo: r.tipo,
  concepto: r.concepto,
  monto: Number(r.monto),
  fecha_inicio: r.fecha_inicio,
  fecha_fin: r.fecha_fin,
  notas: r.notas ?? '',
});

export function useEquityEntries() {
  return useQuery({
    queryKey: ['equity_entries'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from('equity_entries').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(mapRow);
    },
  });
}

export function useAddEquityEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entry: Omit<EquityEntry, 'id'>) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from('equity_entries').insert({ ...entry, user_id: user?.id });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['equity_entries'] }); toast({ title: 'Registro agregado' }); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });
}

export function useUpdateEquityEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entry: EquityEntry) => {
      const { id, ...rest } = entry;
      const { error } = await (supabase as any).from('equity_entries').update({ ...rest, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['equity_entries'] }); toast({ title: 'Registro actualizado' }); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });
}

export function useDeleteEquityEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('equity_entries').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['equity_entries'] }); toast({ title: 'Registro eliminado' }); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });
}
