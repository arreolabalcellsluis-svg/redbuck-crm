import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { ImportOrder, ImportStatus, ImportExpenses } from '@/types';

const DEFAULT_EXPENSES: ImportExpenses = {
  fleteLocalChina: 0, fleteInternacionalMaritimo: 0, igi: 0, dta: 0, prevalidacion: 0,
  gastosLocalesNaviera: 0, maniobrasPuerto: 0, seguro: 0, honorariosDespachoAduanal: 0,
  comercializadora: 0, fleteTerrestreGdl: 0,
};

function dbToImport(row: any): ImportOrder {
  return {
    id: row.id,
    orderNumber: row.order_number,
    supplier: row.supplier,
    country: row.country,
    departurePort: row.departure_port,
    arrivalPort: row.arrival_port,
    currency: row.currency,
    exchangeRate: Number(row.exchange_rate),
    purchaseDate: row.purchase_date,
    estimatedDeparture: row.estimated_departure || '',
    estimatedArrival: row.estimated_arrival || '',
    status: row.status as ImportStatus,
    items: Array.isArray(row.items) ? row.items : [],
    totalCost: Number(row.total_cost),
    freightCost: Number(row.freight_cost),
    customsCost: Number(row.customs_cost),
    totalLanded: Number(row.total_landed),
    daysInTransit: Number(row.days_in_transit),
    expenses: {
      fleteLocalChina: Number(row.flete_local_china ?? 0),
      fleteInternacionalMaritimo: Number(row.flete_internacional_maritimo ?? 0),
      igi: Number(row.igi ?? 0),
      dta: Number(row.dta ?? 0),
      prevalidacion: Number(row.prevalidacion ?? 0),
      gastosLocalesNaviera: Number(row.gastos_locales_naviera ?? 0),
      maniobrasPuerto: Number(row.maniobras_puerto ?? 0),
      seguro: Number(row.seguro ?? 0),
      honorariosDespachoAduanal: Number(row.honorarios_despacho_aduanal ?? 0),
      comercializadora: Number(row.comercializadora ?? 0),
      fleteTerrestreGdl: Number(row.flete_terrestre_gdl ?? 0),
    },
    pesoTotalKg: Number(row.peso_total_kg ?? 0),
    volumenTotalCbm: Number(row.volumen_total_cbm ?? 0),
    numeroContenedores: Number(row.numero_contenedores ?? 1),
  };
}

function expensesToDb(exp: ImportExpenses) {
  return {
    flete_local_china: exp.fleteLocalChina,
    flete_internacional_maritimo: exp.fleteInternacionalMaritimo,
    igi: exp.igi,
    dta: exp.dta,
    prevalidacion: exp.prevalidacion,
    gastos_locales_naviera: exp.gastosLocalesNaviera,
    maniobras_puerto: exp.maniobrasPuerto,
    seguro: exp.seguro,
    honorarios_despacho_aduanal: exp.honorariosDespachoAduanal,
    comercializadora: exp.comercializadora,
    flete_terrestre_gdl: exp.fleteTerrestreGdl,
  };
}

export function useImportOrders() {
  return useQuery({
    queryKey: ['import_orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('import_orders')
        .select('*')
        .order('purchase_date', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(dbToImport);
    },
  });
}

export function useAddImportOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (imp: Omit<ImportOrder, 'id'>) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('import_orders').insert({
        order_number: imp.orderNumber,
        supplier: imp.supplier,
        country: imp.country,
        departure_port: imp.departurePort,
        arrival_port: imp.arrivalPort,
        currency: imp.currency,
        exchange_rate: imp.exchangeRate,
        purchase_date: imp.purchaseDate,
        estimated_departure: imp.estimatedDeparture || null,
        estimated_arrival: imp.estimatedArrival || null,
        status: imp.status,
        items: imp.items as any,
        total_cost: imp.totalCost,
        freight_cost: imp.freightCost,
        customs_cost: imp.customsCost,
        total_landed: imp.totalLanded,
        days_in_transit: imp.daysInTransit,
        user_id: user?.id ?? null,
        peso_total_kg: imp.pesoTotalKg,
        volumen_total_cbm: imp.volumenTotalCbm,
        numero_contenedores: imp.numeroContenedores,
        ...expensesToDb(imp.expenses),
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['import_orders'] });
      toast.success('Importación creada');
    },
    onError: (e: any) => toast.error('Error: ' + e.message),
  });
}

export function useUpdateImportOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...imp }: Partial<ImportOrder> & { id: string }) => {
      const updates: Record<string, any> = { updated_at: new Date().toISOString() };
      if (imp.orderNumber !== undefined) updates.order_number = imp.orderNumber;
      if (imp.supplier !== undefined) updates.supplier = imp.supplier;
      if (imp.country !== undefined) updates.country = imp.country;
      if (imp.departurePort !== undefined) updates.departure_port = imp.departurePort;
      if (imp.arrivalPort !== undefined) updates.arrival_port = imp.arrivalPort;
      if (imp.currency !== undefined) updates.currency = imp.currency;
      if (imp.exchangeRate !== undefined) updates.exchange_rate = imp.exchangeRate;
      if (imp.purchaseDate !== undefined) updates.purchase_date = imp.purchaseDate;
      if (imp.estimatedDeparture !== undefined) updates.estimated_departure = imp.estimatedDeparture || null;
      if (imp.estimatedArrival !== undefined) updates.estimated_arrival = imp.estimatedArrival || null;
      if (imp.status !== undefined) updates.status = imp.status;
      if (imp.items !== undefined) updates.items = imp.items;
      if (imp.totalCost !== undefined) updates.total_cost = imp.totalCost;
      if (imp.freightCost !== undefined) updates.freight_cost = imp.freightCost;
      if (imp.customsCost !== undefined) updates.customs_cost = imp.customsCost;
      if (imp.totalLanded !== undefined) updates.total_landed = imp.totalLanded;
      if (imp.daysInTransit !== undefined) updates.days_in_transit = imp.daysInTransit;
      if (imp.pesoTotalKg !== undefined) updates.peso_total_kg = imp.pesoTotalKg;
      if (imp.volumenTotalCbm !== undefined) updates.volumen_total_cbm = imp.volumenTotalCbm;
      if (imp.numeroContenedores !== undefined) updates.numero_contenedores = imp.numeroContenedores;
      if (imp.expenses !== undefined) Object.assign(updates, expensesToDb(imp.expenses));
      const { error } = await supabase.from('import_orders').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['import_orders'] });
      toast.success('Importación actualizada');
    },
    onError: (e: any) => toast.error('Error: ' + e.message),
  });
}

export function useDeleteImportOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('import_orders').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['import_orders'] });
      toast.success('Importación eliminada');
    },
    onError: (e: any) => toast.error('Error: ' + e.message),
  });
}
