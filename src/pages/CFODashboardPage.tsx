import { useMemo, useState } from 'react';
import { useExpenses } from '@/hooks/useExpenses';
import { useAssets, getTotalMonthlyDepAmort } from '@/hooks/useAssets';
import { useAccountsPayable } from '@/hooks/useAccountsPayable';
import { demoExpenses } from '@/lib/operatingExpensesEngine';
import {
  calcIncomeStatement, calcBalanceSheet, calcCashFlow,
  calcStrategicKPIs, calcMonthlyFlow,
} from '@/lib/cfoDashboardEngine';
import MetricCard from '@/components/shared/MetricCard';
import { exportToExcel } from '@/components/shared/ReportFilterBar';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DollarSign, TrendingUp, TrendingDown, Package, CreditCard, Building2,
  Wallet, BarChart3, Download, ArrowUpRight, ArrowDownRight, AlertTriangle,
  CheckCircle, Loader2, RefreshCw, Banknote, Layers, Activity, Target,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, PieChart, Pie, Cell,
} from 'recharts';

const fmt = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);
const fmtPct = (n: number) => `${n.toFixed(1)}%`;
const fmtDays = (n: number) => `${Math.round(n)} días`;
const fmtX = (n: number) => `${n.toFixed(1)}x`;

const COLORS = ['hsl(var(--primary))', 'hsl(142,71%,45%)', 'hsl(38,92%,50%)', 'hsl(0,78%,45%)', 'hsl(210,100%,52%)', 'hsl(280,65%,55%)'];

// Fallback assets
const fallbackAssets = [
  { id:'a1', nombre:'Camioneta Nissan NP300', categoria:'vehiculos' as const, tipo:'depreciacion' as const, descripcion:'', fechaCompra:'2023-06-15', costoAdquisicion:420000, vidaUtilMeses:60, valorRescate:120000, estatus:'activo' as const },
  { id:'a2', nombre:'Camioneta RAM 700', categoria:'vehiculos' as const, tipo:'depreciacion' as const, descripcion:'', fechaCompra:'2024-01-10', costoAdquisicion:350000, vidaUtilMeses:60, valorRescate:100000, estatus:'activo' as const },
  { id:'a3', nombre:'Montacargas Yale', categoria:'maquinaria' as const, tipo:'depreciacion' as const, descripcion:'', fechaCompra:'2022-03-01', costoAdquisicion:280000, vidaUtilMeses:120, valorRescate:40000, estatus:'activo' as const },
  { id:'a4', nombre:'MacBook Pro', categoria:'computadoras' as const, tipo:'depreciacion' as const, descripcion:'', fechaCompra:'2024-06-01', costoAdquisicion:65000, vidaUtilMeses:36, valorRescate:15000, estatus:'activo' as const },
  { id:'a5', nombre:'Licencia ERP', categoria:'software' as const, tipo:'amortizacion' as const, descripcion:'', fechaCompra:'2025-01-01', costoAdquisicion:48000, vidaUtilMeses:12, valorRescate:0, estatus:'activo' as const },
];

export default function CFODashboardPage() {
  const { data: dbExpenses } = useExpenses();
  const { data: dbAssets } = useAssets();
  const { data: dbPayables } = useAccountsPayable();

  const expenses = dbExpenses && dbExpenses.length > 0 ? dbExpenses : demoExpenses;
  const assets = dbAssets && dbAssets.length > 0 ? dbAssets : fallbackAssets;
  const payables = dbPayables ?? [];

  // Editable config for balance sheet
  const [bsConfig, setBsConfig] = useState({
    bancos: 850000,
    creditosBancarios: 0,
    aportacionSocios: 2000000,
    utilidadesAcumuladas: 500000,
  });

  const income = useMemo(() => calcIncomeStatement(expenses, assets, 12), [expenses, assets]);
  const balance = useMemo(() => calcBalanceSheet(income, assets, payables, bsConfig), [income, assets, payables, bsConfig]);
  const cashFlow = useMemo(() => calcCashFlow(income, payables, { saldoInicial: bsConfig.bancos }), [income, payables, bsConfig.bancos]);
  const kpis = useMemo(() => calcStrategicKPIs(balance, income, payables), [balance, income, payables]);
  const monthlyFlow = useMemo(() => calcMonthlyFlow(expenses), [expenses]);

  // Export all to Excel
  const handleExportAll = () => {
    const incomeData = [
      { Concepto: 'Ventas', Monto: income.ventas },
      { Concepto: 'Costo de ventas', Monto: income.costoVentas },
      { Concepto: 'Utilidad Bruta', Monto: income.utilidadBruta },
      { Concepto: 'Gastos de ventas', Monto: income.gastosVentas },
      { Concepto: 'Gastos administrativos', Monto: income.gastosAdmin },
      { Concepto: 'EBITDA', Monto: income.ebitda },
      { Concepto: 'Depreciación y amortización', Monto: income.depAmort },
      { Concepto: 'EBIT', Monto: income.ebit },
      { Concepto: 'Intereses', Monto: income.intereses },
      { Concepto: 'Utilidad antes de impuestos', Monto: income.utilidadAntesImpuestos },
      { Concepto: 'Impuestos (30%)', Monto: income.impuestos },
      { Concepto: 'Utilidad Neta', Monto: income.utilidadNeta },
      { Concepto: '---', Monto: 0 },
      { Concepto: 'Margen Bruto', Monto: income.margenBruto },
      { Concepto: 'Margen EBITDA', Monto: income.margenEbitda },
      { Concepto: 'Margen Neto', Monto: income.margenNeto },
    ];

    const balanceData = [
      { Concepto: 'ACTIVOS CIRCULANTES', Monto: '' },
      { Concepto: 'Bancos', Monto: balance.bancos },
      { Concepto: 'Cuentas por cobrar', Monto: balance.cuentasPorCobrar },
      { Concepto: 'Inventario', Monto: balance.inventario },
      { Concepto: 'Total circulantes', Monto: balance.totalCirculantes },
      { Concepto: 'ACTIVOS FIJOS', Monto: '' },
      { Concepto: 'Valor de adquisición', Monto: balance.activosFijosValor },
      { Concepto: 'Depreciación acumulada', Monto: -balance.depreciacionAcumulada },
      { Concepto: 'Activos fijos neto', Monto: balance.activosFijosNeto },
      { Concepto: 'TOTAL ACTIVOS', Monto: balance.totalActivos },
      { Concepto: '---', Monto: '' },
      { Concepto: 'PASIVOS', Monto: '' },
      { Concepto: 'Cuentas por pagar', Monto: balance.cuentasPorPagar },
      { Concepto: 'Créditos bancarios', Monto: balance.creditosBancarios },
      { Concepto: 'Impuestos por pagar', Monto: balance.impuestosPorPagar },
      { Concepto: 'TOTAL PASIVOS', Monto: balance.totalPasivos },
      { Concepto: '---', Monto: '' },
      { Concepto: 'CAPITAL', Monto: '' },
      { Concepto: 'Aportación de socios', Monto: balance.aportacionSocios },
      { Concepto: 'Utilidades acumuladas', Monto: balance.utilidadesAcumuladas },
      { Concepto: 'Utilidad del ejercicio', Monto: balance.utilidadEjercicio },
      { Concepto: 'TOTAL CAPITAL', Monto: balance.totalCapital },
    ];

    const cashData = [
      { Concepto: 'FLUJO OPERATIVO', Monto: '' },
      { Concepto: 'Cobros de clientes', Monto: cashFlow.cobrosClientes },
      { Concepto: 'Ingresos de ventas', Monto: cashFlow.ingresosVentas },
      { Concepto: 'Pagos a proveedores', Monto: -cashFlow.pagosProveedores },
      { Concepto: 'Gastos operativos', Monto: -cashFlow.gastosOperativos },
      { Concepto: 'Nómina', Monto: -cashFlow.nomina },
      { Concepto: 'Impuestos', Monto: -cashFlow.impuestosPagados },
      { Concepto: 'Total flujo operativo', Monto: cashFlow.flujoOperativo },
      { Concepto: 'FLUJO INVERSIÓN', Monto: '' },
      { Concepto: 'Compra de activos', Monto: -cashFlow.compraActivos },
      { Concepto: 'Total flujo inversión', Monto: cashFlow.flujoInversion },
      { Concepto: 'FLUJO FINANCIAMIENTO', Monto: '' },
      { Concepto: 'Préstamos recibidos', Monto: cashFlow.prestamosRecibidos },
      { Concepto: 'Pagos de deuda', Monto: -cashFlow.pagosDeuda },
      { Concepto: 'Aportaciones', Monto: cashFlow.aportacionesSocios },
      { Concepto: 'Total flujo financiamiento', Monto: cashFlow.flujoFinanciamiento },
      { Concepto: '---', Monto: '' },
      { Concepto: 'Flujo neto', Monto: cashFlow.flujoNeto },
      { Concepto: 'Saldo inicial', Monto: cashFlow.saldoInicial },
      { Concepto: 'Saldo final', Monto: cashFlow.saldoFinal },
    ];

    const kpiData = [
      { Indicador: 'Liquidez', Valor: kpis.liquidez.toFixed(2) },
      { Indicador: 'Endeudamiento', Valor: kpis.endeudamiento.toFixed(2) },
      { Indicador: 'Días de inventario', Valor: Math.round(kpis.diasInventario) },
      { Indicador: 'Días CxC', Valor: Math.round(kpis.diasCxC) },
      { Indicador: 'Días CxP', Valor: Math.round(kpis.diasCxP) },
      { Indicador: 'Ciclo conversión efectivo', Valor: Math.round(kpis.cicloConversionEfectivo) },
      { Indicador: 'Rotación inventario', Valor: kpis.rotacionInventario.toFixed(1) },
      { Indicador: 'Capital en inventario', Valor: kpis.capitalEnInventario },
    ];

    const flowData = monthlyFlow.map(m => ({
      Mes: m.month, Entradas: m.entradas, Salidas: m.salidas, Neto: m.neto, Acumulado: m.acumulado,
    }));

    // Build multi-sheet export
    import('xlsx').then(XLSX => {
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(incomeData), 'Estado Resultados');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(balanceData), 'Balance General');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(cashData), 'Flujo Efectivo');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(kpiData), 'Indicadores');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(flowData), 'Flujo Mensual');
      XLSX.writeFile(wb, `Dashboard_Financiero_${new Date().toISOString().split('T')[0]}.xlsx`);
    });
  };

  // Income statement rows for table
  const incomeRows = [
    { label: 'Ventas', value: income.ventas, bold: true, indent: 0 },
    { label: 'Costo de ventas', value: -income.costoVentas, indent: 1 },
    { label: 'Utilidad Bruta', value: income.utilidadBruta, bold: true, indent: 0, highlight: true },
    { label: 'Gastos de ventas', value: -income.gastosVentas, indent: 1 },
    { label: 'Gastos administrativos', value: -income.gastosAdmin, indent: 1 },
    { label: 'EBITDA', value: income.ebitda, bold: true, indent: 0, highlight: true },
    { label: 'Depreciación y amortización', value: -income.depAmort, indent: 1 },
    { label: 'EBIT', value: income.ebit, bold: true, indent: 0 },
    { label: 'Intereses', value: -income.intereses, indent: 1 },
    { label: 'Utilidad antes de impuestos', value: income.utilidadAntesImpuestos, bold: true, indent: 0 },
    { label: 'Impuestos (30%)', value: -income.impuestos, indent: 1 },
    { label: 'Utilidad Neta', value: income.utilidadNeta, bold: true, indent: 0, highlight: true },
  ];

  const pieBalanceData = [
    { name: 'Bancos', value: balance.bancos },
    { name: 'CxC', value: balance.cuentasPorCobrar },
    { name: 'Inventario', value: balance.inventario },
    { name: 'Activos Fijos', value: balance.activosFijosNeto },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard Financiero del Director</h1>
          <p className="page-subtitle">Visión consolidada: Estado de Resultados · Balance General · Flujo de Efectivo · KPIs</p>
        </div>
        <Button onClick={handleExportAll} className="gap-2">
          <Download size={16} /> Exportar Excel
        </Button>
      </div>

      {/* ─── Top KPIs ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
        <MetricCard title="Ventas" value={fmt(income.ventas)} icon={DollarSign} />
        <MetricCard title="Utilidad Bruta" value={fmt(income.utilidadBruta)} subtitle={fmtPct(income.margenBruto)} icon={TrendingUp} />
        <MetricCard title="EBITDA" value={fmt(income.ebitda)} subtitle={fmtPct(income.margenEbitda)} icon={BarChart3} />
        <MetricCard title="Utilidad Neta" value={fmt(income.utilidadNeta)} subtitle={fmtPct(income.margenNeto)} icon={Banknote} />
        <MetricCard title="Bancos" value={fmt(balance.bancos)} icon={Building2} />
        <MetricCard title="Inventario" value={fmt(balance.inventario)} icon={Package} />
        <MetricCard title="CxC" value={fmt(balance.cuentasPorCobrar)} icon={CreditCard} />
        <MetricCard title="CxP" value={fmt(balance.cuentasPorPagar)} icon={Wallet} />
      </div>

      {/* ─── Tabs ──────────────────────────────────────────────── */}
      <Tabs defaultValue="income" className="space-y-4">
        <TabsList className="grid grid-cols-4 w-full max-w-2xl">
          <TabsTrigger value="income">Estado de Resultados</TabsTrigger>
          <TabsTrigger value="balance">Balance General</TabsTrigger>
          <TabsTrigger value="cashflow">Flujo de Efectivo</TabsTrigger>
          <TabsTrigger value="kpis">Indicadores</TabsTrigger>
        </TabsList>

        {/* ─── INCOME STATEMENT TAB ─────────────────────────────── */}
        <TabsContent value="income">
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="bg-card rounded-xl border p-6">
              <h3 className="text-lg font-bold mb-4">Estado de Resultados (12 meses)</h3>
              <table className="w-full text-sm">
                <tbody>
                  {incomeRows.map((r, i) => (
                    <tr key={i} className={`${r.highlight ? 'bg-muted/50' : ''} ${r.bold ? 'font-bold' : ''}`}>
                      <td className={`py-1.5 ${r.indent ? 'pl-6 text-muted-foreground' : ''}`}>{r.label}</td>
                      <td className={`py-1.5 text-right ${r.value < 0 ? 'text-destructive' : ''}`}>{fmt(Math.abs(r.value))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-4 pt-4 border-t grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-xs text-muted-foreground">Margen Bruto</div>
                  <div className="text-lg font-bold text-primary">{fmtPct(income.margenBruto)}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-muted-foreground">Margen EBITDA</div>
                  <div className="text-lg font-bold text-primary">{fmtPct(income.margenEbitda)}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-muted-foreground">Margen Neto</div>
                  <div className="text-lg font-bold text-primary">{fmtPct(income.margenNeto)}</div>
                </div>
              </div>
            </div>

            {/* Waterfall-style bar chart for income statement */}
            <div className="bg-card rounded-xl border p-6">
              <h3 className="text-lg font-bold mb-4">Composición del Resultado</h3>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={[
                  { name: 'Ventas', valor: income.ventas },
                  { name: 'COGS', valor: -income.costoVentas },
                  { name: 'Ut. Bruta', valor: income.utilidadBruta },
                  { name: 'G. Op.', valor: -income.gastosOperativos },
                  { name: 'EBITDA', valor: income.ebitda },
                  { name: 'D&A', valor: -income.depAmort },
                  { name: 'Ut. Neta', valor: income.utilidadNeta },
                ]}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={v => `$${(v / 1000000).toFixed(1)}M`} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Bar dataKey="valor" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]}>
                    {[0, 1, 2, 3, 4, 5, 6].map(i => (
                      <Cell key={i} fill={[0, 2, 4, 6].includes(i) ? 'hsl(var(--primary))' : 'hsl(var(--destructive)/0.7)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </TabsContent>

        {/* ─── BALANCE SHEET TAB ────────────────────────────────── */}
        <TabsContent value="balance">
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Activos */}
            <div className="bg-card rounded-xl border p-6">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Layers size={18} /> Activos
              </h3>
              <div className="space-y-3">
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Circulantes</div>
                  <div className="space-y-1.5">
                    <Row label="Bancos" value={balance.bancos} editable onEdit={v => setBsConfig(c => ({ ...c, bancos: v }))} />
                    <Row label="Cuentas por cobrar" value={balance.cuentasPorCobrar} />
                    <Row label="Inventario" value={balance.inventario} />
                    <Row label="Total circulantes" value={balance.totalCirculantes} bold />
                  </div>
                </div>
                <div className="border-t pt-3">
                  <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Fijos</div>
                  <div className="space-y-1.5">
                    <Row label="Valor adquisición" value={balance.activosFijosValor} />
                    <Row label="Dep. acumulada" value={-balance.depreciacionAcumulada} negative />
                    <Row label="Activos fijos neto" value={balance.activosFijosNeto} bold />
                  </div>
                </div>
                <div className="border-t pt-3">
                  <Row label="TOTAL ACTIVOS" value={balance.totalActivos} bold highlight />
                </div>
              </div>
            </div>

            {/* Pasivos */}
            <div className="bg-card rounded-xl border p-6">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <AlertTriangle size={18} /> Pasivos
              </h3>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Row label="Cuentas por pagar" value={balance.cuentasPorPagar} />
                  <div className="pl-4 space-y-1 text-xs text-muted-foreground">
                    <div className="flex justify-between"><span>0-30 días</span><span>{fmt(balance.cxpPor30)}</span></div>
                    <div className="flex justify-between"><span>31-60 días</span><span>{fmt(balance.cxpPor60)}</span></div>
                    <div className="flex justify-between"><span>61-90 días</span><span>{fmt(balance.cxpPor90)}</span></div>
                    <div className="flex justify-between"><span>90+ días</span><span>{fmt(balance.cxpPor120Plus)}</span></div>
                  </div>
                  <Row label="Créditos bancarios" value={balance.creditosBancarios} editable onEdit={v => setBsConfig(c => ({ ...c, creditosBancarios: v }))} />
                  <Row label="Impuestos por pagar" value={balance.impuestosPorPagar} />
                  <Row label="TOTAL PASIVOS" value={balance.totalPasivos} bold />
                </div>
                <div className="border-t pt-3">
                  <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Capital Contable</div>
                  <div className="space-y-1.5">
                    <Row label="Aportación socios" value={balance.aportacionSocios} editable onEdit={v => setBsConfig(c => ({ ...c, aportacionSocios: v }))} />
                    <Row label="Utilidades acumuladas" value={balance.utilidadesAcumuladas} editable onEdit={v => setBsConfig(c => ({ ...c, utilidadesAcumuladas: v }))} />
                    <Row label="Utilidad del ejercicio" value={balance.utilidadEjercicio} />
                    <Row label="TOTAL CAPITAL" value={balance.totalCapital} bold />
                  </div>
                </div>
                <div className="border-t pt-3">
                  <Row label="PASIVOS + CAPITAL" value={balance.totalPasivos + balance.totalCapital} bold highlight />
                  <div className={`mt-2 text-xs font-medium flex items-center gap-1 ${balance.ecuacionBalanceada ? 'text-green-600' : 'text-destructive'}`}>
                    {balance.ecuacionBalanceada ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
                    {balance.ecuacionBalanceada ? 'Ecuación balanceada ✓' : 'Diferencia detectada'}
                  </div>
                </div>
              </div>
            </div>

            {/* Balance pie chart */}
            <div className="bg-card rounded-xl border p-6">
              <h3 className="text-lg font-bold mb-4">Distribución de Activos</h3>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={pieBalanceData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {pieBalanceData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmt(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-4 text-center">
                <div className="text-xs text-muted-foreground">Total Activos</div>
                <div className="text-xl font-bold">{fmt(balance.totalActivos)}</div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ─── CASH FLOW TAB ────────────────────────────────────── */}
        <TabsContent value="cashflow">
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              {/* Operativo */}
              <div className="bg-card rounded-xl border p-6">
                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">Flujo Operativo</h3>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between"><span className="text-green-600">+ Cobros de clientes</span><span>{fmt(cashFlow.cobrosClientes)}</span></div>
                  <div className="flex justify-between"><span className="text-green-600">+ Ventas</span><span>{fmt(cashFlow.ingresosVentas)}</span></div>
                  <div className="flex justify-between"><span className="text-destructive">- Proveedores</span><span>{fmt(cashFlow.pagosProveedores)}</span></div>
                  <div className="flex justify-between"><span className="text-destructive">- Gastos operativos</span><span>{fmt(cashFlow.gastosOperativos)}</span></div>
                  <div className="flex justify-between"><span className="text-destructive">- Nómina</span><span>{fmt(cashFlow.nomina)}</span></div>
                  <div className="flex justify-between"><span className="text-destructive">- Impuestos</span><span>{fmt(cashFlow.impuestosPagados)}</span></div>
                  <div className="flex justify-between font-bold border-t pt-2 mt-2">
                    <span>Total operativo</span>
                    <span className={cashFlow.flujoOperativo >= 0 ? 'text-green-600' : 'text-destructive'}>{fmt(cashFlow.flujoOperativo)}</span>
                  </div>
                </div>
              </div>
              {/* Inversión */}
              <div className="bg-card rounded-xl border p-6">
                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">Flujo de Inversión</h3>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between"><span className="text-destructive">- Compra de activos</span><span>{fmt(cashFlow.compraActivos)}</span></div>
                  <div className="flex justify-between font-bold border-t pt-2 mt-2"><span>Total inversión</span><span>{fmt(cashFlow.flujoInversion)}</span></div>
                </div>
              </div>
              {/* Financiamiento */}
              <div className="bg-card rounded-xl border p-6">
                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">Flujo de Financiamiento</h3>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between"><span className="text-green-600">+ Préstamos</span><span>{fmt(cashFlow.prestamosRecibidos)}</span></div>
                  <div className="flex justify-between"><span className="text-destructive">- Pagos de deuda</span><span>{fmt(cashFlow.pagosDeuda)}</span></div>
                  <div className="flex justify-between"><span className="text-green-600">+ Aportaciones</span><span>{fmt(cashFlow.aportacionesSocios)}</span></div>
                  <div className="flex justify-between font-bold border-t pt-2 mt-2"><span>Total financiamiento</span><span>{fmt(cashFlow.flujoFinanciamiento)}</span></div>
                </div>
              </div>
              {/* Summary */}
              <div className="bg-primary/5 rounded-xl border-2 border-primary/20 p-6">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div><div className="text-xs text-muted-foreground">Saldo Inicial</div><div className="text-lg font-bold">{fmt(cashFlow.saldoInicial)}</div></div>
                  <div><div className="text-xs text-muted-foreground">Flujo Neto</div><div className={`text-lg font-bold ${cashFlow.flujoNeto >= 0 ? 'text-green-600' : 'text-destructive'}`}>{fmt(cashFlow.flujoNeto)}</div></div>
                  <div><div className="text-xs text-muted-foreground">Saldo Final</div><div className="text-lg font-bold text-primary">{fmt(cashFlow.saldoFinal)}</div></div>
                </div>
              </div>
            </div>

            {/* Monthly flow chart */}
            <div className="bg-card rounded-xl border p-6">
              <h3 className="text-lg font-bold mb-4">Flujo de Efectivo Mensual</h3>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={monthlyFlow}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tickFormatter={v => `$${(v / 1000000).toFixed(1)}M`} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Legend />
                  <Bar dataKey="entradas" name="Entradas" fill="hsl(142,71%,45%)" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="salidas" name="Salidas" fill="hsl(0,78%,45%)" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-4">
                <h4 className="text-sm font-bold mb-2">Saldo Acumulado</h4>
                <ResponsiveContainer width="100%" height={150}>
                  <LineChart data={monthlyFlow}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                    <YAxis tickFormatter={v => `$${(v / 1000000).toFixed(1)}M`} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Line type="monotone" dataKey="acumulado" name="Acumulado" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ─── KPIs TAB ─────────────────────────────────────────── */}
        <TabsContent value="kpis">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <KPICard title="Liquidez" value={fmtX(kpis.liquidez)} desc="Activos circulantes / Pasivos circulantes" good={kpis.liquidez >= 1.5} icon={Activity} />
            <KPICard title="Endeudamiento" value={fmtX(kpis.endeudamiento)} desc="Pasivos totales / Capital contable" good={kpis.endeudamiento < 1} icon={AlertTriangle} />
            <KPICard title="Rotación Inventario" value={`${kpis.rotacionInventario.toFixed(1)}x/año`} desc="Costo ventas / Inventario promedio" good={kpis.rotacionInventario >= 4} icon={RefreshCw} />
            <KPICard title="CCC" value={fmtDays(kpis.cicloConversionEfectivo)} desc="Ciclo de conversión de efectivo" good={kpis.cicloConversionEfectivo < 90} icon={Target} />
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* CCC Breakdown */}
            <div className="bg-card rounded-xl border p-6">
              <h3 className="text-lg font-bold mb-4">Ciclo de Conversión de Efectivo</h3>
              <div className="text-sm text-muted-foreground mb-4">CCC = Días Inventario + Días CxC − Días CxP</div>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1"><span>Días de inventario</span><span className="font-bold">{fmtDays(kpis.diasInventario)}</span></div>
                  <div className="h-3 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500 rounded-full" style={{ width: `${Math.min(100, (kpis.diasInventario / 200) * 100)}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1"><span>Días CxC</span><span className="font-bold">{fmtDays(kpis.diasCxC)}</span></div>
                  <div className="h-3 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(100, (kpis.diasCxC / 200) * 100)}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1"><span>Días CxP</span><span className="font-bold text-green-600">-{fmtDays(kpis.diasCxP)}</span></div>
                  <div className="h-3 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full" style={{ width: `${Math.min(100, (kpis.diasCxP / 200) * 100)}%` }} />
                  </div>
                </div>
                <div className="border-t pt-3">
                  <div className="flex justify-between text-lg font-bold">
                    <span>Ciclo total</span>
                    <span className={kpis.cicloConversionEfectivo < 90 ? 'text-green-600' : 'text-amber-600'}>{fmtDays(kpis.cicloConversionEfectivo)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {kpis.cicloConversionEfectivo < 60 ? 'Excelente: el dinero regresa rápido al negocio' :
                     kpis.cicloConversionEfectivo < 90 ? 'Bueno: ciclo dentro de rangos saludables' :
                     'Atención: el dinero tarda en regresar al negocio'}
                  </p>
                </div>
              </div>
            </div>

            {/* Capital in inventory */}
            <div className="bg-card rounded-xl border p-6">
              <h3 className="text-lg font-bold mb-4">Capital Invertido en Inventario</h3>
              <div className="text-center mb-6">
                <div className="text-3xl font-bold text-primary">{fmt(kpis.capitalEnInventario)}</div>
                <div className="text-sm text-muted-foreground">Capital detenido en inventario</div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-muted/50 rounded-lg p-4 text-center">
                  <div className="text-xs text-muted-foreground">Rotación anual</div>
                  <div className="text-xl font-bold">{kpis.rotacionInventario.toFixed(1)}x</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {kpis.rotacionInventario >= 6 ? '🟢 Óptima' : kpis.rotacionInventario >= 4 ? '🟡 Aceptable' : '🔴 Baja'}
                  </div>
                </div>
                <div className="bg-muted/50 rounded-lg p-4 text-center">
                  <div className="text-xs text-muted-foreground">Días en bodega</div>
                  <div className="text-xl font-bold">{Math.round(kpis.diasInventario)}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {kpis.diasInventario <= 60 ? '🟢 Óptimo' : kpis.diasInventario <= 90 ? '🟡 Normal' : '🔴 Alto'}
                  </div>
                </div>
              </div>
              <div className="mt-4 p-3 bg-primary/5 rounded-lg text-xs">
                <strong>Interpretación:</strong> El inventario rota {kpis.rotacionInventario.toFixed(1)} veces al año, lo que significa que cada unidad permanece en promedio {Math.round(kpis.diasInventario)} días antes de venderse. Un inventario de {fmt(kpis.capitalEnInventario)} representa capital que no genera rendimiento hasta que se vende.
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Reusable components ────────────────────────────────────────

function Row({ label, value, bold, highlight, negative, editable, onEdit }: {
  label: string; value: number; bold?: boolean; highlight?: boolean; negative?: boolean;
  editable?: boolean; onEdit?: (v: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState(String(Math.abs(value)));

  return (
    <div className={`flex justify-between items-center py-1 text-sm ${bold ? 'font-bold' : ''} ${highlight ? 'bg-primary/5 px-2 rounded' : ''}`}>
      <span className={negative ? 'text-destructive' : ''}>{label}</span>
      {editable && editing ? (
        <Input
          type="number"
          value={editVal}
          onChange={e => setEditVal(e.target.value)}
          onBlur={() => { setEditing(false); onEdit?.(parseFloat(editVal) || 0); }}
          onKeyDown={e => { if (e.key === 'Enter') { setEditing(false); onEdit?.(parseFloat(editVal) || 0); } }}
          className="w-32 h-7 text-right text-xs"
          autoFocus
        />
      ) : (
        <span
          className={`${negative ? 'text-destructive' : ''} ${editable ? 'cursor-pointer hover:text-primary underline decoration-dotted' : ''}`}
          onClick={() => { if (editable) { setEditVal(String(Math.abs(value))); setEditing(true); } }}
        >
          {negative ? `-${fmt(Math.abs(value))}` : fmt(value)}
        </span>
      )}
    </div>
  );
}

function KPICard({ title, value, desc, good, icon: Icon }: {
  title: string; value: string; desc: string; good: boolean; icon: any;
}) {
  return (
    <div className={`bg-card rounded-xl border-2 p-5 ${good ? 'border-green-500/30' : 'border-amber-500/30'}`}>
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${good ? 'bg-green-500/10' : 'bg-amber-500/10'}`}>
          <Icon size={16} className={good ? 'text-green-600' : 'text-amber-600'} />
        </div>
        <span className="text-xs text-muted-foreground uppercase tracking-wider">{title}</span>
      </div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{desc}</div>
      <div className={`text-xs font-medium mt-2 ${good ? 'text-green-600' : 'text-amber-600'}`}>
        {good ? '● Saludable' : '● Requiere atención'}
      </div>
    </div>
  );
}
