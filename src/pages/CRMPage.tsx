import { useState, useMemo, useCallback } from 'react';
import { CUSTOMER_TYPE_LABELS, PIPELINE_LABELS, CustomerType, LeadSource, Customer } from '@/types';
import { useAppContext } from '@/contexts/AppContext';
import { exportCRMToExcel } from '@/lib/exportUtils';
import { SAT_TAX_REGIMES, SAT_CFDI_USES } from '@/lib/satCatalogs';
import { findDuplicates, scanGlobalDuplicates, type DuplicateMatch, type DuplicateGroup } from '@/lib/duplicateDetectionEngine';
import StatusBadge from '@/components/shared/StatusBadge';
import MetricCard from '@/components/shared/MetricCard';
import { Users, UserPlus, Target, TrendingUp, Search, Plus, FileDown, Pencil, ChevronDown, ChevronUp, Trash2, Zap, CheckCircle2, Clock, AlertTriangle, X, Eye, Merge, Copy, FileText, Package, CreditCard, CalendarDays, ArrowRight, Phone, Mail, MapPin, History, ShoppingCart, ExternalLink } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useCustomers, useAddCustomer, useUpdateCustomer, useDeleteCustomer, type DBCustomer } from '@/hooks/useCustomers';
import { useAllCustomerFiscalData, useSaveCustomerFiscalData } from '@/hooks/useInvoicing';
import { useQuotations } from '@/hooks/useQuotations';
import { useOrders } from '@/hooks/useOrders';
import { useTeamMembers } from '@/hooks/useTeamMembers';
import { useActivities, useAddActivity } from '@/hooks/useActivities';
import { useOnboardingConfig } from '@/hooks/useOnboardingConfig';
import { useOrderPayments } from '@/hooks/useOrderPayments';
import { useAllCommercialDocuments } from '@/hooks/useCommercialDocuments';
import { generateOnboardingActivities, buildWhatsAppLink } from '@/lib/onboardingEngine';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

const fmt = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);

type Tab = 'clientes' | 'pipeline' | 'onboarding' | 'duplicados';

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
  const navigate = useNavigate();
  const { currentRole } = useAppContext();
  const [tab, setTab] = useState<Tab>('clientes');
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [filterVendor, setFilterVendor] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [viewingCustomer, setViewingCustomer] = useState<Customer | null>(null);
  const [form, setForm] = useState(emptyCustomer());

  // DB hooks
  const { data: dbCustomers, isLoading } = useCustomers();
  const addCustomerMut = useAddCustomer();
  const updateCustomerMut = useUpdateCustomer();
  const deleteCustomerMut = useDeleteCustomer();
  const { data: dbQuotations = [] } = useQuotations();
  const { data: dbOrders = [] } = useOrders();
  const { data: dbTeam = [] } = useTeamMembers();
  const { data: dbActivities = [] } = useActivities();
  const addActivityMut = useAddActivity();
  const { config: onboardingConfig, saveConfig: saveOnboardingConfig } = useOnboardingConfig();
  const { data: allFiscalData = [] } = useAllCustomerFiscalData();
  const saveFiscalMut = useSaveCustomerFiscalData();
  const { data: dbOrderPayments = [] } = useOrderPayments();
  const { data: dbCommDocs = [] } = useAllCommercialDocuments();

  const customers = useMemo(() => (dbCustomers ?? []).map(dbToCustomer), [dbCustomers]);

  const canExport = true;
  const isVendedor = currentRole === 'vendedor';

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

  const allCustomers = customers;

  // Multi-field duplicate detection
  const duplicateMatches = useMemo(() => {
    if (!form.phone && !form.email && !form.name) return [];
    return findDuplicates(
      { phone: form.phone, email: form.email, name: form.name, whatsapp: form.whatsapp },
      allCustomers,
      editingCustomer?.id,
    );
  }, [form.phone, form.email, form.name, form.whatsapp, allCustomers, editingCustomer]);

  const phoneDuplicate = duplicateMatches.length > 0 ? duplicateMatches[0].customer : null;

  // Global duplicate scanner
  const globalDuplicates = useMemo(() => scanGlobalDuplicates(allCustomers), [allCustomers]);

  // Merge state
  const [mergeDialog, setMergeDialog] = useState<{ primary: Customer; secondary: Customer } | null>(null);
  const [merging, setMerging] = useState(false);
  const queryClient = useQueryClient();

  const handleMerge = async () => {
    if (!mergeDialog) return;
    setMerging(true);
    const { primary, secondary } = mergeDialog;
    try {
      // Transfer orders
      await supabase.from('orders').update({ customer_id: primary.id, customer_name: primary.name } as any).eq('customer_id', secondary.id);
      // Transfer quotations
      await supabase.from('quotations').update({ customer_id: primary.id, customer_name: primary.name } as any).eq('customer_id', secondary.id);
      // Transfer activities
      await supabase.from('activities').update({ customer_id: primary.id, customer_name: primary.name } as any).eq('customer_id', secondary.id);
      // Transfer accounts receivable
      await supabase.from('accounts_receivable').update({ customer_id: primary.id, customer_name: primary.name } as any).eq('customer_id', secondary.id);
      // Transfer invoices
      await supabase.from('invoices').update({ customer_id: primary.id } as any).eq('customer_id', secondary.id);
      // Delete the duplicate
      await supabase.from('customers').delete().eq('id', secondary.id);
      // Invalidate caches
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      toast.success(`Clientes fusionados. "${secondary.name}" fue absorbido por "${primary.name}"`);
      setMergeDialog(null);
    } catch (e: any) {
      toast.error(`Error al fusionar: ${e.message}`);
    } finally {
      setMerging(false);
    }
  };

  const quotationToPipelineStage = (status: string): string => {
    switch (status) {
      case 'borrador': return 'cotizacion_enviada';
      case 'enviada': return 'cotizacion_enviada';
      case 'vista': return 'seguimiento';
      case 'seguimiento': return 'seguimiento';
      case 'aceptada': return 'negociacion';
      case 'rechazada': return 'cierre_perdido';
      case 'vencida': return 'cierre_perdido';
      default: return 'prospecto_nuevo';
    }
  };

  // Build pipeline opportunities from real quotations
  const allOpportunities = useMemo(() => {
    const customerMap = new Map(allCustomers.map(c => [c.id, c]));
    const teamMap = new Map(dbTeam.map(t => [t.id, t]));

    const quotationOpps = dbQuotations.map(q => ({
      id: q.id,
      customerId: q.customer_id || '',
      customerName: q.customer_name,
      vendorId: q.vendor_id || '',
      vendorName: q.vendor_name || (q.vendor_id ? (teamMap.get(q.vendor_id)?.name ?? q.vendor_id) : 'Sin asignar'),
      estimatedAmount: q.total,
      stage: quotationToPipelineStage(q.status),
      status: q.status,
      folio: q.folio,
    }));

    // Orders represent "cierre_ganado"
    const orderOpps = dbOrders.map(o => ({
      id: o.id,
      customerId: o.customer_id || '',
      customerName: o.customer_name,
      vendorId: '',
      vendorName: o.vendor_name || 'Sin asignar',
      estimatedAmount: o.total,
      stage: 'cierre_ganado',
      status: 'orden',
      folio: o.folio,
    }));

    return [...quotationOpps, ...orderOpps];
  }, [dbQuotations, dbOrders, allCustomers, dbTeam]);

  const cities = useMemo(() => [...new Set(allCustomers.map(c => c.city).filter(Boolean))].sort(), [allCustomers]);
  const filterVendorOptions = useMemo(() => {
    const ids = [...new Set(allCustomers.map(c => c.vendorId).filter(Boolean))];
    return ids.map(id => ({ id, name: dbTeam.find(t => t.id === id)?.name || id })).sort((a, b) => a.name.localeCompare(b.name));
  }, [allCustomers, dbTeam]);

  const hasFilters = !!(filterType || filterCity || filterVendor || filterPriority || filterDateFrom || filterDateTo);
  const clearFilters = () => { setFilterType(''); setFilterCity(''); setFilterVendor(''); setFilterPriority(''); setFilterDateFrom(''); setFilterDateTo(''); setSearch(''); };

  const filteredCustomers = useMemo(() => {
    let data = [...allCustomers];
    if (search) {
      const s = search.toLowerCase();
      data = data.filter(c => c.name.toLowerCase().includes(s) || c.city.toLowerCase().includes(s));
    }
    if (filterType) data = data.filter(c => c.type === filterType);
    if (filterCity) data = data.filter(c => c.city === filterCity);
    if (filterVendor) data = data.filter(c => c.vendorId === filterVendor);
    if (filterPriority) data = data.filter(c => c.priority === filterPriority);
    if (filterDateFrom) data = data.filter(c => c.createdAt >= filterDateFrom);
    if (filterDateTo) data = data.filter(c => c.createdAt <= filterDateTo);
    return data;
  }, [allCustomers, search, filterType, filterCity, filterVendor, filterPriority, filterDateFrom, filterDateTo]);

  const resolveVendor = (vendorId: string) => {
    const u = dbTeam.find(usr => usr.id === vendorId);
    return u ? u.name : vendorId || '—';
  };

  const vendors = dbTeam.filter(u => u.role === 'vendedor');
  const pipelineStages = ['prospecto_nuevo', 'contactado', 'calificado', 'diagnostico', 'cotizacion_enviada', 'seguimiento', 'negociacion', 'cierre_ganado', 'cierre_perdido', 'postventa'] as const;

  const handleExport = () => {
    exportCRMToExcel(filteredCustomers, dbTeam as any);
    toast.success(`${filteredCustomers.length} registros exportados a Excel`);
  };

  const handleCreate = () => {
    if (!form.name.trim()) { toast.error('El nombre es obligatorio'); return; }
    if (!form.phone.trim()) { toast.error('El teléfono es obligatorio'); return; }
    if (!form.vendorId) { toast.error('Selecciona un vendedor'); return; }

    const vendor = dbTeam.find(v => v.id === form.vendorId);
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
      onSuccess: (data, _vars, _ctx) => {
        // Save fiscal data if any field was filled
        const hasFiscal = fiscal.legalName || fiscal.taxRegime || fiscal.fiscalZipCode || fiscal.invoiceEmail;
        if (hasFiscal && data?.id) {
          saveFiscalMut.mutate({
            customer_id: data.id,
            legal_name: fiscal.legalName,
            rfc: form.rfc || '',
            tax_regime: fiscal.taxRegime,
            fiscal_zip_code: fiscal.fiscalZipCode,
            cfdi_use_default: fiscal.cfdiUse || 'G03',
            invoice_email: fiscal.invoiceEmail || null,
          });
        }
        toast.success(`Cliente "${form.name}" registrado correctamente`);
        // Trigger onboarding automation
        if (onboardingConfig.enabled && vendor) {
          const today = new Date().toISOString().split('T')[0];
          const activities = generateOnboardingActivities(
            onboardingConfig,
            { id: '', name: form.name, createdAt: today },
            { id: vendor.id, name: vendor.name },
          );
          activities.forEach(act => addActivityMut.mutate(act));
          if (activities.length > 0) {
            toast.success(`${activities.length} actividades de seguimiento creadas automáticamente`);
          }
          // Open WhatsApp if available
          if (form.whatsapp) {
            const link = buildWhatsAppLink(form.whatsapp, onboardingConfig.whatsappTemplate, {
              cliente: form.name,
              vendedor: vendor.name,
              producto: 'equipo automotriz',
            });
            window.open(link, '_blank');
          }
        }
        setShowCreate(false);
        setForm(emptyCustomer());
        setFiscal(emptyFiscal());
      },
    });
  };

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    const { id, createdAt, ...rest } = customer;
    setForm(rest);
    // Load fiscal data for this customer
    const existingFiscal = allFiscalData.find(f => f.customer_id === customer.id);
    if (existingFiscal) {
      setFiscal({
        taxRegime: existingFiscal.tax_regime || '',
        fiscalZipCode: existingFiscal.fiscal_zip_code || '',
        cfdiUse: existingFiscal.cfdi_use_default || 'G03',
        legalName: existingFiscal.legal_name || '',
        invoiceEmail: existingFiscal.invoice_email || '',
      });
      setShowFiscal(true);
    } else {
      setFiscal(emptyFiscal());
      setShowFiscal(false);
    }
  };

  const handleUpdate = () => {
    if (!editingCustomer) return;
    if (!form.name.trim()) { toast.error('El nombre es obligatorio'); return; }
    if (!form.phone.trim()) { toast.error('El teléfono es obligatorio'); return; }
    if (!form.vendorId) { toast.error('Selecciona un vendedor'); return; }

    updateCustomerMut.mutate({
      id: editingCustomer.id,
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
        // Save fiscal data
        const hasFiscal = fiscal.legalName || fiscal.taxRegime || fiscal.fiscalZipCode || fiscal.invoiceEmail;
        if (hasFiscal) {
          saveFiscalMut.mutate({
            customer_id: editingCustomer.id,
            legal_name: fiscal.legalName,
            rfc: form.rfc || '',
            tax_regime: fiscal.taxRegime,
            fiscal_zip_code: fiscal.fiscalZipCode,
            cfdi_use_default: fiscal.cfdiUse || 'G03',
            invoice_email: fiscal.invoiceEmail || null,
          });
        }
        toast.success(`Cliente "${form.name}" actualizado correctamente`);
        setEditingCustomer(null);
        setForm(emptyCustomer());
        setFiscal(emptyFiscal());
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
        {(['clientes', 'pipeline', 'onboarding', 'duplicados'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors capitalize ${tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            {t === 'clientes' ? 'Clientes' : t === 'pipeline' ? 'Pipeline' : t === 'onboarding' ? '⚡ Onboarding' : `🔍 Duplicados${globalDuplicates.length > 0 ? ` (${globalDuplicates.length})` : ''}`}
          </button>
        ))}
      </div>

      {tab === 'clientes' && (
        <>
          <div className="bg-card rounded-xl border p-4 mb-4 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-muted-foreground">Filtros</span>
              <div className="ml-auto">
                {hasFilters && <button onClick={clearFilters} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><X size={14} />Limpiar</button>}
              </div>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search size={14} className="absolute left-2.5 top-2 text-muted-foreground" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar cliente..." className="w-full pl-8 pr-3 py-1.5 rounded-lg border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
              <select value={filterType} onChange={e => setFilterType(e.target.value)} className="px-3 py-1.5 rounded-lg border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/20">
                <option value="">Todos los tipos</option>
                {Object.entries(CUSTOMER_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <select value={filterCity} onChange={e => setFilterCity(e.target.value)} className="px-3 py-1.5 rounded-lg border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/20">
                <option value="">Todas las ciudades</option>
                {cities.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={filterVendor} onChange={e => setFilterVendor(e.target.value)} className="px-3 py-1.5 rounded-lg border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/20">
                <option value="">Todos los vendedores</option>
                {filterVendorOptions.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
              <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} className="px-3 py-1.5 rounded-lg border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/20">
                <option value="">Todas las prioridades</option>
                <option value="alta">Alta</option>
                <option value="media">Media</option>
                <option value="baja">Baja</option>
              </select>
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-muted-foreground whitespace-nowrap">Desde:</span>
                <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} className="px-2 py-1.5 rounded-lg border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-muted-foreground whitespace-nowrap">Hasta:</span>
                <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} className="px-2 py-1.5 rounded-lg border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
            </div>
            <div className="text-xs text-muted-foreground">{filteredCustomers.length} de {allCustomers.length} clientes</div>
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
                    <td className="font-medium text-primary hover:underline cursor-pointer" onClick={() => setViewingCustomer(c)}>{c.name}</td>
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

      {tab === 'pipeline' && (() => {
        const stageColors: Record<string, string> = {
          prospecto_nuevo: 'border-muted-foreground/30',
          contactado: 'border-blue-400',
          calificado: 'border-cyan-400',
          diagnostico: 'border-yellow-400',
          cotizacion_enviada: 'border-orange-400',
          seguimiento: 'border-amber-400',
          negociacion: 'border-purple-400',
          cierre_ganado: 'border-green-500',
          cierre_perdido: 'border-destructive',
          postventa: 'border-primary',
        };
        const stageBg: Record<string, string> = {
          cierre_ganado: 'bg-green-50 dark:bg-green-950/20',
          cierre_perdido: 'bg-red-50 dark:bg-red-950/20',
          postventa: 'bg-primary/5',
        };
        return (
          <div className="flex gap-3 overflow-x-auto pb-4">
            {pipelineStages.map(stage => {
              const opps = allOpportunities.filter(o => o.stage === stage);
              const total = opps.reduce((s, o) => s + o.estimatedAmount, 0);
              return (
                <div key={stage} className="min-w-[240px] max-w-[280px] flex-shrink-0">
                  <div className={`flex items-center justify-between mb-2 px-2 py-1.5 rounded-lg border-l-4 ${stageColors[stage] || ''} ${stageBg[stage] || 'bg-muted/30'}`}>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{PIPELINE_LABELS[stage]}</span>
                    <span className="text-xs font-bold bg-background rounded-full px-2 py-0.5">{opps.length}</span>
                  </div>
                  {total > 0 && <div className="text-xs font-semibold text-muted-foreground mb-2 px-1">{fmt(total)}</div>}
                  <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                    {opps.map(o => {
                      const customer = allCustomers.find(c => c.id === o.customerId);
                      return (
                        <div key={o.id} className="p-3 rounded-lg bg-card border hover:shadow-md transition-shadow">
                          <div className="font-medium text-sm">{o.customerName}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">{o.vendorName}</div>
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-sm font-bold">{fmt(o.estimatedAmount)}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">{o.folio}</span>
                          </div>
                          <div className="flex gap-1 mt-2 flex-wrap">
                            {customer && (
                              <button onClick={() => setViewingCustomer(customer)} className="text-[10px] px-2 py-1 rounded bg-muted hover:bg-accent text-foreground flex items-center gap-1">
                                <Eye className="w-3 h-3" /> Cliente
                              </button>
                            )}
                            {stage !== 'cierre_ganado' && stage !== 'cierre_perdido' && (
                              <button onClick={() => navigate('/cotizaciones')} className="text-[10px] px-2 py-1 rounded bg-muted hover:bg-accent text-foreground flex items-center gap-1">
                                <FileText className="w-3 h-3" /> Cotización
                              </button>
                            )}
                            {stage === 'cierre_ganado' && (
                              <button onClick={() => navigate('/pedidos')} className="text-[10px] px-2 py-1 rounded bg-green-100 dark:bg-green-900/30 hover:bg-green-200 dark:hover:bg-green-900/50 text-green-800 dark:text-green-300 flex items-center gap-1">
                                <Package className="w-3 h-3" /> Pedido
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {opps.length === 0 && <div className="p-4 text-center text-xs text-muted-foreground border border-dashed rounded-lg">Sin oportunidades</div>}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* ═══ ONBOARDING TAB ═══ */}
      {tab === 'onboarding' && (() => {
        const TODAY_STR = new Date().toISOString().split('T')[0];
        const thirtyDaysAgo = (() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0]; })();
        const recentCustomers = allCustomers.filter(c => c.createdAt >= thirtyDaysAgo);

        // Customers with at least one follow-up activity
        const customersWithFollowUp = new Set(
          dbActivities.filter(a => a.customerName && (a.status === 'realizada' || a.status === 'en_proceso')).map(a => a.customerId).filter(Boolean)
        );
        const withoutFollowUp = recentCustomers.filter(c => !customersWithFollowUp.has(c.id));

        // Customers with all onboarding activities done
        const onboardingCompleted = recentCustomers.filter(c => {
          const acts = dbActivities.filter(a => a.customerId === c.id);
          return acts.length > 0 && acts.every(a => a.status === 'realizada' || a.status === 'cancelada');
        });

        // Response rate: customers that had at least 1 follow-up done / total recent
        const responseRate = recentCustomers.length > 0
          ? Math.round((recentCustomers.filter(c => customersWithFollowUp.has(c.id)).length / recentCustomers.length) * 100)
          : 0;

        return (
          <div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-card rounded-xl border p-4" style={{ borderLeft: '4px solid hsl(var(--destructive))' }}>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <AlertTriangle size={14} /> Sin seguimiento
                </div>
                <div className="text-2xl font-bold text-destructive">{withoutFollowUp.length}</div>
                <div className="text-[10px] text-muted-foreground mt-1">Últimos 30 días</div>
              </div>
              <div className="bg-card rounded-xl border p-4" style={{ borderLeft: '4px solid hsl(var(--success))' }}>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <CheckCircle2 size={14} /> Onboarding completo
                </div>
                <div className="text-2xl font-bold text-success">{onboardingCompleted.length}</div>
                <div className="text-[10px] text-muted-foreground mt-1">De {recentCustomers.length} recientes</div>
              </div>
              <div className="bg-card rounded-xl border p-4" style={{ borderLeft: '4px solid hsl(var(--primary))' }}>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <TrendingUp size={14} /> Tasa de respuesta
                </div>
                <div className="text-2xl font-bold">{responseRate}%</div>
                <div className="text-[10px] text-muted-foreground mt-1">Clientes con seguimiento</div>
              </div>
              <div className="bg-card rounded-xl border p-4" style={{ borderLeft: '4px solid hsl(var(--warning))' }}>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <Zap size={14} /> Automatización
                </div>
                <div className="text-2xl font-bold">{onboardingConfig.enabled ? '✅ Activa' : '⏸️ Pausada'}</div>
                <div className="text-[10px] text-muted-foreground mt-1">Días: {onboardingConfig.followUpDays.join(', ')}</div>
                {currentRole === 'director' && (
                  <button
                    onClick={() => saveOnboardingConfig({ ...onboardingConfig, enabled: !onboardingConfig.enabled })}
                    className={`mt-2 text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${onboardingConfig.enabled ? 'bg-destructive/10 text-destructive hover:bg-destructive/20' : 'bg-primary/10 text-primary hover:bg-primary/20'}`}
                  >
                    {onboardingConfig.enabled ? 'Desactivar' : 'Activar'}
                  </button>
                )}
              </div>
            </div>

            {/* Clients without follow-up */}
            {withoutFollowUp.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-bold text-destructive flex items-center gap-2 mb-3">
                  <AlertTriangle size={14} /> Clientes sin seguimiento ({withoutFollowUp.length})
                </h3>
                <div className="bg-card rounded-xl border overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr><th>Cliente</th><th>Tipo</th><th>Vendedor</th><th>Alta</th><th>Días sin contacto</th></tr>
                    </thead>
                    <tbody>
                      {withoutFollowUp.map(c => {
                        const daysSince = Math.floor((new Date().getTime() - new Date(c.createdAt).getTime()) / 86400000);
                        return (
                          <tr key={c.id}>
                            <td className="font-medium">{c.name}</td>
                            <td className="text-xs">{CUSTOMER_TYPE_LABELS[c.type]}</td>
                            <td className="text-muted-foreground">{resolveVendor(c.vendorId)}</td>
                            <td className="text-xs text-muted-foreground">{c.createdAt}</td>
                            <td>
                              <span className={`text-xs font-bold ${daysSince > 7 ? 'text-destructive' : daysSince > 3 ? 'text-warning' : 'text-success'}`}>
                                {daysSince} días
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Completed onboarding */}
            {onboardingCompleted.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-success flex items-center gap-2 mb-3">
                  <CheckCircle2 size={14} /> Onboarding completado ({onboardingCompleted.length})
                </h3>
                <div className="bg-card rounded-xl border overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr><th>Cliente</th><th>Tipo</th><th>Vendedor</th><th>Alta</th></tr>
                    </thead>
                    <tbody>
                      {onboardingCompleted.map(c => (
                        <tr key={c.id}>
                          <td className="font-medium">{c.name}</td>
                          <td className="text-xs">{CUSTOMER_TYPE_LABELS[c.type]}</td>
                          <td className="text-muted-foreground">{resolveVendor(c.vendorId)}</td>
                          <td className="text-xs text-muted-foreground">{c.createdAt}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {recentCustomers.length === 0 && (
              <div className="text-center text-muted-foreground py-12 border border-dashed rounded-xl">
                No hay clientes registrados en los últimos 30 días
              </div>
            )}
          </div>
        );
      })()}


      {/* ═══ DUPLICADOS TAB ═══ */}
      {tab === 'duplicados' && (
        <div className="space-y-4">
          <div className="bg-card rounded-xl border p-4">
            <h2 className="text-lg font-bold flex items-center gap-2 mb-1">
              <Copy size={18} /> Detección de Duplicados
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Se escanearon {allCustomers.length} clientes — {globalDuplicates.length} grupo(s) de posibles duplicados.
            </p>

            {globalDuplicates.length === 0 && (
              <div className="text-center text-muted-foreground py-12 border border-dashed rounded-xl">
                <CheckCircle2 className="mx-auto mb-2 text-green-500" size={32} />
                <p className="font-medium">Base de datos limpia</p>
                <p className="text-xs">No se detectaron clientes duplicados</p>
              </div>
            )}

            {globalDuplicates.map((group, gi) => (
              <div key={gi} className="mb-4 border rounded-lg overflow-hidden">
                <div className="bg-muted/50 px-4 py-2 flex items-center gap-2 text-sm font-medium">
                  <AlertTriangle size={14} className="text-yellow-600" />
                  {group.reason}
                  <span className="ml-auto text-xs text-muted-foreground">{group.customers.length} registros</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/30">
                      <tr>
                        <th className="px-3 py-2 text-left">Nombre</th>
                        <th className="px-3 py-2 text-left">Teléfono</th>
                        <th className="px-3 py-2 text-left">Email</th>
                        <th className="px-3 py-2 text-left">Vendedor</th>
                        <th className="px-3 py-2 text-left">Registro</th>
                        <th className="px-3 py-2 text-left">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {group.customers.map(c => (
                        <tr key={c.id} className="hover:bg-muted/20">
                          <td className="px-3 py-2 font-medium">{c.name}</td>
                          <td className="px-3 py-2">{c.phone}</td>
                          <td className="px-3 py-2">{c.email || '—'}</td>
                          <td className="px-3 py-2">{resolveVendor(c.vendorId)}</td>
                          <td className="px-3 py-2">{c.createdAt}</td>
                          <td className="px-3 py-2">
                            <button onClick={() => setViewingCustomer(c)} className="text-primary hover:underline text-xs">Ver</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {(currentRole === 'director' || currentRole === 'gerencia_comercial') && group.customers.length === 2 && (
                  <div className="px-4 py-3 bg-muted/20 border-t flex items-center gap-2 flex-wrap">
                    <Merge size={14} className="text-primary" />
                    <span className="text-xs text-muted-foreground">Fusionar:</span>
                    <button
                      onClick={() => setMergeDialog({ primary: group.customers[0], secondary: group.customers[1] })}
                      className="text-xs px-3 py-1 rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      Mantener "{group.customers[0].name}"
                    </button>
                    <button
                      onClick={() => setMergeDialog({ primary: group.customers[1], secondary: group.customers[0] })}
                      className="text-xs px-3 py-1 rounded-md border hover:bg-accent"
                    >
                      Mantener "{group.customers[1].name}"
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <Dialog open={!!viewingCustomer} onOpenChange={() => setViewingCustomer(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{viewingCustomer?.name}</DialogTitle>
            <DialogDescription>Información del cliente</DialogDescription>
          </DialogHeader>
          {viewingCustomer && (
            <div className="grid grid-cols-2 gap-4 text-sm">
              {viewingCustomer.contactName && (
                <div className="col-span-2">
                  <span className="text-xs text-muted-foreground block">Nombre de contacto</span>
                  <span className="font-medium">{viewingCustomer.contactName}</span>
                </div>
              )}
              <div>
                <span className="text-xs text-muted-foreground block">Tipo</span>
                <span className="font-medium">{CUSTOMER_TYPE_LABELS[viewingCustomer.type]}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Prioridad</span>
                <StatusBadge status={viewingCustomer.priority} type="priority" />
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Teléfono</span>
                <span className="font-medium">{viewingCustomer.phone || '—'}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">WhatsApp</span>
                <span className="font-medium">{viewingCustomer.whatsapp || '—'}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Correo</span>
                <span className="font-medium">{viewingCustomer.email || '—'}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">RFC</span>
                <span className="font-medium">{viewingCustomer.rfc || '—'}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Ciudad</span>
                <span className="font-medium">{viewingCustomer.city || '—'}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Estado</span>
                <span className="font-medium">{viewingCustomer.state || '—'}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Vendedor</span>
                <span className="font-medium">{resolveVendor(viewingCustomer.vendorId)}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Desde</span>
                <span className="font-medium">{viewingCustomer.createdAt}</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

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
            <div className="md:col-span-2">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Nombre de contacto</label>
              <input value={form.contactName || ''} onChange={e => setForm(p => ({ ...p, contactName: e.target.value }))} className="w-full px-3 py-2 rounded-lg border bg-card text-sm" placeholder="Ej: Juan Pérez" />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Teléfono *</label>
              <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} className={`w-full px-3 py-2 rounded-lg border text-sm ${duplicateMatches.length > 0 ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950/30' : 'bg-card'}`} placeholder="811-234-5678" />
            </div>
            {/* Multi-field duplicate detection panel */}
            {duplicateMatches.length > 0 && (
              <div className="md:col-span-2 p-3 rounded-lg border border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/30 text-sm space-y-2">
                <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400 font-medium">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  Posibles clientes existentes ({duplicateMatches.length})
                </div>
                {duplicateMatches.slice(0, 5).map(dm => (
                  <div key={dm.customer.id} className="ml-6 p-2 rounded-md bg-background/60 border text-xs space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{dm.customer.name}</span>
                      <span className="flex gap-1 flex-wrap">
                        {dm.matchReasons.map(r => (
                          <span key={r} className="px-1.5 py-0.5 rounded bg-yellow-200 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 text-[10px]">{r}</span>
                        ))}
                      </span>
                    </div>
                    <div className="flex gap-4 text-muted-foreground">
                      <span>📞 {dm.customer.phone}</span>
                      {dm.customer.email && <span>✉ {dm.customer.email}</span>}
                      <span>👤 {resolveVendor(dm.customer.vendorId)}</span>
                    </div>
                    <div className="flex gap-2 mt-1">
                      <button type="button" onClick={() => { setShowCreate(false); setViewingCustomer(dm.customer); }} className="text-[10px] px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1">
                        <Eye className="w-3 h-3" /> Ver existente
                      </button>
                      <button type="button" onClick={() => { setShowCreate(false); setForm(emptyCustomer()); }} className="text-[10px] px-2 py-1 rounded border hover:bg-accent">
                        Cancelar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
            <div className="md:col-span-2">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Teléfono *</label>
              <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} className={`w-full px-3 py-2 rounded-lg border text-sm ${duplicateMatches.length > 0 ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950/30' : 'bg-card'}`} />
            </div>
            {duplicateMatches.length > 0 && (
              <div className="md:col-span-2 p-3 rounded-lg border border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/30 text-sm">
                <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400 font-medium mb-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  Posibles duplicados ({duplicateMatches.length})
                </div>
                {duplicateMatches.slice(0, 3).map(dm => (
                  <div key={dm.customer.id} className="ml-6 p-2 rounded-md bg-background/60 border text-xs mb-1">
                    <span className="font-semibold">{dm.customer.name}</span>
                    <span className="text-muted-foreground ml-2">📞 {dm.customer.phone}</span>
                    <span className="ml-2">{dm.matchReasons.join(', ')}</span>
                  </div>
                ))}
              </div>
            )}
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

      {/* ===================== MERGE CONFIRM DIALOG ===================== */}
      <AlertDialog open={!!mergeDialog} onOpenChange={(open) => { if (!open) setMergeDialog(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><Merge size={18} /> Fusionar clientes</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>Se mantendrá el registro principal y se transferirán todos los datos del registro duplicado:</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="p-3 rounded-lg border-2 border-primary bg-primary/5">
                    <p className="text-[10px] font-bold text-primary mb-1">✅ SE MANTIENE</p>
                    <p className="font-semibold">{mergeDialog?.primary.name}</p>
                    <p className="text-xs text-muted-foreground">📞 {mergeDialog?.primary.phone}</p>
                  </div>
                  <div className="p-3 rounded-lg border border-destructive/50 bg-destructive/5">
                    <p className="text-[10px] font-bold text-destructive mb-1">❌ SE ELIMINA</p>
                    <p className="font-semibold">{mergeDialog?.secondary.name}</p>
                    <p className="text-xs text-muted-foreground">📞 {mergeDialog?.secondary.phone}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Se transferirán: pedidos, cotizaciones, actividades, facturas y cuentas por cobrar.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={merging}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleMerge} disabled={merging} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {merging ? 'Fusionando...' : 'Confirmar fusión'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
