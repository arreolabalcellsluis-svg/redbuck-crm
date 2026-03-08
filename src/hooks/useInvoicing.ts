import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// ─── Fiscal Settings (singleton) ───
export interface FiscalSettings {
  id: string;
  issuer_rfc: string;
  issuer_name: string;
  issuer_trade_name: string;
  issuer_tax_regime: string;
  expedition_zip_code: string;
  default_series: string;
  pac_provider: string;
  pac_api_url: string;
  pac_username: string;
  pac_token_encrypted: string;
  csd_cer_path: string;
  csd_key_path: string;
  csd_password_encrypted: string;
  csd_status: string;
  csd_expiration_date: string | null;
  created_at: string;
  updated_at: string;
}

export function useFiscalSettings() {
  return useQuery({
    queryKey: ['fiscal_settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fiscal_settings')
        .select('*')
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as FiscalSettings | null;
    },
  });
}

export function useSaveFiscalSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (settings: Partial<FiscalSettings> & { id?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const payload = { ...settings, user_id: user?.id, updated_at: new Date().toISOString() };
      
      if (settings.id) {
        const { error } = await supabase.from('fiscal_settings').update(payload as any).eq('id', settings.id);
        if (error) throw error;
      } else {
        delete payload.id;
        const { error } = await supabase.from('fiscal_settings').insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fiscal_settings'] });
      toast.success('Configuración fiscal guardada');
    },
    onError: (e: any) => toast.error('Error al guardar: ' + e.message),
  });
}

// ─── Customer Fiscal Data ───
export interface CustomerFiscalData {
  id: string;
  customer_id: string;
  rfc: string;
  legal_name: string;
  fiscal_zip_code: string;
  tax_regime: string;
  cfdi_use_default: string;
  invoice_email: string;
  created_at: string;
  updated_at: string;
}

export function useCustomerFiscalData(customerId?: string) {
  return useQuery({
    queryKey: ['customer_fiscal_data', customerId],
    enabled: !!customerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_fiscal_data')
        .select('*')
        .eq('customer_id', customerId!)
        .maybeSingle();
      if (error) throw error;
      return data as CustomerFiscalData | null;
    },
  });
}

export function useAllCustomerFiscalData() {
  return useQuery({
    queryKey: ['customer_fiscal_data'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_fiscal_data')
        .select('*');
      if (error) throw error;
      return (data ?? []) as CustomerFiscalData[];
    },
  });
}

export function useSaveCustomerFiscalData() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (d: Partial<CustomerFiscalData> & { customer_id: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const payload = { ...d, user_id: user?.id, updated_at: new Date().toISOString() };

      // Upsert by customer_id
      const { data: existing } = await supabase
        .from('customer_fiscal_data')
        .select('id')
        .eq('customer_id', d.customer_id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase.from('customer_fiscal_data').update(payload as any).eq('id', existing.id);
        if (error) throw error;
      } else {
        delete (payload as any).id;
        const { error } = await supabase.from('customer_fiscal_data').insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customer_fiscal_data'] });
      toast.success('Datos fiscales del cliente guardados');
    },
    onError: (e: any) => toast.error('Error: ' + e.message),
  });
}

// ─── Product Fiscal Data ───
export interface ProductFiscalData {
  id: string;
  product_id: string;
  sat_product_key: string;
  sat_unit_key: string;
  commercial_unit: string;
  tax_object: string;
  vat_rate: number;
  fiscal_description: string;
  created_at: string;
  updated_at: string;
}

export function useProductFiscalData(productId?: string) {
  return useQuery({
    queryKey: ['product_fiscal_data', productId],
    enabled: !!productId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_fiscal_data')
        .select('*')
        .eq('product_id', productId!)
        .maybeSingle();
      if (error) throw error;
      return data as ProductFiscalData | null;
    },
  });
}

export function useAllProductFiscalData() {
  return useQuery({
    queryKey: ['product_fiscal_data'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_fiscal_data')
        .select('*');
      if (error) throw error;
      return (data ?? []) as ProductFiscalData[];
    },
  });
}

export function useSaveProductFiscalData() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (d: Partial<ProductFiscalData> & { product_id: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const payload = { ...d, user_id: user?.id, updated_at: new Date().toISOString() };

      const { data: existing } = await supabase
        .from('product_fiscal_data')
        .select('id')
        .eq('product_id', d.product_id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase.from('product_fiscal_data').update(payload as any).eq('id', existing.id);
        if (error) throw error;
      } else {
        delete (payload as any).id;
        const { error } = await supabase.from('product_fiscal_data').insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['product_fiscal_data'] });
      toast.success('Datos fiscales del producto guardados');
    },
    onError: (e: any) => toast.error('Error: ' + e.message),
  });
}

// ─── Invoices ───
export interface Invoice {
  id: string;
  customer_id: string | null;
  order_id: string | null;
  sales_person_id: string;
  series: string;
  folio: string;
  uuid: string;
  invoice_type: string;
  payment_form: string;
  payment_method: string;
  currency: string;
  exchange_rate: number;
  subtotal: number;
  tax_amount: number;
  total: number;
  status: string;
  pac_provider: string;
  pac_response: any;
  xml_path: string;
  pdf_path: string;
  conditions: string;
  notes: string;
  export_code: string;
  issued_at: string | null;
  canceled_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export function useInvoices() {
  return useQuery({
    queryKey: ['invoices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Invoice[];
    },
  });
}

// ─── SAT Catalogs ───
export const SAT_TAX_REGIMES = [
  { code: '601', label: '601 - General de Ley Personas Morales' },
  { code: '603', label: '603 - Personas Morales con Fines no Lucrativos' },
  { code: '605', label: '605 - Sueldos y Salarios' },
  { code: '606', label: '606 - Arrendamiento' },
  { code: '608', label: '608 - Demás ingresos' },
  { code: '610', label: '610 - Residentes en el Extranjero' },
  { code: '611', label: '611 - Ingresos por Dividendos' },
  { code: '612', label: '612 - Personas Físicas con Actividades Empresariales y Profesionales' },
  { code: '614', label: '614 - Ingresos por intereses' },
  { code: '616', label: '616 - Sin obligaciones fiscales' },
  { code: '620', label: '620 - Sociedades Cooperativas de Producción' },
  { code: '621', label: '621 - Incorporación Fiscal' },
  { code: '622', label: '622 - Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras' },
  { code: '623', label: '623 - Opcional para Grupos de Sociedades' },
  { code: '624', label: '624 - Coordinados' },
  { code: '625', label: '625 - Régimen de las Actividades Empresariales con ingresos a través de Plataformas Tecnológicas' },
  { code: '626', label: '626 - Régimen Simplificado de Confianza' },
];

export const SAT_CFDI_USES = [
  { code: 'G01', label: 'G01 - Adquisición de mercancías' },
  { code: 'G02', label: 'G02 - Devoluciones, descuentos o bonificaciones' },
  { code: 'G03', label: 'G03 - Gastos en general' },
  { code: 'I01', label: 'I01 - Construcciones' },
  { code: 'I02', label: 'I02 - Mobilario y equipo de oficina' },
  { code: 'I03', label: 'I03 - Equipo de transporte' },
  { code: 'I04', label: 'I04 - Equipo de cómputo y accesorios' },
  { code: 'I08', label: 'I08 - Otra maquinaria y equipo' },
  { code: 'P01', label: 'P01 - Por definir' },
  { code: 'S01', label: 'S01 - Sin efectos fiscales' },
  { code: 'CP01', label: 'CP01 - Pagos' },
];

export const SAT_PAYMENT_FORMS = [
  { code: '01', label: '01 - Efectivo' },
  { code: '02', label: '02 - Cheque nominativo' },
  { code: '03', label: '03 - Transferencia electrónica de fondos' },
  { code: '04', label: '04 - Tarjeta de crédito' },
  { code: '06', label: '06 - Dinero electrónico' },
  { code: '28', label: '28 - Tarjeta de débito' },
  { code: '29', label: '29 - Tarjeta de servicios' },
  { code: '99', label: '99 - Por definir' },
];

export const SAT_PAYMENT_METHODS = [
  { code: 'PUE', label: 'PUE - Pago en una sola exhibición' },
  { code: 'PPD', label: 'PPD - Pago en parcialidades o diferido' },
];

export const TAX_OBJECTS = [
  { code: '01', label: '01 - No objeto de impuesto' },
  { code: '02', label: '02 - Sí objeto de impuesto' },
  { code: '03', label: '03 - Sí objeto del impuesto y no obligado al desglose' },
  { code: '04', label: '04 - Sí objeto del impuesto y no causa impuesto' },
];

export const CANCELLATION_REASONS = [
  { code: '01', label: '01 - Comprobante emitido con errores con relación' },
  { code: '02', label: '02 - Comprobante emitido con errores sin relación' },
  { code: '03', label: '03 - No se llevó a cabo la operación' },
  { code: '04', label: '04 - Operación nominativa relacionada en una factura global' },
];
