/**
 * Market Map Engine — Aggregates CRM data by city for geographic market analysis.
 * Uses real data passed as parameters (no demo data).
 */

// ─── Types ───────────────────────────────────────────────────────
export type PenetrationLevel = 'alto' | 'medio' | 'bajo' | 'sin_presencia';

export const PENETRATION_LABELS: Record<PenetrationLevel, string> = {
  alto: 'Alto',
  medio: 'Medio',
  bajo: 'Bajo',
  sin_presencia: 'Sin presencia',
};

export const PENETRATION_COLORS: Record<PenetrationLevel, string> = {
  alto: 'bg-success text-success-foreground',
  medio: 'bg-warning text-warning-foreground',
  bajo: 'bg-orange-500 text-white',
  sin_presencia: 'bg-destructive text-destructive-foreground',
};

export const PENETRATION_DOT_COLORS: Record<PenetrationLevel, string> = {
  alto: 'hsl(142,71%,45%)',
  medio: 'hsl(38,92%,50%)',
  bajo: 'hsl(24,95%,53%)',
  sin_presencia: 'hsl(0,78%,45%)',
};

export const PENETRATION_BG: Record<PenetrationLevel, string> = {
  alto: 'bg-success/10 border-success/30',
  medio: 'bg-warning/10 border-warning/30',
  bajo: 'bg-orange-500/10 border-orange-500/30',
  sin_presencia: 'bg-destructive/10 border-destructive/30',
};

export interface CityMarketData {
  city: string;
  state: string;
  customers: number;
  leads: number;
  quotations: number;
  openQuotations: number;
  closedSales: number;
  totalSalesValue: number;
  vendors: string[];
  penetration: PenetrationLevel;
  topProducts: { name: string; count: number }[];
  opportunities: string[];
  potentialValue: number;
  priority: 'alta' | 'media' | 'baja';
  lat: number;
  lng: number;
}

// Approximate coordinates for Mexican cities
const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  'Monterrey': { lat: 25.67, lng: -100.31 },
  'San Nicolás': { lat: 25.74, lng: -100.30 },
  'San Pedro': { lat: 25.66, lng: -100.40 },
  'Guadalajara': { lat: 20.67, lng: -103.35 },
  'CDMX': { lat: 19.43, lng: -99.13 },
  'Ciudad de México': { lat: 19.43, lng: -99.13 },
  'Ciudad Juárez': { lat: 31.69, lng: -106.42 },
  'Saltillo': { lat: 25.42, lng: -100.99 },
  'Nuevo Laredo': { lat: 27.48, lng: -99.52 },
  'Mazatlán': { lat: 23.24, lng: -106.44 },
  'León': { lat: 21.12, lng: -101.68 },
  'Cuernavaca': { lat: 18.92, lng: -99.23 },
  'Querétaro': { lat: 20.59, lng: -100.39 },
  'Puebla': { lat: 19.04, lng: -98.20 },
  'Mérida': { lat: 20.97, lng: -89.62 },
  'Tijuana': { lat: 32.51, lng: -117.02 },
  'Aguascalientes': { lat: 21.88, lng: -102.29 },
  'Hermosillo': { lat: 29.07, lng: -110.96 },
  'Chihuahua': { lat: 28.63, lng: -106.09 },
  'Toluca': { lat: 19.29, lng: -99.66 },
  'Veracruz': { lat: 19.18, lng: -96.14 },
  'Cancún': { lat: 21.16, lng: -86.85 },
  'Tampico': { lat: 22.25, lng: -97.86 },
  'San Luis Potosí': { lat: 22.15, lng: -100.98 },
  'Morelia': { lat: 19.70, lng: -101.19 },
  'Villahermosa': { lat: 17.99, lng: -92.93 },
  'Tuxtla Gutiérrez': { lat: 16.75, lng: -93.12 },
  'Oaxaca': { lat: 17.07, lng: -96.72 },
  'Durango': { lat: 24.02, lng: -104.67 },
  'Reynosa': { lat: 26.08, lng: -98.28 },
  'Torreón': { lat: 25.54, lng: -103.41 },
  'Culiacán': { lat: 24.80, lng: -107.39 },
  'Acapulco': { lat: 16.86, lng: -99.88 },
  'Irapuato': { lat: 20.68, lng: -101.35 },
  'Celaya': { lat: 20.52, lng: -100.82 },
  'Pachuca': { lat: 20.12, lng: -98.73 },
  'Tuxtla': { lat: 16.75, lng: -93.12 },
  'Mexicali': { lat: 32.62, lng: -115.45 },
};

// Input data interfaces (what the page passes in)
export interface MarketCustomer {
  id: string;
  city: string;
  state: string;
  vendor_id: string | null;
}

export interface MarketQuotation {
  id: string;
  customer_id: string | null;
  status: string;
  total: number;
  items: any[];
}

export interface MarketOrder {
  id: string;
  customer_id: string | null;
  total: number;
  items: any[];
}

export interface MarketTeamMember {
  id: string;
  name: string;
}

function classifyPenetration(customers: number, sales: number, quotations: number): PenetrationLevel {
  const score = customers * 3 + sales * 5 + quotations * 2;
  if (score >= 10) return 'alto';
  if (score >= 5) return 'medio';
  if (score >= 1) return 'bajo';
  return 'sin_presencia';
}

export function generateMarketData(
  customers: MarketCustomer[],
  quotations: MarketQuotation[],
  orders: MarketOrder[],
  teamMembers: MarketTeamMember[],
  filterVendorId?: string,
): CityMarketData[] {
  const cityMap = new Map<string, CityMarketData>();

  const resolveVendor = (vendorId: string | null) => {
    if (!vendorId) return 'Sin asignar';
    return teamMembers.find(m => m.id === vendorId)?.name ?? vendorId;
  };

  // Build customer lookup
  const customerById = new Map(customers.map(c => [c.id, c]));

  // Filter customers by vendor if needed
  const filteredCustomers = filterVendorId
    ? customers.filter(c => c.vendor_id === filterVendorId)
    : customers;

  // Initialize with customer cities
  filteredCustomers.forEach(c => {
    if (!c.city) return;
    if (!cityMap.has(c.city)) {
      const coords = CITY_COORDS[c.city] ?? { lat: 23, lng: -102 };
      cityMap.set(c.city, {
        city: c.city,
        state: c.state ?? '',
        customers: 0, leads: 0, quotations: 0, openQuotations: 0,
        closedSales: 0, totalSalesValue: 0,
        vendors: [],
        penetration: 'sin_presencia',
        topProducts: [],
        opportunities: [],
        potentialValue: 0,
        priority: 'baja',
        lat: coords.lat,
        lng: coords.lng,
      });
    }
    const cd = cityMap.get(c.city)!;
    cd.customers++;
    cd.leads++;
    const vendorName = resolveVendor(c.vendor_id);
    if (!cd.vendors.includes(vendorName)) cd.vendors.push(vendorName);
  });

  // Add quotation data
  const productCounts: Record<string, Record<string, number>> = {};
  quotations.forEach(q => {
    if (!q.customer_id) return;
    const customer = customerById.get(q.customer_id);
    if (!customer) return;
    const cd = cityMap.get(customer.city);
    if (!cd) return;
    cd.quotations++;
    if (['enviada', 'seguimiento', 'vista', 'borrador'].includes(q.status)) {
      cd.openQuotations++;
      cd.potentialValue += q.total;
    }
    if (!productCounts[customer.city]) productCounts[customer.city] = {};
    const items = Array.isArray(q.items) ? q.items : [];
    items.forEach((item: any) => {
      const name = item.productName || item.product_name || 'Producto';
      const qty = item.qty || 1;
      productCounts[customer.city][name] = (productCounts[customer.city][name] || 0) + qty;
    });
  });

  // Add sales (orders) data
  orders.forEach(o => {
    if (!o.customer_id) return;
    const customer = customerById.get(o.customer_id);
    if (!customer) return;
    const cd = cityMap.get(customer.city);
    if (!cd) return;
    cd.closedSales++;
    cd.totalSalesValue += o.total;
    if (!productCounts[customer.city]) productCounts[customer.city] = {};
    const items = Array.isArray(o.items) ? o.items : [];
    items.forEach((item: any) => {
      const name = item.productName || item.product_name || 'Producto';
      const qty = item.qty || 1;
      productCounts[customer.city][name] = (productCounts[customer.city][name] || 0) + qty;
    });
  });

  // Finalize each city
  cityMap.forEach((cd, city) => {
    const pc = productCounts[city] ?? {};
    cd.topProducts = Object.entries(pc)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    cd.penetration = classifyPenetration(cd.customers, cd.closedSales, cd.quotations);

    if (cd.leads > 0 && cd.closedSales === 0) {
      cd.opportunities.push('Leads sin ventas cerradas');
    }
    if (cd.openQuotations > 0) {
      cd.opportunities.push(`${cd.openQuotations} cotización(es) no cerrada(s)`);
    }
    if (cd.customers > 0 && cd.customers < 3) {
      cd.opportunities.push('Pocos clientes — zona con potencial de crecimiento');
    }

    if (cd.penetration === 'sin_presencia' && cd.potentialValue > 0) cd.priority = 'media';
    if (cd.leads > 0 && cd.closedSales === 0) cd.priority = 'alta';
    if (cd.openQuotations > 0) cd.priority = 'alta';
    if (cd.penetration === 'alto') cd.priority = 'baja';
  });

  return Array.from(cityMap.values()).sort((a, b) => {
    const pOrder = { alta: 0, media: 1, baja: 2 };
    return pOrder[a.priority] - pOrder[b.priority] || b.potentialValue - a.potentialValue;
  });
}

// ─── Growth opportunities ────────────────────────────────────────
export interface GrowthOpportunity {
  city: string;
  state: string;
  leads: number;
  quotations: number;
  sales: number;
  potentialValue: number;
  priority: 'alta' | 'media' | 'baja';
  reasons: string[];
}

export function getGrowthOpportunities(data: CityMarketData[]): GrowthOpportunity[] {
  return data
    .filter(d => d.penetration !== 'alto')
    .map(d => ({
      city: d.city,
      state: d.state,
      leads: d.leads,
      quotations: d.quotations,
      sales: d.closedSales,
      potentialValue: d.potentialValue || 50000,
      priority: d.priority,
      reasons: d.opportunities,
    }))
    .sort((a, b) => {
      const pOrder = { alta: 0, media: 1, baja: 2 };
      return pOrder[a.priority] - pOrder[b.priority] || b.potentialValue - a.potentialValue;
    });
}

// ─── Market analytics ────────────────────────────────────────────
export function getMarketAnalytics(data: CityMarketData[]) {
  const withSales = [...data].filter(d => d.totalSalesValue > 0).sort((a, b) => b.totalSalesValue - a.totalSalesValue);
  const withLeads = [...data].filter(d => d.leads > 0).sort((a, b) => b.leads - a.leads);
  const lowPen = data.filter(d => d.penetration === 'bajo' || d.penetration === 'sin_presencia');
  const totalCities = data.length;
  const citiesWithPresence = data.filter(d => d.penetration !== 'sin_presencia').length;
  const totalSales = data.reduce((s, d) => s + d.totalSalesValue, 0);
  const totalPotential = data.reduce((s, d) => s + d.potentialValue, 0);

  return {
    topSalesCities: withSales.slice(0, 5),
    topLeadsCities: withLeads.slice(0, 5),
    lowPenetrationCities: lowPen,
    totalCities,
    citiesWithPresence,
    coverageRate: totalCities > 0 ? Math.round((citiesWithPresence / totalCities) * 100) : 0,
    totalSales,
    totalPotential,
  };
}
