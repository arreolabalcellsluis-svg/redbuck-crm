import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface CommercialDocument {
  id: string;
  order_id: string;
  doc_type: string;
  folio: string;
  subtotal: number;
  tax: number;
  total: number;
  items: any[];
  customer_name: string;
  customer_contact: string;
  notes: string;
  conditions: string;
  legal_text: string;
  vendor_name: string;
  vendor_phone: string;
  user_id: string | null;
  created_at: string;
  updated_at: string;
}

const DOC_PREFIXES: Record<string, string> = {
  factura: 'FAC',
  recibo_honorarios: 'RH',
  nota_credito: 'NC',
  nota_devolucion: 'ND',
  nota_venta: 'NV',
};

function mapRow(row: any): CommercialDocument {
  return {
    id: row.id,
    order_id: row.order_id,
    doc_type: row.doc_type,
    folio: row.folio,
    subtotal: Number(row.subtotal),
    tax: Number(row.tax),
    total: Number(row.total),
    items: Array.isArray(row.items) ? row.items : [],
    customer_name: row.customer_name || '',
    customer_contact: row.customer_contact || '',
    notes: row.notes || '',
    conditions: row.conditions || '',
    legal_text: row.legal_text || '',
    vendor_name: row.vendor_name || '',
    vendor_phone: row.vendor_phone || '',
    user_id: row.user_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function useCommercialDocuments(orderId?: string) {
  return useQuery({
    queryKey: ['commercial_documents', orderId],
    queryFn: async () => {
      let query = supabase.from('commercial_documents' as any).select('*').order('created_at', { ascending: false });
      if (orderId) query = query.eq('order_id', orderId);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).map(mapRow);
    },
  });
}

export function useAllCommercialDocuments() {
  return useQuery({
    queryKey: ['commercial_documents_all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('commercial_documents' as any)
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(mapRow);
    },
  });
}

export function useAddCommercialDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (doc: Omit<CommercialDocument, 'id' | 'created_at' | 'updated_at' | 'folio'> & { folio?: string }) => {
      // Generate next folio
      const prefix = DOC_PREFIXES[doc.doc_type] || 'DOC';
      const { data: existing } = await supabase
        .from('commercial_documents' as any)
        .select('folio')
        .eq('doc_type', doc.doc_type)
        .order('created_at', { ascending: false })
        .limit(1);

      let nextNum = 1;
      if (existing && existing.length > 0) {
        const lastFolio = (existing[0] as any).folio as string;
        const match = lastFolio.match(/(\d+)$/);
        if (match) nextNum = parseInt(match[1], 10) + 1;
      }
      const folio = `${prefix}-${String(nextNum).padStart(3, '0')}`;

      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase.from('commercial_documents' as any).insert({
        order_id: doc.order_id,
        doc_type: doc.doc_type,
        folio,
        subtotal: doc.subtotal,
        tax: doc.tax,
        total: doc.total,
        items: doc.items as any,
        customer_name: doc.customer_name,
        customer_contact: doc.customer_contact,
        notes: doc.notes,
        conditions: doc.conditions,
        legal_text: doc.legal_text,
        vendor_name: doc.vendor_name,
        vendor_phone: doc.vendor_phone || '',
        user_id: user?.id ?? null,
      }).select('*').single();
      if (error) throw error;
      return mapRow(data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['commercial_documents'] });
      qc.invalidateQueries({ queryKey: ['commercial_documents_all'] });
      toast({ title: 'Documento generado correctamente' });
    },
    onError: (e: any) => toast({ title: 'Error al generar documento', description: e.message, variant: 'destructive' }),
  });
}

export const DOC_TYPE_LABELS: Record<string, string> = {
  factura: 'Factura',
  recibo_honorarios: 'Recibo de honorarios',
  nota_credito: 'Nota de crédito',
  nota_devolucion: 'Nota de devolución',
  nota_venta: 'Nota de venta',
};

export const DOC_TYPES = Object.entries(DOC_TYPE_LABELS).map(([value, label]) => ({ value, label }));
