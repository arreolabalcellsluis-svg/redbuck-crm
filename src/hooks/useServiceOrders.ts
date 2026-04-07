import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { ServiceOrder, ServiceType, ServiceStatus } from '@/types';

export interface ExtendedServiceOrder extends ServiceOrder {
  images?: string[];
  diagnosis?: string;
  actionsPerformed?: string;
  completedDate?: string;
  observations?: string;
}

function dbToService(row: any): ExtendedServiceOrder {
  return {
    id: row.id,
    folio: row.folio,
    customerId: row.customer_id,
    customerName: row.customer_name,
    productName: row.product_name,
    technicianName: row.technician_name,
    type: row.type as ServiceType,
    scheduledDate: row.scheduled_date,
    status: row.status as ServiceStatus,
    description: row.description,
    images: Array.isArray(row.photos) ? row.photos : [],
    diagnosis: row.diagnosis || '',
    actionsPerformed: row.work_performed || '',
    completedDate: row.completed_date || '',
    observations: row.report_notes || '',
  };
}

export function useServiceOrders() {
  return useQuery({
    queryKey: ['service_orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('service_orders')
        .select('*')
        .order('scheduled_date', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(dbToService);
    },
  });
}

export function useAddServiceOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (so: Omit<ExtendedServiceOrder, 'id'>) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('service_orders').insert({
        folio: so.folio,
        customer_id: so.customerId,
        customer_name: so.customerName,
        product_name: so.productName,
        technician_name: so.technicianName,
        type: so.type,
        scheduled_date: so.scheduledDate,
        status: so.status,
        description: so.description,
        photos: (so.images || []) as any,
        diagnosis: so.diagnosis || null,
        work_performed: so.actionsPerformed || null,
        completed_date: so.completedDate || null,
        report_notes: so.observations || null,
        user_id: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['service_orders'] });
      toast.success('Orden de servicio creada');
    },
    onError: (e: any) => toast.error('Error: ' + e.message),
  });
}

export function useUpdateServiceOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...so }: Partial<ExtendedServiceOrder> & { id: string }) => {
      const updates: Record<string, any> = { updated_at: new Date().toISOString() };
      if (so.folio !== undefined) updates.folio = so.folio;
      if (so.customerId !== undefined) updates.customer_id = so.customerId;
      if (so.customerName !== undefined) updates.customer_name = so.customerName;
      if (so.productName !== undefined) updates.product_name = so.productName;
      if (so.technicianName !== undefined) updates.technician_name = so.technicianName;
      if (so.type !== undefined) updates.type = so.type;
      if (so.scheduledDate !== undefined) updates.scheduled_date = so.scheduledDate;
      if (so.status !== undefined) updates.status = so.status;
      if (so.description !== undefined) updates.description = so.description;
      if (so.images !== undefined) updates.photos = so.images;
      if (so.diagnosis !== undefined) updates.diagnosis = so.diagnosis || null;
      if (so.actionsPerformed !== undefined) updates.work_performed = so.actionsPerformed || null;
      if (so.completedDate !== undefined) updates.completed_date = so.completedDate || null;
      if (so.observations !== undefined) updates.report_notes = so.observations || null;
      const { error } = await supabase.from('service_orders').update(updates as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['service_orders'] });
      toast.success('Orden actualizada');
    },
    onError: (e: any) => toast.error('Error: ' + e.message),
  });
}
