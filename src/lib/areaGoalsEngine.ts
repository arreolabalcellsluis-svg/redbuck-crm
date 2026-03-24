/**
 * REDBUCK – Area Goals Engine
 * Calculates KPIs, scores, and bonuses for strategic areas:
 * Gerente Comercial, Cobranza, Administración.
 */

import type { VendorKPI, ARRecord, TeamMember } from './vendorKPIsEngine';
import type { DBOrder } from '@/hooks/useOrders';
import type { DBQuotation } from '@/hooks/useQuotations';

// ─── Types ──────────────────────────────────────────────────────

export interface AreaKPIDefinition {
  key: string;
  label: string;
  weight: number;       // % weight for score (all weights should sum 100)
  goal: number;
  enabled: boolean;
  unit: 'currency' | 'percent' | 'number' | 'days';
  autoCalc: boolean;    // whether this KPI is auto-calculated or manual
}

export interface AreaGoalConfig {
  id?: string;
  area: 'gerente_comercial' | 'cobranza' | 'administracion';
  month: number;
  year: number;
  userName: string;
  kpiConfig: AreaKPIDefinition[];
  bonusBase: number;
  bonusOverperformanceRate: number;  // % additional per % over 100
  manualKpiValues: Record<string, number>;
}

export interface AreaKPIResult {
  key: string;
  label: string;
  weight: number;
  goal: number;
  actual: number;
  progress: number;     // %
  unit: 'currency' | 'percent' | 'number' | 'days';
  status: 'red' | 'yellow' | 'green';
  enabled: boolean;
}

export interface AreaScoreResult {
  area: string;
  areaLabel: string;
  userName: string;
  kpis: AreaKPIResult[];
  scoreTotal: number;
  overallProgress: number;
  bonusBase: number;
  bonusOverperformance: number;
  bonusTotal: number;
  status: 'red' | 'yellow' | 'green';
}

// ─── Default KPI Definitions ────────────────────────────────────

export const DEFAULT_GERENTE_KPIS: AreaKPIDefinition[] = [
  { key: 'team_sales', label: 'Ventas totales del equipo', weight: 25, goal: 0, enabled: true, unit: 'currency', autoCalc: true },
  { key: 'team_close_rate', label: 'Tasa de cierre del equipo', weight: 20, goal: 0, enabled: true, unit: 'percent', autoCalc: true },
  { key: 'followup_pct', label: 'Seguimiento de cotizaciones (%)', weight: 15, goal: 0, enabled: true, unit: 'percent', autoCalc: true },
  { key: 'growth_vs_prev', label: 'Crecimiento vs periodo anterior', weight: 15, goal: 0, enabled: true, unit: 'percent', autoCalc: true },
  { key: 'strategic_products', label: 'Venta productos estratégicos', weight: 10, goal: 0, enabled: true, unit: 'currency', autoCalc: true },
  { key: 'vendors_on_target', label: '% vendedores que cumplen meta', weight: 15, goal: 0, enabled: true, unit: 'percent', autoCalc: true },
];

export const DEFAULT_COBRANZA_KPIS: AreaKPIDefinition[] = [
  { key: 'recovered_amount', label: 'Monto recuperado vs meta', weight: 30, goal: 0, enabled: true, unit: 'currency', autoCalc: true },
  { key: 'dso', label: 'Días promedio de cobranza (DSO)', weight: 20, goal: 30, enabled: true, unit: 'days', autoCalc: true },
  { key: 'overdue_pct', label: '% cartera vencida', weight: 20, goal: 0, enabled: true, unit: 'percent', autoCalc: true },
  { key: 'critical_recovery', label: 'Recuperación cartera crítica', weight: 20, goal: 0, enabled: true, unit: 'currency', autoCalc: true },
  { key: 'active_followup_pct', label: '% clientes con seguimiento activo', weight: 10, goal: 0, enabled: true, unit: 'percent', autoCalc: false },
];

export const DEFAULT_ADMIN_KPIS: AreaKPIDefinition[] = [
  { key: 'operational_accuracy', label: 'Exactitud operativa (% sin errores)', weight: 25, goal: 0, enabled: true, unit: 'percent', autoCalc: true },
  { key: 'response_time', label: 'Tiempo de respuesta interno', weight: 15, goal: 0, enabled: true, unit: 'number', autoCalc: false },
  { key: 'expense_control', label: 'Control de gastos vs presupuesto', weight: 25, goal: 0, enabled: true, unit: 'percent', autoCalc: false },
  { key: 'doc_control', label: 'Control documental completo', weight: 15, goal: 0, enabled: true, unit: 'percent', autoCalc: false },
  { key: 'sales_support', label: 'Soporte a ventas (pedidos procesados)', weight: 20, goal: 0, enabled: true, unit: 'number', autoCalc: true },
];

export function getDefaultKPIs(area: string): AreaKPIDefinition[] {
  switch (area) {
    case 'gerente_comercial': return DEFAULT_GERENTE_KPIS.map(k => ({ ...k }));
    case 'cobranza': return DEFAULT_COBRANZA_KPIS.map(k => ({ ...k }));
    case 'administracion': return DEFAULT_ADMIN_KPIS.map(k => ({ ...k }));
    default: return [];
  }
}

// ─── Status helper ──────────────────────────────────────────────

function getStatus(progress: number): 'red' | 'yellow' | 'green' {
  if (progress >= 100) return 'green';
  if (progress >= 80) return 'yellow';
  return 'red';
}

// For DSO-type KPIs where lower is better
function getInverseStatus(actual: number, goal: number): 'red' | 'yellow' | 'green' {
  if (goal <= 0) return 'green';
  if (actual <= goal) return 'green';
  if (actual <= goal * 1.2) return 'yellow';
  return 'red';
}

function pct(actual: number, goal: number): number {
  return goal > 0 ? Math.round((actual / goal) * 100) : 0;
}

// For inverse KPIs (lower is better, like DSO or % vencida)
function inversePct(actual: number, goal: number): number {
  if (goal <= 0) return 100;
  if (actual <= 0) return 100;
  // If actual <= goal → 100%+. If actual > goal → less.
  return Math.round((goal / actual) * 100);
}

// ─── Auto-calculate KPI values ──────────────────────────────────

export interface AreaCalcContext {
  vendorKPIs: VendorKPI[];
  orders: DBOrder[];
  quotations: DBQuotation[];
  accountsReceivable: ARRecord[];
  teamMembers: TeamMember[];
  month: number;
  year: number;
  prevMonthVendorKPIs?: VendorKPI[];
}

function calcGerenteKPIValue(key: string, ctx: AreaCalcContext): number {
  const { vendorKPIs, quotations } = ctx;
  switch (key) {
    case 'team_sales':
      return vendorKPIs.reduce((s, k) => s + k.paidSales, 0);
    case 'team_close_rate': {
      const totalQ = vendorKPIs.reduce((s, k) => s + k.quotations, 0);
      const totalO = vendorKPIs.reduce((s, k) => s + k.paidOrders, 0);
      return totalQ > 0 ? Math.round((totalO / totalQ) * 100) : 0;
    }
    case 'followup_pct': {
      const total = quotations.length;
      const followed = quotations.filter(q => q.status === 'seguimiento' || q.status === 'aceptada').length;
      return total > 0 ? Math.round((followed / total) * 100) : 0;
    }
    case 'growth_vs_prev': {
      const currentSales = vendorKPIs.reduce((s, k) => s + k.paidSales, 0);
      const prevSales = (ctx.prevMonthVendorKPIs ?? []).reduce((s, k) => s + k.paidSales, 0);
      return prevSales > 0 ? Math.round(((currentSales - prevSales) / prevSales) * 100) : 0;
    }
    case 'strategic_products':
      // Total from orders - can be refined later
      return vendorKPIs.reduce((s, k) => s + k.paidSales, 0);
    case 'vendors_on_target': {
      const withGoal = vendorKPIs.filter(k => k.goalSales > 0);
      if (withGoal.length === 0) return 0;
      const onTarget = withGoal.filter(k => k.progressSales >= 100).length;
      return Math.round((onTarget / withGoal.length) * 100);
    }
    default: return 0;
  }
}

function calcCobranzaKPIValue(key: string, ctx: AreaCalcContext): number {
  const { accountsReceivable } = ctx;
  const totalCartera = accountsReceivable.reduce((s, ar) => s + ar.total, 0);
  const totalCobrado = accountsReceivable.reduce((s, ar) => s + ar.paid, 0);
  const totalBalance = accountsReceivable.reduce((s, ar) => s + ar.balance, 0);
  const overdueAR = accountsReceivable.filter(ar => ar.status === 'vencido' || ar.daysOverdue > 0);

  switch (key) {
    case 'recovered_amount':
      return totalCobrado;
    case 'dso': {
      if (overdueAR.length === 0) return 0;
      return Math.round(overdueAR.reduce((s, ar) => s + ar.daysOverdue, 0) / overdueAR.length);
    }
    case 'overdue_pct':
      return totalCartera > 0 ? Math.round((totalBalance / totalCartera) * 100) : 0;
    case 'critical_recovery': {
      const critical = overdueAR.filter(ar => ar.daysOverdue > 60);
      return critical.reduce((s, ar) => s + ar.paid, 0);
    }
    default: return 0;
  }
}

function calcAdminKPIValue(key: string, ctx: AreaCalcContext): number {
  const { orders } = ctx;
  const total = orders.length;
  const cancelled = orders.filter(o => o.status === 'cancelado').length;
  const processed = orders.filter(o => o.status !== 'cancelado' && o.status !== 'nuevo').length;

  switch (key) {
    case 'operational_accuracy':
      return total > 0 ? Math.round(((total - cancelled) / total) * 100) : 100;
    case 'sales_support':
      return processed;
    default: return 0;
  }
}

function getAutoCalcValue(area: string, key: string, ctx: AreaCalcContext): number {
  switch (area) {
    case 'gerente_comercial': return calcGerenteKPIValue(key, ctx);
    case 'cobranza': return calcCobranzaKPIValue(key, ctx);
    case 'administracion': return calcAdminKPIValue(key, ctx);
    default: return 0;
  }
}

// ─── Inverse KPIs (lower is better) ────────────────────────────
const INVERSE_KPIS = new Set(['dso', 'overdue_pct']);

// ─── Main Score Calculator ──────────────────────────────────────

export function calcAreaScore(
  config: AreaGoalConfig,
  ctx: AreaCalcContext,
): AreaScoreResult {
  const areaLabels: Record<string, string> = {
    gerente_comercial: 'Gerente Comercial',
    cobranza: 'Equipo de Cobranza',
    administracion: 'Administración',
  };

  const enabledKPIs = config.kpiConfig.filter(k => k.enabled);
  const totalWeight = enabledKPIs.reduce((s, k) => s + k.weight, 0);

  const kpiResults: AreaKPIResult[] = enabledKPIs.map(kpi => {
    const actual = kpi.autoCalc
      ? getAutoCalcValue(config.area, kpi.key, ctx)
      : (config.manualKpiValues[kpi.key] ?? 0);

    const isInverse = INVERSE_KPIS.has(kpi.key);
    const progress = isInverse ? inversePct(actual, kpi.goal) : pct(actual, kpi.goal);
    const status = isInverse ? getInverseStatus(actual, kpi.goal) : getStatus(progress);

    return {
      key: kpi.key,
      label: kpi.label,
      weight: kpi.weight,
      goal: kpi.goal,
      actual,
      progress,
      unit: kpi.unit,
      status,
      enabled: kpi.enabled,
    };
  });

  // Weighted score
  const scoreTotal = totalWeight > 0
    ? Math.round(kpiResults.reduce((s, k) => s + (Math.min(k.progress, 150) / 1.5) * (k.weight / totalWeight), 0))
    : 0;

  // Overall progress (average of all KPI progress weighted)
  const overallProgress = totalWeight > 0
    ? Math.round(kpiResults.reduce((s, k) => s + k.progress * (k.weight / totalWeight), 0))
    : 0;

  // Bonus calculation
  const bonusBase = config.bonusBase;
  let bonusOverperformance = 0;
  if (overallProgress > 100 && config.bonusOverperformanceRate > 0) {
    const overPct = overallProgress - 100;
    bonusOverperformance = bonusBase * (overPct * config.bonusOverperformanceRate / 100);
  }
  const bonusTotal = overallProgress >= 80 ? bonusBase + bonusOverperformance : 0;

  const status = getStatus(overallProgress);

  return {
    area: config.area,
    areaLabel: areaLabels[config.area] ?? config.area,
    userName: config.userName,
    kpis: kpiResults,
    scoreTotal,
    overallProgress,
    bonusBase,
    bonusOverperformance,
    bonusTotal,
    status,
  };
}

// ─── Format helpers ─────────────────────────────────────────────

export function formatKPIValue(value: number, unit: string): string {
  switch (unit) {
    case 'currency':
      return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(value);
    case 'percent':
      return `${value.toFixed(1)}%`;
    case 'days':
      return `${value} días`;
    default:
      return String(value);
  }
}
