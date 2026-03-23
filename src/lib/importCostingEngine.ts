/**
 * REDBUCK – Import Costing Engine
 * Centralized landed-cost calculation with FOB proration, markup, and IVA.
 *
 * All derived values are computed in-memory; no DB schema changes required.
 */

// ─── Types ──────────────────────────────────────────────────────────

export type ProrationMethod = 'fob' | 'quantity' | 'weight' | 'volume' | 'fixed';

export interface CostingParams {
  /** Markup / profit factor applied to unit landed cost. Default 2.2 */
  markupFactor: number;
  /** IVA rate (0-1). Default 0.16 */
  ivaRate: number;
  /** Sales commission rate (0-1). Default 0.15 */
  commissionRate: number;
  /** Admin overhead rate (0-1). Default 0.025 */
  adminRate: number;
  /** Proration method. Default 'fob' */
  prorationMethod: ProrationMethod;
}

export const DEFAULT_COSTING_PARAMS: CostingParams = {
  markupFactor: 2.2,
  ivaRate: 0.16,
  commissionRate: 0.15,
  adminRate: 0.025,
  prorationMethod: 'fob',
};

export interface CostingItemInput {
  productName: string;
  qty: number;
  unitCost: number; // FOB unit cost
}

export interface CostingItemResult extends CostingItemInput {
  subtotalFob: number;
  fobShare: number;           // 0–1
  importExpenseAllocated: number;
  totalLanded: number;
  unitLanded: number;
  priceBeforeIva: number;     // unitLanded * markupFactor
  priceWithIva: number;       // priceBeforeIva * (1 + iva)
  commissionAmount: number;   // priceBeforeIva * commissionRate
  adminAmount: number;        // priceBeforeIva * adminRate
  netMargin: number;          // priceBeforeIva - unitLanded - commissionAmount - adminAmount
  marginPercent: number;      // netMargin / priceBeforeIva (0-1)
}

export interface CostingSummary {
  totalFob: number;
  totalImportExpenses: number;
  totalLanded: number;
  expenseToFobRatio: number;  // KPI: gastos / FOB
  items: CostingItemResult[];
  params: CostingParams;
}

// ─── Safe number helpers ────────────────────────────────────────────

function safeNum(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function safeDivide(numerator: number, denominator: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return 0;
  return numerator / denominator;
}

// ─── Main calculation ───────────────────────────────────────────────

export function calculateImportCosting(
  items: CostingItemInput[],
  importExpenses: number,
  params: Partial<CostingParams> = {},
): CostingSummary {
  const p: CostingParams = { ...DEFAULT_COSTING_PARAMS, ...params };
  const totalImportExpenses = safeNum(importExpenses);

  // 1-2. Subtotal FOB per item & total FOB
  const itemsWithFob = items.map(it => ({
    ...it,
    qty: safeNum(it.qty),
    unitCost: safeNum(it.unitCost),
    subtotalFob: safeNum(it.qty) * safeNum(it.unitCost),
  }));

  const totalFob = itemsWithFob.reduce((s, it) => s + it.subtotalFob, 0);

  // 3-9. Per-item calculations
  const resultItems: CostingItemResult[] = itemsWithFob.map(it => {
    // 4. FOB share
    const fobShare = safeDivide(it.subtotalFob, totalFob);

    // 5. Import expense allocated
    const importExpenseAllocated = fobShare * totalImportExpenses;

    // 6. Total landed
    const totalLanded = it.subtotalFob + importExpenseAllocated;

    // 7. Unit landed
    const unitLanded = safeDivide(totalLanded, it.qty);

    // 8. Price before IVA (markup)
    const priceBeforeIva = unitLanded * safeNum(p.markupFactor);

    // 9. Price with IVA
    const priceWithIva = priceBeforeIva * (1 + safeNum(p.ivaRate));

    // 10. Commercial logic
    const commissionAmount = priceBeforeIva * safeNum(p.commissionRate);
    const adminAmount = priceBeforeIva * safeNum(p.adminRate);
    const netMargin = priceBeforeIva - unitLanded - commissionAmount - adminAmount;
    const marginPercent = safeDivide(netMargin, priceBeforeIva);

    return {
      productName: it.productName,
      qty: it.qty,
      unitCost: it.unitCost,
      subtotalFob: it.subtotalFob,
      fobShare,
      importExpenseAllocated,
      totalLanded,
      unitLanded,
      priceBeforeIva,
      priceWithIva,
      commissionAmount,
      adminAmount,
      netMargin,
      marginPercent,
    };
  });

  const totalLanded = totalFob + totalImportExpenses;
  const expenseToFobRatio = safeDivide(totalImportExpenses, totalFob);

  return {
    totalFob,
    totalImportExpenses,
    totalLanded,
    expenseToFobRatio,
    items: resultItems,
    params: p,
  };
}
