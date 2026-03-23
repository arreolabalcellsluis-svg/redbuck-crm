import { useAppContext } from '@/contexts/AppContext';
import { Search, Plus, AlertTriangle, Trash2, Pencil, Upload, X } from 'lucide-react';
import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import type { SparePart } from '@/types';
import { useAuthorization } from '@/hooks/useAuthorization';
import AuthorizationDialog from '@/components/shared/AuthorizationDialog';
import { useSpareParts, useAddSparePart, useUpdateSparePart, useDeleteSparePart } from '@/hooks/useSpareParts';
import { useProducts } from '@/hooks/useProducts';
import ImageGalleryLightbox from '@/components/shared/ImageGalleryLightbox';

const fmt = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);

type SparePartForm = Omit<SparePart, 'id'>;

const emptyForm = (): SparePartForm => ({
  sku: '', name: '', productId: '', productName: '', cost: 0, price: 0,
  stock: 0, minStock: 5, warehouse: 'w1', active: true, image: '', images: [],
});

export default function SparePartsPage() {
  const { currentRole } = useAppContext();
  const isVendedor = currentRole === 'vendedor';
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<SparePartForm>(emptyForm());
  const [viewingSparePart, setViewingSparePart] = useState<SparePart | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);

  const { data: spareParts = [], isLoading } = useSpareParts();
  const { data: dbProducts = [] } = useProducts();
  const addMutation = useAddSparePart();
  const updateMutation = useUpdateSparePart();
  const deleteMutation = useDeleteSparePart();

  const isAdmin = currentRole === 'director';
  const { authRequest, requestAuthorization, closeAuth } = useAuthorization();
  const filtered = spareParts.filter(s => s.active !== false && (s.name.toLowerCase().includes(search.toLowerCase()) || s.productName.toLowerCase().includes(search.toLowerCase())));
  const spareToDelete = spareParts.find(s => s.id === deleteTarget);

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

  const resetForm = () => {
    setForm(emptyForm());
    setEditId(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCreate = () => {
    if (!form.name.trim()) { toast.error('El nombre de la refacción es obligatorio'); return; }
    if (!form.sku.trim()) { toast.error('El SKU es obligatorio'); return; }
    if (form.price <= 0) { toast.error('El precio debe ser mayor a 0'); return; }

    const product = dbProducts.find(p => p.id === form.productId);
    addMutation.mutate({
      ...form,
      productName: product?.name || form.productName || 'Sin equipo',
    });
    setShowCreate(false);
    resetForm();
  };

  const openEdit = (sp: SparePart) => {
    setEditId(sp.id);
    // Consolidate images: use images array if available, otherwise fall back to single image
    const consolidatedImages = (sp.images && sp.images.length > 0)
      ? sp.images
      : (sp.image ? [sp.image] : []);
    setForm({
      ...sp,
      images: consolidatedImages,
      image: consolidatedImages[0] || '',
    });
    setShowEdit(true);
  };

  const handleEdit = () => {
    if (!editId) return;
    if (!form.name.trim()) { toast.error('El nombre de la refacción es obligatorio'); return; }
    if (!form.sku.trim()) { toast.error('El SKU es obligatorio'); return; }
    if (form.price <= 0) { toast.error('El precio debe ser mayor a 0'); return; }

    const product = dbProducts.find(p => p.id === form.productId);
    updateMutation.mutate({
      id: editId,
      ...form,
      productName: product?.name || form.productName || 'Sin equipo',
    });
    setShowEdit(false);
    resetForm();
  };

  const formFields = (
    <div className="space-y-4">
      {/* Multi-image upload */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Imágenes de la refacción</label>
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
        <p className="text-[10px] text-muted-foreground mt-1">Puedes subir múltiples imágenes. Haz clic en ⭐ para seleccionar la imagen principal.</p>
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Nombre *</label>
        <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="w-full px-3 py-2 rounded-lg border bg-card text-sm" placeholder="Cilindro hidráulico elevador" />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">SKU *</label>
        <input value={form.sku} onChange={e => setForm(p => ({ ...p, sku: e.target.value }))} className="w-full px-3 py-2 rounded-lg border bg-card text-sm" placeholder="RB-REF-CIL01" />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Equipo relacionado</label>
        <select value={form.productId} onChange={e => { const prod = dbProducts.find(p => p.id === e.target.value); setForm(p => ({ ...p, productId: e.target.value, productName: prod?.name || '' })); }} className="w-full px-3 py-2 rounded-lg border bg-card text-sm">
          <option value="">Seleccionar equipo...</option>
          {dbProducts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      {!isVendedor && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Costo</label>
            <input type="number" value={form.cost || ''} onChange={e => setForm(p => ({ ...p, cost: +e.target.value }))} className="w-full px-3 py-2 rounded-lg border bg-card text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Precio *</label>
            <input type="number" value={form.price || ''} onChange={e => setForm(p => ({ ...p, price: +e.target.value }))} className="w-full px-3 py-2 rounded-lg border bg-card text-sm" />
          </div>
        </div>
      )}
      {isVendedor && (
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Precio *</label>
          <input type="number" value={form.price || ''} onChange={e => setForm(p => ({ ...p, price: +e.target.value }))} className="w-full px-3 py-2 rounded-lg border bg-card text-sm" />
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Stock inicial</label>
          <input type="number" value={form.stock} onChange={e => setForm(p => ({ ...p, stock: +e.target.value }))} className="w-full px-3 py-2 rounded-lg border bg-card text-sm" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Stock mínimo</label>
          <input type="number" value={form.minStock} onChange={e => setForm(p => ({ ...p, minStock: +e.target.value }))} className="w-full px-3 py-2 rounded-lg border bg-card text-sm" />
        </div>
      </div>
    </div>
  );

  if (isLoading) return <div className="py-12 text-center text-muted-foreground">Cargando refacciones...</div>;

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Refacciones</h1>
          <p className="page-subtitle">{spareParts.filter(s => s.active !== false).length} refacciones en catálogo</p>
        </div>
        <button onClick={() => { resetForm(); setShowCreate(true); }} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
          <Plus size={16} /> Nueva refacción
        </button>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar refacción o equipo..." className="w-full pl-9 pr-3 py-2 rounded-lg border bg-card text-sm outline-none focus:ring-2 focus:ring-primary/20" />
        </div>
      </div>

      <div className="bg-card rounded-xl border overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr><th>SKU</th><th>Refacción</th><th>Equipo relacionado</th>{!isVendedor && <th>Costo</th>}<th>Precio</th><th>Stock</th><th>Mín</th><th>Estado</th><th></th></tr>
          </thead>
          <tbody>
            {filtered.map(sp => {
              const allImages = (sp.images && sp.images.length > 0) ? sp.images : (sp.image ? [sp.image] : []);
              const mainImage = allImages[0];
              return (
                <tr key={sp.id}>
                  <td className="font-mono text-xs">{sp.sku}</td>
                  <td>
                    <div className="flex items-center gap-3">
                      {mainImage && (
                        <div className="w-10 h-10 rounded-md overflow-hidden border shrink-0 cursor-pointer" onClick={() => { if (allImages.length > 1) openLightbox(allImages, 0); else setViewingSparePart(sp); }}>
                          <img src={mainImage} alt={sp.name} className="w-full h-full object-cover" />
                          {allImages.length > 1 && (
                            <span className="absolute bottom-0 right-0 text-[8px] font-semibold px-1 bg-black/60 text-white rounded-tl">
                              📷 {allImages.length}
                            </span>
                          )}
                        </div>
                      )}
                      <span className="font-medium text-primary hover:underline cursor-pointer" onClick={() => setViewingSparePart(sp)}>{sp.name}</span>
                    </div>
                  </td>
                  <td className="text-muted-foreground text-sm">{sp.productName}</td>
                  {!isVendedor && <td>{fmt(sp.cost)}</td>}
                  <td className="font-semibold">{fmt(sp.price)}</td>
                  <td className={sp.stock <= sp.minStock ? 'text-destructive font-bold' : 'font-semibold'}>
                    {sp.stock}
                    {sp.stock <= sp.minStock && <AlertTriangle size={12} className="inline ml-1 text-destructive" />}
                  </td>
                  <td className="text-muted-foreground">{sp.minStock}</td>
                  <td>{sp.active ? <span className="status-badge-success">Activa</span> : <span className="status-badge-neutral">Inactiva</span>}</td>
                  <td>
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(sp)} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => setDeleteTarget(sp.id)} className="p-1.5 rounded-md text-destructive hover:bg-destructive/10">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={showCreate} onOpenChange={(open) => { setShowCreate(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nueva Refacción</DialogTitle>
            <DialogDescription>Registra una nueva refacción en el catálogo.</DialogDescription>
          </DialogHeader>
          {formFields}
          <DialogFooter>
            <button onClick={() => { setShowCreate(false); resetForm(); }} className="px-4 py-2 rounded-lg border text-sm font-medium">Cancelar</button>
            <button onClick={handleCreate} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">Crear Refacción</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEdit} onOpenChange={(open) => { setShowEdit(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Refacción</DialogTitle>
            <DialogDescription>Modifica la información de la refacción.</DialogDescription>
          </DialogHeader>
          {formFields}
          <DialogFooter>
            <button onClick={() => { setShowEdit(false); resetForm(); }} className="px-4 py-2 rounded-lg border text-sm font-medium">Cancelar</button>
            <button onClick={handleEdit} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">Guardar Cambios</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar refacción?</DialogTitle>
            <DialogDescription>Estás a punto de eliminar <strong>{spareToDelete?.name}</strong>.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 rounded-lg border text-sm font-medium">Cancelar</button>
            <button
              onClick={() => {
                requestAuthorization('delete_spare_part', 'refacciones', () => {
                  if (deleteTarget) updateMutation.mutate({ id: deleteTarget, active: false });
                  setDeleteTarget(null);
                }, { entityId: deleteTarget!, entityLabel: spareToDelete?.name, onCancelled: () => setDeleteTarget(null) });
              }}
              className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium">Inactivar</button>
            <button
              onClick={() => {
                requestAuthorization('delete_spare_part', 'refacciones', () => {
                  if (deleteTarget) deleteMutation.mutate(deleteTarget);
                  setDeleteTarget(null);
                }, { entityId: deleteTarget!, entityLabel: spareToDelete?.name, onCancelled: () => setDeleteTarget(null) });
              }}
              className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium">Eliminar definitivamente</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===================== VIEW SPARE PART DIALOG (READ-ONLY) ===================== */}
      <Dialog open={!!viewingSparePart} onOpenChange={() => setViewingSparePart(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewingSparePart?.name}</DialogTitle>
            <DialogDescription>Información de la refacción</DialogDescription>
          </DialogHeader>
          {viewingSparePart && (() => {
            const allImages = (viewingSparePart.images && viewingSparePart.images.length > 0)
              ? viewingSparePart.images
              : (viewingSparePart.image ? [viewingSparePart.image] : []);
            return (
              <div className="space-y-4">
                {allImages.length > 0 && (
                  <div>
                    <div className="aspect-[16/10] bg-muted rounded-lg overflow-hidden cursor-pointer" onClick={() => openLightbox(allImages, 0)}>
                      <img src={allImages[0]} alt={viewingSparePart.name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }} />
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
                )}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-xs text-muted-foreground block">SKU</span><span className="font-mono font-medium">{viewingSparePart.sku}</span></div>
                  <div><span className="text-xs text-muted-foreground block">Equipo relacionado</span><span className="font-medium">{viewingSparePart.productName || '—'}</span></div>
                  {!isVendedor && (
                    <div><span className="text-xs text-muted-foreground block">Costo</span><span className="font-medium">{fmt(viewingSparePart.cost)}</span></div>
                  )}
                  <div><span className="text-xs text-muted-foreground block">Precio</span><span className="font-bold">{fmt(viewingSparePart.price)}</span></div>
                  <div><span className="text-xs text-muted-foreground block">Stock</span><span className={`font-bold ${viewingSparePart.stock <= viewingSparePart.minStock ? 'text-destructive' : ''}`}>{viewingSparePart.stock}</span></div>
                  <div><span className="text-xs text-muted-foreground block">Stock mínimo</span><span className="font-medium">{viewingSparePart.minStock}</span></div>
                  <div><span className="text-xs text-muted-foreground block">Estado</span>{viewingSparePart.active ? <span className="status-badge-success">Activa</span> : <span className="status-badge-neutral">Inactiva</span>}</div>
                </div>
              </div>
            );
          })()}
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
    </div>
  );
}
