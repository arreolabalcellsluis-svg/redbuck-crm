import { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, Save, Calculator, Package, Ship, Landmark, Shield, Truck } from 'lucide-react';
import type { ImportOrder, ImportExpenses } from '@/types';
import { useUpdateImportOrder } from '@/hooks/useImportOrders';

const fmtUSD = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n);
const fmtMXN = (n: number, rate: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n * rate);

const EXPENSE_FIELDS: { key: keyof ImportExpenses; label: string; group: string }[] = [
  { key: 'fleteLocalChina', label: 'Flete local China', group: 'logistica_int' },
  { key: 'fleteInternacionalMaritimo', label: 'Flete internacional marítimo', group: 'logistica_int' },
  { key: 'igi', label: 'IGI (Impuesto General de Importación)', group: 'aduana' },
  { key: 'dta', label: 'DTA (Derecho de Trámite Aduanero)', group: 'aduana' },
  { key: 'prevalidacion', label: 'Prevalidación', group: 'aduana' },
  { key: 'gastosLocalesNaviera', label: 'Gastos locales naviera', group: 'puerto' },
  { key: 'maniobrasPuerto', label: 'Maniobras puerto', group: 'puerto' },
  { key: 'seguro', label: 'Seguro', group: 'servicios' },
  { key: 'honorariosDespachoAduanal', label: 'Honorarios despacho aduanal', group: 'servicios' },
  { key: 'comercializadora', label: 'Comercializadora', group: 'servicios' },
  { key: 'fleteTerrestreGdl', label: 'Flete terrestre a GDL', group: 'logistica_nal' },
];

const GROUPS = [
  { id: 'logistica_int', label: 'Logística Internacional', icon: Ship },
  { id: 'aduana', label: 'Aduana e Impuestos', icon: Landmark },
  { id: 'puerto', label: 'Puerto / Naviera', icon: Package },
  { id: 'servicios', label: 'Servicios', icon: Shield },
  { id: 'logistica_nal', label: 'Logística Nacional', icon: Truck },
];

interface Props {
  importOrder: ImportOrder;
  canEdit: boolean;
}

export default function ImportExpensesDetail({ importOrder, canEdit }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [expenses, setExpenses] = useState<ImportExpenses>({ ...importOrder.expenses });
  const [pesoKg, setPesoKg] = useState(importOrder.pesoTotalKg);
  const [cbm, setCbm] = useState(importOrder.volumenTotalCbm);
  const [contenedores, setContenedores] = useState(importOrder.numeroContenedores);
  const [dirty, setDirty] = useState(false);
  const updateMutation = useUpdateImportOrder();

  const updateField = (key: keyof ImportExpenses, val: number) => {
    setExpenses(prev => ({ ...prev, [key]: val }));
    setDirty(true);
  };

  const calc = useMemo(() => {
    const subtotalGastos = Object.values(expenses).reduce((s, v) => s + (Number(v) || 0), 0);
    const valorPedidoChina = importOrder.totalCost;
    const ivaGastos = subtotalGastos * 0.16;
    const ivaProducto = valorPedidoChina * 0.16;
    const ivaTotal = ivaGastos + ivaProducto;
    const totalImportacion = valorPedidoChina + subtotalGastos + ivaTotal;
    const totalQty = importOrder.items.reduce((s, it) => s + it.qty, 0);
    const costoPorContenedor = contenedores > 0 ? totalImportacion / contenedores : 0;
    const costoPorCbm = cbm > 0 ? totalImportacion / cbm : 0;
    const costoPorKg = pesoKg > 0 ? totalImportacion / pesoKg : 0;
    const costoPorProducto = totalQty > 0 ? totalImportacion / totalQty : 0;
    return { subtotalGastos, valorPedidoChina, ivaGastos, ivaProducto, ivaTotal, totalImportacion, costoPorContenedor, costoPorCbm, costoPorKg, costoPorProducto };
  }, [expenses, importOrder.totalCost, importOrder.items, contenedores, cbm, pesoKg]);

  const handleSave = () => {
    updateMutation.mutate({
      id: importOrder.id,
      expenses,
      pesoTotalKg: pesoKg,
      volumenTotalCbm: cbm,
      numeroContenedores: contenedores,
    });
    setDirty(false);
  };

  const rate = importOrder.exchangeRate || 1;

  return (
    <div className="mt-4 border rounded-xl overflow-hidden bg-muted/20">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold hover:bg-muted/40 transition-colors"
      >
        <span className="flex items-center gap-2">💰 Gastos Detallados de Importación</span>
        <div className="flex items-center gap-2">
          {calc.subtotalGastos > 0 && (
            <span className="text-xs text-muted-foreground">Total: {fmtUSD(calc.totalImportacion)}</span>
          )}
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4">
          {/* Summary KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: 'Valor pedido China', value: fmtUSD(calc.valorPedidoChina), sub: fmtMXN(calc.valorPedidoChina, rate) },
              { label: 'Subtotal gastos', value: fmtUSD(calc.subtotalGastos), sub: fmtMXN(calc.subtotalGastos, rate) },
              { label: 'IVA gastos', value: fmtUSD(calc.ivaGastos), sub: '16%' },
              { label: 'IVA producto', value: fmtUSD(calc.ivaProducto), sub: '16%' },
              { label: 'IVA total', value: fmtUSD(calc.ivaTotal), sub: fmtMXN(calc.ivaTotal, rate) },
              { label: 'TOTAL IMPORTACIÓN', value: fmtUSD(calc.totalImportacion), sub: fmtMXN(calc.totalImportacion, rate), highlight: true },
            ].map(kpi => (
              <div key={kpi.label} className={`p-3 rounded-lg border text-center ${kpi.highlight ? 'bg-primary/10 border-primary/30' : 'bg-card'}`}>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{kpi.label}</div>
                <div className={`text-sm font-bold font-display mt-1 ${kpi.highlight ? 'text-primary' : ''}`}>{kpi.value}</div>
                <div className="text-[10px] text-muted-foreground">{kpi.sub}</div>
              </div>
            ))}
          </div>

          {/* Expense fields grouped */}
          {GROUPS.map(group => {
            const fields = EXPENSE_FIELDS.filter(f => f.group === group.id);
            const Icon = group.icon;
            return (
              <div key={group.id} className="rounded-lg border bg-card p-3">
                <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <Icon size={14} /> {group.label}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {fields.map(f => (
                    <div key={f.key}>
                      <label className="text-[10px] font-medium text-muted-foreground block mb-1">{f.label} (USD)</label>
                      {canEdit ? (
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={expenses[f.key]}
                          onChange={e => updateField(f.key, Math.max(0, Number(e.target.value)))}
                          className="w-full px-2 py-1.5 rounded border bg-background text-sm"
                        />
                      ) : (
                        <div className="px-2 py-1.5 rounded border bg-muted text-sm font-medium">{fmtUSD(expenses[f.key])}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Physical params */}
          <div className="rounded-lg border bg-card p-3">
            <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <Calculator size={14} /> Parámetros de Análisis
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] font-medium text-muted-foreground block mb-1">Peso total (kg)</label>
                <input type="number" step="0.1" min="0" value={pesoKg} onChange={e => { setPesoKg(Number(e.target.value)); setDirty(true); }}
                  className="w-full px-2 py-1.5 rounded border bg-background text-sm" disabled={!canEdit} />
              </div>
              <div>
                <label className="text-[10px] font-medium text-muted-foreground block mb-1">Volumen (CBM)</label>
                <input type="number" step="0.01" min="0" value={cbm} onChange={e => { setCbm(Number(e.target.value)); setDirty(true); }}
                  className="w-full px-2 py-1.5 rounded border bg-background text-sm" disabled={!canEdit} />
              </div>
              <div>
                <label className="text-[10px] font-medium text-muted-foreground block mb-1">No. Contenedores</label>
                <input type="number" step="1" min="1" value={contenedores} onChange={e => { setContenedores(Math.max(1, Number(e.target.value))); setDirty(true); }}
                  className="w-full px-2 py-1.5 rounded border bg-background text-sm" disabled={!canEdit} />
              </div>
            </div>
          </div>

          {/* Analysis KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Costo por contenedor', value: fmtUSD(calc.costoPorContenedor) },
              { label: 'Costo por CBM', value: cbm > 0 ? fmtUSD(calc.costoPorCbm) : 'N/A' },
              { label: 'Costo por kg', value: pesoKg > 0 ? fmtUSD(calc.costoPorKg) : 'N/A' },
              { label: 'Costo por producto (prom.)', value: fmtUSD(calc.costoPorProducto) },
            ].map(kpi => (
              <div key={kpi.label} className="p-3 rounded-lg bg-accent/10 border text-center">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{kpi.label}</div>
                <div className="text-sm font-bold font-display mt-1">{kpi.value}</div>
              </div>
            ))}
          </div>

          {/* Save button */}
          {canEdit && dirty && (
            <div className="flex justify-end">
              <button
                onClick={handleSave}
                disabled={updateMutation.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                <Save size={14} /> {updateMutation.isPending ? 'Guardando...' : 'Guardar gastos'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
