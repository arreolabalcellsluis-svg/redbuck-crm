import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  generateDailyRecommendations, getAssistantSummary, refreshRecommendations,
  REASON_LABELS, REASON_ICONS, type DailyRecommendation, type RecommendationPriority, type RecommendationReason,
} from '@/lib/dailyAssistantEngine';
import { useAppContext } from '@/contexts/AppContext';
import MetricCard from '@/components/shared/MetricCard';
import { Input } from '@/components/ui/input';
import {
  Brain, Search, Filter, Phone, MessageCircle, FileText, CalendarPlus,
  CheckCircle2, Trophy, ArrowRight, Sparkles, Download, RefreshCw,
  Zap, Target, TrendingUp, AlertTriangle,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);

const PRIORITY_STYLES: Record<RecommendationPriority, string> = {
  alta: 'bg-destructive/10 text-destructive border-destructive/20',
  media: 'bg-warning/10 text-warning border-warning/20',
  baja: 'bg-muted text-muted-foreground border-border',
};

const PRIORITY_LABELS: Record<RecommendationPriority, string> = {
  alta: 'Alta', media: 'Media', baja: 'Baja',
};

export default function DailyAssistantPage() {
  const { currentRole } = useAppContext();
  const navigate = useNavigate();
  const [recs, setRecs] = useState<DailyRecommendation[]>(() => generateDailyRecommendations());
  const [search, setSearch] = useState('');
  const [filterPriority, setFilterPriority] = useState<RecommendationPriority | 'todas'>('todas');
  const [filterReason, setFilterReason] = useState<RecommendationReason | 'todas'>('todas');
  const [filterVendor, setFilterVendor] = useState('todos');
  const [showWorked, setShowWorked] = useState(false);

  const vendors = useMemo(() => {
    const set = new Set(recs.map(r => r.vendorName));
    return Array.from(set).sort();
  }, [recs]);

  const filtered = useMemo(() => {
    let list = recs;
    if (!showWorked) list = list.filter(r => !r.worked && !r.closed);
    if (filterPriority !== 'todas') list = list.filter(r => r.priority === filterPriority);
    if (filterReason !== 'todas') list = list.filter(r => r.reason === filterReason);
    if (filterVendor !== 'todos') list = list.filter(r => r.vendorName === filterVendor);
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(r =>
        r.customerName.toLowerCase().includes(s) ||
        r.suggestedProduct.toLowerCase().includes(s) ||
        r.city.toLowerCase().includes(s) ||
        r.vendorName.toLowerCase().includes(s)
      );
    }
    return list;
  }, [recs, search, filterPriority, filterReason, filterVendor, showWorked]);

  const summary = useMemo(() => getAssistantSummary(recs), [recs]);

  const markWorked = (id: string) => {
    setRecs(prev => prev.map(r => r.id === id ? { ...r, worked: true } : r));
    toast.success('Oportunidad marcada como trabajada');
  };

  const markClosed = (id: string) => {
    setRecs(prev => prev.map(r => r.id === id ? { ...r, closed: true, worked: true } : r));
    toast.success('¡Venta cerrada! 🎉');
  };

  const openWhatsApp = (rec: DailyRecommendation) => {
    const customer = rec.customerName;
    const msg = encodeURIComponent(`Hola, le contacto de REDBUCK Equipment respecto a ${rec.suggestedProduct}. ¿Tiene un momento para platicar?`);
    window.open(`https://wa.me/?text=${msg}`, '_blank');
    toast.info(`WhatsApp para ${customer}`);
  };

  const handleRefresh = () => {
    setRecs(refreshRecommendations());
    toast.success('Recomendaciones actualizadas');
  };

  const exportData = (format: 'csv' | 'xlsx') => {
    const rows = filtered.map(r => ({
      Cliente: r.customerName,
      Empresa: r.company,
      Ciudad: r.city,
      Vendedor: r.vendorName,
      Motivo: r.reasonLabel,
      'Producto Sugerido': r.suggestedProduct,
      Prioridad: PRIORITY_LABELS[r.priority],
      Score: r.score,
      'Última Actividad': r.lastActivity,
      'Acción Sugerida': r.suggestedAction,
      'Valor Estimado': r.estimatedValue,
      Trabajada: r.worked ? 'Sí' : 'No',
      Cerrada: r.closed ? 'Sí' : 'No',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Asistente');
    if (format === 'csv') {
      const csv = XLSX.utils.sheet_to_csv(ws);
      saveAs(new Blob([csv], { type: 'text/csv;charset=utf-8' }), 'asistente-comercial.csv');
    } else {
      const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      saveAs(new Blob([buf]), 'asistente-comercial.xlsx');
    }
    toast.success(`Exportado a ${format.toUpperCase()}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <Brain size={20} className="text-primary-foreground" />
          </div>
          <div>
            <h1 className="page-title">Asistente Comercial Diario</h1>
            <p className="page-subtitle">Hoy puedes cerrar estas ventas — {new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </div>
        </div>
        <div className="flex gap-2 mt-3 sm:mt-0">
          <button onClick={handleRefresh} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm hover:bg-muted transition-colors">
            <RefreshCw size={14} /> Actualizar
          </button>
          <button onClick={() => exportData('xlsx')} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm hover:bg-muted transition-colors">
            <Download size={14} /> Excel
          </button>
          <button onClick={() => exportData('csv')} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm hover:bg-muted transition-colors">
            <Download size={14} /> CSV
          </button>
        </div>
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <MetricCard title="Oportunidades Hoy" value={summary.total} icon={Sparkles} variant="primary" />
        <MetricCard title="Alta Prioridad" value={summary.alta} icon={Zap} variant="danger" />
        <MetricCard title="Media Prioridad" value={summary.media} icon={Target} variant="warning" />
        <MetricCard title="Baja Prioridad" value={summary.baja} icon={TrendingUp} />
        <MetricCard title="Valor Total" value={fmt(summary.totalValue)} icon={Trophy} variant="success" />
        <MetricCard title="Tasa Cumplimiento" value={`${summary.complianceRate}%`} icon={CheckCircle2} variant="info" />
      </div>

      {/* Filters */}
      <div className="bg-card rounded-xl border p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar cliente, producto, ciudad..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <select value={filterPriority} onChange={e => setFilterPriority(e.target.value as any)}
            className="h-10 rounded-md border bg-background px-3 text-sm">
            <option value="todas">Todas las prioridades</option>
            <option value="alta">🔴 Alta</option>
            <option value="media">🟡 Media</option>
            <option value="baja">⚪ Baja</option>
          </select>
          <select value={filterReason} onChange={e => setFilterReason(e.target.value as any)}
            className="h-10 rounded-md border bg-background px-3 text-sm">
            <option value="todas">Todos los motivos</option>
            {Object.entries(REASON_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{REASON_ICONS[k as RecommendationReason]} {v}</option>
            ))}
          </select>
          <select value={filterVendor} onChange={e => setFilterVendor(e.target.value)}
            className="h-10 rounded-md border bg-background px-3 text-sm">
            <option value="todos">Todos los vendedores</option>
            {vendors.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={showWorked} onChange={e => setShowWorked(e.target.checked)}
              className="rounded border-input" />
            Mostrar trabajadas
          </label>
        </div>
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {filtered.length} oportunidad{filtered.length !== 1 ? 'es' : ''} encontrada{filtered.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Recommendations list */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <Brain size={48} className="mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">No hay oportunidades pendientes</p>
            <p className="text-sm">¡Excelente trabajo! Todas las oportunidades han sido trabajadas.</p>
          </div>
        )}
        {filtered.map(rec => (
          <div key={rec.id}
            className={`bg-card rounded-xl border p-4 hover:shadow-md transition-all ${rec.worked ? 'opacity-60' : ''} ${rec.closed ? 'border-success/30 bg-success/5' : ''}`}>
            <div className="flex flex-col lg:flex-row lg:items-center gap-4">
              {/* Main info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-lg">{REASON_ICONS[rec.reason]}</span>
                  <h3 className="font-semibold truncate">{rec.customerName}</h3>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${PRIORITY_STYLES[rec.priority]}`}>
                    {PRIORITY_LABELS[rec.priority]}
                  </span>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    Score: {rec.score}
                  </span>
                  {rec.quotationFolio && (
                    <span className="text-xs text-muted-foreground">
                      📄 {rec.quotationFolio}
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {rec.city} · {rec.vendorName} · {rec.reasonLabel}
                </p>
                <div className="flex items-center gap-4 mt-2 text-sm">
                  <span className="font-medium text-primary">{rec.suggestedProduct}</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="font-semibold">{fmt(rec.estimatedValue)}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <ArrowRight size={12} /> {rec.suggestedAction}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">Última actividad: {rec.lastActivity}</p>
              </div>

              {/* Quick actions */}
              <div className="flex flex-wrap gap-2 shrink-0">
                <button onClick={() => toast.info(`Llamando a ${rec.customerName}...`)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border hover:bg-muted transition-colors"
                  title="Llamar">
                  <Phone size={13} /> Llamar
                </button>
                <button onClick={() => openWhatsApp(rec)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border hover:bg-success/10 hover:border-success/30 transition-colors"
                  title="WhatsApp">
                  <MessageCircle size={13} /> WhatsApp
                </button>
                <button onClick={() => toast.info('Crear cotización...')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border hover:bg-primary/10 hover:border-primary/30 transition-colors"
                  title="Cotizar">
                  <FileText size={13} /> Cotizar
                </button>
                <button onClick={() => toast.info('Actividad registrada')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border hover:bg-info/10 hover:border-info/30 transition-colors"
                  title="Registrar actividad">
                  <CalendarPlus size={13} /> Actividad
                </button>
                {!rec.worked && (
                  <button onClick={() => markWorked(rec.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border hover:bg-warning/10 hover:border-warning/30 transition-colors"
                    title="Marcar como trabajada">
                    <CheckCircle2 size={13} /> Trabajada
                  </button>
                )}
                {!rec.closed && (
                  <button onClick={() => markClosed(rec.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-success/10 text-success border border-success/20 hover:bg-success/20 transition-colors font-medium"
                    title="Marcar como venta cerrada">
                    <Trophy size={13} /> Cerrada
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
