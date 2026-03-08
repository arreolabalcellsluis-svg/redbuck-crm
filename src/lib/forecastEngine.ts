/**
 * REDBUCK – Forecast / Prediction Engine
 * Projects future financials using existing historical data.
 *
 * REUSES:
 * - monthlySales, demoProducts, demoAccountsReceivable, dashboardMetrics (demo-data)
 * - IncomeStatement, BalanceSheet from cfoDashboardEngine
 * - OperatingExpense from operatingExpensesEngine
 * - DBAccountPayable from useAccountsPayable
 */

import { monthlySales, demoProducts, demoAccountsReceivable, dashboardMetrics } from '@/data/demo-data';
import type { IncomeStatement, BalanceSheet } from '@/lib/cfoDashboardEngine';
import type { DBAccountPayable } from '@/hooks/useAccountsPayable';

// ─── Types ──────────────────────────────────────────────────────

export type ScenarioType = 'conservador' | 'base' | 'agresivo';

export interface ScenarioConfig {
  label: string;
  growthFactor: number; // multiplier on trend (0.5 = half growth, 1 = trend, 1.5 = aggressive)
  color: string;
}

export const SCENARIOS: Record<ScenarioType, ScenarioConfig> = {
  conservador: { label: 'Conservador', growthFactor: 0.5, color: 'hsl(210,100%,52%)' },
  base:        { label: 'Base (Tendencia)', growthFactor: 1.0, color: 'hsl(142,71%,45%)' },
  agresivo:    { label: 'Agresivo', growthFactor: 1.5, color: 'hsl(38,92%,50%)' },
};

export interface MonthlyProjection {
  month: string;
  ventas: number;
  costoVentas: number;
  utilidadBruta: number;
  gastosOperativos: number;
  ebitda: number;
  utilidadNeta: number;
  flujoEntradas: number;
  flujoSalidas: number;
  flujoNeto: number;
  saldoCaja: number;
  inventarioNecesario: number;
  capitalTrabajo: number;
}

export interface ForecastResult {
  scenario: ScenarioType;
  months: MonthlyProjection[];
  // Totals for the horizon
  ventasTotal: number;
  utilidadBrutaTotal: number;
  ebitdaTotal: number;
  utilidadNetaTotal: number;
  flujoNetoTotal: number;
  capitalTrabajoFinal: number;
  inventarioCapitalRequerido: number;
  // Alerts
  alertas: ForecastAlert[];
}

export interface ForecastAlert {
  tipo: 'liquidez' | 'capital' | 'inventario' | 'utilidad' | 'pagos';
  severity: 'critico' | 'alto' | 'medio';
  mes: string;
  titulo: string;
  descripcion: string;
  monto: number;
}

// ─── Helpers ────────────────────────────────────────────────────
const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function getMonthLabel(baseDate: Date, offset: number): string {
  const d = new Date(baseDate);
  d.setMonth(d.getMonth() + offset);
  return `${MONTH_NAMES[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`;
}

// ─── Trend calculation using linear regression on monthlySales ──
function calcTrend(): { avgMonthly: number; monthlyGrowth: number; seasonality: number[] } {
  const sales = monthlySales.map(m => m.sales);
  const n = sales.length;
  if (n < 3) return { avgMonthly: sales[n - 1] ?? 1000000, monthlyGrowth: 0, seasonality: Array(12).fill(1) };

  // Linear regression: y = a + b*x
  const xMean = (n - 1) / 2;
  const yMean = sum(sales) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (sales[i] - yMean);
    den += (i - xMean) ** 2;
  }
  const b = den !== 0 ? num / den : 0;
  const a = yMean - b * xMean;

  // Seasonality index (ratio of actual to trend for each calendar month)
  const seasonality = Array(12).fill(0);
  const seasonCount = Array(12).fill(0);
  for (let i = 0; i < n; i++) {
    const trendVal = a + b * i;
    const monthIdx = i % 12;
    if (trendVal > 0) {
      seasonality[monthIdx] += sales[i] / trendVal;
      seasonCount[monthIdx]++;
    }
  }
  for (let m = 0; m < 12; m++) {
    seasonality[m] = seasonCount[m] > 0 ? seasonality[m] / seasonCount[m] : 1;
  }

  return {
    avgMonthly: sales[n - 1],
    monthlyGrowth: b,
    seasonality,
  };
}

// ─── Main forecast function ─────────────────────────────────────
export function calcForecast(
  scenario: ScenarioType,
  horizonMonths: number,
  currentIncome: IncomeStatement,
  currentBalance: BalanceSheet,
  payables: DBAccountPayable[],
): ForecastResult {
  const config = SCENARIOS[scenario];
  const trend = calcTrend();
  const salesData = monthlySales.map(m => m.sales);
  const lastIdx = salesData.length - 1;

  // Current ratios from income statement
  const costRatio = currentIncome.costoVentas / (currentIncome.ventas || 1);
  const opexRatio = currentIncome.gastosOperativos / (currentIncome.ventas || 1);
  const depAmortMonthly = currentIncome.depAmort / 12;
  const interestMonthly = currentIncome.intereses / 12;
  const taxRate = 0.30;

  // Cash flow ratios
  const collectionRate = 0.85; // 85% of sales collected same month
  const paymentRate = 0.80; // 80% of COGS paid same month
  const inventoryToSalesRatio = currentBalance.inventario / (currentIncome.ventas / 12 || 1);

  // Starting values
  let saldoCaja = currentBalance.bancos;
  const cxcBase = currentBalance.cuentasPorCobrar;
  const cxpBase = currentBalance.cuentasPorPagar;

  const months: MonthlyProjection[] = [];
  const alertas: ForecastAlert[] = [];
  const now = new Date();

  for (let i = 1; i <= horizonMonths; i++) {
    const monthLabel = getMonthLabel(now, i);
    const futureDate = new Date(now);
    futureDate.setMonth(futureDate.getMonth() + i);
    const calMonth = futureDate.getMonth();

    // Projected sales: trend line + growth factor + seasonality
    const trendSales = salesData[lastIdx] + trend.monthlyGrowth * i * config.growthFactor;
    const seasonIdx = trend.seasonality[calMonth] ?? 1;
    const ventas = Math.max(0, trendSales * seasonIdx);

    const costoVentas = ventas * costRatio;
    const utilidadBruta = ventas - costoVentas;
    const gastosOperativos = ventas * opexRatio;
    const ebitda = utilidadBruta - gastosOperativos;
    const utilidadAntesImp = ebitda - depAmortMonthly - interestMonthly;
    const impuestos = Math.max(0, utilidadAntesImp * taxRate);
    const utilidadNeta = utilidadAntesImp - impuestos;

    // Cash flow projection
    const flujoEntradas = ventas * collectionRate + (i === 1 ? cxcBase * 0.3 : 0);
    const pagoProveedores = costoVentas * paymentRate + (i <= 2 ? cxpBase * 0.2 : 0);
    const flujoSalidas = pagoProveedores + gastosOperativos + impuestos + interestMonthly;
    const flujoNeto = flujoEntradas - flujoSalidas;
    saldoCaja += flujoNeto;

    // Inventory needed
    const inventarioNecesario = ventas * inventoryToSalesRatio;

    // Working capital
    const cxcProj = ventas * (1 - collectionRate) * 2; // ~2 months uncollected
    const cxpProj = costoVentas * (1 - paymentRate) * 1.5;
    const capitalTrabajo = (saldoCaja + cxcProj + inventarioNecesario) - cxpProj;

    months.push({
      month: monthLabel, ventas, costoVentas, utilidadBruta, gastosOperativos,
      ebitda, utilidadNeta, flujoEntradas, flujoSalidas, flujoNeto,
      saldoCaja, inventarioNecesario, capitalTrabajo,
    });

    // Generate alerts
    if (saldoCaja < 0) {
      alertas.push({
        tipo: 'liquidez', severity: 'critico', mes: monthLabel,
        titulo: 'Déficit de caja proyectado',
        descripcion: `El saldo de caja podría ser negativo en ${monthLabel}`,
        monto: Math.abs(saldoCaja),
      });
    } else if (saldoCaja < gastosOperativos) {
      alertas.push({
        tipo: 'liquidez', severity: 'alto', mes: monthLabel,
        titulo: 'Liquidez ajustada',
        descripcion: `Caja no cubre un mes de operación en ${monthLabel}`,
        monto: saldoCaja,
      });
    }

    if (utilidadNeta < 0) {
      alertas.push({
        tipo: 'utilidad', severity: 'alto', mes: monthLabel,
        titulo: 'Pérdida proyectada',
        descripcion: `Se proyecta pérdida neta en ${monthLabel}`,
        monto: Math.abs(utilidadNeta),
      });
    }

    if (capitalTrabajo < 0) {
      alertas.push({
        tipo: 'capital', severity: 'critico', mes: monthLabel,
        titulo: 'Capital de trabajo negativo',
        descripcion: `Se necesitará inyección de capital en ${monthLabel}`,
        monto: Math.abs(capitalTrabajo),
      });
    }
  }

  // Inventory alert: total capital needed
  const inventarioCapitalRequerido = sum(months.map(m => m.inventarioNecesario)) / horizonMonths;
  if (inventarioCapitalRequerido > currentBalance.inventario * 1.3) {
    alertas.push({
      tipo: 'inventario', severity: 'alto', mes: months[0]?.month ?? '',
      titulo: 'Inventario adicional requerido',
      descripcion: `Se necesitará ~${Math.round((inventarioCapitalRequerido / currentBalance.inventario - 1) * 100)}% más inventario para cubrir demanda`,
      monto: inventarioCapitalRequerido - currentBalance.inventario,
    });
  }

  return {
    scenario,
    months,
    ventasTotal: sum(months.map(m => m.ventas)),
    utilidadBrutaTotal: sum(months.map(m => m.utilidadBruta)),
    ebitdaTotal: sum(months.map(m => m.ebitda)),
    utilidadNetaTotal: sum(months.map(m => m.utilidadNeta)),
    flujoNetoTotal: sum(months.map(m => m.flujoNeto)),
    capitalTrabajoFinal: months[months.length - 1]?.capitalTrabajo ?? 0,
    inventarioCapitalRequerido,
    alertas,
  };
}

// ─── Multi-scenario comparison ──────────────────────────────────
export interface ScenarioComparison {
  label: string;
  conservador: number;
  base: number;
  agresivo: number;
}

export function calcScenarioComparison(
  horizonMonths: number,
  currentIncome: IncomeStatement,
  currentBalance: BalanceSheet,
  payables: DBAccountPayable[],
): { forecasts: Record<ScenarioType, ForecastResult>; comparison: ScenarioComparison[] } {
  const types: ScenarioType[] = ['conservador', 'base', 'agresivo'];
  const forecasts = {} as Record<ScenarioType, ForecastResult>;

  for (const t of types) {
    forecasts[t] = calcForecast(t, horizonMonths, currentIncome, currentBalance, payables);
  }

  const comparison: ScenarioComparison[] = [
    { label: 'Ventas', conservador: forecasts.conservador.ventasTotal, base: forecasts.base.ventasTotal, agresivo: forecasts.agresivo.ventasTotal },
    { label: 'Utilidad Bruta', conservador: forecasts.conservador.utilidadBrutaTotal, base: forecasts.base.utilidadBrutaTotal, agresivo: forecasts.agresivo.utilidadBrutaTotal },
    { label: 'EBITDA', conservador: forecasts.conservador.ebitdaTotal, base: forecasts.base.ebitdaTotal, agresivo: forecasts.agresivo.ebitdaTotal },
    { label: 'Utilidad Neta', conservador: forecasts.conservador.utilidadNetaTotal, base: forecasts.base.utilidadNetaTotal, agresivo: forecasts.agresivo.utilidadNetaTotal },
    { label: 'Flujo Neto', conservador: forecasts.conservador.flujoNetoTotal, base: forecasts.base.flujoNetoTotal, agresivo: forecasts.agresivo.flujoNetoTotal },
    { label: 'Capital Trabajo', conservador: forecasts.conservador.capitalTrabajoFinal, base: forecasts.base.capitalTrabajoFinal, agresivo: forecasts.agresivo.capitalTrabajoFinal },
  ];

  return { forecasts, comparison };
}
