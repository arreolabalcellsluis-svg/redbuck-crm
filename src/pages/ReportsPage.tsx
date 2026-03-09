import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAppContext } from '@/contexts/AppContext';
import MetricCard from '@/components/shared/MetricCard';
import { BarChart3, TrendingUp, Users, Package, DollarSign, Warehouse, Skull, AlertTriangle, Star, ArrowRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { useOrders } from '@/hooks/useOrders';
import { useQuotations } from '@/hooks/useQuotations';
import { useProducts } from '@/hooks/useProducts';
import { useTeamMembers } from '@/hooks/useTeamMembers';

const fmt = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);

const reportLinks = [
  { label: 'Reporte de Ventas', description: 'Detalle transaccional por fecha, vendedor, cliente y SKU', path: '/reportes/ventas', icon: DollarSign, color: 'bg-primary/10 text-primary' },
  { label: 'Inventario Actual', description: 'Stock por bodega, categoría, SKU y valor total', path: '/reportes/inventario', icon: Warehouse, color: 'bg-warning/10 text-warning' },
  { label: 'Inventario Muerto', description: 'Productos sin rotación con sugerencias de acción', path: '/reportes/inventario-muerto', icon: Skull, color: 'bg-destructive/10 text-destructive' },
  { label: 'Productos por Agotarse', description: 'Bajo stock con punto de reorden y sugerencia de compra', path: '/reportes/bajo-stock', icon: AlertTriangle, color: 'bg-warning/10 text-warning' },
  { label: 'Ventas por SKU', description: 'Ranking por monto, unidades y rentabilidad', path: '/reportes/ventas-sku', icon: BarChart3, color: 'bg-primary/10 text-primary' },
  { label: 'Detalle por Vendedor', description: 'Qué vendió, a quién, cuánto y por canal', path: '/reportes/vendedor', icon: Users, color: 'bg-info/10 text-info' },
  { label: 'Rentabilidad por Producto', description: 'Costo, margen, utilidad anual estimada', path: '/reportes/rentabilidad', icon: Star, color: 'bg-success/10 text-success' },
];

const VENDEDOR_HIDDEN_REPORTS = ['/reportes/inventario', '/reportes/inventario-muerto', '/reportes/rentabilidad'];

export default function ReportsPage() {
  const { currentRole } = useAppContext();
  const isVendedor = currentRole === 'vendedor';

  const { data: orders = [] } = useOrders();
  const { data: quotations = [] } = useQuotations();
  const { data: products = [] } = useProducts();
  const { data: teamMembers = [] } = useTeamMembers();

  const visibleReports = isVendedor
    ? reportLinks.filter(r => !VENDEDOR_HIDDEN_REPORTS.includes(r.path))
    : reportLinks;

  // Build monthly sales trend from real orders
  const monthlySales = useMemo(() => {
    const map: Record<string, number> = {};
    orders.forEach(o => {
      const d = new Date(o.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      map[key] = (map[key] || 0) + o.total;
    });
    const months = Object.keys(map).sort();
    return months.map(m => ({
      month: m,
      sales: map[m],
    }));
  }, [orders]);

  // Build sales by vendor from real orders
  const salesByVendor = useMemo(() => {
    const map: Record<string, number> = {};
    orders.forEach(o => {
      if (o.vendor_name) {
        map[o.vendor_name] = (map[o.vendor_name] || 0) + o.total;
      }
    });
    return Object.entries(map).map(([name, sales]) => ({ name, sales })).sort((a, b) => b.sales - a.sales);
  }, [orders]);

  // Build sales by category from real orders + products
  const salesByCategory = useMemo(() => {
    const productMap = new Map(products.map(p => [p.name, p.category]));
    const catMap: Record<string, number> = {};
    orders.forEach(o => {
      (o.items || []).forEach((item: any) => {
        const cat = productMap.get(item.productName) || 'otros';
        const subtotal = (item.qty || 0) * (item.unitPrice || 0);
        catMap[cat] = (catMap[cat] || 0) + subtotal;
      });
    });
    return Object.entries(catMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [orders, products]);

  // KPI calculations
  const totalOrders = orders.length;
  const totalQuotations = quotations.length;
  const closingRate = totalQuotations > 0 ? Math.round((totalOrders / totalQuotations) * 100) : 0;
  const totalStock = products.reduce((sum, p) => sum + Object.values(p.stock || {}).reduce((a, b) => a + b, 0), 0);
  const inventoryRotation = totalStock > 0 && totalOrders > 0
    ? (orders.reduce((s, o) => s + o.total, 0) / (products.reduce((s, p) => s + p.cost * Object.values(p.stock || {}).reduce((a, b) => a + b, 0), 0) || 1)).toFixed(1) + 'x'
    : '—';

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Reportes y KPIs</h1>
        <p className="page-subtitle">
          {isVendedor ? 'Mis reportes comerciales' : 'Centro de reportes — click en cualquier reporte para ver el detalle'}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <MetricCard title="Tasa de cierre" value={`${closingRate}%`} icon={TrendingUp} variant="success" href="/reportes/ventas" />
        <MetricCard title="Cotizaciones" value={totalQuotations} icon={BarChart3} href="/reportes/ventas" />
        <MetricCard title="Pedidos" value={totalOrders} icon={Users} href="/pedidos" />
        {!isVendedor && <MetricCard title="Rotación inventario" value={inventoryRotation} icon={Package} variant="primary" href="/reportes/inventario" />}
      </div>

      {/* Report links grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {visibleReports.map(item => (
          <Link
            key={item.path}
            to={item.path}
            className="flex items-start gap-4 p-5 bg-card rounded-xl border hover:shadow-lg hover:border-primary/30 hover:scale-[1.01] transition-all group"
          >
            <div className={`p-3 rounded-lg shrink-0 ${item.color}`}>
              <item.icon size={22} />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-display font-semibold text-sm group-hover:text-primary transition-colors">{item.label}</h3>
              <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
            </div>
            <ArrowRight size={16} className="text-muted-foreground group-hover:text-primary transition-colors mt-1 shrink-0" />
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-card rounded-xl border p-5 cursor-pointer hover:shadow-lg transition-all" onClick={() => window.location.href = '/reportes/ventas'}>
          <h3 className="font-display font-semibold mb-4">
            {isVendedor ? 'Mi tendencia de ventas' : 'Tendencia de ventas'}
          </h3>
          {monthlySales.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={monthlySales}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Line type="monotone" dataKey="sales" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ fill: 'hsl(var(--primary))' }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[280px] text-muted-foreground text-sm">
              Sin datos de ventas registrados
            </div>
          )}
        </div>

        {!isVendedor ? (
          <div className="bg-card rounded-xl border p-5 cursor-pointer hover:shadow-lg transition-all" onClick={() => window.location.href = '/reportes/vendedor'}>
            <h3 className="font-display font-semibold mb-4">Ventas por vendedor</h3>
            {salesByVendor.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={salesByVendor} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={80} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Bar dataKey="sales" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[280px] text-muted-foreground text-sm">
                Sin datos de ventas por vendedor
              </div>
            )}
          </div>
        ) : (
          <div className="bg-card rounded-xl border p-5">
            <h3 className="font-display font-semibold mb-4">Mi resumen</h3>
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-muted/50">
                <div className="text-xs text-muted-foreground uppercase tracking-wider">Pedidos totales</div>
                <div className="text-2xl font-bold text-primary mt-1">{totalOrders}</div>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <div className="text-xs text-muted-foreground uppercase tracking-wider">Venta total</div>
                <div className="text-2xl font-bold mt-1">{fmt(orders.reduce((s, o) => s + o.total, 0))}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {!isVendedor && salesByCategory.length > 0 && (
        <div className="bg-card rounded-xl border p-5 cursor-pointer hover:shadow-lg transition-all" onClick={() => window.location.href = '/reportes/ventas-sku'}>
          <h3 className="font-display font-semibold mb-4">Ventas por categoría</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={salesByCategory}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => fmt(v)} />
              <Bar dataKey="value" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
