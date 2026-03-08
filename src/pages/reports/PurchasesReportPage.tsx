import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ReportFilterBar, { exportToExcel } from '@/components/shared/ReportFilterBar';
import { exportFullExcel, exportFullPdf } from '@/lib/fullReportExport';
import { demoImports, demoSuppliers } from '@/data/demo-data';
import { IMPORT_STATUS_LABELS } from '@/types';
import StatusBadge from '@/components/shared/StatusBadge';

const fmt = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);
const fmtUSD = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

export default function PurchasesReportPage() {
  const [filters, setFilters] = useState<Record<string, any>>({ search: '', proveedor: '' });

  const records = useMemo(() => {
    return demoImports.flatMap(imp =>
      imp.items.map((item, idx) => ({
        id: `${imp.id}-${idx}`,
        proveedor: imp.supplier,
        ordenNumero: imp.orderNumber,
        producto: item.productName,
        cantidad: item.qty,
        costoUnitario: item.unitCost,
        costoTotal: item.qty * item.unitCost,
        costoTotalMXN: imp.exchangeRate * item.qty * item.unitCost,
        status: imp.status,
        eta: imp.estimatedArrival,
        diasTransito: imp.daysInTransit,
        moneda: imp.currency,
        tipoCambio: imp.exchangeRate,
      }))
    );
  }, []);

  const filtered = useMemo(() => {
    return records.filter(r => {
      if (filters.search) {
        const s = filters.search.toLowerCase();
        if (!r.producto.toLowerCase().includes(s) && !r.ordenNumero.toLowerCase().includes(s)) return false;
      }
      if (filters.proveedor && r.proveedor !== filters.proveedor) return false;
      return true;
    });
  }, [records, filters]);

  const supplierSummary = useMemo(() => {
    const map: Record<string, { proveedor: string; totalUSD: number; totalMXN: number; items: number }> = {};
    filtered.forEach(r => {
      if (!map[r.proveedor]) map[r.proveedor] = { proveedor: r.proveedor, totalUSD: 0, totalMXN: 0, items: 0 };
      map[r.proveedor].totalUSD += r.costoTotal;
      map[r.proveedor].totalMXN += r.costoTotalMXN;
      map[r.proveedor].items += r.cantidad;
    });
    return Object.values(map).sort((a, b) => b.totalMXN - a.totalMXN);
  }, [filtered]);

  const totalUSD = filtered.reduce((s, r) => s + r.costoTotal, 0);
  const totalMXN = filtered.reduce((s, r) => s + r.costoTotalMXN, 0);
  const totalTransito = demoImports.reduce((s, i) => s + i.totalLanded * i.exchangeRate, 0);
  const hasActiveFilters = !!(filters.search || filters.proveedor);

  const supplierOptions = [...new Set(records.map(r => r.proveedor))].map(s => ({ value: s, label: s }));

  const handleExport = () => {
    const data = filtered.map(r => ({
      Proveedor: r.proveedor, 'No. Orden': r.ordenNumero, Producto: r.producto,
      Cantidad: r.cantidad, 'Costo unit. (USD)': r.costoUnitario, 'Costo total (USD)': r.costoTotal,
      'Costo total (MXN)': r.costoTotalMXN, Estatus: IMPORT_STATUS_LABELS[r.status] || r.status,
      'ETA': r.eta, 'Días tránsito': r.diasTransito,
    }));
    exportToExcel(data, `Compras_importaciones_${new Date().toISOString().split('T')[0]}`);
  };

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <Link to="/reportes-ejecutivos"><Button variant="ghost" size="sm"><ArrowLeft size={16} /></Button></Link>
          <div>
            <h1 className="page-title flex items-center gap-2"><Globe size={22} className="text-primary" /> Compras e Importaciones</h1>
            <p className="page-subtitle">Control de compras y logística</p>
          </div>
        </div>
      </div>

      <ReportFilterBar
        config={{
          search: true, searchPlaceholder: 'Buscar por producto o número de orden...',
          selects: [{ key: 'proveedor', label: 'Proveedor', options: supplierOptions }],
          exportExcel: true,
        }}
        filters={filters}
        onFilterChange={(k, v) => setFilters(prev => ({ ...prev, [k]: v }))}
        onClear={() => setFilters({ search: '', proveedor: '' })}
        onExportExcel={handleExport}
        hasActiveFilters={hasActiveFilters}
      />

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="bg-card rounded-xl border p-4 text-center">
          <div className="text-xs text-muted-foreground">Total compras (USD)</div>
          <div className="text-xl font-bold">{fmtUSD(totalUSD)}</div>
        </div>
        <div className="bg-card rounded-xl border p-4 text-center">
          <div className="text-xs text-muted-foreground">Total compras (MXN)</div>
          <div className="text-xl font-bold text-primary">{fmt(totalMXN)}</div>
        </div>
        <div className="bg-card rounded-xl border p-4 text-center">
          <div className="text-xs text-muted-foreground">Valor en tránsito</div>
          <div className="text-xl font-bold text-warning">{fmt(totalTransito)}</div>
        </div>
      </div>

      {/* Supplier summary */}
      <div className="bg-card rounded-xl border p-5 mb-6">
        <h3 className="font-display font-semibold mb-3">Compras por proveedor</h3>
        <div className="space-y-2">
          {supplierSummary.map(s => (
            <div key={s.proveedor} className="flex items-center justify-between text-sm p-2 rounded-lg bg-muted/30">
              <span className="font-medium">{s.proveedor}</span>
              <div className="flex gap-4 text-xs">
                <span>{s.items} uds</span>
                <span className="font-bold">{fmtUSD(s.totalUSD)}</span>
                <span className="font-bold text-primary">{fmt(s.totalMXN)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-card rounded-xl border overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr><th>Proveedor</th><th>No. Orden</th><th>Producto</th><th>Cant.</th><th>Costo USD</th><th>Total USD</th><th>Total MXN</th><th>Estatus</th><th>ETA</th></tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.id}>
                <td className="text-xs">{r.proveedor}</td>
                <td className="text-xs font-mono">{r.ordenNumero}</td>
                <td className="text-xs font-medium">{r.producto}</td>
                <td className="text-xs text-center">{r.cantidad}</td>
                <td className="text-xs">{fmtUSD(r.costoUnitario)}</td>
                <td className="text-xs font-bold">{fmtUSD(r.costoTotal)}</td>
                <td className="text-xs font-bold text-primary">{fmt(r.costoTotalMXN)}</td>
                <td><StatusBadge status={r.status} type="import" /></td>
                <td className="text-xs">{r.eta}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
