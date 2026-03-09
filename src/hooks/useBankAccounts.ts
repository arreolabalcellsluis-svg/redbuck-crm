import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface BankAccount {
  id: string;
  nombre: string;
  banco: string;
  numero_cuenta: string;
  clabe: string;
  moneda: string;
  saldo: number;
  activa: boolean;
  notas: string;
}

const mapRow = (r: any): BankAccount => ({
  id: r.id,
  nombre: r.nombre,
  banco: r.banco,
  numero_cuenta: r.numero_cuenta,
  clabe: r.clabe ?? '',
  moneda: r.moneda,
  saldo: Number(r.saldo),
  activa: r.activa,
  notas: r.notas ?? '',
});

export function useBankAccounts() {
  return useQuery({
    queryKey: ['bank_accounts'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from('bank_accounts').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(mapRow);
    },
  });
}

export function useAddBankAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (account: Omit<BankAccount, 'id'>) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from('bank_accounts').insert({ ...account, user_id: user?.id });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bank_accounts'] }); toast({ title: 'Cuenta bancaria agregada' }); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });
}

export function useUpdateBankAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (account: BankAccount) => {
      const { id, ...rest } = account;
      const { error } = await (supabase as any).from('bank_accounts').update({ ...rest, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bank_accounts'] }); toast({ title: 'Cuenta actualizada' }); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });
}

export function useDeleteBankAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('bank_accounts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bank_accounts'] }); toast({ title: 'Cuenta eliminada' }); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });
}
