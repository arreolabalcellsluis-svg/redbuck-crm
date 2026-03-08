/**
 * REDBUCK – Vendor KPIs, Commissions & Score Engine
 * Calculates sales KPIs, intelligent commissions, and commercial score per vendor.
 * Reuses existing quotations, orders, customers, products, and receivables data.
 */

import type { DBQuotation } from '@/hooks/useQuotations';
import type { DBOrder } from '@/hooks/useOrders';
import type { DBCustomer } from '@/hooks/useCustomers';
import { demoUsers, demoProducts, demoAccountsReceivable } from '@/data/demo-data';

// ─── Types ──────────────────────────────────────────────────────
export interface SalesGoal {
  id: string;
  vendor_id: string;
  vendor_name: string;
  month: number;
  year: number;
  goal_sales: number;
  goal_quotations: number;
  goal_orders: number;
  goal_new_customers: number;
  goal_followups: number;
  goal_collections: number;
  goal_min_margin: number;
}

export interface CommissionConfig {
  baseRate: number; // %
  marginBonuses: { min_margin: number; bonus: number }[];
  goalBonuses: { min_pct: number; bonus: number }[];
  newCustomerBonus: number; // fixed $
  collectionBonusRate: number; // %
}

export interface ScoreWeights {
  sales: number;
  close_rate: number;
  margin: number;
  new_customers: number;
  collections: number;
  quotations: number;
  followups: number;
}

export interface ScoreLevel {
  min: number;
  label: string;
  color: string;
}

export interface CommissionBreakdown {
  baseSales: number;
  baseRate: number;
  baseAmount: number;
  marginAvg: number;
  marginBonusPct: number;
  marginBonusAmount: number;
  goalPct: number;
  goalBonusPct: number;
  goalBonusAmount: number;
  newCustomerCount: number;
  newCustomerBonusUnit: number;
  newCustomerBonusAmount: number;
  collectionAmount: number;
  collectionBonusRate: number;
  collectionBonusAmount: number;
  total: number;
}

export interface VendorKPI {
  vendorId: string;
  vendorName: string;
  // Actual metrics
  sales: number;
  quotations: number;
  orders: number;
  closeRate: number;
  avgTicket: number;
  pipeline: number;
  newCustomers: number;
  reactivatedCustomers: number;
  followups: number;
  collections: number;
  marginAvg: number;
  // Goals
  goalSales: number;
  goalQuotations: number;
  goalOrders: number;
  goalNewCustomers: number;
  goalFollowups: number;
  goalCollections: number;
  goalMinMargin: number;
  // Progress %
  progressSales: number;
  progressQuotations: number;
  progressOrders: number;
  progressNewCustomers: number;
  progressFollowups: number;
  progressCollections: number;
  // Commission
  commission: CommissionBreakdown;
  // Score
  score: number;
  scoreLabel: string;
  scoreColor: string;
}

// ─── Helpers ────────────────────────────────────────────────────
function inPeriod(dateStr: string, month: number, year: number): boolean {
  const d = new Date(dateStr);
  return d.getMonth() + 1 === month && d.getFullYear() === year;
}

function pct(actual: number, goal: number): number {
  return goal > 0 ? Math.round((actual / goal) * 100) : 0;
}

// Build a product cost lookup from demoProducts
const productCostMap = new Map(demoProducts.map(p => [p.name, p.cost]));
const productPriceMap = new Map(demoProducts.map(p => [p.name, p.listPrice]));

export function getVendors() {
  return demoUsers.filter(u => u.role === 'vendedor');
}

// ─── Default configs ────────────────────────────────────────────
export const DEFAULT_COMMISSION_CONFIG: CommissionConfig = {
  baseRate: 5,
  marginBonuses: [
    { min_margin: 20, bonus: 1 },
    { min_margin: 25, bonus: 2 },
    { min_margin: 30, bonus: 3 },
  ],
  goalBonuses: [
    { min_pct: 100, bonus: 3 },
    { min_pct: 120, bonus: 5 },
  ],
  newCustomerBonus: 500,
  collectionBonusRate: 1,
};

export const DEFAULT_SCORE_WEIGHTS: ScoreWeights = {
  sales: 30,
  close_rate: 15,
  margin: 15,
  new_customers: 10,
  collections: 15,
  quotations: 10,
  followups: 5,
};

export const DEFAULT_SCORE_LEVELS: ScoreLevel[] = [
  { min: 80, label: 'Excelente', color: 'green' },
  { min: 60, label: 'Muy bueno', color: 'blue' },
  { min: 40, label: 'Bueno', color: 'amber' },
  { min: 20, label: 'Regular', color: 'orange' },
  { min: 0, label: 'Bajo', color: 'red' },
];

// ─── Commission Calculator ─────────────────────────────────────
function calcCommission(
  sales: number,
  marginAvg: number,
  goalPct: number,
  newCustomers: number,
  collections: number,
  config: CommissionConfig,
): CommissionBreakdown {
  // Base
  const baseAmount = sales * (config.baseRate / 100);

  // Margin bonus - find highest qualifying tier
  const marginTier = [...config.marginBonuses]
    .sort((a, b) => b.min_margin - a.min_margin)
    .find(t => marginAvg >= t.min_margin);
  const marginBonusPct = marginTier?.bonus ?? 0;
  const marginBonusAmount = sales * (marginBonusPct / 100);

  // Goal bonus
  const goalTier = [...config.goalBonuses]
    .sort((a, b) => b.min_pct - a.min_pct)
    .find(t => goalPct >= t.min_pct);
  const goalBonusPct = goalTier?.bonus ?? 0;
  const goalBonusAmount = sales * (goalBonusPct / 100);

  // New customer bonus
  const newCustomerBonusAmount = newCustomers * config.newCustomerBonus;

  // Collection bonus
  const collectionBonusAmount = collections * (config.collectionBonusRate / 100);

  return {
    baseSales: sales,
    baseRate: config.baseRate,
    baseAmount,
    marginAvg,
    marginBonusPct,
    marginBonusAmount,
    goalPct,
    goalBonusPct,
    goalBonusAmount,
    newCustomerCount: newCustomers,
    newCustomerBonusUnit: config.newCustomerBonus,
    newCustomerBonusAmount,
    collectionAmount: collections,
    collectionBonusRate: config.collectionBonusRate,
    collectionBonusAmount,
    total: baseAmount + marginBonusAmount + goalBonusAmount + newCustomerBonusAmount + collectionBonusAmount,
  };
}

// ─── Score Calculator ───────────────────────────────────────────
function calcScore(
  kpi: { progressSales: number; closeRate: number; marginAvg: number; progressNewCustomers: number; progressCollections: number; progressQuotations: number; progressFollowups: number },
  weights: ScoreWeights,
  levels: ScoreLevel[],
): { score: number; label: string; color: string } {
  // Normalize each factor to 0-100
  const normalized = {
    sales: Math.min(kpi.progressSales, 150) / 1.5, // cap at 150% → 100
    close_rate: Math.min(kpi.closeRate, 100),
    margin: Math.min(kpi.marginAvg * 2.5, 100), // 40% margin → 100
    new_customers: Math.min(kpi.progressNewCustomers, 150) / 1.5,
    collections: Math.min(kpi.progressCollections, 150) / 1.5,
    quotations: Math.min(kpi.progressQuotations, 150) / 1.5,
    followups: Math.min(kpi.progressFollowups, 150) / 1.5,
  };

  const totalWeight = Object.values(weights).reduce((s, w) => s + w, 0);
  const score = totalWeight > 0
    ? (normalized.sales * weights.sales +
       normalized.close_rate * weights.close_rate +
       normalized.margin * weights.margin +
       normalized.new_customers * weights.new_customers +
       normalized.collections * weights.collections +
       normalized.quotations * weights.quotations +
       normalized.followups * weights.followups) / totalWeight
    : 0;

  const roundedScore = Math.round(score);
  const level = [...levels].sort((a, b) => b.min - a.min).find(l => roundedScore >= l.min)
    ?? { label: 'Sin datos', color: 'gray' };

  return { score: roundedScore, label: level.label, color: level.color };
}

// ─── Main KPI Calculator ───────────────────────────────────────
export function calcVendorKPIs(
  vendorId: string,
  quotations: DBQuotation[],
  orders: DBOrder[],
  customers: DBCustomer[],
  goals: SalesGoal[],
  month: number,
  year: number,
  commissionConfig: CommissionConfig = DEFAULT_COMMISSION_CONFIG,
  scoreWeights: ScoreWeights = DEFAULT_SCORE_WEIGHTS,
  scoreLevels: ScoreLevel[] = DEFAULT_SCORE_LEVELS,
): VendorKPI {
  const vendor = demoUsers.find(u => u.id === vendorId);
  const vendorName = vendor?.name ?? vendorId;

  // Filter by vendor
  const vQuotations = quotations.filter(q => q.vendor_id === vendorId && inPeriod(q.created_at, month, year));
  const vOrders = orders.filter(o => o.vendor_name === vendorName && inPeriod(o.created_at, month, year));
  const vCustomers = customers.filter(c => c.vendor_id === vendorId);

  // Sales
  const activeOrders = vOrders.filter(o => o.status !== 'cancelado');
  const sales = activeOrders.reduce((s, o) => s + o.total, 0);

  // Quotations & Orders count
  const quotationCount = vQuotations.length;
  const orderCount = activeOrders.length;
  const closeRate = quotationCount > 0 ? (orderCount / quotationCount) * 100 : 0;
  const avgTicket = orderCount > 0 ? sales / orderCount : 0;

  // Pipeline
  const openStatuses = ['borrador', 'enviada', 'vista', 'seguimiento'];
  const pipeline = quotations
    .filter(q => q.vendor_id === vendorId && openStatuses.includes(q.status))
    .reduce((s, q) => s + q.total, 0);

  // New customers
  const newCustomers = vCustomers.filter(c => inPeriod(c.created_at, month, year)).length;

  // Reactivated
  const prevMonths = [1, 2, 3].map(delta => {
    let m = month - delta;
    let y = year;
    while (m <= 0) { m += 12; y--; }
    return { m, y };
  });
  const recentOrderCustomers = new Set(
    orders
      .filter(o => o.vendor_name === vendorName && prevMonths.some(p => inPeriod(o.created_at, p.m, p.y)))
      .map(o => o.customer_name)
  );
  const thisMonthCustomers = new Set(activeOrders.map(o => o.customer_name));
  const reactivatedCustomers = [...thisMonthCustomers].filter(c => !recentOrderCustomers.has(c)).length;

  // Followups
  const followups = quotations.filter(q =>
    q.vendor_id === vendorId && q.status === 'seguimiento' && inPeriod(q.updated_at, month, year)
  ).length;

  // Collections
  const vendorCustomerIds = new Set(vCustomers.map(c => c.id));
  const collections = demoAccountsReceivable
    .filter(ar => vendorCustomerIds.has(ar.customerId))
    .reduce((s, ar) => s + ar.paid, 0);

  // Margin - calculate from order items using product cost lookup
  let totalCost = 0;
  let totalRevenue = 0;
  activeOrders.forEach(o => {
    o.items.forEach((item: any) => {
      const cost = productCostMap.get(item.productName) ?? 0;
      const price = item.unitPrice ?? productPriceMap.get(item.productName) ?? 0;
      const qty = item.qty ?? 1;
      totalCost += cost * qty;
      totalRevenue += price * qty;
    });
  });
  const marginAvg = totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue) * 100 : 0;

  // Goals
  const goal = goals.find(g => g.vendor_id === vendorId && g.month === month && g.year === year);
  const goalSales = goal?.goal_sales ?? 0;
  const goalQuotations = goal?.goal_quotations ?? 0;
  const goalOrders = goal?.goal_orders ?? 0;
  const goalNewCustomers = goal?.goal_new_customers ?? 0;
  const goalFollowups = goal?.goal_followups ?? 0;
  const goalCollections = goal?.goal_collections ?? 0;
  const goalMinMargin = goal?.goal_min_margin ?? 0;

  const progressSales = pct(sales, goalSales);
  const progressQuotations = pct(quotationCount, goalQuotations);
  const progressOrders = pct(orderCount, goalOrders);
  const progressNewCustomers = pct(newCustomers, goalNewCustomers);
  const progressFollowups = pct(followups, goalFollowups);
  const progressCollections = pct(collections, goalCollections);

  // Commission
  const commission = calcCommission(sales, marginAvg, progressSales, newCustomers, collections, commissionConfig);

  // Score
  const { score, label: scoreLabel, color: scoreColor } = calcScore(
    { progressSales, closeRate, marginAvg, progressNewCustomers, progressCollections, progressQuotations, progressFollowups },
    scoreWeights,
    scoreLevels,
  );

  return {
    vendorId, vendorName,
    sales, quotations: quotationCount, orders: orderCount,
    closeRate, avgTicket, pipeline, newCustomers, reactivatedCustomers,
    followups, collections, marginAvg,
    goalSales, goalQuotations, goalOrders, goalNewCustomers, goalFollowups,
    goalCollections, goalMinMargin,
    progressSales, progressQuotations, progressOrders,
    progressNewCustomers, progressFollowups, progressCollections,
    commission, score, scoreLabel, scoreColor,
  };
}

// ─── Calculate all vendors ─────────────────────────────────────
export function calcAllVendorKPIs(
  quotations: DBQuotation[],
  orders: DBOrder[],
  customers: DBCustomer[],
  goals: SalesGoal[],
  month: number,
  year: number,
  commissionConfig?: CommissionConfig,
  scoreWeights?: ScoreWeights,
  scoreLevels?: ScoreLevel[],
): VendorKPI[] {
  return getVendors()
    .map(v => calcVendorKPIs(v.id, quotations, orders, customers, goals, month, year, commissionConfig, scoreWeights, scoreLevels))
    .sort((a, b) => b.sales - a.sales);
}

// ─── Alerts Generator ───────────────────────────────────────────
export interface VendorAlert {
  vendorName: string;
  type: 'danger' | 'warning' | 'info';
  message: string;
}

export function generateAlerts(kpis: VendorKPI[]): VendorAlert[] {
  const alerts: VendorAlert[] = [];
  kpis.forEach(k => {
    if (k.goalSales > 0 && k.progressSales < 50) alerts.push({ vendorName: k.vendorName, type: 'danger', message: `Por debajo del 50% de meta de ventas (${k.progressSales}%)` });
    if (k.closeRate < 20 && k.quotations >= 3) alerts.push({ vendorName: k.vendorName, type: 'warning', message: `Baja tasa de cierre: ${k.closeRate.toFixed(0)}%` });
    if (k.marginAvg > 0 && k.marginAvg < 15) alerts.push({ vendorName: k.vendorName, type: 'warning', message: `Margen bajo: ${k.marginAvg.toFixed(1)}%` });
    if (k.goalCollections > 0 && k.progressCollections < 40) alerts.push({ vendorName: k.vendorName, type: 'warning', message: `Cobranza baja: ${k.progressCollections}% de meta` });
    if (k.quotations === 0) alerts.push({ vendorName: k.vendorName, type: 'info', message: 'Sin cotizaciones en el período' });
    if (k.score < 30 && k.goalSales > 0) alerts.push({ vendorName: k.vendorName, type: 'danger', message: `Score comercial bajo: ${k.score}/100` });
  });
  return alerts;
}
