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
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: ['quotations'] });
      const previous = qc.getQueryData(['quotations']);
      qc.setQueryData(['quotations'], (old: any[] | undefined) =>
        old?.map(q => q.id === id ? { ...q, status, updated_at: new Date().toISOString() } : q) ?? []
      );
      return { previous };
    },
    onError: (e: any, _vars, context) => {
      if (context?.previous) qc.setQueryData(['quotations'], context.previous);
      toast({ title: 'Error al actualizar estatus', description: e.message, variant: 'destructive' });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['quotations'] });
    },
    onSuccess: () => {
      toast({ title: 'Estatus actualizado' });
    },
  });
}

export function useUpdateQuotation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...fields }: {
      id: string;
      customer_id?: string | null;
      customer_name?: string;
      customer_phone?: string | null;
      customer_whatsapp?: string | null;
      vendor_id?: string | null;
      vendor_name?: string;
      vendor_phone?: string | null;
      vendor_email?: string | null;
      items?: any[];
      subtotal?: number;
      tax?: number;
      total?: number;
      status?: string;
      valid_until?: string;
    }) => {
      const updates: Record<string, any> = { updated_at: new Date().toISOString() };
      if (fields.customer_id !== undefined) updates.customer_id = fields.customer_id;
      if (fields.customer_name !== undefined) updates.customer_name = fields.customer_name;
      if (fields.customer_phone !== undefined) updates.customer_phone = fields.customer_phone;
      if (fields.customer_whatsapp !== undefined) updates.customer_whatsapp = fields.customer_whatsapp;
      if (fields.vendor_id !== undefined) updates.vendor_id = fields.vendor_id;
      if (fields.vendor_name !== undefined) updates.vendor_name = fields.vendor_name;
      if (fields.vendor_phone !== undefined) updates.vendor_phone = fields.vendor_phone;
      if (fields.vendor_email !== undefined) updates.vendor_email = fields.vendor_email;
      if (fields.items !== undefined) updates.items = fields.items as any;
      if (fields.subtotal !== undefined) updates.subtotal = fields.subtotal;
      if (fields.tax !== undefined) updates.tax = fields.tax;
      if (fields.total !== undefined) updates.total = fields.total;
      if (fields.status !== undefined) updates.status = fields.status as any;
      if (fields.valid_until !== undefined) updates.valid_until = fields.valid_until;

      const { error } = await supabase.from('quotations').update(updates as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quotations'] });
      toast({ title: 'Cotización actualizada' });
    },
    onError: (e: any) => toast({ title: 'Error al actualizar cotización', description: e.message, variant: 'destructive' }),
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
