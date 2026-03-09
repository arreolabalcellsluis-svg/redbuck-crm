import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ReportFilterBar, { exportToExcel } from '@/components/shared/ReportFilterBar';
import { exportFullExcel, exportFullPdf } from '@/lib/fullReportExport';
import { useReportData } from '@/hooks/usePlanningData';

const fmt = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);

export default function DistributorsReportPage() {
  const [filters, setFilters] = useState<Record<string, any>>({ search: '', estado: '', clasificacion: '' });
  const { customers, orders, receivables } = useReportData();

  const records = useMemo(() => {
    return customers.map(c => {
      const customerOrders = orders.filter(o => o.customerName === c.name);
      const ventasAcum = customerOrders.reduce((s, o) => s + o.total, 0);
      const numPedidos = customerOrders.length;
      const ticketProm = numPedidos > 0 ? ventasAcum / numPedidos : 0;
      const ar = receivables.filter(a => a.customer_name === c.name);
      const saldoPendiente = ar.reduce((s, a) => s + a.balance, 0);
      const productosMasComprados = customerOrders.flatMap(o => o.items.map(i => i.productName));
      const productCount: Record<string, number> = {};
      productosMasComprados.forEach(p => { productCount[p] = (productCount[p] || 0) + 1; });
      const topProducts = Object.entries(productCount).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([p]) => p);
      const isActive = numPedidos > 0;
      const hasOverdue = ar.some(a => a.days_overdue > 0);
      return {
        id: c.id, distribuidor: c.name, tipo: c.type, ciudad: c.city, estado: c.state,
        ventasAcum, numPedidos, ticketProm, saldoPendiente, topProducts: topProducts.join(', ') || 'N/A',
        activo: isActive, carteraVencida: hasOverdue,
      };
    }).sort((a, b) => b.ventasAcum - a.ventasAcum);
  }, [customers, orders, receivables]);

  const filtered = useMemo(() => {
    return records.filter(r => {
      if (filters.search) {
        const s = filters.search.toLowerCase();
        if (!r.distribuidor.toLowerCase().includes(s) && !r.ciudad.toLowerCase().includes(s)) return false;
      }
      if (filters.estado && r.estado !== filters.estado) return false;
      if (filters.clasificacion === 'activos' && !r.activo) return false;
      if (filters.clasificacion === 'inactivos' && r.activo) return false;
      if (filters.clasificacion === 'cartera_vencida' && !r.carteraVencida) return false;
      return true;
    });
  }, [records, filters]);

  const hasActiveFilters = !!(filters.search || filters.estado || filters.clasificacion);
  const stateOptions = [...new Set(records.map(r => r.estado).filter(Boolean))].map(s => ({ value: s, label: s }));

  const handleExport = () => {
    const dateStr = new Date().toISOString().split('T')[0];
    exportFullExcel({
      title: 'Distribuidores / Clientes', filename: `Distribuidores_${dateStr}`,
      kpis: [{ label: 'Total clientes', value: filtered.length }, { label: 'Activos', value: filtered.filter(r => r.activo).length, color: 'success' }, { label: 'Ventas totales', value: fmt(filtered.reduce((s, r) => s + r.ventasAcum, 0)), color: 'primary' }, { label: 'Saldo total', value: fmt(filtered.reduce((s, r) => s + r.saldoPendiente, 0)), color: 'warning' }],
      sections: [{ title: 'Ranking de clientes', headers: ['#', 'Distribuidor', 'Ciudad', 'Estado', 'Ventas', 'Pedidos', 'Ticket prom.', 'Saldo', 'Top productos', 'Estatus'], rows: filtered.map((r, i) => [i+1, r.distribuidor, r.ciudad, r.estado, fmt(r.ventasAcum), r.numPedidos, fmt(r.ticketProm), fmt(r.saldoPendiente), r.topProducts, r.carteraVencida ? 'Cartera vencida' : r.activo ? 'Activo' : 'Inactivo']) }],
    });
  };
  const handleExportPdf = () => {
    const dateStr = new Date().toISOString().split('T')[0];
    exportFullPdf({
      title: 'Distribuidores / Clientes', filename: `Distribuidores_${dateStr}`,
      kpis: [{ label: 'Total clientes', value: filtered.length }, { label: 'Activos', value: filtered.filter(r => r.activo).length, color: 'success' }, { label: 'Ventas totales', value: fmt(filtered.reduce((s, r) => s + r.ventasAcum, 0)), color: 'primary' }],
      sections: [{ title: 'Ranking', headers: ['#', 'Distribuidor', 'Ciudad', 'Ventas', 'Pedidos', 'Ticket', 'Saldo', 'Estatus'], rows: filtered.map((r, i) => [i+1, r.distribuidor, r.ciudad, fmt(r.ventasAcum), r.numPedidos, fmt(r.ticketProm), fmt(r.saldoPendiente), r.carteraVencida ? 'Vencida' : r.activo ? 'Activo' : 'Inactivo']) }],
    });
  };

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <Link to="/reportes-ejecutivos"><Button variant="ghost" size="sm"><ArrowLeft size={16} /></Button></Link>
          <div><h1 className="page-title flex items-center gap-2"><Building2 size={22} className="text-primary" /> Reporte de Distribuidores</h1><p className="page-subtitle">Ranking y análisis de clientes/distribuidores</p></div>
        </div>
      </div>
      <div className="flex gap-2 mb-4">
        {[['', 'Todos'], ['activos', 'Activos'], ['inactivos', 'Inactivos'], ['cartera_vencida', 'Con cartera vencida']].map(([k, l]) => (
          <Button key={k} variant={filters.clasificacion === k ? 'default' : 'outline'} size="sm" className="text-xs" onClick={() => setFilters(prev => ({ ...prev, clasificacion: k }))}>{l}</Button>
        ))}
      </div>
      <ReportFilterBar config={{ search: true, searchPlaceholder: 'Buscar por nombre o ciudad...', selects: [{ key: 'estado', label: 'Estado', options: stateOptions }], exportExcel: true, exportPdf: true }} filters={filters} onFilterChange={(k, v) => setFilters(prev => ({ ...prev, [k]: v }))} onClear={() => setFilters({ search: '', estado: '', clasificacion: '' })} onExportExcel={handleExport} onExportPdf={handleExportPdf} hasActiveFilters={hasActiveFilters} />
      <div className="grid grid-cols-4 gap-4 mb-4">
        <div className="bg-card rounded-xl border p-4 text-center"><div className="text-xs text-muted-foreground">Total clientes</div><div className="text-xl font-bold">{filtered.length}</div></div>
        <div className="bg-card rounded-xl border p-4 text-center"><div className="text-xs text-muted-foreground">Activos</div><div className="text-xl font-bold text-success">{filtered.filter(r => r.activo).length}</div></div>
        <div className="bg-card rounded-xl border p-4 text-center"><div className="text-xs text-muted-foreground">Ventas totales</div><div className="text-xl font-bold text-primary">{fmt(filtered.reduce((s, r) => s + r.ventasAcum, 0))}</div></div>
        <div className="bg-card rounded-xl border p-4 text-center"><div className="text-xs text-muted-foreground">Saldo total</div><div className="text-xl font-bold text-warning">{fmt(filtered.reduce((s, r) => s + r.saldoPendiente, 0))}</div></div>
      </div>
      <div className="bg-card rounded-xl border overflow-x-auto">
        <table className="data-table"><thead><tr><th>#</th><th>Distribuidor</th><th>Ciudad</th><th>Estado</th><th>Ventas</th><th>Pedidos</th><th>Ticket prom.</th><th>Saldo</th><th>Top productos</th><th>Estado</th></tr></thead>
          <tbody>{filtered.length === 0 ? (<tr><td colSpan={10} className="text-center py-8 text-muted-foreground">Sin clientes registrados</td></tr>) : filtered.map((r, i) => (
            <tr key={r.id}><td className="text-xs font-bold text-muted-foreground">{i + 1}</td><td className="text-xs font-medium">{r.distribuidor}</td><td className="text-xs">{r.ciudad}</td><td className="text-xs">{r.estado}</td><td className="text-xs font-bold">{fmt(r.ventasAcum)}</td><td className="text-xs text-center">{r.numPedidos}</td><td className="text-xs">{fmt(r.ticketProm)}</td><td className="text-xs">{r.saldoPendiente > 0 ? <span className="text-warning font-bold">{fmt(r.saldoPendiente)}</span> : <span className="text-success">$0</span>}</td><td className="text-xs text-muted-foreground max-w-[200px] truncate">{r.topProducts}</td><td>{r.carteraVencida ? <span className="text-xs px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">Cartera vencida</span> : r.activo ? <span className="text-xs px-2 py-0.5 rounded-full bg-success/10 text-success">Activo</span> : <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Inactivo</span>}</td></tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}
