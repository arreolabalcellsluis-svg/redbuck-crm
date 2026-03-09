import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Skull } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ReportFilterBar, { exportToExcel } from '@/components/shared/ReportFilterBar';
import { exportFullExcel, exportFullPdf } from '@/lib/fullReportExport';
import { usePlanningData } from '@/hooks/usePlanningData';
import { CATEGORY_LABELS } from '@/types';

const fmt = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);

export default function DeadStockReportPage() {
  const [filters, setFilters] = useState<Record<string, any>>({ search: '', categoria: '', bodega: '', periodo: '180' });

  const { analyses, warehouses: demoWarehouses } = usePlanningData();

  const records = useMemo(() => {
    const threshold = parseInt(filters.periodo) || 180;
    return analyses
      .filter(a => a.daysOfStock > threshold)
      .map(a => {
        const totalStock = a.totalStock;
        const lastSaleDate = new Date();
        lastSaleDate.setDate(lastSaleDate.getDate() - a.daysOfStock);
        let suggestion = 'Monitorear';
        if (a.daysOfStock > 365) suggestion = 'Liquidar';
        else if (a.daysOfStock > 180) suggestion = 'Promoción / Descuento';
        else suggestion = 'Revisar rotación';
        return {
          id: a.product.id,
          sku: a.product.sku,
          producto: a.product.name,
          modelo: a.product.model,
          categoria: a.product.category,
          ultimaVenta: lastSaleDate.toISOString().split('T')[0],
          diasSinVender: a.daysOfStock,
          stock: totalStock,
          costo: a.product.cost,
          valorDetenido: totalStock * a.product.cost,
          sugerencia: suggestion,
        };
      })
      .sort((a, b) => b.diasSinVender - a.diasSinVender);
  }, [analyses, filters.periodo]);

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

  const totalValue = filtered.reduce((s, r) => s + r.valorDetenido, 0);
  const hasActiveFilters = !!(filters.search || filters.categoria);

  const handleExport = () => {
    const dateStr = new Date().toISOString().split('T')[0];
    const totalUnits = filtered.reduce((s, r) => s + r.stock, 0);
    const headers = ['SKU', 'Producto', 'Modelo', 'Categoría', 'Última venta', 'Días sin vender', 'Stock', 'Costo', 'Valor detenido', 'Sugerencia'];
    const rows = filtered.map(r => [r.sku, r.producto, r.modelo, CATEGORY_LABELS[r.categoria as keyof typeof CATEGORY_LABELS] || r.categoria, r.ultimaVenta, `${r.diasSinVender}d`, r.stock, fmt(r.costo), fmt(r.valorDetenido), r.sugerencia]);
    exportFullExcel({
      title: 'Inventario Muerto', subtitle: `Productos sin rotación > ${filters.periodo} días`, filename: `Inventario_muerto_${dateStr}`,
      kpis: [
        { label: 'Productos muertos', value: filtered.length, color: 'destructive' },
        { label: 'Unidades estancadas', value: totalUnits },
        { label: 'Valor detenido', value: fmt(totalValue), color: 'destructive' },
      ],
      sections: [{ title: `Productos sin rotación > ${filters.periodo} días`, headers, rows }],
    });
  };

  const handleExportPdf = () => {
    const dateStr = new Date().toISOString().split('T')[0];
    const totalUnits = filtered.reduce((s, r) => s + r.stock, 0);
    exportFullPdf({
      title: 'Inventario Muerto', subtitle: `Productos sin rotación > ${filters.periodo} días`, filename: `Inventario_muerto_${dateStr}`,
      kpis: [
        { label: 'Productos muertos', value: filtered.length, color: 'destructive' },
        { label: 'Unidades estancadas', value: totalUnits },
        { label: 'Valor detenido', value: fmt(totalValue), color: 'destructive' },
      ],
      sections: [{
        title: 'Detalle de inventario muerto',
        headers: ['SKU', 'Producto', 'Categoría', 'Días sin vender', 'Stock', 'Valor detenido', 'Sugerencia'],
        rows: filtered.map(r => [r.sku, r.producto, CATEGORY_LABELS[r.categoria as keyof typeof CATEGORY_LABELS] || r.categoria, `${r.diasSinVender}d`, r.stock, fmt(r.valorDetenido), r.sugerencia]),
        totalsRow: ['TOTAL', '', '', '', totalUnits, fmt(totalValue), ''],
      }],
    });
  };

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <Link to={-1 as any}><Button variant="ghost" size="sm"><ArrowLeft size={16} /></Button></Link>
          <div>
            <h1 className="page-title flex items-center gap-2"><Skull size={22} className="text-destructive" /> Inventario Muerto</h1>
            <p className="page-subtitle">Productos sin rotación que requieren acción</p>
          </div>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        {['90', '180', '365'].map(p => (
          <Button key={p} variant={filters.periodo === p ? 'default' : 'outline'} size="sm" className="text-xs"
            onClick={() => setFilters(prev => ({ ...prev, periodo: p }))}>
            {'>'} {p} días
          </Button>
        ))}
      </div>

      <ReportFilterBar
        config={{
          search: true, searchPlaceholder: 'Buscar por producto o SKU...',
          selects: [
            { key: 'categoria', label: 'Categoría', options: Object.entries(CATEGORY_LABELS).map(([k, v]) => ({ value: k, label: v })) },
          ],
          exportExcel: true, exportPdf: true,
        }}
        filters={filters}
        onFilterChange={(k, v) => setFilters(prev => ({ ...prev, [k]: v }))}
        onClear={() => setFilters({ search: '', categoria: '', bodega: '', periodo: filters.periodo })}
        onExportExcel={handleExport}
        onExportPdf={handleExportPdf}
        hasActiveFilters={hasActiveFilters}
      />

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="bg-card rounded-xl border p-4 text-center">
          <div className="text-xs text-muted-foreground">Productos muertos</div>
          <div className="text-xl font-bold text-destructive">{filtered.length}</div>
        </div>
        <div className="bg-card rounded-xl border p-4 text-center">
          <div className="text-xs text-muted-foreground">Unidades estancadas</div>
          <div className="text-xl font-bold">{filtered.reduce((s, r) => s + r.stock, 0)}</div>
        </div>
        <div className="bg-card rounded-xl border p-4 text-center">
          <div className="text-xs text-muted-foreground">Valor detenido</div>
          <div className="text-xl font-bold text-destructive">{fmt(totalValue)}</div>
        </div>
      </div>

      <div className="bg-card rounded-xl border overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>SKU</th><th>Producto</th><th>Modelo</th><th>Categoría</th>
              <th>Última venta</th><th>Días sin vender</th><th>Stock</th>
              <th>Costo</th><th>Valor detenido</th><th>Sugerencia</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.id}>
                <td className="font-mono text-xs">{r.sku}</td>
                <td className="text-xs font-medium">{r.producto}</td>
                <td className="text-xs">{r.modelo}</td>
                <td className="text-xs">{CATEGORY_LABELS[r.categoria as keyof typeof CATEGORY_LABELS]}</td>
                <td className="text-xs">{r.ultimaVenta}</td>
                <td className="text-xs font-bold text-destructive">{r.diasSinVender}d</td>
                <td className="text-xs text-center">{r.stock}</td>
                <td className="text-xs">{fmt(r.costo)}</td>
                <td className="text-xs font-bold">{fmt(r.valorDetenido)}</td>
                <td>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    r.sugerencia === 'Liquidar' ? 'bg-destructive/10 text-destructive' :
                    r.sugerencia.includes('Promoción') ? 'bg-warning/10 text-warning' :
                    'bg-muted text-muted-foreground'
                  }`}>{r.sugerencia}</span>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={10} className="text-center text-muted-foreground py-8">Sin inventario muerto en este periodo</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
