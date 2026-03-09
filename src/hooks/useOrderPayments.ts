import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface DBOrderPayment {
  id: string;
  order_id: string;
  payment_date: string;
  amount: number;
  method: string;
  reference: string;
  comment: string;
  registered_by: string;
  user_id: string | null;
  created_at: string;
}

export function useOrderPayments() {
  return useQuery({
    queryKey: ['order_payments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('order_payments')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as DBOrderPayment[];
    },
  });
}

export function useAddOrderPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payment: Omit<DBOrderPayment, 'id' | 'created_at' | 'user_id'>) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('order_payments').insert({
        order_id: payment.order_id,
        payment_date: payment.payment_date,
        amount: payment.amount,
        method: payment.method,
        reference: payment.reference,
        comment: payment.comment,
        registered_by: payment.registered_by,
        user_id: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['order_payments'] });
      qc.invalidateQueries({ queryKey: ['accounts_receivable'] });
    },
    onError: (e: any) => toast.error('Error al registrar pago: ' + e.message),
  });
}
