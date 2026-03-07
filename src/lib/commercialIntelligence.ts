/**
 * Commercial Intelligence Engine for Executive Dashboard
 * Computes opportunity money, vendor performance, recoverable money,
 * growth radar, upgrade-ready clients, and cross-sell opportunities.
 */
import {
  demoCustomers, demoOpportunities, demoQuotations, demoOrders,
  demoProducts, demoUsers, salesByVendor,
} from '@/data/demo-data';

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);

// ─── Cross-sell rules ────────────────────────────────────────────
const CROSS_SELL_RULES: Record<string, { suggest: string; category: string }[]> = {
  balanceadoras: [
    { suggest: 'Desmontadora Automática 24"', category: 'desmontadoras' },
    { suggest: 'Compresor 5 HP 235L', category: 'aire' },
  ],
  desmontadoras: [
    { suggest: 'Balanceadora Automática', category: 'balanceadoras' },
    { suggest: 'Compresor 5 HP 235L', category: 'aire' },
  ],
  elevadores: [
    { suggest: 'Alineadora 3D', category: 'alineadoras' },
    { suggest: 'Prensa Hidráulica 20 Ton', category: 'hidraulico' },
  ],
  alineadoras: [
    { suggest: 'Elevador 4 Postes 4 Ton', category: 'elevadores' },
  ],
  hidraulico: [
    { suggest: 'Compresor 5 HP 235L', category: 'aire' },
  ],
  aire: [
    { suggest: 'Sistema de Lubricación Neumático', category: 'lubricacion' },
  ],
};

// ─── Workshop upgrade path ───────────────────────────────────────
const WORKSHOP_LEVELS = [
  { level: 'Básico', products: ['hidraulico', 'aire'], next: 'Balanceadora Semiautomática', nextValue: 28000 },
  { level: 'Semi-equipado', products: ['balanceadoras', 'desmontadoras'], next: 'Elevador 2 Postes 4.5 Ton', nextValue: 75000 },
  { level: 'Equipado', products: ['elevadores'], next: 'Alineadora 3D', nextValue: 185000 },
  { level: 'Premium', products: ['alineadoras'], next: 'Elevador Tijera 3 Ton', nextValue: 65000 },
];

function resolveVendor(vendorId: string) {
  return demoUsers.find(u => u.id === vendorId)?.name ?? vendorId;
}

function getCustomerPurchasedCategories(customerId: string): string[] {
  const cats = new Set<string>();
  // From orders
  demoOrders.filter(o => o.customerId === customerId).forEach(o => {
    o.items.forEach(item => {
      const product = demoProducts.find(p => p.name === item.productName);
      if (product) cats.add(product.category);
    });
  });
  // From accepted quotations
  demoQuotations.filter(q => q.customerId === customerId && q.status === 'aceptada').forEach(q => {
    q.items.forEach(item => {
      const product = demoProducts.find(p => p.id === item.productId);
      if (product) cats.add(product.category);
    });
  });
  return Array.from(cats);
}

function getCustomerPurchasedProductNames(customerId: string): string[] {
  const names = new Set<string>();
  demoOrders.filter(o => o.customerId === customerId).forEach(o => {
    o.items.forEach(item => names.add(item.productName));
  });
  return Array.from(names);
}

// ─── 1. DINERO EN OPORTUNIDADES ─────────────────────────────────
export interface OpportunityMoney {
  openQuotationsValue: number;
  openQuotationsCount: number;
  hotQuotationsValue: number;
  hotQuotationsCount: number;
  restockOpportunitiesValue: number;
  restockOpportunitiesCount: number;
  crossSellValue: number;
  crossSellCount: number;
  upgradeReadyValue: number;
  upgradeReadyCount: number;
  noFollowUpValue: number;
  noFollowUpCount: number;
}

export function getOpportunityMoney(): OpportunityMoney {
  const openStatuses = ['enviada', 'seguimiento', 'borrador', 'vista'] as const;
  const hotStatuses = ['seguimiento', 'vista'] as const;

  const openQuotations = demoQuotations.filter(q => openStatuses.includes(q.status as any));
  const hotQuotations = demoQuotations.filter(q => hotStatuses.includes(q.status as any));

  // Restock: opportunities from products that customers have bought before
  const restockOpps = demoOpportunities.filter(o => {
    const cats = getCustomerPurchasedCategories(o.customerId);
    return o.products.some(p => {
      const prod = demoProducts.find(pr => pr.name.includes(p.split(' ')[0]));
      return prod && cats.includes(prod.category);
    });
  });

  // Cross-sell
  const crossSellItems = getCrossSellOpportunities();

  // Upgrade ready
  const upgradeItems = getUpgradeReadyClients();

  // No follow-up: quotations sent but no recent activity
  const noFollowUp = demoQuotations.filter(q => q.status === 'enviada' || q.status === 'borrador');

  return {
    openQuotationsValue: openQuotations.reduce((s, q) => s + q.total, 0),
    openQuotationsCount: openQuotations.length,
    hotQuotationsValue: hotQuotations.reduce((s, q) => s + q.total, 0),
    hotQuotationsCount: hotQuotations.length,
    restockOpportunitiesValue: restockOpps.reduce((s, o) => s + o.estimatedAmount, 0),
    restockOpportunitiesCount: restockOpps.length,
    crossSellValue: crossSellItems.reduce((s, c) => s + c.estimatedValue, 0),
    crossSellCount: crossSellItems.length,
    upgradeReadyValue: upgradeItems.reduce((s, u) => s + u.estimatedValue, 0),
    upgradeReadyCount: upgradeItems.length,
    noFollowUpValue: noFollowUp.reduce((s, q) => s + q.total, 0),
    noFollowUpCount: noFollowUp.length,
  };
}

// ─── 2. RENDIMIENTO DE VENDEDORES ───────────────────────────────
export interface VendorPerformance {
  name: string;
  totalSales: number;
  quotationCount: number;
  wonCount: number;
  closeRate: number;
}

export function getVendorPerformance(): VendorPerformance[] {
  const vendors = demoUsers.filter(u => u.role === 'vendedor');
  return vendors.map(v => {
    const sales = salesByVendor.find(s => s.name.startsWith(v.name.split(' ')[0]))?.sales ?? 0;
    const quotations = demoQuotations.filter(q => q.vendorId === v.id || q.vendorName === v.name);
    const wonQuotations = quotations.filter(q => q.status === 'aceptada');
    const allQuotations = quotations.length || 1;
    return {
      name: v.name,
      totalSales: sales,
      quotationCount: quotations.length,
      wonCount: wonQuotations.length,
      closeRate: Math.round((wonQuotations.length / allQuotations) * 100),
    };
  }).sort((a, b) => b.totalSales - a.totalSales);
}

// ─── 3. DINERO RECUPERABLE ──────────────────────────────────────
export interface RecoverableItem {
  id: string;
  name: string;
  value: number;
  detail: string;
}

export interface RecoverableMoney {
  noFollowUpValue: number;
  noFollowUpCount: number;
  noFollowUpTop: RecoverableItem[];
  inactiveClientsValue: number;
  inactiveClientsCount: number;
  inactiveClientsTop: RecoverableItem[];
  restockValue: number;
  restockCount: number;
  restockTop: RecoverableItem[];
}

export function getRecoverableMoney(): RecoverableMoney {
  // Quotations without follow-up
  const noFollowUp = demoQuotations
    .filter(q => q.status === 'enviada' || q.status === 'borrador')
    .map(q => ({ id: q.id, name: q.customerName, value: q.total, detail: `Folio: ${q.folio} — ${q.status}` }))
    .sort((a, b) => b.value - a.value);

  // Inactive clients: have no open opportunities or recent quotations
  const activeCustomerIds = new Set([
    ...demoOpportunities.filter(o => o.stage !== 'cierre_perdido').map(o => o.customerId),
    ...demoQuotations.filter(q => ['enviada', 'seguimiento', 'vista'].includes(q.status)).map(q => q.customerId),
  ]);
  const inactiveClients = demoCustomers
    .filter(c => !activeCustomerIds.has(c.id))
    .map(c => {
      const lastOrder = demoOrders.filter(o => o.customerId === c.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
      return {
        id: c.id,
        name: c.name,
        value: lastOrder ? lastOrder.total : 50000, // estimated reactivation value
        detail: `${c.city} — ${resolveVendor(c.vendorId)}`,
      };
    })
    .sort((a, b) => b.value - a.value);

  // Restock opportunities
  const restockOpps = demoOpportunities
    .filter(o => o.stage !== 'cierre_ganado' && o.stage !== 'cierre_perdido')
    .map(o => ({ id: o.id, name: o.customerName, value: o.estimatedAmount, detail: o.products.join(', ') }))
    .sort((a, b) => b.value - a.value);

  return {
    noFollowUpValue: noFollowUp.reduce((s, i) => s + i.value, 0),
    noFollowUpCount: noFollowUp.length,
    noFollowUpTop: noFollowUp.slice(0, 5),
    inactiveClientsValue: inactiveClients.reduce((s, i) => s + i.value, 0),
    inactiveClientsCount: inactiveClients.length,
    inactiveClientsTop: inactiveClients.slice(0, 5),
    restockValue: restockOpps.reduce((s, i) => s + i.value, 0),
    restockCount: restockOpps.length,
    restockTop: restockOpps.slice(0, 5),
  };
}

// ─── 4. RADAR DE CRECIMIENTO ────────────────────────────────────
export interface GrowthRadarItem {
  customerId: string;
  customerName: string;
  city: string;
  vendorName: string;
  opportunityType: 'upgrade' | 'cross_sell' | 'recent_interest';
  suggestedProduct: string;
  score: number;
  lastActivity: string;
}

export function getGrowthRadar(): GrowthRadarItem[] {
  const items: GrowthRadarItem[] = [];

  // Upgrade ready
  getUpgradeReadyClients().forEach(u => {
    items.push({
      customerId: u.customerId,
      customerName: u.customerName,
      city: u.city,
      vendorName: u.vendorName,
      opportunityType: 'upgrade',
      suggestedProduct: u.nextProduct,
      score: u.score,
      lastActivity: u.lastActivity,
    });
  });

  // Cross-sell
  getCrossSellOpportunities().forEach(c => {
    items.push({
      customerId: c.customerId,
      customerName: c.customerName,
      city: c.city,
      vendorName: c.vendorName,
      opportunityType: 'cross_sell',
      suggestedProduct: c.suggestedProduct,
      score: c.score,
      lastActivity: c.lastActivity,
    });
  });

  // Recent interest (open opportunities)
  demoOpportunities
    .filter(o => o.stage !== 'cierre_ganado' && o.stage !== 'cierre_perdido')
    .forEach(o => {
      const customer = demoCustomers.find(c => c.id === o.customerId);
      if (!customer || items.some(i => i.customerId === o.customerId && i.opportunityType === 'recent_interest')) return;
      items.push({
        customerId: o.customerId,
        customerName: o.customerName,
        city: customer.city,
        vendorName: o.vendorName,
        opportunityType: 'recent_interest',
        suggestedProduct: o.products[0],
        score: o.probability,
        lastActivity: o.createdAt,
      });
    });

  return items.sort((a, b) => b.score - a.score);
}

// ─── 5. CLIENTES LISTOS PARA CRECER ────────────────────────────
export interface UpgradeReadyClient {
  customerId: string;
  customerName: string;
  city: string;
  vendorName: string;
  currentLevel: string;
  nextProduct: string;
  estimatedValue: number;
  score: number;
  lastActivity: string;
}

export function getUpgradeReadyClients(): UpgradeReadyClient[] {
  const results: UpgradeReadyClient[] = [];

  demoCustomers.forEach(c => {
    const cats = getCustomerPurchasedCategories(c.id);
    if (cats.length === 0) return;

    // Determine current level
    let currentLevelIdx = -1;
    WORKSHOP_LEVELS.forEach((level, idx) => {
      if (level.products.some(p => cats.includes(p))) {
        currentLevelIdx = Math.max(currentLevelIdx, idx);
      }
    });

    if (currentLevelIdx >= 0 && currentLevelIdx < WORKSHOP_LEVELS.length - 1) {
      const nextLevel = WORKSHOP_LEVELS[currentLevelIdx + 1];
      // Check if customer already has next level products
      if (!nextLevel.products.some(p => cats.includes(p))) {
        const lastOrder = demoOrders.filter(o => o.customerId === c.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
        results.push({
          customerId: c.id,
          customerName: c.name,
          city: c.city,
          vendorName: resolveVendor(c.vendorId),
          currentLevel: WORKSHOP_LEVELS[currentLevelIdx].level,
          nextProduct: nextLevel.next,
          estimatedValue: nextLevel.nextValue,
          score: Math.min(95, 60 + cats.length * 10 + (c.priority === 'alta' ? 15 : c.priority === 'media' ? 5 : 0)),
          lastActivity: lastOrder?.createdAt ?? c.createdAt,
        });
      }
    }
  });

  return results.sort((a, b) => b.score - a.score);
}

// ─── 6. VENTA CRUZADA ───────────────────────────────────────────
export interface CrossSellItem {
  customerId: string;
  customerName: string;
  city: string;
  vendorName: string;
  purchasedProduct: string;
  suggestedProduct: string;
  estimatedValue: number;
  priority: 'alta' | 'media' | 'baja';
  score: number;
  lastActivity: string;
}

export function getCrossSellOpportunities(): CrossSellItem[] {
  const results: CrossSellItem[] = [];
  const seen = new Set<string>();

  demoCustomers.forEach(c => {
    const cats = getCustomerPurchasedCategories(c.id);
    const purchasedNames = getCustomerPurchasedProductNames(c.id);

    cats.forEach(cat => {
      const rules = CROSS_SELL_RULES[cat];
      if (!rules) return;

      rules.forEach(rule => {
        // Skip if customer already has this category
        if (cats.includes(rule.category)) return;
        const key = `${c.id}-${rule.suggest}`;
        if (seen.has(key)) return;
        seen.add(key);

        const product = demoProducts.find(p => p.name === rule.suggest);
        const lastOrder = demoOrders.filter(o => o.customerId === c.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

        results.push({
          customerId: c.id,
          customerName: c.name,
          city: c.city,
          vendorName: resolveVendor(c.vendorId),
          purchasedProduct: purchasedNames[0] ?? cat,
          suggestedProduct: rule.suggest,
          estimatedValue: product?.listPrice ?? 30000,
          priority: c.priority,
          score: c.priority === 'alta' ? 85 : c.priority === 'media' ? 65 : 45,
          lastActivity: lastOrder?.createdAt ?? c.createdAt,
        });
      });
    });
  });

  return results.sort((a, b) => b.score - a.score);
}
