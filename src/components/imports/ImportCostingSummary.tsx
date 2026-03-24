import { useState, useMemo } from 'react';
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
              { label: 'Factor utilidad', value: `×${params.markupFactor}`, sub: `IVA ${fmtPct(params.ivaRate)}` },
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
                <label className="text-[10px] font-medium text-muted-foreground block mb-1">Factor utilidad</label>
                <input
                  type="number" step="0.1" min="1" value={params.markupFactor}
                  onChange={e => setParams({ ...params, markupFactor: Math.max(0, Number(e.target.value)) })}
                  className="w-full px-2 py-1.5 rounded border bg-background text-sm"
                />
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
                  <th className="text-right">Precio s/IVA</th>
                  <th className="text-right">Precio c/IVA</th>
                  <th className="text-right">Comisión</th>
                  <th className="text-right">Margen</th>
                </tr>
              </thead>
              <tbody>
                {costing.items.map((it, i) => (
                  <tr key={i}>
                    <td className="font-medium">{it.productName}</td>
                    <td className="text-right">{it.qty}</td>
                    <td className="text-right">{fmtUSD(it.unitCost)}</td>
                    <td className="text-right">{fmtUSD(it.subtotalFob)}</td>
                    <td className="text-right text-muted-foreground">{fmtPct(it.fobShare)}</td>
                    <td className="text-right">{fmtUSD(it.importExpenseAllocated)}</td>
                    <td className="text-right font-semibold">{fmtUSD(it.totalLanded)}</td>
                    <td className="text-right font-semibold text-primary">{fmtUSD(it.unitLanded / (1 + params.ivaRate))}</td>
                    <td className="text-right">{fmtUSD(it.priceBeforeIva)}</td>
                    <td className="text-right font-bold">{fmtUSD(it.priceWithIva)}</td>
                    <td className="text-right text-muted-foreground">{fmtUSD(it.commissionAmount)}</td>
                    <td className={`text-right font-semibold ${it.marginPercent >= 0.2 ? 'text-success' : it.marginPercent >= 0.1 ? 'text-warning' : 'text-destructive'}`}>
                      {fmtPct(it.marginPercent)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
