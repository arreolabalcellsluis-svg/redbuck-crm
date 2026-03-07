import { useState, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ReportFilterBar, { exportToExcel } from '@/components/shared/ReportFilterBar';
import { demoOrders, demoProducts, salesByVendor, demoUsers } from '@/data/demo-data';
import { CATEGORY_LABELS } from '@/types';

const fmt = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);

// Generate detailed sales records from orders
function generateSalesRecords() {
  return demoOrders.flatMap(o =>
    o.items.map((item, idx) => {
      const product = demoProducts.find(p => p.name === item.productName || item.productName.includes(p.name.split(' ')[0]));
      const subtotal = item.qty * item.unitPrice;
      const iva = subtotal * 0.16;
      return {
        id: `${o.id}-${idx}`,
        fecha: o.createdAt,
        folio: o.folio,
        cliente: o.customerName,
        vendedor: o.vendorName,
        sku: product?.sku || 'N/A',
        producto: item.productName,
        categoria: product?.category || 'otros',
        cantidad: item.qty,
        precioVenta: item.unitPrice,
        subtotal,
        iva,
        total: subtotal + iva,
        canal: 'Directo',
        estatus: o.status,
      };
    })
  );
}

export default function SalesReportPage() {
  const [searchParams] = useSearchParams();
  const vendorFilter = searchParams.get('vendedor') || '';
  const skuFilter = searchParams.get('sku') || '';

  const [filters, setFilters] = useState<Record<string, any>>({
    search: '',
    vendedor: vendorFilter,
    sku: skuFilter,
    categoria: '',
    dateFrom: undefined,
    dateTo: undefined,
  });

  const records = useMemo(() => generateSalesRecords(), []);

  const filtered = useMemo(() => {
    return records.filter(r => {
      if (filters.search) {
        const s = filters.search.toLowerCase();
        if (!r.cliente.toLowerCase().includes(s) && !r.producto.toLowerCase().includes(s) && !r.sku.toLowerCase().includes(s) && !r.folio.toLowerCase().includes(s)) return false;
      }
      if (filters.vendedor && !r.vendedor.includes(filters.vendedor)) return false;
      if (filters.sku && r.sku !== filters.sku) return false;
      if (filters.categoria && r.categoria !== filters.categoria) return false;
      if (filters.dateFrom && new Date(r.fecha) < new Date(filters.dateFrom)) return false;
      if (filters.dateTo && new Date(r.fecha) > new Date(filters.dateTo)) return false;
      return true;
    });
  }, [records, filters]);

  const totals = useMemo(() => ({
    cantidad: filtered.reduce((s, r) => s + r.cantidad, 0),
    subtotal: filtered.reduce((s, r) => s + r.subtotal, 0),
    iva: filtered.reduce((s, r) => s + r.iva, 0),
    total: filtered.reduce((s, r) => s + r.total, 0),
  }), [filtered]);

  const hasActiveFilters = !!(filters.search || filters.vendedor || filters.sku || filters.categoria || filters.dateFrom || filters.dateTo);

  const vendorOptions = [...new Set(records.map(r => r.vendedor))].map(v => ({ value: v, label: v }));
  const skuOptions = [...new Set(records.map(r => r.sku))].filter(s => s !== 'N/A').map(s => ({ value: s, label: s }));
  const catOptions = Object.entries(CATEGORY_LABELS).map(([k, v]) => ({ value: k, label: v }));

  const handleExport = () => {
    const data = filtered.map(r => ({
      Fecha: r.fecha, Folio: r.folio, Cliente: r.cliente, Vendedor: r.vendedor,
      SKU: r.sku, Producto: r.producto, Cantidad: r.cantidad,
      'Precio Venta': r.precioVenta, Subtotal: r.subtotal, IVA: r.iva, Total: r.total,
      Canal: r.canal, Estatus: r.estatus,
    }));
    const dateStr = new Date().toISOString().split('T')[0];
    exportToExcel(data, `Ventas_del_mes_${dateStr}`);
  };

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <Link to={-1 as any}>
            <Button variant="ghost" size="sm"><ArrowLeft size={16} /></Button>
          </Link>
          <div>
            <h1 className="page-title">Reporte de Ventas</h1>
            <p className="page-subtitle">Detalle transaccional de ventas</p>
          </div>
        </div>
      </div>

      <ReportFilterBar
        config={{
          search: true,
          searchPlaceholder: 'Buscar por cliente, producto, SKU, folio...',
          dateRange: true,
          selects: [
            { key: 'vendedor', label: 'Vendedor', options: vendorOptions },
            { key: 'sku', label: 'SKU', options: skuOptions },
            { key: 'categoria', label: 'Categoría', options: catOptions },
          ],
          exportExcel: true,
        }}
        filters={filters}
        onFilterChange={(k, v) => setFilters(prev => ({ ...prev, [k]: v }))}
        onClear={() => setFilters({ search: '', vendedor: '', sku: '', categoria: '', dateFrom: undefined, dateTo: undefined })}
        onExportExcel={handleExport}
        hasActiveFilters={hasActiveFilters}
      />

      {/* Summary */}
      <div className="grid grid-cols-4 gap-4 mb-4">
        <div className="bg-card rounded-xl border p-4 text-center">
          <div className="text-xs text-muted-foreground">Registros</div>
          <div className="text-xl font-bold">{filtered.length}</div>
        </div>
        <div className="bg-card rounded-xl border p-4 text-center">
          <div className="text-xs text-muted-foreground">Unidades</div>
          <div className="text-xl font-bold">{totals.cantidad}</div>
        </div>
        <div className="bg-card rounded-xl border p-4 text-center">
          <div className="text-xs text-muted-foreground">Subtotal</div>
          <div className="text-xl font-bold">{fmt(totals.subtotal)}</div>
        </div>
        <div className="bg-card rounded-xl border p-4 text-center">
          <div className="text-xs text-muted-foreground">Total c/IVA</div>
          <div className="text-xl font-bold text-primary">{fmt(totals.total)}</div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Fecha</th><th>Folio</th><th>Cliente</th><th>Vendedor</th>
              <th>SKU</th><th>Producto</th><th>Cant.</th><th>P. Venta</th>
              <th>Subtotal</th><th>IVA</th><th>Total</th><th>Canal</th><th>Estatus</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.id}>
                <td className="text-xs">{r.fecha}</td>
                <td className="font-medium text-xs">{r.folio}</td>
                <td className="text-xs">{r.cliente}</td>
                <td className="text-xs">{r.vendedor}</td>
                <td className="text-xs font-mono">{r.sku}</td>
                <td className="text-xs">{r.producto}</td>
                <td className="text-xs text-center">{r.cantidad}</td>
                <td className="text-xs">{fmt(r.precioVenta)}</td>
                <td className="text-xs">{fmt(r.subtotal)}</td>
                <td className="text-xs">{fmt(r.iva)}</td>
                <td className="text-xs font-bold">{fmt(r.total)}</td>
                <td className="text-xs">{r.canal}</td>
                <td className="text-xs">{r.estatus}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={13} className="text-center text-muted-foreground py-8">Sin registros</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
