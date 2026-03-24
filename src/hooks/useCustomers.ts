import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface DBCustomer {
  id: string;
  name: string;
  contact_name: string | null;
  trade_name: string | null;
  rfc: string | null;
  type: string;
  phone: string;
  whatsapp: string | null;
  email: string | null;
  city: string;
  state: string;
  vendor_id: string | null;
  source: string;
  priority: 'alta' | 'media' | 'baja';
  created_at: string;
  updated_at: string;
}

function mapRow(row: any): DBCustomer {
  return {
    id: row.id,
    name: row.name,
    contact_name: row.contact_name,
    trade_name: row.trade_name,
    rfc: row.rfc,
    type: row.type,
    phone: row.phone,
    whatsapp: row.whatsapp,
    email: row.email,
    city: row.city,
    state: row.state,
    vendor_id: row.vendor_id,
    source: row.source,
    priority: row.priority,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function useCustomers() {
  return useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('name');
      if (error) throw error;
      return (data ?? []).map(mapRow);
    },
  });
}

export function useAddCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (customer: Omit<DBCustomer, 'id' | 'created_at' | 'updated_at'>) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase.from('customers').insert({
        name: customer.name,
        contact_name: customer.contact_name,
        trade_name: customer.trade_name,
        rfc: customer.rfc,
        type: customer.type as any,
        phone: customer.phone,
        whatsapp: customer.whatsapp,
        email: customer.email,
        city: customer.city,
        state: customer.state,
        vendor_id: customer.vendor_id,
        source: customer.source as any,
        priority: customer.priority as any,
        user_id: user?.id ?? null,
      }).select('id').single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] });
      toast({ title: 'Cliente registrado' });
    },
    onError: (e: any) => toast({ title: 'Error al guardar cliente', description: e.message, variant: 'destructive' }),
  });
}

export function useUpdateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...customer }: Partial<DBCustomer> & { id: string }) => {
      const updates: Record<string, any> = { updated_at: new Date().toISOString() };
      Object.entries(customer).forEach(([k, v]) => {
        if (v !== undefined) updates[k] = v;
      });
      const { error } = await supabase.from('customers').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] });
      toast({ title: 'Cliente actualizado' });
    },
    onError: (e: any) => toast({ title: 'Error al actualizar', description: e.message, variant: 'destructive' }),
  });
}

export function useDeleteCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('customers').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] });
      toast({ title: 'Cliente eliminado' });
    },
    onError: (e: any) => toast({ title: 'Error al eliminar', description: e.message, variant: 'destructive' }),
  });
}
