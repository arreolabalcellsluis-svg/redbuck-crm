import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface DBQuotation {
  id: string;
  folio: string;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  customer_whatsapp: string | null;
  vendor_id: string | null;
  vendor_name: string;
  vendor_phone: string | null;
  vendor_email: string | null;
  items: any[];
  subtotal: number;
  tax: number;
  total: number;
  status: string;
  valid_until: string;
  created_at: string;
  updated_at: string;
}

function mapRow(row: any): DBQuotation {
  return {
    id: row.id,
    folio: row.folio,
    customer_id: row.customer_id,
    customer_name: row.customer_name,
    customer_phone: row.customer_phone,
    customer_whatsapp: row.customer_whatsapp,
    vendor_id: row.vendor_id,
    vendor_name: row.vendor_name,
    vendor_phone: row.vendor_phone,
    vendor_email: row.vendor_email,
    items: Array.isArray(row.items) ? row.items : [],
    subtotal: Number(row.subtotal),
    tax: Number(row.tax),
    total: Number(row.total),
    status: row.status,
    valid_until: row.valid_until,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function useQuotations() {
  return useQuery({
    queryKey: ['quotations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quotations')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(mapRow);
    },
  });
}

export function useAddQuotation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (q: Omit<DBQuotation, 'id' | 'created_at' | 'updated_at'>) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('quotations').insert({
        folio: q.folio,
        customer_id: q.customer_id,
        customer_name: q.customer_name,
        customer_phone: q.customer_phone,
        customer_whatsapp: q.customer_whatsapp,
        vendor_id: q.vendor_id,
        vendor_name: q.vendor_name,
        vendor_phone: q.vendor_phone,
        vendor_email: q.vendor_email,
        items: q.items as any,
        subtotal: q.subtotal,
        tax: q.tax,
        total: q.total,
        status: q.status as any,
        valid_until: q.valid_until,
        user_id: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quotations'] });
      toast({ title: 'Cotización registrada' });
    },
    onError: (e: any) => toast({ title: 'Error al guardar cotización', description: e.message, variant: 'destructive' }),
  });
}

export function useUpdateQuotationStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from('quotations').update({
        status: status as any,
        updated_at: new Date().toISOString(),
      }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quotations'] });
      toast({ title: 'Estatus actualizado' });
    },
    onError: (e: any) => toast({ title: 'Error al actualizar', description: e.message, variant: 'destructive' }),
  });
}

export function useDeleteQuotation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('quotations').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quotations'] });
      toast({ title: 'Cotización eliminada' });
    },
    onError: (e: any) => toast({ title: 'Error al eliminar', description: e.message, variant: 'destructive' }),
  });
}
