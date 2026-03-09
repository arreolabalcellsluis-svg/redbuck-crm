import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { User, UserRole } from '@/types';

function dbToUser(row: any): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone || '',
    whatsapp: row.whatsapp || '',
    role: row.role as UserRole,
    active: row.active,
    seriesPrefix: row.series_prefix || undefined,
    seriesStart: row.series_start ?? undefined,
    seriesCurrent: row.series_current ?? undefined,
    commissionRate: row.commission_rate != null ? Number(row.commission_rate) : undefined,
    address: row.address || '',
    emergencyContactName: row.emergency_contact_name || '',
    emergencyContactPhone: row.emergency_contact_phone || '',
    photoUrl: row.photo_url || '',
    contractUrl: row.contract_url || '',
  };
}

export function useTeamMembers() {
  return useQuery({
    queryKey: ['team_members'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_members')
        .select('*')
        .order('name', { ascending: true });
      if (error) throw error;
      return (data ?? []).map(dbToUser);
    },
  });
}

export function useAddTeamMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (u: Omit<User, 'id'>) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('team_members').insert({
        name: u.name,
        email: u.email,
        phone: u.phone || '',
        whatsapp: u.whatsapp || '',
        role: u.role,
        active: u.active,
        series_prefix: u.seriesPrefix || null,
        series_start: u.seriesStart ?? null,
        series_current: u.seriesCurrent ?? null,
        commission_rate: u.commissionRate ?? null,
        address: u.address || '',
        emergency_contact_name: u.emergencyContactName || '',
        emergency_contact_phone: u.emergencyContactPhone || '',
        photo_url: u.photoUrl || '',
        contract_url: u.contractUrl || '',
        user_id: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['team_members'] });
      toast.success('Usuario creado');
    },
    onError: (e: any) => toast.error('Error: ' + e.message),
  });
}

export function useUpdateTeamMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...u }: Partial<User> & { id: string }) => {
      const updates: Record<string, any> = { updated_at: new Date().toISOString() };
      if (u.name !== undefined) updates.name = u.name;
      if (u.email !== undefined) updates.email = u.email;
      if (u.phone !== undefined) updates.phone = u.phone;
      if (u.whatsapp !== undefined) updates.whatsapp = u.whatsapp;
      if (u.role !== undefined) updates.role = u.role;
      if (u.active !== undefined) updates.active = u.active;
      if (u.seriesPrefix !== undefined) updates.series_prefix = u.seriesPrefix || null;
      if (u.seriesStart !== undefined) updates.series_start = u.seriesStart;
      if (u.seriesCurrent !== undefined) updates.series_current = u.seriesCurrent;
      if (u.commissionRate !== undefined) updates.commission_rate = u.commissionRate;
      if (u.address !== undefined) updates.address = u.address;
      if (u.emergencyContactName !== undefined) updates.emergency_contact_name = u.emergencyContactName;
      if (u.emergencyContactPhone !== undefined) updates.emergency_contact_phone = u.emergencyContactPhone;
      if (u.photoUrl !== undefined) updates.photo_url = u.photoUrl;
      if (u.contractUrl !== undefined) updates.contract_url = u.contractUrl;
      const { error } = await supabase.from('team_members').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['team_members'] });
      toast.success('Usuario actualizado');
    },
    onError: (e: any) => toast.error('Error: ' + e.message),
  });
}
