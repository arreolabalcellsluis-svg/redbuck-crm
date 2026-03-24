import { useState, useRef, useEffect, useMemo } from 'react';
import { Search, Plus, X, Package, Check } from 'lucide-react';
import { useProducts } from '@/hooks/useProducts';
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
}

interface Props {
  items: ImportItemData[];
  onChange: (items: ImportItemData[]) => void;
}

const CATEGORIES = [
  'elevadores', 'alineadoras', 'balanceadoras', 'desmontadoras',
  'compresores', 'gatos_hidraulicos', 'herramienta', 'refacciones', 'accesorios', 'otros',
];

export default function ImportProductSelector({ items, onChange }: Props) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-medium text-muted-foreground">Productos *</label>
        <button
          type="button"
          onClick={() => onChange([...items, { productId: null, productName: '', sku: '', skuFabrica: '', category: '', brand: '', model: '', description: '', listPrice: 0, minPrice: 0, warranty: '', qty: 1, unitCost: 0, cbm: 0, peso: 0 }])}
          className="text-xs text-primary hover:underline flex items-center gap-1"
        >
          <Plus size={12} /> Agregar producto
        </button>
      </div>
      <div className="space-y-2">
        {items.map((item, i) => (
          <ImportItemRow
            key={i}
            item={item}
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
          Sin productos. Haz clic en "+ Agregar producto" para comenzar.
        </div>
      )}
    </div>
  );
}

function ImportItemRow({ item, onUpdate, onRemove }: { item: ImportItemData; onUpdate: (item: ImportItemData) => void; onRemove: () => void }) {
  const { data: products = [] } = useProducts();
  const [search, setSearch] = useState(item.productName);
  const [showSearch, setShowSearch] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [linked, setLinked] = useState(!!item.productId);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setShowSearch(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return products.slice(0, 10);
    const q = search.toLowerCase();
    return products.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    ).slice(0, 10);
  }, [search, products]);

  const selectProduct = (p: typeof products[0]) => {
    onUpdate({
      ...item,
      productId: p.id,
      productName: p.name,
      sku: p.sku,
      category: p.category,
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

  return (
    <div className="rounded-lg border bg-card p-3 space-y-2">
      <div className="flex items-start gap-2">
        {/* Product search */}
        <div className="flex-1 relative" ref={ref}>
          <div className="relative">
            <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setShowSearch(true);
                setLinked(false);
                onUpdate({ ...item, productId: null, productName: e.target.value, sku: '' });
              }}
              onFocus={() => setShowSearch(true)}
              placeholder="Buscar por nombre, SKU o categoría..."
              className="w-full pl-8 pr-3 py-1.5 rounded border bg-background text-sm"
            />
            {linked && (
              <Check size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-green-500" />
            )}
          </div>

          {showSearch && !linked && (
            <div className="absolute z-50 w-full mt-1 bg-popover border rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {filtered.length > 0 ? filtered.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => selectProduct(p)}
                  className="w-full text-left px-3 py-2 hover:bg-muted flex items-center gap-2 text-sm border-b last:border-0"
                >
                  <Package size={12} className="text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{p.name}</div>
                    <div className="text-[10px] text-muted-foreground">{p.sku} · {p.category} · Costo: ${p.cost}</div>
                  </div>
                </button>
              )) : (
                <div className="p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-2">No se encontró el producto</p>
                  <button
                    type="button"
                    onClick={() => { setShowSearch(false); setShowNewForm(true); }}
                    className="text-xs text-primary hover:underline flex items-center gap-1 mx-auto"
                  >
                    <Plus size={12} /> Crear producto nuevo
                  </button>
                </div>
              )}
              {filtered.length > 0 && (
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
      <div className="grid grid-cols-6 gap-2">
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
      {showNewForm && <NewProductForm
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
  onCreated: (p: { id: string; name: string; sku: string; category: string; cost: number }) => void;
  onCancel: () => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState(initialName);
  const [sku, setSku] = useState('');
  const [category, setCategory] = useState('otros');
  const [cost, setCost] = useState(initialCost);
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!sku.trim()) { toast.error('SKU es obligatorio'); return; }
    if (!name.trim()) { toast.error('Nombre es obligatorio'); return; }

    setSaving(true);
    try {
      // Check if SKU exists
      const { data: existing } = await supabase.from('products').select('id, name, sku, category, cost').eq('sku', sku.trim()).maybeSingle();
      if (existing) {
        toast.info(`SKU ya existe. Se vinculó al producto "${existing.name}".`);
        onCreated({ id: existing.id, name: existing.name, sku: existing.sku, category: existing.category, cost: Number(existing.cost) });
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase.from('products').insert({
        sku: sku.trim(),
        name: name.trim(),
        category: category as any,
        brand: '',
        model: '',
        description: '',
        cost,
        list_price: 0,
        min_price: 0,
        currency: 'USD' as any,
        delivery_days: 0,
        supplier: '',
        warranty: '',
        active: true,
        stock: {} as any,
        in_transit: 0,
        images: [] as any,
        user_id: user?.id ?? null,
      }).select('id, name, sku, category, cost').single();

      if (error) throw error;
      qc.invalidateQueries({ queryKey: ['products'] });
      toast.success(`Producto "${data.name}" creado y agregado al catálogo`);
      onCreated({ id: data.id, name: data.name, sku: data.sku, category: data.category, cost: Number(data.cost) });
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
      <div className="grid grid-cols-2 gap-2">
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
          <label className="text-[10px] text-muted-foreground">Costo unitario (USD)</label>
          <input type="number" step="0.01" min={0} value={cost} onChange={e => setCost(Number(e.target.value))} className="w-full px-2 py-1 rounded border bg-background text-xs" />
        </div>
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
