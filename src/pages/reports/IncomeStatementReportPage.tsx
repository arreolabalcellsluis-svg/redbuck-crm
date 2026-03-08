import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, TrendingUp, CalendarIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { exportToExcel } from '@/components/shared/ReportFilterBar';
import { exportToPdf } from '@/lib/pdfExport';
import { monthlySales, dashboardMetrics } from '@/data/demo-data';
import { demoExpenses } from '@/lib/operatingExpensesEngine';
import { useExpenses } from '@/hooks/useExpenses';
import { useAssets, getTotalMonthlyDepAmort } from '@/hooks/useAssets';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const fmt = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);
const fmtPct = (n: number) => `${n.toFixed(1)}%`;
const safePct = (num: number, den: number) => den !== 0 ? (num / den) * 100 : 0;

// Fallback demo assets for depreciation
const fallbackAssets = [
  { id:'a1', nombre:'Camioneta Nissan NP300', categoria:'vehiculos' as const, tipo:'depreciacion' as const, descripcion:'', fechaCompra:'2023-06-15', costoAdquisicion:420000, vidaUtilMeses:60, valorRescate:120000, estatus:'activo' as const },
  { id:'a2', nombre:'Camioneta RAM 700', categoria:'vehiculos' as const, tipo:'depreciacion' as const, descripcion:'', fechaCompra:'2024-01-10', costoAdquisicion:350000, vidaUtilMeses:60, valorRescate:100000, estatus:'activo' as const },
  { id:'a3', nombre:'Montacargas Yale', categoria:'maquinaria' as const, tipo:'depreciacion' as const, descripcion:'', fechaCompra:'2022-03-01', costoAdquisicion:280000, vidaUtilMeses:120, valorRescate:40000, estatus:'activo' as const },
  { id:'a4', nombre:'MacBook Pro', categoria:'computadoras' as const, tipo:'depreciacion' as const, descripcion:'', fechaCompra:'2024-06-01', costoAdquisicion:65000, vidaUtilMeses:36, valorRescate:15000, estatus:'activo' as const },
  { id:'a5', nombre:'Licencia ERP', categoria:'software' as const, tipo:'amortizacion' as const, descripcion:'', fechaCompra:'2025-01-01', costoAdquisicion:48000, vidaUtilMeses:12, valorRescate:0, estatus:'activo' as const },
  { id:'a6', nombre:'Escritorios', categoria:'mobiliario' as const, tipo:'depreciacion' as const, descripcion:'', fechaCompra:'2023-01-15', costoAdquisicion:35000, vidaUtilMeses:120, valorRescate:5000, estatus:'activo' as const },
];

function parseMonthLabel(label: string): Date {
  const monthMap: Record<string, string> = {
    'Ene':'01','Feb':'02','Mar':'03','Abr':'04','May':'05','Jun':'06',
    'Jul':'07','Ago':'08','Sep':'09','Oct':'10','Nov':'11','Dic':'12',
  };
  const [mon, yr] = label.split(' ');
  const fullYear = Number(yr) < 100 ? 2000 + Number(yr) : Number(yr);
  return new Date(fullYear, Number(monthMap[mon] || '01') - 1, 1);
}

const PRESETS = [
  { label: 'Último trimestre', getRange: () => { const now = new Date(); return { from: new Date(now.getFullYear(), now.getMonth() - 3, 1), to: endOfMonth(new Date(now.getFullYear(), now.getMonth() - 1, 1)) }; } },
  { label: 'Último semestre', getRange: () => { const now = new Date(); return { from: new Date(now.getFullYear(), now.getMonth() - 6, 1), to: endOfMonth(new Date(now.getFullYear(), now.getMonth() - 1, 1)) }; } },
  { label: 'Año 2024', getRange: () => ({ from: new Date(2024, 0, 1), to: new Date(2024, 11, 31) }) },
  { label: 'Año 2025', getRange: () => ({ from: new Date(2025, 0, 1), to: new Date(2025, 11, 31) }) },
  { label: 'Todo', getRange: () => ({ from: new Date(2024, 0, 1), to: new Date(2025, 11, 31) }) },
];

export default function IncomeStatementReportPage() {
  const [dateFrom, setDateFrom] = useState<Date>(new Date(2024, 0, 1));
  const [dateTo, setDateTo] = useState<Date>(new Date(2025, 2, 31));

  // Fetch real data from DB
  const { data: dbExpenses, isLoading: loadingExpenses } = useExpenses();
  const { data: dbAssets, isLoading: loadingAssets } = useAssets();

  const expenses = dbExpenses && dbExpenses.length > 0 ? dbExpenses : demoExpenses;
  const assets = dbAssets && dbAssets.length > 0 ? dbAssets : fallbackAssets;

  const isDbConnected = (dbExpenses && dbExpenses.length > 0) || (dbAssets && dbAssets.length > 0);

  // Classify expenses
  const gastosVentas = useMemo(() =>
    expenses.filter(e => e.categoria === 'ventas').reduce((s, e) => s + e.monto, 0), [expenses]);
  const gastosFinancieros = useMemo(() =>
    expenses.filter(e => e.categoria === 'financieros').reduce((s, e) => s + e.monto, 0), [expenses]);
  const totalExpensesMensual = useMemo(() =>
    expenses.reduce((s, e) => s + e.monto, 0), [expenses]);
  const gastosGeneralesAdmin = useMemo(() =>
    totalExpensesMensual - gastosVentas - gastosFinancieros, [totalExpensesMensual, gastosVentas, gastosFinancieros]);

  const depAmortMensual = useMemo(() => getTotalMonthlyDepAmort(assets), [assets]);

  const data = useMemo(() => {
    return monthlySales
      .filter(m => {
        const d = parseMonthLabel(m.month);
        return d >= startOfMonth(dateFrom) && d <= endOfMonth(dateTo);
      })
      .map(m => {
        const ventas = m.sales;
        const cogs = ventas * (1 - dashboardMetrics.grossMargin / 100);
        const utilidadBruta = ventas - cogs;
        const weight = ventas / (dashboardMetrics.salesMonth || 1);
        const gVentas = gastosVentas * weight;
        const gAdmin = gastosGeneralesAdmin * weight;
        const ebitda = utilidadBruta - gVentas - gAdmin;
        const depAmort = depAmortMensual * weight;
        const ebit = ebitda - depAmort;
        const intereses = gastosFinancieros * weight;
        const utilidadAntesImpuestos = ebit - intereses;
        const impuestos = Math.max(0, utilidadAntesImpuestos * 0.30);
        const utilidadNeta = utilidadAntesImpuestos - impuestos;
        return {
          mes: m.month, ventas, cogs, utilidadBruta,
          gVentas, gAdmin, ebitda, depAmort, ebit,
          intereses, utilidadAntesImpuestos, impuestos, utilidadNeta,
          margenBruto: safePct(utilidadBruta, ventas),
          margenEbitda: safePct(ebitda, ventas),
          margenOperativo: safePct(ebit, ventas),
          margenNeto: safePct(utilidadNeta, ventas),
        };
      });
  }, [dateFrom, dateTo, gastosVentas, gastosGeneralesAdmin, gastosFinancieros, depAmortMensual]);

  const totals = useMemo(() => {
    const t = data.reduce((acc, m) => ({
      ventas: acc.ventas + m.ventas, cogs: acc.cogs + m.cogs, utilidadBruta: acc.utilidadBruta + m.utilidadBruta,
      gVentas: acc.gVentas + m.gVentas, gAdmin: acc.gAdmin + m.gAdmin, ebitda: acc.ebitda + m.ebitda,
      depAmort: acc.depAmort + m.depAmort, ebit: acc.ebit + m.ebit, intereses: acc.intereses + m.intereses,
      utilidadAntesImpuestos: acc.utilidadAntesImpuestos + m.utilidadAntesImpuestos,
      impuestos: acc.impuestos + m.impuestos, utilidadNeta: acc.utilidadNeta + m.utilidadNeta,
    }), { ventas:0, cogs:0, utilidadBruta:0, gVentas:0, gAdmin:0, ebitda:0, depAmort:0, ebit:0, intereses:0, utilidadAntesImpuestos:0, impuestos:0, utilidadNeta:0 });
    return {
      ...t,
      margenBruto: safePct(t.utilidadBruta, t.ventas),
      margenEbitda: safePct(t.ebitda, t.ventas),
      margenOperativo: safePct(t.ebit, t.ventas),
      margenNeto: safePct(t.utilidadNeta, t.ventas),
    };
  }, [data]);

  const chartData = data.map(d => ({
    name: d.mes, Ventas: d.ventas, EBITDA: d.ebitda, EBIT: d.ebit, 'Utilidad neta': d.utilidadNeta,
  }));

  const periodLabel = `${format(dateFrom, 'dd MMM yyyy', { locale: es })} — ${format(dateTo, 'dd MMM yyyy', { locale: es })}`;

  const handleExportExcel = () => {
    const rows = data.map(d => ({
      Mes: d.mes, Ventas: d.ventas, COGS: d.cogs, 'Utilidad bruta': d.utilidadBruta,
      'Gastos ventas': d.gVentas, 'Gastos G&A': d.gAdmin, EBITDA: d.ebitda,
      'Dep/Amort': d.depAmort, EBIT: d.ebit, Intereses: d.intereses,
      'Util antes imp': d.utilidadAntesImpuestos, Impuestos: d.impuestos,
      'Utilidad neta': d.utilidadNeta, 'Margen neto %': d.margenNeto.toFixed(1),
    }));
    exportToExcel(rows, `Estado_resultados_${new Date().toISOString().split('T')[0]}`);
  };

  const handleExportPdf = () => {
    exportToPdf({
      title: 'Estado de Resultados',
      subtitle: `${periodLabel} — REDBUCK EQUIPMENT`,
      filename: `Estado_resultados_${new Date().toISOString().split('T')[0]}`,
      headers: ['Mes', 'Ventas', 'COGS', 'U. Bruta', 'EBITDA', 'EBIT', 'U. Neta', 'Margen %'],
      rows: data.map(d => [d.mes, fmt(d.ventas), fmt(d.cogs), fmt(d.utilidadBruta), fmt(d.ebitda), fmt(d.ebit), fmt(d.utilidadNeta), fmtPct(d.margenNeto)]),
      summary: [
        { label: 'Ventas totales', value: fmt(totals.ventas) },
        { label: 'EBITDA', value: fmt(totals.ebitda) },
        { label: 'Utilidad neta', value: fmt(totals.utilidadNeta) },
        { label: 'Margen neto', value: fmtPct(totals.margenNeto) },
      ],
    });
  };

  const lineItems: { label: string; key: string; bold?: boolean; bg?: boolean; indent?: boolean; color?: string; isMargin?: boolean }[] = [
    { label: 'Ventas', key: 'ventas', bold: true },
    { label: '(-) Costo de ventas (COGS)', key: 'cogs', indent: true },
    { label: '= Utilidad bruta', key: 'utilidadBruta', bold: true, bg: true },
    { label: 'Margen bruto %', key: 'margenBruto', indent: true, isMargin: true },
    { label: '(-) Gastos de ventas', key: 'gVentas', indent: true },
    { label: '(-) Gastos generales y administrativos', key: 'gAdmin', indent: true },
    { label: '= EBITDA', key: 'ebitda', bold: true, bg: true },
    { label: 'Margen EBITDA %', key: 'margenEbitda', indent: true, isMargin: true },
    { label: '(-) Depreciación y amortización', key: 'depAmort', indent: true },
    { label: '= Utilidad de operación (EBIT)', key: 'ebit', bold: true, bg: true },
    { label: 'Margen operativo %', key: 'margenOperativo', indent: true, isMargin: true },
    { label: '(-) Intereses / gastos financieros', key: 'intereses', indent: true },
    { label: '= Utilidad antes de impuestos', key: 'utilidadAntesImpuestos', bold: true },
    { label: '(-) Impuestos (30%)', key: 'impuestos', indent: true },
    { label: '= Utilidad neta', key: 'utilidadNeta', bold: true, bg: true, color: 'success' },
    { label: 'Margen neto %', key: 'margenNeto', indent: true, isMargin: true },
  ];

  if (loadingExpenses || loadingAssets) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-primary" size={32} />
        <span className="ml-3 text-muted-foreground">Cargando datos financieros...</span>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <Link to="/reportes-ejecutivos"><Button variant="ghost" size="sm"><ArrowLeft size={16} /></Button></Link>
          <div>
            <h1 className="page-title flex items-center gap-2"><TrendingUp size={22} className="text-success" /> Estado de Resultados</h1>
            <p className="page-subtitle">
              Reporte financiero por periodo seleccionable
              {isDbConnected && <span className="ml-2 text-xs text-success">● Datos reales</span>}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="text-xs" onClick={handleExportExcel}>📊 Excel</Button>
          <Button variant="outline" size="sm" className="text-xs" onClick={handleExportPdf}>📄 PDF</Button>
        </div>
      </div>

      {/* Period selector */}
      <div className="bg-card rounded-xl border p-4 mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Fecha inicio</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("w-44 justify-start text-left text-xs")}>
                  <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                  {format(dateFrom, 'dd MMM yyyy', { locale: es })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateFrom} onSelect={d => d && setDateFrom(d)} initialFocus className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Fecha fin</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("w-44 justify-start text-left text-xs")}>
                  <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                  {format(dateTo, 'dd MMM yyyy', { locale: es })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateTo} onSelect={d => d && setDateTo(d)} initialFocus className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {PRESETS.map(p => (
              <Button key={p.label} variant="ghost" size="sm" className="text-xs h-8"
                onClick={() => { const r = p.getRange(); setDateFrom(r.from); setDateTo(r.to); }}>
                {p.label}
              </Button>
            ))}
          </div>
          <div className="ml-auto text-xs text-muted-foreground">
            {data.length} meses seleccionados
          </div>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        {[
          { label: 'Ventas totales', value: fmt(totals.ventas), sub: '', border: 'primary' },
          { label: 'Utilidad bruta', value: fmt(totals.utilidadBruta), sub: fmtPct(totals.margenBruto), border: 'warning' },
          { label: 'EBITDA', value: fmt(totals.ebitda), sub: fmtPct(totals.margenEbitda), border: 'primary' },
          { label: 'EBIT', value: fmt(totals.ebit), sub: fmtPct(totals.margenOperativo), border: 'warning' },
          { label: 'Utilidad neta', value: fmt(totals.utilidadNeta), sub: fmtPct(totals.margenNeto), border: 'success' },
        ].map(k => (
          <div key={k.label} className={`bg-card rounded-xl border p-4 text-center border-l-4 border-l-${k.border}`}>
            <div className="text-xs text-muted-foreground">{k.label}</div>
            <div className="text-lg font-bold">{k.value}</div>
            {k.sub && <div className="text-xs text-muted-foreground">{k.sub}</div>}
          </div>
        ))}
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
            <Line type="monotone" dataKey="Ventas" stroke="hsl(var(--primary))" strokeWidth={2.5} />
            <Line type="monotone" dataKey="EBITDA" stroke="hsl(var(--warning))" strokeWidth={2} />
            <Line type="monotone" dataKey="EBIT" stroke="hsl(var(--accent-foreground))" strokeWidth={2} strokeDasharray="5 5" />
            <Line type="monotone" dataKey="Utilidad neta" stroke="hsl(var(--success))" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Full income statement table */}
      <div className="bg-card rounded-xl border overflow-x-auto">
        <div className="p-4 border-b">
          <h3 className="font-display font-semibold">Estado de resultados detallado</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{periodLabel}</p>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Concepto</th>
              {data.map(d => <th key={d.mes}>{d.mes}</th>)}
              <th className="font-bold">Total</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map(line => (
              <tr key={line.key} className={`${line.bold ? 'font-semibold' : ''} ${line.bg ? 'bg-muted/30' : ''} ${line.color === 'success' ? 'bg-success/5' : ''}`}>
                <td className={`text-xs ${line.indent ? 'pl-6 text-muted-foreground' : ''} ${line.color === 'success' ? 'text-success' : ''}`}>
                  {line.label}
                </td>
                {data.map(d => (
                  <td key={d.mes} className={`text-xs ${line.color === 'success' ? 'text-success font-bold' : ''} ${line.indent && !line.isMargin ? 'text-muted-foreground' : ''}`}>
                    {line.isMargin ? fmtPct((d as any)[line.key]) : fmt((d as any)[line.key])}
                  </td>
                ))}
                <td className={`text-xs font-bold ${line.color === 'success' ? 'text-success' : ''}`}>
                  {line.isMargin ? fmtPct((totals as any)[line.key]) : fmt((totals as any)[line.key])}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
