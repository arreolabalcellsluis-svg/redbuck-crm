import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useExpenses } from '@/hooks/useExpenses';
import { useAssets, getTotalMonthlyDepAmort } from '@/hooks/useAssets';
import { useAccountsPayable } from '@/hooks/useAccountsPayable';
import { useProducts } from '@/hooks/useProducts';
import { useOrders } from '@/hooks/useOrders';
import { useAccountsReceivable } from '@/hooks/useAccountsReceivable';
import { useBankAccounts } from '@/hooks/useBankAccounts';
import {
  calcIncomeStatement, calcBalanceSheet, calcCashFlow,
  calcStrategicKPIs, calcMonthlyFlow, calcFinancialRadar,
  type PeriodRange, parseMonthLabel,
} from '@/lib/cfoDashboardEngine';
import {
  calcLeakSummary, detectSlowInventory, detectLowMarginProducts,
  detectCapitalConsumingClients, detectExcessInventory, detectPaymentPressure,
} from '@/lib/leakDetectorEngine';
import { calcScenarioComparison, SCENARIOS, type ScenarioType } from '@/lib/forecastEngine';
import MetricCard from '@/components/shared/MetricCard';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import {
  DollarSign, TrendingUp, Package, CreditCard, Building2,
  Wallet, BarChart3, Download, AlertTriangle,
  CheckCircle, RefreshCw, Banknote, Layers, Activity, Target, Radar,
  ShieldAlert, Eye, Sparkles,
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, PieChart, Pie, Cell,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar as RechartsRadar,
} from 'recharts';

const fmt = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);
const fmtPct = (n: number) => `${n.toFixed(1)}%`;
const fmtDays = (n: number) => `${Math.round(n)} días`;
const fmtX = (n: number) => `${n.toFixed(1)}x`;
const safePct = (num: number, den: number) => den !== 0 ? (num / den) * 100 : 0;

const COLORS = ['hsl(142,71%,45%)', 'hsl(210,100%,52%)', 'hsl(38,92%,50%)', 'hsl(0,78%,45%)', 'hsl(280,65%,55%)', 'hsl(190,80%,45%)'];

const MONTH_NAMES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

export default function CFODashboardPage() {
  const { data: dbExpenses } = useExpenses();
  const { data: dbAssets } = useAssets();
  const { data: dbPayables } = useAccountsPayable();
  const { data: dbProducts = [] } = useProducts();
  const { data: dbOrders = [] } = useOrders();
  const { data: dbReceivables = [] } = useAccountsReceivable();
  const { data: dbBankAccounts = [] } = useBankAccounts();

  const expenses = dbExpenses ?? [];
  const assets = dbAssets ?? [];
  const payables = dbPayables ?? [];

  // Real bank balance from bank_accounts table
  const totalBancos = useMemo(() =>
    dbBankAccounts.filter(b => b.activa).reduce((s, b) => s + b.saldo, 0),
    [dbBankAccounts]
  );

  // Compute monthly sales from real orders
  const monthlySales = useMemo(() => {
    const groups: Record<string, number> = {};
    dbOrders.filter(o => o.status !== 'cancelado').forEach(o => {
      const d = new Date(o.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      groups[key] = (groups[key] || 0) + o.total;
    });
    return Object.entries(groups)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, sales]) => {
        const [y, m] = key.split('-');
        return { month: `${MONTH_NAMES[parseInt(m) - 1]} ${y.slice(2)}`, sales };
      });
  }, [dbOrders]);

  // Compute gross margin from products catalog
  const grossMarginPct = useMemo(() => {
    const active = dbProducts.filter(p => p.active && p.list_price > 0);
    if (active.length === 0) return 0;
    return active.reduce((s, p) => s + (p.list_price - p.cost) / p.list_price * 100, 0) / active.length;
  }, [dbProducts]);

  const [bsConfig, setBsConfig] = useState({
    bancos: 0,
    creditosBancarios: 0,
    aportacionSocios: 2000000,
    utilidadesAcumuladas: 500000,
  });

  // Sync bank balance into bsConfig when data loads
  useEffect(() => {
    setBsConfig(prev => ({ ...prev, bancos: totalBancos }));
  }, [totalBancos]);

  // Period selector — derive available months from monthlySales
  const availableMonths = useMemo(() =>
    monthlySales.map(m => ({ label: m.month, value: parseMonthLabel(m.month) })),
    [monthlySales],
  );
  const [periodFrom, setPeriodFrom] = useState('2024-01');
  const [periodTo, setPeriodTo] = useState('2025-03');

  // Sync period defaults when availableMonths first loads
  useEffect(() => {
    if (availableMonths.length > 0) {
      setPeriodFrom(prev => availableMonths.find(m => m.value === prev) ? prev : availableMonths[0].value);
      setPeriodTo(prev => availableMonths.find(m => m.value === prev) ? prev : availableMonths[availableMonths.length - 1].value);
    }
  }, [availableMonths]);
  const period: PeriodRange = useMemo(() => ({ from: periodFrom, to: periodTo }), [periodFrom, periodTo]);

  const periodLabel = useMemo(() => {
    const fromItem = availableMonths.find(m => m.value === periodFrom);
    const toItem = availableMonths.find(m => m.value === periodTo);
    return `${fromItem?.label ?? periodFrom} — ${toItem?.label ?? periodTo}`;
  }, [periodFrom, periodTo, availableMonths]);

  const receivablesData = useMemo(() => dbReceivables.map(r => ({ paid: r.paid, balance: r.balance })), [dbReceivables]);
  const productsData = useMemo(() => dbProducts.map(p => ({ active: p.active, stock: p.stock as Record<string, number>, cost: p.cost })), [dbProducts]);

  // Map DB data to leak detector input shapes
  const leakProducts = useMemo(() => dbProducts.map(p => ({
    id: p.id, name: p.name, sku: p.sku, cost: p.cost,
    listPrice: p.list_price, minPrice: p.min_price,
    active: p.active, stock: p.stock as Record<string, number>,
    deliveryDays: p.delivery_days,
  })), [dbProducts]);

  const leakOrders = useMemo(() => dbOrders.map(o => ({
    items: (o.items as any[]).map((i: any) => ({ productName: i.productName ?? '', qty: i.qty ?? 1 })),
    createdAt: o.created_at, status: o.status,
  })), [dbOrders]);

  const leakReceivables = useMemo(() => dbReceivables.map(r => ({
    customerId: r.customer_id ?? '', customerName: r.customer_name,
    balance: r.balance, total: r.total, daysOverdue: r.days_overdue,
  })), [dbReceivables]);

  const income = useMemo(() => calcIncomeStatement(expenses, assets, monthlySales, grossMarginPct, 12, period), [expenses, assets, monthlySales, grossMarginPct, period]);
  const balance = useMemo(() => calcBalanceSheet(income, assets, payables, receivablesData, productsData, bsConfig), [income, assets, payables, receivablesData, productsData, bsConfig]);
  const cashFlow = useMemo(() => calcCashFlow(income, payables, receivablesData, { saldoInicial: bsConfig.bancos }), [income, payables, receivablesData, bsConfig.bancos]);
  const kpis = useMemo(() => calcStrategicKPIs(balance, income, payables), [balance, income, payables]);
  const monthlyFlow = useMemo(() => calcMonthlyFlow(expenses, monthlySales, grossMarginPct, period), [expenses, monthlySales, grossMarginPct, period]);
  const radar = useMemo(() => calcFinancialRadar(balance, income), [balance, income]);

  // Leak detector data — using real DB data
  const leakSummary = useMemo(() => calcLeakSummary(leakProducts, leakOrders, leakReceivables, payables), [leakProducts, leakOrders, leakReceivables, payables]);
  const slowInv = useMemo(() => detectSlowInventory(leakProducts, leakOrders), [leakProducts, leakOrders]);
  const lowMargin = useMemo(() => detectLowMarginProducts(leakProducts), [leakProducts]);
  const capClients = useMemo(() => detectCapitalConsumingClients(leakReceivables), [leakReceivables]);
  const excessInv = useMemo(() => detectExcessInventory(leakProducts, leakOrders), [leakProducts, leakOrders]);
  const payPressure = useMemo(() => detectPaymentPressure(payables), [payables]);

  // Forecast data
  const [forecastHorizon, setForecastHorizon] = useState(12);
  const [forecastScenario, setForecastScenario] = useState<ScenarioType>('base');
  const scenarioData = useMemo(
    () => calcScenarioComparison(forecastHorizon, income, balance, payables, monthlySales),
    [forecastHorizon, income, balance, payables, monthlySales],
  );
  const activeForecast = scenarioData.forecasts[forecastScenario];

  // Radar chart data (normalized to max for spider chart)
  const radarChartData = useMemo(() => {
    const maxVal = Math.max(radar.bancos, radar.cuentasPorCobrar, radar.inventario, radar.cuentasPorPagar, radar.creditosBancarios, Math.abs(radar.utilidadNeta), 1);
    return [
      { axis: 'Bancos', value: (radar.bancos / maxVal) * 100, raw: radar.bancos },
      { axis: 'CxC', value: (radar.cuentasPorCobrar / maxVal) * 100, raw: radar.cuentasPorCobrar },
      { axis: 'Inventario', value: (radar.inventario / maxVal) * 100, raw: radar.inventario },
      { axis: 'CxP', value: (radar.cuentasPorPagar / maxVal) * 100, raw: radar.cuentasPorPagar },
      { axis: 'Créditos', value: (radar.creditosBancarios / maxVal) * 100, raw: radar.creditosBancarios },
      { axis: 'Utilidad', value: (Math.abs(radar.utilidadNeta) / maxVal) * 100, raw: radar.utilidadNeta },
    ];
  }, [radar]);

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
      { Concepto: '  0-30 días', Monto: balance.cxpPor30 },
      { Concepto: '  31-60 días', Monto: balance.cxpPor60 },
      { Concepto: '  61-90 días', Monto: balance.cxpPor90 },
      { Concepto: '  91-120 días', Monto: balance.cxpPor120 },
      { Concepto: '  121-150 días', Monto: balance.cxpPor150 },
      { Concepto: '  151-180 días', Monto: balance.cxpPor180 },
      { Concepto: '  181-365 días', Monto: balance.cxpPor365 },
      { Concepto: '  365+ días', Monto: balance.cxpMas365 },
      { Concepto: 'Créditos bancarios', Monto: balance.creditosBancarios },
      { Concepto: 'Impuestos por pagar', Monto: balance.impuestosPorPagar },
      { Concepto: 'TOTAL PASIVOS', Monto: balance.totalPasivos },
      { Concepto: '---', Monto: '' },
      { Concepto: 'CAPITAL', Monto: '' },
      { Concepto: 'Aportación de socios', Monto: balance.aportacionSocios },
      { Concepto: 'Utilidades acumuladas', Monto: balance.utilidadesAcumuladas },
      { Concepto: 'Utilidad del ejercicio', Monto: balance.utilidadEjercicio },
      { Concepto: 'TOTAL CAPITAL', Monto: balance.totalCapital },
      { Concepto: '---', Monto: '' },
      { Concepto: 'Capital de trabajo', Monto: balance.capitalDeTrabajo },
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
      { Indicador: 'Capital de trabajo', Valor: balance.capitalDeTrabajo },
    ];
    const radarData = radar.distribution.map(d => ({
      Concepto: d.label, Valor: d.value, 'Porcentaje %': d.pct.toFixed(1),
    }));
    const flowData = monthlyFlow.map(m => ({
      Mes: m.month, Entradas: m.entradas, Salidas: m.salidas, Neto: m.neto, Acumulado: m.acumulado,
    }));

    import('xlsx').then(XLSX => {
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(incomeData), 'Estado Resultados');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(balanceData), 'Balance General');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(cashData), 'Flujo Efectivo');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(kpiData), 'Indicadores');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(radarData), 'Radar Financiero');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(flowData), 'Flujo Mensual');
      // Leak detector sheets
      const leakAlerts = leakSummary.alertas.map(a => ({ Tipo: a.tipo, Severidad: a.severity, Alerta: a.titulo, Descripción: a.descripcion, Monto: a.monto }));
      const slowData = slowInv.map(s => ({ Producto: s.name, SKU: s.sku, Stock: s.totalStock, 'Capital Detenido': s.capitalDetenido, 'Días sin venta': s.diasSinVenta, Severidad: s.severity }));
      const marginData = lowMargin.map(l => ({ Producto: l.name, Costo: l.cost, 'Precio Lista': l.listPrice, 'Precio Mín': l.minPrice, 'Margen Lista %': l.margenLista.toFixed(1), 'Margen Mín %': l.margenMinimo.toFixed(1), Severidad: l.severity }));
      const clientData = capClients.map(c => ({ Cliente: c.customerName, 'Saldo CxC': c.saldoPorCobrar, 'Días promedio': c.diasPromedioCobro, Facturas: c.facturasPendientes, Severidad: c.severity }));
      if (leakAlerts.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(leakAlerts), 'Alertas Fugas');
      if (slowData.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(slowData), 'Inv. Lento');
      if (marginData.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(marginData), 'Bajo Margen');
      if (clientData.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(clientData), 'Clientes Riesgo');
      // Forecast sheet
      const forecastData = activeForecast.months.map(m => ({
        Mes: m.month, Ventas: m.ventas, 'Ut. Bruta': m.utilidadBruta, EBITDA: m.ebitda,
        'Ut. Neta': m.utilidadNeta, 'Flujo Neto': m.flujoNeto, 'Saldo Caja': m.saldoCaja,
        'Inv. Necesario': m.inventarioNecesario, 'Cap. Trabajo': m.capitalTrabajo,
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(forecastData), `Predicción ${SCENARIOS[forecastScenario].label}`);
      XLSX.writeFile(wb, `Dashboard_Financiero_${new Date().toISOString().split('T')[0]}.xlsx`);
    });
  };

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
          <p className="page-subtitle">Visión consolidada: Estado de Resultados · Balance General · Flujo de Efectivo · Radar · KPIs</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 mt-3 sm:mt-0">
          {/* Period selector */}
           <div className="flex items-center gap-3 bg-card border rounded-lg px-4 py-2">
              <span className="text-sm text-muted-foreground font-medium whitespace-nowrap">Periodo:</span>
              <Select value={periodFrom} onValueChange={setPeriodFrom}>
                <SelectTrigger className="w-[160px] h-9 text-sm font-medium">
                  <SelectValue placeholder="Desde" />
                </SelectTrigger>
                <SelectContent>
                  {availableMonths.map(m => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground">a</span>
              <Select value={periodTo} onValueChange={setPeriodTo}>
                <SelectTrigger className="w-[160px] h-9 text-sm font-medium">
                  <SelectValue placeholder="Hasta" />
                </SelectTrigger>
                <SelectContent>
                  {availableMonths.filter(m => m.value >= periodFrom).map(m => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          <Button onClick={handleExportAll} className="gap-2">
            <Download size={16} /> Exportar Excel
          </Button>
        </div>
      </div>

      {/* Period badge */}
      <div className="mb-4 flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium border border-primary/20">
          <Activity size={12} />
          {periodLabel}
        </span>
        <span className="text-xs text-muted-foreground">
          {monthlySales.filter(m => { const k = parseMonthLabel(m.month); return k >= periodFrom && k <= periodTo; }).length} meses seleccionados
        </span>
      </div>

      {/* ─── Top KPIs — Executive style ──────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
        {/* Ventas */}
        <div className="bg-card rounded-xl border p-4 group" style={{ borderLeft: '4px solid hsl(var(--primary))' }}>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <DollarSign size={14} /> Ventas
          </div>
          <div className="text-xl font-bold">{fmt(income.ventas)}</div>
          <div className="flex items-center justify-between mt-2">
            <div className="w-full bg-muted rounded-full h-2">
              <div className="h-2 rounded-full bg-primary transition-all" style={{ width: '100%' }} />
            </div>
          </div>
        </div>

        {/* Utilidad Bruta */}
        <div className="bg-card rounded-xl border p-4 group" style={{ borderLeft: '4px solid hsl(var(--success))' }}>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <TrendingUp size={14} /> Utilidad Bruta
          </div>
          <div className="text-xl font-bold text-success">{fmt(income.utilidadBruta)}</div>
          <div className="space-y-0.5 mt-2 text-[10px]">
            <div className="flex justify-between"><span className="text-muted-foreground">Margen:</span> <span className="font-semibold">{fmtPct(income.margenBruto)}</span></div>
          </div>
        </div>

        {/* EBITDA */}
        <div className="bg-card rounded-xl border p-4 group" style={{ borderLeft: '4px solid hsl(var(--info))' }}>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <BarChart3 size={14} /> EBITDA
          </div>
          <div className="text-xl font-bold">{fmt(income.ebitda)}</div>
          <div className="space-y-0.5 mt-2 text-[10px]">
            <div className="flex justify-between"><span className="text-muted-foreground">Margen:</span> <span className="font-semibold">{fmtPct(income.margenEbitda)}</span></div>
          </div>
        </div>

        {/* Utilidad Neta */}
        <div className="bg-card rounded-xl border p-4 group" style={{ borderLeft: `4px solid hsl(var(--${income.utilidadNeta >= 0 ? 'success' : 'destructive'}))` }}>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Banknote size={14} /> Utilidad Neta
          </div>
          <div className={`text-xl font-bold ${income.utilidadNeta >= 0 ? 'text-success' : 'text-destructive'}`}>{fmt(income.utilidadNeta)}</div>
          <div className="space-y-0.5 mt-2 text-[10px]">
            <div className="flex justify-between"><span className="text-muted-foreground">Margen:</span> <span className="font-semibold">{fmtPct(income.margenNeto)}</span></div>
          </div>
        </div>

        {/* Bancos */}
        <div className="bg-card rounded-xl border p-4 group" style={{ borderLeft: '4px solid hsl(var(--primary))' }}>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Building2 size={14} /> Bancos
          </div>
          <div className="text-xl font-bold">{fmt(balance.bancos)}</div>
        </div>

        {/* Inventario */}
        <div className="bg-card rounded-xl border p-4 group" style={{ borderLeft: '4px solid hsl(var(--warning))' }}>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Package size={14} /> Inventario
          </div>
          <div className="text-xl font-bold">{fmt(balance.inventario)}</div>
        </div>

        {/* CxC */}
        <div className="bg-card rounded-xl border p-4 group" style={{ borderLeft: '4px solid hsl(var(--warning))' }}>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <CreditCard size={14} /> CxC
          </div>
          <div className="text-xl font-bold">{fmt(balance.cuentasPorCobrar)}</div>
          <div className="space-y-0.5 mt-2 text-[10px]">
            <div className="flex justify-between"><span className="text-muted-foreground">Días:</span> <span className="font-semibold">{fmtDays(kpis.diasCxC)}</span></div>
          </div>
        </div>

        {/* CxP */}
        <div className="bg-card rounded-xl border p-4 group" style={{ borderLeft: '4px solid hsl(var(--destructive))' }}>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Wallet size={14} /> CxP
          </div>
          <div className="text-xl font-bold text-destructive">{fmt(balance.cuentasPorPagar)}</div>
          <div className="space-y-0.5 mt-2 text-[10px]">
            <div className="flex justify-between"><span className="text-muted-foreground">Días:</span> <span className="font-semibold">{fmtDays(kpis.diasCxP)}</span></div>
          </div>
        </div>
      </div>

      {/* ─── Tabs ──────────────────────────────────────────────── */}
      <Tabs defaultValue="radar" className="space-y-4">
        <TabsList className="grid grid-cols-4 md:grid-cols-8 w-full max-w-5xl">
          <TabsTrigger value="radar">Radar</TabsTrigger>
          <TabsTrigger value="income">Resultados</TabsTrigger>
          <TabsTrigger value="balance">Balance</TabsTrigger>
          <TabsTrigger value="cashflow">Flujo</TabsTrigger>
          <TabsTrigger value="kpis">KPIs</TabsTrigger>
          <TabsTrigger value="moneymap">Mapa</TabsTrigger>
          <TabsTrigger value="leaks" className="gap-1">
            <ShieldAlert size={14} /> Fugas
            {leakSummary.alertas.length > 0 && (
              <span className="ml-1 bg-destructive text-destructive-foreground text-[10px] rounded-full px-1.5 py-0.5 font-bold">
                {leakSummary.alertas.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="forecast" className="gap-1">
            <Sparkles size={14} /> Predicción
          </TabsTrigger>
        </TabsList>

        {/* ─── FINANCIAL RADAR TAB ──────────────────────────────── */}
        <TabsContent value="radar">
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Spider Chart */}
            <div className="bg-card rounded-xl border p-6">
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                <Radar size={20} /> Radar Financiero del Negocio
              </h3>
              <p className="text-xs text-muted-foreground mb-4">¿Dónde está el dinero del negocio?</p>
              <ResponsiveContainer width="100%" height={380}>
                <RadarChart data={radarChartData} cx="50%" cy="50%" outerRadius="75%">
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis dataKey="axis" tick={{ fontSize: 12, fill: 'hsl(var(--foreground))' }} />
                  <PolarRadiusAxis tick={false} axisLine={false} />
                  <RechartsRadar name="Capital" dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.25} strokeWidth={2} />
                  <Tooltip
                    content={({ payload }) => {
                      if (!payload?.[0]) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="bg-popover border rounded-lg p-3 shadow-lg">
                          <div className="font-bold text-sm">{d.axis}</div>
                          <div className="text-sm">{fmt(d.raw)}</div>
                        </div>
                      );
                    }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {/* Capital Distribution */}
            <div className="space-y-4">
              <div className="bg-card rounded-xl border p-6">
                <h3 className="text-lg font-bold mb-4">Distribución del Capital</h3>
                <div className="space-y-3">
                  {radar.distribution.map((d, i) => (
                    <div key={i}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium">{d.label}</span>
                        <span className="font-bold">{fmt(d.value)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${Math.min(100, Math.abs(d.pct))}%`,
                              backgroundColor: d.color,
                              opacity: d.value < 0 ? 0.6 : 1,
                            }}
                          />
                        </div>
                        <span className={`text-xs font-mono w-14 text-right ${d.value < 0 ? 'text-destructive' : ''}`}>
                          {d.pct > 0 ? '+' : ''}{d.pct.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Capital de trabajo */}
              <div className={`rounded-xl border-2 p-6 ${radar.capitalDeTrabajo > 0 ? 'bg-green-500/5 border-green-500/20' : 'bg-destructive/5 border-destructive/20'}`}>
                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Capital de Trabajo</div>
                <div className={`text-3xl font-bold ${radar.capitalDeTrabajo > 0 ? 'text-green-600' : 'text-destructive'}`}>
                  {fmt(radar.capitalDeTrabajo)}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Activos circulantes ({fmt(balance.totalCirculantes)}) − Pasivos circulantes ({fmt(balance.cuentasPorPagar + balance.impuestosPorPagar)})
                </p>
                <div className="mt-3 p-3 bg-card rounded-lg text-xs">
                  {radar.capitalDeTrabajo > 0
                    ? '✅ La empresa tiene capacidad para cubrir sus obligaciones de corto plazo.'
                    : '⚠️ Los pasivos circulantes superan los activos circulantes. Riesgo de liquidez.'}
                </div>
              </div>

              {/* Quick decisions */}
              <div className="bg-card rounded-xl border p-6">
                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">Diagnóstico Rápido</h3>
                <div className="space-y-2 text-xs">
                  <DiagnosticItem
                    condition={balance.inventario > balance.totalCirculantes * 0.6}
                    warn="Inventario concentra más del 60% de activos circulantes → capital congelado"
                    ok="Inventario dentro de rangos normales"
                  />
                  <DiagnosticItem
                    condition={balance.cuentasPorCobrar > income.ventas / 6}
                    warn="CxC equivale a más de 2 meses de ventas → problema de cobranza"
                    ok="Cobranza dentro de parámetros saludables"
                  />
                  <DiagnosticItem
                    condition={balance.cuentasPorPagar < balance.inventario * 0.1}
                    warn="CxP muy bajo → no se aprovecha crédito comercial de proveedores"
                    ok="Se utiliza crédito comercial adecuadamente"
                  />
                  <DiagnosticItem
                    condition={balance.bancos < income.gastosOperativos / 3}
                    warn="Liquidez baja: bancos no cubre un mes de operación"
                    ok="Liquidez bancaria suficiente"
                  />
                  <DiagnosticItem
                    condition={balance.creditosBancarios > balance.totalCapital * 0.5}
                    warn="Deuda bancaria alta respecto al capital"
                    ok="Nivel de deuda bancaria controlado"
                  />
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

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

            {/* Pasivos + Capital */}
            <div className="bg-card rounded-xl border p-6">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <AlertTriangle size={18} /> Pasivos + Capital
              </h3>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Row label="Cuentas por pagar" value={balance.cuentasPorPagar} />
                  <div className="pl-4 space-y-1 text-xs text-muted-foreground">
                    <div className="flex justify-between"><span>0-30 días</span><span>{fmt(balance.cxpPor30)}</span></div>
                    <div className="flex justify-between"><span>31-60 días</span><span>{fmt(balance.cxpPor60)}</span></div>
                    <div className="flex justify-between"><span>61-90 días</span><span>{fmt(balance.cxpPor90)}</span></div>
                    <div className="flex justify-between"><span>91-120 días</span><span>{fmt(balance.cxpPor120)}</span></div>
                    <div className="flex justify-between"><span>121-150 días</span><span>{fmt(balance.cxpPor150)}</span></div>
                    <div className="flex justify-between"><span>151-180 días</span><span>{fmt(balance.cxpPor180)}</span></div>
                    <div className="flex justify-between"><span>181-365 días</span><span>{fmt(balance.cxpPor365)}</span></div>
                    <div className="flex justify-between"><span>365+ días</span><span>{fmt(balance.cxpMas365)}</span></div>
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
                  <div className="mt-1">
                    <Row label="Capital de trabajo" value={balance.capitalDeTrabajo} bold />
                  </div>
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
              <div className="bg-card rounded-xl border p-6">
                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">Flujo Operativo</h3>
                <div className="space-y-1.5 text-sm">
                  <FlowRow label="+ Cobros de clientes" value={cashFlow.cobrosClientes} positive />
                  <FlowRow label="+ Ventas" value={cashFlow.ingresosVentas} positive />
                  <FlowRow label="- Proveedores" value={cashFlow.pagosProveedores} />
                  <FlowRow label="- Gastos operativos" value={cashFlow.gastosOperativos} />
                  <FlowRow label="- Nómina" value={cashFlow.nomina} />
                  <FlowRow label="- Impuestos" value={cashFlow.impuestosPagados} />
                  <div className="flex justify-between font-bold border-t pt-2 mt-2">
                    <span>Total operativo</span>
                    <span className={cashFlow.flujoOperativo >= 0 ? 'text-green-600' : 'text-destructive'}>{fmt(cashFlow.flujoOperativo)}</span>
                  </div>
                </div>
              </div>
              <div className="bg-card rounded-xl border p-6">
                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">Flujo de Inversión</h3>
                <div className="space-y-1.5 text-sm">
                  <FlowRow label="- Compra de activos" value={cashFlow.compraActivos} />
                  <div className="flex justify-between font-bold border-t pt-2 mt-2"><span>Total inversión</span><span>{fmt(cashFlow.flujoInversion)}</span></div>
                </div>
              </div>
              <div className="bg-card rounded-xl border p-6">
                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">Flujo de Financiamiento</h3>
                <div className="space-y-1.5 text-sm">
                  <FlowRow label="+ Préstamos" value={cashFlow.prestamosRecibidos} positive />
                  <FlowRow label="- Pagos de deuda" value={cashFlow.pagosDeuda} />
                  <FlowRow label="+ Aportaciones" value={cashFlow.aportacionesSocios} positive />
                  <div className="flex justify-between font-bold border-t pt-2 mt-2"><span>Total financiamiento</span><span>{fmt(cashFlow.flujoFinanciamiento)}</span></div>
                </div>
              </div>
              <div className="bg-primary/5 rounded-xl border-2 border-primary/20 p-6">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div><div className="text-xs text-muted-foreground">Saldo Inicial</div><div className="text-lg font-bold">{fmt(cashFlow.saldoInicial)}</div></div>
                  <div><div className="text-xs text-muted-foreground">Flujo Neto</div><div className={`text-lg font-bold ${cashFlow.flujoNeto >= 0 ? 'text-green-600' : 'text-destructive'}`}>{fmt(cashFlow.flujoNeto)}</div></div>
                  <div><div className="text-xs text-muted-foreground">Saldo Final</div><div className="text-lg font-bold text-primary">{fmt(cashFlow.saldoFinal)}</div></div>
                </div>
              </div>
            </div>
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
            <div className="bg-card rounded-xl border p-6">
              <h3 className="text-lg font-bold mb-4">Ciclo de Conversión de Efectivo</h3>
              <div className="text-sm text-muted-foreground mb-4">CCC = Días Inventario + Días CxC − Días CxP</div>
              <div className="space-y-4">
                <ProgressBar label="Días de inventario" value={kpis.diasInventario} max={200} color="bg-amber-500" />
                <ProgressBar label="Días CxC" value={kpis.diasCxC} max={200} color="bg-blue-500" />
                <ProgressBar label="Días CxP" value={kpis.diasCxP} max={200} color="bg-green-500" negative />
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
                <strong>Interpretación:</strong> El inventario rota {kpis.rotacionInventario.toFixed(1)} veces al año, cada unidad permanece {Math.round(kpis.diasInventario)} días en promedio. Capital de {fmt(kpis.capitalEnInventario)} detenido hasta venderse.
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ─── MONEY MAP TAB ────────────────────────────────────── */}
        <TabsContent value="moneymap">
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Flow diagram */}
            <div className="bg-card rounded-xl border p-6">
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                <Activity size={20} /> Mapa del Dinero del Negocio
              </h3>
              <p className="text-xs text-muted-foreground mb-6">Cómo fluye el dinero dentro de la empresa</p>
              <div className="space-y-0">
                {[
                  { stage: 'Dinero en Bancos', value: balance.bancos, icon: '🏦', desc: 'Capital disponible', color: 'bg-green-500' },
                  { stage: 'Compra Inventario', value: balance.inventario, icon: '📦', desc: `${fmtDays(kpis.diasInventario)} promedio en bodega`, color: 'bg-amber-500' },
                  { stage: 'Ventas', value: income.ventas, icon: '💰', desc: `${fmt(income.ventas / 12)}/mes promedio`, color: 'bg-blue-500' },
                  { stage: 'Cuentas por Cobrar', value: balance.cuentasPorCobrar, icon: '📋', desc: `${fmtDays(kpis.diasCxC)} promedio de cobro`, color: 'bg-purple-500' },
                  { stage: 'Cobro', value: income.ventas - balance.cuentasPorCobrar, icon: '✅', desc: 'Efectivo recuperado', color: 'bg-emerald-500' },
                  { stage: 'Dinero en Bancos', value: cashFlow.saldoFinal, icon: '🏦', desc: 'Ciclo completo', color: 'bg-green-500' },
                ].map((step, i, arr) => (
                  <div key={i}>
                    <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/30 hover:bg-muted/60 transition-colors">
                      <div className="text-2xl w-10 text-center">{step.icon}</div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm">{step.stage}</div>
                        <div className="text-xs text-muted-foreground">{step.desc}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-bold text-sm">{fmt(step.value)}</div>
                      </div>
                      <div className={`w-2 h-8 rounded-full ${step.color}`} />
                    </div>
                    {i < arr.length - 1 && (
                      <div className="flex justify-center py-1">
                        <div className="w-0.5 h-6 bg-border" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-4 p-3 bg-primary/5 rounded-lg text-xs">
                <strong>Ciclo total:</strong> El dinero tarda <strong>{fmtDays(kpis.cicloConversionEfectivo)}</strong> en regresar al negocio (Inv: {fmtDays(kpis.diasInventario)} + CxC: {fmtDays(kpis.diasCxC)} − CxP: {fmtDays(kpis.diasCxP)})
              </div>
            </div>

            {/* Where money is stuck + bottleneck analysis */}
            <div className="space-y-4">
              <div className="bg-card rounded-xl border p-6">
                <h3 className="text-lg font-bold mb-4">¿Dónde está detenido el capital?</h3>
                {(() => {
                  const stages = [
                    { label: 'Inventario', value: balance.inventario, color: 'bg-amber-500', time: kpis.diasInventario },
                    { label: 'Cuentas por cobrar', value: balance.cuentasPorCobrar, color: 'bg-blue-500', time: kpis.diasCxC },
                    { label: 'Bancos', value: balance.bancos, color: 'bg-green-500', time: 0 },
                  ];
                  const total = stages.reduce((s, st) => s + st.value, 0);
                  return (
                    <div className="space-y-4">
                      {stages.map((st, i) => (
                        <div key={i}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="font-medium">{st.label}</span>
                            <div className="text-right">
                              <span className="font-bold">{fmt(st.value)}</span>
                              <span className="text-muted-foreground ml-2">({safePct(st.value, total).toFixed(0)}%)</span>
                            </div>
                          </div>
                          <div className="h-5 bg-muted rounded-full overflow-hidden">
                            <div className={`h-full ${st.color} rounded-full transition-all flex items-center justify-end pr-2`}
                              style={{ width: `${Math.max(5, safePct(st.value, total))}%` }}>
                              {st.time > 0 && <span className="text-[10px] text-white font-bold">{Math.round(st.time)}d</span>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* Bottleneck detection */}
              <div className="bg-card rounded-xl border p-6">
                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">Detección de Cuellos de Botella</h3>
                <div className="space-y-2 text-xs">
                  <DiagnosticItem
                    condition={kpis.diasInventario > 90}
                    warn={`Inventario lento (${Math.round(kpis.diasInventario)} días) → capital congelado por ${fmt(balance.inventario)}`}
                    ok={`Inventario fluye bien (${Math.round(kpis.diasInventario)} días)`}
                  />
                  <DiagnosticItem
                    condition={kpis.diasCxC > 45}
                    warn={`Cobranza lenta (${Math.round(kpis.diasCxC)} días) → ${fmt(balance.cuentasPorCobrar)} sin cobrar`}
                    ok={`Cobranza eficiente (${Math.round(kpis.diasCxC)} días)`}
                  />
                  <DiagnosticItem
                    condition={kpis.diasCxP < 15}
                    warn={`Pago a proveedores muy rápido (${Math.round(kpis.diasCxP)} días) → no se aprovecha crédito`}
                    ok={`Uso de crédito comercial adecuado (${Math.round(kpis.diasCxP)} días)`}
                  />
                  <DiagnosticItem
                    condition={kpis.cicloConversionEfectivo > 90}
                    warn={`Ciclo de efectivo largo (${Math.round(kpis.cicloConversionEfectivo)} días) → presión de liquidez`}
                    ok={`Ciclo de efectivo saludable (${Math.round(kpis.cicloConversionEfectivo)} días)`}
                  />
                </div>
              </div>

              {/* Quick summary card */}
              <div className={`rounded-xl border-2 p-6 ${kpis.cicloConversionEfectivo < 90 ? 'bg-green-500/5 border-green-500/20' : 'bg-amber-500/5 border-amber-500/20'}`}>
                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Velocidad del Dinero</div>
                <div className={`text-3xl font-bold ${kpis.cicloConversionEfectivo < 90 ? 'text-green-600' : 'text-amber-600'}`}>
                  {fmtDays(kpis.cicloConversionEfectivo)}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Tiempo que tarda $1 en salir del banco, convertirse en producto, venderse, cobrarse y regresar.
                </p>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ─── LEAK DETECTOR TAB ────────────────────────────────── */}
        <TabsContent value="leaks">
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
            <MetricCard title="Inv. Detenido" value={fmt(leakSummary.capitalInventarioLento)} icon={Package} variant={leakSummary.capitalInventarioLento > 300000 ? 'danger' : 'warning'} />
            <MetricCard title="Bajo Margen" value={`${lowMargin.length} prod.`} icon={TrendingUp} variant={lowMargin.length > 3 ? 'danger' : 'warning'} />
            <MetricCard title="CxC Lenta" value={fmt(leakSummary.capitalClientesLentos)} icon={CreditCard} variant={leakSummary.capitalClientesLentos > 80000 ? 'danger' : 'warning'} />
            <MetricCard title="Exceso Inv." value={fmt(leakSummary.capitalExcesoInventario)} icon={Layers} variant={leakSummary.capitalExcesoInventario > 200000 ? 'danger' : 'warning'} />
            <MetricCard title="Pagos 30d" value={fmt(leakSummary.presionPagos30d)} icon={Wallet} variant={leakSummary.presionPagos30d > 100000 ? 'danger' : 'info'} />
          </div>

          {/* Total leak banner */}
          <div className={`rounded-xl border-2 p-4 mb-6 flex items-center justify-between ${leakSummary.totalFugas > 500000 ? 'bg-destructive/5 border-destructive/30' : 'bg-amber-500/5 border-amber-500/30'}`}>
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider">Capital Total en Riesgo / Detenido</div>
              <div className={`text-3xl font-bold ${leakSummary.totalFugas > 500000 ? 'text-destructive' : 'text-amber-600'}`}>{fmt(leakSummary.totalFugas)}</div>
            </div>
            <ShieldAlert size={40} className={leakSummary.totalFugas > 500000 ? 'text-destructive/40' : 'text-amber-500/40'} />
          </div>

          {/* Alerts */}
          {leakSummary.alertas.length > 0 && (
            <div className="bg-card rounded-xl border p-6 mb-6">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <AlertTriangle size={18} /> Alertas del Negocio
              </h3>
              <div className="space-y-2">
                {leakSummary.alertas.map((alerta, i) => (
                  <div key={i} className={`flex items-start gap-3 p-3 rounded-lg ${
                    alerta.severity === 'critico' ? 'bg-destructive/10' : alerta.severity === 'alto' ? 'bg-amber-500/10' : 'bg-muted/50'
                  }`}>
                    <span className="text-lg mt-0.5">{alerta.severity === 'critico' ? '🔴' : alerta.severity === 'alto' ? '🟡' : '🟠'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm">{alerta.titulo}</div>
                      <div className="text-xs text-muted-foreground">{alerta.descripcion}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-bold text-sm">{fmt(alerta.monto)}</div>
                      <div className={`text-[10px] uppercase font-bold ${
                        alerta.severity === 'critico' ? 'text-destructive' : 'text-amber-600'
                      }`}>{alerta.severity}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Slow Inventory */}
            <div className="bg-card rounded-xl border p-6">
              <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <Package size={16} /> Inventario sin Rotación
              </h3>
              {slowInv.length === 0 ? (
                <p className="text-sm text-muted-foreground">✅ Todos los productos tienen ventas recientes</p>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {slowInv.map((item, i) => (
                    <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30 text-sm">
                      <SeverityDot severity={item.severity} />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{item.name}</div>
                        <div className="text-xs text-muted-foreground">{item.totalStock} uds · {item.diasSinVenta} días sin venta</div>
                      </div>
                      <div className="text-right shrink-0 font-bold text-sm">{fmt(item.capitalDetenido)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Low Margin */}
            <div className="bg-card rounded-xl border p-6">
              <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <TrendingUp size={16} /> Productos Bajo Margen
              </h3>
              {lowMargin.length === 0 ? (
                <p className="text-sm text-muted-foreground">✅ Todos los productos tienen margen saludable</p>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {lowMargin.map((item, i) => (
                    <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30 text-sm">
                      <SeverityDot severity={item.severity} />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{item.name}</div>
                        <div className="text-xs text-muted-foreground">
                          Margen lista: {item.margenLista.toFixed(1)}% · Margen mín: {item.margenMinimo.toFixed(1)}%
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs text-muted-foreground">Costo: {fmt(item.cost)}</div>
                        <div className="text-xs">Lista: {fmt(item.listPrice)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Capital Consuming Clients */}
            <div className="bg-card rounded-xl border p-6">
              <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <Eye size={16} /> Clientes que Consumen Capital
              </h3>
              {capClients.length === 0 ? (
                <p className="text-sm text-muted-foreground">✅ Todos los clientes pagan a tiempo</p>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {capClients.map((item, i) => (
                    <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30 text-sm">
                      <SeverityDot severity={item.severity} />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{item.customerName}</div>
                        <div className="text-xs text-muted-foreground">
                          {item.facturasPendientes} factura(s) · {item.diasPromedioCobro} días promedio
                        </div>
                      </div>
                      <div className="text-right shrink-0 font-bold text-sm">{fmt(item.saldoPorCobrar)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Excess Inventory */}
            <div className="bg-card rounded-xl border p-6">
              <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <Layers size={16} /> Exceso de Inventario
              </h3>
              {excessInv.length === 0 ? (
                <p className="text-sm text-muted-foreground">✅ Niveles de inventario dentro del rango óptimo</p>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {excessInv.map((item, i) => (
                    <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30 text-sm">
                      <SeverityDot severity={item.severity} />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{item.name}</div>
                        <div className="text-xs text-muted-foreground">
                          Actual: {item.stockActual} · Recomendado: {item.stockRecomendado} · Exceso: +{item.exceso}
                        </div>
                      </div>
                      <div className="text-right shrink-0 font-bold text-sm">{fmt(item.capitalExceso)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Payment Pressure */}
            <div className="bg-card rounded-xl border p-6 lg:col-span-2">
              <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <Wallet size={16} /> Presión de Pagos a Proveedores
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {payPressure.map((item, i) => (
                  <div key={i} className={`rounded-lg p-3 text-center border ${
                    item.severity === 'critico' ? 'bg-destructive/10 border-destructive/30' :
                    item.severity === 'alto' ? 'bg-amber-500/10 border-amber-500/30' :
                    item.severity === 'medio' ? 'bg-blue-500/5 border-blue-500/20' :
                    'bg-muted/30 border-border'
                  }`}>
                    <div className="text-xs text-muted-foreground mb-1">{item.periodo}</div>
                    <div className="text-lg font-bold">{fmt(item.totalPagar)}</div>
                    <div className="text-[10px] text-muted-foreground">{item.cantidadFacturas} factura(s)</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ─── FORECAST TAB ─────────────────────────────────────── */}
        <TabsContent value="forecast">
          {/* Controls */}
          <div className="flex flex-wrap items-center gap-4 mb-6">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Horizonte:</span>
              <Select value={String(forecastHorizon)} onValueChange={v => setForecastHorizon(Number(v))}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 meses</SelectItem>
                  <SelectItem value="6">6 meses</SelectItem>
                  <SelectItem value="12">12 meses</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Escenario:</span>
              {(['conservador', 'base', 'agresivo'] as ScenarioType[]).map(s => (
                <Button
                  key={s}
                  size="sm"
                  variant={forecastScenario === s ? 'default' : 'outline'}
                  onClick={() => setForecastScenario(s)}
                  className="text-xs"
                >
                  {SCENARIOS[s].label}
                </Button>
              ))}
            </div>
          </div>

          {/* Summary KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            <MetricCard title={`Ventas ${forecastHorizon}m`} value={fmt(activeForecast.ventasTotal)} icon={DollarSign} />
            <MetricCard title="Ut. Bruta Proy." value={fmt(activeForecast.utilidadBrutaTotal)} icon={TrendingUp} />
            <MetricCard title="EBITDA Proy." value={fmt(activeForecast.ebitdaTotal)} icon={BarChart3} />
            <MetricCard title="Ut. Neta Proy." value={fmt(activeForecast.utilidadNetaTotal)} icon={Banknote} variant={activeForecast.utilidadNetaTotal < 0 ? 'danger' : 'success'} />
            <MetricCard title="Flujo Neto" value={fmt(activeForecast.flujoNetoTotal)} icon={Activity} variant={activeForecast.flujoNetoTotal < 0 ? 'danger' : 'success'} />
            <MetricCard title="Cap. Trabajo Final" value={fmt(activeForecast.capitalTrabajoFinal)} icon={Layers} variant={activeForecast.capitalTrabajoFinal < 0 ? 'danger' : 'info'} />
          </div>

          <div className="grid lg:grid-cols-2 gap-6 mb-6">
            {/* Sales + Profit projection chart */}
            <div className="bg-card rounded-xl border p-6">
              <h3 className="text-lg font-bold mb-4">Ventas y Utilidad Proyectadas</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={activeForecast.months}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tickFormatter={v => `$${(v / 1000000).toFixed(1)}M`} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Legend />
                  <Bar dataKey="ventas" name="Ventas" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="utilidadNeta" name="Ut. Neta" fill="hsl(142,71%,45%)" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Cash flow projection */}
            <div className="bg-card rounded-xl border p-6">
              <h3 className="text-lg font-bold mb-4">Flujo de Efectivo Proyectado</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={activeForecast.months}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tickFormatter={v => `$${(v / 1000000).toFixed(1)}M`} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Legend />
                  <Line type="monotone" dataKey="saldoCaja" name="Saldo Caja" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="flujoNeto" name="Flujo Neto" stroke="hsl(142,71%,45%)" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="capitalTrabajo" name="Cap. Trabajo" stroke="hsl(38,92%,50%)" strokeWidth={1.5} strokeDasharray="5 5" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Scenario comparison */}
            <div className="bg-card rounded-xl border p-6">
              <h3 className="text-lg font-bold mb-4">Comparativo de Escenarios ({forecastHorizon} meses)</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={scenarioData.comparison} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tickFormatter={v => `$${(v / 1000000).toFixed(1)}M`} tick={{ fontSize: 10 }} />
                  <YAxis dataKey="label" type="category" tick={{ fontSize: 11 }} width={90} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Legend />
                  <Bar dataKey="conservador" name="Conservador" fill={SCENARIOS.conservador.color} radius={[0, 2, 2, 0]} />
                  <Bar dataKey="base" name="Base" fill={SCENARIOS.base.color} radius={[0, 2, 2, 0]} />
                  <Bar dataKey="agresivo" name="Agresivo" fill={SCENARIOS.agresivo.color} radius={[0, 2, 2, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Forecast alerts */}
            <div className="bg-card rounded-xl border p-6">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <AlertTriangle size={18} /> Alertas Futuras ({SCENARIOS[forecastScenario].label})
              </h3>
              {activeForecast.alertas.length === 0 ? (
                <div className="flex items-center gap-2 p-4 bg-green-500/5 rounded-lg">
                  <CheckCircle size={18} className="text-green-600" />
                  <span className="text-sm">No se detectan riesgos financieros en el horizonte proyectado</span>
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {activeForecast.alertas.map((a, i) => (
                    <div key={i} className={`flex items-start gap-3 p-3 rounded-lg ${
                      a.severity === 'critico' ? 'bg-destructive/10' : a.severity === 'alto' ? 'bg-amber-500/10' : 'bg-muted/50'
                    }`}>
                      <span className="text-lg mt-0.5">{a.severity === 'critico' ? '🔴' : a.severity === 'alto' ? '🟡' : '🟠'}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm">{a.titulo}</div>
                        <div className="text-xs text-muted-foreground">{a.descripcion}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-bold text-sm">{fmt(a.monto)}</div>
                        <div className="text-[10px] text-muted-foreground">{a.mes}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Inventory projection summary */}
              <div className="mt-4 p-3 bg-muted/30 rounded-lg">
                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Inventario Promedio Requerido</div>
                <div className="text-lg font-bold">{fmt(activeForecast.inventarioCapitalRequerido)}</div>
                <div className="text-xs text-muted-foreground">
                  {activeForecast.inventarioCapitalRequerido > balance.inventario
                    ? `⚠️ Se necesita ${fmt(activeForecast.inventarioCapitalRequerido - balance.inventario)} adicional`
                    : '✅ Inventario actual es suficiente'}
                </div>
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

function FlowRow({ label, value, positive }: { label: string; value: number; positive?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className={positive ? 'text-green-600' : 'text-destructive'}>{label}</span>
      <span>{fmt(value)}</span>
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

function ProgressBar({ label, value, max, color, negative }: {
  label: string; value: number; max: number; color: string; negative?: boolean;
}) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span>{label}</span>
        <span className={`font-bold ${negative ? 'text-green-600' : ''}`}>{negative ? '-' : ''}{fmtDays(value)}</span>
      </div>
      <div className="h-3 bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
      </div>
    </div>
  );
}

function DiagnosticItem({ condition, warn, ok }: { condition: boolean; warn: string; ok: string }) {
  return (
    <div className={`flex items-start gap-2 p-2 rounded ${condition ? 'bg-amber-500/10' : 'bg-green-500/5'}`}>
      <span className="mt-0.5">{condition ? '⚠️' : '✅'}</span>
      <span>{condition ? warn : ok}</span>
    </div>
  );
}

function SeverityDot({ severity }: { severity: 'critico' | 'alto' | 'medio' }) {
  const color = severity === 'critico' ? 'bg-destructive' : severity === 'alto' ? 'bg-amber-500' : 'bg-blue-500';
  return <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${color}`} />;
}
