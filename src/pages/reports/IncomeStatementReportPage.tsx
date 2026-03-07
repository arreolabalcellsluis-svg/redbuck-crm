import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { exportToExcel } from '@/components/shared/ReportFilterBar';
import { exportToPdf } from '@/lib/pdfExport';
import { monthlySales, dashboardMetrics } from '@/data/demo-data';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const fmt = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);
const fmtPct = (n: number) => `${n.toFixed(1)}%`;

export default function IncomeStatementReportPage() {
  const data = useMemo(() => {
    return monthlySales.map(m => {
      const ventas = m.sales;
      const cogs = ventas * (1 - dashboardMetrics.grossMargin / 100);
      const utilidadBruta = ventas - cogs;
      const gastosOp = ventas * 0.18;
      const utilidadOp = utilidadBruta - gastosOp;
      const impuestos = utilidadOp * 0.30;
      const utilidadNeta = utilidadOp - impuestos;
      const margenNeto = ventas > 0 ? (utilidadNeta / ventas * 100) : 0;
      return {
        mes: m.month,
        ventas, cogs, utilidadBruta, gastosOp, utilidadOp, impuestos, utilidadNeta, margenNeto,
        margenBruto: ventas > 0 ? (utilidadBruta / ventas * 100) : 0,
      };
    });
  }, []);

  const totals = useMemo(() => {
    const t = data.reduce((acc, m) => ({
      ventas: acc.ventas + m.ventas,
      cogs: acc.cogs + m.cogs,
      utilidadBruta: acc.utilidadBruta + m.utilidadBruta,
      gastosOp: acc.gastosOp + m.gastosOp,
      utilidadOp: acc.utilidadOp + m.utilidadOp,
      impuestos: acc.impuestos + m.impuestos,
      utilidadNeta: acc.utilidadNeta + m.utilidadNeta,
    }), { ventas: 0, cogs: 0, utilidadBruta: 0, gastosOp: 0, utilidadOp: 0, impuestos: 0, utilidadNeta: 0 });
    return { ...t, margenNeto: t.ventas > 0 ? (t.utilidadNeta / t.ventas * 100) : 0, margenBruto: t.ventas > 0 ? (t.utilidadBruta / t.ventas * 100) : 0 };
  }, [data]);

  const chartData = data.map(d => ({
    name: d.mes,
    'Ventas': d.ventas,
    'Utilidad bruta': d.utilidadBruta,
    'Utilidad neta': d.utilidadNeta,
  }));

  const handleExportExcel = () => {
    const rows = data.map(d => ({
      Mes: d.mes, Ventas: d.ventas, 'COGS': d.cogs,
      'Utilidad bruta': d.utilidadBruta, 'Margen bruto %': d.margenBruto.toFixed(1),
      'Gastos operativos': d.gastosOp, 'Utilidad operativa': d.utilidadOp,
      'Impuestos': d.impuestos, 'Utilidad neta': d.utilidadNeta, 'Margen neto %': d.margenNeto.toFixed(1),
    }));
    exportToExcel(rows, `Estado_resultados_${new Date().toISOString().split('T')[0]}`);
  };

  const handleExportPdf = () => {
    exportToPdf({
      title: 'Estado de Resultados',
      subtitle: 'Últimos 6 meses — REDBUCK EQUIPMENT',
      filename: `Estado_resultados_${new Date().toISOString().split('T')[0]}`,
      headers: ['Mes', 'Ventas', 'COGS', 'Util. Bruta', 'Gastos Op.', 'Util. Op.', 'Impuestos', 'Util. Neta', 'Margen %'],
      rows: data.map(d => [d.mes, fmt(d.ventas), fmt(d.cogs), fmt(d.utilidadBruta), fmt(d.gastosOp), fmt(d.utilidadOp), fmt(d.impuestos), fmt(d.utilidadNeta), `${d.margenNeto.toFixed(1)}%`]),
      summary: [
        { label: 'Ventas totales', value: fmt(totals.ventas) },
        { label: 'Utilidad neta', value: fmt(totals.utilidadNeta) },
        { label: 'Margen neto', value: fmtPct(totals.margenNeto) },
        { label: 'Margen bruto', value: fmtPct(totals.margenBruto) },
      ],
    });
  };

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <Link to="/reportes-ejecutivos"><Button variant="ghost" size="sm"><ArrowLeft size={16} /></Button></Link>
          <div>
            <h1 className="page-title flex items-center gap-2"><TrendingUp size={22} className="text-success" /> Estado de Resultados</h1>
            <p className="page-subtitle">Reporte financiero — Últimos 6 meses</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="text-xs" onClick={handleExportExcel}>📊 Excel</Button>
          <Button variant="outline" size="sm" className="text-xs" onClick={handleExportPdf}>📄 PDF</Button>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-card rounded-xl border p-4 text-center border-l-4 border-l-primary">
          <div className="text-xs text-muted-foreground">Ventas totales</div>
          <div className="text-xl font-bold">{fmt(totals.ventas)}</div>
        </div>
        <div className="bg-card rounded-xl border p-4 text-center border-l-4 border-l-warning">
          <div className="text-xs text-muted-foreground">Utilidad bruta</div>
          <div className="text-xl font-bold">{fmt(totals.utilidadBruta)}</div>
          <div className="text-xs text-muted-foreground">{fmtPct(totals.margenBruto)}</div>
        </div>
        <div className="bg-card rounded-xl border p-4 text-center border-l-4 border-l-success">
          <div className="text-xs text-muted-foreground">Utilidad neta</div>
          <div className="text-xl font-bold text-success">{fmt(totals.utilidadNeta)}</div>
          <div className="text-xs text-muted-foreground">{fmtPct(totals.margenNeto)}</div>
        </div>
        <div className="bg-card rounded-xl border p-4 text-center border-l-4 border-l-destructive">
          <div className="text-xs text-muted-foreground">COGS</div>
          <div className="text-xl font-bold">{fmt(totals.cogs)}</div>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-card rounded-xl border p-5 mb-6">
        <h3 className="font-display font-semibold mb-4">Tendencia financiera</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
            <Tooltip formatter={(v: number) => fmt(v)} />
            <Legend />
            <Line type="monotone" dataKey="Ventas" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ fill: 'hsl(var(--primary))' }} />
            <Line type="monotone" dataKey="Utilidad bruta" stroke="hsl(var(--warning))" strokeWidth={2} dot={{ fill: 'hsl(var(--warning))' }} />
            <Line type="monotone" dataKey="Utilidad neta" stroke="hsl(var(--success))" strokeWidth={2} dot={{ fill: 'hsl(var(--success))' }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Income statement table */}
      <div className="bg-card rounded-xl border overflow-x-auto">
        <div className="p-4 border-b"><h3 className="font-display font-semibold">Estado de resultados detallado</h3></div>
        <table className="data-table">
          <thead>
            <tr><th>Concepto</th>{data.map(d => <th key={d.mes}>{d.mes}</th>)}<th className="font-bold">Total</th></tr>
          </thead>
          <tbody>
            <tr className="font-semibold">
              <td className="text-xs">Ventas</td>
              {data.map(d => <td key={d.mes} className="text-xs">{fmt(d.ventas)}</td>)}
              <td className="text-xs font-bold">{fmt(totals.ventas)}</td>
            </tr>
            <tr>
              <td className="text-xs text-muted-foreground">(-) Costo de ventas (COGS)</td>
              {data.map(d => <td key={d.mes} className="text-xs text-muted-foreground">{fmt(d.cogs)}</td>)}
              <td className="text-xs">{fmt(totals.cogs)}</td>
            </tr>
            <tr className="font-semibold bg-muted/30">
              <td className="text-xs">= Utilidad bruta</td>
              {data.map(d => <td key={d.mes} className="text-xs">{fmt(d.utilidadBruta)}</td>)}
              <td className="text-xs font-bold">{fmt(totals.utilidadBruta)}</td>
            </tr>
            <tr>
              <td className="text-xs text-muted-foreground pl-4">Margen bruto %</td>
              {data.map(d => <td key={d.mes} className="text-xs text-muted-foreground">{fmtPct(d.margenBruto)}</td>)}
              <td className="text-xs">{fmtPct(totals.margenBruto)}</td>
            </tr>
            <tr>
              <td className="text-xs text-muted-foreground">(-) Gastos operativos</td>
              {data.map(d => <td key={d.mes} className="text-xs text-muted-foreground">{fmt(d.gastosOp)}</td>)}
              <td className="text-xs">{fmt(totals.gastosOp)}</td>
            </tr>
            <tr className="font-semibold bg-muted/30">
              <td className="text-xs">= Utilidad operativa</td>
              {data.map(d => <td key={d.mes} className="text-xs">{fmt(d.utilidadOp)}</td>)}
              <td className="text-xs font-bold">{fmt(totals.utilidadOp)}</td>
            </tr>
            <tr>
              <td className="text-xs text-muted-foreground">(-) Impuestos (30%)</td>
              {data.map(d => <td key={d.mes} className="text-xs text-muted-foreground">{fmt(d.impuestos)}</td>)}
              <td className="text-xs">{fmt(totals.impuestos)}</td>
            </tr>
            <tr className="font-bold bg-success/5">
              <td className="text-xs text-success">= Utilidad neta</td>
              {data.map(d => <td key={d.mes} className="text-xs text-success font-bold">{fmt(d.utilidadNeta)}</td>)}
              <td className="text-xs text-success font-bold">{fmt(totals.utilidadNeta)}</td>
            </tr>
            <tr>
              <td className="text-xs text-muted-foreground pl-4">Margen neto %</td>
              {data.map(d => <td key={d.mes} className="text-xs text-muted-foreground">{fmtPct(d.margenNeto)}</td>)}
              <td className="text-xs font-bold">{fmtPct(totals.margenNeto)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
