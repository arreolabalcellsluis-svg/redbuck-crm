import { useState, useRef, useEffect, useMemo } from 'react';
import { Search, Plus, X, Package, Check, Wrench } from 'lucide-react';
import { useProducts } from '@/hooks/useProducts';
import { useSpareParts } from '@/hooks/useSpareParts';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

export interface ImportItemData {
  productId: string | null;
  productName: string;
  sku: string;
  skuFabrica: string;
  category: string;
  brand: string;
  model: string;
  description: string;
  listPrice: number;
  minPrice: number;
  warranty: string;
  qty: number;
  unitCost: number;
  cbm: number;
  peso: number;
  supplier: string;
  itemType: 'product' | 'spare_part';
}

interface Props {
  items: ImportItemData[];
  onChange: (items: ImportItemData[]) => void;
  suppliers?: { id: string; name: string }[];
}

const CATEGORIES = [
  'elevadores', 'alineadoras', 'balanceadoras', 'desmontadoras',
  'compresores', 'gatos_hidraulicos', 'herramienta', 'refacciones', 'accesorios', 'otros',
];

const emptyItem = (type: 'product' | 'spare_part' = 'product'): ImportItemData => ({
  productId: null, productName: '', sku: '', skuFabrica: '', category: '', brand: '', model: '',
  description: '', listPrice: 0, minPrice: 0, warranty: '', qty: 1, unitCost: 0, cbm: 0, peso: 0,
  supplier: '', itemType: type,
});

export default function ImportProductSelector({ items, onChange, suppliers = [] }: Props) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-medium text-muted-foreground">Productos y Refacciones *</label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onChange([...items, emptyItem('product')])}
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            <Plus size={12} /> Agregar producto
          </button>
          <button
            type="button"
            onClick={() => onChange([...items, emptyItem('spare_part')])}
            className="text-xs text-orange-600 hover:underline flex items-center gap-1"
          >
            <Plus size={12} /> Agregar refacción
          </button>
        </div>
      </div>
      <div className="space-y-2">
        {items.map((item, i) => (
          <ImportItemRow
            key={i}
            item={item}
            suppliers={suppliers}
            onUpdate={(updated) => {
              const next = [...items];
              next[i] = updated;
              onChange(next);
            }}
            onRemove={() => onChange(items.filter((_, idx) => idx !== i))}
          />
        ))}
      </div>
      {items.length === 0 && (
        <div className="text-center py-4 text-sm text-muted-foreground border rounded-lg border-dashed">
          Sin productos ni refacciones. Haz clic en los botones de arriba para comenzar.
        </div>
      )}
    </div>
  );
}

function ImportItemRow({ item, suppliers, onUpdate, onRemove }: { item: ImportItemData; suppliers: { id: string; name: string }[]; onUpdate: (item: ImportItemData) => void; onRemove: () => void }) {
  const { data: products = [], isLoading: productsLoading } = useProducts();
  const { data: spareParts = [], isLoading: sparePartsLoading } = useSpareParts();
  const [search, setSearch] = useState(item.productName);
  const [showSearch, setShowSearch] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [linked, setLinked] = useState(!!item.productId);
  const ref = useRef<HTMLDivElement>(null);

  const isSparePart = item.itemType === 'spare_part';

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setShowSearch(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (item.productId && item.productName && item.productName !== search) {
      setSearch(item.productName);
      setLinked(true);
    }
  }, [item.productId, item.productName]);

  const filtered = useMemo(() => {
    if (isSparePart) {
      if (!search.trim()) return spareParts.slice(0, 30);
      const q = search.toLowerCase().trim();
      const terms = q.split(/\s+/);
      return spareParts.filter(sp => {
        const haystack = [sp.name, sp.sku, sp.productName, sp.warehouse]
          .filter(Boolean).join(' ').toLowerCase();
        return terms.every(term => haystack.includes(term));
      }).slice(0, 30);
    } else {
      if (!search.trim()) return products.slice(0, 30);
      const q = search.toLowerCase().trim();
      const terms = q.split(/\s+/);
      return products.filter(p => {
        const haystack = [p.name, p.sku, p.category, p.brand, p.model, p.description, p.supplier]
          .filter(Boolean).join(' ').toLowerCase();
        return terms.every(term => haystack.includes(term));
      }).slice(0, 30);
    }
  }, [search, products, spareParts, isSparePart]);

  const selectProduct = (p: any) => {
    onUpdate({
      ...item,
      productId: p.id,
      productName: p.name,
      sku: p.sku,
      category: p.category || '',
      brand: p.brand || '',
      model: p.model || '',
      description: p.description || '',
      listPrice: p.list_price || 0,
      minPrice: p.min_price || 0,
      warranty: p.warranty || '',
      unitCost: p.cost || item.unitCost,
    });
    setSearch(p.name);
    setLinked(true);
    setShowSearch(false);
  };

  const selectSparePart = (sp: any) => {
    onUpdate({
      ...item,
      productId: sp.id,
      productName: sp.name,
      sku: sp.sku,
      category: 'refacciones',
      brand: '',
      model: '',
      description: `Refacción para: ${sp.productName || ''}`,
      listPrice: sp.price || 0,
      minPrice: 0,
      warranty: '',
      unitCost: sp.cost || item.unitCost,
    });
    setSearch(sp.name);
    setLinked(true);
    setShowSearch(false);
  };

  const isLoading = isSparePart ? sparePartsLoading : productsLoading;
  const borderColor = isSparePart ? 'border-orange-300 dark:border-orange-700' : '';
  const typeLabel = isSparePart ? 'Refacción' : 'Producto';

  return (
    <div className={`rounded-lg border bg-card p-3 space-y-2 ${borderColor}`}>
      <div className="flex items-start gap-2">
        <div className="flex-1 relative" ref={ref}>
          <div className="relative">
            {isSparePart
              ? <Wrench size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-orange-500" />
              : <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            }
            <input
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setShowSearch(true);
                setLinked(false);
                onUpdate({ ...item, productId: null, productName: e.target.value, sku: '' });
              }}
              onFocus={() => setShowSearch(true)}
              placeholder={isSparePart ? 'Buscar refacción por nombre o SKU...' : 'Buscar por nombre, SKU o categoría...'}
              className="w-full pl-8 pr-16 py-1.5 rounded border bg-background text-sm"
            />
            <span className={`absolute right-8 top-1/2 -translate-y-1/2 text-[9px] font-semibold px-1.5 py-0.5 rounded ${isSparePart ? 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300' : 'bg-primary/10 text-primary'}`}>
              {typeLabel}
            </span>
            {linked && (
              <Check size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-green-500" />
            )}
          </div>

          {showSearch && !linked && (
            <div className="absolute z-50 w-full mt-1 bg-popover border rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {isLoading ? (
                <div className="p-3 text-center text-xs text-muted-foreground">Cargando...</div>
              ) : filtered.length > 0 ? (
                <>
                  <div className="px-3 py-1.5 text-[10px] text-muted-foreground border-b bg-muted/30">
                    {filtered.length} {isSparePart ? 'refacción(es)' : 'producto(s)'} encontrado(s)
                  </div>
                  {filtered.map((p: any) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => isSparePart ? selectSparePart(p) : selectProduct(p)}
                      className="w-full text-left px-3 py-2 hover:bg-muted flex items-center gap-2 text-sm border-b last:border-0"
                    >
                      {isSparePart
                        ? <Wrench size={12} className="text-orange-500 shrink-0" />
                        : <Package size={12} className="text-muted-foreground shrink-0" />
                      }
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{p.name}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {p.sku} · {isSparePart ? `Para: ${p.productName || '—'}` : `${p.category} · ${p.brand}`} · Costo: ${p.cost}
                        </div>
                      </div>
                    </button>
                  ))}
                </>
              ) : (
                <div className="p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-2">No se encontró "{search}"</p>
                  {!isSparePart && (
                    <button
                      type="button"
                      onClick={() => { setShowSearch(false); setShowNewForm(true); }}
                      className="text-xs text-primary hover:underline flex items-center gap-1 mx-auto"
                    >
                      <Plus size={12} /> Crear producto nuevo
                    </button>
                  )}
                </div>
              )}
              {filtered.length > 0 && !isSparePart && (
                <button
                  type="button"
                  onClick={() => { setShowSearch(false); setShowNewForm(true); }}
                  className="w-full px-3 py-2 text-xs text-primary hover:bg-muted flex items-center gap-1 border-t"
                >
                  <Plus size={12} /> Crear producto nuevo
                </button>
              )}
            </div>
          )}
        </div>
        <button type="button" onClick={onRemove} className="p-1.5 text-muted-foreground hover:text-destructive shrink-0 mt-0.5">
          <X size={14} />
        </button>
      </div>

      {/* Inline fields */}
      <div className="grid grid-cols-7 gap-2">
        <div>
          <label className="text-[10px] text-muted-foreground">Proveedor *</label>
          <select value={item.supplier || ''} onChange={e => onUpdate({ ...item, supplier: e.target.value })} className="w-full px-2 py-1 rounded border bg-background text-xs">
            <option value="">Seleccionar...</option>
            {suppliers.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground">SKU Fábrica</label>
          <input value={item.skuFabrica || ''} className="w-full px-2 py-1 rounded border bg-background text-xs" placeholder="Ref. fábrica" onChange={e => onUpdate({ ...item, skuFabrica: e.target.value })} />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground">SKU</label>
          <input value={item.sku} readOnly={linked} className="w-full px-2 py-1 rounded border bg-background text-xs" onChange={e => onUpdate({ ...item, sku: e.target.value })} />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground">Cantidad *</label>
          <input type="number" min={1} value={item.qty} onChange={e => onUpdate({ ...item, qty: Math.max(1, Number(e.target.value)) })} className="w-full px-2 py-1 rounded border bg-background text-xs text-center" />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground">Costo unit. (USD) *</label>
          <input type="number" step="0.01" min={0} value={item.unitCost} onChange={e => onUpdate({ ...item, unitCost: Number(e.target.value) })} className="w-full px-2 py-1 rounded border bg-background text-xs" />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground">CBM</label>
          <input type="number" step="0.01" min={0} value={item.cbm} onChange={e => onUpdate({ ...item, cbm: Number(e.target.value) })} className="w-full px-2 py-1 rounded border bg-background text-xs" />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground">Peso (kg)</label>
          <input type="number" step="0.1" min={0} value={item.peso} onChange={e => onUpdate({ ...item, peso: Number(e.target.value) })} className="w-full px-2 py-1 rounded border bg-background text-xs" />
        </div>
      </div>

      {/* New product form */}
      {showNewForm && !isSparePart && <NewProductForm
        initialName={search}
        initialCost={item.unitCost}
        onCreated={(p) => {
          onUpdate({ ...item, productId: p.id, productName: p.name, sku: p.sku, category: p.category, brand: p.brand, model: p.model, description: p.description, listPrice: p.listPrice, minPrice: p.minPrice, warranty: p.warranty, unitCost: p.cost || item.unitCost });
          setSearch(p.name);
          setLinked(true);
          setShowNewForm(false);
        }}
        onCancel={() => setShowNewForm(false)}
      />}
    </div>
  );
}

function NewProductForm({ initialName, initialCost, onCreated, onCancel }: {
  initialName: string;
  initialCost: number;
  onCreated: (p: { id: string; name: string; sku: string; category: string; cost: number; brand: string; model: string; description: string; listPrice: number; minPrice: number; warranty: string }) => void;
  onCancel: () => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState(initialName);
  const [sku, setSku] = useState('');
  const [category, setCategory] = useState('otros');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [description, setDescription] = useState('');
  const [cost, setCost] = useState(initialCost);
  const [listPrice, setListPrice] = useState(0);
  const [minPrice, setMinPrice] = useState(0);
  const [warranty, setWarranty] = useState('');
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!sku.trim()) { toast.error('SKU es obligatorio'); return; }
    if (!name.trim()) { toast.error('Nombre es obligatorio'); return; }

    setSaving(true);
    try {
      const { data: existing } = await supabase.from('products').select('id, name, sku, category, cost, brand, model, description, list_price, min_price, warranty').eq('sku', sku.trim()).maybeSingle();
      if (existing) {
        toast.info(`SKU ya existe. Se vinculó al producto "${existing.name}".`);
        onCreated({ id: existing.id, name: existing.name, sku: existing.sku, category: existing.category, cost: Number(existing.cost), brand: existing.brand || '', model: existing.model || '', description: existing.description || '', listPrice: Number(existing.list_price), minPrice: Number(existing.min_price), warranty: existing.warranty || '' });
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase.from('products').insert({
        sku: sku.trim(),
        name: name.trim(),
        category: category as any,
        brand: brand.trim(),
        model: model.trim(),
        description: description.trim(),
        cost,
        list_price: listPrice,
        min_price: minPrice,
        currency: 'USD' as any,
        delivery_days: 0,
        supplier: '',
        warranty: warranty.trim(),
        active: true,
        stock: {} as any,
        in_transit: 0,
        images: [] as any,
        user_id: user?.id ?? null,
      }).select('id, name, sku, category, cost, brand, model, description, list_price, min_price, warranty').single();

      if (error) throw error;
      qc.invalidateQueries({ queryKey: ['products'] });
      toast.success(`Producto "${data.name}" creado y agregado al catálogo`);
      onCreated({ id: data.id, name: data.name, sku: data.sku, category: data.category, cost: Number(data.cost), brand: data.brand || '', model: data.model || '', description: data.description || '', listPrice: Number(data.list_price), minPrice: Number(data.min_price), warranty: data.warranty || '' });
    } catch (e: any) {
      toast.error('Error: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border rounded-lg p-3 bg-accent/5 space-y-2 mt-2">
      <div className="text-xs font-semibold text-primary flex items-center gap-1">
        <Plus size={12} /> Crear producto nuevo
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-[10px] text-muted-foreground">Nombre *</label>
          <input value={name} onChange={e => setName(e.target.value)} className="w-full px-2 py-1 rounded border bg-background text-xs" />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground">SKU * (único)</label>
          <input value={sku} onChange={e => setSku(e.target.value)} className="w-full px-2 py-1 rounded border bg-background text-xs" placeholder="Ej: ELV-4P-001" />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground">Categoría</label>
          <select value={category} onChange={e => setCategory(e.target.value)} className="w-full px-2 py-1 rounded border bg-background text-xs">
            {CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground">Marca</label>
          <input value={brand} onChange={e => setBrand(e.target.value)} className="w-full px-2 py-1 rounded border bg-background text-xs" />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground">Modelo</label>
          <input value={model} onChange={e => setModel(e.target.value)} className="w-full px-2 py-1 rounded border bg-background text-xs" />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground">Costo unit. (USD)</label>
          <input type="number" step="0.01" min={0} value={cost} onChange={e => setCost(Number(e.target.value))} className="w-full px-2 py-1 rounded border bg-background text-xs" />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground">Precio lista (MXN)</label>
          <input type="number" step="0.01" min={0} value={listPrice} onChange={e => setListPrice(Number(e.target.value))} className="w-full px-2 py-1 rounded border bg-background text-xs" />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground">Precio mínimo (MXN)</label>
          <input type="number" step="0.01" min={0} value={minPrice} onChange={e => setMinPrice(Number(e.target.value))} className="w-full px-2 py-1 rounded border bg-background text-xs" />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground">Garantía</label>
          <input value={warranty} onChange={e => setWarranty(e.target.value)} className="w-full px-2 py-1 rounded border bg-background text-xs" placeholder="Ej: 1 año" />
        </div>
      </div>
      <div>
        <label className="text-[10px] text-muted-foreground">Descripción</label>
        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className="w-full px-2 py-1 rounded border bg-background text-xs resize-none" />
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-3 py-1 rounded border text-xs hover:bg-muted">Cancelar</button>
        <button type="button" onClick={handleCreate} disabled={saving} className="px-3 py-1 rounded bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 disabled:opacity-50">
          {saving ? 'Guardando...' : 'Crear y vincular'}
        </button>
      </div>
    </div>
  );
}
