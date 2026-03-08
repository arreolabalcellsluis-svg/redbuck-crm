import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import type { OperatingExpense, ExpenseCategory, ExpenseType, ExpenseArea } from '@/lib/operatingExpensesEngine';

// Map DB row to app type
function mapRow(row: any): OperatingExpense {
  return {
    id: row.id,
    fecha: row.fecha,
    categoria: row.categoria as ExpenseCategory,
    subcategoria: row.subcategoria,
    descripcion: row.descripcion,
    monto: Number(row.monto),
    tipo: row.tipo as ExpenseType,
    area: row.area as ExpenseArea,
    notas: row.notas ?? undefined,
  };
}

export function useExpenses() {
  return useQuery({
    queryKey: ['operating_expenses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operating_expenses')
        .select('*')
        .order('fecha', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(mapRow);
    },
  });
}

export function useAddExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (expense: Omit<OperatingExpense, 'id'>) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('operating_expenses').insert({
        fecha: expense.fecha,
        categoria: expense.categoria,
        subcategoria: expense.subcategoria,
        descripcion: expense.descripcion,
        monto: expense.monto,
        tipo: expense.tipo,
        area: expense.area,
        notas: expense.notas ?? null,
        user_id: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['operating_expenses'] });
      toast({ title: 'Gasto registrado' });
    },
    onError: (e: any) => toast({ title: 'Error al guardar', description: e.message, variant: 'destructive' }),
  });
}

export function useDeleteExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('operating_expenses').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['operating_expenses'] });
      toast({ title: 'Gasto eliminado' });
    },
    onError: (e: any) => toast({ title: 'Error al eliminar', description: e.message, variant: 'destructive' }),
  });
}
