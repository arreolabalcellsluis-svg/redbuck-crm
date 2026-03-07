import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import CommercialSections from '@/components/dashboard/CommercialSections';
import { useAppContext } from '@/contexts/AppContext';
import {
  dashboardMetrics, salesByVendor, salesByCategory, monthlySales,
  demoImports, demoAccountsReceivable, demoOpportunities, demoProducts, demoOrders, demoCustomers,
} from '@/data/demo-data';
import { analyzeProducts, getPlanningSummary } from '@/lib/planningEngine';
import { getFinancialAnalysis } from '@/lib/financialSimulator';
import { generateRestockOpportunities, getRestockAlerts } from '@/lib/restockEngine';
import { IMPORT_STATUS_LABELS } from '@/types';
import MetricCard from '@/components/shared/MetricCard';
import StatusBadge from '@/components/shared/StatusBadge';
import {
  DollarSign, TrendingUp, Package, Warehouse, Activity, ShieldAlert,
  BarChart3, Target, Users, FileText, ShoppingCart, CreditCard, Globe,
  Zap, Star, ArrowRight, AlertTriangle, Clock, Skull, Crown, Percent,
  Banknote, ArrowUpRight, ArrowDownRight, Layers, PackageX, CalendarClock, Calculator, RefreshCw,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from 'recharts';

// ─── Helpers ────────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);
const fmtPct = (n: number) => `${n.toFixed(1)}%`;
const COLORS = [
  'hsl(0,78%,45%)', 'hsl(210,100%,52%)', 'hsl(142,71%,45%)',
  'hsl(38,92%,50%)', 'hsl(280,65%,55%)', 'hsl(0,0%,60%)',
  'hsl(190,80%,45%)', 'hsl(330,70%,50%)',
];

export default function ExecutiveDashboardPage() {
  const { currentRole } = useAppContext();
  const navigate = useNavigate();

  const analyses = useMemo(() => analyzeProducts(), []);
  const summary = useMemo(() => getPlanningSummary(analyses), [analyses]);
  const fin = useMemo(() => getFinancialAnalysis(analyses), [analyses]);

  const invByCategory = useMemo(() => {
    const cats: Record<string, number> = {};
    demoProducts.forEach(p => {
      if (!p.active || !p.stock) return;
      const total = Object.values(p.stock).reduce((a, b) => a + b, 0);
      const cat = p.category.charAt(0).toUpperCase() + p.category.slice(1);
      cats[cat] = (cats[cat] || 0) + total * p.cost;
    });
    return Object.entries(cats).map(([name, value]) => ({ name, value }));
  }, []);

  const leadsBySource = useMemo(() => {
    const sources: Record<string, number> = {};
    demoCustomers.forEach(c => {
      const label = c.source.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      sources[label] = (sources[label] || 0) + 1;
    });
    return Object.entries(sources)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, []);

  const alerts = useMemo(() => {
    const list: { type: 'danger' | 'warning' | 'info'; message: string }[] = [];
    analyses.filter(a => a.riskLevel === 'critico').forEach(a =>
      list.push({ type: 'danger', message: `${a.product.name} — stock crítico (${a.totalStock} uds)` })
    );
    demoAccountsReceivable.filter(a => a.daysOverdue > 0).forEach(a =>
      list.push({ type: 'warning', message: `${a.customerName} — pago vencido ${a.daysOverdue}d (${fmt(a.balance)})` })
    );
    demoImports.filter(i => i.status === 'produccion').forEach(i =>
      list.push({ type: 'info', message: `${i.orderNumber} — ${IMPORT_STATUS_LABELS[i.status]}` })
    );
    analyses.filter(a => a.daysOfStock > 180).forEach(a =>
      list.push({ type: 'warning', message: `${a.product.name} — inventario sin rotación (${a.daysOfStock}d)` })
    );
    return list.slice(0, 10);
  }, [analyses]);

  // Access control
  if (currentRole !== 'director') {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <ShieldAlert size={48} className="text-destructive" />
        <h2 className="text-xl font-bold">Acceso restringido</h2>
        <p className="text-muted-foreground">Este dashboard es exclusivo para el Director.</p>
      </div>
    );
  }

  // ─── Derived metrics ──────────────────────────────────────────
  const salesMonth = dashboardMetrics.salesMonth;
  const salesGoal = 1_500_000;
  const salesPct = Math.round((salesMonth / salesGoal) * 100);
  const prevMonth = monthlySales[monthlySales.length - 2]?.sales ?? 0;
  const growthMoM = prevMonth > 0 ? ((salesMonth - prevMonth) / prevMonth) * 100 : 0;

  const grossProfit = salesMonth * (dashboardMetrics.grossMargin / 100);
  const operatingExpenses = salesMonth * 0.18;
  const netProfit = grossProfit - operatingExpenses;
  const netMargin = (netProfit / salesMonth) * 100;
  const ebitda = netProfit + salesMonth * 0.05;

  const totalReceivable = demoAccountsReceivable.reduce((s, a) => s + a.balance, 0);
  const totalPayable = demoImports.reduce((s, i) => s + (i.totalLanded * 17.2) * 0.3, 0);
  const cashInBank = salesMonth * 0.6;
  const netCashFlow = cashInBank - totalPayable + totalReceivable * 0.3;

  const lowStockProducts = analyses
    .filter(a => a.riskLevel === 'critico' || a.riskLevel === 'alerta')
    .sort((a, b) => a.daysOfStock - b.daysOfStock)
    .slice(0, 5);

  const vendorData = salesByVendor.map(v => ({
    ...v,
    deals: Math.round(v.sales / dashboardMetrics.avgTicket),
    avgTicket: dashboardMetrics.avgTicket,
    closeRate: Math.round(30 + Math.random() * 30),
  }));

  const profitRanking = [...analyses]
    .sort((a, b) => b.annualProfit - a.annualProfit)
    .slice(0, 8);

  // Strategic highlights
  const mostSold = analyses.sort((a, b) => b.monthlySales - a.monthlySales)[0];
  const mostProfitable = analyses.sort((a, b) => b.margin - a.margin)[0];
  const lowestRotation = analyses.sort((a, b) => b.daysOfStock - a.daysOfStock)[0];
  const topVendor = vendorData.sort((a, b) => b.closeRate - a.closeRate)[0];

  // Monthly growth data with %
  const monthlyGrowth = monthlySales.map((m, i) => ({
    ...m,
    growth: i > 0 ? Math.round(((m.sales - monthlySales[i - 1].sales) / monthlySales[i - 1].sales) * 100) : 0,
  }));

  // Inventory rotation
  const annualCOGS = analyses.reduce((s, a) => s + a.annualSales * a.product.cost, 0);
  const avgInventory = summary.totalStockValue;
  const inventoryRotation = avgInventory > 0 ? annualCOGS / avgInventory : 0;
  const daysOfInventory = inventoryRotation > 0 ? Math.round(365 / inventoryRotation) : 0;

  // Leads metrics
  const totalLeads = demoCustomers.length;
  const closedDeals = demoOpportunities.filter(o => o.stage === 'cierre_ganado').length;
  const conversionRate = totalLeads > 0 ? (closedDeals / totalLeads) * 100 : 0;

  // clickable card helper
  const clickCard = (path: string) => ({
    className: 'bg-card rounded-xl border p-4 cursor-pointer hover:shadow-lg hover:border-primary/30 hover:scale-[1.02] transition-all duration-200 group',
    onClick: () => navigate(path),
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <Crown size={20} className="text-primary-foreground" />
          </div>
          Dashboard Ejecutivo REDBUCK
        </h1>
        <p className="page-subtitle">Visión 360° del negocio — Marzo 2026</p>
      </div>

      {/* Restock alert banner */}
      {(() => {
        const restockAlerts = getRestockAlerts(generateRestockOpportunities());
        if (restockAlerts.length === 0) return null;
        return (
          <Link to="/crm/reabasto" className="block p-4 rounded-xl border border-success/30 bg-success/5 hover:bg-success/10 transition-colors group">
            <div className="flex items-center gap-3">
              <RefreshCw size={20} className="text-success shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-success">
                  Tienes {restockAlerts.length} oportunidad{restockAlerts.length !== 1 ? 'es' : ''} por reabasto disponibles para reactivar
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {restockAlerts.map(a => a.productName).slice(0, 3).join(', ')}{restockAlerts.length > 3 ? ` y ${restockAlerts.length - 3} más` : ''}
                </p>
              </div>
              <ArrowRight size={16} className="text-success opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
            </div>
          </Link>
        );
      })()}

      {/* ═══ SECCIÓN 1: TOP KPIs ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {/* 1. Ventas del mes */}
        <div {...clickCard('/reportes/ventas')} style={{ borderLeft: '4px solid hsl(var(--primary))' }}>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <DollarSign size={14} /> Ventas del mes
          </div>
          <div className="text-xl font-bold group-hover:text-primary transition-colors">{fmt(salesMonth)}</div>
          <div className="flex items-center justify-between mt-2">
            <div className="w-full bg-muted rounded-full h-2">
              <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${Math.min(salesPct, 100)}%` }} />
            </div>
            <span className="text-xs font-bold ml-2 whitespace-nowrap">{salesPct}%</span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">Meta: {fmt(salesGoal)}</div>
          <div className={`text-xs font-semibold mt-1 flex items-center gap-1 ${growthMoM >= 0 ? 'text-success' : 'text-destructive'}`}>
            {growthMoM >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {fmtPct(Math.abs(growthMoM))} vs mes anterior
          </div>
          <div className="text-[10px] text-muted-foreground mt-1 opacity-0 group-hover:opacity-100 transition-opacity">Click para ver detalle →</div>
        </div>

        {/* 2. Utilidad */}
        <div {...clickCard('/reportes/rentabilidad')} style={{ borderLeft: '4px solid hsl(var(--success))' }}>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <TrendingUp size={14} /> Utilidad del mes
          </div>
          <div className="text-xl font-bold text-success group-hover:text-primary transition-colors">{fmt(netProfit)}</div>
          <div className="grid grid-cols-2 gap-1 mt-2 text-[11px]">
            <div><span className="text-muted-foreground">Bruta:</span> <span className="font-semibold">{fmt(grossProfit)}</span></div>
            <div><span className="text-muted-foreground">Margen:</span> <span className="font-semibold">{fmtPct(netMargin)}</span></div>
          </div>
          <div className="text-[10px] text-muted-foreground mt-1 opacity-0 group-hover:opacity-100 transition-opacity">Click para ver detalle →</div>
        </div>

        {/* 3. Inventario */}
        <div {...clickCard('/reportes/inventario')} style={{ borderLeft: '4px solid hsl(var(--warning))' }}>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Warehouse size={14} /> Inventario total
          </div>
          <div className="text-xl font-bold group-hover:text-primary transition-colors">{fmt(summary.totalStockValue)}</div>
          <div className="space-y-0.5 mt-2">
            {invByCategory.slice(0, 3).map(c => (
              <div key={c.name} className="text-[10px] flex justify-between">
                <span className="text-muted-foreground">{c.name}</span>
                <span className="font-medium">{fmt(c.value)}</span>
              </div>
            ))}
          </div>
          <div className="text-[10px] text-muted-foreground mt-1 opacity-0 group-hover:opacity-100 transition-opacity">Click para ver detalle →</div>
        </div>

        {/* 4. Flujo de efectivo */}
        <div {...clickCard('/cobranza')} style={{ borderLeft: '4px solid hsl(var(--info))' }}>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Banknote size={14} /> Flujo de efectivo
          </div>
          <div className={`text-xl font-bold ${netCashFlow >= 0 ? 'text-success' : 'text-destructive'} group-hover:text-primary transition-colors`}>{fmt(netCashFlow)}</div>
          <div className="space-y-0.5 mt-2 text-[10px]">
            <div className="flex justify-between"><span className="text-muted-foreground">En banco:</span> <span className="font-medium">{fmt(cashInBank)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">x Cobrar:</span> <span className="font-medium text-warning">{fmt(totalReceivable)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">x Pagar:</span> <span className="font-medium text-destructive">{fmt(totalPayable)}</span></div>
          </div>
        </div>

        {/* 5. Productos por agotarse (predictivo) */}
        <div {...clickCard('/reportes/bajo-stock')} style={{ borderLeft: '4px solid hsl(var(--destructive))' }}>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <AlertTriangle size={14} /> Por agotarse
          </div>
          <div className="text-xl font-bold text-destructive group-hover:text-primary transition-colors">{summary.requirePurchase} <span className="text-xs font-normal text-muted-foreground">SKUs</span></div>
          <div className="space-y-0.5 mt-2">
            <div className="text-[10px] flex justify-between">
              <span className="text-muted-foreground">🔴 Compra inmediata</span>
              <span className="font-bold text-destructive">{summary.immediateAction}</span>
            </div>
            <div className="text-[10px] flex justify-between">
              <span className="text-muted-foreground">🟠 Riesgo desabasto</span>
              <span className="font-bold text-destructive">{summary.stockoutRisk}</span>
            </div>
            <div className="text-[10px] flex justify-between">
              <span className="text-muted-foreground">💰 Reposición est.</span>
              <span className="font-bold text-primary">{fmt(summary.totalRepositionValue)}</span>
            </div>
          </div>
          <div className="text-[10px] text-muted-foreground mt-1 opacity-0 group-hover:opacity-100 transition-opacity">Click para ver motor predictivo →</div>
        </div>
      </div>

      {/* ═══ SECCIÓN 2: VENTAS ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ventas últimos meses */}
        <div className="bg-card rounded-xl border p-5 cursor-pointer hover:shadow-lg hover:border-primary/30 transition-all group"
          onClick={() => navigate('/reportes/ventas')}>
          <h3 className="font-display font-semibold mb-1 group-hover:text-primary transition-colors">
            Ventas últimos 6 meses
            <span className="text-[10px] text-muted-foreground ml-2 opacity-0 group-hover:opacity-100 transition-opacity">Ver detalle →</span>
          </h3>
          <p className="text-xs text-muted-foreground mb-4">Crecimiento mensual: <span className={`font-bold ${growthMoM >= 0 ? 'text-success' : 'text-destructive'}`}>{fmtPct(growthMoM)}</span></p>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={monthlyGrowth}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => fmt(v)} />
              <Bar dataKey="sales" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Ventas" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Ventas por categoría */}
        <div className="bg-card rounded-xl border p-5 cursor-pointer hover:shadow-lg hover:border-primary/30 transition-all group"
          onClick={() => navigate('/reportes/ventas-sku')}>
          <h3 className="font-display font-semibold mb-4 group-hover:text-primary transition-colors">
            Ventas por producto
            <span className="text-[10px] text-muted-foreground ml-2 opacity-0 group-hover:opacity-100 transition-opacity">Ver detalle →</span>
          </h3>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={salesByCategory} cx="50%" cy="50%" outerRadius={85} innerRadius={40} dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                {salesByCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v: number) => fmt(v)} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Ventas por vendedor */}
      <div className="bg-card rounded-xl border overflow-x-auto">
        <div className="p-5 border-b cursor-pointer hover:bg-muted/30 transition-colors group"
          onClick={() => navigate('/reportes/vendedor')}>
          <h3 className="font-display font-semibold flex items-center gap-2 group-hover:text-primary transition-colors">
            <Users size={18} className="text-primary" /> Ventas por vendedor
            <span className="text-[10px] text-muted-foreground ml-2 opacity-0 group-hover:opacity-100 transition-opacity">Ver detalle →</span>
          </h3>
        </div>
        <table className="data-table">
          <thead>
            <tr><th>Vendedor</th><th>Ventas mes</th><th># Ventas</th><th>Ticket prom.</th><th>Tasa cierre</th></tr>
          </thead>
          <tbody>
            {vendorData.map(v => (
              <tr key={v.name} className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => navigate(`/reportes/vendedor?nombre=${encodeURIComponent(v.name)}`)}>
                <td className="font-medium group-hover:text-primary">{v.name}</td>
                <td className="font-bold">{fmt(v.sales)}</td>
                <td>{v.deals}</td>
                <td>{fmt(v.avgTicket)}</td>
                <td>
                  <span className={`font-semibold ${v.closeRate >= 50 ? 'text-success' : v.closeRate >= 30 ? 'text-warning' : 'text-destructive'}`}>
                    {v.closeRate}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ═══ SECCIÓN 3: INVENTARIO ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <MetricCard title="Rotación inventario" value={`${inventoryRotation.toFixed(1)}x`} icon={Activity} variant="primary" subtitle="anual" href="/reportes/inventario" />
        <MetricCard title="Días de inventario" value={daysOfInventory} icon={Clock} variant={daysOfInventory > 90 ? 'warning' : 'success'} subtitle={daysOfInventory <= 90 ? 'Saludable' : 'Excesivo'} href="/reportes/inventario" />
        <MetricCard title="Inventario muerto" value={fmt(summary.deadStockValue)} icon={Skull} variant="danger" subtitle="> 180 días" href="/reportes/inventario-muerto" />
        <MetricCard title="Productos excedentes" value={summary.excessProducts} icon={Layers} variant="warning" href="/reportes/inventario" />

        {/* Simulador financiero KPI */}
        <div {...clickCard('/reportes/simulador-financiero')} style={{ borderLeft: '4px solid hsl(var(--info))' }}>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Calculator size={14} /> Simulador financiero
          </div>
          <div className="text-xl font-bold group-hover:text-primary transition-colors">{fmt(fin.totalInventoryValue)}</div>
          <div className="space-y-0.5 mt-2">
            <div className="text-[10px] flex justify-between">
              <span className="text-muted-foreground">ROI inv.</span>
              <span className="font-bold text-success">{fmtPct(fin.roi)}</span>
            </div>
            <div className="text-[10px] flex justify-between">
              <span className="text-muted-foreground">Capital lento</span>
              <span className="font-bold text-warning">{fmt(fin.slowInventoryValue)}</span>
            </div>
          </div>
          <div className="text-[10px] text-muted-foreground mt-1 opacity-0 group-hover:opacity-100 transition-opacity">Click para simulador →</div>
        </div>

        {/* Sobreinventario KPI */}
        <div {...clickCard('/reportes/sobreinventario')} style={{ borderLeft: '4px solid hsl(var(--warning))' }}>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <PackageX size={14} /> Sobreinventario
          </div>
          <div className="text-xl font-bold text-warning group-hover:text-primary transition-colors">{summary.overstockProducts} <span className="text-xs font-normal text-muted-foreground">SKUs</span></div>
          <div className="space-y-0.5 mt-2">
            <div className="text-[10px] flex justify-between">
              <span className="text-muted-foreground">Capital excedente</span>
              <span className="font-bold text-destructive">{fmt(summary.totalExcessValue)}</span>
            </div>
            <div className="text-[10px] flex justify-between">
              <span className="text-muted-foreground">Riesgo muerto</span>
              <span className="font-bold text-destructive">{summary.overstockRiskProducts}</span>
            </div>
          </div>
          <div className="text-[10px] text-muted-foreground mt-1 opacity-0 group-hover:opacity-100 transition-opacity">Click para ver detalle →</div>
        </div>

        {/* Planeación importaciones KPI */}
        <div {...clickCard('/reportes/plan-importaciones')} style={{ borderLeft: '4px solid hsl(var(--primary))' }}>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <CalendarClock size={14} /> Plan importaciones
          </div>
          <div className="text-xl font-bold group-hover:text-primary transition-colors">{summary.purchaseUrgentProducts + summary.purchaseSoonProducts} <span className="text-xs font-normal text-muted-foreground">compras pendientes</span></div>
          <div className="space-y-0.5 mt-2">
            <div className="text-[10px] flex justify-between">
              <span className="text-muted-foreground">🔴 Urgentes</span>
              <span className="font-bold text-destructive">{summary.purchaseUrgentProducts}</span>
            </div>
            <div className="text-[10px] flex justify-between">
              <span className="text-muted-foreground">Inversión est.</span>
              <span className="font-bold text-primary">{fmt(summary.nextPurchaseValue)}</span>
            </div>
          </div>
          <div className="text-[10px] text-muted-foreground mt-1 opacity-0 group-hover:opacity-100 transition-opacity">Click para ver plan →</div>
        </div>
      </div>

      {/* ═══ SECCIÓN 4: IMPORTACIONES ═══ */}
      <div className="bg-card rounded-xl border p-5 cursor-pointer hover:shadow-lg transition-all" onClick={() => navigate('/importaciones')}>
        <h3 className="font-display font-semibold mb-4 flex items-center gap-2">
          <Globe size={18} className="text-primary" /> Importaciones activas
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {demoImports.map(imp => (
            <div key={imp.id} className="p-4 rounded-xl bg-muted/50 border">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-sm">{imp.orderNumber}</span>
                <StatusBadge status={imp.status} type="import" />
              </div>
              <p className="text-xs text-muted-foreground mb-2">{imp.supplier}</p>
              <div className="space-y-1 text-xs">
                {imp.items.map((item, i) => (
                  <div key={i} className="flex justify-between">
                    <span className="text-muted-foreground truncate mr-2">{item.productName}</span>
                    <span className="font-medium">{item.qty} uds</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-3 pt-2 border-t text-xs">
                <span className="text-muted-foreground">ETA: {imp.estimatedArrival}</span>
                <span className="font-semibold">{imp.daysInTransit}d tránsito</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ SECCIÓN 5: CRM Y MARKETING ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-xl border p-5 cursor-pointer hover:shadow-lg transition-all" onClick={() => navigate('/crm')}>
          <h3 className="font-display font-semibold mb-4">Leads y conversión</h3>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold text-primary">{totalLeads}</div>
              <div className="text-[10px] text-muted-foreground">Leads totales</div>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold text-success">{closedDeals}</div>
              <div className="text-[10px] text-muted-foreground">Ventas cerradas</div>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold">{fmtPct(conversionRate)}</div>
              <div className="text-[10px] text-muted-foreground">Conversión</div>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-xl border p-5">
          <h3 className="font-display font-semibold mb-4">Ventas por canal</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={leadsBySource} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={90} />
              <Tooltip />
              <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name="Leads" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ═══ SECCIÓN 6: RENTABILIDAD POR PRODUCTO ═══ */}
      <div className="bg-card rounded-xl border overflow-x-auto cursor-pointer hover:shadow-lg transition-all"
        onClick={() => navigate('/reportes/rentabilidad')}>
        <div className="p-5 border-b">
          <h3 className="font-display font-semibold flex items-center gap-2">
            <Star size={18} className="text-warning" /> Rentabilidad por producto (Top 8)
            <span className="text-[10px] text-muted-foreground ml-2">Click para ver reporte completo →</span>
          </h3>
        </div>
        <table className="data-table">
          <thead>
            <tr><th>Producto</th><th>Precio prom.</th><th>Costo</th><th>Utilidad/ud</th><th>Margen %</th><th>Utilidad anual est.</th></tr>
          </thead>
          <tbody>
            {profitRanking.map(a => (
              <tr key={a.product.id}>
                <td className="font-medium">{a.product.name}</td>
                <td>{fmt(a.product.listPrice)}</td>
                <td className="text-muted-foreground">{fmt(a.product.cost)}</td>
                <td className="font-semibold text-success">{fmt(a.product.listPrice - a.product.cost)}</td>
                <td>
                  <span className={`font-bold ${a.margin >= 40 ? 'text-success' : a.margin >= 30 ? 'text-primary' : 'text-destructive'}`}>
                    {a.margin}%
                  </span>
                </td>
                <td className="font-bold">{fmt(a.annualProfit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ═══ SECCIÓN 7: ALERTAS ═══ */}
      <div className="bg-card rounded-xl border p-5">
        <h3 className="font-display font-semibold mb-4 flex items-center gap-2">
          <AlertTriangle size={18} className="text-warning" /> Alertas del negocio
        </h3>
        <div className="space-y-2">
          {alerts.map((alert, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg border text-sm cursor-pointer hover:scale-[1.01] transition-all ${
                alert.type === 'danger' ? 'bg-destructive/5 border-destructive/20 text-destructive' :
                alert.type === 'warning' ? 'bg-warning/5 border-warning/20 text-warning' :
                'bg-primary/5 border-primary/20 text-primary'
              }`}
              onClick={() => {
                if (alert.type === 'danger') navigate('/reportes/bajo-stock');
                else if (alert.message.includes('vencido')) navigate('/cobranza');
                else if (alert.message.includes('rotación')) navigate('/reportes/inventario-muerto');
                else navigate('/importaciones');
              }}
            >
              {alert.type === 'danger' ? <AlertTriangle size={14} /> :
               alert.type === 'warning' ? <Clock size={14} /> :
               <Globe size={14} />}
              <span>{alert.message}</span>
              <ArrowRight size={12} className="ml-auto opacity-50" />
            </div>
          ))}
          {alerts.length === 0 && (
            <p className="text-muted-foreground text-center py-4">Sin alertas activas</p>
          )}
        </div>
      </div>

      {/* ═══ SECCIÓN 8: DECISIONES ESTRATÉGICAS ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div {...clickCard('/reportes/ventas-sku')}>
          <Zap size={20} className="mx-auto text-primary mb-2" />
          <div className="text-[10px] text-muted-foreground mb-1 text-center">Más vendido</div>
          <div className="text-sm font-bold truncate text-center">{mostSold?.product.name}</div>
          <div className="text-xs text-muted-foreground text-center">{mostSold?.monthlySales.toFixed(1)}/mes</div>
        </div>
        <div {...clickCard('/reportes/rentabilidad')}>
          <Star size={20} className="mx-auto text-warning mb-2" />
          <div className="text-[10px] text-muted-foreground mb-1 text-center">Más rentable</div>
          <div className="text-sm font-bold truncate text-center">{mostProfitable?.product.name}</div>
          <div className="text-xs text-success font-semibold text-center">{mostProfitable?.margin}% margen</div>
        </div>
        <div {...clickCard('/reportes/inventario-muerto')}>
          <Skull size={20} className="mx-auto text-destructive mb-2" />
          <div className="text-[10px] text-muted-foreground mb-1 text-center">Menor rotación</div>
          <div className="text-sm font-bold truncate text-center">{lowestRotation?.product.name}</div>
          <div className="text-xs text-destructive text-center">{lowestRotation?.daysOfStock > 900 ? '> 1 año' : `${lowestRotation?.daysOfStock}d`}</div>
        </div>
        <div {...clickCard('/reportes/vendedor')}>
          <Crown size={20} className="mx-auto text-success mb-2" />
          <div className="text-[10px] text-muted-foreground mb-1 text-center">Mayor conversión</div>
          <div className="text-sm font-bold truncate text-center">{topVendor?.name}</div>
          <div className="text-xs text-success font-semibold text-center">{topVendor?.closeRate}% cierre</div>
        </div>
      </div>

      {/* ═══ SECCIÓN 9: INDICADORES ESTRATÉGICOS ═══ */}
      <div className="bg-card rounded-xl border p-5">
        <h3 className="font-display font-semibold mb-4 flex items-center gap-2">
          <BarChart3 size={18} className="text-primary" /> Indicadores estratégicos
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {[
            { label: 'Ventas mensuales', value: fmt(salesMonth), path: '/reportes/ventas' },
            { label: 'Utilidad neta', value: fmt(netProfit), path: '/reportes/rentabilidad' },
            { label: 'Margen neto', value: fmtPct(netMargin), path: '/reportes/rentabilidad' },
            { label: 'EBITDA', value: fmt(ebitda), path: '/reportes/rentabilidad' },
            { label: 'Inventario total', value: fmt(summary.totalStockValue), path: '/reportes/inventario' },
            { label: 'Rotación inv.', value: `${inventoryRotation.toFixed(1)}x`, path: '/reportes/inventario' },
            { label: 'Flujo efectivo', value: fmt(netCashFlow), path: '/cobranza' },
            { label: 'Ctas. x cobrar', value: fmt(totalReceivable), path: '/cobranza' },
            { label: 'Ctas. x pagar', value: fmt(totalPayable), path: '/importaciones' },
            { label: 'Ticket promedio', value: fmt(dashboardMetrics.avgTicket), path: '/reportes/ventas' },
            { label: 'Crecimiento mensual', value: fmtPct(growthMoM), path: '/reportes/ventas' },
            { label: 'Margen bruto', value: fmtPct(dashboardMetrics.grossMargin), path: '/reportes/rentabilidad' },
          ].map((kpi, i) => (
            <div key={i} className="bg-muted/40 rounded-lg p-3 text-center cursor-pointer hover:bg-primary/10 hover:scale-[1.03] transition-all"
              onClick={() => navigate(kpi.path)}>
              <div className="text-[10px] text-muted-foreground mb-1">{kpi.label}</div>
              <div className="text-sm font-bold">{kpi.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ SECCIÓN 10: ACCESOS RÁPIDOS ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Reporte ventas', path: '/reportes/ventas', icon: DollarSign, color: 'bg-primary/10 text-primary' },
          { label: 'Ventas por SKU', path: '/reportes/ventas-sku', icon: BarChart3, color: 'bg-chart-2/10 text-chart-2' },
          { label: 'Inventario muerto', path: '/reportes/inventario-muerto', icon: Skull, color: 'bg-destructive/10 text-destructive' },
          { label: 'Por agotarse', path: '/reportes/bajo-stock', icon: AlertTriangle, color: 'bg-warning/10 text-warning' },
          { label: 'Sobreinventario', path: '/reportes/sobreinventario', icon: PackageX, color: 'bg-warning/10 text-warning' },
          { label: 'Plan importaciones', path: '/reportes/plan-importaciones', icon: CalendarClock, color: 'bg-primary/10 text-primary' },
          { label: 'Rentabilidad', path: '/reportes/rentabilidad', icon: Star, color: 'bg-success/10 text-success' },
          { label: 'Simulador financiero', path: '/reportes/simulador-financiero', icon: Calculator, color: 'bg-info/10 text-info' },
        ].map(item => (
          <Link
            key={item.path}
            to={item.path}
            className="flex items-center gap-3 p-4 bg-card rounded-xl border hover:shadow-md transition-all group"
          >
            <div className={`p-2 rounded-lg ${item.color}`}>
              <item.icon size={18} />
            </div>
            <span className="text-sm font-medium group-hover:text-primary transition-colors">{item.label}</span>
            <ArrowRight size={14} className="ml-auto text-muted-foreground group-hover:text-primary transition-colors" />
          </Link>
        ))}
      </div>

      {/* ═══ SECCIONES COMERCIALES ═══ */}
      <CommercialSections />
    </div>
  );
}
