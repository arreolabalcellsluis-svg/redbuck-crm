/**
 * Daily Assistant Page — Uses real DB data.
 * Shows actionable commercial recommendations based on quotations, activities, and customers.
 */
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuotations } from '@/hooks/useQuotations';
import { useActivities } from '@/hooks/useActivities';
import { useCustomers } from '@/hooks/useCustomers';
import { useOrders } from '@/hooks/useOrders';
import { useTeamMembers } from '@/hooks/useTeamMembers';
import { getActivitiesForDate, getOverdueActivities, getPendingActivities } from '@/lib/agendaEngine';
import MetricCard from '@/components/shared/MetricCard';
import { Input } from '@/components/ui/input';
import {
  Brain, Search, Phone, MessageCircle, FileText,
  CheckCircle2, Zap, Target, TrendingUp, AlertTriangle, Clock, CalendarDays,
} from 'lucide-react';

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);

const TODAY = new Date().toISOString().split('T')[0];

interface Recommendation {
  id: string;
  customerName: string;
  vendorName: string;
  reason: string;
  priority: 'alta' | 'media' | 'baja';
  value: number;
  action: string;
  detail: string;
}

const PRIORITY_STYLES: Record<string, string> = {
  alta: 'bg-destructive/10 text-destructive border-destructive/20',
  media: 'bg-warning/10 text-warning border-warning/20',
  baja: 'bg-muted text-muted-foreground border-border',
};

export default function DailyAssistantPage() {
  const navigate = useNavigate();
  const { data: dbQuotations = [] } = useQuotations();
  const { data: dbActivities = [] } = useActivities();
  const { data: dbCustomers = [] } = useCustomers();
  const { data: dbOrders = [] } = useOrders();
  const { data: dbTeam = [] } = useTeamMembers();

  const [search, setSearch] = useState('');
  const [filterPriority, setFilterPriority] = useState<string>('');

  // ─── Real KPIs ──────────────────────────────────────────
  const allTodayActs = useMemo(() => getActivitiesForDate(dbActivities, TODAY), [dbActivities]);
  const allOverdue = useMemo(() => getOverdueActivities(dbActivities, TODAY), [dbActivities]);
  const allPending = useMemo(() => getPendingActivities(dbActivities), [dbActivities]);
  const todayPendingCount = allTodayActs.filter(a => a.status === 'pendiente' || a.status === 'en_proceso').length;
  const todayDoneCount = allTodayActs.filter(a => a.status === 'realizada').length;

  // Generate recommendations from real data
  const recommendations = useMemo<Recommendation[]>(() => {
    const recs: Recommendation[] = [];

    // 1. Hot quotations (seguimiento/vista status)
    dbQuotations
      .filter(q => q.status === 'seguimiento' || q.status === 'vista')
      .forEach(q => {
        recs.push({
          id: `hot-${q.id}`,
          customerName: q.customer_name,
          vendorName: q.vendor_name,
          reason: 'Cotización caliente',
          priority: 'alta',
          value: q.total,
          action: 'Dar seguimiento inmediato',
          detail: `Cotización ${q.folio} — ${fmt(q.total)}`,
        });
      });

    // 2. Open quotations without follow-up
    dbQuotations
      .filter(q => q.status === 'enviada')
      .forEach(q => {
        recs.push({
          id: `open-${q.id}`,
          customerName: q.customer_name,
          vendorName: q.vendor_name,
          reason: 'Cotización abierta',
          priority: 'media',
          value: q.total,
          action: 'Contactar cliente',
          detail: `Cotización ${q.folio} enviada — pendiente respuesta`,
        });
      });

    // 3. Overdue activities (high priority)
    allOverdue.forEach(a => {
      recs.push({
        id: `overdue-${a.id}`,
        customerName: a.customerName || a.leadName || 'Sin cliente',
        vendorName: a.responsibleName,
        reason: 'Actividad vencida',
        priority: 'alta',
        value: 0,
        action: a.title,
        detail: `${a.type} — Vencida desde ${a.date}`,
      });
    });

    // 4. Pending activities for today
    allTodayActs
      .filter(a => a.status === 'pendiente' || a.status === 'en_proceso')
      .forEach(a => {
        recs.push({
          id: `act-${a.id}`,
          customerName: a.customerName || a.leadName || 'Sin cliente',
          vendorName: a.responsibleName,
          reason: 'Actividad pendiente hoy',
          priority: a.priority === 'alta' ? 'alta' : 'media',
          value: 0,
          action: a.title,
          detail: `${a.type}${a.time ? ` — ${a.time}` : ''} — ${a.notes || 'Sin notas'}`,
        });
      });

    return recs.sort((a, b) => {
      const pOrder: Record<string, number> = { alta: 0, media: 1, baja: 2 };
      const pd = (pOrder[a.priority] ?? 2) - (pOrder[b.priority] ?? 2);
      if (pd !== 0) return pd;
      // Within same priority, higher value first
      return b.value - a.value;
    });
  }, [dbQuotations, dbActivities, allOverdue, allTodayActs]);

  const filtered = useMemo(() => {
    let data = recommendations;
    if (search) {
      const s = search.toLowerCase();
      data = data.filter(r => r.customerName.toLowerCase().includes(s) || r.vendorName.toLowerCase().includes(s) || r.reason.toLowerCase().includes(s));
    }
    if (filterPriority) data = data.filter(r => r.priority === filterPriority);
    return data;
  }, [recommendations, search, filterPriority]);

  const highCount = recommendations.filter(r => r.priority === 'alta').length;
  const totalValue = recommendations.filter(r => r.value > 0).reduce((s, r) => s + r.value, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-display text-foreground flex items-center gap-3">
          <Brain size={24} className="text-primary" />
          Asistente Comercial Diario
        </h1>
        <p className="text-sm text-muted-foreground">
          Recomendaciones priorizadas basadas en cotizaciones, actividades y clientes reales.
        </p>
      </div>

      {/* KPIs — clickable, from real unfiltered data */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <button onClick={() => navigate('/crm/agenda')} className="text-left">
          <MetricCard title="Hoy pendientes" value={todayPendingCount} icon={Clock} variant="warning" />
        </button>
        <button onClick={() => navigate('/crm/agenda')} className="text-left">
          <MetricCard title="Vencidas" value={allOverdue.length} icon={AlertTriangle} variant="danger" />
        </button>
        <button onClick={() => navigate('/crm/agenda')} className="text-left">
          <MetricCard title="Realizadas hoy" value={todayDoneCount} icon={CheckCircle2} variant="success" />
        </button>
        <button onClick={() => navigate('/crm/agenda')} className="text-left">
          <MetricCard title="Total pendientes" value={allPending.length} icon={CalendarDays} variant="primary" />
        </button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative max-w-sm">
          <Search size={14} className="absolute left-2.5 top-2.5 text-muted-foreground" />
          <Input
            placeholder="Buscar cliente o vendedor..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>
        <div className="flex gap-1">
          {['', 'alta', 'media', 'baja'].map(p => (
            <button
              key={p}
              onClick={() => setFilterPriority(p)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                filterPriority === p
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {p === '' ? 'Todas' : p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-card rounded-xl border p-12 text-center">
          <Brain size={40} className="mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No hay recomendaciones pendientes.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Crea cotizaciones y registra actividades para que el asistente genere oportunidades.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(rec => (
            <div
              key={rec.id}
              className={`bg-card rounded-xl border p-4 hover:shadow-md transition-all ${PRIORITY_STYLES[rec.priority]}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${PRIORITY_STYLES[rec.priority]}`}>
                      {rec.priority.toUpperCase()}
                    </span>
                    <span className="text-xs text-muted-foreground">{rec.reason}</span>
                  </div>
                  <h4 className="font-semibold text-sm">{rec.customerName}</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">{rec.detail}</p>
                  <p className="text-xs font-medium text-primary mt-1">→ {rec.action}</p>
                </div>
                <div className="text-right shrink-0">
                  {rec.value > 0 && <div className="text-sm font-bold">{fmt(rec.value)}</div>}
                  <div className="text-[10px] text-muted-foreground">{rec.vendorName}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
