/**
 * REDBUCK – Financial Inventory Simulator
 * Analyzes capital investment, ROI, rotation, slow inventory,
 * and growth scenarios tied to inventory data.
 */

import { analyzeProducts, getPlanningSummary, simulateGrowth, type ProductAnalysis, type PlanningSummary } from './planningEngine';

const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
const fmt = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);

// ─── Capital invested breakdown ─────────────────────────────────────
export interface CapitalByCategory {
  category: string;
  units: number;
  value: number;
  pct: number;
}

export interface CapitalByWarehouse {
  warehouse: string;
  units: number;
  value: number;
  pct: number;
}

export interface CapitalByProduct {
  sku: string;
  name: string;
  category: string;
  stock: number;
  cost: number;
  value: number;
  rotation: number;
  margin: number;
  roi: number;
  monthlySales: number;
  daysOfStock: number;
  annualProfit: number;
}

// ─── Slow inventory item ────────────────────────────────────────────
export interface SlowInventoryItem {
  sku: string;
  name: string;
  category: string;
  stock: number;
  cost: number;
  value: number;
  coverageDays: number;
  coverageMonths: number;
  lastSaleDaysAgo: number;
  monthlySales: number;
  pctOfTotal: number;
}

// ─── Rotation by category ───────────────────────────────────────────
export interface RotationByCategory {
  category: string;
  annualCOGS: number;
  avgInventory: number;
  rotation: number;
  daysOfInventory: number;
}

// ─── Growth scenario ────────────────────────────────────────────────
export interface GrowthScenario {
  label: string;
  factor: number;
  currentRevenue: number;
  targetRevenue: number;
  currentInventory: number;
  requiredInventory: number;
  additionalCapital: number;
  estimatedProfit: number;
  cashFlowImpact: number;
}

// ─── Financial summary ─────────────────────────────────────────────
export interface FinancialSummary {
  totalInventoryValue: number;
  slowInventoryValue: number;
  slowInventoryPct: number;
  deadInventoryValue: number;
  deadInventoryPct: number;
  healthyInventoryValue: number;
  inventoryRotation: number;
  daysOfInventory: number;
  roi: number;
  annualCOGS: number;
  annualRevenue: number;
  annualProfit: number;
  capitalByCategory: CapitalByCategory[];
  capitalByWarehouse: CapitalByWarehouse[];
  topCapitalProducts: CapitalByProduct[];
  topROIProducts: CapitalByProduct[];
  worstROIProducts: CapitalByProduct[];
  slowInventory: SlowInventoryItem[];
  rotationByCategory: RotationByCategory[];
  growthScenarios: GrowthScenario[];
  requiredInventoryForCurrentSales: number;
  inventoryDifference: number;
  purchasePlanValue: number;
}

export function getFinancialAnalysis(analyses: ProductAnalysis[]): FinancialSummary {
  const data = analyses;
  const summary = getPlanningSummary(data);

  const totalValue = summary.totalStockValue;

  // ── Capital by category ──
  const catMap: Record<string, { units: number; value: number }> = {};
  data.forEach(a => {
    const cat = a.product.category.charAt(0).toUpperCase() + a.product.category.slice(1);
    if (!catMap[cat]) catMap[cat] = { units: 0, value: 0 };
    catMap[cat].units += a.usefulStock;
    catMap[cat].value += a.stockValue;
  });
  const capitalByCategory: CapitalByCategory[] = Object.entries(catMap)
    .map(([category, d]) => ({ category, units: d.units, value: d.value, pct: totalValue > 0 ? (d.value / totalValue) * 100 : 0 }))
    .sort((a, b) => b.value - a.value);

  // ── Capital by warehouse ──
  const whMap: Record<string, { units: number; value: number }> = {};
  data.forEach(a => {
    Object.entries(a.stockByWarehouse).forEach(([wh, qty]) => {
      const name = wh === 'w1' ? 'Bodega Principal' : wh === 'w2' ? 'Bodega Sur' : wh === 'w3' ? 'Bodega CDMX' : wh;
      if (!whMap[name]) whMap[name] = { units: 0, value: 0 };
      whMap[name].units += qty;
      whMap[name].value += qty * a.product.cost;
    });
  });
  const capitalByWarehouse: CapitalByWarehouse[] = Object.entries(whMap)
    .map(([warehouse, d]) => ({ warehouse, units: d.units, value: d.value, pct: totalValue > 0 ? (d.value / totalValue) * 100 : 0 }))
    .sort((a, b) => b.value - a.value);

  // ── Products by capital ──
  const allProducts: CapitalByProduct[] = data.map(a => {
    const annualCOGS = a.annualSales * a.product.cost;
    const avgInv = a.stockValue;
    const rotation = avgInv > 0 ? annualCOGS / avgInv : 0;
    const roi = avgInv > 0 ? (a.annualProfit / avgInv) * 100 : 0;
    return {
      sku: a.product.sku,
      name: a.product.name,
      category: a.product.category,
      stock: a.usefulStock,
      cost: a.product.cost,
      value: a.stockValue,
      rotation,
      margin: a.margin,
      roi,
      monthlySales: a.monthlySales,
      daysOfStock: a.daysOfStock,
      annualProfit: a.annualProfit,
    };
  });
  const topCapitalProducts = [...allProducts].sort((a, b) => b.value - a.value).slice(0, 10);
  const topROIProducts = [...allProducts].filter(p => p.value > 0).sort((a, b) => b.roi - a.roi).slice(0, 10);
  const worstROIProducts = [...allProducts].filter(p => p.value > 0).sort((a, b) => a.roi - b.roi).slice(0, 10);

  // ── Slow inventory (coverage > 90 days) ──
  const slowInventory: SlowInventoryItem[] = data
    .filter(a => a.daysOfStock > 90)
    .map(a => ({
      sku: a.product.sku,
      name: a.product.name,
      category: a.product.category,
      stock: a.usefulStock,
      cost: a.product.cost,
      value: a.stockValue,
      coverageDays: a.daysOfStock,
      coverageMonths: a.coverageMonths,
      lastSaleDaysAgo: Math.min(a.deadStockDays, 365),
      monthlySales: a.monthlySales,
      pctOfTotal: totalValue > 0 ? (a.stockValue / totalValue) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value);

  const slowInventoryValue = sum(slowInventory.filter(s => s.coverageDays > 180).map(s => s.value));
  const deadInventoryValue = sum(slowInventory.filter(s => s.coverageDays > 365).map(s => s.value));
  const healthyInventoryValue = totalValue - slowInventoryValue;

  // ── Rotation by category ──
  const rotCatMap: Record<string, { cogs: number; inv: number }> = {};
  data.forEach(a => {
    const cat = a.product.category.charAt(0).toUpperCase() + a.product.category.slice(1);
    if (!rotCatMap[cat]) rotCatMap[cat] = { cogs: 0, inv: 0 };
    rotCatMap[cat].cogs += a.annualSales * a.product.cost;
    rotCatMap[cat].inv += a.stockValue;
  });
  const rotationByCategory: RotationByCategory[] = Object.entries(rotCatMap)
    .map(([category, d]) => ({
      category,
      annualCOGS: d.cogs,
      avgInventory: d.inv,
      rotation: d.inv > 0 ? d.cogs / d.inv : 0,
      daysOfInventory: d.inv > 0 ? Math.round(365 / (d.cogs / d.inv)) : 999,
    }))
    .sort((a, b) => b.rotation - a.rotation);

  // ── Global rotation ──
  const annualCOGS = sum(data.map(a => a.annualSales * a.product.cost));
  const annualRevenue = sum(data.map(a => a.annualRevenue));
  const annualProfit = sum(data.map(a => a.annualProfit));
  const inventoryRotation = totalValue > 0 ? annualCOGS / totalValue : 0;
  const daysOfInventory = inventoryRotation > 0 ? Math.round(365 / inventoryRotation) : 0;
  const roi = totalValue > 0 ? (annualProfit / totalValue) * 100 : 0;

  // ── Required inventory for current sales ──
  const requiredInventoryForCurrentSales = sum(data.map(a => {
    const coverageDays = 90; // 3 months coverage
    return Math.ceil(a.predictiveDailyDemand * coverageDays) * a.product.cost;
  }));
  const inventoryDifference = totalValue - requiredInventoryForCurrentSales;

  // ── Growth scenarios ──
  const factors = [1.1, 1.25, 1.5, 2.0];
  const growthScenarios: GrowthScenario[] = factors.map(factor => {
    const sim = simulateGrowth(data, factor);
    const requiredInv = sum(data.map(a => {
      const newMonthly = a.monthlySales * factor;
      return Math.ceil(newMonthly * 3) * a.product.cost;
    }));
    return {
      label: factor === 2 ? 'Duplicar ventas' : `+${Math.round((factor - 1) * 100)}%`,
      factor,
      currentRevenue: sim.currentRevenue,
      targetRevenue: sim.targetRevenue,
      currentInventory: totalValue,
      requiredInventory: requiredInv,
      additionalCapital: Math.max(0, requiredInv - totalValue),
      estimatedProfit: sim.estimatedProfit,
      cashFlowImpact: -(Math.max(0, requiredInv - totalValue)),
    };
  });

  // Purchase plan value
  const purchasePlanValue = summary.nextPurchaseValue;

  return {
    totalInventoryValue: totalValue,
    slowInventoryValue,
    slowInventoryPct: totalValue > 0 ? (slowInventoryValue / totalValue) * 100 : 0,
    deadInventoryValue,
    deadInventoryPct: totalValue > 0 ? (deadInventoryValue / totalValue) * 100 : 0,
    healthyInventoryValue,
    inventoryRotation,
    daysOfInventory,
    roi,
    annualCOGS,
    annualRevenue,
    annualProfit,
    capitalByCategory,
    capitalByWarehouse,
    topCapitalProducts,
    topROIProducts,
    worstROIProducts,
    slowInventory,
    rotationByCategory,
    growthScenarios,
    requiredInventoryForCurrentSales,
    inventoryDifference,
    purchasePlanValue,
  };
}
