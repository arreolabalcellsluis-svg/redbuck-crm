import { useNavigate } from 'react-router-dom';
import { useAppContext } from '@/contexts/AppContext';
import MetricCard from '@/components/shared/MetricCard';
import StatusBadge from '@/components/shared/StatusBadge';
import TodayActivitiesWidget from '@/components/dashboard/TodayActivitiesWidget';
import DailyAssistantWidget from '@/components/dashboard/DailyAssistantWidget';
import { dashboardMetrics, salesByVendor, salesByCategory, monthlySales, demoImports, demoOpportunities, demoAccountsReceivable, demoQuotations, demoCustomers } from '@/data/demo-data';
import { IMPORT_STATUS_LABELS } from '@/types';
import { DEMO_VENDEDOR_ID } from '@/lib/rolePermissions';
import {
  DollarSign, TrendingUp, Users, FileText, Target, ShoppingCart,
  CreditCard, Warehouse, Globe, Wrench, BarChart3, Package
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const fmt = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);

const COLORS = ['hsl(0,78%,45%)', 'hsl(210,100%,52%)', 'hsl(142,71%,45%)', 'hsl(38,92%,50%)', 'hsl(280,65%,55%)', 'hsl(0,0%,60%)'];

export default function DashboardPage() {
  const navigate = useNavigate();
  const { currentRole, quotations, receivables } = useAppContext();
  const isVendedor = currentRole === 'vendedor';
  const vendorId = DEMO_VENDEDOR_ID;

  // Filter data for vendedor
  const myCustomers = isVendedor ? demoCustomers.filter(c => c.vendorId === vendorId) : demoCustomers;
  const myOpportunities = isVendedor ? demoOpportunities.filter(o => o.vendorId === vendorId) : demoOpportunities;
  const myQuotations = isVendedor ? quotations.filter(q => q.vendorId === vendorId) : quotations;
  const myCustomerIds = new Set(myCustomers.map(c => c.id));
  const myReceivables = isVendedor ? receivables.filter(r => myCustomerIds.has(r.customerId)) : receivables;

  // Personal metrics for vendedor
  const vendorSalesMonth = isVendedor ? 420000 : dashboardMetrics.salesMonth; // demo personal sales
  const vendorSalesQuarter = isVendedor ? 1150000 : dashboardMetrics.salesQuarter;
  const activeOpportunities = myOpportunities.filter(o => !['cierre_ganado', 'cierre_perdido'].includes(o.stage)).length;
  const quotationsSent = myQuotations.filter(q => q.status === 'enviada' || q.status === 'seguimiento').length;
  const overdueReceivables = myReceivables.filter(r => r.status === 'vencido').reduce((s, r) => s + r.balance, 0);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">
          {isVendedor
            ? 'Mi panel comercial — Marzo 2026'
            : 'Vista general de REDBUCK EQUIPMENT — Marzo 2026'}
        </p>
      </div>

      {/* Metrics grid — Executive style */}
      {(() => {
        const salesGoal = isVendedor ? 500000 : 1500000;
        const salesPct = Math.round((vendorSalesMonth / salesGoal) * 100);
        const clickCard = (path: string) => ({
          className: 'bg-card rounded-xl border p-4 cursor-pointer hover:shadow-lg hover:border-primary/30 hover:scale-[1.02] transition-all duration-200 group',
          onClick: () => navigate(path),
        });
        return (
          <div className={`grid grid-cols-2 ${isVendedor ? 'md:grid-cols-3 lg:grid-cols-4' : 'md:grid-cols-3 lg:grid-cols-5'} gap-4 mb-6`}>
            {/* Ventas del mes */}
            <div {...clickCard('/reportes/ventas')} style={{ borderLeft: '4px solid hsl(var(--primary))' }}>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <DollarSign size={14} /> {isVendedor ? 'Mis ventas del mes' : 'Ventas del mes'}
              </div>
              <div className="text-xl font-bold group-hover:text-primary transition-colors">{fmt(vendorSalesMonth)}</div>
              <div className="flex items-center justify-between mt-2">
                <div className="w-full bg-muted rounded-full h-2">
                  <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${Math.min(salesPct, 100)}%` }} />
                </div>
                <span className="text-xs font-bold ml-2 whitespace-nowrap">{salesPct}%</span>
              </div>
              <div className="text-[10px] text-muted-foreground mt-1">Meta: {fmt(salesGoal)}</div>
              <div className="text-xs font-semibold mt-1 flex items-center gap-1 text-success">↑ 12% vs mes anterior</div>
              <div className="text-[10px] text-muted-foreground mt-1 opacity-0 group-hover:opacity-100 transition-opacity">Click para ver detalle →</div>
            </div>

            {/* Ventas trimestre */}
            <div {...clickCard('/reportes/ventas')} style={{ borderLeft: '4px solid hsl(var(--info))' }}>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <TrendingUp size={14} /> {isVendedor ? 'Mis ventas trimestre' : 'Ventas trimestre'}
              </div>
              <div className="text-xl font-bold group-hover:text-primary transition-colors">{fmt(vendorSalesQuarter)}</div>
              <div className="space-y-0.5 mt-2 text-[10px]">
                <div className="flex justify-between"><span className="text-muted-foreground">Promedio/mes:</span> <span className="font-medium">{fmt(Math.round(vendorSalesQuarter / 3))}</span></div>
              </div>
              <div className="text-[10px] text-muted-foreground mt-1 opacity-0 group-hover:opacity-100 transition-opacity">Click para ver detalle →</div>
            </div>

            {/* Oportunidades */}
            <div {...clickCard('/crm')} style={{ borderLeft: '4px solid hsl(var(--warning))' }}>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <Users size={14} /> {isVendedor ? 'Mis oportunidades' : 'Oportunidades'}
              </div>
              <div className="text-xl font-bold group-hover:text-primary transition-colors">{activeOpportunities}</div>
              <div className="space-y-0.5 mt-2 text-[10px]">
                <div className="flex justify-between"><span className="text-muted-foreground">Activas</span> <span className="font-semibold">{activeOpportunities}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Pipeline:</span> <span className="font-medium">{fmt(myOpportunities.filter(o => !['cierre_ganado', 'cierre_perdido'].includes(o.stage)).reduce((s, o) => s + o.estimatedAmount, 0))}</span></div>
              </div>
              <div className="text-[10px] text-muted-foreground mt-1 opacity-0 group-hover:opacity-100 transition-opacity">Click para ver detalle →</div>
            </div>

            {/* Cotizaciones */}
            <div {...clickCard('/cotizaciones')} style={{ borderLeft: '4px solid hsl(var(--primary))' }}>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <FileText size={14} /> {isVendedor ? 'Mis cotizaciones' : 'Cotizaciones'}
              </div>
              <div className="text-xl font-bold group-hover:text-primary transition-colors">{quotationsSent}</div>
              <div className="space-y-0.5 mt-2 text-[10px]">
                <div className="flex justify-between"><span className="text-muted-foreground">Enviadas / seguimiento</span></div>
              </div>
              <div className="text-[10px] text-muted-foreground mt-1 opacity-0 group-hover:opacity-100 transition-opacity">Click para ver detalle →</div>
            </div>

            {/* Tasa de cierre */}
            {!isVendedor && (
              <div {...clickCard('/reportes/ventas')} style={{ borderLeft: '4px solid hsl(var(--success))' }}>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <Target size={14} /> Tasa de cierre
                </div>
                <div className="text-xl font-bold text-success group-hover:text-primary transition-colors">{dashboardMetrics.closeRate}%</div>
                <div className="flex items-center justify-between mt-2">
                  <div className="w-full bg-muted rounded-full h-2">
                    <div className="h-2 rounded-full bg-success transition-all" style={{ width: `${dashboardMetrics.closeRate}%` }} />
                  </div>
                </div>
                <div className="text-[10px] text-muted-foreground mt-1 opacity-0 group-hover:opacity-100 transition-opacity">Click para ver detalle →</div>
              </div>
            )}

            {/* Ticket promedio */}
            {!isVendedor && (
              <div {...clickCard('/reportes/ventas')} style={{ borderLeft: '4px solid hsl(var(--primary))' }}>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <ShoppingCart size={14} /> Ticket promedio
                </div>
                <div className="text-xl font-bold group-hover:text-primary transition-colors">{fmt(dashboardMetrics.avgTicket)}</div>
                <div className="text-[10px] text-muted-foreground mt-1 opacity-0 group-hover:opacity-100 transition-opacity">Click para ver detalle →</div>
              </div>
            )}

            {/* Margen bruto */}
            {!isVendedor && (
              <div {...clickCard('/reportes/rentabilidad')} style={{ borderLeft: '4px solid hsl(var(--success))' }}>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <BarChart3 size={14} /> Margen bruto
                </div>
                <div className="text-xl font-bold text-success group-hover:text-primary transition-colors">{dashboardMetrics.grossMargin}%</div>
                <div className="flex items-center justify-between mt-2">
                  <div className="w-full bg-muted rounded-full h-2">
                    <div className="h-2 rounded-full bg-success transition-all" style={{ width: `${dashboardMetrics.grossMargin}%` }} />
                  </div>
                </div>
                <div className="text-[10px] text-muted-foreground mt-1 opacity-0 group-hover:opacity-100 transition-opacity">Click para ver detalle →</div>
              </div>
            )}

            {/* Cartera vencida */}
            <div {...clickCard('/cobranza')} style={{ borderLeft: '4px solid hsl(var(--destructive))' }}>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <CreditCard size={14} /> {isVendedor ? 'Mi cartera vencida' : 'Cartera vencida'}
              </div>
              <div className="text-xl font-bold text-destructive group-hover:text-primary transition-colors">{fmt(overdueReceivables)}</div>
              <div className="space-y-0.5 mt-2 text-[10px]">
                <div className="flex justify-between"><span className="text-muted-foreground">Facturas vencidas:</span> <span className="font-bold text-destructive">{myReceivables.filter(r => r.status === 'vencido').length}</span></div>
              </div>
              <div className="text-[10px] text-muted-foreground mt-1 opacity-0 group-hover:opacity-100 transition-opacity">Click para ver detalle →</div>
            </div>

            {/* Inventario total */}
            {!isVendedor && (
              <div {...clickCard('/reportes/inventario')} style={{ borderLeft: '4px solid hsl(var(--warning))' }}>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <Warehouse size={14} /> Inventario total
                </div>
                <div className="text-xl font-bold group-hover:text-primary transition-colors">{fmt(dashboardMetrics.totalInventoryValue)}</div>
                <div className="text-[10px] text-muted-foreground mt-1 opacity-0 group-hover:opacity-100 transition-opacity">Click para ver detalle →</div>
              </div>
            )}

            {/* Importaciones */}
            {!isVendedor && (
              <div {...clickCard('/importaciones')} style={{ borderLeft: '4px solid hsl(var(--warning))' }}>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <Globe size={14} /> Importaciones
                </div>
                <div className="text-xl font-bold group-hover:text-primary transition-colors">{dashboardMetrics.activeImports}</div>
                <div className="space-y-0.5 mt-2 text-[10px]">
                  <div className="flex justify-between"><span className="text-muted-foreground">En tránsito:</span> <span className="font-semibold">{dashboardMetrics.productsInTransit}</span></div>
                </div>
                <div className="text-[10px] text-muted-foreground mt-1 opacity-0 group-hover:opacity-100 transition-opacity">Click para ver detalle →</div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-card rounded-xl border p-5 cursor-pointer hover:shadow-lg hover:border-primary/30 transition-all group"
          onClick={() => navigate('/reportes/ventas')}>
          <h3 className="font-display font-semibold mb-4 group-hover:text-primary transition-colors">
            {isVendedor ? 'Mis ventas mensuales' : 'Ventas mensuales'}
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

      {/* Bottom widgets */}
      <div className={`grid grid-cols-1 ${isVendedor ? 'lg:grid-cols-2' : 'lg:grid-cols-4'} gap-6`}>
        {/* Agenda widget */}
        <TodayActivitiesWidget />

        {/* Daily Assistant widget */}
        <DailyAssistantWidget />

        {/* Vendor ranking - hide for vendedor */}
        {!isVendedor && (
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
        )}

        {/* Active imports - hide for vendedor */}
        {!isVendedor && (
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
        )}

        {/* Receivables - filtered for vendedor */}
        <div className="bg-card rounded-xl border p-5 cursor-pointer hover:shadow-lg transition-all" onClick={() => navigate('/cobranza')}>
          <h3 className="font-display font-semibold mb-4">
            {isVendedor ? 'Mi cobranza pendiente' : 'Cobranza pendiente'}
          </h3>
          <div className="space-y-3">
            {myReceivables.filter(ar => ar.status !== 'liquidado').slice(0, 5).map((ar) => (
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
