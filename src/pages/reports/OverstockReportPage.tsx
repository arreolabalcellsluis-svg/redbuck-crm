import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, PackageX, TrendingDown, TrendingUp, Minus, ChevronDown, ChevronUp, Info, Ban, Tag, Percent, Truck, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import ReportFilterBar, { exportToExcel } from '@/components/shared/ReportFilterBar';
import {
  getPlanningSummary,
  OVERSTOCK_STATUS_LABELS, OVERSTOCK_STATUS_COLORS, OVERSTOCK_SUGGESTION_LABELS,
  PLANNING_CONFIG,
} from '@/lib/planningEngine';
import type { OverstockStatus, OverstockSuggestion } from '@/lib/planningEngine';
import { usePlanningData } from '@/hooks/usePlanningData';
import { CATEGORY_LABELS } from '@/types';

const fmt = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);

const TrendIcon = ({ trend }: { trend: string }) => {
  if (trend === 'crecimiento') return <TrendingUp size={12} className="text-success" />;
  if (trend === 'caida') return <TrendingDown size={12} className="text-destructive" />;
  return <Minus size={12} className="text-muted-foreground" />;
};

const SuggestionBadge = ({ suggestion }: { suggestion: OverstockSuggestion }) => {
  const icons: Record<string, typeof Ban> = {
    no_comprar: Ban, promover: Tag, descuento: Percent,
    liquidar: PackageX, mover_bodega: Truck, ofrecer_distribuidores: Users, mantener: Info,
  };
  const Icon = icons[suggestion] ?? Info;
  return (
    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
      <Icon size={10} /> {OVERSTOCK_SUGGESTION_LABELS[suggestion]}
    </span>
  );
};

export default function OverstockReportPage() {
  const [filters, setFilters] = useState<Record<string, any>>({ search: '', categoria: '', overstockStatus: '', proveedor: '' });
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const { analyses, summary } = usePlanningData();

  const records = useMemo(() => {
    return analyses
      .filter(a => a.overstockStatus !== 'optimo' || filters.overstockStatus === 'optimo')
      .sort((a, b) => b.coverageMonths - a.coverageMonths);
  }, [analyses, filters.overstockStatus]);

  const filtered = useMemo(() => {
    return records.filter(r => {
      if (filters.search) {
        const s = filters.search.toLowerCase();
        if (!r.product.name.toLowerCase().includes(s) && !r.product.sku.toLowerCase().includes(s)) return false;
      }
      if (filters.categoria && r.product.category !== filters.categoria) return false;
      if (filters.overstockStatus && r.overstockStatus !== filters.overstockStatus) return false;
      if (filters.proveedor && !r.product.supplier.toLowerCase().includes(filters.proveedor.toLowerCase())) return false;
      return true;
    });
  }, [records, filters]);

  const hasActiveFilters = !!(filters.search || filters.categoria || filters.overstockStatus || filters.proveedor);

  const suppliers = useMemo(() => {
    const set = new Set(analyses.map(a => a.product.supplier));
    return Array.from(set).sort();
  }, [analyses]);

  const handleExport = () => {
    const data = filtered.map(r => ({
      SKU: r.product.sku, Producto: r.product.name,
      Categoría: CATEGORY_LABELS[r.product.category as keyof typeof CATEGORY_LABELS] || r.product.category,
      Proveedor: r.product.supplier,
      'Inv. útil': r.usefulStock, 'En tránsito': r.inTransit,
      'Stock total proyectado': r.totalProjectedStock,
      'Demanda mensual': r.predictiveMonthlyDemand.toFixed(1),
      'Cobertura (meses)': r.coverageMonths.toFixed(1),
      'Cobertura (días)': r.daysOfStockWithTransit,
      Tendencia: r.demandTrend,
      'Costo unitario': r.product.cost,
      'Valor inventario': r.stockValue,
      'Unidades excedentes': r.excessUnits,
      'Valor excedente': r.excessValue,
      Estado: OVERSTOCK_STATUS_LABELS[r.overstockStatus],
      'No comprar': r.shouldNotBuy ? 'Sí' : 'No',
      Sugerencias: r.overstockSuggestions.map(s => OVERSTOCK_SUGGESTION_LABELS[s]).join(', '),
      Explicación: r.overstockExplanation,
    }));
    exportToExcel(data, `Sobreinventario_${new Date().toISOString().split('T')[0]}`);
  };

  return (
    <TooltipProvider>
      <div>
        <div className="page-header">
          <div className="flex items-center gap-3">
            <Link to={-1 as any}><Button variant="ghost" size="sm"><ArrowLeft size={16} /></Button></Link>
            <div>
              <h1 className="page-title flex items-center gap-2"><PackageX size={22} className="text-warning" /> Motor de Sobreinventario</h1>
              <p className="page-subtitle">Detección inteligente de exceso de inventario y capital detenido</p>
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-card rounded-xl border p-4 text-center border-l-4 border-l-destructive">
            <div className="text-xs text-muted-foreground">Sobreinventario</div>
            <div className="text-2xl font-bold text-destructive">{summary.overstockProducts}</div>
            <div className="text-[10px] text-muted-foreground">SKUs</div>
          </div>
          <div className="bg-card rounded-xl border p-4 text-center border-l-4 border-l-destructive/60">
            <div className="text-xs text-muted-foreground">Riesgo inv. muerto</div>
            <div className="text-2xl font-bold text-destructive">{summary.overstockRiskProducts}</div>
            <div className="text-[10px] text-muted-foreground">SKUs</div>
          </div>
          <div className="bg-card rounded-xl border p-4 text-center border-l-4 border-l-warning">
            <div className="text-xs text-muted-foreground">Capital excedente</div>
            <div className="text-xl font-bold text-warning">{fmt(summary.totalExcessValue)}</div>
            <div className="text-[10px] text-muted-foreground">valor detenido</div>
          </div>
          <div className="bg-card rounded-xl border p-4 text-center border-l-4 border-l-primary">
            <div className="text-xs text-muted-foreground">Inventario total</div>
            <div className="text-xl font-bold text-primary">{fmt(summary.totalStockValue)}</div>
            <div className="text-[10px] text-muted-foreground">{summary.totalExcessValue > 0 ? `${((summary.totalExcessValue / summary.totalStockValue) * 100).toFixed(0)}% excedente` : 'saludable'}</div>
          </div>
        </div>

        <ReportFilterBar
          config={{
            search: true, searchPlaceholder: 'Buscar por producto o SKU...',
            selects: [
              { key: 'categoria', label: 'Categoría', options: Object.entries(CATEGORY_LABELS).map(([k, v]) => ({ value: k, label: v })) },
              {
                key: 'overstockStatus', label: 'Estado', options: [
                  { value: 'riesgo_muerto', label: '🔴 Riesgo inv. muerto' },
                  { value: 'sobreinventario', label: '🟠 Sobreinventario' },
                  { value: 'vigilar_exceso', label: '🟡 Vigilar' },
                  { value: 'optimo', label: '🟢 Óptimo' },
                ]
              },
              { key: 'proveedor', label: 'Proveedor', options: suppliers.map(s => ({ value: s, label: s })) },
            ],
            exportExcel: true,
          }}
          filters={filters}
          onFilterChange={(k, v) => setFilters(prev => ({ ...prev, [k]: v }))}
          onClear={() => setFilters({ search: '', categoria: '', overstockStatus: '', proveedor: '' })}
          onExportExcel={handleExport}
          hasActiveFilters={hasActiveFilters}
        />

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
                    <TooltipContent>Stock disponible para venta</TooltipContent>
                  </Tooltip>
                </th>
                <th>Tránsito</th>
                <th>
                  <Tooltip><TooltipTrigger className="underline decoration-dotted">Total proy.</TooltipTrigger>
                    <TooltipContent>Inventario útil + tránsito efectivo</TooltipContent>
                  </Tooltip>
                </th>
                <th>Dem./mes</th>
                <th>Tend.</th>
                <th>
                  <Tooltip><TooltipTrigger className="underline decoration-dotted">Cob. (meses)</TooltipTrigger>
                    <TooltipContent>Meses de cobertura con inventario total proyectado</TooltipContent>
                  </Tooltip>
                </th>
                <th>Cob. (días)</th>
                <th>Valor inv.</th>
                <th>
                  <Tooltip><TooltipTrigger className="underline decoration-dotted">Excedente</TooltipTrigger>
                    <TooltipContent>Valor del inventario que supera la cobertura recomendada</TooltipContent>
                  </Tooltip>
                </th>
                <th>Estado</th>
                <th>¿Comprar?</th>
                <th>Sugerencias</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const colors = OVERSTOCK_STATUS_COLORS[r.overstockStatus];
                const isExpanded = expandedRow === r.product.id;
                return (
                  <>
                    <tr key={r.product.id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setExpandedRow(isExpanded ? null : r.product.id)}>
                      <td className="text-center">{isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</td>
                      <td className="font-mono text-xs">{r.product.sku}</td>
                      <td className="text-xs font-medium max-w-[160px] truncate">{r.product.name}</td>
                      <td className="text-[10px]">{CATEGORY_LABELS[r.product.category as keyof typeof CATEGORY_LABELS]?.split(' ')[0]}</td>
                      <td className="text-xs text-center font-bold">{r.usefulStock}</td>
                      <td className="text-xs text-center text-primary">{r.effectiveTransit}{r.inTransit > 0 && <span className="text-[9px] text-muted-foreground ml-0.5">({r.inTransit})</span>}</td>
                      <td className="text-xs text-center font-bold">{r.totalProjectedStock}</td>
                      <td className="text-xs text-center">{r.predictiveMonthlyDemand.toFixed(1)}</td>
                      <td className="text-center"><TrendIcon trend={r.demandTrend} /></td>
                      <td className={`text-xs text-center font-bold ${r.coverageMonths > 12 ? 'text-destructive' : r.coverageMonths > 6 ? 'text-warning' : ''}`}>
                        {r.coverageMonths > 50 ? '∞' : `${r.coverageMonths.toFixed(1)}`}
                      </td>
                      <td className="text-xs text-center">{r.daysOfStockWithTransit > 900 ? '∞' : `${r.daysOfStockWithTransit}d`}</td>
                      <td className="text-xs text-right">{fmt(r.stockValue)}</td>
                      <td className={`text-xs text-right font-bold ${r.excessValue > 0 ? 'text-destructive' : ''}`}>{r.excessValue > 0 ? fmt(r.excessValue) : '—'}</td>
                      <td>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold whitespace-nowrap ${colors.bg} ${colors.text}`}>
                          {OVERSTOCK_STATUS_LABELS[r.overstockStatus]}
                        </span>
                      </td>
                      <td className="text-center">
                        {r.shouldNotBuy ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-semibold">No comprar</span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-success/10 text-success font-semibold">OK</span>
                        )}
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-0.5">
                          {r.overstockSuggestions.slice(0, 2).map((s, i) => <SuggestionBadge key={i} suggestion={s} />)}
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${r.product.id}-detail`}>
                        <td colSpan={16} className="bg-muted/30 p-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-card rounded-lg border p-4">
                              <div className="flex items-start gap-2 mb-3">
                                <Info size={16} className="text-primary mt-0.5 shrink-0" />
                                <div>
                                  <div className="text-sm font-semibold mb-1">Análisis de sobreinventario</div>
                                  <p className="text-xs text-muted-foreground leading-relaxed">{r.overstockExplanation}</p>
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
                                  <div className="text-[10px] text-muted-foreground">Uds. excedentes</div>
                                  <div className="text-sm font-bold text-destructive">{r.excessUnits}</div>
                                </div>
                                <div className="bg-muted/50 rounded-lg p-2 text-center">
                                  <div className="text-[10px] text-muted-foreground">Cob. máx. cat.</div>
                                  <div className="text-sm font-bold">{PLANNING_CONFIG.overstockThresholds[r.product.category]?.maxCoverage ?? 180}d</div>
                                </div>
                              </div>
                              <div className="mt-3">
                                <div className="text-xs font-semibold mb-1">Impacto financiero</div>
                                <div className="grid grid-cols-3 gap-2 text-[10px]">
                                  <div className="bg-muted/50 rounded-lg p-2 text-center">
                                    <div className="text-muted-foreground">Costo unitario</div>
                                    <div className="font-bold">{fmt(r.product.cost)}</div>
                                  </div>
                                  <div className="bg-muted/50 rounded-lg p-2 text-center">
                                    <div className="text-muted-foreground">Valor total inv.</div>
                                    <div className="font-bold">{fmt(r.stockValue)}</div>
                                  </div>
                                  <div className="bg-destructive/5 rounded-lg p-2 text-center">
                                    <div className="text-muted-foreground">Capital detenido</div>
                                    <div className="font-bold text-destructive">{fmt(r.excessValue)}</div>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="bg-card rounded-lg border p-4">
                              <div className="text-sm font-semibold mb-2">Acciones sugeridas</div>
                              <div className="space-y-2">
                                {r.overstockSuggestions.map((s, i) => (
                                  <div key={i} className="flex items-center gap-2 bg-muted/50 rounded-lg p-2">
                                    <SuggestionBadge suggestion={s} />
                                  </div>
                                ))}
                              </div>
                              <div className="mt-4 text-xs text-muted-foreground">
                                <div className="font-semibold text-foreground mb-1">Proveedor</div>
                                <div>{r.product.supplier}</div>
                                <div className="mt-2 font-semibold text-foreground mb-1">Lead time</div>
                                <div>{r.leadTime.total} días</div>
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
                <tr><td colSpan={16} className="text-center text-muted-foreground py-8">Sin productos con exceso de inventario</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="bg-card rounded-xl border p-4 mt-4">
          <div className="text-xs font-semibold mb-2">Leyenda de estados</div>
          <div className="flex flex-wrap gap-3">
            {(Object.entries(OVERSTOCK_STATUS_LABELS) as [OverstockStatus, string][]).map(([key, label]) => (
              <div key={key} className="flex items-center gap-1.5">
                <span className={`inline-block w-2.5 h-2.5 rounded-full ${OVERSTOCK_STATUS_COLORS[key].bg} ${OVERSTOCK_STATUS_COLORS[key].text}`} style={{ boxShadow: 'inset 0 0 0 4px currentColor' }} />
                <span className="text-[10px] text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 text-[10px] text-muted-foreground">
            Umbrales: &gt;180d vigilar · &gt;270d sobreinventario · &gt;365d riesgo muerto (configurable por categoría)
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
