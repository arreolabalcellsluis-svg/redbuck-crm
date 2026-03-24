import { useState, useMemo, useEffect } from 'react';
import { ChevronDown, ChevronUp, Settings2 } from 'lucide-react';
import {
  calculateImportCosting,
  DEFAULT_COSTING_PARAMS,
  type CostingParams,
  type CostingItemInput,
  type CostingSummary,
} from '@/lib/importCostingEngine';

const fmtUSD = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
const fmtPct = (n: number) => `${(n * 100).toFixed(1)}%`;

interface Props {
  items: CostingItemInput[];
  freightCost: number;
  customsCost: number;
  exchangeRate: number;
}

export default function ImportCostingSummary({ items, freightCost, customsCost, exchangeRate }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [params, setParams] = useState<CostingParams>({ ...DEFAULT_COSTING_PARAMS });
  const [showParams, setShowParams] = useState(false);

  // Per-item markup factors, keyed by index. Defaults to global markupFactor.
  const [itemMarkups, setItemMarkups] = useState<Record<number, number>>({});

  // When global markupFactor changes, reset items that haven't been individually modified
  const prevGlobalMarkup = useState(params.markupFactor)[0];
  useEffect(() => {
    // Reset all item markups to new global value
    const reset: Record<number, number> = {};
    items.forEach((_, i) => { reset[i] = params.markupFactor; });
    setItemMarkups(reset);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.markupFactor, items.length]);

  const getItemMarkup = (index: number) => itemMarkups[index] ?? params.markupFactor;

  const importExpenses = (freightCost || 0) + (customsCost || 0);

  const costing: CostingSummary = useMemo(
    () => calculateImportCosting(items, importExpenses, params),
    [items, importExpenses, params],
  );

  const fmtMXN = (n: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n * (exchangeRate || 1));

  if (items.length === 0) return null;

  return (
    <div className="mt-4 border rounded-xl overflow-hidden bg-muted/20">
      {/* Toggle header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold hover:bg-muted/40 transition-colors"
      >
        <span className="flex items-center gap-2">📊 Costeo de importación (Landed Cost)</span>
        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4">
          {/* KPI row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Total FOB', value: fmtUSD(costing.totalFob), sub: fmtMXN(costing.totalFob) },
              { label: 'Gastos importación', value: fmtUSD(costing.totalImportExpenses), sub: fmtPct(costing.expenseToFobRatio) + ' vs FOB' },
              { label: 'Total Landed', value: fmtUSD(costing.totalLanded), sub: fmtMXN(costing.totalLanded) },
              { label: 'Factor utilidad (global)', value: `×${params.markupFactor}`, sub: `IVA ${fmtPct(params.ivaRate)}` },
            ].map(kpi => (
              <div key={kpi.label} className="p-3 rounded-lg bg-card border text-center">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{kpi.label}</div>
                <div className="text-base font-bold font-display mt-1">{kpi.value}</div>
                <div className="text-[10px] text-muted-foreground">{kpi.sub}</div>
              </div>
            ))}
          </div>

          {/* Params toggle */}
          <button
            onClick={() => setShowParams(!showParams)}
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            <Settings2 size={12} /> {showParams ? 'Ocultar' : 'Ajustar'} parámetros de costeo
          </button>

          {showParams && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 rounded-lg border bg-card">
              <div>
                <label className="text-[10px] font-medium text-muted-foreground block mb-1">Factor utilidad (global)</label>
                <input
                  type="number" step="0.1" min="1" value={params.markupFactor}
                  onChange={e => setParams({ ...params, markupFactor: Math.max(0, Number(e.target.value)) })}
                  className="w-full px-2 py-1.5 rounded border bg-background text-sm"
                />
                <p className="text-[9px] text-muted-foreground mt-0.5">Se aplica a todos los productos por defecto</p>
              </div>
              <div>
                <label className="text-[10px] font-medium text-muted-foreground block mb-1">IVA (%)</label>
                <input
                  type="number" step="1" min="0" max="100" value={Math.round(params.ivaRate * 100)}
                  onChange={e => setParams({ ...params, ivaRate: Math.max(0, Number(e.target.value)) / 100 })}
                  className="w-full px-2 py-1.5 rounded border bg-background text-sm"
                />
              </div>
              <div>
                <label className="text-[10px] font-medium text-muted-foreground block mb-1">Comisión vendedor (%)</label>
                <input
                  type="number" step="1" min="0" max="100" value={Math.round(params.commissionRate * 100)}
                  onChange={e => setParams({ ...params, commissionRate: Math.max(0, Number(e.target.value)) / 100 })}
                  className="w-full px-2 py-1.5 rounded border bg-background text-sm"
                />
              </div>
              <div>
                <label className="text-[10px] font-medium text-muted-foreground block mb-1">Gasto admin (%)</label>
                <input
                  type="number" step="0.5" min="0" max="100" value={Math.round(params.adminRate * 1000) / 10}
                  onChange={e => setParams({ ...params, adminRate: Math.max(0, Number(e.target.value)) / 100 })}
                  className="w-full px-2 py-1.5 rounded border bg-background text-sm"
                />
              </div>
            </div>
          )}

          {/* Detailed product table */}
          <div className="overflow-x-auto rounded-lg border">
            <table className="data-table text-xs">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th className="text-right">Qty</th>
                  <th className="text-right">FOB unit</th>
                  <th className="text-right">Subtotal FOB</th>
                  <th className="text-right">% FOB</th>
                  <th className="text-right">Gasto asignado</th>
                  <th className="text-right">Landed total</th>
                  <th className="text-right">Landed unit</th>
                  <th className="text-center">Factor</th>
                  <th className="text-right">Precio s/IVA</th>
                  <th className="text-right">Precio c/IVA</th>
                  <th className="text-right">Comisión</th>
                  <th className="text-right">Gasto admin</th>
                  <th className="text-right">Margen</th>
                </tr>
              </thead>
              <tbody>
                {costing.items.map((it, i) => {
                  const itemMarkup = getItemMarkup(i);
                  const unitLandedSinIva = it.unitLanded / (1 + params.ivaRate);
                  const precioSinIva = unitLandedSinIva * itemMarkup;
                  const precioConIva = precioSinIva * (1 + params.ivaRate);
                  const comision = precioSinIva * params.commissionRate;
                  const admin = precioSinIva * params.adminRate;
                  const netMargin = precioSinIva - unitLandedSinIva - comision - admin;
                  const marginPct = precioSinIva > 0 ? netMargin / precioSinIva : 0;
                  return (
                    <tr key={i}>
                      <td className="font-medium">{it.productName}</td>
                      <td className="text-right">{it.qty}</td>
                      <td className="text-right">{fmtUSD(it.unitCost)}</td>
                      <td className="text-right">{fmtUSD(it.subtotalFob)}</td>
                      <td className="text-right text-muted-foreground">{fmtPct(it.fobShare)}</td>
                      <td className="text-right">{fmtUSD(it.importExpenseAllocated)}</td>
                      <td className="text-right font-semibold">{fmtUSD(it.totalLanded)}</td>
                      <td className="text-right font-semibold text-primary">{fmtUSD(unitLandedSinIva)}</td>
                      <td className="text-center">
                        <input
                          type="number"
                          step="0.1"
                          min="0.1"
                          value={itemMarkup}
                          onChange={e => setItemMarkups(prev => ({ ...prev, [i]: Math.max(0.1, Number(e.target.value)) }))}
                          className="w-14 px-1 py-0.5 rounded border bg-background text-xs text-center"
                        />
                      </td>
                      <td className="text-right">{fmtUSD(precioSinIva)}</td>
                      <td className="text-right font-bold">{fmtUSD(precioConIva)}</td>
                      <td className="text-right text-muted-foreground">{fmtUSD(comision)}</td>
                      <td className="text-right text-muted-foreground">{fmtUSD(admin)}</td>
                      <td className={`text-right font-semibold ${marginPct >= 0.2 ? 'text-success' : marginPct >= 0.1 ? 'text-warning' : 'text-destructive'}`}>
                        {fmtPct(marginPct)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}