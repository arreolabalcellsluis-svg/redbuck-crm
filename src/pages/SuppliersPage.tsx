import { useAppContext } from '@/contexts/AppContext';
import { Building2, Plus, Search, Edit2 } from 'lucide-react';
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Supplier } from '@/types';
import { toast } from 'sonner';
import { useSuppliers, useAddSupplier, useUpdateSupplier } from '@/hooks/useSuppliers';

export default function SuppliersPage() {
  const { currentRole } = useAppContext();
  const canEdit = currentRole === 'director' || currentRole === 'compras';

  const { data: suppliers = [], isLoading } = useSuppliers();
  const addMutation = useAddSupplier();
  const updateMutation = useUpdateSupplier();

  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', country: 'México', contact: '', phone: '', email: '', currency: 'MXN' as 'MXN' | 'USD' | 'CNY', type: 'nacional' as Supplier['type'], website: '', bancoDestino: '', cuentaDestino: '', clabeDestino: '', divisaBanco: 'USD', direccionBanco: '', swiftCode: '', nombreBeneficiario: '', direccionBeneficiario: '', telefonoBeneficiario: '' });

  const filtered = suppliers.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));

  const openEdit = (s: Supplier) => {
    setEditId(s.id);
    setForm({ name: s.name, country: s.country, contact: s.contact, phone: s.phone, email: s.email, currency: s.currency, type: s.type, website: s.website ?? '', bancoDestino: s.bancoDestino ?? '', cuentaDestino: s.cuentaDestino ?? '', clabeDestino: s.clabeDestino ?? '', divisaBanco: s.divisaBanco ?? 'USD', direccionBanco: s.direccionBanco ?? '', swiftCode: s.swiftCode ?? '', nombreBeneficiario: s.nombreBeneficiario ?? '', direccionBeneficiario: s.direccionBeneficiario ?? '', telefonoBeneficiario: s.telefonoBeneficiario ?? '' });
    setOpen(true);
  };

  const resetForm = () => {
    setEditId(null);
    setForm({ name: '', country: 'México', contact: '', phone: '', email: '', currency: 'MXN', type: 'nacional', website: '', bancoDestino: '', cuentaDestino: '', clabeDestino: '', divisaBanco: 'USD' });
  };

  const handleSave = () => {
    if (!form.name || !form.contact) {
      toast.error('Nombre y contacto son requeridos');
      return;
    }
    if (editId) {
      updateMutation.mutate({ id: editId, ...form });
    } else {
      addMutation.mutate(form);
    }
    setOpen(false);
    resetForm();
  };

  if (isLoading) return <div className="py-12 text-center text-muted-foreground">Cargando proveedores...</div>;

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Proveedores</h1>
          <p className="page-subtitle">{suppliers.length} proveedores registrados</p>
        </div>
        {canEdit && (
          <button onClick={() => { resetForm(); setOpen(true); }} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
            <Plus size={16} /> Nuevo proveedor
          </button>
        )}
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar proveedor..." className="w-full pl-9 pr-3 py-2 rounded-lg border bg-card text-sm outline-none focus:ring-2 focus:ring-primary/20" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(s => (
          <div key={s.id} className="bg-card rounded-xl border p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                  <Building2 size={20} className="text-muted-foreground" />
                </div>
                <div>
                  <h3 className="font-display font-semibold text-sm">{s.name}</h3>
                  <p className="text-xs text-muted-foreground">{s.country} · {s.currency}</p>
                </div>
              </div>
              {canEdit && (
                <button onClick={() => openEdit(s)} className="p-1.5 rounded-md hover:bg-muted" title="Editar proveedor">
                  <Edit2 size={14} />
                </button>
              )}
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Contacto:</span><span>{s.contact}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Teléfono:</span><span>{s.phone}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Email:</span><span className="text-xs">{s.email}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Tipo:</span><span className="capitalize">{s.type}</span></div>
              {s.website && <div className="flex justify-between"><span className="text-muted-foreground">Web:</span><a href={s.website.startsWith('http') ? s.website : `https://${s.website}`} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline truncate max-w-[160px]">{s.website}</a></div>}
              {s.bancoDestino && <div className="flex justify-between"><span className="text-muted-foreground">Banco:</span><span className="text-xs">{s.bancoDestino}</span></div>}
              {s.cuentaDestino && <div className="flex justify-between"><span className="text-muted-foreground">Cuenta:</span><span className="text-xs">{s.cuentaDestino}</span></div>}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={() => { setOpen(false); resetForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editId ? 'Editar Proveedor' : 'Nuevo Proveedor'}</DialogTitle>
            <DialogDescription>{editId ? 'Modifica la información del proveedor' : 'Registra un nuevo proveedor'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Nombre *</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">País</label>
                <input value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Tipo</label>
                <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as Supplier['type'] })} className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm">
                  <option value="nacional">Nacional</option>
                  <option value="internacional">Internacional</option>
                  <option value="refacciones">Refacciones</option>
                  <option value="logistica">Logística</option>
                  <option value="aduana">Aduana</option>
                  <option value="servicio">Servicio</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Contacto *</label>
              <input value={form.contact} onChange={e => setForm({ ...form, contact: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Teléfono</label>
                <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Moneda</label>
                <select value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value as 'MXN' | 'USD' | 'CNY' })} className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm">
                  <option value="MXN">MXN</option><option value="USD">USD</option><option value="CNY">CNY</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Email</label>
              <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Página de internet</label>
              <input value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} placeholder="https://ejemplo.com" className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm" />
            </div>

            <div className="border-t pt-3 mt-1">
              <p className="text-xs font-semibold text-muted-foreground mb-2">Datos bancarios del proveedor</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Banco destino</label>
                <input value={form.bancoDestino} onChange={e => setForm({ ...form, bancoDestino: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Divisa bancaria</label>
                <select value={form.divisaBanco} onChange={e => setForm({ ...form, divisaBanco: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm">
                  <option value="MXN">MXN</option><option value="USD">USD</option><option value="CNY">CNY</option><option value="EUR">EUR</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Cuenta destino</label>
              <input value={form.cuentaDestino} onChange={e => setForm({ ...form, cuentaDestino: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">CLABE interbancaria</label>
              <input value={form.clabeDestino} onChange={e => setForm({ ...form, clabeDestino: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm" />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => { setOpen(false); resetForm(); }} className="px-4 py-2 rounded-lg border text-sm hover:bg-muted">Cancelar</button>
              <button onClick={handleSave} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
                {editId ? 'Guardar cambios' : 'Crear proveedor'}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
