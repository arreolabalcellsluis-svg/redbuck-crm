/**
 * Oportunidades por Reabasto — Full module page.
 * Three views: table, kanban, timeline. Filters, export, quick actions.
 */
import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import {
  generateRestockOpportunities, getRestockAlerts,
  RESTOCK_STATUS_LABELS, RESTOCK_STATUS_COLORS, RESTOCK_REASON_LABELS,
  type RestockOpportunity, type RestockStatus, type RestockReason,
} from '@/lib/restockEngine';
import { CATEGORY_LABELS, type ProductCategory } from '@/types';
import { demoUsers } from '@/data/demo-data';
import StatusBadge from '@/components/shared/StatusBadge';
import MetricCard from '@/components/shared/MetricCard';
import {
  RefreshCw, Search, FileDown, Table2, Columns3, CalendarClock,
  Send, MessageCircle, CheckCircle, ArrowUp, ArrowDown, Filter,
  X, AlertTriangle, DollarSign, Package, Clock, TrendingUp,
} from 'lucide-react';

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);

type ViewMode = 'table' | 'kanban' | 'timeline';
type SortDir = 'asc' | 'desc';

const ALL_STATUSES: RestockStatus[] = [
  'esperando_llegada', 'producto_disponible', 'cotizacion_reenviada',
  'en_seguimiento', 'venta_cerrada', 'perdida',
];

const KANBAN_STATUSES: RestockStatus[] = [
  'esperando_llegada', 'producto_disponible', 'cotizacion_reenviada',
  'en_seguimiento', 'venta_cerrada', 'perdida',
];

export default function RestockOpportunitiesPage() {
  const [view, setView] = useState<ViewMode>('table');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterPriority, setFilterPriority] = useState<string>('');
  const [filterVendor, setFilterVendor] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterCity, setFilterCity] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  const [sortKey, setSortKey] = useState<string>('priority');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const allOpportunities = useMemo(() => generateRestockOpportunities(), []);
  const alerts = useMemo(() => getRestockAlerts(allOpportunities), [allOpportunities]);

  // Local state for status changes
  const [statusOverrides, setStatusOverrides] = useState<Record<string, RestockStatus>>({});

  const opportunities = useMemo(() => {
    let data = allOpportunities.map(o => ({
      ...o,
      status: statusOverrides[o.id] ?? o.status,
    }));

    if (search) {
      const q = search.toLowerCase();
      data = data.filter(o =>
        o.customerName.toLowerCase().includes(q) ||
        o.productName.toLowerCase().includes(q) ||
        o.quotationFolio.toLowerCase().includes(q) ||
        o.vendorName.toLowerCase().includes(q)
      );
    }
    if (filterStatus) data = data.filter(o => o.status === filterStatus);
    if (filterPriority) data = data.filter(o => o.priority === filterPriority);
    if (filterVendor) data = data.filter(o => o.vendorName === filterVendor);
    if (filterCategory) data = data.filter(o => o.productCategory === filterCategory);
    if (filterCity) data = data.filter(o => o.city === filterCity);

    // Sort
    data.sort((a, b) => {
      const pOrder = { alta: 0, media: 1, baja: 2 };
      let av: any, bv: any;
      switch (sortKey) {
        case 'priority': av = pOrder[a.priority]; bv = pOrder[b.priority]; break;
        case 'totalQuotation': av = a.totalQuotation; bv = b.totalQuotation; break;
        case 'quotationDate': av = a.quotationDate; bv = b.quotationDate; break;
        case 'estimatedArrival': av = a.estimatedArrival; bv = b.estimatedArrival; break;
        case 'customerName': av = a.customerName; bv = b.customerName; break;
        default: av = pOrder[a.priority]; bv = pOrder[b.priority];
      }
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === 'asc' ? av - bv : bv - av;
    });

    return data;
  }, [allOpportunities, search, filterStatus, filterPriority, filterVendor, filterCategory, filterCity, sortKey, sortDir, statusOverrides]);

  // ─── Derived data ────────────────────────────────────────
  const uniqueVendors = [...new Set(allOpportunities.map(o => o.vendorName))];
  const uniqueCities = [...new Set(allOpportunities.map(o => o.city))];
  const uniqueCategories = [...new Set(allOpportunities.map(o => o.productCategory))];

  const totalValue = opportunities.reduce((s, o) => s + o.totalQuotation, 0);
  const availableCount = opportunities.filter(o => o.status === 'producto_disponible').length;
  const waitingCount = opportunities.filter(o => o.status === 'esperando_llegada').length;

  // ─── Actions ─────────────────────────────────────────────
  const handleResend = (opp: RestockOpportunity) => {
    setStatusOverrides(prev => ({ ...prev, [opp.id]: 'cotizacion_reenviada' }));
    toast.success(`Cotización ${opp.quotationFolio} reenviada a ${opp.customerName}`);
  };

  const handleWhatsApp = (opp: RestockOpportunity) => {
    const phone = opp.customerWhatsapp ?? opp.customerPhone ?? '';
    const msg = encodeURIComponent(
      `Hola, le informamos que el producto ${opp.productName} que cotizó (${opp.quotationFolio}) ya está disponible. ¿Le gustaría confirmar su pedido? — REDBUCK EQUIPMENT`
    );
    window.open(`https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=${msg}`, '_blank');
    toast.info(`Abriendo WhatsApp para ${opp.customerName}`);
  };

  const handleReactivate = (opp: RestockOpportunity) => {
    setStatusOverrides(prev => ({ ...prev, [opp.id]: 'en_seguimiento' }));
    toast.success(`Oportunidad ${opp.quotationFolio} marcada como reactivada`);
  };

  const handleExport = (format: 'xlsx' | 'csv') => {
    const data = opportunities.map(o => ({
      'Fecha Cotización': o.quotationDate,
      'Folio': o.quotationFolio,
      'Cliente': o.customerName,
      'Ciudad': o.city,
      'Estado': o.state,
      'Vendedor': o.vendorName,
      'Producto': o.productName,
      'Categoría': o.categoryLabel,
      'Cantidad': o.qty,
      'Precio Unitario': o.unitPrice,
      'Total Cotización': o.totalQuotation,
      'Estatus Inventario': o.inventoryStatus,
      'Fecha Est. Llegada': o.estimatedArrival,
      'Prioridad': o.priority,
      'Estatus': RESTOCK_STATUS_LABELS[o.status],
      'Último Seguimiento': o.lastFollowUp,
      'Próxima Acción': o.nextAction,
      'Motivo': RESTOCK_REASON_LABELS[o.reason],
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Reabasto');

    if (format === 'csv') {
      const csv = XLSX.utils.sheet_to_csv(ws);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      saveAs(blob, `Oportunidades_Reabasto_${new Date().toISOString().split('T')[0]}.csv`);
    } else {
      const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      saveAs(new Blob([buf]), `Oportunidades_Reabasto_${new Date().toISOString().split('T')[0]}.xlsx`);
    }
    toast.success(`${opportunities.length} registros exportados a ${format.toUpperCase()}`);
  };

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const clearFilters = () => {
    setSearch(''); setFilterStatus(''); setFilterPriority('');
    setFilterVendor(''); setFilterCategory(''); setFilterCity('');
  };

  const hasActiveFilters = !!(search || filterStatus || filterPriority || filterVendor || filterCategory || filterCity);

  function SortableHeader({ label, sortField }: { label: string; sortField: string }) {
    const active = sortKey === sortField;
    return (
      <th className="cursor-pointer select-none hover:text-primary transition-colors" onClick={() => toggleSort(sortField)}>
        <span className="inline-flex items-center gap-1">
          {label}
          {active && (sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
        </span>
      </th>
    );
  }

  // ─── Priority badge ──────────────────────────────────────
  function PriorityBadge({ priority }: { priority: string }) {
    const cls = priority === 'alta' ? 'bg-destructive/10 text-destructive' : priority === 'media' ? 'bg-warning/10 text-warning' : 'bg-muted text-muted-foreground';
    return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>{priority.charAt(0).toUpperCase() + priority.slice(1)}</span>;
  }

  // ─── Status badge ────────────────────────────────────────
  function RestockStatusBadge({ status }: { status: RestockStatus }) {
    return (
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${RESTOCK_STATUS_COLORS[status]}`}>
        {RESTOCK_STATUS_LABELS[status]}
      </span>
    );
  }

  // ─── Quick Actions ───────────────────────────────────────
  function QuickActions({ opp }: { opp: RestockOpportunity }) {
    return (
      <div className="flex items-center gap-1">
        <button onClick={() => handleResend(opp)} className="p-1.5 rounded-md hover:bg-info/10 text-muted-foreground hover:text-info transition-colors" title="Reenviar cotización">
          <Send size={14} />
        </button>
        <button onClick={() => handleWhatsApp(opp)} className="p-1.5 rounded-md hover:bg-success/10 text-muted-foreground hover:text-success transition-colors" title="WhatsApp">
          <MessageCircle size={14} />
        </button>
        <button onClick={() => handleReactivate(opp)} className="p-1.5 rounded-md hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors" title="Reactivar">
          <CheckCircle size={14} />
        </button>
      </div>
    );
  }

  // ─── Timeline view grouping ──────────────────────────────
  const timelineGroups = useMemo(() => {
    const groups: Record<string, RestockOpportunity[]> = {};
    opportunities.forEach(o => {
      const key = o.estimatedArrival;
      if (!groups[key]) groups[key] = [];
      groups[key].push(o);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [opportunities]);

  return (
    <div>
      {/* Header */}
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center">
              <RefreshCw size={20} className="text-warning" />
            </div>
            Oportunidades por Reabasto
          </h1>
          <p className="page-subtitle">Cotizaciones sin cerrar por falta de inventario — reactiva cuando haya stock</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => handleExport('csv')} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium hover:bg-muted transition-colors">
            <FileDown size={16} /> CSV
          </button>
          <button onClick={() => handleExport('xlsx')} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium hover:bg-muted transition-colors">
            <FileDown size={16} /> Excel
          </button>
        </div>
      </div>

      {/* Alerts banner */}
      {alerts.length > 0 && (
        <div className="mb-4 p-4 rounded-xl border border-success/30 bg-success/5 flex items-start gap-3">
          <AlertTriangle size={20} className="text-success mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-success">
              ¡{alerts.length} oportunidad{alerts.length !== 1 ? 'es' : ''} lista{alerts.length !== 1 ? 's' : ''} para reactivar!
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Productos ya disponibles en inventario: {alerts.map(a => a.productName).join(', ')}
            </p>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <MetricCard title="Valor total" value={fmt(totalValue)} icon={DollarSign} variant="primary" />
        <MetricCard title="Oportunidades" value={opportunities.length} icon={Package} />
        <MetricCard title="Disponibles" value={availableCount} icon={CheckCircle} variant="success" subtitle="Listas para reactivar" />
        <MetricCard title="Esperando" value={waitingCount} icon={Clock} variant="warning" subtitle="Pendientes de llegada" />
      </div>

      {/* View toggle + Search + Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
        {/* View toggle */}
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          {([
            { mode: 'table' as ViewMode, icon: Table2, label: 'Tabla' },
            { mode: 'kanban' as ViewMode, icon: Columns3, label: 'Kanban' },
            { mode: 'timeline' as ViewMode, icon: CalendarClock, label: 'Llegada' },
          ]).map(v => (
            <button key={v.mode} onClick={() => setView(v.mode)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${view === v.mode ? 'bg-card shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
              <v.icon size={14} /> {v.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar cliente, producto, folio..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border bg-card text-sm outline-none focus:ring-2 focus:ring-primary/20" />
        </div>

        {/* Filter toggle */}
        <button onClick={() => setShowFilters(!showFilters)}
          className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${hasActiveFilters ? 'bg-primary/10 border-primary/30 text-primary' : 'hover:bg-muted'}`}>
          <Filter size={14} /> Filtros {hasActiveFilters && '•'}
        </button>
        {hasActiveFilters && (
          <button onClick={clearFilters} className="inline-flex items-center gap-1 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground">
            <X size={12} /> Limpiar
          </button>
        )}
      </div>

      {/* Filter bar */}
      {showFilters && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4 p-4 bg-muted/30 rounded-xl border border-dashed">
          <div>
            <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Estatus</label>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="w-full px-2 py-1.5 rounded-md border bg-card text-xs">
              <option value="">Todos</option>
              {ALL_STATUSES.map(s => <option key={s} value={s}>{RESTOCK_STATUS_LABELS[s]}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Prioridad</label>
            <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} className="w-full px-2 py-1.5 rounded-md border bg-card text-xs">
              <option value="">Todas</option>
              <option value="alta">Alta</option>
              <option value="media">Media</option>
              <option value="baja">Baja</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Vendedor</label>
            <select value={filterVendor} onChange={e => setFilterVendor(e.target.value)} className="w-full px-2 py-1.5 rounded-md border bg-card text-xs">
              <option value="">Todos</option>
              {uniqueVendors.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Categoría</label>
            <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="w-full px-2 py-1.5 rounded-md border bg-card text-xs">
              <option value="">Todas</option>
              {uniqueCategories.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Ciudad</label>
            <select value={filterCity} onChange={e => setFilterCity(e.target.value)} className="w-full px-2 py-1.5 rounded-md border bg-card text-xs">
              <option value="">Todas</option>
              {uniqueCities.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* Results count */}
      <div className="text-xs text-muted-foreground mb-3">
        {opportunities.length} oportunidad{opportunities.length !== 1 ? 'es' : ''} • Valor total: {fmt(totalValue)}
      </div>

      {/* ═══ TABLE VIEW ═══ */}
      {view === 'table' && (
        <div className="bg-card rounded-xl border overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <SortableHeader label="Fecha" sortField="quotationDate" />
                <th>Folio</th>
                <SortableHeader label="Cliente" sortField="customerName" />
                <th>Ciudad</th>
                <th>Vendedor</th>
                <th>Producto</th>
                <th>Categoría</th>
                <th>Cant.</th>
                <SortableHeader label="Total" sortField="totalQuotation" />
                <th>Inv.</th>
                <SortableHeader label="ETA" sortField="estimatedArrival" />
                <SortableHeader label="Prioridad" sortField="priority" />
                <th>Estatus</th>
                <th>Próxima acción</th>
                <th className="w-24">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {opportunities.length === 0 ? (
                <tr><td colSpan={15} className="text-center text-muted-foreground py-8">Sin oportunidades encontradas</td></tr>
              ) : opportunities.map(o => (
                <tr key={o.id}>
                  <td className="text-xs text-muted-foreground whitespace-nowrap">{o.quotationDate}</td>
                  <td className="font-mono text-xs">{o.quotationFolio}</td>
                  <td className="font-medium">{o.customerName}</td>
                  <td className="text-muted-foreground text-xs">{o.city}, {o.state}</td>
                  <td className="text-muted-foreground text-xs">{o.vendorName}</td>
                  <td className="text-sm">{o.productName}</td>
                  <td className="text-xs text-muted-foreground">{o.categoryLabel}</td>
                  <td className="text-center">{o.qty}</td>
                  <td className="font-bold">{fmt(o.totalQuotation)}</td>
                  <td className="text-xs">{o.inventoryStatus}</td>
                  <td className="text-xs text-muted-foreground whitespace-nowrap">{o.estimatedArrival}</td>
                  <td><PriorityBadge priority={o.priority} /></td>
                  <td><RestockStatusBadge status={o.status} /></td>
                  <td className="text-xs text-muted-foreground">{o.nextAction}</td>
                  <td><QuickActions opp={o} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ═══ KANBAN VIEW ═══ */}
      {view === 'kanban' && (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {KANBAN_STATUSES.map(status => {
            const items = opportunities.filter(o => o.status === status);
            const total = items.reduce((s, o) => s + o.totalQuotation, 0);
            return (
              <div key={status} className="min-w-[280px] flex-shrink-0">
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${RESTOCK_STATUS_COLORS[status]}`}>
                    {RESTOCK_STATUS_LABELS[status]}
                  </span>
                  <span className="text-xs font-medium text-muted-foreground">{items.length}</span>
                </div>
                {total > 0 && <div className="text-xs text-muted-foreground mb-2 px-1">{fmt(total)}</div>}
                <div className="space-y-2">
                  {items.map(o => (
                    <div key={o.id} className="p-3 rounded-lg bg-card border hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between mb-1">
                        <div className="font-medium text-sm">{o.customerName}</div>
                        <PriorityBadge priority={o.priority} />
                      </div>
                      <div className="text-xs text-muted-foreground">{o.vendorName}</div>
                      <div className="text-xs mt-1">{o.productName}</div>
                      <div className="flex items-center justify-between mt-2 pt-2 border-t">
                        <span className="text-sm font-bold">{fmt(o.totalQuotation)}</span>
                        <span className="text-[10px] text-muted-foreground">{o.quotationFolio}</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-1">ETA: {o.estimatedArrival}</div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[10px] text-primary">{o.nextAction}</span>
                        <QuickActions opp={o} />
                      </div>
                    </div>
                  ))}
                  {items.length === 0 && (
                    <div className="p-4 text-center text-xs text-muted-foreground border border-dashed rounded-lg">
                      Sin oportunidades
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ═══ TIMELINE VIEW (by arrival date) ═══ */}
      {view === 'timeline' && (
        <div className="space-y-6">
          {timelineGroups.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">Sin oportunidades encontradas</div>
          ) : timelineGroups.map(([date, items]) => (
            <div key={date}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <CalendarClock size={16} className="text-primary" />
                </div>
                <div>
                  <div className="text-sm font-bold">Llegada estimada: {date}</div>
                  <div className="text-xs text-muted-foreground">{items.length} oportunidad{items.length !== 1 ? 'es' : ''} • {fmt(items.reduce((s, o) => s + o.totalQuotation, 0))}</div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 ml-11">
                {items.map(o => (
                  <div key={o.id} className="p-4 rounded-xl bg-card border hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="font-medium text-sm">{o.customerName}</div>
                        <div className="text-xs text-muted-foreground">{o.city} • {o.vendorName}</div>
                      </div>
                      <PriorityBadge priority={o.priority} />
                    </div>
                    <div className="text-sm">{o.productName} <span className="text-muted-foreground">×{o.qty}</span></div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="font-bold">{fmt(o.totalQuotation)}</span>
                      <RestockStatusBadge status={o.status} />
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-2">{o.inventoryStatus}</div>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t">
                      <span className="text-[10px] text-primary">{o.nextAction}</span>
                      <QuickActions opp={o} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
