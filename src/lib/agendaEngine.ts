/**
 * Commercial Agenda — Types, demo data, and helpers.
 */
import { demoCustomers, demoQuotations, demoProducts, demoUsers } from '@/data/demo-data';

// ─── Types ───────────────────────────────────────────────────────
export type ActivityType =
  | 'llamada' | 'whatsapp' | 'enviar_cotizacion' | 'reenviar_cotizacion'
  | 'seguimiento' | 'visita' | 'videollamada' | 'cobranza'
  | 'confirmacion_entrega' | 'postventa' | 'recordatorio' | 'otra';

export type ActivityStatus = 'pendiente' | 'en_proceso' | 'realizada' | 'no_realizada' | 'reagendada' | 'cancelada';

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  llamada: 'Llamada',
  whatsapp: 'WhatsApp',
  enviar_cotizacion: 'Enviar cotización',
  reenviar_cotizacion: 'Reenviar cotización',
  seguimiento: 'Seguimiento comercial',
  visita: 'Visita a cliente',
  videollamada: 'Videollamada',
  cobranza: 'Cobranza',
  confirmacion_entrega: 'Confirmación de entrega',
  postventa: 'Postventa',
  recordatorio: 'Recordatorio',
  otra: 'Otra actividad',
};

export const ACTIVITY_TYPE_ICONS: Record<ActivityType, string> = {
  llamada: '📞',
  whatsapp: '💬',
  enviar_cotizacion: '📄',
  reenviar_cotizacion: '📨',
  seguimiento: '🔄',
  visita: '🚗',
  videollamada: '📹',
  cobranza: '💰',
  confirmacion_entrega: '📦',
  postventa: '🔧',
  recordatorio: '⏰',
  otra: '📌',
};

export const ACTIVITY_STATUS_LABELS: Record<ActivityStatus, string> = {
  pendiente: 'Pendiente',
  en_proceso: 'En proceso',
  realizada: 'Realizada',
  no_realizada: 'No realizada',
  reagendada: 'Reagendada',
  cancelada: 'Cancelada',
};

export const ACTIVITY_STATUS_COLORS: Record<ActivityStatus, string> = {
  pendiente: 'bg-warning/10 text-warning border-warning/20',
  en_proceso: 'bg-info/10 text-info border-info/20',
  realizada: 'bg-success/10 text-success border-success/20',
  no_realizada: 'bg-destructive/10 text-destructive border-destructive/20',
  reagendada: 'bg-primary/10 text-primary border-primary/20',
  cancelada: 'bg-muted text-muted-foreground border-muted',
};

export interface Activity {
  id: string;
  title: string;
  type: ActivityType;
  date: string;        // YYYY-MM-DD
  time?: string;       // HH:mm
  customerId?: string;
  customerName?: string;
  leadId?: string;
  leadName?: string;
  quotationId?: string;
  quotationFolio?: string;
  productId?: string;
  productName?: string;
  priority: 'alta' | 'media' | 'baja';
  notes: string;
  responsibleId: string;
  responsibleName: string;
  status: ActivityStatus;
}

// ─── Demo data ───────────────────────────────────────────────────
const today = '2026-03-07';
const yesterday = '2026-03-06';
const tomorrow = '2026-03-08';

export const demoActivities: Activity[] = [
  // Today
  {
    id: 'act-1', title: 'Llamar a Taller Los Reyes por cotización elevador',
    type: 'llamada', date: today, time: '09:00',
    customerId: 'c1', customerName: 'Taller Automotriz Los Reyes',
    quotationId: 'q1', quotationFolio: 'V1-1001',
    priority: 'alta', notes: 'Seguimiento a cotización de elevador + alineadora',
    responsibleId: 'u3', responsibleName: 'Roberto Juárez', status: 'pendiente',
  },
  {
    id: 'act-2', title: 'WhatsApp a Llantamax — seguimiento cotización',
    type: 'whatsapp', date: today, time: '10:30',
    customerId: 'c2', customerName: 'Llantamax S.A. de C.V.',
    quotationId: 'q2', quotationFolio: 'V2-2001',
    priority: 'alta', notes: 'Cotización de balanceadora + desmontadora en seguimiento',
    responsibleId: 'u4', responsibleName: 'Miguel Torres', status: 'pendiente',
  },
  {
    id: 'act-3', title: 'Enviar cotización a Grupo Llantas Express',
    type: 'enviar_cotizacion', date: today, time: '11:00',
    customerId: 'c5', customerName: 'Grupo Llantas Express',
    quotationId: 'q3', quotationFolio: 'V4-4001',
    productId: 'p2', productName: 'Elevador 2 Postes 4.5 Ton',
    priority: 'alta', notes: 'Cotización borrador pendiente de enviar',
    responsibleId: 'u6', responsibleName: 'Fernando Ruiz', status: 'pendiente',
  },
  {
    id: 'act-4', title: 'Cobranza Transportes García',
    type: 'cobranza', date: today, time: '14:00',
    customerId: 'c6', customerName: 'Transportes García Hnos',
    priority: 'media', notes: 'Pago vencido 19 días — $42,500',
    responsibleId: 'u5', responsibleName: 'Alejandra Vega', status: 'en_proceso',
  },
  {
    id: 'act-5', title: 'Confirmación de entrega — Llantamax desmontadora',
    type: 'confirmacion_entrega', date: today, time: '16:00',
    customerId: 'c2', customerName: 'Llantamax S.A. de C.V.',
    productId: 'p7', productName: 'Desmontadora Semiautomática',
    priority: 'media', notes: 'Pedido PED-2026-003 en entrega',
    responsibleId: 'u4', responsibleName: 'Miguel Torres', status: 'pendiente',
  },
  // Yesterday (some done, some missed)
  {
    id: 'act-6', title: 'Visita a AutoAgencia Premium — demo alineadora',
    type: 'visita', date: yesterday, time: '10:00',
    customerId: 'c8', customerName: 'AutoAgencia Premium',
    productId: 'p8', productName: 'Alineadora 3D',
    priority: 'alta', notes: 'Demo de alineadora 3D programada',
    responsibleId: 'u3', responsibleName: 'Roberto Juárez', status: 'realizada',
  },
  {
    id: 'act-7', title: 'Llamar a Vulcanizadora El Rápido — cobranza',
    type: 'cobranza', date: yesterday, time: '11:00',
    customerId: 'c7', customerName: 'Vulcanizadora El Rápido',
    priority: 'baja', notes: 'Pago vencido $16,000',
    responsibleId: 'u7', responsibleName: 'Diana Castillo', status: 'no_realizada',
  },
  // Tomorrow
  {
    id: 'act-8', title: 'Seguimiento Distribuidora Bajío — propuesta 5+5',
    type: 'seguimiento', date: tomorrow, time: '09:30',
    customerId: 'c12', customerName: 'Distribuidora Automotriz del Bajío',
    priority: 'alta', notes: 'Propuesta de 5 balanceadoras + 5 desmontadoras',
    responsibleId: 'u4', responsibleName: 'Miguel Torres', status: 'pendiente',
  },
  {
    id: 'act-9', title: 'Videollamada Flotillas del Pacífico — alineadora',
    type: 'videollamada', date: tomorrow, time: '12:00',
    customerId: 'c9', customerName: 'Flotillas del Pacífico',
    productId: 'p8', productName: 'Alineadora 3D',
    priority: 'media', notes: 'Presentación de alineadora por videollamada',
    responsibleId: 'u4', responsibleName: 'Miguel Torres', status: 'pendiente',
  },
  // Next week
  {
    id: 'act-10', title: 'Visita Taller Hernández — entrega gatos hidráulicos',
    type: 'visita', date: '2026-03-10', time: '10:00',
    customerId: 'c10', customerName: 'Taller Mecánico Hernández',
    productId: 'p12', productName: 'Gato Hidráulico Patin 3 Ton',
    priority: 'media', notes: 'Entrega de 3 gatos + capacitación',
    responsibleId: 'u6', responsibleName: 'Fernando Ruiz', status: 'pendiente',
  },
  {
    id: 'act-11', title: 'Reenviar cotización a Suspensiones del Norte',
    type: 'reenviar_cotizacion', date: '2026-03-11',
    customerId: 'c3', customerName: 'Suspensiones del Norte',
    priority: 'baja', notes: 'Reenviar cotización de elevador tijera',
    responsibleId: 'u3', responsibleName: 'Roberto Juárez', status: 'pendiente',
  },
  {
    id: 'act-12', title: 'Postventa — Servicio Automotriz Juárez',
    type: 'postventa', date: '2026-03-12', time: '15:00',
    customerId: 'c4', customerName: 'Servicio Automotriz Juárez',
    priority: 'media', notes: 'Seguimiento postventa prensa + compresor',
    responsibleId: 'u5', responsibleName: 'Alejandra Vega', status: 'pendiente',
  },
  {
    id: 'act-13', title: 'Recordatorio: revisar meta mensual',
    type: 'recordatorio', date: '2026-03-15',
    priority: 'baja', notes: 'Cierre de primera quincena — revisar meta',
    responsibleId: 'u3', responsibleName: 'Roberto Juárez', status: 'pendiente',
  },
  {
    id: 'act-14', title: 'Llamada Llantas y Servicios Morelos — reactivar',
    type: 'llamada', date: '2026-03-14', time: '11:00',
    customerId: 'c11', customerName: 'Llantas y Servicios Morelos',
    priority: 'baja', notes: 'Reactivar cliente inactivo — alineadora CCD',
    responsibleId: 'u7', responsibleName: 'Diana Castillo', status: 'pendiente',
  },
];

// ─── Helpers ─────────────────────────────────────────────────────
export function getActivitiesForDate(activities: Activity[], date: string): Activity[] {
  return activities.filter(a => a.date === date);
}

export function getActivitiesForWeek(activities: Activity[], startDate: string): Activity[] {
  const start = new Date(startDate);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return activities.filter(a => {
    const d = new Date(a.date);
    return d >= start && d <= end;
  });
}

export function getActivitiesForMonth(activities: Activity[], year: number, month: number): Activity[] {
  return activities.filter(a => {
    const d = new Date(a.date);
    return d.getFullYear() === year && d.getMonth() === month;
  });
}

export function getPendingActivities(activities: Activity[]): Activity[] {
  return activities.filter(a => a.status === 'pendiente' || a.status === 'en_proceso');
}

export function getOverdueActivities(activities: Activity[], today: string): Activity[] {
  return activities.filter(a => a.date < today && (a.status === 'pendiente' || a.status === 'en_proceso'));
}

export function getTodaysSummary(activities: Activity[], today: string) {
  const todayActs = getActivitiesForDate(activities, today);
  return {
    pending: todayActs.filter(a => a.status === 'pendiente').length,
    inProgress: todayActs.filter(a => a.status === 'en_proceso').length,
    done: todayActs.filter(a => a.status === 'realizada').length,
    overdue: getOverdueActivities(activities, today).length,
    upcoming: activities.filter(a => a.date > today && (a.status === 'pendiente' || a.status === 'en_proceso')).slice(0, 5),
    todayActivities: todayActs,
  };
}
