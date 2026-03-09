import { useState, useMemo } from 'react';
import { demoOpportunities, demoUsers } from '@/data/demo-data';
import { CUSTOMER_TYPE_LABELS, PIPELINE_LABELS, CustomerType, LeadSource, Customer } from '@/types';
import { useAppContext } from '@/contexts/AppContext';
import { DEMO_VENDEDOR_ID } from '@/lib/rolePermissions';
import { exportCRMToExcel } from '@/lib/exportUtils';
import { SAT_TAX_REGIMES, SAT_CFDI_USES } from '@/lib/satCatalogs';
import StatusBadge from '@/components/shared/StatusBadge';
import MetricCard from '@/components/shared/MetricCard';
import { Users, UserPlus, Target, TrendingUp, Search, Plus, FileDown, Pencil, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { useCustomers, useAddCustomer, useUpdateCustomer, useDeleteCustomer, type DBCustomer } from '@/hooks/useCustomers';

const fmt = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);

type Tab = 'clientes' | 'pipeline';

type FiscalData = {
  taxRegime: string;
  fiscalZipCode: string;
  cfdiUse: string;
  legalName: string;
  invoiceEmail: string;
};

const emptyFiscal = (): FiscalData => ({ taxRegime: '', fiscalZipCode: '', cfdiUse: 'G03', legalName: '', invoiceEmail: '' });

const emptyCustomer = (): Omit<Customer, 'id' | 'createdAt'> => ({
  name: '', contactName: '', type: 'taller_mecanico', phone: '', city: '', state: '', vendorId: '', source: 'llamada', priority: 'media',
});

// Map DB row to local Customer type
function dbToCustomer(db: DBCustomer): Customer {
  return {
    id: db.id,
    name: db.name,
    contactName: db.contact_name || undefined,
    tradeName: db.trade_name || undefined,
    rfc: db.rfc || undefined,
    type: db.type as CustomerType,
    phone: db.phone,
    whatsapp: db.whatsapp || undefined,
    email: db.email || undefined,
    city: db.city,
    state: db.state,
    vendorId: db.vendor_id || '',
    source: db.source as LeadSource,
    priority: db.priority,
    createdAt: db.created_at.split('T')[0],
  };
}

export default function CRMPage() {
  const { currentRole } = useAppContext();
  const [tab, setTab] = useState<Tab>('clientes');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [form, setForm] = useState(emptyCustomer());

  // DB hooks
  const { data: dbCustomers, isLoading } = useCustomers();
  const addCustomerMut = useAddCustomer();
  const updateCustomerMut = useUpdateCustomer();
  const deleteCustomerMut = useDeleteCustomer();

  const customers = useMemo(() => (dbCustomers ?? []).map(dbToCustomer), [dbCustomers]);

  const canExport = true;
  const isVendedor = currentRole === 'vendedor';
  const vendorId = DEMO_VENDEDOR_ID;

  const [fiscal, setFiscal] = useState<FiscalData>(emptyFiscal());
  const [showFiscal, setShowFiscal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDeleteCustomer = () => {
    if (!editingCustomer) return;
    deleteCustomerMut.mutate(editingCustomer.id, {
      onSuccess: () => {
        toast.success(`Cliente "${editingCustomer.name}" eliminado permanentemente`);
        setShowDeleteConfirm(false);
        setEditingCustomer(null);
        setForm(emptyCustomer());
        setFiscal(emptyFiscal());
        setShowFiscal(false);
      },
    });
  };

  const allCustomers = isVendedor
    ? customers.filter(c => c.vendorId === vendorId)
    : customers;

  const allOpportunities = isVendedor
    ? demoOpportunities.filter(o => o.vendorId === vendorId)
    : demoOpportunities;

  const filteredCustomers = allCustomers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) || c.city.toLowerCase().includes(search.toLowerCase())
  );

  const resolveVendor = (vendorId: string) => {
    const u = demoUsers.find(usr => usr.id === vendorId);
    return u ? u.name : vendorId;
  };

  const vendors = demoUsers.filter(u => u.role === 'vendedor');
  const pipelineStages = ['prospecto_nuevo', 'contactado', 'calificado', 'diagnostico', 'cotizacion_enviada', 'seguimiento', 'negociacion'] as const;

  const handleExport = () => {
    exportCRMToExcel(filteredCustomers, demoUsers);
    toast.success(`${filteredCustomers.length} registros exportados a Excel`);
  };

  const handleCreate = () => {
    if (!form.name.trim()) { toast.error('El nombre es obligatorio'); return; }
    if (!form.phone.trim()) { toast.error('El teléfono es obligatorio'); return; }
    if (!form.vendorId) { toast.error('Selecciona un vendedor'); return; }

    addCustomerMut.mutate({
      name: form.name,
      contact_name: form.contactName || null,
      trade_name: form.tradeName || null,
      rfc: form.rfc || null,
      type: form.type,
      phone: form.phone,
      whatsapp: form.whatsapp || null,
      email: form.email || null,
      city: form.city,
      state: form.state,
      vendor_id: form.vendorId || null,
      source: form.source,
      priority: form.priority,
    }, {
      onSuccess: () => {
        toast.success(`Cliente "${form.name}" registrado correctamente`);
        setShowCreate(false);
        setForm(emptyCustomer());
      },
    });
  };

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    const { id, createdAt, ...rest } = customer;
    setForm(rest);
  };

  const handleUpdate = () => {
    if (!editingCustomer) return;
    if (!form.name.trim()) { toast.error('El nombre es obligatorio'); return; }
    if (!form.phone.trim()) { toast.error('El teléfono es obligatorio'); return; }
    if (!form.vendorId) { toast.error('Selecciona un vendedor'); return; }

    updateCustomerMut.mutate({
      id: editingCustomer.id,
      name: form.name,
      trade_name: form.tradeName || null,
      rfc: form.rfc || null,
      type: form.type,
      phone: form.phone,
      whatsapp: form.whatsapp || null,
      email: form.email || null,
      city: form.city,
      state: form.state,
      vendor_id: form.vendorId || null,
      source: form.source,
      priority: form.priority,
    }, {
      onSuccess: () => {
        toast.success(`Cliente "${form.name}" actualizado correctamente`);
        setEditingCustomer(null);
        setForm(emptyCustomer());
      },
    });
  };

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">CRM</h1>
          <p className="page-subtitle">Gestión de clientes, prospectos y oportunidades {isVendedor && '(mis clientes)'}</p>
        </div>
        <div className="flex items-center gap-2">
          {canExport && (
            <button onClick={handleExport} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium hover:bg-muted transition-colors">
              <FileDown size={16} /> Exportar Excel ({filteredCustomers.length})
            </button>
          )}
          <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
            <Plus size={16} /> Nuevo cliente
          </button>
        </div>
      </div>

      {(() => {
        const pipelineTotal = allOpportunities.reduce((s, o) => s + o.estimatedAmount, 0);
        const cierreGanado = allOpportunities.filter(o => o.stage === 'cierre_ganado').reduce((s, o) => s + o.estimatedAmount, 0);
        const activeOps = allOpportunities.filter(o => !['cierre_ganado', 'cierre_perdido'].includes(o.stage));
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-card rounded-xl border p-4 group" style={{ borderLeft: '4px solid hsl(var(--primary))' }}>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <Users size={14} /> {isVendedor ? 'Mis clientes' : 'Clientes'}
              </div>
              <div className="text-xl font-bold">{isLoading ? '...' : allCustomers.length}</div>
              <div className="space-y-0.5 mt-2 text-[10px]">
                <div className="flex justify-between"><span className="text-muted-foreground">Alta prioridad:</span> <span className="font-semibold">{allCustomers.filter(c => c.priority === 'alta').length}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Nuevos este mes:</span> <span className="font-semibold">{allCustomers.filter(c => c.createdAt >= new Date().toISOString().slice(0, 7)).length}</span></div>
              </div>
            </div>

            <div className="bg-card rounded-xl border p-4 group" style={{ borderLeft: '4px solid hsl(var(--warning))' }}>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <Target size={14} /> {isVendedor ? 'Mis oportunidades' : 'Oportunidades'}
              </div>
              <div className="text-xl font-bold">{allOpportunities.length}</div>
              <div className="space-y-0.5 mt-2 text-[10px]">
                <div className="flex justify-between"><span className="text-muted-foreground">Activas:</span> <span className="font-semibold">{activeOps.length}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Ganadas:</span> <span className="font-semibold text-success">{allOpportunities.filter(o => o.stage === 'cierre_ganado').length}</span></div>
              </div>
            </div>

            <div className="bg-card rounded-xl border p-4 group" style={{ borderLeft: '4px solid hsl(var(--info))' }}>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <TrendingUp size={14} /> Pipeline activo
              </div>
              <div className="text-xl font-bold">{fmt(pipelineTotal)}</div>
              <div className="space-y-0.5 mt-2 text-[10px]">
                <div className="flex justify-between"><span className="text-muted-foreground">Promedio/op:</span> <span className="font-medium">{fmt(activeOps.length > 0 ? Math.round(activeOps.reduce((s, o) => s + o.estimatedAmount, 0) / activeOps.length) : 0)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">En negociación:</span> <span className="font-semibold">{allOpportunities.filter(o => o.stage === 'negociacion').length}</span></div>
              </div>
            </div>

            <div className="bg-card rounded-xl border p-4 group" style={{ borderLeft: '4px solid hsl(var(--success))' }}>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <UserPlus size={14} /> Cierre ganado
              </div>
              <div className="text-xl font-bold text-success">{fmt(cierreGanado)}</div>
              {pipelineTotal > 0 && (
                <div className="flex items-center justify-between mt-2">
                  <div className="w-full bg-muted rounded-full h-2">
                    <div className="h-2 rounded-full bg-success transition-all" style={{ width: `${Math.min(Math.round((cierreGanado / pipelineTotal) * 100), 100)}%` }} />
                  </div>
                  <span className="text-xs font-bold ml-2 whitespace-nowrap">{Math.round((cierreGanado / pipelineTotal) * 100)}%</span>
                </div>
              )}
              <div className="text-[10px] text-muted-foreground mt-1">del pipeline total</div>
            </div>
          </div>
        );
      })()}

      <div className="flex items-center gap-1 mb-4 border-b">
        {(['clientes', 'pipeline'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors capitalize ${tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            {t === 'clientes' ? 'Clientes' : 'Pipeline'}
          </button>
        ))}
      </div>

      {tab === 'clientes' && (
        <>
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar cliente..." className="w-full pl-9 pr-3 py-2 rounded-lg border bg-card text-sm outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
          </div>
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Cargando clientes...</div>
          ) : (
          <div className="bg-card rounded-xl border overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr><th>Cliente</th><th>Tipo</th><th>Ciudad</th><th>Vendedor</th><th>Prioridad</th><th>Desde</th><th className="w-10"></th></tr>
              </thead>
              <tbody>
                {filteredCustomers.map(c => (
                  <tr key={c.id} className="cursor-pointer">
                    <td className="font-medium">{c.name}</td>
                    <td><span className="text-xs">{CUSTOMER_TYPE_LABELS[c.type]}</span></td>
                    <td className="text-muted-foreground">{c.city}, {c.state}</td>
                    <td className="text-muted-foreground">{resolveVendor(c.vendorId)}</td>
                    <td><StatusBadge status={c.priority} type="priority" /></td>
                    <td className="text-muted-foreground text-xs">{c.createdAt}</td>
                    <td>
                      <button onClick={() => handleEdit(c)} className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground" title="Editar cliente">
                        <Pencil size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </>
      )}

      {tab === 'pipeline' && (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {pipelineStages.map(stage => {
            const opps = allOpportunities.filter(o => o.stage === stage);
            const total = opps.reduce((s, o) => s + o.estimatedAmount, 0);
            return (
              <div key={stage} className="min-w-[260px] flex-shrink-0">
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{PIPELINE_LABELS[stage]}</span>
                  <span className="text-xs font-medium">{opps.length}</span>
                </div>
                {total > 0 && <div className="text-xs text-muted-foreground mb-2 px-1">{fmt(total)}</div>}
                <div className="space-y-2">
                  {opps.map(o => (
                    <div key={o.id} className="p-3 rounded-lg bg-card border hover:shadow-md transition-shadow cursor-pointer">
                      <div className="font-medium text-sm">{o.customerName}</div>
                      <div className="text-xs text-muted-foreground mt-1">{o.vendorName}</div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-sm font-semibold">{fmt(o.estimatedAmount)}</span>
                        <span className="text-xs text-muted-foreground">{o.probability}%</span>
                      </div>
                      {o.nextActivity && <div className="text-xs text-primary mt-1.5">→ {o.nextActivity}</div>}
                    </div>
                  ))}
                  {opps.length === 0 && <div className="p-4 text-center text-xs text-muted-foreground border border-dashed rounded-lg">Sin oportunidades</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ===================== CREATE CLIENT DIALOG ===================== */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nuevo Cliente / Prospecto</DialogTitle>
            <DialogDescription>Registra los datos del cliente o prospecto. Los campos con * son obligatorios.</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Nombre / Razón social *</label>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="w-full px-3 py-2 rounded-lg border bg-card text-sm" placeholder="Ej: Taller Automotriz Los Reyes" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Teléfono *</label>
              <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} className="w-full px-3 py-2 rounded-lg border bg-card text-sm" placeholder="811-234-5678" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">WhatsApp</label>
              <input value={form.whatsapp || ''} onChange={e => setForm(p => ({ ...p, whatsapp: e.target.value }))} className="w-full px-3 py-2 rounded-lg border bg-card text-sm" placeholder="5218112345678" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Correo</label>
              <input value={form.email || ''} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} className="w-full px-3 py-2 rounded-lg border bg-card text-sm" placeholder="correo@empresa.com" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">RFC</label>
              <input value={form.rfc || ''} onChange={e => setForm(p => ({ ...p, rfc: e.target.value }))} className="w-full px-3 py-2 rounded-lg border bg-card text-sm" placeholder="XAXX010101000" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Tipo de cliente</label>
              <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value as CustomerType }))} className="w-full px-3 py-2 rounded-lg border bg-card text-sm">
                {Object.entries(CUSTOMER_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Origen</label>
              <select value={form.source} onChange={e => setForm(p => ({ ...p, source: e.target.value as LeadSource }))} className="w-full px-3 py-2 rounded-lg border bg-card text-sm">
                <option value="facebook">Facebook</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="llamada">Llamada</option>
                <option value="recomendacion">Recomendación</option>
                <option value="sitio_web">Sitio web</option>
                <option value="visita_sucursal">Visita sucursal</option>
                <option value="expos">Expos</option>
                <option value="campaña">Campaña</option>
                <option value="organico">Orgánico</option>
                <option value="otro">Otro</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Ciudad</label>
              <input value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} className="w-full px-3 py-2 rounded-lg border bg-card text-sm" placeholder="Monterrey" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Estado</label>
              <input value={form.state} onChange={e => setForm(p => ({ ...p, state: e.target.value }))} className="w-full px-3 py-2 rounded-lg border bg-card text-sm" placeholder="Nuevo León" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Vendedor asignado *</label>
              <select value={form.vendorId} onChange={e => setForm(p => ({ ...p, vendorId: e.target.value }))} className="w-full px-3 py-2 rounded-lg border bg-card text-sm">
                <option value="">Seleccionar vendedor...</option>
                {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Prioridad</label>
              <select value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value as 'alta' | 'media' | 'baja' }))} className="w-full px-3 py-2 rounded-lg border bg-card text-sm">
                <option value="alta">Alta</option>
                <option value="media">Media</option>
                <option value="baja">Baja</option>
              </select>
            </div>
          </div>

          {/* Datos de facturación (colapsable) */}
          <div className="border rounded-lg overflow-hidden">
            <button type="button" onClick={() => setShowFiscal(v => !v)} className="w-full flex items-center justify-between px-4 py-3 bg-muted/50 hover:bg-muted transition-colors text-sm font-medium">
              <span>📄 Datos de facturación (opcional)</span>
              {showFiscal ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {showFiscal && (
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Razón social (receptor)</label>
                  <input value={fiscal.legalName} onChange={e => setFiscal(p => ({ ...p, legalName: e.target.value }))} className="w-full px-3 py-2 rounded-lg border bg-card text-sm" placeholder="Empresa S.A. de C.V." />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Régimen fiscal receptor</label>
                  <select value={fiscal.taxRegime} onChange={e => setFiscal(p => ({ ...p, taxRegime: e.target.value }))} className="w-full px-3 py-2 rounded-lg border bg-card text-sm">
                    <option value="">Seleccionar régimen fiscal...</option>
                    {SAT_TAX_REGIMES.map(r => <option key={r.code} value={r.code}>{r.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Domicilio fiscal (C.P.)</label>
                  <input value={fiscal.fiscalZipCode} onChange={e => setFiscal(p => ({ ...p, fiscalZipCode: e.target.value.replace(/\D/g, '').slice(0, 5) }))} className="w-full px-3 py-2 rounded-lg border bg-card text-sm" placeholder="64000" maxLength={5} />
                  <p className="text-[10px] text-muted-foreground mt-0.5">Código postal del domicilio fiscal</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Correo para factura</label>
                  <input value={fiscal.invoiceEmail} onChange={e => setFiscal(p => ({ ...p, invoiceEmail: e.target.value }))} className="w-full px-3 py-2 rounded-lg border bg-card text-sm" placeholder="facturacion@empresa.com" />
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <button onClick={() => { setShowCreate(false); setForm(emptyCustomer()); setFiscal(emptyFiscal()); setShowFiscal(false); }} className="px-4 py-2 rounded-lg border text-sm font-medium">Cancelar</button>
            <button onClick={handleCreate} disabled={addCustomerMut.isPending} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">
              {addCustomerMut.isPending ? 'Guardando...' : 'Registrar Cliente'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===================== EDIT CLIENT DIALOG ===================== */}
      <Dialog open={!!editingCustomer} onOpenChange={(open) => { if (!open) { setEditingCustomer(null); setForm(emptyCustomer()); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Cliente</DialogTitle>
            <DialogDescription>Modifica los datos del cliente. Los campos con * son obligatorios.</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Nombre / Razón social *</label>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="w-full px-3 py-2 rounded-lg border bg-card text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Teléfono *</label>
              <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} className="w-full px-3 py-2 rounded-lg border bg-card text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">WhatsApp</label>
              <input value={form.whatsapp || ''} onChange={e => setForm(p => ({ ...p, whatsapp: e.target.value }))} className="w-full px-3 py-2 rounded-lg border bg-card text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Correo</label>
              <input value={form.email || ''} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} className="w-full px-3 py-2 rounded-lg border bg-card text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">RFC</label>
              <input value={form.rfc || ''} onChange={e => setForm(p => ({ ...p, rfc: e.target.value }))} className="w-full px-3 py-2 rounded-lg border bg-card text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Tipo de cliente</label>
              <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value as CustomerType }))} className="w-full px-3 py-2 rounded-lg border bg-card text-sm">
                {Object.entries(CUSTOMER_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Origen</label>
              <select value={form.source} onChange={e => setForm(p => ({ ...p, source: e.target.value as LeadSource }))} className="w-full px-3 py-2 rounded-lg border bg-card text-sm">
                <option value="facebook">Facebook</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="llamada">Llamada</option>
                <option value="recomendacion">Recomendación</option>
                <option value="sitio_web">Sitio web</option>
                <option value="visita_sucursal">Visita sucursal</option>
                <option value="expos">Expos</option>
                <option value="campaña">Campaña</option>
                <option value="organico">Orgánico</option>
                <option value="otro">Otro</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Ciudad</label>
              <input value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} className="w-full px-3 py-2 rounded-lg border bg-card text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Estado</label>
              <input value={form.state} onChange={e => setForm(p => ({ ...p, state: e.target.value }))} className="w-full px-3 py-2 rounded-lg border bg-card text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Vendedor asignado *</label>
              <select value={form.vendorId} onChange={e => setForm(p => ({ ...p, vendorId: e.target.value }))} className="w-full px-3 py-2 rounded-lg border bg-card text-sm">
                <option value="">Seleccionar vendedor...</option>
                {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Prioridad</label>
              <select value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value as 'alta' | 'media' | 'baja' }))} className="w-full px-3 py-2 rounded-lg border bg-card text-sm">
                <option value="alta">Alta</option>
                <option value="media">Media</option>
                <option value="baja">Baja</option>
              </select>
            </div>
          </div>

          {/* Datos de facturación (colapsable) */}
          <div className="border rounded-lg overflow-hidden">
            <button type="button" onClick={() => setShowFiscal(v => !v)} className="w-full flex items-center justify-between px-4 py-3 bg-muted/50 hover:bg-muted transition-colors text-sm font-medium">
              <span>📄 Datos de facturación (opcional)</span>
              {showFiscal ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {showFiscal && (
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Razón social (receptor)</label>
                  <input value={fiscal.legalName} onChange={e => setFiscal(p => ({ ...p, legalName: e.target.value }))} className="w-full px-3 py-2 rounded-lg border bg-card text-sm" placeholder="Empresa S.A. de C.V." />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Régimen fiscal receptor</label>
                  <select value={fiscal.taxRegime} onChange={e => setFiscal(p => ({ ...p, taxRegime: e.target.value }))} className="w-full px-3 py-2 rounded-lg border bg-card text-sm">
                    <option value="">Seleccionar régimen fiscal...</option>
                    {SAT_TAX_REGIMES.map(r => <option key={r.code} value={r.code}>{r.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Domicilio fiscal (C.P.)</label>
                  <input value={fiscal.fiscalZipCode} onChange={e => setFiscal(p => ({ ...p, fiscalZipCode: e.target.value.replace(/\D/g, '').slice(0, 5) }))} className="w-full px-3 py-2 rounded-lg border bg-card text-sm" placeholder="64000" maxLength={5} />
                  <p className="text-[10px] text-muted-foreground mt-0.5">Código postal del domicilio fiscal</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Correo para factura</label>
                  <input value={fiscal.invoiceEmail} onChange={e => setFiscal(p => ({ ...p, invoiceEmail: e.target.value }))} className="w-full px-3 py-2 rounded-lg border bg-card text-sm" placeholder="facturacion@empresa.com" />
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex !justify-between">
            <button onClick={() => setShowDeleteConfirm(true)} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:opacity-90 transition-opacity">
              <Trash2 size={14} /> Eliminar cliente
            </button>
            <div className="flex gap-2">
              <button onClick={() => { setEditingCustomer(null); setForm(emptyCustomer()); setFiscal(emptyFiscal()); setShowFiscal(false); }} className="px-4 py-2 rounded-lg border text-sm font-medium">Cancelar</button>
              <button onClick={handleUpdate} disabled={updateCustomerMut.isPending} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">
                {updateCustomerMut.isPending ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===================== DELETE CONFIRM DIALOG ===================== */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar cliente permanentemente?</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que quieres borrar permanentemente a <strong>{editingCustomer?.name}</strong>? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCustomer} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleteCustomerMut.isPending ? 'Eliminando...' : 'Sí, eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
