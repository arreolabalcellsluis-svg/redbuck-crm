import { useState, useMemo } from 'react';
import { getCompanyLogoUrl } from '@/hooks/useCompanyLogo';
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
    import('xlsx').then(XLSX => {
      const wb = XLSX.utils.book_new();

      // Hoja 1: Estado de resultados completo (mensual)
      const fullRows = data.map(d => ({
        Mes: d.mes,
        Ventas: d.ventas,
        'Costo de ventas': d.cogs,
        'Utilidad bruta': d.utilidadBruta,
        'Margen bruto %': d.margenBruto.toFixed(1),
        'Gastos de ventas': d.gVentas,
        'Gastos G&A': d.gAdmin,
        EBITDA: d.ebitda,
        'Margen EBITDA %': d.margenEbitda.toFixed(1),
        'Dep/Amort': d.depAmort,
        'EBIT (Ut. operativa)': d.ebit,
        'Margen operativo %': d.margenOperativo.toFixed(1),
        Intereses: d.intereses,
        'Util antes impuestos': d.utilidadAntesImpuestos,
        'Impuestos (30%)': d.impuestos,
        'Utilidad neta': d.utilidadNeta,
        'Margen neto %': d.margenNeto.toFixed(1),
      }));
      // Add totals row
      fullRows.push({
        Mes: 'TOTAL',
        Ventas: totals.ventas,
        'Costo de ventas': totals.cogs,
        'Utilidad bruta': totals.utilidadBruta,
        'Margen bruto %': totals.margenBruto.toFixed(1),
        'Gastos de ventas': totals.gVentas,
        'Gastos G&A': totals.gAdmin,
        EBITDA: totals.ebitda,
        'Margen EBITDA %': totals.margenEbitda.toFixed(1),
        'Dep/Amort': totals.depAmort,
        'EBIT (Ut. operativa)': totals.ebit,
        'Margen operativo %': totals.margenOperativo.toFixed(1),
        Intereses: totals.intereses,
        'Util antes impuestos': totals.utilidadAntesImpuestos,
        'Impuestos (30%)': totals.impuestos,
        'Utilidad neta': totals.utilidadNeta,
        'Margen neto %': totals.margenNeto.toFixed(1),
      });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(fullRows), 'Estado de Resultados');

      // Hoja 2: KPIs resumen
      const kpiRows = [
        { Indicador: 'Periodo', Valor: periodLabel },
        { Indicador: 'Meses analizados', Valor: data.length },
        { Indicador: 'Ventas totales', Valor: totals.ventas },
        { Indicador: 'Costo de ventas total', Valor: totals.cogs },
        { Indicador: 'Utilidad bruta', Valor: totals.utilidadBruta },
        { Indicador: 'Margen bruto %', Valor: totals.margenBruto.toFixed(1) + '%' },
        { Indicador: 'EBITDA', Valor: totals.ebitda },
        { Indicador: 'Margen EBITDA %', Valor: totals.margenEbitda.toFixed(1) + '%' },
        { Indicador: 'EBIT', Valor: totals.ebit },
        { Indicador: 'Margen operativo %', Valor: totals.margenOperativo.toFixed(1) + '%' },
        { Indicador: 'Utilidad neta', Valor: totals.utilidadNeta },
        { Indicador: 'Margen neto %', Valor: totals.margenNeto.toFixed(1) + '%' },
        { Indicador: 'Venta promedio mensual', Valor: data.length > 0 ? Math.round(totals.ventas / data.length) : 0 },
        { Indicador: 'Utilidad neta promedio mensual', Valor: data.length > 0 ? Math.round(totals.utilidadNeta / data.length) : 0 },
        { Indicador: 'Dep/Amort total', Valor: totals.depAmort },
        { Indicador: 'Gastos de ventas total', Valor: totals.gVentas },
        { Indicador: 'Gastos G&A total', Valor: totals.gAdmin },
        { Indicador: 'Intereses total', Valor: totals.intereses },
        { Indicador: 'Impuestos total', Valor: totals.impuestos },
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(kpiRows), 'KPIs Resumen');

      // Hoja 3: Datos de gráfica (tendencia)
      const chartRows = data.map(d => ({
        Mes: d.mes,
        Ventas: d.ventas,
        EBITDA: d.ebitda,
        EBIT: d.ebit,
        'Utilidad neta': d.utilidadNeta,
        'Margen bruto %': d.margenBruto.toFixed(1),
        'Margen EBITDA %': d.margenEbitda.toFixed(1),
        'Margen operativo %': d.margenOperativo.toFixed(1),
        'Margen neto %': d.margenNeto.toFixed(1),
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(chartRows), 'Tendencia Financiera');

      // Hoja 4: Estructura de gastos
      const expenseRows = [
        { Concepto: 'Gastos de ventas (mensual)', Monto: gastosVentas, '% de Ventas': safePct(gastosVentas * data.length, totals.ventas).toFixed(1) + '%' },
        { Concepto: 'Gastos G&A (mensual)', Monto: gastosGeneralesAdmin, '% de Ventas': safePct(gastosGeneralesAdmin * data.length, totals.ventas).toFixed(1) + '%' },
        { Concepto: 'Gastos financieros (mensual)', Monto: gastosFinancieros, '% de Ventas': safePct(gastosFinancieros * data.length, totals.ventas).toFixed(1) + '%' },
        { Concepto: 'Dep/Amort (mensual)', Monto: depAmortMensual, '% de Ventas': safePct(depAmortMensual * data.length, totals.ventas).toFixed(1) + '%' },
        { Concepto: '---', Monto: '', '% de Ventas': '' },
        { Concepto: 'Total gastos operativos (periodo)', Monto: totals.gVentas + totals.gAdmin, '% de Ventas': safePct(totals.gVentas + totals.gAdmin, totals.ventas).toFixed(1) + '%' },
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(expenseRows), 'Estructura de Gastos');

      XLSX.writeFile(wb, `Estado_resultados_completo_${new Date().toISOString().split('T')[0]}.xlsx`);
    });
  };

  const handleExportPdf = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    // Build KPI cards HTML
    const kpis = [
      { label: 'Ventas totales', value: fmt(totals.ventas) },
      { label: 'Utilidad bruta', value: fmt(totals.utilidadBruta), sub: fmtPct(totals.margenBruto) },
      { label: 'EBITDA', value: fmt(totals.ebitda), sub: fmtPct(totals.margenEbitda) },
      { label: 'EBIT', value: fmt(totals.ebit), sub: fmtPct(totals.margenOperativo) },
      { label: 'Utilidad neta', value: fmt(totals.utilidadNeta), sub: fmtPct(totals.margenNeto) },
    ];
    const kpiHtml = `<div style="display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap;">${kpis.map(k => `
      <div style="background:#f5f5f5;padding:12px 18px;border-radius:8px;text-align:center;min-width:110px;flex:1;border-left:3px solid #c41e2a;">
        <div style="font-size:9px;color:#666;text-transform:uppercase;letter-spacing:1px;">${k.label}</div>
        <div style="font-size:15px;font-weight:700;margin-top:4px;">${k.value}</div>
        ${k.sub ? `<div style="font-size:10px;color:#888;margin-top:2px;">${k.sub}</div>` : ''}
      </div>
    `).join('')}</div>`;

    // Build full income statement table
    const allLineItems = lineItems;
    const tableHeaders = ['Concepto', ...data.map(d => d.mes), 'TOTAL'];
    const tableRows = allLineItems.map(line => {
      const isMoney = !line.isMargin;
      const cells = data.map(d => line.isMargin ? fmtPct((d as any)[line.key]) : fmt((d as any)[line.key]));
      const totalCell = line.isMargin ? fmtPct((totals as any)[line.key]) : fmt((totals as any)[line.key]);
      const style = `${line.bold ? 'font-weight:700;' : ''}${line.bg ? 'background:#f0f0f0;' : ''}${line.color === 'success' ? 'background:#e8f5e9;color:#2e7d32;' : ''}`;
      const indentStyle = line.indent ? 'padding-left:20px;color:#666;' : '';
      return `<tr style="${style}">
        <td style="${indentStyle}font-size:10px;padding:4px 8px;border-bottom:1px solid #eee;">${line.label}</td>
        ${cells.map(c => `<td style="font-size:10px;padding:4px 6px;border-bottom:1px solid #eee;text-align:right;">${c}</td>`).join('')}
        <td style="font-size:10px;padding:4px 6px;border-bottom:1px solid #eee;text-align:right;font-weight:700;">${totalCell}</td>
      </tr>`;
    }).join('');

    // Build expense structure summary
    const expenseHtml = `
      <div style="margin-top:24px;">
        <h3 style="font-size:13px;font-weight:700;margin-bottom:10px;border-bottom:1px solid #ddd;padding-bottom:4px;">Estructura de gastos (mensual)</h3>
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr>
            <th style="text-align:left;font-size:9px;padding:4px 8px;background:#f0f0f0;border-bottom:2px solid #ddd;">Concepto</th>
            <th style="text-align:right;font-size:9px;padding:4px 8px;background:#f0f0f0;border-bottom:2px solid #ddd;">Monto</th>
            <th style="text-align:right;font-size:9px;padding:4px 8px;background:#f0f0f0;border-bottom:2px solid #ddd;">% de Ventas</th>
          </tr></thead>
          <tbody>
            <tr><td style="font-size:10px;padding:4px 8px;border-bottom:1px solid #eee;">Gastos de ventas</td><td style="font-size:10px;padding:4px 8px;border-bottom:1px solid #eee;text-align:right;">${fmt(gastosVentas)}</td><td style="font-size:10px;padding:4px 8px;border-bottom:1px solid #eee;text-align:right;">${fmtPct(safePct(gastosVentas * data.length, totals.ventas))}</td></tr>
            <tr><td style="font-size:10px;padding:4px 8px;border-bottom:1px solid #eee;">Gastos G&A</td><td style="font-size:10px;padding:4px 8px;border-bottom:1px solid #eee;text-align:right;">${fmt(gastosGeneralesAdmin)}</td><td style="font-size:10px;padding:4px 8px;border-bottom:1px solid #eee;text-align:right;">${fmtPct(safePct(gastosGeneralesAdmin * data.length, totals.ventas))}</td></tr>
            <tr><td style="font-size:10px;padding:4px 8px;border-bottom:1px solid #eee;">Gastos financieros</td><td style="font-size:10px;padding:4px 8px;border-bottom:1px solid #eee;text-align:right;">${fmt(gastosFinancieros)}</td><td style="font-size:10px;padding:4px 8px;border-bottom:1px solid #eee;text-align:right;">${fmtPct(safePct(gastosFinancieros * data.length, totals.ventas))}</td></tr>
            <tr><td style="font-size:10px;padding:4px 8px;border-bottom:1px solid #eee;">Dep/Amort</td><td style="font-size:10px;padding:4px 8px;border-bottom:1px solid #eee;text-align:right;">${fmt(depAmortMensual)}</td><td style="font-size:10px;padding:4px 8px;border-bottom:1px solid #eee;text-align:right;">${fmtPct(safePct(depAmortMensual * data.length, totals.ventas))}</td></tr>
          </tbody>
        </table>
      </div>
    `;

    // Build trend chart as ASCII table for PDF
    const trendHtml = `
      <div style="margin-top:24px;">
        <h3 style="font-size:13px;font-weight:700;margin-bottom:10px;border-bottom:1px solid #ddd;padding-bottom:4px;">Tendencia financiera</h3>
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr>
            <th style="text-align:left;font-size:9px;padding:4px 8px;background:#f0f0f0;border-bottom:2px solid #ddd;">Mes</th>
            <th style="text-align:right;font-size:9px;padding:4px 8px;background:#f0f0f0;border-bottom:2px solid #ddd;">Ventas</th>
            <th style="text-align:right;font-size:9px;padding:4px 8px;background:#f0f0f0;border-bottom:2px solid #ddd;">EBITDA</th>
            <th style="text-align:right;font-size:9px;padding:4px 8px;background:#f0f0f0;border-bottom:2px solid #ddd;">EBIT</th>
            <th style="text-align:right;font-size:9px;padding:4px 8px;background:#f0f0f0;border-bottom:2px solid #ddd;">Ut. Neta</th>
            <th style="text-align:right;font-size:9px;padding:4px 8px;background:#f0f0f0;border-bottom:2px solid #ddd;">M. Bruto</th>
            <th style="text-align:right;font-size:9px;padding:4px 8px;background:#f0f0f0;border-bottom:2px solid #ddd;">M. EBITDA</th>
            <th style="text-align:right;font-size:9px;padding:4px 8px;background:#f0f0f0;border-bottom:2px solid #ddd;">M. Neto</th>
          </tr></thead>
          <tbody>
            ${data.map(d => `<tr>
              <td style="font-size:10px;padding:4px 8px;border-bottom:1px solid #eee;">${d.mes}</td>
              <td style="font-size:10px;padding:4px 8px;border-bottom:1px solid #eee;text-align:right;">${fmt(d.ventas)}</td>
              <td style="font-size:10px;padding:4px 8px;border-bottom:1px solid #eee;text-align:right;">${fmt(d.ebitda)}</td>
              <td style="font-size:10px;padding:4px 8px;border-bottom:1px solid #eee;text-align:right;">${fmt(d.ebit)}</td>
              <td style="font-size:10px;padding:4px 8px;border-bottom:1px solid #eee;text-align:right;">${fmt(d.utilidadNeta)}</td>
              <td style="font-size:10px;padding:4px 8px;border-bottom:1px solid #eee;text-align:right;">${fmtPct(d.margenBruto)}</td>
              <td style="font-size:10px;padding:4px 8px;border-bottom:1px solid #eee;text-align:right;">${fmtPct(d.margenEbitda)}</td>
              <td style="font-size:10px;padding:4px 8px;border-bottom:1px solid #eee;text-align:right;">${fmtPct(d.margenNeto)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    `;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Estado de Resultados - REDBUCK</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 24px; color: #1a1a1a; font-size: 11px; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; border-bottom: 3px solid #c41e2a; padding-bottom: 12px; }
          .brand { font-size: 18px; font-weight: 800; color: #c41e2a; letter-spacing: 1px; }
          .brand-sub { font-size: 9px; color: #666; letter-spacing: 2px; }
          .section-title { font-size: 13px; font-weight: 700; margin-bottom: 10px; margin-top: 20px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
          .footer { margin-top: 30px; padding-top: 10px; border-top: 1px solid #ddd; font-size: 9px; color: #999; display: flex; justify-content: space-between; }
          @media print { body { padding: 12px; } @page { size: landscape; margin: 10mm; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div style="display:flex;align-items:center;gap:12px;">
            <img src="${getCompanyLogoUrl()}" alt="Logo" style="height:36px;max-width:120px;object-fit:contain;" onerror="this.style.display='none'" />
            <div>
              <div class="brand">REDBUCK EQUIPMENT</div>
              <div class="brand-sub">ERP · CRM · SISTEMA INTEGRAL</div>
            </div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:16px;font-weight:700;">Estado de Resultados</div>
            <div style="font-size:10px;color:#666;">${periodLabel}</div>
            <div style="font-size:9px;color:#999;margin-top:2px;">Generado: ${new Date().toLocaleString('es-MX')}</div>
          </div>
        </div>

        ${kpiHtml}

        <h3 class="section-title">Estado de resultados detallado</h3>
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr>${tableHeaders.map(h => `<th style="text-align:${h === 'Concepto' ? 'left' : 'right'};font-size:8px;padding:4px 6px;background:#f0f0f0;border-bottom:2px solid #ddd;text-transform:uppercase;letter-spacing:0.5px;">${h}</th>`).join('')}</tr></thead>
          <tbody>${tableRows}</tbody>
        </table>

        ${trendHtml}
        ${expenseHtml}

        <div class="footer">
          <span>REDBUCK EQUIPMENT — Reporte financiero confidencial</span>
          <span>${new Date().toLocaleString('es-MX')}</span>
        </div>
        <script>setTimeout(() => { window.print(); }, 500);</script>
      </body>
      </html>
    `);
    printWindow.document.close();
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
