import { useState, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ReportFilterBar from '@/components/shared/ReportFilterBar';
import { exportFullExcel, exportFullPdf } from '@/lib/fullReportExport';
import { useOrders } from '@/hooks/useOrders';
import { useQuotations } from '@/hooks/useQuotations';
import { useProducts } from '@/hooks/useProducts';
import { useAppContext } from '@/contexts/AppContext';
import { CATEGORY_LABELS } from '@/types';

const fmt = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);

export default function SalesReportPage() {
  const { currentRole } = useAppContext();
  const isVendedor = currentRole === 'vendedor';
  const [searchParams] = useSearchParams();
  const vendorFilter = searchParams.get('vendedor') || '';
  const skuFilter = searchParams.get('sku') || '';

  const { data: dbOrders = [] } = useOrders();
  const { data: dbQuotations = [] } = useQuotations();
  const { data: dbProducts = [] } = useProducts();

  const [filters, setFilters] = useState<Record<string, any>>({
    search: '',
    vendedor: vendorFilter,
    sku: skuFilter,
    categoria: '',
    dateFrom: undefined,
    dateTo: undefined,
  });

  // Generate sales records from real orders
  const records = useMemo(() => {
    const productMap = new Map(dbProducts.map(p => [p.name, p]));
    return dbOrders.flatMap(o =>
      (o.items || []).map((item: any, idx: number) => {
        const product = productMap.get(item.productName);
        const subtotal = (item.qty || 0) * (item.unitPrice || 0);
        const iva = subtotal * 0.16;
        return {
          id: `${o.id}-${idx}`,
          fecha: o.created_at?.split('T')[0] || '',
          folio: o.folio,
          cliente: o.customer_name,
          vendedor: o.vendor_name,
          sku: product?.sku || 'N/A',
          producto: item.productName || '',
          categoria: product?.category || 'otros',
          cantidad: item.qty || 0,
          precioVenta: item.unitPrice || 0,
          subtotal,
          iva,
          total: subtotal + iva,
          canal: 'Directo',
          estatus: o.status,
        };
      })
    );
  }, [dbOrders, dbProducts]);

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

  const totalCotizaciones = useMemo(() => {
    return dbQuotations.filter(q => {
      if (filters.search) {
        const s = filters.search.toLowerCase();
        if (!q.customer_name.toLowerCase().includes(s) && !q.folio.toLowerCase().includes(s)) return false;
      }
      if (filters.vendedor && !q.vendor_name.includes(filters.vendedor)) return false;
      if (filters.dateFrom && new Date(q.created_at) < new Date(filters.dateFrom)) return false;
      if (filters.dateTo && new Date(q.created_at) > new Date(filters.dateTo)) return false;
      return true;
    }).length;
  }, [dbQuotations, filters]);

  const totalPedidos = useMemo(() => {
    return dbOrders.filter(o => {
      if (filters.search) {
        const s = filters.search.toLowerCase();
        if (!o.customer_name.toLowerCase().includes(s) && !o.folio.toLowerCase().includes(s)) return false;
      }
      if (filters.vendedor && !o.vendor_name.includes(filters.vendedor)) return false;
      if (filters.dateFrom && new Date(o.created_at) < new Date(filters.dateFrom)) return false;
      if (filters.dateTo && new Date(o.created_at) > new Date(filters.dateTo)) return false;
      return true;
    }).length;
  }, [dbOrders, filters]);

  const hasActiveFilters = !!(filters.search || filters.vendedor || filters.sku || filters.categoria || filters.dateFrom || filters.dateTo);

  const vendorOptions = [...new Set(records.map(r => r.vendedor))].filter(Boolean).map(v => ({ value: v, label: v }));
  const skuOptions = [...new Set(records.map(r => r.sku))].filter(s => s !== 'N/A').map(s => ({ value: s, label: s }));
  const catOptions = Object.entries(CATEGORY_LABELS).map(([k, v]) => ({ value: k, label: v }));

  const handleExport = () => {
    const dateStr = new Date().toISOString().split('T')[0];
    exportFullExcel({
      title: 'Reporte de Ventas',
      subtitle: `Generado: ${dateStr}`,
      filename: `Ventas_${dateStr}`,
      kpis: [
        { label: 'Cotizaciones', value: totalCotizaciones },
        { label: 'Pedidos', value: totalPedidos },
        { label: 'Subtotal', value: fmt(totals.subtotal) },
        { label: 'Total c/IVA', value: fmt(totals.total), color: 'primary' },
      ],
      sections: [{
        title: 'Detalle transaccional',
        headers: ['Fecha', 'Folio', 'Cliente', 'Vendedor', 'SKU', 'Producto', 'Cant.', 'P. Venta', 'Subtotal', 'IVA', 'Total', 'Canal', 'Estatus'],
        rows: filtered.map(r => [r.fecha, r.folio, r.cliente, r.vendedor, r.sku, r.producto, r.cantidad, fmt(r.precioVenta), fmt(r.subtotal), fmt(r.iva), fmt(r.total), r.canal, r.estatus]),
        totalsRow: ['TOTAL', '', '', '', '', '', totals.cantidad, '', fmt(totals.subtotal), fmt(totals.iva), fmt(totals.total), '', ''],
      }],
    });
  };

  const handleExportPdf = () => {
    const dateStr = new Date().toISOString().split('T')[0];
    exportFullPdf({
      title: 'Reporte de Ventas',
      subtitle: `Generado: ${dateStr}`,
      filename: `Ventas_${dateStr}`,
      kpis: [
        { label: 'Cotizaciones', value: totalCotizaciones },
        { label: 'Pedidos', value: totalPedidos },
        { label: 'Subtotal', value: fmt(totals.subtotal) },
        { label: 'Total c/IVA', value: fmt(totals.total), color: 'primary' },
      ],
      sections: [{
        title: 'Detalle transaccional',
        headers: ['Fecha', 'Folio', 'Cliente', 'Vendedor', 'SKU', 'Producto', 'Cant.', 'P. Venta', 'Subtotal', 'IVA', 'Total', 'Canal', 'Estatus'],
        rows: filtered.map(r => [r.fecha, r.folio, r.cliente, r.vendedor, r.sku, r.producto, r.cantidad, fmt(r.precioVenta), fmt(r.subtotal), fmt(r.iva), fmt(r.total), r.canal, r.estatus]),
        totalsRow: ['TOTAL', '', '', '', '', '', totals.cantidad, '', fmt(totals.subtotal), fmt(totals.iva), fmt(totals.total), '', ''],
      }],
    });
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
          exportPdf: true,
        }}
        filters={filters}
        onFilterChange={(k, v) => setFilters(prev => ({ ...prev, [k]: v }))}
        onClear={() => setFilters({ search: '', vendedor: '', sku: '', categoria: '', dateFrom: undefined, dateTo: undefined })}
        onExportExcel={handleExport}
        onExportPdf={handleExportPdf}
        hasActiveFilters={hasActiveFilters}
      />

      {/* Summary */}
      <div className="grid grid-cols-4 gap-4 mb-4">
        <div className="bg-card rounded-xl border p-4 text-center">
          <div className="text-xs text-muted-foreground">Cotizaciones</div>
          <div className="text-xl font-bold">{totalCotizaciones}</div>
        </div>
        <div className="bg-card rounded-xl border p-4 text-center">
          <div className="text-xs text-muted-foreground">Pedidos</div>
          <div className="text-xl font-bold">{totalPedidos}</div>
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
