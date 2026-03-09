/**
 * REDBUCK – Detector de Fugas de Dinero
 * Analyzes existing data to find where money is leaking or stuck.
 * All functions accept real data as parameters — no demo-data imports.
 */

import type { DBAccountPayable } from '@/hooks/useAccountsPayable';

// ─── Input types (minimal shape needed) ─────────────────────────

export interface LeakProduct {
  id: string;
  name: string;
  sku: string;
  cost: number;
  listPrice: number;
  minPrice: number;
  active: boolean;
  stock: Record<string, number>;
  deliveryDays: number;
}

export interface LeakOrder {
  items: { productName: string; qty: number }[];
  createdAt: string;
  status: string;
}

export interface LeakReceivable {
  customerId: string;
  customerName: string;
  balance: number;
  total: number;
  daysOverdue: number;
}

// ─── Output types ───────────────────────────────────────────────

export interface SlowInventoryItem {
  productId: string;
  name: string;
  sku: string;
  totalStock: number;
  costPerUnit: number;
  capitalDetenido: number;
  diasSinVenta: number;
  severity: 'critico' | 'alto' | 'medio';
}

export interface LowMarginProduct {
  productId: string;
  name: string;
  sku: string;
  cost: number;
  listPrice: number;
  minPrice: number;
  margenLista: number;
  margenMinimo: number;
  totalStock: number;
  capitalEnRiesgo: number;
  severity: 'critico' | 'alto' | 'medio';
}

export interface CapitalConsumingClient {
  customerId: string;
  customerName: string;
  saldoPorCobrar: number;
  totalFacturado: number;
  diasPromedioCobro: number;
  facturasPendientes: number;
  severity: 'critico' | 'alto' | 'medio';
}

export interface ExcessInventoryItem {
  productId: string;
  name: string;
  sku: string;
  stockActual: number;
  stockRecomendado: number;
  exceso: number;
  capitalExceso: number;
  severity: 'critico' | 'alto' | 'medio';
}

export interface PaymentPressureItem {
  periodo: string;
  totalPagar: number;
  cantidadFacturas: number;
  severity: 'critico' | 'alto' | 'medio' | 'normal';
}

export interface LeakSummary {
  capitalInventarioLento: number;
  capitalBajoMargen: number;
  capitalClientesLentos: number;
  capitalExcesoInventario: number;
  presionPagos30d: number;
  totalFugas: number;
  alertas: LeakAlert[];
}

export interface LeakAlert {
  tipo: 'inventario' | 'margen' | 'cobranza' | 'exceso' | 'pagos';
  severity: 'critico' | 'alto' | 'medio';
  titulo: string;
  descripcion: string;
  monto: number;
}

// ─── Helpers ────────────────────────────────────────────────────
const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
const totalStock = (stock: Record<string, number>) => Object.values(stock).reduce((a, b) => a + b, 0);

// ─── 1. Inventario que no rota ──────────────────────────────────
export function detectSlowInventory(products: LeakProduct[], orders: LeakOrder[], thresholdDays = 60): SlowInventoryItem[] {
  const lastSaleMap = new Map<string, string>();
  for (const order of orders) {
    if (order.status === 'cancelado') continue;
    for (const item of order.items) {
      const product = products.find(p => item.productName?.includes(p.name.split(' ').slice(0, 2).join(' ')));
      if (product) {
        const existing = lastSaleMap.get(product.id);
        if (!existing || order.createdAt > existing) {
          lastSaleMap.set(product.id, order.createdAt);
        }
      }
    }
  }

  const now = new Date();
  const results: SlowInventoryItem[] = [];

  for (const p of products.filter(pr => pr.active)) {
    const stock = totalStock(p.stock);
    if (stock === 0) continue;

    const lastSale = lastSaleMap.get(p.id);
    const diasSinVenta = lastSale
      ? Math.floor((now.getTime() - new Date(lastSale).getTime()) / 86400000)
      : 180;

    if (diasSinVenta >= thresholdDays) {
      results.push({
        productId: p.id, name: p.name, sku: p.sku,
        totalStock: stock, costPerUnit: p.cost,
        capitalDetenido: stock * p.cost, diasSinVenta,
        severity: diasSinVenta > 120 ? 'critico' : diasSinVenta > 90 ? 'alto' : 'medio',
      });
    }
  }

  return results.sort((a, b) => b.capitalDetenido - a.capitalDetenido);
}

// ─── 2. Productos con bajo margen ───────────────────────────────
export function detectLowMarginProducts(products: LeakProduct[], thresholdPct = 25): LowMarginProduct[] {
  const results: LowMarginProduct[] = [];

  for (const p of products.filter(pr => pr.active)) {
    const margenLista = p.listPrice > 0 ? ((p.listPrice - p.cost) / p.listPrice) * 100 : 0;
    const margenMinimo = p.minPrice > 0 ? ((p.minPrice - p.cost) / p.minPrice) * 100 : 0;
    const stock = totalStock(p.stock);

    if (margenMinimo < thresholdPct) {
      results.push({
        productId: p.id, name: p.name, sku: p.sku,
        cost: p.cost, listPrice: p.listPrice, minPrice: p.minPrice,
        margenLista, margenMinimo, totalStock: stock,
        capitalEnRiesgo: stock * p.cost,
        severity: margenMinimo < 15 ? 'critico' : margenMinimo < 20 ? 'alto' : 'medio',
      });
    }
  }

  return results.sort((a, b) => a.margenMinimo - b.margenMinimo);
}

// ─── 3. Clientes que consumen capital ───────────────────────────
export function detectCapitalConsumingClients(receivables: LeakReceivable[], thresholdDays = 30): CapitalConsumingClient[] {
  const clientMap = new Map<string, { name: string; balance: number; total: number; count: number; maxDays: number }>();

  for (const ar of receivables) {
    const existing = clientMap.get(ar.customerId) ?? { name: ar.customerName, balance: 0, total: 0, count: 0, maxDays: 0 };
    existing.balance += ar.balance;
    existing.total += ar.total;
    existing.count += 1;
    existing.maxDays = Math.max(existing.maxDays, ar.daysOverdue);
    clientMap.set(ar.customerId, existing);
  }

  const results: CapitalConsumingClient[] = [];
  for (const [id, data] of clientMap) {
    if (data.balance <= 0) continue;
    const diasPromedio = data.maxDays > 0 ? data.maxDays : Math.round((data.balance / data.total) * 30);

    if (diasPromedio >= thresholdDays || data.balance > 30000) {
      results.push({
        customerId: id, customerName: data.name,
        saldoPorCobrar: data.balance, totalFacturado: data.total,
        diasPromedioCobro: diasPromedio, facturasPendientes: data.count,
        severity: diasPromedio > 60 ? 'critico' : diasPromedio > 30 ? 'alto' : 'medio',
      });
    }
  }

  return results.sort((a, b) => b.saldoPorCobrar - a.saldoPorCobrar);
}

// ─── 4. Exceso de inventario ────────────────────────────────────
export function detectExcessInventory(products: LeakProduct[], orders: LeakOrder[]): ExcessInventoryItem[] {
  const salesMap = new Map<string, number>();
  for (const order of orders) {
    if (order.status === 'cancelado') continue;
    for (const item of order.items) {
      const product = products.find(p => item.productName?.includes(p.name.split(' ').slice(0, 2).join(' ')));
      if (product) {
        salesMap.set(product.id, (salesMap.get(product.id) ?? 0) + item.qty);
      }
    }
  }

  const results: ExcessInventoryItem[] = [];

  for (const p of products.filter(pr => pr.active)) {
    const stock = totalStock(p.stock);
    const monthlySales = (salesMap.get(p.id) ?? 0.5);
    const leadTimeMonths = p.deliveryDays / 30;
    const stockRecomendado = Math.ceil(monthlySales * (2 + leadTimeMonths));

    const exceso = stock - stockRecomendado;
    if (exceso > 0) {
      results.push({
        productId: p.id, name: p.name, sku: p.sku,
        stockActual: stock, stockRecomendado, exceso,
        capitalExceso: exceso * p.cost,
        severity: exceso > stockRecomendado ? 'critico' : exceso > stockRecomendado * 0.5 ? 'alto' : 'medio',
      });
    }
  }

  return results.sort((a, b) => b.capitalExceso - a.capitalExceso);
}

// ─── 5. Presión de pagos ────────────────────────────────────────
export function detectPaymentPressure(payables: DBAccountPayable[]): PaymentPressureItem[] {
  const now = new Date();
  const active = payables.filter(p => p.status !== 'liquidada' && p.status !== 'cancelada');

  const buckets = [
    { periodo: 'Vencidas', min: -99999, max: 0 },
    { periodo: '0-15 días', min: 0, max: 15 },
    { periodo: '16-30 días', min: 15, max: 30 },
    { periodo: '31-60 días', min: 30, max: 60 },
    { periodo: '61-90 días', min: 60, max: 90 },
    { periodo: '90+ días', min: 90, max: 99999 },
  ];

  const avgMonthlyPayments = active.length > 0 ? sum(active.map(p => p.balance)) / 3 : 50000;

  return buckets.map(bucket => {
    const matching = active.filter(p => {
      const daysUntilDue = Math.floor((new Date(p.due_date).getTime() - now.getTime()) / 86400000);
      return daysUntilDue > bucket.min && daysUntilDue <= bucket.max;
    });
    const totalPagar = sum(matching.map(p => p.balance));
    return {
      periodo: bucket.periodo, totalPagar,
      cantidadFacturas: matching.length,
      severity: bucket.periodo === 'Vencidas' && totalPagar > 0 ? 'critico' as const
        : totalPagar > avgMonthlyPayments ? 'alto' as const
        : totalPagar > 0 ? 'medio' as const
        : 'normal' as const,
    };
  });
}

// ─── 6. Summary & Alerts ────────────────────────────────────────
export function calcLeakSummary(
  products: LeakProduct[],
  orders: LeakOrder[],
  receivables: LeakReceivable[],
  payables: DBAccountPayable[],
): LeakSummary {
  const slow = detectSlowInventory(products, orders);
  const lowMargin = detectLowMarginProducts(products);
  const clients = detectCapitalConsumingClients(receivables);
  const excess = detectExcessInventory(products, orders);
  const pressure = detectPaymentPressure(payables);

  const capitalInventarioLento = sum(slow.map(s => s.capitalDetenido));
  const capitalBajoMargen = sum(lowMargin.map(l => l.capitalEnRiesgo));
  const capitalClientesLentos = sum(clients.map(c => c.saldoPorCobrar));
  const capitalExcesoInventario = sum(excess.map(e => e.capitalExceso));
  const presionPagos30d = sum(pressure.filter(p => p.periodo === 'Vencidas' || p.periodo === '0-15 días' || p.periodo === '16-30 días').map(p => p.totalPagar));

  const alertas: LeakAlert[] = [];

  if (capitalInventarioLento > 0) {
    alertas.push({
      tipo: 'inventario', severity: capitalInventarioLento > 500000 ? 'critico' : 'alto',
      titulo: 'Inventario detenido',
      descripcion: `${slow.length} productos sin venta reciente con capital detenido`,
      monto: capitalInventarioLento,
    });
  }
  if (lowMargin.length > 0) {
    alertas.push({
      tipo: 'margen', severity: lowMargin.some(l => l.margenMinimo < 15) ? 'critico' : 'alto',
      titulo: 'Productos con bajo margen',
      descripcion: `${lowMargin.length} productos con margen mínimo debajo del umbral`,
      monto: capitalBajoMargen,
    });
  }
  if (capitalClientesLentos > 0) {
    alertas.push({
      tipo: 'cobranza', severity: capitalClientesLentos > 100000 ? 'critico' : 'alto',
      titulo: 'Cobranza lenta',
      descripcion: `${clients.length} clientes con saldo elevado o pagos lentos`,
      monto: capitalClientesLentos,
    });
  }
  if (capitalExcesoInventario > 0) {
    alertas.push({
      tipo: 'exceso', severity: capitalExcesoInventario > 300000 ? 'critico' : 'medio',
      titulo: 'Exceso de inventario',
      descripcion: `${excess.length} productos con stock superior al recomendado`,
      monto: capitalExcesoInventario,
    });
  }
  if (presionPagos30d > 0) {
    const overdue = pressure.find(p => p.periodo === 'Vencidas');
    if (overdue && overdue.totalPagar > 0) {
      alertas.push({
        tipo: 'pagos', severity: 'critico',
        titulo: 'Pagos vencidos',
        descripcion: `${overdue.cantidadFacturas} facturas vencidas por pagar`,
        monto: overdue.totalPagar,
      });
    }
  }

  return {
    capitalInventarioLento, capitalBajoMargen, capitalClientesLentos,
    capitalExcesoInventario, presionPagos30d,
    totalFugas: capitalInventarioLento + capitalClientesLentos + capitalExcesoInventario,
    alertas: alertas.sort((a, b) => {
      const sev = { critico: 3, alto: 2, medio: 1 };
      return sev[b.severity] - sev[a.severity];
    }),
  };
}
