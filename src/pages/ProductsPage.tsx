import { useState, useRef, useMemo } from 'react';
import { useWarehouses } from '@/hooks/useWarehouses';
import { CATEGORY_LABELS, ProductCategory, Product } from '@/types';
import { useAppContext } from '@/contexts/AppContext';
import { getProductImage } from '@/lib/productImages';
import { Search, Plus, Package, Trash2, Pencil, Upload, X, Warehouse, FileText, FileDown } from 'lucide-react';
import { generatePriceListPdf, type PriceListProduct } from '@/lib/priceListPdf';
import { generateProductDatasheet, type DatasheetConfig } from '@/lib/productDatasheetPdf';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useAuthorization } from '@/hooks/useAuthorization';
import AuthorizationDialog from '@/components/shared/AuthorizationDialog';
import { useAllProductFiscalData, useSaveProductFiscalData } from '@/hooks/useInvoicing';
import { useProducts, useAddProduct, useUpdateProduct, useDeleteProduct, type DBProduct } from '@/hooks/useProducts';
import ImageGalleryLightbox from '@/components/shared/ImageGalleryLightbox';
import { useTeamMembers } from '@/hooks/useTeamMembers';

const fmt = (n: number, currency: 'MXN' | 'USD' = 'MXN') => new Intl.NumberFormat('es-MX', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n);

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
    images: db.images ?? [],
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

const emptyProduct = (): Omit<Product, 'id'> & { image?: string; satProductKey?: string; satUnitKey?: string; taxObject?: string; taxFamily?: string } => ({
  sku: '', name: '', category: 'elevadores', brand: 'Redbuck', model: '', description: '',
  images: [],
  listPrice: 0, minPrice: 0, cost: 0, currency: 'USD', deliveryDays: 5,
  supplier: '', warranty: '1 año', active: true, stock: {}, inTransit: 0, image: '',
  satProductKey: '', satUnitKey: '', taxObject: '02', taxFamily: '16',
});

type ProductForm = Omit<Product, 'id'> & { image?: string; satProductKey?: string; satUnitKey?: string; taxObject?: string; taxFamily?: string };

export default function ProductsPage() {
  const { currentRole, exchangeRate } = useAppContext();
  const { data: productFiscalData } = useAllProductFiscalData();
  const saveFiscalMutation = useSaveProductFiscalData();
  const fiscalMap = useMemo(() => new Map((productFiscalData ?? []).map(f => [f.product_id, f])), [productFiscalData]);

  // DB hooks
  const { data: dbProducts, isLoading } = useProducts();
  const { data: dbWarehouses = [] } = useWarehouses();
  const addProductMut = useAddProduct();
  const updateProductMut = useUpdateProduct();
  const deleteProductMut = useDeleteProduct();

  const products = useMemo(() => (dbProducts ?? []).map(dbToProduct), [dbProducts]);
  const { data: teamMembers = [] } = useTeamMembers();
  const sellers = useMemo(() => teamMembers.filter(m => m.active && ['vendedor', 'gerencia_comercial', 'director'].includes(m.role)), [teamMembers]);

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<ProductCategory | ''>('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyProduct());
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { authRequest, requestAuthorization, closeAuth } = useAuthorization();
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  
  // Datasheet PDF state
  const [datasheetProduct, setDatasheetProduct] = useState<Product | null>(null);
  const [datasheetSeller, setDatasheetSeller] = useState({ name: '', phone: '', email: '', note: '' });
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [generatingPriceList, setGeneratingPriceList] = useState(false);
  const [priceListCategory, setPriceListCategory] = useState<string>('all');
  const [showPriceListDialog, setShowPriceListDialog] = useState(false);

  const handleGeneratePriceList = async () => {
    setGeneratingPriceList(true);
    try {
      const priceProducts: PriceListProduct[] = (dbProducts ?? []).map(p => ({
        sku: p.sku,
        name: p.name,
        capacity: (p as any).capacity || p.model || '',
        image: p.image,
        price_client: (p as any).price_client || p.list_price || 0,
        price_distributor: (p as any).price_distributor || p.min_price || 0,
        commission_distributor: (p as any).commission_distributor || 0,
        commission_admin: (p as any).commission_admin || 0,
        category: p.category,
        active: p.active,
      }));
      await generatePriceListPdf(priceProducts, priceListCategory);
      toast.success('Lista de precios generada');
    } catch {
      toast.error('Error al generar lista de precios');
    } finally {
      setGeneratingPriceList(false);
      setShowPriceListDialog(false);
    }
  };
  
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
  dbWarehouses.forEach(w => { warehouseMap[w.id] = w.name; });

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) { toast.error('Solo se permiten archivos de imagen'); return; }
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        setForm(p => {
          const newImages = [...(p.images || []), dataUrl];
          return { ...p, images: newImages, image: newImages[0] };
        });
      };
      reader.readAsDataURL(file);
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeImage = (index: number) => {
    setForm(p => {
      const newImages = (p.images || []).filter((_, i) => i !== index);
      return { ...p, images: newImages, image: newImages[0] || '' };
    });
  };

  const openLightbox = (images: string[], index: number) => {
    setLightboxImages(images);
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  const saveFiscalData = (productId: string) => {
    const vatRate = form.taxFamily === 'exento' ? 0 : Number(form.taxFamily || 16);
    saveFiscalMutation.mutate({
      product_id: productId,
      sat_product_key: form.satProductKey || '',
      sat_unit_key: form.satUnitKey || '',
      tax_object: form.taxObject || '02',
      vat_rate: vatRate,
      fiscal_description: form.name,
    });
  };

  const handleCreate = () => {
    if (!form.name.trim()) { toast.error('El nombre del producto es obligatorio'); return; }
    if (!form.sku.trim()) { toast.error('El SKU es obligatorio'); return; }
    if (form.listPrice <= 0) { toast.error('El precio de lista debe ser mayor a 0'); return; }

    addProductMut.mutate({
      sku: form.sku,
      name: form.name,
      category: form.category,
      brand: form.brand,
      model: form.model,
      description: form.description,
      image: form.image || null,
      images: form.images ?? [],
      list_price: form.listPrice,
      min_price: form.minPrice,
      cost: form.cost,
      currency: 'USD',
      delivery_days: form.deliveryDays,
      supplier: form.supplier,
      warranty: form.warranty,
      active: form.active,
      stock: form.stock,
      in_transit: form.inTransit,
    }, {
      onSuccess: () => {
        toast.success(`Producto "${form.name}" creado correctamente`);
        setShowCreate(false);
        setForm(emptyProduct());
        setImagePreview(null);
      },
    });
  };

  const openEdit = (p: Product) => {
    setEditId(p.id);
    const existing = fiscalMap.get(p.id);
    const taxFamily = existing ? (existing.vat_rate === 0 ? (existing.tax_object === '01' || existing.tax_object === '04' ? 'exento' : '0') : String(existing.vat_rate)) : '16';
    // Consolidate images: use images array if available, otherwise fall back to single image
    const consolidatedImages = (p.images && p.images.length > 0)
      ? p.images
      : (p.image ? [p.image] : []);
    setForm({
      ...p,
      images: consolidatedImages,
      image: consolidatedImages[0] || '',
      satProductKey: existing?.sat_product_key || '',
      satUnitKey: existing?.sat_unit_key || '',
      taxObject: existing?.tax_object || '02',
      taxFamily,
    });
    setImagePreview(consolidatedImages[0] || null);
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
      updateProductMut.mutate({
        id: editId,
        sku: form.sku,
        name: form.name,
        category: form.category,
        brand: form.brand,
        model: form.model,
        cost: form.cost,
        list_price: form.listPrice,
        min_price: form.minPrice,
        stock: form.stock,
        in_transit: form.inTransit,
        active: form.active,
        image: form.image || null,
        images: form.images ?? [],
      }, {
        onSuccess: () => {
          saveFiscalData(editId);
          toast.success(`Producto "${form.name}" actualizado correctamente`);
          setShowEdit(false);
          setEditId(null);
          setForm(emptyProduct());
          setImagePreview(null);
        },
      });
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
        updateProductMut.mutate({ id: deleteTarget, active: false }, {
          onSuccess: () => {
            toast.success(`Producto "${productToDelete?.name}" inactivado`);
            setDeleteTarget(null);
          },
        });
      } else {
        deleteProductMut.mutate(deleteTarget, {
          onSuccess: () => {
            toast.success(`Producto "${productToDelete?.name}" eliminado definitivamente`);
            setDeleteTarget(null);
          },
        });
      }
    };
    requestAuthorization('delete_product', 'productos', doDelete, {
      entityId: deleteTarget, entityLabel: productToDelete?.name,
      onCancelled: () => setDeleteTarget(null),
    });
  };

  const handleGenerateDatasheet = async () => {
    if (!datasheetProduct) return;
    if (!datasheetSeller.name.trim() || !datasheetSeller.phone.trim()) {
      toast.error('Nombre y teléfono del vendedor son obligatorios');
      return;
    }
    setGeneratingPdf(true);
    try {
      await generateProductDatasheet({
        product: datasheetProduct,
        exchangeRate,
        sellerName: datasheetSeller.name,
        sellerPhone: datasheetSeller.phone,
        sellerEmail: datasheetSeller.email || undefined,
        customNote: datasheetSeller.note || undefined,
      });
      toast.success('Ficha técnica generada');
    } catch {
      toast.error('Error al generar ficha técnica');
    } finally {
      setGeneratingPdf(false);
    }
  };

  const getWarehouseNames = (stock: Record<string, number>) => {
    return Object.entries(stock)
      .filter(([, qty]) => qty > 0)
      .map(([wId, qty]) => ({ name: warehouseMap[wId] || wId, qty }));
  };

  const productFormFields = (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Image upload - multiple */}
      <div className="md:col-span-2">
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Imágenes del producto</label>
        <div className="flex flex-wrap items-center gap-3">
          {(form.images || []).map((img, idx) => (
            <div key={idx} className={`relative w-20 h-20 rounded-lg overflow-hidden border group ${idx === 0 ? 'ring-2 ring-primary' : ''}`}>
              <img src={img} alt={`Imagen ${idx + 1}`} className="w-full h-full object-cover cursor-pointer" onClick={() => openLightbox(form.images || [], idx)} />
              <button onClick={() => removeImage(idx)} className="absolute top-1 right-1 p-0.5 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                <X size={10} />
              </button>
              {idx !== 0 && (
                <button
                  onClick={() => {
                    setForm(p => {
                      const imgs = [...(p.images || [])];
                      const [selected] = imgs.splice(idx, 1);
                      imgs.unshift(selected);
                      return { ...p, images: imgs, image: selected };
                    });
                    toast.success('Imagen principal actualizada');
                  }}
                  title="Establecer como imagen principal"
                  className="absolute bottom-1 left-1 p-0.5 rounded-full bg-yellow-500/90 text-white opacity-0 group-hover:opacity-100 transition-opacity text-[9px] leading-none"
                >
                  ⭐
                </button>
              )}
              {idx === 0 && (
                <span className="absolute bottom-1 left-1 text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground">Principal</span>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center w-20 h-20 rounded-lg border border-dashed border-muted-foreground/30 text-muted-foreground text-xs hover:border-primary/50 hover:text-primary transition-colors gap-1"
          >
            <Upload size={16} />
            <span>Agregar</span>
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageSelect} />
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">Puedes subir múltiples imágenes. Haz clic en ⭐ para seleccionar la imagen principal (usada en cotizaciones).</p>
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
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Costo unitario (USD)</label>
        <input type="number" value={form.cost || ''} onChange={e => setForm(p => ({ ...p, cost: +e.target.value }))} className="w-full px-3 py-2 rounded-lg border bg-card text-sm" placeholder="3000" />
        {form.cost > 0 && (
          <p className="text-[10px] text-primary mt-1">≈ {fmt(form.cost * exchangeRate, 'MXN')} MXN</p>
        )}
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Precio de lista (USD) *</label>
        <input type="number" value={form.listPrice || ''} onChange={e => setForm(p => ({ ...p, listPrice: +e.target.value }))} className="w-full px-3 py-2 rounded-lg border bg-card text-sm" placeholder="5000" />
        {form.listPrice > 0 && (
          <p className="text-[10px] text-primary mt-1">≈ {fmt(form.listPrice * exchangeRate, 'MXN')} MXN</p>
        )}
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Precio mínimo (USD)</label>
        <input type="number" value={form.minPrice || ''} onChange={e => setForm(p => ({ ...p, minPrice: +e.target.value }))} className="w-full px-3 py-2 rounded-lg border bg-card text-sm" placeholder="4500" />
        {form.minPrice > 0 && (
          <p className="text-[10px] text-primary mt-1">≈ {fmt(form.minPrice * exchangeRate, 'MXN')} MXN</p>
        )}
      </div>
      <div className="md:col-span-2">
        <p className="text-[10px] text-muted-foreground">Tipo de cambio: $1 USD = ${exchangeRate} MXN (configurable en Ajustes)</p>
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
          <p className="page-subtitle">{isLoading ? '...' : products.filter(p => p.active).length} productos activos</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowPriceListDialog(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border bg-card text-sm font-medium hover:bg-accent transition-colors">
            <FileDown size={16} /> Lista de Precios
          </button>
          <button onClick={() => { setForm(emptyProduct()); setImagePreview(null); setShowCreate(true); }} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
            <Plus size={16} /> Nuevo producto
          </button>
        </div>
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

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Cargando productos...</div>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(p => {
          const warehouses = getWarehouseNames(p.stock);
          const cardImages = p.images?.length ? p.images : [p.image || getProductImage(p.id)];
          const mainImage = cardImages[0];
          return (
            <div key={p.id} className="bg-card rounded-xl border hover:shadow-md transition-shadow overflow-hidden">
              <div className="aspect-[16/10] bg-muted relative overflow-hidden cursor-pointer" onClick={() => { if (cardImages.length > 1) { openLightbox(cardImages, 0); } else { setViewingProduct(p); } }}>
                <img src={mainImage} alt={p.name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }} />
                <span className="absolute top-2 right-2 text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-card/90 text-muted-foreground backdrop-blur-sm">{CATEGORY_LABELS[p.category]}</span>
                {cardImages.length > 1 && (
                  <span className="absolute bottom-2 right-2 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-black/60 text-white backdrop-blur-sm">
                    📷 {cardImages.length}
                  </span>
                )}
              </div>
              <div className="p-5">
                <h3 className="font-display font-semibold text-sm cursor-pointer text-primary hover:underline" onClick={() => setViewingProduct(p)}>{p.name}</h3>
                <p className="text-xs text-muted-foreground mt-1">{p.sku} · {p.brand} {p.model}</p>
                <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{p.description}</p>
                <div className="flex items-center justify-between mt-4 pt-3 border-t">
                  <div>
                    <div className="text-lg font-bold font-display">{fmt(p.listPrice, 'USD')}</div>
                    <div className="text-[10px] text-muted-foreground">Precio de lista (USD)</div>
                    <div className="text-[10px] text-primary">≈ {fmt(p.listPrice * exchangeRate, 'MXN')} MXN</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold">{totalStock(p)} <span className="text-xs font-normal text-muted-foreground">en stock</span></div>
                    {p.inTransit > 0 && <div className="text-[10px] text-primary">+{p.inTransit} en tránsito</div>}
                  </div>
                </div>

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
                    onClick={(e) => { e.stopPropagation(); setDatasheetProduct(p); }}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity"
                  >
                    <FileText size={12} /> Ficha PDF
                  </button>
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
      )}

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
            <button onClick={handleCreate} disabled={addProductMut.isPending} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">
              {addProductMut.isPending ? 'Guardando...' : 'Crear Producto'}
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
            <button onClick={handleEdit} disabled={updateProductMut.isPending} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">
              {updateProductMut.isPending ? 'Guardando...' : 'Guardar Cambios'}
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

      {/* ===================== VIEW PRODUCT DIALOG (READ-ONLY) ===================== */}
      <Dialog open={!!viewingProduct} onOpenChange={() => setViewingProduct(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewingProduct?.name}</DialogTitle>
            <DialogDescription>Información del producto</DialogDescription>
          </DialogHeader>
          {viewingProduct && (
            <div className="space-y-4">
              {(() => {
                const allImages = [
                  ...(viewingProduct.images?.length ? viewingProduct.images : []),
                  ...((!viewingProduct.images?.length && (viewingProduct.image || getProductImage(viewingProduct.id))) ? [viewingProduct.image || getProductImage(viewingProduct.id)] : []),
                ];
                return allImages.length > 0 ? (
                  <div>
                    <div className="aspect-[16/10] bg-muted rounded-lg overflow-hidden cursor-pointer" onClick={() => openLightbox(allImages, 0)}>
                      <img src={allImages[0]} alt={viewingProduct.name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }} />
                    </div>
                    {allImages.length > 1 && (
                      <div className="flex gap-2 mt-2 overflow-x-auto pb-1">
                        {allImages.map((img, idx) => (
                          <button key={idx} onClick={() => openLightbox(allImages, idx)} className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 border-transparent hover:border-primary transition-colors">
                            <img src={img} alt={`Imagen ${idx + 1}`} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }} />
                          </button>
                        ))}
                      </div>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-1">Haz clic en la imagen para ampliar</p>
                  </div>
                ) : null;
              })()}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-xs text-muted-foreground block">SKU</span><span className="font-mono font-medium">{viewingProduct.sku}</span></div>
                <div><span className="text-xs text-muted-foreground block">Categoría</span><span className="font-medium">{CATEGORY_LABELS[viewingProduct.category]}</span></div>
                <div><span className="text-xs text-muted-foreground block">Marca</span><span className="font-medium">{viewingProduct.brand}</span></div>
                <div><span className="text-xs text-muted-foreground block">Modelo</span><span className="font-medium">{viewingProduct.model}</span></div>
                <div className="col-span-2"><span className="text-xs text-muted-foreground block">Descripción</span><span className="font-medium">{viewingProduct.description || '—'}</span></div>
                <div><span className="text-xs text-muted-foreground block">Precio de lista (USD)</span><span className="font-bold text-lg">{fmt(viewingProduct.listPrice, 'USD')}</span><span className="text-[10px] text-primary block">≈ {fmt(viewingProduct.listPrice * exchangeRate, 'MXN')} MXN</span></div>
                <div><span className="text-xs text-muted-foreground block">Precio mínimo (USD)</span><span className="font-medium">{fmt(viewingProduct.minPrice, 'USD')}</span><span className="text-[10px] text-primary block">≈ {fmt(viewingProduct.minPrice * exchangeRate, 'MXN')} MXN</span></div>
                <div><span className="text-xs text-muted-foreground block">Costo (USD)</span><span className="font-medium">{fmt(viewingProduct.cost, 'USD')}</span><span className="text-[10px] text-primary block">≈ {fmt(viewingProduct.cost * exchangeRate, 'MXN')} MXN</span></div>
                <div><span className="text-xs text-muted-foreground block">Stock total</span><span className="font-bold">{totalStock(viewingProduct)}</span></div>
                <div><span className="text-xs text-muted-foreground block">En tránsito</span><span className="font-medium">{viewingProduct.inTransit}</span></div>
                <div><span className="text-xs text-muted-foreground block">Garantía</span><span className="font-medium">{viewingProduct.warranty}</span></div>
                <div><span className="text-xs text-muted-foreground block">Días de entrega</span><span className="font-medium">{viewingProduct.deliveryDays}</span></div>
              </div>
              {(() => {
                const wh = getWarehouseNames(viewingProduct.stock);
                return wh.length > 0 ? (
                  <div className="pt-3 border-t">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-2">Stock por bodega</span>
                    <div className="flex flex-wrap gap-2">
                      {wh.map(w => <span key={w.name} className="text-xs px-2 py-1 rounded-full bg-muted">{w.name}: <strong>{w.qty}</strong></span>)}
                    </div>
                  </div>
                ) : null;
              })()}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ===================== IMAGE LIGHTBOX ===================== */}
      <ImageGalleryLightbox
        images={lightboxImages}
        initialIndex={lightboxIndex}
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
      />

      <AuthorizationDialog request={authRequest} onClose={closeAuth} />

      {/* ===================== DATASHEET PDF DIALOG ===================== */}
      <Dialog open={!!datasheetProduct} onOpenChange={(open) => { if (!open) setDatasheetProduct(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Generar Ficha Técnica</DialogTitle>
            <DialogDescription>Personaliza la ficha comercial de <strong>{datasheetProduct?.name}</strong> antes de generar el PDF.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Vendedor *</label>
              <select
                value={datasheetSeller.name}
                onChange={e => {
                  const selected = sellers.find(s => s.name === e.target.value);
                  if (selected) {
                    setDatasheetSeller(s => ({ ...s, name: selected.name, phone: selected.phone || selected.whatsapp || '', email: selected.email || '' }));
                  } else {
                    setDatasheetSeller(s => ({ ...s, name: e.target.value }));
                  }
                }}
                className="w-full px-3 py-2 rounded-lg border bg-card text-sm"
              >
                <option value="">Selecciona un vendedor</option>
                {sellers.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Teléfono / WhatsApp *</label>
              <input value={datasheetSeller.phone} onChange={e => setDatasheetSeller(s => ({ ...s, phone: e.target.value }))} className="w-full px-3 py-2 rounded-lg border bg-card text-sm" placeholder="33 1234 5678" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Email (opcional)</label>
              <input value={datasheetSeller.email} onChange={e => setDatasheetSeller(s => ({ ...s, email: e.target.value }))} className="w-full px-3 py-2 rounded-lg border bg-card text-sm" placeholder="vendedor@redbuck.com" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Nota personalizada (opcional)</label>
              <textarea value={datasheetSeller.note} onChange={e => setDatasheetSeller(s => ({ ...s, note: e.target.value }))} rows={2} className="w-full px-3 py-2 rounded-lg border bg-card text-sm resize-y" placeholder="Ej: Precio especial válido esta semana..." />
            </div>
          </div>
          <DialogFooter>
            <button onClick={() => setDatasheetProduct(null)} className="px-4 py-2 rounded-lg border text-sm font-medium">Cancelar</button>
            <button onClick={handleGenerateDatasheet} disabled={generatingPdf} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">
              {generatingPdf ? 'Generando...' : '📄 Generar PDF'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
