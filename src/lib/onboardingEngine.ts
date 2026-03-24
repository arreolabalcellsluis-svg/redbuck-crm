/**
 * Onboarding Automation Engine
 * Creates follow-up activities automatically when a new customer is registered.
 */

export interface OnboardingConfig {
  enabled: boolean;
  followUpDays: number[];         // e.g. [1, 3, 7, 15]
  whatsappTemplate: string;
  activityTitles: Record<number, string>; // day → title template
}

export const DEFAULT_ONBOARDING_CONFIG: OnboardingConfig = {
  enabled: true,
  followUpDays: [1, 3, 7, 15],
  whatsappTemplate:
    'Hola {cliente}, soy {vendedor} de RedBuck. Gracias por tu interés en {producto}. Estoy a tus órdenes para cualquier duda. ¡Saludos!',
  activityTitles: {
    1: 'Seguimiento inicial - {producto}',
    3: 'Segundo seguimiento - {producto}',
    7: 'Seguimiento semanal - {producto}',
    15: 'Reactivación - {producto}',
  },
};

export interface OnboardingActivityPayload {
  title: string;
  type: 'llamada' | 'seguimiento' | 'whatsapp';
  date: string;
  customerId: string;
  customerName: string;
  responsibleId: string;
  responsibleName: string;
  priority: 'alta' | 'media' | 'baja';
  notes: string;
  status: 'pendiente';
  productName?: string;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function fillTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? '');
}

/**
 * Generate the list of onboarding activities for a newly created customer.
 */
export function generateOnboardingActivities(
  config: OnboardingConfig,
  customer: { id: string; name: string; createdAt: string },
  vendor: { id: string; name: string },
  productOfInterest?: string,
): OnboardingActivityPayload[] {
  if (!config.enabled) return [];
  const producto = productOfInterest || 'equipo automotriz';
  const vars = { cliente: customer.name, vendedor: vendor.name, producto };

  return config.followUpDays.map((day, idx) => {
    const titleTpl = config.activityTitles[day] ?? `Seguimiento día ${day} - {producto}`;
    return {
      title: fillTemplate(titleTpl, vars),
      type: idx === 0 ? 'llamada' : 'seguimiento',
      date: addDays(customer.createdAt, day),
      customerId: customer.id,
      customerName: customer.name,
      responsibleId: vendor.id,
      responsibleName: vendor.name,
      priority: idx === 0 ? 'alta' : 'media',
      notes: idx === 0
        ? `Onboarding automático día ${day}. Mensaje WhatsApp sugerido:\n${fillTemplate(config.whatsappTemplate, vars)}`
        : `Onboarding automático día ${day}`,
      status: 'pendiente' as const,
    };
  });
}

/**
 * Build WhatsApp link with pre-filled message.
 */
export function buildWhatsAppLink(phone: string, template: string, vars: Record<string, string>): string {
  const msg = fillTemplate(template, vars);
  const clean = phone.replace(/\D/g, '');
  return `https://wa.me/${clean}?text=${encodeURIComponent(msg)}`;
}

// ─── Smart title suggestions ─────────────────────────────────────

export type CustomerStage = 'nuevo' | 'seguimiento' | 'cierre' | 'reactivacion';

const TITLE_TEMPLATES: Record<CustomerStage, string[]> = {
  nuevo: [
    'Primer contacto - {producto}',
    'Bienvenida nuevo cliente - {producto}',
    'Presentación de productos - {producto}',
  ],
  seguimiento: [
    'Seguimiento cotización - {producto}',
    'Seguimiento comercial - {producto}',
    'Revisar interés - {producto}',
  ],
  cierre: [
    'Cierre potencial - {producto}',
    'Negociación final - {producto}',
    'Confirmación de pedido - {producto}',
  ],
  reactivacion: [
    'Reactivación cliente - {producto}',
    'Retomar contacto - {producto}',
    'Nueva propuesta - {producto}',
  ],
};

export function suggestTitles(
  activityType: string,
  stage: CustomerStage,
  productName?: string,
  customerName?: string,
): string[] {
  const producto = productName || 'equipo';
  const cliente = customerName || '';
  const vars = { producto, cliente };

  const baseTitles = TITLE_TEMPLATES[stage] || TITLE_TEMPLATES.seguimiento;

  // Add type-specific suggestions
  const typeSpecific: string[] = [];
  if (activityType === 'llamada') typeSpecific.push(`Llamar a ${cliente || 'cliente'} - ${producto}`);
  if (activityType === 'whatsapp') typeSpecific.push(`WhatsApp a ${cliente || 'cliente'} - ${producto}`);
  if (activityType === 'visita') typeSpecific.push(`Visita a ${cliente || 'cliente'} - ${producto}`);
  if (activityType === 'cobranza') typeSpecific.push(`Cobranza - ${cliente || 'cliente'}`);
  if (activityType === 'enviar_cotizacion') typeSpecific.push(`Enviar cotización - ${producto}`);
  if (activityType === 'reenviar_cotizacion') typeSpecific.push(`Reenviar cotización - ${producto}`);
  if (activityType === 'confirmacion_entrega') typeSpecific.push(`Confirmar entrega - ${producto}`);
  if (activityType === 'postventa') typeSpecific.push(`Postventa - ${producto}`);
  if (activityType === 'videollamada') typeSpecific.push(`Videollamada con ${cliente || 'cliente'} - ${producto}`);

  return [
    ...typeSpecific,
    ...baseTitles.map(t => fillTemplate(t, vars)),
  ];
}

/**
 * Detect customer stage based on existing activities count.
 */
export function detectCustomerStage(
  customerId: string,
  activities: { customerId?: string; status: string }[],
  hasQuotation: boolean,
): CustomerStage {
  const customerActs = activities.filter(a => a.customerId === customerId);
  const doneCount = customerActs.filter(a => a.status === 'realizada').length;

  if (doneCount === 0) return 'nuevo';
  if (hasQuotation) return 'cierre';
  if (doneCount >= 3) return 'reactivacion';
  return 'seguimiento';
}
