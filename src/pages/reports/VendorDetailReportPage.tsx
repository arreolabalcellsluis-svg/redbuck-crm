import { useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ReportFilterBar, { exportToExcel } from '@/components/shared/ReportFilterBar';
import { demoOrders, demoProducts, salesByVendor } from '@/data/demo-data';
import { useAppContext } from '@/contexts/AppContext';
import { DEMO_VENDEDOR_NAME } from '@/lib/rolePermissions';
import { CATEGORY_LABELS } from '@/types';

const fmt = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);

export default function VendorDetailReportPage() {
  const [searchParams] = useSearchParams();
  const vendorParam = searchParams.get('nombre') || '';

  const [filters, setFilters] = useState<Record<string, any>>({
    search: '',
    vendedor: vendorParam,
    dateFrom: undefined,
    dateTo: undefined,
  });

  const vendorOptions = salesByVendor.map(v => ({ value: v.name, label: v.name }));

  const records = useMemo(() => {
    return demoOrders.flatMap(o =>
      o.items.map((item, idx) => {
        const product = demoProducts.find(p => p.name === item.productName || item.productName.includes(p.name.split(' ')[0]));
        return {
          id: `${o.id}-${idx}`,
          fecha: o.createdAt,
          folio: o.folio,
          cliente: o.customerName,
          vendedor: o.vendorName,
          sku: product?.sku || 'N/A',
          producto: item.productName,
          cantidad: item.qty,
          precio: item.unitPrice,
          total: item.qty * item.unitPrice,
          canal: 'Directo',
        };
      })
    );
  }, []);

  const filtered = useMemo(() => {
    return records.filter(r => {
      if (filters.vendedor && !r.vendedor.includes(filters.vendedor)) return false;
      if (filters.search) {
        const s = filters.search.toLowerCase();
        if (!r.cliente.toLowerCase().includes(s) && !r.producto.toLowerCase().includes(s) && !r.sku.toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [records, filters]);

  const vendorName = filters.vendedor || 'Todos';

  // Summary by vendor
  const summary = useMemo(() => {
    const totalSales = filtered.reduce((s, r) => s + r.total, 0);
    const numSales = filtered.length;
    const ticketProm = numSales > 0 ? totalSales / numSales : 0;
    const uniqueClients = [...new Set(filtered.map(r => r.cliente))];
    const byClient = uniqueClients.map(c => ({
      cliente: c,
      total: filtered.filter(r => r.cliente === c).reduce((s, r) => s + r.total, 0),
      ventas: filtered.filter(r => r.cliente === c).length,
    })).sort((a, b) => b.total - a.total);

    const bySku = [...new Set(filtered.map(r => r.sku))].map(sku => ({
      sku,
      producto: filtered.find(r => r.sku === sku)?.producto || '',
      unidades: filtered.filter(r => r.sku === sku).reduce((s, r) => s + r.cantidad, 0),
      total: filtered.filter(r => r.sku === sku).reduce((s, r) => s + r.total, 0),
    })).sort((a, b) => b.total - a.total);

    return { totalSales, numSales, ticketProm, byClient, bySku };
  }, [filtered]);

  const hasActiveFilters = !!(filters.search || filters.vendedor || filters.dateFrom || filters.dateTo);

  const handleExport = () => {
    const data = filtered.map(r => ({
      Fecha: r.fecha, Folio: r.folio, Cliente: r.cliente, Vendedor: r.vendedor,
      SKU: r.sku, Producto: r.producto, Cantidad: r.cantidad, Precio: r.precio, Total: r.total, Canal: r.canal,
    }));
    const vendorSlug = vendorName.replace(/\s+/g, '_');
    const dateStr = new Date().toISOString().split('T')[0];
    exportToExcel(data, `Ventas_vendedor_${vendorSlug}_${dateStr}`);
  };

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <Link to={-1 as any}><Button variant="ghost" size="sm"><ArrowLeft size={16} /></Button></Link>
          <div>
            <h1 className="page-title flex items-center gap-2"><Users size={22} className="text-primary" /> Detalle Vendedor: {vendorName}</h1>
            <p className="page-subtitle">Qué vendió, a quién y cuánto</p>
          </div>
        </div>
      </div>

      <ReportFilterBar
        config={{
          search: true, searchPlaceholder: 'Buscar por cliente, SKU, producto...',
          dateRange: true,
          selects: [{ key: 'vendedor', label: 'Vendedor', options: vendorOptions }],
          exportExcel: true,
        }}
        filters={filters}
        onFilterChange={(k, v) => setFilters(prev => ({ ...prev, [k]: v }))}
        onClear={() => setFilters({ search: '', vendedor: '', dateFrom: undefined, dateTo: undefined })}
        onExportExcel={handleExport}
        hasActiveFilters={hasActiveFilters}
      />

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-card rounded-xl border p-4 text-center">
          <div className="text-xs text-muted-foreground">Ventas totales</div>
          <div className="text-xl font-bold text-primary">{fmt(summary.totalSales)}</div>
        </div>
        <div className="bg-card rounded-xl border p-4 text-center">
          <div className="text-xs text-muted-foreground"># Ventas</div>
          <div className="text-xl font-bold">{summary.numSales}</div>
        </div>
        <div className="bg-card rounded-xl border p-4 text-center">
          <div className="text-xs text-muted-foreground">Ticket promedio</div>
          <div className="text-xl font-bold">{fmt(summary.ticketProm)}</div>
        </div>
        <div className="bg-card rounded-xl border p-4 text-center">
          <div className="text-xs text-muted-foreground">Clientes atendidos</div>
          <div className="text-xl font-bold">{summary.byClient.length}</div>
        </div>
      </div>

      {/* By client & by SKU */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-card rounded-xl border p-5">
          <h3 className="font-display font-semibold mb-3">Ventas por cliente</h3>
          <div className="space-y-2">
            {summary.byClient.map(c => (
              <div key={c.cliente} className="flex items-center justify-between text-sm">
                <span>{c.cliente}</span>
                <span className="font-bold">{fmt(c.total)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-card rounded-xl border p-5">
          <h3 className="font-display font-semibold mb-3">Ventas por SKU</h3>
          <div className="space-y-2">
            {summary.bySku.map(s => (
              <div key={s.sku} className="flex items-center justify-between text-sm">
                <div>
                  <span className="font-mono text-xs text-muted-foreground mr-2">{s.sku}</span>
                  <span>{s.producto}</span>
                </div>
                <span className="font-bold">{fmt(s.total)} <span className="text-xs text-muted-foreground">({s.unidades}u)</span></span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Detail table */}
      <div className="bg-card rounded-xl border overflow-x-auto">
        <div className="p-4 border-b"><h3 className="font-display font-semibold">Detalle transaccional</h3></div>
        <table className="data-table">
          <thead>
            <tr><th>Fecha</th><th>Folio</th><th>Cliente</th><th>SKU</th><th>Producto</th><th>Cant.</th><th>Precio</th><th>Total</th><th>Canal</th></tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.id}>
                <td className="text-xs">{r.fecha}</td>
                <td className="text-xs font-medium">{r.folio}</td>
                <td className="text-xs">{r.cliente}</td>
                <td className="text-xs font-mono">{r.sku}</td>
                <td className="text-xs">{r.producto}</td>
                <td className="text-xs text-center">{r.cantidad}</td>
                <td className="text-xs">{fmt(r.precio)}</td>
                <td className="text-xs font-bold">{fmt(r.total)}</td>
                <td className="text-xs">{r.canal}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
