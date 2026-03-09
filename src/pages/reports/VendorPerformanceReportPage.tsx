import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Users, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ReportFilterBar, { exportToExcel } from '@/components/shared/ReportFilterBar';
import { exportFullExcel, exportFullPdf } from '@/lib/fullReportExport';
import { useReportData } from '@/hooks/usePlanningData';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const fmt = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);

export default function VendorPerformanceReportPage() {
  const [filters, setFilters] = useState<Record<string, any>>({ dateFrom: undefined, dateTo: undefined });
  const { orders, quotations, team } = useReportData();

  const records = useMemo(() => {
    const vendorMembers = team.filter(u => u.role === 'vendedor');
    if (vendorMembers.length === 0) {
      // Derive vendors from orders
      const vendorMap: Record<string, { name: string; sales: number; orders: number; products: number }> = {};
      orders.forEach(o => {
        if (!o.vendorName) return;
        if (!vendorMap[o.vendorName]) vendorMap[o.vendorName] = { name: o.vendorName, sales: 0, orders: 0, products: 0 };
        vendorMap[o.vendorName].sales += o.total;
        vendorMap[o.vendorName].orders++;
        vendorMap[o.vendorName].products += o.items.reduce((s, i) => s + i.qty, 0);
      });
      return Object.values(vendorMap).map(v => ({
        id: v.name, vendedor: v.name, email: '', ventasTotales: v.sales, numVentas: v.orders,
        ticketProm: v.orders > 0 ? v.sales / v.orders : 0, productosVendidos: v.products,
        cotizacionesEnviadas: quotations.filter(q => q.vendorName === v.name).length,
        cotizacionesAceptadas: quotations.filter(q => q.vendorName === v.name && q.status === 'aceptada').length,
        conversion: 0, meta: 300000, cumplimiento: 0, comision: 5, comisionGenerada: 0,
      })).map(r => ({ ...r, conversion: r.cotizacionesEnviadas > 0 ? (r.cotizacionesAceptadas / r.cotizacionesEnviadas * 100) : 0, cumplimiento: r.meta > 0 ? (r.ventasTotales / r.meta * 100) : 0, comisionGenerada: r.ventasTotales * 0.05 })).sort((a, b) => b.ventasTotales - a.ventasTotales);
    }
    return vendorMembers.map(user => {
      const vendorOrders = orders.filter(o => o.vendorName.includes(user.name.split(' ')[0]));
      const vendorQuotes = quotations.filter(q => q.vendorId === user.id);
      const ventasTotales = vendorOrders.reduce((s, o) => s + o.total, 0);
      const numVentas = vendorOrders.length;
      const ticketProm = numVentas > 0 ? ventasTotales / numVentas : 0;
      const productosVendidos = vendorOrders.reduce((s, o) => s + o.items.reduce((ss, i) => ss + i.qty, 0), 0);
      const quotesEnviadas = vendorQuotes.length;
      const quotesAceptadas = vendorQuotes.filter(q => q.status === 'aceptada').length;
      const conversion = quotesEnviadas > 0 ? (quotesAceptadas / quotesEnviadas * 100) : 0;
      const meta = 300000;
      const cumplimiento = meta > 0 ? (ventasTotales / meta * 100) : 0;
      const commRate = user.commission_rate || 5;
      return {
        id: user.id, vendedor: user.name, email: user.email, ventasTotales, numVentas, ticketProm,
        productosVendidos, cotizacionesEnviadas: quotesEnviadas, cotizacionesAceptadas: quotesAceptadas,
        conversion, meta, cumplimiento, comision: commRate, comisionGenerada: ventasTotales * (commRate / 100),
      };
    }).sort((a, b) => b.ventasTotales - a.ventasTotales);
  }, [orders, quotations, team]);

  const chartData = records.map(r => ({ name: r.vendedor.split(' ')[0], ventas: r.ventasTotales, meta: r.meta }));

  const handleExportExcel = () => {
    const dateStr = new Date().toISOString().split('T')[0];
    const totalVentas = records.reduce((s, r) => s + r.ventasTotales, 0);
    exportFullExcel({
      title: 'Desempeño de Vendedores', filename: `Desempeno_vendedores_${dateStr}`,
      kpis: [{ label: 'Total ventas equipo', value: fmt(totalVentas), color: 'primary' }, { label: 'Vendedores', value: records.length }],
      sections: [{ title: 'Ranking completo', headers: ['#', 'Vendedor', 'Ventas', '# Ventas', 'Ticket prom.', 'Conv. %', 'Cumpl. %', 'Comisión'], rows: records.map((r, i) => [i+1, r.vendedor, fmt(r.ventasTotales), r.numVentas, fmt(r.ticketProm), `${r.conversion.toFixed(0)}%`, `${r.cumplimiento.toFixed(0)}%`, fmt(r.comisionGenerada)]) }],
    });
  };

  const handleExportPdf = () => {
    const dateStr = new Date().toISOString().split('T')[0];
    exportFullPdf({
      title: 'Desempeño de Vendedores', filename: `Desempeno_vendedores_${dateStr}`,
      kpis: [{ label: 'Total ventas equipo', value: fmt(records.reduce((s, r) => s + r.ventasTotales, 0)), color: 'primary' }, { label: 'Vendedores', value: records.length }],
      sections: [{ title: 'Ranking', headers: ['#', 'Vendedor', 'Ventas', '# Ventas', 'Ticket', 'Conv. %', 'Cumpl. %', 'Comisión'], rows: records.map((r, i) => [i+1, r.vendedor, fmt(r.ventasTotales), r.numVentas, fmt(r.ticketProm), `${r.conversion.toFixed(0)}%`, `${r.cumplimiento.toFixed(0)}%`, fmt(r.comisionGenerada)]) }],
    });
  };

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <Link to="/reportes-ejecutivos"><Button variant="ghost" size="sm"><ArrowLeft size={16} /></Button></Link>
          <div><h1 className="page-title flex items-center gap-2"><Trophy size={22} className="text-warning" /> Desempeño de Vendedores</h1><p className="page-subtitle">Análisis y ranking del equipo comercial</p></div>
        </div>
      </div>
      <ReportFilterBar config={{ dateRange: true, exportExcel: true, exportPdf: true }} filters={filters} onFilterChange={(k, v) => setFilters(prev => ({ ...prev, [k]: v }))} onClear={() => setFilters({ dateFrom: undefined, dateTo: undefined })} onExportExcel={handleExportExcel} onExportPdf={handleExportPdf} hasActiveFilters={!!(filters.dateFrom || filters.dateTo)} />
      {chartData.length > 0 && (
        <div className="bg-card rounded-xl border p-5 mb-6">
          <h3 className="font-display font-semibold mb-4">Ventas vs Meta por vendedor</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" /><XAxis dataKey="name" tick={{ fontSize: 12 }} /><YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} /><Tooltip formatter={(v: number) => fmt(v)} /><Bar dataKey="ventas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Ventas" /><Bar dataKey="meta" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} name="Meta" opacity={0.3} /></BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className="bg-card rounded-xl border overflow-x-auto">
        <div className="p-4 border-b"><h3 className="font-display font-semibold">Ranking de vendedores</h3></div>
        <table className="data-table"><thead><tr><th>#</th><th>Vendedor</th><th>Ventas</th><th># Ventas</th><th>Ticket prom.</th><th>Cot. enviadas</th><th>Conv. %</th><th>Meta</th><th>Cumpl. %</th><th>Comisión</th></tr></thead>
          <tbody>{records.length === 0 ? (<tr><td colSpan={10} className="text-center py-8 text-muted-foreground">Sin datos de vendedores</td></tr>) : records.map((r, i) => (
            <tr key={r.id}><td className="text-xs">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : <span className="font-bold text-muted-foreground">{i + 1}</span>}</td><td className="text-xs font-medium">{r.vendedor}</td><td className="text-xs font-bold text-primary">{fmt(r.ventasTotales)}</td><td className="text-xs text-center">{r.numVentas}</td><td className="text-xs">{fmt(r.ticketProm)}</td><td className="text-xs text-center">{r.cotizacionesEnviadas}</td><td className="text-xs"><span className={`font-bold ${r.conversion >= 50 ? 'text-success' : r.conversion >= 25 ? 'text-warning' : 'text-destructive'}`}>{r.conversion.toFixed(0)}%</span></td><td className="text-xs text-muted-foreground">{fmt(r.meta)}</td><td className="text-xs"><div className="flex items-center gap-2"><div className="w-16 bg-muted rounded-full h-1.5"><div className={`h-1.5 rounded-full ${r.cumplimiento >= 100 ? 'bg-success' : r.cumplimiento >= 70 ? 'bg-warning' : 'bg-destructive'}`} style={{ width: `${Math.min(r.cumplimiento, 100)}%` }} /></div><span className="font-bold text-xs">{r.cumplimiento.toFixed(0)}%</span></div></td><td className="text-xs font-bold text-success">{fmt(r.comisionGenerada)}</td></tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}
