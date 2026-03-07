import { useNavigate } from 'react-router-dom';
import MetricCard from '@/components/shared/MetricCard';
import StatusBadge from '@/components/shared/StatusBadge';
import TodayActivitiesWidget from '@/components/dashboard/TodayActivitiesWidget';
import { dashboardMetrics, salesByVendor, salesByCategory, monthlySales, demoImports, demoOpportunities, demoAccountsReceivable } from '@/data/demo-data';
import { IMPORT_STATUS_LABELS } from '@/types';
import {
  DollarSign, TrendingUp, Users, FileText, Target, ShoppingCart,
  CreditCard, Warehouse, Globe, Wrench, BarChart3, Package
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const fmt = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);

const COLORS = ['hsl(0,78%,45%)', 'hsl(210,100%,52%)', 'hsl(142,71%,45%)', 'hsl(38,92%,50%)', 'hsl(280,65%,55%)', 'hsl(0,0%,60%)'];

export default function DashboardPage() {
  const navigate = useNavigate();

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Vista general de REDBUCK EQUIPMENT — Marzo 2026</p>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <MetricCard title="Ventas del mes" value={fmt(dashboardMetrics.salesMonth)} icon={DollarSign} variant="primary" trend={{ value: 12, positive: true }} href="/reportes/ventas" />
        <MetricCard title="Ventas trimestre" value={fmt(dashboardMetrics.salesQuarter)} icon={TrendingUp} href="/reportes/ventas" />
        <MetricCard title="Oportunidades" value={dashboardMetrics.activeOpportunities} icon={Users} subtitle="activas" href="/crm" />
        <MetricCard title="Cotizaciones" value={dashboardMetrics.quotationsSent} icon={FileText} subtitle="enviadas" href="/cotizaciones" />
        <MetricCard title="Tasa de cierre" value={`${dashboardMetrics.closeRate}%`} icon={Target} variant="success" href="/reportes/ventas" />
        <MetricCard title="Ticket promedio" value={fmt(dashboardMetrics.avgTicket)} icon={ShoppingCart} href="/reportes/ventas" />
        <MetricCard title="Margen bruto" value={`${dashboardMetrics.grossMargin}%`} icon={BarChart3} variant="success" href="/reportes/rentabilidad" />
        <MetricCard title="Cartera vencida" value={fmt(dashboardMetrics.overdueReceivables)} icon={CreditCard} variant="danger" href="/cobranza" />
        <MetricCard title="Inventario total" value={fmt(dashboardMetrics.totalInventoryValue)} icon={Warehouse} href="/reportes/inventario" />
        <MetricCard title="Importaciones" value={dashboardMetrics.activeImports} icon={Globe} subtitle={`${dashboardMetrics.productsInTransit} en tránsito`} variant="warning" href="/importaciones" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-card rounded-xl border p-5 cursor-pointer hover:shadow-lg hover:border-primary/30 transition-all group"
          onClick={() => navigate('/reportes/ventas')}>
          <h3 className="font-display font-semibold mb-4 group-hover:text-primary transition-colors">
            Ventas mensuales
            <span className="text-[10px] text-muted-foreground ml-2 opacity-0 group-hover:opacity-100 transition-opacity">Ver detalle →</span>
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={monthlySales}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => fmt(v)} />
              <Bar dataKey="sales" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card rounded-xl border p-5 cursor-pointer hover:shadow-lg hover:border-primary/30 transition-all group"
          onClick={() => navigate('/reportes/ventas-sku')}>
          <h3 className="font-display font-semibold mb-4 group-hover:text-primary transition-colors">
            Ventas por categoría
            <span className="text-[10px] text-muted-foreground ml-2 opacity-0 group-hover:opacity-100 transition-opacity">Ver detalle →</span>
          </h3>
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
        </div>
      </div>

      {/* Vendor ranking + imports + receivables */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Vendor ranking */}
        <div className="bg-card rounded-xl border p-5">
          <h3 className="font-display font-semibold mb-4">Ventas por vendedor</h3>
          <div className="space-y-3">
            {salesByVendor.map((v, i) => (
              <div key={v.name} className="flex items-center gap-3 cursor-pointer hover:bg-muted/50 rounded-lg p-1.5 -mx-1.5 transition-colors group"
                onClick={() => navigate(`/reportes/vendedor?nombre=${encodeURIComponent(v.name)}`)}>
                <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium group-hover:text-primary transition-colors">{v.name}</div>
                  <div className="w-full bg-muted rounded-full h-1.5 mt-1">
                    <div className="h-1.5 rounded-full bg-primary" style={{ width: `${(v.sales / salesByVendor[0].sales) * 100}%` }} />
                  </div>
                </div>
                <span className="text-sm font-semibold">{fmt(v.sales)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Active imports */}
        <div className="bg-card rounded-xl border p-5 cursor-pointer hover:shadow-lg transition-all" onClick={() => navigate('/importaciones')}>
          <h3 className="font-display font-semibold mb-4">Importaciones activas</h3>
          <div className="space-y-3">
            {demoImports.map((imp) => (
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
        </div>

        {/* Receivables */}
        <div className="bg-card rounded-xl border p-5 cursor-pointer hover:shadow-lg transition-all" onClick={() => navigate('/cobranza')}>
          <h3 className="font-display font-semibold mb-4">Cobranza pendiente</h3>
          <div className="space-y-3">
            {demoAccountsReceivable.filter(ar => ar.status !== 'liquidado').map((ar) => (
              <div key={ar.id} className="p-3 rounded-lg bg-muted/50 border">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold">{ar.customerName}</span>
                  <StatusBadge status={ar.status} type="receivable" />
                </div>
                <p className="text-xs text-muted-foreground">{ar.orderFolio}</p>
                <div className="flex items-center justify-between mt-2 text-xs">
                  <span className="text-muted-foreground">Saldo: {fmt(ar.balance)}</span>
                  {ar.daysOverdue > 0 && <span className="text-destructive font-medium">{ar.daysOverdue}d vencido</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
