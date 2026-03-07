import { useMemo, useState } from 'react';
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

  const handleExportExcel = (tab: string) => {
    if (tab === 'capital') {
      exportToExcel(fin.topCapitalProducts.map(p => ({
        SKU: p.sku, Producto: p.name, Categoría: p.category, Stock: p.stock,
        'Costo unitario': p.cost, 'Valor inventario': p.value, Rotación: p.rotation.toFixed(1),
        'Margen %': p.margin, 'ROI %': p.roi.toFixed(1), 'Venta mensual': p.monthlySales.toFixed(1),
        'Días stock': p.daysOfStock, 'Utilidad anual': p.annualProfit,
      })), 'capital-invertido-inventario');
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
    exportToPdf({
      title: 'Simulador Financiero de Inventario',
      subtitle: 'REDBUCK EQUIPMENT',
      filename: 'simulador-financiero',
      summary: [
        { label: 'Capital en inventario', value: fmt(fin.totalInventoryValue) },
        { label: 'Capital detenido', value: fmt(fin.slowInventoryValue) },
        { label: 'ROI inventario', value: fmtPct(fin.roi) },
        { label: 'Rotación', value: `${fin.inventoryRotation.toFixed(1)}x` },
        { label: 'Días inventario', value: `${fin.daysOfInventory}` },
      ],
      headers: ['SKU', 'Producto', 'Stock', 'Valor', 'Rotación', 'ROI %', 'Margen %'],
      rows: fin.topCapitalProducts.map(p => [
        p.sku, p.name, p.stock, fmt(p.value),
        p.rotation.toFixed(1), p.roi.toFixed(0), `${p.margin}%`,
      ]),
    });
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
          <Button variant="outline" size="sm" onClick={handleExportPdf}>
            <Download size={14} className="mr-1" /> PDF
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
