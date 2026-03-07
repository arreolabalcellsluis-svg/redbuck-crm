import { Plus, X, Pencil } from 'lucide-react';
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { demoSuppliers } from '@/data/demo-data';
import { toast } from '@/hooks/use-toast';

interface Purchase {
  id: number;
  folio: string;
  supplier: string;
  products: string;
  total: number;
  status: string;
  date: string;
  notes?: string;
}

const PURCHASE_STATUSES = [
  { value: 'enviada', label: 'Enviada' },
  { value: 'confirmada', label: 'Confirmada' },
  { value: 'en_transito', label: 'En tránsito' },
  { value: 'recibida_parcial', label: 'Recibida parcial' },
  { value: 'recibida_total', label: 'Recibida total' },
  { value: 'cancelada', label: 'Cancelada' },
];

const statusLabel = (s: string) => PURCHASE_STATUSES.find(st => st.value === s)?.label || s.replace('_', ' ');

const initialPurchases: Purchase[] = [
  { id: 1, folio: 'OC-2026-001', supplier: 'Herramientas MX', products: 'Prensas, Gatos', total: 125000, status: 'recibida_total', date: '2026-02-10' },
  { id: 2, folio: 'OC-2026-002', supplier: 'Herramientas MX', products: 'Compresores', total: 78000, status: 'confirmada', date: '2026-02-28' },
  { id: 3, folio: 'OC-2026-003', supplier: 'Herramientas MX', products: 'Lubricación', total: 34500, status: 'enviada', date: '2026-03-03' },
];

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<Purchase[]>(initialPurchases);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
  const [form, setForm] = useState({ supplier: '', date: '' });
  const [items, setItems] = useState<{ name: string; qty: number; cost: number }[]>([]);

  // Edit form state
  const [editForm, setEditForm] = useState({ folio: '', supplier: '', products: '', total: 0, status: '', date: '', notes: '' });

  const addItem = () => setItems([...items, { name: '', qty: 1, cost: 0 }]);
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: string, value: any) => {
    const updated = [...items];
    (updated[i] as any)[field] = value;
    setItems(updated);
  };

  const total = items.reduce((s, it) => s + it.qty * it.cost, 0);

  const handleCreate = () => {
    if (!form.supplier || items.length === 0) {
      toast({ title: 'Error', description: 'Selecciona proveedor y agrega productos', variant: 'destructive' });
      return;
    }
    const folio = `OC-2026-${String(purchases.length + 1).padStart(3, '0')}`;
    const newPurchase: Purchase = {
      id: Date.now(),
      folio,
      supplier: form.supplier,
      products: items.map(it => it.name).filter(Boolean).join(', '),
      total,
      status: 'enviada',
      date: form.date || new Date().toISOString().slice(0, 10),
    };
    setPurchases(prev => [newPurchase, ...prev]);
    setOpen(false);
    setForm({ supplier: '', date: '' });
    setItems([]);
    toast({ title: 'Orden creada', description: `Folio ${folio}` });
  };

  const openEdit = (p: Purchase) => {
    setEditingPurchase(p);
    setEditForm({
      folio: p.folio,
      supplier: p.supplier,
      products: p.products,
      total: p.total,
      status: p.status,
      date: p.date,
      notes: p.notes || '',
    });
    setEditOpen(true);
  };

  const handleSaveEdit = () => {
    if (!editingPurchase) return;
    if (!editForm.folio.trim()) {
      toast({ title: 'Error', description: 'El folio no puede estar vacío', variant: 'destructive' });
      return;
    }
    // Check duplicate folio
    const duplicate = purchases.find(p => p.folio === editForm.folio.trim() && p.id !== editingPurchase.id);
    if (duplicate) {
      toast({ title: 'Error', description: 'Ya existe una orden con ese folio', variant: 'destructive' });
      return;
    }
    setPurchases(prev => prev.map(p => p.id === editingPurchase.id ? {
      ...p,
      folio: editForm.folio.trim(),
      supplier: editForm.supplier,
      products: editForm.products,
      total: editForm.total,
      status: editForm.status,
      date: editForm.date,
      notes: editForm.notes,
    } : p));
    setEditOpen(false);
    setEditingPurchase(null);
    toast({ title: 'Orden actualizada', description: `Folio ${editForm.folio.trim()}` });
  };

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Compras Nacionales</h1>
          <p className="page-subtitle">Órdenes de compra a proveedores nacionales</p>
        </div>
        <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
          <Plus size={16} /> Nueva orden
        </button>
      </div>

      <div className="bg-card rounded-xl border overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr><th>Folio</th><th>Proveedor</th><th>Productos</th><th>Total</th><th>Estado</th><th>Fecha</th><th></th></tr>
          </thead>
          <tbody>
            {purchases.map(p => (
              <tr key={p.id}>
                <td className="font-mono text-xs font-semibold">{p.folio}</td>
                <td className="font-medium">{p.supplier}</td>
                <td className="text-muted-foreground">{p.products}</td>
                <td className="font-semibold">${p.total.toLocaleString()}</td>
                <td><span className={`status-badge ${p.status === 'recibida_total' ? 'status-badge-success' : p.status === 'confirmada' ? 'status-badge-info' : p.status === 'cancelada' ? 'status-badge-danger' : 'status-badge-warning'}`}>{statusLabel(p.status)}</span></td>
                <td className="text-xs text-muted-foreground">{p.date}</td>
                <td>
                  <button onClick={() => openEdit(p)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Editar">
                    <Pencil size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nueva Orden de Compra</DialogTitle>
            <DialogDescription>Registra una orden de compra nacional</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Proveedor *</label>
                <select value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm">
                  <option value="">Seleccionar...</option>
                  {demoSuppliers.filter(s => s.type === 'nacional').map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Fecha</label>
                <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-muted-foreground">Productos *</label>
                <button onClick={addItem} className="text-xs text-primary hover:underline">+ Agregar</button>
              </div>
              {items.map((it, i) => (
                <div key={i} className="flex items-center gap-2 mb-2">
                  <input value={it.name} onChange={e => updateItem(i, 'name', e.target.value)} placeholder="Producto" className="flex-1 px-2 py-1.5 rounded border bg-background text-sm" />
                  <input type="number" min={1} value={it.qty} onChange={e => updateItem(i, 'qty', Number(e.target.value))} className="w-16 px-2 py-1.5 rounded border bg-background text-sm text-center" />
                  <input type="number" value={it.cost} onChange={e => updateItem(i, 'cost', Number(e.target.value))} placeholder="Costo" className="w-24 px-2 py-1.5 rounded border bg-background text-sm" />
                  <button onClick={() => removeItem(i)} className="text-muted-foreground hover:text-destructive"><X size={14} /></button>
                </div>
              ))}
            </div>

            <div className="text-right font-bold text-sm">Total: ${total.toLocaleString()}</div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setOpen(false)} className="px-4 py-2 rounded-lg border text-sm hover:bg-muted">Cancelar</button>
              <button onClick={handleCreate} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">Crear orden</button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Orden de Compra</DialogTitle>
            <DialogDescription>Modifica el folio, estado e información general</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Folio *</label>
                <input value={editForm.folio} onChange={e => setEditForm({ ...editForm, folio: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm font-mono" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Estado</label>
                <select value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm">
                  {PURCHASE_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Proveedor</label>
                <select value={editForm.supplier} onChange={e => setEditForm({ ...editForm, supplier: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm">
                  <option value="">Seleccionar...</option>
                  {demoSuppliers.filter(s => s.type === 'nacional').map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Fecha</label>
                <input type="date" value={editForm.date} onChange={e => setEditForm({ ...editForm, date: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm" />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">Productos</label>
              <input value={editForm.products} onChange={e => setEditForm({ ...editForm, products: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm" />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">Total ($)</label>
              <input type="number" value={editForm.total} onChange={e => setEditForm({ ...editForm, total: Number(e.target.value) })} className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm" />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">Notas</label>
              <textarea value={editForm.notes} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} rows={2} className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm resize-none" placeholder="Observaciones..." />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setEditOpen(false)} className="px-4 py-2 rounded-lg border text-sm hover:bg-muted">Cancelar</button>
              <button onClick={handleSaveEdit} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">Guardar cambios</button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
