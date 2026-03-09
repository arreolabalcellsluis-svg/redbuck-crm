import { useState, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ReportFilterBar, { exportToExcel } from '@/components/shared/ReportFilterBar';
import { exportFullExcel, exportFullPdf } from '@/lib/fullReportExport';
import { useReportData } from '@/hooks/usePlanningData';
import { useAppContext } from '@/contexts/AppContext';
import { CATEGORY_LABELS } from '@/types';

const fmt = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);

export default function SalesReportPage() {
  const { currentRole } = useAppContext();
  const isVendedor = currentRole === 'vendedor';
  const [searchParams] = useSearchParams();
  const vendorFilter = searchParams.get('vendedor') || '';
  const skuFilter = searchParams.get('sku') || '';
  const { orders, products, quotations } = useReportData();

  const [filters, setFilters] = useState<Record<string, any>>({
    search: '', vendedor: vendorFilter, sku: skuFilter, categoria: '', dateFrom: undefined, dateTo: undefined,
  });

  const records = useMemo(() => {
    return orders.flatMap(o =>
      o.items.map((item, idx) => {
        const product = products.find(p => p.name === item.productName || item.productName.includes(p.name.split(' ')[0]));
        const subtotal = item.qty * item.unitPrice;
        const iva = subtotal * 0.16;
        return {
          id: `${o.id}-${idx}`, fecha: o.createdAt, folio: o.folio, cliente: o.customerName,
          vendedor: o.vendorName, sku: product?.sku || 'N/A', producto: item.productName,
          categoria: product?.category || 'otros', cantidad: item.qty, precioVenta: item.unitPrice,
          subtotal, iva, total: subtotal + iva, canal: 'Directo', estatus: o.status,
        };
      })
    );
  }, [orders, products]);

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

  const totalCotizaciones = useMemo(() => quotations.length, [quotations]);

  const vendorOptions = useMemo(() => {
    const vendors = [...new Set(orders.map(o => o.vendorName).filter(Boolean))];
    return vendors.map(v => ({ value: v, label: v }));
  }, [orders]);

  const skuOptions = useMemo(() => {
    const skus = [...new Set(records.map(r => r.sku).filter(s => s !== 'N/A'))];
    return skus.map(s => ({ value: s, label: s }));
  }, [records]);

  const hasActiveFilters = !!(filters.search || filters.vendedor || filters.sku || filters.categoria || filters.dateFrom || filters.dateTo);

  const handleExport = () => {
    const dateStr = new Date().toISOString().split('T')[0];
    exportFullExcel({
      title: 'Reporte de Ventas', subtitle: dateStr, filename: `Ventas_${dateStr}`,
      kpis: [
        { label: 'Ventas totales', value: fmt(totals.total), color: 'primary' },
        { label: '# Líneas', value: filtered.length },
        { label: 'Cotizaciones', value: totalCotizaciones },
      ],
      sections: [{
        title: 'Detalle de ventas',
        headers: ['Fecha', 'Folio', 'Cliente', 'Vendedor', 'SKU', 'Producto', 'Categoría', 'Cant.', 'Precio', 'Subtotal', 'IVA', 'Total'],
        rows: filtered.map(r => [r.fecha, r.folio, r.cliente, r.vendedor, r.sku, r.producto, CATEGORY_LABELS[r.categoria as keyof typeof CATEGORY_LABELS] || r.categoria, r.cantidad, fmt(r.precioVenta), fmt(r.subtotal), fmt(r.iva), fmt(r.total)]),
        totalsRow: ['TOTAL', '', '', '', '', '', '', totals.cantidad, '', fmt(totals.subtotal), fmt(totals.iva), fmt(totals.total)],
      }],
    });
  };

  const handleExportPdf = () => {
    const dateStr = new Date().toISOString().split('T')[0];
    exportFullPdf({
      title: 'Reporte de Ventas', subtitle: dateStr, filename: `Ventas_${dateStr}`,
      kpis: [
        { label: 'Ventas totales', value: fmt(totals.total), color: 'primary' },
        { label: '# Líneas', value: filtered.length },
      ],
      sections: [{
        title: 'Detalle',
        headers: ['Fecha', 'Folio', 'Cliente', 'Vendedor', 'SKU', 'Producto', 'Cant.', 'Total'],
        rows: filtered.map(r => [r.fecha, r.folio, r.cliente, r.vendedor, r.sku, r.producto, r.cantidad, fmt(r.total)]),
        totalsRow: ['TOTAL', '', '', '', '', '', totals.cantidad, fmt(totals.total)],
      }],
    });
  };

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <Link to={-1 as any}><Button variant="ghost" size="sm"><ArrowLeft size={16} /></Button></Link>
          <div>
            <h1 className="page-title">Reporte de Ventas</h1>
            <p className="page-subtitle">Detalle transaccional por fecha, vendedor, cliente y SKU</p>
          </div>
        </div>
      </div>

      <ReportFilterBar
        config={{
          search: true, searchPlaceholder: 'Buscar por cliente, producto, SKU o folio...',
          dateRange: true,
          selects: [
            { key: 'vendedor', label: 'Vendedor', options: vendorOptions },
            { key: 'sku', label: 'SKU', options: skuOptions },
            { key: 'categoria', label: 'Categoría', options: Object.entries(CATEGORY_LABELS).map(([k, v]) => ({ value: k, label: v })) },
          ],
          exportExcel: true, exportPdf: true,
        }}
        filters={filters}
        onFilterChange={(k, v) => setFilters(prev => ({ ...prev, [k]: v }))}
        onClear={() => setFilters({ search: '', vendedor: '', sku: '', categoria: '', dateFrom: undefined, dateTo: undefined })}
        onExportExcel={handleExport}
        onExportPdf={handleExportPdf}
        hasActiveFilters={hasActiveFilters}
      />

      <div className="grid grid-cols-4 gap-4 mb-4">
        <div className="bg-card rounded-xl border p-4 text-center">
          <div className="text-xs text-muted-foreground">Ventas totales</div>
          <div className="text-xl font-bold text-primary">{fmt(totals.total)}</div>
        </div>
        <div className="bg-card rounded-xl border p-4 text-center">
          <div className="text-xs text-muted-foreground">Líneas</div>
          <div className="text-xl font-bold">{filtered.length}</div>
        </div>
        <div className="bg-card rounded-xl border p-4 text-center">
          <div className="text-xs text-muted-foreground">Unidades</div>
          <div className="text-xl font-bold">{totals.cantidad}</div>
        </div>
        <div className="bg-card rounded-xl border p-4 text-center">
          <div className="text-xs text-muted-foreground">Cotizaciones</div>
          <div className="text-xl font-bold">{totalCotizaciones}</div>
        </div>
      </div>

      <div className="bg-card rounded-xl border overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr><th>Fecha</th><th>Folio</th><th>Cliente</th><th>Vendedor</th><th>SKU</th><th>Producto</th><th>Cant.</th><th>Precio</th><th>Subtotal</th><th>IVA</th><th>Total</th></tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={11} className="text-center py-8 text-muted-foreground">Sin registros de ventas</td></tr>
            ) : filtered.map(r => (
              <tr key={r.id}>
                <td className="text-xs">{r.fecha}</td>
                <td className="text-xs font-medium">{r.folio}</td>
                <td className="text-xs">{r.cliente}</td>
                <td className="text-xs">{r.vendedor}</td>
                <td className="text-xs font-mono">{r.sku}</td>
                <td className="text-xs">{r.producto}</td>
                <td className="text-xs text-center">{r.cantidad}</td>
                <td className="text-xs">{fmt(r.precioVenta)}</td>
                <td className="text-xs">{fmt(r.subtotal)}</td>
                <td className="text-xs">{fmt(r.iva)}</td>
                <td className="text-xs font-bold">{fmt(r.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
