/**
 * REDBUCK – Role-Based Commission Engine
 * Calculates commissions/bonuses for: Vendedor, Gerente Comercial, Cobranza, Administración.
 * Reuses vendorKPIsEngine for vendor calculations.
 */

import {
  calcAllVendorKPIs, getVendors, generateAlerts,
  type VendorKPI, type CommissionConfig, type ScoreWeights, type ScoreLevel,
  DEFAULT_COMMISSION_CONFIG, DEFAULT_SCORE_WEIGHTS, DEFAULT_SCORE_LEVELS,
} from './vendorKPIsEngine';
import type { DBQuotation } from '@/hooks/useQuotations';
import type { DBOrder } from '@/hooks/useOrders';
import type { DBCustomer } from '@/hooks/useCustomers';
import type { SalesGoal } from './vendorKPIsEngine';
import { demoUsers, demoAccountsReceivable } from '@/data/demo-data';

// ─── Role Commission Config ────────────────────────────────────
export interface RoleCommissionConfig {
  gerente: GerenteConfig;
  cobranza: CobranzaConfig;
  administracion: AdminConfig;
  penalties: PenaltyConfig;
}

export interface GerenteConfig {
  enabled: boolean;
  teamGoalBonuses: { min_pct: number; bonus: number }[]; // escalated
  marginBonusPct: number; // % of team sales if team margin > threshold
  marginThreshold: number;
  collectionBonusPct: number;
  collectionThreshold: number; // min % collected
  baseBonusAmount: number; // fixed base
}

export interface CobranzaConfig {
  enabled: boolean;
  collectedBonusRate: number; // % of amount collected
  overdueRecoveryBonusRate: number; // % of overdue recovered
  goalBonuses: { min_pct: number; bonus: number }[]; // % goal -> fixed bonus
}

export interface AdminConfig {
  enabled: boolean;
  orderProcessedBonus: number; // per order processed
  efficiencyBonusPct: number; // % of total sales if targets met
  globalGoalBonuses: { min_pct: number; bonus: number }[];
}

export interface PenaltyConfig {
  lowMarginThreshold: number; // min margin %, below = penalty
  lowMarginPenaltyPct: number; // % reduction
  highCancellationThreshold: number; // # of cancellations
  highCancellationPenaltyPct: number;
  uncollectedThreshold: number; // % uncollected above this = penalty
  uncollectedPenaltyPct: number;
}

export const DEFAULT_ROLE_CONFIG: RoleCommissionConfig = {
  gerente: {
    enabled: true,
    teamGoalBonuses: [
      { min_pct: 90, bonus: 5000 },
      { min_pct: 100, bonus: 10000 },
      { min_pct: 110, bonus: 15000 },
      { min_pct: 120, bonus: 25000 },
    ],
    marginBonusPct: 0.5,
    marginThreshold: 25,
    collectionBonusPct: 0.3,
    collectionThreshold: 80,
    baseBonusAmount: 3000,
  },
  cobranza: {
    enabled: true,
    collectedBonusRate: 0.5,
    overdueRecoveryBonusRate: 1.5,
    goalBonuses: [
      { min_pct: 80, bonus: 2000 },
      { min_pct: 100, bonus: 5000 },
      { min_pct: 120, bonus: 8000 },
    ],
  },
  administracion: {
    enabled: true,
    orderProcessedBonus: 50,
    efficiencyBonusPct: 0.2,
    globalGoalBonuses: [
      { min_pct: 90, bonus: 2000 },
      { min_pct: 100, bonus: 4000 },
      { min_pct: 110, bonus: 6000 },
    ],
  },
  penalties: {
    lowMarginThreshold: 15,
    lowMarginPenaltyPct: 20,
    highCancellationThreshold: 3,
    highCancellationPenaltyPct: 10,
    uncollectedThreshold: 50,
    uncollectedPenaltyPct: 15,
  },
};

// ─── Result Types ───────────────────────────────────────────────
export interface RoleCommissionResult {
  role: string;
  roleName: string;
  userName: string;
  kpis: Record<string, number | string>;
  bonuses: { label: string; amount: number; detail: string }[];
  penalties: { label: string; amount: number; detail: string }[];
  grossTotal: number;
  penaltyTotal: number;
  netTotal: number;
}

export interface ExecutiveSummary {
  totalVendorCommissions: number;
  totalGerenteBonus: number;
  totalCobranzaBonus: number;
  totalAdminBonus: number;
  grandTotal: number;
  totalSales: number;
  totalGrossProfit: number;
  commissionToSalesRatio: number;
  commissionToProfitRatio: number;
}

// ─── Gerente Comercial Calculation ──────────────────────────────
export function calcGerenteCommission(
  vendorKPIs: VendorKPI[],
  config: GerenteConfig,
): RoleCommissionResult {
  const gerente = demoUsers.find(u => u.role === 'gerencia_comercial');

  const teamSales = vendorKPIs.reduce((s, k) => s + k.sales, 0);
  const teamGoal = vendorKPIs.reduce((s, k) => s + k.goalSales, 0);
  const teamPct = teamGoal > 0 ? Math.round((teamSales / teamGoal) * 100) : 0;
  const teamOrders = vendorKPIs.reduce((s, k) => s + k.orders, 0);
  const teamQuotations = vendorKPIs.reduce((s, k) => s + k.quotations, 0);
  const teamCloseRate = teamQuotations > 0 ? (teamOrders / teamQuotations) * 100 : 0;
  const teamMargin = vendorKPIs.length > 0
    ? vendorKPIs.reduce((s, k) => s + k.marginAvg, 0) / vendorKPIs.length : 0;
  const teamCollections = vendorKPIs.reduce((s, k) => s + k.collections, 0);
  const teamNewCustomers = vendorKPIs.reduce((s, k) => s + k.newCustomers, 0);
  const teamScore = vendorKPIs.length > 0
    ? Math.round(vendorKPIs.reduce((s, k) => s + k.score, 0) / vendorKPIs.length) : 0;
  const collectionPct = teamSales > 0 ? (teamCollections / teamSales) * 100 : 0;

  const bonuses: RoleCommissionResult['bonuses'] = [];

  // Base
  bonuses.push({ label: 'Bono base', amount: config.baseBonusAmount, detail: 'Fijo mensual' });

  // Team goal
  const goalTier = [...config.teamGoalBonuses]
    .sort((a, b) => b.min_pct - a.min_pct)
    .find(t => teamPct >= t.min_pct);
  if (goalTier) {
    bonuses.push({
      label: 'Bono cumplimiento equipo',
      amount: goalTier.bonus,
      detail: `Equipo al ${teamPct}% de meta (nivel ≥${goalTier.min_pct}%)`,
    });
  }

  // Margin bonus
  if (teamMargin >= config.marginThreshold) {
    const amount = teamSales * (config.marginBonusPct / 100);
    bonuses.push({
      label: 'Bono margen equipo',
      amount,
      detail: `Margen ${teamMargin.toFixed(1)}% ≥ ${config.marginThreshold}% (${config.marginBonusPct}% de ventas)`,
    });
  }

  // Collection bonus
  if (collectionPct >= config.collectionThreshold) {
    const amount = teamCollections * (config.collectionBonusPct / 100);
    bonuses.push({
      label: 'Bono cobranza equipo',
      amount,
      detail: `Cobranza ${collectionPct.toFixed(0)}% ≥ ${config.collectionThreshold}% (${config.collectionBonusPct}% de cobrado)`,
    });
  }

  const grossTotal = bonuses.reduce((s, b) => s + b.amount, 0);

  return {
    role: 'gerente_comercial',
    roleName: 'Gerente Comercial',
    userName: gerente?.name ?? 'Gerente Comercial',
    kpis: {
      'Ventas equipo': teamSales,
      'Meta equipo': teamGoal,
      'Cumplimiento': `${teamPct}%`,
      'Tasa cierre': `${teamCloseRate.toFixed(0)}%`,
      'Margen equipo': `${teamMargin.toFixed(1)}%`,
      'Cobranza equipo': teamCollections,
      'Clientes nuevos': teamNewCustomers,
      'Score promedio': teamScore,
    },
    bonuses,
    penalties: [],
    grossTotal,
    penaltyTotal: 0,
    netTotal: grossTotal,
  };
}

// ─── Cobranza Calculation ───────────────────────────────────────
export function calcCobranzaCommission(
  vendorKPIs: VendorKPI[],
  config: CobranzaConfig,
): RoleCommissionResult {
  // Use accounts receivable data
  const totalCartera = demoAccountsReceivable.reduce((s, ar) => s + ar.total, 0);
  const totalCobrado = demoAccountsReceivable.reduce((s, ar) => s + ar.paid, 0);
  const totalBalance = demoAccountsReceivable.reduce((s, ar) => s + ar.balance, 0);
  const overdueAR = demoAccountsReceivable.filter(ar => ar.status === 'vencida' || ar.daysOverdue > 0);
  const overdueRecovered = overdueAR.reduce((s, ar) => s + ar.paid, 0);
  const collectionPct = totalCartera > 0 ? (totalCobrado / totalCartera) * 100 : 0;
  const avgDaysOverdue = overdueAR.length > 0
    ? Math.round(overdueAR.reduce((s, ar) => s + ar.daysOverdue, 0) / overdueAR.length) : 0;

  const bonuses: RoleCommissionResult['bonuses'] = [];

  // Collection bonus
  const collectedBonus = totalCobrado * (config.collectedBonusRate / 100);
  bonuses.push({
    label: 'Bono por monto cobrado',
    amount: collectedBonus,
    detail: `${config.collectedBonusRate}% de ${fmt(totalCobrado)} cobrados`,
  });

  // Overdue recovery
  if (overdueRecovered > 0) {
    const recoveryBonus = overdueRecovered * (config.overdueRecoveryBonusRate / 100);
    bonuses.push({
      label: 'Bono recuperación vencida',
      amount: recoveryBonus,
      detail: `${config.overdueRecoveryBonusRate}% de ${fmt(overdueRecovered)} recuperados`,
    });
  }

  // Goal bonuses
  const goalTier = [...config.goalBonuses]
    .sort((a, b) => b.min_pct - a.min_pct)
    .find(t => collectionPct >= t.min_pct);
  if (goalTier) {
    bonuses.push({
      label: 'Bono cumplimiento cobranza',
      amount: goalTier.bonus,
      detail: `Cobranza ${collectionPct.toFixed(0)}% ≥ ${goalTier.min_pct}%`,
    });
  }

  const grossTotal = bonuses.reduce((s, b) => s + b.amount, 0);

  return {
    role: 'cobranza',
    roleName: 'Cobranza',
    userName: 'Equipo de Cobranza',
    kpis: {
      'Cartera total': totalCartera,
      'Monto cobrado': totalCobrado,
      'Saldo pendiente': totalBalance,
      '% Recuperado': `${collectionPct.toFixed(1)}%`,
      'Cartera vencida recuperada': overdueRecovered,
      'Días promedio atraso': avgDaysOverdue,
    },
    bonuses,
    penalties: [],
    grossTotal,
    penaltyTotal: 0,
    netTotal: grossTotal,
  };
}

// ─── Administración Calculation ─────────────────────────────────
export function calcAdminCommission(
  vendorKPIs: VendorKPI[],
  orders: DBOrder[],
  config: AdminConfig,
): RoleCommissionResult {
  const admin = demoUsers.find(u => u.role === 'administracion');
  const teamSales = vendorKPIs.reduce((s, k) => s + k.sales, 0);
  const teamGoal = vendorKPIs.reduce((s, k) => s + k.goalSales, 0);
  const teamPct = teamGoal > 0 ? Math.round((teamSales / teamGoal) * 100) : 0;

  const processedOrders = orders.filter(o => o.status !== 'cancelado' && o.status !== 'nuevo').length;
  const cancelledOrders = orders.filter(o => o.status === 'cancelado').length;
  const errorRate = orders.length > 0 ? (cancelledOrders / orders.length) * 100 : 0;

  const bonuses: RoleCommissionResult['bonuses'] = [];

  // Per-order bonus
  const orderBonus = processedOrders * config.orderProcessedBonus;
  bonuses.push({
    label: 'Bono por pedidos procesados',
    amount: orderBonus,
    detail: `${processedOrders} pedidos × ${fmt(config.orderProcessedBonus)}`,
  });

  // Efficiency bonus (low error rate)
  if (errorRate < 10 && processedOrders > 0) {
    const effBonus = teamSales * (config.efficiencyBonusPct / 100);
    bonuses.push({
      label: 'Bono eficiencia',
      amount: effBonus,
      detail: `Tasa error ${errorRate.toFixed(1)}% < 10% (${config.efficiencyBonusPct}% de ventas)`,
    });
  }

  // Global goal
  const goalTier = [...config.globalGoalBonuses]
    .sort((a, b) => b.min_pct - a.min_pct)
    .find(t => teamPct >= t.min_pct);
  if (goalTier) {
    bonuses.push({
      label: 'Bono meta global',
      amount: goalTier.bonus,
      detail: `Cumplimiento ${teamPct}% ≥ ${goalTier.min_pct}%`,
    });
  }

  const grossTotal = bonuses.reduce((s, b) => s + b.amount, 0);

  return {
    role: 'administracion',
    roleName: 'Administración',
    userName: admin?.name ?? 'Administración',
    kpis: {
      'Pedidos procesados': processedOrders,
      'Pedidos cancelados': cancelledOrders,
      'Tasa error': `${errorRate.toFixed(1)}%`,
      'Ventas totales': teamSales,
      'Cumplimiento global': `${teamPct}%`,
    },
    bonuses,
    penalties: [],
    grossTotal,
    penaltyTotal: 0,
    netTotal: grossTotal,
  };
}

// ─── Apply Penalties ────────────────────────────────────────────
export function applyVendorPenalties(
  kpi: VendorKPI,
  orders: DBOrder[],
  config: PenaltyConfig,
): { penalties: RoleCommissionResult['penalties']; penaltyTotal: number } {
  const penalties: RoleCommissionResult['penalties'] = [];
  const commission = kpi.commission.total;

  // Low margin
  if (kpi.marginAvg > 0 && kpi.marginAvg < config.lowMarginThreshold) {
    const amount = commission * (config.lowMarginPenaltyPct / 100);
    penalties.push({
      label: 'Castigo margen bajo',
      amount,
      detail: `Margen ${kpi.marginAvg.toFixed(1)}% < ${config.lowMarginThreshold}% (-${config.lowMarginPenaltyPct}%)`,
    });
  }

  // High cancellations
  const vendorCancellations = orders.filter(
    o => o.vendor_name === kpi.vendorName && o.status === 'cancelado'
  ).length;
  if (vendorCancellations >= config.highCancellationThreshold) {
    const amount = commission * (config.highCancellationPenaltyPct / 100);
    penalties.push({
      label: 'Castigo cancelaciones',
      amount,
      detail: `${vendorCancellations} cancelaciones ≥ ${config.highCancellationThreshold} (-${config.highCancellationPenaltyPct}%)`,
    });
  }

  // High uncollected
  if (kpi.sales > 0) {
    const uncollectedPct = ((kpi.sales - kpi.collections) / kpi.sales) * 100;
    if (uncollectedPct > config.uncollectedThreshold) {
      const amount = commission * (config.uncollectedPenaltyPct / 100);
      penalties.push({
        label: 'Castigo cartera sin cobrar',
        amount,
        detail: `${uncollectedPct.toFixed(0)}% sin cobrar > ${config.uncollectedThreshold}% (-${config.uncollectedPenaltyPct}%)`,
      });
    }
  }

  return { penalties, penaltyTotal: penalties.reduce((s, p) => s + p.amount, 0) };
}

// ─── Build vendor commission results with penalties ─────────────
export function buildVendorResults(
  vendorKPIs: VendorKPI[],
  orders: DBOrder[],
  penaltyConfig: PenaltyConfig,
): RoleCommissionResult[] {
  return vendorKPIs.map(kpi => {
    const c = kpi.commission;
    const bonuses: RoleCommissionResult['bonuses'] = [
      { label: 'Comisión base', amount: c.baseAmount, detail: `${c.baseRate}% de ${fmt(c.baseSales)}` },
      { label: 'Bono margen', amount: c.marginBonusAmount, detail: `+${c.marginBonusPct}% (margen: ${c.marginAvg.toFixed(1)}%)` },
      { label: 'Bono meta', amount: c.goalBonusAmount, detail: `+${c.goalBonusPct}% (cumplimiento: ${c.goalPct}%)` },
      { label: 'Bono clientes nuevos', amount: c.newCustomerBonusAmount, detail: `${c.newCustomerCount} × ${fmt(c.newCustomerBonusUnit)}` },
      { label: 'Bono cobranza', amount: c.collectionBonusAmount, detail: `${c.collectionBonusRate}% de ${fmt(c.collectionAmount)}` },
    ].filter(b => b.amount > 0);

    const { penalties, penaltyTotal } = applyVendorPenalties(kpi, orders, penaltyConfig);

    return {
      role: 'vendedor',
      roleName: 'Vendedor',
      userName: kpi.vendorName,
      kpis: {
        'Ventas': kpi.sales,
        'Meta': kpi.goalSales,
        'Avance': `${kpi.progressSales}%`,
        'Cotizaciones': kpi.quotations,
        'Pedidos': kpi.orders,
        'Cierre': `${kpi.closeRate.toFixed(0)}%`,
        'Margen': `${kpi.marginAvg.toFixed(1)}%`,
        'Score': kpi.score,
      },
      bonuses,
      penalties,
      grossTotal: c.total,
      penaltyTotal,
      netTotal: Math.max(0, c.total - penaltyTotal),
    };
  });
}

// ─── Executive Summary ──────────────────────────────────────────
export function calcExecutiveSummary(
  vendorResults: RoleCommissionResult[],
  gerenteResult: RoleCommissionResult,
  cobranzaResult: RoleCommissionResult,
  adminResult: RoleCommissionResult,
  vendorKPIs: VendorKPI[],
): ExecutiveSummary {
  const totalVendorCommissions = vendorResults.reduce((s, r) => s + r.netTotal, 0);
  const totalSales = vendorKPIs.reduce((s, k) => s + k.sales, 0);
  const teamMargin = vendorKPIs.length > 0
    ? vendorKPIs.reduce((s, k) => s + k.marginAvg, 0) / vendorKPIs.length : 0;
  const totalGrossProfit = totalSales * (teamMargin / 100);
  const grandTotal = totalVendorCommissions + gerenteResult.netTotal + cobranzaResult.netTotal + adminResult.netTotal;

  return {
    totalVendorCommissions,
    totalGerenteBonus: gerenteResult.netTotal,
    totalCobranzaBonus: cobranzaResult.netTotal,
    totalAdminBonus: adminResult.netTotal,
    grandTotal,
    totalSales,
    totalGrossProfit,
    commissionToSalesRatio: totalSales > 0 ? (grandTotal / totalSales) * 100 : 0,
    commissionToProfitRatio: totalGrossProfit > 0 ? (grandTotal / totalGrossProfit) * 100 : 0,
  };
}

const fmt = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);
