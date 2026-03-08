import { useState, useRef, useMemo } from 'react';
import { demoProducts as initialProducts, demoWarehouses } from '@/data/demo-data';
import { CATEGORY_LABELS, ProductCategory, Product } from '@/types';
import { useAppContext } from '@/contexts/AppContext';
import { getProductImage } from '@/lib/productImages';
import { Search, Plus, Package, Trash2, Pencil, Upload, X, Warehouse } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useAuthorization } from '@/hooks/useAuthorization';
import AuthorizationDialog from '@/components/shared/AuthorizationDialog';
import { useAllProductFiscalData, useSaveProductFiscalData } from '@/hooks/useInvoicing';

const fmt = (n: number, currency: 'MXN' | 'USD' = 'MXN') => new Intl.NumberFormat('es-MX', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n);

const emptyProduct = (): Omit<Product, 'id'> & { image?: string; satProductKey?: string; satUnitKey?: string; taxObject?: string; taxFamily?: string } => ({
  sku: '', name: '', category: 'elevadores', brand: 'Redbuck', model: '', description: '',
  listPrice: 0, minPrice: 0, cost: 0, currency: 'MXN', deliveryDays: 5,
  supplier: '', warranty: '1 año', active: true, stock: {}, inTransit: 0, image: '',
  satProductKey: '', satUnitKey: '', taxObject: '02', taxFamily: '16',
});

type ProductForm = Omit<Product, 'id'> & { image?: string; satProductKey?: string; satUnitKey?: string; taxObject?: string; taxFamily?: string };

export default function ProductsPage() {
  const { currentRole, exchangeRate } = useAppContext();
  const { data: productFiscalData } = useAllProductFiscalData();
  const saveFiscalMutation = useSaveProductFiscalData();
  const fiscalMap = useMemo(() => new Map((productFiscalData ?? []).map(f => [f.product_id, f])), [productFiscalData]);

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<ProductCategory | ''>('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyProduct());
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { authRequest, requestAuthorization, closeAuth } = useAuthorization();
  const filtered = products.filter(p => {
    if (!p.active) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.sku.toLowerCase().includes(search.toLowerCase())) return false;
    if (category && p.category !== category) return false;
    return true;
  });

  const totalStock = (p: Product) => Object.values(p.stock).reduce((a, b) => a + b, 0);
  const isAdmin = currentRole === 'director';
  const productToDelete = products.find(p => p.id === deleteTarget);

  const warehouseMap: Record<string, string> = {};
  demoWarehouses.forEach(w => { warehouseMap[w.id] = w.name; });

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Solo se permiten archivos de imagen'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setImagePreview(dataUrl);
      setForm(p => ({ ...p, image: dataUrl }));
    };
    reader.readAsDataURL(file);
  };

  const clearImage = () => {
    setImagePreview(null);
    setForm(p => ({ ...p, image: '' }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCreate = () => {
    if (!form.name.trim()) { toast.error('El nombre del producto es obligatorio'); return; }
    if (!form.sku.trim()) { toast.error('El SKU es obligatorio'); return; }
    if (form.listPrice <= 0) { toast.error('El precio de lista debe ser mayor a 0'); return; }

    const newProduct: Product = { ...form, id: `p-${Date.now()}` };
    setProducts(prev => [newProduct, ...prev]);
    toast.success(`Producto "${form.name}" creado correctamente`);
    setShowCreate(false);
    setForm(emptyProduct());
    setImagePreview(null);
  };

  const openEdit = (p: Product) => {
    setEditId(p.id);
    setForm({ ...p });
    setImagePreview(p.image || null);
    setShowEdit(true);
  };

  const handleEdit = () => {
    if (!editId) return;
    if (!form.name.trim()) { toast.error('El nombre del producto es obligatorio'); return; }
    if (!form.sku.trim()) { toast.error('El SKU es obligatorio'); return; }
    if (form.listPrice <= 0) { toast.error('El precio de lista debe ser mayor a 0'); return; }

    const original = products.find(p => p.id === editId);
    const priceChanged = original && (original.listPrice !== form.listPrice || original.minPrice !== form.minPrice);
    const costChanged = original && original.cost !== form.cost;

    const doEdit = () => {
      setProducts(prev => prev.map(p => p.id === editId ? { ...form, id: editId } : p));
      toast.success(`Producto "${form.name}" actualizado correctamente`);
      setShowEdit(false);
      setEditId(null);
      setForm(emptyProduct());
      setImagePreview(null);
    };

    if (costChanged) {
      requestAuthorization('modify_cost', 'productos', doEdit, {
        entityId: editId, entityLabel: form.name,
      });
    } else if (priceChanged) {
      requestAuthorization('modify_price', 'productos', doEdit, {
        entityId: editId, entityLabel: form.name,
      });
    } else {
      doEdit();
    }
  };

  const handleDelete = (type: 'logical' | 'definitive') => {
    if (!deleteTarget) return;
    const doDelete = () => {
      if (type === 'logical') {
        setProducts(prev => prev.map(p => p.id === deleteTarget ? { ...p, active: false } : p));
        toast.success(`Producto "${productToDelete?.name}" inactivado`);
      } else {
        setProducts(prev => prev.filter(p => p.id !== deleteTarget));
        toast.success(`Producto "${productToDelete?.name}" eliminado definitivamente`);
      }
      setDeleteTarget(null);
    };
    requestAuthorization('delete_product', 'productos', doDelete, {
      entityId: deleteTarget, entityLabel: productToDelete?.name,
      onCancelled: () => setDeleteTarget(null),
    });
  };

  const getWarehouseNames = (stock: Record<string, number>) => {
    return Object.entries(stock)
      .filter(([, qty]) => qty > 0)
      .map(([wId, qty]) => ({ name: warehouseMap[wId] || wId, qty }));
  };

  const productFormFields = (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Image upload */}
      <div className="md:col-span-2">
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Imagen del producto</label>
        <div className="flex items-center gap-4">
          {imagePreview ? (
            <div className="relative w-24 h-24 rounded-lg overflow-hidden border">
              <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
              <button onClick={clearImage} className="absolute top-1 right-1 p-0.5 rounded-full bg-destructive text-destructive-foreground">
                <X size={12} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-3 rounded-lg border border-dashed border-muted-foreground/30 text-muted-foreground text-sm hover:border-primary/50 hover:text-primary transition-colors"
            >
              <Upload size={16} /> Adjuntar imagen
            </button>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
          {imagePreview && (
            <button type="button" onClick={() => fileInputRef.current?.click()} className="text-xs text-primary hover:underline">
              Cambiar imagen
            </button>
          )}
        </div>
      </div>

      <div className="md:col-span-2">
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Nombre del producto *</label>
        <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="w-full px-3 py-2 rounded-lg border bg-card text-sm" placeholder="Elevador 4 Postes 4 Ton" />
      </div>
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
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Marca</label>
        <input value={form.brand} onChange={e => setForm(p => ({ ...p, brand: e.target.value }))} className="w-full px-3 py-2 rounded-lg border bg-card text-sm" placeholder="Redbuck" />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Modelo</label>
        <input value={form.model} onChange={e => setForm(p => ({ ...p, model: e.target.value }))} className="w-full px-3 py-2 rounded-lg border bg-card text-sm" placeholder="RB-4P4000" />
      </div>
      <div className="md:col-span-2">
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Descripción</label>
        <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2} className="w-full px-3 py-2 rounded-lg border bg-card text-sm resize-y" placeholder="Descripción del producto..." />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Moneda</label>
        <select value={form.currency} onChange={e => setForm(p => ({ ...p, currency: e.target.value as 'MXN' | 'USD' }))} className="w-full px-3 py-2 rounded-lg border bg-card text-sm">
          <option value="MXN">MXN — Pesos Mexicanos</option>
          <option value="USD">USD — Dólares</option>
        </select>
        {form.currency === 'USD' && (
          <p className="text-[10px] text-muted-foreground mt-1">Tipo de cambio: $1 USD = ${exchangeRate} MXN (configurable en Parámetros Fiscales)</p>
        )}
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Precio de lista ({form.currency}) *</label>
        <input type="number" value={form.listPrice || ''} onChange={e => setForm(p => ({ ...p, listPrice: +e.target.value }))} className="w-full px-3 py-2 rounded-lg border bg-card text-sm" placeholder="89000" />
        {form.currency === 'USD' && form.listPrice > 0 && (
          <p className="text-[10px] text-primary mt-1">≈ {fmt(form.listPrice * exchangeRate, 'MXN')} MXN</p>
        )}
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Precio mínimo ({form.currency})</label>
        <input type="number" value={form.minPrice || ''} onChange={e => setForm(p => ({ ...p, minPrice: +e.target.value }))} className="w-full px-3 py-2 rounded-lg border bg-card text-sm" placeholder="79000" />
        {form.currency === 'USD' && form.minPrice > 0 && (
          <p className="text-[10px] text-primary mt-1">≈ {fmt(form.minPrice * exchangeRate, 'MXN')} MXN</p>
        )}
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Costo ({form.currency})</label>
        <input type="number" value={form.cost || ''} onChange={e => setForm(p => ({ ...p, cost: +e.target.value }))} className="w-full px-3 py-2 rounded-lg border bg-card text-sm" placeholder="52000" />
        {form.currency === 'USD' && form.cost > 0 && (
          <p className="text-[10px] text-primary mt-1">≈ {fmt(form.cost * exchangeRate, 'MXN')} MXN</p>
        )}
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Garantía</label>
        <input value={form.warranty} onChange={e => setForm(p => ({ ...p, warranty: e.target.value }))} className="w-full px-3 py-2 rounded-lg border bg-card text-sm" placeholder="2 años" />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Días de entrega</label>
        <input type="number" value={form.deliveryDays} onChange={e => setForm(p => ({ ...p, deliveryDays: +e.target.value }))} className="w-full px-3 py-2 rounded-lg border bg-card text-sm" />
      </div>

      {/* SAT Keys */}
      <div className="md:col-span-2 pt-2 border-t mt-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Datos fiscales SAT</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Clave SAT Producto</label>
            <input value={form.satProductKey || ''} onChange={e => setForm(p => ({ ...p, satProductKey: e.target.value }))} className="w-full px-3 py-2 rounded-lg border bg-card text-sm" placeholder="24101500" />
            <p className="text-[10px] text-muted-foreground mt-0.5">Ej: 24101500 — Elevadores</p>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Clave SAT Unidad</label>
            <input value={form.satUnitKey || ''} onChange={e => setForm(p => ({ ...p, satUnitKey: e.target.value }))} className="w-full px-3 py-2 rounded-lg border bg-card text-sm" placeholder="H87" />
            <p className="text-[10px] text-muted-foreground mt-0.5">Ej: H87 — Pieza, E48 — Servicio</p>
          </div>
          <div className="col-span-2">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Objeto de Impuestos</label>
            <select value={form.taxObject || '02'} onChange={e => setForm(p => ({ ...p, taxObject: e.target.value }))} className="w-full px-3 py-2 rounded-lg border bg-card text-sm">
              <option value="01">01 — No objeto de impuestos</option>
              <option value="02">02 — Sí objeto de impuestos</option>
              <option value="03">03 — Sí objeto de impuestos y no obligado al desglose</option>
              <option value="04">04 — Sí objeto de impuesto y no causa de impuestos</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Familia de Impuestos</label>
            <select value={form.taxFamily || '16'} onChange={e => setForm(p => ({ ...p, taxFamily: e.target.value }))} className="w-full px-3 py-2 rounded-lg border bg-card text-sm">
              <option value="16">IVA 16%</option>
              <option value="0">IVA 0%</option>
              <option value="exento">Exento</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Catálogo de Productos</h1>
          <p className="page-subtitle">{products.filter(p => p.active).length} productos activos</p>
        </div>
        <button onClick={() => { setForm(emptyProduct()); setImagePreview(null); setShowCreate(true); }} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
          <Plus size={16} /> Nuevo producto
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre o SKU..." className="w-full pl-9 pr-3 py-2 rounded-lg border bg-card text-sm outline-none focus:ring-2 focus:ring-primary/20" />
        </div>
        <select value={category} onChange={e => setCategory(e.target.value as any)} className="px-3 py-2 rounded-lg border bg-card text-sm outline-none">
          <option value="">Todas las categorías</option>
          {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(p => {
          const warehouses = getWarehouseNames(p.stock);
          return (
            <div key={p.id} className="bg-card rounded-xl border hover:shadow-md transition-shadow overflow-hidden">
              <div className="aspect-[16/10] bg-muted relative overflow-hidden">
                <img src={p.image || getProductImage(p.id)} alt={p.name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }} />
                <span className="absolute top-2 right-2 text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-card/90 text-muted-foreground backdrop-blur-sm">{CATEGORY_LABELS[p.category]}</span>
              </div>
              <div className="p-5">
                <h3 className="font-display font-semibold text-sm">{p.name}</h3>
                <p className="text-xs text-muted-foreground mt-1">{p.sku} · {p.brand} {p.model}</p>
                {!(p as any).satProductKey && !(p as any).satUnitKey && (
                  <span className="inline-flex items-center gap-1 mt-1 text-[10px] px-1.5 py-0.5 rounded bg-warning/10 text-warning font-medium">
                    ⚠ Sin claves SAT
                  </span>
                )}
                <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{p.description}</p>
                <div className="flex items-center justify-between mt-4 pt-3 border-t">
                  <div>
                    <div className="text-lg font-bold font-display">{fmt(p.listPrice, p.currency)}</div>
                    <div className="text-[10px] text-muted-foreground">Precio de lista {p.currency === 'USD' ? '(USD)' : ''}</div>
                    {p.currency === 'USD' && (
                      <div className="text-[10px] text-primary">≈ {fmt(p.listPrice * exchangeRate, 'MXN')} MXN</div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold">{totalStock(p)} <span className="text-xs font-normal text-muted-foreground">en stock</span></div>
                    {p.inTransit > 0 && <div className="text-[10px] text-primary">+{p.inTransit} en tránsito</div>}
                  </div>
                </div>

                {/* Warehouse breakdown */}
                {warehouses.length > 0 && (
                  <div className="mt-3 pt-3 border-t">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Warehouse size={12} className="text-muted-foreground" />
                      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Ubicación en bodega</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {warehouses.map(w => (
                        <span key={w.name} className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          {w.name}: <strong className="text-foreground">{w.qty}</strong>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2 mt-3">
                  <button
                    onClick={(e) => { e.stopPropagation(); openEdit(p); }}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium hover:bg-muted transition-colors"
                  >
                    <Pencil size={12} /> Editar
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(p.id); }}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg border border-destructive/30 text-destructive text-xs font-medium hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 size={12} /> Eliminar
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ===================== CREATE PRODUCT DIALOG ===================== */}
      <Dialog open={showCreate} onOpenChange={(open) => { setShowCreate(open); if (!open) { setForm(emptyProduct()); setImagePreview(null); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nuevo Producto</DialogTitle>
            <DialogDescription>Registra un nuevo producto en el catálogo. Los campos con * son obligatorios.</DialogDescription>
          </DialogHeader>
          {productFormFields}
          <DialogFooter>
            <button onClick={() => { setShowCreate(false); setForm(emptyProduct()); setImagePreview(null); }} className="px-4 py-2 rounded-lg border text-sm font-medium">Cancelar</button>
            <button onClick={handleCreate} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
              Crear Producto
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===================== EDIT PRODUCT DIALOG ===================== */}
      <Dialog open={showEdit} onOpenChange={(open) => { setShowEdit(open); if (!open) { setEditId(null); setForm(emptyProduct()); setImagePreview(null); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Producto</DialogTitle>
            <DialogDescription>Modifica la información del producto. Los campos con * son obligatorios.</DialogDescription>
          </DialogHeader>
          {productFormFields}
          <DialogFooter>
            <button onClick={() => { setShowEdit(false); setEditId(null); setForm(emptyProduct()); setImagePreview(null); }} className="px-4 py-2 rounded-lg border text-sm font-medium">Cancelar</button>
            <button onClick={handleEdit} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
              Guardar Cambios
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar producto?</DialogTitle>
            <DialogDescription>
              Estás a punto de eliminar <strong>{productToDelete?.name}</strong>. Si tiene relaciones con cotizaciones, pedidos o inventario, se realizará una eliminación lógica (inactivación).
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 rounded-lg border text-sm font-medium">Cancelar</button>
            <button onClick={() => handleDelete('logical')} className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:opacity-90">
              Inactivar producto
            </button>
            <button onClick={() => handleDelete('definitive')} className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:opacity-90">
              Eliminar definitivamente
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AuthorizationDialog request={authRequest} onClose={closeAuth} />
    </div>
  );
}
