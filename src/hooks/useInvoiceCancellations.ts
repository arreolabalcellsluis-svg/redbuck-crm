import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface InvoiceCancellation {
  id: string;
  invoice_id: string;
  cancellation_reason: string;
  substitute_uuid: string | null;
  canceled_by: string;
  canceled_at: string;
  cancellation_ack_path: string | null;
  created_at: string;
}

export function useInvoiceCancellations() {
  return useQuery({
    queryKey: ['invoice_cancellations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoice_cancellations')
        .select('*')
        .order('canceled_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as InvoiceCancellation[];
    },
  });
}

export function useCancelInvoiceInternal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      invoice_id: string;
      reason: string;
      notes?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();

      // Update invoice status to cancelada (internal only)
      const { error: invErr } = await supabase
        .from('invoices')
        .update({
          status: 'cancelada' as any,
          canceled_at: new Date().toISOString(),
          notes: payload.notes || '',
          updated_at: new Date().toISOString(),
        })
        .eq('id', payload.invoice_id);
      if (invErr) throw invErr;

      // Create cancellation record
      const { error: cancelErr } = await supabase
        .from('invoice_cancellations')
        .insert({
          invoice_id: payload.invoice_id,
          cancellation_reason: payload.reason as any,
          canceled_by: user?.email || 'sistema',
          user_id: user?.id,
        } as any);
      if (cancelErr) throw cancelErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['invoice_cancellations'] });
      toast.success('Factura cancelada internamente');
    },
    onError: (e: any) => toast.error('Error al cancelar: ' + e.message),
  });
}

export function useCancelInvoiceSAT() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      invoice_id: string;
      reason: string;
      substitute_uuid?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('facturama-cfdi', {
        body: {
          action: 'cancel',
          invoice_id: payload.invoice_id,
          reason: payload.reason,
          substitute_uuid: payload.substitute_uuid,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Error de cancelación SAT');
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['invoice_cancellations'] });
      toast.success('Solicitud de cancelación enviada al SAT');
    },
    onError: (e: any) => toast.error('Error cancelación SAT: ' + e.message),
  });
}
