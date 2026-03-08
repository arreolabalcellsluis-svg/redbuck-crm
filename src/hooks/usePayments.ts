import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Payment {
  id: string;
  invoice_id: string;
  customer_id: string | null;
  amount: number;
  previous_balance: number;
  remaining_balance: number;
  payment_date: string;
  payment_form: string;
  currency: string;
  exchange_rate: number;
  operation_reference: string;
  bank: string;
  notes: string;
  complement_status: string;
  complement_uuid: string;
  complement_xml_path: string;
  complement_pdf_path: string;
  created_by: string;
  user_id: string | null;
  created_at: string;
  updated_at: string;
}

export function usePayments() {
  return useQuery({
    queryKey: ['payments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Payment[];
    },
  });
}

export function usePaymentsByInvoice(invoiceId?: string) {
  return useQuery({
    queryKey: ['payments', 'invoice', invoiceId],
    enabled: !!invoiceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('invoice_id', invoiceId!)
        .order('payment_date', { ascending: true });
      if (error) throw error;
      return (data ?? []) as Payment[];
    },
  });
}

export function useCreatePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      invoice_id: string;
      customer_id: string | null;
      amount: number;
      previous_balance: number;
      remaining_balance: number;
      payment_date: string;
      payment_form: string;
      currency: string;
      exchange_rate: number;
      operation_reference?: string;
      bank?: string;
      notes?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();

      // Insert payment
      const { data, error } = await supabase
        .from('payments')
        .insert({
          ...payload,
          user_id: user?.id,
          created_by: user?.email || '',
        } as any)
        .select('id')
        .single();
      if (error) throw error;

      // Update invoice payment_status
      const newStatus = payload.remaining_balance <= 0 ? 'pagada' : 'parcial';
      const { error: invErr } = await supabase
        .from('invoices')
        .update({ payment_status: newStatus, updated_at: new Date().toISOString() } as any)
        .eq('id', payload.invoice_id);
      if (invErr) throw invErr;

      return data.id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payments'] });
      qc.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Pago registrado correctamente');
    },
    onError: (e: any) => toast.error('Error al registrar pago: ' + e.message),
  });
}
