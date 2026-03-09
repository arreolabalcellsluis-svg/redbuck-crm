import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, TrendingUp, TrendingDown, Minus, Package, ShoppingCart, Clock, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import ReportFilterBar, { exportToExcel } from '@/components/shared/ReportFilterBar';
import { getPlanningSummary, SUPPLY_STATUS_LABELS, SUPPLY_STATUS_COLORS, PLANNING_CONFIG } from '@/lib/planningEngine';
import type { SupplyStatus, ProductAnalysis } from '@/lib/planningEngine';
import { usePlanningData } from '@/hooks/usePlanningData';
import { CATEGORY_LABELS } from '@/types';

const fmt = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);

const TrendIcon = ({ trend }: { trend: string }) => {
  if (trend === 'crecimiento') return <TrendingUp size={12} className="text-success" />;
  if (trend === 'caida') return <TrendingDown size={12} className="text-destructive" />;
  return <Minus size={12} className="text-muted-foreground" />;
};

const UrgencyBar = ({ score }: { score: number }) => {
  const color = score >= 80 ? 'bg-destructive' : score >= 50 ? 'bg-warning' : score >= 25 ? 'bg-primary' : 'bg-success';
  return (
    <div className="w-full bg-muted rounded-full h-1.5">
      <div className={`h-1.5 rounded-full ${color} transition-all`} style={{ width: `${score}%` }} />
    </div>
  );
};

export default function LowStockReportPage() {
  const [filters, setFilters] = useState<Record<string, any>>({ search: '', categoria: '', supplyStatus: '', proveedor: '' });
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [coverageTarget, setCoverageTarget] = useState(PLANNING_CONFIG.defaultCoverageTargetDays);

  const analyses = useMemo(() => analyzeProducts(), []);
  const summary = useMemo(() => getPlanningSummary(analyses), [analyses]);

  // Only show products that need attention (exclude saludable by default unless filtered)
  const records = useMemo(() => {
    return analyses
      .filter(a => a.supplyStatus !== 'saludable' || filters.supplyStatus === 'saludable')
      .sort((a, b) => b.urgencyScore - a.urgencyScore);
  }, [analyses, filters.supplyStatus]);

  const filtered = useMemo(() => {
    return records.filter(r => {
      if (filters.search) {
        const s = filters.search.toLowerCase();
        if (!r.product.name.toLowerCase().includes(s) && !r.product.sku.toLowerCase().includes(s)) return false;
      }
      if (filters.categoria && r.product.category !== filters.categoria) return false;
      if (filters.supplyStatus && r.supplyStatus !== filters.supplyStatus) return false;
      if (filters.proveedor) {
        const prov = filters.proveedor.toLowerCase();
        if (!r.product.supplier.toLowerCase().includes(prov)) return false;
      }
      return true;
    });
  }, [records, filters]);

  const hasActiveFilters = !!(filters.search || filters.categoria || filters.supplyStatus || filters.proveedor);

  const handleExport = () => {
    const data = filtered.map(r => ({
      SKU: r.product.sku,
      Producto: r.product.name,
      Categoría: CATEGORY_LABELS[r.product.category as keyof typeof CATEGORY_LABELS] || r.product.category,
      Proveedor: r.product.supplier,
      'Inv. bruto': r.grossStock,
      Comprometido: r.committed,
      'Inv. útil': r.usefulStock,
      'En tránsito': r.inTransit,
      'Tránsito efectivo': r.effectiveTransit,
      'ETA próxima': r.nextEta || 'N/A',
      'Demanda diaria pred.': r.predictiveDailyDemand.toFixed(2),
      'Demanda mensual pred.': r.predictiveMonthlyDemand.toFixed(1),
      Tendencia: r.demandTrend,
      'Días cobertura actual': r.daysOfStock,
      'Días cobertura total': r.daysOfStockWithTransit,
      'Lead time (días)': r.leadTime.total,
      'Fecha agotamiento': r.stockoutDate || 'N/A',
      'Estado abastecimiento': SUPPLY_STATUS_LABELS[r.supplyStatus],
      'Urgencia (0-100)': r.urgencyScore,
      'Sugerencia compra (uds)': r.suggestedPurchase,
      'Valor reposición': r.repositionValue,
      Explicación: r.supplyExplanation,
    }));
    exportToExcel(data, `Productos_por_agotarse_predictivo_${new Date().toISOString().split('T')[0]}`);
  };

  const suppliers = useMemo(() => {
    const set = new Set(analyses.map(a => a.product.supplier));
    return Array.from(set).sort();
  }, [analyses]);

  return (
    <TooltipProvider>
      <div>
        <div className="page-header">
          <div className="flex items-center gap-3">
            <Link to={-1 as any}><Button variant="ghost" size="sm"><ArrowLeft size={16} /></Button></Link>
            <div>
              <h1 className="page-title flex items-center gap-2"><AlertTriangle size={22} className="text-warning" /> Motor Predictivo de Abastecimiento</h1>
              <p className="page-subtitle">Predicción inteligente basada en inventario útil, demanda ponderada, tránsito y lead time</p>
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
            <div className="text-xs text-muted-foreground">Compra inmediata</div>
            <div className="text-2xl font-bold text-destructive">{summary.immediateAction}</div>
            <div className="text-[10px] text-muted-foreground">SKUs</div>
          </div>
          <div className="bg-card rounded-xl border p-4 text-center border-l-4 border-l-warning">
            <div className="text-xs text-muted-foreground">Requieren compra</div>
            <div className="text-2xl font-bold text-warning">{summary.requirePurchase}</div>
            <div className="text-[10px] text-muted-foreground">SKUs total</div>
          </div>
          <div className="bg-card rounded-xl border p-4 text-center border-l-4 border-l-primary">
            <div className="text-xs text-muted-foreground">Inversión reposición</div>
            <div className="text-xl font-bold text-primary">{fmt(summary.totalRepositionValue)}</div>
            <div className="text-[10px] text-muted-foreground">estimada</div>
          </div>
          <div className="bg-card rounded-xl border p-4 text-center border-l-4 border-l-muted-foreground">
            <div className="text-xs text-muted-foreground">Anticipación</div>
            <div className="text-2xl font-bold">{PLANNING_CONFIG.alertAnticipationDays}d</div>
            <div className="text-[10px] text-muted-foreground">antes de compra</div>
          </div>
        </div>

        {/* Filters */}
        <ReportFilterBar
          config={{
            search: true, searchPlaceholder: 'Buscar por producto o SKU...',
            selects: [
              { key: 'categoria', label: 'Categoría', options: Object.entries(CATEGORY_LABELS).map(([k, v]) => ({ value: k, label: v })) },
              {
                key: 'supplyStatus', label: 'Estado', options: [
                  { value: 'riesgo_desabasto', label: '🔴 Riesgo desabasto' },
                  { value: 'compra_inmediata', label: '🟠 Compra inmediata' },
                  { value: 'comprar_pronto', label: '🟡 Comprar pronto' },
                  { value: 'vigilar', label: '🔵 Vigilar' },
                  { value: 'saludable', label: '🟢 Saludable' },
                ]
              },
              { key: 'proveedor', label: 'Proveedor', options: suppliers.map(s => ({ value: s, label: s })) },
            ],
            exportExcel: true,
          }}
          filters={filters}
          onFilterChange={(k, v) => setFilters(prev => ({ ...prev, [k]: v }))}
          onClear={() => setFilters({ search: '', categoria: '', supplyStatus: '', proveedor: '' })}
          onExportExcel={handleExport}
          hasActiveFilters={hasActiveFilters}
        />

        {/* Coverage target selector */}
        <div className="flex items-center gap-3 mb-4 bg-card rounded-xl border p-3">
          <span className="text-xs text-muted-foreground font-medium">Cobertura objetivo:</span>
          {[90, 120, 180].map(d => (
            <Button
              key={d}
              variant={coverageTarget === d ? 'default' : 'outline'}
              size="sm"
              className="text-xs h-7"
              onClick={() => setCoverageTarget(d)}
            >
              {d} días
            </Button>
          ))}
          <span className="text-[10px] text-muted-foreground ml-2">La sugerencia de compra se calcula para cubrir {coverageTarget} días de demanda</span>
        </div>

        {/* Main table */}
        <div className="bg-card rounded-xl border overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th className="w-8"></th>
                <th>SKU</th>
                <th>Producto</th>
                <th>Cat.</th>
                <th>
                  <Tooltip><TooltipTrigger className="underline decoration-dotted">Inv. útil</TooltipTrigger>
                    <TooltipContent>Stock bruto − comprometido − exhibición</TooltipContent>
                  </Tooltip>
                </th>
                <th>
                  <Tooltip><TooltipTrigger className="underline decoration-dotted">Tránsito</TooltipTrigger>
                    <TooltipContent>Inventario en camino (efectivo según confianza logística)</TooltipContent>
                  </Tooltip>
                </th>
                <th>
                  <Tooltip><TooltipTrigger className="underline decoration-dotted">Dem./mes</TooltipTrigger>
                    <TooltipContent>Demanda mensual predictiva (ponderada: 40% último mes, 30% 90d, 20% 180d, 10% anual)</TooltipContent>
                  </Tooltip>
                </th>
                <th>Tend.</th>
                <th>
                  <Tooltip><TooltipTrigger className="underline decoration-dotted">Cob. actual</TooltipTrigger>
                    <TooltipContent>Días que cubre solo el inventario útil actual</TooltipContent>
                  </Tooltip>
                </th>
                <th>
                  <Tooltip><TooltipTrigger className="underline decoration-dotted">Cob. total</TooltipTrigger>
                    <TooltipContent>Días con inventario útil + tránsito efectivo</TooltipContent>
                  </Tooltip>
                </th>
                <th>Lead time</th>
                <th>Agotamiento</th>
                <th>Estado</th>
                <th>Urgencia</th>
                <th>
                  <Tooltip><TooltipTrigger className="underline decoration-dotted">Comprar</TooltipTrigger>
                    <TooltipContent>Unidades sugeridas para alcanzar {coverageTarget}d de cobertura + stock de seguridad</TooltipContent>
                  </Tooltip>
                </th>
                <th>Inversión</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const statusColors = SUPPLY_STATUS_COLORS[r.supplyStatus];
                const isExpanded = expandedRow === r.product.id;
                return (
                  <>
                    <tr key={r.product.id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setExpandedRow(isExpanded ? null : r.product.id)}>
                      <td className="text-center">
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </td>
                      <td className="font-mono text-xs">{r.product.sku}</td>
                      <td className="text-xs font-medium max-w-[160px] truncate">{r.product.name}</td>
                      <td className="text-[10px]">{CATEGORY_LABELS[r.product.category as keyof typeof CATEGORY_LABELS]?.split(' ')[0]}</td>
                      <td className="text-xs text-center">
                        <span className="font-bold">{r.usefulStock}</span>
                        <span className="text-[9px] text-muted-foreground ml-0.5">/{r.grossStock}</span>
                      </td>
                      <td className="text-xs text-center">
                        <span className="text-primary font-medium">{r.effectiveTransit}</span>
                        {r.inTransit > 0 && <span className="text-[9px] text-muted-foreground ml-0.5">({r.inTransit})</span>}
                      </td>
                      <td className="text-xs text-center font-medium">{r.predictiveMonthlyDemand.toFixed(1)}</td>
                      <td className="text-center"><TrendIcon trend={r.demandTrend} /></td>
                      <td className={`text-xs text-center font-bold ${r.daysOfStock <= 30 ? 'text-destructive' : r.daysOfStock <= 60 ? 'text-warning' : ''}`}>
                        {r.daysOfStock > 900 ? '∞' : `${r.daysOfStock}d`}
                      </td>
                      <td className={`text-xs text-center font-bold ${r.daysOfStockWithTransit <= 60 ? 'text-destructive' : r.daysOfStockWithTransit <= 120 ? 'text-warning' : ''}`}>
                        {r.daysOfStockWithTransit > 900 ? '∞' : `${r.daysOfStockWithTransit}d`}
                      </td>
                      <td className="text-xs text-center">{r.leadTime.total}d</td>
                      <td className="text-xs text-center">
                        {r.stockoutDate ? <span className={r.daysOfStock <= 60 ? 'text-destructive font-bold' : ''}>{r.stockoutDate}</span> : '—'}
                      </td>
                      <td>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold whitespace-nowrap ${statusColors.bg} ${statusColors.text}`}>
                          {SUPPLY_STATUS_LABELS[r.supplyStatus]}
                        </span>
                      </td>
                      <td className="w-20">
                        <UrgencyBar score={r.urgencyScore} />
                        <div className="text-[9px] text-center text-muted-foreground">{r.urgencyScore}/100</div>
                      </td>
                      <td className="text-xs text-center font-bold text-primary">{r.suggestedPurchase > 0 ? `${r.suggestedPurchase} uds` : '—'}</td>
                      <td className="text-xs text-right font-medium">{r.repositionValue > 0 ? fmt(r.repositionValue) : '—'}</td>
                    </tr>

                    {/* Expanded detail row */}
                    {isExpanded && (
                      <tr key={`${r.product.id}-detail`}>
                        <td colSpan={16} className="bg-muted/30 p-4">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Explanation */}
                            <div className="md:col-span-2 bg-card rounded-lg border p-4">
                              <div className="flex items-start gap-2 mb-3">
                                <Info size={16} className="text-primary mt-0.5 shrink-0" />
                                <div>
                                  <div className="text-sm font-semibold mb-1">¿Por qué esta recomendación?</div>
                                  <p className="text-xs text-muted-foreground leading-relaxed">{r.supplyExplanation}</p>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                                <div className="bg-muted/50 rounded-lg p-2 text-center">
                                  <div className="text-[10px] text-muted-foreground">Stock bruto</div>
                                  <div className="text-sm font-bold">{r.grossStock}</div>
                                </div>
                                <div className="bg-muted/50 rounded-lg p-2 text-center">
                                  <div className="text-[10px] text-muted-foreground">Comprometido</div>
                                  <div className="text-sm font-bold text-warning">{r.committed}</div>
                                </div>
                                <div className="bg-muted/50 rounded-lg p-2 text-center">
                                  <div className="text-[10px] text-muted-foreground">Exhibición</div>
                                  <div className="text-sm font-bold">{r.exhibition}</div>
                                </div>
                                <div className="bg-muted/50 rounded-lg p-2 text-center">
                                  <div className="text-[10px] text-muted-foreground">Inv. útil real</div>
                                  <div className="text-sm font-bold text-primary">{r.usefulStock}</div>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                                <div className="bg-muted/50 rounded-lg p-2 text-center">
                                  <div className="text-[10px] text-muted-foreground">Stock seguridad</div>
                                  <div className="text-sm font-bold">{r.safetyStock}</div>
                                </div>
                                <div className="bg-muted/50 rounded-lg p-2 text-center">
                                  <div className="text-[10px] text-muted-foreground">Punto reorden</div>
                                  <div className="text-sm font-bold">{r.reorderPoint}</div>
                                </div>
                                <div className="bg-muted/50 rounded-lg p-2 text-center">
                                  <div className="text-[10px] text-muted-foreground">Dem. cotiz.</div>
                                  <div className="text-sm font-bold">{r.quotationDemand}</div>
                                </div>
                                <div className="bg-muted/50 rounded-lg p-2 text-center">
                                  <div className="text-[10px] text-muted-foreground">Prioridad cat.</div>
                                  <div className="text-sm font-bold capitalize">{r.categoryPriority}</div>
                                </div>
                              </div>
                            </div>

                            {/* Transit details */}
                            <div className="bg-card rounded-lg border p-4">
                              <div className="text-sm font-semibold mb-2 flex items-center gap-1">
                                <Package size={14} /> Inventario en tránsito
                              </div>
                              {r.transitDetails.length === 0 ? (
                                <p className="text-xs text-muted-foreground">Sin inventario en camino</p>
                              ) : (
                                <div className="space-y-2">
                                  {r.transitDetails.map((t, i) => (
                                    <div key={i} className="bg-muted/50 rounded-lg p-2 text-xs">
                                      <div className="flex justify-between mb-1">
                                        <span className="font-medium">{t.orderNumber}</span>
                                        <span className={t.arrivesBeforeStockout ? 'text-success' : 'text-destructive'}>
                                          {t.arrivesBeforeStockout ? '✓ Llega a tiempo' : '✗ Llega tarde'}
                                        </span>
                                      </div>
                                      <div className="grid grid-cols-2 gap-1 text-[10px]">
                                        <div>Cantidad: <span className="font-bold">{t.qty}</span></div>
                                        <div>Efectivo: <span className="font-bold text-primary">{t.effectiveQty}</span></div>
                                        <div>Confianza: <span className="font-bold">{Math.round(t.confidence * 100)}%</span></div>
                                        <div>ETA: <span className="font-bold">{t.etaDays}d</span></div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}

                              <div className="mt-3 pt-2 border-t">
                                <div className="text-sm font-semibold mb-1 flex items-center gap-1">
                                  <Clock size={14} /> Lead time desglosado
                                </div>
                                <div className="space-y-0.5 text-[10px]">
                                  {r.leadTime.production > 0 && <div className="flex justify-between"><span>Producción</span><span>{r.leadTime.production}d</span></div>}
                                  {r.leadTime.freightChina > 0 && <div className="flex justify-between"><span>Flete China</span><span>{r.leadTime.freightChina}d</span></div>}
                                  {r.leadTime.ocean > 0 && <div className="flex justify-between"><span>Tránsito marítimo</span><span>{r.leadTime.ocean}d</span></div>}
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
                <tr><td colSpan={16} className="text-center text-muted-foreground py-8">Sin productos que requieran atención</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="bg-card rounded-xl border p-4 mt-4">
          <div className="text-xs font-semibold mb-2">Leyenda de estados de abastecimiento</div>
          <div className="flex flex-wrap gap-3">
            {(Object.entries(SUPPLY_STATUS_LABELS) as [SupplyStatus, string][]).map(([key, label]) => (
              <div key={key} className="flex items-center gap-1.5">
                <span className={`inline-block w-2.5 h-2.5 rounded-full ${SUPPLY_STATUS_COLORS[key].bg} ${SUPPLY_STATUS_COLORS[key].text}`} style={{ boxShadow: 'inset 0 0 0 4px currentColor' }} />
                <span className="text-[10px] text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 text-[10px] text-muted-foreground">
            Anticipación: {PLANNING_CONFIG.alertAnticipationDays} días · Stock seguridad: {PLANNING_CONFIG.safetyStockDays} días · Demanda ponderada: 40% últimos 30d, 30% 90d, 20% 180d, 10% anual
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
