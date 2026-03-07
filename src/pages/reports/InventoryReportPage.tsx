import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ReportFilterBar, { exportToExcel } from '@/components/shared/ReportFilterBar';
import { demoProducts, demoWarehouses } from '@/data/demo-data';
import { CATEGORY_LABELS } from '@/types';

const fmt = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);

export default function InventoryReportPage() {
  const [filters, setFilters] = useState<Record<string, any>>({ search: '', bodega: '', categoria: '' });

  const records = useMemo(() => {
    return demoProducts.filter(p => p.active).map(p => {
      const totalStock = Object.values(p.stock).reduce((a, b) => a + b, 0);
      return {
        id: p.id,
        sku: p.sku,
        producto: p.name,
        categoria: p.category,
        modelo: p.model,
        marca: p.brand,
        ...Object.fromEntries(demoWarehouses.map(w => [`stock_${w.id}`, p.stock[w.id] || 0])),
        stockTotal: totalStock,
        stockComprometido: 0,
        enTransito: p.inTransit,
        costo: p.cost,
        valorTotal: totalStock * p.cost,
      };
    });
  }, []);

  const filtered = useMemo(() => {
    return records.filter(r => {
      if (filters.search) {
        const s = filters.search.toLowerCase();
        if (!r.producto.toLowerCase().includes(s) && !r.sku.toLowerCase().includes(s)) return false;
      }
      if (filters.categoria && r.categoria !== filters.categoria) return false;
      if (filters.bodega) {
        const stockKey = `stock_${filters.bodega}`;
        if ((r as any)[stockKey] <= 0) return false;
      }
      return true;
    });
  }, [records, filters]);

  const totalValue = filtered.reduce((s, r) => s + r.valorTotal, 0);
  const totalUnits = filtered.reduce((s, r) => s + r.stockTotal, 0);
  const hasActiveFilters = !!(filters.search || filters.bodega || filters.categoria);

  const handleExport = () => {
    const data = filtered.map(r => ({
      SKU: r.sku, Producto: r.producto, Categoría: CATEGORY_LABELS[r.categoria as keyof typeof CATEGORY_LABELS] || r.categoria,
      Modelo: r.modelo,
      ...Object.fromEntries(demoWarehouses.map(w => [w.name, (r as any)[`stock_${w.id}`]])),
      'Stock Total': r.stockTotal, 'En Tránsito': r.enTransito,
      Costo: r.costo, 'Valor Total': r.valorTotal,
    }));
    exportToExcel(data, `Inventario_${new Date().toISOString().split('T')[0]}`);
  };

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <Link to={-1 as any}><Button variant="ghost" size="sm"><ArrowLeft size={16} /></Button></Link>
          <div>
            <h1 className="page-title">Reporte de Inventario</h1>
            <p className="page-subtitle">Detalle completo del inventario actual</p>
          </div>
        </div>
      </div>

      <ReportFilterBar
        config={{
          search: true, searchPlaceholder: 'Buscar por producto o SKU...',
          selects: [
            { key: 'bodega', label: 'Bodega', options: demoWarehouses.map(w => ({ value: w.id, label: w.name })) },
            { key: 'categoria', label: 'Categoría', options: Object.entries(CATEGORY_LABELS).map(([k, v]) => ({ value: k, label: v })) },
          ],
          exportExcel: true,
        }}
        filters={filters}
        onFilterChange={(k, v) => setFilters(prev => ({ ...prev, [k]: v }))}
        onClear={() => setFilters({ search: '', bodega: '', categoria: '' })}
        onExportExcel={handleExport}
        hasActiveFilters={hasActiveFilters}
      />

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="bg-card rounded-xl border p-4 text-center">
          <div className="text-xs text-muted-foreground">Productos</div>
          <div className="text-xl font-bold">{filtered.length}</div>
        </div>
        <div className="bg-card rounded-xl border p-4 text-center">
          <div className="text-xs text-muted-foreground">Unidades totales</div>
          <div className="text-xl font-bold">{totalUnits}</div>
        </div>
        <div className="bg-card rounded-xl border p-4 text-center">
          <div className="text-xs text-muted-foreground">Valor total</div>
          <div className="text-xl font-bold text-primary">{fmt(totalValue)}</div>
        </div>
      </div>

      <div className="bg-card rounded-xl border overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>SKU</th><th>Producto</th><th>Categoría</th><th>Modelo</th>
              {demoWarehouses.map(w => <th key={w.id}>{w.name}</th>)}
              <th>Total</th><th>Tránsito</th><th>Costo</th><th>Valor</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.id}>
                <td className="font-mono text-xs">{r.sku}</td>
                <td className="text-xs font-medium">{r.producto}</td>
                <td className="text-xs">{CATEGORY_LABELS[r.categoria as keyof typeof CATEGORY_LABELS] || r.categoria}</td>
                <td className="text-xs">{r.modelo}</td>
                {demoWarehouses.map(w => (
                  <td key={w.id} className="text-xs text-center">{(r as any)[`stock_${w.id}`]}</td>
                ))}
                <td className="text-xs font-bold text-center">{r.stockTotal}</td>
                <td className="text-xs text-center text-primary">{r.enTransito}</td>
                <td className="text-xs">{fmt(r.costo)}</td>
                <td className="text-xs font-bold">{fmt(r.valorTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
