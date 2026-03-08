/**
 * REDBUCK – Vendor KPIs Engine
 * Calculates sales KPIs per vendor using existing quotations, orders, customers, and receivables data.
 * Reuses demo-data + DB hooks data without duplicating logic.
 */

import type { DBQuotation } from '@/hooks/useQuotations';
import type { DBOrder } from '@/hooks/useOrders';
import type { DBCustomer } from '@/hooks/useCustomers';
import { demoUsers, demoAccountsReceivable } from '@/data/demo-data';

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
}

export interface VendorKPI {
  vendorId: string;
  vendorName: string;
  // Actual metrics
  sales: number;
  quotations: number;
  orders: number;
  closeRate: number; // pedidos / cotizaciones %
  avgTicket: number;
  pipeline: number; // open quotations total
  newCustomers: number;
  reactivatedCustomers: number;
  followups: number;
  collections: number; // cobranza
  // Goals
  goalSales: number;
  goalQuotations: number;
  goalOrders: number;
  goalNewCustomers: number;
  goalFollowups: number;
  // Progress %
  progressSales: number;
  progressQuotations: number;
  progressOrders: number;
  progressNewCustomers: number;
  progressFollowups: number;
}

// ─── Helpers ────────────────────────────────────────────────────
function inPeriod(dateStr: string, month: number, year: number): boolean {
  const d = new Date(dateStr);
  return d.getMonth() + 1 === month && d.getFullYear() === year;
}

function pct(actual: number, goal: number): number {
  return goal > 0 ? Math.round((actual / goal) * 100) : 0;
}

// Get vendor list from demo data
export function getVendors() {
  return demoUsers.filter(u => u.role === 'vendedor');
}

// ─── KPI Calculator ─────────────────────────────────────────────
export function calcVendorKPIs(
  vendorId: string,
  quotations: DBQuotation[],
  orders: DBOrder[],
  customers: DBCustomer[],
  goals: SalesGoal[],
  month: number,
  year: number,
): VendorKPI {
  const vendor = demoUsers.find(u => u.id === vendorId);
  const vendorName = vendor?.name ?? vendorId;

  // Filter by vendor
  const vQuotations = quotations.filter(q => q.vendor_id === vendorId && inPeriod(q.created_at, month, year));
  const vOrders = orders.filter(o => {
    // Match by vendor_name since orders store vendor_name not vendor_id
    return o.vendor_name === vendorName && inPeriod(o.created_at, month, year);
  });
  const vCustomers = customers.filter(c => c.vendor_id === vendorId);

  // Sales = sum of orders total (only non-cancelled)
  const activeOrders = vOrders.filter(o => o.status !== 'cancelado');
  const sales = activeOrders.reduce((s, o) => s + o.total, 0);

  // Quotations count
  const quotationCount = vQuotations.length;

  // Orders count
  const orderCount = activeOrders.length;

  // Close rate
  const closeRate = quotationCount > 0 ? (orderCount / quotationCount) * 100 : 0;

  // Average ticket
  const avgTicket = orderCount > 0 ? sales / orderCount : 0;

  // Pipeline: open quotations (borrador, enviada, vista, seguimiento)
  const openStatuses = ['borrador', 'enviada', 'vista', 'seguimiento'];
  const pipelineQuotations = quotations.filter(q =>
    q.vendor_id === vendorId && openStatuses.includes(q.status)
  );
  const pipeline = pipelineQuotations.reduce((s, q) => s + q.total, 0);

  // New customers this month
  const newCustomers = vCustomers.filter(c => inPeriod(c.created_at, month, year)).length;

  // Reactivated customers: customers who placed an order this month but had no orders in the previous 3 months
  const prevMonths = [1, 2, 3].map(delta => {
    let m = month - delta;
    let y = year;
    while (m <= 0) { m += 12; y--; }
    return { m, y };
  });
  const customersWithRecentOrders = new Set(
    orders
      .filter(o => o.vendor_name === vendorName && prevMonths.some(p => inPeriod(o.created_at, p.m, p.y)))
      .map(o => o.customer_name)
  );
  const thisMonthCustomers = new Set(activeOrders.map(o => o.customer_name));
  const reactivatedCustomers = [...thisMonthCustomers].filter(c => !customersWithRecentOrders.has(c)).length;

  // Followups: count quotations with status 'seguimiento' as proxy
  const followups = quotations.filter(q =>
    q.vendor_id === vendorId && q.status === 'seguimiento' && inPeriod(q.updated_at, month, year)
  ).length;

  // Collections from AR
  const vendorCustomerIds = new Set(vCustomers.map(c => c.id));
  const collections = demoAccountsReceivable
    .filter(ar => vendorCustomerIds.has(ar.customerId))
    .reduce((s, ar) => s + ar.paid, 0);

  // Goals for this vendor/month/year
  const goal = goals.find(g => g.vendor_id === vendorId && g.month === month && g.year === year);

  const goalSales = goal?.goal_sales ?? 0;
  const goalQuotations = goal?.goal_quotations ?? 0;
  const goalOrders = goal?.goal_orders ?? 0;
  const goalNewCustomers = goal?.goal_new_customers ?? 0;
  const goalFollowups = goal?.goal_followups ?? 0;

  return {
    vendorId,
    vendorName,
    sales,
    quotations: quotationCount,
    orders: orderCount,
    closeRate,
    avgTicket,
    pipeline,
    newCustomers,
    reactivatedCustomers,
    followups,
    collections,
    goalSales,
    goalQuotations,
    goalOrders,
    goalNewCustomers,
    goalFollowups,
    progressSales: pct(sales, goalSales),
    progressQuotations: pct(quotationCount, goalQuotations),
    progressOrders: pct(orderCount, goalOrders),
    progressNewCustomers: pct(newCustomers, goalNewCustomers),
    progressFollowups: pct(followups, goalFollowups),
  };
}

// ─── Calculate all vendors at once ──────────────────────────────
export function calcAllVendorKPIs(
  quotations: DBQuotation[],
  orders: DBOrder[],
  customers: DBCustomer[],
  goals: SalesGoal[],
  month: number,
  year: number,
): VendorKPI[] {
  const vendors = getVendors();
  return vendors
    .map(v => calcVendorKPIs(v.id, quotations, orders, customers, goals, month, year))
    .sort((a, b) => b.sales - a.sales);
}
