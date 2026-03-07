import { useState } from 'react';
import { demoProducts as initialProducts, demoWarehouses } from '@/data/demo-data';
import { useAppContext } from '@/contexts/AppContext';
import { CATEGORY_LABELS, ProductCategory, Product } from '@/types';
import MetricCard from '@/components/shared/MetricCard';
import { Warehouse, Package, ArrowLeftRight, AlertTriangle, Search, Plus, Pencil } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useAuthorization } from '@/hooks/useAuthorization';
import AuthorizationDialog from '@/components/shared/AuthorizationDialog';

const fmt = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);

type InventoryForm = {
  productId: string;
  productName: string;
  sku: string;
  category: ProductCategory;
  stock: Record<string, number>;
  inTransit: number;
  cost: number;
};

const emptyForm = (): InventoryForm => ({
  productId: '', productName: '', sku: '', category: 'elevadores',
  stock: Object.fromEntries(demoWarehouses.map(w => [w.id, 0])),
  inTransit: 0, cost: 0,
});

export default function InventoryPage() {
  const { currentRole } = useAppContext();
  const [search, setSearch] = useState('');
  const [filterWarehouse, setFilterWarehouse] = useState('');
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<InventoryForm>(emptyForm());

  const isAdmin = currentRole === 'director';
  const isVendedor = currentRole === 'vendedor';
  const { authRequest, requestAuthorization, closeAuth } = useAuthorization();

  const totalValue = products.reduce((s, p) => s + Object.values(p.stock).reduce((a, b) => a + b, 0) * p.cost, 0);
  const totalUnits = products.reduce((s, p) => s + Object.values(p.stock).reduce((a, b) => a + b, 0), 0);
  const inTransit = products.reduce((s, p) => s + p.inTransit, 0);
  const lowStock = products.filter(p => Object.values(p.stock).reduce((a, b) => a + b, 0) <= 2).length;

  const filtered = products.filter(p => {
    if (!p.active) return false;
    const q = search.toLowerCase();
    if (q && !p.name.toLowerCase().includes(q) && !p.sku.toLowerCase().includes(q)) return false;
    if (filterWarehouse && (p.stock[filterWarehouse] || 0) === 0) return false;
    return true;
  });

  const resetForm = () => {
    setForm(emptyForm());
    setEditId(null);
  };

  const handleCreate = () => {
    if (!form.productName.trim()) { toast.error('El nombre del producto es obligatorio'); return; }
    if (!form.sku.trim()) { toast.error('El SKU es obligatorio'); return; }

    const newProduct: Product = {
      id: `inv-${Date.now()}`,
      sku: form.sku,
      name: form.productName,
      category: form.category,
      brand: 'Redbuck',
      model: '',
      description: '',
      listPrice: 0,
      minPrice: 0,
      cost: form.cost,
      currency: 'MXN',
      deliveryDays: 5,
      supplier: '',
      warranty: '1 año',
      active: true,
      stock: { ...form.stock },
      inTransit: form.inTransit,
    };
    setProducts(prev => [newProduct, ...prev]);
    toast.success(`Inventario "${form.productName}" creado correctamente`);
    setShowCreate(false);
    resetForm();
  };

  const openEdit = (p: Product) => {
    setEditId(p.id);
    setForm({
      productId: p.id,
      productName: p.name,
      sku: p.sku,
      category: p.category,
      stock: { ...p.stock },
      inTransit: p.inTransit,
      cost: p.cost,
    });
    setShowEdit(true);
  };

  const handleEdit = () => {
    if (!editId) return;
    const doEdit = () => {
      setProducts(prev => prev.map(p => p.id === editId ? {
        ...p,
        name: form.productName,
        sku: form.sku,
        category: form.category,
        stock: { ...form.stock },
        inTransit: form.inTransit,
        cost: form.cost,
      } : p));
      toast.success(`Inventario "${form.productName}" actualizado`);
      setShowEdit(false);
      resetForm();
    };

    const original = products.find(p => p.id === editId);
    const stockChanged = original && JSON.stringify(original.stock) !== JSON.stringify(form.stock);
    const costChanged = original && original.cost !== form.cost;

    if (costChanged) {
      requestAuthorization('modify_cost', 'inventario', doEdit, { entityId: editId, entityLabel: form.productName });
    } else if (stockChanged) {
      requestAuthorization('modify_inventory', 'inventario', doEdit, { entityId: editId, entityLabel: form.productName });
    } else {
      doEdit();
    }
  };

  const inventoryFormFields = (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Nombre del producto *</label>
        <input value={form.productName} onChange={e => setForm(p => ({ ...p, productName: e.target.value }))} className="w-full px-3 py-2 rounded-lg border bg-card text-sm" placeholder="Elevador 4 Postes 4 Ton" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">SKU *</label>
          <input value={form.sku} onChange={e => setForm(p => ({ ...p, sku: e.target.value }))} className="w-full px-3 py-2 rounded-lg border bg-card text-sm" placeholder="RB-ELV-4P01" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Categoría</label>
          <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value as ProductCategory }))} className="w-full px-3 py-2 rounded-lg border bg-card text-sm">
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Costo unitario (MXN)</label>
        <input type="number" value={form.cost || ''} onChange={e => setForm(p => ({ ...p, cost: +e.target.value }))} className="w-full px-3 py-2 rounded-lg border bg-card text-sm" placeholder="52000" />
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground mb-2 block">Stock por bodega</label>
        <div className="space-y-2">
          {demoWarehouses.map(w => (
            <div key={w.id} className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground w-40 shrink-0">{w.name}</span>
              <input
                type="number"
                min={0}
                value={form.stock[w.id] || 0}
                onChange={e => setForm(p => ({ ...p, stock: { ...p.stock, [w.id]: +e.target.value } }))}
                className="w-24 px-3 py-2 rounded-lg border bg-card text-sm text-center"
              />
            </div>
          ))}
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">En tránsito</label>
        <input type="number" min={0} value={form.inTransit} onChange={e => setForm(p => ({ ...p, inTransit: +e.target.value }))} className="w-24 px-3 py-2 rounded-lg border bg-card text-sm" />
      </div>
    </div>
  );

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Inventario</h1>
          <p className="page-subtitle">Control de existencias por bodega</p>
        </div>
        {isAdmin && (
          <button onClick={() => { resetForm(); setShowCreate(true); }} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
            <Plus size={16} /> Nuevo inventario
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <MetricCard title="Unidades totales" value={totalUnits} icon={Package} />
        <MetricCard title="Valor inventario" value={fmt(totalValue)} icon={Warehouse} variant="primary" />
        <MetricCard title="En tránsito" value={inTransit} icon={ArrowLeftRight} variant="warning" subtitle="unidades" />
        <MetricCard title="Stock bajo" value={lowStock} icon={AlertTriangle} variant="danger" subtitle="productos" />
      </div>

      {/* Warehouses overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {demoWarehouses.map(w => {
          const units = products.reduce((s, p) => s + (p.stock[w.id] || 0), 0);
          const value = products.reduce((s, p) => s + (p.stock[w.id] || 0) * p.cost, 0);
          return (
            <div key={w.id} className="bg-card rounded-xl border p-5">
              <div className="flex items-center gap-3 mb-3">
                <Warehouse size={20} className="text-muted-foreground" />
                <div>
                  <h3 className="font-display font-semibold text-sm">{w.name}</h3>
                  <p className="text-xs text-muted-foreground">{w.location}{w.hasExhibition ? ' · Con exhibición' : ''}</p>
                </div>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{units} unidades</span>
                <span className="font-semibold">{fmt(value)}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Product stock table */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por producto o SKU..." className="w-full pl-9 pr-3 py-2 rounded-lg border bg-card text-sm outline-none focus:ring-2 focus:ring-primary/20" />
        </div>
        <select value={filterWarehouse} onChange={e => setFilterWarehouse(e.target.value)} className="px-3 py-2 rounded-lg border bg-card text-sm outline-none focus:ring-2 focus:ring-primary/20">
          <option value="">Todas las bodegas</option>
          {demoWarehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
        {(search || filterWarehouse) && (
          <button onClick={() => { setSearch(''); setFilterWarehouse(''); }} className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted transition-colors">
            Limpiar filtros
          </button>
        )}
      </div>

      <div className="bg-card rounded-xl border overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Producto</th>
              <th>SKU</th>
              {demoWarehouses.map(w => <th key={w.id}>{w.name}</th>)}
              <th>Total</th>
              <th>Tránsito</th>
              {isAdmin && <th></th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => {
              const total = Object.values(p.stock).reduce((a, b) => a + b, 0);
              return (
                <tr key={p.id}>
                  <td className="font-medium">{p.name}</td>
                  <td className="text-muted-foreground text-xs font-mono">{p.sku}</td>
                  {demoWarehouses.map(w => (
                    <td key={w.id}>
                      <span className={`font-semibold ${(p.stock[w.id] || 0) === 0 ? 'text-destructive' : ''}`}>{p.stock[w.id] || 0}</span>
                    </td>
                  ))}
                  <td className="font-bold">{total}</td>
                  <td>{p.inTransit > 0 ? <span className="text-info font-medium">{p.inTransit}</span> : <span className="text-muted-foreground">—</span>}</td>
                  {isAdmin && (
                    <td>
                      <button onClick={() => openEdit(p)} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                        <Pencil size={14} />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ===================== CREATE INVENTORY DIALOG ===================== */}
      <Dialog open={showCreate} onOpenChange={(open) => { setShowCreate(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nuevo Inventario</DialogTitle>
            <DialogDescription>Registra un nuevo producto en el inventario con stock por bodega.</DialogDescription>
          </DialogHeader>
          {inventoryFormFields}
          <DialogFooter>
            <button onClick={() => { setShowCreate(false); resetForm(); }} className="px-4 py-2 rounded-lg border text-sm font-medium">Cancelar</button>
            <button onClick={handleCreate} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
              Crear Inventario
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===================== EDIT INVENTORY DIALOG ===================== */}
      <Dialog open={showEdit} onOpenChange={(open) => { setShowEdit(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Inventario</DialogTitle>
            <DialogDescription>Modifica el stock y datos del producto en inventario.</DialogDescription>
          </DialogHeader>
          {inventoryFormFields}
          <DialogFooter>
            <button onClick={() => { setShowEdit(false); resetForm(); }} className="px-4 py-2 rounded-lg border text-sm font-medium">Cancelar</button>
            <button onClick={handleEdit} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
              Guardar Cambios
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AuthorizationDialog request={authRequest} onClose={closeAuth} />
    </div>
  );
}
