/**
 * Restock Opportunities Module — Data types, demo data, and engine.
 * Tracks quotations that didn't close due to inventory unavailability.
 */
import {
  demoQuotations, demoCustomers, demoProducts, demoImports, demoUsers,
} from '@/data/demo-data';
import { CATEGORY_LABELS, type ProductCategory } from '@/types';

// ─── Types ───────────────────────────────────────────────────────
export type RestockReason = 'sin_existencia' | 'en_transito' | 'pendiente_llegada' | 'cliente_espera';
export type RestockStatus = 'esperando_llegada' | 'producto_disponible' | 'cotizacion_reenviada' | 'en_seguimiento' | 'venta_cerrada' | 'perdida';

export const RESTOCK_REASON_LABELS: Record<RestockReason, string> = {
  sin_existencia: 'Sin existencia',
  en_transito: 'Producto en tránsito',
  pendiente_llegada: 'Pendiente de llegada',
  cliente_espera: 'Cliente espera disponibilidad',
};

export const RESTOCK_STATUS_LABELS: Record<RestockStatus, string> = {
  esperando_llegada: 'Esperando llegada',
  producto_disponible: 'Producto disponible',
  cotizacion_reenviada: 'Cotización reenviada',
  en_seguimiento: 'En seguimiento',
  venta_cerrada: 'Venta cerrada',
  perdida: 'Perdida',
};

export const RESTOCK_STATUS_COLORS: Record<RestockStatus, string> = {
  esperando_llegada: 'bg-warning/10 text-warning border-warning/20',
  producto_disponible: 'bg-success/10 text-success border-success/20',
  cotizacion_reenviada: 'bg-info/10 text-info border-info/20',
  en_seguimiento: 'bg-primary/10 text-primary border-primary/20',
  venta_cerrada: 'bg-success/10 text-success border-success/20',
  perdida: 'bg-destructive/10 text-destructive border-destructive/20',
};

export interface RestockOpportunity {
  id: string;
  quotationDate: string;
  quotationFolio: string;
  quotationId: string;
  customerId: string;
  customerName: string;
  city: string;
  state: string;
  vendorId: string;
  vendorName: string;
  productId: string;
  productName: string;
  productCategory: ProductCategory;
  categoryLabel: string;
  qty: number;
  unitPrice: number;
  totalQuotation: number;
  reason: RestockReason;
  inventoryStatus: string;
  estimatedArrival: string;
  priority: 'alta' | 'media' | 'baja';
  status: RestockStatus;
  lastFollowUp: string;
  nextAction: string;
  customerPhone?: string;
  customerWhatsapp?: string;
}

// ─── Demo data generation ────────────────────────────────────────
function resolveVendor(vendorId: string) {
  return demoUsers.find(u => u.id === vendorId)?.name ?? vendorId;
}

function getProductStock(productId: string): number {
  const p = demoProducts.find(pr => pr.id === productId);
  if (!p || !p.stock) return 0;
  return Object.values(p.stock).reduce((a, b) => a + b, 0);
}

function getEstimatedArrival(productName: string): string {
  for (const imp of demoImports) {
    if (imp.items.some(i => productName.includes(i.productName.split(' ')[0]))) {
      return imp.estimatedArrival;
    }
  }
  return '2026-04-30';
}

function getInventoryStatusText(productId: string): string {
  const stock = getProductStock(productId);
  const p = demoProducts.find(pr => pr.id === productId);
  if (stock > 0) return `Disponible (${stock} uds)`;
  if (p && p.inTransit > 0) return `En tránsito (${p.inTransit} uds)`;
  return 'Sin stock';
}

function determineRestockStatus(productId: string): RestockStatus {
  const stock = getProductStock(productId);
  if (stock > 0) return 'producto_disponible';
  const p = demoProducts.find(pr => pr.id === productId);
  if (p && p.inTransit > 0) return 'esperando_llegada';
  return 'esperando_llegada';
}

export function generateRestockOpportunities(): RestockOpportunity[] {
  const opportunities: RestockOpportunity[] = [];

  // From open/lost quotations where products had low/no stock
  demoQuotations.forEach(q => {
    const customer = demoCustomers.find(c => c.id === q.customerId);
    if (!customer) return;

    q.items.forEach((item, idx) => {
      const product = demoProducts.find(p => p.id === item.productId);
      if (!product) return;

      const totalStock = getProductStock(product.id);
      const hasLowStock = totalStock < item.qty;
      const isOpenQuotation = ['enviada', 'borrador', 'seguimiento', 'vencida'].includes(q.status);

      if (hasLowStock || isOpenQuotation) {
        const reason: RestockReason = totalStock === 0
          ? (product.inTransit > 0 ? 'en_transito' : 'sin_existencia')
          : (totalStock < item.qty ? 'pendiente_llegada' : 'cliente_espera');

        const status = q.status === 'aceptada' ? 'venta_cerrada' as RestockStatus
          : q.status === 'rechazada' ? 'perdida' as RestockStatus
          : determineRestockStatus(product.id);

        opportunities.push({
          id: `rst-${q.id}-${idx}`,
          quotationDate: q.createdAt,
          quotationFolio: q.folio,
          quotationId: q.id,
          customerId: customer.id,
          customerName: customer.name,
          city: customer.city,
          state: customer.state,
          vendorId: q.vendorId ?? '',
          vendorName: q.vendorName,
          productId: product.id,
          productName: product.name,
          productCategory: product.category,
          categoryLabel: CATEGORY_LABELS[product.category],
          qty: item.qty,
          unitPrice: item.unitPrice,
          totalQuotation: q.total,
          reason,
          inventoryStatus: getInventoryStatusText(product.id),
          estimatedArrival: getEstimatedArrival(product.name),
          priority: customer.priority,
          status,
          lastFollowUp: q.createdAt,
          nextAction: status === 'producto_disponible'
            ? 'Reenviar cotización al cliente'
            : status === 'esperando_llegada'
            ? 'Confirmar ETA con compras'
            : 'Contactar cliente para seguimiento',
          customerPhone: customer.phone,
          customerWhatsapp: customer.whatsapp ?? customer.phone,
        });
      }
    });
  });

  // Add some synthetic entries for richer demo
  const syntheticEntries: Partial<RestockOpportunity>[] = [
    {
      id: 'rst-syn-1',
      quotationDate: '2026-02-05',
      quotationFolio: 'V1-0998',
      quotationId: 'syn1',
      customerId: 'c3',
      customerName: 'Suspensiones del Norte',
      city: 'San Nicolás',
      state: 'Nuevo León',
      vendorId: 'u3',
      vendorName: 'Roberto Juárez',
      productId: 'p3',
      productName: 'Elevador Tijera 3 Ton',
      productCategory: 'elevadores',
      categoryLabel: 'Elevadores / Rampas',
      qty: 2,
      unitPrice: 62000,
      totalQuotation: 143840,
      reason: 'sin_existencia',
      inventoryStatus: 'En tránsito (4 uds)',
      estimatedArrival: '2026-04-25',
      priority: 'media',
      status: 'esperando_llegada',
      lastFollowUp: '2026-02-20',
      nextAction: 'Confirmar ETA con compras',
      customerPhone: '818-567-8901',
    },
    {
      id: 'rst-syn-2',
      quotationDate: '2026-01-20',
      quotationFolio: 'V5-5001',
      quotationId: 'syn2',
      customerId: 'c9',
      customerName: 'Flotillas del Pacífico',
      city: 'Mazatlán',
      state: 'Sinaloa',
      vendorId: 'u4',
      vendorName: 'Miguel Torres',
      productId: 'p8',
      productName: 'Alineadora 3D',
      productCategory: 'alineadoras',
      categoryLabel: 'Alineadoras',
      qty: 1,
      unitPrice: 180000,
      totalQuotation: 208800,
      reason: 'pendiente_llegada',
      inventoryStatus: 'En tránsito (2 uds)',
      estimatedArrival: '2026-04-25',
      priority: 'alta',
      status: 'en_seguimiento',
      lastFollowUp: '2026-03-01',
      nextAction: 'Contactar cliente para seguimiento',
      customerPhone: '669-234-5678',
    },
    {
      id: 'rst-syn-3',
      quotationDate: '2026-02-12',
      quotationFolio: 'V3-3002',
      quotationId: 'syn3',
      customerId: 'c11',
      customerName: 'Llantas y Servicios Morelos',
      city: 'Cuernavaca',
      state: 'Morelos',
      vendorId: 'u7',
      vendorName: 'Diana Castillo',
      productId: 'p9',
      productName: 'Alineadora CCD',
      productCategory: 'alineadoras',
      categoryLabel: 'Alineadoras',
      qty: 1,
      unitPrice: 90000,
      totalQuotation: 104400,
      reason: 'sin_existencia',
      inventoryStatus: 'Sin stock',
      estimatedArrival: '2026-05-15',
      priority: 'baja',
      status: 'esperando_llegada',
      lastFollowUp: '2026-02-28',
      nextAction: 'Confirmar si el cliente sigue interesado',
      customerPhone: '777-234-5678',
    },
  ];

  syntheticEntries.forEach(s => {
    if (!opportunities.find(o => o.id === s.id)) {
      opportunities.push(s as RestockOpportunity);
    }
  });

  return opportunities.sort((a, b) => {
    const pOrder = { alta: 0, media: 1, baja: 2 };
    return pOrder[a.priority] - pOrder[b.priority] || b.totalQuotation - a.totalQuotation;
  });
}

// ─── Alerts: products that became available ──────────────────────
export function getRestockAlerts(opportunities: RestockOpportunity[]): RestockOpportunity[] {
  return opportunities.filter(o => o.status === 'producto_disponible');
}
