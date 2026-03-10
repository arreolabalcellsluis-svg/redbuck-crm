import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { demoWarehouses } from '@/data/demo-data';
import { useAppContext } from '@/contexts/AppContext';
import { CATEGORY_LABELS, ProductCategory, Product } from '@/types';
import MetricCard from '@/components/shared/MetricCard';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Warehouse, Package, ArrowLeftRight, AlertTriangle, Search, Plus, Pencil, Trash2, CalendarIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useAuthorization } from '@/hooks/useAuthorization';
import AuthorizationDialog from '@/components/shared/AuthorizationDialog';
import { useProducts, useAddProduct, useUpdateProduct, useDeleteProduct, type DBProduct } from '@/hooks/useProducts';

const fmt = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);

// Map DB row to local Product type
function dbToProduct(db: DBProduct): Product {
  return {
    id: db.id,
    sku: db.sku,
    name: db.name,
    category: db.category as ProductCategory,
    brand: db.brand,
    model: db.model,
    description: db.description,
    image: db.image || undefined,
    listPrice: db.list_price,
    minPrice: db.min_price,
    cost: db.cost,
    currency: db.currency,
    deliveryDays: db.delivery_days,
    supplier: db.supplier,
    warranty: db.warranty,
    active: db.active,
    stock: db.stock,
    inTransit: db.in_transit,
  };
}

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
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<InventoryForm>(emptyForm());

  // DB hooks
  const { data: dbProducts, isLoading } = useProducts();
  const addProductMut = useAddProduct();
  const updateProductMut = useUpdateProduct();
  const deleteProductMut = useDeleteProduct();

  const products = useMemo(() => (dbProducts ?? []).map(dbToProduct), [dbProducts]);

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

    addProductMut.mutate({
      sku: form.sku,
      name: form.productName,
      category: form.category,
      brand: 'Redbuck',
      model: '',
      description: '',
      image: null,
      images: [],
      list_price: 0,
      min_price: 0,
      cost: form.cost,
      currency: 'MXN',
      delivery_days: 5,
      supplier: '',
      warranty: '1 año',
      active: true,
      stock: form.stock,
      in_transit: form.inTransit,
    }, {
      onSuccess: () => {
        toast.success(`Inventario "${form.productName}" creado correctamente`);
        setShowCreate(false);
        resetForm();
      },
    });
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
      updateProductMut.mutate({
        id: editId,
        name: form.productName,
        sku: form.sku,
        category: form.category,
        stock: form.stock,
        in_transit: form.inTransit,
        cost: form.cost,
      }, {
        onSuccess: () => {
          toast.success(`Inventario "${form.productName}" actualizado`);
          setShowEdit(false);
          resetForm();
        },
      });
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

  const [inventoryDate, setInventoryDate] = useState<Date>(new Date());

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Inventario</h1>
          <p className="page-subtitle">
            Control de existencias — {format(inventoryDate, "d 'de' MMMM yyyy", { locale: es })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("justify-start text-left text-sm h-9 gap-2")}>
                <CalendarIcon className="h-4 w-4 text-primary" />
                {format(inventoryDate, "dd/MM/yyyy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={inventoryDate}
                onSelect={d => d && setInventoryDate(d)}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => setInventoryDate(new Date())}>
            Hoy
          </Button>
          {isAdmin && (
            <button onClick={() => { resetForm(); setShowCreate(true); }} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
              <Plus size={16} /> Nuevo inventario
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <MetricCard title="Unidades totales" value={isLoading ? '...' : totalUnits} icon={Package} />
        {!isVendedor && <MetricCard title="Valor inventario" value={isLoading ? '...' : fmt(totalValue)} icon={Warehouse} variant="primary" />}
        <MetricCard title="En tránsito" value={isLoading ? '...' : inTransit} icon={ArrowLeftRight} variant="warning" subtitle="unidades" />
        <MetricCard title="Stock bajo" value={isLoading ? '...' : lowStock} icon={AlertTriangle} variant="danger" subtitle="productos" />
      </div>

      {/* Warehouses overview */}
      {!isVendedor && (
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
      )}

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

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Cargando inventario...</div>
      ) : (
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
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(p)} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="Editar">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => {
                          if (confirm(`¿Eliminar "${p.name}" del inventario?`)) {
                            deleteProductMut.mutate(p.id);
                          }
                        }} className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" title="Eliminar">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      )}

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
            <button onClick={handleCreate} disabled={addProductMut.isPending} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">
              {addProductMut.isPending ? 'Guardando...' : 'Crear Inventario'}
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
            <button onClick={handleEdit} disabled={updateProductMut.isPending} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">
              {updateProductMut.isPending ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AuthorizationDialog request={authRequest} onClose={closeAuth} />
    </div>
  );
}
