/**
 * REDBUCK – CFO Financial Dashboard Engine
 * Consolidates all financial data: Income Statement, Balance Sheet,
 * Cash Flow, and Strategic KPIs.
 * 
 * All data is passed as parameters — no demo-data imports.
 */

import type { OperatingExpense } from '@/lib/operatingExpensesEngine';
import type { Asset } from '@/hooks/useAssets';
import { calcDepreciation, getTotalMonthlyDepAmort } from '@/hooks/useAssets';
import type { DBAccountPayable } from '@/hooks/useAccountsPayable';

// ─── Types ──────────────────────────────────────────────────────
export interface IncomeStatement {
  ventas: number; costoVentas: number; utilidadBruta: number;
  gastosVentas: number; gastosAdmin: number; gastosOperativos: number;
  ebitda: number; depAmort: number; ebit: number; intereses: number;
  utilidadAntesImpuestos: number; impuestos: number; utilidadNeta: number;
  margenBruto: number; margenEbitda: number; margenNeto: number;
}

export interface BalanceSheet {
  bancos: number; cuentasPorCobrar: number; inventario: number; totalCirculantes: number;
  activosFijosValor: number; depreciacionAcumulada: number; activosFijosNeto: number; totalActivos: number;
  cuentasPorPagar: number; cxpPor30: number; cxpPor60: number; cxpPor90: number;
  cxpPor120: number; cxpPor150: number; cxpPor180: number; cxpPor365: number; cxpMas365: number;
  creditosBancarios: number; impuestosPorPagar: number; totalPasivos: number;
  aportacionSocios: number; utilidadesAcumuladas: number; utilidadEjercicio: number; totalCapital: number;
  capitalDeTrabajo: number; ecuacionBalanceada: boolean;
}

export interface FinancialRadar {
  bancos: number; cuentasPorCobrar: number; inventario: number;
  cuentasPorPagar: number; creditosBancarios: number; utilidadNeta: number;
  capitalDeTrabajo: number;
  distribution: { label: string; value: number; pct: number; color: string }[];
}

export interface CashFlow {
  cobrosClientes: number; ingresosVentas: number; pagosProveedores: number;
  gastosOperativos: number; nomina: number; impuestosPagados: number; flujoOperativo: number;
  compraActivos: number; ventaActivos: number; flujoInversion: number;
  prestamosRecibidos: number; pagosDeuda: number; aportacionesSocios: number; flujoFinanciamiento: number;
  flujoNeto: number; saldoInicial: number; saldoFinal: number;
}

export interface StrategicKPIs {
  liquidez: number; endeudamiento: number; diasInventario: number;
  diasCxC: number; diasCxP: number; cicloConversionEfectivo: number;
  rotacionInventario: number; capitalEnInventario: number;
}

export interface MonthlyFlowItem {
  month: string; entradas: number; salidas: number; neto: number; acumulado: number;
}

export interface MonthlySalesItem { month: string; sales: number; }

// ─── Helpers ────────────────────────────────────────────────────
const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
const safePct = (num: number, den: number) => den !== 0 ? (num / den) * 100 : 0;

const MONTH_MAP: Record<string, string> = {
  'Ene': '01', 'Feb': '02', 'Mar': '03', 'Abr': '04', 'May': '05', 'Jun': '06',
  'Jul': '07', 'Ago': '08', 'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dic': '12',
};

export function parseMonthLabel(label: string): string {
  const parts = label.split(' ');
  if (parts.length !== 2) return '9999-99';
  const mm = MONTH_MAP[parts[0]] ?? '01';
  const yy = parts[1].length === 2 ? `20${parts[1]}` : parts[1];
  return `${yy}-${mm}`;
}

export interface PeriodRange { from: string; to: string; }

function filterSalesByPeriod(salesData: MonthlySalesItem[], period?: PeriodRange) {
  if (!period) return salesData;
  return salesData.filter(m => {
    const key = parseMonthLabel(m.month);
    return key >= period.from && key <= period.to;
  });
}

function filterExpensesByPeriod(expenses: OperatingExpense[], period?: PeriodRange) {
  if (!period) return expenses;
  return expenses.filter(e => {
    const d = e.fecha.slice(0, 7);
    return d >= period.from && d <= period.to;
  });
}

// ─── Income Statement Calculator ────────────────────────────────
export function calcIncomeStatement(
  expenses: OperatingExpense[],
  assets: Asset[],
  salesData: MonthlySalesItem[],
  grossMarginPct: number,
  months = 12,
  period?: PeriodRange,
): IncomeStatement {
  const filteredSales = filterSalesByPeriod(salesData, period);
  const filteredExpenses = filterExpensesByPeriod(expenses, period);
  const effectiveMonths = period ? Math.max(filteredSales.length, 1) : months;

  const totalSales = period
    ? sum(filteredSales.map(m => m.sales))
    : sum(salesData.slice(-months).map(m => m.sales));
  const costoVentas = totalSales * (1 - grossMarginPct / 100);
  const utilidadBruta = totalSales - costoVentas;

  const expSource = period ? filteredExpenses : expenses;
  const gastosVentas = sum(expSource.filter(e => e.categoria === 'ventas').map(e => e.monto));
  const gastosFinancieros = sum(expSource.filter(e => e.categoria === 'financieros').map(e => e.monto));
  const totalExp = sum(expSource.map(e => e.monto));
  const gastosAdmin = totalExp - gastosVentas - gastosFinancieros;
  const gastosOperativos = gastosVentas + gastosAdmin;

  const ebitda = utilidadBruta - gastosOperativos;
  const depAmort = getTotalMonthlyDepAmort(assets) * effectiveMonths;
  const ebit = ebitda - depAmort;
  const intereses = gastosFinancieros;
  const utilidadAntesImpuestos = ebit - intereses;
  const impuestos = Math.max(0, utilidadAntesImpuestos * 0.30);
  const utilidadNeta = utilidadAntesImpuestos - impuestos;

  return {
    ventas: totalSales, costoVentas, utilidadBruta,
    gastosVentas, gastosAdmin, gastosOperativos,
    ebitda, depAmort, ebit, intereses, utilidadAntesImpuestos, impuestos, utilidadNeta,
    margenBruto: safePct(utilidadBruta, totalSales),
    margenEbitda: safePct(ebitda, totalSales),
    margenNeto: safePct(utilidadNeta, totalSales),
  };
}

// ─── Balance Sheet Calculator ───────────────────────────────────
export function calcBalanceSheet(
  income: IncomeStatement,
  assets: Asset[],
  payables: DBAccountPayable[],
  receivablesData: { paid: number; balance: number }[],
  productsData: { active: boolean; stock: Record<string, number>; cost: number }[],
  config: { bancos?: number; creditosBancarios?: number; aportacionSocios?: number; utilidadesAcumuladas?: number } = {},
): BalanceSheet {
  const bancos = config.bancos ?? 0;
  const cuentasPorCobrar = sum(receivablesData.map(r => r.balance));
  const inventario = sum(productsData.filter(p => p.active).map(p => {
    const totalStock = Object.values(p.stock).reduce((a: number, b) => a + Number(b), 0);
    return totalStock * p.cost;
  }));
  const totalCirculantes = bancos + cuentasPorCobrar + inventario;

  const activeAssets = assets.filter(a => a.estatus === 'activo');
  const activosFijosValor = sum(activeAssets.map(a => a.costoAdquisicion));
  const depreciacionAcumulada = sum(activeAssets.map(a => calcDepreciation(a).depAcumulada));
  const activosFijosNeto = activosFijosValor - depreciacionAcumulada;
  const totalActivos = totalCirculantes + activosFijosNeto;

  const now = new Date();
  const activePay = payables.filter(p => p.status !== 'liquidada' && p.status !== 'cancelada');
  const cuentasPorPagar = sum(activePay.map(p => p.balance));

  const agingRange = (minDays: number, maxDays: number) => sum(activePay.filter(p => {
    const due = new Date(p.due_date);
    const diff = Math.floor((now.getTime() - due.getTime()) / 86400000);
    return diff >= minDays && diff < maxDays;
  }).map(p => p.balance));

  const notYetDue = sum(activePay.filter(p => new Date(p.due_date) >= now).map(p => p.balance));
  const cxpPor30 = notYetDue + agingRange(0, 30);
  const cxpPor60 = agingRange(30, 60);
  const cxpPor90 = agingRange(60, 90);
  const cxpPor120 = agingRange(90, 120);
  const cxpPor150 = agingRange(120, 150);
  const cxpPor180 = agingRange(150, 180);
  const cxpPor365 = agingRange(180, 365);
  const cxpMas365 = agingRange(365, 99999);

  const creditosBancarios = config.creditosBancarios ?? 0;
  const impuestosPorPagar = income.impuestos * 0.25;
  const totalPasivos = cuentasPorPagar + creditosBancarios + impuestosPorPagar;

  const aportacionSocios = config.aportacionSocios ?? 0;
  const utilidadesAcumuladas = config.utilidadesAcumuladas ?? 0;
  const utilidadEjercicio = income.utilidadNeta;
  const totalCapital = aportacionSocios + utilidadesAcumuladas + utilidadEjercicio;

  const capitalDeTrabajo = totalCirculantes - (cuentasPorPagar + impuestosPorPagar);

  return {
    bancos, cuentasPorCobrar, inventario, totalCirculantes,
    activosFijosValor, depreciacionAcumulada, activosFijosNeto, totalActivos,
    cuentasPorPagar, cxpPor30, cxpPor60, cxpPor90, cxpPor120, cxpPor150, cxpPor180, cxpPor365, cxpMas365,
    creditosBancarios, impuestosPorPagar, totalPasivos,
    aportacionSocios, utilidadesAcumuladas, utilidadEjercicio, totalCapital,
    capitalDeTrabajo,
    ecuacionBalanceada: Math.abs(totalActivos - (totalPasivos + totalCapital)) < 1,
  };
}

// ─── Cash Flow Calculator ───────────────────────────────────────
export function calcCashFlow(
  income: IncomeStatement,
  payables: DBAccountPayable[],
  receivablesData: { paid: number; balance: number }[],
  config: { saldoInicial?: number; prestamosRecibidos?: number; pagosDeuda?: number; aportaciones?: number; compraActivos?: number } = {},
): CashFlow {
  const cobrosClientes = sum(receivablesData.map(r => r.paid));
  const ingresosVentas = income.ventas;
  const pagosProveedores = sum(payables.filter(p => p.status === 'liquidada').map(p => p.total));
  const gastosOp = income.gastosOperativos;
  const nomina = income.gastosAdmin * 0.55;
  const impuestosPagados = income.impuestos * 0.75;

  const flujoOperativo = (cobrosClientes + ingresosVentas) - (pagosProveedores + gastosOp + nomina + impuestosPagados);

  const compraActivos = config.compraActivos ?? 0;
  const ventaActivos = 0;
  const flujoInversion = ventaActivos - compraActivos;

  const prestamosRecibidos = config.prestamosRecibidos ?? 0;
  const pagosDeuda = config.pagosDeuda ?? 0;
  const aportacionesSocios = config.aportaciones ?? 0;
  const flujoFinanciamiento = prestamosRecibidos - pagosDeuda + aportacionesSocios;

  const flujoNeto = flujoOperativo + flujoInversion + flujoFinanciamiento;
  const saldoInicial = config.saldoInicial ?? 0;

  return {
    cobrosClientes, ingresosVentas,
    pagosProveedores, gastosOperativos: gastosOp, nomina, impuestosPagados,
    flujoOperativo,
    compraActivos, ventaActivos, flujoInversion,
    prestamosRecibidos, pagosDeuda, aportacionesSocios, flujoFinanciamiento,
    flujoNeto, saldoInicial, saldoFinal: saldoInicial + flujoNeto,
  };
}

// ─── Monthly cash flow series ───────────────────────────────────
export function calcMonthlyFlow(
  expenses: OperatingExpense[],
  salesData: MonthlySalesItem[],
  grossMarginPct: number,
  period?: PeriodRange,
): MonthlyFlowItem[] {
  const expSource = period ? filterExpensesByPeriod(expenses, period) : expenses;
  const totalExpMonthly = expSource.length > 0
    ? sum(expSource.map(e => e.monto)) / Math.max(expSource.length / 3, 1)
    : 0;

  const filtered = filterSalesByPeriod(salesData, period);
  let acumulado = 0;
  return filtered.map(m => {
    const entradas = m.sales;
    const salidas = m.sales * (1 - grossMarginPct / 100) + totalExpMonthly;
    const neto = entradas - salidas;
    acumulado += neto;
    return { month: m.month, entradas, salidas, neto, acumulado };
  });
}

// ─── Strategic KPIs Calculator ──────────────────────────────────
export function calcStrategicKPIs(
  balance: BalanceSheet,
  income: IncomeStatement,
  payables: DBAccountPayable[],
): StrategicKPIs {
  const pasivosCirculantes = balance.cuentasPorPagar + balance.impuestosPorPagar;
  const liquidez = pasivosCirculantes > 0 ? balance.totalCirculantes / pasivosCirculantes : 99;
  const endeudamiento = balance.totalCapital > 0 ? balance.totalPasivos / balance.totalCapital : 0;

  const ventasDiarias = income.ventas / 365;
  const costoVentasDiario = income.costoVentas / 365;
  const comprasDiarias = sum(payables.map(p => p.total)) / 365;

  const diasInventario = costoVentasDiario > 0 ? balance.inventario / costoVentasDiario : 0;
  const diasCxC = ventasDiarias > 0 ? balance.cuentasPorCobrar / ventasDiarias : 0;
  const diasCxP = comprasDiarias > 0 ? balance.cuentasPorPagar / comprasDiarias : 0;

  const cicloConversionEfectivo = diasInventario + diasCxC - diasCxP;
  const rotacionInventario = balance.inventario > 0 ? income.costoVentas / balance.inventario : 0;

  return {
    liquidez, endeudamiento, diasInventario, diasCxC, diasCxP,
    cicloConversionEfectivo, rotacionInventario,
    capitalEnInventario: balance.inventario,
  };
}

// ─── Financial Radar Calculator ─────────────────────────────────
export function calcFinancialRadar(
  balance: BalanceSheet,
  income: IncomeStatement,
): FinancialRadar {
  const items = [
    { label: 'Bancos', value: balance.bancos, color: 'hsl(142,71%,45%)' },
    { label: 'Cuentas por cobrar', value: balance.cuentasPorCobrar, color: 'hsl(210,100%,52%)' },
    { label: 'Inventario', value: balance.inventario, color: 'hsl(38,92%,50%)' },
    { label: 'Cuentas por pagar', value: -balance.cuentasPorPagar, color: 'hsl(0,78%,45%)' },
    { label: 'Créditos bancarios', value: -balance.creditosBancarios, color: 'hsl(280,65%,55%)' },
    { label: 'Utilidad neta', value: income.utilidadNeta, color: 'hsl(var(--primary))' },
  ];
  const totalAbs = items.reduce((s, i) => s + Math.abs(i.value), 0);
  const distribution = items.map(i => ({
    ...i, pct: totalAbs > 0 ? (i.value / totalAbs) * 100 : 0,
  }));
  return {
    bancos: balance.bancos, cuentasPorCobrar: balance.cuentasPorCobrar,
    inventario: balance.inventario, cuentasPorPagar: balance.cuentasPorPagar,
    creditosBancarios: balance.creditosBancarios, utilidadNeta: income.utilidadNeta,
    capitalDeTrabajo: balance.capitalDeTrabajo, distribution,
  };
}
