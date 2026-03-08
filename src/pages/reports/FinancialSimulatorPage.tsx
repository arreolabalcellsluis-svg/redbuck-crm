import { useMemo, useState } from 'react';
import { getCompanyLogoUrl } from '@/hooks/useCompanyLogo';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '@/contexts/AppContext';
import { getFinancialAnalysis } from '@/lib/financialSimulator';
import { analyzeProducts } from '@/lib/planningEngine';
import { exportToExcel } from '@/components/shared/ReportFilterBar';
import { exportToPdf } from '@/lib/pdfExport';
import {
  DollarSign, TrendingUp, TrendingDown, Warehouse, Activity, ShieldAlert,
  BarChart3, ArrowUpRight, ArrowDownRight, FileSpreadsheet, Download,
  Layers, Zap, AlertTriangle, PieChart as PieIcon, Calculator,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, RadialBarChart, RadialBar, Legend, LineChart, Line,
} from 'recharts';

const fmt = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);
const fmtPct = (n: number) => `${n.toFixed(1)}%`;
const COLORS = [
  'hsl(0,78%,45%)', 'hsl(210,100%,52%)', 'hsl(142,71%,45%)',
  'hsl(38,92%,50%)', 'hsl(280,65%,55%)', 'hsl(190,80%,45%)',
  'hsl(330,70%,50%)', 'hsl(0,0%,60%)',
];

export default function FinancialSimulatorPage() {
  const { currentRole } = useAppContext();
  const navigate = useNavigate();
  const [coverageTarget, setCoverageTarget] = useState(90);

  const analyses = useMemo(() => analyzeProducts(), []);
  const fin = useMemo(() => getFinancialAnalysis(analyses), [analyses]);

  if (!['director', 'administracion'].includes(currentRole)) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <ShieldAlert size={48} className="text-destructive" />
        <h2 className="text-xl font-bold">Acceso restringido</h2>
        <p className="text-muted-foreground">Este módulo es exclusivo para Director y Administración.</p>
      </div>
    );
  }

  const handleExportAllExcel = async () => {
    const XLSX = await import('xlsx');
    const { saveAs } = await import('file-saver');
    const wb = XLSX.utils.book_new();

    // Sheet 1: KPIs resumen
    const kpiData = [
      { Indicador: 'Reporte', Valor: 'Simulador Financiero Completo' },
      { Indicador: 'Generado', Valor: new Date().toLocaleString('es-MX') },
      { Indicador: 'Capital en inventario', Valor: fin.totalInventoryValue },
      { Indicador: 'Capital detenido (>180d)', Valor: fin.slowInventoryValue },
      { Indicador: 'Capital muerto (>365d)', Valor: fin.deadInventoryValue },
      { Indicador: 'Inventario saludable', Valor: fin.healthyInventoryValue },
      { Indicador: '% lento', Valor: Number(fin.slowInventoryPct.toFixed(1)) },
      { Indicador: '% muerto', Valor: Number(fin.deadInventoryPct.toFixed(1)) },
      { Indicador: 'Rotación anual', Valor: Number(fin.inventoryRotation.toFixed(2)) },
      { Indicador: 'Días de inventario', Valor: fin.daysOfInventory },
      { Indicador: 'ROI inventario %', Valor: Number(fin.roi.toFixed(1)) },
      { Indicador: 'Utilidad anual', Valor: fin.annualProfit },
      { Indicador: 'Ingresos anuales', Valor: fin.annualRevenue },
      { Indicador: 'COGS anual', Valor: fin.annualCOGS },
      { Indicador: 'Inv. necesario', Valor: fin.requiredInventoryForCurrentSales },
      { Indicador: fin.inventoryDifference > 0 ? 'Excedente' : 'Faltante', Valor: Math.abs(fin.inventoryDifference) },
      { Indicador: 'Compras recomendadas', Valor: fin.purchasePlanValue },
    ];
    const ws0 = XLSX.utils.json_to_sheet(kpiData);
    ws0['!cols'] = [{ wch: 30 }, { wch: 22 }];
    XLSX.utils.book_append_sheet(wb, ws0, 'KPIs Resumen');

    // Sheet 2: Capital por categoría
    const catData = fin.capitalByCategory.map(c => ({
      Categoría: c.category, Unidades: c.units, Valor: c.value, '% del total': Number(c.pct.toFixed(1)),
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(catData), 'Capital por Categoría');

    // Sheet 3: Capital por bodega
    const whData = fin.capitalByWarehouse.map(w => ({
      Bodega: w.warehouse, Unidades: w.units, Valor: w.value, '% del total': Number(w.pct.toFixed(1)),
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(whData), 'Capital por Bodega');

    // Sheet 4: Salud del inventario
    const healthData = [
      { Categoría: 'Saludable', Valor: fin.healthyInventoryValue, '% del total': Number(((fin.healthyInventoryValue / fin.totalInventoryValue) * 100).toFixed(1)) },
      { Categoría: 'Lento (>180 días)', Valor: fin.slowInventoryValue - fin.deadInventoryValue, '% del total': Number((((fin.slowInventoryValue - fin.deadInventoryValue) / fin.totalInventoryValue) * 100).toFixed(1)) },
      { Categoría: 'Muerto (>365 días)', Valor: fin.deadInventoryValue, '% del total': Number(fin.deadInventoryPct.toFixed(1)) },
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(healthData), 'Salud Inventario');

    // Sheet 5: Top productos por capital
    const prodData = fin.topCapitalProducts.map(p => ({
      SKU: p.sku, Producto: p.name, Categoría: p.category, Stock: p.stock,
      'Costo unitario': p.cost, 'Valor inventario': p.value, Rotación: Number(p.rotation.toFixed(1)),
      'Margen %': p.margin, 'ROI %': Number(p.roi.toFixed(1)), 'Venta mensual': Number(p.monthlySales.toFixed(1)),
      'Días stock': p.daysOfStock, 'Utilidad anual': p.annualProfit,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(prodData), 'Top Capital Productos');

    // Sheet 6: Inventario lento
    const slowData = fin.slowInventory.map(s => ({
      SKU: s.sku, Producto: s.name, Categoría: s.category, Stock: s.stock,
      'Costo unitario': s.cost, 'Valor detenido': s.value, 'Cobertura días': s.coverageDays,
      'Cobertura meses': Number(s.coverageMonths.toFixed(1)), 'Venta mensual': Number(s.monthlySales.toFixed(2)),
      '% del total': Number(s.pctOfTotal.toFixed(1)),
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(slowData), 'Inventario Lento');

    // Sheet 7: Rotación por categoría
    const rotData = fin.rotationByCategory.map(r => ({
      Categoría: r.category, 'COGS anual': r.annualCOGS, 'Inv. promedio': r.avgInventory,
      Rotación: Number(r.rotation.toFixed(2)), 'Días inventario': r.daysOfInventory,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rotData), 'Rotación por Categoría');

    // Sheet 8: Top ROI
    const roiData = fin.topROIProducts.map((p, i) => ({
      '#': i + 1, Producto: p.name, SKU: p.sku, 'Valor inventario': p.value,
      'Utilidad anual': p.annualProfit, 'ROI %': Number(p.roi.toFixed(1)), 'Margen %': p.margin,
      'Venta mensual': Number(p.monthlySales.toFixed(1)),
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(roiData), 'Top ROI');

    // Sheet 9: Peor ROI
    const worstData = fin.worstROIProducts.map((p, i) => ({
      '#': i + 1, Producto: p.name, SKU: p.sku, 'Valor inventario': p.value,
      'Utilidad anual': p.annualProfit, 'ROI %': Number(p.roi.toFixed(1)), 'Margen %': p.margin,
      'Venta mensual': Number(p.monthlySales.toFixed(1)),
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(worstData), 'Peor ROI');

    // Sheet 10: Simulación crecimiento
    const growthData = fin.growthScenarios.map(g => ({
      Escenario: g.label, 'Ventas actuales': g.currentRevenue, 'Ventas objetivo': g.targetRevenue,
      'Inventario actual': g.currentInventory, 'Inventario requerido': g.requiredInventory,
      'Capital adicional': g.additionalCapital, 'Utilidad estimada': g.estimatedProfit,
      'Impacto flujo': g.cashFlowImpact,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(growthData), 'Simulación Crecimiento');

    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `simulador-financiero-completo_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleExportExcel = async (tab: string) => {
    if (tab === 'capital') {
      handleExportAllExcel();
    } else if (tab === 'slow') {
      exportToExcel(fin.slowInventory.map(s => ({
        SKU: s.sku, Producto: s.name, Categoría: s.category, Stock: s.stock,
        'Costo unitario': s.cost, 'Valor detenido': s.value, 'Cobertura días': s.coverageDays,
        'Cobertura meses': s.coverageMonths.toFixed(1), 'Venta mensual': s.monthlySales.toFixed(2),
        '% del total': s.pctOfTotal.toFixed(1),
      })), 'inventario-lento');
    } else if (tab === 'rotation') {
      exportToExcel(fin.rotationByCategory.map(r => ({
        Categoría: r.category, 'COGS anual': r.annualCOGS, 'Inv. promedio': r.avgInventory,
        Rotación: r.rotation.toFixed(2), 'Días inventario': r.daysOfInventory,
      })), 'rotacion-inventario');
    } else if (tab === 'growth') {
      exportToExcel(fin.growthScenarios.map(g => ({
        Escenario: g.label, 'Ventas actuales': g.currentRevenue, 'Ventas objetivo': g.targetRevenue,
        'Inventario actual': g.currentInventory, 'Inventario requerido': g.requiredInventory,
        'Capital adicional': g.additionalCapital, 'Utilidad estimada': g.estimatedProfit,
      })), 'simulacion-crecimiento');
    }
  };

  const handleExportPdf = () => {
    const w = window.open('', '_blank');
    if (!w) return;

    const kpiRow = (items: { label: string; value: string }[]) => `
      <div style="display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap;">
        ${items.map(i => `<div style="background:#f5f5f5;padding:10px 16px;border-radius:8px;text-align:center;min-width:110px;flex:1;">
          <div style="font-size:9px;color:#666;text-transform:uppercase;letter-spacing:0.5px;">${i.label}</div>
          <div style="font-size:15px;font-weight:700;margin-top:3px;">${i.value}</div>
        </div>`).join('')}
      </div>`;

    const table = (headers: string[], rows: string[][]) => `
      <table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;

    const section = (title: string, content: string) => `
      <div style="margin-bottom:24px;">
        <h2 style="font-size:13px;font-weight:700;border-bottom:2px solid #c41e2a;padding-bottom:4px;margin-bottom:10px;">${title}</h2>
        ${content}
      </div>`;

    // Bar representation helper for charts
    const barChart = (items: { label: string; value: number; pct: number }[], color: string) => `
      <div style="display:flex;flex-direction:column;gap:6px;">
        ${items.map(i => `<div style="display:flex;align-items:center;gap:8px;">
          <span style="width:120px;font-size:10px;text-align:right;">${i.label}</span>
          <div style="flex:1;background:#eee;border-radius:4px;height:16px;position:relative;">
            <div style="width:${Math.min(i.pct, 100)}%;background:${color};height:100%;border-radius:4px;"></div>
          </div>
          <span style="width:90px;font-size:10px;font-weight:600;">${fmt(i.value)} (${i.pct.toFixed(1)}%)</span>
        </div>`).join('')}
      </div>`;

    const maxCatVal = Math.max(...fin.capitalByCategory.map(c => c.value), 1);
    const maxWhVal = Math.max(...fin.capitalByWarehouse.map(w => w.value), 1);

    const healthTotal = fin.healthyInventoryValue + fin.slowInventoryValue;
    const healthItems = [
      { label: 'Saludable', value: fin.healthyInventoryValue, pct: healthTotal > 0 ? (fin.healthyInventoryValue / healthTotal) * 100 : 0 },
      { label: 'Lento (>180d)', value: fin.slowInventoryValue - fin.deadInventoryValue, pct: healthTotal > 0 ? ((fin.slowInventoryValue - fin.deadInventoryValue) / healthTotal) * 100 : 0 },
      { label: 'Muerto (>365d)', value: fin.deadInventoryValue, pct: healthTotal > 0 ? (fin.deadInventoryValue / healthTotal) * 100 : 0 },
    ].filter(i => i.value > 0);

    w.document.write(`<!DOCTYPE html><html><head><title>Simulador Financiero</title><style>
      *{margin:0;padding:0;box-sizing:border-box;}
      body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:25px;color:#1a1a1a;font-size:10px;}
      .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px;border-bottom:3px solid #c41e2a;padding-bottom:10px;}
      .brand{font-size:18px;font-weight:800;color:#c41e2a;letter-spacing:1px;}
      .brand-sub{font-size:8px;color:#666;letter-spacing:2px;}
      table{width:100%;border-collapse:collapse;margin-top:6px;margin-bottom:12px;}
      th{background:#f0f0f0;font-weight:600;text-align:left;padding:5px 6px;font-size:8px;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #ddd;}
      td{padding:4px 6px;border-bottom:1px solid #eee;font-size:9px;}
      tr:nth-child(even){background:#fafafa;}
      .footer{margin-top:20px;padding-top:8px;border-top:1px solid #ddd;font-size:8px;color:#999;display:flex;justify-content:space-between;}
      @media print{body{padding:12px;} @page{size:landscape;margin:10mm;}}
    </style></head><body>
      <div class="header">
        <div><div class="brand">REDBUCK EQUIPMENT</div><div class="brand-sub">ERP · SIMULADOR FINANCIERO DE INVENTARIO</div></div>
        <div style="text-align:right;"><div style="font-size:14px;font-weight:700;">Simulador Financiero de Inventario</div>
        <div style="font-size:9px;color:#666;">Generado: ${new Date().toLocaleString('es-MX')}</div></div>
      </div>

      ${section('1. Indicadores principales', kpiRow([
        { label: 'Capital en inventario', value: fmt(fin.totalInventoryValue) },
        { label: 'Capital detenido', value: fmt(fin.slowInventoryValue) },
        { label: 'Rotación anual', value: `${fin.inventoryRotation.toFixed(1)}x` },
        { label: 'ROI inventario', value: fmtPct(fin.roi) },
        { label: 'Inv. necesario', value: fmt(fin.requiredInventoryForCurrentSales) },
      ]) + kpiRow([
        { label: 'Días inventario', value: `${fin.daysOfInventory}` },
        { label: 'Utilidad anual', value: fmt(fin.annualProfit) },
        { label: 'Ingresos anuales', value: fmt(fin.annualRevenue) },
        { label: fin.inventoryDifference > 0 ? 'Excedente' : 'Faltante', value: fmt(Math.abs(fin.inventoryDifference)) },
      ]))}

      ${section('2. Capital por categoría', barChart(
        fin.capitalByCategory.map(c => ({ label: c.category, value: c.value, pct: c.pct })),
        '#c41e2a'
      ) + table(['Categoría', 'Unidades', 'Valor', '% del total'],
        fin.capitalByCategory.map(c => [c.category, String(c.units), fmt(c.value), fmtPct(c.pct)])
      ))}

      ${section('3. Capital por bodega', barChart(
        fin.capitalByWarehouse.map(w => ({ label: w.warehouse, value: w.value, pct: w.pct })),
        '#2563eb'
      ) + table(['Bodega', 'Unidades', 'Valor', '% del total'],
        fin.capitalByWarehouse.map(w => [w.warehouse, String(w.units), fmt(w.value), fmtPct(w.pct)])
      ))}

      ${section('4. Salud del inventario', barChart(
        healthItems.map(h => ({ label: h.label, value: h.value, pct: h.pct })),
        '#16a34a'
      ) + kpiRow([
        { label: 'Inv. saludable', value: fmt(fin.healthyInventoryValue) },
        { label: 'Inv. lento (>180d)', value: fmt(fin.slowInventoryValue) },
        { label: 'Inv. muerto (>365d)', value: fmt(fin.deadInventoryValue) },
        { label: '% lento', value: fmtPct(fin.slowInventoryPct) },
        { label: '% muerto', value: fmtPct(fin.deadInventoryPct) },
      ]))}

      ${section('5. Capital invertido — Top productos', table(
        ['SKU', 'Producto', 'Stock', 'Costo ud.', 'Valor inv.', 'Venta/mes', 'Días stock', 'Margen'],
        fin.topCapitalProducts.map(p => [p.sku, p.name, String(p.stock), fmt(p.cost), fmt(p.value), p.monthlySales.toFixed(1), p.daysOfStock > 900 ? '>1 año' : `${p.daysOfStock}d`, `${p.margin}%`])
      ))}

      ${section('6. Inventario lento (cobertura >90 días)', kpiRow([
        { label: 'Capital detenido (>180d)', value: fmt(fin.slowInventoryValue) },
        { label: 'Inv. muerto (>365d)', value: fmt(fin.deadInventoryValue) },
        { label: 'Productos lentos', value: String(fin.slowInventory.length) },
        { label: '% del capital total', value: fmtPct(fin.slowInventoryPct) },
      ]) + table(
        ['SKU', 'Producto', 'Categoría', 'Stock', 'Valor', 'Cobertura', 'Venta/mes', '% total'],
        fin.slowInventory.map(s => [s.sku, s.name, s.category, String(s.stock), fmt(s.value), s.coverageDays > 900 ? '>1 año' : `${s.coverageDays}d (${s.coverageMonths.toFixed(1)}m)`, s.monthlySales.toFixed(2), fmtPct(s.pctOfTotal)])
      ))}

      ${section('7. Rotación por categoría', table(
        ['Categoría', 'COGS anual', 'Inv. promedio', 'Rotación', 'Días inventario'],
        fin.rotationByCategory.map(r => [r.category, fmt(r.annualCOGS), fmt(r.avgInventory), `${r.rotation.toFixed(2)}x`, `${r.daysOfInventory}d`])
      ))}

      ${section('8. ROI por producto — Mayor retorno', table(
        ['#', 'Producto', 'Valor inv.', 'Utilidad anual', 'ROI'],
        fin.topROIProducts.map((p, i) => [String(i + 1), p.name, fmt(p.value), fmt(p.annualProfit), fmtPct(p.roi)])
      ))}

      ${section('8b. ROI por producto — Menor retorno', table(
        ['#', 'Producto', 'Valor inv.', 'Utilidad anual', 'ROI'],
        fin.worstROIProducts.map((p, i) => [String(i + 1), p.name, fmt(p.value), fmt(p.annualProfit), fmtPct(p.roi)])
      ))}

      ${section('9. Simulación de crecimiento', table(
        ['Escenario', 'Ventas actuales', 'Ventas objetivo', 'Inv. actual', 'Inv. requerido', 'Capital adicional', 'Utilidad est.', 'Impacto flujo'],
        fin.growthScenarios.map(g => [g.label, fmt(g.currentRevenue), fmt(g.targetRevenue), fmt(g.currentInventory), fmt(g.requiredInventory), fmt(g.additionalCapital), fmt(g.estimatedProfit), fmt(g.cashFlowImpact)])
      ) + (() => {
        const dup = fin.growthScenarios.find(g => g.factor === 2);
        return dup ? kpiRow([
          { label: 'Para duplicar ventas', value: '' },
          { label: 'Ventas actuales', value: fmt(dup.currentRevenue) },
          { label: 'Ventas objetivo (2x)', value: fmt(dup.targetRevenue) },
          { label: 'Inversión adicional', value: fmt(dup.additionalCapital) },
          { label: 'Utilidad estimada', value: fmt(dup.estimatedProfit) },
        ]) : '';
      })() + kpiRow([
        { label: 'Compras recomendadas', value: fmt(fin.purchasePlanValue) },
        { label: 'Inventario actual', value: fmt(fin.totalInventoryValue) },
        { label: 'Inventario post-compra', value: fmt(fin.totalInventoryValue + fin.purchasePlanValue) },
      ]))}

      <div class="footer"><span>REDBUCK EQUIPMENT — Reporte confidencial</span><span>${new Date().toLocaleString('es-MX')}</span></div>
      <script>setTimeout(()=>{window.print();},600);</script>
    </body></html>`);
    w.document.close();
  };

  // Chart data for capital distribution
  const capitalPieData = fin.capitalByCategory.map(c => ({ name: c.category, value: c.value }));
  const warehousePieData = fin.capitalByWarehouse.map(w => ({ name: w.warehouse, value: w.value }));

  const healthPieData = [
    { name: 'Saludable', value: fin.healthyInventoryValue },
    { name: 'Lento (>180d)', value: fin.slowInventoryValue - fin.deadInventoryValue },
    { name: 'Muerto (>365d)', value: fin.deadInventoryValue },
  ].filter(d => d.value > 0);
  const healthColors = ['hsl(142,71%,45%)', 'hsl(38,92%,50%)', 'hsl(0,78%,45%)'];

  const growthChartData = fin.growthScenarios.map(g => ({
    name: g.label,
    'Inv. requerido': g.requiredInventory,
    'Capital adicional': g.additionalCapital,
    'Utilidad est.': g.estimatedProfit,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <Calculator size={20} className="text-primary-foreground" />
            </div>
            Simulador Financiero de Inventario
          </h1>
          <p className="page-subtitle">Análisis de impacto financiero, ROI y simulación de crecimiento</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportAllExcel}>
            <FileSpreadsheet size={14} className="mr-1" /> Excel Completo
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportPdf}>
            <Download size={14} className="mr-1" /> PDF Completo
          </Button>
        </div>
      </div>

      {/* ═══ TOP KPIs ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard icon={DollarSign} label="Capital en inventario" value={fmt(fin.totalInventoryValue)}
          color="primary" />
        <KpiCard icon={AlertTriangle} label="Capital detenido" value={fmt(fin.slowInventoryValue)}
          subtitle={`${fmtPct(fin.slowInventoryPct)} del total`} color="warning" />
        <KpiCard icon={Activity} label="Rotación anual" value={`${fin.inventoryRotation.toFixed(1)}x`}
          subtitle={`${fin.daysOfInventory} días promedio`}
          color={fin.inventoryRotation >= 3 ? 'success' : fin.inventoryRotation >= 1.5 ? 'primary' : 'warning'} />
        <KpiCard icon={TrendingUp} label="ROI inventario" value={fmtPct(fin.roi)}
          subtitle={`Utilidad: ${fmt(fin.annualProfit)}`}
          color={fin.roi >= 50 ? 'success' : fin.roi >= 20 ? 'primary' : 'destructive'} />
        <KpiCard icon={Layers} label="Inv. necesario (ventas actuales)" value={fmt(fin.requiredInventoryForCurrentSales)}
          subtitle={fin.inventoryDifference > 0 ? `Excedente: ${fmt(fin.inventoryDifference)}` : `Faltante: ${fmt(Math.abs(fin.inventoryDifference))}`}
          color={fin.inventoryDifference > 0 ? 'warning' : 'destructive'} />
      </div>

      {/* ═══ TABS ═══ */}
      <Tabs defaultValue="capital" className="space-y-4">
        <TabsList className="grid grid-cols-5 w-full max-w-2xl">
          <TabsTrigger value="capital">Capital invertido</TabsTrigger>
          <TabsTrigger value="slow">Inv. lento</TabsTrigger>
          <TabsTrigger value="rotation">Rotación</TabsTrigger>
          <TabsTrigger value="roi">ROI por producto</TabsTrigger>
          <TabsTrigger value="growth">Simulación</TabsTrigger>
        </TabsList>

        {/* ── TAB 1: Capital invertido ── */}
        <TabsContent value="capital" className="space-y-6">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => handleExportExcel('capital')}>
              <FileSpreadsheet size={14} className="mr-1" /> Excel
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Por categoría */}
            <div className="bg-card rounded-xl border p-5">
              <h3 className="font-display font-semibold mb-4 text-sm">Capital por categoría</h3>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={capitalPieData} cx="50%" cy="50%" outerRadius={85} innerRadius={40} dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {capitalPieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmt(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Por bodega */}
            <div className="bg-card rounded-xl border p-5">
              <h3 className="font-display font-semibold mb-4 text-sm">Capital por bodega</h3>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={warehousePieData} cx="50%" cy="50%" outerRadius={85} innerRadius={40} dataKey="value"
                    label={({ name, percent }) => `${name.replace('Bodega ', '')} ${(percent * 100).toFixed(0)}%`}>
                    {warehousePieData.map((_, i) => <Cell key={i} fill={COLORS[(i + 3) % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmt(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Salud del inventario */}
            <div className="bg-card rounded-xl border p-5">
              <h3 className="font-display font-semibold mb-4 text-sm">Salud del inventario</h3>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={healthPieData} cx="50%" cy="50%" outerRadius={85} innerRadius={40} dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {healthPieData.map((_, i) => <Cell key={i} fill={healthColors[i]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmt(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Tabla top capital */}
          <div className="bg-card rounded-xl border overflow-x-auto">
            <div className="p-4 border-b">
              <h3 className="font-display font-semibold text-sm">Top productos por capital invertido</h3>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>SKU</th><th>Producto</th><th>Stock</th><th>Costo ud.</th>
                  <th>Valor inv.</th><th>Venta/mes</th><th>Días stock</th><th>Margen</th>
                </tr>
              </thead>
              <tbody>
                {fin.topCapitalProducts.map(p => (
                  <tr key={p.sku}>
                    <td className="font-mono text-xs">{p.sku}</td>
                    <td className="font-medium">{p.name}</td>
                    <td>{p.stock}</td>
                    <td className="text-muted-foreground">{fmt(p.cost)}</td>
                    <td className="font-bold">{fmt(p.value)}</td>
                    <td>{p.monthlySales.toFixed(1)}</td>
                    <td>
                      <span className={`font-semibold ${p.daysOfStock > 180 ? 'text-destructive' : p.daysOfStock > 90 ? 'text-warning' : 'text-success'}`}>
                        {p.daysOfStock > 900 ? '>1 año' : `${p.daysOfStock}d`}
                      </span>
                    </td>
                    <td>
                      <span className={`font-semibold ${p.margin >= 40 ? 'text-success' : p.margin >= 30 ? 'text-primary' : 'text-destructive'}`}>
                        {p.margin}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Detalle por categoría */}
          <div className="bg-card rounded-xl border overflow-x-auto">
            <div className="p-4 border-b">
              <h3 className="font-display font-semibold text-sm">Detalle por categoría</h3>
            </div>
            <table className="data-table">
              <thead>
                <tr><th>Categoría</th><th>Unidades</th><th>Valor</th><th>% del total</th></tr>
              </thead>
              <tbody>
                {fin.capitalByCategory.map(c => (
                  <tr key={c.category}>
                    <td className="font-medium">{c.category}</td>
                    <td>{c.units}</td>
                    <td className="font-bold">{fmt(c.value)}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-muted rounded-full h-2">
                          <div className="h-2 rounded-full bg-primary" style={{ width: `${Math.min(c.pct, 100)}%` }} />
                        </div>
                        <span className="text-xs font-semibold">{fmtPct(c.pct)}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* ── TAB 2: Inventario lento ── */}
        <TabsContent value="slow" className="space-y-6">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => handleExportExcel('slow')}>
              <FileSpreadsheet size={14} className="mr-1" /> Excel
            </Button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard icon={DollarSign} label="Capital detenido (>180d)" value={fmt(fin.slowInventoryValue)} color="warning" />
            <KpiCard icon={AlertTriangle} label="Inventario muerto (>365d)" value={fmt(fin.deadInventoryValue)} color="destructive" />
            <KpiCard icon={Layers} label="Productos lentos" value={fin.slowInventory.length} color="warning" />
            <KpiCard icon={TrendingDown} label="% del capital total" value={fmtPct(fin.slowInventoryPct)} color="destructive" />
          </div>

          <div className="bg-card rounded-xl border overflow-x-auto">
            <div className="p-4 border-b">
              <h3 className="font-display font-semibold text-sm">Productos con inventario lento</h3>
              <p className="text-xs text-muted-foreground">Productos con cobertura mayor a 90 días</p>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>SKU</th><th>Producto</th><th>Categoría</th><th>Stock</th>
                  <th>Valor</th><th>Cobertura</th><th>Venta/mes</th><th>% del total</th>
                </tr>
              </thead>
              <tbody>
                {fin.slowInventory.map(s => (
                  <tr key={s.sku}>
                    <td className="font-mono text-xs">{s.sku}</td>
                    <td className="font-medium">{s.name}</td>
                    <td className="text-muted-foreground capitalize">{s.category}</td>
                    <td>{s.stock}</td>
                    <td className="font-bold">{fmt(s.value)}</td>
                    <td>
                      <span className={`font-semibold ${s.coverageDays > 365 ? 'text-destructive' : s.coverageDays > 180 ? 'text-warning' : 'text-primary'}`}>
                        {s.coverageDays > 900 ? '>1 año' : `${s.coverageDays}d`} ({s.coverageMonths.toFixed(1)}m)
                      </span>
                    </td>
                    <td className="text-muted-foreground">{s.monthlySales.toFixed(2)}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-12 bg-muted rounded-full h-1.5">
                          <div className="h-1.5 rounded-full bg-warning" style={{ width: `${Math.min(s.pctOfTotal, 100)}%` }} />
                        </div>
                        <span className="text-xs">{fmtPct(s.pctOfTotal)}</span>
                      </div>
                    </td>
                  </tr>
                ))}
                {fin.slowInventory.length === 0 && (
                  <tr><td colSpan={8} className="text-center text-muted-foreground py-8">Sin inventario lento detectado</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* ── TAB 3: Rotación ── */}
        <TabsContent value="rotation" className="space-y-6">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => handleExportExcel('rotation')}>
              <FileSpreadsheet size={14} className="mr-1" /> Excel
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-card rounded-xl border p-5">
              <h3 className="font-display font-semibold mb-4 text-sm">Rotación por categoría</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={fin.rotationByCategory} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="category" type="category" tick={{ fontSize: 11 }} width={100} />
                  <Tooltip formatter={(v: number) => `${v.toFixed(2)}x`} />
                  <Bar dataKey="rotation" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name="Rotación anual" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-card rounded-xl border p-5">
              <h3 className="font-display font-semibold mb-4 text-sm">Días de inventario por categoría</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={fin.rotationByCategory} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="category" type="category" tick={{ fontSize: 11 }} width={100} />
                  <Tooltip formatter={(v: number) => `${v} días`} />
                  <Bar dataKey="daysOfInventory" fill="hsl(var(--warning))" radius={[0, 4, 4, 0]} name="Días" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-card rounded-xl border overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr><th>Categoría</th><th>COGS anual</th><th>Inv. promedio</th><th>Rotación</th><th>Días inventario</th></tr>
              </thead>
              <tbody>
                {fin.rotationByCategory.map(r => (
                  <tr key={r.category}>
                    <td className="font-medium">{r.category}</td>
                    <td>{fmt(r.annualCOGS)}</td>
                    <td>{fmt(r.avgInventory)}</td>
                    <td>
                      <span className={`font-bold ${r.rotation >= 3 ? 'text-success' : r.rotation >= 1.5 ? 'text-primary' : 'text-destructive'}`}>
                        {r.rotation.toFixed(2)}x
                      </span>
                    </td>
                    <td>
                      <span className={`font-semibold ${r.daysOfInventory > 180 ? 'text-destructive' : r.daysOfInventory > 90 ? 'text-warning' : 'text-success'}`}>
                        {r.daysOfInventory}d
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* ── TAB 4: ROI por producto ── */}
        <TabsContent value="roi" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top ROI */}
            <div className="bg-card rounded-xl border overflow-x-auto">
              <div className="p-4 border-b">
                <h3 className="font-display font-semibold text-sm flex items-center gap-2">
                  <ArrowUpRight size={16} className="text-success" /> Mayor retorno sobre inventario
                </h3>
              </div>
              <table className="data-table">
                <thead>
                  <tr><th>#</th><th>Producto</th><th>Valor inv.</th><th>Utilidad anual</th><th>ROI</th></tr>
                </thead>
                <tbody>
                  {fin.topROIProducts.map((p, i) => (
                    <tr key={p.sku}>
                      <td className="font-bold text-success">{i + 1}</td>
                      <td className="font-medium">{p.name}</td>
                      <td className="text-muted-foreground">{fmt(p.value)}</td>
                      <td className="font-semibold text-success">{fmt(p.annualProfit)}</td>
                      <td><span className="font-bold text-success">{fmtPct(p.roi)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Worst ROI */}
            <div className="bg-card rounded-xl border overflow-x-auto">
              <div className="p-4 border-b">
                <h3 className="font-display font-semibold text-sm flex items-center gap-2">
                  <ArrowDownRight size={16} className="text-destructive" /> Menor retorno sobre inventario
                </h3>
              </div>
              <table className="data-table">
                <thead>
                  <tr><th>#</th><th>Producto</th><th>Valor inv.</th><th>Utilidad anual</th><th>ROI</th></tr>
                </thead>
                <tbody>
                  {fin.worstROIProducts.map((p, i) => (
                    <tr key={p.sku}>
                      <td className="font-bold text-destructive">{i + 1}</td>
                      <td className="font-medium">{p.name}</td>
                      <td className="text-muted-foreground">{fmt(p.value)}</td>
                      <td className="font-semibold">{fmt(p.annualProfit)}</td>
                      <td><span className={`font-bold ${p.roi < 20 ? 'text-destructive' : 'text-warning'}`}>{fmtPct(p.roi)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ROI chart */}
          <div className="bg-card rounded-xl border p-5">
            <h3 className="font-display font-semibold mb-4 text-sm">Capital invertido vs Utilidad anual</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={fin.topCapitalProducts.slice(0, 8)}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Legend />
                <Bar dataKey="value" fill="hsl(var(--primary))" name="Capital invertido" radius={[4, 4, 0, 0]} />
                <Bar dataKey="annualProfit" fill="hsl(var(--success))" name="Utilidad anual" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </TabsContent>

        {/* ── TAB 5: Simulación de crecimiento ── */}
        <TabsContent value="growth" className="space-y-6">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => handleExportExcel('growth')}>
              <FileSpreadsheet size={14} className="mr-1" /> Excel
            </Button>
          </div>

          {/* Scenario cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {fin.growthScenarios.map(g => (
              <div key={g.label} className="bg-card rounded-xl border p-5 hover:shadow-lg hover:border-primary/30 transition-all">
                <div className="text-center mb-3">
                  <div className="text-lg font-bold text-primary">{g.label}</div>
                  <div className="text-xs text-muted-foreground">Escenario de crecimiento</div>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Ventas objetivo</span>
                    <span className="font-bold">{fmt(g.targetRevenue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Inv. requerido</span>
                    <span className="font-bold">{fmt(g.requiredInventory)}</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between">
                    <span className="text-muted-foreground">Capital adicional</span>
                    <span className="font-bold text-destructive">{fmt(g.additionalCapital)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Utilidad est.</span>
                    <span className="font-bold text-success">{fmt(g.estimatedProfit)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Impacto flujo</span>
                    <span className={`font-bold ${g.cashFlowImpact >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {fmt(g.cashFlowImpact)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Growth chart */}
          <div className="bg-card rounded-xl border p-5">
            <h3 className="font-display font-semibold mb-4 text-sm">Comparación de escenarios</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={growthChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${(v / 1_000_000).toFixed(1)}M`} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Legend />
                <Bar dataKey="Inv. requerido" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Capital adicional" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Utilidad est." fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Highlight: duplicate sales */}
          <div className="bg-card rounded-xl border p-6" style={{ borderLeft: '4px solid hsl(var(--primary))' }}>
            <h3 className="font-display font-semibold text-lg mb-3 flex items-center gap-2">
              <Zap size={20} className="text-primary" />
              ¿Cuánto necesito para duplicar ventas?
            </h3>
            {(() => {
              const dup = fin.growthScenarios.find(g => g.factor === 2);
              if (!dup) return null;
              return (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-muted/50 rounded-lg p-4 text-center">
                    <div className="text-xs text-muted-foreground mb-1">Ventas actuales</div>
                    <div className="font-bold text-lg">{fmt(dup.currentRevenue)}</div>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-4 text-center">
                    <div className="text-xs text-muted-foreground mb-1">Ventas objetivo (2x)</div>
                    <div className="font-bold text-lg text-primary">{fmt(dup.targetRevenue)}</div>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-4 text-center">
                    <div className="text-xs text-muted-foreground mb-1">Inversión adicional</div>
                    <div className="font-bold text-lg text-destructive">{fmt(dup.additionalCapital)}</div>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-4 text-center">
                    <div className="text-xs text-muted-foreground mb-1">Utilidad estimada (anual)</div>
                    <div className="font-bold text-lg text-success">{fmt(dup.estimatedProfit)}</div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Capital for purchase plan */}
          <div className="bg-card rounded-xl border p-5">
            <h3 className="font-display font-semibold text-sm mb-3 flex items-center gap-2">
              <Warehouse size={16} className="text-primary" /> Capital requerido para plan de compras actual
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <div className="text-xs text-muted-foreground mb-1">Compras recomendadas</div>
                <div className="font-bold text-lg">{fmt(fin.purchasePlanValue)}</div>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <div className="text-xs text-muted-foreground mb-1">Inventario actual</div>
                <div className="font-bold text-lg">{fmt(fin.totalInventoryValue)}</div>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <div className="text-xs text-muted-foreground mb-1">Inventario post-compra</div>
                <div className="font-bold text-lg text-primary">{fmt(fin.totalInventoryValue + fin.purchasePlanValue)}</div>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── KPI card helper ────────────────────────────────────────────────
function KpiCard({ icon: Icon, label, value, subtitle, color = 'primary' }: {
  icon: any; label: string; value: string | number; subtitle?: string; color?: string;
}) {
  const colorMap: Record<string, string> = {
    primary: 'hsl(var(--primary))',
    success: 'hsl(var(--success))',
    warning: 'hsl(var(--warning))',
    destructive: 'hsl(var(--destructive))',
  };
  return (
    <div className="bg-card rounded-xl border p-4" style={{ borderLeft: `4px solid ${colorMap[color] ?? colorMap.primary}` }}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
        <Icon size={14} /> {label}
      </div>
      <div className="text-xl font-bold">{value}</div>
      {subtitle && <div className="text-[10px] text-muted-foreground mt-1">{subtitle}</div>}
    </div>
  );
}
