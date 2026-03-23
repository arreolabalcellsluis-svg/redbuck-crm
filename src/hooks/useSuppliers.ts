import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Supplier } from '@/types';

function dbToSupplier(row: any): Supplier {
  return {
    id: row.id,
    name: row.name,
    country: row.country,
    contact: row.contact,
    phone: row.phone,
    email: row.email,
    currency: row.currency as Supplier['currency'],
    type: row.type as Supplier['type'],
    website: row.website ?? '',
    bancoDestino: row.banco_destino ?? '',
    cuentaDestino: row.cuenta_destino ?? '',
    clabeDestino: row.clabe_destino ?? '',
    divisaBanco: row.divisa_banco ?? 'USD',
  };
}

export function useSuppliers() {
  return useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .order('name', { ascending: true });
      if (error) throw error;
      return (data ?? []).map(dbToSupplier);
    },
  });
}

export function useAddSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (s: Omit<Supplier, 'id'>) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from('suppliers').insert({
        name: s.name,
        country: s.country,
        contact: s.contact,
        phone: s.phone,
        email: s.email,
        currency: s.currency,
        type: s.type,
        website: s.website ?? '',
        banco_destino: s.bancoDestino ?? '',
        cuenta_destino: s.cuentaDestino ?? '',
        clabe_destino: s.clabeDestino ?? '',
        divisa_banco: s.divisaBanco ?? 'USD',
        user_id: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['suppliers'] });
      toast.success('Proveedor creado');
    },
    onError: (e: any) => toast.error('Error: ' + e.message),
  });
}

export function useUpdateSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...s }: Partial<Supplier> & { id: string }) => {
      const updates: Record<string, any> = { updated_at: new Date().toISOString() };
      if (s.name !== undefined) updates.name = s.name;
      if (s.country !== undefined) updates.country = s.country;
      if (s.contact !== undefined) updates.contact = s.contact;
      if (s.phone !== undefined) updates.phone = s.phone;
      if (s.email !== undefined) updates.email = s.email;
      if (s.currency !== undefined) updates.currency = s.currency;
      if (s.type !== undefined) updates.type = s.type;
      const { error } = await supabase.from('suppliers').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['suppliers'] });
      toast.success('Proveedor actualizado');
    },
    onError: (e: any) => toast.error('Error: ' + e.message),
  });
}
