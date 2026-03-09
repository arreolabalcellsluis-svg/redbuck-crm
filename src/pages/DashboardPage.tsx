import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '@/contexts/AppContext';
import StatusBadge from '@/components/shared/StatusBadge';
import TodayActivitiesWidget from '@/components/dashboard/TodayActivitiesWidget';
import DailyAssistantWidget from '@/components/dashboard/DailyAssistantWidget';
import { useProducts } from '@/hooks/useProducts';
import { useOrders } from '@/hooks/useOrders';
import { useQuotations } from '@/hooks/useQuotations';
import { useCustomers } from '@/hooks/useCustomers';
import { useImportOrders } from '@/hooks/useImportOrders';
import { useAccountsReceivable } from '@/hooks/useAccountsReceivable';
import { IMPORT_STATUS_LABELS } from '@/types';
import {
  DollarSign, TrendingUp, Users, FileText, Target, ShoppingCart,
  CreditCard, Warehouse, Globe, BarChart3
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const fmt = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);
const COLORS = ['hsl(0,78%,45%)', 'hsl(210,100%,52%)', 'hsl(142,71%,45%)', 'hsl(38,92%,50%)', 'hsl(280,65%,55%)', 'hsl(0,0%,60%)'];
const MONTH_NAMES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

export default function DashboardPage() {
  const navigate = useNavigate();
  const { currentRole } = useAppContext();
  const isVendedor = currentRole === 'vendedor';

  const { data: products = [] } = useProducts();
  const { data: orders = [] } = useOrders();
  const { data: dbQuotations = [] } = useQuotations();
  const { data: customers = [] } = useCustomers();
  const { data: imports = [] } = useImportOrders();
  const { data: receivables = [] } = useAccountsReceivable();

  const activeOrders = useMemo(() => orders.filter(o => o.status !== 'cancelado'), [orders]);

  const metrics = useMemo(() => {
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);

    const salesMonth = activeOrders
      .filter(o => o.created_at.slice(0, 7) === thisMonth)
      .reduce((s, o) => s + o.total, 0);

    const salesQuarter = activeOrders
      .filter(o => new Date(o.created_at) >= threeMonthsAgo)
      .reduce((s, o) => s + o.total, 0);

    const activeProducts = products.filter(p => p.active);
    const totalInventoryValue = activeProducts.reduce((s, p) => {
      const totalStock = Object.values(p.stock).reduce((a: number, b) => a + Number(b), 0);
      return s + totalStock * p.cost;
    }, 0);

    const margins = activeProducts.filter(p => p.list_price > 0);
    const grossMargin = margins.length > 0
      ? margins.reduce((s, p) => s + (p.list_price - p.cost) / p.list_price * 100, 0) / margins.length
      : 0;

    const avgTicket = activeOrders.length > 0
      ? activeOrders.reduce((s, o) => s + o.total, 0) / activeOrders.length
      : 0;

    const productsInTransit = activeProducts.reduce((s, p) => s + p.in_transit, 0);

    return { salesMonth, salesQuarter, totalInventoryValue, grossMargin, avgTicket, productsInTransit };
  }, [activeOrders, products]);

  const monthlySales = useMemo(() => {
    const groups: Record<string, number> = {};
    activeOrders.forEach(o => {
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
  }, [activeOrders]);

  const salesByCategory = useMemo(() => {
    const cats: Record<string, number> = {};
    const productMap = new Map(products.map(p => [p.name, p.category]));
    activeOrders.forEach(o => {
      (o.items || []).forEach((item: any) => {
        const cat = productMap.get(item.productName) || 'otros';
        const label = cat.charAt(0).toUpperCase() + cat.slice(1);
        cats[label] = (cats[label] || 0) + (item.qty || 1) * (item.unitPrice || 0);
      });
    });
    return Object.entries(cats).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [activeOrders, products]);

  const salesByVendor = useMemo(() => {
    const vendors: Record<string, number> = {};
    activeOrders.forEach(o => {
      if (o.vendor_name) vendors[o.vendor_name] = (vendors[o.vendor_name] || 0) + o.total;
    });
    return Object.entries(vendors).map(([name, sales]) => ({ name, sales })).sort((a, b) => b.sales - a.sales);
  }, [activeOrders]);

  const quotationsSent = dbQuotations.filter(q => q.status === 'enviada' || q.status === 'seguimiento').length;
  const overdueReceivables = receivables.filter(r => r.days_overdue > 0).reduce((s, r) => s + r.balance, 0);
  const totalQuotations = dbQuotations.length;
  const acceptedQuotations = dbQuotations.filter(q => q.status === 'aceptada').length;
  const closeRate = totalQuotations > 0 ? Math.round(acceptedQuotations / totalQuotations * 100) : 0;

  const salesGoal = isVendedor ? 500000 : 1500000;
  const salesPct = salesGoal > 0 ? Math.round((metrics.salesMonth / salesGoal) * 100) : 0;

  const clickCard = (path: string) => ({
    className: 'bg-card rounded-xl border p-4 cursor-pointer hover:shadow-lg hover:border-primary/30 hover:scale-[1.02] transition-all duration-200 group',
    onClick: () => navigate(path),
  });

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">
          {isVendedor ? 'Mi panel comercial' : 'Vista general de REDBUCK EQUIPMENT'}
        </p>
      </div>

      {/* Metrics grid */}
      <div className={`grid grid-cols-2 ${isVendedor ? 'md:grid-cols-3 lg:grid-cols-4' : 'md:grid-cols-3 lg:grid-cols-5'} gap-4 mb-6`}>
        <div {...clickCard('/reportes/ventas')} style={{ borderLeft: '4px solid hsl(var(--primary))' }}>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <DollarSign size={14} /> Ventas del mes
          </div>
          <div className="text-xl font-bold group-hover:text-primary transition-colors">{fmt(metrics.salesMonth)}</div>
          <div className="flex items-center justify-between mt-2">
            <div className="w-full bg-muted rounded-full h-2">
              <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${Math.min(salesPct, 100)}%` }} />
            </div>
            <span className="text-xs font-bold ml-2 whitespace-nowrap">{salesPct}%</span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">Meta: {fmt(salesGoal)}</div>
        </div>

        <div {...clickCard('/reportes/ventas')} style={{ borderLeft: '4px solid hsl(var(--info))' }}>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <TrendingUp size={14} /> Ventas trimestre
          </div>
          <div className="text-xl font-bold group-hover:text-primary transition-colors">{fmt(metrics.salesQuarter)}</div>
          <div className="space-y-0.5 mt-2 text-[10px]">
            <div className="flex justify-between"><span className="text-muted-foreground">Promedio/mes:</span> <span className="font-medium">{fmt(Math.round(metrics.salesQuarter / 3))}</span></div>
          </div>
        </div>

        <div {...clickCard('/cotizaciones')} style={{ borderLeft: '4px solid hsl(var(--primary))' }}>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <FileText size={14} /> Cotizaciones activas
          </div>
          <div className="text-xl font-bold group-hover:text-primary transition-colors">{quotationsSent}</div>
          <div className="space-y-0.5 mt-2 text-[10px]">
            <div className="flex justify-between"><span className="text-muted-foreground">Total cotizaciones:</span> <span className="font-medium">{totalQuotations}</span></div>
          </div>
        </div>

        {!isVendedor && (
          <div {...clickCard('/reportes/ventas')} style={{ borderLeft: '4px solid hsl(var(--success))' }}>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Target size={14} /> Tasa de cierre
            </div>
            <div className="text-xl font-bold text-success group-hover:text-primary transition-colors">{closeRate}%</div>
            <div className="flex items-center justify-between mt-2">
              <div className="w-full bg-muted rounded-full h-2">
                <div className="h-2 rounded-full bg-success transition-all" style={{ width: `${closeRate}%` }} />
              </div>
            </div>
          </div>
        )}

        {!isVendedor && (
          <div {...clickCard('/reportes/ventas')} style={{ borderLeft: '4px solid hsl(var(--primary))' }}>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <ShoppingCart size={14} /> Ticket promedio
            </div>
            <div className="text-xl font-bold group-hover:text-primary transition-colors">{fmt(metrics.avgTicket)}</div>
          </div>
        )}

        {!isVendedor && (
          <div {...clickCard('/reportes/rentabilidad')} style={{ borderLeft: '4px solid hsl(var(--success))' }}>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <BarChart3 size={14} /> Margen bruto
            </div>
            <div className="text-xl font-bold text-success group-hover:text-primary transition-colors">{metrics.grossMargin.toFixed(1)}%</div>
            <div className="flex items-center justify-between mt-2">
              <div className="w-full bg-muted rounded-full h-2">
                <div className="h-2 rounded-full bg-success transition-all" style={{ width: `${metrics.grossMargin}%` }} />
              </div>
            </div>
          </div>
        )}

        <div {...clickCard('/cobranza')} style={{ borderLeft: '4px solid hsl(var(--destructive))' }}>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <CreditCard size={14} /> Cartera vencida
          </div>
          <div className="text-xl font-bold text-destructive group-hover:text-primary transition-colors">{fmt(overdueReceivables)}</div>
          <div className="space-y-0.5 mt-2 text-[10px]">
            <div className="flex justify-between"><span className="text-muted-foreground">Facturas vencidas:</span> <span className="font-bold text-destructive">{receivables.filter(r => r.days_overdue > 0).length}</span></div>
          </div>
        </div>

        {!isVendedor && (
          <div {...clickCard('/reportes/inventario')} style={{ borderLeft: '4px solid hsl(var(--warning))' }}>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Warehouse size={14} /> Inventario total
            </div>
            <div className="text-xl font-bold group-hover:text-primary transition-colors">{fmt(metrics.totalInventoryValue)}</div>
          </div>
        )}

        {!isVendedor && (
          <div {...clickCard('/importaciones')} style={{ borderLeft: '4px solid hsl(var(--warning))' }}>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Globe size={14} /> Importaciones
            </div>
            <div className="text-xl font-bold group-hover:text-primary transition-colors">{imports.length}</div>
            <div className="space-y-0.5 mt-2 text-[10px]">
              <div className="flex justify-between"><span className="text-muted-foreground">En tránsito:</span> <span className="font-semibold">{metrics.productsInTransit}</span></div>
            </div>
          </div>
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-card rounded-xl border p-5 cursor-pointer hover:shadow-lg hover:border-primary/30 transition-all group"
          onClick={() => navigate('/reportes/ventas')}>
          <h3 className="font-display font-semibold mb-4 group-hover:text-primary transition-colors">
            Ventas mensuales
          </h3>
          {monthlySales.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={monthlySales}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Bar dataKey="sales" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[260px] text-muted-foreground text-sm">
              Sin datos de ventas aún. Crea pedidos para ver la gráfica.
            </div>
          )}
        </div>

        <div className="bg-card rounded-xl border p-5 cursor-pointer hover:shadow-lg hover:border-primary/30 transition-all group"
          onClick={() => navigate('/reportes/ventas-sku')}>
          <h3 className="font-display font-semibold mb-4 group-hover:text-primary transition-colors">
            Ventas por categoría
          </h3>
          {salesByCategory.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={salesByCategory} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {salesByCategory.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => fmt(v)} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[260px] text-muted-foreground text-sm">
              Sin datos de ventas por categoría aún.
            </div>
          )}
        </div>
      </div>

      {/* Bottom widgets */}
      <div className={`grid grid-cols-1 ${isVendedor ? 'lg:grid-cols-2' : 'lg:grid-cols-4'} gap-6`}>
        <TodayActivitiesWidget />
        <DailyAssistantWidget />

        {!isVendedor && (
          <div className="bg-card rounded-xl border p-5">
            <h3 className="font-display font-semibold mb-4">Ventas por vendedor</h3>
            {salesByVendor.length > 0 ? (
              <div className="space-y-3">
                {salesByVendor.map((v, i) => (
                  <div key={v.name} className="flex items-center gap-3 cursor-pointer hover:bg-muted/50 rounded-lg p-1.5 -mx-1.5 transition-colors group"
                    onClick={() => navigate(`/reportes/vendedor?nombre=${encodeURIComponent(v.name)}`)}>
                    <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium group-hover:text-primary transition-colors">{v.name}</div>
                      <div className="w-full bg-muted rounded-full h-1.5 mt-1">
                        <div className="h-1.5 rounded-full bg-primary" style={{ width: `${salesByVendor[0]?.sales ? (v.sales / salesByVendor[0].sales) * 100 : 0}%` }} />
                      </div>
                    </div>
                    <span className="text-sm font-semibold">{fmt(v.sales)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground text-center py-6">Sin ventas registradas</div>
            )}
          </div>
        )}

        {!isVendedor && (
          <div className="bg-card rounded-xl border p-5 cursor-pointer hover:shadow-lg transition-all" onClick={() => navigate('/importaciones')}>
            <h3 className="font-display font-semibold mb-4">Importaciones activas</h3>
            {imports.length > 0 ? (
              <div className="space-y-3">
                {imports.map((imp) => (
                  <div key={imp.id} className="p-3 rounded-lg bg-muted/50 border">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold">{imp.orderNumber}</span>
                      <StatusBadge status={imp.status} type="import" />
                    </div>
                    <p className="text-xs text-muted-foreground">{imp.supplier}</p>
                    <div className="flex items-center justify-between mt-2 text-xs">
                      <span className="text-muted-foreground">ETA: {imp.estimatedArrival}</span>
                      <span className="font-medium">{imp.daysInTransit}d tránsito</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground text-center py-6">Sin importaciones activas</div>
            )}
          </div>
        )}

        <div className="bg-card rounded-xl border p-5 cursor-pointer hover:shadow-lg transition-all" onClick={() => navigate('/cobranza')}>
          <h3 className="font-display font-semibold mb-4">Cobranza pendiente</h3>
          {receivables.length > 0 ? (
            <div className="space-y-3">
              {receivables.filter(ar => ar.status !== 'liquidado').slice(0, 5).map((ar) => (
                <div key={ar.id} className="p-3 rounded-lg bg-muted/50 border">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold">{ar.customer_name}</span>
                    <StatusBadge status={ar.status} type="receivable" />
                  </div>
                  <p className="text-xs text-muted-foreground">{ar.order_folio}</p>
                  <div className="flex items-center justify-between mt-2 text-xs">
                    <span className="text-muted-foreground">Saldo: {fmt(ar.balance)}</span>
                    {ar.days_overdue > 0 && <span className="text-destructive font-medium">{ar.days_overdue}d vencido</span>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground text-center py-6">Sin cobranza pendiente</div>
          )}
        </div>
      </div>
    </div>
  );
}
