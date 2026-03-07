import { useState, useMemo } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import {
  analyzeProducts, getPlanningSummary, simulateGrowth, simulateImport,
  type ProductAnalysis, type ImportSimulation,
} from '@/lib/planningEngine';
import { demoProducts } from '@/data/demo-data';
import MetricCard from '@/components/shared/MetricCard';
import {
  AlertTriangle, TrendingUp, Package, DollarSign, Truck, BarChart3,
  ShieldAlert, Zap, Star, ArrowUpDown, Crown, Skull, Clock, Target,
  Calculator, Warehouse, ShoppingCart, Filter, ChevronDown, ChevronUp,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);
const fmtNum = (n: number) =>
  new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1 }).format(n);

type TabKey = 'dashboard' | 'demanda' | 'reorden' | 'compras' | 'simulador' | 'inventario' | 'muerto' | 'estrategico' | 'crecimiento';

const TABS: { key: TabKey; label: string; icon: any }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  { key: 'demanda', label: 'Demanda', icon: TrendingUp },
  { key: 'reorden', label: 'Reorden', icon: AlertTriangle },
  { key: 'compras', label: 'Planeador Compras', icon: ShoppingCart },
  { key: 'simulador', label: 'Simulador Import', icon: Truck },
  { key: 'inventario', label: 'Inventario Ideal', icon: Warehouse },
  { key: 'muerto', label: 'Inv. Muerto', icon: Skull },
  { key: 'estrategico', label: 'Clasificación', icon: Star },
  { key: 'crecimiento', label: 'Crecimiento', icon: Target },
];

const RISK_CONFIG = {
  critico: { label: 'Crítico', className: 'bg-destructive/10 text-destructive border-destructive/30' },
  alerta: { label: 'Alerta', className: 'bg-warning/10 text-warning border-warning/30' },
  ok: { label: 'OK', className: 'bg-success/10 text-success border-success/30' },
  excedente: { label: 'Excedente', className: 'bg-accent text-accent-foreground border-accent' },
};

const CAT_CONFIG = {
  estrella: { label: '⭐ Estrella', desc: 'Alta venta + Alta rentabilidad', color: 'text-warning' },
  rotacion: { label: '🔄 Rotación', desc: 'Alta venta + Menor margen', color: 'text-primary' },
  premium: { label: '💎 Premium', desc: 'Alta rentabilidad + Menor rotación', color: 'text-success' },
  problematico: { label: '⚠️ Problemático', desc: 'Baja venta + Bajo margen', color: 'text-destructive' },
};

export default function PlanningPage() {
  const { currentRole } = useAppContext();
  const [tab, setTab] = useState<TabKey>('dashboard');
  const [sortField, setSortField] = useState<string>('');
  const [sortAsc, setSortAsc] = useState(true);
  const [purchaseSearch, setPurchaseSearch] = useState('');
  const [purchaseCat, setPurchaseCat] = useState('');
  const [purchasePriority, setPurchasePriority] = useState('');

  // Simulation state
  const [simProductId, setSimProductId] = useState(demoProducts[0]?.id ?? '');
  const [simQty, setSimQty] = useState(10);
  const [simFreight, setSimFreight] = useState(50000);
  const [simCustoms, setSimCustoms] = useState(35000);
  const [growthFactor, setGrowthFactor] = useState(2);

  const analyses = useMemo(() => analyzeProducts(), []);
  const summary = useMemo(() => getPlanningSummary(analyses), [analyses]);
  const growth = useMemo(() => simulateGrowth(analyses, growthFactor), [analyses, growthFactor]);
  const importSim = useMemo(
    () => simulateImport(simProductId, simQty, simFreight, simCustoms, analyses),
    [simProductId, simQty, simFreight, simCustoms, analyses]
  );

  // Access control
  const allowed = ['director', 'administracion', 'compras'].includes(currentRole);
  if (!allowed) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <ShieldAlert size={48} className="text-destructive" />
        <h2 className="text-xl font-bold">Acceso restringido</h2>
        <p className="text-muted-foreground">Este módulo está disponible solo para Director, Administración y Compras.</p>
      </div>
    );
  }

  // Sort helper
  const sortedAnalyses = [...analyses].sort((a, b) => {
    if (!sortField) return 0;
    const valA = (a as any)[sortField] ?? 0;
    const valB = (b as any)[sortField] ?? 0;
    return sortAsc ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
  });

  const toggleSort = (field: string) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(true); }
  };

  const SortIcon = ({ field }: { field: string }) => (
    <button onClick={() => toggleSort(field)} className="inline-flex ml-1 text-muted-foreground hover:text-foreground">
      {sortField === field ? (sortAsc ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : <ArrowUpDown size={12} />}
    </button>
  );

  // ─── Chart data ───────────────────────────────────────────────────
  const riskChartData = [
    { name: 'Crítico', value: summary.criticalProducts, fill: 'hsl(var(--destructive))' },
    { name: 'Alerta', value: summary.alertProducts, fill: 'hsl(var(--warning))' },
    { name: 'OK', value: summary.totalProducts - summary.criticalProducts - summary.alertProducts - summary.excessProducts, fill: 'hsl(var(--success))' },
    { name: 'Excedente', value: summary.excessProducts, fill: 'hsl(var(--accent))' },
  ];

  const catChartData = [
    { name: 'Estrella', value: summary.estrellas, fill: 'hsl(var(--warning))' },
    { name: 'Rotación', value: summary.rotacion, fill: 'hsl(var(--primary))' },
    { name: 'Premium', value: summary.premium, fill: 'hsl(var(--success))' },
    { name: 'Problemático', value: summary.problematicos, fill: 'hsl(var(--destructive))' },
  ];

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Planeación de Inventario y Compras</h1>
        <p className="page-subtitle">Análisis inteligente para decisiones de compra — "Qué comprar, cuándo comprar y cuánto comprar"</p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 mb-6 bg-muted/50 rounded-xl p-1">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
              tab === t.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══════════════════════ DASHBOARD ═══════════════════════ */}
      {tab === 'dashboard' && (
        <div className="space-y-6">
          {/* Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard title="Productos en riesgo" value={summary.criticalProducts} icon={AlertTriangle} variant="danger" />
            <MetricCard title="Alertas de reorden" value={summary.alertProducts} icon={ShieldAlert} variant="warning" />
            <MetricCard title="Capital necesario" value={fmt(summary.capitalNeeded)} icon={DollarSign} variant="primary" />
            <MetricCard title="Inventario muerto" value={fmt(summary.deadStockValue)} icon={Skull} />
          </div>

          {/* Charts row */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-card rounded-xl border p-5">
              <h3 className="font-display font-semibold mb-4">Nivel de riesgo de inventario</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={riskChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {riskChartData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-card rounded-xl border p-5">
              <h3 className="font-display font-semibold mb-4">Clasificación estratégica</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={catChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {catChartData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Critical products */}
          <div className="bg-card rounded-xl border p-5">
            <h3 className="font-display font-semibold mb-4 flex items-center gap-2">
              <AlertTriangle size={18} className="text-destructive" />
              Productos que necesitan compra urgente
            </h3>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Stock actual</th>
                    <th>En tránsito</th>
                    <th>Punto reorden</th>
                    <th>Demanda 3M</th>
                    <th>Compra sugerida</th>
                    <th>Riesgo</th>
                  </tr>
                </thead>
                <tbody>
                  {analyses
                    .filter(a => a.riskLevel === 'critico' || a.riskLevel === 'alerta')
                    .sort((a, b) => (a.riskLevel === 'critico' ? -1 : 1))
                    .map(a => (
                      <tr key={a.product.id}>
                        <td className="font-medium">{a.product.name}</td>
                        <td className="font-semibold">{a.totalStock}</td>
                        <td>{a.inTransit}</td>
                        <td>{a.reorderPoint}</td>
                        <td>{a.demand3m}</td>
                        <td className="font-bold text-primary">{a.suggestedPurchase}</td>
                        <td>
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${RISK_CONFIG[a.riskLevel].className}`}>
                            {RISK_CONFIG[a.riskLevel].label}
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Quick summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard title="Prod. Estrella" value={summary.estrellas} icon={Star} variant="warning" />
            <MetricCard title="Prod. Rotación" value={summary.rotacion} icon={Zap} variant="primary" />
            <MetricCard title="Prod. Premium" value={summary.premium} icon={Crown} variant="success" />
            <MetricCard title="Prod. Problemáticos" value={summary.problematicos} icon={Skull} variant="danger" />
          </div>
        </div>
      )}

      {/* ═══════════════════════ DEMANDA ═══════════════════════ */}
      {tab === 'demanda' && (
        <div className="bg-card rounded-xl border overflow-x-auto">
          <div className="p-5 border-b">
            <h3 className="font-display font-semibold flex items-center gap-2">
              <TrendingUp size={18} className="text-primary" />
              Predicción de demanda por producto
            </h3>
            <p className="text-xs text-muted-foreground mt-1">Basado en ventas históricas y cotizaciones activas</p>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Venta/mes <SortIcon field="monthlySales" /></th>
                <th>Venta/trimestre</th>
                <th>Venta/año</th>
                <th>Demanda 3M <SortIcon field="demand3m" /></th>
                <th>Demanda 6M</th>
                <th>Demanda 12M</th>
                <th>En cotizaciones</th>
              </tr>
            </thead>
            <tbody>
              {sortedAnalyses.map(a => (
                <tr key={a.product.id}>
                  <td className="font-medium">{a.product.name}</td>
                  <td className="font-semibold">{fmtNum(a.monthlySales)}</td>
                  <td>{fmtNum(a.quarterlySales)}</td>
                  <td>{fmtNum(a.annualSales)}</td>
                  <td className="font-bold text-primary">{a.demand3m}</td>
                  <td>{a.demand6m}</td>
                  <td>{a.demand12m}</td>
                  <td>{a.quotationDemand > 0 ? <span className="text-warning font-semibold">{a.quotationDemand}</span> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ═══════════════════════ REORDEN ═══════════════════════ */}
      {tab === 'reorden' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <MetricCard title="Productos en punto de reorden" value={analyses.filter(a => a.totalStock <= a.reorderPoint).length} icon={AlertTriangle} variant="danger" />
            <MetricCard title="Días promedio de stock" value={Math.round(analyses.reduce((s, a) => s + a.daysOfStock, 0) / analyses.length)} icon={Clock} />
            <MetricCard title="Productos OK" value={analyses.filter(a => a.riskLevel === 'ok').length} icon={Package} variant="success" />
          </div>

          <div className="bg-card rounded-xl border overflow-x-auto">
            <div className="p-5 border-b">
              <h3 className="font-display font-semibold flex items-center gap-2">
                <AlertTriangle size={18} className="text-warning" />
                Punto de reorden por producto
              </h3>
              <p className="text-xs text-muted-foreground mt-1">Fórmula: Demanda diaria × Lead Time total</p>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Demanda diaria</th>
                  <th>Lead Time</th>
                  <th>Punto reorden <SortIcon field="reorderPoint" /></th>
                  <th>Stock actual <SortIcon field="totalStock" /></th>
                  <th>Días de stock <SortIcon field="daysOfStock" /></th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {sortedAnalyses.map(a => (
                  <tr key={a.product.id} className={a.riskLevel === 'critico' ? 'bg-destructive/5' : ''}>
                    <td className="font-medium">{a.product.name}</td>
                    <td>{fmtNum(a.dailyDemand)}</td>
                    <td>{a.leadTime.total} días</td>
                    <td className="font-bold">{a.reorderPoint}</td>
                    <td className="font-semibold">{a.totalStock}</td>
                    <td>
                      <span className={a.daysOfStock < 30 ? 'text-destructive font-bold' : a.daysOfStock < 90 ? 'text-warning font-semibold' : 'text-success'}>
                        {a.daysOfStock > 900 ? '∞' : `${a.daysOfStock}d`}
                      </span>
                    </td>
                    <td>
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${RISK_CONFIG[a.riskLevel].className}`}>
                        {RISK_CONFIG[a.riskLevel].label}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Lead time detail */}
          <div className="bg-card rounded-xl border overflow-x-auto">
            <div className="p-5 border-b">
              <h3 className="font-display font-semibold flex items-center gap-2">
                <Clock size={18} className="text-primary" />
                Desglose de Lead Time por producto
              </h3>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Proveedor</th>
                  <th>Producción</th>
                  <th>Flete China</th>
                  <th>Barco</th>
                  <th>Aduana</th>
                  <th>Transporte Nal.</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {analyses.map(a => (
                  <tr key={a.product.id}>
                    <td className="font-medium">{a.product.name}</td>
                    <td className="text-xs text-muted-foreground">{a.product.supplier}</td>
                    <td>{a.leadTime.production > 0 ? `${a.leadTime.production}d` : '—'}</td>
                    <td>{a.leadTime.freightChina > 0 ? `${a.leadTime.freightChina}d` : '—'}</td>
                    <td>{a.leadTime.ocean > 0 ? `${a.leadTime.ocean}d` : '—'}</td>
                    <td>{a.leadTime.customs > 0 ? `${a.leadTime.customs}d` : '—'}</td>
                    <td>{a.leadTime.nationalTransport}d</td>
                    <td className="font-bold text-primary">{a.leadTime.total}d</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════════════ COMPRAS ═══════════════════════ */}
      {tab === 'compras' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard title="Productos a comprar" value={analyses.filter(a => a.suggestedPurchase > 0 && !a.shouldNotBuy).length} icon={ShoppingCart} variant="primary" />
            <MetricCard title="Inversión requerida" value={fmt(summary.suggestedPurchaseValue)} icon={DollarSign} variant="warning" />
            <MetricCard title="Valor inventario actual" value={fmt(summary.totalStockValue)} icon={Warehouse} />
            <MetricCard title="Prioridad alta" value={analyses.filter(a => a.suggestedPurchase > 0 && !a.shouldNotBuy && (a.riskLevel === 'critico' || a.riskLevel === 'alerta')).length} icon={AlertTriangle} variant="danger" subtitle="SKUs requieren atención" />
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap bg-card rounded-xl border p-3">
            <Filter size={14} className="text-muted-foreground" />
            <input
              placeholder="Buscar producto..."
              value={purchaseSearch}
              onChange={e => setPurchaseSearch(e.target.value)}
              className="px-3 py-1.5 rounded-lg border bg-background text-xs w-48"
            />
            <select value={purchaseCat} onChange={e => setPurchaseCat(e.target.value)} className="px-3 py-1.5 rounded-lg border bg-background text-xs">
              <option value="">Todas las categorías</option>
              {Object.entries(
                { elevadores: 'Elevadores', balanceadoras: 'Balanceadoras', desmontadoras: 'Desmontadoras', alineadoras: 'Alineadoras', hidraulico: 'Hidráulico', lubricacion: 'Lubricación', aire: 'Aire', otros: 'Otros' }
              ).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select value={purchasePriority} onChange={e => setPurchasePriority(e.target.value)} className="px-3 py-1.5 rounded-lg border bg-background text-xs">
              <option value="">Todas las prioridades</option>
              <option value="critico">🔴 Crítico</option>
              <option value="alerta">🟠 Alerta</option>
              <option value="ok">🟡 OK</option>
            </select>
          </div>

          <div className="bg-card rounded-xl border overflow-x-auto">
            <div className="p-5 border-b">
              <h3 className="font-display font-semibold flex items-center gap-2">
                <ShoppingCart size={18} className="text-primary" />
                Recomendaciones de compra — Plan anual
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Capa de recomendación basada en datos existentes del ERP: stock, tránsito, demanda y cobertura. No modifica métricas existentes.
              </p>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Categoría</th>
                  <th>Existencia actual</th>
                  <th>Inv. en tránsito</th>
                  <th>Ventas prom./mes</th>
                  <th>Días de inv.</th>
                  <th>Inv. objetivo</th>
                  <th>Compra sugerida <SortIcon field="suggestedPurchase" /></th>
                  <th>Prioridad</th>
                  <th>Motivo</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const priorityOrder: Record<string, number> = { critico: 0, alerta: 1, ok: 2, excedente: 3 };
                  let rows = analyses
                    .filter(a => a.suggestedPurchase > 0 && !a.shouldNotBuy)
                    .map(a => {
                      // Generate reason based on existing metrics
                      const reasons: string[] = [];
                      if (a.riskLevel === 'critico') reasons.push('Stock crítico');
                      else if (a.riskLevel === 'alerta') reasons.push('Stock en alerta');
                      if (a.daysOfStock < a.leadTime.total) reasons.push(`Cobertura < lead time (${a.leadTime.total}d)`);
                      if (a.demandTrend === 'crecimiento') reasons.push('Demanda en crecimiento');
                      if (a.usefulStock <= a.reorderPoint) reasons.push('Bajo punto de reorden');
                      if (a.quotationDemand > 0) reasons.push(`${a.quotationDemand} uds en cotizaciones`);
                      if (a.daysOfStock <= 30) reasons.push('< 30 días de inventario');
                      if (reasons.length === 0) reasons.push('Reposición preventiva');
                      return { a, reasons, priority: priorityOrder[a.riskLevel] ?? 3 };
                    });

                  // Apply filters
                  if (purchaseSearch) {
                    const s = purchaseSearch.toLowerCase();
                    rows = rows.filter(r => r.a.product.name.toLowerCase().includes(s) || r.a.product.sku.toLowerCase().includes(s));
                  }
                  if (purchaseCat) rows = rows.filter(r => r.a.product.category === purchaseCat);
                  if (purchasePriority) rows = rows.filter(r => r.a.riskLevel === purchasePriority);

                  // Sort: priority first, then suggested purchase desc
                  rows.sort((a, b) => a.priority !== b.priority ? a.priority - b.priority : b.a.suggestedPurchase - a.a.suggestedPurchase);

                  if (rows.length === 0) return (
                    <tr><td colSpan={10} className="text-center text-muted-foreground py-8">No hay recomendaciones de compra con los filtros actuales</td></tr>
                  );

                  return rows.map(({ a, reasons }) => (
                    <tr key={a.product.id}>
                      <td className="font-medium text-sm">{a.product.name}</td>
                      <td className="text-xs text-muted-foreground">{
                        ({ elevadores: 'Elevadores', balanceadoras: 'Balanceadoras', desmontadoras: 'Desmontadoras', alineadoras: 'Alineadoras', hidraulico: 'Hidráulico', lubricacion: 'Lubricación', aire: 'Aire', otros: 'Otros' } as Record<string, string>)[a.product.category] || a.product.category
                      }</td>
                      <td className="text-center font-semibold">{a.totalStock}</td>
                      <td className="text-center text-primary">{a.effectiveTransit > 0 ? a.effectiveTransit : a.inTransit || 0}</td>
                      <td className="text-center">{a.predictiveMonthlyDemand.toFixed(1)}</td>
                      <td className="text-center">
                        <span className={a.daysOfStock <= 30 ? 'text-destructive font-bold' : a.daysOfStock <= 60 ? 'text-warning font-semibold' : ''}>
                          {a.daysOfStock > 900 ? '∞' : `${a.daysOfStock}d`}
                        </span>
                      </td>
                      <td className="text-center text-muted-foreground">{a.idealStock}</td>
                      <td className="text-center font-bold text-primary">{a.suggestedPurchase} uds</td>
                      <td>
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${RISK_CONFIG[a.riskLevel].className}`}>
                          {RISK_CONFIG[a.riskLevel].label}
                        </span>
                      </td>
                      <td className="text-[11px] text-muted-foreground max-w-[200px]">{reasons.join('; ')}</td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════════════ SIMULADOR ═══════════════════════ */}
      {tab === 'simulador' && (
        <div className="space-y-6">
          <div className="bg-card rounded-xl border p-6">
            <h3 className="font-display font-semibold mb-4 flex items-center gap-2">
              <Calculator size={18} className="text-primary" />
              Simulador de importación desde China
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Producto</label>
                <select
                  value={simProductId}
                  onChange={e => setSimProductId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border bg-background text-sm"
                >
                  {demoProducts.filter(p => p.active).map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Cantidad a importar</label>
                <input type="number" min={1} value={simQty} onChange={e => setSimQty(+e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border bg-background text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Costo de flete (MXN)</label>
                <input type="number" min={0} value={simFreight} onChange={e => setSimFreight(+e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border bg-background text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Costo de aduana (MXN)</label>
                <input type="number" min={0} value={simCustoms} onChange={e => setSimCustoms(+e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border bg-background text-sm" />
              </div>
            </div>

            {importSim && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-muted/50 rounded-xl p-4 text-center">
                    <div className="text-xs text-muted-foreground mb-1">Inversión total</div>
                    <div className="text-lg font-bold text-primary">{fmt(importSim.totalInvestment)}</div>
                  </div>
                  <div className="bg-muted/50 rounded-xl p-4 text-center">
                    <div className="text-xs text-muted-foreground mb-1">Venta estimada</div>
                    <div className="text-lg font-bold text-success">{fmt(importSim.estimatedRevenue)}</div>
                  </div>
                  <div className="bg-muted/50 rounded-xl p-4 text-center">
                    <div className="text-xs text-muted-foreground mb-1">Utilidad proyectada</div>
                    <div className={`text-lg font-bold ${importSim.estimatedProfit > 0 ? 'text-success' : 'text-destructive'}`}>
                      {fmt(importSim.estimatedProfit)}
                    </div>
                  </div>
                  <div className="bg-muted/50 rounded-xl p-4 text-center">
                    <div className="text-xs text-muted-foreground mb-1">Cobertura con nuevo stock</div>
                    <div className="text-lg font-bold">{importSim.monthsCoverage} meses</div>
                  </div>
                </div>

                <div className="bg-muted/30 rounded-lg p-4">
                  <h4 className="text-sm font-semibold mb-2">Desglose de costos</h4>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                    <div><span className="text-muted-foreground">Costo producto:</span> <span className="font-semibold">{fmt(importSim.totalCost)}</span></div>
                    <div><span className="text-muted-foreground">Flete:</span> <span className="font-semibold">{fmt(importSim.freight)}</span></div>
                    <div><span className="text-muted-foreground">Aduana:</span> <span className="font-semibold">{fmt(importSim.customs)}</span></div>
                    <div><span className="text-muted-foreground">Stock actual:</span> <span className="font-semibold">{analyses.find(a => a.product.id === simProductId)?.totalStock ?? 0}</span></div>
                    <div><span className="text-muted-foreground">Nuevo stock:</span> <span className="font-bold text-primary">{importSim.newStock}</span></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════ INVENTARIO IDEAL ═══════════════════════ */}
      {tab === 'inventario' && (
        <div className="bg-card rounded-xl border overflow-x-auto">
          <div className="p-5 border-b">
            <h3 className="font-display font-semibold flex items-center gap-2">
              <Warehouse size={18} className="text-primary" />
              Inventario ideal por producto (cobertura 3 meses)
            </h3>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Venta mensual</th>
                <th>Stock actual</th>
                <th>En tránsito</th>
                <th>Stock ideal <SortIcon field="idealStock" /></th>
                <th>Diferencia <SortIcon field="stockDifference" /></th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {sortedAnalyses.map(a => (
                <tr key={a.product.id}>
                  <td className="font-medium">{a.product.name}</td>
                  <td>{fmtNum(a.monthlySales)}</td>
                  <td className="font-semibold">{a.totalStock}</td>
                  <td>{a.inTransit}</td>
                  <td className="font-bold">{a.idealStock}</td>
                  <td className={`font-bold ${a.stockDifference > 0 ? 'text-destructive' : a.stockDifference < -3 ? 'text-warning' : 'text-success'}`}>
                    {a.stockDifference > 0 ? `Faltan ${a.stockDifference}` : a.stockDifference < 0 ? `Sobran ${Math.abs(a.stockDifference)}` : 'Justo'}
                  </td>
                  <td>
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${RISK_CONFIG[a.riskLevel].className}`}>
                      {RISK_CONFIG[a.riskLevel].label}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ═══════════════════════ INVENTARIO MUERTO ═══════════════════════ */}
      {tab === 'muerto' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <MetricCard title="Valor inv. sin movimiento" value={fmt(summary.deadStockValue)} icon={Skull} variant="danger" />
            <MetricCard title="Productos baja rotación" value={analyses.filter(a => a.daysOfStock > 180).length} icon={Clock} variant="warning" />
            <MetricCard title="Valor total inventario" value={fmt(summary.totalStockValue)} icon={Warehouse} />
          </div>

          <div className="bg-card rounded-xl border overflow-x-auto">
            <div className="p-5 border-b">
              <h3 className="font-display font-semibold flex items-center gap-2">
                <Skull size={18} className="text-destructive" />
                Análisis de inventario muerto / baja rotación
              </h3>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Categoría</th>
                  <th>Stock</th>
                  <th>Valor inventario</th>
                  <th>Días de stock <SortIcon field="daysOfStock" /></th>
                  <th>Venta mensual</th>
                  <th>Acción sugerida</th>
                </tr>
              </thead>
              <tbody>
                {sortedAnalyses
                  .filter(a => a.daysOfStock > 90)
                  .sort((a, b) => b.daysOfStock - a.daysOfStock)
                  .map(a => (
                    <tr key={a.product.id} className={a.daysOfStock > 365 ? 'bg-destructive/5' : ''}>
                      <td className="font-medium">{a.product.name}</td>
                      <td className="text-xs text-muted-foreground capitalize">{a.product.category}</td>
                      <td>{a.totalStock}</td>
                      <td className="font-semibold">{fmt(a.stockValue)}</td>
                      <td>
                        <span className={`font-bold ${a.daysOfStock > 365 ? 'text-destructive' : a.daysOfStock > 180 ? 'text-warning' : 'text-muted-foreground'}`}>
                          {a.daysOfStock > 900 ? '> 1 año' : `${a.daysOfStock}d`}
                        </span>
                      </td>
                      <td>{fmtNum(a.monthlySales)}</td>
                      <td>
                        {a.daysOfStock > 365 ? (
                          <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-destructive/10 text-destructive">🔥 Liquidación</span>
                        ) : a.daysOfStock > 180 ? (
                          <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-warning/10 text-warning">💰 Descuento</span>
                        ) : (
                          <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary">📢 Promoción</span>
                        )}
                      </td>
                    </tr>
                  ))}
                {analyses.filter(a => a.daysOfStock > 90).length === 0 && (
                  <tr><td colSpan={7} className="text-center text-muted-foreground py-8">No se detecta inventario muerto</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════════════ CLASIFICACIÓN ESTRATÉGICA ═══════════════════════ */}
      {tab === 'estrategico' && (
        <div className="space-y-6">
          {/* Category explanation */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(CAT_CONFIG).map(([key, conf]) => (
              <div key={key} className="bg-card rounded-xl border p-4">
                <div className={`text-lg font-bold ${conf.color} mb-1`}>{conf.label}</div>
                <div className="text-xs text-muted-foreground">{conf.desc}</div>
                <div className="text-2xl font-bold mt-2">
                  {analyses.filter(a => a.category === key).length}
                </div>
              </div>
            ))}
          </div>

          <div className="bg-card rounded-xl border overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Clasificación</th>
                  <th>Venta/mes</th>
                  <th>Margen % <SortIcon field="margin" /></th>
                  <th>Ingreso anual</th>
                  <th>Utilidad anual</th>
                  <th>Costo</th>
                  <th>Precio</th>
                </tr>
              </thead>
              <tbody>
                {sortedAnalyses.map(a => (
                  <tr key={a.product.id}>
                    <td className="font-medium">{a.product.name}</td>
                    <td>
                      <span className={`font-semibold ${CAT_CONFIG[a.category].color}`}>
                        {CAT_CONFIG[a.category].label}
                      </span>
                    </td>
                    <td>{fmtNum(a.monthlySales)}</td>
                    <td className={`font-bold ${a.margin >= 40 ? 'text-success' : a.margin >= 30 ? 'text-primary' : 'text-destructive'}`}>{a.margin}%</td>
                    <td>{fmt(a.annualRevenue)}</td>
                    <td className="font-semibold text-success">{fmt(a.annualProfit)}</td>
                    <td className="text-muted-foreground">{fmt(a.product.cost)}</td>
                    <td>{fmt(a.product.listPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════════════ CRECIMIENTO ═══════════════════════ */}
      {tab === 'crecimiento' && (
        <div className="space-y-6">
          <div className="bg-card rounded-xl border p-6">
            <h3 className="font-display font-semibold mb-4 flex items-center gap-2">
              <Target size={18} className="text-primary" />
              Simulación de crecimiento
            </h3>
            <div className="mb-6">
              <label className="text-xs font-medium text-muted-foreground mb-2 block">
                Factor de crecimiento: <span className="text-foreground font-bold">{growthFactor}x</span>
                {growthFactor === 2 && ' (duplicar ventas)'}
                {growthFactor === 3 && ' (triplicar ventas)'}
              </label>
              <input
                type="range"
                min={0}
                max={3.5}
                step={0.5}
                value={growthFactor}
                onChange={e => setGrowthFactor(+e.target.value)}
                className="w-full max-w-md"
              />
              <div className="flex justify-between text-xs text-muted-foreground max-w-md">
                <span>0x</span><span>1x</span><span>2x</span><span>3x</span><span>3.5x</span>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-muted/50 rounded-xl p-4 text-center">
                <div className="text-xs text-muted-foreground mb-1">Ingreso actual anual</div>
                <div className="text-lg font-bold">{fmt(growth.currentRevenue)}</div>
              </div>
              <div className="bg-muted/50 rounded-xl p-4 text-center">
                <div className="text-xs text-muted-foreground mb-1">Ingreso objetivo ({growthFactor}x)</div>
                <div className="text-lg font-bold text-primary">{fmt(growth.targetRevenue)}</div>
              </div>
              <div className="bg-muted/50 rounded-xl p-4 text-center">
                <div className="text-xs text-muted-foreground mb-1">Capital requerido</div>
                <div className="text-lg font-bold text-warning">{fmt(growth.capitalRequired)}</div>
              </div>
              <div className="bg-muted/50 rounded-xl p-4 text-center">
                <div className="text-xs text-muted-foreground mb-1">Utilidad estimada anual</div>
                <div className="text-lg font-bold text-success">{fmt(growth.estimatedProfit)}</div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-primary/5 rounded-lg border border-primary/20">
              <h4 className="text-sm font-semibold mb-2">📊 Resumen para el Director</h4>
              <p className="text-sm text-muted-foreground">
                Para crecer <strong>{growthFactor}x</strong>, la empresa necesita invertir{' '}
                <strong className="text-foreground">{fmt(growth.capitalRequired)}</strong> en inventario adicional.
                Esto generaría ingresos anuales de{' '}
                <strong className="text-foreground">{fmt(growth.targetRevenue)}</strong> con una utilidad estimada de{' '}
                <strong className="text-success">{fmt(growth.estimatedProfit)}</strong>.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
