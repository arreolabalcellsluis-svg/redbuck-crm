import { useAppContext } from '@/contexts/AppContext';
import ImportCostingSummary from '@/components/imports/ImportCostingSummary';
import ImportExpensesDetail from '@/components/imports/ImportExpensesDetail';
import ImportProductSelector, { type ImportItemData } from '@/components/imports/ImportProductSelector';
import StatusBadge from '@/components/shared/StatusBadge';
import ImportTimeline from '@/components/shared/ImportTimeline';
import MetricCard from '@/components/shared/MetricCard';
import { Globe, Ship, AlertTriangle, DollarSign, Plus, X, Edit2, Download } from 'lucide-react';
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ImportStatus, IMPORT_STATUS_LABELS, IMPORT_STATUS_ORDER } from '@/types';
import type { ImportExpenses } from '@/types';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { useImportOrders, useAddImportOrder, useUpdateImportOrder } from '@/hooks/useImportOrders';
import { useSuppliers } from '@/hooks/useSuppliers';

const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

const DEFAULT_EXPENSES: ImportExpenses = {
  fleteLocalChina: 0, fleteInternacionalMaritimo: 0, igi: 0, dta: 0, prevalidacion: 0,
  gastosLocalesNaviera: 0, maniobrasPuerto: 0, seguro: 0, honorariosDespachoAduanal: 0,
  comercializadora: 0, fleteTerrestreGdl: 0,
};

export default function ImportsPage() {
  const { currentRole } = useAppContext();
  const canEdit = currentRole === 'director' || currentRole === 'compras';

  const { data: imports = [], isLoading } = useImportOrders();
  const { data: suppliers = [] } = useSuppliers();
  const addMutation = useAddImportOrder();
  const updateMutation = useUpdateImportOrder();

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [showDownload, setShowDownload] = useState(false);
  const [dlDateFrom, setDlDateFrom] = useState('');
  const [dlDateTo, setDlDateTo] = useState('');
  const [form, setForm] = useState({
    supplier: '', country: 'China', departurePort: '', arrivalPort: 'Manzanillo',
    purchaseDate: '', estimatedDeparture: '', estimatedArrival: '',
    freightCost: 0, customsCost: 0, status: 'orden_enviada' as ImportStatus,
    exchangeRate: 17.2,
  });
  const [items, setItems] = useState<ImportItemData[]>([]);

  const totalValue = imports.reduce((s, i) => s + i.totalLanded, 0);
  const totalItems = imports.reduce((s, i) => s + i.items.reduce((a: number, it: any) => a + (it.qty || 0), 0), 0);

  const totalCost = items.reduce((s, it) => s + it.qty * it.unitCost, 0);
  const totalLanded = totalCost + form.freightCost + form.customsCost;

  const openEdit = (imp: any) => {
    setEditId(imp.id);
    setForm({
      supplier: imp.supplier, country: imp.country, departurePort: imp.departurePort,
      arrivalPort: imp.arrivalPort, purchaseDate: imp.purchaseDate,
      estimatedDeparture: imp.estimatedDeparture, estimatedArrival: imp.estimatedArrival,
      freightCost: imp.freightCost, customsCost: imp.customsCost, status: imp.status,
      exchangeRate: imp.exchangeRate,
    });
    setItems(imp.items.map((it: any) => ({
      productId: it.productId || null,
      productName: it.productName || '',
      sku: it.sku || '',
      category: it.category || '',
      qty: it.qty || 1,
      unitCost: it.unitCost || 0,
      cbm: it.cbm || 0,
      peso: it.peso || 0,
    })));
    setOpen(true);
  };

  const resetForm = () => {
    setEditId(null);
    setForm({ supplier: '', country: 'China', departurePort: '', arrivalPort: 'Manzanillo', purchaseDate: '', estimatedDeparture: '', estimatedArrival: '', freightCost: 0, customsCost: 0, status: 'orden_enviada', exchangeRate: 17.2 });
    setItems([]);
  };

  const handleSave = () => {
    if (!form.supplier || items.length === 0 || !form.purchaseDate) {
      toast.error('Completa proveedor, productos y fecha');
      return;
    }

    const pesoTotal = items.reduce((s, it) => s + (it.peso || 0) * it.qty, 0);
    const cbmTotal = items.reduce((s, it) => s + (it.cbm || 0) * it.qty, 0);

    // Save enriched items with productId, sku, cbm, peso
    const saveItems = items.map(it => ({
      productId: it.productId,
      productName: it.productName,
      sku: it.sku,
      category: it.category,
      qty: it.qty,
      unitCost: it.unitCost,
      cbm: it.cbm,
      peso: it.peso,
    }));

    if (editId) {
      updateMutation.mutate({
        id: editId,
        supplier: form.supplier, country: form.country, departurePort: form.departurePort,
        arrivalPort: form.arrivalPort, purchaseDate: form.purchaseDate,
        estimatedDeparture: form.estimatedDeparture, estimatedArrival: form.estimatedArrival,
        freightCost: form.freightCost, customsCost: form.customsCost, status: form.status,
        exchangeRate: form.exchangeRate,
        items: saveItems as any, totalCost, totalLanded,
        pesoTotalKg: pesoTotal, volumenTotalCbm: cbmTotal,
        daysInTransit: form.estimatedDeparture ? Math.max(0, Math.floor((Date.now() - new Date(form.estimatedDeparture).getTime()) / 86400000)) : 0,
      });
    } else {
      const orderNumber = `IMP-2026-${String(imports.length + 1).padStart(3, '0')}`;
      addMutation.mutate({
        orderNumber, supplier: form.supplier, country: form.country,
        departurePort: form.departurePort, arrivalPort: form.arrivalPort,
        currency: 'USD', exchangeRate: form.exchangeRate,
        purchaseDate: form.purchaseDate, estimatedDeparture: form.estimatedDeparture,
        estimatedArrival: form.estimatedArrival, status: form.status,
        items: saveItems as any, totalCost, freightCost: form.freightCost, customsCost: form.customsCost,
        totalLanded, daysInTransit: 0,
        expenses: DEFAULT_EXPENSES,
        pesoTotalKg: pesoTotal,
        volumenTotalCbm: cbmTotal,
        numeroContenedores: 1,
      });
    }
    setOpen(false);
    resetForm();
  };

  const handleImportsExcel = () => {
    if (!dlDateFrom || !dlDateTo) { toast.error('Selecciona un rango de fechas'); return; }
    if (dlDateFrom > dlDateTo) { toast.error('La fecha inicial no puede ser mayor a la final'); return; }

    const data = imports.filter(i => i.purchaseDate >= dlDateFrom && i.purchaseDate <= dlDateTo);
    if (data.length === 0) { toast.error('No hay importaciones en el rango seleccionado'); return; }

    const rows = data.map(i => {
      const exp = i.expenses;
      const subtotalGastos = Object.values(exp).reduce((s, v) => s + (Number(v) || 0), 0);
      return {
        'No. Orden': i.orderNumber, 'Proveedor': i.supplier, 'País': i.country,
        'Puerto Salida': i.departurePort, 'Puerto Llegada': i.arrivalPort,
        'Fecha Compra': i.purchaseDate, 'Salida Estimada': i.estimatedDeparture,
        'Llegada Estimada': i.estimatedArrival, 'Costo Productos (USD)': i.totalCost,
        'Flete local China': exp.fleteLocalChina,
        'Flete internacional': exp.fleteInternacionalMaritimo,
        'IGI': exp.igi, 'DTA': exp.dta, 'Prevalidación': exp.prevalidacion,
        'Gastos naviera': exp.gastosLocalesNaviera, 'Maniobras puerto': exp.maniobrasPuerto,
        'Seguro': exp.seguro, 'Honorarios aduanal': exp.honorariosDespachoAduanal,
        'Comercializadora': exp.comercializadora, 'Flete terrestre GDL': exp.fleteTerrestreGdl,
        'Subtotal Gastos': subtotalGastos,
        'IVA Gastos': subtotalGastos * 0.16,
        'IVA Producto': i.totalCost * 0.16,
        'Total Importación': i.totalCost + subtotalGastos + (subtotalGastos * 0.16) + (i.totalCost * 0.16),
        'Tipo Cambio': i.exchangeRate,
        'Estatus': IMPORT_STATUS_LABELS[i.status] || i.status,
        'Peso (kg)': i.pesoTotalKg, 'Volumen (CBM)': i.volumenTotalCbm, 'Contenedores': i.numeroContenedores,
      };
    });

    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.json_to_sheet(rows);
    ws1['!cols'] = Object.keys(rows[0]).map(() => ({ wch: 18 }));
    XLSX.utils.book_append_sheet(wb, ws1, 'Importaciones');
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `Importaciones_${dlDateFrom}_a_${dlDateTo}.xlsx`);
    toast.success(`Excel generado con ${data.length} importaciones`);
    setShowDownload(false);
  };

  const dlFilteredCount = imports.filter(i => {
    if (dlDateFrom && i.purchaseDate < dlDateFrom) return false;
    if (dlDateTo && i.purchaseDate > dlDateTo) return false;
    return true;
  }).length;

  if (isLoading) return <div className="py-12 text-center text-muted-foreground">Cargando importaciones...</div>;

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Importaciones</h1>
          <p className="page-subtitle">Control de compras internacionales y logística</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowDownload(true)} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium hover:bg-muted transition-colors">
            <Download size={16} /> Descargar Excel
          </button>
          {canEdit && (
            <button onClick={() => { resetForm(); setOpen(true); }} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
              <Plus size={16} /> Nueva importación
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <MetricCard title="Importaciones activas" value={imports.length} icon={Globe} variant="primary" />
        <MetricCard title="Productos en tránsito" value={totalItems} icon={Ship} variant="warning" subtitle="unidades" />
        <MetricCard title="Valor total" value={fmt(totalValue)} icon={DollarSign} subtitle="USD puesto en bodega" />
        <MetricCard title="Alertas" value={0} icon={AlertTriangle} variant="success" subtitle="todo en orden" />
      </div>

      <div className="space-y-6">
        {imports.map(imp => (
          <div key={imp.id} className="bg-card rounded-xl border overflow-hidden">
            <div className="p-5">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="font-display font-bold text-lg">{imp.orderNumber}</h3>
                    <StatusBadge status={imp.status} type="import" />
                    {canEdit && (
                      <button onClick={() => openEdit(imp)} className="p-1.5 rounded-md hover:bg-muted" title="Editar importación">
                        <Edit2 size={14} />
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{imp.supplier} · {imp.country}</p>
                </div>
                <div className="flex items-center gap-6 text-sm">
                  <div><span className="text-muted-foreground">Puerto salida:</span><span className="ml-1 font-medium">{imp.departurePort}</span></div>
                  <div><span className="text-muted-foreground">Puerto llegada:</span><span className="ml-1 font-medium">{imp.arrivalPort}</span></div>
                  <div><span className="text-muted-foreground">ETA:</span><span className="ml-1 font-semibold">{imp.estimatedArrival}</span></div>
                </div>
              </div>
              <div className="py-4 overflow-x-auto"><ImportTimeline currentStatus={imp.status} /></div>
              <div className="mt-4 rounded-lg border overflow-hidden">
                <table className="data-table">
                  <thead><tr><th>Producto</th><th>SKU</th><th>Cantidad</th><th>Costo unitario</th><th>Costo total</th></tr></thead>
                  <tbody>
                    {imp.items.map((item: any, i: number) => (
                      <tr key={i}>
                        <td className="font-medium">{item.productName}</td>
                        <td className="text-muted-foreground text-xs">{item.sku || '—'}</td>
                        <td>{item.qty}</td>
                        <td>{fmt(item.unitCost)}</td>
                        <td className="font-semibold">{fmt(item.qty * item.unitCost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
                {[
                  { label: 'Costo producto', value: fmt(imp.totalCost) },
                  { label: 'Flete', value: fmt(imp.freightCost) },
                  { label: 'Aduana', value: fmt(imp.customsCost) },
                  { label: 'Total puesto bodega', value: fmt(imp.totalLanded) },
                  { label: 'Días en tránsito', value: `${imp.daysInTransit}` },
                ].map(item => (
                  <div key={item.label} className="p-3 rounded-lg bg-muted/50">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{item.label}</div>
                    <div className="text-sm font-bold font-display mt-1">{item.value}</div>
                  </div>
                ))}
              </div>

              {/* New detailed expenses section */}
              <ImportExpensesDetail importOrder={imp} canEdit={canEdit} />

              <ImportCostingSummary
                items={imp.items}
                freightCost={imp.freightCost}
                customsCost={imp.customsCost}
                exchangeRate={imp.exchangeRate}
              />
            </div>
          </div>
        ))}
      </div>

      {/* CREATE / EDIT IMPORT */}
      <Dialog open={open} onOpenChange={() => { setOpen(false); resetForm(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? 'Editar Importación' : 'Nueva Importación'}</DialogTitle>
            <DialogDescription>{editId ? 'Modifica la información de la importación' : 'Registra una nueva orden de importación'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Proveedor *</label>
                <select value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm">
                  <option value="">Seleccionar...</option>
                  {suppliers.filter(s => s.type === 'internacional').map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">País</label>
                <input value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Puerto salida</label>
                <input value={form.departurePort} onChange={e => setForm({ ...form, departurePort: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Puerto llegada</label>
                <input value={form.arrivalPort} onChange={e => setForm({ ...form, arrivalPort: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Fecha compra *</label>
                <input type="date" value={form.purchaseDate} onChange={e => setForm({ ...form, purchaseDate: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Fecha salida estimada</label>
                <input type="date" value={form.estimatedDeparture} onChange={e => setForm({ ...form, estimatedDeparture: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">ETA llegada</label>
                <input type="date" value={form.estimatedArrival} onChange={e => setForm({ ...form, estimatedArrival: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Tipo de cambio</label>
                <input type="number" step="0.1" value={form.exchangeRate} onChange={e => setForm({ ...form, exchangeRate: Number(e.target.value) })} className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Estado logístico</label>
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as ImportStatus })} className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm">
                {IMPORT_STATUS_ORDER.map(s => <option key={s} value={s}>{IMPORT_STATUS_LABELS[s]}</option>)}
              </select>
            </div>
            <ImportProductSelector items={items} onChange={setItems} />
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Flete (USD)</label>
                <input type="number" value={form.freightCost} onChange={e => setForm({ ...form, freightCost: Number(e.target.value) })} className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Aduana (USD)</label>
                <input type="number" value={form.customsCost} onChange={e => setForm({ ...form, customsCost: Number(e.target.value) })} className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Total landed</label>
                <div className="mt-1 px-3 py-2 rounded-lg border bg-muted text-sm font-bold">{fmt(totalLanded)}</div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => { setOpen(false); resetForm(); }} className="px-4 py-2 rounded-lg border text-sm hover:bg-muted">Cancelar</button>
              <button onClick={handleSave} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
                {editId ? 'Guardar cambios' : 'Crear importación'}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* DOWNLOAD DIALOG */}
      <Dialog open={showDownload} onOpenChange={setShowDownload}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Download size={20} /> Descargar Importaciones</DialogTitle>
            <DialogDescription>Selecciona un rango de fechas de compra para descargar.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Fecha inicial *</label>
                <input type="date" value={dlDateFrom} onChange={e => setDlDateFrom(e.target.value)} className="w-full px-3 py-2 rounded-lg border bg-card text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Fecha final *</label>
                <input type="date" value={dlDateTo} onChange={e => setDlDateTo(e.target.value)} className="w-full px-3 py-2 rounded-lg border bg-card text-sm" />
              </div>
            </div>
            {dlDateFrom && dlDateTo && (
              <div className="rounded-lg bg-muted/50 p-3 text-sm text-center">
                <span className="font-semibold text-primary">{dlFilteredCount}</span> importacion{dlFilteredCount !== 1 ? 'es' : ''} encontrada{dlFilteredCount !== 1 ? 's' : ''}
              </div>
            )}
          </div>
          <DialogFooter>
            <button onClick={() => setShowDownload(false)} className="px-4 py-2 rounded-lg border text-sm hover:bg-muted">Cancelar</button>
            <button onClick={handleImportsExcel} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 flex items-center gap-2">
              <Download size={16} /> Descargar Excel
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
