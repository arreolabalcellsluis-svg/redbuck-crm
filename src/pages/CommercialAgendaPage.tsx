/**
 * Agenda Comercial — Full module page.
 * Views: daily, weekly, monthly, pending list.
 * CRUD, reschedule, duplicate, export.
 */
import { useState, useMemo, useCallback, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import {
  ACTIVITY_TYPE_LABELS, ACTIVITY_TYPE_ICONS,
  ACTIVITY_STATUS_LABELS, ACTIVITY_STATUS_COLORS,
  getActivitiesForDate, getActivitiesForWeek, getActivitiesForMonth,
  getPendingActivities, getOverdueActivities,
  type Activity, type ActivityType, type ActivityStatus,
} from '@/lib/agendaEngine';
import { demoUsers } from '@/data/demo-data';
import { useActivities, useAddActivity, useUpdateActivity, useDeleteActivity } from '@/hooks/useActivities';
import { useCustomers } from '@/hooks/useCustomers';
import { useQuotations } from '@/hooks/useQuotations';
import { useProducts } from '@/hooks/useProducts';
import MetricCard from '@/components/shared/MetricCard';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import {
  CalendarDays, List, CalendarRange, Calendar as CalendarIcon,
  Search, FileDown, Plus, Filter, X, CheckCircle2, Clock, AlertTriangle,
  ArrowUp, ArrowDown, Pencil, Copy, CalendarClock, MoreHorizontal,
  Phone, MessageCircle, Send, Eye, Trash2, ChevronLeft, ChevronRight,
} from 'lucide-react';

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);

type ViewMode = 'daily' | 'weekly' | 'monthly' | 'pending';

const TODAY = new Date().toISOString().split('T')[0];

const ALL_TYPES: ActivityType[] = [
  'llamada', 'whatsapp', 'enviar_cotizacion', 'reenviar_cotizacion',
  'seguimiento', 'visita', 'videollamada', 'cobranza',
  'confirmacion_entrega', 'postventa', 'recordatorio', 'otra',
];

const ALL_STATUSES: ActivityStatus[] = [
  'pendiente', 'en_proceso', 'realizada', 'no_realizada', 'reagendada', 'cancelada',
];

function emptyActivity(): Omit<Activity, 'id'> {
  return {
    title: '', type: 'llamada', date: TODAY, time: '',
    priority: 'media', notes: '', responsibleId: '', responsibleName: '',
    status: 'pendiente',
  };
}

export default function CommercialAgendaPage() {
  const location = useLocation();
  const [view, setView] = useState<ViewMode>('daily');
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterVendor, setFilterVendor] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [currentDate, setCurrentDate] = useState(TODAY);
  const [showCreate, setShowCreate] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [form, setForm] = useState<Omit<Activity, 'id'>>(emptyActivity());

  // DB hooks
  const { data: dbActivities = [], isLoading } = useActivities();
  const addMutation = useAddActivity();
  const updateMutation = useUpdateActivity();
  const deleteMutation = useDeleteActivity();
  const { data: dbCustomers = [] } = useCustomers();
  const { data: dbQuotations = [] } = useQuotations();
  const { data: dbProducts = [] } = useProducts();

  // Open create dialog pre-filled when navigated from DailyAssistant
  useEffect(() => {
    const state = location.state as any;
    if (state?.newActivityForCustomer) {
      const { customerId, customerName, vendorName, suggestedProduct } = state.newActivityForCustomer;
      const vendor = demoUsers.find(u => u.name === vendorName && u.role === 'vendedor');
      setForm({
        ...emptyActivity(),
        customerId: customerId || undefined,
        customerName: customerName || undefined,
        responsibleId: vendor?.id ?? '',
        responsibleName: vendorName ?? '',
        notes: suggestedProduct ? `Producto sugerido: ${suggestedProduct}` : '',
      });
      setShowCreate(true);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const vendors = demoUsers.filter(u => u.role === 'vendedor');

  // ─── Filtering ───────────────────────────────────────────
  const filtered = useMemo(() => {
    let data = [...dbActivities];
    if (search) {
      const q = search.toLowerCase();
      data = data.filter(a =>
        a.title.toLowerCase().includes(q) ||
        (a.customerName ?? '').toLowerCase().includes(q) ||
        a.responsibleName.toLowerCase().includes(q)
      );
    }
    if (filterType) data = data.filter(a => a.type === filterType);
    if (filterStatus) data = data.filter(a => a.status === filterStatus);
    if (filterVendor) data = data.filter(a => a.responsibleName === filterVendor);
    return data;
  }, [dbActivities, search, filterType, filterStatus, filterVendor]);

  // ─── Date navigation ────────────────────────────────────
  const currentDateObj = new Date(currentDate + 'T12:00:00');
  const navigateDate = (days: number) => {
    const d = new Date(currentDateObj);
    d.setDate(d.getDate() + days);
    setCurrentDate(d.toISOString().split('T')[0]);
  };
  const navigateWeek = (weeks: number) => navigateDate(weeks * 7);
  const navigateMonth = (months: number) => {
    const d = new Date(currentDateObj);
    d.setMonth(d.getMonth() + months);
    setCurrentDate(d.toISOString().split('T')[0]);
  };

  const weekStart = useMemo(() => {
    const d = new Date(currentDateObj);
    const day = d.getDay();
    d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    return d.toISOString().split('T')[0];
  }, [currentDate]);

  // ─── CRUD ────────────────────────────────────────────────
  const handleCreate = () => {
    if (!form.title.trim()) { toast.error('El título es obligatorio'); return; }
    if (!form.responsibleId) { toast.error('Selecciona un responsable'); return; }
    const vendor = vendors.find(v => v.id === form.responsibleId);
    addMutation.mutate({ ...form, responsibleName: vendor?.name ?? '' });
    setShowCreate(false);
    setForm(emptyActivity());
  };

  const handleUpdate = () => {
    if (!editingActivity) return;
    if (!form.title.trim()) { toast.error('El título es obligatorio'); return; }
    const vendor = vendors.find(v => v.id === form.responsibleId);
    updateMutation.mutate({ id: editingActivity.id, ...form, responsibleName: vendor?.name ?? form.responsibleName });
    toast.success('Actividad actualizada');
    setEditingActivity(null);
    setForm(emptyActivity());
  };

  const handleToggleDone = (id: string) => {
    const act = dbActivities.find(a => a.id === id);
    if (!act) return;
    updateMutation.mutate({ id, status: act.status === 'realizada' ? 'pendiente' : 'realizada' });
  };

  const handleDuplicate = (act: Activity) => {
    const { id, ...rest } = act;
    addMutation.mutate({ ...rest, status: 'pendiente' });
    toast.success('Actividad duplicada');
  };

  const handleReschedule = (act: Activity) => {
    setEditingActivity(act);
    const { id, ...rest } = act;
    setForm({ ...rest, status: 'reagendada' });
  };

  const handleEdit = (act: Activity) => {
    setEditingActivity(act);
    const { id, ...rest } = act;
    setForm(rest);
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  // ─── Export ──────────────────────────────────────────────
  const handleExport = (format: 'xlsx' | 'csv') => {
    const data = filtered.map(a => ({
      'Título': a.title,
      'Tipo': ACTIVITY_TYPE_LABELS[a.type],
      'Fecha': a.date,
      'Hora': a.time ?? '',
      'Cliente': a.customerName ?? '',
      'Cotización': a.quotationFolio ?? '',
      'Producto': a.productName ?? '',
      'Prioridad': a.priority,
      'Responsable': a.responsibleName,
      'Estatus': ACTIVITY_STATUS_LABELS[a.status],
      'Notas': a.notes,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Agenda');
    if (format === 'csv') {
      const csv = XLSX.utils.sheet_to_csv(ws);
      saveAs(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `Agenda_Comercial_${currentDate}.csv`);
    } else {
      const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      saveAs(new Blob([buf]), `Agenda_Comercial_${currentDate}.xlsx`);
    }
    toast.success(`${filtered.length} actividades exportadas`);
  };

  const clearFilters = () => { setSearch(''); setFilterType(''); setFilterStatus(''); setFilterVendor(''); };
  const hasActiveFilters = !!(search || filterType || filterStatus || filterVendor);

  // ─── KPIs ────────────────────────────────────────────────
  const todayActs = getActivitiesForDate(filtered, TODAY);
  const overdue = getOverdueActivities(filtered, TODAY);
  const pending = getPendingActivities(filtered);

  // ─── Sub-components ──────────────────────────────────────
  function PriorityDot({ p }: { p: string }) {
    const cls = p === 'alta' ? 'bg-destructive' : p === 'media' ? 'bg-warning' : 'bg-success';
    return <span className={`w-2 h-2 rounded-full inline-block ${cls}`} />;
  }

  function StatusBadge({ status }: { status: ActivityStatus }) {
    return (
      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${ACTIVITY_STATUS_COLORS[status]}`}>
        {ACTIVITY_STATUS_LABELS[status]}
      </span>
    );
  }

  function ActivityCard({ act, compact = false }: { act: Activity; compact?: boolean }) {
    return (
      <div className={`p-3 rounded-lg bg-card border hover:shadow-md transition-shadow group ${act.status === 'realizada' ? 'opacity-60' : ''}`}>
        <div className="flex items-start gap-2">
          <button onClick={() => handleToggleDone(act.id)}
            className={`mt-0.5 shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-colors ${
              act.status === 'realizada' ? 'bg-success border-success text-success-foreground' : 'border-muted-foreground/30 hover:border-primary'
            }`}>
            {act.status === 'realizada' && <CheckCircle2 size={12} />}
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-sm">{ACTIVITY_TYPE_ICONS[act.type]}</span>
              <span className={`text-sm font-medium ${act.status === 'realizada' ? 'line-through' : ''}`}>{act.title}</span>
              <PriorityDot p={act.priority} />
            </div>
            {!compact && (
              <>
                {act.time && <div className="text-[10px] text-muted-foreground">🕐 {act.time}</div>}
                {act.customerName && <div className="text-xs text-muted-foreground mt-0.5">👤 {act.customerName}</div>}
                {act.quotationFolio && <div className="text-xs text-muted-foreground">📄 {act.quotationFolio}</div>}
                {act.productName && <div className="text-xs text-muted-foreground">📦 {act.productName}</div>}
                <div className="text-xs text-muted-foreground mt-0.5">👔 {act.responsibleName}</div>
              </>
            )}
            <div className="flex items-center gap-2 mt-1.5">
              <StatusBadge status={act.status} />
              {compact && act.time && <span className="text-[10px] text-muted-foreground">{act.time}</span>}
            </div>
          </div>
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => handleEdit(act)} className="p-1 rounded hover:bg-muted" title="Editar"><Pencil size={12} /></button>
            <button onClick={() => handleDuplicate(act)} className="p-1 rounded hover:bg-muted" title="Duplicar"><Copy size={12} /></button>
            <button onClick={() => handleReschedule(act)} className="p-1 rounded hover:bg-muted" title="Reagendar"><CalendarClock size={12} /></button>
            <button onClick={() => handleDelete(act.id)} className="p-1 rounded hover:bg-destructive/10 text-destructive" title="Eliminar"><Trash2 size={12} /></button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Week days ───────────────────────────────────────────
  const weekDays = useMemo(() => {
    const days: { date: string; label: string; dayName: string }[] = [];
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart + 'T12:00:00');
      d.setDate(d.getDate() + i);
      days.push({
        date: d.toISOString().split('T')[0],
        label: `${d.getDate()}`,
        dayName: dayNames[d.getDay()],
      });
    }
    return days;
  }, [weekStart]);

  // ─── Month calendar ─────────────────────────────────────
  const monthCalendar = useMemo(() => {
    const year = currentDateObj.getFullYear();
    const month = currentDateObj.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPad = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
    const days: { date: string; day: number; inMonth: boolean }[] = [];

    for (let i = startPad; i > 0; i--) {
      const d = new Date(year, month, 1 - i);
      days.push({ date: d.toISOString().split('T')[0], day: d.getDate(), inMonth: false });
    }
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const d = new Date(year, month, i);
      days.push({ date: d.toISOString().split('T')[0], day: i, inMonth: true });
    }
    const remaining = 7 - (days.length % 7);
    if (remaining < 7) {
      for (let i = 1; i <= remaining; i++) {
        const d = new Date(year, month + 1, i);
        days.push({ date: d.toISOString().split('T')[0], day: i, inMonth: false });
      }
    }
    return days;
  }, [currentDate]);

  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  // ─── Form dialog content ────────────────────────────────
  function ActivityFormFields() {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Título *</label>
          <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg border bg-card text-sm" placeholder="Descripción de la actividad" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Tipo de actividad</label>
          <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value as ActivityType }))}
            className="w-full px-3 py-2 rounded-lg border bg-card text-sm">
            {ALL_TYPES.map(t => <option key={t} value={t}>{ACTIVITY_TYPE_ICONS[t]} {ACTIVITY_TYPE_LABELS[t]}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Responsable *</label>
          <select value={form.responsibleId} onChange={e => setForm(p => ({ ...p, responsibleId: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg border bg-card text-sm">
            <option value="">Seleccionar...</option>
            {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Fecha *</label>
          <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg border bg-card text-sm" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Hora (opcional)</label>
          <input type="time" value={form.time ?? ''} onChange={e => setForm(p => ({ ...p, time: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg border bg-card text-sm" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Cliente</label>
          <select value={form.customerId ?? ''} onChange={e => {
            const c = dbCustomers.find(cc => cc.id === e.target.value);
            setForm(p => ({ ...p, customerId: e.target.value || undefined, customerName: c?.name }));
          }} className="w-full px-3 py-2 rounded-lg border bg-card text-sm">
            <option value="">Ninguno</option>
            {dbCustomers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Cotización</label>
          <select value={form.quotationId ?? ''} onChange={e => {
            const q = dbQuotations.find(qq => qq.id === e.target.value);
            setForm(p => ({ ...p, quotationId: e.target.value || undefined, quotationFolio: q?.folio }));
          }} className="w-full px-3 py-2 rounded-lg border bg-card text-sm">
            <option value="">Ninguna</option>
            {dbQuotations.map(q => <option key={q.id} value={q.id}>{q.folio} — {q.customer_name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Producto</label>
          <select value={form.productId ?? ''} onChange={e => {
            const p = dbProducts.find(pp => pp.id === e.target.value);
            setForm(prev => ({ ...prev, productId: e.target.value || undefined, productName: p?.name }));
          }} className="w-full px-3 py-2 rounded-lg border bg-card text-sm">
            <option value="">Ninguno</option>
            {dbProducts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Prioridad</label>
          <select value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value as any }))}
            className="w-full px-3 py-2 rounded-lg border bg-card text-sm">
            <option value="alta">🔴 Alta</option>
            <option value="media">🟡 Media</option>
            <option value="baja">🟢 Baja</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Estatus</label>
          <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as ActivityStatus }))}
            className="w-full px-3 py-2 rounded-lg border bg-card text-sm">
            {ALL_STATUSES.map(s => <option key={s} value={s}>{ACTIVITY_STATUS_LABELS[s]}</option>)}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Notas</label>
          <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg border bg-card text-sm h-20 resize-none" placeholder="Notas adicionales..." />
        </div>
      </div>
    );
  }

  if (isLoading) {
    return <div className="py-12 text-center text-muted-foreground">Cargando agenda...</div>;
  }

  return (
    <div>
      {/* Header */}
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <CalendarDays size={20} className="text-primary" />
            </div>
            Agenda Comercial
          </h1>
          <p className="page-subtitle">Organiza actividades comerciales diarias, semanales y mensuales</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => handleExport('csv')} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium hover:bg-muted transition-colors">
            <FileDown size={16} /> CSV
          </button>
          <button onClick={() => handleExport('xlsx')} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium hover:bg-muted transition-colors">
            <FileDown size={16} /> Excel
          </button>
          <button onClick={() => { setForm(emptyActivity()); setShowCreate(true); }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
            <Plus size={16} /> Nueva actividad
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <MetricCard title="Hoy pendientes" value={todayActs.filter(a => a.status === 'pendiente').length} icon={Clock} variant="warning" />
        <MetricCard title="Vencidas" value={overdue.length} icon={AlertTriangle} variant="danger" />
        <MetricCard title="Realizadas hoy" value={todayActs.filter(a => a.status === 'realizada').length} icon={CheckCircle2} variant="success" />
        <MetricCard title="Total pendientes" value={pending.length} icon={CalendarDays} variant="primary" />
      </div>

      {/* View toggle + search + filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          {([
            { mode: 'daily' as ViewMode, icon: CalendarDays, label: 'Día' },
            { mode: 'weekly' as ViewMode, icon: CalendarRange, label: 'Semana' },
            { mode: 'monthly' as ViewMode, icon: CalendarIcon, label: 'Mes' },
            { mode: 'pending' as ViewMode, icon: List, label: 'Pendientes' },
          ]).map(v => (
            <button key={v.mode} onClick={() => setView(v.mode)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                view === v.mode ? 'bg-card shadow text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}>
              <v.icon size={14} /> {v.label}
            </button>
          ))}
        </div>

        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar actividad..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border bg-card text-sm outline-none focus:ring-2 focus:ring-primary/20" />
        </div>

        <button onClick={() => setShowFilters(!showFilters)}
          className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${hasActiveFilters ? 'bg-primary/10 border-primary/30 text-primary' : 'hover:bg-muted'}`}>
          <Filter size={14} /> Filtros
        </button>
        {hasActiveFilters && (
          <button onClick={clearFilters} className="inline-flex items-center gap-1 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground">
            <X size={12} /> Limpiar
          </button>
        )}
      </div>

      {showFilters && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4 p-4 bg-muted/30 rounded-xl border border-dashed">
          <div>
            <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Tipo</label>
            <select value={filterType} onChange={e => setFilterType(e.target.value)} className="w-full px-2 py-1.5 rounded-md border bg-card text-xs">
              <option value="">Todos</option>
              {ALL_TYPES.map(t => <option key={t} value={t}>{ACTIVITY_TYPE_LABELS[t]}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Estatus</label>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="w-full px-2 py-1.5 rounded-md border bg-card text-xs">
              <option value="">Todos</option>
              {ALL_STATUSES.map(s => <option key={s} value={s}>{ACTIVITY_STATUS_LABELS[s]}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Vendedor</label>
            <select value={filterVendor} onChange={e => setFilterVendor(e.target.value)} className="w-full px-2 py-1.5 rounded-md border bg-card text-xs">
              <option value="">Todos</option>
              {vendors.map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* ═══ DAILY VIEW ═══ */}
      {view === 'daily' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => navigateDate(-1)} className="p-2 rounded-lg hover:bg-muted"><ChevronLeft size={18} /></button>
            <div className="text-center">
              <div className="text-lg font-bold">{currentDateObj.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
              {currentDate === TODAY && <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">Hoy</span>}
            </div>
            <button onClick={() => navigateDate(1)} className="p-2 rounded-lg hover:bg-muted"><ChevronRight size={18} /></button>
          </div>
          <div className="space-y-2">
            {getActivitiesForDate(filtered, currentDate).sort((a, b) => (a.time ?? '99:99').localeCompare(b.time ?? '99:99')).map(act => (
              <ActivityCard key={act.id} act={act} />
            ))}
            {getActivitiesForDate(filtered, currentDate).length === 0 && (
              <div className="text-center text-muted-foreground py-12 border border-dashed rounded-xl">
                Sin actividades para este día
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ WEEKLY VIEW ═══ */}
      {view === 'weekly' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => navigateWeek(-1)} className="p-2 rounded-lg hover:bg-muted"><ChevronLeft size={18} /></button>
            <div className="text-sm font-bold">Semana del {new Date(weekStart + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}</div>
            <button onClick={() => navigateWeek(1)} className="p-2 rounded-lg hover:bg-muted"><ChevronRight size={18} /></button>
          </div>
          <div className="grid grid-cols-7 gap-2">
            {weekDays.map(day => {
              const dayActs = getActivitiesForDate(filtered, day.date);
              const isToday = day.date === TODAY;
              return (
                <div key={day.date} className={`rounded-xl border p-2 min-h-[200px] ${isToday ? 'border-primary/50 bg-primary/5' : 'bg-card'}`}>
                  <div className="text-center mb-2">
                    <div className="text-[10px] text-muted-foreground uppercase">{day.dayName}</div>
                    <div className={`text-sm font-bold ${isToday ? 'text-primary' : ''}`}>{day.label}</div>
                    {dayActs.length > 0 && (
                      <div className="text-[10px] text-muted-foreground">{dayActs.length} act.</div>
                    )}
                  </div>
                  <div className="space-y-1">
                    {dayActs.sort((a, b) => (a.time ?? '99:99').localeCompare(b.time ?? '99:99')).map(act => (
                      <div key={act.id}
                        className={`p-1.5 rounded text-[10px] cursor-pointer hover:shadow transition-shadow ${
                          act.status === 'realizada' ? 'opacity-50' : ''
                        } ${ACTIVITY_STATUS_COLORS[act.status]}`}
                        onClick={() => handleEdit(act)}
                        title={act.title}>
                        <div className="flex items-center gap-1">
                          <button onClick={e => { e.stopPropagation(); handleToggleDone(act.id); }}
                            className={`w-3 h-3 rounded border flex items-center justify-center shrink-0 ${
                              act.status === 'realizada' ? 'bg-success border-success' : 'border-muted-foreground/30'
                            }`}>
                            {act.status === 'realizada' && <CheckCircle2 size={8} />}
                          </button>
                          <span className="truncate font-medium">{ACTIVITY_TYPE_ICONS[act.type]} {act.title}</span>
                        </div>
                        {act.time && <div className="text-muted-foreground ml-4">{act.time}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ MONTHLY VIEW ═══ */}
      {view === 'monthly' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => navigateMonth(-1)} className="p-2 rounded-lg hover:bg-muted"><ChevronLeft size={18} /></button>
            <div className="text-lg font-bold">{monthNames[currentDateObj.getMonth()]} {currentDateObj.getFullYear()}</div>
            <button onClick={() => navigateMonth(1)} className="p-2 rounded-lg hover:bg-muted"><ChevronRight size={18} /></button>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => (
              <div key={d} className="text-center text-[10px] font-medium text-muted-foreground py-1">{d}</div>
            ))}
            {monthCalendar.map((day, i) => {
              const dayActs = getActivitiesForDate(filtered, day.date);
              const isToday = day.date === TODAY;
              return (
                <div key={i}
                  className={`rounded-lg border p-1.5 min-h-[80px] cursor-pointer hover:border-primary/30 transition-colors ${
                    !day.inMonth ? 'opacity-30' : ''
                  } ${isToday ? 'border-primary bg-primary/5' : 'bg-card'}`}
                  onClick={() => { setCurrentDate(day.date); setView('daily'); }}>
                  <div className={`text-xs font-bold mb-1 ${isToday ? 'text-primary' : ''}`}>{day.day}</div>
                  {dayActs.slice(0, 3).map(act => (
                    <div key={act.id} className={`text-[9px] px-1 py-0.5 rounded mb-0.5 truncate ${ACTIVITY_STATUS_COLORS[act.status]}`}>
                      {ACTIVITY_TYPE_ICONS[act.type]} {act.title}
                    </div>
                  ))}
                  {dayActs.length > 3 && (
                    <div className="text-[9px] text-muted-foreground text-center">+{dayActs.length - 3} más</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ PENDING LIST ═══ */}
      {view === 'pending' && (
        <div>
          {overdue.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-bold text-destructive flex items-center gap-2 mb-2">
                <AlertTriangle size={14} /> Vencidas ({overdue.length})
              </h3>
              <div className="space-y-2">
                {overdue.map(act => (
                  <div key={act.id} className="border-l-2 border-l-destructive pl-3">
                    <ActivityCard act={act} />
                  </div>
                ))}
              </div>
            </div>
          )}
          <h3 className="text-sm font-bold flex items-center gap-2 mb-2">
            <Clock size={14} className="text-warning" /> Pendientes ({pending.filter(a => a.date >= TODAY).length})
          </h3>
          <div className="space-y-2">
            {pending.filter(a => a.date >= TODAY).sort((a, b) => a.date.localeCompare(b.date)).map(act => (
              <div key={act.id} className="flex items-center gap-3">
                <div className="text-[10px] text-muted-foreground w-16 shrink-0 text-right">{act.date.slice(5)}</div>
                <div className="flex-1"><ActivityCard act={act} /></div>
              </div>
            ))}
            {pending.filter(a => a.date >= TODAY).length === 0 && (
              <div className="text-center text-muted-foreground py-8 border border-dashed rounded-xl">
                ¡Sin actividades pendientes!
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ CREATE DIALOG ═══ */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nueva Actividad</DialogTitle>
            <DialogDescription>Programa una actividad comercial. Los campos con * son obligatorios.</DialogDescription>
          </DialogHeader>
          <ActivityFormFields />
          <DialogFooter>
            <button onClick={() => { setShowCreate(false); setForm(emptyActivity()); }} className="px-4 py-2 rounded-lg border text-sm font-medium">Cancelar</button>
            <button onClick={handleCreate} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">Crear actividad</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ EDIT DIALOG ═══ */}
      <Dialog open={!!editingActivity} onOpenChange={open => { if (!open) { setEditingActivity(null); setForm(emptyActivity()); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.status === 'reagendada' ? 'Reagendar Actividad' : 'Editar Actividad'}</DialogTitle>
            <DialogDescription>Modifica los datos de la actividad.</DialogDescription>
          </DialogHeader>
          <ActivityFormFields />
          <DialogFooter>
            <button onClick={() => { setEditingActivity(null); setForm(emptyActivity()); }} className="px-4 py-2 rounded-lg border text-sm font-medium">Cancelar</button>
            <button onClick={handleUpdate} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
              {form.status === 'reagendada' ? 'Reagendar' : 'Guardar cambios'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
