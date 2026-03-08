import { useState, useMemo } from 'react';
import {
  DollarSign, TrendingUp, TrendingDown, PlusCircle, Trash2, BarChart3,
  PieChart as PieChartIcon, Target, ArrowUpRight, ArrowDownRight, Banknote,
  Layers, Calculator, FileText, Copy, Loader2, Download,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  EXPENSE_CATEGORIES, AREA_LABELS, TYPE_LABELS,
  calculateExpenseSummary, calculateFinancialMetrics,
  type OperatingExpense, type ExpenseCategory, type ExpenseType, type ExpenseArea,
  demoExpenses,
} from '@/lib/operatingExpensesEngine';
import { useExpenses, useAddExpense, useDeleteExpense } from '@/hooks/useExpenses';
import { dashboardMetrics } from '@/data/demo-data';

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);
const fmtPct = (n: number) => `${n.toFixed(1)}%`;

const COLORS = [
  'hsl(0,78%,45%)', 'hsl(210,100%,52%)', 'hsl(142,71%,45%)',
  'hsl(38,92%,50%)', 'hsl(280,65%,55%)', 'hsl(190,80%,45%)',
  'hsl(330,70%,50%)', 'hsl(0,0%,60%)', 'hsl(60,80%,45%)',
];

type Tab = 'registro' | 'dashboard' | 'director';

export default function OperatingExpensesPage() {
  const [tab, setTab] = useState<Tab>('dashboard');

  // DB data
  const { data: dbExpenses, isLoading } = useExpenses();
  const addExpenseMutation = useAddExpense();
  const deleteExpenseMutation = useDeleteExpense();

  // Use DB data if available, fallback to demo
  const expenses: OperatingExpense[] = dbExpenses && dbExpenses.length > 0 ? dbExpenses : demoExpenses;

  // Form state
  const [formCat, setFormCat] = useState<ExpenseCategory>('personal');
  const [formSub, setFormSub] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formMonto, setFormMonto] = useState(0);
  const [formTipo, setFormTipo] = useState<ExpenseType>('variable');
  const [formArea, setFormArea] = useState<ExpenseArea>('administracion');
  const [formFecha, setFormFecha] = useState(new Date().toISOString().slice(0, 10));
  const [formNotas, setFormNotas] = useState('');

  // Filter
  const [filterCat, setFilterCat] = useState<string>('all');

  // Excel download
  const [dlOpen, setDlOpen] = useState(false);
  const [dlDateFrom, setDlDateFrom] = useState('');
  const [dlDateTo, setDlDateTo] = useState('');

  const dlFilteredCount = useMemo(() => {
    if (!dlDateFrom && !dlDateTo) return expenses.length;
    return expenses.filter(e => {
      if (dlDateFrom && e.fecha < dlDateFrom) return false;
      if (dlDateTo && e.fecha > dlDateTo) return false;
      return true;
    }).length;
  }, [expenses, dlDateFrom, dlDateTo]);

  const handleExcelDownload = async () => {
    const XLSX = await import('xlsx');
    const { saveAs } = await import('file-saver');
    const filtered = expenses.filter(e => {
      if (dlDateFrom && e.fecha < dlDateFrom) return false;
      if (dlDateTo && e.fecha > dlDateTo) return false;
      return true;
    });
    const wb = XLSX.utils.book_new();
    const data = filtered.map(e => ({
      Fecha: e.fecha, Categoría: EXPENSE_CATEGORIES[e.categoria]?.label ?? e.categoria,
      Subcategoría: e.subcategoria, Descripción: e.descripcion, Monto: e.monto,
      Tipo: TYPE_LABELS[e.tipo], Área: AREA_LABELS[e.area as ExpenseArea], Notas: e.notas || '',
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), 'Gastos Operativos');
    const resumen = [
      { Indicador: 'Periodo', Valor: dlDateFrom && dlDateTo ? `${dlDateFrom} a ${dlDateTo}` : 'Todos' },
      { Indicador: 'Total gastos', Valor: filtered.reduce((s, e) => s + e.monto, 0) },
      { Indicador: 'Registros', Valor: filtered.length },
      { Indicador: 'Gastos fijos', Valor: filtered.filter(e => e.tipo === 'fijo').reduce((s, e) => s + e.monto, 0) },
      { Indicador: 'Gastos variables', Valor: filtered.filter(e => e.tipo === 'variable').reduce((s, e) => s + e.monto, 0) },
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumen), 'Resumen');
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      `gastos-operativos_${dlDateFrom || 'inicio'}_${dlDateTo || 'fin'}.xlsx`);
    setDlOpen(false);
  };

  const summary = useMemo(() => calculateExpenseSummary(expenses), [expenses]);
  const financial = useMemo(() => calculateFinancialMetrics(expenses), [expenses]);

  const filteredExpenses = useMemo(() => {
    if (filterCat === 'all') return expenses;
    return expenses.filter(e => e.categoria === filterCat);
  }, [expenses, filterCat]);

  const addExpense = () => {
    if (!formDesc || formMonto <= 0) return;
    addExpenseMutation.mutate({
      fecha: formFecha,
      categoria: formCat,
      subcategoria: formSub || EXPENSE_CATEGORIES[formCat].subcategories[0],
      descripcion: formDesc,
      monto: formMonto,
      tipo: formTipo,
      area: formArea,
      notas: formNotas || undefined,
    });
    setFormDesc('');
    setFormMonto(0);
    setFormNotas('');
  };

  const removeExpense = (id: string) => deleteExpenseMutation.mutate(id);
  const duplicateExpense = (exp: OperatingExpense) => {
    addExpenseMutation.mutate({
      fecha: exp.fecha,
      categoria: exp.categoria,
      subcategoria: exp.subcategoria,
      descripcion: exp.descripcion + ' (copia)',
      monto: exp.monto,
      tipo: exp.tipo,
      area: exp.area,
      notas: exp.notas,
    });
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'dashboard', label: '📊 Dashboard Financiero' },
    { key: 'registro', label: '📝 Registro de Gastos' },
    { key: 'director', label: '👔 Vista Director' },
  ];

  const inputCls = 'w-full text-sm rounded-lg border px-3 py-2 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40';
  const selectCls = inputCls;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-primary" size={32} />
        <span className="ml-3 text-muted-foreground">Cargando gastos...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Gastos Operativos</h1>
        <p className="text-sm text-muted-foreground">
          Registro, análisis y control de gastos de operación
          {dbExpenses && dbExpenses.length > 0 && (
            <span className="ml-2 text-xs text-success">● Conectado a base de datos</span>
          )}
          {dbExpenses && dbExpenses.length === 0 && (
            <span className="ml-2 text-xs text-warning">● Mostrando datos demo — registra tu primer gasto para activar</span>
          )}
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={() => setDlOpen(true)}>
        <Download size={14} className="mr-1" /> Descargar Excel
      </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b pb-2">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${tab === t.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══ TAB: DASHBOARD ═══ */}
      {tab === 'dashboard' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { label: 'Gasto Mensual', value: fmt(summary.totalMensual), icon: DollarSign, color: 'text-destructive' },
              { label: 'Gasto Anual (est.)', value: fmt(summary.totalAnual), icon: BarChart3, color: 'text-primary' },
              { label: 'Gasto Diario', value: fmt(summary.gastoDiario), icon: TrendingDown, color: 'text-warning' },
              { label: 'Gastos Fijos', value: fmt(summary.gastosFijos), icon: Layers, color: 'text-primary' },
              { label: 'Gastos Variables', value: fmt(summary.gastosVariables), icon: TrendingUp, color: 'text-accent-foreground' },
              { label: 'Ratio vs Ventas', value: fmtPct(financial.ratioGastoOperativo), icon: Target, color: 'text-destructive' },
            ].map((kpi, i) => (
              <div key={i} className="bg-card rounded-xl border p-4 text-center">
                <kpi.icon size={20} className={`mx-auto mb-1 ${kpi.color}`} />
                <div className="text-lg font-bold">{kpi.value}</div>
                <div className="text-[11px] text-muted-foreground">{kpi.label}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-card rounded-xl border p-5">
              <h3 className="font-display font-semibold mb-4">Gastos por Categoría</h3>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={summary.byCategory} cx="50%" cy="50%" outerRadius={90} innerRadius={40} dataKey="total"
                    label={({ label, pct }) => `${label} ${pct.toFixed(0)}%`}>
                    {summary.byCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmt(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-card rounded-xl border p-5">
              <h3 className="font-display font-semibold mb-4">Gastos por Área</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={summary.byArea} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                  <YAxis dataKey="label" type="category" width={110} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Bar dataKey="total" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name="Total" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-card rounded-xl border p-5">
              <h3 className="font-display font-semibold mb-4">Gastos por Mes</h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={summary.byMonth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Bar dataKey="total" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} name="Gastos" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-card rounded-xl border p-5">
              <h3 className="font-display font-semibold mb-4">Top 10 Gastos</h3>
              <div className="space-y-2 max-h-[260px] overflow-y-auto">
                {summary.top10.map((e, i) => (
                  <div key={e.id} className="flex items-center justify-between text-sm border-b pb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}</span>
                      <div className="truncate">
                        <div className="font-medium truncate">{e.descripcion}</div>
                        <div className="text-[10px] text-muted-foreground">{EXPENSE_CATEGORIES[e.categoria]?.label} · {e.subcategoria}</div>
                      </div>
                    </div>
                    <span className="font-bold text-destructive whitespace-nowrap ml-2">{fmt(e.monto)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-card rounded-xl border p-5">
            <h3 className="font-display font-semibold mb-4">Distribución por Área</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3">Área</th>
                    <th className="text-right py-2 px-3">Total</th>
                    <th className="text-right py-2 px-3">% del Total</th>
                    <th className="text-left py-2 px-3 w-1/3">Proporción</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.byArea.map(a => (
                    <tr key={a.area} className="border-b hover:bg-muted/30">
                      <td className="py-2 px-3 font-medium">{a.label}</td>
                      <td className="py-2 px-3 text-right font-bold">{fmt(a.total)}</td>
                      <td className="py-2 px-3 text-right">{fmtPct(a.pct)}</td>
                      <td className="py-2 px-3">
                        <div className="w-full bg-muted rounded-full h-2">
                          <div className="bg-primary rounded-full h-2" style={{ width: `${Math.min(a.pct, 100)}%` }} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══ TAB: REGISTRO ═══ */}
      {tab === 'registro' && (
        <div className="space-y-6">
          <div className="bg-card rounded-xl border p-5">
            <h3 className="font-display font-semibold mb-4 flex items-center gap-2">
              <PlusCircle size={18} className="text-primary" /> Registrar Gasto
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Fecha</label>
                <input type="date" value={formFecha} onChange={e => setFormFecha(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Categoría</label>
                <select value={formCat} onChange={e => { setFormCat(e.target.value as ExpenseCategory); setFormSub(''); }} className={selectCls}>
                  {Object.entries(EXPENSE_CATEGORIES).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Subcategoría</label>
                <select value={formSub} onChange={e => setFormSub(e.target.value)} className={selectCls}>
                  <option value="">Seleccionar...</option>
                  {EXPENSE_CATEGORIES[formCat].subcategories.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Monto</label>
                <input type="number" min={0} value={formMonto || ''} onChange={e => setFormMonto(+e.target.value)} placeholder="$0" className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Descripción</label>
                <input type="text" value={formDesc} onChange={e => setFormDesc(e.target.value)} placeholder="Descripción del gasto" className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Tipo</label>
                <select value={formTipo} onChange={e => setFormTipo(e.target.value as ExpenseType)} className={selectCls}>
                  {Object.entries(TYPE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Área</label>
                <select value={formArea} onChange={e => setFormArea(e.target.value as ExpenseArea)} className={selectCls}>
                  {Object.entries(AREA_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Notas (opcional)</label>
                <input type="text" value={formNotas} onChange={e => setFormNotas(e.target.value)} placeholder="Notas" className={inputCls} />
              </div>
            </div>
            <button onClick={addExpense} disabled={addExpenseMutation.isPending}
              className="mt-4 px-6 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-2 disabled:opacity-50">
              {addExpenseMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <PlusCircle size={16} />}
              Agregar Gasto
            </button>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-muted-foreground">Filtrar por:</span>
            <select value={filterCat} onChange={e => setFilterCat(e.target.value)} className="text-sm border rounded-lg px-3 py-1.5 bg-background text-foreground">
              <option value="all">Todas las categorías</option>
              {Object.entries(EXPENSE_CATEGORIES).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
            <span className="text-xs text-muted-foreground">{filteredExpenses.length} gastos · Total: {fmt(filteredExpenses.reduce((a, e) => a + e.monto, 0))}</span>
          </div>

          <div className="bg-card rounded-xl border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left py-2.5 px-3">Fecha</th>
                  <th className="text-left py-2.5 px-3">Categoría</th>
                  <th className="text-left py-2.5 px-3">Subcategoría</th>
                  <th className="text-left py-2.5 px-3">Descripción</th>
                  <th className="text-right py-2.5 px-3">Monto</th>
                  <th className="text-center py-2.5 px-3">Tipo</th>
                  <th className="text-left py-2.5 px-3">Área</th>
                  <th className="text-center py-2.5 px-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredExpenses.map(e => (
                  <tr key={e.id} className="border-b hover:bg-muted/20 transition-colors">
                    <td className="py-2 px-3 whitespace-nowrap">{e.fecha}</td>
                    <td className="py-2 px-3">
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary">
                        {EXPENSE_CATEGORIES[e.categoria]?.label}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-muted-foreground">{e.subcategoria}</td>
                    <td className="py-2 px-3 max-w-[200px] truncate" title={e.descripcion}>{e.descripcion}</td>
                    <td className="py-2 px-3 text-right font-bold text-destructive">{fmt(e.monto)}</td>
                    <td className="py-2 px-3 text-center">
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${e.tipo === 'fijo' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                        {TYPE_LABELS[e.tipo]}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-muted-foreground">{AREA_LABELS[e.area as ExpenseArea]}</td>
                    <td className="py-2 px-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => duplicateExpense(e)} className="p-1 hover:bg-muted rounded" title="Duplicar">
                          <Copy size={14} className="text-muted-foreground" />
                        </button>
                        <button onClick={() => removeExpense(e.id)} className="p-1 hover:bg-destructive/10 rounded" title="Eliminar">
                          <Trash2 size={14} className="text-destructive" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══ TAB: DIRECTOR ═══ */}
      {tab === 'director' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { label: 'Ventas del Mes', value: fmt(financial.ventasMes), sub: '', positive: true },
              { label: 'Utilidad Bruta', value: fmt(financial.utilidadBruta), sub: `Margen: ${fmtPct(financial.margenBruto)}`, positive: true },
              { label: 'Gastos Operativos', value: fmt(financial.gastoOperativo), sub: `${fmtPct(financial.ratioGastoOperativo)} de ventas`, positive: false },
              { label: 'Utilidad Neta', value: fmt(financial.utilidadNeta), sub: `Margen: ${fmtPct(financial.margenNeto)}`, positive: financial.utilidadNeta >= 0 },
              { label: 'Punto de Equilibrio', value: fmt(financial.puntoEquilibrio), sub: `${fmt(financial.ventasNecesariasDiarias)}/día`, positive: true },
              { label: 'Costo por Venta', value: fmt(financial.costoOperativoPorVenta), sub: `${Math.round(financial.ventasMes / dashboardMetrics.avgTicket)} ventas/mes`, positive: false },
            ].map((kpi, i) => (
              <div key={i} className="bg-card rounded-xl border p-4">
                <div className="text-[11px] text-muted-foreground mb-1">{kpi.label}</div>
                <div className={`text-lg font-bold ${kpi.positive ? 'text-foreground' : 'text-destructive'}`}>{kpi.value}</div>
                {kpi.sub && <div className="text-[10px] text-muted-foreground mt-0.5">{kpi.sub}</div>}
              </div>
            ))}
          </div>

          <div className="bg-card rounded-xl border p-6">
            <h3 className="font-display font-semibold mb-4 flex items-center gap-2">
              <FileText size={18} className="text-primary" /> Estado de Resultados Simplificado
            </h3>
            <div className="max-w-lg space-y-3">
              {[
                { label: 'Ventas Totales', value: financial.ventasMes, indent: 0, bold: true },
                { label: '(-) Costo de Productos', value: -financial.costoProductos, indent: 1, bold: false },
                { label: '= Utilidad Bruta', value: financial.utilidadBruta, indent: 0, bold: true, border: true },
                { label: '(-) Gastos Operativos', value: -financial.gastoOperativo, indent: 1, bold: false },
                { label: '= Utilidad Neta', value: financial.utilidadNeta, indent: 0, bold: true, border: true, highlight: true },
              ].map((row, i) => (
                <div key={i} className={`flex justify-between items-center py-2 ${row.border ? 'border-t-2 border-foreground/20 pt-3' : ''} ${row.indent ? 'pl-6' : ''}`}>
                  <span className={`text-sm ${row.bold ? 'font-bold' : 'text-muted-foreground'}`}>{row.label}</span>
                  <span className={`text-sm font-mono ${row.bold ? 'font-bold' : ''} ${row.highlight ? (row.value >= 0 ? 'text-success' : 'text-destructive') : ''} ${row.value < 0 ? 'text-destructive' : ''}`}>
                    {fmt(Math.abs(row.value))}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-card rounded-xl border p-6">
              <h3 className="font-display font-semibold mb-4 flex items-center gap-2">
                <Target size={18} className="text-primary" /> Punto de Equilibrio
              </h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Ventas actuales vs Punto de Equilibrio</span>
                    <span className="font-bold">{fmtPct(financial.puntoEquilibrio > 0 ? (financial.ventasMes / financial.puntoEquilibrio) * 100 : 0)}</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-4 relative">
                    <div className={`rounded-full h-4 transition-all ${financial.ventasMes >= financial.puntoEquilibrio ? 'bg-success' : 'bg-destructive'}`}
                      style={{ width: `${Math.min((financial.ventasMes / (financial.puntoEquilibrio || 1)) * 100, 100)}%` }} />
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                    <span>$0</span>
                    <span>PE: {fmt(financial.puntoEquilibrio)}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="text-center p-3 bg-muted/30 rounded-lg">
                    <div className="text-lg font-bold">{fmt(financial.gastoDiario)}</div>
                    <div className="text-[10px] text-muted-foreground">Gasto diario</div>
                  </div>
                  <div className="text-center p-3 bg-muted/30 rounded-lg">
                    <div className="text-lg font-bold">{fmt(financial.ventasNecesariasDiarias)}</div>
                    <div className="text-[10px] text-muted-foreground">Venta diaria necesaria</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-xl border p-6">
              <h3 className="font-display font-semibold mb-4 flex items-center gap-2">
                <Calculator size={18} className="text-primary" /> Márgenes del Negocio
              </h3>
              <div className="space-y-6">
                {[
                  { label: 'Margen Bruto', value: financial.margenBruto, color: 'bg-primary' },
                  { label: 'Ratio Gasto Operativo', value: financial.ratioGastoOperativo, color: 'bg-destructive' },
                  { label: 'Margen Neto Real', value: Math.max(financial.margenNeto, 0), color: financial.margenNeto >= 0 ? 'bg-success' : 'bg-destructive' },
                ].map((m, i) => (
                  <div key={i}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium">{m.label}</span>
                      <span className="font-bold">{fmtPct(m.value)}</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-3">
                      <div className={`${m.color} rounded-full h-3 transition-all`} style={{ width: `${Math.min(m.value, 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      <Dialog open={dlOpen} onOpenChange={setDlOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Descargar Gastos Operativos</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Selecciona el rango de fechas. <strong>{dlFilteredCount}</strong> registros encontrados.</p>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Desde</Label><Input type="date" value={dlDateFrom} onChange={e => setDlDateFrom(e.target.value)} /></div>
              <div><Label>Hasta</Label><Input type="date" value={dlDateTo} onChange={e => setDlDateTo(e.target.value)} /></div>
            </div>
            <Button onClick={handleExcelDownload} className="w-full"><Download size={14} className="mr-2" />Descargar Excel ({dlFilteredCount})</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
