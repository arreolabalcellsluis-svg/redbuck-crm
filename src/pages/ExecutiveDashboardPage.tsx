import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAppContext } from '@/contexts/AppContext';
import { useProducts } from '@/hooks/useProducts';
import { useOrders } from '@/hooks/useOrders';
import { useCustomers } from '@/hooks/useCustomers';
import { useAccountsReceivable } from '@/hooks/useAccountsReceivable';
import { useAccountsPayable } from '@/hooks/useAccountsPayable';
import { useImportOrders } from '@/hooks/useImportOrders';
import { useQuotations } from '@/hooks/useQuotations';
import { useTeamMembers } from '@/hooks/useTeamMembers';
import { useExpenses } from '@/hooks/useExpenses';
import { IMPORT_STATUS_LABELS } from '@/types';
import MetricCard from '@/components/shared/MetricCard';
import StatusBadge from '@/components/shared/StatusBadge';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  DollarSign, TrendingUp, Package, Warehouse, Activity, ShieldAlert,
  BarChart3, Target, Users, FileText, ShoppingCart, CreditCard, Globe,
  Zap, Star, ArrowRight, AlertTriangle, Clock, Skull, Crown, Percent,
  Banknote, ArrowUpRight, ArrowDownRight, Layers, PackageX, CalendarClock, Calculator, RefreshCw, CalendarIcon,
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
const MONTH_NAMES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

export default function ExecutiveDashboardPage() {
  const { currentRole } = useAppContext();
  const navigate = useNavigate();

  const { data: dbProducts = [] } = useProducts();
  const { data: dbOrders = [] } = useOrders();
  const { data: dbCustomers = [] } = useCustomers();
  const { data: dbReceivables = [] } = useAccountsReceivable();
  const { data: dbPayables = [] } = useAccountsPayable();
  const { data: dbImports = [] } = useImportOrders();
  const { data: dbQuotations = [] } = useQuotations();
  const { data: dbTeam = [] } = useTeamMembers();
  const { data: dbExpenses = [] } = useExpenses();

  const [salesMonths, setSalesMonths] = useState(6);
  const [analysisDate, setAnalysisDate] = useState<Date>(new Date());

  // ─── Compute monthly sales from real orders ───────────────────
  const monthlySales = useMemo(() => {
    const groups: Record<string, number> = {};
    dbOrders.filter(o => o.status !== 'cancelado').forEach(o => {
      const d = new Date(o.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      groups[key] = (groups[key] || 0) + o.total;
    });
    return Object.entries(groups)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, sales]) => {
        const [y, m] = key.split('-');
        return { month: `${MONTH_NAMES[parseInt(m) - 1]} ${y.slice(2)}`, sales };
      });
  }, [dbOrders]);

  // ─── Current month sales ──────────────────────────────────────
  const now = new Date();
  const currentMonthOrders = useMemo(() =>
    dbOrders.filter(o => {
      if (o.status === 'cancelado') return false;
      const d = new Date(o.created_at);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }), [dbOrders]);

  const salesMonth = useMemo(() => currentMonthOrders.reduce((s, o) => s + o.total, 0), [currentMonthOrders]);

  // ─── Gross margin from catalog ────────────────────────────────
  const grossMarginPct = useMemo(() => {
    const active = dbProducts.filter(p => p.active && p.list_price > 0);
    if (active.length === 0) return 0;
    return active.reduce((s, p) => s + (p.list_price - p.cost) / p.list_price * 100, 0) / active.length;
  }, [dbProducts]);

  // ─── Sales by vendor from orders ──────────────────────────────
  const salesByVendor = useMemo(() => {
    const map: Record<string, number> = {};
    currentMonthOrders.forEach(o => {
      const name = o.vendor_name || 'Sin vendedor';
      map[name] = (map[name] || 0) + o.total;
    });
    return Object.entries(map).map(([name, sales]) => ({ name, sales })).sort((a, b) => b.sales - a.sales);
  }, [currentMonthOrders]);

  // ─── Sales by category from orders ────────────────────────────
  const salesByCategory = useMemo(() => {
    const cats: Record<string, number> = {};
    currentMonthOrders.forEach(o => {
      const items = o.items as any[];
      items?.forEach((item: any) => {
        const product = dbProducts.find(p => p.name === item.productName);
        const cat = product?.category ?? 'otros';
        const label = cat.charAt(0).toUpperCase() + cat.slice(1);
        cats[label] = (cats[label] || 0) + (item.qty || 1) * (item.unitPrice || 0);
      });
    });
    return Object.entries(cats).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [currentMonthOrders, dbProducts]);

  // ─── Inventory valuation ──────────────────────────────────────
  const inventoryData = useMemo(() => {
    let totalValue = 0;
    let totalUnits = 0;
    const byCat: Record<string, number> = {};
    dbProducts.filter(p => p.active).forEach(p => {
      const stock = p.stock as Record<string, number>;
      const units = Object.values(stock).reduce((a: number, b) => a + Number(b), 0);
      const value = units * p.cost;
      totalValue += value;
      totalUnits += units;
      const cat = (p.category ?? 'otros').charAt(0).toUpperCase() + (p.category ?? 'otros').slice(1);
      byCat[cat] = (byCat[cat] || 0) + value;
    });
    const invByCategory = Object.entries(byCat).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    return { totalValue, totalUnits, invByCategory };
  }, [dbProducts]);

  // ─── Receivables / Payables ───────────────────────────────────
  const totalReceivable = useMemo(() => dbReceivables.reduce((s, r) => s + r.balance, 0), [dbReceivables]);
  const totalPayable = useMemo(() => dbPayables.filter(p => p.status !== 'liquidada' && p.status !== 'cancelada').reduce((s, p) => s + p.balance, 0), [dbPayables]);
  const overdueReceivables = useMemo(() => dbReceivables.filter(r => r.days_overdue > 0), [dbReceivables]);

  // ─── Leads by source ──────────────────────────────────────────
  const leadsBySource = useMemo(() => {
    const sources: Record<string, number> = {};
    dbCustomers.forEach(c => {
      const label = (c.source || 'otro').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      sources[label] = (sources[label] || 0) + 1;
    });
    return Object.entries(sources).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [dbCustomers]);

  // ─── Derived metrics ──────────────────────────────────────────
  const salesGoal = 1_500_000;
  const salesPct = salesGoal > 0 ? Math.round((salesMonth / salesGoal) * 100) : 0;
  const prevMonthSales = monthlySales.length >= 2 ? monthlySales[monthlySales.length - 2]?.sales ?? 0 : 0;
  const growthMoM = prevMonthSales > 0 ? ((salesMonth - prevMonthSales) / prevMonthSales) * 100 : 0;

  const grossProfit = salesMonth * (grossMarginPct / 100);
  const monthlyExpenses = useMemo(() => {
    const thisMonth = dbExpenses.filter(e => {
      const d = new Date(e.fecha);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    return thisMonth.reduce((s, e) => s + e.monto, 0);
  }, [dbExpenses]);
  const netProfit = grossProfit - monthlyExpenses;
  const netMargin = salesMonth > 0 ? (netProfit / salesMonth) * 100 : 0;

  const cashInBank = 0; // Will be configured in CFO dashboard
  const netCashFlow = cashInBank - totalPayable + totalReceivable * 0.3;

  // ─── Avg ticket ───────────────────────────────────────────────
  const avgTicket = currentMonthOrders.length > 0 ? salesMonth / currentMonthOrders.length : 0;

  // ─── Low stock products ───────────────────────────────────────
  const lowStockProducts = useMemo(() => {
    return dbProducts.filter(p => {
      if (!p.active) return false;
      const stock = p.stock as Record<string, number>;
      const total = Object.values(stock).reduce((a: number, b) => a + Number(b), 0);
      return total <= 2;
    }).slice(0, 5);
  }, [dbProducts]);

  // ─── Monthly growth chart ─────────────────────────────────────
  const filteredMonthlySales = monthlySales.slice(-salesMonths);
  const monthlyGrowth = filteredMonthlySales.map((m, i) => ({
    ...m,
    growth: i > 0 && filteredMonthlySales[i - 1].sales > 0
      ? Math.round(((m.sales - filteredMonthlySales[i - 1].sales) / filteredMonthlySales[i - 1].sales) * 100)
      : 0,
  }));

  // ─── Inventory rotation ───────────────────────────────────────
  const annualSalesValue = monthlySales.reduce((s, m) => s + m.sales, 0);
  const annualCOGS = annualSalesValue * (1 - grossMarginPct / 100);
  const inventoryRotation = inventoryData.totalValue > 0 ? annualCOGS / inventoryData.totalValue : 0;
  const daysOfInventory = inventoryRotation > 0 ? Math.round(365 / inventoryRotation) : 0;

  // ─── Quotations metrics ───────────────────────────────────────
  const openQuotations = useMemo(() => dbQuotations.filter(q =>
    ['enviada', 'seguimiento', 'borrador', 'vista'].includes(q.status)
  ), [dbQuotations]);
  const acceptedQuotations = useMemo(() => dbQuotations.filter(q => q.status === 'aceptada'), [dbQuotations]);

  // ─── Alerts ───────────────────────────────────────────────────
  const alerts = useMemo(() => {
    const list: { type: 'danger' | 'warning' | 'info'; message: string }[] = [];
    lowStockProducts.forEach(p => {
      const stock = p.stock as Record<string, number>;
      const total = Object.values(stock).reduce((a: number, b) => a + Number(b), 0);
      list.push({ type: 'danger', message: `${p.name} — stock bajo (${total} uds)` });
    });
    overdueReceivables.forEach(r =>
      list.push({ type: 'warning', message: `${r.customer_name} — pago vencido ${r.days_overdue}d (${fmt(r.balance)})` })
    );
    dbImports.filter(i => i.status === 'produccion').forEach(i =>
      list.push({ type: 'info', message: `${i.orderNumber} — ${IMPORT_STATUS_LABELS[i.status as keyof typeof IMPORT_STATUS_LABELS] || i.status}` })
    );
    return list.slice(0, 10);
  }, [lowStockProducts, overdueReceivables, dbImports]);

  // ─── Vendor performance ───────────────────────────────────────
  const vendorData = useMemo(() => {
    return salesByVendor.map(v => ({
      ...v,
      deals: currentMonthOrders.filter(o => o.vendor_name === v.name).length,
      avgTicket: currentMonthOrders.filter(o => o.vendor_name === v.name).length > 0
        ? v.sales / currentMonthOrders.filter(o => o.vendor_name === v.name).length
        : 0,
    }));
  }, [salesByVendor, currentMonthOrders]);

  // clickable card helper
  const clickCard = (path: string) => ({
    className: 'bg-card rounded-xl border p-4 cursor-pointer hover:shadow-lg hover:border-primary/30 hover:scale-[1.02] transition-all duration-200 group',
    onClick: () => navigate(path),
  });

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="page-title flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                <Crown size={20} className="text-primary-foreground" />
              </div>
              Dashboard Ejecutivo REDBUCK
            </h1>
            <p className="page-subtitle">
              Visión 360° del negocio — {format(analysisDate, "d 'de' MMMM yyyy", { locale: es })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("justify-start text-left text-sm h-9 gap-2")}>
                  <CalendarIcon className="h-4 w-4 text-primary" />
                  {format(analysisDate, "dd/MM/yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={analysisDate}
                  onSelect={d => d && setAnalysisDate(d)}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => setAnalysisDate(new Date())}>
              Hoy
            </Button>
          </div>
        </div>
      </div>

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
          {monthlySales.length >= 2 && (
            <div className={`text-xs font-semibold mt-1 flex items-center gap-1 ${growthMoM >= 0 ? 'text-success' : 'text-destructive'}`}>
              {growthMoM >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
              {fmtPct(Math.abs(growthMoM))} vs mes anterior
            </div>
          )}
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
        </div>

        {/* 3. Inventario */}
        <div {...clickCard('/reportes/inventario')} style={{ borderLeft: '4px solid hsl(var(--warning))' }}>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Warehouse size={14} /> Inventario total
          </div>
          <div className="text-xl font-bold group-hover:text-primary transition-colors">{fmt(inventoryData.totalValue)}</div>
          <div className="space-y-0.5 mt-2">
            {inventoryData.invByCategory.slice(0, 3).map(c => (
              <div key={c.name} className="text-[10px] flex justify-between">
                <span className="text-muted-foreground">{c.name}</span>
                <span className="font-medium">{fmt(c.value)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 4. Flujo de efectivo */}
        <div {...clickCard('/cobranza')} style={{ borderLeft: '4px solid hsl(var(--info))' }}>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Banknote size={14} /> Cuentas
          </div>
          <div className="space-y-0.5 mt-2 text-[11px]">
            <div className="flex justify-between"><span className="text-muted-foreground">x Cobrar:</span> <span className="font-medium text-warning">{fmt(totalReceivable)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">x Pagar:</span> <span className="font-medium text-destructive">{fmt(totalPayable)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Vencidas:</span> <span className="font-medium text-destructive">{overdueReceivables.length}</span></div>
          </div>
        </div>

        {/* 5. Stock bajo */}
        <div {...clickCard('/reportes/bajo-stock')} style={{ borderLeft: '4px solid hsl(var(--destructive))' }}>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <AlertTriangle size={14} /> Stock bajo
          </div>
          <div className="text-xl font-bold text-destructive group-hover:text-primary transition-colors">
            {lowStockProducts.length} <span className="text-xs font-normal text-muted-foreground">SKUs</span>
          </div>
          <div className="space-y-0.5 mt-2">
            {lowStockProducts.slice(0, 3).map(p => (
              <div key={p.id} className="text-[10px] text-muted-foreground truncate">{p.name}</div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ SECCIÓN 2: VENTAS ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ventas últimos meses */}
        <div className="bg-card rounded-xl border p-5 hover:shadow-lg hover:border-primary/30 transition-all group">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-display font-semibold group-hover:text-primary transition-colors cursor-pointer"
              onClick={() => navigate('/reportes/ventas')}>
              Ventas últimos {salesMonths} meses
            </h3>
            {monthlySales.length > 0 && (
              <select
                value={salesMonths}
                onChange={e => { e.stopPropagation(); setSalesMonths(+e.target.value); }}
                onClick={e => e.stopPropagation()}
                className="text-xs border rounded px-2 py-1 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {[3, 6, 9, 12].filter(n => n <= monthlySales.length).map(n => (
                  <option key={n} value={n}>{n} meses</option>
                ))}
              </select>
            )}
          </div>
          {monthlySales.length === 0 ? (
            <p className="text-muted-foreground text-center py-12">Sin datos de ventas aún</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={monthlyGrowth}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Bar dataKey="sales" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Ventas" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Ventas por categoría */}
        <div className="bg-card rounded-xl border p-5 cursor-pointer hover:shadow-lg hover:border-primary/30 transition-all group"
          onClick={() => navigate('/reportes/ventas-sku')}>
          <h3 className="font-display font-semibold mb-4 group-hover:text-primary transition-colors">
            Ventas por categoría
          </h3>
          {salesByCategory.length === 0 ? (
            <p className="text-muted-foreground text-center py-12">Sin datos aún</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={salesByCategory} cx="50%" cy="50%" outerRadius={85} innerRadius={40} dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {salesByCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => fmt(v)} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Ventas por vendedor */}
      <div className="bg-card rounded-xl border overflow-x-auto">
        <div className="p-5 border-b cursor-pointer hover:bg-muted/30 transition-colors group"
          onClick={() => navigate('/reportes/vendedor')}>
          <h3 className="font-display font-semibold flex items-center gap-2 group-hover:text-primary transition-colors">
            <Users size={18} className="text-primary" /> Ventas por vendedor (mes actual)
          </h3>
        </div>
        {vendorData.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">Sin pedidos este mes</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>Vendedor</th><th>Ventas mes</th><th># Pedidos</th><th>Ticket prom.</th></tr>
            </thead>
            <tbody>
              {vendorData.map(v => (
                <tr key={v.name} className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => navigate(`/reportes/vendedor?nombre=${encodeURIComponent(v.name)}`)}>
                  <td className="font-medium">{v.name}</td>
                  <td className="font-bold">{fmt(v.sales)}</td>
                  <td>{v.deals}</td>
                  <td>{fmt(v.avgTicket)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ═══ SECCIÓN 3: INVENTARIO KPIs ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard title="Rotación inventario" value={inventoryRotation > 0 ? `${inventoryRotation.toFixed(1)}x` : '—'} icon={Activity} variant="primary" subtitle="anual" href="/reportes/inventario" />
        <MetricCard title="Días de inventario" value={daysOfInventory > 0 ? daysOfInventory : '—'} icon={Clock} variant={daysOfInventory > 90 ? 'warning' : 'success'} subtitle={daysOfInventory <= 90 ? 'Saludable' : daysOfInventory > 0 ? 'Excesivo' : ''} href="/reportes/inventario" />
        <MetricCard title="Cotizaciones abiertas" value={openQuotations.length} icon={FileText} variant="primary" subtitle={`${fmt(openQuotations.reduce((s, q) => s + q.total, 0))} en juego`} href="/cotizaciones" />
        <MetricCard title="Ticket promedio" value={avgTicket > 0 ? fmt(avgTicket) : '—'} icon={Target} variant="primary" href="/reportes/ventas" />
      </div>

      {/* ═══ SECCIÓN 4: IMPORTACIONES ═══ */}
      {dbImports.length > 0 && (
        <div className="bg-card rounded-xl border p-5 cursor-pointer hover:shadow-lg transition-all" onClick={() => navigate('/importaciones')}>
          <h3 className="font-display font-semibold mb-4 flex items-center gap-2">
            <Globe size={18} className="text-primary" /> Importaciones activas
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {dbImports.slice(0, 6).map(imp => (
              <div key={imp.id} className="p-4 rounded-xl bg-muted/50 border">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-sm">{imp.orderNumber}</span>
                  <StatusBadge status={imp.status} type="import" />
                </div>
                <p className="text-xs text-muted-foreground mb-2">{imp.supplier}</p>
                <div className="space-y-1 text-xs">
                  {(imp.items as any[])?.slice(0, 3).map((item: any, i: number) => (
                    <div key={i} className="flex justify-between">
                      <span className="text-muted-foreground truncate mr-2">{item.productName}</span>
                      <span className="font-medium">{item.qty} uds</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between mt-3 pt-2 border-t text-xs">
                  <span className="text-muted-foreground">ETA: {imp.estimatedArrival || '—'}</span>
                  <span className="font-semibold">{imp.daysInTransit}d tránsito</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ SECCIÓN 5: CRM Y MARKETING ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-xl border p-5 cursor-pointer hover:shadow-lg transition-all" onClick={() => navigate('/crm')}>
          <h3 className="font-display font-semibold mb-4">Clientes y conversión</h3>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold text-primary">{dbCustomers.length}</div>
              <div className="text-[10px] text-muted-foreground">Clientes</div>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold text-success">{acceptedQuotations.length}</div>
              <div className="text-[10px] text-muted-foreground">Cot. aceptadas</div>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold">{dbOrders.filter(o => o.status !== 'cancelado').length}</div>
              <div className="text-[10px] text-muted-foreground">Pedidos totales</div>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-xl border p-5">
          <h3 className="font-display font-semibold mb-4">Clientes por canal</h3>
          {leadsBySource.length === 0 ? (
            <p className="text-muted-foreground text-center py-12">Sin datos aún</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={leadsBySource} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={90} />
                <Tooltip />
                <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name="Clientes" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ═══ SECCIÓN 6: ALERTAS ═══ */}
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
            <p className="text-muted-foreground text-center py-4">Sin alertas activas — alimenta datos para ver señales</p>
          )}
        </div>
      </div>

      {/* ═══ SECCIÓN 7: INDICADORES ESTRATÉGICOS ═══ */}
      <div className="bg-card rounded-xl border p-5">
        <h3 className="font-display font-semibold mb-4 flex items-center gap-2">
          <BarChart3 size={18} className="text-primary" /> Indicadores estratégicos
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {[
            { label: 'Ventas mensuales', value: fmt(salesMonth), path: '/reportes/ventas' },
            { label: 'Utilidad neta', value: fmt(netProfit), path: '/reportes/rentabilidad' },
            { label: 'Margen neto', value: salesMonth > 0 ? fmtPct(netMargin) : '—', path: '/reportes/rentabilidad' },
            { label: 'Margen bruto', value: grossMarginPct > 0 ? fmtPct(grossMarginPct) : '—', path: '/reportes/rentabilidad' },
            { label: 'Inventario total', value: fmt(inventoryData.totalValue), path: '/reportes/inventario' },
            { label: 'Rotación inv.', value: inventoryRotation > 0 ? `${inventoryRotation.toFixed(1)}x` : '—', path: '/reportes/inventario' },
            { label: 'Ctas. x cobrar', value: fmt(totalReceivable), path: '/cobranza' },
            { label: 'Ctas. x pagar', value: fmt(totalPayable), path: '/cuentas-por-pagar' },
            { label: 'Ticket promedio', value: avgTicket > 0 ? fmt(avgTicket) : '—', path: '/reportes/ventas' },
            { label: 'Crecimiento mensual', value: monthlySales.length >= 2 ? fmtPct(growthMoM) : '—', path: '/reportes/ventas' },
            { label: 'Cotizaciones abiertas', value: String(openQuotations.length), path: '/cotizaciones' },
            { label: 'Gastos del mes', value: fmt(monthlyExpenses), path: '/gastos-operativos' },
          ].map((kpi, i) => (
            <div key={i} className="bg-muted/40 rounded-lg p-3 text-center cursor-pointer hover:bg-primary/10 hover:scale-[1.03] transition-all"
              onClick={() => navigate(kpi.path)}>
              <div className="text-[10px] text-muted-foreground mb-1">{kpi.label}</div>
              <div className="text-sm font-bold">{kpi.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ SECCIÓN 8: ACCESOS RÁPIDOS ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Reporte ventas', path: '/reportes/ventas', icon: DollarSign, color: 'bg-primary/10 text-primary' },
          { label: 'Inventario', path: '/reportes/inventario', icon: Package, color: 'bg-warning/10 text-warning' },
          { label: 'Cobranza', path: '/cobranza', icon: CreditCard, color: 'bg-info/10 text-info' },
          { label: 'Rentabilidad', path: '/reportes/rentabilidad', icon: Star, color: 'bg-success/10 text-success' },
          { label: 'Importaciones', path: '/importaciones', icon: Globe, color: 'bg-primary/10 text-primary' },
          { label: 'Cotizaciones', path: '/cotizaciones', icon: FileText, color: 'bg-warning/10 text-warning' },
          { label: 'CRM / Clientes', path: '/crm', icon: Users, color: 'bg-info/10 text-info' },
          { label: 'Dashboard CFO', path: '/cfo', icon: Calculator, color: 'bg-success/10 text-success' },
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
    </div>
  );
}
