import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CalendarClock, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp, Info, Package, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import ReportFilterBar, { exportToExcel } from '@/components/shared/ReportFilterBar';
import {
  getPlanningSummary,
  PURCHASE_URGENCY_LABELS, PURCHASE_URGENCY_COLORS,
  PLANNING_CONFIG,
} from '@/lib/planningEngine';
import type { PurchaseUrgency } from '@/lib/planningEngine';
import { usePlanningData } from '@/hooks/usePlanningData';
import { CATEGORY_LABELS } from '@/types';

const fmt = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);

const TrendIcon = ({ trend }: { trend: string }) => {
  if (trend === 'crecimiento') return <TrendingUp size={12} className="text-success" />;
  if (trend === 'caida') return <TrendingDown size={12} className="text-destructive" />;
  return <Minus size={12} className="text-muted-foreground" />;
};

export default function ImportPlanningPage() {
  const [filters, setFilters] = useState<Record<string, any>>({ search: '', categoria: '', urgency: '', proveedor: '' });
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [coverageTarget, setCoverageTarget] = useState(PLANNING_CONFIG.defaultCoverageTargetDays);

  const analyses = useMemo(() => analyzeProducts(), []);
  const summary = useMemo(() => getPlanningSummary(analyses), [analyses]);

  // Sort by urgency (most urgent first)
  const urgencyOrder: Record<PurchaseUrgency, number> = {
    riesgo_desabasto_imp: 0, compra_urgente: 1, compra_recomendada: 2, compra_futura: 3, no_necesaria: 4,
  };

  const records = useMemo(() => {
    return [...analyses].sort((a, b) => a.daysOfStockWithTransit - b.daysOfStockWithTransit);
  }, [analyses]);

  const filtered = useMemo(() => {
    return records.filter(r => {
      if (filters.search) {
        const s = filters.search.toLowerCase();
        if (!r.product.name.toLowerCase().includes(s) && !r.product.sku.toLowerCase().includes(s)) return false;
      }
      if (filters.categoria && r.product.category !== filters.categoria) return false;
      if (filters.urgency && r.purchaseUrgency !== filters.urgency) return false;
      if (filters.proveedor && !r.product.supplier.toLowerCase().includes(filters.proveedor.toLowerCase())) return false;
      return true;
    });
  }, [records, filters]);

  const hasActiveFilters = !!(filters.search || filters.categoria || filters.urgency || filters.proveedor);

  const suppliers = useMemo(() => {
    const set = new Set(analyses.map(a => a.product.supplier));
    return Array.from(set).sort();
  }, [analyses]);

  const handleExport = () => {
    const data = filtered.map(r => ({
      SKU: r.product.sku, Producto: r.product.name,
      Categoría: CATEGORY_LABELS[r.product.category as keyof typeof CATEGORY_LABELS] || r.product.category,
      Proveedor: r.product.supplier,
      'Lead time (días)': r.leadTime.total,
      'Inv. útil': r.usefulStock, 'En tránsito': r.inTransit, 'Tránsito efectivo': r.effectiveTransit,
      'Demanda diaria pred.': r.predictiveDailyDemand.toFixed(2),
      'Demanda mensual pred.': r.predictiveMonthlyDemand.toFixed(1),
      Tendencia: r.demandTrend,
      'Cobertura actual (días)': r.daysOfStock,
      'Cobertura total (días)': r.daysOfStockWithTransit,
      'Fecha agotamiento': r.stockoutDate || 'N/A',
      'Fecha ideal compra': r.idealPurchaseDate || 'N/A',
      'Días hasta compra': r.daysUntilPurchase ?? 'N/A',
      'Urgencia': PURCHASE_URGENCY_LABELS[r.purchaseUrgency],
      'Sugerencia compra (uds)': r.suggestedPurchase,
      'Inversión estimada': r.repositionValue,
      '¿No comprar?': r.shouldNotBuy ? 'Sí' : 'No',
    }));
    exportToExcel(data, `Plan_importaciones_${new Date().toISOString().split('T')[0]}`);
  };

  return (
    <TooltipProvider>
      <div>
        <div className="page-header">
          <div className="flex items-center gap-3">
            <Link to={-1 as any}><Button variant="ghost" size="sm"><ArrowLeft size={16} /></Button></Link>
            <div>
              <h1 className="page-title flex items-center gap-2"><CalendarClock size={22} className="text-primary" /> Planeación de Importaciones</h1>
              <p className="page-subtitle">Plan automático de compras basado en demanda predictiva, cobertura y lead time</p>
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-card rounded-xl border p-4 text-center border-l-4 border-l-destructive">
            <div className="text-xs text-muted-foreground">Riesgo desabasto</div>
            <div className="text-2xl font-bold text-destructive">{summary.stockoutRisk}</div>
            <div className="text-[10px] text-muted-foreground">SKUs</div>
          </div>
          <div className="bg-card rounded-xl border p-4 text-center border-l-4 border-l-destructive/60">
            <div className="text-xs text-muted-foreground">Compra urgente</div>
            <div className="text-2xl font-bold text-destructive">{summary.purchaseUrgentProducts}</div>
            <div className="text-[10px] text-muted-foreground">SKUs</div>
          </div>
          <div className="bg-card rounded-xl border p-4 text-center border-l-4 border-l-warning">
            <div className="text-xs text-muted-foreground">Compra recomendada</div>
            <div className="text-2xl font-bold text-warning">{summary.purchaseSoonProducts}</div>
            <div className="text-[10px] text-muted-foreground">SKUs</div>
          </div>
          <div className="bg-card rounded-xl border p-4 text-center border-l-4 border-l-primary">
            <div className="text-xs text-muted-foreground">Inversión próximas compras</div>
            <div className="text-xl font-bold text-primary">{fmt(summary.nextPurchaseValue)}</div>
            <div className="text-[10px] text-muted-foreground">estimada</div>
          </div>
          <div className="bg-card rounded-xl border p-4 text-center border-l-4 border-l-success">
            <div className="text-xs text-muted-foreground">No requieren compra</div>
            <div className="text-2xl font-bold text-success">{analyses.filter(a => a.purchaseUrgency === 'no_necesaria').length}</div>
            <div className="text-[10px] text-muted-foreground">SKUs</div>
          </div>
        </div>

        <ReportFilterBar
          config={{
            search: true, searchPlaceholder: 'Buscar por producto o SKU...',
            selects: [
              { key: 'categoria', label: 'Categoría', options: Object.entries(CATEGORY_LABELS).map(([k, v]) => ({ value: k, label: v })) },
              {
                key: 'urgency', label: 'Urgencia', options: [
                  { value: 'riesgo_desabasto_imp', label: '🔴 Riesgo desabasto' },
                  { value: 'compra_urgente', label: '🟠 Urgente' },
                  { value: 'compra_recomendada', label: '🟡 Recomendada' },
                  { value: 'compra_futura', label: '🔵 Futura' },
                  { value: 'no_necesaria', label: '🟢 No necesaria' },
                ]
              },
              { key: 'proveedor', label: 'Proveedor', options: suppliers.map(s => ({ value: s, label: s })) },
            ],
            exportExcel: true,
          }}
          filters={filters}
          onFilterChange={(k, v) => setFilters(prev => ({ ...prev, [k]: v }))}
          onClear={() => setFilters({ search: '', categoria: '', urgency: '', proveedor: '' })}
          onExportExcel={handleExport}
          hasActiveFilters={hasActiveFilters}
        />

        {/* Coverage target */}
        <div className="flex items-center gap-3 mb-4 bg-card rounded-xl border p-3">
          <span className="text-xs text-muted-foreground font-medium">Cobertura objetivo:</span>
          {[90, 120, 180].map(d => (
            <Button key={d} variant={coverageTarget === d ? 'default' : 'outline'} size="sm" className="text-xs h-7" onClick={() => setCoverageTarget(d)}>
              {d} días
            </Button>
          ))}
        </div>

        {/* Main table */}
        <div className="bg-card rounded-xl border overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th className="w-8"></th>
                <th>SKU</th>
                <th>Producto</th>
                <th>Proveedor</th>
                <th>Lead time</th>
                <th>Inv. útil</th>
                <th>Tránsito</th>
                <th>Dem./mes</th>
                <th>Tend.</th>
                <th>Cob. actual</th>
                <th>Cob. total</th>
                <th>
                  <Tooltip><TooltipTrigger className="underline decoration-dotted">Agotamiento</TooltipTrigger>
                    <TooltipContent>Fecha estimada de agotamiento del inventario útil</TooltipContent>
                  </Tooltip>
                </th>
                <th>
                  <Tooltip><TooltipTrigger className="underline decoration-dotted">Fecha compra</TooltipTrigger>
                    <TooltipContent>Fecha ideal para realizar la compra (agotamiento − lead time − seguridad)</TooltipContent>
                  </Tooltip>
                </th>
                <th>Urgencia</th>
                <th>Comprar</th>
                <th>Inversión</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const colors = PURCHASE_URGENCY_COLORS[r.purchaseUrgency];
                const isExpanded = expandedRow === r.product.id;
                return (
                  <>
                    <tr key={r.product.id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setExpandedRow(isExpanded ? null : r.product.id)}>
                      <td className="text-center">{isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</td>
                      <td className="font-mono text-xs">{r.product.sku}</td>
                      <td className="text-xs font-medium max-w-[140px] truncate">{r.product.name}</td>
                      <td className="text-[10px] max-w-[100px] truncate">{r.product.supplier}</td>
                      <td className="text-xs text-center">{r.leadTime.total}d</td>
                      <td className="text-xs text-center font-bold">{r.usefulStock}</td>
                      <td className="text-xs text-center text-primary">{r.effectiveTransit}{r.inTransit > 0 && <span className="text-[9px] text-muted-foreground ml-0.5">({r.inTransit})</span>}</td>
                      <td className="text-xs text-center">{r.predictiveMonthlyDemand.toFixed(1)}</td>
                      <td className="text-center"><TrendIcon trend={r.demandTrend} /></td>
                      <td className={`text-xs text-center font-bold ${r.daysOfStock <= 30 ? 'text-destructive' : r.daysOfStock <= 60 ? 'text-warning' : ''}`}>
                        {r.daysOfStock > 900 ? '∞' : `${r.daysOfStock}d`}
                      </td>
                      <td className="text-xs text-center">{r.daysOfStockWithTransit > 900 ? '∞' : `${r.daysOfStockWithTransit}d`}</td>
                      <td className="text-xs text-center">{r.stockoutDate || '—'}</td>
                      <td className={`text-xs text-center font-medium ${r.daysUntilPurchase !== null && r.daysUntilPurchase <= 0 ? 'text-destructive font-bold' : ''}`}>
                        {r.idealPurchaseDate || '—'}
                        {r.daysUntilPurchase !== null && r.daysUntilPurchase <= 0 && <span className="block text-[9px]">¡HOY!</span>}
                      </td>
                      <td>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold whitespace-nowrap ${colors.bg} ${colors.text}`}>
                          {PURCHASE_URGENCY_LABELS[r.purchaseUrgency]}
                        </span>
                      </td>
                      <td className="text-xs text-center font-bold text-primary">
                        {r.suggestedPurchase > 0 && !r.shouldNotBuy ? `${r.suggestedPurchase} uds` : r.shouldNotBuy ? <span className="text-muted-foreground">—</span> : '—'}
                      </td>
                      <td className="text-xs text-right font-medium">{r.repositionValue > 0 && !r.shouldNotBuy ? fmt(r.repositionValue) : '—'}</td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${r.product.id}-detail`}>
                        <td colSpan={16} className="bg-muted/30 p-4">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="md:col-span-2 bg-card rounded-lg border p-4">
                              <div className="flex items-start gap-2 mb-3">
                                <Info size={16} className="text-primary mt-0.5 shrink-0" />
                                <div>
                                  <div className="text-sm font-semibold mb-1">Análisis de planeación</div>
                                  <p className="text-xs text-muted-foreground leading-relaxed">{r.supplyExplanation}</p>
                                  {r.shouldNotBuy && (
                                    <p className="text-xs text-destructive font-semibold mt-2">⛔ No se recomienda comprar — cobertura superior al doble del lead time o máxima recomendada.</p>
                                  )}
                                </div>
                              </div>
                              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
                                <div className="bg-muted/50 rounded-lg p-2 text-center">
                                  <div className="text-[10px] text-muted-foreground">Stock seguridad</div>
                                  <div className="text-sm font-bold">{r.safetyStock} uds</div>
                                </div>
                                <div className="bg-muted/50 rounded-lg p-2 text-center">
                                  <div className="text-[10px] text-muted-foreground">Punto reorden</div>
                                  <div className="text-sm font-bold">{r.reorderPoint} uds</div>
                                </div>
                                <div className="bg-muted/50 rounded-lg p-2 text-center">
                                  <div className="text-[10px] text-muted-foreground">Stock ideal</div>
                                  <div className="text-sm font-bold text-primary">{r.idealStock} uds</div>
                                </div>
                                <div className="bg-muted/50 rounded-lg p-2 text-center">
                                  <div className="text-[10px] text-muted-foreground">Días hasta compra</div>
                                  <div className="text-sm font-bold">{r.daysUntilPurchase ?? '—'}</div>
                                </div>
                                <div className="bg-muted/50 rounded-lg p-2 text-center">
                                  <div className="text-[10px] text-muted-foreground">Dem. cotizaciones</div>
                                  <div className="text-sm font-bold">{r.quotationDemand}</div>
                                </div>
                              </div>
                            </div>
                            <div className="bg-card rounded-lg border p-4">
                              <div className="text-sm font-semibold mb-2 flex items-center gap-1">
                                <Package size={14} /> Tránsito activo
                              </div>
                              {r.transitDetails.length === 0 ? (
                                <p className="text-xs text-muted-foreground">Sin importaciones en camino</p>
                              ) : (
                                <div className="space-y-2">
                                  {r.transitDetails.map((t, i) => (
                                    <div key={i} className="bg-muted/50 rounded-lg p-2 text-xs">
                                      <div className="flex justify-between mb-1">
                                        <span className="font-medium">{t.orderNumber}</span>
                                        <span className={t.arrivesBeforeStockout ? 'text-success' : 'text-destructive'}>
                                          {t.arrivesBeforeStockout ? '✓ A tiempo' : '✗ Tarde'}
                                        </span>
                                      </div>
                                      <div className="grid grid-cols-2 gap-1 text-[10px]">
                                        <div>Qty: <span className="font-bold">{t.qty}</span></div>
                                        <div>ETA: <span className="font-bold">{t.etaDays}d</span></div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                              <div className="mt-3 pt-2 border-t">
                                <div className="text-sm font-semibold mb-1 flex items-center gap-1"><Clock size={14} /> Lead time</div>
                                <div className="space-y-0.5 text-[10px]">
                                  {r.leadTime.production > 0 && <div className="flex justify-between"><span>Producción</span><span>{r.leadTime.production}d</span></div>}
                                  {r.leadTime.freightChina > 0 && <div className="flex justify-between"><span>Flete China</span><span>{r.leadTime.freightChina}d</span></div>}
                                  {r.leadTime.ocean > 0 && <div className="flex justify-between"><span>Marítimo</span><span>{r.leadTime.ocean}d</span></div>}
                                  {r.leadTime.customs > 0 && <div className="flex justify-between"><span>Aduana</span><span>{r.leadTime.customs}d</span></div>}
                                  <div className="flex justify-between"><span>Transporte local</span><span>{r.leadTime.nationalTransport}d</span></div>
                                  <div className="flex justify-between font-bold border-t pt-1 mt-1"><span>Total</span><span>{r.leadTime.total}d</span></div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={16} className="text-center text-muted-foreground py-8">Sin productos que mostrar</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="bg-card rounded-xl border p-4 mt-4">
          <div className="text-xs font-semibold mb-2">Clasificación de urgencia</div>
          <div className="flex flex-wrap gap-3">
            {(Object.entries(PURCHASE_URGENCY_LABELS) as [PurchaseUrgency, string][]).map(([key, label]) => (
              <div key={key} className="flex items-center gap-1.5">
                <span className={`inline-block w-2.5 h-2.5 rounded-full ${PURCHASE_URGENCY_COLORS[key].bg} ${PURCHASE_URGENCY_COLORS[key].text}`} style={{ boxShadow: 'inset 0 0 0 4px currentColor' }} />
                <span className="text-[10px] text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 text-[10px] text-muted-foreground">
            Fecha ideal de compra = fecha agotamiento − lead time − {PLANNING_CONFIG.safetyStockDays}d seguridad
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
