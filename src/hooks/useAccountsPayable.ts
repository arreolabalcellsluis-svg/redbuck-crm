import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface DBAccountPayable {
  id: string;
  supplier_name: string;
  invoice_number: string;
  description: string;
  invoice_date: string;
  due_date: string;
  total: number;
  paid: number;
  balance: number;
  currency: string;
  status: 'pendiente' | 'por_vencer' | 'vencida' | 'pago_parcial' | 'liquidada' | 'cancelada';
  payment_method: string | null;
  import_order_id: string | null;
  purchase_order_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

function mapRow(row: any): DBAccountPayable {
  return {
    id: row.id,
    supplier_name: row.supplier_name,
    invoice_number: row.invoice_number,
    description: row.description,
    invoice_date: row.invoice_date,
    due_date: row.due_date,
    total: Number(row.total),
    paid: Number(row.paid),
    balance: Number(row.balance),
    currency: row.currency,
    status: row.status,
    payment_method: row.payment_method,
    import_order_id: row.import_order_id,
    purchase_order_id: row.purchase_order_id,
    notes: row.notes,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function useAccountsPayable() {
  return useQuery({
    queryKey: ['accounts_payable'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts_payable')
        .select('*')
        .order('due_date', { ascending: true });
      if (error) throw error;
      return (data ?? []).map(mapRow);
    },
  });
}

export function useAddPayable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payable: Omit<DBAccountPayable, 'id' | 'created_at' | 'updated_at'>) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('accounts_payable').insert({
        supplier_name: payable.supplier_name,
        invoice_number: payable.invoice_number,
        description: payable.description,
        invoice_date: payable.invoice_date,
        due_date: payable.due_date,
        total: payable.total,
        paid: payable.paid,
        balance: payable.balance,
        currency: payable.currency,
        status: payable.status as any,
        payment_method: payable.payment_method as any,
        import_order_id: payable.import_order_id,
        purchase_order_id: payable.purchase_order_id,
        notes: payable.notes,
        user_id: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounts_payable'] });
      toast({ title: 'Factura registrada' });
    },
    onError: (e: any) => toast({ title: 'Error al guardar', description: e.message, variant: 'destructive' }),
  });
}

export function useUpdatePayable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...fields }: Partial<DBAccountPayable> & { id: string }) => {
      const updates: Record<string, any> = { updated_at: new Date().toISOString() };
      Object.entries(fields).forEach(([k, v]) => {
        if (v !== undefined) updates[k] = v;
      });
      const { error } = await supabase.from('accounts_payable').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounts_payable'] });
      toast({ title: 'Factura actualizada' });
    },
    onError: (e: any) => toast({ title: 'Error al actualizar', description: e.message, variant: 'destructive' }),
  });
}

export function useRegisterPayablePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, amount, method }: { id: string; amount: number; method: string }) => {
      // Fetch current record
      const { data: current, error: fetchErr } = await supabase
        .from('accounts_payable')
        .select('total, paid, balance')
        .eq('id', id)
        .single();
      if (fetchErr || !current) throw fetchErr || new Error('No encontrado');

      const newPaid = Number(current.paid) + amount;
      const newBalance = Number(current.total) - newPaid;
      const newStatus = newBalance <= 0 ? 'liquidada' : 'pago_parcial';

      const { error } = await supabase.from('accounts_payable').update({
        paid: newPaid,
        balance: Math.max(0, newBalance),
        status: newStatus as any,
        payment_method: method as any,
        updated_at: new Date().toISOString(),
      }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounts_payable'] });
      toast({ title: 'Pago registrado' });
    },
    onError: (e: any) => toast({ title: 'Error al registrar pago', description: e.message, variant: 'destructive' }),
  });
}

export function useDeletePayable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('accounts_payable').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounts_payable'] });
      toast({ title: 'Factura eliminada' });
    },
    onError: (e: any) => toast({ title: 'Error al eliminar', description: e.message, variant: 'destructive' }),
  });
}
