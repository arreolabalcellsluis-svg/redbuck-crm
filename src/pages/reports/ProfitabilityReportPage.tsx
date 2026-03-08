import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ReportFilterBar, { exportToExcel } from '@/components/shared/ReportFilterBar';
import { exportFullExcel, exportFullPdf } from '@/lib/fullReportExport';
import { analyzeProducts } from '@/lib/planningEngine';
import { demoProducts } from '@/data/demo-data';
import { CATEGORY_LABELS } from '@/types';
import { subMonths } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const fmt = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);

export default function ProfitabilityReportPage() {
  const [filters, setFilters] = useState<Record<string, any>>({
    search: '',
    categoria: '',
    dateFrom: subMonths(new Date(), 6),
    dateTo: new Date(),
  });

  const analyses = useMemo(() => analyzeProducts(), []);

  const records = useMemo(() => {
    return analyses.map(a => {
      const importCost = a.product.cost * 0.15; // estimated import cost
      const totalCost = a.product.cost + importCost;
      const avgSalePrice = a.product.listPrice;
      const utilidad = avgSalePrice - totalCost;
      const margen = avgSalePrice > 0 ? (utilidad / avgSalePrice) * 100 : 0;
      return {
        id: a.product.id,
        sku: a.product.sku,
        producto: a.product.name,
        categoria: a.product.category,
        costoCompra: a.product.cost,
        costoImportacion: importCost,
        costoTotal: totalCost,
        precioVentaProm: avgSalePrice,
        utilidad,
        margen,
        ventasMensuales: a.monthlySales,
        utilidadAnual: a.annualProfit,
      };
    }).sort((a, b) => b.utilidadAnual - a.utilidadAnual);
  }, [analyses]);

  const filtered = useMemo(() => {
    return records.filter(r => {
      if (filters.search) {
        const s = filters.search.toLowerCase();
        if (!r.producto.toLowerCase().includes(s) && !r.sku.toLowerCase().includes(s)) return false;
      }
      if (filters.categoria && r.categoria !== filters.categoria) return false;
      return true;
    });
  }, [records, filters]);

  const chartData = filtered.slice(0, 10).map(r => ({
    name: r.sku,
    utilidad: r.utilidad,
    margen: r.margen,
  }));

  const hasActiveFilters = !!(filters.search || filters.categoria);

  const totalUtilidad = filtered.reduce((s, r) => s + r.utilidad, 0);
  const totalAnual = filtered.reduce((s, r) => s + r.utilidadAnual, 0);
  const avgMargen = filtered.length > 0 ? filtered.reduce((s, r) => s + r.margen, 0) / filtered.length : 0;

  const handleExport = () => {
    const dateStr = new Date().toISOString().split('T')[0];
    const kpis = [
      { label: 'Productos', value: filtered.length as number },
      { label: 'Utilidad prom/ud', value: fmt(filtered.length > 0 ? totalUtilidad / filtered.length : 0) },
      { label: 'Margen promedio', value: `${avgMargen.toFixed(1)}%`, color: 'success' as const },
      { label: 'Utilidad anual est.', value: fmt(totalAnual), color: 'primary' as const },
    ];
    const headers = ['SKU', 'Producto', 'Categoría', 'Costo compra', 'Costo import.', 'Costo total', 'P. venta prom.', 'Utilidad/ud', 'Margen %', 'Utilidad anual'];
    const rows = filtered.map(r => [
      r.sku, r.producto, CATEGORY_LABELS[r.categoria as keyof typeof CATEGORY_LABELS] || r.categoria,
      fmt(r.costoCompra), fmt(r.costoImportacion), fmt(r.costoTotal), fmt(r.precioVentaProm),
      fmt(r.utilidad), `${r.margen.toFixed(1)}%`, fmt(r.utilidadAnual),
    ]);
    const chartHeaders = ['SKU', 'Utilidad/ud'];
    const chartRows = filtered.slice(0, 10).map(r => [r.sku, fmt(r.utilidad)]);
    exportFullExcel({
      title: 'Rentabilidad por Producto', subtitle: `Top ${filtered.length} productos`, filename: `Rentabilidad_${dateStr}`,
      kpis, sections: [
        { title: 'Utilidad por producto (Top 10)', headers: chartHeaders, rows: chartRows },
        { title: 'Detalle completo', headers, rows },
      ],
    });
  };

  const handleExportPdf = () => {
    const dateStr = new Date().toISOString().split('T')[0];
    exportFullPdf({
      title: 'Rentabilidad por Producto', subtitle: `Top ${filtered.length} productos`, filename: `Rentabilidad_${dateStr}`,
      kpis: [
        { label: 'Productos', value: filtered.length },
        { label: 'Utilidad prom/ud', value: fmt(filtered.length > 0 ? totalUtilidad / filtered.length : 0) },
        { label: 'Margen promedio', value: `${avgMargen.toFixed(1)}%`, color: 'success' },
        { label: 'Utilidad anual est.', value: fmt(totalAnual), color: 'primary' },
      ],
      sections: [
        { title: 'Top 10 Utilidad por producto', headers: ['SKU', 'Producto', 'Utilidad/ud', 'Margen %'], rows: filtered.slice(0, 10).map(r => [r.sku, r.producto, fmt(r.utilidad), `${r.margen.toFixed(1)}%`]) },
        { title: 'Detalle completo', headers: ['SKU', 'Producto', 'Categoría', 'Costo total', 'P. venta', 'Utilidad/ud', 'Margen %', 'Ut. anual'], rows: filtered.map(r => [r.sku, r.producto, CATEGORY_LABELS[r.categoria as keyof typeof CATEGORY_LABELS] || r.categoria, fmt(r.costoTotal), fmt(r.precioVentaProm), fmt(r.utilidad), `${r.margen.toFixed(1)}%`, fmt(r.utilidadAnual)]) },
      ],
    });
  };

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <Link to={-1 as any}><Button variant="ghost" size="sm"><ArrowLeft size={16} /></Button></Link>
          <div>
            <h1 className="page-title flex items-center gap-2"><Star size={22} className="text-warning" /> Rentabilidad por Producto</h1>
            <p className="page-subtitle">Histórico semestral actualizado al día de hoy</p>
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
        onClear={() => setFilters({ search: '', categoria: '', dateFrom: subMonths(new Date(), 6), dateTo: new Date() })}
        onExportExcel={handleExport}
        hasActiveFilters={hasActiveFilters}
      />

      {/* Chart */}
      <div className="bg-card rounded-xl border p-5 mb-6">
        <h3 className="font-display font-semibold mb-4">Utilidad por producto (Top 10)</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
            <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={100} />
            <Tooltip formatter={(v: number) => fmt(v)} />
            <Bar dataKey="utilidad" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} name="Utilidad/ud" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>SKU</th><th>Producto</th><th>Categoría</th><th>Costo compra</th>
              <th>Costo import.</th><th>Costo total</th><th>P. venta prom.</th>
              <th>Utilidad/ud</th><th>Margen %</th><th>Utilidad anual est.</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.id}>
                <td className="font-mono text-xs">{r.sku}</td>
                <td className="text-xs font-medium">{r.producto}</td>
                <td className="text-xs">{CATEGORY_LABELS[r.categoria as keyof typeof CATEGORY_LABELS]}</td>
                <td className="text-xs">{fmt(r.costoCompra)}</td>
                <td className="text-xs">{fmt(r.costoImportacion)}</td>
                <td className="text-xs">{fmt(r.costoTotal)}</td>
                <td className="text-xs">{fmt(r.precioVentaProm)}</td>
                <td className="text-xs font-bold text-success">{fmt(r.utilidad)}</td>
                <td className="text-xs">
                  <span className={`font-bold ${r.margen >= 40 ? 'text-success' : r.margen >= 30 ? 'text-primary' : 'text-destructive'}`}>
                    {r.margen.toFixed(1)}%
                  </span>
                </td>
                <td className="text-xs font-bold">{fmt(r.utilidadAnual)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
