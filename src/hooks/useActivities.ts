import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Activity, ActivityType, ActivityStatus } from '@/lib/agendaEngine';

export interface DBActivity {
  id: string;
  title: string;
  type: string;
  date: string;
  time: string | null;
  customer_id: string | null;
  customer_name: string | null;
  lead_id: string | null;
  lead_name: string | null;
  quotation_id: string | null;
  quotation_folio: string | null;
  product_id: string | null;
  product_name: string | null;
  priority: string;
  notes: string;
  responsible_id: string;
  responsible_name: string;
  status: string;
  user_id: string | null;
  created_at: string;
  updated_at: string;
}

export function dbToActivity(row: DBActivity): Activity {
  return {
    id: row.id,
    title: row.title,
    type: row.type as ActivityType,
    date: row.date,
    time: row.time ?? undefined,
    customerId: row.customer_id ?? undefined,
    customerName: row.customer_name ?? undefined,
    leadId: row.lead_id ?? undefined,
    leadName: row.lead_name ?? undefined,
    quotationId: row.quotation_id ?? undefined,
    quotationFolio: row.quotation_folio ?? undefined,
    productId: row.product_id ?? undefined,
    productName: row.product_name ?? undefined,
    priority: row.priority as Activity['priority'],
    notes: row.notes,
    responsibleId: row.responsible_id,
    responsibleName: row.responsible_name,
    status: row.status as ActivityStatus,
  };
}

export function useActivities() {
  return useQuery({
    queryKey: ['activities'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .order('date', { ascending: true });
      if (error) throw error;
      return (data ?? []).map((r: any) => dbToActivity(r));
    },
  });
}

export function useAddActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (act: Omit<Activity, 'id'>) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('activities').insert({
        title: act.title,
        type: act.type,
        date: act.date,
        time: act.time || null,
        customer_id: act.customerId || null,
        customer_name: act.customerName || null,
        lead_id: act.leadId || null,
        lead_name: act.leadName || null,
        quotation_id: act.quotationId || null,
        quotation_folio: act.quotationFolio || null,
        product_id: act.productId || null,
        product_name: act.productName || null,
        priority: act.priority,
        notes: act.notes,
        responsible_id: act.responsibleId,
        responsible_name: act.responsibleName,
        status: act.status,
        user_id: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['activities'] });
      toast.success('Actividad creada');
    },
    onError: (e: any) => toast.error('Error: ' + e.message),
  });
}

export function useUpdateActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...act }: Partial<Activity> & { id: string }) => {
      const updates: Record<string, any> = { updated_at: new Date().toISOString() };
      if (act.title !== undefined) updates.title = act.title;
      if (act.type !== undefined) updates.type = act.type;
      if (act.date !== undefined) updates.date = act.date;
      if (act.time !== undefined) updates.time = act.time || null;
      if (act.customerId !== undefined) updates.customer_id = act.customerId || null;
      if (act.customerName !== undefined) updates.customer_name = act.customerName || null;
      if (act.leadId !== undefined) updates.lead_id = act.leadId || null;
      if (act.leadName !== undefined) updates.lead_name = act.leadName || null;
      if (act.quotationId !== undefined) updates.quotation_id = act.quotationId || null;
      if (act.quotationFolio !== undefined) updates.quotation_folio = act.quotationFolio || null;
      if (act.productId !== undefined) updates.product_id = act.productId || null;
      if (act.productName !== undefined) updates.product_name = act.productName || null;
      if (act.priority !== undefined) updates.priority = act.priority;
      if (act.notes !== undefined) updates.notes = act.notes;
      if (act.responsibleId !== undefined) updates.responsible_id = act.responsibleId;
      if (act.responsibleName !== undefined) updates.responsible_name = act.responsibleName;
      if (act.status !== undefined) updates.status = act.status;
      const { error } = await supabase.from('activities').update(updates as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['activities'] });
    },
    onError: (e: any) => toast.error('Error: ' + e.message),
  });
}

export function useDeleteActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('activities').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['activities'] });
      toast.success('Actividad eliminada');
    },
    onError: (e: any) => toast.error('Error: ' + e.message),
  });
}
