/**
 * Daily Commercial Assistant Engine
 * Analyzes all commercial signals to generate prioritized daily recommendations.
 */
import {
  demoCustomers, demoOpportunities, demoQuotations, demoOrders,
  demoProducts, demoUsers,
} from '@/data/demo-data';
import { getCrossSellOpportunities, getUpgradeReadyClients } from '@/lib/commercialIntelligence';
import { generateRestockOpportunities } from '@/lib/restockEngine';
import { demoActivities } from '@/lib/agendaEngine';

// ─── Types ───────────────────────────────────────────────────────
export type RecommendationReason =
  | 'cotizacion_abierta'
  | 'cotizacion_caliente'
  | 'sin_seguimiento'
  | 'reabasto_disponible'
  | 'venta_cruzada'
  | 'upgrade_taller'
  | 'visita_showroom'
  | 'cliente_inactivo'
  | 'actividad_pendiente'
  | 'nuevo_lead'
  | 'solicitud_descuento'
  | 'producto_disponible';

export type RecommendationPriority = 'alta' | 'media' | 'baja';

export const REASON_LABELS: Record<RecommendationReason, string> = {
  cotizacion_abierta: 'Cotización abierta',
  cotizacion_caliente: 'Cotización caliente (seguimiento/vista)',
  sin_seguimiento: 'Sin seguimiento reciente',
  reabasto_disponible: 'Producto disponible por reabasto',
  venta_cruzada: 'Oportunidad de venta cruzada',
  upgrade_taller: 'Cliente listo para subir de nivel',
  visita_showroom: 'Visitó showroom recientemente',
  cliente_inactivo: 'Cliente inactivo con historial',
  actividad_pendiente: 'Actividad pendiente/vencida',
  nuevo_lead: 'Nuevo lead sin contactar',
  solicitud_descuento: 'Solicitó descuento',
  producto_disponible: 'Producto ahora disponible',
};

export const REASON_ICONS: Record<RecommendationReason, string> = {
  cotizacion_abierta: '📄',
  cotizacion_caliente: '🔥',
  sin_seguimiento: '⚠️',
  reabasto_disponible: '📦',
  venta_cruzada: '🔀',
  upgrade_taller: '⬆️',
  visita_showroom: '🏪',
  cliente_inactivo: '💤',
  actividad_pendiente: '⏰',
  nuevo_lead: '🆕',
  solicitud_descuento: '💲',
  producto_disponible: '✅',
};

export interface DailyRecommendation {
  id: string;
  customerId: string;
  customerName: string;
  company: string;
  city: string;
  state: string;
  vendorId: string;
  vendorName: string;
  reason: RecommendationReason;
  reasonLabel: string;
  suggestedProduct: string;
  priority: RecommendationPriority;
  score: number;
  lastActivity: string;
  suggestedAction: string;
  quotationFolio?: string;
  estimatedValue: number;
  worked: boolean;
  closed: boolean;
}

// ─── Priority scoring weights ────────────────────────────────────
const PRIORITY_WEIGHTS: Record<RecommendationReason, number> = {
  cotizacion_caliente: 95,
  visita_showroom: 90,
  reabasto_disponible: 88,
  producto_disponible: 87,
  solicitud_descuento: 85,
  upgrade_taller: 80,
  venta_cruzada: 75,
  cotizacion_abierta: 70,
  actividad_pendiente: 68,
  sin_seguimiento: 60,
  nuevo_lead: 55,
  cliente_inactivo: 50,
};

function resolveVendor(vendorId: string) {
  return demoUsers.find(u => u.id === vendorId)?.name ?? vendorId;
}

function resolveCustomer(customerId: string) {
  return demoCustomers.find(c => c.id === customerId);
}

function classifyPriority(score: number): RecommendationPriority {
  if (score >= 80) return 'alta';
  if (score >= 60) return 'media';
  return 'baja';
}

let _cachedRecs: DailyRecommendation[] | null = null;

export function generateDailyRecommendations(): DailyRecommendation[] {
  if (_cachedRecs) return _cachedRecs;

  const recs: DailyRecommendation[] = [];
  const seen = new Set<string>();
  let idCounter = 1;

  const addRec = (
    customerId: string,
    reason: RecommendationReason,
    suggestedProduct: string,
    suggestedAction: string,
    extraScore: number = 0,
    extra?: Partial<DailyRecommendation>,
  ) => {
    const key = `${customerId}-${reason}-${suggestedProduct}`;
    if (seen.has(key)) return;
    seen.add(key);

    const customer = resolveCustomer(customerId);
    if (!customer) return;

    const baseScore = PRIORITY_WEIGHTS[reason] + extraScore;
    const score = Math.min(99, Math.max(10, baseScore));

    recs.push({
      id: `da-${idCounter++}`,
      customerId,
      customerName: customer.name,
      company: customer.name,
      city: customer.city,
      state: customer.state ?? '',
      vendorId: customer.vendorId,
      vendorName: resolveVendor(customer.vendorId),
      reason,
      reasonLabel: REASON_LABELS[reason],
      suggestedProduct,
      priority: classifyPriority(score),
      score,
      lastActivity: extra?.lastActivity ?? customer.createdAt,
      suggestedAction,
      quotationFolio: extra?.quotationFolio,
      estimatedValue: extra?.estimatedValue ?? 0,
      worked: false,
      closed: false,
    });
  };

  // 1. Hot quotations (seguimiento / vista)
  demoQuotations
    .filter(q => q.status === 'seguimiento' || q.status === 'vista')
    .forEach(q => {
      const mainProduct = q.items[0]?.productName ?? 'Producto';
      addRec(q.customerId, 'cotizacion_caliente', mainProduct,
        'Dar seguimiento inmediato a cotización', 5,
        { quotationFolio: q.folio, estimatedValue: q.total, lastActivity: q.createdAt });
    });

  // 2. Open quotations
  demoQuotations
    .filter(q => q.status === 'enviada' || q.status === 'borrador')
    .forEach(q => {
      const mainProduct = q.items[0]?.productName ?? 'Producto';
      addRec(q.customerId, 'cotizacion_abierta', mainProduct,
        q.status === 'borrador' ? 'Completar y enviar cotización' : 'Seguimiento a cotización enviada', 0,
        { quotationFolio: q.folio, estimatedValue: q.total, lastActivity: q.createdAt });
    });

  // 3. Without follow-up (sent quotations older than 5 days)
  demoQuotations
    .filter(q => q.status === 'enviada')
    .forEach(q => {
      const daysSince = Math.floor((Date.now() - new Date(q.createdAt).getTime()) / 86400000);
      if (daysSince > 5) {
        addRec(q.customerId, 'sin_seguimiento', q.items[0]?.productName ?? 'Producto',
          'Contactar cliente — cotización sin respuesta', daysSince > 10 ? 5 : 0,
          { quotationFolio: q.folio, estimatedValue: q.total, lastActivity: q.createdAt });
      }
    });

  // 4. Restock opportunities (product now available)
  try {
    const restockOpps = generateRestockOpportunities();
    restockOpps
      .filter(r => r.status === 'producto_disponible')
      .forEach(r => {
        addRec(r.customerId, 'reabasto_disponible', r.productName,
          'Reenviar cotización — producto ya disponible', 0,
          { quotationFolio: r.quotationFolio, estimatedValue: r.totalQuotation, lastActivity: r.lastFollowUp ?? r.quotationDate });
      });
  } catch { /* ignore if engine not ready */ }

  // 5. Cross-sell opportunities
  try {
    getCrossSellOpportunities().forEach(cs => {
      addRec(cs.customerId, 'venta_cruzada', cs.suggestedProduct,
        `Ofrecer ${cs.suggestedProduct} — complemento de ${cs.purchasedProduct}`,
        cs.priority === 'alta' ? 10 : cs.priority === 'media' ? 5 : 0,
        { estimatedValue: cs.estimatedValue, lastActivity: cs.lastActivity });
    });
  } catch { /* */ }

  // 6. Upgrade-ready clients
  try {
    getUpgradeReadyClients().forEach(u => {
      addRec(u.customerId, 'upgrade_taller', u.nextProduct,
        `Proponer upgrade de nivel ${u.currentLevel} — ${u.nextProduct}`, 0,
        { estimatedValue: u.estimatedValue, lastActivity: u.lastActivity });
    });
  } catch { /* */ }

  // 7. Showroom visits (customers with source = visita_sucursal)
  demoCustomers
    .filter(c => c.source === 'visita_sucursal')
    .forEach(c => {
      addRec(c.id, 'visita_showroom', 'Producto de interés',
        'Contactar — visitó showroom', c.priority === 'alta' ? 5 : 0,
        { lastActivity: c.createdAt, estimatedValue: 50000 });
    });

  // 8. Inactive clients (no open opportunities)
  const activeIds = new Set([
    ...demoOpportunities.filter(o => o.stage !== 'cierre_perdido').map(o => o.customerId),
    ...demoQuotations.filter(q => ['enviada', 'seguimiento', 'vista'].includes(q.status)).map(q => q.customerId),
  ]);
  demoCustomers
    .filter(c => !activeIds.has(c.id))
    .forEach(c => {
      const lastOrder = demoOrders.filter(o => o.customerId === c.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
      if (lastOrder) {
        addRec(c.id, 'cliente_inactivo', 'Recompra sugerida',
          'Reactivar cliente — tiene historial de compra', 0,
          { estimatedValue: lastOrder.total, lastActivity: lastOrder.createdAt });
      }
    });

  // 9. Pending/overdue activities
  try {
    const activities = getDemoActivities();
    const today = new Date().toISOString().slice(0, 10);
    activities
      .filter(a => (a.status === 'pendiente' || a.status === 'en_proceso') && a.date <= today)
      .forEach(a => {
        if (a.customerId) {
          addRec(a.customerId, 'actividad_pendiente', a.title,
            `Completar actividad: ${a.title}`, a.date < today ? 8 : 0,
            { lastActivity: a.date });
        }
      });
  } catch { /* */ }

  // 10. New leads (customers created recently without any quotation)
  const quotedCustomerIds = new Set(demoQuotations.map(q => q.customerId));
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  demoCustomers
    .filter(c => c.createdAt >= thirtyDaysAgo && !quotedCustomerIds.has(c.id))
    .forEach(c => {
      addRec(c.id, 'nuevo_lead', 'Diagnosticar necesidad',
        'Primer contacto — nuevo lead', c.priority === 'alta' ? 5 : 0,
        { lastActivity: c.createdAt, estimatedValue: 30000 });
    });

  _cachedRecs = recs.sort((a, b) => b.score - a.score);
  return _cachedRecs;
}

// ─── Summary stats ──────────────────────────────────────────────
export interface AssistantSummary {
  total: number;
  alta: number;
  media: number;
  baja: number;
  totalValue: number;
  workedCount: number;
  closedCount: number;
  complianceRate: number;
}

export function getAssistantSummary(recs: DailyRecommendation[]): AssistantSummary {
  const alta = recs.filter(r => r.priority === 'alta').length;
  const media = recs.filter(r => r.priority === 'media').length;
  const baja = recs.filter(r => r.priority === 'baja').length;
  const workedCount = recs.filter(r => r.worked).length;
  const closedCount = recs.filter(r => r.closed).length;
  return {
    total: recs.length,
    alta, media, baja,
    totalValue: recs.reduce((s, r) => s + r.estimatedValue, 0),
    workedCount,
    closedCount,
    complianceRate: recs.length > 0 ? Math.round((workedCount / recs.length) * 100) : 0,
  };
}

// Force recalculation
export function refreshRecommendations() {
  _cachedRecs = null;
  return generateDailyRecommendations();
}
