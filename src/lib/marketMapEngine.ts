/**
 * Market Map Engine — Aggregates CRM data by city for geographic market analysis.
 */
import {
  demoCustomers, demoOpportunities, demoQuotations, demoOrders, demoUsers,
} from '@/data/demo-data';

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
  // Map coordinates (approximate for Mexico cities)
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
  'Ciudad Juárez': { lat: 31.69, lng: -106.42 },
  'Saltillo': { lat: 25.42, lng: -100.99 },
  'Nuevo Laredo': { lat: 27.48, lng: -99.52 },
  'Mazatlán': { lat: 23.24, lng: -106.44 },
  'León': { lat: 21.12, lng: -101.68 },
  'Cuernavaca': { lat: 18.92, lng: -99.23 },
  'Querétaro': { lat: 20.59, lng: -100.39 },
  // Additional potential cities (no customers yet)
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
};

// States for potential cities
const CITY_STATES: Record<string, string> = {
  'Puebla': 'Puebla',
  'Mérida': 'Yucatán',
  'Tijuana': 'Baja California',
  'Aguascalientes': 'Aguascalientes',
  'Hermosillo': 'Sonora',
  'Chihuahua': 'Chihuahua',
  'Toluca': 'Estado de México',
  'Veracruz': 'Veracruz',
  'Cancún': 'Quintana Roo',
  'Tampico': 'Tamaulipas',
  'San Luis Potosí': 'San Luis Potosí',
  'Morelia': 'Michoacán',
  'Villahermosa': 'Tabasco',
  'Tuxtla Gutiérrez': 'Chiapas',
  'Oaxaca': 'Oaxaca',
  'Durango': 'Durango',
  'Reynosa': 'Tamaulipas',
};

function resolveVendor(vendorId: string) {
  return demoUsers.find(u => u.id === vendorId)?.name ?? vendorId;
}

function classifyPenetration(customers: number, sales: number, quotations: number): PenetrationLevel {
  const score = customers * 3 + sales * 5 + quotations * 2;
  if (score >= 10) return 'alto';
  if (score >= 5) return 'medio';
  if (score >= 1) return 'bajo';
  return 'sin_presencia';
}

export function generateMarketData(filterVendorId?: string): CityMarketData[] {
  // Collect all cities from customers
  const cityMap = new Map<string, CityMarketData>();

  // Filter customers by vendor if provided
  const customers = filterVendorId
    ? demoCustomers.filter(c => c.vendorId === filterVendorId)
    : demoCustomers;

  // Initialize with customer cities
  customers.forEach(c => {
    if (!cityMap.has(c.city)) {
      const coords = CITY_COORDS[c.city] ?? { lat: 23, lng: -102 };
      cityMap.set(c.city, {
        city: c.city,
        state: c.state ?? '',
        customers: 0,
        leads: 0,
        quotations: 0,
        openQuotations: 0,
        closedSales: 0,
        totalSalesValue: 0,
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
    const vendorName = resolveVendor(c.vendorId);
    if (!cd.vendors.includes(vendorName)) cd.vendors.push(vendorName);
  });

  // Add quotation data
  const productCounts: Record<string, Record<string, number>> = {};
  demoQuotations.forEach(q => {
    const customer = demoCustomers.find(c => c.id === q.customerId);
    if (!customer) return;
    const cd = cityMap.get(customer.city);
    if (!cd) return;
    cd.quotations++;
    if (['enviada', 'seguimiento', 'vista', 'borrador'].includes(q.status)) {
      cd.openQuotations++;
      cd.potentialValue += q.total;
    }
    if (!productCounts[customer.city]) productCounts[customer.city] = {};
    q.items.forEach(item => {
      productCounts[customer.city][item.productName] = (productCounts[customer.city][item.productName] || 0) + item.qty;
    });
  });

  // Add sales (orders) data
  demoOrders.forEach(o => {
    const customer = demoCustomers.find(c => c.id === o.customerId);
    if (!customer) return;
    const cd = cityMap.get(customer.city);
    if (!cd) return;
    cd.closedSales++;
    cd.totalSalesValue += o.total;
    if (!productCounts[customer.city]) productCounts[customer.city] = {};
    o.items.forEach(item => {
      productCounts[customer.city][item.productName] = (productCounts[customer.city][item.productName] || 0) + item.qty;
    });
  });

  // Add won opportunities to sales count
  demoOpportunities.filter(o => o.stage === 'cierre_ganado').forEach(o => {
    const customer = demoCustomers.find(c => c.id === o.customerId);
    if (!customer) return;
    const cd = cityMap.get(customer.city);
    if (cd) cd.totalSalesValue += o.estimatedAmount;
  });

  // Add potential market cities (without customers)
  const potentialCities = [
    'Puebla', 'Mérida', 'Tijuana', 'Aguascalientes', 'Hermosillo',
    'Toluca', 'Veracruz', 'Cancún', 'Tampico', 'San Luis Potosí',
    'Morelia', 'Villahermosa', 'Durango', 'Reynosa',
  ];
  potentialCities.forEach(city => {
    if (!cityMap.has(city)) {
      const coords = CITY_COORDS[city] ?? { lat: 23, lng: -102 };
      cityMap.set(city, {
        city,
        state: CITY_STATES[city] ?? '',
        customers: 0, leads: 0, quotations: 0, openQuotations: 0,
        closedSales: 0, totalSalesValue: 0,
        vendors: [],
        penetration: 'sin_presencia',
        topProducts: [],
        opportunities: ['Ciudad sin presencia comercial — mercado potencial'],
        potentialValue: 80000, // estimated
        priority: 'media',
        lat: coords.lat,
        lng: coords.lng,
      });
    }
  });

  // Finalize each city
  cityMap.forEach((cd, city) => {
    // Top products
    const pc = productCounts[city] ?? {};
    cd.topProducts = Object.entries(pc)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Penetration
    cd.penetration = classifyPenetration(cd.customers, cd.closedSales, cd.quotations);

    // Detect opportunities
    if (cd.leads > 0 && cd.closedSales === 0) {
      cd.opportunities.push('Leads sin ventas cerradas');
    }
    if (cd.openQuotations > 0) {
      cd.opportunities.push(`${cd.openQuotations} cotización(es) no cerrada(s)`);
    }
    if (cd.customers > 0 && cd.customers < 3) {
      cd.opportunities.push('Pocos clientes — zona con potencial de crecimiento');
    }

    // Priority
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
