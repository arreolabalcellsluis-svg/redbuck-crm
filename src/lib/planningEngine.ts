/**
 * REDBUCK – Planning Engine v2
 * Predictive stockout engine with weighted demand, useful inventory,
 * coverage calculations, 5-level supply classification, and purchase suggestions.
 */

import { demoProducts, demoOrders, demoQuotations, demoImports } from '@/data/demo-data';
import type { Product, ImportOrder } from '@/types';

// ─── helpers ────────────────────────────────────────────────────────
const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
const fmt = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);

// ─── Lead-time defaults (days) ──────────────────────────────────────
export interface LeadTime {
  production: number;
  freightChina: number;
  ocean: number;
  customs: number;
  nationalTransport: number;
  total: number;
}

function getLeadTime(p: Product): LeadTime {
  const isImported = (p.supplier ?? '').toLowerCase().includes('china') ||
    (p.supplier ?? '').toLowerCase().includes('guangzhou') ||
    (p.supplier ?? '').toLowerCase().includes('zhongshan') ||
    (p.supplier ?? '').toLowerCase().includes('shenzhen');

  if (isImported) {
    const production = 15;
    const freightChina = 5;
    const ocean = 30;
    const customs = 7;
    const nationalTransport = 3;
    return { production, freightChina, ocean, customs, nationalTransport, total: production + freightChina + ocean + customs + nationalTransport };
  }
  return { production: 0, freightChina: 0, ocean: 0, customs: 0, nationalTransport: p.deliveryDays ?? 5, total: p.deliveryDays ?? 5 };
}

// ─── Configurable parameters ────────────────────────────────────────
export const PLANNING_CONFIG = {
  alertAnticipationDays: 60,
  defaultCoverageTargetDays: 90,
  safetyStockDays: 15,
  demandWeights: { last30: 0.4, last90: 0.3, last180: 0.2, annual: 0.1 },
  transitConfidence: {
    produccion: 0.5,
    flete_local_china: 0.6,
    puerto_china: 0.65,
    embarcado: 0.75,
    transito_maritimo: 0.8,
    puerto_mexico: 0.85,
    aduana: 0.85,
    liberado_aduana: 0.9,
    transito_local: 0.95,
    llego_bodega: 1.0,
    inventario_disponible: 1.0,
    orden_enviada: 0.3,
    anticipo_pagado: 0.4,
  } as Record<string, number>,
  categoryPriority: {
    elevadores: 'alta',
    alineadoras: 'alta',
    balanceadoras: 'media',
    desmontadoras: 'media',
    hidraulico: 'baja',
    lubricacion: 'baja',
    aire: 'baja',
    otros: 'baja',
  } as Record<string, string>,
  overstockThresholds: {
    elevadores: { maxCoverage: 240 },
    alineadoras: { maxCoverage: 240 },
    balanceadoras: { maxCoverage: 180 },
    desmontadoras: { maxCoverage: 180 },
    hidraulico: { maxCoverage: 150 },
    lubricacion: { maxCoverage: 120 },
    aire: { maxCoverage: 120 },
    otros: { maxCoverage: 150 },
  } as Record<string, { maxCoverage: number }>,
};

// ─── Supply status (5 levels) ───────────────────────────────────────
export type SupplyStatus = 'saludable' | 'vigilar' | 'comprar_pronto' | 'compra_inmediata' | 'riesgo_desabasto';

export const SUPPLY_STATUS_LABELS: Record<SupplyStatus, string> = {
  saludable: 'Stock saludable',
  vigilar: 'Vigilar',
  comprar_pronto: 'Comprar pronto',
  compra_inmediata: 'Compra inmediata',
  riesgo_desabasto: 'Riesgo de desabasto',
};

export const SUPPLY_STATUS_COLORS: Record<SupplyStatus, { bg: string; text: string }> = {
  saludable: { bg: 'bg-success/10', text: 'text-success' },
  vigilar: { bg: 'bg-primary/10', text: 'text-primary' },
  comprar_pronto: { bg: 'bg-warning/10', text: 'text-warning' },
  compra_inmediata: { bg: 'bg-destructive/10', text: 'text-destructive' },
  riesgo_desabasto: { bg: 'bg-destructive/20', text: 'text-destructive' },
};

// ─── Sales history (simulated with weighted demand) ─────────────────
function getSalesData(productId: string) {
  const product = demoProducts.find(p => p.id === productId);
  if (!product) return { last30: 0, last90: 0, last180: 0, annual: 0 };

  const orderUnits = demoOrders.reduce((s, o) => {
    const item = o.items.find(i => i.productName === product.name || i.productName.includes(product.name.split(' ')[0]));
    return s + (item?.qty ?? 0);
  }, 0);

  // Simulate different period velocities with some variance
  const baseMonthly = Math.max(orderUnits / 6, 0.3);
  // Recent months sell slightly more (simulating growth trend)
  const trendFactor = 1 + (Math.random() * 0.3 - 0.1); // -10% to +20% recent trend
  const last30 = baseMonthly * trendFactor;
  const last90 = baseMonthly * (trendFactor * 0.9 + 0.1);
  const last180 = baseMonthly * 0.95;
  const annual = baseMonthly * 12;

  return { last30, last90: last90 * 3, last180: last180 * 6, annual };
}

function getWeightedDemand(productId: string): { dailyDemand: number; monthlyDemand: number; trend: 'crecimiento' | 'estable' | 'caida' } {
  const sales = getSalesData(productId);
  const w = PLANNING_CONFIG.demandWeights;

  // Normalize to monthly rates
  const rate30 = sales.last30;
  const rate90 = sales.last90 / 3;
  const rate180 = sales.last180 / 6;
  const rateAnnual = sales.annual / 12;

  const weightedMonthly = (rate30 * w.last30) + (rate90 * w.last90) + (rate180 * w.last180) + (rateAnnual * w.annual);
  const dailyDemand = weightedMonthly / 30;

  // Trend detection
  let trend: 'crecimiento' | 'estable' | 'caida' = 'estable';
  if (rate30 > rate90 * 1.15) trend = 'crecimiento';
  else if (rate30 < rate90 * 0.85) trend = 'caida';

  return { dailyDemand, monthlyDemand: weightedMonthly, trend };
}

// ─── Quotation demand (pipeline) ────────────────────────────────────
function getQuotationDemand(productId: string): number {
  const product = demoProducts.find(p => p.id === productId);
  if (!product) return 0;
  return demoQuotations
    .filter(q => q.status === 'enviada' || q.status === 'seguimiento')
    .reduce((s, q) => {
      const item = q.items.find(i => i.productId === productId);
      return s + (item?.qty ?? 0);
    }, 0);
}

// ─── Useful inventory (not gross stock) ─────────────────────────────
function getUsefulInventory(product: Product): {
  grossStock: number;
  committed: number;
  exhibition: number;
  usefulStock: number;
  stockByWarehouse: Record<string, number>;
} {
  if (!product.stock) return { grossStock: 0, committed: 0, exhibition: 0, usefulStock: 0, stockByWarehouse: {} };
  const grossStock = Object.values(product.stock).reduce((a, b) => a + b, 0);

  // Simulate committed stock from active orders
  const committed = demoOrders
    .filter(o => ['confirmado', 'confirmado_anticipo', 'apartado', 'entrega_programada', 'surtido_parcial'].includes(o.status))
    .reduce((s, o) => {
      const item = o.items.find(i => i.productName === product.name || i.productName.includes(product.name.split(' ')[0]));
      return s + (item?.qty ?? 0);
    }, 0);

  // Exhibition stock (1 unit per warehouse with exhibition)
  const exhibition = Object.keys(product.stock).length > 0 ? 1 : 0;

  const usefulStock = Math.max(0, grossStock - committed - exhibition);

  return { grossStock, committed, exhibition, usefulStock, stockByWarehouse: product.stock };
}

// ─── Transit analysis with confidence ───────────────────────────────
export interface TransitDetail {
  importId: string;
  orderNumber: string;
  qty: number;
  status: string;
  confidence: number;
  effectiveQty: number;
  eta: string;
  etaDays: number;
  arrivesBeforeStockout: boolean;
}

function getTransitDetails(product: Product): TransitDetail[] {
  const today = new Date();
  const details: TransitDetail[] = [];

  demoImports.forEach(imp => {
    imp.items.forEach(item => {
      if (item.productName === product.name || item.productName.includes(product.name.split(' ')[0])) {
        const confidence = PLANNING_CONFIG.transitConfidence[imp.status] ?? 0.5;
        const eta = new Date(imp.estimatedArrival);
        const etaDays = Math.max(0, Math.round((eta.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));

        details.push({
          importId: imp.id,
          orderNumber: imp.orderNumber,
          qty: item.qty,
          status: imp.status,
          confidence,
          effectiveQty: Math.round(item.qty * confidence),
          eta: imp.estimatedArrival,
          etaDays,
          arrivesBeforeStockout: false, // calculated later
        });
      }
    });
  });

  return details;
}

// ─── Overstock types ────────────────────────────────────────────────
export type OverstockStatus = 'optimo' | 'vigilar_exceso' | 'sobreinventario' | 'riesgo_muerto';

export const OVERSTOCK_STATUS_LABELS: Record<OverstockStatus, string> = {
  optimo: 'Stock óptimo',
  vigilar_exceso: 'Vigilar',
  sobreinventario: 'Sobreinventario',
  riesgo_muerto: 'Riesgo inv. muerto',
};

export const OVERSTOCK_STATUS_COLORS: Record<OverstockStatus, { bg: string; text: string }> = {
  optimo: { bg: 'bg-success/10', text: 'text-success' },
  vigilar_exceso: { bg: 'bg-warning/10', text: 'text-warning' },
  sobreinventario: { bg: 'bg-destructive/10', text: 'text-destructive' },
  riesgo_muerto: { bg: 'bg-destructive/20', text: 'text-destructive' },
};

export type OverstockSuggestion = 'no_comprar' | 'promover' | 'descuento' | 'liquidar' | 'mover_bodega' | 'ofrecer_distribuidores' | 'mantener';

export const OVERSTOCK_SUGGESTION_LABELS: Record<OverstockSuggestion, string> = {
  no_comprar: 'No comprar más',
  promover: 'Promover activamente',
  descuento: 'Aplicar descuento',
  liquidar: 'Liquidar stock',
  mover_bodega: 'Mover a otra bodega',
  ofrecer_distribuidores: 'Ofrecer a distribuidores',
  mantener: 'Mantener sin cambios',
};

// ─── Import planning types ──────────────────────────────────────────
export type PurchaseUrgency = 'no_necesaria' | 'compra_futura' | 'compra_recomendada' | 'compra_urgente' | 'riesgo_desabasto_imp';

export const PURCHASE_URGENCY_LABELS: Record<PurchaseUrgency, string> = {
  no_necesaria: 'No necesaria',
  compra_futura: 'Compra futura',
  compra_recomendada: 'Recomendada',
  compra_urgente: 'Urgente',
  riesgo_desabasto_imp: 'Riesgo desabasto',
};

export const PURCHASE_URGENCY_COLORS: Record<PurchaseUrgency, { bg: string; text: string }> = {
  no_necesaria: { bg: 'bg-success/10', text: 'text-success' },
  compra_futura: { bg: 'bg-primary/10', text: 'text-primary' },
  compra_recomendada: { bg: 'bg-warning/10', text: 'text-warning' },
  compra_urgente: { bg: 'bg-destructive/10', text: 'text-destructive' },
  riesgo_desabasto_imp: { bg: 'bg-destructive/20', text: 'text-destructive' },
};

// ─── Product analysis row (v2 predictive) ───────────────────────────
export interface ProductAnalysis {
  product: Product;
  // Stock
  totalStock: number;
  grossStock: number;
  committed: number;
  exhibition: number;
  usefulStock: number;
  stockByWarehouse: Record<string, number>;
  inTransit: number;
  transitDetails: TransitDetail[];
  effectiveTransit: number;
  nextEta: string | null;
  nextEtaDays: number | null;
  availableStock: number;
  // Demand
  monthlySales: number;
  quarterlySales: number;
  annualSales: number;
  demand3m: number;
  demand6m: number;
  demand12m: number;
  dailyDemand: number;
  predictiveDailyDemand: number;
  predictiveMonthlyDemand: number;
  demandTrend: 'crecimiento' | 'estable' | 'caida';
  // Coverage
  leadTime: LeadTime;
  reorderPoint: number;
  idealStock: number;
  stockDifference: number;
  suggestedPurchase: number;
  quotationDemand: number;
  daysOfStock: number;
  daysOfStockWithTransit: number;
  stockoutDate: string | null;
  // Supply status
  supplyStatus: SupplyStatus;
  supplyExplanation: string;
  urgencyScore: number;
  // Overstock
  overstockStatus: OverstockStatus;
  overstockExplanation: string;
  overstockSuggestions: OverstockSuggestion[];
  excessUnits: number;
  excessValue: number;
  coverageMonths: number;
  totalProjectedStock: number;
  shouldNotBuy: boolean;
  // Import planning
  purchaseUrgency: PurchaseUrgency;
  idealPurchaseDate: string | null;
  daysUntilPurchase: number | null;
  // Strategy
  margin: number;
  annualRevenue: number;
  annualProfit: number;
  category: 'estrella' | 'rotacion' | 'premium' | 'problematico';
  riskLevel: 'critico' | 'alerta' | 'ok' | 'excedente';
  deadStockDays: number;
  stockValue: number;
  repositionValue: number;
  categoryPriority: string;
  safetyStock: number;
  coverageTargetDays: number;
}

const COVERAGE_MONTHS = 3;

export function analyzeProducts(): ProductAnalysis[] {
  return demoProducts.filter(p => p.active).map(product => {
    // ── Useful inventory ──
    const inv = getUsefulInventory(product);
    const transitDetails = getTransitDetails(product);
    const effectiveTransit = sum(transitDetails.map(t => t.effectiveQty));
    const totalInTransit = product.inTransit ?? sum(transitDetails.map(t => t.qty));

    // Next ETA
    const sortedTransits = [...transitDetails].sort((a, b) => a.etaDays - b.etaDays);
    const nextEta = sortedTransits[0]?.eta ?? null;
    const nextEtaDays = sortedTransits[0]?.etaDays ?? null;

    // ── Demand (weighted predictive) ──
    const demand = getWeightedDemand(product.id);
    const salesData = getSalesData(product.id);
    const monthly = demand.monthlyDemand;
    const quarterly = monthly * 3;
    const annual = monthly * 12;
    const demand3m = Math.ceil(monthly * 3);
    const demand6m = Math.ceil(monthly * 6);
    const demand12m = Math.ceil(monthly * 12);

    // ── Lead time & reorder ──
    const leadTime = getLeadTime(product);
    const safetyStock = Math.ceil(demand.dailyDemand * PLANNING_CONFIG.safetyStockDays);
    const reorderPoint = Math.ceil(demand.dailyDemand * leadTime.total) + safetyStock;
    const coverageTargetDays = PLANNING_CONFIG.defaultCoverageTargetDays;
    const idealStock = Math.ceil(demand.dailyDemand * coverageTargetDays);
    const stockDifference = idealStock - (inv.usefulStock + effectiveTransit);
    const suggestedPurchase = Math.max(0, Math.ceil(
      (demand.dailyDemand * coverageTargetDays + safetyStock) - inv.usefulStock - effectiveTransit
    ));
    const quotationDemand = getQuotationDemand(product.id);

    // ── Coverage ──
    const daysOfStock = demand.dailyDemand > 0 ? Math.round(inv.usefulStock / demand.dailyDemand) : 999;
    const daysOfStockWithTransit = demand.dailyDemand > 0
      ? Math.round((inv.usefulStock + effectiveTransit) / demand.dailyDemand)
      : 999;

    // Stockout date
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    let stockoutDate: string | null = null;
    if (daysOfStock < 365) {
      const sDate = new Date(today);
      sDate.setDate(sDate.getDate() + daysOfStock);
      stockoutDate = sDate.toISOString().split('T')[0];
    }

    // Check if transit arrives before stockout
    transitDetails.forEach(t => {
      t.arrivesBeforeStockout = t.etaDays <= daysOfStock;
    });

    // ── Supply status (5-level) ──
    const totalCoverageDays = daysOfStockWithTransit;
    const criticalThreshold = leadTime.total + PLANNING_CONFIG.alertAnticipationDays;
    let supplyStatus: SupplyStatus;
    let supplyExplanation: string;
    let urgencyScore: number;

    if (daysOfStock <= 0 || (daysOfStock < leadTime.total && effectiveTransit === 0)) {
      supplyStatus = 'riesgo_desabasto';
      supplyExplanation = `Stock útil de ${inv.usefulStock} uds cubre solo ${daysOfStock} días. Lead time de reposición: ${leadTime.total} días. ${effectiveTransit > 0 ? `Tránsito de ${effectiveTransit} uds llega en ${nextEtaDays}d, pero no alcanzará.` : 'Sin inventario en tránsito.'}`;
      urgencyScore = 100;
    } else if (daysOfStock < leadTime.total) {
      // Stock will run out before reposition, but has some transit
      const transitHelps = transitDetails.some(t => t.arrivesBeforeStockout);
      if (!transitHelps) {
        supplyStatus = 'riesgo_desabasto';
        supplyExplanation = `Cobertura actual: ${daysOfStock}d. Lead time: ${leadTime.total}d. Tránsito de ${effectiveTransit} uds llega en ${nextEtaDays}d, DESPUÉS del agotamiento estimado.`;
        urgencyScore = 95;
      } else {
        supplyStatus = 'compra_inmediata';
        supplyExplanation = `Cobertura actual: ${daysOfStock}d, menor al lead time (${leadTime.total}d). Tránsito llega a tiempo pero se debe comprar ya para siguiente ciclo.`;
        urgencyScore = 80;
      }
    } else if (totalCoverageDays <= criticalThreshold) {
      supplyStatus = 'compra_inmediata';
      supplyExplanation = `Cobertura total (stock + tránsito): ${totalCoverageDays}d. Con lead time de ${leadTime.total}d + ${PLANNING_CONFIG.alertAnticipationDays}d de anticipación, requiere compra inmediata.`;
      urgencyScore = 75;
    } else if (totalCoverageDays <= criticalThreshold + 30) {
      supplyStatus = 'comprar_pronto';
      supplyExplanation = `Cobertura total: ${totalCoverageDays}d. Se acerca al umbral de compra (${criticalThreshold}d). Programar compra en los próximos 30 días.`;
      urgencyScore = 50;
    } else if (totalCoverageDays <= criticalThreshold + 60) {
      supplyStatus = 'vigilar';
      supplyExplanation = `Cobertura total: ${totalCoverageDays}d. Aún saludable pero debe monitorearse.${demand.trend === 'crecimiento' ? ' Tendencia de demanda al alza.' : ''}`;
      urgencyScore = 25;
    } else {
      supplyStatus = 'saludable';
      supplyExplanation = `Cobertura total: ${totalCoverageDays}d. Stock suficiente para el horizonte de planeación.`;
      urgencyScore = 0;
    }

    // Adjust urgency for demand trend
    if (demand.trend === 'crecimiento' && supplyStatus !== 'saludable') {
      urgencyScore = Math.min(100, urgencyScore + 10);
      supplyExplanation += ' ⚡ Demanda en crecimiento reciente.';
    }

    // ── Strategy metrics ──
    const margin = product.listPrice > 0 ? Math.round(((product.listPrice - product.cost) / product.listPrice) * 100) : 0;
    const annualRevenue = annual * product.listPrice;
    const annualProfit = annual * (product.listPrice - product.cost);
    const stockValue = inv.usefulStock * product.cost;
    const repositionValue = suggestedPurchase * product.cost;

    const highSales = monthly >= 1;
    const highMargin = margin >= 35;
    let category: ProductAnalysis['category'];
    if (highSales && highMargin) category = 'estrella';
    else if (highSales && !highMargin) category = 'rotacion';
    else if (!highSales && highMargin) category = 'premium';
    else category = 'problematico';

    let riskLevel: ProductAnalysis['riskLevel'];
    if (inv.usefulStock <= reorderPoint * 0.5) riskLevel = 'critico';
    else if (inv.usefulStock <= reorderPoint) riskLevel = 'alerta';
    else if (inv.usefulStock > idealStock * 1.5) riskLevel = 'excedente';
    else riskLevel = 'ok';

    const deadStockDays = demand.dailyDemand > 0 ? Math.round(1 / demand.dailyDemand) * 2 : 365;
    const categoryPriority = PLANNING_CONFIG.categoryPriority[product.category] ?? 'baja';

    // ── Overstock analysis ──
    const totalProjectedStock = inv.usefulStock + effectiveTransit;
    const coverageMonths = demand.monthlyDemand > 0 ? totalProjectedStock / demand.monthlyDemand : 99;
    const maxCoverageDays = PLANNING_CONFIG.overstockThresholds?.[product.category]?.maxCoverage ?? 180;

    let overstockStatus: OverstockStatus;
    let overstockExplanation: string;
    const overstockSuggestions: OverstockSuggestion[] = [];

    if (daysOfStockWithTransit > 365) {
      overstockStatus = 'riesgo_muerto';
      overstockExplanation = `Cobertura total: ${daysOfStockWithTransit}d (${coverageMonths.toFixed(1)} meses). Inventario excesivo con riesgo de convertirse en muerto. Demanda mensual: ${demand.monthlyDemand.toFixed(1)} uds.`;
      overstockSuggestions.push('no_comprar', 'liquidar', 'ofrecer_distribuidores');
    } else if (daysOfStockWithTransit > 270) {
      overstockStatus = 'sobreinventario';
      overstockExplanation = `Cobertura total: ${daysOfStockWithTransit}d (${coverageMonths.toFixed(1)} meses). Inventario significativamente alto para la demanda actual.`;
      overstockSuggestions.push('no_comprar', 'promover', 'descuento');
    } else if (daysOfStockWithTransit > maxCoverageDays) {
      overstockStatus = 'vigilar_exceso';
      overstockExplanation = `Cobertura total: ${daysOfStockWithTransit}d (${coverageMonths.toFixed(1)} meses). Inventario algo alto, supera ${maxCoverageDays}d recomendados para esta categoría.`;
      overstockSuggestions.push('promover', 'mover_bodega');
    } else {
      overstockStatus = 'optimo';
      overstockExplanation = `Cobertura total: ${daysOfStockWithTransit}d (${coverageMonths.toFixed(1)} meses). Inventario dentro del rango saludable.`;
      overstockSuggestions.push('mantener');
    }

    // Excess units & value
    const optimalUnits = Math.ceil(demand.dailyDemand * maxCoverageDays);
    const excessUnits = Math.max(0, totalProjectedStock - optimalUnits);
    const excessValue = excessUnits * product.cost;

    // Should not buy
    const shouldNotBuy = daysOfStockWithTransit > maxCoverageDays || daysOfStockWithTransit > leadTime.total * 2;

    // ── Import planning ──
    let purchaseUrgency: PurchaseUrgency;
    let idealPurchaseDate: string | null = null;
    let daysUntilPurchase: number | null = null;

    if (supplyStatus === 'riesgo_desabasto') {
      purchaseUrgency = 'riesgo_desabasto_imp';
      idealPurchaseDate = todayStr;
      daysUntilPurchase = 0;
    } else if (supplyStatus === 'compra_inmediata') {
      purchaseUrgency = 'compra_urgente';
      idealPurchaseDate = todayStr;
      daysUntilPurchase = 0;
    } else if (supplyStatus === 'comprar_pronto') {
      purchaseUrgency = 'compra_recomendada';
      const daysLeft = daysOfStock - leadTime.total - PLANNING_CONFIG.safetyStockDays;
      daysUntilPurchase = Math.max(0, daysLeft);
      const pDate = new Date(today);
      pDate.setDate(pDate.getDate() + daysUntilPurchase);
      idealPurchaseDate = pDate.toISOString().split('T')[0];
    } else if (shouldNotBuy) {
      purchaseUrgency = 'no_necesaria';
      daysUntilPurchase = null;
      idealPurchaseDate = null;
    } else {
      // Calculate future purchase date
      const daysLeft = daysOfStockWithTransit - leadTime.total - PLANNING_CONFIG.safetyStockDays;
      if (daysLeft > 90) {
        purchaseUrgency = 'no_necesaria';
      } else {
        purchaseUrgency = 'compra_futura';
      }
      daysUntilPurchase = Math.max(0, daysLeft);
      const pDate = new Date(today);
      pDate.setDate(pDate.getDate() + daysUntilPurchase);
      idealPurchaseDate = pDate.toISOString().split('T')[0];
    }

    return {
      product,
      totalStock: inv.grossStock,
      grossStock: inv.grossStock,
      committed: inv.committed,
      exhibition: inv.exhibition,
      usefulStock: inv.usefulStock,
      stockByWarehouse: inv.stockByWarehouse,
      inTransit: totalInTransit,
      transitDetails,
      effectiveTransit,
      nextEta,
      nextEtaDays,
      availableStock: inv.usefulStock + effectiveTransit,
      monthlySales: monthly,
      quarterlySales: quarterly,
      annualSales: annual,
      demand3m,
      demand6m,
      demand12m,
      dailyDemand: demand.dailyDemand,
      predictiveDailyDemand: demand.dailyDemand,
      predictiveMonthlyDemand: demand.monthlyDemand,
      demandTrend: demand.trend,
      leadTime,
      reorderPoint,
      idealStock,
      stockDifference,
      suggestedPurchase,
      quotationDemand,
      daysOfStock,
      daysOfStockWithTransit,
      stockoutDate,
      supplyStatus,
      supplyExplanation,
      urgencyScore,
      overstockStatus,
      overstockExplanation,
      overstockSuggestions,
      excessUnits,
      excessValue,
      coverageMonths,
      totalProjectedStock,
      shouldNotBuy,
      purchaseUrgency,
      idealPurchaseDate,
      daysUntilPurchase,
      margin,
      annualRevenue,
      annualProfit,
      category,
      riskLevel,
      deadStockDays,
      stockValue,
      repositionValue,
      categoryPriority,
      safetyStock,
      coverageTargetDays,
    };
  });
}

// ─── Summary metrics ────────────────────────────────────────────────
export interface PlanningSummary {
  totalProducts: number;
  criticalProducts: number;
  alertProducts: number;
  excessProducts: number;
  totalStockValue: number;
  capitalNeeded: number;
  suggestedPurchaseValue: number;
  estrellas: number;
  rotacion: number;
  premium: number;
  problematicos: number;
  deadStockValue: number;
  // v2 predictive
  requirePurchase: number;
  immediateAction: number;
  stockoutRisk: number;
  totalRepositionValue: number;
  // v3 overstock
  overstockProducts: number;
  overstockRiskProducts: number;
  totalExcessValue: number;
  // v3 import planning
  purchaseSoonProducts: number;
  purchaseUrgentProducts: number;
  nextPurchaseValue: number;
}

export function getPlanningSummary(analyses: ProductAnalysis[]): PlanningSummary {
  return {
    totalProducts: analyses.length,
    criticalProducts: analyses.filter(a => a.riskLevel === 'critico').length,
    alertProducts: analyses.filter(a => a.riskLevel === 'alerta').length,
    excessProducts: analyses.filter(a => a.riskLevel === 'excedente').length,
    totalStockValue: sum(analyses.map(a => a.stockValue)),
    capitalNeeded: sum(analyses.map(a => a.suggestedPurchase * a.product.cost)),
    suggestedPurchaseValue: sum(analyses.map(a => a.suggestedPurchase * a.product.cost)),
    estrellas: analyses.filter(a => a.category === 'estrella').length,
    rotacion: analyses.filter(a => a.category === 'rotacion').length,
    premium: analyses.filter(a => a.category === 'premium').length,
    problematicos: analyses.filter(a => a.category === 'problematico').length,
    deadStockValue: sum(analyses.filter(a => a.daysOfStock > 180).map(a => a.stockValue)),
    requirePurchase: analyses.filter(a => ['comprar_pronto', 'compra_inmediata', 'riesgo_desabasto'].includes(a.supplyStatus)).length,
    immediateAction: analyses.filter(a => a.supplyStatus === 'compra_inmediata' || a.supplyStatus === 'riesgo_desabasto').length,
    stockoutRisk: analyses.filter(a => a.supplyStatus === 'riesgo_desabasto').length,
    totalRepositionValue: sum(analyses.map(a => a.repositionValue)),
    overstockProducts: analyses.filter(a => a.overstockStatus === 'sobreinventario' || a.overstockStatus === 'riesgo_muerto').length,
    overstockRiskProducts: analyses.filter(a => a.overstockStatus === 'riesgo_muerto').length,
    totalExcessValue: sum(analyses.map(a => a.excessValue)),
    purchaseSoonProducts: analyses.filter(a => a.purchaseUrgency === 'compra_recomendada').length,
    purchaseUrgentProducts: analyses.filter(a => a.purchaseUrgency === 'compra_urgente' || a.purchaseUrgency === 'riesgo_desabasto_imp').length,
    nextPurchaseValue: sum(analyses.filter(a => ['compra_recomendada', 'compra_urgente', 'riesgo_desabasto_imp'].includes(a.purchaseUrgency)).map(a => a.repositionValue)),
  };
}

// ─── Growth simulation ──────────────────────────────────────────────
export interface GrowthSimulation {
  growthFactor: number;
  currentRevenue: number;
  targetRevenue: number;
  additionalInventory: number;
  capitalRequired: number;
  estimatedProfit: number;
}

export function simulateGrowth(analyses: ProductAnalysis[], growthFactor: number): GrowthSimulation {
  const currentRevenue = sum(analyses.map(a => a.annualRevenue));
  const targetRevenue = currentRevenue * growthFactor;
  const additionalInventory = sum(analyses.map(a => {
    const newMonthly = a.monthlySales * growthFactor;
    const newIdeal = Math.ceil(newMonthly * COVERAGE_MONTHS);
    return Math.max(0, newIdeal - a.availableStock) * a.product.cost;
  }));
  const estimatedProfit = sum(analyses.map(a => a.annualProfit * growthFactor));

  return {
    growthFactor,
    currentRevenue,
    targetRevenue,
    additionalInventory,
    capitalRequired: additionalInventory,
    estimatedProfit,
  };
}

// ─── Import simulation ──────────────────────────────────────────────
export interface ImportSimulation {
  productId: string;
  productName: string;
  qty: number;
  unitCost: number;
  totalCost: number;
  freight: number;
  customs: number;
  totalInvestment: number;
  estimatedRevenue: number;
  estimatedProfit: number;
  newStock: number;
  monthsCoverage: number;
}

export function simulateImport(
  productId: string,
  qty: number,
  freightCost: number,
  customsCost: number,
  analyses: ProductAnalysis[]
): ImportSimulation | null {
  const analysis = analyses.find(a => a.product.id === productId);
  if (!analysis) return null;
  const p = analysis.product;
  const totalCost = qty * p.cost;
  const totalInvestment = totalCost + freightCost + customsCost;
  const estimatedRevenue = qty * p.listPrice;
  const estimatedProfit = estimatedRevenue - totalInvestment;
  const newStock = analysis.totalStock + qty;
  const monthsCoverage = analysis.monthlySales > 0 ? newStock / analysis.monthlySales : 99;

  return {
    productId,
    productName: p.name,
    qty,
    unitCost: p.cost,
    totalCost,
    freight: freightCost,
    customs: customsCost,
    totalInvestment,
    estimatedRevenue,
    estimatedProfit,
    newStock,
    monthsCoverage: Math.round(monthsCoverage * 10) / 10,
  };
}
