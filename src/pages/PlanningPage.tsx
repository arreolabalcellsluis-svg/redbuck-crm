import { useState, useMemo, Fragment } from 'react';
import { getCompanyLogoUrl } from '@/hooks/useCompanyLogo';
import { useAppContext } from '@/contexts/AppContext';
import {
  getPlanningSummary, simulateGrowth,
  type ProductAnalysis,
} from '@/lib/planningEngine';
import { usePlanningData } from '@/hooks/usePlanningData';
import { exportToExcel } from '@/components/shared/ReportFilterBar';
import MetricCard from '@/components/shared/MetricCard';
import {
  AlertTriangle, TrendingUp, Package, DollarSign, Truck, BarChart3,
  ShieldAlert, Zap, Star, ArrowUpDown, Crown, Skull, Clock, Target,
  Calculator, Warehouse, ShoppingCart, Filter, ChevronDown, ChevronUp, Copy,
  Download, FileSpreadsheet,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);
const fmtNum = (n: number) =>
  new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1 }).format(n);

type TabKey = 'dashboard' | 'demanda' | 'reorden' | 'compras' | 'simulador' | 'inventario' | 'muerto' | 'estrategico' | 'crecimiento';

const TABS: { key: TabKey; label: string; icon: any }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  { key: 'demanda', label: 'Demanda', icon: TrendingUp },
  { key: 'reorden', label: 'Reorden', icon: AlertTriangle },
  { key: 'compras', label: 'Planeador Compras', icon: ShoppingCart },
  { key: 'simulador', label: 'Simulador Import', icon: Truck },
  { key: 'inventario', label: 'Inventario Ideal', icon: Warehouse },
  { key: 'muerto', label: 'Inv. Muerto', icon: Skull },
  { key: 'estrategico', label: 'Clasificación', icon: Star },
  { key: 'crecimiento', label: 'Crecimiento', icon: Target },
];

const RISK_CONFIG = {
  critico: { label: 'Crítico', className: 'bg-destructive/10 text-destructive border-destructive/30' },
  alerta: { label: 'Alerta', className: 'bg-warning/10 text-warning border-warning/30' },
  ok: { label: 'OK', className: 'bg-success/10 text-success border-success/30' },
  excedente: { label: 'Excedente', className: 'bg-accent text-accent-foreground border-accent' },
};

const CAT_CONFIG = {
  estrella: { label: '⭐ Estrella', desc: 'Alta venta + Alta rentabilidad', color: 'text-warning' },
  rotacion: { label: '🔄 Rotación', desc: 'Alta venta + Menor margen', color: 'text-primary' },
  premium: { label: '💎 Premium', desc: 'Alta rentabilidad + Menor rotación', color: 'text-success' },
  problematico: { label: '⚠️ Problemático', desc: 'Baja venta + Bajo margen', color: 'text-destructive' },
};

export default function PlanningPage() {
  const { currentRole } = useAppContext();
  const [tab, setTab] = useState<TabKey>('dashboard');
  const [planningDate, setPlanningDate] = useState(new Date().toISOString().split('T')[0]);
  const [sortField, setSortField] = useState<string>('');
  const [sortAsc, setSortAsc] = useState(true);
  const [purchaseSearch, setPurchaseSearch] = useState('');
  const [purchaseCat, setPurchaseCat] = useState('');
  const [purchasePriority, setPurchasePriority] = useState('');
  const [categoryDialog, setCategoryDialog] = useState<keyof typeof CAT_CONFIG | null>(null);

  // Simulation state — multi-product import costing
  interface SimLine {
    productId: string;
    costoUnitario: number;
    qty: number;
    fleteLocal: number;
    igiPct: number;
    cbm: number;
    margenPct: number;
  }
  const defaultLine = (): SimLine => {
    const p = products[0];
    return { productId: p?.id ?? '', costoUnitario: p?.cost ?? 0, qty: 10, fleteLocal: 0, igiPct: 5, cbm: 0.5, margenPct: 35 };
  };
  const [simLines, setSimLines] = useState<SimLine[]>([defaultLine()]);
  // Shared shipment costs
  const [costoAduana, setCostoAduana] = useState(35000);
  const [costoFleteMaritimo, setCostoFleteMaritimo] = useState(50000);
  const [ivaPct] = useState(16);

  const [growthFactor, setGrowthFactor] = useState(2);

  const { analyses, summary: summaryFromHook, products } = usePlanningData();
  const summary = summaryFromHook;
  const growth = useMemo(() => simulateGrowth(analyses, growthFactor), [analyses, growthFactor]);

  // Import costing calculations
  const simCalc = useMemo(() => {
    const lines = simLines.map(line => {
      const product = products.find(p => p.id === line.productId);
      const valorTotal = (line.costoUnitario || 0) * (line.qty || 0);
      const volumenTotal = (line.cbm || 0) * (line.qty || 0);
      const igiMonto = valorTotal * ((line.igiPct || 0) / 100);
      return { ...line, product, valorTotal, volumenTotal, igiMonto };
    });

    const valorEmbarque = lines.reduce((s, l) => s + l.valorTotal, 0) || 1; // avoid /0
    const volumenEmbarque = lines.reduce((s, l) => s + l.volumenTotal, 0) || 1;
    const baseImponible = lines.reduce((s, l) => s + l.valorTotal + l.igiMonto, 0);
    const ivaTotal = baseImponible * (ivaPct / 100);

    return lines.map(l => {
      const propValor = l.valorTotal / valorEmbarque;
      const propVolumen = l.volumenTotal / volumenEmbarque;
      const factor = propValor * 0.5 + propVolumen * 0.5;

      const aduanaAsignada = factor * costoAduana;
      const fleteMarAsignado = factor * costoFleteMaritimo;
      const ivaAsignado = factor * ivaTotal;

      const costoTotalImportado = l.valorTotal + (l.fleteLocal || 0) + l.igiMonto + aduanaAsignada + fleteMarAsignado + ivaAsignado;
      const costoUnitarioFinal = l.qty > 0 ? costoTotalImportado / l.qty : 0;
      const precioVenta = costoUnitarioFinal * (1 + (l.margenPct || 0) / 100);
      const utilidadUnit = precioVenta - costoUnitarioFinal;
      const utilidadTotal = utilidadUnit * (l.qty || 0);

      return {
        ...l,
        aduanaAsignada,
        fleteMarAsignado,
        ivaAsignado,
        costoTotalImportado,
        costoUnitarioFinal,
        precioVenta,
        utilidadUnit,
        utilidadTotal,
      };
    });
  }, [simLines, costoAduana, costoFleteMaritimo, ivaPct]);

  const simTotals = useMemo(() => ({
    totalQty: simCalc.reduce((s, r) => s + (r.qty || 0), 0),
    totalValor: simCalc.reduce((s, r) => s + r.valorTotal, 0),
    totalCostoImportado: simCalc.reduce((s, r) => s + r.costoTotalImportado, 0),
    totalUtilidadTotal: simCalc.reduce((s, r) => s + r.utilidadTotal, 0),
    totalVenta: simCalc.reduce((s, r) => s + r.precioVenta * (r.qty || 0), 0),
  }), [simCalc]);

  const updateSimLine = (index: number, field: keyof SimLine, value: string | number) => {
    setSimLines(prev => prev.map((l, i) => i === index ? { ...l, [field]: value } : l));
  };
  const addSimLine = () => setSimLines(prev => [...prev, defaultLine()]);
  const duplicateSimLine = (index: number) => setSimLines(prev => [...prev, { ...prev[index] }]);
  const removeSimLine = (index: number) => setSimLines(prev => prev.length > 1 ? prev.filter((_, i) => i !== index) : prev);

  // Access control
  const allowed = ['director', 'administracion', 'compras'].includes(currentRole);
  if (!allowed) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <ShieldAlert size={48} className="text-destructive" />
        <h2 className="text-xl font-bold">Acceso restringido</h2>
        <p className="text-muted-foreground">Este módulo está disponible solo para Director, Administración y Compras.</p>
      </div>
    );
  }

  // Sort helper — default sort by importance per tab when no explicit sort
  const riskOrder: Record<string, number> = { critico: 0, alerta: 1, ok: 2, excedente: 3 };
  const catOrder: Record<string, number> = { estrella: 0, rotacion: 1, premium: 2, problematico: 3 };

  const sortedAnalyses = [...analyses].sort((a, b) => {
    if (sortField) {
      const valA = (a as any)[sortField] ?? 0;
      const valB = (b as any)[sortField] ?? 0;
      return sortAsc ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
    }
    // Default sort per tab: most important first
    switch (tab) {
      case 'demanda':
        return b.monthlySales - a.monthlySales; // highest demand first
      case 'reorden':
        return a.daysOfStock - b.daysOfStock; // lowest coverage first (most urgent)
      case 'inventario':
        return b.stockDifference - a.stockDifference; // largest deficit first
      case 'estrategico':
        return catOrder[a.category] !== catOrder[b.category]
          ? catOrder[a.category] - catOrder[b.category]
          : b.annualRevenue - a.annualRevenue; // stars first, then by revenue
      default:
        return 0;
    }
  });

  const toggleSort = (field: string) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(true); }
  };

  const SortIcon = ({ field }: { field: string }) => (
    <button onClick={() => toggleSort(field)} className="inline-flex ml-1 text-muted-foreground hover:text-foreground">
      {sortField === field ? (sortAsc ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : <ArrowUpDown size={12} />}
    </button>
  );

  // ─── Chart data ───────────────────────────────────────────────────
  const riskChartData = [
    { name: 'Crítico', value: summary.criticalProducts, fill: 'hsl(var(--destructive))' },
    { name: 'Alerta', value: summary.alertProducts, fill: 'hsl(var(--warning))' },
    { name: 'OK', value: summary.totalProducts - summary.criticalProducts - summary.alertProducts - summary.excessProducts, fill: 'hsl(var(--success))' },
    { name: 'Excedente', value: summary.excessProducts, fill: 'hsl(var(--accent))' },
  ];

  const catChartData = [
    { name: 'Estrella', value: summary.estrellas, fill: 'hsl(var(--warning))' },
    { name: 'Rotación', value: summary.rotacion, fill: 'hsl(var(--primary))' },
    { name: 'Premium', value: summary.premium, fill: 'hsl(var(--success))' },
    { name: 'Problemático', value: summary.problematicos, fill: 'hsl(var(--destructive))' },
  ];

  // ─── Export helpers ─────────────────────────────────────────────
  const CAT_LABELS: Record<string, string> = { elevadores: 'Elevadores', balanceadoras: 'Balanceadoras', desmontadoras: 'Desmontadoras', alineadoras: 'Alineadoras', hidraulico: 'Hidráulico', lubricacion: 'Lubricación', aire: 'Aire', otros: 'Otros' };

  const handleExportAllExcel = async () => {
    const XLSX = await import('xlsx');
    const { saveAs } = await import('file-saver');
    const wb = XLSX.utils.book_new();

    // 1. Dashboard KPIs
    const dashKpis = [
      { Indicador: 'Reporte', Valor: 'Planeación de Inventario — Completo' },
      { Indicador: 'Generado', Valor: new Date().toLocaleString('es-MX') },
      { Indicador: 'Productos en riesgo', Valor: summary.criticalProducts },
      { Indicador: 'Alertas de reorden', Valor: summary.alertProducts },
      { Indicador: 'Capital necesario', Valor: summary.capitalNeeded },
      { Indicador: 'Inventario muerto', Valor: summary.deadStockValue },
      { Indicador: 'Valor inventario total', Valor: summary.totalStockValue },
      { Indicador: 'Prod. Estrella', Valor: summary.estrellas },
      { Indicador: 'Prod. Rotación', Valor: summary.rotacion },
      { Indicador: 'Prod. Premium', Valor: summary.premium },
      { Indicador: 'Prod. Problemáticos', Valor: summary.problematicos },
      { Indicador: 'Compra sugerida valor', Valor: summary.suggestedPurchaseValue },
      { Indicador: 'Próxima compra valor', Valor: summary.nextPurchaseValue },
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dashKpis), 'Dashboard KPIs');

    // 2. Productos urgentes (dashboard)
    const urgentData = analyses
      .filter(a => a.riskLevel === 'critico' || a.riskLevel === 'alerta')
      .sort((a, b) => (a.riskLevel === 'critico' ? -1 : 1))
      .map(a => ({
        Producto: a.product.name, 'Stock actual': a.totalStock, 'En tránsito': a.inTransit,
        'Punto reorden': a.reorderPoint, 'Demanda 3M': a.demand3m,
        'Compra sugerida': a.suggestedPurchase, Riesgo: RISK_CONFIG[a.riskLevel].label,
      }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(urgentData), 'Compra Urgente');

    // 3. Demanda
    const demandaData = analyses.map(a => ({
      Producto: a.product.name, SKU: a.product.sku, 'Venta/mes': Number(a.monthlySales.toFixed(1)),
      'Venta/trimestre': Number(a.quarterlySales.toFixed(1)), 'Venta/año': Number(a.annualSales.toFixed(1)),
      'Demanda 3M': a.demand3m, 'Demanda 6M': a.demand6m, 'Demanda 12M': a.demand12m,
      'En cotizaciones': a.quotationDemand,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(demandaData), 'Demanda');

    // 4. Reorden
    const reordenData = analyses.map(a => ({
      Producto: a.product.name, SKU: a.product.sku, 'Demanda diaria': Number(a.dailyDemand.toFixed(2)),
      'Lead Time total': a.leadTime.total, 'Punto reorden': a.reorderPoint,
      'Stock actual': a.totalStock, 'Días de stock': a.daysOfStock > 900 ? 999 : a.daysOfStock,
      Estado: RISK_CONFIG[a.riskLevel].label,
      'LT Producción': a.leadTime.production, 'LT Flete China': a.leadTime.freightChina,
      'LT Barco': a.leadTime.ocean, 'LT Aduana': a.leadTime.customs, 'LT Transporte Nal': a.leadTime.nationalTransport,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(reordenData), 'Reorden');

    // 5. Planeador Compras
    const comprasData = analyses
      .filter(a => a.suggestedPurchase > 0 && !a.shouldNotBuy)
      .sort((a, b) => {
        const po: Record<string, number> = { critico: 0, alerta: 1, ok: 2, excedente: 3 };
        return (po[a.riskLevel] ?? 3) - (po[b.riskLevel] ?? 3);
      })
      .map(a => ({
        Producto: a.product.name, SKU: a.product.sku,
        Categoría: CAT_LABELS[a.product.category] || a.product.category,
        'Existencia actual': a.totalStock, 'En tránsito': a.effectiveTransit > 0 ? a.effectiveTransit : a.inTransit || 0,
        'Ventas prom/mes': Number(a.predictiveMonthlyDemand.toFixed(1)),
        'Días de inv': a.daysOfStock > 900 ? 999 : a.daysOfStock,
        'Inv objetivo': a.idealStock, 'Compra sugerida': a.suggestedPurchase,
        Prioridad: RISK_CONFIG[a.riskLevel].label,
      }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(comprasData), 'Planeador Compras');

    // 6. Simulador Import
    if (simCalc.length > 0) {
      const simData = simCalc.map(r => ({
        SKU: r.product?.sku ?? '', Producto: r.product?.name ?? '',
        'Costo unitario': r.costoUnitario, Cantidad: r.qty, 'CBM unit': r.cbm,
        'Valor total': r.valorTotal, 'IGI %': r.igiPct, 'IGI monto': Math.round(r.igiMonto),
        'Flete local': r.fleteLocal, 'Aduana asignada': Math.round(r.aduanaAsignada),
        'Flete marítimo asig': Math.round(r.fleteMarAsignado), 'IVA asignado': Math.round(r.ivaAsignado),
        'Costo total importado': Math.round(r.costoTotalImportado),
        'Costo unit bodega': Math.round(r.costoUnitarioFinal),
        'Margen %': r.margenPct, 'Precio venta sug': Math.round(r.precioVenta),
        'Utilidad unitaria': Math.round(r.utilidadUnit), 'Utilidad total': Math.round(r.utilidadTotal),
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(simData), 'Simulador Import');
    }

    // 7. Inventario Ideal
    const invIdealData = analyses.map(a => ({
      Producto: a.product.name, SKU: a.product.sku, 'Venta mensual': Number(a.monthlySales.toFixed(1)),
      'Stock actual': a.totalStock, 'En tránsito': a.inTransit, 'Stock ideal': a.idealStock,
      Diferencia: a.stockDifference, Estado: RISK_CONFIG[a.riskLevel].label,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(invIdealData), 'Inventario Ideal');

    // 8. Inventario Muerto
    const muertoData = analyses
      .filter(a => a.daysOfStock > 90)
      .sort((a, b) => b.daysOfStock - a.daysOfStock)
      .map(a => ({
        Producto: a.product.name, SKU: a.product.sku, Categoría: a.product.category,
        Stock: a.totalStock, 'Valor inventario': a.stockValue,
        'Días de stock': a.daysOfStock > 900 ? 999 : a.daysOfStock,
        'Venta mensual': Number(a.monthlySales.toFixed(1)),
        'Acción sugerida': a.daysOfStock > 365 ? 'Liquidación' : a.daysOfStock > 180 ? 'Descuento' : 'Promoción',
      }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(muertoData), 'Inv Muerto');

    // 9. Clasificación Estratégica
    const clasifData = analyses.map(a => ({
      Producto: a.product.name, SKU: a.product.sku,
      Clasificación: CAT_CONFIG[a.category].label, 'Venta/mes': Number(a.monthlySales.toFixed(1)),
      'Margen %': a.margin, 'Ingreso anual': a.annualRevenue, 'Utilidad anual': a.annualProfit,
      Costo: a.product.cost, Precio: a.product.listPrice,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(clasifData), 'Clasificación');

    // 10. Crecimiento
    const crecData = [
      { Indicador: 'Factor crecimiento', Valor: growthFactor },
      { Indicador: 'Ingreso actual anual', Valor: growth.currentRevenue },
      { Indicador: `Ingreso objetivo (${growthFactor}x)`, Valor: growth.targetRevenue },
      { Indicador: 'Capital requerido', Valor: growth.capitalRequired },
      { Indicador: 'Utilidad estimada anual', Valor: growth.estimatedProfit },
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(crecData), 'Crecimiento');

    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `planeacion-completo_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleExportAllPdf = () => {
    const w = window.open('', '_blank');
    if (!w) return;

    const kpiRow = (items: { label: string; value: string }[]) => `
      <div style="display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap;">
        ${items.map(i => `<div style="background:#f8f8f8;padding:8px 14px;border-radius:8px;text-align:center;min-width:100px;flex:1;border-left:3px solid #c41e2a;">
          <div style="font-size:8px;color:#666;text-transform:uppercase;letter-spacing:0.5px;">${i.label}</div>
          <div style="font-size:13px;font-weight:700;margin-top:2px;">${i.value}</div>
        </div>`).join('')}
      </div>`;

    const table = (headers: string[], rows: string[][]) => `
      <table style="width:100%;border-collapse:collapse;margin-top:6px;margin-bottom:12px;">
        <thead><tr>${headers.map(h => `<th style="background:#f0f0f0;font-weight:600;text-align:left;padding:4px 6px;font-size:8px;text-transform:uppercase;border-bottom:2px solid #ddd;">${h}</th>`).join('')}</tr></thead>
        <tbody>${rows.map(r => `<tr>${r.map((c, i) => `<td style="padding:3px 6px;border-bottom:1px solid #eee;font-size:9px;text-align:${i === 0 ? 'left' : 'right'};">${c}</td>`).join('')}</tr>`).join('')}</tbody>
      </table>`;

    const section = (title: string, content: string) => `
      <div style="margin-bottom:20px;page-break-inside:avoid;">
        <h2 style="font-size:12px;font-weight:700;border-bottom:2px solid #c41e2a;padding-bottom:3px;margin-bottom:8px;">${title}</h2>
        ${content}
      </div>`;

    w.document.write(`<!DOCTYPE html><html><head><title>Planeación Completa</title><style>
      *{margin:0;padding:0;box-sizing:border-box;}
      body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:20px;color:#1a1a1a;font-size:10px;}
      .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;border-bottom:3px solid #c41e2a;padding-bottom:10px;}
      .brand{font-size:18px;font-weight:800;color:#c41e2a;letter-spacing:1px;}
      .brand-sub{font-size:8px;color:#666;letter-spacing:2px;}
      .footer{margin-top:20px;padding-top:8px;border-top:1px solid #ddd;font-size:8px;color:#999;display:flex;justify-content:space-between;}
      @media print{body{padding:10px;} @page{size:landscape;margin:8mm;}}
    </style></head><body>
      <div class="header">
        <div style="display:flex;align-items:center;gap:12px;"><img src="${getCompanyLogoUrl()}" alt="Logo" style="height:32px;max-width:100px;object-fit:contain;" onerror="this.style.display='none'" /><div><div class="brand">REDBUCK EQUIPMENT</div><div class="brand-sub">ERP · PLANEACIÓN DE INVENTARIO Y COMPRAS</div></div></div>
        <div style="text-align:right;"><div style="font-size:14px;font-weight:700;">Planeación — Reporte Integral</div>
        <div style="font-size:9px;color:#666;">Generado: ${new Date().toLocaleString('es-MX')}</div></div>
      </div>

      ${section('1. Dashboard — Indicadores', kpiRow([
        { label: 'Productos en riesgo', value: String(summary.criticalProducts) },
        { label: 'Alertas reorden', value: String(summary.alertProducts) },
        { label: 'Capital necesario', value: fmt(summary.capitalNeeded) },
        { label: 'Inv. muerto', value: fmt(summary.deadStockValue) },
      ]) + kpiRow([
        { label: 'Estrella', value: String(summary.estrellas) },
        { label: 'Rotación', value: String(summary.rotacion) },
        { label: 'Premium', value: String(summary.premium) },
        { label: 'Problemáticos', value: String(summary.problematicos) },
      ]))}

      ${section('2. Productos con compra urgente', table(
        ['Producto', 'Stock', 'Tránsito', 'Pto. reorden', 'Demanda 3M', 'Compra sug.', 'Riesgo'],
        analyses.filter(a => a.riskLevel === 'critico' || a.riskLevel === 'alerta')
          .map(a => [a.product.name, String(a.totalStock), String(a.inTransit), String(a.reorderPoint), String(a.demand3m), String(a.suggestedPurchase), RISK_CONFIG[a.riskLevel].label])
      ))}

      ${section('3. Predicción de demanda', table(
        ['Producto', 'Vta/mes', 'Vta/trim', 'Vta/año', 'Dem 3M', 'Dem 6M', 'Dem 12M', 'Cotiz.'],
        analyses.map(a => [a.product.name, a.monthlySales.toFixed(1), a.quarterlySales.toFixed(1), a.annualSales.toFixed(1), String(a.demand3m), String(a.demand6m), String(a.demand12m), String(a.quotationDemand)])
      ))}

      ${section('4. Punto de reorden', table(
        ['Producto', 'Dem. diaria', 'Lead Time', 'Pto. reorden', 'Stock', 'Días stock', 'Estado'],
        analyses.map(a => [a.product.name, a.dailyDemand.toFixed(2), `${a.leadTime.total}d`, String(a.reorderPoint), String(a.totalStock), a.daysOfStock > 900 ? '∞' : `${a.daysOfStock}d`, RISK_CONFIG[a.riskLevel].label])
      ))}

      ${section('5. Planeador de compras', table(
        ['Producto', 'Categoría', 'Stock', 'Tránsito', 'Vta/mes', 'Días inv', 'Inv obj', 'Compra sug', 'Prior.'],
        analyses.filter(a => a.suggestedPurchase > 0 && !a.shouldNotBuy)
          .map(a => [a.product.name, CAT_LABELS[a.product.category] || a.product.category, String(a.totalStock), String(a.effectiveTransit > 0 ? a.effectiveTransit : a.inTransit || 0), a.predictiveMonthlyDemand.toFixed(1), a.daysOfStock > 900 ? '∞' : `${a.daysOfStock}d`, String(a.idealStock), `${a.suggestedPurchase} uds`, RISK_CONFIG[a.riskLevel].label])
      ))}

      ${section('6. Inventario ideal (cobertura 3 meses)', table(
        ['Producto', 'Vta/mes', 'Stock', 'Tránsito', 'Stock ideal', 'Diferencia', 'Estado'],
        analyses.map(a => [a.product.name, a.monthlySales.toFixed(1), String(a.totalStock), String(a.inTransit), String(a.idealStock), a.stockDifference > 0 ? `Faltan ${a.stockDifference}` : a.stockDifference < 0 ? `Sobran ${Math.abs(a.stockDifference)}` : 'Justo', RISK_CONFIG[a.riskLevel].label])
      ))}

      ${section('7. Inventario muerto / baja rotación', kpiRow([
        { label: 'Valor sin movimiento', value: fmt(summary.deadStockValue) },
        { label: 'Productos baja rotación', value: String(analyses.filter(a => a.daysOfStock > 180).length) },
        { label: 'Valor total inventario', value: fmt(summary.totalStockValue) },
      ]) + table(
        ['Producto', 'Categoría', 'Stock', 'Valor inv', 'Días stock', 'Vta/mes', 'Acción'],
        analyses.filter(a => a.daysOfStock > 90).sort((a, b) => b.daysOfStock - a.daysOfStock)
          .map(a => [a.product.name, a.product.category, String(a.totalStock), fmt(a.stockValue), a.daysOfStock > 900 ? '>1 año' : `${a.daysOfStock}d`, a.monthlySales.toFixed(1), a.daysOfStock > 365 ? 'Liquidación' : a.daysOfStock > 180 ? 'Descuento' : 'Promoción'])
      ))}

      ${section('8. Clasificación estratégica', table(
        ['Producto', 'Clasificación', 'Vta/mes', 'Margen %', 'Ingreso anual', 'Utilidad anual', 'Costo', 'Precio'],
        analyses.map(a => [a.product.name, CAT_CONFIG[a.category].label, a.monthlySales.toFixed(1), `${a.margin}%`, fmt(a.annualRevenue), fmt(a.annualProfit), fmt(a.product.cost), fmt(a.product.listPrice)])
      ))}

      ${section('9. Simulación de crecimiento', kpiRow([
        { label: `Factor: ${growthFactor}x`, value: '' },
        { label: 'Ingreso actual', value: fmt(growth.currentRevenue) },
        { label: `Ingreso objetivo (${growthFactor}x)`, value: fmt(growth.targetRevenue) },
        { label: 'Capital requerido', value: fmt(growth.capitalRequired) },
        { label: 'Utilidad estimada', value: fmt(growth.estimatedProfit) },
      ]))}

      <div class="footer"><span>REDBUCK EQUIPMENT — Reporte confidencial</span><span>${new Date().toLocaleString('es-MX')}</span></div>
      <script>setTimeout(()=>{window.print();},600);</script>
    </body></html>`);
    w.document.close();
  };

  return (
    <div>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Planeación de Inventario y Compras</h1>
          <p className="page-subtitle">Análisis inteligente para decisiones de compra — "Qué comprar, cuándo comprar y cuánto comprar"</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">Fecha planeación:</Label>
            <Input type="date" value={planningDate} onChange={e => setPlanningDate(e.target.value)} className="w-40 h-8 text-sm" />
          </div>
          <Button variant="outline" size="sm" onClick={handleExportAllExcel}>
            <FileSpreadsheet size={14} className="mr-1" /> Excel Completo
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportAllPdf}>
            <Download size={14} className="mr-1" /> PDF Completo
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 mb-6 bg-muted/50 rounded-xl p-1">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setSortField(''); setSortAsc(true); }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
              tab === t.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══════════════════════ DASHBOARD ═══════════════════════ */}
      {tab === 'dashboard' && (
        <div className="space-y-6">
          {/* Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard title="Productos en riesgo" value={summary.criticalProducts} icon={AlertTriangle} variant="danger" />
            <MetricCard title="Alertas de reorden" value={summary.alertProducts} icon={ShieldAlert} variant="warning" />
            <MetricCard title="Capital necesario" value={fmt(summary.capitalNeeded)} icon={DollarSign} variant="primary" />
            <MetricCard title="Inventario muerto" value={fmt(summary.deadStockValue)} icon={Skull} />
          </div>

          {/* Charts row */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-card rounded-xl border p-5">
              <h3 className="font-display font-semibold mb-4">Nivel de riesgo de inventario</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={riskChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {riskChartData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-card rounded-xl border p-5">
              <h3 className="font-display font-semibold mb-4">Clasificación estratégica</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={catChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {catChartData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Critical products */}
          <div className="bg-card rounded-xl border p-5">
            <h3 className="font-display font-semibold mb-4 flex items-center gap-2">
              <AlertTriangle size={18} className="text-destructive" />
              Productos que necesitan compra urgente
            </h3>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Stock actual</th>
                    <th>En tránsito</th>
                    <th>Punto reorden</th>
                    <th>Demanda 3M</th>
                    <th>Compra sugerida</th>
                    <th>Riesgo</th>
                  </tr>
                </thead>
                <tbody>
                  {analyses
                    .filter(a => a.riskLevel === 'critico' || a.riskLevel === 'alerta')
                    .sort((a, b) => (a.riskLevel === 'critico' ? -1 : 1))
                    .map(a => (
                      <tr key={a.product.id}>
                        <td className="font-medium">{a.product.name}</td>
                        <td className="font-semibold">{a.totalStock}</td>
                        <td>{a.inTransit}</td>
                        <td>{a.reorderPoint}</td>
                        <td>{a.demand3m}</td>
                        <td className="font-bold text-primary">{a.suggestedPurchase}</td>
                        <td>
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${RISK_CONFIG[a.riskLevel].className}`}>
                            {RISK_CONFIG[a.riskLevel].label}
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Quick summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard title="Prod. Estrella" value={summary.estrellas} icon={Star} variant="warning" onClick={() => setCategoryDialog('estrella')} />
            <MetricCard title="Prod. Rotación" value={summary.rotacion} icon={Zap} variant="primary" onClick={() => setCategoryDialog('rotacion')} />
            <MetricCard title="Prod. Premium" value={summary.premium} icon={Crown} variant="success" onClick={() => setCategoryDialog('premium')} />
            <MetricCard title="Prod. Problemáticos" value={summary.problematicos} icon={Skull} variant="danger" onClick={() => setCategoryDialog('problematico')} />
          </div>

          {/* Category detail dialog */}
          <Dialog open={!!categoryDialog} onOpenChange={(open) => !open && setCategoryDialog(null)}>
            <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
              {categoryDialog && (
                <>
                  <DialogHeader>
                    <DialogTitle className={`flex items-center gap-2 ${CAT_CONFIG[categoryDialog].color}`}>
                      {CAT_CONFIG[categoryDialog].label}
                    </DialogTitle>
                    <p className="text-xs text-muted-foreground">{CAT_CONFIG[categoryDialog].desc}</p>
                  </DialogHeader>
                  <div className="mt-2">
                    {analyses.filter(a => a.category === categoryDialog).length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">No hay productos en esta categoría</p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-xs text-muted-foreground">
                            <th className="text-left py-2">SKU</th>
                            <th className="text-left py-2">Producto</th>
                            <th className="text-right py-2">Margen</th>
                            <th className="text-right py-2">Vta/mes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {analyses.filter(a => a.category === categoryDialog).map(a => (
                            <tr key={a.product.id} className="border-b border-border/50 hover:bg-muted/50">
                              <td className="py-2 font-mono text-xs">{a.product.sku}</td>
                              <td className="py-2 font-medium">{a.product.name}</td>
                              <td className={`py-2 text-right font-bold ${a.margin >= 40 ? 'text-success' : a.margin >= 30 ? 'text-primary' : 'text-destructive'}`}>{a.margin}%</td>
                              <td className="py-2 text-right">{fmtNum(a.monthlySales)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </>
              )}
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* ═══════════════════════ DEMANDA ═══════════════════════ */}
      {tab === 'demanda' && (
        <div className="bg-card rounded-xl border overflow-x-auto">
          <div className="p-5 border-b">
            <h3 className="font-display font-semibold flex items-center gap-2">
              <TrendingUp size={18} className="text-primary" />
              Predicción de demanda por producto
            </h3>
            <p className="text-xs text-muted-foreground mt-1">Basado en ventas históricas y cotizaciones activas</p>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Venta/mes <SortIcon field="monthlySales" /></th>
                <th>Venta/trimestre</th>
                <th>Venta/año</th>
                <th>Demanda 3M <SortIcon field="demand3m" /></th>
                <th>Demanda 6M</th>
                <th>Demanda 12M</th>
                <th>En cotizaciones</th>
              </tr>
            </thead>
            <tbody>
              {sortedAnalyses.map(a => (
                <tr key={a.product.id}>
                  <td className="font-medium">{a.product.name}</td>
                  <td className="font-semibold">{fmtNum(a.monthlySales)}</td>
                  <td>{fmtNum(a.quarterlySales)}</td>
                  <td>{fmtNum(a.annualSales)}</td>
                  <td className="font-bold text-primary">{a.demand3m}</td>
                  <td>{a.demand6m}</td>
                  <td>{a.demand12m}</td>
                  <td>{a.quotationDemand > 0 ? <span className="text-warning font-semibold">{a.quotationDemand}</span> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ═══════════════════════ REORDEN ═══════════════════════ */}
      {tab === 'reorden' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <MetricCard title="Productos en punto de reorden" value={analyses.filter(a => a.totalStock <= a.reorderPoint).length} icon={AlertTriangle} variant="danger" />
            <MetricCard title="Días promedio de stock" value={Math.round(analyses.reduce((s, a) => s + a.daysOfStock, 0) / analyses.length)} icon={Clock} />
            <MetricCard title="Productos OK" value={analyses.filter(a => a.riskLevel === 'ok').length} icon={Package} variant="success" />
          </div>

          <div className="bg-card rounded-xl border overflow-x-auto">
            <div className="p-5 border-b">
              <h3 className="font-display font-semibold flex items-center gap-2">
                <AlertTriangle size={18} className="text-warning" />
                Punto de reorden por producto
              </h3>
              <p className="text-xs text-muted-foreground mt-1">Fórmula: Demanda diaria × Lead Time total</p>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Demanda diaria</th>
                  <th>Lead Time</th>
                  <th>Punto reorden <SortIcon field="reorderPoint" /></th>
                  <th>Stock actual <SortIcon field="totalStock" /></th>
                  <th>Días de stock <SortIcon field="daysOfStock" /></th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {sortedAnalyses.map(a => (
                  <tr key={a.product.id} className={a.riskLevel === 'critico' ? 'bg-destructive/5' : ''}>
                    <td className="font-medium">{a.product.name}</td>
                    <td>{fmtNum(a.dailyDemand)}</td>
                    <td>{a.leadTime.total} días</td>
                    <td className="font-bold">{a.reorderPoint}</td>
                    <td className="font-semibold">{a.totalStock}</td>
                    <td>
                      <span className={a.daysOfStock < 30 ? 'text-destructive font-bold' : a.daysOfStock < 90 ? 'text-warning font-semibold' : 'text-success'}>
                        {a.daysOfStock > 900 ? '∞' : `${a.daysOfStock}d`}
                      </span>
                    </td>
                    <td>
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${RISK_CONFIG[a.riskLevel].className}`}>
                        {RISK_CONFIG[a.riskLevel].label}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Lead time detail */}
          <div className="bg-card rounded-xl border overflow-x-auto">
            <div className="p-5 border-b">
              <h3 className="font-display font-semibold flex items-center gap-2">
                <Clock size={18} className="text-primary" />
                Desglose de Lead Time por producto
              </h3>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Proveedor</th>
                  <th>Producción</th>
                  <th>Flete China</th>
                  <th>Barco</th>
                  <th>Aduana</th>
                  <th>Transporte Nal.</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {sortedAnalyses.map(a => (
                  <tr key={a.product.id}>
                    <td className="font-medium">{a.product.name}</td>
                    <td className="text-xs text-muted-foreground">{a.product.supplier}</td>
                    <td>{a.leadTime.production > 0 ? `${a.leadTime.production}d` : '—'}</td>
                    <td>{a.leadTime.freightChina > 0 ? `${a.leadTime.freightChina}d` : '—'}</td>
                    <td>{a.leadTime.ocean > 0 ? `${a.leadTime.ocean}d` : '—'}</td>
                    <td>{a.leadTime.customs > 0 ? `${a.leadTime.customs}d` : '—'}</td>
                    <td>{a.leadTime.nationalTransport}d</td>
                    <td className="font-bold text-primary">{a.leadTime.total}d</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════════════ COMPRAS ═══════════════════════ */}
      {tab === 'compras' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard title="Productos a comprar" value={analyses.filter(a => a.suggestedPurchase > 0 && !a.shouldNotBuy).length} icon={ShoppingCart} variant="primary" />
            <MetricCard title="Inversión requerida" value={fmt(summary.suggestedPurchaseValue)} icon={DollarSign} variant="warning" />
            <MetricCard title="Valor inventario actual" value={fmt(summary.totalStockValue)} icon={Warehouse} />
            <MetricCard title="Prioridad alta" value={analyses.filter(a => a.suggestedPurchase > 0 && !a.shouldNotBuy && (a.riskLevel === 'critico' || a.riskLevel === 'alerta')).length} icon={AlertTriangle} variant="danger" subtitle="SKUs requieren atención" />
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap bg-card rounded-xl border p-3">
            <Filter size={14} className="text-muted-foreground" />
            <input
              placeholder="Buscar producto..."
              value={purchaseSearch}
              onChange={e => setPurchaseSearch(e.target.value)}
              className="px-3 py-1.5 rounded-lg border bg-background text-xs w-48"
            />
            <select value={purchaseCat} onChange={e => setPurchaseCat(e.target.value)} className="px-3 py-1.5 rounded-lg border bg-background text-xs">
              <option value="">Todas las categorías</option>
              {Object.entries(
                { elevadores: 'Elevadores', balanceadoras: 'Balanceadoras', desmontadoras: 'Desmontadoras', alineadoras: 'Alineadoras', hidraulico: 'Hidráulico', lubricacion: 'Lubricación', aire: 'Aire', otros: 'Otros' }
              ).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select value={purchasePriority} onChange={e => setPurchasePriority(e.target.value)} className="px-3 py-1.5 rounded-lg border bg-background text-xs">
              <option value="">Todas las prioridades</option>
              <option value="critico">🔴 Crítico</option>
              <option value="alerta">🟠 Alerta</option>
              <option value="ok">🟡 OK</option>
            </select>
          </div>

          <div className="bg-card rounded-xl border overflow-x-auto">
            <div className="p-5 border-b">
              <h3 className="font-display font-semibold flex items-center gap-2">
                <ShoppingCart size={18} className="text-primary" />
                Recomendaciones de compra — Plan anual
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Capa de recomendación basada en datos existentes del ERP: stock, tránsito, demanda y cobertura. No modifica métricas existentes.
              </p>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Categoría</th>
                  <th>Existencia actual</th>
                  <th>Inv. en tránsito</th>
                  <th>Ventas prom./mes</th>
                  <th>Días de inv.</th>
                  <th>Inv. objetivo</th>
                  <th>Compra sugerida <SortIcon field="suggestedPurchase" /></th>
                  <th>Prioridad</th>
                  <th>Motivo</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const priorityOrder: Record<string, number> = { critico: 0, alerta: 1, ok: 2, excedente: 3 };
                  let rows = analyses
                    .filter(a => a.suggestedPurchase > 0 && !a.shouldNotBuy)
                    .map(a => {
                      // Generate reason based on existing metrics
                      const reasons: string[] = [];
                      if (a.riskLevel === 'critico') reasons.push('Stock crítico');
                      else if (a.riskLevel === 'alerta') reasons.push('Stock en alerta');
                      if (a.daysOfStock < a.leadTime.total) reasons.push(`Cobertura < lead time (${a.leadTime.total}d)`);
                      if (a.demandTrend === 'crecimiento') reasons.push('Demanda en crecimiento');
                      if (a.usefulStock <= a.reorderPoint) reasons.push('Bajo punto de reorden');
                      if (a.quotationDemand > 0) reasons.push(`${a.quotationDemand} uds en cotizaciones`);
                      if (a.daysOfStock <= 30) reasons.push('< 30 días de inventario');
                      if (reasons.length === 0) reasons.push('Reposición preventiva');
                      return { a, reasons, priority: priorityOrder[a.riskLevel] ?? 3 };
                    });

                  // Apply filters
                  if (purchaseSearch) {
                    const s = purchaseSearch.toLowerCase();
                    rows = rows.filter(r => r.a.product.name.toLowerCase().includes(s) || r.a.product.sku.toLowerCase().includes(s));
                  }
                  if (purchaseCat) rows = rows.filter(r => r.a.product.category === purchaseCat);
                  if (purchasePriority) rows = rows.filter(r => r.a.riskLevel === purchasePriority);

                  // Sort: priority first, then suggested purchase desc
                  rows.sort((a, b) => a.priority !== b.priority ? a.priority - b.priority : b.a.suggestedPurchase - a.a.suggestedPurchase);

                  if (rows.length === 0) return (
                    <tr><td colSpan={10} className="text-center text-muted-foreground py-8">No hay recomendaciones de compra con los filtros actuales</td></tr>
                  );

                  return rows.map(({ a, reasons }) => (
                    <tr key={a.product.id}>
                      <td className="font-medium text-sm">{a.product.name}</td>
                      <td className="text-xs text-muted-foreground">{
                        ({ elevadores: 'Elevadores', balanceadoras: 'Balanceadoras', desmontadoras: 'Desmontadoras', alineadoras: 'Alineadoras', hidraulico: 'Hidráulico', lubricacion: 'Lubricación', aire: 'Aire', otros: 'Otros' } as Record<string, string>)[a.product.category] || a.product.category
                      }</td>
                      <td className="text-center font-semibold">{a.totalStock}</td>
                      <td className="text-center text-primary">{a.effectiveTransit > 0 ? a.effectiveTransit : a.inTransit || 0}</td>
                      <td className="text-center">{a.predictiveMonthlyDemand.toFixed(1)}</td>
                      <td className="text-center">
                        <span className={a.daysOfStock <= 30 ? 'text-destructive font-bold' : a.daysOfStock <= 60 ? 'text-warning font-semibold' : ''}>
                          {a.daysOfStock > 900 ? '∞' : `${a.daysOfStock}d`}
                        </span>
                      </td>
                      <td className="text-center text-muted-foreground">{a.idealStock}</td>
                      <td className="text-center font-bold text-primary">{a.suggestedPurchase} uds</td>
                      <td>
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${RISK_CONFIG[a.riskLevel].className}`}>
                          {RISK_CONFIG[a.riskLevel].label}
                        </span>
                      </td>
                      <td className="text-[11px] text-muted-foreground max-w-[200px]">{reasons.join('; ')}</td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════════════ SIMULADOR ═══════════════════════ */}
      {tab === 'simulador' && (
        <div className="space-y-6">
          {/* Costos generales del embarque */}
          <div className="bg-card rounded-xl border p-5">
            <h3 className="font-display font-semibold flex items-center gap-2 mb-4">
              <Truck size={18} className="text-primary" />
              Costos generales del embarque
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Costo total aduana (MXN)</label>
                <input type="number" min={0} value={costoAduana}
                  onChange={e => setCostoAduana(+e.target.value || 0)}
                  className="w-full px-3 py-2 rounded-lg border bg-background text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Costo total flete marítimo (MXN)</label>
                <input type="number" min={0} value={costoFleteMaritimo}
                  onChange={e => setCostoFleteMaritimo(+e.target.value || 0)}
                  className="w-full px-3 py-2 rounded-lg border bg-background text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">IVA importación (%)</label>
                <input type="number" value={ivaPct} disabled
                  className="w-full px-3 py-2 rounded-lg border bg-muted text-sm cursor-not-allowed" />
              </div>
            </div>
          </div>

          {/* Tabla de productos */}
          <div className="bg-card rounded-xl border p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold flex items-center gap-2">
                <Calculator size={18} className="text-primary" />
                Simulador de importación — Orden de compra
              </h3>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="text-xs" onClick={addSimLine}>
                  + Agregar producto
                </Button>
                <Button
                  variant="default" size="sm" className="text-xs"
                  disabled={simCalc.length === 0}
                  onClick={() => {
                    const data = simCalc.map(r => ({
                      SKU: r.product?.sku ?? '',
                      Producto: r.product?.name ?? '',
                      'Costo unitario': r.costoUnitario,
                      Cantidad: r.qty,
                      'CBM unit.': r.cbm,
                      'Valor total producto': r.valorTotal,
                      'IGI %': r.igiPct,
                      'IGI monto': r.igiMonto,
                      'Flete local': r.fleteLocal,
                      'Aduana asignada': Math.round(r.aduanaAsignada),
                      'Flete marítimo asig.': Math.round(r.fleteMarAsignado),
                      'IVA asignado': Math.round(r.ivaAsignado),
                      'Costo total importado': Math.round(r.costoTotalImportado),
                      'Costo unit. bodega': Math.round(r.costoUnitarioFinal),
                      'Margen %': r.margenPct,
                      'Precio venta sug.': Math.round(r.precioVenta),
                      'Utilidad unitaria': Math.round(r.utilidadUnit),
                      'Utilidad total': Math.round(r.utilidadTotal),
                    }));
                    data.push({
                      SKU: '', Producto: 'TOTAL ORDEN',
                      'Costo unitario': 0, Cantidad: simTotals.totalQty,
                      'CBM unit.': 0, 'Valor total producto': simTotals.totalValor,
                      'IGI %': 0, 'IGI monto': 0, 'Flete local': 0,
                      'Aduana asignada': costoAduana,
                      'Flete marítimo asig.': costoFleteMaritimo,
                      'IVA asignado': 0,
                      'Costo total importado': Math.round(simTotals.totalCostoImportado),
                      'Costo unit. bodega': 0, 'Margen %': 0,
                      'Precio venta sug.': Math.round(simTotals.totalVenta),
                      'Utilidad unitaria': 0,
                      'Utilidad total': Math.round(simTotals.totalUtilidadTotal),
                    });
                    exportToExcel(data, `Simulacion_importacion_${new Date().toISOString().split('T')[0]}`);
                  }}
                >
                  📥 Descargar Excel
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="data-table text-[11px]">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>SKU / Producto</th>
                    <th>Costo unit.</th>
                    <th>Cant.</th>
                    <th>CBM</th>
                    <th>IGI %</th>
                    <th>Flete local</th>
                    <th>Margen %</th>
                    <th className="bg-muted/30">Valor total</th>
                    <th className="bg-muted/30">Aduana asig.</th>
                    <th className="bg-muted/30">Flete mar. asig.</th>
                    <th className="bg-muted/30">IVA asig.</th>
                    <th className="bg-primary/10 font-bold">Costo importado</th>
                    <th className="bg-primary/10 font-bold">C.U. bodega</th>
                    <th className="bg-success/10">P. venta sug.</th>
                    <th className="bg-success/10">Util. unit.</th>
                    <th className="bg-success/10">Util. total</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {simLines.map((line, i) => {
                    const calc = simCalc[i];
                    const product = products.find(p => p.id === line.productId);
                    return (
                      <tr key={i}>
                        <td className="text-muted-foreground">{i + 1}</td>
                        <td>
                          <select
                            value={line.productId}
                            onChange={e => {
                              const p = products.find(pr => pr.id === e.target.value);
                              updateSimLine(i, 'productId', e.target.value);
                              if (p) updateSimLine(i, 'costoUnitario', p.cost);
                            }}
                            className="px-1.5 py-1 rounded border bg-background text-[11px] w-full min-w-[140px]"
                          >
                            {demoProducts.filter(p => p.active).map(p => (
                              <option key={p.id} value={p.id}>{p.sku} – {p.name}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input type="number" min={0} value={line.costoUnitario}
                            onChange={e => updateSimLine(i, 'costoUnitario', +e.target.value)}
                            className="w-20 px-1.5 py-1 rounded border bg-background text-[11px] text-right" />
                        </td>
                        <td>
                          <input type="number" min={1} value={line.qty}
                            onChange={e => updateSimLine(i, 'qty', +e.target.value)}
                            className="w-16 px-1.5 py-1 rounded border bg-background text-[11px] text-center" />
                        </td>
                        <td>
                          <input type="number" min={0} step={0.01} value={line.cbm}
                            onChange={e => updateSimLine(i, 'cbm', +e.target.value)}
                            className="w-16 px-1.5 py-1 rounded border bg-background text-[11px] text-right" />
                        </td>
                        <td>
                          <input type="number" min={0} max={100} value={line.igiPct}
                            onChange={e => updateSimLine(i, 'igiPct', +e.target.value)}
                            className="w-14 px-1.5 py-1 rounded border bg-background text-[11px] text-right" />
                        </td>
                        <td>
                          <input type="number" min={0} value={line.fleteLocal}
                            onChange={e => updateSimLine(i, 'fleteLocal', +e.target.value)}
                            className="w-20 px-1.5 py-1 rounded border bg-background text-[11px] text-right" />
                        </td>
                        <td>
                          <input type="number" min={0} max={200} value={line.margenPct}
                            onChange={e => updateSimLine(i, 'margenPct', +e.target.value)}
                            className="w-14 px-1.5 py-1 rounded border bg-background text-[11px] text-right" />
                        </td>
                        {/* Calculated columns */}
                        <td className="bg-muted/20 text-right font-medium">{fmt(calc?.valorTotal ?? 0)}</td>
                        <td className="bg-muted/20 text-right">{fmt(Math.round(calc?.aduanaAsignada ?? 0))}</td>
                        <td className="bg-muted/20 text-right">{fmt(Math.round(calc?.fleteMarAsignado ?? 0))}</td>
                        <td className="bg-muted/20 text-right">{fmt(Math.round(calc?.ivaAsignado ?? 0))}</td>
                        <td className="bg-primary/5 text-right font-bold text-primary">{fmt(Math.round(calc?.costoTotalImportado ?? 0))}</td>
                        <td className="bg-primary/5 text-right font-bold">{fmt(Math.round(calc?.costoUnitarioFinal ?? 0))}</td>
                        <td className="bg-success/5 text-right font-semibold text-success">{fmt(Math.round(calc?.precioVenta ?? 0))}</td>
                        <td className="bg-success/5 text-right">{fmt(Math.round(calc?.utilidadUnit ?? 0))}</td>
                        <td className="bg-success/5 text-right font-bold text-success">{fmt(Math.round(calc?.utilidadTotal ?? 0))}</td>
                        <td className="flex gap-0.5">
                          <button onClick={() => duplicateSimLine(i)} className="text-muted-foreground hover:text-primary text-[10px] p-0.5" title="Duplicar">
                            <Copy size={12} />
                          </button>
                          <button onClick={() => removeSimLine(i)} className="text-muted-foreground hover:text-destructive text-[10px] p-0.5" title="Eliminar">✕</button>
                        </td>
                      </tr>
                    );
                  })}
                  {/* Totals */}
                  {simCalc.length > 0 && (
                    <tr className="bg-muted/50 font-bold border-t-2 border-primary/30">
                      <td></td>
                      <td className="text-xs">TOTAL ORDEN</td>
                      <td></td>
                      <td className="text-center">{simTotals.totalQty}</td>
                      <td colSpan={4}></td>
                      <td className="bg-muted/30 text-right">{fmt(simTotals.totalValor)}</td>
                      <td className="bg-muted/30 text-right">{fmt(costoAduana)}</td>
                      <td className="bg-muted/30 text-right">{fmt(costoFleteMaritimo)}</td>
                      <td className="bg-muted/30"></td>
                      <td className="bg-primary/5 text-right text-primary">{fmt(Math.round(simTotals.totalCostoImportado))}</td>
                      <td></td>
                      <td className="bg-success/5 text-right text-success">{fmt(Math.round(simTotals.totalVenta))}</td>
                      <td></td>
                      <td className="bg-success/5 text-right text-success">{fmt(Math.round(simTotals.totalUtilidadTotal))}</td>
                      <td></td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Summary cards */}
          {simCalc.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-card rounded-xl border p-4 text-center border-l-4 border-l-primary">
                <div className="text-xs text-muted-foreground">Costo total importado</div>
                <div className="text-xl font-bold text-primary">{fmt(Math.round(simTotals.totalCostoImportado))}</div>
                <div className="text-[10px] text-muted-foreground">{simCalc.length} productos</div>
              </div>
              <div className="bg-card rounded-xl border p-4 text-center border-l-4 border-l-success">
                <div className="text-xs text-muted-foreground">Venta estimada</div>
                <div className="text-xl font-bold text-success">{fmt(Math.round(simTotals.totalVenta))}</div>
              </div>
              <div className="bg-card rounded-xl border p-4 text-center border-l-4 border-l-warning">
                <div className="text-xs text-muted-foreground">Utilidad proyectada</div>
                <div className={`text-xl font-bold ${simTotals.totalUtilidadTotal > 0 ? 'text-success' : 'text-destructive'}`}>{fmt(Math.round(simTotals.totalUtilidadTotal))}</div>
              </div>
              <div className="bg-card rounded-xl border p-4 text-center">
                <div className="text-xs text-muted-foreground">Margen promedio</div>
                <div className="text-xl font-bold">
                  {simTotals.totalVenta > 0 ? `${Math.round((simTotals.totalUtilidadTotal / simTotals.totalVenta) * 100)}%` : '—'}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════ INVENTARIO IDEAL ═══════════════════════ */}
      {tab === 'inventario' && (
        <div className="bg-card rounded-xl border overflow-x-auto">
          <div className="p-5 border-b">
            <h3 className="font-display font-semibold flex items-center gap-2">
              <Warehouse size={18} className="text-primary" />
              Inventario ideal por producto (cobertura 3 meses)
            </h3>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Venta mensual</th>
                <th>Stock actual</th>
                <th>En tránsito</th>
                <th>Stock ideal <SortIcon field="idealStock" /></th>
                <th>Diferencia <SortIcon field="stockDifference" /></th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {sortedAnalyses.map(a => (
                <tr key={a.product.id}>
                  <td className="font-medium">{a.product.name}</td>
                  <td>{fmtNum(a.monthlySales)}</td>
                  <td className="font-semibold">{a.totalStock}</td>
                  <td>{a.inTransit}</td>
                  <td className="font-bold">{a.idealStock}</td>
                  <td className={`font-bold ${a.stockDifference > 0 ? 'text-destructive' : a.stockDifference < -3 ? 'text-warning' : 'text-success'}`}>
                    {a.stockDifference > 0 ? `Faltan ${a.stockDifference}` : a.stockDifference < 0 ? `Sobran ${Math.abs(a.stockDifference)}` : 'Justo'}
                  </td>
                  <td>
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${RISK_CONFIG[a.riskLevel].className}`}>
                      {RISK_CONFIG[a.riskLevel].label}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ═══════════════════════ INVENTARIO MUERTO ═══════════════════════ */}
      {tab === 'muerto' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <MetricCard title="Valor inv. sin movimiento" value={fmt(summary.deadStockValue)} icon={Skull} variant="danger" />
            <MetricCard title="Productos baja rotación" value={analyses.filter(a => a.daysOfStock > 180).length} icon={Clock} variant="warning" />
            <MetricCard title="Valor total inventario" value={fmt(summary.totalStockValue)} icon={Warehouse} />
          </div>

          <div className="bg-card rounded-xl border overflow-x-auto">
            <div className="p-5 border-b">
              <h3 className="font-display font-semibold flex items-center gap-2">
                <Skull size={18} className="text-destructive" />
                Análisis de inventario muerto / baja rotación
              </h3>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Categoría</th>
                  <th>Stock</th>
                  <th>Valor inventario</th>
                  <th>Días de stock <SortIcon field="daysOfStock" /></th>
                  <th>Venta mensual</th>
                  <th>Acción sugerida</th>
                </tr>
              </thead>
              <tbody>
                {sortedAnalyses
                  .filter(a => a.daysOfStock > 90)
                  .sort((a, b) => b.daysOfStock - a.daysOfStock)
                  .map(a => (
                    <tr key={a.product.id} className={a.daysOfStock > 365 ? 'bg-destructive/5' : ''}>
                      <td className="font-medium">{a.product.name}</td>
                      <td className="text-xs text-muted-foreground capitalize">{a.product.category}</td>
                      <td>{a.totalStock}</td>
                      <td className="font-semibold">{fmt(a.stockValue)}</td>
                      <td>
                        <span className={`font-bold ${a.daysOfStock > 365 ? 'text-destructive' : a.daysOfStock > 180 ? 'text-warning' : 'text-muted-foreground'}`}>
                          {a.daysOfStock > 900 ? '> 1 año' : `${a.daysOfStock}d`}
                        </span>
                      </td>
                      <td>{fmtNum(a.monthlySales)}</td>
                      <td>
                        {a.daysOfStock > 365 ? (
                          <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-destructive/10 text-destructive">🔥 Liquidación</span>
                        ) : a.daysOfStock > 180 ? (
                          <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-warning/10 text-warning">💰 Descuento</span>
                        ) : (
                          <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary">📢 Promoción</span>
                        )}
                      </td>
                    </tr>
                  ))}
                {analyses.filter(a => a.daysOfStock > 90).length === 0 && (
                  <tr><td colSpan={7} className="text-center text-muted-foreground py-8">No se detecta inventario muerto</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════════════ CLASIFICACIÓN ESTRATÉGICA ═══════════════════════ */}
      {tab === 'estrategico' && (
        <div className="space-y-6">
          {/* Category explanation */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(CAT_CONFIG).map(([key, conf]) => (
              <div key={key} className="bg-card rounded-xl border p-4">
                <div className={`text-lg font-bold ${conf.color} mb-1`}>{conf.label}</div>
                <div className="text-xs text-muted-foreground">{conf.desc}</div>
                <div className="text-2xl font-bold mt-2">
                  {analyses.filter(a => a.category === key).length}
                </div>
              </div>
            ))}
          </div>

          <div className="bg-card rounded-xl border overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Clasificación</th>
                  <th>Venta/mes</th>
                  <th>Margen % <SortIcon field="margin" /></th>
                  <th>Ingreso anual</th>
                  <th>Utilidad anual</th>
                  <th>Costo</th>
                  <th>Precio</th>
                </tr>
              </thead>
              <tbody>
                {sortedAnalyses.map(a => (
                  <tr key={a.product.id}>
                    <td className="font-medium">{a.product.name}</td>
                    <td>
                      <span className={`font-semibold ${CAT_CONFIG[a.category].color}`}>
                        {CAT_CONFIG[a.category].label}
                      </span>
                    </td>
                    <td>{fmtNum(a.monthlySales)}</td>
                    <td className={`font-bold ${a.margin >= 40 ? 'text-success' : a.margin >= 30 ? 'text-primary' : 'text-destructive'}`}>{a.margin}%</td>
                    <td>{fmt(a.annualRevenue)}</td>
                    <td className="font-semibold text-success">{fmt(a.annualProfit)}</td>
                    <td className="text-muted-foreground">{fmt(a.product.cost)}</td>
                    <td>{fmt(a.product.listPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════════════ CRECIMIENTO ═══════════════════════ */}
      {tab === 'crecimiento' && (
        <div className="space-y-6">
          <div className="bg-card rounded-xl border p-6">
            <h3 className="font-display font-semibold mb-4 flex items-center gap-2">
              <Target size={18} className="text-primary" />
              Simulación de crecimiento
            </h3>
            <div className="mb-6">
              <label className="text-xs font-medium text-muted-foreground mb-2 block">
                Factor de crecimiento: <span className="text-foreground font-bold">{growthFactor}x</span>
                {growthFactor === 2 && ' (duplicar ventas)'}
                {growthFactor === 3 && ' (triplicar ventas)'}
              </label>
              <input
                type="range"
                min={0}
                max={3.5}
                step={0.1}
                value={growthFactor}
                onChange={e => setGrowthFactor(Math.round(+e.target.value * 10) / 10)}
                className="w-full max-w-md"
              />
              <div className="flex justify-between text-xs text-muted-foreground max-w-md">
                <span>0x</span><span>0.5x</span><span>1x</span><span>1.5x</span><span>2x</span><span>2.5x</span><span>3x</span><span>3.5x</span>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-muted/50 rounded-xl p-4 text-center">
                <div className="text-xs text-muted-foreground mb-1">Ingreso actual anual</div>
                <div className="text-lg font-bold">{fmt(growth.currentRevenue)}</div>
              </div>
              <div className="bg-muted/50 rounded-xl p-4 text-center">
                <div className="text-xs text-muted-foreground mb-1">Ingreso objetivo ({growthFactor}x)</div>
                <div className="text-lg font-bold text-primary">{fmt(growth.targetRevenue)}</div>
              </div>
              <div className="bg-muted/50 rounded-xl p-4 text-center">
                <div className="text-xs text-muted-foreground mb-1">Capital requerido</div>
                <div className="text-lg font-bold text-warning">{fmt(growth.capitalRequired)}</div>
              </div>
              <div className="bg-muted/50 rounded-xl p-4 text-center">
                <div className="text-xs text-muted-foreground mb-1">Utilidad estimada anual</div>
                <div className="text-lg font-bold text-success">{fmt(growth.estimatedProfit)}</div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-primary/5 rounded-lg border border-primary/20">
              <h4 className="text-sm font-semibold mb-2">📊 Resumen para el Director</h4>
              <p className="text-sm text-muted-foreground">
                Para crecer <strong>{growthFactor}x</strong>, la empresa necesita invertir{' '}
                <strong className="text-foreground">{fmt(growth.capitalRequired)}</strong> en inventario adicional.
                Esto generaría ingresos anuales de{' '}
                <strong className="text-foreground">{fmt(growth.targetRevenue)}</strong> con una utilidad estimada de{' '}
                <strong className="text-success">{fmt(growth.estimatedProfit)}</strong>.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
