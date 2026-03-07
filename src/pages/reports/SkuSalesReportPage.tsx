import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ReportFilterBar, { exportToExcel } from '@/components/shared/ReportFilterBar';
import { demoOrders, demoProducts } from '@/data/demo-data';
import { useAppContext } from '@/contexts/AppContext';
import { DEMO_VENDEDOR_NAME } from '@/lib/rolePermissions';
import { CATEGORY_LABELS } from '@/types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const fmt = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);

type ViewMode = 'monto' | 'unidades' | 'rentabilidad';

export default function SkuSalesReportPage() {
  const { currentRole } = useAppContext();
  const isVendedor = currentRole === 'vendedor';
  const navigate = useNavigate();
  const [filters, setFilters] = useState<Record<string, any>>({ search: '', categoria: '', dateFrom: undefined, dateTo: undefined });
  const [viewMode, setViewMode] = useState<ViewMode>('monto');
  const [chartType, setChartType] = useState<'bar' | 'table'>('bar');

  const skuData = useMemo(() => {
    const map: Record<string, { sku: string; producto: string; unidades: number; monto: number; costo: number; categoria: string }> = {};
    // For vendedor, only count their own orders
    const ordersToUse = isVendedor
      ? demoOrders.filter(o => o.vendorName === DEMO_VENDEDOR_NAME)
      : demoOrders;
    ordersToUse.forEach(o => {
      o.items.forEach(item => {
        const product = demoProducts.find(p => p.name === item.productName || item.productName.includes(p.name.split(' ')[0]));
        const sku = product?.sku || 'N/A';
        if (!map[sku]) map[sku] = { sku, producto: item.productName, unidades: 0, monto: 0, costo: product?.cost || 0, categoria: product?.category || 'otros' };
        map[sku].unidades += item.qty;
        map[sku].monto += item.qty * item.unitPrice;
      });
    });
    return Object.values(map).map(d => ({
      ...d,
      utilidad: d.monto - d.unidades * d.costo,
      margen: d.monto > 0 ? ((d.monto - d.unidades * d.costo) / d.monto * 100) : 0,
    }));
  }, []);

  const filtered = useMemo(() => {
    return skuData.filter(r => {
      if (filters.search) {
        const s = filters.search.toLowerCase();
        if (!r.producto.toLowerCase().includes(s) && !r.sku.toLowerCase().includes(s)) return false;
      }
      if (filters.categoria && r.categoria !== filters.categoria) return false;
      return true;
    }).sort((a, b) => viewMode === 'unidades' ? b.unidades - a.unidades : viewMode === 'rentabilidad' ? b.utilidad - a.utilidad : b.monto - a.monto);
  }, [skuData, filters, viewMode]);

  const chartData = filtered.slice(0, 10).map(r => ({
    name: r.sku,
    value: viewMode === 'unidades' ? r.unidades : viewMode === 'rentabilidad' ? r.utilidad : r.monto,
  }));

  const hasActiveFilters = !!(filters.search || filters.categoria || filters.dateFrom || filters.dateTo);

  const handleExport = () => {
    const data = filtered.map(r => ({
      SKU: r.sku, Producto: r.producto,
      Categoría: CATEGORY_LABELS[r.categoria as keyof typeof CATEGORY_LABELS] || r.categoria,
      Unidades: r.unidades, 'Monto vendido': r.monto,
      Utilidad: r.utilidad, 'Margen %': r.margen.toFixed(1),
    }));
    exportToExcel(data, `Ventas_por_SKU_${new Date().toISOString().split('T')[0]}`);
  };

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <Link to={-1 as any}><Button variant="ghost" size="sm"><ArrowLeft size={16} /></Button></Link>
          <div>
            <h1 className="page-title flex items-center gap-2"><BarChart3 size={22} className="text-primary" /> Ventas por SKU</h1>
            <p className="page-subtitle">Análisis de ventas por código de producto</p>
          </div>
        </div>
      </div>

      <ReportFilterBar
        config={{
          search: true, searchPlaceholder: 'Buscar por SKU o producto...',
          dateRange: true,
          selects: [
            { key: 'categoria', label: 'Categoría', options: Object.entries(CATEGORY_LABELS).map(([k, v]) => ({ value: k, label: v })) },
          ],
          exportExcel: true,
        }}
        filters={filters}
        onFilterChange={(k, v) => setFilters(prev => ({ ...prev, [k]: v }))}
        onClear={() => setFilters({ search: '', categoria: '', dateFrom: undefined, dateTo: undefined })}
        onExportExcel={handleExport}
        hasActiveFilters={hasActiveFilters}
      />

      {/* View mode toggles */}
      <div className="flex gap-2 mb-4">
        <div className="flex gap-1">
          {([['monto', 'Por monto'], ['unidades', 'Por unidades'], ['rentabilidad', 'Por rentabilidad']] as const).map(([k, l]) => (
            <Button key={k} variant={viewMode === k ? 'default' : 'outline'} size="sm" className="text-xs"
              onClick={() => setViewMode(k as ViewMode)}>{l}</Button>
          ))}
        </div>
        <div className="ml-auto flex gap-1">
          <Button variant={chartType === 'bar' ? 'default' : 'outline'} size="sm" className="text-xs" onClick={() => setChartType('bar')}>Gráfica</Button>
          <Button variant={chartType === 'table' ? 'default' : 'outline'} size="sm" className="text-xs" onClick={() => setChartType('table')}>Tabla</Button>
        </div>
      </div>

      {chartType === 'bar' && (
        <div className="bg-card rounded-xl border p-5 mb-6">
          <h3 className="font-display font-semibold mb-4">Top 10 SKU — {viewMode === 'unidades' ? 'Unidades' : viewMode === 'rentabilidad' ? 'Utilidad' : 'Monto'}</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => viewMode === 'unidades' ? v : `$${(v/1000).toFixed(0)}k`} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={100} />
              <Tooltip formatter={(v: number) => viewMode === 'unidades' ? `${v} uds` : fmt(v)} />
              <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]}
                cursor="pointer"
                onClick={(data: any) => {
                  if (data?.name) navigate(`/reportes/ventas?sku=${data.name}`);
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="bg-card rounded-xl border overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr><th>SKU</th><th>Producto</th><th>Categoría</th><th>Unidades</th><th>Monto</th><th>Utilidad</th><th>Margen %</th></tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.sku} className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => navigate(`/reportes/ventas?sku=${r.sku}`)}>
                <td className="font-mono text-xs">{r.sku}</td>
                <td className="text-xs font-medium">{r.producto}</td>
                <td className="text-xs">{CATEGORY_LABELS[r.categoria as keyof typeof CATEGORY_LABELS]}</td>
                <td className="text-xs text-center font-bold">{r.unidades}</td>
                <td className="text-xs font-bold">{fmt(r.monto)}</td>
                <td className="text-xs font-bold text-success">{fmt(r.utilidad)}</td>
                <td className="text-xs">
                  <span className={`font-bold ${r.margen >= 40 ? 'text-success' : r.margen >= 30 ? 'text-primary' : 'text-destructive'}`}>
                    {r.margen.toFixed(1)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
