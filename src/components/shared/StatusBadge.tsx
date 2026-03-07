import { QuotationStatus, OrderStatus, ServiceStatus, ImportStatus, PipelineStage, IMPORT_STATUS_LABELS, PIPELINE_LABELS } from '@/types';

interface Props {
  status: string;
  type?: 'quotation' | 'order' | 'service' | 'import' | 'pipeline' | 'receivable' | 'priority';
}

const statusConfig: Record<string, { label: string; className: string }> = {
  // Quotations
  borrador: { label: 'Borrador', className: 'status-badge-neutral' },
  enviada: { label: 'Enviada', className: 'status-badge-info' },
  vista: { label: 'Vista', className: 'status-badge-info' },
  seguimiento: { label: 'Seguimiento', className: 'status-badge-warning' },
  aceptada: { label: 'Aceptada', className: 'status-badge-success' },
  rechazada: { label: 'Rechazada', className: 'status-badge-danger' },
  vencida: { label: 'Vencida', className: 'status-badge-danger' },
  // Orders
  nuevo: { label: 'Nuevo', className: 'status-badge-info' },
  por_confirmar: { label: 'Por confirmar', className: 'status-badge-warning' },
  confirmado: { label: 'Confirmado', className: 'status-badge-success' },
  confirmado_anticipo: { label: 'Confirmado c/anticipo', className: 'status-badge-success' },
  apartado: { label: 'Apartado', className: 'status-badge-warning' },
  entrega_programada: { label: 'Entrega programada', className: 'status-badge-info' },
  en_bodega: { label: 'En bodega', className: 'status-badge-info' },
  surtido_parcial: { label: 'Surtido parcial', className: 'status-badge-warning' },
  surtido_total: { label: 'Surtido total', className: 'status-badge-success' },
  en_reparto: { label: 'En reparto', className: 'status-badge-warning' },
  en_entrega: { label: 'En entrega', className: 'status-badge-info' },
  entregado: { label: 'Entregado', className: 'status-badge-success' },
  cancelado: { label: 'Cancelado', className: 'status-badge-danger' },
  // Service
  pendiente: { label: 'Pendiente', className: 'status-badge-warning' },
  programado: { label: 'Programado', className: 'status-badge-info' },
  en_proceso: { label: 'En proceso', className: 'status-badge-warning' },
  terminado: { label: 'Terminado', className: 'status-badge-success' },
  // Receivable
  al_corriente: { label: 'Al corriente', className: 'status-badge-success' },
  por_vencer: { label: 'Por vencer', className: 'status-badge-warning' },
  vencido: { label: 'Vencido', className: 'status-badge-danger' },
  pago_parcial: { label: 'Pago parcial', className: 'status-badge-warning' },
  liquidado: { label: 'Liquidado', className: 'status-badge-success' },
  // Priority
  alta: { label: 'Alta', className: 'status-badge-danger' },
  media: { label: 'Media', className: 'status-badge-warning' },
  baja: { label: 'Baja', className: 'status-badge-neutral' },
  // Pipeline
  prospecto_nuevo: { label: 'Prospecto nuevo', className: 'status-badge-neutral' },
  contactado: { label: 'Contactado', className: 'status-badge-info' },
  calificado: { label: 'Calificado', className: 'status-badge-info' },
  diagnostico: { label: 'Diagnóstico', className: 'status-badge-warning' },
  cotizacion_enviada: { label: 'Cotización enviada', className: 'status-badge-info' },
  negociacion: { label: 'Negociación', className: 'status-badge-warning' },
  cierre_ganado: { label: 'Cierre ganado', className: 'status-badge-success' },
  cierre_perdido: { label: 'Cierre perdido', className: 'status-badge-danger' },
  postventa: { label: 'Postventa', className: 'status-badge-success' },
};

// Add import statuses
Object.entries(IMPORT_STATUS_LABELS).forEach(([key, label]) => {
  const idx = ['orden_enviada', 'anticipo_pagado', 'produccion', 'flete_local_china', 'puerto_china'].includes(key)
    ? 'status-badge-warning'
    : ['embarcado', 'transito_maritimo', 'puerto_mexico', 'aduana'].includes(key)
    ? 'status-badge-info'
    : ['liberado_aduana', 'transito_local', 'llego_bodega'].includes(key)
    ? 'status-badge-success'
    : 'status-badge-success';
  statusConfig[key] = { label, className: idx };
});

export default function StatusBadge({ status }: Props) {
  const config = statusConfig[status] || { label: status, className: 'status-badge-neutral' };
  return <span className={config.className}>{config.label}</span>;
}
