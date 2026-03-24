import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface DBOrder {
  id: string;
  folio: string;
  customer_id: string | null;
  customer_name: string;
  vendor_name: string;
  items: any[];
  total: number;
  advance: number;
  balance: number;
  status: string;
  order_type: string;
  warehouse: string;
  promise_date: string | null;
  quotation_folio: string | null;
  scheduled_delivery_date: string | null;
  delivery_notes: string | null;
  reserve_deadline: string | null;
  transportista: string;
  guia_numero: string;
  fecha_envio: string | null;
  shipping_images: string[];
  invoice_number_manual: string;
  invoice_date_manual: string | null;
  invoice_pdf_url: string;
  edit_history: any[];
  created_at: string;
  updated_at: string;
}

function mapRow(row: any): DBOrder {
  return {
    id: row.id,
    folio: row.folio,
    customer_id: row.customer_id,
    customer_name: row.customer_name,
    vendor_name: row.vendor_name,
    items: Array.isArray(row.items) ? row.items : [],
    total: Number(row.total),
    advance: Number(row.advance),
    balance: Number(row.balance),
    status: row.status,
    order_type: row.order_type,
    warehouse: row.warehouse,
    promise_date: row.promise_date,
    quotation_folio: row.quotation_folio,
    scheduled_delivery_date: row.scheduled_delivery_date,
    delivery_notes: row.delivery_notes,
    reserve_deadline: row.reserve_deadline,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function useOrders() {
  return useQuery({
    queryKey: ['orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(mapRow);
    },
  });
}

export function useAddOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (order: Omit<DBOrder, 'id' | 'created_at' | 'updated_at'>) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('orders').insert({
        folio: order.folio,
        customer_id: order.customer_id,
        customer_name: order.customer_name,
        vendor_name: order.vendor_name,
        items: order.items as any,
        total: order.total,
        advance: order.advance,
        balance: order.balance,
        status: order.status as any,
        order_type: order.order_type as any,
        warehouse: order.warehouse,
        promise_date: order.promise_date,
        quotation_folio: order.quotation_folio,
        scheduled_delivery_date: order.scheduled_delivery_date,
        delivery_notes: order.delivery_notes,
        reserve_deadline: order.reserve_deadline,
        user_id: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      toast({ title: 'Pedido registrado' });
    },
    onError: (e: any) => toast({ title: 'Error al guardar pedido', description: e.message, variant: 'destructive' }),
  });
}

export function useUpdateOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from('orders').update({
        status: status as any,
        updated_at: new Date().toISOString(),
      }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      toast({ title: 'Estatus de pedido actualizado' });
    },
    onError: (e: any) => toast({ title: 'Error al actualizar', description: e.message, variant: 'destructive' }),
  });
}

export function useUpdateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...fields }: Partial<DBOrder> & { id: string }) => {
      const updates: Record<string, any> = { updated_at: new Date().toISOString() };
      Object.entries(fields).forEach(([k, v]) => {
        if (v !== undefined) updates[k] = v;
      });
      const { error } = await supabase.from('orders').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      toast({ title: 'Pedido actualizado' });
    },
    onError: (e: any) => toast({ title: 'Error al actualizar', description: e.message, variant: 'destructive' }),
  });
}

export function useDeleteOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('orders').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      toast({ title: 'Pedido eliminado' });
    },
    onError: (e: any) => toast({ title: 'Error al eliminar', description: e.message, variant: 'destructive' }),
  });
}
