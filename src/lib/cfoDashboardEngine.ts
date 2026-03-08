/**
 * REDBUCK – CFO Financial Dashboard Engine
 * Consolidates all financial data: Income Statement, Balance Sheet,
 * Cash Flow, and Strategic KPIs.
 * 
 * REUSES existing data sources:
 * - monthlySales, dashboardMetrics, demoProducts, demoAccountsReceivable (demo-data)
 * - useExpenses hook (operating_expenses table)
 * - useAssets + calcDepreciation (assets table)
 * - useAccountsPayable hook (accounts_payable table)
 */

import { monthlySales, dashboardMetrics, demoProducts, demoAccountsReceivable } from '@/data/demo-data';
import { demoExpenses } from '@/lib/operatingExpensesEngine';
import type { OperatingExpense } from '@/lib/operatingExpensesEngine';
import type { Asset } from '@/hooks/useAssets';
import { calcDepreciation, getTotalMonthlyDepAmort } from '@/hooks/useAssets';
import type { DBAccountPayable } from '@/hooks/useAccountsPayable';

// ─── Types ──────────────────────────────────────────────────────
export interface IncomeStatement {
  ventas: number;
  costoVentas: number;
  utilidadBruta: number;
  gastosVentas: number;
  gastosAdmin: number;
  gastosOperativos: number;
  ebitda: number;
  depAmort: number;
  ebit: number;
  intereses: number;
  utilidadAntesImpuestos: number;
  impuestos: number;
  utilidadNeta: number;
  margenBruto: number;
  margenEbitda: number;
  margenNeto: number;
}

export interface BalanceSheet {
  // Activos
  bancos: number;
  cuentasPorCobrar: number;
  inventario: number;
  totalCirculantes: number;
  activosFijosValor: number;
  depreciacionAcumulada: number;
  activosFijosNeto: number;
  totalActivos: number;
  // Pasivos
  cuentasPorPagar: number;
  cxpPor30: number;
  cxpPor60: number;
  cxpPor90: number;
  cxpPor120: number;
  cxpPor150: number;
  cxpPor180: number;
  cxpPor365: number;
  cxpMas365: number;
  creditosBancarios: number;
  impuestosPorPagar: number;
  totalPasivos: number;
  // Capital
  aportacionSocios: number;
  utilidadesAcumuladas: number;
  utilidadEjercicio: number;
  totalCapital: number;
  // Working capital
  capitalDeTrabajo: number;
  // Verificación
  ecuacionBalanceada: boolean;
}

export interface FinancialRadar {
  bancos: number;
  cuentasPorCobrar: number;
  inventario: number;
  cuentasPorPagar: number;
  creditosBancarios: number;
  utilidadNeta: number;
  capitalDeTrabajo: number;
  // Percentages
  distribution: { label: string; value: number; pct: number; color: string }[];
}

export interface CashFlow {
  // Operativo
  cobrosClientes: number;
  ingresosVentas: number;
  pagosProveedores: number;
  gastosOperativos: number;
  nomina: number;
  impuestosPagados: number;
  flujoOperativo: number;
  // Inversión
  compraActivos: number;
  ventaActivos: number;
  flujoInversion: number;
  // Financiamiento
  prestamosRecibidos: number;
  pagosDeuda: number;
  aportacionesSocios: number;
  flujoFinanciamiento: number;
  // Totales
  flujoNeto: number;
  saldoInicial: number;
  saldoFinal: number;
}

export interface StrategicKPIs {
  liquidez: number;
  endeudamiento: number;
  diasInventario: number;
  diasCxC: number;
  diasCxP: number;
  cicloConversionEfectivo: number;
  rotacionInventario: number;
  capitalEnInventario: number;
}

export interface MonthlyFlowItem {
  month: string;
  entradas: number;
  salidas: number;
  neto: number;
  acumulado: number;
}

// ─── Helpers ────────────────────────────────────────────────────
const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
const safePct = (num: number, den: number) => den !== 0 ? (num / den) * 100 : 0;

// ─── Income Statement Calculator ────────────────────────────────
export function calcIncomeStatement(
  expenses: OperatingExpense[],
  assets: Asset[],
  months = 12,
): IncomeStatement {
  const totalSales = sum(monthlySales.slice(-months).map(m => m.sales));
  const costoVentas = totalSales * (1 - dashboardMetrics.grossMargin / 100);
  const utilidadBruta = totalSales - costoVentas;

  const gastosVentas = sum(expenses.filter(e => e.categoria === 'ventas').map(e => e.monto));
  const gastosFinancieros = sum(expenses.filter(e => e.categoria === 'financieros').map(e => e.monto));
  const totalExp = sum(expenses.map(e => e.monto));
  const gastosAdmin = totalExp - gastosVentas - gastosFinancieros;
  const gastosOperativos = gastosVentas + gastosAdmin;

  const ebitda = utilidadBruta - gastosOperativos;
  const depAmort = getTotalMonthlyDepAmort(assets) * months;
  const ebit = ebitda - depAmort;
  const intereses = gastosFinancieros;
  const utilidadAntesImpuestos = ebit - intereses;
  const impuestos = Math.max(0, utilidadAntesImpuestos * 0.30);
  const utilidadNeta = utilidadAntesImpuestos - impuestos;

  return {
    ventas: totalSales,
    costoVentas,
    utilidadBruta,
    gastosVentas,
    gastosAdmin,
    gastosOperativos,
    ebitda,
    depAmort,
    ebit,
    intereses,
    utilidadAntesImpuestos,
    impuestos,
    utilidadNeta,
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
  config: { bancos?: number; creditosBancarios?: number; aportacionSocios?: number; utilidadesAcumuladas?: number } = {},
): BalanceSheet {
  // Activos circulantes
  const bancos = config.bancos ?? 850000;
  const cuentasPorCobrar = sum(demoAccountsReceivable.map(r => r.balance));
  const inventario = sum(demoProducts.filter(p => p.active).map(p => {
    const totalStock = Object.values(p.stock).reduce((a, b) => a + b, 0);
    return totalStock * p.cost;
  }));
  const totalCirculantes = bancos + cuentasPorCobrar + inventario;

  // Activos fijos
  const activeAssets = assets.filter(a => a.estatus === 'activo');
  const activosFijosValor = sum(activeAssets.map(a => a.costoAdquisicion));
  const depreciacionAcumulada = sum(activeAssets.map(a => calcDepreciation(a).depAcumulada));
  const activosFijosNeto = activosFijosValor - depreciacionAcumulada;
  const totalActivos = totalCirculantes + activosFijosNeto;

  // Pasivos
  const now = new Date();
  const activePay = payables.filter(p => p.status !== 'liquidada' && p.status !== 'cancelada');
  const cuentasPorPagar = sum(activePay.map(p => p.balance));

  // Aging buckets: how many days overdue
  const agingRange = (minDays: number, maxDays: number) => sum(activePay.filter(p => {
    const due = new Date(p.due_date);
    const diff = Math.floor((now.getTime() - due.getTime()) / 86400000);
    return diff >= minDays && diff < maxDays;
  }).map(p => p.balance));

  // Also include not-yet-due in "0-30" bucket
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
  const impuestosPorPagar = income.impuestos * 0.25; // estimated quarterly
  const totalPasivos = cuentasPorPagar + creditosBancarios + impuestosPorPagar;

  // Capital
  const aportacionSocios = config.aportacionSocios ?? 2000000;
  const utilidadesAcumuladas = config.utilidadesAcumuladas ?? 500000;
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
  config: { saldoInicial?: number; prestamosRecibidos?: number; pagosDeuda?: number; aportaciones?: number; compraActivos?: number } = {},
): CashFlow {
  const cobrosClientes = sum(demoAccountsReceivable.map(r => r.paid));
  const ingresosVentas = income.ventas;
  const pagosProveedores = sum(payables.filter(p => p.status === 'liquidada').map(p => p.total));
  const gastosOp = income.gastosOperativos;
  const nomina = income.gastosAdmin * 0.55; // estimated
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
  const saldoInicial = config.saldoInicial ?? 850000;

  return {
    cobrosClientes, ingresosVentas,
    pagosProveedores, gastosOperativos: gastosOp, nomina, impuestosPagados,
    flujoOperativo,
    compraActivos, ventaActivos, flujoInversion,
    prestamosRecibidos, pagosDeuda, aportacionesSocios, flujoFinanciamiento,
    flujoNeto,
    saldoInicial,
    saldoFinal: saldoInicial + flujoNeto,
  };
}

// ─── Monthly cash flow series ───────────────────────────────────
export function calcMonthlyFlow(expenses: OperatingExpense[]): MonthlyFlowItem[] {
  const totalExpMonthly = expenses.length > 0
    ? sum(expenses.map(e => e.monto)) / 12
    : sum(demoExpenses.map(e => e.monto)) / 12;

  let acumulado = 850000;
  return monthlySales.map(m => {
    const entradas = m.sales;
    const salidas = m.sales * (1 - dashboardMetrics.grossMargin / 100) + totalExpMonthly;
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
    liquidez,
    endeudamiento,
    diasInventario,
    diasCxC,
    diasCxP,
    cicloConversionEfectivo,
    rotacionInventario,
    capitalEnInventario: balance.inventario,
  };
}
